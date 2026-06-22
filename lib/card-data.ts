import { createAdminClient } from "@/lib/supabase/server";
import { computePatternCounts } from "@/lib/portfolio";
import { type CardData, type CardVerification } from "@/lib/badge-card";

// Loads the public, VERIFIED-only data behind the shareable card / credential (P3). Uses the
// service-role client because the card runs without a session (README/OG context); it reads only
// public columns and the public verify page already exposes the same data. Returns null if the
// profile doesn't exist.
// SECURITY: only rows with status='verified' are read, and the stats are the snapshot PULLED from
// the platform at verify time - never user-typed - so a card can't show fake ratings or claim
// someone else's account.
export async function loadCardData(handle: string, origin: string): Promise<CardData | null> {
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profile")
    .select("user_id, username, display_name")
    .eq("username", handle.toLowerCase())
    .maybeSingle();
  if (!profile) return null;

  const username = (profile.username as string) || handle;
  const displayName = ((profile.display_name as string) || "").trim() || `@${username}`;

  const [{ data: verifyRows }, { data: problems }] = await Promise.all([
    admin
      .from("platform_verifications")
      .select("platform, stats, verified_at")
      .eq("user_id", profile.user_id)
      .eq("status", "verified"),
    admin
      .from("problems")
      .select("source_tags, custom_tags")
      .eq("user_id", profile.user_id)
      .eq("is_public", true),
  ]);

  const rows = verifyRows ?? [];
  const verifs: CardVerification[] = rows.map((r) => ({
    platform: r.platform as string,
    stats: (r.stats ?? {}) as CardVerification["stats"],
  }));

  const journaled = problems?.length ?? 0;
  const patterns = computePatternCounts(problems ?? []).length;

  // latest verified_at -> the credential's issue date
  const issuedAt =
    rows
      .map((r) => r.verified_at as string | null)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;

  return {
    displayName,
    username,
    origin,
    verifs,
    journaled,
    patterns,
    issuedAt,
    credentialId: `CPJ-${username.toUpperCase()}`,
  };
}
