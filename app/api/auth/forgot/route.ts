import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { errorResponse } from "@/lib/api-error";

// resetPasswordForEmail sends through the Supabase-configured SMTP (our Gmail SMTP from P1),
// which uses nodemailer under the hood -> Node.js runtime.
export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Public "forgot password" endpoint.
// Requirement: only people who actually have an account may trigger a reset email.
// Security: we must NOT leak which emails are registered (enumeration). We reconcile the
// two by checking account existence SERVER-SIDE with the admin client and sending the
// recovery mail only for real users - while ALWAYS returning the same generic response to
// the client. The recovery link points at /auth/confirm (the prefetch-safe page that
// consumes the token only on the human's click, then redirects to /auth/set-password).
export async function POST(request: NextRequest) {
  // Per-IP throttle: each call can send an email, so it's an email-bomb / enumeration-probe
  // vector. Fail-open if the limiter itself errors (see lib/rate-limit).
  if (!(await rateLimit(`forgot-pw:${clientIp(request)}`, 5, 3600))) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  // Generic acknowledgement returned in every non-rate-limited case so the response is
  // identical whether or not the email is registered.
  const ack = NextResponse.json({ ok: true });

  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    // Malformed input still gets the generic ack (don't reveal validation as a signal).
    if (!email || email.length > 254 || !EMAIL_RE.test(email)) return ack;

    // Authoritative existence check via the admin client. Invite-only app -> tiny user base,
    // so a single listUsers page is sufficient and has no side effects (unlike generateLink,
    // which would mint an unused recovery token).
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) {
      // Don't leak failure to the client; log and ack.
      console.error("[forgot-pw] listUsers failed:", error.message);
      return ack;
    }
    const exists = data.users.some((u) => u.email?.toLowerCase() === email);
    if (!exists) return ack;

    // Real account -> send the standard recovery email via Supabase SMTP. Use the configured
    // app URL (NOT the request origin) for the redirect target, matching the invite flow:
    // the redirect lands the auth code, so it must not be derived from a client Host header.
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || new URL(request.url).origin;
    const supabase = await createClient();
    const { error: sendErr } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${baseUrl}/auth/confirm`,
    });
    if (sendErr) {
      // Surface the real reason in the log (SMTP issues are otherwise invisible); still ack.
      console.error("[forgot-pw] resetPasswordForEmail failed:", sendErr.message);
    }

    return ack;
  } catch (err) {
    // Even on unexpected errors, prefer the generic ack over a 500 that could be used as a
    // probe - but log it. (errorResponse logs; we still return ok-shaped to the client.)
    errorResponse("auth.forgot.POST", err, "Failed to process request");
    return ack;
  }
}
