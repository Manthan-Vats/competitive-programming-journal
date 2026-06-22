import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

// Allowlist of OTP types we accept. Anything else is rejected so a crafted link can't
// coerce verifyOtp into an unexpected flow.
const VALID_TYPES: ReadonlySet<string> = new Set([
  "invite",
  "recovery",
  "magiclink",
  "email",
  "signup",
  "email_change",
]);

// Only allow redirecting to an internal, absolute path. Rejects protocol-relative
// ("//evil.com"), backslash, and external origins to prevent an open redirect via ?next=.
function safeNext(next: string, origin: string): URL {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return new URL("/auth/set-password", origin);
  }
  return new URL(next, origin);
}

// POST-only. The /auth/confirm PAGE renders a button that submits here, so the one-time
// token is consumed only on this POST - never on a GET that an email link-scanner might
// pre-fetch. Uses NextResponse.redirect (the proven cookie path) with a 303 so the
// browser performs a GET to the next page (a 307 would re-POST and 405 against a page).
export async function POST(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const form = await request.formData();
  const code = String(form.get("code") || "");
  const tokenHash = String(form.get("token_hash") || "");
  const type = String(form.get("type") || "");
  const next = safeNext(String(form.get("next") || ""), origin);

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(next, { status: 303 });
  } else if (tokenHash && VALID_TYPES.has(type)) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    });
    if (!error) return NextResponse.redirect(next, { status: 303 });
  }

  return NextResponse.redirect(new URL("/login?error=invite_invalid", origin), {
    status: 303,
  });
}
