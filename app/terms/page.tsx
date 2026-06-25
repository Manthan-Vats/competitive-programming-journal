import React from "react";
import Link from "next/link";
import { Metadata } from "next";
import { PaperSheet } from "@/components/paper/paper-sheet";
import { Cap } from "@/components/paper/bits";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Terms of Use - CP Journal",
  description: "The terms under which you may use CP Journal.",
};

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

export default function TermsPage() {
  return (
    <div className="cpj-desk min-h-screen w-full py-6 px-4">
      <div className="w-full max-w-3xl mx-auto space-y-6">
        <PaperSheet variant="page" className="p-[24px] md:p-[34px]">
          <Link href="/" className="font-mono text-[10px] tracking-[0.16em] text-ink-faint hover:text-blood uppercase">
            ◂ back · the library
          </Link>
          <h1 className="font-display text-[34px] leading-[0.95] mt-3">TERMS OF USE</h1>
          <p className="font-mono text-[11px] text-ink-soft mt-1">last updated · {UPDATED}</p>

          <Block cap="THE GIST">
            <P>
              CP Journal is a personal tool for keeping a competitive-programming journal and public
              portfolio, offered to invited users free of charge. By using it you agree to these
              terms. If you do not agree, please do not use the service.
            </P>
          </Block>

          <Block cap="YOUR ACCOUNT">
            <P>
              Access is by invitation. Keep your login secure; you are responsible for activity under
              your account. Use the service for your own competitive-programming record-keeping.
            </P>
          </Block>

          <Block cap="BRING YOUR OWN AI KEY">
            <P>
              AI features run on Google Gemini using an API key you supply. You are responsible for
              your own Gemini usage, quota, costs (if any), and for complying with{" "}
              <a className="text-blueprint hover:underline" href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer">Google&apos;s API terms</a>.
              We provide no AI quota and make no guarantee about AI output quality or availability.
            </P>
          </Block>

          <Block cap="ACCEPTABLE USE">
            <P>
              Do not use CP Journal to store or publish content you do not have the right to, to
              attempt to access other users&apos; data, to abuse or overload the service, or to break
              the law. When capturing problems from online judges, respect those judges&apos; own terms
              of service - capture only your own submissions and content you are permitted to save.
            </P>
          </Block>

          <Block cap="YOUR CONTENT">
            <P>
              You keep ownership of everything you put into your journal. You grant us only the
              permission needed to store and display it to you, and - for items you mark public - to
              show them on your public portfolio. You can export or delete your content at any time
              from Settings.
            </P>
          </Block>

          <Block cap="NO WARRANTY">
            <P>
              The service is provided &quot;as is&quot;, without warranties of any kind. It may change,
              break, or go offline. To the maximum extent permitted by law, we are not liable for any
              loss arising from your use of it. Keep your own backups of anything important (the export
              tool is there for exactly this).
            </P>
          </Block>

          <Block cap="SUSPENSION">
            <P>
              We may suspend or remove an account that abuses the service or violates these terms.
            </P>
          </Block>

          <Block cap="CONTACT">
            <P>
              Questions? Email{" "}
              <a className="text-blueprint hover:underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>.
            </P>
          </Block>
        </PaperSheet>
        <SiteFooter />
      </div>
    </div>
  );
}
