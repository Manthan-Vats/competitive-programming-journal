import { aiNormalizePatterns } from "../lib/ai/normalize-patterns";

// Tests the static-first behavior of AI pattern normalization (no network - AI fallback is disabled
// via useAI:false or skipped because the static map already resolves). Run:
//   npx tsx test/normalize-patterns.test.ts

let passed = 0;
function check(name: string, cond: boolean, got?: unknown) {
  if (!cond) {
    console.error("FAIL:", name, "got:", JSON.stringify(got));
    throw new Error("test failed: " + name);
  }
  passed++;
}
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

async function main() {
  // Static map resolves -> returns immediately, no AI needed.
  check("static dp -> DP", eq(await aiNormalizePatterns(["dp"]), ["Dynamic Programming"]));
  check(
    "static AI-tags map (Segment Tree + graph -> Trees, Graphs)",
    eq(await aiNormalizePatterns(["Segment Tree", "graph"]), ["Trees", "Graphs"]),
    await aiNormalizePatterns(["Segment Tree", "graph"])
  );

  // Empty input -> [] with no AI call.
  check("empty -> []", eq(await aiNormalizePatterns([]), []));
  check("non-strings ignored -> []", eq(await aiNormalizePatterns([null, 5] as unknown[]), []));

  // useAI:false forces static-only, so unknown tags yield [] without any network call.
  check(
    "unknown tags, useAI:false -> []",
    eq(await aiNormalizePatterns(["implementation", "ad hoc"], { useAI: false }), [])
  );

  // Canonical ordering preserved when several resolve.
  check(
    "ordering preserved",
    eq(await aiNormalizePatterns(["greedy", "two pointers"]), ["Two Pointers", "Greedy"]),
    await aiNormalizePatterns(["greedy", "two pointers"])
  );

  console.log(`\nALL PASS (${passed} checks)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
