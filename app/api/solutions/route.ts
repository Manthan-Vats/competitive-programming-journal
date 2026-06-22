import { NextRequest, NextResponse, after } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { runAnalysis } from "@/lib/analyze";
import { isLanguage, MAX_CODE_LENGTH } from "@/lib/difficulty";
import { errorResponse } from "@/lib/api-error";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { problem_id, language, code, label, is_public_code } = body;

    if (!problem_id || !language || !code) {
      return NextResponse.json(
        { error: "Missing required fields (problem_id, language, code)" },
        { status: 400 }
      );
    }

    // Validate language + code size to match the extension solution path (which already
    // does this). Without it the web path accepts arbitrary language strings and unbounded
    // code blobs.
    if (!isLanguage(language)) {
      return NextResponse.json({ error: "Invalid language" }, { status: 400 });
    }
    if (typeof code !== "string" || !code.trim()) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }
    if (code.length > MAX_CODE_LENGTH) {
      return NextResponse.json({ error: "Code is too large" }, { status: 400 });
    }

    // The parent problem must belong to this user (can't attach code to someone
    // else's problem). RLS would also reject the insert's user_id mismatch, but
    // this gives a clean 403 and keeps ownership consistent.
    const { data: parent } = await supabase
      .from("problems")
      .select("id")
      .eq("id", problem_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!parent) {
      return NextResponse.json(
        { error: "Problem not found in your journal" },
        { status: 403 }
      );
    }

    const { data: solution, error } = await supabase
      .from("solutions")
      .insert({
        user_id: user.id,
        problem_id,
        language,
        code,
        label: typeof label === "string" ? label.slice(0, 120) : null,
        // Private by default (audit B2): publishing code is an explicit toggle. Coerce to a
        // real boolean (a truthy string must not silently publish) and cap the label, matching
        // the extension solution path.
        is_public_code: !!is_public_code,
        ai_status: "pending",
      })
      .select()
      .single();

    if (error) throw error;

    // Schedule AI analysis to run AFTER the response is sent, so creating a solution isn't blocked
    // on the (multi-second) model call. ai_status stays "pending" (set at insert) and the problem
    // page's realtime subscription to ai_analyses surfaces the result when it lands. We use an admin
    // client because the request's cookie store is closed once the response flushes; ownership is
    // still asserted inside runAnalysis via the explicit user_id. runAnalysis never throws and
    // records its own failures as ai_status="failed". (The old fire-and-forget self-fetch dropped on
    // serverless; `after()` is the supported way to keep the work alive past the response.)
    const sid = solution.id;
    const uid = user.id;
    after(async () => {
      await runAnalysis(createAdminClient(), sid, uid);
    });

    return NextResponse.json(solution, { status: 201 });
  } catch (err) {
    return errorResponse("solutions.POST", err, "Failed to create solution");
  }
}
