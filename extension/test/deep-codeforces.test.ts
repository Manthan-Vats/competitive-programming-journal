/* Verification for the Codeforces deep-import shapers. Run: npx tsx test/deep-codeforces.test.ts
 * Exercises the PURE builders against REAL user.status rows captured from a logged-in account
 * (session #11) - no fetch, no DOM. */
import {
  cfMapLanguage,
  cfRatingToDifficulty,
  cfEarliestAccepted,
  buildCfItem,
  type CfSubmission,
} from "../lib/deep/codeforces";

let failures = 0;
function check(label: string, cond: boolean, detail = "") {
  if (!cond) failures++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${cond ? "" : "  -- " + detail}`);
}

//  language mapping
check("lang C++17 -> cpp", cfMapLanguage("C++17 (GCC 7-32)") === "cpp");
check("lang GNU C++20 (64) -> cpp", cfMapLanguage("GNU C++20 (64)") === "cpp");
check("lang PyPy 3-64 -> python", cfMapLanguage("PyPy 3-64") === "python");
check("lang Python 3 -> python", cfMapLanguage("Python 3") === "python");
check("lang Java 21 -> java", cfMapLanguage("Java 21") === "java");
check("lang Node.js -> js", cfMapLanguage("Node.js") === "js");
check("lang JavaScript -> js (not java)", cfMapLanguage("JavaScript") === "js");
check("lang Rust 2021 -> rust", cfMapLanguage("Rust 2021") === "rust");
check("lang Go -> go", cfMapLanguage("Go") === "go");
check("lang Kotlin -> other", cfMapLanguage("Kotlin 1.9") === "other");
check("lang empty -> other", cfMapLanguage(undefined) === "other");

//  rating buckets (boundaries)
check("rating 0 -> unknown", cfRatingToDifficulty(0) === "unknown");
check("rating 900 -> easy", cfRatingToDifficulty(900) === "easy");
check("rating 1299 -> easy", cfRatingToDifficulty(1299) === "easy");
check("rating 1300 -> medium", cfRatingToDifficulty(1300) === "medium");
check("rating 1899 -> medium", cfRatingToDifficulty(1899) === "medium");
check("rating 1900 -> hard", cfRatingToDifficulty(1900) === "hard");
check("rating 2400 -> expert", cfRatingToDifficulty(2400) === "expert");

//  REAL user.status rows (first 5 captured)
const REAL: CfSubmission[] = [
  {
    id: 359178622,
    contestId: 2185,
    creationTimeSeconds: 1769074025,
    programmingLanguage: "C++17 (GCC 7-32)",
    verdict: "OK",
    timeConsumedMillis: 46,
    memoryConsumedBytes: 0,
    problem: { contestId: 2185, index: "C", name: "Shifted MEX", rating: 900, tags: ["implementation", "sortings"] },
  },
  {
    id: 359041775,
    contestId: 2191,
    creationTimeSeconds: 1768989271,
    programmingLanguage: "C++17 (GCC 7-32)",
    verdict: "OK",
    timeConsumedMillis: 46,
    memoryConsumedBytes: 0,
    problem: { contestId: 2191, index: "B", name: "MEX Reordering", rating: 1000, tags: ["constructive algorithms", "sortings"] },
  },
  // Three submissions of the SAME problem (2037 D) - must collapse to the earliest.
  {
    id: 341827063,
    contestId: 2037,
    creationTimeSeconds: 1759572825,
    programmingLanguage: "C++17 (GCC 7-32)",
    verdict: "OK",
    timeConsumedMillis: 218,
    memoryConsumedBytes: 5632000,
    problem: { contestId: 2037, index: "D", name: "Sharky Surfing", rating: 1300, tags: ["data structures", "greedy", "two pointers"] },
  },
  {
    id: 341826945,
    contestId: 2037,
    creationTimeSeconds: 1759572773,
    programmingLanguage: "C++17 (GCC 7-32)",
    verdict: "OK",
    timeConsumedMillis: 234,
    memoryConsumedBytes: 5734400,
    problem: { contestId: 2037, index: "D", name: "Sharky Surfing", rating: 1300, tags: ["data structures", "greedy", "two pointers"] },
  },
  {
    id: 341826380,
    contestId: 2037,
    creationTimeSeconds: 1759572523, // earliest of the three
    programmingLanguage: "C++17 (GCC 7-32)",
    verdict: "OK",
    timeConsumedMillis: 249,
    memoryConsumedBytes: 5734400,
    problem: { contestId: 2037, index: "D", name: "Sharky Surfing", rating: 1300, tags: ["data structures", "greedy", "two pointers"] },
  },
];

const accepted = cfEarliestAccepted(REAL);
check("dedupes 5 subs -> 3 problems", accepted.length === 3, String(accepted.length));

const byKey = new Map(accepted.map((a) => [a.key, a]));
const d = byKey.get("2037-D");
check("kept EARLIEST 2037-D submission", !!d && d.sub.id === 341826380, String(d?.sub.id));

//  skips non-OK + malformed
const noise: CfSubmission[] = [
  { id: 1, verdict: "WRONG_ANSWER", problem: { contestId: 5, index: "A" } },
  { id: 2, verdict: "OK", problem: { index: "A" } }, // no contestId
  { id: 3, verdict: "OK", problem: { contestId: 5 } }, // no index
];
check("skips non-OK / malformed", cfEarliestAccepted(noise).length === 0);

//  buildCfItem (with source)
const SRC = "#include <bits/stdc++.h>\nint main(){return 0;}";
const itemB = buildCfItem(byKey.get("2191-B")!, SRC);
check("CF url canonical", itemB.problem.url === "https://codeforces.com/contest/2191/problem/B", itemB.problem.url);
check("CF title", itemB.problem.title === "B. MEX Reordering", itemB.problem.title);
check("CF platform_id", itemB.problem.platform_id === "2191B", String(itemB.problem.platform_id));
check("CF difficulty_raw", itemB.problem.difficulty_raw === "1000", String(itemB.problem.difficulty_raw));
check("CF difficulty_norm easy", itemB.problem.difficulty_norm === "easy", String(itemB.problem.difficulty_norm));
check("CF tags", JSON.stringify(itemB.problem.source_tags) === JSON.stringify(["constructive algorithms", "sortings"]));
check("CF solved_at ISO", itemB.problem.solved_at === new Date(1768989271 * 1000).toISOString(), String(itemB.problem.solved_at));
check("CF solution present", !!itemB.solution);
check("CF solution language cpp", itemB.solution?.language === "cpp");
check("CF solution code", itemB.solution?.code === SRC);
check("CF solution verdict OK", itemB.solution?.verdict === "OK");
check("CF solution accepted", itemB.solution?.is_accepted === true);
check("CF solution runtime", itemB.solution?.runtime === "46 ms", String(itemB.solution?.runtime));
check("CF solution memory", itemB.solution?.memory === "0 KB", String(itemB.solution?.memory));
check("CF solution submission_url", itemB.solution?.submission_url === "https://codeforces.com/contest/2191/submission/359041775", itemB.solution?.submission_url || "");
check("CF solution source id prefixed", itemB.solution?.source_submission_id === "cf:359041775", String(itemB.solution?.source_submission_id));

// memory rounding on the 2037-D row (5734400 bytes -> 5600 KB)
const itemD = buildCfItem(d!, SRC);
check("CF memory rounds to KB", itemD.solution?.memory === "5600 KB", String(itemD.solution?.memory));
check("CF 2037-D medium (1300)", itemD.problem.difficulty_norm === "medium", String(itemD.problem.difficulty_norm));

//  buildCfItem (no source -> problem only)
const noSrc = buildCfItem(byKey.get("2185-C")!, null);
check("no source -> no solution", noSrc.solution === undefined);
check("no source -> problem still built", noSrc.problem.url === "https://codeforces.com/contest/2185/problem/C");

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
