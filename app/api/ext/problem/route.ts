import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { resolveExtensionUser } from "@/lib/auth/ext-token";

// "Is this problem already in the journal?" - by canonical URL, for the extension's
// resume / on-file detection (T1). Bearer-authed; scoped to the resolved user.
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const identity = await resolveExtensionUser(request);
  if (!identity) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = request.nextUrl.searchParams.get("url");
  const url = raw?.trim().slice(0, 2048);
  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("problems")
    .select("id")
    .eq("user_id", identity.userId)
    .eq("url", url)
    .maybeSingle();

  return NextResponse.json({ exists: !!data, problem_id: data?.id ?? null });
}
