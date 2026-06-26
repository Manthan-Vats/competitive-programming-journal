import { defineConfig } from "wxt";

// WXT config - builds MV3 for Chrome + Firefox from one codebase.
// See docs/planning/p2-extension-architecture.md for the locked design.
// host_permissions cover (a) the cp-journal web app the extension talks to and
// (b) the judges it captures from. The web-app origin is also where the connect
// handshake content script runs. Add your PRODUCTION app domain to BOTH the
// host_permissions list and entrypoints/connect.content.ts `matches`.
export default defineConfig({
  manifest: {
    name: "SolveLog Companion",
    description:
      "One-click capture of coding problems into your SolveLog.",
    // unlimitedStorage: the CF rating/tags enrichment caches the full problemset map
    // (~1-2 MB) in storage.local, which can exceed the default ~10 MB quota over time.
    // The LeetCode csrftoken is read from `document.cookie` inside the same-origin content script
    // (not the chrome.cookies API), so the `cookies` permission is not needed.
    permissions: ["storage", "unlimitedStorage", "activeTab", "tabs"],
    host_permissions: [
      // cp-journal web app. Keep dev + prod in sync with background.ts TRUSTED_APP_ORIGINS
      // and connect.content.ts `matches`.
      "http://localhost:3000/*",
      "https://competitive-programming-journal.vercel.app/*",
      // Judges we capture from (v1).
      "https://codeforces.com/*",
      "https://*.codeforces.com/*",
      "https://atcoder.jp/*",
      "https://www.codechef.com/*",
      "https://leetcode.com/*",
    ],
  },
});
