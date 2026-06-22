import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/api-error";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { ended_at } = body;

    if (!ended_at) {
      return NextResponse.json(
        { error: "Missing required fields (ended_at)" },
        { status: 400 }
      );
    }
    if (Number.isNaN(Date.parse(ended_at))) {
      return NextResponse.json({ error: "Invalid ended_at" }, { status: 400 });
    }

    // Guard against ending before the session started (mirrors the create path + the DB
    // timing_sessions_order_check). Scoped to the caller's own row by RLS + the eq filter.
    const { data: current } = await supabase
      .from("timing_sessions")
      .select("started_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!current) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (Date.parse(ended_at) < Date.parse(current.started_at)) {
      return NextResponse.json(
        { error: "ended_at must be on or after started_at" },
        { status: 400 }
      );
    }

    const { data: session, error } = await supabase
      .from("timing_sessions")
      .update({ ended_at })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(session);
  } catch (err) {
    return errorResponse("timing-sessions.[id].PATCH", err, "Failed to update session");
  }
}
