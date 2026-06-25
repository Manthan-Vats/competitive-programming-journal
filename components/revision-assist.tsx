"use client";

import React, { useState } from "react";
import { Loader2, Lightbulb, Scale, Layers } from "lucide-react";
import { GhostButton } from "@/components/paper/stamp";
import { Cap, RedPen, TopicChip } from "@/components/paper/bits";
import { renderInline } from "@/lib/markdown";
import { toast } from "sonner";

// AI revision assists (P4 / P6 #2) for one card in the revision flow:
//   - Hint:    progressive nudges that don't spoil the solution (useful while recalling)
//   - Critique: feedback on the user's own saved solution
//   - Pattern card: a reusable "reach for this when..." card derived from the code
// All optional: if AI is off the endpoint returns 503 and we show a friendly note. Mount with a
// `key={problemId}` so state resets per card.

interface HintResult {
  hints: string[];
}
interface CritiqueResult {
  time_complexity: string;
  space_complexity: string;
  strengths: string[];
  improvements: string[];
  edge_cases: string[];
}
interface PatternCardResult {
  pattern: string;
  summary: string;
  when_to_use: string;
  key_steps: string[];
}

type Action = "hint" | "critique" | "pattern_card";

export function RevisionAssist({
  problemId,
  hasSolution,
}: {
  problemId: string;
  hasSolution: boolean;
}) {
  const [busy, setBusy] = useState<Action | null>(null);
  const [hint, setHint] = useState<HintResult | null>(null);
  const [shownHints, setShownHints] = useState(0);
  const [critique, setCritique] = useState<CritiqueResult | null>(null);
  const [card, setCard] = useState<PatternCardResult | null>(null);

  // `regenerate` forces a fresh model call; otherwise the server serves a saved result for this
  // problem instantly (no quota spent) when one exists.
  const run = async (action: Action, regenerate = false) => {
    setBusy(action);
    try {
      const res = await fetch("/api/review/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem_id: problemId, action, regenerate }),
      });
      const data = await res.json();
      if (res.status === 503) {
        toast.error("AI assists are not configured on this instance.");
        return;
      }
      if (!res.ok) throw new Error(data.error || "AI assist failed");

      if (action === "hint") {
        setHint(data.result);
        setShownHints(1);
      } else if (action === "critique") setCritique(data.result);
      else setCard(data.result);
    } catch (err: any) {
      toast.error(err.message || "AI assist failed");
    } finally {
      setBusy(null);
    }
  };

  // Small "regenerate" link shown on a loaded result - re-runs with a fresh model call.
  const Regen = ({ action }: { action: Action }) => (
    <button
      onClick={() => run(action, true)}
      disabled={busy !== null}
      title="Generate a fresh take (uses one AI request)"
      className="ml-auto font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint hover:text-blueprint disabled:opacity-40"
    >
      {busy === action ? "..." : "↻ regenerate"}
    </button>
  );

  return (
    <div className="space-y-3">
      {/* red-pen masthead + toolbar (horizontal so results below get the full readable width) */}
      <div className="flex items-center gap-3 flex-wrap">
        <RedPen rotate={-2} className="text-[17px]">
          second opinion
        </RedPen>
        <Cap className="tracking-[0.14em] !text-ink-faint">AI · NO SPOILERS</Cap>
      </div>

      <div className="flex flex-wrap gap-2">
        <GhostButton disabled={busy !== null} onClick={() => run("hint")}>
          {busy === "hint" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lightbulb className="w-3.5 h-3.5" />}
          give me a hint
        </GhostButton>
        <GhostButton
          className="disabled:border-dashed"
          disabled={busy !== null || !hasSolution}
          title={hasSolution ? "" : "No saved solution to analyze"}
          onClick={() => run("critique")}
        >
          {busy === "critique" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Scale className="w-3.5 h-3.5" />}
          critique my solution
        </GhostButton>
        <GhostButton
          className="disabled:border-dashed"
          disabled={busy !== null || !hasSolution}
          title={hasSolution ? "" : "No saved solution to analyze"}
          onClick={() => run("pattern_card")}
        >
          {busy === "pattern_card" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
          make a pattern card
        </GhostButton>
      </div>

      {/* Hint - revealed one at a time so it stays a nudge, not a spoiler. */}
      {hint && hint.hints.length > 0 && (
        <div className="bg-paper rounded-[3px] p-3 mt-2 shadow-[inset_0_0_0_1px_rgba(33,30,24,.08)] space-y-2">
          <div className="flex items-center gap-2">
            <Cap className="!text-ink-faint">
              HINT {Math.min(shownHints, hint.hints.length)} / {hint.hints.length}
            </Cap>
            <Regen action="hint" />
          </div>
          <ol className="list-decimal list-inside space-y-1.5">
            {hint.hints.slice(0, shownHints).map((h, i) => (
              <li
                key={i}
                className="font-body text-[14px] leading-[1.55] text-ink"
                dangerouslySetInnerHTML={{ __html: renderInline(h) }}
              />
            ))}
          </ol>
          {shownHints < hint.hints.length && (
            <button
              onClick={() => setShownHints((n) => n + 1)}
              className="font-mono text-[11px] text-blueprint hover:underline uppercase tracking-[0.08em]"
            >
              reveal next hint ▸
            </button>
          )}
        </div>
      )}

      {/* Critique */}
      {critique && (
        <div className="bg-paper rounded-[3px] p-3 mt-2 shadow-[inset_0_0_0_1px_rgba(33,30,24,.08)] space-y-2">
          <div className="flex items-center gap-2">
            <Cap className="!text-ink-faint">CRITIQUE</Cap>
            <Regen action="critique" />
          </div>
          <p className="font-mono text-[11px] text-ink">
            Time: {critique.time_complexity} · Space: {critique.space_complexity}
          </p>
          {critique.strengths.length > 0 && (
            <div className="font-body text-[14px] leading-[1.55] text-ink">
              <span className="text-ink-soft">Strengths:</span>
              <ul className="list-disc list-outside pl-5 space-y-1 mt-1">
                {critique.strengths.map((s, i) => (
                  <li key={i} dangerouslySetInnerHTML={{ __html: renderInline(s) }} />
                ))}
              </ul>
            </div>
          )}
          {critique.improvements.length > 0 && (
            <div className="font-body text-[14px] leading-[1.55] text-ink">
              <span className="text-ink-soft">Improvements:</span>
              <ul className="list-disc list-outside pl-5 space-y-1 mt-1">
                {critique.improvements.map((s, i) => (
                  <li key={i} dangerouslySetInnerHTML={{ __html: renderInline(s) }} />
                ))}
              </ul>
            </div>
          )}
          {critique.edge_cases.length > 0 && (
            <div className="font-body text-[14px] leading-[1.55] text-ink">
              <span className="text-ink-soft">Edge cases:</span>
              <ul className="list-disc list-outside pl-5 space-y-1 mt-1">
                {critique.edge_cases.map((s, i) => (
                  <li key={i} dangerouslySetInnerHTML={{ __html: renderInline(s) }} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Pattern card */}
      {card && (
        <div className="bg-paper rounded-[3px] p-3 mt-2 shadow-[inset_0_0_0_1px_rgba(33,30,24,.08)] space-y-2">
          <div className="flex items-center gap-2">
            <Cap className="!text-ink-faint">PATTERN CARD</Cap>
            <TopicChip tag={card.pattern} />
            <Regen action="pattern_card" />
          </div>
          <p
            className="font-body text-[14px] leading-[1.55] text-ink"
            dangerouslySetInnerHTML={{ __html: renderInline(card.summary) }}
          />
          <p className="font-body text-[14px] leading-[1.55] text-ink">
            <span className="text-ink-soft">Reach for it when:</span>{" "}
            <span dangerouslySetInnerHTML={{ __html: renderInline(card.when_to_use) }} />
          </p>
          {card.key_steps.length > 0 && (
            <ol className="list-decimal list-outside pl-5 space-y-1 font-body text-[14px] leading-[1.55] text-ink">
              {card.key_steps.map((s, i) => (
                <li key={i} dangerouslySetInnerHTML={{ __html: renderInline(s) }} />
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
