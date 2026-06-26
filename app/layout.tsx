import type { Metadata } from "next";
import {
  Anton,
  Special_Elite,
  Newsreader,
  JetBrains_Mono,
  Permanent_Marker,
} from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { EasterEggs } from "@/components/easter-eggs";
import { SoundProvider } from "@/components/paper/sound-provider";
import { MotionProvider } from "@/components/paper/motion-provider";
import { MusicPlayer } from "@/components/paper/music-player";
import { Analytics } from "@vercel/analytics/next";

/* - the five paper fonts, strict roles (00_FOUNDATIONS §2.2) - */
const anton = Anton({
  variable: "--font-anton",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});
const specialElite = Special_Elite({
  variable: "--font-special-elite",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});
const permanentMarker = Permanent_Marker({
  variable: "--font-permanent-marker",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SolveLog - remember every problem you solve",
  description:
    "Capture every problem you solve, understand the pattern, and remember it for good - a practice journal in a Radiohead Public Library.",
  other: {
    // a small hello for anyone who reads the <head>
    "x-message-to-the-curious": "2 + 2 = 5",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${anton.variable} ${specialElite.variable} ${newsreader.variable} ${jetbrainsMono.variable} ${permanentMarker.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-desk-deep text-ink font-body antialiased">
        {/* shared paper SVG filter defs (deckled/torn edge) - mounted once */}
        <svg
          width="0"
          height="0"
          aria-hidden="true"
          style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
        >
          <defs>
            <filter id="cpj-deckle-filter">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.012 0.022"
                numOctaves={3}
                seed={7}
                result="t"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="t"
                scale={6}
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          </defs>
        </svg>
        <MotionProvider>
          <SoundProvider>
            <TooltipProvider>{children}</TooltipProvider>
            <Toaster
              theme="light"
              closeButton
              position="bottom-right"
              toastOptions={{
                style: {
                  background: "var(--color-paper-sheet)",
                  color: "var(--color-ink)",
                  border: "1px solid var(--color-paper-edge)",
                  fontFamily: "var(--font-body)",
                },
              }}
            />
            <EasterEggs />
            <MusicPlayer />
          </SoundProvider>
        </MotionProvider>
        {/* Cookieless, privacy-friendly page analytics. No-op off Vercel / in dev. */}
        <Analytics />
      </body>
    </html>
  );
}
