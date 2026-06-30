import { defineContentScript } from "wxt/utils/define-content-script";
import { browser } from "wxt/browser";

// Bridge between the cp-journal WEB APP and the extension background, so history sync is driven
// from the web app (where it belongs) while the extension does the session-gated fetching. The
// page talks to us via window.postMessage (same-origin only); we relay to the background and
// stream results/progress back. This is the same page->content-script->background pattern as the
// connect handshake (works in Chrome + Firefox, unlike externally_connectable).
// Add your PRODUCTION app domain to `matches` (and to wxt.config host_permissions).
export default defineContentScript({
  matches: [
    "http://localhost:3000/admin/*",
    "https://solvelog.vercel.app/admin/*",
    "https://competitive-programming-journal.vercel.app/admin/*",
  ],
  main() {
    // Proactively announce presence so the web app doesn't depend on its single ping
    // landing AFTER our listener is wired (a race that caused false "not detected").
    // The page treats this exactly like a pong. Sent on load AND the page also retries
    // its ping - belt and suspenders for either ordering.
    const announce = () =>
      window.postMessage({ type: "CPJ_COMPANION_HELLO" }, window.location.origin);
    announce();
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", announce, { once: true });
    }

    // Page -> extension.
    window.addEventListener("message", async (event) => {
      if (event.source !== window) return;
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || typeof data.type !== "string") return;

      // Presence probe: the web app pings to learn whether the companion is installed.
      if (data.type === "CPJ_PING") {
        window.postMessage({ type: "CPJ_PONG" }, window.location.origin);
        return;
      }

      // Sync request: run the deep history sync for one judge in the background.
      if (
        data.type === "CPJ_SYNC" &&
        (data.judge === "codeforces" || data.judge === "leetcode")
      ) {
        const result = await browser.runtime.sendMessage({
          type: "SYNC_JUDGE",
          judge: data.judge,
          handle: typeof data.handle === "string" ? data.handle : undefined,
        });
        window.postMessage(
          { type: "CPJ_SYNC_RESULT", judge: data.judge, result },
          window.location.origin
        );
        return;
      }

      // Extension-backed verification: report the logged-in handle on the judge.
      if (
        data.type === "CPJ_VERIFY" &&
        (data.judge === "codeforces" || data.judge === "leetcode")
      ) {
        const result = await browser.runtime.sendMessage({
          type: "VERIFY_HANDLE",
          judge: data.judge,
        });
        window.postMessage(
          { type: "CPJ_VERIFY_RESULT", judge: data.judge, result },
          window.location.origin
        );
        return;
      }
    });

    // Background -> page: relay progress ticks the background sends to this tab.
    browser.runtime.onMessage.addListener((msg: { type?: string }) => {
      if (msg?.type === "CPJ_SYNC_PROGRESS") {
        window.postMessage(msg, window.location.origin);
      }
    });
  },
});
