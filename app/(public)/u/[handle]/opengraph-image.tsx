import { loadCardData } from "@/lib/card-data";
import { portfolioOgImage, OG_SIZE } from "@/lib/og-card";
import { type CardData } from "@/lib/badge-card";

// Dynamic Open Graph image for the public verify page (P3): the themed case-file card on the desk.
// Reads only public, verified data (loadCardData uses the service-role client; no cookies needed).

export const runtime = "nodejs";
export const alt = "SolveLog - a verified practice portfolio";
export const size = OG_SIZE;
export const contentType = "image/png";

const ORIGIN = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";

export default async function OgImage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const fallback: CardData = {
    displayName: "A SolveLog member",
    username: handle,
    origin: ORIGIN,
    verifs: [],
    journaled: 0,
    patterns: 0,
    issuedAt: null,
    credentialId: `CPJ-${handle.toUpperCase()}`,
  };

  return portfolioOgImage((await loadCardData(handle, ORIGIN)) ?? fallback);
}
