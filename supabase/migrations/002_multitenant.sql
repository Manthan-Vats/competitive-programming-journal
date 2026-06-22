-- 002_multitenant.sql - Per-user multi-tenancy + invite-only access (P1).
-- This SUPERSEDES the single-owner model (the old 002_owner_model.sql, now deleted).
-- It turns the single-owner app into a per-user multi-tenant product:
--   * every user-owned row carries a user_id (the row's owner);
--   * RLS lets a user do anything to their OWN rows, and lets anyone read rows the
--     owner has explicitly published (is_public / is_public_code);
--   * private by default - new rows are unpublished until toggled public;
--   * an access_requests table backs the public "request access" -> owner-approve ->
--     inviteUserByEmail() invite flow.
-- It fixes the audit root cause (B1: any authenticated user was a full admin via
-- `admin_all USING (auth.uid() IS NOT NULL)`) and B2 (public by default), and applies
-- the locked RLS performance rules: (select auth.uid()), TO-scoped policies, indexed
-- user_id columns.
--  BEFORE YOU RUN THIS:
--   1. At least one auth user must already exist (the operator). Existing rows
--      are backfilled to the EARLIEST-created auth user. If that is not the
--      operator, edit the three backfill blocks below to the correct UID.
--   2. In the dashboard, DISABLE public sign-ups
--      (Authentication -> Sign In / Providers -> Email -> turn off "Allow new
--      users to sign up"). Access is then invite-only via inviteUserByEmail().
--   3. Set OWNER_USER_ID in .env.local to the operator's UID - it gates the
--      invite-approval screen/route (app layer); the per-row RLS below does
--      NOT depend on it.

BEGIN;

-- 1. Add ownership columns (nullable first so we can backfill, then NOT NULL).
ALTER TABLE problems        ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE solutions       ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ai_analyses     ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE timing_sessions ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Backfill. Existing rows belong to the operator = the earliest auth user.
--    Child tables inherit their parent problem's owner. Edit the operator
--    selection here if the earliest user is not the operator.
UPDATE problems
   SET user_id = (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
 WHERE user_id IS NULL;

UPDATE solutions s
   SET user_id = p.user_id
  FROM problems p
 WHERE p.id = s.problem_id AND s.user_id IS NULL;

UPDATE timing_sessions t
   SET user_id = p.user_id
  FROM problems p
 WHERE p.id = t.problem_id AND t.user_id IS NULL;

UPDATE ai_analyses a
   SET user_id = s.user_id
  FROM solutions s
 WHERE s.id = a.solution_id AND a.user_id IS NULL;

-- Enforce ownership now that every existing row has an owner.
ALTER TABLE problems        ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE solutions       ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE ai_analyses     ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE timing_sessions ALTER COLUMN user_id SET NOT NULL;

-- 3. Problem URL uniqueness becomes PER-USER (two users may solve the same URL).
--    The 001 schema had `url TEXT UNIQUE` -> constraint problems_url_key.
ALTER TABLE problems DROP CONSTRAINT IF EXISTS problems_url_key;
ALTER TABLE problems ADD CONSTRAINT problems_user_url_unique UNIQUE (user_id, url);

-- 4. Indexes on every column used by RLS policies (locked perf rule: >100x on
--    large tables).
CREATE INDEX IF NOT EXISTS idx_problems_user        ON problems(user_id);
CREATE INDEX IF NOT EXISTS idx_solutions_user       ON solutions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_user     ON ai_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_timing_sessions_user ON timing_sessions(user_id);

-- 5. Private by default (was DEFAULT TRUE in 001). New rows stay unpublished
--    until their owner explicitly toggles them public. (audit B2)
ALTER TABLE problems  ALTER COLUMN is_public      SET DEFAULT FALSE;
ALTER TABLE solutions ALTER COLUMN is_public_code SET DEFAULT FALSE;

-- (OPTIONAL) Retroactively unpublish everything captured under the old
-- public-by-default behaviour, then re-publish deliberately. Uncomment to apply.
-- UPDATE problems  SET is_public      = FALSE;
-- UPDATE solutions SET is_public_code = FALSE;

-- 6. RLS rewrite: drop the over-broad 001 policies, install per-user ownership
--    + explicit public-read. All policies are TO-scoped and wrap auth.uid() in a
--    subselect so Postgres evaluates it once per query (initPlan), not per row.

-- problems
DROP POLICY IF EXISTS "admin_all"   ON problems;
DROP POLICY IF EXISTS "public_read" ON problems;

CREATE POLICY "own_rows" ON problems
  FOR ALL TO authenticated
  USING ( (select auth.uid()) = user_id )
  WITH CHECK ( (select auth.uid()) = user_id );

CREATE POLICY "public_read" ON problems
  FOR SELECT TO anon, authenticated
  USING ( is_public = true );

-- solutions
DROP POLICY IF EXISTS "admin_all"   ON solutions;
DROP POLICY IF EXISTS "public_read" ON solutions;

CREATE POLICY "own_rows" ON solutions
  FOR ALL TO authenticated
  USING ( (select auth.uid()) = user_id )
  WITH CHECK ( (select auth.uid()) = user_id );

CREATE POLICY "public_read" ON solutions
  FOR SELECT TO anon, authenticated
  USING (
    is_public_code = true AND
    EXISTS (SELECT 1 FROM problems WHERE id = problem_id AND is_public = true)
  );

-- ai_analyses
DROP POLICY IF EXISTS "admin_all"   ON ai_analyses;
DROP POLICY IF EXISTS "public_read" ON ai_analyses;

CREATE POLICY "own_rows" ON ai_analyses
  FOR ALL TO authenticated
  USING ( (select auth.uid()) = user_id )
  WITH CHECK ( (select auth.uid()) = user_id );

CREATE POLICY "public_read" ON ai_analyses
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM solutions s
      JOIN problems p ON p.id = s.problem_id
      WHERE s.id = solution_id AND s.is_public_code = true AND p.is_public = true
    )
  );

-- timing_sessions
DROP POLICY IF EXISTS "admin_all"   ON timing_sessions;
DROP POLICY IF EXISTS "public_read" ON timing_sessions;

CREATE POLICY "own_rows" ON timing_sessions
  FOR ALL TO authenticated
  USING ( (select auth.uid()) = user_id )
  WITH CHECK ( (select auth.uid()) = user_id );

CREATE POLICY "public_read" ON timing_sessions
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (SELECT 1 FROM problems WHERE id = problem_id AND is_public = true)
  );

-- 7. Profile becomes one row PER USER, with a public username (the /u/<handle>
--    namespace). The 001 table was a single anonymous row.
ALTER TABLE profile ADD COLUMN IF NOT EXISTS user_id  uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE profile ADD COLUMN IF NOT EXISTS username text;

-- Backfill the existing single profile row to the operator.
UPDATE profile
   SET user_id = (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
 WHERE user_id IS NULL;

ALTER TABLE profile ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE profile ADD CONSTRAINT profile_user_id_unique UNIQUE (user_id);
-- Case-insensitive uniqueness for handles; NULLs allowed (username is opt-in).
CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_username_ci ON profile (lower(username));

DROP POLICY IF EXISTS "admin_all"   ON profile;
DROP POLICY IF EXISTS "public_read" ON profile;

CREATE POLICY "own_rows" ON profile
  FOR ALL TO authenticated
  USING ( (select auth.uid()) = user_id )
  WITH CHECK ( (select auth.uid()) = user_id );

-- Profiles are publicly readable (powers the public portfolio + P3 verify page).
CREATE POLICY "public_read" ON profile
  FOR SELECT TO anon, authenticated
  USING ( true );

-- 8. access_requests - backs the invite-only "request access" flow.
--    Anyone may submit a request; only the operator (via the service-role admin
--    client, server-side) may read or act on them. There is deliberately NO
--    SELECT/UPDATE policy, so RLS denies all anon/authenticated reads.
CREATE TABLE IF NOT EXISTS access_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  note        text,
  status      text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'invited', 'rejected')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_access_requests_status  ON access_requests(status);
CREATE INDEX IF NOT EXISTS idx_access_requests_created ON access_requests(created_at DESC);

ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;

-- Public may insert a pending request only (no read-back, no status injection).
CREATE POLICY "anon_request_access" ON access_requests
  FOR INSERT TO anon, authenticated
  WITH CHECK ( status = 'pending' );

COMMIT;
