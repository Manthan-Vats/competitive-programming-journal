import React from "react";
import { createClient } from "@/lib/supabase/server";
import { AnalyticsDashboard } from "@/components/analytics-dashboard";
import { PaperSheet } from "@/components/paper/paper-sheet";
import { Cap } from "@/components/paper/bits";
import { Stamp } from "@/components/paper/stamp";

export default async function AnalyticsPage() {
  const supabase = await createClient();

  // Fetch all problems with relations for the admin user
  const { data: problems = [] } = await supabase.from("problems").select(`
    id,
    title,
    platform,
    difficulty_norm,
    created_at,
    solutions (
      language,
      ai_analyses (
        algorithms,
        data_structures,
        techniques,
        math_concepts
      )
    ),
    timing_sessions (
      started_at,
      ended_at
    )
  `);

  return (
    <PaperSheet variant="page" className="cpj-develop p-[22px] md:p-[26px]">
      <div className="relative flex items-start justify-between">
        <div>
          <Cap>03 · ANALYTICS</Cap>
          <h2 className="font-display text-[42px] leading-[0.9] tracking-[0.01em] text-ink mt-[5px]">
            2 + 2 = 5
          </h2>
          <p className="font-body italic text-[14px] text-ink-soft mt-1">
            the numbers don&apos;t lie - except when they do.
          </p>
        </div>
        <Stamp label="ON RECORD" sub="FILE" />
      </div>

      <div className="mt-6">
        <AnalyticsDashboard rawProblems={problems || []} />
      </div>
    </PaperSheet>
  );
}
