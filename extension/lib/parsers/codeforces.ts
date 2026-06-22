import type { CapturePayload } from "../messages";
import type { JudgeParser } from "./types";
import { extractReadableText, latexToReadable } from "./mathjax";

// Extract a readable statement from a FETCHED Codeforces problem-page HTML string (used by the
// history sync, which scrapes the page rather than reading a live, MathJax-rendered DOM). On the
// raw server HTML, MathJax has NOT run - math is inline as Codeforces `$$$...$$$` LaTeX - so after
// the same block-aware `extractReadableText` we convert those delimiters with the SAME
// `latexToReadable` the live-capture path uses, giving byte-for-byte consistent formatting.
export function extractCfStatementFromHtml(html: string): string | undefined {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(html, "text/html");
  } catch {
    return undefined;
  }
  const root = doc.querySelector(".problem-statement");
  if (!root) return undefined;

  const clone = root.cloneNode(true) as Element;
  clone.querySelectorAll(".header, .sample-tests, .sample-test").forEach((el) => el.remove());

  let text = extractReadableText(clone);
  // Codeforces wraps math in runs of 3+ dollar signs; convert each to readable Unicode.
  text = text.replace(/\${3,}([\s\S]*?)\${3,}/g, (_m, tex: string) => latexToReadable(tex));
  text = text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line, i, arr) => line !== "" || (i > 0 && arr[i - 1] !== ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text ? text.slice(0, 4000) : undefined; // 4000 cap matches the live-capture parser
}

// Codeforces problem-page URL shapes we recognize. Group 1 = contest/gym id,
// group 2 = problem index (e.g. "A", "B2", "F1"). Ordered most- to least-specific so
// the /group/.../contest/... form isn't shadowed by the bare /contest/... form.
const URL_PATTERNS: RegExp[] = [
  /\/group\/[^/]+\/contest\/(\d+)\/problem\/([A-Za-z]\d*)/,
  /\/contest\/(\d+)\/problem\/([A-Za-z]\d*)/,
  /\/problemset\/problem\/(\d+)\/([A-Za-z]\d*)/,
  /\/gym\/(\d+)\/problem\/([A-Za-z]\d*)/,
];

function parseId(pathname: string): { contestId: string; index: string } | null {
  for (const re of URL_PATTERNS) {
    const m = re.exec(pathname);
    if (m) return { contestId: m[1], index: m[2].toUpperCase() };
  }
  return null;
}

export const codeforcesParser: JudgeParser = {
  platform: "codeforces",

  matches(url) {
    return (
      /(^|\.)codeforces\.com$/.test(url.hostname) && parseId(url.pathname) !== null
    );
  },

  parse(doc, url) {
    const ids = parseId(url.pathname);
    if (!ids) return null;

    // Canonical URL = origin + pathname (drop query/hash) so the per-user URL dedupe in
    // /api/ext/capture is stable across "?locale=en" and trailing-slash variants.
    const canonicalUrl = `${url.origin}${url.pathname}`.replace(/\/$/, "");

    const stmtRoot = doc.querySelector(".problem-statement");

    // Verified selector (matches Competitive Companion's CF parser): the
    // ".problem-statement .title" node renders like "A. Theatre Square". Fall back to the
    // document title if the statement markup isn't present.
    const titleEl = stmtRoot?.querySelector(".title");
    const title = (titleEl?.textContent || doc.title || "").trim();
    if (!title) return null;

    const metadata: Record<string, unknown> = {};
    let statement: string | undefined;

    if (stmtRoot) {
      // Time / memory limits live in the header; strip the descriptive label text.
      const tl = stmtRoot
        .querySelector(".time-limit")
        ?.textContent?.replace(/time limit per test/i, "")
        .trim();
      const ml = stmtRoot
        .querySelector(".memory-limit")
        ?.textContent?.replace(/memory limit per test/i, "")
        .trim();
      if (tl) metadata.timeLimit = tl;
      if (ml) metadata.memoryLimit = ml;

      // Statement text for the at-a-glance view: clone, drop the header (title/limits we
      // already captured) and the bulky sample-test blocks, then extract readable text.
      // extractReadableText de-duplicates MathJax's triple rendering and converts the
      // LaTeX source to readable Unicode (the raw textContent is garbled otherwise).
      const clone = stmtRoot.cloneNode(true) as HTMLElement;
      clone.querySelectorAll(".header, .sample-tests").forEach((el) => el.remove());
      const text = extractReadableText(clone);
      if (text) statement = text.slice(0, 4000);
    }

    return {
      url: canonicalUrl,
      title,
      platform: "codeforces",
      platform_id: `${ids.contestId}${ids.index}`,
      statement,
      metadata,
    };
  },
};
