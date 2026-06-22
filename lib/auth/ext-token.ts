// Per-user extension bearer tokens (P2). The web app mints a random token while
// the user is logged in; we store only its SHA-256 hash. The extension presents
// the raw token as `Authorization: Bearer <token>`; we hash + look it up to resolve
// the user. No Supabase session is involved on the extension side, so token-authed
// routes use the service-role client and stamp user_id explicitly.

import { randomBytes, createHash } from "crypto";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

const TOKEN_PREFIX = "cpj_";

/** A fresh, URL-safe random token (raw - shown to the user exactly once). */
export function generateRawToken(): string {
  return TOKEN_PREFIX + randomBytes(32).toString("base64url");
}

/** SHA-256 hex of a raw token. Only this is ever stored. */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Pull the bearer token out of the Authorization header, if present. */
export function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export interface ExtensionIdentity {
  userId: string;
  tokenId: string;
}

/**
 * Resolve the user behind a presented extension bearer token. Returns null if the
 * header is missing, the token is unknown, or it has been revoked. Side effect:
 * bumps last_used_at on success. Uses the service-role client (the extension is
 * not a Supabase session), so callers MUST scope all writes to the returned userId.
 */
export async function resolveExtensionUser(
  request: NextRequest
): Promise<ExtensionIdentity | null> {
  const raw = getBearerToken(request);
  if (!raw) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("extension_tokens")
    .select("id, user_id, revoked_at")
    .eq("token_hash", hashToken(raw))
    .maybeSingle();

  if (error || !data || data.revoked_at) return null;

  // Best-effort usage stamp; don't fail the request if it doesn't land.
  await admin
    .from("extension_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return { userId: data.user_id, tokenId: data.id };
}
