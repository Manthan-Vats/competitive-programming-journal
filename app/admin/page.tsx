import React from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { localDateKey, problemDate } from "@/lib/date";
import { computePatternCounts } from "@/lib/portfolio";
import { CANONICAL_PATTERNS } from "@/lib/patterns";
import { ProblemCard } from "@/components/problem-card";
import { PaperSheet } from "@/components/paper/paper-sheet";
import { Cap, RedPen, LedgerRow } from "@/components/paper/bits";
import type { ProblemWithRelations } from "@/types";

export const dynamic = "force-dynamic";

type RawProblem = {
  id: string;
  title: string;
  platform: string;
  difficulty_norm: string;
  difficulty_raw: string | null;
  source_tags: string[] | null;
  custom_tags: string[] | null;
  ai_tags?: string[] | null;
  solved_at: string | null;
  created_at: string;
  timing_sessions: { started_at: string | null; ended_at: string | null }[] | null;
};

function totalSeconds(p: RawProblem): number {
  return (p.timing_sessions ?? []).reduce((acc, s) => {
    if (s.started_at && s.ended_at) {
      const d = Math.floor(
        (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000
      );
      return acc + (d > 0 ? d : 0);
    }
    return acc;
  }, 0);
}

function currentStreak(dayKeys: Set<string>): number {
  let streak = 0;
  const cur = new Date();
  for (let i = 0; i < 400; i++) {
    const key = localDateKey(cur);
    if (dayKeys.has(key)) {
      streak++;
    } else if (i !== 0) {
      break;
    }
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("problems")
    .select(
      `id, title, platform, difficulty_norm, difficulty_raw, source_tags, custom_tags,
       solved_at, created_at, timing_sessions ( started_at, ended_at )`
    )
    .order("created_at", { ascending: false });

  const problems = (rows ?? []) as RawProblem[];

  const todayKey = localDateKey(new Date());
  const dayKeys = new Set(problems.map((p) => localDateKey(problemDate(p))));
  const loggedToday = problems.filter(
    (p) => localDateKey(problemDate(p)) === todayKey
  ).length;
  const streak = currentStreak(dayKeys);

  const recent = [...problems]
    .sort(
      (a, b) =>
        new Date(problemDate(b)).getTime() - new Date(problemDate(a)).getTime()
    )
    .slice(0, 3)
    .map(
      (p) =>
        ({
          ...p,
          ai_tags: p.ai_tags ?? [],
          total_seconds: totalSeconds(p),
          solutions: [],
          timing_sessions: p.timing_sessions ?? [],
        }) as unknown as ProblemWithRelations
    );

  const totalHours = Math.round(
    problems.reduce((a, p) => a + totalSeconds(p), 0) / 3600
  );
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekCount = problems.filter(
    (p) => new Date(problemDate(p)).getTime() >= weekAgo
  ).length;

  const counts = computePatternCounts(problems);
  const covered = new Set(counts.map((c) => c.pattern));
  const missing = CANONICAL_PATTERNS.filter((p) => !covered.has(p));
  const gap = missing[0] ?? counts[counts.length - 1]?.pattern ?? null;

  const { data: cards } = await supabase
    .from("review_cards")
    .select("problem_id, due, suspended");
  const nowIso = new Date().toISOString();
  const due = (cards ?? []).filter(
    (c: { due: string | null; suspended: boolean | null }) =>
      !c.suspended && c.due != null && c.due <= nowIso
  ).length;
  const newCards = Math.max(0, problems.length - (cards?.length ?? 0));

  const dateLabel = new Date()
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();

  const strip: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = localDateKey(d);
    strip.push(problems.filter((p) => localDateKey(problemDate(p)) === k).length);
  }
  const heat = [
    "var(--color-heat-0)",
    "var(--color-heat-1)",
    "var(--color-heat-2)",
    "var(--color-heat-3)",
    "var(--color-heat-4)",
  ];
  const heatOf = (c: number) =>
    c <= 0 ? heat[0] : c === 1 ? heat[1] : c <= 3 ? heat[2] : c <= 6 ? heat[3] : heat[4];

  return (
    <PaperSheet variant="page" className="cpj-develop p-[22px] md:p-[26px]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Cap>MORNING BELL · {dateLabel}</Cap>
          <h1 className="font-display text-[44px] leading-[0.9] mt-1.5">WAKE UP.</h1>
          <p className="font-body italic text-[15px] text-ink-soft mt-1">
            a record of the day - it&apos;s time to solve.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_1.35fr] gap-7 mt-6">
        <div className="space-y-6">
          <div>
            <Cap>CURRENT STREAK</Cap>
            <div className="flex items-baseline gap-2.5">
              <span className="font-display text-[48px] leading-[0.9] text-blood">
                {streak}
              </span>
              <span className="font-body italic text-ink-soft">
                {streak === 1 ? "day, unbroken" : "days, unbroken"}
              </span>
            </div>
            <div className="flex gap-[3px] mt-2.5">
              {strip.map((c, i) => (
                <span
                  key={i}
                  className="cpj-cell-in w-[13px] h-[13px] rounded-[1px]"
                  style={{ background: heatOf(c), animationDelay: `${i * 50}ms` }}
                />
              ))}
            </div>
          </div>

          <div>
            <Cap>TODAY</Cap>
            <p className="font-body text-[17px] mt-1">
              {loggedToday} logged ·{" "}
              <span className="text-blood font-medium">2+2=5</span> waiting
            </p>
            <div className="mt-3">
              <RedPen>do one before noon</RedPen>
            </div>
          </div>

          <div>
            <Cap>DUE TO REVISIT</Cap>
            <PaperSheet
              variant="card"
              grain={false}
              className="border-l-[3px] border-blueprint p-3 mt-1.5"
            >
              {due + newCards > 0 ? (
                <>
                  <p className="font-body text-[17px]">
                    <span className="font-display text-[22px] align-[-2px] mr-0.5">
                      {due}
                    </span>{" "}
                    due ·{" "}
                    <span className="font-display text-[22px] align-[-2px] mr-0.5">
                      {newCards}
                    </span>{" "}
                    new
                  </p>
                  <Link
                    href="/admin/revision"
                    className="inline-block mt-1.5 font-mono text-[11px] text-blueprint hover:underline"
                  >
                    open revision
                  </Link>
                </>
              ) : (
                <p className="font-body italic text-[15px] text-ink-soft">
                  nothing waiting - everything in its right place.
                </p>
              )}
            </PaperSheet>
          </div>

          {/* ON RECORD - a small hand-logged ledger to balance the column (D3) */}
          <div className="pt-1">
            <Cap className="mb-1.5">ON RECORD</Cap>
            <div className="space-y-1.5">
              <LedgerRow label="SOLVED" value={<span className="text-[22px]">{problems.length}</span>} />
              <LedgerRow label="HOURS LOGGED" value={<span className="text-[22px]">{totalHours}</span>} />
              <LedgerRow label="THIS WEEK" accent value={<span className="text-[22px]">{weekCount}</span>} />
            </div>
          </div>
        </div>

        <div>
          <Cap className="mb-2.5">RECENT ENTRIES</Cap>
          {recent.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              {recent.map((p) => (
                <Link key={p.id} href={`/admin/problems/${p.id}`}>
                  <ProblemCard problem={p} variant="admin" />
                </Link>
              ))}
            </div>
          ) : (
            <p className="font-body italic text-[15px] text-ink-soft">
              nothing filed yet - capture one with the companion, or add a problem.
            </p>
          )}

          {gap && (
            <div className="flex items-center gap-3 mt-4 flex-wrap">
              <Cap>COVERAGE</Cap>
              <span className="font-body text-[14px] text-ink-soft">weakest area:</span>
              <RedPen rotate={-3} className="text-[17px]">
                still avoiding {gap}
              </RedPen>
              <Link
                href="/admin/problems"
                className="ml-auto font-mono text-[11px] text-blueprint hover:underline"
              >
                file under {gap}
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-5 pt-2.5 border-t border-paper-edge">
        <span className="font-body italic text-[13px] text-ink-soft">
          everything in its right place
        </span>
        <Cap>p.01</Cap>
      </div>
    </PaperSheet>
  );
}
