"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Profile } from "@/types";
import { Cap, RedPen } from "@/components/paper/bits";
import { Stamp, GhostButton } from "@/components/paper/stamp";
import { JigsawPortrait } from "@/components/paper/jigsaw-portrait";

export interface HeroStats {
  totalProblems: number;
  hours: number;
  currentStreak: number;
  platformsCount: number;
}

interface PublicHeroProps {
  displayName: string;
  bio: string;
  profile: Profile | null;
  stats: HeroStats;
  /** number of distinct paradigms covered - drives the jigsaw portrait fill */
  coverage: number;
}

// Light-on-desk palette for the title wall (the dark desk is #211d17). These live inline
// because they're hero-only and shouldn't pollute the paper token set.
const NAME_COLOR = "#ece4d1";
const SUB_COLOR = "#b8af95";
const FAINT_COLOR = "#857c64";

/**
 * Full-bleed "Title Wall" - the name as architecture on the lit desk, with a mono stat-rule
 * beneath it. The case-file paper docks below this (see PublicPortfolio). On scroll the name
 * subtly compresses + recedes so the title wall hands off to the record (kinetic type, 2026).
 * Reduced-motion: completely static.
 */
export const PublicHero: React.FC<PublicHeroProps> = ({
  displayName,
  bio,
  profile,
  stats,
  coverage,
}) => {
  const [mounted, setMounted] = useState(false);
  const nameRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => setMounted(true), []);

  // Kinetic name: map scroll progress (first ~60vh) to a subtle compress + recede. rAF-throttled,
  // passive listener, transform-only (cheap to composite). Skipped under reduced-motion.
  useEffect(() => {
    const el = nameRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const span = Math.max(window.innerHeight * 0.6, 1);
        const p = Math.min(Math.max(window.scrollY / span, 0), 1); // 0 -> 1
        const scale = 1 - p * 0.12; // 1 -> 0.88
        const tracking = (-0.04 * p).toFixed(4); // 0 -> -0.04em (compress)
        el.style.transform = `scale(${scale.toFixed(4)})`;
        el.style.letterSpacing = `${tracking}em`;
        el.style.opacity = String(1 - p * 0.35);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const statCells: [string, React.ReactNode, boolean][] = [
    ["SOLVED", stats.totalProblems, false],
    ["HOURS", stats.hours, false],
    ["STREAK", mounted ? stats.currentStreak : "-", true],
    ["JUDGES", stats.platformsCount, false],
  ];

  return (
    <header
      className="relative w-full overflow-hidden"
      style={
        {
          "--hero-name": NAME_COLOR,
          "--hero-sub": SUB_COLOR,
          "--hero-faint": FAINT_COLOR,
        } as React.CSSProperties
      }
    >
      <div className="relative mx-auto w-full max-w-[1140px] px-4 pt-[clamp(2.5rem,9vh,6rem)] pb-7">
        <div className="grid gap-8 md:grid-cols-[1fr_150px] md:items-start">
          <div className="min-w-0">
            <Cap className="!text-[color:var(--hero-faint)]" >
              ◉ A SOLVELOG PORTFOLIO
            </Cap>

            {/* the name AS architecture - oversized, full-bleed, kinetic on scroll */}
            <h1
              ref={nameRef}
              className="font-display uppercase mt-3 leading-[0.82] origin-left will-change-transform"
              style={{
                color: NAME_COLOR,
                fontSize: "clamp(3.25rem, 12vw, 9.5rem)",
                textShadow: "0 1px 0 rgba(0,0,0,0.35), 0 0 40px rgba(231,181,58,0.05)",
              }}
            >
              {displayName}
            </h1>

            <p className="font-type text-[clamp(1rem,2.2vw,1.4rem)] mt-3" style={{ color: "#d6483f" }}>
              fitter. happier. more productive.
            </p>
            <p
              className="font-body text-[16px] md:text-[17px] leading-[1.6] mt-4 max-w-[46ch]"
              style={{ color: SUB_COLOR }}
            >
              {bio}
            </p>

            <div className="flex flex-wrap gap-2 items-center mt-5">
              {profile?.cf_handle && (
                <span className="font-mono text-[12px] border border-blueprint/70 text-blueprint px-2.5 py-1 rounded-[2px]">
                  CF · {profile.cf_handle}
                </span>
              )}
              {profile?.lc_handle && (
                <span className="font-mono text-[12px] border border-blueprint/70 text-blueprint px-2.5 py-1 rounded-[2px]">
                  LC · {profile.lc_handle}
                </span>
              )}
              {profile?.github_handle && (
                <span
                  className="font-mono text-[12px] border px-2.5 py-1 rounded-[2px]"
                  style={{ borderColor: "#4a4435", color: SUB_COLOR }}
                >
                  GH · {profile.github_handle}
                </span>
              )}
              <Link href="/admin">
                <GhostButton className="!bg-transparent hover:!bg-white/[0.06] !text-[color:var(--hero-name)] !border-[color:var(--hero-sub)]">
                  ▸ open solvelog
                </GhostButton>
              </Link>
            </div>
          </div>

          {/* paperclipped jigsaw self-portrait - the one bright paper object on the wall */}
          <div className="relative mt-1.5 hidden md:block">
            <RedPen rotate={-6} className="absolute -top-2 -left-7 text-[22px] z-20">
              2+2=5
            </RedPen>
            <svg
              width="20"
              height="46"
              viewBox="0 0 20 46"
              className="absolute -top-3 left-1/2 -translate-x-1/2 z-10"
              aria-hidden
            >
              <path d="M4 42 V12 a5 5 0 0 1 10 0 V36" fill="none" stroke="#a39d90" strokeWidth="2.2" />
              <path d="M8 36 V14 a3 3 0 0 1 6 0 V40" fill="none" stroke="#c7c1b3" strokeWidth="2.2" />
            </svg>
            <div className="bg-paper-sheet p-2 cpj-card-shadow rotate-[2.5deg]">
              <JigsawPortrait coverage={coverage} />
            </div>
            <div
              className="font-mono text-[10px] tracking-[0.16em] text-center mt-2 rotate-[2.5deg]"
              style={{ color: FAINT_COLOR }}
            >
              coverage
            </div>
            <div className="flex justify-center mt-3">
              <Stamp label="PUBLIC" sub="ACCESS" size="sm" rotate={-5} />
            </div>
          </div>
        </div>

        {/* mono stat-rule - full-width ledger line under the title wall */}
        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-5 mt-8 py-4 border-y"
          style={{ borderColor: "rgba(236,228,209,0.16)" }}
          data-reveal
          data-reveal-stagger
        >
          {statCells.map(([label, value, accent]) => (
            <div key={label}>
              <Cap className="!text-[color:var(--hero-faint)]">{label}</Cap>
              <div
                className="font-display text-[clamp(1.9rem,4vw,2.6rem)] leading-[0.9] mt-0.5"
                style={{ color: accent ? "#d6483f" : NAME_COLOR }}
                {...(typeof value === "number" && mounted ? { "data-count": String(value) } : {})}
              >
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
};

export default PublicHero;
