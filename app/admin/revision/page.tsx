"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { PaperSheet } from "@/components/paper/paper-sheet";
import { StampButton, GhostButton } from "@/components/paper/stamp";
import { Cap, TopicChip, RedPen } from "@/components/paper/bits";
import { ModifiedBear } from "@/components/modified-bear";
import { CopyButton } from "@/components/copy-button";
import { RevisionAssist } from "@/components/revision-assist";
import { DIFFICULTY_COLOR } from "@/lib/paper";
import { renderMarkdown } from "@/lib/markdown";
import { toast } from "sonner";

// Revision (P4): the daily spaced-repetition queue. Show a problem's statement, let the user
// recall/re-solve, reveal their own notes + solution + canonical patterns, then self-grade
// Again/Hard/Good/Easy - ts-fsrs (server) schedules the next review. New (never-reviewed) problems
// are seeded after the due ones. All driven by /api/review/{queue,grade,suspend}.

interface QueueProblem {
  id: string;
  title: string;
  url: string;
  platform: string;
  difficulty_norm: string;
  difficulty_raw: string | null;
  notes: string | null;
  statement: string | null;
  solved_at: string | null;
  solutions: { language: string; code: string }[] | null;
  patterns: string[];
}
interface QueueItem {
  card: { due: string; state: number; reps: number; last_rating: number | null } | null;
  problem: QueueProblem;
}
interface QueueResp {
  due: QueueItem[];
  new: QueueItem[];
  counts: { due: number; new: number };
}

// Grade stamps - palette + the static FSRS interval hint the spec calls for (<10m / 1d / 4d / 9d).
const GRADES: { key: string; label: string; hint: string; cls: string }[] = [
  { key: "again", label: "AGAIN", hint: "<10m", cls: "bg-blood text-[#FBE9E7]" },
  { key: "hard", label: "HARD", hint: "1d", cls: "bg-t-orange text-[#231300]" },
  { key: "good", label: "GOOD", hint: "4d", cls: "bg-t-green text-[#eef3e6]" },
  { key: "easy", label: "EASY", hint: "9d", cls: "bg-t-blue text-[#e7f1f3]" },
];

const PLATFORM_SHORT: Record<string, string> = {
  codeforces: "CF",
  leetcode: "LC",
  atcoder: "AC",
  spoj: "SPOJ",
  cses: "CSES",
  hackerrank: "HR",
  codechef: "CC",
  hackerearth: "HE",
  other: "-",
};

export default function RevisionPage() {
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [counts, setCounts] = useState({ due: 0, new: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/review/queue");
      const data: QueueResp = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to load");
      setQueue([...data.due, ...data.new]);
      setCounts(data.counts);
      setIndex(0);
      setRevealed(false);
      setReviewed(0);
    } catch (err: any) {
      toast.error(err.message || "Could not load your revision queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const current = queue[index];
  // Remaining-in-session, derived from position (queue is [...due, ...new]) so the header counts
  // tick down as you grade/skip instead of showing the stale load-time totals.
  const remaining = Math.max(queue.length - index, 0);
  const dueLeft = Math.max(counts.due - index, 0);
  const newLeft = Math.max(remaining - dueLeft, 0);
  const advance = () => {
    setRevealed(false);
    setIndex((i) => i + 1);
  };

  const grade = async (rating: string) => {
    if (!current) return;
    setBusy(true);
    try {
      const res = await fetch("/api/review/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem_id: current.problem.id, rating }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to grade");
      setReviewed((n) => n + 1);
      advance();
    } catch (err: any) {
      toast.error(err.message || "Failed to record your grade.");
    } finally {
      setBusy(false);
    }
  };

  const suspend = async () => {
    if (!current) return;
    setBusy(true);
    try {
      const res = await fetch("/api/review/suspend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem_id: current.problem.id, suspended: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      toast.success("Removed from revision.");
      advance();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove from revision.");
    } finally {
      setBusy(false);
    }
  };

  const edge = current ? DIFFICULTY_COLOR[current.problem.difficulty_norm] || DIFFICULTY_COLOR.unknown : "";
  const plat = current
    ? PLATFORM_SHORT[current.problem.platform] || current.problem.platform?.toUpperCase()
    : "";
  const rating = current ? current.problem.difficulty_raw || current.problem.difficulty_norm : "";

  return (
    <PaperSheet variant="page" className="cpj-develop p-[22px] md:p-[26px]">
      <main className="max-w-3xl mx-auto space-y-6">
        {/* Header - EVERYTHING IN ITS RIGHT PLACE */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <Cap>04 · REVISION</Cap>
            <h1 className="font-display text-[34px] leading-[0.95] text-ink mt-[5px] max-w-[13ch] uppercase">
              EVERYTHING IN ITS RIGHT PLACE
            </h1>
            <p className="font-body italic text-[14px] text-ink-soft mt-1">
              put it back where it belongs.
            </p>
          </div>
          <div className="text-right shrink-0 font-mono text-[12px] text-ink-soft">
            <span className="text-blood">{dueLeft}</span> due ·{" "}
            <span className="text-ink">{newLeft}</span> new
            {reviewed > 0 && (
              <div className="text-ink-faint text-[11px] tracking-[0.12em] uppercase mt-1">
                {reviewed} reviewed
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-ink-soft font-mono text-[13px] py-16 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> pulling the next card...
          </div>
        ) : !current ? (
          // Caught-up / empty - a quiet sheet with the bear.
          <PaperSheet variant="card" className="p-12 text-center">
            <ModifiedBear className="w-10 h-10 text-ink-faint mx-auto opacity-50" />
            <p className="font-body italic text-[15px] text-ink-soft mt-3 leading-relaxed">
              everything in its right place.
              <br />
              nothing due - come back tomorrow.
            </p>
            {reviewed > 0 && (
              <p className="font-mono text-[11px] text-ink-faint uppercase tracking-[0.12em] mt-3">
                {reviewed} reviewed today
              </p>
            )}
            {reviewed > 0 && (
              <div className="mt-4 flex justify-center">
                <GhostButton onClick={load}>reload queue</GhostButton>
              </div>
            )}
          </PaperSheet>
        ) : (
          <div className="space-y-5">
            {/* FLASHCARD + DECK */}
            <div className="relative">
              {/* faint deck behind the active card */}
              <div className="absolute inset-0 z-0" aria-hidden>
                <div className="absolute top-[8px] left-[6px] right-[6px] h-full rounded-[3px] bg-paper-sheet cpj-card-shadow opacity-60 rotate-[0.8deg]" />
                <div className="absolute top-[5px] left-[3px] right-[3px] h-full rounded-[3px] bg-paper-sheet cpj-card-shadow opacity-80 rotate-[-0.6deg]" />
              </div>

              {/* the flashcard */}
              <PaperSheet
                variant="card"
                className="relative z-[1] border-l-[3px] p-[16px] md:p-[18px]"
                style={{ borderLeftColor: edge }}
              >
                {/* progress / deck depth */}
                <div className="flex items-center justify-between font-mono text-[10px] text-ink-faint uppercase tracking-[0.12em] mb-2">
                  <span>
                    card {index + 1} of {queue.length}
                  </span>
                  <span>{current.card ? `seen ${current.card.reps}×` : "new"}</span>
                </div>

                {/* front - platform·rating chip + title */}
                <div className="flex items-center gap-[9px] flex-wrap">
                  <span
                    className="font-mono text-[10px] px-[7px] py-[2px] rounded-[2px]"
                    style={{ background: edge, color: "#1c1812" }}
                  >
                    {plat} · {rating}
                  </span>
                  <h2 className="font-display text-[22px] leading-none text-ink uppercase">
                    {current.problem.title}
                  </h2>
                  <a
                    href={current.problem.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto font-mono text-[10px] text-ink-faint hover:text-blood uppercase tracking-[0.1em]"
                  >
                    open
                  </a>
                </div>

                {/* statement */}
                {current.problem.statement ? (
                  <p
                    data-lenis-prevent
                    className="font-body text-[16px] leading-[1.62] text-ink mt-3 whitespace-pre-wrap max-h-[46vh] overflow-y-auto pr-2"
                  >
                    {current.problem.statement}
                  </p>
                ) : (
                  <p className="font-body italic text-[15px] text-ink-soft mt-3">
                    No statement saved - open the problem and recall your approach.
                  </p>
                )}

                {/* pattern chips */}
                {current.problem.patterns.length > 0 && (
                  <div className="flex flex-wrap gap-[5px] mt-3">
                    {current.problem.patterns.map((p) => (
                      <TopicChip key={p} tag={p} />
                    ))}
                  </div>
                )}

                {/* reveal / answer */}
                {!revealed ? (
                  <div className="mt-4">
                    <GhostButton
                      onClick={() => setRevealed(true)}
                      className="border-blueprint text-blueprint hover:bg-blueprint/5"
                    >
                      ▸ show my solution &amp; notes
                    </GhostButton>
                  </div>
                ) : (
                  <div className="mt-4 border-t border-dashed border-ink/25 pt-4 space-y-4">
                    {/* notes */}
                    {current.problem.notes && (
                      <div>
                        <Cap className="mb-1.5">NOTES</Cap>
                        <div
                          className="font-body text-[15px] leading-[1.6] text-ink"
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(current.problem.notes) }}
                        />
                      </div>
                    )}

                    {/* solution - graph-paper insert (client-safe CodeInsert) */}
                    <div>
                      <Cap className="mb-1.5">
                        {current.problem.solutions?.length ? "YOUR SOLUTION" : "SOLUTION"}
                      </Cap>
                      {current.problem.solutions?.length ? (
                        current.problem.solutions.map((s, i) => (
                          <div
                            key={i}
                            className="relative w-full cpj-graph cpj-card-shadow rounded-[3px] overflow-hidden mb-2"
                          >
                            <div
                              className="absolute left-[38px] top-0 bottom-0 w-px bg-margin-red pointer-events-none"
                              aria-hidden
                            />
                            <div className="relative flex items-center justify-between px-4 pt-2.5 pb-1">
                              <span className="font-mono text-[10px] tracking-[0.16em] text-ink-faint uppercase">
                                {s.language}
                              </span>
                              <CopyButton code={s.code} />
                            </div>
                            <pre data-lenis-prevent className="cpj-code relative px-4 pb-3.5 pl-[14px] overflow-auto text-[13px] font-mono leading-[1.65] text-ink m-0 max-h-[40vh]">
                              <code>{s.code}</code>
                            </pre>
                          </div>
                        ))
                      ) : (
                        <p className="font-body italic text-[14px] text-ink-soft">
                          No saved solution - grade on recall alone.
                        </p>
                      )}
                    </div>

                    {/* a little red-pen marginalia */}
                    <RedPen className="text-[15px]">put it back where it belongs.</RedPen>

                    {/* grade stamps */}
                    <div>
                      <Cap className="mb-1.5">HOW WELL DID YOU RECALL IT?</Cap>
                      <div className="flex gap-[10px] flex-wrap">
                        {GRADES.map((g) => (
                          <div key={g.key} className="flex-1 min-w-[96px] text-center">
                            <button
                              disabled={busy}
                              onClick={() => grade(g.key)}
                              className={`cpj-press w-full rounded-[2px] py-[9px] font-type text-[14px] disabled:opacity-50 disabled:pointer-events-none ${g.cls}`}
                              style={{ boxShadow: "0 2px 0 rgba(0,0,0,.22)" }}
                            >
                              {g.label}
                            </button>
                            <span className="block font-mono text-[9px] tracking-[0.1em] text-ink-faint mt-[5px]">
                              {g.hint}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* row actions */}
                <div className="flex items-center justify-between mt-4 font-mono text-[11px]">
                  <button
                    onClick={advance}
                    disabled={busy}
                    className="text-ink-soft hover:text-ink uppercase tracking-[0.08em] disabled:opacity-50"
                  >
                    skip
                  </button>
                  <button
                    onClick={suspend}
                    disabled={busy}
                    className="text-ink-faint hover:text-blood uppercase tracking-[0.08em] disabled:opacity-50"
                  >
                    remove from revision
                  </button>
                </div>
              </PaperSheet>
            </div>

            {/* SECOND OPINION - AI assists below the card at full readable width, keyed per
                problem so results reset per card. */}
            <div className="border-t border-dashed border-ink/25 pt-5">
              <RevisionAssist
                key={current.problem.id}
                problemId={current.problem.id}
                hasSolution={!!current.problem.solutions?.length}
              />
            </div>
          </div>
        )}
      </main>
    </PaperSheet>
  );
}
