import type { DeepImportItem } from "./types";

// PURE shaping for the LeetCode deep import. No DOM, no fetch - unit-testable in isolation
// (test/deep-leetcode.test.ts runs it against real captured rows).
// Verified live (session #11): the SESSION REST endpoint
//   `GET /api/submissions/?offset=<n>&limit=<n>`  (credentials: include)
// returns `{ submissions_dump: [...], has_next, last_key }` and every row already carries the
// full `code` inline plus id, lang, lang_name, status/status_display, runtime, memory,
// timestamp, title, title_slug, question_id, frontend_id, url. That single paginated endpoint
// is a strictly better source than the GraphQL `submissionDetails` / `questionSubmissionList`
// pair (full history + code in one call), so the deep import is built entirely on it. Problem
// metadata (difficulty/tags/statement) is enriched separately via the `question(slug)` GraphQL
// query the live-capture parser already uses.

export interface LcSubmissionRow {
  id?: number;
  question_id?: number;
  // NOTE: `frontend_id` on /api/submissions/ rows is a PER-USER submission counter (it
  // decrements 16,15,14 across older submissions of the SAME problem) - it is NOT the public
  // problem number. The canonical number comes from the question(slug) enrichment below.
  frontend_id?: number;
  title?: string; // the problem title (no number)
  title_slug?: string;
  lang?: string;
  lang_name?: string;
  status?: number; // 10 == Accepted
  status_display?: string;
  runtime?: string;
  memory?: string;
  timestamp?: number; // epoch SECONDS
  url?: string; // "/submissions/detail/<id>/"
  code?: string;
}

// Per-problem metadata fetched from the `question(titleSlug)` GraphQL query (the same one the
// live-capture parser + server import use). Provides the CANONICAL problem number/title so the
// imported problem matches whatever a live capture or the web import produced for the same slug.
export interface LcEnrichment {
  frontendId?: string; // questionFrontendId - the real public problem number
  title?: string; // problem title (no number)
  difficulty?: string; // "Easy" | "Medium" | "Hard"
  tags?: string[];
  statement?: string; // already plain text
}

// LeetCode `lang` slug -> our solution-language enum. Default "other".
const LC_LANG: Record<string, string> = {
  cpp: "cpp",
  c: "cpp",
  java: "java",
  python: "python",
  python3: "python",
  golang: "go",
  go: "go",
  rust: "rust",
  javascript: "js",
  typescript: "js",
};

export function lcMapLanguage(lang: string | undefined | null): string {
  return LC_LANG[(lang || "").toLowerCase()] ?? "other";
}

// Mirror lib/difficulty.ts lcDifficultyToNorm. Inlined to keep this module import-free.
export function lcDifficultyToNorm(difficulty: string | undefined | null): string {
  switch ((difficulty || "").toLowerCase()) {
    case "easy":
      return "easy";
    case "medium":
      return "medium";
    case "hard":
      return "hard";
    default:
      return "unknown";
  }
}

export function isLcAccepted(row: LcSubmissionRow): boolean {
  return row?.status === 10 || row?.status_display === "Accepted";
}

// One earliest-accepted submission per problem (by title_slug), keeping the first-AC timestamp
// as the solve date - consistent with the CF path and the server import.
export function lcEarliestAccepted(rows: LcSubmissionRow[]): LcSubmissionRow[] {
  const bySlug = new Map<string, LcSubmissionRow>();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!isLcAccepted(row)) continue;
    const slug = row.title_slug;
    if (!slug || row.id == null) continue;
    const ts = typeof row.timestamp === "number" ? row.timestamp : Infinity;
    const existing = bySlug.get(slug);
    const ets =
      existing && typeof existing.timestamp === "number" ? existing.timestamp : Infinity;
    if (existing && ets <= ts) continue; // keep the earlier AC
    bySlug.set(slug, row);
  }
  return Array.from(bySlug.values());
}

// Build the import item for one accepted submission row (+ optional enrichment). Canonical URL
// matches the live-capture parser AND the server import (`/problems/<slug>`, no trailing slash).
export function buildLcItem(row: LcSubmissionRow, enrich?: LcEnrichment): DeepImportItem {
  const slug = row.title_slug as string;
  const solvedAt =
    typeof row.timestamp === "number"
      ? new Date(row.timestamp * 1000).toISOString()
      : undefined;
  // Canonical number/title from enrichment (NOT row.frontend_id - see LcSubmissionRow note).
  const fid = enrich?.frontendId;
  const problemTitle = enrich?.title || row.title || slug;
  const title = fid ? `${fid}. ${problemTitle}` : problemTitle;

  const item: DeepImportItem = {
    problem: {
      url: `https://leetcode.com/problems/${slug}`,
      title,
      platform: "leetcode",
      platform_id: fid || undefined,
      difficulty_raw: enrich?.difficulty || undefined,
      difficulty_norm: enrich?.difficulty ? lcDifficultyToNorm(enrich.difficulty) : undefined,
      source_tags: Array.isArray(enrich?.tags) ? enrich!.tags : [],
      statement: enrich?.statement,
      solved_at: solvedAt,
    },
  };

  if (typeof row.code === "string" && row.code.trim()) {
    item.solution = {
      language: lcMapLanguage(row.lang),
      code: row.code,
      submitted_at: solvedAt,
      verdict: row.status_display || "Accepted",
      is_accepted: true,
      runtime: row.runtime || undefined,
      memory: row.memory || undefined,
      submission_url: row.url ? `https://leetcode.com${row.url}` : undefined,
      source_submission_id: `lc:${row.id}`,
    };
  }
  return item;
}
