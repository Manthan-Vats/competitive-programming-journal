-- 010: Validate the CHECK constraints that 007 added as NOT VALID.
-- 007 added them NOT VALID so the migration couldn't fail on any pre-existing/legacy row; new and
-- updated rows have been enforced ever since (NOT VALID only skips the one-time existing-row scan).
-- Verified against the LIVE database (session #11, via the Supabase MCP) that ALL existing rows
-- already conform - 0 violations across every constraint, no NULLs in the constrained columns - so
-- validating now is safe. Validating makes the constraints enforced for existing rows too and lets
-- the query planner trust them.
-- VALIDATE CONSTRAINT takes only a SHARE UPDATE EXCLUSIVE lock (no full table lock) and is a no-op
-- if the constraint is already validated, so this is safe + idempotent.

ALTER TABLE problems        VALIDATE CONSTRAINT problems_platform_check;
ALTER TABLE problems        VALIDATE CONSTRAINT problems_difficulty_norm_check;
ALTER TABLE solutions       VALIDATE CONSTRAINT solutions_language_check;
ALTER TABLE solutions       VALIDATE CONSTRAINT solutions_ai_status_check;
ALTER TABLE ai_analyses     VALIDATE CONSTRAINT ai_analyses_confidence_check;
ALTER TABLE timing_sessions VALIDATE CONSTRAINT timing_sessions_order_check;
