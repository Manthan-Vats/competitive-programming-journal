import { z } from "zod";
import { AIProvider, AINotConfiguredError, StructuredOptions, TextOptions } from "./types";
import { createGeminiProvider } from "./gemini";
import { createGroqProvider } from "./groq";

export { AIProviderError, AINotConfiguredError } from "./types";
export type { AIProvider } from "./types";

// The AI layer is OPTIONAL, SWAPPABLE, and PER-USER (BYOK). Providers are assembled from the keys
// passed in by the caller - NOT from a shared env key - so each user's analyses spend their OWN
// Gemini quota:
//   - keys.gemini -> Gemini (the per-user key resolved by lib/ai/user-key.ts)
// If no key is passed, the chain is empty: isAIConfigured(keys) is false and callers degrade
// cleanly with no errors. Model override: GEMINI_MODEL (an instance-wide default, not a secret).
// (Groq remains plumbed for resilience but is intentionally unused on the BYOK path - the product
// decision is Gemini-only BYOK.)

const DEFAULT_TIMEOUT_MS = 30_000;

// The set of provider keys for one request. Keys are supplied per call (serverless-safe: no
// request-scoped global state that could bleed across users).
export interface AIKeys {
  gemini?: string;
}

function buildProviders(keys: AIKeys): AIProvider[] {
  const providers: AIProvider[] = [];
  if (keys.gemini) {
    providers.push(createGeminiProvider(keys.gemini, process.env.GEMINI_MODEL));
  }
  return providers;
}

// Built per call from the passed keys (cheap; no network on construction).
function providers(keys: AIKeys): AIProvider[] {
  return buildProviders(keys);
}

export function isAIConfigured(keys: AIKeys): boolean {
  return providers(keys).length > 0;
}

// A short, human label for the active chain, e.g. "gemini-2.5-flash-lite". Useful for UI copy +
// logs. Empty string when nothing is configured.
export function aiChainLabel(keys: AIKeys): string {
  const list = providers(keys);
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
  keys: AIKeys,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<AIRun<T>> {
  const chain = providers(keys);
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
  keys: AIKeys,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<AIRun<string>> {
  const chain = providers(keys);
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
