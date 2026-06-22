import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isOperator } from "@/lib/auth/operator";
import { errorResponse } from "@/lib/api-error";

// Operator-only management of a single access request (reject / remove). Reads/writes
// use the service-role admin client because RLS denies tenant access to this table; the
// operator gate is enforced here on the cookie session.
export const runtime = "nodejs";

async function requireOperator() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return isOperator(user) ? user : null;
}

// Reject a request (mark 'rejected'; it stays in History for the record).
export async function PATCH(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const op = await requireOperator();
  if (!op) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const admin = createAdminClient();
  const { error } = await admin
    .from("access_requests")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: op.id,
    })
    .eq("id", id);

  if (error) return errorResponse("access-requests.[id].PATCH", error, "Failed to reject request");
  return NextResponse.json({ success: true });
}

// Permanently remove a request row.
export async function DELETE(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const op = await requireOperator();
  if (!op) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const admin = createAdminClient();
  const { error } = await admin.from("access_requests").delete().eq("id", id);

  if (error) return errorResponse("access-requests.[id].DELETE", error, "Failed to remove request");
  return NextResponse.json({ success: true });
}
