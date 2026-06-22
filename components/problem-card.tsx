"use client";

import React from "react";
import { ArrowUpRight, Pencil } from "lucide-react";
import { ProblemWithRelations } from "@/types";
import { TopicChip } from "@/components/paper/bits";
import { seededRotation, DIFFICULTY_COLOR } from "@/lib/paper";
import { cn } from "@/lib/utils";

interface ProblemCardProps {
  problem: ProblemWithRelations;
  variant: "admin" | "public";
  onClick?: () => void;
}

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

const formatTime = (seconds: number): string => {
  if (!seconds || seconds <= 0) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "";
    // Compare CALENDAR days in local time, not elapsed time. (The old Math.ceil of
    // elapsed ms made a problem added today - a few hours ago - round up to 1 =
    // "yesterday".) Bucket both to local midnight, then diff whole days.
    const startOfDay = (x: Date) => {
      const d = new Date(x);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    };
    const diffDays = Math.round(
      (startOfDay(new Date()) - startOfDay(date)) / (1000 * 60 * 60 * 24)
    );
    if (diffDays <= 0) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays <= 7) return `${diffDays} days ago`;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
};

/**
 * IndexCard - a filed problem (00_FOUNDATIONS §3). Difficulty-coloured edge tab,
 * deterministic ±0.6° rotation, hover-lift. (Component kept as ProblemCard for
 * call-site compatibility.)
 */
export const ProblemCard: React.FC<ProblemCardProps> = ({
  problem,
  variant,
  onClick,
}) => {
  const edge = DIFFICULTY_COLOR[problem.difficulty_norm] || DIFFICULTY_COLOR.unknown;
  const rot = seededRotation(problem.id);
  const plat = PLATFORM_SHORT[problem.platform] || problem.platform?.toUpperCase();
  const rating = problem.difficulty_raw || problem.difficulty_norm;
  const totalTimeSpent = problem.total_seconds || 0;
  const tags = [
    ...(problem.source_tags ?? []),
    ...(problem.custom_tags ?? []),
  ].slice(0, 3);

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      data-tilt
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      style={{ "--seed-rot": `${rot}deg`, borderLeftColor: edge } as React.CSSProperties}
      className={cn(
        "cpj-tilt cpj-lift-sh group relative bg-paper-sheet cpj-card-shadow rounded-[3px] border-l-[3px] p-[13px] px-[14px] cursor-pointer select-none"
      )}
    >
      {/* top row: platform·rating chip + time/date */}
      <div className="flex items-center justify-between gap-2">
        <span
          className="font-mono text-[10px] px-[7px] py-[2px] rounded-[2px]"
          style={{ background: edge, color: "#1c1812" }}
        >
          {plat} · {rating}
        </span>
        <span className="font-mono text-[10px] tracking-[0.12em] text-ink-faint whitespace-nowrap">
          {formatTime(totalTimeSpent)} · {formatDate(problem.solved_at || problem.created_at)}
        </span>
      </div>

      {/* title */}
      <h3 className="font-body text-[16px] text-ink my-[7px] truncate group-hover:text-blood transition-colors">
        {problem.title}
      </h3>

      {/* tags + variant glyph */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-[5px] overflow-hidden max-h-[24px]">
          {tags.map((tag) => (
            <TopicChip key={tag} tag={tag} />
          ))}
          {problem.ai_tags?.slice(0, 1).map((tag) => (
            <span
              key={tag}
              className="font-mono text-[10px] px-[7px] py-[2px] rounded-[2px] border border-blueprint/50 text-blueprint"
            >
              {tag}
            </span>
          ))}
        </div>
        {variant === "admin" ? (
          <Pencil className="w-[13px] h-[13px] text-ink-faint group-hover:text-blood transition-colors shrink-0" />
        ) : (
          <ArrowUpRight className="w-[14px] h-[14px] text-ink-faint group-hover:text-blood group-hover:translate-x-[1px] transition-all shrink-0" />
        )}
      </div>
    </div>
  );
};
