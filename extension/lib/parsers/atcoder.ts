import type { JudgeParser } from "./types";
import { extractReadableText } from "./mathjax";

// AtCoder is server-rendered, so we parse the live DOM. Problem URLs look like
// atcoder.jp/contests/<contest>/tasks/<task>. The statement lives in #task-statement with
// bilingual `.lang-en` / `.lang-ja` sections - we prefer English. Time/memory limits are
// printed as "Time Limit: 2 sec / Memory Limit: 1024 MiB". AtCoder has no on-page tags or
// official difficulty (the community API is access-restricted), so those stay empty.

function taskFromPath(pathname: string): { contest: string; task: string } | null {
  const m = /\/contests\/([^/]+)\/tasks\/([^/?#]+)/.exec(pathname);
  return m ? { contest: m[1], task: m[2] } : null;
}

export const atcoderParser: JudgeParser = {
  platform: "atcoder",

  matches(url) {
    return /(^|\.)atcoder\.jp$/.test(url.hostname) && taskFromPath(url.pathname) !== null;
  },

  parse(doc, url) {
    const ids = taskFromPath(url.pathname);
    if (!ids) return null;
    const canonicalUrl = `${url.origin}${url.pathname}`.replace(/\/$/, "");

    const title = (doc.title || doc.querySelector("span.h2")?.textContent || "")
      .replace(/\s*-\s*AtCoder.*$/i, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!title) return null;

    // Bound each value to its number+unit token so trailing text (no reliable
    // whitespace after the limits line) can't bleed into the capture.
    const metadata: Record<string, unknown> = {};
    const bodyText = doc.body?.textContent || "";
    const tl = /Time Limit:\s*([\d.]+\s*(?:msec|ms|sec|s))/i.exec(bodyText);
    const ml = /Memory Limit:\s*([\d.]+\s*[KMG]i?B)/i.exec(bodyText);
    if (tl) metadata.timeLimit = tl[1].replace(/\s+/g, " ").trim();
    if (ml) metadata.memoryLimit = ml[1].replace(/\s+/g, " ").trim();

    // Prefer the English statement section; fall back to the whole statement block.
    const root =
      (doc.querySelector("#task-statement .lang-en") as HTMLElement | null) ||
      (doc.querySelector("#task-statement") as HTMLElement | null);
    let statement: string | undefined;
    if (root) {
      const text = extractReadableText(root.cloneNode(true) as HTMLElement);
      if (text) statement = text.slice(0, 4000);
    }

    return {
      url: canonicalUrl,
      title,
      platform: "atcoder",
      platform_id: ids.task,
      statement,
      metadata,
    };
  },
};
