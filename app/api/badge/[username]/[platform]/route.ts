import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isVerifyPlatform, badgeMessage, type VerifyStats } from "@/lib/verify";

// shields.io ENDPOINT badge (P3): returns the JSON schema shields expects, so a user can embed
//   ![](https://img.shields.io/endpoint?url=https://<app>/api/badge/<username>/<platform>)
// in a GitHub README. Reads only VERIFIED, public stats (RLS public_read_verified). Never trusts
// typed numbers - the snapshot was pulled from the platform at verify time.

export const runtime = "nodejs";

const PLATFORM_META: Record<string, { label: string; color: string }> = {
  codeforces: { label: "Codeforces", color: "1f8acb" },
  leetcode: { label: "LeetCode", color: "ffa116" },
  github: { label: "GitHub", color: "181717" },
};

function badge(label: string, message: string, color: string) {
  return NextResponse.json(
    { schemaVersion: 1, label, message, color, cacheSeconds: 1800 },
    { headers: { "Cache-Control": "public, max-age=1800, s-maxage=1800" } }
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string; platform: string }> }
) {
  const { username, platform } = await params;
  const meta = PLATFORM_META[platform];
  if (!isVerifyPlatform(platform) || !meta) {
    return badge("solvelog", "unknown platform", "lightgrey");
  }

  try {
    const supabase = await createClient();

    const { data: profile } = await supabase
      .from("profile")
      .select("user_id")
      .eq("username", username)
      .maybeSingle();
    if (!profile) return badge(meta.label, "not found", "lightgrey");

    const { data: v } = await supabase
      .from("platform_verifications")
      .select("stats, status")
      .eq("user_id", profile.user_id)
      .eq("platform", platform)
      .eq("status", "verified")
      .maybeSingle();

    if (!v) return badge(meta.label, "unverified", "lightgrey");

    return badge(meta.label, badgeMessage(platform, (v.stats ?? {}) as VerifyStats), meta.color);
  } catch {
    return badge(meta.label, "unavailable", "lightgrey");
  }
}
