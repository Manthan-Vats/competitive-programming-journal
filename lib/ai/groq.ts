import { z } from "zod";
import { AIProvider, AIProviderError, StructuredOptions, TextOptions } from "./types";
import { toGroqJsonSchema } from "./schema";

// Groq provider - OPTIONAL fallback. Groq's API is OpenAI-compatible, so a plain fetch to the
// chat/completions endpoint avoids pulling in another SDK. Its appeal here is resilience: a second,
// independent free quota and the fastest inference if the primary is rate-limited or slow. Structured
// output uses `response_format: json_schema` with strict mode (constrained decoding -> guaranteed
// schema adherence); we still validate against the Zod schema for defense-in-depth.
// Default model llama-3.3-70b-versatile: strong code reasoning on the free tier. Override with
// GROQ_MODEL if you prefer e.g. openai/gpt-oss-120b.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

interface ChatChoice {
  message?: { content?: string | null };
}
interface ChatResponse {
  choices?: ChatChoice[];
  error?: { message?: string };
}

export function createGroqProvider(apiKey: string, model = DEFAULT_MODEL): AIProvider {
  async function chat(body: Record<string, unknown>, signal?: AbortSignal): Promise<string> {
    let res: Response;
    try {
      res = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model, ...body }),
        signal,
      });
    } catch (err) {
      throw new AIProviderError("groq", (err as Error)?.message || "network error", err);
    }

    const json = (await res.json().catch(() => ({}))) as ChatResponse;
    if (!res.ok) {
      throw new AIProviderError("groq", json.error?.message || `HTTP ${res.status}`);
    }
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new AIProviderError("groq", "empty response");
    return content;
  }

  return {
    name: "groq",
    model,

    async generateStructured<T>(schema: z.ZodType<T>, opts: StructuredOptions): Promise<T> {
      const content = await chat(
        {
          messages: [
            { role: "system", content: opts.systemInstruction },
            { role: "user", content: opts.prompt },
          ],
          temperature: opts.temperature ?? 0,
          ...(opts.maxOutputTokens ? { max_tokens: opts.maxOutputTokens } : {}),
          response_format: {
            type: "json_schema",
            json_schema: {
              name: opts.schemaName,
              strict: true,
              schema: toGroqJsonSchema(schema),
            },
          },
        },
        opts.signal
      );

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new AIProviderError("groq", "response was not valid JSON");
      }
      const result = schema.safeParse(parsed);
      if (!result.success) {
        throw new AIProviderError("groq", `response failed schema validation: ${result.error.message}`);
      }
      return result.data;
    },

    async generateText(opts: TextOptions): Promise<string> {
      return chat(
        {
          messages: [
            { role: "system", content: opts.systemInstruction },
            { role: "user", content: opts.prompt },
          ],
          temperature: opts.temperature ?? 0.4,
          ...(opts.maxOutputTokens ? { max_tokens: opts.maxOutputTokens } : {}),
        },
        opts.signal
      );
    },
  };
}
