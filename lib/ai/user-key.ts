import { createAdminClient } from "@/lib/supabase/server";
import { encryptSecret, decryptSecret, isEncryptionConfigured } from "@/lib/crypto/secret-box";

// Per-user Gemini key store (BYOK). All access goes through the service-role admin client because
// `user_ai_keys` (migration 016) has RLS on with NO policies - the user's own browser can never
// read even the ciphertext. The plaintext key is only ever materialised here, server-side, at
// AI-call time; it is never returned to the client (no NEXT_PUBLIC) and never logged.

// Gemini API keys have NO single stable prefix: classic AI Studio keys are `AIza...` (~39 chars),
// but Google now also issues `AQ.`/`IQ.`-prefixed keys (2025+ rollout). So we DON'T gate on a
// prefix - that's a brittle heuristic that wrongly rejects valid new-format keys. We only sanity-
// check the shape here (single token, sane charset, sane length); the route does a real live API
// ping with the candidate, which is the actual source of truth for whether the key works.
// Charset covers all known formats: letters, digits, and the `._-` used by AQ./IQ. keys.
const GEMINI_KEY_RE = /^[A-Za-z0-9._-]{20,}$/;
const MAX_KEY_LEN = 200;

export interface KeyMeta {
  configured: boolean;
  /** Last 4 chars of the stored key for a "•••• abcd" hint. Non-sensitive. */
  hint: string | null;
}

/** Validate the shape of a candidate Gemini key. Returns a cleaned key or an error message. */
export function validateGeminiKey(raw: unknown): { value?: string; error?: string } {
  if (typeof raw !== "string") return { error: "Missing API key" };
  const key = raw.trim();
  if (!key) return { error: "Missing API key" };
  if (key.length > MAX_KEY_LEN) return { error: "That doesn't look like a valid Gemini key" };
  if (!GEMINI_KEY_RE.test(key)) {
    return { error: "That doesn't look like a Gemini API key. Paste the key from Google AI Studio with no extra spaces." };
  }
  return { value: key };
}

// Resolve the plaintext Gemini key for a user. Returns null when none is stored, encryption is
// unconfigured, or anything fails - callers treat null as "AI is off for this user".
// DEV-ONLY convenience: outside production, fall back to the instance GEMINI_API_KEY so local
// development and the live smoke test work without seeding a per-user key.
export async function getUserGeminiKey(userId: string): Promise<string | null> {
  if (isEncryptionConfigured()) {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from("user_ai_keys")
        .select("ciphertext")
        .eq("user_id", userId)
        .maybeSingle();
      if (!error && data?.ciphertext) {
        return decryptSecret(data.ciphertext);
      }
    } catch (err) {
      console.error("[ai/user-key] failed to read/decrypt user key:", (err as Error)?.message);
    }
  }
  if (process.env.NODE_ENV !== "production" && process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }
  return null;
}

// Encrypt + store (upsert) a user's key. Caller must validate first; we validate again here as a
// guard. Stores only the last-4 as a display hint alongside the ciphertext.
export async function setUserGeminiKey(userId: string, rawKey: string): Promise<void> {
  const { value, error } = validateGeminiKey(rawKey);
  if (error || !value) throw new Error(error || "Invalid API key");

  const ciphertext = encryptSecret(value);
  const key_hint = value.slice(-4);
  const admin = createAdminClient();
  const { error: upsertErr } = await admin
    .from("user_ai_keys")
    .upsert(
      { user_id: userId, provider: "gemini", ciphertext, key_hint, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  if (upsertErr) throw upsertErr;
}

export async function deleteUserGeminiKey(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("user_ai_keys").delete().eq("user_id", userId);
  if (error) throw error;
}

// Non-sensitive metadata for the Settings UI: whether a key is set and its last-4 hint. Never
// returns the key itself.
export async function getUserKeyMeta(userId: string): Promise<KeyMeta> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("user_ai_keys")
      .select("key_hint")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return { configured: false, hint: null };
    return { configured: true, hint: (data.key_hint as string | null) ?? null };
  } catch {
    return { configured: false, hint: null };
  }
}
