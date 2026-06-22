import { z } from "zod";
import { AIProvider, AINotConfiguredError, StructuredOptions, TextOptions } from "./types";
import { createGeminiProvider } from "./gemini";
import { createGroqProvider } from "./groq";

export { AIProviderError, AINotConfiguredError } from "./types";
export type { AIProvider } from "./types";

// The AI layer is OPTIONAL and SWAPPABLE. Providers are assembled from whatever keys are present:
//   - GEMINI_API_KEY  -> Gemini  (primary by default; best fit for this app - see docs)
//   - GROQ_API_KEY    -> Groq    (optional fallback: a 2nd free quota + fastest inference)
// AI_PRIMARY ("gemini" | "groq") flips the order. If a key is absent, that provider is simply not
// in the chain. If NO keys are present, isAIConfigured() is false and callers degrade cleanly with
// no errors. Per-provider model overrides: GEMINI_MODEL, GROQ_MODEL.

const DEFAULT_TIMEOUT_MS = 30_000;

function buildProviders(): AIProvider[] {
  const providers: Record<string, AIProvider> = {};
  if (process.env.GEMINI_API_KEY) {
    providers.gemini = createGeminiProvider(process.env.GEMINI_API_KEY, process.env.GEMINI_MODEL);
  }
  if (process.env.GROQ_API_KEY) {
    providers.groq = createGroqProvider(process.env.GROQ_API_KEY, process.env.GROQ_MODEL);
  }

  const primary = (process.env.AI_PRIMARY || "gemini").toLowerCase();
  const order = primary === "groq" ? ["groq", "gemini"] : ["gemini", "groq"];
  return order.map((n) => providers[n]).filter((p): p is AIProvider => !!p);
}

// Rebuilt per call so it always reflects the current env (cheap; no network on construction).
function providers(): AIProvider[] {
  return buildProviders();
}

export function isAIConfigured(): boolean {
  return providers().length > 0;
}

// A short, human label for the active chain, e.g. "gemini-2.5-flash-lite (+groq fallback)". Useful
// for UI copy + logs. Empty string when nothing is configured.
export function aiChainLabel(): string {
  const list = providers();
  if (list.length === 0) return "";
  const [head, ...rest] = list;
  return rest.length ? `${head.model} (+${rest.map((p) => p.name).join(", ")} fallback)` : head.model;
}

function withTimeout(signal?: AbortSignal, ms = DEFAULT_TIMEOUT_MS): { signal: AbortSignal; clear: () => void } {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  if (signal) {
    if (signal.aborted) ctrl.abort();
    else signal.addEventListener("abort", () => ctrl.abort(), { once: true });
  }
  return { signal: ctrl.signal, clear: () => clearTimeout(timer) };
}

export interface AIRun<T> {
  data: T;
  /** The model that actually produced the result (records as model_used / shown in UI). */
  model: string;
  /** The provider that succeeded after any fallbacks. */
  provider: string;
}

// Run a structured call across the provider chain: try the primary, and on ANY provider failure
// (quota, outage, malformed output) fall through to the next. Throws AINotConfiguredError if no
// provider exists, or the last AIProviderError if every provider failed.
export async function generateStructured<T>(
  schema: z.ZodType<T>,
  opts: StructuredOptions,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<AIRun<T>> {
  const chain = providers();
  if (chain.length === 0) throw new AINotConfiguredError();

  let lastErr: unknown;
  for (const provider of chain) {
    const { signal, clear } = withTimeout(opts.signal, timeoutMs);
    try {
      const data = await provider.generateStructured(schema, { ...opts, signal });
      return { data, model: provider.model, provider: provider.name };
    } catch (err) {
      lastErr = err;
      console.warn(`[ai] ${provider.name} failed, trying next:`, (err as Error)?.message);
    } finally {
      clear();
    }
  }
  throw lastErr;
}

export async function generateText(
  opts: TextOptions,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<AIRun<string>> {
  const chain = providers();
  if (chain.length === 0) throw new AINotConfiguredError();

  let lastErr: unknown;
  for (const provider of chain) {
    const { signal, clear } = withTimeout(opts.signal, timeoutMs);
    try {
      const data = await provider.generateText({ ...opts, signal });
      return { data, model: provider.model, provider: provider.name };
    } catch (err) {
      lastErr = err;
      console.warn(`[ai] ${provider.name} failed, trying next:`, (err as Error)?.message);
    } finally {
      clear();
    }
  }
  throw lastErr;
}
