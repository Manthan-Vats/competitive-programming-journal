import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isOperator } from "@/lib/auth/operator";

// Operator-only: turn an access request (or a raw email) into a Supabase invite.
// Sends inviteUserByEmail() via the service-role admin client, then marks the
// originating request 'invited'. Only invited emails can ever create an account
// (public sign-up is disabled in the dashboard).
export async function POST(request: NextRequest) {
  // Gate on the operator's COOKIE session (not the admin client).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isOperator(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const requestId: string | undefined = body.request_id;
    let email: string | undefined =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : undefined;

    const admin = createAdminClient();

    // If a request id was supplied, resolve the email from it.
    if (requestId) {
      const { data: reqRow, error: reqErr } = await admin
        .from("access_requests")
        .select("id, email, status")
        .eq("id", requestId)
        .maybeSingle();
      if (reqErr) throw reqErr;
      if (!reqRow) {
        return NextResponse.json({ error: "Request not found" }, { status: 404 });
      }
      email = reqRow.email;
    }

    if (!email) {
      return NextResponse.json(
        { error: "An email or request_id is required." },
        { status: 400 }
      );
    }

    // Send the invite. The email link returns to /auth/confirm to set a password.
    // Use the configured app URL, NOT the request origin (P1-8): the redirect target is
    // security-sensitive (it's where the auth code lands), so it must not be derived from a
    // client-controlled Host header. Falls back to the request origin only if unset.
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || new URL(request.url).origin;
    const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${baseUrl}/auth/confirm`,
    });

    // The email already has an account. This isn't a failure - they can just sign in.
    // Resolve the request and tell the operator clearly, instead of surfacing a 500.
    const alreadyRegistered =
      !!inviteErr &&
      ((inviteErr as { code?: string }).code === "email_exists" ||
        (inviteErr as { status?: number }).status === 422 ||
        /already.*(registered|exists)|email_exists/i.test(inviteErr.message ?? ""));

    if (inviteErr && !alreadyRegistered) throw inviteErr;

    // Mark the request resolved (invited / already has access) if it came from one.
    if (requestId) {
      await admin
        .from("access_requests")
        .update({
          status: "invited",
          reviewed_at: new Date().toISOString(),
          reviewed_by: user!.id,
        })
        .eq("id", requestId);
    }

    return NextResponse.json({ success: true, email, alreadyRegistered });
  } catch (err: any) {
    // Surface the real reason in the server log - Supabase wraps SMTP failures in a
    // generic "Error sending invite email", and the actual cause (e.g. an SMTP
    // auth/connection error or timeout) is otherwise invisible.
    console.error("[invites] failed:", {
      status: err?.status,
      code: err?.code,
      message: err?.message,
    });
    const msg: string = err?.message || "Failed to send invite";
    // Most common snag is the SMTP layer rejecting or timing out on the send. The
    // real cause is in the server log above; point the operator at the SMTP config.
    const friendly = /sending|smtp|email|timeout|504/i.test(msg)
      ? `${msg} - check the Supabase SMTP settings (Authentication -> Emails) and the server log for the underlying SMTP error.`
      : msg;
    return NextResponse.json({ error: friendly }, { status: 500 });
  }
}
