"use client";

import React, { useState, useMemo, useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip } from "recharts";
import { useWidth } from "@/lib/use-width";
import { ProblemWithRelations, Profile } from "@/types";
import { ProblemCard } from "@/components/problem-card";
import { Heatmap } from "@/components/heatmap";
import { PaperSheet } from "@/components/paper/paper-sheet";
import { Cap } from "@/components/paper/bits";
import { PublicHero } from "@/components/public-hero";
import { localDateKey, problemDate } from "@/lib/date";
import Link from "next/link";

interface PublicPortfolioProps {
  problems: ProblemWithRelations[];
  profile: Profile | null;
  /** trailing sections (verified stats, request access) rendered INSIDE the same
   *  sheet so the public page is one continuous case file, not sheets on a void. */
  children?: React.ReactNode;
}

// paper paradigm spectrum (HttT set)
const COLORS = [
  "var(--color-blood)",
  "#C9A227",
  "var(--color-blueprint)",
  "var(--color-t-green)",
  "var(--color-t-orange)",
  "var(--color-t-red)",
  "var(--color-t-blue)",
  "#9C7B14",
];

export const PublicPortfolio: React.FC<PublicPortfolioProps> = ({ problems, profile, children }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [chartRef, chartWidth] = useWidth<HTMLDivElement>();

  const [activePlatform, setActivePlatform] = useState<string>("all");
  const [activeDifficulty, setActiveDifficulty] = useState<string>("all");

  const displayName = profile?.display_name || "A SolveLog member";
  const bio =
    profile?.bio ||
    "A record of every problem solved - with the accepted code, the time it took, and what the solution actually does. Read-only. Filed by hand.";

  const stats = useMemo(() => {
    const totalProblems = problems.length;
    let totalSeconds = 0;
    const platforms = new Set<string>();
    problems.forEach((p) => {
      platforms.add(p.platform);
      p.timing_sessions?.forEach((s: { started_at?: string | null; ended_at?: string | null }) => {
        if (s.started_at && s.ended_at) {
          const diff = Math.floor(
            (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000
          );
          totalSeconds += diff > 0 ? diff : 0;
        }
      });
    });
    const hours = Math.round(totalSeconds / 3600);

    let longestStreak = 0;
    let currentStreak = 0;
    const uniqueDatesStr = Array.from(new Set(problems.map((p) => localDateKey(problemDate(p))).sort()));
    if (uniqueDatesStr.length > 0) {
      const datesMs = uniqueDatesStr.map((d) => new Date(d).getTime());
      let tempStreak = 1;
      for (let i = 1; i < datesMs.length; i++) {
        const diffDays = Math.round((datesMs[i] - datesMs[i - 1]) / (24 * 60 * 60 * 1000));
        if (diffDays === 1) tempStreak++;
        else if (diffDays > 1) {
          if (tempStreak > longestStreak) longestStreak = tempStreak;
          tempStreak = 1;
        }
      }
      if (tempStreak > longestStreak) longestStreak = tempStreak;
      // Compare via LOCAL date-key strings (new Date("YYYY-MM-DD") is UTC midnight -> off by a day).
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const lastKey = uniqueDatesStr[uniqueDatesStr.length - 1];
      currentStreak =
        lastKey === localDateKey(today) || lastKey === localDateKey(yesterday) ? tempStreak : 0;
    }

    return {
      totalProblems,
      hours,
      currentStreak,
      longestStreak: Math.max(longestStreak, currentStreak),
      platformsCount: platforms.size,
      uniqueDatesCount: uniqueDatesStr.length,
    };
  }, [problems]);

  const heatmapData = useMemo(() => {
    const counts: Record<string, number> = {};
    problems.forEach((p) => {
      const dateStr = localDateKey(problemDate(p));
      counts[dateStr] = (counts[dateStr] || 0) + 1;
    });
    return Object.entries(counts).map(([date, count]) => ({ date, count }));
  }, [problems]);

  const pieData = useMemo(() => {
    const topicCounts: Record<string, number> = {};
    problems.forEach((p) => {
      const tags = new Set<string>();
      p.solutions?.forEach((s) => {
        s.ai_analyses?.forEach((a) => {
          a.algorithms?.forEach((t: string) => tags.add(t));
          a.data_structures?.forEach((t: string) => tags.add(t));
          a.techniques?.forEach((t: string) => tags.add(t));
          a.math_concepts?.forEach((t: string) => tags.add(t));
        });
      });
      if (tags.size === 0) {
        p.source_tags?.forEach((t: string) => tags.add(t));
        p.custom_tags?.forEach((t: string) => tags.add(t));
      }
      tags.forEach((tag) => {
        const capitalized = tag.charAt(0).toUpperCase() + tag.slice(1);
        topicCounts[capitalized] = (topicCounts[capitalized] || 0) + 1;
      });
    });
    return Object.entries(topicCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [problems]);

  const filteredProblems = useMemo(() => {
    let result = [...problems];
    if (activePlatform !== "all") result = result.filter((p) => p.platform === activePlatform);
    if (activeDifficulty !== "all") result = result.filter((p) => p.difficulty_norm === activeDifficulty);
    return result;
  }, [problems, activePlatform, activeDifficulty]);

  const chip = (active: boolean) =>
    `px-2.5 py-1 rounded-[2px] font-mono text-[11px] capitalize transition-colors cursor-pointer ${
      active ? "bg-blood text-[#fbe9e7]" : "border border-paper-edge text-ink-faint hover:text-ink"
    }`;

  return (
    <>
      {/* full-bleed Title Wall - the name as architecture on the lit desk */}
      <PublicHero
        displayName={displayName}
        bio={bio}
        profile={profile}
        stats={{
          totalProblems: stats.totalProblems,
          hours: stats.hours,
          currentStreak: stats.currentStreak,
          platformsCount: stats.platformsCount,
        }}
        coverage={stats.platformsCount > 0 ? pieData.length : 0}
      />

      {/* the case-file record, docked below the wall */}
      <div className="relative mx-auto w-full max-w-[1140px] px-4 pb-14">
      <PaperSheet variant="page" className="cpj-develop w-full p-[26px] md:p-[34px] relative">
        {/* ACTIVITY */}
        <section className="mt-8" data-reveal>
          <Cap className="mb-2.5">02 · ACTIVITY</Cap>
          <Heatmap data={heatmapData} />
          <p className="font-mono text-[10px] text-ink-faint mt-2 pl-1">
            longest streak: {mounted ? stats.longestStreak : "-"} days · {stats.uniqueDatesCount} active days
          </p>
        </section>

        {/* PARADIGMS */}
        {pieData.length > 0 && (
          <section className="mt-8" data-reveal>
            <Cap className="mb-2.5">03 · ALGORITHMIC PARADIGMS</Cap>
            <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-6 bg-paper-sheet cpj-card-shadow rounded-[3px] p-5">
              <div ref={chartRef} className="md:col-span-5 h-[180px] flex items-center justify-center">
                {chartWidth > 0 && (
                <PieChart width={chartWidth} height={180}>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={72} paddingAngle={3} dataKey="value" isAnimationActive={false}>
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="var(--color-paper-sheet)" strokeWidth={2} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "var(--color-paper-sheet)",
                        borderColor: "var(--color-paper-edge)",
                        borderRadius: "3px",
                        fontSize: "11px",
                        color: "var(--color-ink)",
                        fontFamily: "var(--font-mono)",
                      }}
                    />
                </PieChart>
                )}
              </div>
              <div className="md:col-span-7 grid grid-cols-2 gap-x-5 gap-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                {pieData.map((d, index) => (
                  <div key={d.name} className="flex items-center gap-2 text-[12px] font-mono text-ink-soft">
                    <span className="w-2.5 h-2.5 rounded-[2px] shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="truncate flex-1">{d.name}</span>
                    <span className="text-ink-faint">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* PROBLEMS */}
        <section className="mt-8" data-reveal>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
            <Cap>04 · FILED · {filteredProblems.length} problems</Cap>
            <div className="flex flex-wrap gap-2">
              <div className="flex gap-1.5">
                {["all", "codeforces", "leetcode", "atcoder"].map((plat) => (
                  <button key={plat} onClick={() => setActivePlatform(plat)} className={chip(activePlatform === plat)}>
                    {plat === "all" ? "all" : plat}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5">
                {["all", "easy", "medium", "hard", "expert"].map((diff) => (
                  <button key={diff} onClick={() => setActiveDifficulty(diff)} className={chip(activeDifficulty === diff)}>
                    {diff}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filteredProblems.length === 0 ? (
            <p className="text-center py-12 font-body italic text-ink-soft text-[14px]">
              no public problems under these filters.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredProblems.map((problem) => (
                <Link
                  key={problem.id}
                  href={`/problem/${problem.id}`}
                  className="block focus-visible:outline-none"
                  aria-label={`Open ${problem.title}`}
                >
                  <ProblemCard problem={problem} variant="public" />
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* trailing sections folded into THIS sheet (no black gaps between pages) */}
        {children && (
          <div className="mt-8 pt-6 border-t border-paper-edge space-y-8">{children}</div>
        )}

        {/* colophon - part of the case file, on the paper, not floating on the desk */}
        <footer className="mt-10 pt-4 border-t-2 border-double border-paper-edge flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <span className="font-body italic text-[14px] text-ink-soft">
            everything in its right place · 2+2=5
          </span>
          <span className="font-mark text-[15px] text-blood/85 leading-tight">
            handcrafted by the TaxMan - aka Manthan Vats - himself
          </span>
          <span className="font-mono text-[11px] tracking-[0.16em] text-ink-faint uppercase">
            <a href="/privacy" className="hover:text-blood transition-colors">privacy</a>
            {" · "}
            <a href="/terms" className="hover:text-blood transition-colors">terms</a>
            {" · "}
            SOLVELOG · 2026
          </span>
        </footer>
      </PaperSheet>
      </div>
    </>
  );
};
export default PublicPortfolio;
