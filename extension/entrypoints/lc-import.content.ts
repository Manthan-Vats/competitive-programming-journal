import { defineContentScript } from "wxt/utils/define-content-script";
import { browser } from "wxt/browser";
import type { ContentMessage, SyncResult, WhoamiResult } from "../lib/messages";
import {
  lcEarliestAccepted,
  buildLcItem,
  type LcSubmissionRow,
  type LcEnrichment,
} from "../lib/deep/leetcode";
import { extractReadableText } from "../lib/parsers/mathjax";
import type { DeepImportItem } from "../lib/deep/types";
import {
  getExistingIds,
  postBatch,
  reportProgress,
  sleep,
  CHUNK,
  MAX_NEW_PER_RUN,
} from "../lib/deep/driver";

// LeetCode history fetcher. The BACKGROUND opens (or reuses) a leetcode.com tab and sends
// DEEP_IMPORT here. The session REST endpoint /api/submissions/ returns the FULL history WITH the
// code inline (same-origin -> cookies attach). We paginate it, keep the earliest accepted per
// problem, enrich number/title/difficulty/tags/statement via question(slug), and import. No user
// action - the extension opens the tab itself.

const PAGE_LIMIT = 20;
const MAX_PAGES = 400;
const PAGE_DELAY_MS = 300;
const ENRICH_DELAY_MS = 200;

const QUESTION_QUERY =
  "query q($titleSlug:String!){question(titleSlug:$titleSlug){" +
  "questionFrontendId title difficulty topicTags{name} content}}";

export default defineContentScript({
  matches: ["*://leetcode.com/*"],
  main() {
    browser.runtime.onMessage.addListener(
      (message: ContentMessage, _sender, sendResponse) => {
        if (message?.type === "WHOAMI") {
          whoami().then(sendResponse).catch(() => sendResponse({ handle: null, signedIn: false }));
          return true; // async
        }
        if (message?.type === "DEEP_IMPORT") {
          runLcImport()
            .then(sendResponse)
            .catch((err) =>
              sendResponse({
                success: false,
                judge: "leetcode",
                error: err?.message ?? String(err),
              } as SyncResult)
            );
          return true; // async
        }
      }
    );
  },
});

function csrfCookie(): string | null {
  const m = document.cookie.split("; ").find((c) => c.startsWith("csrftoken="));
  return m ? m.split("=")[1] : null;
}

// The logged-in LeetCode handle (extension-backed verification).
async function whoami(): Promise<WhoamiResult> {
  try {
    const res = await fetch("https://leetcode.com/graphql/", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "query{userStatus{isSignedIn username}}" }),
    });
    const u = (await res.json())?.data?.userStatus;
    return { handle: u?.username || null, signedIn: !!u?.isSignedIn };
  } catch {
    return { handle: null, signedIn: false };
  }
}

async function fetchPage(offset: number): Promise<{ rows: LcSubmissionRow[]; hasNext: boolean }> {
  const res = await fetch(
    `https://leetcode.com/api/submissions/?offset=${offset}&limit=${PAGE_LIMIT}`,
    { credentials: "include", headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw new Error(`/api/submissions HTTP ${res.status}`);
  const json = await res.json();
  const rows = Array.isArray(json?.submissions_dump) ? json.submissions_dump : [];
  return { rows, hasNext: !!json?.has_next };
}

async function fetchAll(): Promise<{ rows: LcSubmissionRow[]; capped: boolean }> {
  const rows: LcSubmissionRow[] = [];
  let offset = 0;
  let pages = 0;
  for (;;) {
    const { rows: page, hasNext } = await fetchPage(offset);
    rows.push(...page);
    pages++;
    if (!hasNext || page.length === 0) return { rows, capped: false };
    if (pages >= MAX_PAGES) return { rows, capped: true };
    offset += PAGE_LIMIT;
    await sleep(PAGE_DELAY_MS);
  }
}

async function enrich(slug: string, csrf: string | null): Promise<LcEnrichment | undefined> {
  try {
    const res = await fetch("https://leetcode.com/graphql/", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(csrf ? { "x-csrftoken": csrf } : {}) },
      body: JSON.stringify({ query: QUESTION_QUERY, variables: { titleSlug: slug } }),
    });
    if (!res.ok) return undefined;
    const q = (await res.json())?.data?.question;
    if (!q) return undefined;
    const tags = Array.isArray(q.topicTags)
      ? q.topicTags.map((t: { name?: string }) => t?.name).filter((n: unknown): n is string => !!n)
      : [];
    let statement: string | undefined;
    if (typeof q.content === "string" && q.content) {
      const div = document.createElement("div"); // detached -> inert (no script exec / img load)
      div.innerHTML = q.content;
      const text = extractReadableText(div);
      if (text) statement = text.slice(0, 4000);
    }
    return {
      frontendId: q.questionFrontendId ? String(q.questionFrontendId) : undefined,
      title: q.title || undefined,
      difficulty: q.difficulty || undefined,
      tags,
      statement,
    };
  } catch {
    return undefined;
  }
}

async function runLcImport(): Promise<SyncResult> {
  const csrf = csrfCookie();
  const existing = await getExistingIds();

  const { rows, capped: pageCapped } = await fetchAll();
  const accepted = lcEarliestAccepted(rows);
  const totalFound = accepted.length;

  const toImport = accepted.filter((r) => !existing.has(`lc:${r.id}`));
  const alreadyHad = totalFound - toImport.length;
  const overCap = toImport.length > MAX_NEW_PER_RUN;
  const batch = overCap ? toImport.slice(0, MAX_NEW_PER_RUN) : toImport;

  let problemsImported = 0;
  let solutionsImported = 0;
  let attempted = 0;

  for (let start = 0; start < batch.length; start += CHUNK) {
    const slice = batch.slice(start, start + CHUNK);
    const items: DeepImportItem[] = [];
    for (const row of slice) {
      const meta = row.title_slug ? await enrich(row.title_slug, csrf) : undefined;
      items.push(buildLcItem(row, meta));
      attempted++;
      await sleep(ENRICH_DELAY_MS);
    }
    const r = await postBatch(items);
    problemsImported += r.problems;
    solutionsImported += r.solutions;
    reportProgress("leetcode", attempted, batch.length, problemsImported, solutionsImported);
  }

  return {
    success: true,
    judge: "leetcode",
    totalFound,
    alreadyHad,
    attempted,
    problemsImported,
    solutionsImported,
    capped: pageCapped || overCap,
  };
}
