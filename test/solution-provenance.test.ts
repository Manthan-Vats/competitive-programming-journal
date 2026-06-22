import { buildProvenance } from "../lib/ext/solution-provenance";

// Unit tests for solution provenance shaping (migration 008). Untrusted extension payload ->
// validated, capped, null-safe row fields.

let passed = 0;
function check(name: string, cond: boolean, got?: unknown) {
  if (!cond) {
    console.error("FAIL:", name, "got:", JSON.stringify(got));
    throw new Error("test failed: " + name);
  }
  passed++;
}

// Empty / missing -> all null.
const empty = buildProvenance({});
check("empty all null", Object.values(empty).every((v) => v === null), empty);

// Happy path (LeetCode-ish).
const lc = buildProvenance({
  submitted_at: "2024-05-01T10:00:00Z",
  verdict: "Accepted",
  is_accepted: true,
  runtime: "52 ms",
  memory: "16.1 MB",
  submission_url: "https://leetcode.com/submissions/detail/12345/",
  source_submission_id: "12345",
});
check("submitted_at ISO", lc.submitted_at === "2024-05-01T10:00:00.000Z", lc.submitted_at);
check("verdict", lc.verdict === "Accepted", lc.verdict);
check("is_accepted true", lc.is_accepted === true, lc.is_accepted);
check("runtime", lc.runtime === "52 ms", lc.runtime);
check("memory", lc.memory === "16.1 MB", lc.memory);
check("submission_url kept", lc.submission_url === "https://leetcode.com/submissions/detail/12345/", lc.submission_url);
check("source_submission_id", lc.source_submission_id === "12345", lc.source_submission_id);

// is_accepted strict boolean: a truthy string is NOT accepted (stays null = unknown).
check("is_accepted string -> null", buildProvenance({ is_accepted: "true" }).is_accepted === null);
check("is_accepted 1 -> null", buildProvenance({ is_accepted: 1 }).is_accepted === null);
check("is_accepted false kept", buildProvenance({ is_accepted: false }).is_accepted === false);

// Bad timestamp -> null.
check("bad submitted_at -> null", buildProvenance({ submitted_at: "not-a-date" }).submitted_at === null);

// URL scheme guard: reject non-http(s).
check("javascript: url rejected", buildProvenance({ submission_url: "javascript:alert(1)" }).submission_url === null);
check("data: url rejected", buildProvenance({ submission_url: "data:text/html,x" }).submission_url === null);
check("relative url rejected", buildProvenance({ submission_url: "/foo" }).submission_url === null);
check("http url kept", buildProvenance({ submission_url: "http://cf.com/s/1" }).submission_url === "http://cf.com/s/1");

// Caps.
check("verdict capped 40", (buildProvenance({ verdict: "x".repeat(100) }).verdict ?? "").length === 40);
check("source id capped 100", (buildProvenance({ source_submission_id: "9".repeat(500) }).source_submission_id ?? "").length === 100);
check(
  "long url over 500 rejected-or-capped",
  (() => {
    const long = "https://leetcode.com/" + "a".repeat(600);
    const out = buildProvenance({ submission_url: long }).submission_url;
    return out !== null && out.length === 500;
  })()
);

// Non-string junk -> null, no throw.
check("number verdict -> null", buildProvenance({ verdict: 42 }).verdict === null);
check("object runtime -> null", buildProvenance({ runtime: {} }).runtime === null);

console.log(`ALL PASS (${passed} assertions)`);
