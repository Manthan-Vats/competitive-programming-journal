-- 003_extension.sql - Per-user extension tokens (P2 auth).
-- The capture/import extension authenticates to OUR API with a per-user bearer
-- token (retiring the shared COMPANION_TOKEN for end users, per P1 D4). The web
-- app mints a random token while the user is logged in (same-origin, so the
-- Supabase cookie is sent) and stores only its SHA-256 HASH here. The extension
-- presents the raw token as `Authorization: Bearer <token>`; the server hashes it
-- and resolves the user. Tokens are revocable.

BEGIN;

CREATE TABLE IF NOT EXISTS extension_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash   text NOT NULL UNIQUE,           -- SHA-256 hex of the raw token; raw is never stored
  label        text,                            -- e.g. "Chrome on laptop"
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_extension_tokens_user ON extension_tokens(user_id);

ALTER TABLE extension_tokens ENABLE ROW LEVEL SECURITY;

-- A user manages (lists/revokes) their own tokens. Token validation itself happens
-- server-side via the service-role client (the extension has no Supabase session),
-- so there is intentionally no public/anon policy here.
CREATE POLICY "own_rows" ON extension_tokens
  FOR ALL TO authenticated
  USING ( (select auth.uid()) = user_id )
  WITH CHECK ( (select auth.uid()) = user_id );

COMMIT;
