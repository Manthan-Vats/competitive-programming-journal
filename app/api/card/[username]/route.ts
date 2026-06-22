import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { loadCardData } from "@/lib/card-data";
import { buildCombinedCardSvg, buildPlatformCardSvg } from "@/lib/badge-card";
import { isVerifyPlatform } from "@/lib/verify";

// Themed SVG achievement card (P3 share surface). Embed in a README/portfolio via
//   ![CP Journal](https://<app>/api/card/<username>)            <- combined
//   ![Codeforces](https://<app>/api/card/<username>?platform=codeforces)  <- single platform
// Renders ONLY public, verified, platform-pulled stats. Cached at the edge so it auto-refreshes.

export const runtime = "nodejs";

function svgResponse(svg: string, status = 200) {
  return new NextResponse(svg, {
    status,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // refresh a few times a day; safe to cache because stats only change on (re)verify
      "Cache-Control": "public, max-age=1800, s-maxage=21600, stale-while-revalidate=86400",
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const platform = request.nextUrl.searchParams.get("platform");
  const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || request.nextUrl.origin;

  if (platform && !isVerifyPlatform(platform)) {
    return svgResponse(
      `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="60"><text x="16" y="36" font-family="monospace" font-size="14" fill="#b81d24">unknown platform</text></svg>`,
      400,
    );
  }

  const data = await loadCardData(username, origin);
  if (!data) {
    return svgResponse(
      `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="60"><text x="16" y="36" font-family="monospace" font-size="14" fill="#6e664f">profile not found</text></svg>`,
      404,
    );
  }

  const svg = platform ? buildPlatformCardSvg(data, platform) : buildCombinedCardSvg(data);

  // PNG variant (e.g. for a LinkedIn post, which won't render SVG). Rasterized at 2× for crispness.
  if (request.nextUrl.searchParams.get("format") === "png") {
    try {
      const png = await sharp(Buffer.from(svg), { density: 144 }).png().toBuffer();
      return new NextResponse(new Uint8Array(png), {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=1800, s-maxage=21600, stale-while-revalidate=86400",
          "Content-Disposition": `inline; filename="cp-journal-${data.username}${platform ? "-" + platform : ""}.png"`,
        },
      });
    } catch {
      // fall back to SVG if rasterization isn't available in this environment
      return svgResponse(svg);
    }
  }

  return svgResponse(svg);
}
