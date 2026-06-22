import type { JudgeParser } from "./types";
import { extractReadableText } from "./mathjax";

// CodeChef is a React SPA, so we use its public JSON API (verified anonymous):
// /api/contests/<CONTEST>/problems/<CODE> -> { status, problem_name, problem_code, body
// (HTML), category_name, ... }. Practice problems use the contest code "PRACTICE". The
// content script runs on codechef.com so this fetch is same-origin (carries the session).

const DIFF: Record<string, string> = {
  school: "easy",
  beginner: "easy",
  easy: "easy",
  medium: "medium",
  hard: "hard",
  harder: "hard",
  hardest: "expert",
  challenge: "expert",
};

function locate(pathname: string): { contest: string; code: string } | null {
  let m = /^\/([^/]+)\/problems\/([^/?#]+)/.exec(pathname);
  if (m) return { contest: m[1], code: m[2] };
  m = /^\/problems\/([^/?#]+)/.exec(pathname);
  if (m) return { contest: "PRACTICE", code: m[1] };
  return null;
}

interface CcResp {
  status?: string;
  problem_name?: string;
  problem_code?: string;
  body?: string;
  category_name?: string;
  difficulty_rating?: number;
  tags?: unknown;
}

export const codechefParser: JudgeParser = {
  platform: "codechef",

  matches(url) {
    return /(^|\.)codechef\.com$/.test(url.hostname) && locate(url.pathname) !== null;
  },

  async parse(doc, url) {
    const loc = locate(url.pathname);
    if (!loc) return null;
    const canonicalUrl = `${url.origin}${url.pathname}`.replace(/\/$/, "");

    let data: CcResp | null = null;
    try {
      const res = await fetch(
        `${url.origin}/api/contests/${encodeURIComponent(loc.contest)}/problems/${encodeURIComponent(loc.code)}`,
        { headers: { Accept: "application/json" }, credentials: "include" }
      );
      if (res.ok) {
        const j = await res.json();
        if (j?.status === "success") data = j;
      }
    } catch {
      data = null;
    }

    const domTitle = doc.title
      .replace(/\s*\|\s*CodeChef.*$/i, "")
      .replace(/\s+Practice.*$/i, "")
      .trim();

    if (!data) {
      const title = domTitle || loc.code;
      if (!title) return null;
      return { url: canonicalUrl, title, platform: "codechef", platform_id: loc.code };
    }

    let statement: string | undefined;
    if (typeof data.body === "string" && data.body) {
      const div = doc.createElement("div");
      div.innerHTML = data.body; // inert: detached, no script exec / image load
      const text = extractReadableText(div);
      if (text) statement = text.slice(0, 4000);
    }

    const cat = (data.category_name || "").toLowerCase();
    const tags = Array.isArray(data.tags)
      ? (data.tags as unknown[])
          .map((t) => (typeof t === "string" ? t : (t as { tag?: string })?.tag))
          .filter((x): x is string => !!x)
      : [];

    return {
      url: canonicalUrl,
      title: data.problem_name || domTitle || loc.code,
      platform: "codechef",
      platform_id: data.problem_code || loc.code,
      difficulty_raw:
        typeof data.difficulty_rating === "number"
          ? String(data.difficulty_rating)
          : cat || undefined,
      difficulty_norm: DIFF[cat] || "unknown",
      source_tags: tags,
      statement,
      metadata: {},
    };
  },
};
