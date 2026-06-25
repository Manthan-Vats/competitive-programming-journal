import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Content-Security-Policy. The old WebGL/Web-Audio UI that blocked a CSP is gone (the paper UI is
// CSS-3D/GSAP only), so we can ship one now. Notes on each non-obvious directive:
//  - script-src 'unsafe-inline': Next.js injects inline bootstrap/hydration scripts and we render
//    static/ISR public pages, so a nonce (which forces every page dynamic) is not worth the SEO/perf
//    cost here. Upgrading to nonces is a documented future hardening.
//  - worker-src/child-src blob:: Monaco (self-hosted, see components/code-editor.tsx) spawns its
//    editor workers from blob: URLs.
//  - connect-src: Supabase REST/auth over https + realtime over wss; Vercel Web Analytics beacon.
//    Gemini calls happen server-side, and Sentry client events are tunneled same-origin (see
//    tunnelRoute below), so neither needs a third-party origin here.
//  - va.vercel-scripts.com: the Vercel Analytics loader script.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.vercel-insights.com",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

// Ship report-only by default so a missed directive can't break prod (e.g. the authed Monaco editor
// or Supabase realtime). After verifying zero violations in the browser console, set
// CSP_ENFORCE=true to switch to the enforcing header - no code change needed.
const cspHeaderKey =
  process.env.CSP_ENFORCE === "true" ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only";

// Baseline security headers applied to every response.
const securityHeaders = [
  { key: cspHeaderKey, value: csp },
  // Don't let browsers MIME-sniff responses into a different content type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Clickjacking: this app is never meant to be framed (CSP frame-ancestors backs this up).
  { key: "X-Frame-Options", value: "DENY" },
  // Send only the origin on cross-origin navigations; full URL same-origin.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Drop powerful features the app never uses.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  // Only meaningful over HTTPS; harmless on localhost. 2 years + preload-eligible.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

// withSentryConfig wires source-map upload + the same-origin tunnel route. Source maps upload only
// when SENTRY_AUTH_TOKEN (+ SENTRY_ORG/SENTRY_PROJECT) are set; otherwise it's a quiet no-op, so
// local/dev builds are unaffected.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // Proxy client error/trace traffic through our own origin to beat ad-blockers and keep CSP tight.
  tunnelRoute: "/monitoring",
  // Tree-shake Sentry's debug logging out of the production bundle.
  webpack: { treeshake: { removeDebugLogging: true } },
});
