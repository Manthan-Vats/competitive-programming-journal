// Minimal transactional-email sender over SMTP (Gmail by default).
// This is for OUR OWN app notifications (e.g. "someone requested access") - it is NOT
// the auth/invite emails, which Supabase sends through its own dashboard SMTP config.
// We reuse the SAME Gmail account + App Password configured for Supabase's SMTP, so the
// whole app runs on a single free email provider.
// Degrades gracefully: if SMTP_USER / SMTP_PASS / EMAIL_FROM are unset, sending is
// skipped and the caller continues normally (email is an optional enhancement, never a
// hard dependency).
// Requires the Node.js runtime (nodemailer opens a TCP/TLS socket) - any route that
// calls this must set `export const runtime = "nodejs"`.

import nodemailer from "nodemailer";

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export async function sendEmail({ to, subject, html, text }: SendArgs): Promise<boolean> {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM || user;

  if (!user || !pass || !from) {
    // Email not configured - skip silently so the calling flow still succeeds.
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS
      auth: { user, pass },
      // Fail fast if the SMTP server is unreachable so a stuck send can't hang the
      // calling request (the notify path is best-effort and must never block).
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000,
    });
    await transporter.sendMail({ from, to, subject, html, text });
    return true;
  } catch (err) {
    console.error("[email] SMTP send error:", err);
    return false;
  }
}

// Escape user-supplied text before interpolating into an HTML email body.
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
