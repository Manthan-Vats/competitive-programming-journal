import { PLATFORMS, DIFFICULTIES } from "@/lib/difficulty";

// Pure validation + shaping of a capture/import payload into an insertable `problems` row.
// DB-FREE on purpose (no Supabase import) so it can be reused and unit-tested in isolation;
// the DB-touching `resolveOrCreateProblem` lives in capture-problem.ts and imports this.
// PLATFORMS / DIFFICULTIES allowlists are the single source of truth in lib/difficulty.ts.

export interface CaptureInput {
  url?: unknown;
  title?: unknown;
  platform?: unknown;
  platform_id?: unknown;
  difficulty_raw?: unknown;
  difficulty_norm?: unknown;
  source_tags?: unknown;
  statement?: unknown;
  metadata?: unknown;
  solved_at?: unknown;
}

// A validated, ready-to-insert problems row (minus DB defaults). Shared by the single capture
// path (resolveOrCreateProblem) and the bulk import path so both apply identical shaping.
export interface ProblemRow {
  user_id: string;
  url: string;
  title: string;
  platform: string;
  platform_id: string | null;
  difficulty_raw: string | null;
  difficulty_norm: string;
  source_tags: string[];
  custom_tags: string[];
  statement: string | null;
  metadata: Record<string, unknown>;
  solved_at: string | null;
  is_public: boolean;
  is_featured: boolean;
}

// Returns an error (no DB access) if the required url/title are missing.
export function buildProblemRow(
  userId: string,
  input: CaptureInput
): { row: ProblemRow } | { error: string; status: number } {
  // Cap url/title length: this shaper feeds every capture/import path off an untrusted payload,
  // so an unbounded string here would let a token store a multi-MB blob per row.
  const url = typeof input.url === "string" ? input.url.trim().slice(0, 2048) : "";
  const title = typeof input.title === "string" ? input.title.trim().slice(0, 512) : "";
  if (!url || !title) {
    return { error: "Missing required problem fields (url, title)", status: 400 };
  }

  const platform =
    typeof input.platform === "string" && PLATFORMS.has(input.platform)
      ? input.platform
      : "other";
  const difficulty_norm =
    typeof input.difficulty_norm === "string" && DIFFICULTIES.has(input.difficulty_norm)
      ? input.difficulty_norm
      : "unknown";
  const source_tags = Array.isArray(input.source_tags)
    ? input.source_tags.filter((t): t is string => typeof t === "string").slice(0, 40)
    : [];
  const statement =
    typeof input.statement === "string" ? input.statement.slice(0, 12000) : null;
  let metadata: Record<string, unknown> = {};
  if (
    input.metadata &&
    typeof input.metadata === "object" &&
    !Array.isArray(input.metadata) &&
    JSON.stringify(input.metadata).length <= 4000
  ) {
    metadata = input.metadata as Record<string, unknown>;
  }
  // Accept an ISO/parseable solve timestamp; store normalized to ISO, else null.
  const solved_at =
    typeof input.solved_at === "string" && !Number.isNaN(Date.parse(input.solved_at))
      ? new Date(input.solved_at).toISOString()
      : null;

  return {
    row: {
      user_id: userId,
      url,
      title,
      platform,
      platform_id: typeof input.platform_id === "string" ? input.platform_id.slice(0, 120) : null,
      difficulty_raw:
        typeof input.difficulty_raw === "string" ? input.difficulty_raw.slice(0, 120) : null,
      difficulty_norm,
      source_tags,
      custom_tags: [],
      statement,
      metadata,
      solved_at,
      is_public: false, // private by default
      is_featured: false,
    },
  };
}
