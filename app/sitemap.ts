import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/server";
import { getOperatorId } from "@/lib/auth/operator";

// Public surface: the marketing landing + legal pages, plus the operator's own portfolio at
// /u/<handle> (since "/" is now the landing, not their portfolio). Other users' public portfolios
// are discoverable from there; a fuller dynamic sitemap can be added later.
const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  // Add the operator's public portfolio if they've set a handle.
  try {
    const operatorId = getOperatorId();
    if (operatorId) {
      const admin = createAdminClient();
      const { data } = await admin
        .from("profile")
        .select("username")
        .eq("user_id", operatorId)
        .maybeSingle();
      if (data?.username) {
        entries.push({
          url: `${base}/u/${data.username}`,
          lastModified: now,
          changeFrequency: "weekly",
          priority: 0.8,
        });
      }
    }
  } catch {
    /* sitemap must never throw - skip the dynamic entry on any error */
  }

  return entries;
}
