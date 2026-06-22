import { defineContentScript } from "wxt/utils/define-content-script";
import { browser } from "wxt/browser";
import type { ContentMessage, SyncResult, WhoamiResult } from "../lib/messages";
import {
  cfEarliestAccepted,
  buildCfItem,
  type CfSubmission,
  type CfAccepted,
} from "../lib/deep/codeforces";
import { extractCfStatementFromHtml } from "../lib/parsers/codeforces";
import type { DeepImportItem } from "../lib/deep/types";
import {
  getExistingIds,
  postBatch,
  reportProgress,
  mapPool,
  CHUNK,
  MAX_NEW_PER_RUN,
} from "../lib/deep/driver";

// Codeforces history fetcher. The BACKGROUND opens (or reuses) a codeforces.com tab and sends
// DEEP_IMPORT here - this content script runs on the judge ORIGIN, so its fetches carry the user's
// session cookies (CF submitSource is session-gated). The submission source is the only gated bit;
// ids/verdict/lang/time/memory/date come from the anon user.status. Items route back through the
// background to /api/ext/import. The user never has to open Codeforces - the extension does it.

const CF_CONCURRENCY = 3; // parallel problems; each does source + statement fetch - keep polite

export default defineContentScript({
  matches: ["*://codeforces.com/*", "*://*.codeforces.com/*"],
  main() {
    browser.runtime.onMessage.addListener(
      (message: ContentMessage, _sender, sendResponse) => {
        if (message?.type === "WHOAMI") {
          const handle = findHandle();
          sendResponse({ handle, signedIn: !!handle } as WhoamiResult);
          return true;
        }
        if (message?.type === "DEEP_IMPORT") {
          runCfImport(message.handle)
            .then(sendResponse)
            .catch((err) =>
              sendResponse({
                success: false,
                judge: "codeforces",
                error: err?.message ?? String(err),
              } as SyncResult)
            );
          return true; // async
        }
      }
    );
  },
});

function findHandle(): string | null {
  const el = document.querySelector('#header a[href^="/profile/"]') as HTMLAnchorElement | null;
  return el?.textContent?.trim() || null;
}

function findCsrf(): string | null {
  return (
    document.querySelector('meta[name="X-Csrf-Token"]')?.getAttribute("content") ||
    (document.querySelector('input[name="csrf_token"]') as HTMLInputElement | null)?.value ||
    document.querySelector(".csrf-token")?.getAttribute("data-csrf") ||
    null
  );
}

async function fetchUserStatus(handle: string): Promise<CfSubmission[]> {
  const res = await fetch(
    `https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}`,
    { credentials: "include" }
  );
  if (!res.ok) throw new Error(`user.status HTTP ${res.status}`);
  const json = await res.json();
  if (json?.status !== "OK" || !Array.isArray(json.result)) {
    throw new Error(json?.comment || "Codeforces returned an unexpected response.");
  }
  return json.result as CfSubmission[];
}

async function fetchSource(submissionId: number, csrf: string): Promise<string | null> {
  try {
    const res = await fetch("https://codeforces.com/data/submitSource", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Csrf-Token": csrf },
      body: `submissionId=${submissionId}&csrf_token=${encodeURIComponent(csrf)}`,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.source === "string" ? data.source : null;
  } catch {
    return null; // unreadable submission -> problem imported without code
  }
}

// Scrape the problem page for a readable statement (CF has no statement API). Same-origin, so the
// page loads normally; best-effort - a miss just leaves the problem statement-less. Mirrors the
// live-capture parser's formatting via extractCfStatementFromHtml.
async function fetchStatement(contestId: number, index: string): Promise<string | undefined> {
  try {
    const res = await fetch(
      `https://codeforces.com/contest/${contestId}/problem/${index}`,
      { credentials: "include" }
    );
    if (!res.ok) return undefined;
    return extractCfStatementFromHtml(await res.text());
  } catch {
    return undefined;
  }
}

async function runCfImport(passedHandle?: string): Promise<SyncResult> {
  const handle = (passedHandle && passedHandle.trim()) || findHandle();
  if (!handle) {
    return {
      success: false,
      judge: "codeforces",
      error: "Couldn't determine your Codeforces handle - save it in Settings, or log in on Codeforces.",
    };
  }
  const csrf = findCsrf();
  if (!csrf) {
    return {
      success: false,
      judge: "codeforces",
      error: "Couldn't read your Codeforces session - make sure you're logged in on Codeforces.",
    };
  }

  const existing = await getExistingIds();
  const accepted = cfEarliestAccepted(await fetchUserStatus(handle));
  const totalFound = accepted.length;

  const toFetch = accepted.filter((a) => !existing.has(`cf:${a.sub.id}`));
  const alreadyHad = totalFound - toFetch.length;
  const capped = toFetch.length > MAX_NEW_PER_RUN;
  const batch = capped ? toFetch.slice(0, MAX_NEW_PER_RUN) : toFetch;

  let problemsImported = 0;
  let solutionsImported = 0;
  let attempted = 0;

  // Process in CHUNK slices; within each slice fetch source with bounded concurrency, then POST the
  // chunk (incremental -> resumable if the tab closes; re-sync skips what's already imported).
  for (let start = 0; start < batch.length; start += CHUNK) {
    const slice = batch.slice(start, start + CHUNK);
    const items: DeepImportItem[] = [];
    await mapPool(slice, CF_CONCURRENCY, async (acc: CfAccepted) => {
      // Source (session-gated) + statement (page scrape) in parallel per problem.
      const [source, statement] = await Promise.all([
        fetchSource(acc.sub.id as number, csrf),
        fetchStatement(acc.contestId, acc.index),
      ]);
      const item = buildCfItem(acc, source);
      if (statement) item.problem.statement = statement;
      items.push(item);
      attempted++;
    });
    const r = await postBatch(items);
    problemsImported += r.problems;
    solutionsImported += r.solutions;
    reportProgress("codeforces", attempted, batch.length, problemsImported, solutionsImported);
  }

  return {
    success: true,
    judge: "codeforces",
    totalFound,
    alreadyHad,
    attempted,
    problemsImported,
    solutionsImported,
    capped,
  };
}
