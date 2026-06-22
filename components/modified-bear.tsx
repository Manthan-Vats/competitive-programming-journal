"use client";

import React from "react";

/**
 * The Modified Bear - Radiohead's totem since Kid A / Amnesiac (Stanley Donwood).
 * A blank, sharp-toothed white bear. Used here as the CP Journal mark.
 * Pure SVG so it scales crisply and can be tinted via `currentColor`.
 */
export const ModifiedBear: React.FC<
  React.SVGProps<SVGSVGElement> & { title?: string }
> = ({ title = "modified bear", className, ...props }) => {
  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label={title}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={4}
      strokeLinejoin="round"
      strokeLinecap="round"
      {...props}
    >
      <title>{title}</title>
      {/* ears */}
      <circle cx="26" cy="26" r="13" />
      <circle cx="74" cy="26" r="13" />
      {/* head */}
      <path d="M18 50 C18 28, 38 18, 50 18 C62 18, 82 28, 82 50 C82 74, 66 88, 50 88 C34 88, 18 74, 18 50 Z" />
      {/* blank eyes (two dots, the dead stare) */}
      <circle cx="38" cy="48" r="3.4" fill="currentColor" stroke="none" />
      <circle cx="62" cy="48" r="3.4" fill="currentColor" stroke="none" />
      {/* snarl line */}
      <path d="M34 66 L66 66" />
      {/* sharp teeth */}
      <path d="M38 66 L41 72 L44 66 L47 72 L50 66 L53 72 L56 66 L59 72 L62 66" />
    </svg>
  );
};

export default ModifiedBear;
