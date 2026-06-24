// Tests validateGeminiKey shape-checking. Gemini keys have NO single stable prefix anymore:
// classic AI Studio keys are `AIza...`, but Google now also issues `AQ.`/`IQ.`-prefixed keys.
// The validator must accept all of those and reject only obvious junk (blobs, whitespace, empties);
// the route's live API ping is the real validity check. No network. Run:
//   npx tsx test/ai-key-validate.test.ts

import { validateGeminiKey } from "../lib/ai/user-key";

let passed = 0;
function check(name: string, cond: boolean) {
  if (!cond) {
    console.error("FAIL:", name);
    throw new Error("test failed: " + name);
  }
  passed++;
}

function main() {
  // Accepts all known Gemini key formats.
  check("accepts classic AIza key", !!validateGeminiKey("AIzaSyD1234567890abcdefghijklmnopqrstuv").value);
  check("accepts new AQ. key", !!validateGeminiKey("AQ.Ab8RN6Jj_kQw-1234567890abcdefghijklmno").value);
  check("accepts IQ. key", !!validateGeminiKey("IQ.Ab8RN6Jj_kQwerty1234567890abcdefghijkl").value);
  check("trims surrounding whitespace", validateGeminiKey("  AIzaSyD1234567890abcdefghijklmnop  ").value === "AIzaSyD1234567890abcdefghijklmnop");

  // Rejects junk.
  check("rejects empty", !!validateGeminiKey("").error);
  check("rejects non-string", !!validateGeminiKey(42 as unknown).error);
  check("rejects too-short", !!validateGeminiKey("AIza123").error);
  check("rejects whitespace inside (blob paste)", !!validateGeminiKey("AIzaSyD1234 567890abcdefghijklmnop").error);
  check("rejects oversized blob", !!validateGeminiKey("A".repeat(201)).error);
  check("rejects illegal chars", !!validateGeminiKey("AIza$$$1234567890abcdefghij!!").error);

  console.log(`\nALL PASS (${passed} checks)`);
}

main();
