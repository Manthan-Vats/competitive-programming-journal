import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runAnalysis } from "@/lib/analyze";
import { isAIConfigured, aiChainLabel } from "@/lib/ai";
import { getUserGeminiKey } from "@/lib/ai/user-key";
import { rateLimit } from "@/lib/rate-limit";
import { errorResponse } from "@/lib/api-error";

// Backfill AI analysis across many solutions (P-AI #2). Imported/synced solutions arrive with
// ai_status="none" (the bulk import never spends a model call), so a fresh account can have lots of
// un-analyzed code. This endpoint processes a small BOUNDED batch per call; the client loops it with
// progress. Bounded + rate-limited so it can't blow the provider's free quota or a serverless time
// budget. AI-optional: 503 (not an error) when no provider is configured.

export const runtime = "nodejs";
export const maxDuration = 60;

// Small enough that a handful of sequential model calls finishes inside a serverless time budget;
// the client repeats until `remaining` is 0.
const MAX_PER_CALL = 4;

// How long a solution may sit in "pending" before we consider it STUCK (its analysis was interrupted
// - e.g. the serverless function died mid-call) and eligible for retry. Long enough not to collide
// with an in-flight create/edit analysis.
const STALE_PENDING_MS = 3 * 60 * 1000;

// PostgREST `.or()` filter for solutions that need analysis: never analyzed (null/none), a previous
// attempt failed, OR stuck in pending past the stale window. Recomputed per call for a fresh cutoff.
function needsFilter(): string {
  const staleCutoff = new Date(Date.now() - STALE_PENDING_MS).toISOString();
  return `ai_status.is.null,ai_status.eq.none,ai_status.eq.failed,and(ai_status.eq.pending,updated_at.lt.${staleCutoff})`;
}

async function countUnanalyzed(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<number> {
  const { count } = await supabase
    .from("solutions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .or(needsFilter());
  return count ?? 0;
}

// Status snapshot for the UI: is AI on, which model, and how many solutions still need analysis.
export async function GET(_request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { count: total } = await supabase
      .from("solutions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    const { count: analyzed } = await supabase
      .from("solutions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("ai_status", "done");
    const unanalyzed = await countUnanalyzed(supabase, user.id);

    const gemini = await getUserGeminiKey(user.id);
    const keys = { gemini: gemini ?? undefined };

    return NextResponse.json({
      ai_configured: isAIConfigured(keys),
      model: aiChainLabel(keys),
      total: total ?? 0,
      analyzed: analyzed ?? 0,
      unanalyzed,
    });
  } catch (err) {
    return errorResponse("analyze.batch.GET", err, "Failed to read analysis status");
  }
}

export async function POST(_request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gemini = await getUserGeminiKey(user.id);
  const keys = { gemini: gemini ?? undefined };
  if (!isAIConfigured(keys)) {
    return NextResponse.json(
      { error: "AI analysis is not configured. Add your Gemini key in Settings.", code: "unconfigured" },
      { status: 503 }
    );
  }

  // Each call spends up to MAX_PER_CALL model requests. Cap the loop rate so a client can't burn the
  // provider's daily free quota in a runaway loop (≈ a few hundred analyses/hr ceiling).
  if (!(await rateLimit(`analyze-batch:${user.id}`, 60, 3600))) {
    return NextResponse.json(
      { error: "Analyzing too fast - please wait a moment and continue." },
      { status: 429 }
    );
  }

  try {
    const { data: pending, error } = await supabase
      .from("solutions")
      .select("id")
      .eq("user_id", user.id)
      .or(needsFilter())
      .limit(MAX_PER_CALL);
    if (error) return errorResponse("analyze.batch.select", error, "Failed to load solutions");

    let succeeded = 0;
    let failed = 0;
    for (const row of pending ?? []) {
      const result = await runAnalysis(supabase, row.id as string, user.id, keys);
      if (result.success) succeeded++;
      else if (result.code === "unconfigured") {
        // Provider dropped out mid-run - stop cleanly rather than hammering.
        return NextResponse.json(
          { error: "AI analysis is not configured on this instance.", code: "unconfigured" },
          { status: 503 }
        );
      } else failed++;
    }

    const remaining = await countUnanalyzed(supabase, user.id);
    return NextResponse.json({
      processed: (pending ?? []).length,
      succeeded,
      failed,
      remaining,
      done: remaining === 0,
    });
  } catch (err) {
    return errorResponse("analyze.batch.POST", err, "Failed to analyze solutions");
  }
}
