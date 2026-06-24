import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getUserKeyMeta,
  setUserGeminiKey,
  deleteUserGeminiKey,
  validateGeminiKey,
} from "@/lib/ai/user-key";
import { isEncryptionConfigured } from "@/lib/crypto/secret-box";
import { generateText } from "@/lib/ai";
import { rateLimit } from "@/lib/rate-limit";
import { errorResponse } from "@/lib/api-error";

// Per-user Gemini key management (BYOK). The key is encrypted at rest (lib/crypto/secret-box.ts)
// and only ever decrypted server-side at AI-call time; this route never returns the key itself,
// only non-sensitive metadata ({ configured, hint }).

export const runtime = "nodejs";

// Returns whether the caller has a key set + its last-4 hint. Never returns the key.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const meta = await getUserKeyMeta(user.id);
    return NextResponse.json({ ...meta, encryption_ready: isEncryptionConfigured() });
  } catch (err) {
    return errorResponse("ai-key.GET", err, "Failed to read key status");
  }
}

// Save (or replace) the caller's Gemini key. Validates the shape, does a tiny live check against
// the Gemini API to confirm the key actually works, then stores it encrypted.
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isEncryptionConfigured()) {
    // Operator misconfiguration - fail loudly rather than storing under a weak/empty secret.
    return NextResponse.json(
      { error: "Key storage is not configured on this instance. Contact the operator." },
      { status: 503 }
    );
  }

  // A live check spends one tiny model request; throttle so this can't be abused to probe keys.
  if (!(await rateLimit(`ai-key:${user.id}`, 10, 600))) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { value, error } = validateGeminiKey(body?.api_key);
    if (error || !value) {
      return NextResponse.json({ error: error || "Invalid API key" }, { status: 400 });
    }

    // Live check: a minimal generation with the candidate key. Rejects bad/revoked keys before we
    // store them, so the user gets immediate feedback instead of silent failures later.
    try {
      await generateText(
        { systemInstruction: "Reply with the single word: ok.", prompt: "ping", maxOutputTokens: 5 },
        { gemini: value },
        12_000
      );
    } catch {
      return NextResponse.json(
        { error: "That key didn't work. Check it's a valid Gemini API key with the Generative Language API enabled." },
        { status: 400 }
      );
    }

    await setUserGeminiKey(user.id, value);
    const meta = await getUserKeyMeta(user.id);
    return NextResponse.json(meta);
  } catch (err) {
    return errorResponse("ai-key.PUT", err, "Failed to save key");
  }
}

// Remove the caller's stored key. AI features then degrade to off for this user.
export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await deleteUserGeminiKey(user.id);
    return NextResponse.json({ configured: false, hint: null });
  } catch (err) {
    return errorResponse("ai-key.DELETE", err, "Failed to remove key");
  }
}
