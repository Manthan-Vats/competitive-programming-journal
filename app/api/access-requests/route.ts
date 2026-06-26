import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sendEmail, escapeHtml } from "@/lib/email/mailer";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { errorResponse } from "@/lib/api-error";

// nodemailer (used by the notify path below) needs a TCP/TLS socket -> Node.js runtime.
export const runtime = "nodejs";

// Public endpoint: a visitor asks for an invite. Inserts a pending row into
// access_requests (RLS allows anon INSERT of status='pending' only, and denies
// reads). The operator reviews + approves these from /admin/invites.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  // Per-IP throttle: this public endpoint can trigger an operator email per call, so it's a
  // prime email-bomb / DB-spam vector. Fail-open if the limiter itself errors.
  if (!(await rateLimit(`access-req:${clientIp(request)}`, 5, 3600))) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;

    if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
      return NextResponse.json(
        { error: "A valid email is required." },
        { status: 400 }
      );
    }

    // Idempotent: if this email already has an open request (pending or already
    // invited), don't create a duplicate row - just acknowledge. Uses the admin client
    // because RLS denies anon reads. The response is identical either way, so this
    // doesn't leak whether the email is known.
    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("access_requests")
      .select("id")
      .eq("email", email)
      .in("status", ["pending", "invited"])
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ success: true });
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("access_requests")
      .insert({ email, note: note || null, status: "pending" });

    if (error) throw error;

    // Best-effort: notify the operator that someone asked to be let in. This must
    // never block or fail the public request - the row is already saved, and email
    // is optional (sendEmail no-ops if SMTP isn't configured). Set
    // ACCESS_REQUEST_NOTIFY_EMAIL to the address that should be alerted.
    const notifyTo = process.env.ACCESS_REQUEST_NOTIFY_EMAIL;
    if (notifyTo) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
      const safeEmail = escapeHtml(email);
      const safeNote = note ? escapeHtml(note) : "";
      await sendEmail({
        to: notifyTo,
        subject: `New access request - ${email}`,
        html:
          `<p>Someone asked to be let into SolveLog.</p>` +
          `<p><strong>Email:</strong> ${safeEmail}</p>` +
          (safeNote ? `<p><strong>Note:</strong> ${safeNote}</p>` : "") +
          `<p>Review &amp; approve at <a href="${appUrl}/admin/invites">${appUrl}/admin/invites</a>.</p>`,
        text:
          `New access request from ${email}` +
          (note ? `\nNote: ${note}` : "") +
          `\n\nReview & approve: ${appUrl}/admin/invites`,
      });
    }

    // Deliberately no read-back; just acknowledge.
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse("access-requests.POST", err, "Failed to submit request");
  }
}
