import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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
    const { problem_id, started_at, ended_at, is_manual } = body;

    if (!problem_id || !started_at) {
      return NextResponse.json(
        { error: "Missing required fields (problem_id, started_at)" },
        { status: 400 }
      );
    }

    // Validate timestamps (P1-3): reject unparseable dates and a session that ends before it
    // starts, so bad/negative durations can't be stored (total_seconds clamps reads, but the
    // data should be sane at write time).
    const startMs = Date.parse(started_at);
    if (Number.isNaN(startMs)) {
      return NextResponse.json({ error: "Invalid started_at" }, { status: 400 });
    }
    if (ended_at != null) {
      const endMs = Date.parse(ended_at);
      if (Number.isNaN(endMs)) {
        return NextResponse.json({ error: "Invalid ended_at" }, { status: 400 });
      }
      if (endMs < startMs) {
        return NextResponse.json(
          { error: "ended_at must be on or after started_at" },
          { status: 400 }
        );
      }
    }

    // The timed problem must belong to this user.
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

    // If it's not a manual entry (meaning it is an active timer), close other active sessions for this problem
    if (!is_manual && !ended_at) {
      // Find and close other active sessions (ended_at IS NULL)
      const now = new Date().toISOString();
      await supabase
        .from("timing_sessions")
        .update({ ended_at: now })
        .eq("problem_id", problem_id)
        .is("ended_at", null);
    }

    const { data: session, error } = await supabase
      .from("timing_sessions")
      .insert({
        user_id: user.id,
        problem_id,
        started_at,
        ended_at: ended_at || null,
        is_manual: !!is_manual,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(session, { status: 201 });
  } catch (err) {
    return errorResponse("timing-sessions.POST", err, "Failed to create session");
  }
}
