/* Verification for the LeetCode deep-import shapers. Run: npx tsx test/deep-leetcode.test.ts
 * Exercises the PURE builders against REAL /api/submissions/ rows captured from a logged-in
 * account (session #11) - no fetch, no DOM. */
import {
  lcMapLanguage,
  lcDifficultyToNorm,
  isLcAccepted,
  lcEarliestAccepted,
  buildLcItem,
  type LcSubmissionRow,
} from "../lib/deep/leetcode";

let failures = 0;
function check(label: string, cond: boolean, detail = "") {
  if (!cond) failures++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${cond ? "" : "  -- " + detail}`);
}

//  language mapping
check("lang cpp -> cpp", lcMapLanguage("cpp") === "cpp");
check("lang c -> cpp", lcMapLanguage("c") === "cpp");
check("lang python3 -> python", lcMapLanguage("python3") === "python");
check("lang python -> python", lcMapLanguage("python") === "python");
check("lang golang -> go", lcMapLanguage("golang") === "go");
check("lang javascript -> js", lcMapLanguage("javascript") === "js");
check("lang typescript -> js", lcMapLanguage("typescript") === "js");
check("lang java -> java", lcMapLanguage("java") === "java");
check("lang rust -> rust", lcMapLanguage("rust") === "rust");
check("lang ruby -> other", lcMapLanguage("ruby") === "other");
check("lang empty -> other", lcMapLanguage(undefined) === "other");

//  difficulty norm
check("Easy -> easy", lcDifficultyToNorm("Easy") === "easy");
check("Medium -> medium", lcDifficultyToNorm("Medium") === "medium");
check("Hard -> hard", lcDifficultyToNorm("Hard") === "hard");
check("?? -> unknown", lcDifficultyToNorm(undefined) === "unknown");

//  REAL /api/submissions/ rows (three submissions of the SAME problem)
const CODE =
  'class Solution {\npublic:\n    int mySqrt(int x) {\n        double l=0,r=x;\n' +
  "       double eps=0.00001;\n    while(r-l>eps)\n    {\n      double mid=l+(r-l)/2;\n" +
  "      if(mid*mid<x) l=mid;\n      else r=mid;\n    }\n        int ans=r;\n       return ans;\n    }\n};";

const REAL: LcSubmissionRow[] = [
  {
    id: 514671986,
    question_id: 69,
    frontend_id: 16, // per-user counter, NOT the problem number - must be ignored
    lang: "cpp",
    lang_name: "C++",
    timestamp: 1624932925,
    status: 10,
    status_display: "Accepted",
    runtime: "4 ms",
    memory: "5.9 MB",
    url: "/submissions/detail/514671986/",
    title: "Sqrt(x)",
    title_slug: "sqrtx",
    code: CODE,
  },
  {
    id: 514671924,
    question_id: 69,
    frontend_id: 15,
    lang: "cpp",
    timestamp: 1624932910,
    status: 10,
    status_display: "Accepted",
    runtime: "4 ms",
    memory: "5.9 MB",
    url: "/submissions/detail/514671924/",
    title: "Sqrt(x)",
    title_slug: "sqrtx",
    code: CODE,
  },
  {
    id: 514671862,
    question_id: 69,
    frontend_id: 14,
    lang: "cpp",
    timestamp: 1624932899, // earliest
    status: 10,
    status_display: "Accepted",
    runtime: "0 ms",
    memory: "5.9 MB",
    url: "/submissions/detail/514671862/",
    title: "Sqrt(x)",
    title_slug: "sqrtx",
    code: CODE,
  },
];

check("isLcAccepted by status 10", isLcAccepted(REAL[0]));
check("isLcAccepted by display", isLcAccepted({ status_display: "Accepted" }));
check("not accepted (WA)", !isLcAccepted({ status: 11, status_display: "Wrong Answer" }));

const accepted = lcEarliestAccepted(REAL);
check("dedupes 3 subs -> 1 problem", accepted.length === 1, String(accepted.length));
check("kept EARLIEST submission", accepted[0]?.id === 514671862, String(accepted[0]?.id));

//  buildLcItem WITH enrichment (canonical number from question(slug))
const item = buildLcItem(accepted[0], {
  frontendId: "69",
  title: "Sqrt(x)",
  difficulty: "Easy",
  tags: ["Math", "Binary Search"],
  statement: "Given a non-negative integer x, return the square root.",
});
check("LC url canonical (slug, no trailing slash)", item.problem.url === "https://leetcode.com/problems/sqrtx", item.problem.url);
check("LC title uses ENRICHMENT frontendId, not row 14", item.problem.title === "69. Sqrt(x)", item.problem.title);
check("LC platform_id from enrichment", item.problem.platform_id === "69", String(item.problem.platform_id));
check("LC difficulty_raw", item.problem.difficulty_raw === "Easy");
check("LC difficulty_norm", item.problem.difficulty_norm === "easy");
check("LC tags from enrichment", JSON.stringify(item.problem.source_tags) === JSON.stringify(["Math", "Binary Search"]));
check("LC statement", !!item.problem.statement && item.problem.statement.includes("square root"));
check("LC solved_at ISO (earliest)", item.problem.solved_at === new Date(1624932899 * 1000).toISOString(), String(item.problem.solved_at));
check("LC solution present", !!item.solution);
check("LC solution language cpp", item.solution?.language === "cpp");
check("LC solution code", item.solution?.code === CODE);
check("LC solution runtime", item.solution?.runtime === "0 ms", String(item.solution?.runtime));
check("LC solution memory", item.solution?.memory === "5.9 MB");
check("LC solution verdict", item.solution?.verdict === "Accepted");
check("LC solution accepted", item.solution?.is_accepted === true);
check("LC solution submission_url absolute", item.solution?.submission_url === "https://leetcode.com/submissions/detail/514671862/", item.solution?.submission_url || "");
check("LC solution source id prefixed", item.solution?.source_submission_id === "lc:514671862", String(item.solution?.source_submission_id));

//  buildLcItem WITHOUT enrichment (degrades to row title/slug, no bad number) -
const bare = buildLcItem(accepted[0]);
check("LC bare title = row title (no wrong number)", bare.problem.title === "Sqrt(x)", bare.problem.title);
check("LC bare platform_id undefined (not row 14)", bare.problem.platform_id === undefined, String(bare.problem.platform_id));
check("LC bare url still canonical", bare.problem.url === "https://leetcode.com/problems/sqrtx");

//  no code -> problem only
const noCode = buildLcItem({ id: 7, title_slug: "x", title: "X", timestamp: 1 });
check("LC no code -> no solution", noCode.solution === undefined);
check("LC no code -> problem still built", noCode.problem.url === "https://leetcode.com/problems/x");

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
