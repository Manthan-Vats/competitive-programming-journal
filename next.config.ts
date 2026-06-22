import type { NextConfig } from "next";

// Baseline security headers applied to every response. These are the non-breaking set -
// a full Content-Security-Policy is deliberately deferred to the frontend rebuild (the R3F /
// WebGL / Web-Audio / blob-worker UI needs a CSP tuned against it, and tuning it now would be
// thrown away). See docs/audit/2026-06-17-hardening-progress.md.
const securityHeaders = [
  // Don't let browsers MIME-sniff responses into a different content type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Clickjacking: this app is never meant to be framed.
  { key: "X-Frame-Options", value: "DENY" },
  // Send only the origin on cross-origin navigations; full URL same-origin.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Drop powerful features the app never uses.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  // Only meaningful over HTTPS; harmless on localhost. 2 years + preload-eligible.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
