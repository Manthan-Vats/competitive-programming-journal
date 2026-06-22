-- 013: Verified platform handles + stat snapshots (P3 - verifiable badge).
-- The trust mechanism: a user proves they own a judge handle by temporarily placing a one-time
-- token in an EDITABLE PUBLIC profile field (CF first name / organization, LeetCode "summary",
-- GitHub bio); we fetch the PUBLIC profile server-side and confirm the token. On success we
-- snapshot their stats (pulled from the platform, never typed) with provenance + timestamp, and
-- clear the token. Only `verified` rows are publicly readable (they power the public badge /
-- verify page); the token is null by then, so it's never exposed. Idempotent.

CREATE TABLE IF NOT EXISTS platform_verifications (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform       text NOT NULL,
  handle         text NOT NULL,
  status         text NOT NULL DEFAULT 'pending',   -- pending | verified
  tier           text NOT NULL DEFAULT 'token',     -- token | extension (strength of proof)
  token          text,                              -- one-time; cleared on successful verify
  verified_at    timestamptz,
  last_synced_at timestamptz,                        -- when the stats snapshot was taken
  source         text,                              -- provenance of the snapshot (e.g. 'codeforces:user.info+user.status')
  stats          jsonb NOT NULL DEFAULT '{}'::jsonb, -- pulled stats: solved/rating/ranking/byDifficulty...
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform),
  CONSTRAINT pv_platform_check CHECK (platform IN ('codeforces','leetcode','atcoder','codechef','github')),
  CONSTRAINT pv_status_check   CHECK (status IN ('pending','verified')),
  CONSTRAINT pv_tier_check     CHECK (tier IN ('token','extension'))
);

ALTER TABLE platform_verifications ENABLE ROW LEVEL SECURITY;

-- Single SELECT policy (verified rows are public - they power the badge + /u/<handle> verify page;
-- token is null on verified rows so it's never exposed - plus the owner sees their own pending rows)
-- and explicit per-command WRITE policies. One permissive policy per (role, action) - no overlap.
DROP POLICY IF EXISTS own_rows ON platform_verifications;
DROP POLICY IF EXISTS public_read_verified ON platform_verifications;
DROP POLICY IF EXISTS read ON platform_verifications;
DROP POLICY IF EXISTS own_insert ON platform_verifications;
DROP POLICY IF EXISTS own_update ON platform_verifications;
DROP POLICY IF EXISTS own_delete ON platform_verifications;
CREATE POLICY read ON platform_verifications FOR SELECT TO anon, authenticated
  USING (status = 'verified' OR (select auth.uid()) = user_id);
CREATE POLICY own_insert ON platform_verifications FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY own_update ON platform_verifications FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY own_delete ON platform_verifications FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_pv_user ON platform_verifications (user_id);
CREATE INDEX IF NOT EXISTS idx_pv_verified ON platform_verifications (platform, handle) WHERE status = 'verified';

DROP TRIGGER IF EXISTS update_platform_verifications_updated_at ON platform_verifications;
CREATE TRIGGER update_platform_verifications_updated_at
  BEFORE UPDATE ON platform_verifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
