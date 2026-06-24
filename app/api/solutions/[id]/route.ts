import { NextRequest, NextResponse, after } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { runAnalysis } from "@/lib/analyze";
import { getUserGeminiKey } from "@/lib/ai/user-key";
import { isLanguage, MAX_CODE_LENGTH } from "@/lib/difficulty";
import { errorResponse } from "@/lib/api-error";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { language, code, label, is_public_code } = body;

    const updateData: any = {};
    if (language !== undefined) {
      if (!isLanguage(language)) {
        return NextResponse.json({ error: "Invalid language" }, { status: 400 });
      }
      updateData.language = language;
    }
    if (code !== undefined) {
      if (typeof code !== "string" || !code.trim()) {
        return NextResponse.json({ error: "Code is required" }, { status: 400 });
      }
      if (code.length > MAX_CODE_LENGTH) {
        return NextResponse.json({ error: "Code is too large" }, { status: 400 });
      }
      updateData.code = code;
      updateData.ai_status = "pending"; // Re-trigger AI analysis on code change
    }
    if (label !== undefined) {
      updateData.label = typeof label === "string" ? label.slice(0, 120) : null;
    }
    if (is_public_code !== undefined) updateData.is_public_code = !!is_public_code;

    const { data: updated, error } = await supabase
      .from("solutions")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw error;

    // If code changed, re-run AI analysis AFTER the response (non-blocking; see solutions POST for
    // why `after()` + an admin client is used). ai_status was set to "pending" above; the page's
    // realtime subscription picks up the refreshed analysis. Never fails the update.
    if (code !== undefined) {
      const uid = user.id;
      after(async () => {
        const gemini = await getUserGeminiKey(uid);
        await runAnalysis(createAdminClient(), id, uid, { gemini: gemini ?? undefined });
      });
    }

    return NextResponse.json(updated);
  } catch (err) {
    return errorResponse("solutions.[id].PATCH", err, "Failed to update solution");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { error } = await supabase
      .from("solutions")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse("solutions.[id].DELETE", err, "Failed to delete solution");
  }
}
