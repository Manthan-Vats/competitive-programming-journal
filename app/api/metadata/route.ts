import { NextRequest, NextResponse } from "next/server";
import { Platform, DifficultyNorm } from "@/types";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { cfRatingToDifficulty, lcDifficultyToNorm } from "@/lib/difficulty";

// CodeChef category_name -> our normalized difficulty (mirrors the extension parser).
const CC_DIFF: Record<string, string> = {
  school: "easy",
  beginner: "easy",
  easy: "easy",
  medium: "medium",
  hard: "hard",
  harder: "hard",
  hardest: "expert",
  challenge: "expert",
};

export async function GET(request: NextRequest) {
  // Require auth (P1-4): this endpoint fans out to external judge APIs, so an unauthenticated
  // caller could use it as a request amplifier / SSRF-ish proxy. It's only ever called from
  // the (authenticated) manual-add page.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  // Per-user throttle on the outbound fan-out (fires on every URL paste).
  if (!(await rateLimit(`metadata:${user.id}`, 60, 60))) {
    return NextResponse.json(
      { success: false, error: "Too many lookups. Please slow down." },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json(
      { success: false, error: "Missing URL parameter" },
      { status: 400 }
    );
  }

  try {
    // 1. Detect platform and parse details
    let platform: Platform = "other";
    let slug = "";
    let contestId = "";
    let index = "";
    let ccContest = "";

    // Codeforces Contest or Problemset
    const cfMatch = url.match(/codeforces\.com\/(contest|problemset\/problem)\/(\d+)\/([A-Z]\d*)/i);
    // Leetcode problems
    const lcMatch = url.match(/leetcode\.com\/problems\/([a-z0-9-]+)/i);
    // Atcoder
    const acMatch = url.match(/atcoder\.jp\/contests\/([^/]+)\/tasks\/([^/?]+)/i);
    // CSES
    const csesMatch = url.match(/cses\.fi\/problemset\/task\/(\d+)/i);
    // SPOJ
    const spojMatch = url.match(/spoj\.com\/problems\/([a-z0-9]+)/i);
    // HackerRank
    const hrMatch = url.match(/hackerrank\.com\/challenges\/([a-z0-9-]+)/i);
    // Codechef - optional contest segment, then problems/<CODE>. Practice problems
    // (/problems/<CODE>) use the contest code "PRACTICE" for the API.
    const ccMatch = url.match(/codechef\.com\/(?:([^/]+)\/)?problems\/([^/?#]+)/i);

    if (cfMatch) {
      platform = "codeforces";
      contestId = cfMatch[2];
      index = cfMatch[3].toUpperCase();
    } else if (lcMatch) {
      platform = "leetcode";
      slug = lcMatch[1];
    } else if (acMatch) {
      platform = "atcoder";
      slug = acMatch[2]; // e.g., abc300_a
    } else if (csesMatch) {
      platform = "cses";
      slug = csesMatch[1];
    } else if (spojMatch) {
      platform = "spoj";
      slug = spojMatch[1].toUpperCase();
    } else if (hrMatch) {
      platform = "hackerrank";
      slug = hrMatch[1];
    } else if (ccMatch) {
      platform = "codechef";
      ccContest = ccMatch[1] || "PRACTICE";
      slug = ccMatch[2];
    }

    // Default metadata response structure
    let title = "";
    let difficulty_raw: string | null = null;
    let difficulty_norm: DifficultyNorm = "unknown";
    let source_tags: string[] = [];
    let manual_required = false;

    if (platform === "codeforces") {
      // Fetch Codeforces problem set
      const cfRes = await fetch("https://codeforces.com/api/problemset.problems", {
        next: { revalidate: 3600 },
      });
      const data = await cfRes.json();
      if (data.status === "OK" && data.result?.problems) {
        const problemObj = data.result.problems.find(
          (p: any) =>
            p.contestId.toString() === contestId &&
            p.index.toUpperCase() === index
        );
        if (problemObj) {
          title = `${problemObj.index}. ${problemObj.name}`;
          if (problemObj.rating) {
            difficulty_raw = problemObj.rating.toString();
            difficulty_norm = cfRatingToDifficulty(problemObj.rating) as DifficultyNorm;
          }
          source_tags = problemObj.tags || [];
        } else {
          title = `${index} (Contest ${contestId})`;
          manual_required = true;
        }
      } else {
        manual_required = true;
      }
    } else if (platform === "leetcode") {
      // POST to LeetCode GraphQL
      const lcRes = await fetch("https://leetcode.com/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            query getQuestionDetail($titleSlug: String!) {
              question(titleSlug: $titleSlug) {
                title
                difficulty
                topicTags {
                  name
                }
              }
            }
          `,
          variables: { titleSlug: slug },
        }),
      });
      const resJson = await lcRes.json();
      const question = resJson?.data?.question;
      if (question) {
        title = question.title;
        difficulty_raw = question.difficulty;
        difficulty_norm = lcDifficultyToNorm(question.difficulty) as DifficultyNorm;
        source_tags = question.topicTags?.map((t: any) => t.name) || [];
      } else {
        manual_required = true;
      }
    } else if (platform === "atcoder") {
      // Fetch Kenkoooo merged problems list
      const acRes = await fetch(
        "https://kenkoooo.com/atcoder/resources/merged-problems.json",
        { next: { revalidate: 86400 } } // Cache for 24h
      );
      const problemsList = await acRes.json();
      const problemObj = problemsList.find((p: any) => p.id === slug);
      if (problemObj) {
        title = problemObj.title || slug;
        if (problemObj.difficulty !== undefined) {
          difficulty_raw = problemObj.difficulty.toString();
          const rating = problemObj.difficulty;
          // AtCoder difficulty rating estimates: easy < 800, medium < 1600, hard < 2400, expert >= 2400
          if (rating < 800) difficulty_norm = "easy";
          else if (rating < 1600) difficulty_norm = "medium";
          else if (rating < 2400) difficulty_norm = "hard";
          else difficulty_norm = "expert";
        }
      } else {
        title = slug;
        manual_required = true;
      }
    } else if (platform === "cses") {
      // Simple HTML Scrape for title
      const csesRes = await fetch(`https://cses.fi/problemset/task/${slug}`);
      const html = await csesRes.text();
      const match = html.match(/<title>CSES - (.*?)<\/title>/);
      if (match) {
        title = match[1];
      } else {
        title = `Task ${slug}`;
      }
      difficulty_norm = "unknown";
    } else if (platform === "spoj") {
      // Simple HTML Scrape for title
      const spojRes = await fetch(`https://www.spoj.com/problems/${slug}/`);
      const html = await spojRes.text();
      const match = html.match(/<h2 id="problem-name" class="text-center">(.*?)<\/h2>/);
      if (match) {
        title = match[1].trim();
      } else {
        const titleMatch = html.match(/<title>SPOJ.com - Problem (.*?)<\/title>/);
        title = titleMatch ? titleMatch[1].trim() : slug;
      }
    } else if (platform === "codechef") {
      // CodeChef public JSON API (verified anonymous), same endpoint the extension parser
      // uses: /api/contests/<CONTEST>/problems/<CODE>. The dead branch before this fix meant
      // CodeChef URLs never resolved (parsed -> never fetched). Send a browser-ish UA since
      // CodeChef sits behind Cloudflare; degrade to manual on any non-success.
      try {
        const ccRes = await fetch(
          `https://www.codechef.com/api/contests/${encodeURIComponent(
            ccContest
          )}/problems/${encodeURIComponent(slug)}`,
          {
            headers: {
              Accept: "application/json",
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
            },
            next: { revalidate: 3600 },
          }
        );
        const data = ccRes.ok ? await ccRes.json() : null;
        if (data?.status === "success") {
          title = data.problem_name || slug;
          const cat = (data.category_name || "").toLowerCase();
          difficulty_raw =
            typeof data.difficulty_rating === "number"
              ? String(data.difficulty_rating)
              : cat || null;
          difficulty_norm = (CC_DIFF[cat] || "unknown") as DifficultyNorm;
          source_tags = Array.isArray(data.tags)
            ? (data.tags as unknown[])
                .map((t) => (typeof t === "string" ? t : (t as { tag?: string })?.tag))
                .filter((x): x is string => !!x)
            : [];
        } else {
          title = slug;
          manual_required = true;
        }
      } catch {
        title = slug;
        manual_required = true;
      }
    } else {
      manual_required = true;
    }

    return NextResponse.json({
      success: true,
      platform,
      title: title || "",
      difficulty_raw,
      difficulty_norm,
      source_tags,
      manual_required,
    });
  } catch (err) {
    console.error("[metadata.GET]", err instanceof Error ? err.message : err);
    return NextResponse.json({
      success: false,
      platform: "other",
      title: "",
      difficulty_raw: null,
      difficulty_norm: "unknown",
      source_tags: [],
      manual_required: true,
      error: "Could not auto-fill metadata. Please enter details manually.",
    });
  }
}
