-- 006: In-DB fixed-window rate limiting (serverless-safe).
-- The app runs on stateless serverless functions, so an in-memory limiter would reset on
-- every cold start and never share state between concurrent instances. Instead we keep the
-- counter in Postgres: a tiny table keyed by (bucket key, window start) plus a SECURITY-
-- sensitive helper function that atomically upserts+increments the current window and tells
-- the caller whether they're still under the cap.
-- RLS is ON with NO policies, so only the service-role client (which bypasses RLS) can read
-- or write the table - exactly the lib/rate-limit.ts admin client. lib/rate-limit.ts FAILS
-- OPEN, so the app keeps working even before this migration is applied.
-- Idempotent: safe to run on an existing database.

CREATE TABLE IF NOT EXISTS rate_limits (
  key          text        NOT NULL,
  window_start timestamptz NOT NULL,
  count        integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
-- Intentionally NO policies: only service-role (RLS-bypassing) may touch this table.

-- Fixed-window counter. Buckets wall-clock time into [floor(now/window)*window, +window)
-- and atomically bumps the count for the current bucket, returning TRUE while count <= max.
-- A fixed window (vs. sliding) is cheap and good enough for abuse/cost control here.
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key text,
  p_max integer,
  p_window_seconds integer
) RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_window_start timestamptz;
  v_count        integer;
BEGIN
  -- Opportunistic, cheap self-maintenance so the table can't grow unbounded without a cron
  -- job: ~0.5% of calls sweep windows older than a day.
  IF random() < 0.005 THEN
    DELETE FROM rate_limits WHERE window_start < now() - interval '1 day';
  END IF;

  v_window_start := to_timestamp(
    floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds
  );

  -- Atomic per-row upsert+increment. The WHERE on the UPDATE stops incrementing (and thus
  -- stops writing) once the window is already saturated: a saturated conflict matches no row,
  -- so RETURNING yields no row and v_count stays NULL -> treated as over-limit. This both
  -- rate-limits correctly under concurrency (Postgres serializes the row lock) and caps the
  -- stored counter at p_max, preventing write-amplification from a sustained flood.
  INSERT INTO rate_limits (key, window_start, count)
  VALUES (p_key, v_window_start, 1)
  ON CONFLICT (key, window_start)
  DO UPDATE SET count = rate_limits.count + 1
    WHERE rate_limits.count < p_max
  RETURNING count INTO v_count;

  IF v_count IS NULL THEN
    RETURN false; -- update filtered out -> already at the cap
  END IF;

  RETURN v_count <= p_max;
END;
$$;

-- Opportunistic cleanup so the table never grows unbounded. Stale windows (older than a day)
-- are irrelevant once their window has passed. Call ad-hoc or from a scheduled job.
CREATE OR REPLACE FUNCTION prune_rate_limits() RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM rate_limits WHERE window_start < now() - interval '1 day';
$$;
