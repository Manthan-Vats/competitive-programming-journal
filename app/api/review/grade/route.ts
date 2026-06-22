import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { newCard, gradeCard, RATING_BY_NAME, type StoredCard, type RatingName } from "@/lib/fsrs";
import { errorResponse } from "@/lib/api-error";

// Grade a problem's revision card (P4). Body: { problem_id, rating } where rating is one of
// again|hard|good|easy. Loads the existing FSRS card (or starts a fresh one), applies the grade
// with ts-fsrs, and upserts the new card state. Authenticated owner only; RLS (own_rows) + an
// explicit problem-ownership check stop grading someone else's problem.

export const runtime = "nodejs";

function ratingValue(v: unknown): (typeof RATING_BY_NAME)[RatingName] | null {
  if (typeof v === "string" && v in RATING_BY_NAME) {
    return RATING_BY_NAME[v as RatingName];
  }
  if (v === 1 || v === 2 || v === 3 || v === 4) return v; // numeric grade
  return null;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const problemId = typeof body.problem_id === "string" ? body.problem_id : null;
    const grade = ratingValue(body.rating);
    if (!problemId) {
      return NextResponse.json({ error: "problem_id is required" }, { status: 400 });
    }
    if (grade === null) {
      return NextResponse.json(
        { error: "rating must be one of again, hard, good, easy" },
        { status: 400 }
      );
    }

    // Ownership: the problem must be in THIS user's journal.
    const { data: problem, error: pErr } = await supabase
      .from("problems")
      .select("id")
      .eq("id", problemId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (pErr) return errorResponse("review.grade.problem", pErr, "Failed to grade");
    if (!problem) return NextResponse.json({ error: "Problem not found" }, { status: 404 });

    // Load the existing card (if any) or start fresh.
    const { data: existing, error: exErr } = await supabase
      .from("review_cards")
      .select("fsrs")
      .eq("user_id", user.id)
      .eq("problem_id", problemId)
      .maybeSingle();
    if (exErr) return errorResponse("review.grade.load", exErr, "Failed to grade");

    const now = new Date();
    const current: StoredCard = (existing?.fsrs as StoredCard) ?? newCard(now);
    const { card } = gradeCard(current, grade, now);

    const { error: upErr } = await supabase.from("review_cards").upsert(
      {
        user_id: user.id,
        problem_id: problemId,
        fsrs: card,
        due: card.due,
        state: card.state,
        reps: card.reps,
        lapses: card.lapses,
        last_rating: grade,
        last_review: now.toISOString(),
        suspended: false,
      },
      { onConflict: "user_id,problem_id" }
    );
    if (upErr) return errorResponse("review.grade.upsert", upErr, "Failed to grade");

    return NextResponse.json({ success: true, due: card.due, state: card.state, reps: card.reps });
  } catch (err) {
    return errorResponse("review.grade", err, "Failed to grade");
  }
}
