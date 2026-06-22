import { shapeImportItems, type ImportItem } from "../lib/ext/import-batch";

// Unit tests for the deep-import batch shaper (/api/ext/import). Validates + dedupes an
// untrusted batch into insertable problem rows + solution drafts, no DB.

let passed = 0;
function check(name: string, cond: boolean, got?: unknown) {
  if (!cond) {
    console.error("FAIL:", name, "got:", JSON.stringify(got));
    throw new Error("test failed: " + name);
  }
  passed++;
}

const U = "00000000-0000-0000-0000-000000000001";

// Empty.
const empty = shapeImportItems(U, []);
check("empty problems", empty.problemRows.length === 0);
check("empty solutions", empty.solutionDrafts.length === 0);

// Non-array guard (defensive).
check("non-array -> empty", shapeImportItems(U, undefined as unknown as ImportItem[]).problemRows.length === 0);

// One problem, no solution.
const a = shapeImportItems(U, [
  { problem: { url: "https://cf.com/c/1/problem/A", title: "A. X", platform: "codeforces" } },
]);
check("one problem row", a.problemRows.length === 1, a.problemRows);
check("stamps user_id", a.problemRows[0].user_id === U);
check("no solution drafts", a.solutionDrafts.length === 0);

// Problem + valid solution with provenance.
const b = shapeImportItems(U, [
  {
    problem: { url: "https://leetcode.com/problems/two-sum", title: "1. Two Sum", platform: "leetcode" },
    solution: {
      language: "python",
      code: "print(1)",
      is_public_code: "yes", // truthy non-bool must NOT publish
      source_submission_id: "sub-1",
      verdict: "Accepted",
      is_accepted: true,
    },
  },
]);
check("b one problem", b.problemRows.length === 1);
check("b one solution", b.solutionDrafts.length === 1, b.solutionDrafts);
check("b solution links by url", b.solutionDrafts[0].url === "https://leetcode.com/problems/two-sum");
check("b is_public_code coerced false", b.solutionDrafts[0].is_public_code === false);
check("b provenance subid", b.solutionDrafts[0].provenance.source_submission_id === "sub-1");
check("b provenance accepted", b.solutionDrafts[0].provenance.is_accepted === true);

// Duplicate problem url within the batch -> one problem row, but both solutions kept.
const c = shapeImportItems(U, [
  { problem: { url: "https://x.com/p", title: "P", platform: "other" }, solution: { language: "cpp", code: "a" } },
  { problem: { url: "https://x.com/p", title: "P", platform: "other" }, solution: { language: "cpp", code: "b" } },
]);
check("c dedupes problem", c.problemRows.length === 1, c.problemRows);
check("c keeps both solutions", c.solutionDrafts.length === 2);

// Invalid problem (no url/title) -> counted, skipped.
const d = shapeImportItems(U, [
  { problem: { url: "", title: "" }, solution: { language: "cpp", code: "x" } },
]);
check("d invalid problem counted", d.invalidProblems === 1, d.invalidProblems);
check("d no problem row", d.problemRows.length === 0);
check("d solution dropped with problem", d.solutionDrafts.length === 0);

// Invalid solution: bad language / empty / too large.
const e = shapeImportItems(U, [
  { problem: { url: "https://y.com/1", title: "Y", platform: "other" }, solution: { language: "cobol", code: "x" } },
  { problem: { url: "https://y.com/2", title: "Y2", platform: "other" }, solution: { language: "cpp", code: "   " } },
  { problem: { url: "https://y.com/3", title: "Y3", platform: "other" }, solution: { language: "cpp", code: "a".repeat(100001) } },
]);
check("e three problems", e.problemRows.length === 3);
check("e invalid solutions counted", e.invalidSolutions === 3, e.invalidSolutions);
check("e no solution drafts", e.solutionDrafts.length === 0);

console.log(`ALL PASS (${passed} assertions)`);
