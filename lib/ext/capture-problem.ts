import { createAdminClient } from "@/lib/supabase/server";
import {
  buildProblemRow,
  type CaptureInput,
  type ProblemRow,
} from "@/lib/ext/problem-row";

// Shared "find the user's problem by URL, or create it from a capture payload" used by the
// extension endpoints (capture / timer / solution). Auto-adding on first timer/solution means
// the user doesn't have to Capture separately before timing or attaching code.
// Uses the service-role client (the extension is bearer-authed, not a Supabase session), so
// the caller MUST pass the resolved userId and we stamp it on every row.
// The PURE shaping (buildProblemRow + CaptureInput/ProblemRow) lives in problem-row.ts (DB-free
// so it's unit-testable); re-exported here so existing importers of @/lib/ext/capture-problem
// keep working.

export { buildProblemRow };
export type { CaptureInput, ProblemRow };

export type ResolveResult =
  | { problemId: string; created: boolean }
  | { error: string; status: number };

export async function resolveOrCreateProblem(
  userId: string,
  input: CaptureInput
): Promise<ResolveResult> {
  const built = buildProblemRow(userId, input);
  if ("error" in built) return built;
  const { row } = built;

  const admin = createAdminClient();

  // Per-user URL dedupe (matches the unique (user_id, url) constraint).
  const { data: existing } = await admin
    .from("problems")
    .select("id")
    .eq("user_id", userId)
    .eq("url", row.url)
    .maybeSingle();
  if (existing) return { problemId: existing.id, created: false };

  const { data: created, error } = await admin
    .from("problems")
    .insert(row)
    .select("id")
    .single();

  if (error) return { error: error.message, status: 500 };
  return { problemId: created.id, created: true };
}
