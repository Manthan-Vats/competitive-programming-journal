// Sentry server-side init (Node runtime). Loaded from instrumentation.ts.
// No-op unless NEXT_PUBLIC_SENTRY_DSN is set, so local dev stays quiet by default.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Performance tracing: sample 10% of transactions in prod to stay within free quota.
  tracesSampleRate: 0.1,
  // Do NOT attach cookies / headers / request bodies. This app handles per-user Gemini keys
  // (encrypted at rest) and auth cookies; keeping PII off the wire is the safe default.
  sendDefaultPii: false,
  // Belt-and-suspenders: never let a stray secret-shaped string leave the server. BYOK keys are
  // already never logged, but scrub here too in case one ends up in an exception message.
  beforeSend(event) {
    return scrubSecrets(event);
  },
});

// Redact Gemini-key-shaped tokens and the master secret from any error payload before it ships.
function scrubSecrets<T>(event: T): T {
  try {
    let json = JSON.stringify(event);
    // AIza... classic keys and AQ./IQ. new-format keys.
    json = json.replace(/\b(AIza[0-9A-Za-z._-]{20,}|A[QI]\.[0-9A-Za-z._-]{20,})\b/g, "[redacted-key]");
    return JSON.parse(json) as T;
  } catch {
    return event;
  }
}
