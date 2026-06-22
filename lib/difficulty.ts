// Single source of truth for problem enums + judge difficulty bucketing. Shared by the
// capture/import paths, the manual create path, and the metadata lookup so allowlists and
// difficulty mapping can't drift between routes (audit P2-1, P2-5).

export const PLATFORMS = new Set([
  "codeforces",
  "leetcode",
  "atcoder",
  "spoj",
  "cses",
  "hackerrank",
  "hackerearth",
  "codechef",
  "other",
]);

export const DIFFICULTIES = new Set(["easy", "medium", "hard", "expert", "unknown"]);

// Allowed solution languages (mirrors the `Language` type in types/index.ts and the admin
// solution form's <Select> options). Shared by every code-accepting route so the allowlist
// can't drift between the web and extension paths.
export const SOLUTION_LANGUAGES = new Set([
  "cpp",
  "python",
  "java",
  "go",
  "rust",
  "js",
  "other",
]);

// Cap on stored solution source length (chars). Mirrors the extension solution route.
export const MAX_CODE_LENGTH = 100000;

export function isLanguage(value: unknown): value is string {
  return typeof value === "string" && SOLUTION_LANGUAGES.has(value);
}

export function isPlatform(value: unknown): value is string {
  return typeof value === "string" && PLATFORMS.has(value);
}

export function isDifficultyNorm(value: unknown): value is string {
  return typeof value === "string" && DIFFICULTIES.has(value);
}

// Codeforces problem rating -> coarse bucket. ONE canonical set of thresholds (the metadata
// route previously used 1200/1800 while the import + extension paths used 1300/1900; this
// reconciles them on the 1300/1900/2400 boundaries the extension/import already shipped with).
export function cfRatingToDifficulty(rating: number | undefined | null): string {
  if (!rating || rating <= 0) return "unknown";
  if (rating < 1300) return "easy";
  if (rating < 1900) return "medium";
  if (rating < 2400) return "hard";
  return "expert";
}

// LeetCode Easy/Medium/Hard -> our normalized bucket.
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
