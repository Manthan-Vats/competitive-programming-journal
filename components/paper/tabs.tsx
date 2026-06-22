"use client";

import React from "react";
import { cn } from "@/lib/utils";

/** PaperTabs - raised paper file tabs over an ink baseline (00_FOUNDATIONS §3/R4). */
export function PaperTabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn("flex gap-1 border-b-2 border-ink", className)}
    >
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            className={cn(
              "font-type text-[13px] px-3.5 pt-1.5 pb-2 rounded-t-[4px] transition-colors",
              on
                ? "bg-paper text-ink shadow-[inset_0_-2px_0_var(--color-paper)]"
                : "bg-[#E4DCC6] text-ink-soft hover:text-ink"
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
