import { analyzeCode } from "@/lib/ai/analyze-code";
import { AINotConfiguredError } from "@/lib/ai";
import { aiNormalizePatterns } from "@/lib/ai/normalize-patterns";
import { createClient } from "@/lib/supabase/server";

// The session-scoped Supabase client (what the API routes hold). Typing the param off the
// factory keeps it in lockstep with whatever createClient returns.
type DbClient = Awaited<ReturnType<typeof createClient>>;

export interface RunAnalysisResult {
  success: boolean;
  analysis?: unknown;
  error?: string;
  /**
   * Distinguishes outcomes so callers can pick a status code:
   *  - not_found / forbidden: ownership / existence problems
   *  - unconfigured: AI is turned off (no provider key) - a clean degraded state, NOT a failure.
   */
  code?: "not_found" | "forbidden" | "unconfigured";
}

// Run AI analysis for one solution IN-PROCESS. Shared by POST /api/analyze and the solution
// create/update paths.
// Why in-process: the create/update routes used to fire-and-forget a self-`fetch` to
// /api/analyze with the caller's cookies forwarded. On serverless the function is frozen
// once it returns its response, so that background request was routinely dropped and
// ai_status got stuck on "pending". Calling analyzeCode directly removes both the dropped-
// work problem and the (fragile) cookie forwarding.
// Asserts the solution belongs to `userId` (defense-in-depth on top of RLS). NEVER throws:
// any failure is recorded as ai_status="failed" and returned as {success:false}, so an AI
// outage can't fail the surrounding create/update.
export async function runAnalysis(
  supabase: DbClient,
  solutionId: string,
  userId: string
): Promise<RunAnalysisResult> {
  try {
    const { data: solution, error: fetchErr } = await supabase
      .from("solutions")
      .select("*, problems:problems(*)")
      .eq("id", solutionId)
      .maybeSingle();

    if (fetchErr || !solution) {
      return { success: false, error: "Solution not found", code: "not_found" };
    }
    // Ownership assert atop RLS (P1-6). RLS already scopes this read, but assert explicitly
    // so a future RLS change can't silently let one user analyze another's solution.
    if (solution.user_id !== userId) {
      return { success: false, error: "Forbidden", code: "forbidden" };
    }

    const problem = solution.problems;

    await supabase
      .from("solutions")
      .update({ ai_status: "pending" })
      .eq("id", solutionId);

    const { data: analysisResult, model } = await analyzeCode(
      {
        title: problem.title,
        platform: problem.platform,
        source_tags: problem.source_tags || [],
      },
      {
        language: solution.language,
        code: solution.code,
      }
    );

    // Normalize the AI's rich tags onto the canonical pattern set (P4 D5). This is the AI-augmented
    // pattern mapping: feeding the model's algorithm/DS/technique tags through the canonical map
    // gives far better coverage than judge tags alone. Static-first, so it's instant unless a tag
    // is unseen - and we're already in the background analysis path, so any AI fallback is free of
    // user-facing latency. Stored alongside the raw response (no schema change needed).
    const patterns = await aiNormalizePatterns([
      ...(analysisResult.algorithms || []),
      ...(analysisResult.data_structures || []),
      ...(analysisResult.techniques || []),
      ...(analysisResult.math_concepts || []),
    ]);

    // Replace any prior analysis for this solution to prevent duplicates.
    await supabase.from("ai_analyses").delete().eq("solution_id", solutionId);

    const { error: insertErr } = await supabase.from("ai_analyses").insert({
      user_id: userId,
      solution_id: solutionId,
      algorithms: analysisResult.algorithms || [],
      data_structures: analysisResult.data_structures || [],
      techniques: analysisResult.techniques || [],
      math_concepts: analysisResult.math_concepts || [],
      confidence: analysisResult.confidence || "medium",
      raw_response: { ...analysisResult, patterns },
      model_used: model, // the model that actually produced this (after any provider fallback)
    });
    if (insertErr) throw insertErr;

    const { error: updateErr } = await supabase
      .from("solutions")
      .update({ ai_status: "done" })
      .eq("id", solutionId);
    if (updateErr) throw updateErr;

    return { success: true, analysis: analysisResult };
  } catch (err: any) {
    // AI turned off (no provider key) is NOT a failure - leave the solution analyzable so the user
    // can run it later once a key is set. Reset to "none" rather than "failed".
    if (err instanceof AINotConfiguredError) {
      try {
        await supabase.from("solutions").update({ ai_status: "none" }).eq("id", solutionId);
      } catch {
        // best-effort
      }
      return { success: false, error: "AI is not configured", code: "unconfigured" };
    }

    console.error("AI Analysis failed:", err);
    try {
      await supabase
        .from("solutions")
        .update({ ai_status: "failed" })
        .eq("id", solutionId);
    } catch {
      // best-effort status write; don't mask the original error
    }
    return { success: false, error: err?.message || "AI Analysis failed" };
  }
}
