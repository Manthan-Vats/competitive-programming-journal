import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { resolveExtensionUser } from "@/lib/auth/ext-token";

// Identity check for the extension: validate the bearer token and report who it
// belongs to (so the popup can show "Connected as ..."). Uses the service-role
// client only to read the linked user's public-ish profile fields.
export async function GET(request: NextRequest) {
  const identity = await resolveExtensionUser(request);
  if (!identity) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profile")
    .select("username, display_name")
    .eq("user_id", identity.userId)
    .maybeSingle();

  return NextResponse.json({
    user_id: identity.userId,
    username: profile?.username ?? null,
    display_name: profile?.display_name ?? null,
  });
}
