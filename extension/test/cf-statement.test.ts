/* Verifies extractCfStatementFromHtml - scraping a readable CF statement from RAW problem-page
 * HTML (math as $$$...$$$, un-rendered), formatted consistently with the live-capture parser.
 * Run: npx tsx test/cf-statement.test.ts */
import { JSDOM } from "jsdom";

// extractCfStatementFromHtml uses `new DOMParser()` - provide jsdom's globally.
const { window } = new JSDOM("<!DOCTYPE html>");
(globalThis as { DOMParser?: unknown }).DOMParser = window.DOMParser;

import { extractCfStatementFromHtml } from "../lib/parsers/codeforces";

let failures = 0;
function check(label: string, cond: boolean, detail = "") {
  if (!cond) failures++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${cond ? "" : "  -- " + detail}`);
}

// Synthetic raw CF problem page: header (title + limits), body with $$$...$$$ math, an input
// section, a sample-tests block (must be dropped), and a note.
const HTML = `<!DOCTYPE html><html><body>
<div class="problem-statement">
  <div class="header">
    <div class="title">C. Shifted MEX</div>
    <div class="time-limit"><div class="property-title">time limit per test</div>1 second</div>
    <div class="memory-limit"><div class="property-title">memory limit per test</div>256 megabytes</div>
  </div>
  <div>
    <p>You are given an array of $$$n$$$ integers where $$$1 \\le n \\le 10^5$$$ and each $$$a_i \\le 10^9$$$.</p>
    <p>Find the maximum value.</p>
  </div>
  <div class="input-specification">
    <p>The first line contains $$$t$$$ ($$$1 \\le t \\le 10^3$$$) - the number of test cases.</p>
  </div>
  <div class="sample-tests"><div class="input">SAMPLE_INPUT_MARKER 3 1 2</div><div class="output">SAMPLE_OUTPUT_MARKER</div></div>
  <div class="note"><p>Recall that $$$x^2$$$ denotes the square.</p></div>
</div>
</body></html>`;

const s = extractCfStatementFromHtml(HTML);
console.log("\n----- statement -----\n" + s + "\n---------------------\n");

check("returns a statement", !!s, String(s));
check("no $$$ delimiters left", !!s && !s.includes("$$$"), s || "");
check("math: 1 ≤ n ≤ 10⁵", !!s && s.includes("1 ≤ n ≤ 10⁵"), s || "");
check("math: 10⁹", !!s && s.includes("10⁹"), s || "");
check("math: 1 ≤ t ≤ 10³", !!s && s.includes("1 ≤ t ≤ 10³"), s || "");
check("math: x²", !!s && s.includes("x²"), s || "");
check("keeps body text", !!s && s.includes("Find the maximum value"), s || "");
check("drops header title", !!s && !s.includes("Shifted MEX"), s || "");
check("drops 'time limit' label", !!s && !/time limit/i.test(s), s || "");
check("drops sample input", !!s && !s.includes("SAMPLE_INPUT_MARKER"), s || "");
check("drops sample output", !!s && !s.includes("SAMPLE_OUTPUT_MARKER"), s || "");
check("plain text (no angle brackets)", !!s && !/[<>]/.test(s), s || "");

// Missing statement -> undefined (graceful).
check("no .problem-statement -> undefined", extractCfStatementFromHtml("<html><body>x</body></html>") === undefined);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
