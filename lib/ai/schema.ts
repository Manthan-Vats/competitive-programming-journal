import { z } from "zod";

// Bridge a Zod schema (our single source of truth for AI output shape + validation) to the
// JSON Schema each provider expects. Zod v4's z.toJSONSchema already emits draft-2020-12 with
// `additionalProperties:false` and all keys in `required` - which is exactly what Groq's strict
// structured-output mode needs. Gemini's `responseJsonSchema` only accepts a subset, so we strip
// the keys it doesn't model.
// Keeping ONE schema per task and deriving both the request schema and the runtime validator from
// it means the model is constrained and the response is verified against the same contract.

type JsonNode = Record<string, unknown>;

function deepClean(node: unknown, opts: { dropAdditionalProperties: boolean }): unknown {
  if (Array.isArray(node)) return node.map((n) => deepClean(n, opts));
  if (node && typeof node === "object") {
    const out: JsonNode = {};
    for (const [k, v] of Object.entries(node as JsonNode)) {
      // $schema / $id / $defs are meta keys the providers don't want inline.
      if (k === "$schema" || k === "$id") continue;
      if (opts.dropAdditionalProperties && k === "additionalProperties") continue;
      out[k] = deepClean(v, opts);
    }
    return out;
  }
  return node;
}

// Plain JSON Schema for Gemini's `responseJsonSchema` (it doesn't model additionalProperties).
export function toGeminiJsonSchema(schema: z.ZodType): JsonNode {
  const raw = z.toJSONSchema(schema, { target: "draft-2020-12" }) as JsonNode;
  return deepClean(raw, { dropAdditionalProperties: true }) as JsonNode;
}

// JSON Schema for Groq's OpenAI-compatible `response_format.json_schema` strict mode. Strict mode
// REQUIRES additionalProperties:false and every property listed in `required` - z.toJSONSchema
// already satisfies both, so we only drop the $schema meta key.
export function toGroqJsonSchema(schema: z.ZodType): JsonNode {
  const raw = z.toJSONSchema(schema, { target: "draft-2020-12" }) as JsonNode;
  return deepClean(raw, { dropAdditionalProperties: false }) as JsonNode;
}
