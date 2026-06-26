"use client";

import React, { useEffect, useState } from "react";
import { Copy, Download, ExternalLink, Loader2 } from "lucide-react";
import { GhostButton } from "@/components/paper/stamp";
import { Cap } from "@/components/paper/bits";
import { toast } from "sonner";

// SHOW-OFF (P3): the shareable "case-file" achievement card. Once at least one handle is verified
// the user gets an auto-updating image (/api/card/<user>) to embed in a GitHub README, a portfolio,
// or post to LinkedIn - plus copy-paste Markdown/HTML and a PNG download. The card itself only ever
// reflects verified, platform-pulled stats, so it can't be faked; the verify page is the trust link.

const PLATFORM_LABEL: Record<string, string> = {
  codeforces: "Codeforces",
  leetcode: "LeetCode",
  github: "GitHub",
};

export function ShareCard({ username }: { username?: string | null }) {
  const [origin, setOrigin] = useState("");
  const [verified, setVerified] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setOrigin(window.location.origin);
    (async () => {
      try {
        const res = await fetch("/api/verify");
        const data = await res.json();
        if (res.ok) {
          setVerified(
            (data.verifications ?? [])
              .filter((v: { status: string }) => v.status === "verified")
              .map((v: { platform: string }) => v.platform),
          );
        }
      } catch {
        /* non-fatal */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copied`);
    } catch {
      toast.error("Couldn't copy - select the text and copy manually.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-ink-soft text-[12px] py-2 font-mono">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading...
      </div>
    );
  }

  if (!username) {
    return (
      <p className="text-[11px] text-ink-faint font-body">
        Set your public handle (/u/...) above and save to unlock your shareable card.
      </p>
    );
  }

  if (verified.length === 0) {
    return (
      <p className="text-[11px] text-ink-faint font-body">
        Verify at least one handle above and your shareable achievement card appears here.
      </p>
    );
  }

  const cardUrl = `${origin}/api/card/${username}`;
  const verifyUrl = `${origin}/u/${username}`;
  const markdown = `[![SolveLog - verified](${cardUrl})](${verifyUrl})`;
  const html = `<a href="${verifyUrl}"><img src="${cardUrl}" width="520" alt="SolveLog - verified card" /></a>`;

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-display text-[18px] uppercase tracking-[0.02em] text-ink leading-none">
          Your achievement card
        </h4>
        <p className="text-[11px] text-ink-soft mt-1.5 font-body leading-relaxed max-w-prose">
          An auto-updating, verifiable card for your README, portfolio, or LinkedIn. It shows only{" "}
          <span className="text-ink">verified</span> stats (pulled from each platform) and links anyone
          back to your public verify page.
        </p>
      </div>

      {/* live preview */}
      <div className="rounded-[3px] border border-paper-edge bg-[#dcd4bf] p-3 overflow-x-auto">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cardUrl}
          alt="Your SolveLog verified card"
          className="max-w-full h-auto mx-auto block"
          style={{ width: 520 }}
        />
      </div>

      {/* actions */}
      <div className="flex flex-wrap items-center gap-2">
        <GhostButton type="button" onClick={() => copy(markdown, "Markdown")} className="uppercase tracking-[0.08em]">
          <Copy className="w-3.5 h-3.5" /> Copy Markdown
        </GhostButton>
        <GhostButton type="button" onClick={() => copy(html, "HTML")} className="uppercase tracking-[0.08em]">
          <Copy className="w-3.5 h-3.5" /> Copy HTML
        </GhostButton>
        <a
          href={`${cardUrl}?format=png`}
          download={`solvelog-${username}.png`}
          className="inline-flex items-center gap-1.5 text-[12px] font-mono uppercase tracking-[0.08em] text-blueprint hover:text-blood"
        >
          <Download className="w-3.5 h-3.5" /> Download PNG
        </a>
        <a
          href={verifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[12px] font-mono uppercase tracking-[0.08em] text-blueprint hover:text-blood"
        >
          <ExternalLink className="w-3.5 h-3.5" /> Verify page
        </a>
      </div>

      {/* markdown snippet */}
      <div className="flex items-center gap-2">
        <code className="flex-1 text-[10px] font-mono bg-[#E4DCC6] border border-paper-edge rounded-[3px] px-2 py-1 text-ink-soft truncate">
          {markdown}
        </code>
        <button
          type="button"
          onClick={() => copy(markdown, "Markdown")}
          className="text-ink-faint hover:text-ink"
          title="Copy markdown"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* per-platform cards */}
      {verified.length > 1 && (
        <div className="space-y-1.5 border-t border-dotted border-ink/20 pt-3">
          <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-faint">
            Single-platform cards
          </p>
          {verified.map((p) => {
            const md = `[![${PLATFORM_LABEL[p] ?? p}](${cardUrl}?platform=${p})](${verifyUrl})`;
            return (
              <div key={p} className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-ink-soft w-[88px] shrink-0">
                  {PLATFORM_LABEL[p] ?? p}
                </span>
                <code className="flex-1 text-[10px] font-mono bg-[#E4DCC6] border border-paper-edge rounded-[3px] px-2 py-1 text-ink-soft truncate">
                  {md}
                </code>
                <button
                  type="button"
                  onClick={() => copy(md, `${PLATFORM_LABEL[p] ?? p} markdown`)}
                  className="text-ink-faint hover:text-ink"
                  title="Copy markdown"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
