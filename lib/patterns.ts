// Canonical pattern taxonomy for the revision/knowledge-base pillar (P4).
// A fixed ~16-pattern set (NeetCode-style) so "patterns mastered" is consistent across problems
// and platforms. We map each problem's raw judge tags (source_tags) + the user's custom_tags
// (and, later, AI `algorithms`) onto this canonical set with a keyword table. This is the
// DETERMINISTIC, AI-FREE mapping; the smarter AI-driven normalization comes in the AI phase.
// Pure + DB-free -> unit-testable.

export const CANONICAL_PATTERNS = [
  "Arrays & Hashing",
  "Two Pointers",
  "Sliding Window",
  "Stack",
  "Binary Search",
  "Linked List",
  "Trees",
  "Heap / Priority Queue",
  "Backtracking",
  "Graphs",
  "Dynamic Programming",
  "Greedy",
  "Intervals",
  "Math & Number Theory",
  "Bit Manipulation",
  "Strings",
] as const;

export type CanonicalPattern = (typeof CANONICAL_PATTERNS)[number];

// Ordered keyword -> pattern rules. A single tag may match several patterns (e.g. "string
// hashing"). Matching is case-insensitive substring. Keep more-specific phrases ahead of generic
// ones where it matters (Heap's "priority queue" before any "queue"; we intentionally omit bare
// "queue" from Stack so "priority queue" isn't double-counted).
const RULES: { kw: string[]; pattern: CanonicalPattern }[] = [
  { kw: ["two pointer", "two-pointer"], pattern: "Two Pointers" },
  { kw: ["sliding window"], pattern: "Sliding Window" },
  { kw: ["binary search", "bsearch", "ternary search"], pattern: "Binary Search" },
  { kw: ["monotonic stack", "stack", "deque", "monotonic queue"], pattern: "Stack" },
  { kw: ["linked list", "linked-list"], pattern: "Linked List" },
  {
    kw: ["segment tree", "fenwick", "binary indexed", "bst", "binary tree", "trie", "tree"],
    pattern: "Trees",
  },
  { kw: ["heap", "priority queue", "priority-queue"], pattern: "Heap / Priority Queue" },
  { kw: ["backtrack", "recursion"], pattern: "Backtracking" },
  {
    kw: [
      "graph", "dfs", "bfs", "shortest path", "dijkstra", "bellman", "floyd",
      "union find", "union-find", "dsu", "disjoint set", "topolog", "spanning",
      "mst", "max flow", "maxflow", "matching", "2-sat", "scc", "articulation",
      "bridge", "euler",
    ],
    pattern: "Graphs",
  },
  {
    kw: ["dynamic programming", "dynamic-programming", "dp", "knapsack", "memoization"],
    pattern: "Dynamic Programming",
  },
  { kw: ["greedy"], pattern: "Greedy" },
  { kw: ["interval", "line sweep", "sweep line"], pattern: "Intervals" },
  {
    kw: [
      "math", "number theory", "number-theory", "modular", "modulo", "prime", "sieve",
      "gcd", "lcm", "combinator", "probabilit", "geometry", "matrix expon", "fft", "ntt",
    ],
    pattern: "Math & Number Theory",
  },
  { kw: ["bitmask", "bit manipulation", "bitwise", "xor", "bits"], pattern: "Bit Manipulation" },
  {
    kw: [
      "string", "kmp", "z-function", "z function", "suffix", "manacher", "aho",
      "hashing", "rolling hash", "palindrome",
    ],
    pattern: "Strings",
  },
  {
    kw: [
      "array", "hash table", "hash map", "hashmap", "hashset", "hash set", "prefix sum",
      "prefix-sum", "sorting", "sortings", "sort", "ordered set", "counting", "frequency",
    ],
    pattern: "Arrays & Hashing",
  },
];

// Map a list of raw tags onto the canonical pattern set, returned in canonical order (stable).
export function tagsToPatterns(tags: readonly unknown[]): CanonicalPattern[] {
  const found = new Set<CanonicalPattern>();
  for (const raw of tags ?? []) {
    if (typeof raw !== "string") continue;
    const t = raw.toLowerCase();
    for (const rule of RULES) {
      if (rule.kw.some((k) => t.includes(k))) found.add(rule.pattern);
    }
  }
  return CANONICAL_PATTERNS.filter((p) => found.has(p));
}

export function isCanonicalPattern(v: unknown): v is CanonicalPattern {
  return typeof v === "string" && (CANONICAL_PATTERNS as readonly string[]).includes(v);
}
