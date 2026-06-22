"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";

/**
 * TransitionShell - "Jigsaw Falling Into Place".
 *
 *  Driven by app/template.tsx, which re-mounts on every navigation, so this
 *  enter animation replays each route change:
 *   - public routes: a screen of fragments scatters away while the new page
 *     blurs up into place.
 *   - /admin: a single calm scanline wipe (motion-calmed).
 *   - reduced-motion: no overlay, content appears immediately.
 */

const COLS = 6;
const ROWS = 4;

export const TransitionShell: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const isAdmin = pathname?.startsWith("/admin");

  // The server has no media query, so it always renders the animated overlay.
  // Only honour reduced-motion after mount so the first client paint matches the
  // server markup (otherwise the dropped overlay causes a hydration mismatch).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // stable scatter offsets per tile
  const tiles = useMemo(
    () =>
      Array.from({ length: COLS * ROWS }, (_, i) => ({
        i,
        rot: (Math.random() - 0.5) * 40,
        dx: (Math.random() - 0.5) * 60,
        dy: (Math.random() - 0.5) * 60,
        delay: Math.random() * 0.18,
      })),
    [pathname]
  );

  if (mounted && reduce) return <>{children}</>;

  if (isAdmin) {
    // calm scanline wipe + soft fade
    return (
      <>
        <motion.div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[90]"
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg,rgba(225,6,0,0.06) 0px,rgba(225,6,0,0.06) 1px,transparent 1px,transparent 3px)",
          }}
        />
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          {children}
        </motion.div>
      </>
    );
  }

  return (
    <>
      {/* fragment curtain that scatters away to reveal the page */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[90] grid"
        style={{
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gridTemplateRows: `repeat(${ROWS}, 1fr)`,
        }}
      >
        {tiles.map((t) => (
          <motion.div
            key={t.i}
            className="bg-desk border border-blood/10"
            initial={{ opacity: 1, scale: 1, rotate: 0, x: 0, y: 0 }}
            animate={{
              opacity: 0,
              scale: 0.35,
              rotate: t.rot,
              x: t.dx,
              y: t.dy,
            }}
            transition={{
              duration: 0.7,
              delay: t.delay,
              ease: [0.16, 1, 0.3, 1],
            }}
          />
        ))}
      </div>

      {/* the page blurs up into place */}
      <motion.div
        initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.6, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </>
  );
};

export default TransitionShell;
