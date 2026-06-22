import type { CapturePayload } from "../messages";
import type { JudgeParser } from "./types";
import { extractReadableText } from "./mathjax";

// LeetCode is a React SPA, so the page DOM is unreliable for metadata. The authoritative
// source is the same-origin GraphQL endpoint (verified: the `question` query returns
// questionFrontendId/title/difficulty/topicTags/content anonymously for free problems).
// The content script runs on leetcode.com, so this fetch is same-origin and carries the
// user's session (covers premium too). Falls back to the DOM title if GraphQL fails.

const DIFF: Record<string, string> = { Easy: "easy", Medium: "medium", Hard: "hard" };

const QUERY =
  "query q($titleSlug:String!){question(titleSlug:$titleSlug){" +
  "questionFrontendId title titleSlug difficulty isPaidOnly topicTags{name} content}}";

function slugFromPath(pathname: string): string | null {
  const m = /\/problems\/([^/]+)/.exec(pathname);
  return m ? m[1] : null;
}

interface LcQuestion {
  questionFrontendId?: string;
  title?: string;
  difficulty?: string;
  isPaidOnly?: boolean;
  topicTags?: { name?: string }[];
  content?: string;
}

export const leetcodeParser: JudgeParser = {
  platform: "leetcode",

  matches(url) {
    return /(^|\.)leetcode\.com$/.test(url.hostname) && slugFromPath(url.pathname) !== null;
  },

  async parse(doc, url) {
    const slug = slugFromPath(url.pathname);
    if (!slug) return null;
    const canonicalUrl = `${url.origin}/problems/${slug}`;

    let q: LcQuestion | null = null;
    try {
      const res = await fetch(`${url.origin}/graphql`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ query: QUERY, variables: { titleSlug: slug } }),
      });
      if (res.ok) {
        const json = await res.json();
        q = json?.data?.question ?? null;
      }
    } catch {
      q = null;
    }

    // DOM fallback title (used if GraphQL is unavailable).
    const domTitle = (
      doc.querySelector('[data-cy="question-title"]')?.textContent ||
      doc.title.replace(/\s*-\s*LeetCode.*$/i, "")
    ).trim();

    if (!q) {
      const title = domTitle || slug;
      if (!title) return null;
      return { url: canonicalUrl, title, platform: "leetcode" };
    }

    const metadata: Record<string, unknown> = {};
    if (q.isPaidOnly) metadata.paidOnly = true;

    let statement: string | undefined;
    if (typeof q.content === "string" && q.content) {
      // Build a detached element from the HTML content (inert: not attached to the
      // document, so scripts don't run and images don't load) and extract readable text.
      const div = doc.createElement("div");
      div.innerHTML = q.content;
      const text = extractReadableText(div);
      if (text) statement = text.slice(0, 4000);
    }

    const title = q.questionFrontendId
      ? `${q.questionFrontendId}. ${q.title ?? domTitle ?? slug}`
      : q.title || domTitle || slug;
    const tags = Array.isArray(q.topicTags)
      ? q.topicTags.map((t) => t.name).filter((n): n is string => !!n)
      : [];

    return {
      url: canonicalUrl,
      title,
      platform: "leetcode",
      platform_id: q.questionFrontendId ? String(q.questionFrontendId) : undefined,
      difficulty_raw: q.difficulty || undefined,
      difficulty_norm: q.difficulty ? DIFF[q.difficulty] || "unknown" : undefined,
      source_tags: tags,
      statement,
      metadata,
    };
  },
};
