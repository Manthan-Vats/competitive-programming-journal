import type { CaptureInput } from "@/lib/ext/problem-row";
import { htmlToReadableText } from "@/lib/import/html-text";
import { cfRatingToDifficulty, lcDifficultyToNorm } from "@/lib/difficulty";

// Server-side bulk fetch of a user's SOLVED problems from a judge, by public handle.
// Returns CaptureInput[] shaped to match the extension parsers' output EXACTLY (same
// canonical url / title / platform_id) so the per-user URL dedupe lines up whether a
// problem was captured live or imported here.
// Verified live (2026-06-16):
//   - Codeforces `user.status` returns every submission with problem.{rating,tags} inline
//     -> one call yields the full solved history WITH metadata (no enrichment needed).
//   - LeetCode `recentAcSubmissionList(username, limit)` is HARD-CAPPED at 20 most-recent
//     ACs anonymously; there is no anonymous "all solved" endpoint. We enrich each via the
//     `question(titleSlug)` query (same one the extension parser uses) for id/difficulty/tags.

export type JudgeFetch =
  | { items: CaptureInput[] }
  | { error: string };

const TIMEOUT_MS = 15000;

async function fetchJson(url: string, init?: RequestInit): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

//  Codeforces

interface CfSubmission {
  verdict?: string;
  creationTimeSeconds?: number;
  problem?: {
    contestId?: number;
    index?: string;
    name?: string;
    rating?: number;
    tags?: string[];
  };
}

export async function fetchCodeforcesSolved(handle: string): Promise<JudgeFetch> {
  const h = handle.trim();
  if (!h) return { items: [] };

  let json: any;
  try {
    json = await fetchJson(
      `https://codeforces.com/api/user.status?handle=${encodeURIComponent(h)}`
    );
  } catch (err: any) {
    return { error: `Codeforces fetch failed: ${err.message || err}` };
  }
  if (json?.status !== "OK" || !Array.isArray(json.result)) {
    return { error: json?.comment || "Codeforces returned an unexpected response." };
  }

  // One CaptureInput per accepted problem (dedupe by contestId-index). Keep the EARLIEST
  // OK submission's time as the solve date (the journal cares about first-AC, not the last
  // re-submit). Skip anything without a contestId/index (e.g. acmsguru / malformed).
  const byKey = new Map<string, { item: CaptureInput; ts: number }>();
  for (const sub of json.result as CfSubmission[]) {
    if (sub.verdict !== "OK") continue;
    const p = sub.problem;
    if (!p || p.contestId == null || !p.index) continue;
    const index = String(p.index).toUpperCase();
    const key = `${p.contestId}-${index}`;
    const ts = typeof sub.creationTimeSeconds === "number" ? sub.creationTimeSeconds : Infinity;

    const existing = byKey.get(key);
    if (existing && existing.ts <= ts) continue; // keep the earlier AC

    // Canonical URL must match codeforcesParser: `${origin}${pathname}` with no trailing
    // slash -> the live contest-page capture form.
    byKey.set(key, {
      ts,
      item: {
        url: `https://codeforces.com/contest/${p.contestId}/problem/${index}`,
        title: p.name ? `${index}. ${p.name}` : `${index}`,
        platform: "codeforces",
        platform_id: `${p.contestId}${index}`,
        difficulty_raw: typeof p.rating === "number" ? String(p.rating) : undefined,
        difficulty_norm: cfRatingToDifficulty(p.rating),
        source_tags: Array.isArray(p.tags) ? p.tags : [],
        solved_at:
          typeof sub.creationTimeSeconds === "number"
            ? new Date(sub.creationTimeSeconds * 1000).toISOString()
            : undefined,
      },
    });
  }
  return { items: Array.from(byKey.values()).map((v) => v.item) };
}

//  LeetCode

const LC_RECENT_QUERY =
  "query($username:String!,$limit:Int!){recentAcSubmissionList(username:$username,limit:$limit){titleSlug timestamp}}";
const LC_QUESTION_QUERY =
  "query q($titleSlug:String!){question(titleSlug:$titleSlug){" +
  "questionFrontendId title difficulty topicTags{name} content}}";

async function lcGraphql(query: string, variables: Record<string, unknown>): Promise<any> {
  return fetchJson("https://leetcode.com/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Referer: "https://leetcode.com" },
    body: JSON.stringify({ query, variables }),
  });
}

export async function fetchLeetcodeSolved(handle: string): Promise<JudgeFetch> {
  const h = handle.trim();
  if (!h) return { items: [] };

  let recent: any;
  try {
    recent = await lcGraphql(LC_RECENT_QUERY, { username: h, limit: 20 });
  } catch (err: any) {
    return { error: `LeetCode fetch failed: ${err.message || err}` };
  }
  const list = recent?.data?.recentAcSubmissionList;
  if (!Array.isArray(list)) {
    return { error: "LeetCode returned an unexpected response (check the handle)." };
  }

  // Dedupe slugs (recent list can repeat a problem solved multiple times). Keep the
  // EARLIEST timestamp seen per slug as the solve date (first AC among the recent window).
  const earliestTs = new Map<string, number>();
  for (const s of list as any[]) {
    if (typeof s?.titleSlug !== "string") continue;
    const ts = Number(s.timestamp);
    const prev = earliestTs.get(s.titleSlug);
    if (prev === undefined || (Number.isFinite(ts) && ts < prev)) {
      earliestTs.set(s.titleSlug, Number.isFinite(ts) ? ts : prev ?? NaN);
    }
  }
  const slugs = Array.from(earliestTs.keys());

  // Enrich each (≤20) for id/difficulty/tags/statement. Sequential to stay gentle on the
  // endpoint; a single failure degrades that one problem to a bare title rather than abort.
  const items: CaptureInput[] = [];
  for (const slug of slugs) {
    let q: any = null;
    try {
      const res = await lcGraphql(LC_QUESTION_QUERY, { titleSlug: slug });
      q = res?.data?.question ?? null;
    } catch {
      q = null;
    }
    const title =
      q?.questionFrontendId && q?.title
        ? `${q.questionFrontendId}. ${q.title}`
        : q?.title || slug;
    const tags = Array.isArray(q?.topicTags)
      ? q.topicTags.map((t: any) => t?.name).filter((n: unknown): n is string => !!n)
      : [];
    // LeetCode's content HTML is fetched anonymously; convert to readable plain text.
    const statement =
      typeof q?.content === "string" && q.content
        ? htmlToReadableText(q.content).slice(0, 4000)
        : undefined;
    const ts = earliestTs.get(slug);
    items.push({
      // Match leetcodeParser: `${origin}/problems/${slug}` (no trailing slash).
      url: `https://leetcode.com/problems/${slug}`,
      title,
      platform: "leetcode",
      platform_id: q?.questionFrontendId ? String(q.questionFrontendId) : undefined,
      difficulty_raw: q?.difficulty || undefined,
      difficulty_norm: q?.difficulty ? lcDifficultyToNorm(q.difficulty) : undefined,
      source_tags: tags,
      statement,
      solved_at:
        ts !== undefined && Number.isFinite(ts)
          ? new Date(ts * 1000).toISOString()
          : undefined,
    });
  }
  return { items };
}
