import { isAIConfigured, aiChainLabel, generateStructured, AINotConfiguredError } from "../lib/ai";
import { z } from "zod";

// Tests the provider registry under BYOK: providers are assembled from the per-call `keys` object
// (NOT a shared env key), and the optional/degraded behavior when no key is supplied. No network
// calls. Run:
//   npx tsx test/ai-registry.test.ts

let passed = 0;
function check(name: string, cond: boolean, got?: unknown) {
  if (!cond) {
    console.error("FAIL:", name, "got:", JSON.stringify(got));
    throw new Error("test failed: " + name);
  }
  passed++;
}

async function main() {
  delete process.env.GEMINI_MODEL;

  // No key -> AI is off (optional feature degrades cleanly).
  check("no key -> not configured", isAIConfigured({}) === false);
  check("no key -> empty label", aiChainLabel({}) === "");
  let threw = false;
  try {
    await generateStructured(
      z.object({ x: z.string() }),
      { schemaName: "t", systemInstruction: "s", prompt: "p" },
      {}
    );
  } catch (e) {
    threw = e instanceof AINotConfiguredError;
  }
  check("no key -> generateStructured throws AINotConfiguredError", threw);

  // Per-user key -> configured.
  check("gemini key -> configured", isAIConfigured({ gemini: "test-key" }) === true);
  check("gemini label", aiChainLabel({ gemini: "test-key" }) === "gemini-2.5-flash-lite", aiChainLabel({ gemini: "test-key" }));

  // GEMINI_MODEL override is an instance-wide default (not a secret) and is honored.
  process.env.GEMINI_MODEL = "gemini-3-flash-preview";
  check("GEMINI_MODEL override", aiChainLabel({ gemini: "k" }) === "gemini-3-flash-preview", aiChainLabel({ gemini: "k" }));
  delete process.env.GEMINI_MODEL;

  console.log(`\nALL PASS (${passed} checks)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
