import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAIConfigured } from "@/lib/ai";
import { getUserGeminiKey } from "@/lib/ai/user-key";
import { generateHint, critiqueSolution, generatePatternCard } from "@/lib/ai/assist";
import { rateLimit } from "@/lib/rate-limit";
import { errorResponse } from "@/lib/api-error";

// AI revision assists for P4 (hint / critique / pattern_card). Authenticated owner only; the problem
// (and its solution, for critique/pattern_card) must belong to the caller. Rate-limited to protect
// the provider's free quota. AI-optional: 503 when no provider is configured.

export const runtime = "nodejs";
export const maxDuration = 60;

type Action = "hint" | "critique" | "pattern_card";
const ACTIONS: Action[] = ["hint", "critique", "pattern_card"];

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gemini = await getUserGeminiKey(user.id);
  const keys = { gemini: gemini ?? undefined };
  if (!isAIConfigured(keys)) {
    return NextResponse.json(
      { error: "AI assists are not configured. Add your Gemini key in Settings.", code: "unconfigured" },
      { status: 503 }
    );
  }

  // Each assist spends a model request; keep it sane per user.
  if (!(await rateLimit(`review-assist:${user.id}`, 40, 3600))) {
    return NextResponse.json(
      { error: "Too many AI requests. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action as Action;
    const problemId = typeof body.problem_id === "string" ? body.problem_id : null;
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
      .select(
        "id, title, platform, statement, source_tags, custom_tags, solutions ( language, code, created_at )"
      )
      .eq("id", problemId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (pErr) return errorResponse("review.assist.problem", pErr, "Assist failed");
    if (!problem) return NextResponse.json({ error: "Problem not found" }, { status: 404 });

    const tags = [
      ...((problem.source_tags as string[] | null) ?? []),
      ...((problem.custom_tags as string[] | null) ?? []),
    ];

    if (action === "hint") {
      const { data, model } = await generateHint(
        {
          title: problem.title as string,
          platform: problem.platform as string,
          statement: problem.statement as string | null,
          tags,
        },
        keys
      );
      return NextResponse.json({ action, result: data, model });
    }

    // critique + pattern_card need the user's own code. Pick the most recent solution.
    const solutions = ((problem.solutions as { language: string; code: string; created_at: string }[]) ?? [])
      .slice()
      .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
    const solution = solutions[0];
    if (!solution?.code) {
      return NextResponse.json(
        { error: "No solution code on this problem to analyze." },
        { status: 400 }
      );
    }

    if (action === "critique") {
      const { data, model } = await critiqueSolution(
        {
          title: problem.title as string,
          platform: problem.platform as string,
          statement: problem.statement as string | null,
        },
        { language: solution.language, code: solution.code },
        keys
      );
      return NextResponse.json({ action, result: data, model });
    }

    // pattern_card
    const { data, model } = await generatePatternCard(
      {
        title: problem.title as string,
        platform: problem.platform as string,
        statement: problem.statement as string | null,
        tags,
      },
      { language: solution.language, code: solution.code },
      keys
    );
    return NextResponse.json({ action, result: data, model });
  } catch (err) {
    return errorResponse("review.assist.POST", err, "AI assist failed");
  }
}
