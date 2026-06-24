import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runAnalysis } from "@/lib/analyze";
import { getUserGeminiKey } from "@/lib/ai/user-key";
import { rateLimit } from "@/lib/rate-limit";
import { errorResponse } from "@/lib/api-error";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Per-user throttle: each call spends a Gemini request (real cost + provider limits).
  if (!(await rateLimit(`analyze:${user.id}`, 30, 3600))) {
    return NextResponse.json(
      { error: "Too many analysis requests. Please wait a bit and try again." },
      { status: 429 }
    );
  }

  let solutionId: string | undefined;
  try {
    const body = await request.json();
    solutionId = typeof body.solution_id === "string" ? body.solution_id : undefined;
  } catch {
    // fall through to the missing-id check
  }

  if (!solutionId) {
    return NextResponse.json(
      { error: "Missing solution_id parameter" },
      { status: 400 }
    );
  }

  // Ownership is asserted inside runAnalysis (defense-in-depth atop RLS). The caller's own
  // (decrypted) Gemini key powers the analysis - BYOK, so each user spends their own quota.
  const gemini = await getUserGeminiKey(user.id);
  const result = await runAnalysis(supabase, solutionId, user.id, { gemini: gemini ?? undefined });

  if (result.code === "not_found") {
    return NextResponse.json({ error: "Solution not found" }, { status: 404 });
  }
  if (result.code === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (result.code === "unconfigured") {
    // AI is optional and turned off (no provider key) - tell the client plainly so it can show a
    // "set up AI" hint rather than a generic failure.
    return NextResponse.json(
      { success: false, error: "AI analysis is not configured on this instance.", code: "unconfigured" },
      { status: 503 }
    );
  }

  // On analysis failure return 200 with success:false so the client degrades gracefully
  // (the solution still exists; the user can retry).
  return NextResponse.json(
    result.success
      ? { success: true, analysis: result.analysis }
      : { success: false, error: result.error || "AI Analysis failed" }
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const solutionId = searchParams.get("solution_id");

  if (!solutionId) {
    return NextResponse.json(
      { error: "Missing solution_id parameter" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // B8: gate status reads behind authentication (defense-in-depth on top of RLS,
  // which already scopes the read to the caller's own solution).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: solution, error: solError } = await supabase
      .from("solutions")
      .select("id, ai_status")
      .eq("id", solutionId)
      .single();

    if (solError || !solution) {
      return NextResponse.json({ error: "Solution not found" }, { status: 404 });
    }

    const { data: analysis } = await supabase
      .from("ai_analyses")
      .select("*")
      .eq("solution_id", solutionId)
      .maybeSingle();

    return NextResponse.json({
      solution_id: solution.id,
      ai_status: solution.ai_status,
      analysis: analysis || null,
    });
  } catch (err) {
    return errorResponse("analyze.GET", err, "Failed to retrieve status");
  }
}
