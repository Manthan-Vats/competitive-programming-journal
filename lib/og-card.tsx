import sharp from "sharp";
import { buildCombinedCardSvg, type CardData } from "@/lib/badge-card";

// Open Graph image (P3 share surface) for the public portfolio pages. To keep ONE source of truth,
// the OG image is the same themed "case-file" card (lib/badge-card) rasterized and centered on the
// dark desk - so a link unfurl on LinkedIn/Twitter/Slack looks exactly like the embeddable badge.

export const OG_SIZE = { width: 1200, height: 630 };

const DESK = "#15120e";
const DESK_HI = "#2c271e";

export async function portfolioOgImage(data: CardData): Promise<Response> {
  const { width: W, height: H } = OG_SIZE;

  // desk background with a warm top-light radial, matching the app's .cpj-desk
  const bg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <radialGradient id="light" cx="50%" cy="0%" r="85%">
        <stop offset="0" stop-color="${DESK_HI}"/>
        <stop offset="1" stop-color="${DESK}"/>
      </radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#light)"/>
    <circle cx="${W / 2}" cy="-40" r="${W * 0.42}" fill="rgba(231,181,58,0.07)"/>
  </svg>`;

  // Rasterize the card at 2× then fit it inside the canvas with a margin (the card height grows
  // with the number of verified platforms, so always constrain it rather than assume a size).
  const card = await sharp(Buffer.from(buildCombinedCardSvg(data)), { density: 144 })
    .resize({ width: 1000, height: 520, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();

  const out = await sharp(Buffer.from(bg))
    .composite([{ input: card, gravity: "center" }])
    .png()
    .toBuffer();

  return new Response(new Uint8Array(out), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400",
    },
  });
}
