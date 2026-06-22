import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tagsToPatterns } from "@/lib/patterns";
import { errorResponse } from "@/lib/api-error";

// The revision queue (P4): cards whose FSRS interval has elapsed ("due") plus a capped number of
// "new" problems that have never been reviewed. Private - authenticated owner only. Each item
// carries the problem (statement/notes/code revealed by the UI on grading) + its canonical
// patterns. New cards aren't persisted until first graded (POST /api/review/grade).

export const runtime = "nodejs";

const DUE_LIMIT = 200;
const NEW_LIMIT = 20;

const PROBLEM_FIELDS =
  "id, title, url, platform, difficulty_norm, difficulty_raw, source_tags, custom_tags, statement, notes, solved_at, created_at, solutions ( language, code, ai_analyses ( algorithms, data_structures, techniques, math_concepts ) )";

type AnalysisTags = {
  algorithms: string[] | null;
  data_structures: string[] | null;
  techniques: string[] | null;
  math_concepts: string[] | null;
};
type SolutionRow = { language: string; code: string; ai_analyses?: AnalysisTags[] | null };
type ProblemRow = {
  id: string;
  source_tags: string[] | null;
  custom_tags: string[] | null;
  solutions?: SolutionRow[] | null;
  [k: string]: unknown;
};

function withPatterns(problem: ProblemRow) {
  // Canonical patterns come from the judge/custom tags AND the AI analysis tags already stored on
  // each solution. Feeding the richer AI tags through the same canonical map is the AI-augmented
  // normalization - and it's free here (no model call; we read what analysis already produced).
  const aiTags: string[] = [];
  for (const sol of problem.solutions ?? []) {
    for (const a of sol.ai_analyses ?? []) {
      aiTags.push(
        ...(a.algorithms ?? []),
        ...(a.data_structures ?? []),
        ...(a.techniques ?? []),
        ...(a.math_concepts ?? [])
      );
    }
  }
  const patterns = tagsToPatterns([
    ...(problem.source_tags ?? []),
    ...(problem.custom_tags ?? []),
    ...aiTags,
  ]);
  return { ...problem, patterns };
}

export async function GET(_request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const nowIso = new Date().toISOString();

    // Due cards (not suspended, due <= now), oldest-due first.
    const { data: dueRows, error: dueErr } = await supabase
      .from("review_cards")
      .select(
        `due, state, reps, lapses, last_rating, last_review, problem:problems ( ${PROBLEM_FIELDS} )`
      )
      .eq("user_id", user.id)
      .eq("suspended", false)
      .lte("due", nowIso)
      .order("due", { ascending: true })
      .limit(DUE_LIMIT);
    if (dueErr) return errorResponse("review.queue.due", dueErr, "Failed to load the revision queue");

    // Problems that have no card yet = "new". Exclude already-carded problem ids.
    const { data: carded, error: cardedErr } = await supabase
      .from("review_cards")
      .select("problem_id")
      .eq("user_id", user.id);
    if (cardedErr) return errorResponse("review.queue.carded", cardedErr, "Failed to load the revision queue");

    const cardedIds = (carded ?? []).map((r) => r.problem_id as string);
    let newQuery = supabase
      .from("problems")
      .select(PROBLEM_FIELDS)
      .eq("user_id", user.id)
      .order("solved_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(NEW_LIMIT);
    if (cardedIds.length > 0) {
      newQuery = newQuery.not("id", "in", `(${cardedIds.join(",")})`);
    }
    const { data: newProblems, error: newErr } = await newQuery;
    if (newErr) return errorResponse("review.queue.new", newErr, "Failed to load the revision queue");

    const due = (dueRows ?? []).map((row) => {
      const problem = row.problem as unknown as ProblemRow;
      return {
        card: {
          due: row.due,
          state: row.state,
          reps: row.reps,
          lapses: row.lapses,
          last_rating: row.last_rating,
          last_review: row.last_review,
        },
        problem: problem ? withPatterns(problem) : null,
      };
    }).filter((i) => i.problem);

    const fresh = (newProblems ?? []).map((problem) => ({
      card: null,
      problem: withPatterns(problem as ProblemRow),
    }));

    return NextResponse.json({
      due,
      new: fresh,
      counts: { due: due.length, new: fresh.length },
    });
  } catch (err) {
    return errorResponse("review.queue", err, "Failed to load the revision queue");
  }
}
