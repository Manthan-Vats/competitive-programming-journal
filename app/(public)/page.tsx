import React, { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getOperatorId } from "@/lib/auth/operator";
import { processPublicProblems, PUBLIC_PORTFOLIO_SELECT, PUBLIC_PROFILE_SELECT, computePatternCounts } from "@/lib/portfolio";
import { PublicPortfolio } from "@/components/public-portfolio";
import { VerifiedStats, type PublicVerification } from "@/components/verified-stats";
import { RequestAccess } from "@/components/request-access";
import { Metadata } from "next";

// The root `/` is the OPERATOR's public portfolio (the face of this instance).
// Other users' portfolios live at /u/<handle>. Everything here is scoped to the
// operator's user_id; if no operator is configured it renders an empty shell.

// Wrapped in React `cache()` so generateMetadata + the page component (same request) share ONE
// profile query. PUBLIC_PROFILE_SELECT already includes display_name + bio (the metadata fields).
const loadOperatorProfile = cache(async (operatorId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profile")
    .select(PUBLIC_PROFILE_SELECT)
    .eq("user_id", operatorId)
    .maybeSingle();
  return data;
});

export async function generateMetadata(): Promise<Metadata> {
  const operatorId = getOperatorId();
  const profile = operatorId ? await loadOperatorProfile(operatorId) : null;

  const name = profile?.display_name || "Competitive Programmer";
  const bio =
    profile?.bio ||
    "A personal competitive programming portfolio logging solved problems and analyzing algorithmic techniques.";

  return {
    title: `${name} - Competitive Programming Portfolio`,
    description: bio,
    openGraph: {
      title: `${name} - Competitive Programming Portfolio`,
      description: bio,
      type: "website",
    },
  };
}

export default async function PublicPortfolioPage() {
  const operatorId = getOperatorId();
  const supabase = await createClient();

  let profile: any = null;
  let processedProblems: any[] = [];
  let verifications: PublicVerification[] = [];

  if (operatorId) {
    // profile (cache-shared with generateMetadata), problems, and verifications are independent ->
    // fetch in parallel instead of three sequential round-trips.
    const [profileData, { data: problems }, { data: verifyRows }] = await Promise.all([
      loadOperatorProfile(operatorId),
      supabase
        .from("problems")
        .select(PUBLIC_PORTFOLIO_SELECT)
        .eq("user_id", operatorId)
        .eq("is_public", true),
      supabase
        .from("platform_verifications")
        .select("platform, handle, stats, verified_at, source")
        .eq("user_id", operatorId)
        .eq("status", "verified"),
    ]);
    profile = profileData;
    processedProblems = processPublicProblems(problems);
    verifications = (verifyRows ?? []) as PublicVerification[];
  }

  const patternCounts = computePatternCounts(processedProblems);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile?.display_name || "Competitive Programmer",
    description: profile?.bio || "Competitive Programming solutions journal.",
    url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    sameAs: [
      profile?.cf_handle ? `https://codeforces.com/profile/${profile.cf_handle}` : null,
      profile?.lc_handle ? `https://leetcode.com/${profile.lc_handle}` : null,
      profile?.github_handle ? `https://github.com/${profile.github_handle}` : null,
    ].filter(Boolean),
  };

  return (
    <div className="cpj-desk min-h-screen w-full overflow-x-hidden relative">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* a warm pool of light spilling down the title wall - so the dark surround reads as
          a lit reading-room the case file rests in, not an empty black void. */}
      <div
        aria-hidden
        className="pointer-events-none inset-x-0 top-0 h-[95vh]"
        style={{
          // inline position beats the `.cpj-desk > * { position: relative }` rule
          // (higher specificity) which would otherwise force this into flow.
          position: "absolute",
          zIndex: 0,
          background:
            "radial-gradient(80% 55% at 50% 0%, rgba(231,181,58,0.10), rgba(231,181,58,0.03) 46%, transparent 78%)",
        }}
      />

      {/* full-bleed Title Wall (the name as architecture) + the docked case-file record.
          PublicPortfolio renders the full-width hero then its own centered sheet. */}
      <PublicPortfolio problems={processedProblems} profile={profile}>
        {(verifications.length > 0 || patternCounts.length > 0) && (
          <VerifiedStats verifications={verifications} patterns={patternCounts} />
        )}
        <section className="flex flex-col items-center gap-3 pt-2">
          <RequestAccess />
        </section>
      </PublicPortfolio>
    </div>
  );
}
