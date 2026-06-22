import { browser } from "wxt/browser";
import type { DeepImportItem } from "./types";
import type { ExistingIdsResult, ImportBatchResult } from "../messages";

// Shared helpers for the judge fetcher content scripts. They run on the judge ORIGIN (so
// credentialed fetches carry the session cookies - a background SW fetch does not reliably do so),
// gather items, and push them through here; the background does the authenticated /api/ext/import
// I/O (the bearer token never leaves the background). The shaping fed in IS unit-tested
// (deep/codeforces.ts, deep/leetcode.ts).

// POST batch size. /api/ext/import is rate-limited to 10 POSTs/hour/user, so keep chunks large
// enough that even MAX_NEW_PER_RUN problems stays well under that cap (2000 / 250 = 8 POSTs).
export const CHUNK = 250;

// Hard cap on NEW problems fetched per run (bounds time; CF fetches one submitSource each).
// Re-syncing resumes - already-imported submissions are skipped via the existing-ids set.
export const MAX_NEW_PER_RUN = 2000;

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function getExistingIds(): Promise<Set<string>> {
  const res = (await browser.runtime.sendMessage({
    type: "IMPORT_EXISTING_IDS",
  })) as ExistingIdsResult;
  if (res?.error) throw new Error(res.error);
  return new Set(res?.ids ?? []);
}

// POST one chunk of items to /api/ext/import (via the background) and return the imported counts.
export async function postBatch(
  items: DeepImportItem[]
): Promise<{ problems: number; solutions: number }> {
  if (items.length === 0) return { problems: 0, solutions: 0 };
  const res = (await browser.runtime.sendMessage({
    type: "IMPORT_BATCH",
    items,
  })) as ImportBatchResult;
  if (res?.error) throw new Error(res.error);
  return {
    problems: res?.problems?.imported ?? 0,
    solutions: res?.solutions?.imported ?? 0,
  };
}

// Best-effort progress tick -> background relays it to the web-app tab.
export function reportProgress(
  judge: "codeforces" | "leetcode",
  attempted: number,
  total: number,
  problemsImported: number,
  solutionsImported: number
): void {
  browser.runtime
    .sendMessage({ type: "SYNC_PROGRESS", judge, attempted, total, problemsImported, solutionsImported })
    .catch(() => {});
}

// Run `worker` over `items` with bounded concurrency (keeps CF submitSource polite but faster than
// strictly sequential). Order-agnostic.
export async function mapPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let i = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await worker(items[idx]);
    }
  });
  await Promise.all(runners);
}
