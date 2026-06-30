import React from "react";
import Link from "next/link";
import { PaperSheet } from "@/components/paper/paper-sheet";
import { Stamp } from "@/components/paper/stamp";
import { RequestAccess } from "@/components/request-access";
import { SiteFooter } from "@/components/site-footer";
import { ModifiedBear } from "@/components/modified-bear";

// Public marketing landing shown to logged-out visitors at "/". One tall paper "dossier" sheet
// resting on the dark desk, so every word is high-contrast ink-on-paper and the type hierarchy
// is unmistakable: mono labels < serif body < Special-Elite sub-heads < Anton headlines, with the
// blood StampButton as the one obvious primary action. Server component; the interactive bits
// (RequestAccess, SiteFooter) are nested client components. Motion = the global data-reveal system.

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
    body: "Spaced repetition brings each problem back right before you'd forget it. This is the part that makes it stick, instead of just piling up.",
  },
  {
    n: "04",
    title: "Show it off",
    body: "Every solve turns into a clean public portfolio with a verified badge. Put the link on your resume and let recruiters see the real work.",
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

/** A consistent section label: mono caps, blood, with a short rule - the one caption style. */
function SectionLabel({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="font-mono text-[12px] font-bold text-blood">{n}</span>
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint">
        {children}
      </span>
      <span className="h-px flex-1 bg-paper-edge" />
    </div>
  );
}

export function Landing() {
  return (
    <div className="cpj-desk min-h-screen w-full overflow-x-hidden relative">
      {/* warm pool of light over the dossier */}
      <div
        aria-hidden
        className="pointer-events-none inset-x-0 top-0 h-[70vh]"
        style={{
          position: "absolute",
          zIndex: 0,
          background:
            "radial-gradient(70% 50% at 50% 0%, rgba(231,181,58,0.09), rgba(231,181,58,0.025) 50%, transparent 80%)",
        }}
      />

      <main className="relative z-[1] w-full max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <PaperSheet variant="page" className="cpj-develop px-6 py-9 sm:px-12 sm:py-12">
          {/* ===== MASTHEAD ===== */}
          <header>
            {/* kicker row: brand mark + filing tab */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ModifiedBear className="w-[22px] h-[22px] text-blood" />
                <span className="font-type text-[18px] tracking-[0.04em] text-ink">SolveLog</span>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                case file · invite-only
              </span>
            </div>
            <div className="mt-3 border-t-2 border-ink/80" />
            <div className="mt-1 border-t border-paper-edge" />

            {/* the promise - the loud, high-contrast headline */}
            <p className="mt-7 font-mono text-[11px] uppercase tracking-[0.22em] text-blood">
              a practice journal for people who grind
            </p>
            <h1 className="mt-3 font-display uppercase text-ink leading-[0.9] text-[clamp(2.5rem,9vw,4.6rem)]">
              Remember every
              <br />
              problem you solve.
            </h1>
            <p className="mt-5 font-body text-[clamp(1.05rem,2.4vw,1.25rem)] leading-[1.6] text-ink-soft max-w-[34rem]">
              You grind 300 problems for placements, then blank on half of them in the
              interview. SolveLog files each one, explains it, and brings it back before you
              forget - so the practice actually adds up.
            </p>

            {/* the one primary action, clearly a button + a quiet secondary */}
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <RequestAccess trigger="button" label="request an invite" />
              <Link
                href="/login"
                className="font-type text-[14px] text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-blood hover:text-blood transition-colors"
              >
                already have an invite? log in
              </Link>
            </div>
          </header>

          {/* ===== 01 THE PROBLEM ===== */}
          <section data-reveal className="mt-14">
            <SectionLabel n="01">the problem</SectionLabel>
            <h2 className="mt-4 font-display uppercase text-ink leading-[1.02] text-[clamp(1.5rem,4vw,2.15rem)]">
              You&apos;ve solved 300 problems.
              <br className="hidden sm:block" /> Could you re-solve 30 right now?
            </h2>
            <p className="mt-4 font-body text-[16.5px] leading-[1.65] text-ink">
              Most of us grind LeetCode and Codeforces, feel productive, then forget it all in a
              week. You keep less than 5% of what you learn two months later. So interview season
              shows up and you&apos;re starting from zero. Again.
            </p>
          </section>

          {/* ===== 02 HOW IT WORKS ===== */}
          <section data-reveal className="mt-12">
            <SectionLabel n="02">how it works</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5" data-reveal-stagger>
              {STEPS.map((s) => (
                <div
                  key={s.n}
                  className="bg-paper-sheet border border-paper-edge rounded-[3px] cpj-card-shadow p-5"
                >
                  <div className="flex items-baseline gap-2.5">
                    <span className="font-display text-[30px] text-blood leading-none">{s.n}</span>
                    <h3 className="font-type text-[18px] text-ink">{s.title}</h3>
                  </div>
                  <p className="font-body text-[15px] leading-[1.6] text-ink-soft mt-2">{s.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ===== 03 WHY IT'S DIFFERENT ===== */}
          <section data-reveal className="mt-12">
            <SectionLabel n="03">why it&apos;s not just another tracker</SectionLabel>
            <ul className="mt-5 space-y-4">
              {WHY.map((w) => (
                <li key={w.head} className="flex gap-3.5">
                  <span className="font-display text-blood text-[19px] leading-[1.3] select-none">
                    &#10003;
                  </span>
                  <p className="font-body text-[16px] leading-[1.6]">
                    <span className="font-type text-[15px] text-ink">{w.head}</span>{" "}
                    <span className="text-ink-soft">{w.body}</span>
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {/* ===== 04 WHO IT'S FOR ===== */}
          <section data-reveal className="mt-12">
            <SectionLabel n="04">who it&apos;s for</SectionLabel>
            <p className="mt-4 font-body text-[16.5px] leading-[1.65] text-ink">
              Built for the placement grind - DSA prep, interview season, or just being tired of
              solving the same problem for the third time. If you practice and want it to add up
              to something, SolveLog is for you.
            </p>
          </section>

          {/* ===== CTA ===== */}
          <section
            data-reveal
            className="mt-14 pt-9 border-t border-paper-edge flex flex-col items-center text-center"
          >
            <Stamp label="INVITE ONLY" sub="SOLVELOG" tone="blood" rotate={-4} />
            <h2 className="mt-5 font-display uppercase text-ink leading-[1.0] text-[clamp(1.5rem,4.5vw,2.3rem)]">
              Pull up a chair.
            </h2>
            <p className="mt-3 font-body text-[16.5px] leading-[1.6] text-ink-soft max-w-[30rem]">
              SolveLog is invite-only while it&apos;s young. Leave your email and you&apos;ll hear
              back when the door opens.
            </p>
            <div className="mt-6">
              <RequestAccess trigger="button" label="request an invite" />
            </div>
          </section>

          <div className="mt-2">
            <SiteFooter />
          </div>
        </PaperSheet>
      </main>
    </div>
  );
}

export default Landing;
