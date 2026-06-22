import {
  generateVerifyToken,
  tokenIn,
  isVerifyPlatform,
  placementHint,
  shapeCfStats,
  shapeLcStats,
  shapeGithubStats,
  countCfSolved,
  badgeMessage,
} from "../lib/verify";

// Unit tests for the verification helpers (P3), built from REAL captured API responses
// (codeforces user.info for "tourist", leetcode matchedUser for "lee215"). Run:
//   npx tsx test/verify.test.ts

let passed = 0;
function check(name: string, cond: boolean, got?: unknown) {
  if (!cond) {
    console.error("FAIL:", name, "got:", JSON.stringify(got));
    throw new Error("test failed: " + name);
  }
  passed++;
}
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// token format + uniqueness.
const tok = generateVerifyToken();
check("token format", /^cpjv-[0-9a-f]{8}$/.test(tok), tok);
check("token unique-ish", generateVerifyToken() !== generateVerifyToken());

// tokenIn: case-insensitive substring across fields, ignores non-strings.
check("tokenIn match", tokenIn(["Gennady", "ITMO cpjv-AB12cd34 University"], "cpjv-ab12cd34"));
check("tokenIn no-match", !tokenIn(["Gennady", "ITMO University"], "cpjv-deadbeef"));
check("tokenIn ignores null/undefined", !tokenIn([null, undefined], "cpjv-x"));
check("tokenIn empty token false", !tokenIn(["cpjv-abc"], "   "));

check("platform valid", isVerifyPlatform("codeforces") && isVerifyPlatform("leetcode") && isVerifyPlatform("github"));
check("platform invalid", !isVerifyPlatform("atcoder") && !isVerifyPlatform("x"));
check("hint is string", typeof placementHint("codeforces") === "string" && placementHint("leetcode").length > 0);

// ---- REAL Codeforces user.info (tourist) ----
const CF_INFO = {
  handle: "tourist",
  firstName: "Gennady",
  lastName: "Korotkevich",
  organization: "ITMO University",
  rating: 3428,
  maxRating: 4009,
  rank: "legendary grandmaster",
  maxRank: "tourist",
};
check(
  "shapeCfStats",
  eq(shapeCfStats(CF_INFO, 1500), {
    solved: 1500,
    rating: 3428,
    maxRating: 4009,
    rank: "legendary grandmaster",
    maxRank: "tourist",
  }),
  shapeCfStats(CF_INFO, 1500)
);
check("shapeCfStats null solved", shapeCfStats(CF_INFO, null).solved === undefined);

// countCfSolved: distinct accepted, dedupes resubmits + same problem.
check(
  "countCfSolved dedupes",
  countCfSolved([
    { verdict: "OK", problem: { contestId: 1, index: "A" } },
    { verdict: "OK", problem: { contestId: 1, index: "A" } }, // dup
    { verdict: "OK", problem: { contestId: 1, index: "B" } },
    { verdict: "WRONG_ANSWER", problem: { contestId: 2, index: "A" } }, // not OK
    { verdict: "OK", problem: { index: "A" } }, // no contestId
  ]) === 2
);

// ---- REAL LeetCode matchedUser (lee215) ----
const LC = {
  username: "lee215",
  profile: { realName: "lee", aboutMe: "Lee codes for fun :)", ranking: 112011 },
  submitStatsGlobal: {
    acSubmissionNum: [
      { difficulty: "All", count: 640 },
      { difficulty: "Easy", count: 122 },
      { difficulty: "Medium", count: 379 },
      { difficulty: "Hard", count: 139 },
    ],
  },
};
check(
  "shapeLcStats",
  eq(shapeLcStats(LC), { solved: 640, easy: 122, medium: 379, hard: 139, ranking: 112011 }),
  shapeLcStats(LC)
);

check("shapeGithubStats", eq(shapeGithubStats({ public_repos: 42, followers: 1000 }), { publicRepos: 42, followers: 1000 }));

// badge headline messages.
check("badge cf", badgeMessage("codeforces", { rating: 3428, solved: 1500 }) === "3428 · 1500 solved");
check("badge lc", badgeMessage("leetcode", { solved: 640 }) === "640 solved");
check("badge github", badgeMessage("github", { publicRepos: 42 }) === "42 repos");
check("badge fallback", badgeMessage("leetcode", {}) === "verified");

console.log(`\nALL PASS (${passed} checks)`);
