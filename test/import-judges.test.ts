import assert from "node:assert";
import { fetchCodeforcesSolved, fetchLeetcodeSolved } from "../lib/import/judges";

// Unit tests for the bulk-import transforms. We stub global.fetch with the exact response
// shapes verified live (2026-06-16) so we assert the mapping, dedupe and URL/title formats
// match the extension parsers (so per-user URL dedupe lines up with live captures).

type FetchStub = (url: string, init?: any) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>;
function withFetch(stub: FetchStub, fn: () => Promise<void>) {
  const orig = global.fetch;
  (global as any).fetch = stub;
  return fn().finally(() => {
    (global as any).fetch = orig;
  });
}
const ok = (body: any) => Promise.resolve({ ok: true, status: 200, json: async () => body });

let passed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (!cond) {
    console.error("FAIL:", name, extra ?? "");
    throw new Error("test failed: " + name);
  }
  passed++;
}

async function main() {
  // ---- Codeforces ----
  await withFetch(
    (url) => {
      assert.ok(url.startsWith("https://codeforces.com/api/user.status?handle="));
      return ok({
        status: "OK",
        result: [
          // OK, later AC of 4A (ts 2000) - should NOT win the solve date
          { verdict: "OK", creationTimeSeconds: 2000, problem: { contestId: 4, index: "A", name: "Watermelon", rating: 800, tags: ["brute force", "math"] } },
          // earlier AC of 4A (ts 1000) - EARLIEST should win solved_at. CF returns identical
          // problem metadata for every submission, so tags match the other 4A row.
          { verdict: "OK", creationTimeSeconds: 1000, problem: { contestId: 4, index: "a", name: "Watermelon", rating: 800, tags: ["brute force", "math"] } },
          // WRONG_ANSWER -> skipped
          { verdict: "WRONG_ANSWER", creationTimeSeconds: 500, problem: { contestId: 1700, index: "C", name: "Helping", rating: 1500, tags: ["greedy"] } },
          // OK, rated medium
          { verdict: "OK", creationTimeSeconds: 1500000000, problem: { contestId: 1700, index: "C", name: "Helping", rating: 1500, tags: ["greedy"] } },
          // OK, unrated (no rating)
          { verdict: "OK", creationTimeSeconds: 1600000000, problem: { contestId: 2229, index: "H", name: "Wowee", tags: [] } },
          // malformed (no contestId) -> skipped
          { verdict: "OK", problem: { index: "A", name: "Ghost" } },
        ],
      });
    },
    async () => {
      const res = await fetchCodeforcesSolved("someone");
      assert.ok("items" in res);
      const items = (res as any).items;
      check("cf: dedupes + filters to 3 solved", items.length === 3, items.map((i: any) => i.platform_id));

      const wm = items.find((i: any) => i.platform_id === "4A");
      check("cf: url is canonical contest form", wm.url === "https://codeforces.com/contest/4/problem/A", wm.url);
      check("cf: title is '<index>. <name>'", wm.title === "A. Watermelon", wm.title);
      check("cf: difficulty_raw is rating string", wm.difficulty_raw === "800");
      check("cf: 800 -> easy", wm.difficulty_norm === "easy");
      check("cf: tags carried", JSON.stringify(wm.source_tags) === JSON.stringify(["brute force", "math"]));
      check("cf: EARLIEST AC wins solved_at (ts 1000)", wm.solved_at === new Date(1000 * 1000).toISOString(), wm.solved_at);

      const helping = items.find((i: any) => i.platform_id === "1700C");
      check("cf: lowercase index normalized in url", helping.url === "https://codeforces.com/contest/1700/problem/C");
      check("cf: 1500 -> medium", helping.difficulty_norm === "medium");

      const wowee = items.find((i: any) => i.platform_id === "2229H");
      check("cf: unrated -> no difficulty_raw", wowee.difficulty_raw === undefined);
      check("cf: unrated -> difficulty_norm unknown", wowee.difficulty_norm === "unknown");
    }
  );

  // CF error path (status != OK)
  await withFetch(
    () => ok({ status: "FAILED", comment: "handle: User with handle xyz not found" }),
    async () => {
      const res = await fetchCodeforcesSolved("xyz");
      check("cf: surfaces API comment as error", "error" in res && /not found/.test((res as any).error));
    }
  );

  // ---- LeetCode ----
  await withFetch(
    (url, init) => {
      const body = JSON.parse(init.body);
      if (body.query.includes("recentAcSubmissionList")) {
        return ok({
          data: {
            recentAcSubmissionList: [
              { titleSlug: "two-sum", timestamp: "2000" }, // later AC
              { titleSlug: "two-sum", timestamp: "1000" }, // earlier AC -> wins solved_at
              { titleSlug: "add-two-numbers", timestamp: "3000" },
            ],
          },
        });
      }
      // question(titleSlug)
      const slug = body.variables.titleSlug;
      if (slug === "two-sum") {
        return ok({ data: { question: { questionFrontendId: "1", title: "Two Sum", difficulty: "Easy", topicTags: [{ name: "Array" }, { name: "Hash Table" }], content: "<p>Given <code>nums</code>, return <strong>indices</strong>.</p>" } } });
      }
      // add-two-numbers: simulate enrichment failure -> bare fallback
      return ok({ data: { question: null } });
    },
    async () => {
      const res = await fetchLeetcodeSolved("lee215");
      assert.ok("items" in res);
      const items = (res as any).items;
      check("lc: dedupes slugs to 2", items.length === 2, items.map((i: any) => i.url));

      const ts = items.find((i: any) => i.url.endsWith("/two-sum"));
      check("lc: url has no trailing slash", ts.url === "https://leetcode.com/problems/two-sum", ts.url);
      check("lc: title is '<id>. <title>'", ts.title === "1. Two Sum", ts.title);
      check("lc: platform_id is frontendId", ts.platform_id === "1");
      check("lc: Easy -> easy", ts.difficulty_norm === "easy");
      check("lc: tags carried", JSON.stringify(ts.source_tags) === JSON.stringify(["Array", "Hash Table"]));
      check("lc: EARLIEST AC wins solved_at (ts 1000)", ts.solved_at === new Date(1000 * 1000).toISOString(), ts.solved_at);
      check("lc: statement from content (tags stripped)", ts.statement === "Given nums, return indices.", ts.statement);

      const atn = items.find((i: any) => i.url.endsWith("/add-two-numbers"));
      check("lc: enrichment fail -> falls back to slug title", atn.title === "add-two-numbers", atn.title);
      check("lc: enrichment fail -> no platform_id", atn.platform_id === undefined);
    }
  );

  // LeetCode bad response
  await withFetch(
    () => ok({ data: { recentAcSubmissionList: null } }),
    async () => {
      const res = await fetchLeetcodeSolved("nobody");
      check("lc: unexpected response -> error", "error" in res);
    }
  );

  // Empty handles short-circuit (no fetch needed)
  await withFetch(
    () => { throw new Error("should not fetch on empty handle"); },
    async () => {
      const cf = await fetchCodeforcesSolved("   ");
      const lc = await fetchLeetcodeSolved("");
      check("empty handle -> empty items, no fetch", "items" in cf && (cf as any).items.length === 0 && "items" in lc);
    }
  );

  console.log(`ALL PASS (${passed} assertions)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
