import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { AIProvider, AIProviderError, StructuredOptions, TextOptions } from "./types";
import { toGeminiJsonSchema } from "./schema";

// Gemini provider (Google AI Studio / Developer API). Default model gemini-2.5-flash-lite: strong
// code reasoning, 1M context, 250K TPM free - comfortably above this app's needs. Structured output
// goes through `responseJsonSchema` (NOT a raw Zod object, which the SDK does not accept - the prior
// untested code passed Zod directly, which is why analysis never produced output). We validate the
// parsed JSON against the Zod schema ourselves so a malformed response is treated as a failure.

const DEFAULT_MODEL = "gemini-2.5-flash-lite";

export function createGeminiProvider(apiKey: string, model = DEFAULT_MODEL): AIProvider {
  const ai = new GoogleGenAI({ apiKey });

  return {
    name: "gemini",
    model,

    async generateStructured<T>(schema: z.ZodType<T>, opts: StructuredOptions): Promise<T> {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: opts.prompt,
          config: {
            systemInstruction: opts.systemInstruction,
            responseMimeType: "application/json",
            responseJsonSchema: toGeminiJsonSchema(schema),
            temperature: opts.temperature ?? 0,
            ...(opts.maxOutputTokens ? { maxOutputTokens: opts.maxOutputTokens } : {}),
            ...(opts.signal ? { abortSignal: opts.signal } : {}),
          },
        });

        const text = response.text;
        if (!text) throw new AIProviderError("gemini", "empty response");

        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new AIProviderError("gemini", "response was not valid JSON");
        }
        const result = schema.safeParse(parsed);
        if (!result.success) {
          throw new AIProviderError("gemini", `response failed schema validation: ${result.error.message}`);
        }
        return result.data;
      } catch (err) {
        if (err instanceof AIProviderError) throw err;
        throw new AIProviderError("gemini", (err as Error)?.message || "request failed", err);
      }
    },

    async generateText(opts: TextOptions): Promise<string> {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: opts.prompt,
          config: {
            systemInstruction: opts.systemInstruction,
            temperature: opts.temperature ?? 0.4,
            ...(opts.maxOutputTokens ? { maxOutputTokens: opts.maxOutputTokens } : {}),
            ...(opts.signal ? { abortSignal: opts.signal } : {}),
          },
        });
        const text = response.text;
        if (!text) throw new AIProviderError("gemini", "empty response");
        return text;
      } catch (err) {
        if (err instanceof AIProviderError) throw err;
        throw new AIProviderError("gemini", (err as Error)?.message || "request failed", err);
      }
    },
  };
}
