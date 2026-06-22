import { NextResponse } from "next/server";

// Centralized error response for API routes. Raw `err.message` from Supabase/PostgREST can
// leak DB column names, constraint text, internal hostnames, and other implementation detail
// (audit P2-3). This logs the real error SERVER-SIDE (tagged for grep) and returns a generic,
// caller-safe message with the chosen status.
// Use for catch blocks around DB writes/reads. For routes that intentionally surface a curated
// message (invite SMTP guidance, validation hints), keep returning that explicit message.
export function errorResponse(
  tag: string,
  err: unknown,
  clientMessage: string,
  status = 500
): NextResponse {
  const detail =
    err instanceof Error
      ? `${err.message}`
      : typeof err === "string"
        ? err
        : (() => {
            try {
              return JSON.stringify(err);
            } catch {
              return String(err);
            }
          })();
  console.error(`[${tag}]`, detail);
  return NextResponse.json({ error: clientMessage }, { status });
}
