import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// LIVE smoke test - actually calls the configured AI provider end-to-end. NOT part of the offline
// test suite (it spends a real request). Run it ONCE after adding a key to confirm the provider +
// structured output work:
//   npx tsx test/ai-live-smoke.ts
// It loads GEMINI_API_KEY / GROQ_API_KEY / AI_PRIMARY / *_MODEL from .env.local so you don't have to
// export them. If no key is present it explains what to add and exits 0 (AI is optional).

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2].trim().replace(/^["']|["']$/g, "");
      if (/^(GEMINI_API_KEY|GROQ_API_KEY|AI_PRIMARY|GEMINI_MODEL|GROQ_MODEL)$/.test(key)) {
        if (val && !val.startsWith("your-")) process.env[key] = val;
      }
    }
  } catch {
    // no .env.local - rely on the ambient environment
  }
}

async function main() {
  loadEnvLocal();
  const { isAIConfigured, aiChainLabel } = await import("../lib/ai");
  const { analyzeCode } = await import("../lib/ai/analyze-code");
  const { generateHint } = await import("../lib/ai/assist");

  // BYOK: the key is supplied per call. For this offline smoke test we read GEMINI_API_KEY directly.
  const keys = { gemini: process.env.GEMINI_API_KEY };

  if (!isAIConfigured(keys)) {
    console.log(
      "AI is not configured. Add a real GEMINI_API_KEY (aistudio.google.com) to .env.local, then re-run."
    );
    return;
  }

  console.log("Provider chain:", aiChainLabel(keys));

  console.log("\n[1/2] analyzeCode (structured) ...");
  const analysis = await analyzeCode(
    { title: "Two Sum", platform: "leetcode", source_tags: ["array", "hash table"] },
    {
      language: "python",
      code:
        "def twoSum(nums, target):\n    seen={}\n    for i,x in enumerate(nums):\n        if target-x in seen:\n            return [seen[target-x], i]\n        seen[x]=i",
    },
    keys
  );
  console.log("  model:", analysis.model, "(via", analysis.provider + ")");
  console.log("  result:", JSON.stringify(analysis.data));

  console.log("\n[2/2] generateHint (structured) ...");
  const hint = await generateHint(
    {
      title: "Two Sum",
      platform: "leetcode",
      statement: "Return indices of the two numbers that add up to target.",
      tags: ["array", "hash table"],
    },
    keys
  );
  console.log("  hints:", JSON.stringify(hint.data.hints));

  console.log("\nLIVE SMOKE OK");
}

main().catch((e) => {
  console.error("LIVE SMOKE FAILED:", e);
  process.exit(1);
});
