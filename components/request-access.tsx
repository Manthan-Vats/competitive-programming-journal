"use client";

import React, { useState } from "react";
import { Loader2, KeyRound, Check } from "lucide-react";
import { StampButton } from "@/components/paper/stamp";
import { Cap } from "@/components/paper/bits";
import { toast } from "sonner";

// Invite-only: visitors can't sign up, they ask. POSTs to /api/access-requests.
// `trigger` picks how the collapsed call-to-action looks:
//   - "link"   : quiet inline mono link (used in tight spots / footers)
//   - "button" : the primary blood StampButton (used for the hero CTA)
export function RequestAccess({
  trigger = "link",
  label = "request an invite",
}: {
  trigger?: "link" | "button";
  label?: string;
} = {}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("leave an email so you can be let in.");
      return;
    }
    setIsSending(true);
    try {
      const res = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), note: note.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send request");
      setDone(true);
      toast.success("asked. you'll hear back if the door opens.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "something went wrong");
    } finally {
      setIsSending(false);
    }
  };

  const inputCls =
    "w-full bg-paper-sheet border border-paper-edge rounded-[3px] px-3 py-2.5 font-body text-[15px] text-ink placeholder:text-ink-faint focus:outline-2 focus:outline-blood focus:outline-offset-2";

  if (done) {
    return (
      <div className="flex items-center gap-2 font-mono text-[12px] text-t-green uppercase tracking-[0.12em]">
        <Check className="w-[14px] h-[14px]" /> request received - sit tight
      </div>
    );
  }

  if (!open) {
    if (trigger === "button") {
      return (
        <StampButton onClick={() => setOpen(true)} className="px-5 py-3 text-[15px]">
          <KeyRound className="w-[15px] h-[15px]" /> {label} <span aria-hidden>&rarr;</span>
        </StampButton>
      );
    }
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft hover:text-blood transition-colors"
      >
        <KeyRound className="w-[13px] h-[13px]" /> {label}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="w-full max-w-[420px] bg-paper-sheet border border-dashed border-[#b3a988] rounded-[3px] p-5 space-y-3">
      <Cap>RING THE BELL · invite only</Cap>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className={inputCls}
        disabled={isSending}
        required
      />
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="(optional) who are you / why you'd like in"
        className={`${inputCls} min-h-[64px] resize-y`}
        disabled={isSending}
      />
      <div className="flex items-center gap-2">
        <StampButton type="submit" disabled={isSending} className="flex-1 justify-center">
          {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : "request"}
        </StampButton>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-faint hover:text-ink-soft px-3"
        >
          never mind
        </button>
      </div>
    </form>
  );
}
