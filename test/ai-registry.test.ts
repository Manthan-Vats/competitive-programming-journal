import { isAIConfigured, aiChainLabel, generateStructured, AINotConfiguredError } from "../lib/ai";
import { z } from "zod";

// Tests the provider registry: env-driven selection, ordering/fallback labels, and the
// optional/degraded behavior when no key is set. No network calls. Run:
//   npx tsx test/ai-registry.test.ts

let passed = 0;
function check(name: string, cond: boolean, got?: unknown) {
  if (!cond) {
    console.error("FAIL:", name, "got:", JSON.stringify(got));
    throw new Error("test failed: " + name);
  }
  passed++;
}

function reset() {
  delete process.env.GEMINI_API_KEY;
  delete process.env.GROQ_API_KEY;
  delete process.env.AI_PRIMARY;
  delete process.env.GEMINI_MODEL;
  delete process.env.GROQ_MODEL;
}

async function main() {
  reset();

  // No keys -> AI is off (optional feature degrades cleanly).
  check("no key -> not configured", isAIConfigured() === false);
  check("no key -> empty label", aiChainLabel() === "");
  let threw = false;
  try {
    await generateStructured(z.object({ x: z.string() }), {
      schemaName: "t",
      systemInstruction: "s",
      prompt: "p",
    });
  } catch (e) {
    threw = e instanceof AINotConfiguredError;
  }
  check("no key -> generateStructured throws AINotConfiguredError", threw);

  // Gemini only.
  reset();
  process.env.GEMINI_API_KEY = "test-key";
  check("gemini key -> configured", isAIConfigured() === true);
  check("gemini label", aiChainLabel() === "gemini-2.5-flash-lite", aiChainLabel());

  // Gemini + Groq -> gemini primary, groq fallback by default.
  process.env.GROQ_API_KEY = "test-key-2";
  check(
    "gemini+groq label shows fallback",
    aiChainLabel() === "gemini-2.5-flash-lite (+groq fallback)",
    aiChainLabel()
  );

  // AI_PRIMARY flips the order.
  process.env.AI_PRIMARY = "groq";
  check(
    "AI_PRIMARY=groq flips order",
    aiChainLabel() === "llama-3.3-70b-versatile (+gemini fallback)",
    aiChainLabel()
  );

  // Model override is honored.
  reset();
  process.env.GEMINI_API_KEY = "k";
  process.env.GEMINI_MODEL = "gemini-3-flash-preview";
  check("GEMINI_MODEL override", aiChainLabel() === "gemini-3-flash-preview", aiChainLabel());

  // Groq only.
  reset();
  process.env.GROQ_API_KEY = "k";
  check("groq only configured", isAIConfigured() === true);
  check("groq only label", aiChainLabel() === "llama-3.3-70b-versatile", aiChainLabel());

  reset();
  console.log(`\nALL PASS (${passed} checks)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
