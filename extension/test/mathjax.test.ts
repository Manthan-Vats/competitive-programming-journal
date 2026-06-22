/* Verification for the statement readability fix. Run: npx tsx test/mathjax.test.ts
 * Tests the REAL module (no copies): latexToReadable on actual CF snippets, and
 * extractReadableText against a reconstructed MathJax-v2 statement fragment via jsdom. */
import { JSDOM } from "jsdom";
import { latexToReadable, extractReadableText } from "../lib/parsers/mathjax";

let failures = 0;
function eq(label: string, got: string, want: string) {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}
function check(label: string, cond: boolean, detail = "") {
  if (!cond) failures++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${cond ? "" : "  -- " + detail}`);
}

console.log("--- latexToReadable (CF math/tex sources) ---");
eq("inequality + exponent", latexToReadable("1 \\le t \\le 10^3"), "1 ≤ t ≤ 10³");
eq("two inequalities", latexToReadable("0 \\le k \\le n"), "0 ≤ k ≤ n");
eq("thin-space thousands", latexToReadable("1 \\le n \\le 5\\,000"), "1 ≤ n ≤ 5 000");
eq("texttt wrapper", latexToReadable("\\texttt{(())()}"), "(())()");
eq("texttt parens", latexToReadable("\\texttt{)(}"), ")(");
eq("footnote marker", latexToReadable("^{\\text{∗}}"), "∗");
eq("single var", latexToReadable("s"), "s");
eq("braced exponent", latexToReadable("10^{9}+7"), "10⁹+7");
eq("simple exponent", latexToReadable("n^2"), "n²");
eq("fraction", latexToReadable("\\frac{n}{2}"), "(n)/(2)");
eq("letter subscript kept", latexToReadable("a_i"), "a_i");
eq("digit subscript", latexToReadable("a_1"), "a₁");
eq("cdot", latexToReadable("n \\cdot m"), "n · m");

console.log("\n--- extractReadableText (MathJax v2 triple-render dedup) ---");
const M = (tex: string, rendered: string) =>
  `<span class="MathJax_Preview"></span><span class="MathJax">${rendered}</span>` +
  `<span class="MJX_Assistive_MathML">${rendered}</span><script type="math/tex">${tex}</script>`;

const html = `
<div class="problem-statement">
  <div class="header"><div class="title">A. Example</div>
    <div class="time-limit">time limit per test1 second</div></div>
  <div><p>You are given a bracket string ${M("s", "s")} and an integer ${M("k", "k")}.</p></div>
  <div class="input-specification"><p>The first line contains ${M("t", "t")}
    (${M("1 \\le t \\le 10^3", "1≤t≤103")}).</p></div>
  <div class="sample-tests"><pre>SENTINEL_9999_SAMPLE</pre></div>
</div>`;

const dom = new JSDOM(html);
const root = dom.window.document.querySelector(".problem-statement")!.cloneNode(true) as Element;
root.querySelectorAll(".header, .sample-tests").forEach((el) => el.remove());
const out = extractReadableText(root);
console.log("\n----- extracted statement -----\n" + out + "\n-------------------------------\n");

check("no 'sss' triplication", !/sss/.test(out), out);
check("no 'ttt' triplication", !/ttt/.test(out), out);
check("no 'kkk' triplication", !/kkk/.test(out), out);
check("no raw '\\le' leaks", !/\\le/.test(out), out);
check("sample tests removed", !/SENTINEL_9999_SAMPLE/.test(out), out);
check("readable vars", /bracket string s and an integer k/.test(out), out);
check("readable inequality", /1 ≤ t ≤ 10³/.test(out), out);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
