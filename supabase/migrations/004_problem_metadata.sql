-- 004: richer problem metadata for extension capture + realtime dashboard updates.
-- Adds a plain-text statement (sanitized/truncated by the capturer, for an at-a-glance
-- view) and a flexible JSONB bag for extra metadata (time/memory limits, sample counts,
-- enrichment source, etc.). Also enables Supabase Realtime on the problems table so the
-- dashboard updates live when the extension captures a problem (no manual refresh).

-- 1. New columns (idempotent).
ALTER TABLE problems ADD COLUMN IF NOT EXISTS statement text;
ALTER TABLE problems ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Realtime. REPLICA IDENTITY FULL so UPDATE/DELETE events carry the old row (incl.
--    user_id), which Realtime needs to evaluate the per-user RLS filter on those events.
ALTER TABLE problems REPLICA IDENTITY FULL;

-- 3. Add problems to Supabase's realtime publication, idempotently. RLS still applies to
--    realtime, so a subscriber only receives changes to rows they're allowed to read.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'problems'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE problems;
  END IF;
END $$;
