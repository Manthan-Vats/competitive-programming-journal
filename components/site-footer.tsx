"use client";

import React, { useState } from "react";

/**
 * SiteFooter - themed paper footer with two hidden eggs:
 *  - click "2+2=5" five times -> it briefly insists "two and two always makes a five".
 *  - click the EXIT sign -> an "exit music (for a film)" whisper.
 */
export const SiteFooter: React.FC = () => {
  const [clicks, setClicks] = useState(0);
  const [lie, setLie] = useState(false);
  const [exit, setExit] = useState(false);

  const onMath = () => {
    const n = clicks + 1;
    setClicks(n);
    if (n >= 5) {
      setLie(true);
      setClicks(0);
      window.setTimeout(() => setLie(false), 3200);
    }
  };

  return (
    <footer className="w-full max-w-5xl mx-auto py-8 text-center border-t border-paper-edge mt-10 relative space-y-2">
      <p className="font-body italic text-[13px] text-ink-soft">
        {lie ? "two and two always makes a five." : "everything in its right place."}
      </p>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
        SolveLog · {new Date().getFullYear()} ·{" "}
        <a href="/privacy" className="hover:text-blood transition-colors">privacy</a>
        {" · "}
        <a href="/terms" className="hover:text-blood transition-colors">terms</a>
        {" · "}
        <button
          type="button"
          onClick={onMath}
          className="text-blood hover:opacity-80 transition-opacity cursor-pointer align-baseline"
          aria-label="2 plus 2 equals 5"
        >
          2+2=5
        </button>
        {" · "}
        <button
          type="button"
          onClick={() => {
            setExit(true);
            window.setTimeout(() => setExit(false), 2600);
          }}
          className="text-ink-soft hover:text-blood transition-colors cursor-pointer"
          aria-label="exit"
        >
          EXIT
        </button>
      </p>
      {exit && (
        <p className="font-type text-[11px] text-blood cpj-develop select-none">
          exit music (for a film)
        </p>
      )}
    </footer>
  );
};

export default SiteFooter;
