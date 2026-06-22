import { randomBytes } from "crypto";

// Handle verification (P3). Profile-token method: the user temporarily puts a one-time token in
// an EDITABLE PUBLIC profile field; we fetch the PUBLIC profile server-side and confirm it, then
// snapshot stats PULLED from the platform (never typed - audit D2). Pure helpers here are
// unit-tested; the network fetchers are exercised live by the route.

export const VERIFY_PLATFORMS = ["codeforces", "leetcode", "github"] as const;
export type VerifyPlatform = (typeof VERIFY_PLATFORMS)[number];

export function isVerifyPlatform(v: unknown): v is VerifyPlatform {
  return typeof v === "string" && (VERIFY_PLATFORMS as readonly string[]).includes(v);
}

// A short, human-typeable one-time token (e.g. "cpjv-1a2b3c4d").
export function generateVerifyToken(): string {
  return `cpjv-${randomBytes(4).toString("hex")}`;
}

// Case-insensitive: does any of the editable profile fields contain the token?
export function tokenIn(fields: (string | null | undefined)[], token: string): boolean {
  const t = token.trim().toLowerCase();
  if (!t) return false;
  return fields.some((f) => typeof f === "string" && f.toLowerCase().includes(t));
}

// Where to paste the token, per platform.
export function placementHint(platform: VerifyPlatform): string {
  switch (platform) {
    case "codeforces":
      return 'Codeforces -> Settings -> Social: put this in your "First name" or "Organization", Save, then Check.';
    case "leetcode":
      return "LeetCode -> Edit Profile -> Summary: paste this in, Save, then Check.";
    case "github":
      return "GitHub -> Edit profile -> Bio: paste this in, Save, then Check.";
  }
}

//  pure stat shapers (raw API json -> snapshot)
export type VerifyStats = Record<string, number | string | undefined>;

export function shapeCfStats(info: any, solved: number | null): VerifyStats {
  return {
    solved: typeof solved === "number" ? solved : undefined,
    rating: typeof info?.rating === "number" ? info.rating : undefined,
    maxRating: typeof info?.maxRating === "number" ? info.maxRating : undefined,
    rank: typeof info?.rank === "string" ? info.rank : undefined,
    maxRank: typeof info?.maxRank === "string" ? info.maxRank : undefined,
  };
}

export function shapeLcStats(matched: any): VerifyStats {
  const arr = Array.isArray(matched?.submitStatsGlobal?.acSubmissionNum)
    ? matched.submitStatsGlobal.acSubmissionNum
    : [];
  const byDiff: Record<string, number> = {};
  for (const e of arr) {
    if (e?.difficulty) byDiff[String(e.difficulty).toLowerCase()] = Number(e.count) || 0;
  }
  return {
    solved: byDiff["all"],
    easy: byDiff["easy"],
    medium: byDiff["medium"],
    hard: byDiff["hard"],
    ranking: typeof matched?.profile?.ranking === "number" ? matched.profile.ranking : undefined,
  };
}

export function shapeGithubStats(u: any): VerifyStats {
  return {
    publicRepos: typeof u?.public_repos === "number" ? u.public_repos : undefined,
    followers: typeof u?.followers === "number" ? u.followers : undefined,
  };
}

// Count distinct accepted Codeforces problems from a user.status result.
export function countCfSolved(statusResult: any[]): number {
  const set = new Set<string>();
  for (const s of Array.isArray(statusResult) ? statusResult : []) {
    if (s?.verdict === "OK" && s?.problem?.contestId != null && s?.problem?.index) {
      set.add(`${s.problem.contestId}-${String(s.problem.index).toUpperCase()}`);
    }
  }
  return set.size;
}

//  live profile fetchers (server-side, anonymous)
const TIMEOUT_MS = 12000;

async function fetchJson(url: string, init?: RequestInit): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export interface ProfileProbe {
  fields: (string | null | undefined)[]; // editable fields the token could be in
  stats: VerifyStats;
  source: string;
}

export async function fetchProfileForVerify(
  platform: VerifyPlatform,
  handle: string
): Promise<ProfileProbe | { error: string }> {
  const h = handle.trim();
  if (!h) return { error: "Handle is required" };
  try {
    if (platform === "codeforces") {
      const info = await fetchJson(
        `https://codeforces.com/api/user.info?handles=${encodeURIComponent(h)}`
      );
      const u = info?.result?.[0];
      if (info?.status !== "OK" || !u) return { error: "Codeforces handle not found" };
      let solved: number | null = null;
      try {
        const st = await fetchJson(
          `https://codeforces.com/api/user.status?handle=${encodeURIComponent(h)}`
        );
        if (st?.status === "OK") solved = countCfSolved(st.result);
      } catch {
        /* solved stays null - non-fatal */
      }
      return {
        fields: [u.firstName, u.lastName, u.organization],
        stats: shapeCfStats(u, solved),
        source: "codeforces:user.info+user.status",
      };
    }

    if (platform === "leetcode") {
      const query =
        "query u($u:String!){matchedUser(username:$u){username profile{realName aboutMe ranking} submitStatsGlobal{acSubmissionNum{difficulty count}}}}";
      const json = await fetchJson("https://leetcode.com/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json", Referer: "https://leetcode.com" },
        body: JSON.stringify({ query, variables: { u: h } }),
      });
      const m = json?.data?.matchedUser;
      if (!m) return { error: "LeetCode user not found" };
      return {
        fields: [m.profile?.realName, m.profile?.aboutMe],
        stats: shapeLcStats(m),
        source: "leetcode:matchedUser",
      };
    }

    // github
    const u = await fetchJson(`https://api.github.com/users/${encodeURIComponent(h)}`, {
      headers: { "User-Agent": "cp-journal", Accept: "application/vnd.github+json" },
    });
    if (!u || !u.login) return { error: "GitHub user not found" };
    return { fields: [u.bio, u.name], stats: shapeGithubStats(u), source: "github:users" };
  } catch (err: any) {
    return { error: `Could not reach ${platform} (${err?.message || "network error"})` };
  }
}

// The headline metric for a shields.io badge, per platform.
export function badgeMessage(platform: VerifyPlatform, stats: VerifyStats): string {
  if (platform === "codeforces") {
    const r = stats.rating;
    const solved = stats.solved;
    if (typeof r === "number") return solved ? `${r} · ${solved} solved` : String(r);
    return solved ? `${solved} solved` : "verified";
  }
  if (platform === "leetcode") {
    return typeof stats.solved === "number" ? `${stats.solved} solved` : "verified";
  }
  return typeof stats.publicRepos === "number" ? `${stats.publicRepos} repos` : "verified";
}
