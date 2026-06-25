"use client";

import React, { useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import { HelpCircle } from "lucide-react";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

// First-run guided tour for the journal, built on Driver.js (MIT, tiny, React-19-safe). It spotlights
// the key surfaces in sequence and is fully dismissible. It auto-runs ONCE on the dashboard for a new
// user (gated by a localStorage flag) and can be replayed anytime from the "?" button this renders.
// Targets are stable selectors that live in the always-present admin shell (nav links + the add
// button), so the tour never depends on page-specific markup.

const SEEN_KEY = "cpj_tour_v1";

const STEPS: DriveStep[] = [
  {
    popover: {
      title: "Welcome to your journal",
      description:
        "A 30-second tour of how this works. Skip anytime, and replay it later from the help button up top.",
    },
  },
  {
    element: 'a[href="/admin/problems/new"]',
    popover: {
      title: "File a problem",
      description:
        "Add one by hand, or just paste a Codeforces / LeetCode / AtCoder link and it auto-fills the title, rating and tags.",
      side: "bottom",
      align: "end",
    },
  },
  {
    element: 'a[href="/admin/problems"]',
    popover: {
      title: "Your drawer",
      description: "Everything you file lands here - searchable, filterable, all in one place.",
      side: "right",
    },
  },
  {
    element: 'a[href="/admin/revision"]',
    popover: {
      title: "Don't just solve - remember",
      description:
        "Spaced-repetition revision resurfaces problems on a schedule so they actually stick.",
      side: "right",
    },
  },
  {
    element: 'a[href="/admin/settings"]',
    popover: {
      title: "Set yourself up",
      description:
        "In Settings: add your own free Gemini key for AI analysis, verify your judge handles, grab the browser companion, and build your share card.",
      side: "right",
    },
  },
  {
    element: '[data-tour="view-public"]',
    popover: {
      title: "Your public portfolio",
      description:
        "This opens the page the world sees. Mark any problem public and it shows up here.",
      side: "right",
    },
  },
  {
    popover: {
      title: "That's the tour",
      description:
        "Replay it anytime with the help button. Now go file your first problem - the best you can is good enough.",
    },
  },
];

function makeDriver() {
  return driver({
    showProgress: true,
    popoverClass: "cpj-tour",
    nextBtnText: "next ▸",
    prevBtnText: "◂ back",
    doneBtnText: "done",
    progressText: "{{current}} / {{total}}",
    steps: STEPS,
    onDestroyed: () => {
      try {
        localStorage.setItem(SEEN_KEY, "1");
      } catch {
        /* ignore */
      }
    },
  });
}

export const OnboardingTour: React.FC = () => {
  const pathname = usePathname();

  const startTour = useCallback(() => {
    // Driver.js needs the target elements in the DOM; the shell is already mounted by now.
    makeDriver().drive();
  }, []);

  // Auto-run once, only on the dashboard, only on a wide screen (the tour points at the desktop
  // spine nav, which is hidden on mobile).
  useEffect(() => {
    if (pathname !== "/admin") return;
    let seen = false;
    try {
      seen = !!localStorage.getItem(SEEN_KEY);
    } catch {
      seen = true; // if storage is unavailable, don't nag
    }
    if (seen) return;
    if (typeof window !== "undefined" && window.innerWidth < 768) return;
    const t = window.setTimeout(startTour, 700);
    return () => window.clearTimeout(t);
  }, [pathname, startTour]);

  return (
    <button
      type="button"
      onClick={startTour}
      title="Replay the guided tour"
      aria-label="Replay the guided tour"
      className="flex items-center justify-center font-mono text-[10px] rounded-[2px] w-[30px] h-[30px] border bg-paper-sheet text-ink-soft border-paper-edge hover:text-blood cpj-card-shadow transition-colors"
    >
      <HelpCircle className="w-4 h-4" />
    </button>
  );
};

export default OnboardingTour;
