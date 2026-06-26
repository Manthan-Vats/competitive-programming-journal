import React from "react";
import Link from "next/link";
import { PaperSheet } from "@/components/paper/paper-sheet";
import { Cap } from "@/components/paper/bits";
import { Stamp } from "@/components/paper/stamp";
import { RequestAccess } from "@/components/request-access";
import { SiteFooter } from "@/components/site-footer";
import { ModifiedBear } from "@/components/modified-bear";

// Public marketing landing shown to logged-out visitors at "/". Built entirely from the paper kit
// so it matches the rest of the app. Server component; the only interactive bits are the nested
// RequestAccess + SiteFooter (client). Motion is the global data-reveal system (MotionProvider).

const STEPS = [
  {
    n: "01",
    title: "Capture it",
    body: "Solve a problem, hit one button, it's filed - title, tags, your code, the time it took. Or paste a judge link. Or bulk-import your whole history in one go.",
  },
  {
    n: "02",
    title: "Understand it",
    body: "Your own free AI key breaks down what the solution actually does - the pattern, the trick, the data structure. So you learn the idea, not just the answer.",
  },
  {
    n: "03",
    title: "Remember it",
    body: "Spaced repetition brings each problem back right before you'd forget it. This is the part that makes it stick, instead of just pile up.",
  },
  {
    n: "04",
    title: "Show it off",
    body: "Every solve turns into a clean public portfolio with a verified badge. Put the link on your resume and let recruiters see the work.",
  },
];

const WHY = [
  {
    head: "It actually makes you remember.",
    body: "Spaced repetition resurfaces each problem right before you'd forget it - the part every other tracker skips.",
  },
  {
    head: "The AI costs you nothing.",
    body: "Bring your own free Gemini key. It runs on your quota, so there's nothing to pay us and nothing throttled.",
  },
  {
    head: "It's proof, not just a checkbox.",
    body: "Your solves become a public portfolio with verified stats you can hand straight to a recruiter.",
  },
];

export function Landing() {
  return (
    <div className="cpj-desk min-h-screen w-full overflow-x-hidden relative">
      {/* warm pool of light down the title wall (matches the public portfolio hero) */}
      <div
        aria-hidden
        className="pointer-events-none inset-x-0 top-0 h-[95vh]"
        style={{
          position: "absolute",
          zIndex: 0,
          background:
            "radial-gradient(80% 55% at 50% 0%, rgba(231,181,58,0.10), rgba(231,181,58,0.03) 46%, transparent 78%)",
        }}
      />

      {/* HERO */}
      <header className="relative z-[1] w-full max-w-5xl mx-auto px-5 pt-16 pb-10 text-center">
        <div className="flex items-center justify-center gap-2 mb-5">
          <ModifiedBear className="w-5 h-5 text-blood" />
          <Cap>invite-only · for people who actually grind</Cap>
        </div>
        <h1
          className="font-display uppercase leading-[0.84]"
          style={{ fontSize: "clamp(2.6rem, 11vw, 7.5rem)" }}
        >
          SolveLog
        </h1>
        <p className="font-display text-[clamp(1.5rem,4.6vw,2.7rem)] leading-[1.02] mt-4">
          Remember every problem you solve.
        </p>
        <p className="font-body text-[clamp(1rem,2.4vw,1.18rem)] text-ink-soft max-w-[560px] mx-auto mt-4 leading-[1.5]">
          You grind 300 problems for placements, then blank on half of them in the interview.
          SolveLog makes them stick.
        </p>
        <div className="flex flex-col items-center gap-3 mt-7">
          <RequestAccess />
          <Link
            href="/login"
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint hover:text-blood transition-colors"
          >
            already in? log in
          </Link>
        </div>
      </header>

      {/* THE CASE FILE */}
      <main className="relative z-[1] w-full max-w-3xl mx-auto px-4 pb-10 space-y-6">
        <PaperSheet variant="page" className="cpj-develop p-[24px] md:p-[34px]">
          {/* 01 - the problem */}
          <section data-reveal>
            <Cap>01 · the problem</Cap>
            <p className="font-display text-[clamp(1.6rem,4vw,2.3rem)] leading-[1.05] mt-2">
              You&apos;ve solved 300 problems. Could you re-solve 30 of them right now?
            </p>
            <p className="font-body text-[16px] leading-[1.62] text-ink mt-3">
              Most of us grind LeetCode and Codeforces, feel productive, then forget it all in a
              week. Learn something once and you keep less than 5% of it two months later. So
              interview season shows up and you&apos;re starting from zero. Again.
            </p>
          </section>

          {/* 02 - how it works */}
          <section data-reveal className="mt-9 pt-7 border-t border-paper-edge">
            <Cap>02 · how it works</Cap>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-4" data-reveal-stagger>
              {STEPS.map((s) => (
                <div
                  key={s.n}
                  className="bg-paper border border-paper-edge rounded-[3px] cpj-card-shadow p-4"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-[26px] text-blood leading-none">{s.n}</span>
                    <h3 className="font-type text-[17px]">{s.title}</h3>
                  </div>
                  <p className="font-body text-[14px] leading-[1.55] text-ink-soft mt-1.5">{s.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 03 - why it's different */}
          <section data-reveal className="mt-9 pt-7 border-t border-paper-edge">
            <Cap>03 · why it&apos;s not just another tracker</Cap>
            <ul className="mt-3 space-y-3">
              {WHY.map((w) => (
                <li key={w.head} className="flex gap-3">
                  <span className="font-display text-blood text-[18px] leading-[1.2] select-none">✓</span>
                  <p className="font-body text-[15px] leading-[1.55] text-ink">
                    <span className="font-type text-ink">{w.head}</span>{" "}
                    <span className="text-ink-soft">{w.body}</span>
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {/* 04 - who it's for */}
          <section data-reveal className="mt-9 pt-7 border-t border-paper-edge">
            <Cap>04 · who it&apos;s for</Cap>
            <p className="font-body text-[16px] leading-[1.62] text-ink mt-2">
              Built for the placement grind - DSA prep, interview season, or just being tired of
              solving the same problem for the third time. If you practice and want it to add up to
              something, SolveLog is for you.
            </p>
          </section>

          {/* 05 - come in (CTA) */}
          <section data-reveal className="mt-9 pt-7 border-t border-paper-edge text-center">
            <div className="flex justify-center mb-3">
              <Stamp label="INVITE ONLY" sub="SOLVELOG" tone="blood" rotate={-4} />
            </div>
            <p className="font-body text-[16px] text-ink mt-2 max-w-[480px] mx-auto">
              SolveLog is invite-only while it&apos;s young. Leave your email and you&apos;ll hear
              back when the door opens.
            </p>
            <div className="flex justify-center mt-4">
              <RequestAccess />
            </div>
            <p className="font-body italic text-[13px] text-ink-soft mt-5">
              everything in its right place.
            </p>
          </section>
        </PaperSheet>

        <SiteFooter />
      </main>
    </div>
  );
}

export default Landing;
