import { browser } from "wxt/browser";
import type { SyncResult, ContentMessage, WhoamiResult } from "./messages";

// Background orchestration that needs a judge's logged-in session. A background service-worker
// fetch does NOT reliably carry cross-site cookies, so we run the work in a content script ON the
// judge origin (same-origin -> cookies attach). This opens a FRESH background tab we control, runs
// the content script there, and closes it. The user never opens the judge - the extension does.

const JUDGE = {
  codeforces: { url: "https://codeforces.com/" },
  leetcode: { url: "https://leetcode.com/" },
} as const;

const LOAD_TIMEOUT_MS = 30000;
const READY_RETRIES = 10;
const READY_DELAY_MS = 700;

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function waitForComplete(tabId: number): Promise<void> {
  const tab = await browser.tabs.get(tabId);
  if (tab.status === "complete") return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      browser.tabs.onUpdated.removeListener(listener);
      reject(new Error("Timed out loading the judge page"));
    }, LOAD_TIMEOUT_MS);
    function listener(id: number, info: { status?: string }) {
      if (id === tabId && info.status === "complete") {
        clearTimeout(timer);
        browser.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    browser.tabs.onUpdated.addListener(listener);
  });
}

// Send a message to the tab's content script, retrying until it answers (injects at document_idle).
async function sendToTab<T>(tabId: number, message: ContentMessage): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < READY_RETRIES; i++) {
    try {
      const res = (await browser.tabs.sendMessage(tabId, message)) as T;
      if (res) return res;
    } catch (err) {
      lastErr = err;
    }
    await wait(READY_DELAY_MS);
  }
  throw new Error(
    `Couldn't reach the judge page (${lastErr instanceof Error ? lastErr.message : "no content script"})`
  );
}

// Open a FRESH background judge tab, run `fn` against its content script, then close it. Never
// reuses an existing tab (MV3 only injects content scripts into tabs loaded after the extension
// (re)loads, so a pre-existing tab would have no listener).
async function withJudgeTab<T>(
  judge: "codeforces" | "leetcode",
  fn: (tabId: number) => Promise<T>
): Promise<T> {
  const tab = await browser.tabs.create({ url: JUDGE[judge].url, active: false });
  if (tab.id == null) throw new Error("Could not open the judge tab");
  const tabId = tab.id;
  try {
    await waitForComplete(tabId);
    return await fn(tabId);
  } finally {
    try {
      await browser.tabs.remove(tabId);
    } catch {
      /* tab already gone */
    }
  }
}

export async function syncJudge(
  judge: "codeforces" | "leetcode",
  handle?: string
): Promise<SyncResult> {
  try {
    return await withJudgeTab(judge, async (tabId) => {
      const res = await sendToTab<SyncResult>(tabId, { type: "DEEP_IMPORT", handle });
      return { ...res, judge };
    });
  } catch (err: any) {
    return { success: false, judge, error: err?.message ?? "Sync failed" };
  }
}

// Read the handle the user is CURRENTLY logged in as on the judge (extension-backed verification).
export async function whoamiJudge(
  judge: "codeforces" | "leetcode"
): Promise<WhoamiResult> {
  try {
    return await withJudgeTab(judge, async (tabId) => {
      return await sendToTab<WhoamiResult>(tabId, { type: "WHOAMI" });
    });
  } catch (err: any) {
    return { handle: null, signedIn: false, error: err?.message ?? "Failed to reach the judge" };
  }
}
