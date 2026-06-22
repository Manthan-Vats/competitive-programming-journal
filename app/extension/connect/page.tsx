"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ModifiedBear } from "@/components/modified-bear";
import { PaperSheet } from "@/components/paper/paper-sheet";
import { StampButton, GhostButton, Stamp } from "@/components/paper/stamp";
import { Cap } from "@/components/paper/bits";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type State = "checking" | "anon" | "ready" | "linking" | "done";

export default function ExtensionConnectPage() {
  const supabase = createClient();
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    let active = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;
      setState(user ? "ready" : "anon");
    })();
    return () => {
      active = false;
    };
  }, [supabase]);

  const connect = async () => {
    setState("linking");
    try {
      const res = await fetch("/api/ext/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: navigator.userAgent.slice(0, 80) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to link");
      window.postMessage({ type: "CPJ_EXT_TOKEN", token: data.token }, window.location.origin);
      setState("done");
      toast.success("sent to the extension.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "failed to connect");
      setState("ready");
    }
  };

  return (
    <div className="cpj-desk min-h-screen w-full flex items-center justify-center p-6">
      <PaperSheet variant="page" className="cpj-develop w-full max-w-[420px] p-8 text-center">
        <div className="select-none">
          <ModifiedBear className="w-[34px] h-[34px] mx-auto text-ink" />
          <Cap className="mt-2.5">THE NATIONAL ANTHEM</Cap>
          <h1 className="font-display text-[30px] leading-[0.9] mt-1.5">CONNECT THE COMPANION</h1>
          <p className="font-body italic text-[14px] text-ink-soft mt-1">everyone is connected.</p>
        </div>

        {/* wiring diagram */}
        <div className="flex items-center justify-center gap-0 my-5" aria-hidden>
          <div className="w-[72px] h-[58px] bg-paper-sheet border border-paper-edge rounded-[3px] cpj-card-shadow flex flex-col items-center justify-center">
            <span className="text-[20px] text-ink">◉</span>
            <span className="font-mono text-[8px] tracking-[0.12em] text-ink-faint mt-0.5">COMPANION</span>
          </div>
          <svg width="80" height="36" viewBox="0 0 90 40">
            <path
              d="M4 20 C30 6 60 34 86 20"
              fill="none"
              stroke="var(--color-blood)"
              strokeWidth="2"
              strokeDasharray={state === "done" ? "0" : "3 4"}
            />
            <path d="M80 14 L88 20 L80 26" fill="none" stroke="var(--color-blood)" strokeWidth="2" />
          </svg>
          <div className="w-[72px] h-[58px] bg-paper-sheet border border-paper-edge rounded-[3px] cpj-card-shadow flex flex-col items-center justify-center">
            <span className="text-[20px] text-ink">▤</span>
            <span className="font-mono text-[8px] tracking-[0.12em] text-ink-faint mt-0.5">JOURNAL</span>
          </div>
        </div>

        {state === "checking" && (
          <div className="flex items-center justify-center gap-2 text-ink-soft text-[12px] py-2 font-mono">
            <Loader2 className="w-4 h-4 animate-spin" /> checking your session...
          </div>
        )}

        {state === "anon" && (
          <div className="space-y-3">
            <p className="font-body text-[14px] text-ink-soft">sign in first to link the companion.</p>
            <Link href="/login">
              <StampButton className="w-full justify-center">▸ go to login</StampButton>
            </Link>
          </div>
        )}

        {(state === "ready" || state === "linking") && (
          <>
            <p className="font-body text-[15px] text-ink">signed in.</p>
            <StampButton onClick={connect} disabled={state === "linking"} className="w-full justify-center mt-3 py-3">
              {state === "linking" ? <Loader2 className="w-4 h-4 animate-spin" /> : "▸ connect the companion"}
            </StampButton>
            <p className="font-mono text-[9px] tracking-[0.1em] text-ink-faint mt-3">
              a one-time token links this browser · no judge credentials stored on the server
            </p>
          </>
        )}

        {state === "done" && (
          <div className="space-y-2">
            <Stamp label="CONNECTED" sub="LINK" rotate={-6} tone="green" />
            <p className="font-body text-[14px] text-ink-soft mt-3">
              you can close this tab - file something from any judge page.
            </p>
            <Link href="/admin" className="inline-block font-mono text-[11px] text-blueprint hover:underline">
              back to the journal ▸
            </Link>
          </div>
        )}
      </PaperSheet>
    </div>
  );
}
