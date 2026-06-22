import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { resolveExtensionUser } from "@/lib/auth/ext-token";
import { resolveOrCreateProblem } from "@/lib/ext/capture-problem";
import { rateLimit } from "@/lib/rate-limit";
import { errorResponse } from "@/lib/api-error";

// Start/stop a timing session for the current problem, from the extension popup. The
// problem is auto-created from the capture payload if it isn't in the journal yet.
// Bearer-authed; all rows stamped with the resolved user_id (service-role client).

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const identity = await resolveExtensionUser(request);
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Per-user throttle on timer start/stop inserts+updates.
  if (!(await rateLimit(`ext-timer:${identity.userId}`, 60, 60))) {
    return NextResponse.json(
      { error: "Too many timer updates. Please slow down and try again shortly." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const action = body.action;
    if (action !== "start" && action !== "stop" && action !== "commit") {
      return NextResponse.json(
        { error: "action must be 'start', 'stop' or 'commit'" },
        { status: 400 }
      );
    }

    const resolved = await resolveOrCreateProblem(identity.userId, body.problem ?? {});
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    const admin = createAdminClient();
    const now = new Date().toISOString();

    // commit: the storage-backed extension timer (T1) sends ONE finished session for
    // the whole solve. We never leave open rows, so no fragmentation.
    if (action === "commit") {
      const startMs = Date.parse(body.startedAt);
      const endMs = Date.parse(body.endedAt);
      if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
        return NextResponse.json({ error: "Invalid startedAt/endedAt" }, { status: 400 });
      }
      if (endMs < startMs) {
        return NextResponse.json(
          { error: "endedAt must be on or after startedAt" },
          { status: 400 }
        );
      }
      const { data, error } = await admin
        .from("timing_sessions")
        .insert({
          user_id: identity.userId,
          problem_id: resolved.problemId,
          started_at: new Date(startMs).toISOString(),
          ended_at: new Date(endMs).toISOString(),
          is_manual: false,
        })
        .select("id")
        .single();
      if (error) throw error;
      return NextResponse.json({
        success: true,
        action,
        problem_id: resolved.problemId,
        session_id: data.id,
      });
    }

    if (action === "start") {
      // Close any still-open session for this problem first (one active timer at a time).
      await admin
        .from("timing_sessions")
        .update({ ended_at: now })
        .eq("user_id", identity.userId)
        .eq("problem_id", resolved.problemId)
        .is("ended_at", null);

      const { data, error } = await admin
        .from("timing_sessions")
        .insert({
          user_id: identity.userId,
          problem_id: resolved.problemId,
          started_at: now,
          ended_at: null,
          is_manual: false,
        })
        .select("id")
        .single();
      if (error) throw error;

      return NextResponse.json({
        success: true,
        action,
        problem_id: resolved.problemId,
        session_id: data.id,
      });
    }

    // stop: close the latest open session for this problem (if any).
    const { data: open } = await admin
      .from("timing_sessions")
      .select("id")
      .eq("user_id", identity.userId)
      .eq("problem_id", resolved.problemId)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (open) {
      await admin.from("timing_sessions").update({ ended_at: now }).eq("id", open.id);
    }

    return NextResponse.json({
      success: true,
      action,
      problem_id: resolved.problemId,
      stopped: !!open,
    });
  } catch (err) {
    return errorResponse("ext.timer", err, "Failed to update timer");
  }
}
