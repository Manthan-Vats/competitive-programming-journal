"use client";

import { useEffect, useRef, useState } from "react";

/**
 * useWidth - measures an element's content width via ResizeObserver. Lets charts
 * render at an explicit pixel size instead of recharts' <ResponsiveContainer>,
 * which logs a harmless-but-noisy `width(-1)/height(-1)` warning on first paint.
 * Returns [ref, width]; width is 0 until measured (gate the chart on width > 0).
 */
export function useWidth<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setWidth(Math.round(w));
    });
    ro.observe(el);
    setWidth(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);

  return [ref, width] as const;
}
