"use client";

import React, { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  AreaChart,
  Area,
  CartesianGrid,
} from "recharts";
import { Heatmap } from "@/components/heatmap";
import { LedgerRow } from "@/components/paper/bits";
import { localDateKey, problemDate } from "@/lib/date";
import { useWidth } from "@/lib/use-width";

/** EmptyPanel - an intentional "nothing filed yet" state, not a blank void. */
function EmptyPanel({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex-1 min-h-[200px] flex flex-col items-center justify-center text-center gap-1.5 rounded-[3px] border border-dashed border-paper-edge bg-[rgba(33,30,24,0.015)] cpj-graph px-4 py-8">
      <span className="font-type text-[13px] text-ink-soft">{title}</span>
      <span className="font-mono text-[10px] tracking-[0.12em] text-ink-faint uppercase">
        {hint}
      </span>
    </div>
  );
}

interface AnalyticsDashboardProps {
  rawProblems: any[];
}

// Paper "lightly inked" palette - Hail to the Thief limited set on paper.
const COLORS = [
  "var(--color-blood)",
  "#C9A227",
  "var(--color-blueprint)",
  "var(--color-t-green)",
  "var(--color-t-orange)",
  "var(--color-t-red)",
  "var(--color-t-blue)",
];

// Helper to format seconds
const formatHours = (seconds: number): string => {
  const h = Math.round(seconds / 3600);
  return `${h}h`;
};

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  rawProblems,
}) => {
  const [pieRef, pieW] = useWidth<HTMLDivElement>();
  const [barRef, barW] = useWidth<HTMLDivElement>();
  const [areaRef, areaW] = useWidth<HTMLDivElement>();

  // 1. Calculations for Overview Cards
  const stats = useMemo(() => {
    const totalProblems = rawProblems.length;

    // Total Hours
    let totalSeconds = 0;
    rawProblems.forEach((p) => {
      p.timing_sessions?.forEach((s: any) => {
        if (s.started_at && s.ended_at) {
          const diff = Math.floor(
            (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000
          );
          totalSeconds += diff > 0 ? diff : 0;
        }
      });
    });

    // Solve count in the last 7 days
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const thisWeekCount = rawProblems.filter(
      (p) => new Date(problemDate(p)).getTime() >= sevenDaysAgo
    ).length;

    // Collect dates sorted to calculate streaks and active days
    const sortedDatesStr = rawProblems
      .map((p) => localDateKey(problemDate(p)))
      .sort();

    const uniqueDates = Array.from(new Set(sortedDatesStr));
    const activeDays = uniqueDates.length;

    // Streaks calculation
    let currentStreak = 0;
    let longestStreak = 0;

    if (uniqueDates.length > 0) {
      const datesMs = uniqueDates.map((d) => new Date(d).getTime());

      let tempStreak = 1;
      for (let i = 1; i < datesMs.length; i++) {
        const diffDays = Math.round((datesMs[i] - datesMs[i - 1]) / (24 * 60 * 60 * 1000));
        if (diffDays === 1) {
          tempStreak++;
        } else if (diffDays > 1) {
          if (tempStreak > longestStreak) longestStreak = tempStreak;
          tempStreak = 1;
        }
      }
      if (tempStreak > longestStreak) longestStreak = tempStreak;

      // Current streak counts only if the last active day is today or yesterday. Compare via LOCAL
      // date-key strings - `new Date("YYYY-MM-DD")` parses as UTC midnight, which would be off by a
      // day for users far from UTC near midnight.
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const todayKey = localDateKey(today);
      const yesterdayKey = localDateKey(yesterday);

      const lastKey = uniqueDates[uniqueDates.length - 1];
      currentStreak = lastKey === todayKey || lastKey === yesterdayKey ? tempStreak : 0;
    }

    return {
      totalProblems,
      totalSeconds,
      thisWeekCount,
      currentStreak,
      longestStreak: Math.max(longestStreak, currentStreak),
      activeDays,
      uniqueDates,
    };
  }, [rawProblems]);

  // 2. Activity Heatmap data
  const heatmapData = useMemo(() => {
    const counts: Record<string, number> = {};
    rawProblems.forEach((p) => {
      const dateStr = localDateKey(problemDate(p));
      counts[dateStr] = (counts[dateStr] || 0) + 1;
    });

    return Object.entries(counts).map(([date, count]) => ({
      date,
      count,
    }));
  }, [rawProblems]);

  // 3. Pie Chart Data (Topic breakdown by problem count)
  const pieData = useMemo(() => {
    const topicCounts: Record<string, number> = {};

    rawProblems.forEach((p) => {
      const tags = new Set<string>();
      // Gather AI tags
      p.solutions?.forEach((s: any) => {
        s.ai_analyses?.forEach((a: any) => {
          a.algorithms?.forEach((t: string) => tags.add(t));
          a.data_structures?.forEach((t: string) => tags.add(t));
          a.techniques?.forEach((t: string) => tags.add(t));
          a.math_concepts?.forEach((t: string) => tags.add(t));
        });
      });
      // Gather source/custom tags as fallback if AI is none
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
  }, [rawProblems]);

  // 4. Bar Chart Data (Avg Solve Time per Topic)
  const barData = useMemo(() => {
    const topicData: Record<string, { totalSeconds: number; count: number }> = {};

    rawProblems.forEach((p) => {
      // Calculate problem solve time
      let problemSeconds = 0;
      p.timing_sessions?.forEach((s: any) => {
        if (s.started_at && s.ended_at) {
          const diff = Math.floor(
            (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000
          );
          problemSeconds += diff > 0 ? diff : 0;
        }
      });

      const tags = new Set<string>();
      p.solutions?.forEach((s: any) => {
        s.ai_analyses?.forEach((a: any) => {
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
        if (!topicData[capitalized]) {
          topicData[capitalized] = { totalSeconds: 0, count: 0 };
        }
        topicData[capitalized].totalSeconds += problemSeconds;
        topicData[capitalized].count += 1;
      });
    });

    return Object.entries(topicData)
      .map(([topic, d]) => ({
        name: topic,
        // Average in minutes
        time: Math.round(d.totalSeconds / d.count / 60),
      }))
      .filter((d) => d.time > 0)
      .sort((a, b) => b.time - a.time)
      .slice(0, 6);
  }, [rawProblems]);

  // 5. Area Chart Data (Cumulative solved problems over time)
  const areaData = useMemo(() => {
    const sorted = [...rawProblems].sort(
      (a, b) => new Date(problemDate(a)).getTime() - new Date(problemDate(b)).getTime()
    );

    let cumulative = 0;
    const rawPoints = sorted.map((p) => {
      cumulative++;
      return {
        date: new Date(problemDate(p)),
        count: cumulative,
      };
    });

    // Sample data to maximum 30 points to keep line smooth
    if (rawPoints.length <= 30) {
      return rawPoints.map((p) => ({
        date: p.date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        count: p.count,
      }));
    }

    const sampledPoints = [];
    const step = Math.floor(rawPoints.length / 30);
    for (let i = 0; i < rawPoints.length; i += step) {
      sampledPoints.push(rawPoints[i]);
    }
    // Ensure last point is always included
    if (sampledPoints[sampledPoints.length - 1] !== rawPoints[rawPoints.length - 1]) {
      sampledPoints.push(rawPoints[rawPoints.length - 1]);
    }

    return sampledPoints.map((p) => ({
      date: p.date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count: p.count,
    }));
  }, [rawProblems]);

  return (
    <div className="space-y-6">
      {/* VITALS - hand-logged ledger strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-9 gap-y-[6px] border-y border-ink/20 py-[14px]">
        <LedgerRow
          label="SOLVED"
          value={<span className="text-[26px]">{stats.totalProblems}</span>}
        />
        <LedgerRow
          label="SOLVE-TIME"
          value={<span className="text-[26px]">{formatHours(stats.totalSeconds)}</span>}
        />
        <LedgerRow
          label="THIS WEEK"
          value={<span className="text-[26px]">{stats.thisWeekCount}</span>}
        />
        <LedgerRow
          label="STREAK"
          accent
          value={<span className="text-[26px]">{stats.currentStreak}</span>}
        />
        <LedgerRow
          label="MAX STREAK"
          value={<span className="text-[26px]">{stats.longestStreak}</span>}
        />
        <LedgerRow
          label="ACTIVE DAYS"
          value={<span className="text-[26px]">{stats.activeDays}</span>}
        />
      </div>

      {/* Heatmap Widget */}
      <div className="space-y-2" data-reveal>
        <h4 className="font-mono text-[10px] tracking-[0.16em] text-ink-faint uppercase">
          ACTIVITY · 52 WEEKS
        </h4>
        <Heatmap data={heatmapData} />
      </div>

      {/* Two Column Charts Grid - ruled ledger sections, not floating cards (R2) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 border-t border-paper-edge pt-5" data-reveal data-reveal-stagger>
        {/* Pie Chart (Topics problem count) */}
        <div className="flex flex-col min-h-[320px]">
          <h4 className="font-mono text-[10px] tracking-[0.16em] text-ink-faint uppercase mb-4">
            TOPIC DISTRIBUTION
          </h4>
          {pieData.length === 0 ? (
            <EmptyPanel title="nothing classified yet" hint="run AI analysis to map topics" />
          ) : (
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 items-center gap-4">
              <div ref={pieRef} className="relative sm:col-span-7 h-[200px] w-full overflow-hidden flex items-center justify-center">
                {pieW > 0 && (
                  <PieChart width={pieW} height={200}>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                      isAnimationActive={false}
                    >
                      {pieData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                          stroke="var(--color-paper-sheet)"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "var(--color-paper-sheet)",
                        borderColor: "var(--color-paper-edge)",
                        borderRadius: "3px",
                        fontSize: "11px",
                        fontFamily: "var(--font-mono)",
                        color: "var(--color-ink)",
                      }}
                    />
                  </PieChart>
                )}
              </div>

              {/* Legend list - mono ledger */}
              <div className="sm:col-span-5 space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {pieData.map((d, index) => (
                  <div
                    key={d.name}
                    className="flex items-center gap-2 font-mono text-[11px] text-ink-soft"
                  >
                    <span
                      className="w-[10px] h-[10px] rounded-[2px] shrink-0"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="truncate flex-1">{d.name}</span>
                    <span className="text-ink font-semibold">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bar Chart (Avg Solve Time per Topic) */}
        <div className="flex flex-col min-h-[320px] md:border-l md:border-paper-edge md:pl-8">
          <h4 className="font-mono text-[10px] tracking-[0.16em] text-ink-faint uppercase mb-4">
            AVG SOLVE-TIME / TOPIC · minutes
          </h4>
          {barData.length === 0 ? (
            <EmptyPanel title="no time on the clock yet" hint="track solve-time to fill this in" />
          ) : (
            <div ref={barRef} className="flex-1 h-[220px] w-full">
              {barW > 0 && (
                <BarChart width={barW} height={220} data={barData} layout="vertical" margin={{ left: -10, right: 10 }}>
                  <XAxis
                    type="number"
                    stroke="var(--color-graph-line)"
                    tick={{ fill: "var(--color-ink-faint)", fontSize: 11 }}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    stroke="var(--color-graph-line)"
                    tick={{ fill: "var(--color-ink-faint)", fontSize: 11 }}
                    width={110}
                    tickFormatter={(tick) => (tick.length > 15 ? `${tick.slice(0, 12)}...` : tick)}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "var(--color-paper-sheet)",
                      borderColor: "var(--color-paper-edge)",
                      borderRadius: "3px",
                      fontSize: "11px",
                      fontFamily: "var(--font-mono)",
                      color: "var(--color-ink)",
                    }}
                    cursor={{ fill: "rgba(33,30,24,.06)" }}
                  />
                  <Bar dataKey="time" fill="var(--color-blood)" radius={[0, 3, 3, 0]} barSize={14} isAnimationActive={false}>
                    {barData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Progress Chart (Cumulative Solved) */}
      <div className="border-t border-paper-edge pt-5 space-y-3" data-reveal>
        <h4 className="font-mono text-[10px] tracking-[0.16em] text-ink-faint uppercase">
          CUMULATIVE SOLVED
        </h4>
        {areaData.length === 0 ? (
          <EmptyPanel title="no progress logged yet" hint="file a problem to start the line" />
        ) : (
          <div ref={areaRef} className="h-[220px] w-full">
            {areaW > 0 && (
              <AreaChart width={areaW} height={220} data={areaData} margin={{ left: -15, right: 10, top: 10 }}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-blood)" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="var(--color-blood)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(33,30,24,.15)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="var(--color-graph-line)"
                  tick={{ fill: "var(--color-ink-faint)", fontSize: 11 }}
                />
                <YAxis
                  stroke="var(--color-graph-line)"
                  tick={{ fill: "var(--color-ink-faint)", fontSize: 11 }}
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "var(--color-paper-sheet)",
                    borderColor: "var(--color-paper-edge)",
                    borderRadius: "3px",
                    fontSize: "11px",
                    fontFamily: "var(--font-mono)",
                    color: "var(--color-ink)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="var(--color-blood)"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorCount)"
                  isAnimationActive={false}
                />
              </AreaChart>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
export default AnalyticsDashboard;
