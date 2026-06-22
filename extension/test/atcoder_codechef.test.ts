/* Verification for AtCoder (DOM) + CodeChef (API) parsers.
 * Run: npx tsx test/atcoder_codechef.test.ts */
import { JSDOM } from "jsdom";
import { atcoderParser } from "../lib/parsers/atcoder";
import { codechefParser } from "../lib/parsers/codechef";

let failures = 0;
function check(label: string, cond: boolean, detail = "") {
  if (!cond) failures++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${cond ? "" : "  -- " + detail}`);
}

async function atcoder() {
  console.log("--- AtCoder (DOM) ---");
  const html =
    "<!DOCTYPE html><title>A - N-choice question</title><body>" +
    '<span class="h2">A - N-choice question</span>' +
    "<p>Time Limit: 2 sec / Memory Limit: 1024 MiB</p>" +
    '<div id="task-statement">' +
    '<span class="lang-en"><p>You are given an integer N. Answer it.</p></span>' +
    '<span class="lang-ja"><p>日本語の問題文。</p></span>' +
    "</div></body>";
  const doc = new JSDOM(html).window.document;
  const p = atcoderParser.parse(doc, new URL("https://atcoder.jp/contests/abc300/tasks/abc300_a")) as
    | NonNullable<ReturnType<typeof atcoderParser.parse>>
    | null;
  const r = (await p) as any;
  console.log("  statement:", JSON.stringify(r?.statement));
  check("matches task url", atcoderParser.matches(new URL("https://atcoder.jp/contests/abc300/tasks/abc300_a")));
  check("rejects non-task", !atcoderParser.matches(new URL("https://atcoder.jp/contests/abc300")));
  check("platform_id", r?.platform_id === "abc300_a", r?.platform_id);
  check("title", r?.title === "A - N-choice question", r?.title);
  check("time limit", r?.metadata?.timeLimit === "2 sec", String(r?.metadata?.timeLimit));
  check("memory limit", r?.metadata?.memoryLimit === "1024 MiB", String(r?.metadata?.memoryLimit));
  check("english statement", !!r?.statement && r.statement.includes("You are given an integer N"), r?.statement);
  check("excludes japanese", !!r?.statement && !r.statement.includes("日本語"), r?.statement);
}

async function codechef() {
  console.log("\n--- CodeChef (API) ---");
  const RESP = {
    status: "success",
    problem_name: "Add Two Numbers",
    problem_code: "FLOW001",
    category_name: "school",
    body: "<h3>Problem Statement</h3><p>Read two integers and print their sum.</p>",
  };
  (globalThis as { fetch?: unknown }).fetch = async () => ({ ok: true, json: async () => RESP });

  const doc = new JSDOM("<!DOCTYPE html><title>Add Two Numbers | CodeChef</title>").window.document;
  check("matches practice url", codechefParser.matches(new URL("https://www.codechef.com/problems/FLOW001")));
  check("matches contest url", codechefParser.matches(new URL("https://www.codechef.com/START100/problems/ADD")));
  check("rejects other path", !codechefParser.matches(new URL("https://www.codechef.com/ratings")));

  const r = (await codechefParser.parse(doc, new URL("https://www.codechef.com/problems/FLOW001"))) as any;
  console.log("  statement:", JSON.stringify(r?.statement));
  check("title", r?.title === "Add Two Numbers", r?.title);
  check("platform_id", r?.platform_id === "FLOW001", r?.platform_id);
  check("difficulty_norm (school->easy)", r?.difficulty_norm === "easy", String(r?.difficulty_norm));
  check("statement plain text", !!r?.statement && !/[<>]/.test(r.statement), r?.statement);
  check("statement content", !!r?.statement && r.statement.includes("Read two integers"), r?.statement);

  // fallback when API fails
  (globalThis as { fetch?: unknown }).fetch = async () => {
    throw new Error("down");
  };
  const f = (await codechefParser.parse(doc, new URL("https://www.codechef.com/problems/FLOW001"))) as any;
  check("fallback payload", !!f && f.platform_id === "FLOW001", JSON.stringify(f));
}

(async () => {
  await atcoder();
  await codechef();
  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
})();
