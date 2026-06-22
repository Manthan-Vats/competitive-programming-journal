import { z } from "zod";
import { toGeminiJsonSchema, toGroqJsonSchema } from "../lib/ai/schema";

// Unit tests for the Zod->JSON-schema bridge used by both AI providers. Run:
//   npx tsx test/ai-schema.test.ts

let passed = 0;
function check(name: string, cond: boolean, got?: unknown) {
  if (!cond) {
    console.error("FAIL:", name, "got:", JSON.stringify(got));
    throw new Error("test failed: " + name);
  }
  passed++;
}

const schema = z.object({
  algorithms: z.array(z.string()),
  confidence: z.enum(["high", "medium", "low"]),
  nested: z.object({ a: z.string() }),
});

const gem = toGeminiJsonSchema(schema) as any;
const groq = toGroqJsonSchema(schema) as any;

// Both strip the $schema meta key.
check("gemini drops $schema", gem.$schema === undefined, gem.$schema);
check("groq drops $schema", groq.$schema === undefined, groq.$schema);

// Gemini variant: additionalProperties removed everywhere (it doesn't model that key).
check("gemini drops additionalProperties (root)", gem.additionalProperties === undefined);
check(
  "gemini drops additionalProperties (nested)",
  gem.properties.nested.additionalProperties === undefined
);

// Groq strict mode requires additionalProperties:false + all keys required - z.toJSONSchema gives
// both, and we must KEEP them.
check("groq keeps additionalProperties:false (root)", groq.additionalProperties === false, groq.additionalProperties);
check(
  "groq keeps additionalProperties:false (nested)",
  groq.properties.nested.additionalProperties === false
);
check(
  "groq required lists all keys",
  JSON.stringify(groq.required) === JSON.stringify(["algorithms", "confidence", "nested"]),
  groq.required
);

// Structure is preserved in both (types, enum, array items).
check("type object preserved", gem.type === "object" && groq.type === "object");
check("enum preserved", JSON.stringify(gem.properties.confidence.enum) === JSON.stringify(["high", "medium", "low"]));
check("array items preserved", gem.properties.algorithms.items.type === "string");

console.log(`\nALL PASS (${passed} checks)`);
