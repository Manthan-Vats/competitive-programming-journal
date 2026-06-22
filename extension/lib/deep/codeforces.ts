import type { DeepImportItem } from "./types";

// PURE shaping for the Codeforces deep import. No DOM, no fetch, no wxt/browser - so it is
// unit-testable in isolation (test/deep-codeforces.test.ts runs it against real captured data).
// Verified live (session #11) against the user's logged-in account:
//   - `GET /api/user.status?handle=<h>` (anon) yields EVERY submission with id, verdict,
//     programmingLanguage, timeConsumedMillis, memoryConsumedBytes, creationTimeSeconds and
//     problem.{contestId,index,name,rating,tags} inline. So everything EXCEPT the source code
//     is already here.
//   - `POST /data/submitSource` body `submissionId=<id>&csrf_token=<csrf>` (session, +X-Csrf-Token
//     header) returns a flat object whose `source` field is the submitted code (the rest is
//     per-test I/O we discard). The content script does that fetch; this module just shapes.

export interface CfSubmission {
  id?: number;
  contestId?: number;
  creationTimeSeconds?: number;
  programmingLanguage?: string;
  verdict?: string;
  timeConsumedMillis?: number;
  memoryConsumedBytes?: number;
  problem?: {
    contestId?: number;
    index?: string;
    name?: string;
    rating?: number;
    tags?: string[];
  };
}

export interface CfAccepted {
  sub: CfSubmission;
  contestId: number;
  index: string; // upper-cased
  key: string; // `${contestId}-${index}`
}

// Map a Codeforces `programmingLanguage` string ("C++17 (GCC 7-32)", "PyPy 3-64", "Java 21",
// "Rust 2021", "Node.js", "GNU C11", "Kotlin 1.9") to our solution-language enum. Order
// matters: check JavaScript/Node before \bjava\b so "JavaScript" doesn't fall into "java".
export function cfMapLanguage(lang: string | undefined | null): string {
  const s = (lang || "").toLowerCase();
  if (!s) return "other";
  if (/c\+\+|cpp|clang\+\+|g\+\+/.test(s)) return "cpp";
  if (/python|pypy/.test(s)) return "python";
  if (/javascript|node\.?js|\bjs\b/.test(s)) return "js";
  if (/\bjava\b|\bjava\d/.test(s)) return "java";
  if (/\bgo\b|golang/.test(s)) return "go";
  if (/rust/.test(s)) return "rust";
  return "other";
}

// Mirror lib/difficulty.ts cfRatingToDifficulty (1300/1900/2400). Inlined to keep this module
// free of the web `@/` imports / wxt/browser so it stays unit-testable in the extension.
export function cfRatingToDifficulty(rating: number | undefined | null): string {
  if (!rating || rating <= 0) return "unknown";
  if (rating < 1300) return "easy";
  if (rating < 1900) return "medium";
  if (rating < 2400) return "hard";
  return "expert";
}

// One earliest-accepted submission per problem (the journal cares about first-AC, like the
// existing server import). Skips non-OK, malformed, and acmsguru/gym rows without contestId.
export function cfEarliestAccepted(subs: CfSubmission[]): CfAccepted[] {
  const byKey = new Map<string, CfAccepted & { ts: number }>();
  for (const sub of Array.isArray(subs) ? subs : []) {
    if (sub?.verdict !== "OK") continue;
    const p = sub.problem;
    const contestId = p?.contestId;
    if (contestId == null || !p?.index || sub.id == null) continue;
    const index = String(p.index).toUpperCase();
    const key = `${contestId}-${index}`;
    const ts =
      typeof sub.creationTimeSeconds === "number" ? sub.creationTimeSeconds : Infinity;
    const existing = byKey.get(key);
    if (existing && existing.ts <= ts) continue; // keep the earlier AC
    byKey.set(key, { sub, contestId, index, key, ts });
  }
  return Array.from(byKey.values()).map(({ sub, contestId, index, key }) => ({
    sub,
    contestId,
    index,
    key,
  }));
}

// Build the import item for one accepted submission + its fetched source. Canonical problem URL
// matches the live-capture parser AND the server import (`/contest/<cid>/problem/<INDEX>`) so the
// per-user (user_id,url) dedupe lines up however the problem first entered the journal. When the
// source couldn't be read, the solution is omitted (the problem is still imported).
export function buildCfItem(acc: CfAccepted, source: string | null): DeepImportItem {
  const { sub, contestId, index } = acc;
  const p = sub.problem ?? {};
  const solvedAt =
    typeof sub.creationTimeSeconds === "number"
      ? new Date(sub.creationTimeSeconds * 1000).toISOString()
      : undefined;

  const item: DeepImportItem = {
    problem: {
      url: `https://codeforces.com/contest/${contestId}/problem/${index}`,
      title: p.name ? `${index}. ${p.name}` : index,
      platform: "codeforces",
      platform_id: `${contestId}${index}`,
      difficulty_raw: typeof p.rating === "number" ? String(p.rating) : undefined,
      difficulty_norm: cfRatingToDifficulty(p.rating),
      source_tags: Array.isArray(p.tags) ? p.tags : [],
      solved_at: solvedAt,
    },
  };

  if (source && source.trim()) {
    item.solution = {
      language: cfMapLanguage(sub.programmingLanguage),
      code: source,
      submitted_at: solvedAt,
      verdict: "OK",
      is_accepted: true,
      runtime:
        typeof sub.timeConsumedMillis === "number"
          ? `${sub.timeConsumedMillis} ms`
          : undefined,
      memory:
        typeof sub.memoryConsumedBytes === "number"
          ? `${Math.round(sub.memoryConsumedBytes / 1024)} KB`
          : undefined,
      submission_url: `https://codeforces.com/contest/${contestId}/submission/${sub.id}`,
      // Judge-prefixed so it can never collide with a LeetCode id under the per-user
      // (user_id, source_submission_id) unique index.
      source_submission_id: `cf:${sub.id}`,
    };
  }
  return item;
}
