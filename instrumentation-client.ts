// Sentry browser init. Runs in the client bundle. No-op unless NEXT_PUBLIC_SENTRY_DSN is set.
// Client errors are tunneled through a same-origin route (see next.config.ts `tunnelRoute`), which
// dodges ad-blockers and keeps the CSP connect-src tight (no third-party ingest origin needed).
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
});

// Capture navigations in the App Router for tracing.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
