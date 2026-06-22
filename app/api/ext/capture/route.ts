import { NextRequest, NextResponse } from "next/server";
import { resolveExtensionUser } from "@/lib/auth/ext-token";
import { resolveOrCreateProblem } from "@/lib/ext/capture-problem";
import { rateLimit } from "@/lib/rate-limit";
import { errorResponse } from "@/lib/api-error";

// One-click capture from the extension. The content script parses the problem page and
// POSTs the result here with a bearer token. We resolve the user and find-or-create the
// problem in THEIR journal (private by default, deduped per-user by URL). This is the
// per-user successor to /api/companion.

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const identity = await resolveExtensionUser(request);
  if (!identity) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Per-user throttle: a valid (or leaked) token must not drive unbounded service-role inserts.
  if (!(await rateLimit(`ext-capture:${identity.userId}`, 60, 60))) {
    return NextResponse.json(
      { error: "Too many captures. Please slow down and try again shortly." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const result = await resolveOrCreateProblem(identity.userId, body);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      problem_id: result.problemId,
      was_duplicate: !result.created,
    });
  } catch (err) {
    return errorResponse("ext.capture", err, "Failed to capture problem");
  }
}
