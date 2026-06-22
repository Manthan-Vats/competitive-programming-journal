import { CANONICAL_PATTERNS, tagsToPatterns, isCanonicalPattern } from "../lib/patterns";

// Unit tests for the canonical pattern taxonomy + tag->pattern mapping (P4). Run:
//   npx tsx test/patterns.test.ts

let passed = 0;
function check(name: string, cond: boolean, got?: unknown) {
  if (!cond) {
    console.error("FAIL:", name, "got:", JSON.stringify(got));
    throw new Error("test failed: " + name);
  }
  passed++;
}
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

check("16 canonical patterns", CANONICAL_PATTERNS.length === 16, CANONICAL_PATTERNS.length);
check("isCanonicalPattern true", isCanonicalPattern("Graphs"));
check("isCanonicalPattern false", !isCanonicalPattern("Nonsense"));

// Codeforces-style tags -> canonical, returned in canonical order.
check(
  "cf dp/graphs/greedy",
  eq(tagsToPatterns(["dp", "graphs", "greedy"]), ["Graphs", "Dynamic Programming", "Greedy"]),
  tagsToPatterns(["dp", "graphs", "greedy"])
);
check("cf dfs and similar -> Graphs", eq(tagsToPatterns(["dfs and similar"]), ["Graphs"]));
check("cf bitmasks -> Bit Manipulation", eq(tagsToPatterns(["bitmasks"]), ["Bit Manipulation"]));
check("cf binary search", eq(tagsToPatterns(["binary search"]), ["Binary Search"]));
check("cf sortings -> Arrays & Hashing", eq(tagsToPatterns(["sortings"]), ["Arrays & Hashing"]));

// LeetCode-style tags.
check(
  "lc Array/Hash Table/Two Pointers",
  eq(tagsToPatterns(["Array", "Hash Table", "Two Pointers"]), ["Arrays & Hashing", "Two Pointers"]),
  tagsToPatterns(["Array", "Hash Table", "Two Pointers"])
);
check("lc Sliding Window", eq(tagsToPatterns(["Sliding Window"]), ["Sliding Window"]));
check("lc segment tree -> Trees", eq(tagsToPatterns(["Segment Tree"]), ["Trees"]));

// "priority queue" must map to Heap ONLY (not Stack - we dropped bare "queue").
check("priority queue -> Heap only", eq(tagsToPatterns(["Priority Queue"]), ["Heap / Priority Queue"]));
check("monotonic stack -> Stack", eq(tagsToPatterns(["monotonic stack"]), ["Stack"]));

// Multiple tags collapse + canonical ordering (Two Pointers before Stack before Graphs).
check(
  "ordering",
  eq(tagsToPatterns(["graph", "stack", "two pointers"]), ["Two Pointers", "Stack", "Graphs"]),
  tagsToPatterns(["graph", "stack", "two pointers"])
);

// Unknown / generic tags yield nothing; non-strings are ignored.
check("unknown tag -> []", eq(tagsToPatterns(["implementation", "brute force"]), []));
check("non-strings ignored", eq(tagsToPatterns([null, 123, "dp"] as unknown[]), ["Dynamic Programming"]));
check("empty input -> []", eq(tagsToPatterns([]), []));

console.log(`\nALL PASS (${passed} checks)`);
