import React from "react";
import { ModifiedBear } from "@/components/modified-bear";

/**
 * JigsawPortrait - the public "self-portrait" rendered as a coverage jigsaw
 * (spec §3 JigsawCoverage). Placed pieces = solved ground; a few missing
 * pieces (dashed holes) = the gaps. The Modified Bear is the face. Static,
 * deterministic, lightweight SVG - no per-frame work.
 *
 * `coverage` (0..N) gently controls how filled the portrait looks: more
 * coverage -> fewer missing pieces (clamped so it always reads as a jigsaw).
 */
const COLS = 4;
const ROWS = 5;
const S = 30; // cell size in the viewBox

// HttT-ish muted piece tints (paper-warm, never loud)
const TINTS = ["#cdbf9b", "#bdc6a8", "#d6c19c", "#c8b59c", "#b8c2ac", "#d2c4a2"];

// face region (where the bear sits) - kept filled so the face is whole
const FACE = new Set(["1,1", "2,1", "1,2", "2,2"]);

// candidate gap cells, removed first->last as coverage drops
const GAP_ORDER = ["3,4", "0,4", "3,0", "0,2", "2,4", "0,0"];

export function JigsawPortrait({ coverage = 0 }: { coverage?: number }) {
  // 1-4 missing pieces; more coverage = fewer gaps
  const gapCount = Math.max(1, Math.min(4, 4 - Math.floor(coverage / 2)));
  const missing = new Set(GAP_ORDER.slice(0, gapCount));

  const cells: React.ReactNode[] = [];
  const knobs: React.ReactNode[] = [];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const key = `${c},${r}`;
      const x = c * S;
      const y = r * S;
      // diagonal stagger so pieces fall into place in a sweep
      const delay = (r + c) * 55;
      if (missing.has(key)) {
        cells.push(
          <rect
            key={key}
            x={x + 2.5}
            y={y + 2.5}
            width={S - 5}
            height={S - 5}
            rx={2}
            fill="#ece5d2"
            stroke="#b1a98f"
            strokeWidth={1}
            strokeDasharray="3 2.5"
          />
        );
        continue;
      }
      const isFace = FACE.has(key);
      const fill = isFace ? "#6f5b51" : TINTS[(r * COLS + c) % TINTS.length];
      cells.push(
        <rect
          key={key}
          className="cpj-piece"
          style={{ animationDelay: `${delay}ms` }}
          x={x}
          y={y}
          width={S}
          height={S}
          fill={fill}
          stroke="#f4efe2"
          strokeWidth={1.6}
        />
      );
      // interlock knobs on the right & bottom shared edges (skip if neighbour missing)
      const rightKey = `${c + 1},${r}`;
      const downKey = `${c},${r + 1}`;
      if (c < COLS - 1 && !missing.has(rightKey)) {
        const out = (r + c) % 2 === 0;
        knobs.push(
          <circle
            key={`kr-${key}`}
            className="cpj-piece"
            style={{ animationDelay: `${delay}ms` }}
            cx={x + S}
            cy={y + S / 2}
            r={4}
            fill={out ? fill : TINTS[(r * COLS + c + 1) % TINTS.length]}
            stroke="#f4efe2"
            strokeWidth={1.4}
          />
        );
      }
      if (r < ROWS - 1 && !missing.has(downKey)) {
        const out = (r + c) % 2 === 1;
        knobs.push(
          <circle
            key={`kd-${key}`}
            className="cpj-piece"
            style={{ animationDelay: `${delay}ms` }}
            cx={x + S / 2}
            cy={y + S}
            r={4}
            fill={out ? fill : TINTS[((r + 1) * COLS + c) % TINTS.length]}
            stroke="#f4efe2"
            strokeWidth={1.4}
          />
        );
      }
    }
  }

  return (
    <div className="relative">
      <svg
        width="132"
        height="160"
        viewBox={`0 0 ${COLS * S} ${ROWS * S}`}
        aria-label="coverage self-portrait - a jigsaw with missing pieces"
        role="img"
      >
        <rect width={COLS * S} height={ROWS * S} fill="#e7e0cd" />
        {cells}
        {knobs}
      </svg>
      {/* the bear is the face - sits over the central filled pieces */}
      <ModifiedBear
        className="absolute left-1/2 top-[30px] -translate-x-1/2 w-[58px] h-[58px] text-[#f1ead2]"
        aria-hidden
      />
    </div>
  );
}
