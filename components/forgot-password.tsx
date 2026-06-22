"use client";

import React, { useState } from "react";
import { toast } from "sonner";

interface ForgotPasswordProps {
  /** the email currently typed in the login form, reused as the reset target */
  email: string;
  disabled?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * "forgot?" affordance on the login form. Sends the typed email to /api/auth/forgot,
 * which only mails a reset link to addresses that actually have an account - but always
 * responds generically, so this UI must NOT reveal whether the email was known.
 */
export const ForgotPassword: React.FC<ForgotPasswordProps> = ({ email, disabled }) => {
  const [sending, setSending] = useState(false);

  const handle = async () => {
    const target = email.trim().toLowerCase();
    if (!EMAIL_RE.test(target)) {
      toast.error("type your email above first, then click forgot.");
      return;
    }
    setSending(true);
    try {
      await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: target }),
      });
      // Generic, regardless of whether the account exists (no enumeration leak).
      toast.success("if that email has an account, a reset link is on its way.");
    } catch {
      toast.error("couldn't reach the server. try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handle}
      disabled={disabled || sending}
      className="font-mono text-[10px] tracking-[0.08em] text-ink-faint hover:text-blood transition-colors disabled:opacity-50 lowercase"
    >
      {sending ? "sending..." : "forgot?"}
    </button>
  );
};

export default ForgotPassword;
