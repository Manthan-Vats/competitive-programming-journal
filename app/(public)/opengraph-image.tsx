import { createAdminClient } from "@/lib/supabase/server";
import { getOperatorId } from "@/lib/auth/operator";
import { loadCardData } from "@/lib/card-data";
import { portfolioOgImage, OG_SIZE } from "@/lib/og-card";
import { type CardData } from "@/lib/badge-card";

// Open Graph image for the operator's root portfolio `/` (P3). Same themed case-file card as the
// per-user verify page, scoped to the operator.

export const runtime = "nodejs";
export const alt = "CP Journal - verified competitive programming portfolio";
export const size = OG_SIZE;
export const contentType = "image/png";

const ORIGIN = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";

const FALLBACK: CardData = {
  displayName: "Competitive Programmer",
  username: "portfolio",
  origin: ORIGIN,
  verifs: [],
  journaled: 0,
  patterns: 0,
  issuedAt: null,
  credentialId: "CPJ-PORTFOLIO",
};

export default async function OgImage() {
  const operatorId = getOperatorId();
  if (operatorId) {
    try {
      const admin = createAdminClient();
      const { data: profile } = await admin
        .from("profile")
        .select("username")
        .eq("user_id", operatorId)
        .maybeSingle();
      const username = (profile?.username as string) || "";
      if (username) {
        const data = await loadCardData(username, ORIGIN);
        if (data) return portfolioOgImage(data);
      }
    } catch {
      /* fall through to generic card */
    }
  }
  return portfolioOgImage(FALLBACK);
}
