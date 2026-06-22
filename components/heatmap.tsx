"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ModifiedBear } from "@/components/modified-bear";
import { localDateKey } from "@/lib/date";

interface HeatmapProps {
  data: { date: string; count: number }[];
  className?: string;
}

const HEAT_COLORS = [
  "bg-heat-0", // 0 problems
  "bg-heat-1", // 1 problem
  "bg-heat-2", // 2-3 problems
  "bg-heat-3", // 4-6 problems
  "bg-heat-4", // 7+ problems
];

const getHeatLevel = (count: number): number => {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
};

export const Heatmap: React.FC<HeatmapProps> = ({ data, className = "" }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Map date strings to counts for O(1) lookups. Callers already pass LOCAL "YYYY-MM-DD"
  // keys (via localDateKey); normalize defensively without a UTC round-trip (the old
  // `new Date(item.date).toISOString()` shifted keys by a day for non-UTC users).
  const dataMap = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach((item) => {
      const dateStr = /^\d{4}-\d{2}-\d{2}$/.test(item.date)
        ? item.date
        : localDateKey(item.date);
      map.set(dateStr, item.count);
    });
    return map;
  }, [data]);

  // Generate 52 weeks * 7 days of dates ending today
  const gridData = useMemo(() => {
    const dates: Date[] = [];
    const today = new Date();

    // Find the current day of the week (0 = Sun, 1 = Mon, ..., 6 = Sat)
    // To align the grid nicely (each column is Mon-Sun), we want to end on the last complete week or today.
    // Let's generate exactly 364 days ending today.
    for (let i = 363; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      dates.push(date);
    }
    return dates;
  }, []);

  // Group dates into 52 columns of 7 days
  const columns = useMemo(() => {
    const cols: Date[][] = [];
    for (let i = 0; i < gridData.length; i += 7) {
      cols.push(gridData.slice(i, i + 7));
    }
    return cols;
  }, [gridData]);

  // Get month labels and their column indexes
  const monthLabels = useMemo(() => {
    const labels: { text: string; colIndex: number }[] = [];
    let lastMonth = -1;

    columns.forEach((col, colIdx) => {
      const firstDayOfMonth = col[0];
      const currentMonth = firstDayOfMonth.getMonth();
      if (currentMonth !== lastMonth) {
        labels.push({
          text: firstDayOfMonth.toLocaleString("default", { month: "short" }),
          colIndex: colIdx,
        });
        lastMonth = currentMonth;
      }
    });

    // Filter labels to prevent overlapping on mobile/desktop
    return labels;
  }, [columns]);

  const formatDateFull = (date: Date): string => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (!mounted) {
    return (
      <div className={`w-full bg-paper-sheet cpj-card-shadow p-[20px] rounded-[3px] min-h-[160px] flex items-center justify-center ${className}`}>
        <span className="text-[12px] text-ink-soft font-type cpj-caret">thumbing through the journal</span>
      </div>
    );
  }

  return (
    <div className={`w-full bg-paper-sheet cpj-card-shadow p-[20px] rounded-[3px] ${className}`}>
      <div className="overflow-x-auto pb-2 scrollbar-thin">
        <div className="min-w-[620px] sm:min-w-0">

          {/* Months Header */}
          <div className="relative h-[16px] mb-[6px] ml-[28px] text-[10px] text-ink-faint font-mono">
            {monthLabels.map((label, idx) => {
              // Position month label roughly above its column
              const leftOffset = label.colIndex * 13; // 11px width + 2px gap
              return (
                <span
                  key={`${label.text}-${idx}`}
                  className="absolute"
                  style={{ left: `${leftOffset}px` }}
                >
                  {label.text}
                </span>
              );
            })}
          </div>

          <div className="flex gap-[6px]">
            {/* Days labels on left */}
            <div className="flex flex-col gap-[2px] justify-between text-[10px] text-ink-faint font-mono w-[22px] pt-[2px]">
              <span>M</span>
              <span></span>
              <span>W</span>
              <span></span>
              <span>F</span>
              <span></span>
              <span></span>
            </div>

            {/* Weeks columns */}
            <div className="flex gap-[2px]">
              {columns.map((week, colIdx) => (
                <div key={`col-${colIdx}`} className="flex flex-col gap-[2px]">
                  {week.map((day) => {
                    const dateStr = localDateKey(day);
                    const count = dataMap.get(dateStr) || 0;
                    const heatLevel = getHeatLevel(count);
                    const colorClass = HEAT_COLORS[heatLevel];
                    // a bear sleeps on Oct 7 (Thom Yorke's birthday) - exit music
                    const isSecret = day.getMonth() === 9 && day.getDate() === 7;

                    return (
                      <Tooltip key={dateStr}>
                        <TooltipTrigger
                          render={
                            <div
                              className={`relative cpj-cell-in w-[11px] h-[11px] rounded-[1px] ${colorClass} shadow-[inset_0_0_0_1px_rgba(33,30,24,0.09)] transition-colors duration-150 cursor-pointer hover:ring-1 hover:ring-blood/60 ${
                                isSecret ? "ring-1 ring-blood/50" : ""
                              }`}
                              style={{ animationDelay: `${colIdx * 12}ms` }}
                            >
                              {isSecret && (
                                <ModifiedBear className="absolute inset-[-1px] h-[13px] w-[13px] text-ink/70" />
                              )}
                            </div>
                          }
                        />
                        <TooltipContent side="top" className="bg-paper-sheet border-paper-edge text-ink text-[11px] font-body">
                          {isSecret ? (
                            <span className="font-type">a bear sleeps here · exit music</span>
                          ) : (
                            <>
                              <span className="font-semibold">{count} problems</span> on {formatDateFull(day)}
                            </>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Legend below */}
      <div className="flex items-center justify-between mt-[14px] text-[11px] text-ink-soft font-body border-t border-paper-edge pt-[10px]">
        <div className="text-ink-soft font-body italic">
          how to disappear completely - one square at a time
        </div>
        <div className="flex items-center gap-[6px]">
          <span className="text-ink-faint">less</span>
          <div className="flex gap-[2px]">
            {HEAT_COLORS.map((color, idx) => (
              <div
                key={`legend-${idx}`}
                className={`w-[11px] h-[11px] rounded-[1px] ${color} shadow-[inset_0_0_0_1px_rgba(33,30,24,0.09)]`}
              />
            ))}
          </div>
          <span className="text-ink-faint">more</span>
        </div>
      </div>
    </div>
  );
};
