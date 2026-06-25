import React, { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { processPublicProblems, PUBLIC_PORTFOLIO_SELECT, PUBLIC_PROFILE_SELECT, computePatternCounts } from "@/lib/portfolio";
import { PublicPortfolio } from "@/components/public-portfolio";
import { VerifiedStats, type PublicVerification } from "@/components/verified-stats";
import { SiteFooter } from "@/components/site-footer";
import { Metadata } from "next";

interface PageProps {
  params: Promise<{ handle: string }>;
}

// Usernames are stored lowercased; the lookup matches that.
// Wrapped in React `cache()` so generateMetadata + the page component (which both run in the same
// request) share ONE profile query instead of issuing it twice.
const loadProfile = cache(async (handle: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profile")
    .select(PUBLIC_PROFILE_SELECT)
    .eq("username", handle.toLowerCase())
    .maybeSingle();
  return data;
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { handle } = await params;
  const profile = await loadProfile(handle);

  if (!profile) return { title: "Profile Not Found" };

  const name = profile.display_name || `@${profile.username}`;
  const bio =
    profile.bio ||
    `${name}'s competitive programming portfolio - solved problems and algorithmic techniques.`;

  return {
    title: `${name} - CP Journal`,
    description: bio,
    openGraph: { title: `${name} - CP Journal`, description: bio, type: "website" },
  };
}

export default async function UserPortfolioPage({ params }: PageProps) {
  const { handle } = await params;
  const supabase = await createClient();

  const profile = await loadProfile(handle);
  if (!profile) notFound();

  // problems + verifications are independent (both keyed by profile.user_id) -> fetch in parallel.
  const [{ data: problems }, { data: verifyRows }] = await Promise.all([
    supabase
      .from("problems")
      .select(PUBLIC_PORTFOLIO_SELECT)
      .eq("user_id", profile.user_id)
      .eq("is_public", true),
    // Verified handles + their snapshotted stats (RLS public_read_verified -> only verified rows).
    supabase
      .from("platform_verifications")
      .select("platform, handle, stats, verified_at, source")
      .eq("user_id", profile.user_id)
      .eq("status", "verified"),
  ]);

  const processedProblems = processPublicProblems(problems);
  const patternCounts = computePatternCounts(processedProblems);
  const verifications = (verifyRows ?? []) as PublicVerification[];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.display_name || `@${profile.username}`,
    description: profile.bio || "Competitive Programming solutions journal.",
    sameAs: [
      profile.cf_handle ? `https://codeforces.com/profile/${profile.cf_handle}` : null,
      profile.lc_handle ? `https://leetcode.com/${profile.lc_handle}` : null,
      profile.github_handle ? `https://github.com/${profile.github_handle}` : null,
    ].filter(Boolean),
  };

  return (
    <div className="cpj-desk min-h-screen w-full overflow-x-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* full-bleed Title Wall + docked case file (PublicPortfolio owns its own layout);
          verified stats fold into the same sheet so nothing floats on the dark desk. */}
      <PublicPortfolio problems={processedProblems} profile={profile}>
        {(verifications.length > 0 || patternCounts.length > 0) && (
          <VerifiedStats verifications={verifications} patterns={patternCounts} />
        )}
      </PublicPortfolio>

      <div className="mx-auto w-full max-w-[1140px] px-4 pb-8">
        <SiteFooter />
      </div>
    </div>
  );
}
