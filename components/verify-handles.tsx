"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, BadgeCheck, ShieldQuestion, Copy, ExternalLink } from "lucide-react";
import { StampButton, GhostButton, Stamp } from "@/components/paper/stamp";
import { toast } from "sonner";

// Verify ownership of judge handles (P3). Profile-token method: we issue a one-time token, the
// user pastes it into their public profile, we confirm it server-side and snapshot pulled stats.
// Verified handles unlock the shareable README badge (and the public verify page). Pure UI over
// /api/verify; the trust logic lives server-side.

type Platform = "codeforces" | "leetcode" | "github";

interface Verification {
  platform: Platform;
  handle: string;
  status: "pending" | "verified";
  verified_at: string | null;
  stats: Record<string, number | string | undefined>;
}

const PLATFORMS: { id: Platform; label: string }[] = [
  { id: "codeforces", label: "Codeforces" },
  { id: "leetcode", label: "LeetCode" },
  { id: "github", label: "GitHub" },
];

function headline(p: Platform, stats: Verification["stats"]): string {
  if (p === "codeforces")
    return [stats.rating && `${stats.rating} rating`, stats.solved && `${stats.solved} solved`]
      .filter(Boolean)
      .join(" · ") || "verified";
  if (p === "leetcode") return stats.solved !== undefined ? `${stats.solved} solved` : "verified";
  return stats.publicRepos !== undefined ? `${stats.publicRepos} repos` : "verified";
}

export function VerifyHandles({
  cfHandle,
  lcHandle,
  githubHandle,
  username,
}: {
  cfHandle?: string | null;
  lcHandle?: string | null;
  githubHandle?: string | null;
  username?: string | null;
}) {
  const [loading, setLoading] = useState(true);
  const [byPlatform, setByPlatform] = useState<Partial<Record<Platform, Verification>>>({});
  const [pending, setPending] = useState<Partial<Record<Platform, { token: string; hint: string }>>>({});
  const [busy, setBusy] = useState<Platform | null>(null);
  const [origin, setOrigin] = useState("");
  const [hasCompanion, setHasCompanion] = useState<boolean | null>(null);

  const handleFor = (p: Platform) =>
    (p === "codeforces" ? cfHandle : p === "leetcode" ? lcHandle : githubHandle)?.trim() || "";

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/verify");
      const data = await res.json();
      if (res.ok) {
        const map: Partial<Record<Platform, Verification>> = {};
        for (const v of data.verifications ?? []) map[v.platform as Platform] = v;
        setByPlatform(map);
      }
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setOrigin(window.location.origin);
    load();

    // Detect the companion + handle extension-backed verification results.
    let ponged = false;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window) return;
      const data = event.data;
      if (!data || typeof data.type !== "string") return;

      if (data.type === "CPJ_PONG") {
        ponged = true;
        setHasCompanion(true);
      } else if (
        data.type === "CPJ_VERIFY_RESULT" &&
        (data.judge === "codeforces" || data.judge === "leetcode")
      ) {
        const result = data.result || {};
        if (!result.signedIn || !result.handle) {
          toast.error(`Log in to ${label(data.judge)} in this browser, then try again.`);
          setBusy(null);
          return;
        }
        fetch("/api/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "confirm_extension", platform: data.judge, evidence: result.handle }),
        })
          .then((r) => r.json())
          .then((d) => {
            if (d.verified) {
              toast.success(`${label(data.judge)} verified via companion`);
              load();
            } else {
              toast.error(d.error || "Verification failed");
            }
          })
          .catch(() => toast.error("Verification failed"))
          .finally(() => setBusy(null));
      }
    };
    window.addEventListener("message", onMessage);
    window.postMessage({ type: "CPJ_PING" }, window.location.origin);
    const t = setTimeout(() => {
      if (!ponged) setHasCompanion(false);
    }, 1500);
    return () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(t);
    };
  }, [load]);

  const start = async (p: Platform) => {
    const handle = handleFor(p);
    if (!handle) return toast.error(`Add and save your ${label(p)} handle above first.`);
    setBusy(p);
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", platform: p, handle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start");
      setPending((prev) => ({ ...prev, [p]: { token: data.token, hint: data.hint } }));
    } catch (err: any) {
      toast.error(err.message || "Failed to start verification");
    } finally {
      setBusy(null);
    }
  };

  const confirm = async (p: Platform) => {
    setBusy(p);
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", platform: p }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to verify");
      if (data.verified) {
        toast.success(`${label(p)} verified`);
        setPending((prev) => ({ ...prev, [p]: undefined }));
        await load();
      } else {
        toast.error(data.error || "Token not found yet - add it, save, and try again.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to verify");
    } finally {
      setBusy(null);
    }
  };

  // Extension-backed verification: the companion reads the handle you're logged in as (no token).
  const verifyWithCompanion = (p: Platform) => {
    setBusy(p);
    toast.message(`Opening ${label(p)} to verify...`);
    window.postMessage({ type: "CPJ_VERIFY", judge: p }, window.location.origin);
  };

  // LinkedIn "Add to Profile" certification deep-link (documented params).
  const linkedInUrl = (p: Platform, v: Verification) => {
    const now = new Date();
    const params = new URLSearchParams({
      startTask: "CERTIFICATION_NAME",
      name: `Verified ${label(p)} - ${headline(p, v.stats)}`,
      organizationName: "SolveLog",
      certUrl: `${origin}/u/${username}`,
      certId: `${username}-${p}`,
      issueYear: String(now.getFullYear()),
      issueMonth: String(now.getMonth() + 1),
    });
    return `https://www.linkedin.com/profile/add?${params.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-display text-[18px] uppercase tracking-[0.02em] text-ink leading-none">
          Verify your handles
        </h4>
        <p className="text-[11px] text-ink-soft mt-1.5 font-body leading-relaxed max-w-prose">
          Prove you own each account so your stats count as <span className="text-ink">verified</span>{" "}
          (pulled from the platform, never typed). Verified handles unlock a shareable README badge and the
          public verify page.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-ink-soft text-[12px] py-2 font-mono">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading...
        </div>
      ) : (
        <div className="space-y-3">
          {PLATFORMS.map(({ id, label: pl }) => {
            const v = byPlatform[id];
            const pend = pending[id];
            const isBusy = busy === id;
            const handle = handleFor(id);
            const verified = v?.status === "verified";

            return (
              <div key={id} className="border border-paper-edge rounded-[3px] p-4 bg-paper-sheet cpj-card-shadow space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {verified ? (
                      <BadgeCheck className="w-4 h-4 text-t-green shrink-0" />
                    ) : (
                      <ShieldQuestion className="w-4 h-4 text-ink-faint shrink-0" />
                    )}
                    <span className="text-[12px] font-mono uppercase tracking-[0.08em] text-ink-soft">{pl}</span>
                    {handle && <span className="text-[11px] text-ink-faint font-mono truncate">@{handle}</span>}
                  </div>
                  {verified ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-t-green font-mono">{headline(id, v!.stats)}</span>
                      <Stamp label="VERIFIED" sub="OK" tone="green" size="sm" rotate={-4} />
                    </div>
                  ) : !handle ? (
                    <span className="text-[11px] text-ink-faint font-body shrink-0">add handle above</span>
                  ) : !pend ? (
                    <GhostButton
                      type="button"
                      onClick={() => start(id)}
                      disabled={!!busy}
                      className="uppercase tracking-[0.08em]"
                    >
                      {isBusy ? <Loader2 className="w-[13px] h-[13px] animate-spin" /> : "Verify"}
                    </GhostButton>
                  ) : (
                    <StampButton
                      type="button"
                      onClick={() => confirm(id)}
                      disabled={!!busy}
                      className="text-[12px] font-mono uppercase tracking-[0.08em] py-1.5 px-3"
                    >
                      {isBusy ? <Loader2 className="w-[13px] h-[13px] animate-spin" /> : "Check"}
                    </StampButton>
                  )}
                </div>

                {/* extension-backed verification (CF/LC) - no token, reads your live login */}
                {!verified && hasCompanion && id !== "github" && !pend && (
                  <button
                    type="button"
                    onClick={() => verifyWithCompanion(id)}
                    disabled={!!busy}
                    className="text-[11px] text-blueprint hover:text-blood font-mono inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <BadgeCheck className="w-3.5 h-3.5" /> verify instantly with the companion (no token)
                  </button>
                )}

                {/* token + instructions while pending */}
                {!verified && pend && (
                  <div className="space-y-2 border-t border-dotted border-ink/20 pt-3">
                    <p className="text-[11px] text-ink-soft font-body">{pend.hint}</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-[12px] font-mono bg-paper border border-dashed border-blood rounded-[3px] px-2 py-1 text-blood">
                        {pend.token}
                      </code>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(pend.token);
                          toast.success("Token copied");
                        }}
                        className="text-ink-faint hover:text-ink"
                        title="Copy token"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[10px] text-ink-faint font-body">
                      You can remove the token from your profile once it&apos;s verified.
                    </p>
                  </div>
                )}

                {/* share: per-platform LinkedIn certification + verify page. The embeddable
                    achievement card lives in the "SHOW OFF" section below. */}
                {verified && username && origin && (
                  <div className="flex items-center justify-between gap-2 border-t border-dotted border-ink/20 pt-3">
                    <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-faint">
                      add as a credential
                    </p>
                    <div className="flex items-center gap-3">
                      <a
                        href={linkedInUrl(id, v!)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-blueprint hover:text-blood font-mono inline-flex items-center gap-1"
                      >
                        add to LinkedIn <ExternalLink className="w-3 h-3" />
                      </a>
                      <a
                        href={`/u/${username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-blueprint hover:text-blood font-mono inline-flex items-center gap-1"
                      >
                        verify page <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {!username && (
            <p className="text-[11px] text-ink-faint font-body">
              Set your public handle (/u/...) above and save to enable the README badge + verify page.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function label(p: Platform): string {
  return p === "codeforces" ? "Codeforces" : p === "leetcode" ? "LeetCode" : "GitHub";
}
