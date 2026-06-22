import React from "react";
import { cn } from "@/lib/utils";
import { chipColors } from "@/lib/paper";

/** Cap - a mono uppercase caption/label (00_FOUNDATIONS §2.2). */
export function Cap({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "font-mono text-[11px] tracking-[0.14em] text-ink-soft uppercase",
        className
      )}
    >
      {children}
    </div>
  );
}

/** TopicChip - a filed topic tag (§3). Colour is stable per tag. */
export function TopicChip({
  tag,
  color,
  className,
}: {
  tag: string;
  color?: { bg: string; text: string };
  className?: string;
}) {
  const c = color ?? chipColors(tag);
  return (
    <span
      className={cn(
        "font-mono text-[10px] px-[7px] py-[2px] rounded-[2px] whitespace-nowrap",
        className
      )}
      style={{ background: c.bg, color: c.text }}
    >
      {tag}
    </span>
  );
}

/** LedgerRow - label + dotted leader + value, hand-logged (§3). */
export function LedgerRow({
  label,
  value,
  accent,
  className,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline gap-2", className)}>
      <span className="font-mono text-[11px] tracking-[0.12em] text-ink-soft uppercase whitespace-nowrap">
        {label}
      </span>
      <span className="flex-1 self-end mb-[5px] border-b border-dotted border-ink/30" />
      <span
        className={cn(
          "font-display leading-[0.9]",
          accent ? "text-blood" : "text-ink"
        )}
      >
        {value}
      </span>
    </div>
  );
}

/** RedPen - Permanent Marker marginalia (§3). */
export function RedPen({
  children,
  rotate = -4,
  className,
}: {
  children: React.ReactNode;
  rotate?: number;
  className?: string;
}) {
  return (
    <span
      className={cn("font-mark text-blood inline-block", className)}
      style={{ transform: `rotate(${rotate}deg)`, opacity: 0.92 }}
    >
      {children}
    </span>
  );
}
