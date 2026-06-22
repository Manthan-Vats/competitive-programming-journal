import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { resolveExtensionUser } from "@/lib/auth/ext-token";
import { resolveOrCreateProblem } from "@/lib/ext/capture-problem";
import { SOLUTION_LANGUAGES, MAX_CODE_LENGTH } from "@/lib/difficulty";
import { buildProvenance } from "@/lib/ext/solution-provenance";
import { rateLimit } from "@/lib/rate-limit";
import { errorResponse } from "@/lib/api-error";

// Attach a solution (code + language) to the current problem from the extension popup.
// The problem is auto-created from the capture payload if needed. ai_status is left
// "none" so the user can trigger AI analysis from the web app (we can't forward a
// Supabase session to /api/analyze from a bearer-authed extension request).

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const identity = await resolveExtensionUser(request);
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Per-user throttle (lower than capture: each call can carry up to MAX_CODE_LENGTH of code).
  if (!(await rateLimit(`ext-solution:${identity.userId}`, 30, 60))) {
    return NextResponse.json(
      { error: "Too many solution uploads. Please slow down and try again shortly." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const language =
      typeof body.language === "string" && SOLUTION_LANGUAGES.has(body.language)
        ? body.language
        : null;
    const code = typeof body.code === "string" ? body.code : "";

    if (!language) {
      return NextResponse.json({ error: "Invalid or missing language" }, { status: 400 });
    }
    if (!code.trim()) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }
    if (code.length > MAX_CODE_LENGTH) {
      return NextResponse.json({ error: "Code is too large" }, { status: 400 });
    }

    const resolved = await resolveOrCreateProblem(identity.userId, body.problem ?? {});
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("solutions")
      .insert({
        user_id: identity.userId,
        problem_id: resolved.problemId,
        language,
        code,
        label: typeof body.label === "string" ? body.label.slice(0, 120) : null,
        is_public_code: false, // private by default
        ai_status: "none",
        // Optional judge provenance (verdict/runtime/memory/submission id/etc.) - shaped + capped.
        ...buildProvenance(body),
      })
      .select("id")
      .single();
    if (error) throw error;

    return NextResponse.json({
      success: true,
      solution_id: data.id,
      problem_id: resolved.problemId,
    });
  } catch (err) {
    return errorResponse("ext.solution", err, "Failed to attach solution");
  }
}
