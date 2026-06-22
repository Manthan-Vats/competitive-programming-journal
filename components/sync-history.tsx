"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, DownloadCloud, Puzzle, Check, AlertTriangle } from "lucide-react";
import { StampButton, GhostButton } from "@/components/paper/stamp";
import { toast } from "sonner";

// History sync, driven from the web app. The heavy lifting (reading your session-gated solved
// problems + submitted source) happens silently in the companion extension's background - the
// web app just asks for it and shows progress. See lib/sync.ts (extension) + the sync-bridge
// content script. If the companion isn't installed, we fall back to a problems-only server
// import (no code) and nudge the user to add the companion.

type Judge = "codeforces" | "leetcode";

interface SyncResult {
  success: boolean;
  judge?: Judge;
  totalFound?: number;
  alreadyHad?: number;
  attempted?: number;
  problemsImported?: number;
  solutionsImported?: number;
  capped?: boolean;
  error?: string;
}

interface Progress {
  attempted: number;
  total: number;
  problemsImported: number;
  solutionsImported: number;
}

const JUDGES: { id: Judge; label: string }[] = [
  { id: "codeforces", label: "Codeforces" },
  { id: "leetcode", label: "LeetCode" },
];

// Retry the presence ping a few times instead of a single 1500ms shot - the
// companion's content script and this component race to load, so one ping can land
// before the bridge is listening. We also accept the bridge's proactive HELLO.
const PING_RETRY_MS = [0, 250, 700, 1400, 2200];

export function SyncHistory({
  cfHandle,
  lcHandle,
}: {
  cfHandle?: string | null;
  lcHandle?: string | null;
}) {
  // null = still probing, true/false = companion present or not.
  const [hasCompanion, setHasCompanion] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<Judge | "fallback" | null>(null);
  const [progress, setProgress] = useState<Partial<Record<Judge, Progress>>>({});
  const [results, setResults] = useState<Partial<Record<Judge, SyncResult>>>({});
  const origin = useRef<string>("");

  // Probe for the companion (ping -> pong) and wire up sync progress/result listeners.
  useEffect(() => {
    origin.current = window.location.origin;
    let ponged = false;

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin.current || event.source !== window) return;
      const data = event.data;
      if (!data || typeof data.type !== "string") return;

      if (data.type === "CPJ_PONG" || data.type === "CPJ_COMPANION_HELLO") {
        ponged = true;
        setHasCompanion(true);
      } else if (data.type === "CPJ_SYNC_PROGRESS" && isJudge(data.judge)) {
        setProgress((p) => ({
          ...p,
          [data.judge]: {
            attempted: data.attempted ?? 0,
            total: data.total ?? 0,
            problemsImported: data.problemsImported ?? 0,
            solutionsImported: data.solutionsImported ?? 0,
          },
        }));
      } else if (data.type === "CPJ_SYNC_RESULT" && isJudge(data.judge)) {
        const result = (data.result ?? {}) as SyncResult;
        setResults((r) => ({ ...r, [data.judge]: result }));
        setBusy(null);
        setProgress((p) => ({ ...p, [data.judge]: undefined }));
        if (result.success) {
          toast.success(
            `${label(data.judge)}: ${result.problemsImported ?? 0} problems, ${
              result.solutionsImported ?? 0
            } solutions synced.`
          );
        } else {
          toast.error(result.error || `${label(data.judge)} sync failed.`);
        }
      }
    };

    window.addEventListener("message", onMessage);

    // Fire the ping several times; declare "absent" only after the last attempt.
    const timers = PING_RETRY_MS.map((delay, i) =>
      setTimeout(() => {
        if (ponged) return;
        window.postMessage({ type: "CPJ_PING" }, origin.current);
        if (i === PING_RETRY_MS.length - 1) {
          // give the last ping a moment to round-trip before giving up
          setTimeout(() => {
            if (!ponged) setHasCompanion(false);
          }, 400);
        }
      }, delay)
    );

    return () => {
      window.removeEventListener("message", onMessage);
      timers.forEach(clearTimeout);
    };
  }, []);

  const sync = useCallback(
    (judge: Judge) => {
      const handle = judge === "codeforces" ? cfHandle?.trim() : undefined;
      if (judge === "codeforces" && !handle) {
        toast.error("Add and save your Codeforces handle above first.");
        return;
      }
      setBusy(judge);
      setResults((r) => ({ ...r, [judge]: undefined }));
      setProgress((p) => ({ ...p, [judge]: { attempted: 0, total: 0, problemsImported: 0, solutionsImported: 0 } }));
      window.postMessage({ type: "CPJ_SYNC", judge, handle }, origin.current);
    },
    [cfHandle]
  );

  // Problems-only fallback (no companion): the existing server-side import.
  const importProblemsOnly = useCallback(async () => {
    setBusy("fallback");
    try {
      const res = await fetch("/api/import", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      toast.success(
        data.imported > 0
          ? `Imported ${data.imported} new problem${data.imported === 1 ? "" : "s"} (catalog only).`
          : "Nothing new - your problem catalog is up to date."
      );
    } catch (err: any) {
      toast.error(err.message || "Import failed");
    } finally {
      setBusy(null);
    }
  }, []);

  const handleFor = (j: Judge) => (j === "codeforces" ? cfHandle : lcHandle);

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-display text-[18px] uppercase tracking-[0.02em] text-ink leading-none">
          Sync solved history
        </h4>
        <p className="text-[13.5px] text-ink-soft mt-1.5 font-body leading-relaxed max-w-prose">
          Pull your accepted problems <span className="text-ink">and your submitted solution code</span>{" "}
          from each judge into your journal - deduped, with real solve dates. The companion opens the judge in a
          background tab and fetches from your logged-in session, so{" "}
          <span className="text-ink">just stay logged in to the judge</span> - you don&apos;t have to open
          it yourself. Codeforces fetches each submission&apos;s source, so a first sync can take a few minutes;
          re-syncing only grabs what&apos;s new.
        </p>
      </div>

      {hasCompanion === null && (
        <div className="flex items-center gap-2 text-ink-soft text-[12px] py-2 font-mono">
          <Loader2 className="w-4 h-4 animate-spin" /> Checking for the companion...
        </div>
      )}

      {hasCompanion === true && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {JUDGES.map(({ id, label: jl }) => {
            const r = results[id];
            const p = progress[id];
            const isBusy = busy === id;
            const noHandle = id === "codeforces" && !handleFor(id)?.trim();
            return (
              <div
                key={id}
                className="border border-paper-edge rounded-[3px] p-4 bg-paper-sheet cpj-card-shadow space-y-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-mono uppercase tracking-[0.08em] text-ink-faint">
                    {jl}
                  </p>
                  <StampButton
                    type="button"
                    onClick={() => sync(id)}
                    disabled={!!busy || noHandle}
                    className="text-[12px] font-mono uppercase tracking-[0.08em] py-1.5 px-3"
                  >
                    {isBusy ? (
                      <>
                        <Loader2 className="w-[13px] h-[13px] animate-spin" /> Syncing...
                      </>
                    ) : (
                      <>
                        <DownloadCloud className="w-[13px] h-[13px]" /> Sync
                      </>
                    )}
                  </StampButton>
                </div>

                {noHandle && (
                  <p className="text-[11px] text-ink-faint font-body">
                    Add your {jl} handle above and save first.
                  </p>
                )}

                {isBusy && p && (
                  <p className="text-[12px] text-ink-soft font-body">
                    {p.total > 0
                      ? `${p.attempted}/${p.total} fetched · ${p.problemsImported} problems, ${p.solutionsImported} solutions so far...`
                      : "Reading your session..."}
                  </p>
                )}

                {!isBusy && r && (
                  r.success ? (
                    <p className="text-[12px] text-ink-soft font-body flex items-start gap-1.5">
                      <Check className="w-3.5 h-3.5 text-t-green mt-0.5 shrink-0" />
                      <span>
                        <span className="text-ink font-semibold">{r.problemsImported ?? 0}</span> problems ·{" "}
                        <span className="text-ink font-semibold">{r.solutionsImported ?? 0}</span> solutions ·{" "}
                        {r.alreadyHad ?? 0} already had
                        {r.capped ? " · capped, sync again to continue" : ""}
                      </span>
                    </p>
                  ) : (
                    <p className="text-[12px] text-blood font-body flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>{r.error}</span>
                    </p>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}

      {hasCompanion === false && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 border border-paper-edge rounded-[3px] p-4 bg-paper-sheet cpj-card-shadow">
            <Puzzle className="w-4 h-4 text-ink-faint mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-[12px] text-ink-soft font-body">
                The companion isn&apos;t detected, so I can only import your{" "}
                <span className="text-ink">problem list</span> (no solution code). Install &amp; connect
                the companion to also sync your submitted code automatically - then reload this page.
              </p>
            </div>
          </div>
          <GhostButton
            type="button"
            onClick={importProblemsOnly}
            disabled={busy === "fallback" || !(cfHandle?.trim() || lcHandle?.trim())}
            className="uppercase tracking-[0.08em]"
          >
            {busy === "fallback" ? (
              <>
                <Loader2 className="w-[13px] h-[13px] animate-spin" /> Importing...
              </>
            ) : (
              <>
                <DownloadCloud className="w-[13px] h-[13px]" /> Import problem list only
              </>
            )}
          </GhostButton>
          {!(cfHandle?.trim() || lcHandle?.trim()) && (
            <p className="text-[11px] text-ink-faint font-body">
              Add a Codeforces or LeetCode handle above and save first.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function isJudge(v: unknown): v is Judge {
  return v === "codeforces" || v === "leetcode";
}
function label(j: Judge): string {
  return j === "codeforces" ? "Codeforces" : "LeetCode";
}
