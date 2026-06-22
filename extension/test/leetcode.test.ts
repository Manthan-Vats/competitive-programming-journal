/* Verification for the LeetCode parser. Run: npx tsx test/leetcode.test.ts
 * Stubs the GraphQL fetch + a jsdom document and exercises the REAL parser. */
import { JSDOM } from "jsdom";
import { leetcodeParser } from "../lib/parsers/leetcode";

let failures = 0;
function check(label: string, cond: boolean, detail = "") {
  if (!cond) failures++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${cond ? "" : "  -- " + detail}`);
}

const CONTENT =
  '<p>Given an array of integers <code>nums</code>&nbsp;and an integer <code>target</code>, ' +
  "return <em>indices of the two numbers</em>.</p>\n" +
  '<p><strong class="example">Example 1:</strong></p>\n' +
  "<pre><strong>Input:</strong> nums = [2,7,11,15], target = 9\n<strong>Output:</strong> [0,1]</pre>";

const RESP = {
  data: {
    question: {
      questionFrontendId: "1",
      title: "Two Sum",
      titleSlug: "two-sum",
      difficulty: "Easy",
      isPaidOnly: false,
      topicTags: [{ name: "Array" }, { name: "Hash Table" }],
      content: CONTENT,
    },
  },
};

const dom = new JSDOM("<!DOCTYPE html><title>Two Sum - LeetCode</title>");
const doc = dom.window.document;

// matches()
check("matches problem URL", leetcodeParser.matches(new URL("https://leetcode.com/problems/two-sum/")));
check("rejects non-problem URL", !leetcodeParser.matches(new URL("https://leetcode.com/problemset/")));
check("rejects other host", !leetcodeParser.matches(new URL("https://example.com/problems/x/")));

async function main() {
  //  happy path (GraphQL returns data)
  (globalThis as { fetch?: unknown }).fetch = async () => ({
    ok: true,
    json: async () => RESP,
  });

  const p = await leetcodeParser.parse(
    doc,
    new URL("https://leetcode.com/problems/two-sum/description/?envType=x")
  );
  if (!p) {
    console.log("FAIL  parse returned null");
    process.exit(1);
  }
  console.log("\n----- statement -----\n" + p.statement + "\n---------------------\n");

  check("canonical url", p.url === "https://leetcode.com/problems/two-sum", p.url);
  check("title with id", p.title === "1. Two Sum", p.title);
  check("platform", p.platform === "leetcode");
  check("platform_id", p.platform_id === "1", String(p.platform_id));
  check("difficulty_raw", p.difficulty_raw === "Easy", String(p.difficulty_raw));
  check("difficulty_norm", p.difficulty_norm === "easy", String(p.difficulty_norm));
  check("tags", JSON.stringify(p.source_tags) === JSON.stringify(["Array", "Hash Table"]), JSON.stringify(p.source_tags));
  check("statement is plain text (no tags)", !!p.statement && !/[<>]/.test(p.statement), p.statement);
  check("statement has intro", !!p.statement && p.statement.includes("Given an array of integers nums"), p.statement);
  check("statement has example", !!p.statement && p.statement.includes("Example 1:"), p.statement);

  //  fallback path (GraphQL fails -> DOM title)
  (globalThis as { fetch?: unknown }).fetch = async () => {
    throw new Error("network down");
  };
  const f = await leetcodeParser.parse(doc, new URL("https://leetcode.com/problems/two-sum/"));
  check("fallback returns payload", !!f);
  check("fallback canonical url", !!f && f.url === "https://leetcode.com/problems/two-sum");
  check("fallback title from DOM", !!f && f.title === "Two Sum", f?.title || "");

  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
