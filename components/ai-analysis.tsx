"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Loader2, Sparkles, CheckCircle, AlertTriangle } from "lucide-react";
import { StampButton } from "@/components/paper/stamp";
import { toast } from "sonner";

interface Status {
  ai_configured: boolean;
  model: string;
  total: number;
  analyzed: number;
  unanalyzed: number;
}

// "AI code classification" panel for /admin/settings. Shows whether AI is enabled (which model) and
// how many solutions still need classifying, with an "Analyze all" action that loops the bounded
// batch endpoint with live progress. Fully degrades when AI is off.
export function AIAnalysis() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/analyze/batch");
      if (res.ok) setStatus(await res.json());
    } catch {
      // leave previous status
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const analyzeAll = async () => {
    if (!status) return;
    setRunning(true);
    const startTotal = status.unanalyzed;
    setProgress({ done: 0, total: startTotal });
    let failures = 0;

    try {
      // Loop the bounded batch endpoint until nothing remains. Each call analyzes a few solutions
      // and reports how many are left, which drives the progress bar.
      for (let guard = 0; guard < 1000; guard++) {
        const res = await fetch("/api/analyze/batch", { method: "POST" });
        const data = await res.json();
        if (res.status === 503) {
          toast.error("AI is not configured on this instance.");
          break;
        }
        if (res.status === 429) {
          // hit the safety rate limit - back off briefly then continue
          await new Promise((r) => setTimeout(r, 4000));
          continue;
        }
        if (!res.ok) throw new Error(data.error || "Analysis failed");

        failures += data.failed ?? 0;
        setProgress({ done: Math.max(0, startTotal - (data.remaining ?? 0)), total: startTotal });
        if (data.done || (data.processed ?? 0) === 0) break;

        // Gentle pacing: the AI free tier caps requests-per-minute, so we space batches out to stay
        // under it instead of bursting (which would get some analyses rate-limited -> marked failed).
        await new Promise((r) => setTimeout(r, 1500));
      }
      await refresh();
      if (failures > 0) {
        toast.warning(`Analysis finished with ${failures} failure(s). You can run it again to retry.`);
      } else {
        toast.success("All solutions analyzed. Everything in its right place.");
      }
    } catch (err: any) {
      toast.error(err.message || "Analysis failed");
      await refresh();
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-blood" />
        <h4 className="text-[13px] font-semibold text-ink font-type uppercase tracking-wider">
          AI Code Classification
        </h4>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-ink-soft text-[12px] py-2 font-mono">
          <Loader2 className="w-4 h-4 animate-spin" /> Checking status...
        </div>
      ) : !status?.ai_configured ? (
        <div className="flex items-start gap-2 text-[12px] text-ink-soft font-body leading-relaxed">
          <AlertTriangle className="w-4 h-4 text-blood shrink-0 mt-0.5" />
          <span>
            AI analysis is <strong>off</strong>. Add your free Gemini key above to enable automatic
            algorithm/data-structure tagging of your solutions. The feature is entirely optional -
            everything else works without it.
          </span>
        </div>
      ) : (
        <>
          <p className="text-[12px] text-ink-soft font-body leading-relaxed">
            Classify your solution code into algorithms, data structures, techniques, and math
            concepts. Model:{" "}
            <span className="font-mono text-ink">{status.model || "configured"}</span>.
          </p>

          <div className="flex flex-wrap items-center gap-4 text-[12px] font-mono">
            <span className="text-ink-soft">
              <span className="text-t-green">{status.analyzed}</span> analyzed
            </span>
            <span className="text-ink-soft">
              <span className="text-blood">{status.unanalyzed}</span> pending
            </span>
            <span className="text-ink-faint">{status.total} total</span>
          </div>

          {running && progress && (
            <div className="space-y-1">
              <div className="h-1.5 bg-[rgba(33,30,24,.08)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-blood transition-all"
                  style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
              <p className="text-[11px] text-ink-faint font-mono">
                {progress.done} / {progress.total} analyzed...
              </p>
            </div>
          )}

          {status.unanalyzed === 0 ? (
            <div className="flex items-center gap-1.5 text-[12px] text-t-green font-body">
              <CheckCircle className="w-3.5 h-3.5" /> All solutions are analyzed.
            </div>
          ) : (
            <StampButton
              onClick={analyzeAll}
              disabled={running}
              className="text-[13px]"
            >
              {running ? (
                <>
                  <Loader2 className="w-[14px] h-[14px] animate-spin" /> Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-[14px] h-[14px]" /> Analyze all ({status.unanalyzed})
                </>
              )}
            </StampButton>
          )}
        </>
      )}
    </div>
  );
}
