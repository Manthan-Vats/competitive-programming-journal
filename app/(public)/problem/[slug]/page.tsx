import React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ExternalLink } from "lucide-react";
import { CodeViewer } from "@/components/code-viewer";
import { SiteFooter } from "@/components/site-footer";
import { PaperSheet } from "@/components/paper/paper-sheet";
import { PageTurn } from "@/components/paper/page-turn";
import { Cap, TopicChip } from "@/components/paper/bits";
import { Stamp } from "@/components/paper/stamp";
import { DIFFICULTY_COLOR } from "@/lib/paper";
import { renderMarkdown } from "@/lib/markdown";
import { Metadata } from "next";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: problem } = await supabase
    .from("problems")
    .select("title, platform, is_public")
    .eq("id", slug)
    .maybeSingle();
  if (!problem || !problem.is_public) return { title: "Problem Not Found" };
  return {
    title: `${problem.title} - CP Journal`,
    description: `Solution code and analysis for ${problem.title} on ${problem.platform}.`,
  };
}

const formatSeconds = (totalSeconds: number): string => {
  if (totalSeconds <= 0) return "0s";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

export default async function PublicProblemDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  // Select only the nested columns this page renders. In particular ai_analyses drops the heavy
  // `raw_response` JSON blob (never shown publicly - only the four tag arrays are used), and
  // solutions/timing_sessions drop unused columns. Top-level problem fields stay `*` (most scalar
  // columns are rendered).
  const { data: problem, error } = await supabase
    .from("problems")
    .select(
      `*, solutions (id, code, language, label, is_public_code, ai_analyses (algorithms, data_structures, techniques, math_concepts)), timing_sessions (started_at, ended_at)`
    )
    .eq("id", slug)
    .maybeSingle();

  if (error || !problem || !problem.is_public) notFound();

  const publicSolutions = problem.solutions.filter((s: { is_public_code?: boolean }) => s.is_public_code);

  const totalSeconds = problem.timing_sessions.reduce((acc: number, s: { started_at?: string | null; ended_at?: string | null }) => {
    if (s.started_at && s.ended_at) {
      const diff = Math.floor((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000);
      return acc + (diff > 0 ? diff : 0);
    }
    return acc;
  }, 0);

  const ai = { algorithms: new Set<string>(), data_structures: new Set<string>(), techniques: new Set<string>(), math_concepts: new Set<string>() };
  publicSolutions.forEach((sol: { ai_analyses?: Array<Record<string, string[] | undefined>> }) => {
    sol.ai_analyses?.forEach((a) => {
      a.algorithms?.forEach((t: string) => ai.algorithms.add(t));
      a.data_structures?.forEach((t: string) => ai.data_structures.add(t));
      a.techniques?.forEach((t: string) => ai.techniques.add(t));
      a.math_concepts?.forEach((t: string) => ai.math_concepts.add(t));
    });
  });
  const hasAI = ai.algorithms.size || ai.data_structures.size || ai.techniques.size || ai.math_concepts.size;
  const edge = DIFFICULTY_COLOR[problem.difficulty_norm] || DIFFICULTY_COLOR.unknown;

  return (
    <div className="cpj-desk min-h-screen w-full py-6 px-4">
      <div className="w-full max-w-3xl mx-auto space-y-6">
        <PageTurn>
        <PaperSheet variant="page" className="p-[24px] md:p-[30px] relative">
          <div className="absolute right-7 top-7">
            <Stamp label="PUBLIC" sub="ACCESS" />
          </div>

          <Link href="/" className="font-mono text-[10px] tracking-[0.16em] text-ink-faint hover:text-blood uppercase">
            ◂ back · the library
          </Link>

          {/* title + chips */}
          <div className="flex items-center gap-2.5 mt-3 flex-wrap">
            <span className="font-mono text-[10px] px-[7px] py-[2px] rounded-[2px]" style={{ background: edge, color: "#1c1812" }}>
              {problem.platform} · {problem.difficulty_raw || problem.difficulty_norm}
            </span>
            <h1 className="font-display text-[30px] leading-[0.95]">{problem.title}</h1>
          </div>
          {problem.source_tags?.length > 0 && (
            <div className="flex flex-wrap gap-[5px] mt-2.5">
              {problem.source_tags.map((t: string) => (
                <TopicChip key={t} tag={t} />
              ))}
            </div>
          )}

          {/* solve ledger */}
          <div className="flex gap-4 flex-wrap font-mono text-[11px] text-ink-soft mt-3">
            <span>
              solved {new Date(problem.solved_at || problem.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
            <span>{formatSeconds(totalSeconds)} on the clock</span>
            <a href={problem.url} target="_blank" rel="noopener noreferrer" className="text-blueprint hover:underline flex items-center gap-1">
              open original <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* statement */}
          {problem.statement && (
            <div className="mt-5">
              <Cap>STATEMENT</Cap>
              <div className="font-body text-[16px] leading-[1.62] text-ink mt-2 whitespace-pre-wrap">{problem.statement}</div>
            </div>
          )}

          {/* notes */}
          {problem.notes && (
            <div className="mt-5">
              <Cap>NOTES</Cap>
              <div
                className="font-body text-[15px] leading-[1.6] text-ink mt-2"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(problem.notes) }}
              />
            </div>
          )}

          {/* solution code */}
          <div className="mt-5">
            <Cap className="mb-2">ACCEPTED CODE</Cap>
            {publicSolutions.length === 0 ? (
              <p className="font-body italic text-[14px] text-ink-soft">solution not publicly shared.</p>
            ) : (
              <div className="space-y-4">
                {publicSolutions.map((sol: { id: string; code: string; language: string; label?: string | null }) => (
                  <CodeViewer key={sol.id} code={sol.code} language={sol.language as Parameters<typeof CodeViewer>[0]["language"]} label={sol.label || undefined} />
                ))}
              </div>
            )}
          </div>

          {/* AI classified */}
          {hasAI ? (
            <div className="mt-5 bg-paper-sheet cpj-card-shadow rounded-[3px] border-l-[3px] border-blueprint p-3.5">
              <Cap>⧉ CLASSIFIED</Cap>
              {([
                ["ALGORITHMS", ai.algorithms],
                ["DATA STRUCTURES", ai.data_structures],
                ["TECHNIQUES", ai.techniques],
                ["CONCEPTS", ai.math_concepts],
              ] as const).map(([label, set]) =>
                set.size > 0 ? (
                  <div key={label} className="flex items-baseline gap-2 mt-2 flex-wrap">
                    <span className="font-mono text-[9px] tracking-[0.16em] text-ink-faint w-[110px] shrink-0">{label}</span>
                    {Array.from(set).map((t) => (
                      <TopicChip key={t} tag={t} />
                    ))}
                  </div>
                ) : null
              )}
            </div>
          ) : null}

          <div className="flex items-center justify-between mt-6 pt-3 border-t border-paper-edge">
            <span className="font-body italic text-[13px] text-ink-soft">everything in its right place · 2+2=5</span>
            <Cap>filed</Cap>
          </div>
        </PaperSheet>
        </PageTurn>

        <SiteFooter />
      </div>
    </div>
  );
}
