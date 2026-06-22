-- 011: Covering indexes for foreign keys (Supabase performance advisor `unindexed_foreign_keys`).
-- An un-indexed FK forces a sequential scan of the child table whenever the parent row is deleted
-- (the FK check) or when joining/filtering by the FK column. Cheap insurance; additive and safe.
--   - ai_analyses.solution_id  -> sped on "delete a solution" (cascade FK check) + analysis-by-solution.
--   - access_requests.reviewed_by -> sped on "requests reviewed by <operator>" lookups.
-- Idempotent.

CREATE INDEX IF NOT EXISTS idx_ai_analyses_solution
  ON ai_analyses (solution_id);

CREATE INDEX IF NOT EXISTS idx_access_requests_reviewed_by
  ON access_requests (reviewed_by);
