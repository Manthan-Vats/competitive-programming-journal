import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/api-error";

// List the logged-in user's extension tokens (never the hash/raw value - only
// metadata, so the user can see and revoke connected extensions).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("extension_tokens")
    .select("id, label, created_at, last_used_at, revoked_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return errorResponse("ext.tokens.GET", error, "Failed to list tokens");
  }

  return NextResponse.json(data ?? []);
}
