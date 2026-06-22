import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    // Use the ANON client, not service-role (P2-4): a liveness ping has no business holding
    // the RLS-bypassing key. `select id limit 1` succeeds under the public_read RLS policy
    // (and returns empty harmlessly if there are no public rows) - enough to keep the DB warm.
    const supabase = await createClient();
    const { error } = await supabase.from("problems").select("id").limit(1);
    if (error) throw error;

    return NextResponse.json({ ok: true, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("[heartbeat]", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: "Heartbeat failed" }, { status: 500 });
  }
}
