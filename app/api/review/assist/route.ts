import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { isAIConfigured } from "@/lib/ai";
import { getUserGeminiKey } from "@/lib/ai/user-key";
import { generateHint, critiqueSolution, generatePatternCard } from "@/lib/ai/assist";
import { rateLimit } from "@/lib/rate-limit";
import { errorResponse } from "@/lib/api-error";

// AI revision assists for P4 (hint / critique / pattern_card). Authenticated owner only; the problem
// (and its solution, for critique/pattern_card) must belong to the caller.
//
// CACHED: results are persisted in `ai_assists` (migration 017) keyed by (problem_id, action) so the
// same assist - reviewed over and over in spaced repetition - is served straight from the DB on
// repeat, costing zero model calls / quota and returning instantly. A model call (and the rate
// limit + AI-configured gate) only happens on a cache MISS or an explicit `regenerate`. For
// critique/pattern_card the cache stores a hash of the solution code, so editing the solution
// auto-invalidates the cached feedback. AI-optional: 503 when no provider is configured AND there's
// nothing cached to fall back on.

export const runtime = "nodejs";
export const maxDuration = 60;

type Action = "hint" | "critique" | "pattern_card";
const ACTIONS: Action[] = ["hint", "critique", "pattern_card"];

const hashCode = (code: string) => createHash("sha256").update(code).digest("hex");

// The fields the assists + cache-keying need, in one query.
const PROBLEM_SELECT =
  "id, title, platform, statement, source_tags, custom_tags, solutions ( language, code, created_at )";

type SolutionRow = { language: string; code: string; created_at: string };

// Most recent solution for a problem (critique/pattern_card analyze the latest code).
function latestSolution(problem: { solutions?: SolutionRow[] | null }): SolutionRow | null {
  const list = (problem.solutions ?? []).slice().sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  return list[0] ?? null;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action as Action;
    const problemId = typeof body.problem_id === "string" ? body.problem_id : null;
    const regenerate = body.regenerate === true;
    if (!ACTIONS.includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    if (!problemId) {
      return NextResponse.json({ error: "problem_id is required" }, { status: 400 });
    }

    // Ownership + the fields the assists need. RLS already scopes this; the explicit user_id match
    // gives a clean 404 and defense-in-depth.
    const { data: problem, error: pErr } = await supabase
      .from("problems")
      .select(PROBLEM_SELECT)
      .eq("id", problemId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (pErr) return errorResponse("review.assist.problem", pErr, "Assist failed");
    if (!problem) return NextResponse.json({ error: "Problem not found" }, { status: 404 });

    // critique + pattern_card need the user's own code; hint does not.
    const solution = action === "hint" ? null : latestSolution(problem);
    if (action !== "hint" && !solution?.code) {
      return NextResponse.json({ error: "No solution code on this problem to analyze." }, { status: 400 });
    }
    const solutionHash = solution?.code ? hashCode(solution.code) : null;

    // 1) Cache check (unless the user explicitly asked to regenerate). A hit needs no key, no rate
    //    limit, no model call. For critique/pattern_card the stored hash must still match the current
    //    code, else the cached feedback is stale and we fall through to regenerate.
    if (!regenerate) {
      const { data: cached } = await supabase
        .from("ai_assists")
        .select("result, model_used, solution_hash")
        .eq("problem_id", problemId)
        .eq("action", action)
        .maybeSingle();
      if (cached && (action === "hint" || cached.solution_hash === solutionHash)) {
        return NextResponse.json({ action, result: cached.result, model: cached.model_used, cached: true });
      }
    }

    // 2) Cache miss / regenerate -> a real model call. Now the AI-configured gate + rate limit apply.
    const gemini = await getUserGeminiKey(user.id);
    const keys = { gemini: gemini ?? undefined };
    if (!isAIConfigured(keys)) {
      return NextResponse.json(
        { error: "AI assists are not configured. Add your Gemini key in Settings.", code: "unconfigured" },
        { status: 503 }
      );
    }
    if (!(await rateLimit(`review-assist:${user.id}`, 40, 3600))) {
      return NextResponse.json(
        { error: "Too many AI requests. Please wait a moment and try again." },
        { status: 429 }
      );
    }

    const tags = [
      ...((problem.source_tags as string[] | null) ?? []),
      ...((problem.custom_tags as string[] | null) ?? []),
    ];

    let result: unknown;
    let model: string;
    if (action === "hint") {
      const r = await generateHint(
        {
          title: problem.title as string,
          platform: problem.platform as string,
          statement: problem.statement as string | null,
          tags,
        },
        keys
      );
      result = r.data;
      model = r.model;
    } else if (action === "critique") {
      const r = await critiqueSolution(
        { title: problem.title as string, platform: problem.platform as string, statement: problem.statement as string | null },
        { language: solution!.language, code: solution!.code },
        keys
      );
      result = r.data;
      model = r.model;
    } else {
      const r = await generatePatternCard(
        { title: problem.title as string, platform: problem.platform as string, statement: problem.statement as string | null, tags },
        { language: solution!.language, code: solution!.code },
        keys
      );
      result = r.data;
      model = r.model;
    }

    // 3) Persist for next time. Upsert on (problem_id, action). Best-effort: a cache write failure
    //    must not fail the request the user is waiting on - they still get their fresh result.
    const { error: upsertErr } = await supabase.from("ai_assists").upsert(
      {
        user_id: user.id,
        problem_id: problemId,
        action,
        solution_hash: solutionHash,
        result,
        model_used: model,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "problem_id,action" }
    );
    if (upsertErr) console.error("[review.assist] cache upsert failed:", upsertErr.message);

    return NextResponse.json({ action, result, model, cached: false });
  } catch (err) {
    return errorResponse("review.assist.POST", err, "AI assist failed");
  }
}
