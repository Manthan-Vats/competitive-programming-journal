import { createAdminClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";

// Serverless-safe fixed-window rate limiter backed by the `rate_limits` table + the
// `check_rate_limit()` SQL function (migration 006). One round-trip per check; the counter
// lives in Postgres so it works across stateless lambda invocations (an in-memory limiter
// would reset on every cold start and not share state between instances).
// FAIL-OPEN by design: any error - the function not existing yet because 006 hasn't been
// applied, a transient DB hiccup, etc. - ALLOWS the request. Adding limiting must never be
// able to take a route down. Returns true when the request is allowed, false when limited.
export async function rateLimit(
  key: string,
  max: number,
  windowSeconds: number
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("[rate-limit] check failed (fail-open):", error.message);
      return true;
    }
    return data === true;
  } catch (err) {
    console.error("[rate-limit] unexpected error (fail-open):", err);
    return true;
  }
}

// Best-effort client IP from the proxy headers Vercel / most hosts set. Falls back to a
// single shared "unknown" bucket rather than a per-request unique value, so a stripped
// header throttles the whole anonymous pool together instead of silently disabling limiting.
export function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
