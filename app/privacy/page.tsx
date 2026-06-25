import React from "react";
import Link from "next/link";
import { Metadata } from "next";
import { PaperSheet } from "@/components/paper/paper-sheet";
import { Cap } from "@/components/paper/bits";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Privacy Policy - CP Journal",
  description: "What CP Journal collects, how it is stored, and your data rights.",
};

// Operator contact for data requests. Update if the instance is run by someone else.
const CONTACT = "manthan.ralph17@gmail.com";
const UPDATED = "June 2026";

const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="font-body text-[15px] leading-[1.62] text-ink mt-2">{children}</p>
);
const Block: React.FC<{ cap: string; children: React.ReactNode }> = ({ cap, children }) => (
  <section className="mt-6 pt-5 border-t border-paper-edge first:border-0 first:pt-0 first:mt-4">
    <Cap>{cap}</Cap>
    {children}
  </section>
);

export default function PrivacyPage() {
  return (
    <div className="cpj-desk min-h-screen w-full py-6 px-4">
      <div className="w-full max-w-3xl mx-auto space-y-6">
        <PaperSheet variant="page" className="p-[24px] md:p-[34px]">
          <Link href="/" className="font-mono text-[10px] tracking-[0.16em] text-ink-faint hover:text-blood uppercase">
            ◂ back · the library
          </Link>
          <h1 className="font-display text-[34px] leading-[0.95] mt-3">PRIVACY POLICY</h1>
          <p className="font-mono text-[11px] text-ink-soft mt-1">last updated · {UPDATED}</p>

          <Block cap="WHO WE ARE">
            <P>
              CP Journal is a personal competitive-programming journal and public portfolio. It is
              invite-only: each invited person owns their own data, isolated from everyone else by
              database row-level security. This policy explains what we store and your rights over it.
            </P>
          </Block>

          <Block cap="WHAT WE COLLECT">
            <P>
              <strong>Account:</strong> your email address (for sign-in and invite/reset emails).
            </P>
            <P>
              <strong>Profile you enter:</strong> your public handle, display name, bio, and any
              competitive-programming / social handles you choose to add.
            </P>
            <P>
              <strong>Journal content:</strong> the problems, solution code, notes, tags, and solve
              timings you save manually or sync from judges.
            </P>
            <P>
              <strong>AI analyses:</strong> when you run an analysis or revision assist, the relevant
              problem and your solution code are sent to Google Gemini using <em>your own</em> API
              key, and the result is stored on your journal.
            </P>
            <P>
              <strong>Verification:</strong> if you verify a judge handle, we store that handle and a
              snapshot of its public stats to display a verified badge.
            </P>
          </Block>

          <Block cap="THE BROWSER EXTENSION">
            <P>
              The optional CP Journal Companion extension captures a problem&apos;s metadata and your
              own solution code from judge pages you are viewing, and sends them to your journal over
              a per-user, revocable access token. It reads only what is needed to file a problem. We
              never store your judge passwords or session cookies on our servers - the token only
              authorizes writing to your own journal, and you can revoke it at any time.
            </P>
          </Block>

          <Block cap="YOUR AI KEY (BYOK)">
            <P>
              You bring your own free Google Gemini API key. It is encrypted at rest with AES-256-GCM;
              the master encryption key lives only on the server, never in the database, so a database
              leak alone cannot expose it. Your key is decrypted only in memory, server-side, at the
              moment of an AI request, and is never sent to your browser or to anyone but Google.
              AI requests made with your key are subject to{" "}
              <a className="text-blueprint hover:underline" href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google&apos;s privacy policy</a>.
            </P>
          </Block>

          <Block cap="WHAT IS PUBLIC">
            <P>
              Anything you explicitly mark public appears on your portfolio at <code>/u/your-handle</code>{" "}
              and may be indexed by search engines. Everything else is private to your account. You
              control what is public per problem and per solution.
            </P>
          </Block>

          <Block cap="ANALYTICS & ERROR MONITORING">
            <P>
              We use Vercel Web Analytics, which is cookieless and does not build advertising profiles
              of you. We use Sentry to capture application errors so we can fix them; it is configured
              not to send cookies, request bodies, or personal data, and known secret-shaped strings
              are scrubbed before anything is sent.
            </P>
          </Block>

          <Block cap="WHERE YOUR DATA LIVES">
            <P>
              Data is stored with Supabase (Postgres) and the app is hosted on Vercel. Auth and invite
              emails are delivered over SMTP. We do not sell your data or share it with advertisers.
            </P>
          </Block>

          <Block cap="YOUR RIGHTS">
            <P>
              You can export everything we hold for you, or permanently delete your account and all of
              its data, at any time from <strong>Settings → How to disappear completely</strong>.
              Deletion is immediate and irreversible. For anything else, email{" "}
              <a className="text-blueprint hover:underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>.
            </P>
          </Block>

          <Block cap="CHANGES">
            <P>
              If this policy changes materially we will update the date above. Continued use after a
              change means you accept the updated policy.
            </P>
          </Block>
        </PaperSheet>
        <SiteFooter />
      </div>
    </div>
  );
}
