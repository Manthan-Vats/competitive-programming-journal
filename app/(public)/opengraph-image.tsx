import sharp from "sharp";
import { OG_SIZE } from "@/lib/og-card";

// Open Graph image for the marketing landing "/". A simple SolveLog wordmark + tagline on the dark
// desk (rendered with sharp/SVG, same approach as the portfolio OG - no satori/font deps).

export const runtime = "nodejs";
export const alt = "SolveLog - remember every problem you solve";
export const size = OG_SIZE;
export const contentType = "image/png";

const DESK = "#15120e";
const DESK_HI = "#2c271e";
const INK = "#efe9d9";
const SOFT = "#c9c1ad";
const BLOOD = "#b81d24";

export default async function OgImage() {
  const { width: W, height: H } = OG_SIZE;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <radialGradient id="light" cx="50%" cy="0%" r="85%">
        <stop offset="0" stop-color="${DESK_HI}"/>
        <stop offset="1" stop-color="${DESK}"/>
      </radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#light)"/>
    <circle cx="${W / 2}" cy="-40" r="${W * 0.42}" fill="rgba(231,181,58,0.07)"/>
    <text x="${W / 2}" y="300" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="150" font-weight="800" fill="${INK}" letter-spacing="2">SolveLog</text>
    <text x="${W / 2}" y="378" text-anchor="middle" font-family="Georgia, serif" font-size="44" fill="${SOFT}">Remember every problem you solve.</text>
    <text x="${W / 2}" y="468" text-anchor="middle" font-family="monospace" font-size="24" fill="${BLOOD}" letter-spacing="6">INVITE-ONLY</text>
  </svg>`;

  const out = await sharp(Buffer.from(svg)).png().toBuffer();
  return new Response(new Uint8Array(out), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400",
    },
  });
}
