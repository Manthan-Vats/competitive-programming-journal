import React from "react";
import { cn } from "@/lib/utils";

/**
 * Grain - the required fibre-grain overlay for any paper surface
 * (00_FOUNDATIONS §2.4). A unique filter id per mount.
 */
export function Grain({
  className,
  opacity,
}: {
  className?: string;
  opacity?: number;
}) {
  const id = React.useId().replace(/:/g, "");
  return (
    <svg
      className={cn("cpj-grain", className)}
      aria-hidden="true"
      style={opacity != null ? ({ "--grain-opacity": opacity } as React.CSSProperties) : undefined}
    >
      <filter id={id}>
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.9"
          numOctaves={2}
          stitchTiles="stitch"
          result="noise"
        />
        {/* desaturate to monochrome fibre: black specks with noisy alpha */}
        <feColorMatrix
          in="noise"
          type="matrix"
          values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0"
        />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${id})`} />
    </svg>
  );
}

/**
 * Desk - the lit dark panel a page rests on (00_FOUNDATIONS §2.3).
 * Use as a full-height wrapper; content sheets sit on it and cast shadow.
 */
export function Desk({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("cpj-desk min-h-screen w-full", className)}>{children}</div>
  );
}

type SheetVariant = "page" | "card" | "insert";

/**
 * PaperSheet - the §2.4 "lightly handled" paper recipe.
 *  - page   : full sheet (deep shadow)
 *  - card   : raised card (mid shadow)
 *  - insert : graph-paper insert (for code)
 */
export function PaperSheet({
  children,
  variant = "page",
  className,
  grain = true,
  stack = true,
  style,
  ...rest
}: {
  children: React.ReactNode;
  variant?: SheetVariant;
  className?: string;
  grain?: boolean;
  /** page sheets show a stacked case-file edge by default; opt out for secondary
   *  sheets stacked vertically so the decorative back-sheets don't pile up (R2/D1). */
  stack?: boolean;
  style?: React.CSSProperties;
} & React.HTMLAttributes<HTMLDivElement>) {
  const base =
    variant === "insert"
      ? "cpj-graph cpj-card-shadow"
      : variant === "card"
      ? "bg-paper-sheet cpj-tone cpj-card-shadow"
      : cn("bg-paper cpj-tone cpj-sheet-shadow", stack && "cpj-stack");
  // page sheets carry more visible fibre than small cards/inserts
  const grainOpacity = variant === "page" ? 0.26 : variant === "card" ? 0.16 : 0.12;
  return (
    <div
      className={cn("relative rounded-[3px] text-ink", base, className)}
      style={style}
      {...rest}
    >
      {grain && <Grain opacity={grainOpacity} />}
      <div className="relative">{children}</div>
    </div>
  );
}
