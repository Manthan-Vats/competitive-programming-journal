import { htmlToReadableText } from "../lib/import/html-text";

// Unit tests for the server-side HTML->readable-text converter used to turn LeetCode's
// question.content HTML into a stored plain-text statement.

let passed = 0;
function check(name: string, cond: boolean, got?: unknown) {
  if (!cond) {
    console.error("FAIL:", name, "got:", JSON.stringify(got));
    throw new Error("test failed: " + name);
  }
  passed++;
}

// Realistic LeetCode-ish content snippet.
const html =
  "<p>Given an array <code>nums</code>, return indices.</p>" +
  "<p>&nbsp;</p>" +
  "<p><strong>Example 1:</strong></p>" +
  "<pre><strong>Input:</strong> nums = [2,7]\n<strong>Output:</strong> [0,1]</pre>" +
  "<p><strong>Constraints:</strong></p>" +
  "<ul><li>2 &lt;= nums.length &lt;= 10<sup>4</sup></li>" +
  "<li>-10<sup>9</sup> &lt;= nums[i] &lt;= 10<sup>9</sup></li></ul>";

const out = htmlToReadableText(html);

// No HTML tags remain (a '<' followed by a letter or slash). Note: decoded `&lt;=` yields
// a legitimate "<=" in the text, so we can't just forbid every '<'.
check("strips tags (no tag-like '<')", !/<[a-zA-Z/]/.test(out), out);
check("decodes &lt; to <", out.includes("<="), out);
check("decodes &nbsp; (no literal entity)", !out.includes("&nbsp;"), out);
check("superscript -> ^ (10^4)", out.includes("10^4"), out);
check("superscript -> ^ (10^9)", out.includes("10^9"), out);
check("list items get a bullet", out.includes("•"), out);
check("keeps example text", out.includes("Input:") && out.includes("Output:"), out);
check("block separation (newlines present)", out.includes("\n"), out);
check("no 3+ consecutive newlines", !/\n{3,}/.test(out), JSON.stringify(out));

// Edge cases.
check("empty string -> ''", htmlToReadableText("") === "");
check("non-string -> ''", htmlToReadableText(undefined as any) === "");
check(
  "script content removed",
  htmlToReadableText("<p>hi</p><script>alert(1)</script>") === "hi",
  htmlToReadableText("<p>hi</p><script>alert(1)</script>")
);
check(
  "numeric entity &#39; -> '",
  htmlToReadableText("it&#39;s") === "it's",
  htmlToReadableText("it&#39;s")
);
check(
  "hex entity &#x2264; -> ≤",
  htmlToReadableText("a &#x2264; b") === "a ≤ b",
  htmlToReadableText("a &#x2264; b")
);

console.log(`ALL PASS (${passed} assertions)`);
