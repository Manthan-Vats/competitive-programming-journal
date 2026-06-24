-- 016: Per-user "Bring Your Own Key" storage for the AI provider (Gemini).
-- The app launches multi-tenant, so the single shared GEMINI_API_KEY would be exhausted
-- instantly across users (and bill the operator). Instead each user supplies their OWN free
-- Gemini key. We store it ENCRYPTED AT REST (AES-256-GCM, see lib/crypto/secret-box.ts):
-- the ciphertext lives here, the master encryption key lives only in the server env
-- (AI_KEY_ENC_SECRET) - so a database leak alone exposes nothing.
--
-- RLS is ON with NO policies, exactly like rate_limits (migration 006): only the service-role
-- client (which bypasses RLS) can read or write this table - the lib/ai/user-key.ts admin path.
-- A user's browser can therefore never read even the ciphertext. The plaintext key is decrypted
-- only in-process, at AI-call time, and is never returned to the client or logged.
-- Idempotent: safe to run on an existing database.

CREATE TABLE IF NOT EXISTS user_ai_keys (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  provider   text NOT NULL DEFAULT 'gemini' CHECK (provider = 'gemini'),
  ciphertext text NOT NULL,        -- base64( iv(12) || authTag(16) || ciphertext )
  key_hint   text,                 -- last 4 chars only, for the "•••• abcd" UI hint (non-sensitive)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_ai_keys ENABLE ROW LEVEL SECURITY;
-- Intentionally NO policies: only the service-role (RLS-bypassing) client may touch this table.
