import { defineContentScript } from "wxt/utils/define-content-script";
import { browser } from "wxt/browser";
import type { ContentMessage, ParsePageResult } from "../lib/messages";
import { parsePage } from "../lib/parsers";

// Runs on supported judge PROBLEM pages. It does nothing until the popup asks it to
// PARSE_PAGE, then it reads the live DOM with the matching judge parser and returns a
// capture payload (or null). Network + the per-user token live in the background worker,
// never here. Add more judges by extending both these `matches` and the parser registry.
export default defineContentScript({
  matches: [
    "*://codeforces.com/contest/*/problem/*",
    "*://codeforces.com/problemset/problem/*",
    "*://codeforces.com/gym/*/problem/*",
    "*://codeforces.com/group/*/contest/*/problem/*",
    "*://*.codeforces.com/contest/*/problem/*",
    "*://*.codeforces.com/problemset/problem/*",
    "*://leetcode.com/problems/*",
    "*://atcoder.jp/contests/*/tasks/*",
    "*://www.codechef.com/problems/*",
    "*://www.codechef.com/*/problems/*",
  ],
  main() {
    browser.runtime.onMessage.addListener(
      (message: ContentMessage, _sender, sendResponse) => {
        if (message?.type === "PARSE_PAGE") {
          // parsePage is async (some judges fetch metadata) - keep the channel open and
          // respond when it resolves. Returning true signals an async sendResponse.
          parsePage(document, window.location.href)
            .then((payload) => sendResponse({ payload } as ParsePageResult))
            .catch(() => sendResponse({ payload: null } as ParsePageResult));
          return true;
        }
      }
    );
  },
});
