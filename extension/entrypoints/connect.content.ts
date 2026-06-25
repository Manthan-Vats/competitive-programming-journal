import { defineContentScript } from "wxt/utils/define-content-script";
import { browser } from "wxt/browser";

// Runs ONLY on the cp-journal /extension/connect page. That page mints a per-user
// token (same-origin, so its Supabase cookie authenticates it) and hands it to us
// via window.postMessage. We relay it to the background worker, recording the
// page's origin as the API base. This page->content-script->background path works
// in both Chrome and Firefox (unlike externally_connectable, which Firefox lacks).
// Add your PRODUCTION app domain to `matches` (and to wxt.config host_permissions).
export default defineContentScript({
  matches: [
    "http://localhost:3000/extension/connect*",
    "https://competitive-programming-journal.vercel.app/extension/connect*",
  ],
  main() {
    window.addEventListener("message", async (event) => {
      // Only trust messages from the page itself (same origin) with our shape.
      if (event.source !== window) return;
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.type !== "CPJ_EXT_TOKEN" || typeof data.token !== "string") {
        return;
      }

      await browser.runtime.sendMessage({
        type: "SET_TOKEN",
        token: data.token,
        apiBase: window.location.origin,
      });
    });
  },
});
