"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { useSfx } from "@/components/paper/sound-provider";

/**
 * Stamp - a rubber-stamp block (00_FOUNDATIONS §3). Status marks (PUBLIC,
 * ACCEPTED, INVITED, REJECTED, ON FILE, ON RECORD) and decorative seals.
 */
export function Stamp({
  label,
  sub,
  tone = "blood",
  size = "md",
  className,
  rotate = 8,
}: {
  label: string;
  sub?: string;
  tone?: "blood" | "green" | "faded" | "blueprint";
  /** scales border / padding / label together so small status marks don't look oversized */
  size?: "sm" | "md" | "lg";
  className?: string;
  rotate?: number;
}) {
  const tones: Record<string, string> = {
    blood: "border-blood text-blood",
    green: "border-t-green text-t-green",
    faded: "border-ink-faint text-ink-faint opacity-70",
    blueprint: "border-blueprint text-blueprint",
  };
  const sizes: Record<string, { box: string; sub: string; label: string }> = {
    sm: { box: "border px-2 py-0.5", sub: "text-[6px] tracking-[0.16em]", label: "text-[11px]" },
    md: { box: "border-2 px-3 py-1", sub: "text-[8px] tracking-[0.16em]", label: "text-[15px]" },
    lg: { box: "border-[2.5px] px-4 py-1.5", sub: "text-[9px] tracking-[0.18em]", label: "text-[20px]" },
  };
  const s = sizes[size];
  return (
    <span
      className={cn(
        "inline-block text-center opacity-90 select-none rounded-[2px]",
        s.box,
        tones[tone],
        className
      )}
      style={{ transform: `rotate(${rotate}deg)` }}
      aria-hidden
    >
      {sub && <span className={cn("block font-mono", s.sub)}>{sub}</span>}
      <span className={cn("block font-type leading-none", s.label)}>{label}</span>
    </span>
  );
}

/**
 * StampButton - the primary CTA (00_FOUNDATIONS §4). Special Elite face,
 * blood with a printed bottom edge; presses down + plays a stamp thunk.
 */
export function StampButton({
  children,
  className,
  onClick,
  type = "button",
  disabled,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { sfx } = useSfx();
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={(e) => {
        sfx("stamp");
        onClick?.(e);
      }}
      className={cn(
        "cpj-press inline-flex items-center justify-center gap-1.5 rounded-[2px] bg-blood px-4 py-2.5 font-type text-[14px] text-[#FBE9E7] disabled:opacity-50 disabled:pointer-events-none",
        className
      )}
      style={{ boxShadow: "0 2px 0 var(--color-blood-deep)" }}
      {...rest}
    >
      {children}
    </button>
  );
}

/** GhostButton - secondary ink/ghost action (§4). */
export function GhostButton({
  children,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[2px] border border-ink/40 bg-paper-sheet/60 px-3.5 py-2 font-type text-[13px] tracking-[0.02em] text-ink transition-colors hover:bg-ink/[0.07] disabled:opacity-50 disabled:pointer-events-none",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
