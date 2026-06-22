"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Problem, ProblemWithRelations, DifficultyNorm } from "@/types";
import { ProblemCard } from "@/components/problem-card";
import { createClient } from "@/lib/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { PaperSheet } from "@/components/paper/paper-sheet";
import { Cap } from "@/components/paper/bits";
import { StampButton, GhostButton } from "@/components/paper/stamp";
import { ModifiedBear } from "@/components/modified-bear";

const DIFFICULTY_ORDER: Record<DifficultyNorm, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
  expert: 4,
  unknown: 0,
};

const SELECT_TRIGGER =
  "bg-[#E4DCC6] border border-paper-edge text-ink-soft font-mono text-[11px] h-8 rounded-[3px] data-[placeholder]:text-ink-faint";
const SELECT_CONTENT =
  "bg-paper-sheet border-paper-edge text-ink font-mono text-[12px]";

export default function ProblemsPage() {
  const router = useRouter();
  const [problems, setProblems] = useState<ProblemWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [languageFilter, setLanguageFilter] = useState<string>("all");

  const [sortBy, setSortBy] = useState<string>("date-desc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => {
    async function fetchProblems() {
      try {
        const res = await fetch("/api/problems");
        if (!res.ok) throw new Error("Failed to load problems");
        const data: ProblemWithRelations[] = await res.json();
        setProblems((prev) => {
          const byId = new Map<string, ProblemWithRelations>(data.map((p) => [p.id, p]));
          for (const p of prev) if (!byId.has(p.id)) byId.set(p.id, p);
          return Array.from(byId.values());
        });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }
    fetchProblems();
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const toWithRelations = (row: Problem): ProblemWithRelations => ({
        ...row,
        solutions: [],
        timing_sessions: [],
        total_seconds: 0,
        ai_tags: [],
      });

      channel = supabase
        .channel(`admin-problems-feed-${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "problems", filter: `user_id=eq.${user.id}` },
          (payload) => {
            setProblems((prev) => {
              if (payload.eventType === "INSERT") {
                const row = payload.new as Problem;
                if (prev.some((p) => p.id === row.id)) return prev;
                return [toWithRelations(row), ...prev];
              }
              if (payload.eventType === "UPDATE") {
                const row = payload.new as Problem;
                return prev.map((p) => (p.id === row.id ? { ...p, ...row } : p));
              }
              if (payload.eventType === "DELETE") {
                const oldRow = payload.old as { id?: string };
                return prev.filter((p) => p.id !== oldRow.id);
              }
              return prev;
            });
          }
        )
        .subscribe();

      // if the effect was cleaned up during the await above, tear down immediately
      // so we never leave a subscribed channel orphaned (StrictMode double-mount).
      if (cancelled) {
        supabase.removeChannel(channel);
        channel = null;
      }
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const allUniqueTags = useMemo(() => {
    const tags = new Set<string>();
    problems.forEach((p) => {
      p.source_tags?.forEach((t) => tags.add(t));
      p.custom_tags?.forEach((t) => tags.add(t));
      p.ai_tags?.forEach((t) => tags.add(t));
    });
    return Array.from(tags).sort();
  }, [problems]);

  const allUniqueLanguages = useMemo(() => {
    const langs = new Set<string>();
    problems.forEach((p) => {
      p.solutions?.forEach((s) => {
        if (s.language) langs.add(s.language);
      });
    });
    return Array.from(langs).sort();
  }, [problems]);

  const filteredProblems = useMemo(() => {
    let result = [...problems];

    if (platformFilter !== "all") result = result.filter((p) => p.platform === platformFilter);
    if (difficultyFilter !== "all") result = result.filter((p) => p.difficulty_norm === difficultyFilter);
    if (languageFilter !== "all")
      result = result.filter((p) => p.solutions?.some((s) => s.language === languageFilter));
    if (tagFilter !== "all")
      result = result.filter(
        (p) =>
          p.source_tags?.includes(tagFilter) ||
          p.custom_tags?.includes(tagFilter) ||
          p.ai_tags?.includes(tagFilter)
      );

    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(term) ||
          p.platform_id?.toLowerCase().includes(term) ||
          p.source_tags?.some((t) => t.toLowerCase().includes(term)) ||
          p.custom_tags?.some((t) => t.toLowerCase().includes(term)) ||
          p.ai_tags?.some((t) => t.toLowerCase().includes(term))
      );
    }

    result.sort((a, b) => {
      if (sortBy === "date-desc")
        return new Date(b.solved_at || b.created_at).getTime() - new Date(a.solved_at || a.created_at).getTime();
      if (sortBy === "date-asc")
        return new Date(a.solved_at || a.created_at).getTime() - new Date(b.solved_at || b.created_at).getTime();
      if (sortBy === "time-desc") return (b.total_seconds || 0) - (a.total_seconds || 0);
      if (sortBy === "time-asc") return (a.total_seconds || 0) - (b.total_seconds || 0);
      if (sortBy === "difficulty-desc")
        return DIFFICULTY_ORDER[b.difficulty_norm] - DIFFICULTY_ORDER[a.difficulty_norm];
      if (sortBy === "difficulty-asc")
        return DIFFICULTY_ORDER[a.difficulty_norm] - DIFFICULTY_ORDER[b.difficulty_norm];
      if (sortBy === "platform") return a.platform.localeCompare(b.platform);
      return 0;
    });

    return result;
  }, [problems, searchTerm, platformFilter, difficultyFilter, tagFilter, languageFilter, sortBy]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, platformFilter, difficultyFilter, tagFilter, languageFilter]);

  const paginatedProblems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredProblems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProblems, currentPage]);

  const totalPages = Math.ceil(filteredProblems.length / itemsPerPage);

  if (error) {
    return (
      <PaperSheet variant="page" className="p-10 text-center flex flex-col items-center gap-4">
        <AlertCircle className="w-10 h-10 text-blood" />
        <h3 className="font-type text-[16px] text-ink">failed to load problems</h3>
        <p className="font-body text-[14px] text-ink-soft max-w-[280px]">{error}</p>
        <GhostButton onClick={() => window.location.reload()}>retry</GhostButton>
      </PaperSheet>
    );
  }

  return (
    <PaperSheet variant="page" className="cpj-develop p-[22px] md:p-[26px]">
      {/* header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <Cap>02 · PROBLEMS</Cap>
          <h1 className="font-display text-[42px] leading-[0.9] mt-1">THE BENDS</h1>
          <p className="font-body italic text-[14px] text-ink-soft mt-0.5">
            {loading
              ? "thumbing through the journal..."
              : `${filteredProblems.length} of ${problems.length} · everything in its right place`}
          </p>
        </div>
        <div className="flex gap-1.5 shrink-0" role="group" aria-label="View mode">
          {(["grid", "list"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              aria-pressed={viewMode === m}
              className={`font-mono text-[10px] tracking-[0.1em] px-2.5 py-1.5 rounded-[3px] uppercase ${
                viewMode === m
                  ? "bg-blood text-[#fbe9e7]"
                  : "border border-paper-edge text-ink-faint"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* filter bar */}
      <div className="flex flex-wrap gap-2 items-center my-4">
        <div className="flex-1 min-w-[220px] bg-paper-sheet border border-paper-edge rounded-[3px] px-3 py-2 flex items-center gap-2">
          <Search className="w-[14px] h-[14px] text-ink-faint" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="search problems, platform id, or tags..."
            className="bg-transparent outline-none w-full font-body text-[14px] text-ink placeholder:text-ink-faint"
          />
        </div>

        <Select value={platformFilter} onValueChange={(v) => setPlatformFilter(v || "all")}>
          <SelectTrigger className={SELECT_TRIGGER}><SelectValue placeholder="platform ▾" /></SelectTrigger>
          <SelectContent className={SELECT_CONTENT}>
            <SelectItem value="all">all platforms</SelectItem>
            <SelectItem value="codeforces">Codeforces</SelectItem>
            <SelectItem value="leetcode">LeetCode</SelectItem>
            <SelectItem value="atcoder">AtCoder</SelectItem>
            <SelectItem value="cses">CSES</SelectItem>
            <SelectItem value="spoj">SPOJ</SelectItem>
            <SelectItem value="hackerrank">HackerRank</SelectItem>
            <SelectItem value="codechef">CodeChef</SelectItem>
            <SelectItem value="hackerearth">HackerEarth</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>

        <Select value={difficultyFilter} onValueChange={(v) => setDifficultyFilter(v || "all")}>
          <SelectTrigger className={SELECT_TRIGGER}><SelectValue placeholder="rating ▾" /></SelectTrigger>
          <SelectContent className={SELECT_CONTENT}>
            <SelectItem value="all">all difficulties</SelectItem>
            <SelectItem value="easy">easy</SelectItem>
            <SelectItem value="medium">medium</SelectItem>
            <SelectItem value="hard">hard</SelectItem>
            <SelectItem value="expert">expert</SelectItem>
            <SelectItem value="unknown">unknown</SelectItem>
          </SelectContent>
        </Select>

        <Select value={tagFilter} onValueChange={(v) => setTagFilter(v || "all")}>
          <SelectTrigger className={SELECT_TRIGGER}><SelectValue placeholder="tag ▾" /></SelectTrigger>
          <SelectContent className={`${SELECT_CONTENT} max-h-[220px]`}>
            <SelectItem value="all">all tags</SelectItem>
            {allUniqueTags.map((tag) => (
              <SelectItem key={tag} value={tag}>{tag}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={languageFilter} onValueChange={(v) => setLanguageFilter(v || "all")}>
          <SelectTrigger className={SELECT_TRIGGER}><SelectValue placeholder="language ▾" /></SelectTrigger>
          <SelectContent className={SELECT_CONTENT}>
            <SelectItem value="all">all languages</SelectItem>
            {allUniqueLanguages.map((l) => (
              <SelectItem key={l} value={l}>{l.toUpperCase()}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v) => setSortBy(v || "date-desc")}>
          <SelectTrigger className={`${SELECT_TRIGGER} ml-auto`}><SelectValue placeholder="sort ▾" /></SelectTrigger>
          <SelectContent className={SELECT_CONTENT}>
            <SelectItem value="date-desc">newest solved</SelectItem>
            <SelectItem value="date-asc">oldest solved</SelectItem>
            <SelectItem value="time-desc">time spent (high)</SelectItem>
            <SelectItem value="time-asc">time spent (low)</SelectItem>
            <SelectItem value="difficulty-desc">difficulty (hard)</SelectItem>
            <SelectItem value="difficulty-asc">difficulty (easy)</SelectItem>
            <SelectItem value="platform">platform name</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="bg-paper-sheet cpj-card-shadow rounded-[3px] h-[78px] relative overflow-hidden">
              <div
                className="absolute inset-0"
                style={{
                  background: "linear-gradient(100deg,transparent,rgba(255,255,255,.35),transparent)",
                  transform: "translateX(-100%)",
                  animation: "shimmer 1.4s infinite",
                }}
              />
            </div>
          ))}
          <style>{`@keyframes shimmer{to{transform:translateX(100%)}}`}</style>
        </div>
      ) : filteredProblems.length === 0 ? (
        <div className="text-center flex flex-col items-center gap-3 py-14">
          <ModifiedBear className="w-10 h-10 text-ink-faint opacity-50" />
          <p className="font-body italic text-[15px] text-ink-soft max-w-[320px]">
            {problems.length === 0
              ? "How to Disappear Completely - nothing filed yet."
              : "nothing here. i'm not here, this isn't happening."}
          </p>
          {problems.length === 0 ? (
            <Link href="/admin/problems/new">
              <StampButton className="text-[13px]">+ ADD PROBLEM</StampButton>
            </Link>
          ) : (
            <GhostButton
              onClick={() => {
                setSearchTerm("");
                setPlatformFilter("all");
                setDifficultyFilter("all");
                setTagFilter("all");
                setLanguageFilter("all");
              }}
            >
              clear filters
            </GhostButton>
          )}
        </div>
      ) : (
        <>
          <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" : "flex flex-col gap-2.5"}>
            {paginatedProblems.map((problem) => (
              <ProblemCard
                key={problem.id}
                problem={problem}
                variant="admin"
                onClick={() => router.push(`/admin/problems/${problem.id}`)}
              />
            ))}
          </div>

          <div className="flex items-center justify-center gap-4 mt-5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="font-mono text-[11px] text-blueprint disabled:text-ink-faint/60 disabled:cursor-default flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> prev
            </button>
            <span className="font-mono text-[11px] text-ink-faint">
              p.{currentPage} of {Math.max(totalPages, 1)}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="font-mono text-[11px] text-blueprint disabled:text-ink-faint/60 disabled:cursor-default flex items-center gap-1"
            >
              next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </>
      )}
    </PaperSheet>
  );
}
