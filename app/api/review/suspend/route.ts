import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { newCard } from "@/lib/fsrs";
import { errorResponse } from "@/lib/api-error";

// Opt a problem in/out of revision (P4). Body: { problem_id, suspended }. Suspended cards never
// surface in the queue. If the problem has no card yet, we create a fresh one carrying the flag.
// Authenticated owner only; RLS + an explicit ownership check apply.

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const problemId = typeof body.problem_id === "string" ? body.problem_id : null;
    const suspended = body.suspended === true;
    if (!problemId) {
      return NextResponse.json({ error: "problem_id is required" }, { status: 400 });
    }

    const { data: problem, error: pErr } = await supabase
      .from("problems")
      .select("id")
      .eq("id", problemId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (pErr) return errorResponse("review.suspend.problem", pErr, "Failed to update revision");
    if (!problem) return NextResponse.json({ error: "Problem not found" }, { status: 404 });

    const { data: existing, error: exErr } = await supabase
      .from("review_cards")
      .select("fsrs")
      .eq("user_id", user.id)
      .eq("problem_id", problemId)
      .maybeSingle();
    if (exErr) return errorResponse("review.suspend.load", exErr, "Failed to update revision");

    const card = (existing?.fsrs as ReturnType<typeof newCard>) ?? newCard();

    const { error: upErr } = await supabase.from("review_cards").upsert(
      {
        user_id: user.id,
        problem_id: problemId,
        fsrs: card,
        due: card.due,
        state: card.state,
        reps: card.reps,
        lapses: card.lapses,
        suspended,
      },
      { onConflict: "user_id,problem_id" }
    );
    if (upErr) return errorResponse("review.suspend.upsert", upErr, "Failed to update revision");

    return NextResponse.json({ success: true, suspended });
  } catch (err) {
    return errorResponse("review.suspend", err, "Failed to update revision");
  }
}
