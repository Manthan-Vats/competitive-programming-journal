import { z } from "zod";

// One AI provider (Gemini, Groq, ...). Providers are deliberately tiny: a structured-JSON call
// (constrained + validated against a Zod schema) and a free-text call. Everything the rest of the
// app needs goes through these two methods so swapping or adding a provider is a no-op elsewhere.

export interface StructuredOptions {
  /** Schema/tool name - required by Groq's json_schema; harmless for Gemini. */
  schemaName: string;
  systemInstruction: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** Abort the request if it runs long (latency guard). */
  signal?: AbortSignal;
}

export interface TextOptions {
  systemInstruction: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
}

export interface AIProvider {
  /** Stable id: "gemini" | "groq". */
  readonly name: string;
  /** The concrete model id used for requests + recorded as model_used. */
  readonly model: string;
  generateStructured<T>(schema: z.ZodType<T>, opts: StructuredOptions): Promise<T>;
  generateText(opts: TextOptions): Promise<string>;
}

// Thrown when a provider call fails (network, quota, bad output). The registry catches these to
// fall back to the next provider; if all providers fail it surfaces the last one.
export class AIProviderError extends Error {
  constructor(
    public readonly provider: string,
    message: string,
    public readonly cause?: unknown
  ) {
    super(`[${provider}] ${message}`);
    this.name = "AIProviderError";
  }
}

// No provider is configured (no API keys). Distinct from a provider *failure* so callers can treat
// "AI is turned off" as a clean, non-error degraded state (the feature is optional by design).
export class AINotConfiguredError extends Error {
  constructor() {
    super("No AI provider is configured");
    this.name = "AINotConfiguredError";
  }
}
