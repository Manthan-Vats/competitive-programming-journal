import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isDifficultyNorm } from "@/lib/difficulty";
import { errorResponse } from "@/lib/api-error";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    const { data: problem, error } = await supabase
      .from("problems")
      .select(`
        *,
        solutions (
          *,
          ai_analyses (
            *
          )
        ),
        timing_sessions (
          *
        )
      `)
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!problem) {
      return NextResponse.json({ error: "Problem not found" }, { status: 404 });
    }

    // The viewer owns this problem only if it's theirs. Otherwise they may see it
    // only if it's published, and only its public solutions.
    const isOwnerOfProblem = !!user && problem.user_id === user.id;

    if (!problem.is_public && !isOwnerOfProblem) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isOwnerOfProblem) {
      problem.solutions = problem.solutions.filter((s: any) => s.is_public_code);
    }

    // Compute total seconds
    const total_seconds = problem.timing_sessions.reduce((acc: number, s: any) => {
      if (s.started_at && s.ended_at) {
        const diff = Math.floor(
          (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000
        );
        return acc + (diff > 0 ? diff : 0);
      }
      return acc;
    }, 0);

    // Compute AI tags union
    const aiTagsSet = new Set<string>();
    problem.solutions.forEach((sol: any) => {
      sol.ai_analyses?.forEach((analysis: any) => {
        analysis.algorithms?.forEach((t: string) => aiTagsSet.add(t));
        analysis.data_structures?.forEach((t: string) => aiTagsSet.add(t));
        analysis.techniques?.forEach((t: string) => aiTagsSet.add(t));
        analysis.math_concepts?.forEach((t: string) => aiTagsSet.add(t));
      });
    });
    const ai_tags = Array.from(aiTagsSet);

    const problemWithRelations = {
      ...problem,
      total_seconds,
      ai_tags,
    };

    return NextResponse.json(problemWithRelations);
  } catch (err) {
    return errorResponse("problems.[id].GET", err, "Failed to fetch problem");
  }
}

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

    // Build the update field-by-field (P1-2). A blanket update of destructured fields would
    // null out everything the caller omitted (e.g. PATCH {is_public} would wipe the title),
    // and would accept arbitrary difficulty values / non-array tags. Only apply provided,
    // validated fields.
    const updateData: Record<string, unknown> = {};

    if (body.title !== undefined) {
      if (typeof body.title !== "string" || !body.title.trim()) {
        return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
      }
      updateData.title = body.title.trim();
    }
    if (body.difficulty_raw !== undefined) {
      updateData.difficulty_raw =
        typeof body.difficulty_raw === "string" ? body.difficulty_raw : null;
    }
    if (body.difficulty_norm !== undefined) {
      if (!isDifficultyNorm(body.difficulty_norm)) {
        return NextResponse.json({ error: "Invalid difficulty" }, { status: 400 });
      }
      updateData.difficulty_norm = body.difficulty_norm;
    }
    if (body.source_tags !== undefined) {
      if (!Array.isArray(body.source_tags)) {
        return NextResponse.json({ error: "source_tags must be an array" }, { status: 400 });
      }
      updateData.source_tags = body.source_tags
        .filter((t: unknown): t is string => typeof t === "string")
        .slice(0, 40);
    }
    if (body.custom_tags !== undefined) {
      if (!Array.isArray(body.custom_tags)) {
        return NextResponse.json({ error: "custom_tags must be an array" }, { status: 400 });
      }
      updateData.custom_tags = body.custom_tags
        .filter((t: unknown): t is string => typeof t === "string")
        .slice(0, 40);
    }
    if (body.notes !== undefined) {
      updateData.notes = typeof body.notes === "string" ? body.notes.slice(0, 5000) : null;
    }
    if (body.is_public !== undefined) updateData.is_public = !!body.is_public;
    if (body.is_featured !== undefined) updateData.is_featured = !!body.is_featured;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from("problems")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(updated);
  } catch (err) {
    return errorResponse("problems.[id].PATCH", err, "Failed to update problem");
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
      .from("problems")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse("problems.[id].DELETE", err, "Failed to delete problem");
  }
}
