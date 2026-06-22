"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ModifiedBear } from "@/components/modified-bear";
import { useSfx } from "@/components/paper/sound-provider";

/**
 * EasterEggs - the hidden Radiohead layer (global, self-dismissing, never blocks).
 *
 *  1. KONAMI (↑↑↓↓←→←→ B A) → full-screen "Kid A" takeover: the bear rises with
 *     a random lyric, then fades.
 *  2. Type "creep" → whisper "i don't belong here."
 *  3. Type "karma" → whisper "this is what you get."
 *  4. Type "jigsaw" → the screen shatters into fragments and falls back into place.
 *  5. Idle 30s → "How to Disappear Completely": a desaturating veil with
 *     "I'm not here. This isn't happening.", restored on the next move.
 *  6. Tab hidden → document.title becomes "i'm not here. this isn't happening."
 *  7. Console love-letter (2 + 2 = 5) on every load.
 */

const LYRICS = [
  "everything in its right place",
  "i'm not here. this isn't happening.",
  "we ride tonight, ghost horses",
  "for a minute there, i lost myself",
  "i'm a reasonable man, get off my case",
  "cut the kids in half",
  "just 'cause you feel it doesn't mean it's there",
  "this is what you get when you mess with us",
  "rain down on me, from a great height",
  "i'm a creep, i'm a weirdo",
];

const IDLE_MS = 30_000;
const COLS = 6;
const ROWS = 4;

export const EasterEggs: React.FC = () => {
  const { sfx } = useSfx();
  const [takeover, setTakeover] = useState(false);
  const [lyric, setLyric] = useState(LYRICS[0]);
  const [whisper, setWhisper] = useState<string | null>(null);
  const [shatter, setShatter] = useState(false);
  const [idle, setIdle] = useState(false);

  const tiles = useMemo(
    () =>
      Array.from({ length: COLS * ROWS }, () => ({
        rot: (Math.random() - 0.5) * 60,
        dx: (Math.random() - 0.5) * 120,
        dy: (Math.random() - 0.5) * 120,
        delay: Math.random() * 0.12,
      })),
    [shatter]
  );

  // one-time console love letter
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log(
      "%c2 + 2 = 5",
      "color:#B81D24;font-family:monospace;font-size:42px;font-weight:bold;"
    );
    // eslint-disable-next-line no-console
    console.log(
      "%ceverything in its right place. (konami ↑↑↓↓←→←→ B A · or type 'jigsaw' / 'everything')",
      "color:#36545F;font-family:monospace;font-size:13px;"
    );
  }, []);

  const fireTakeover = useCallback(() => {
    setLyric(LYRICS[Math.floor(Math.random() * LYRICS.length)]);
    setTakeover(true);
    sfx("konami");
    window.setTimeout(() => setTakeover(false), 4200);
  }, [sfx]);

  const fireShatter = useCallback(() => {
    setShatter(true);
    sfx("glitch");
    window.setTimeout(() => setShatter(false), 1700);
  }, [sfx]);

  // keyboard: konami + typed words
  useEffect(() => {
    const KONAMI = [
      "ArrowUp",
      "ArrowUp",
      "ArrowDown",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "ArrowLeft",
      "ArrowRight",
      "b",
      "a",
    ];
    let kIdx = 0;
    let typed = "";

    const onKey = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === KONAMI[kIdx]) {
        kIdx++;
        if (kIdx === KONAMI.length) {
          kIdx = 0;
          fireTakeover();
        }
      } else {
        kIdx = key === KONAMI[0] ? 1 : 0;
      }

      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key.length === 1) {
        typed = (typed + e.key.toLowerCase()).slice(-12);
        if (typed.endsWith("creep")) {
          setWhisper("i don't belong here.");
          window.setTimeout(() => setWhisper(null), 3500);
        } else if (typed.endsWith("karma")) {
          setWhisper("this is what you get.");
          window.setTimeout(() => setWhisper(null), 3500);
        } else if (typed.endsWith("jigsaw")) {
          fireShatter();
        } else if (typed.endsWith("everything")) {
          setWhisper("everything in its right place.");
          sfx("type");
          window.setTimeout(() => setWhisper(null), 3500);
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fireTakeover, fireShatter, sfx]);

  // idle → "How to Disappear Completely"
  useEffect(() => {
    let timer = window.setTimeout(() => setIdle(true), IDLE_MS);
    const wake = () => {
      if (idle) setIdle(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setIdle(true), IDLE_MS);
    };
    window.addEventListener("mousemove", wake);
    window.addEventListener("keydown", wake);
    window.addEventListener("scroll", wake, { passive: true });
    window.addEventListener("touchstart", wake, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("mousemove", wake);
      window.removeEventListener("keydown", wake);
      window.removeEventListener("scroll", wake);
      window.removeEventListener("touchstart", wake);
    };
  }, [idle]);

  // tab hidden → retitle
  useEffect(() => {
    const original = document.title;
    const onVis = () => {
      document.title = document.hidden
        ? "i'm not here. this isn't happening."
        : original;
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      document.title = original;
    };
  }, []);

  return (
    <>
      {/* whisper toast */}
      {whisper && (
        <div
          className="fixed bottom-6 left-6 z-[200] font-type text-[13px] text-blood cpj-develop select-none pointer-events-none"
          aria-hidden
        >
          {whisper}
        </div>
      )}

      {/* jigsaw shatter */}
      <AnimatePresence>
        {shatter && (
          <div
            aria-hidden
            className="pointer-events-none fixed inset-0 z-[250] grid"
            style={{
              gridTemplateColumns: `repeat(${COLS}, 1fr)`,
              gridTemplateRows: `repeat(${ROWS}, 1fr)`,
            }}
          >
            {tiles.map((t, i) => (
              <motion.div
                key={i}
                className="bg-desk border border-blood/20"
                initial={{ opacity: 0, scale: 1 }}
                animate={{
                  opacity: [0, 0.95, 0.95, 0],
                  scale: [1, 0.4, 0.4, 1],
                  rotate: [0, t.rot, t.rot, 0],
                  x: [0, t.dx, t.dx, 0],
                  y: [0, t.dy, t.dy, 0],
                }}
                transition={{
                  duration: 1.6,
                  times: [0, 0.3, 0.6, 1],
                  delay: t.delay,
                  ease: [0.16, 1, 0.3, 1],
                }}
              />
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* idle: how to disappear completely */}
      <AnimatePresence>
        {idle && (
          <motion.div
            aria-hidden
            className="pointer-events-none fixed inset-0 z-[240] flex items-center justify-center backdrop-sepia-[.3] backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4 }}
          >
            <p className="font-type text-[15px] md:text-[19px] text-ink-soft/80 select-none">
              I&apos;m not here. This isn&apos;t happening.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* konami takeover */}
      {takeover && (
        <div
          className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-desk/95 backdrop-blur-sm select-none"
          aria-hidden
          onClick={() => setTakeover(false)}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg,#B81D24 0px,#B81D24 1px,transparent 1px,transparent 4px)",
            }}
          />
          <ModifiedBear className="w-40 h-40 text-paper cpj-develop" />
          <p className="mt-8 font-type text-[18px] md:text-[22px] text-paper cpj-develop text-center px-6">
            {lyric}
          </p>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.3em] text-ink-faint">
            click to dismiss
          </p>
        </div>
      )}
    </>
  );
};

export default EasterEggs;
