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

const SEEN_KEY = "cpj_tour_v2";

const STEPS: DriveStep[] = [
  {
    popover: {
      title: "Welcome to SolveLog",
      description:
        "Sixty seconds and you'll know your way around. The idea is simple: log every problem you solve, and SolveLog makes sure you actually remember it. Skip anytime - replay later from the ? button up top.",
    },
  },
  {
    element: 'a[href="/admin/problems/new"]',
    popover: {
      title: "1. File a problem",
      description:
        "Start here. Add a problem by hand, or just paste a Codeforces / LeetCode / AtCoder link and it auto-fills the title, rating and tags. Drop in your code, and a solve timer starts so you know how long it really took.",
      side: "bottom",
      align: "end",
    },
  },
  {
    element: 'a[href="/admin/problems"]',
    popover: {
      title: "2. Your drawer",
      description:
        "Every problem you file lands here - search it, filter by platform / difficulty / tag, and open any one to read your notes, your code, and the AI breakdown.",
      side: "right",
    },
  },
  {
    element: 'a[href="/admin/revision"]',
    popover: {
      title: "3. The part that makes it stick",
      description:
        "This is the whole point. SolveLog brings each problem back right before you'd forget it (spaced repetition). You grade yourself - again / hard / good / easy - and it schedules the next review. Do this and the patterns stay with you.",
      side: "right",
    },
  },
  {
    element: 'a[href="/admin/analytics"]',
    popover: {
      title: "4. See where you stand",
      description:
        "Your patterns, your difficulty mix, a solve heatmap, and time per problem - so you can see what you're strong at and what you keep avoiding.",
      side: "right",
    },
  },
  {
    element: 'a[href="/admin/settings"]',
    popover: {
      title: "5. Set yourself up (important)",
      description:
        "Everything setup lives in Settings: pick your public handle (1), one-click sync your whole Codeforces / LeetCode history (4), paste a free Gemini key so AI breaks down every solution (5), and verify your handles for a shareable badge (2 + 3).",
      side: "right",
    },
  },
  {
    popover: {
      title: "6. Capture in one click",
      description:
        "Don't want to type? Install the SolveLog Companion (the download is in Settings). Solve on a judge, click the bear, and the problem is filed for you - with the timer. It can also bulk-import everything you've already solved.",
    },
  },
  {
    element: '[data-tour="view-public"]',
    popover: {
      title: "7. Show it off",
      description:
        "This opens your public portfolio. Mark any problem public and it shows up here - a clean link with verified stats you can put on your resume or LinkedIn.",
      side: "right",
    },
  },
  {
    popover: {
      title: "That's the tour",
      description:
        "Go file your first problem and let SolveLog remember the rest. You can replay this anytime with the ? button. Everything in its right place.",
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
      // Hidden on mobile: the tour spotlights the desktop spine nav, which is collapsed on phones.
      className="hidden sm:flex items-center justify-center font-mono text-[10px] rounded-[2px] w-[30px] h-[30px] border bg-paper-sheet text-ink-soft border-paper-edge hover:text-blood cpj-card-shadow transition-colors"
    >
      <HelpCircle className="w-4 h-4" />
    </button>
  );
};

export default OnboardingTour;
