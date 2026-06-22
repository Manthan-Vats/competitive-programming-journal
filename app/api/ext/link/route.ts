import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateRawToken, hashToken } from "@/lib/auth/ext-token";
import { errorResponse } from "@/lib/api-error";

// Mint a new extension token for the logged-in user. Called same-origin from the
// /extension/connect page, so the Supabase session cookie is sent and we auth
// exactly like any other route. Returns the raw token ONCE; only its hash is stored.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const label =
      typeof body.label === "string" && body.label.trim()
        ? body.label.trim().slice(0, 80)
        : "Browser extension";

    const raw = generateRawToken();

    const { error } = await supabase.from("extension_tokens").insert({
      user_id: user.id,
      token_hash: hashToken(raw),
      label,
    });

    if (error) throw error;

    return NextResponse.json({ token: raw, label });
  } catch (err) {
    return errorResponse("ext.link", err, "Failed to create token");
  }
}
