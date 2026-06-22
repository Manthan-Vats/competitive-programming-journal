"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertTriangle, ArrowLeft } from "lucide-react";
import { Platform, DifficultyNorm, ProblemWithRelations, Language } from "@/types";
import { ProblemCard } from "@/components/problem-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import Link from "next/link";
import { useTimerContext } from "@/components/timer";
import { localDateKey } from "@/lib/date";
import { PaperSheet } from "@/components/paper/paper-sheet";
import { StampButton, GhostButton } from "@/components/paper/stamp";
import { Cap, TopicChip, RedPen } from "@/components/paper/bits";
import { CodeEditor } from "@/components/code-editor";

const INPUT_CLASS =
  "w-full bg-paper-sheet border border-paper-edge rounded-[3px] px-3 py-2.5 font-body text-[15px] text-ink placeholder:text-ink-faint focus:outline-2 focus:outline-blood focus:outline-offset-2";
const SELECT_TRIGGER_CLASS =
  "bg-[#E4DCC6] border border-paper-edge text-ink-soft font-mono text-[12px] rounded-[3px]";

export default function NewProblemPage() {
  const router = useRouter();
  const { startTimer } = useTimerContext();

  // URL input and fetch state
  const [url, setUrl] = useState("");
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
  const [fetchFailed, setFetchFailed] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState<Platform>("other");
  const [difficultyRaw, setDifficultyRaw] = useState("");
  const [difficultyNorm, setDifficultyNorm] = useState<DifficultyNorm>("unknown");
  const [sourceTags, setSourceTags] = useState<string[]>([]);
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [notes, setNotes] = useState("");
  // Defaults to today (local). Empty = leave undated (created_at used as fallback).
  const [solvedDate, setSolvedDate] = useState(() => localDateKey(new Date()));
  const [isPublic, setIsPublic] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [startTimerChecked, setStartTimerChecked] = useState(true);

  // Optional first-solution paste. If present at submit time it's saved as the problem's first
  // solution (POST /api/solutions) right after the problem is created.
  const [code, setCode] = useState("");
  const [codeLang, setCodeLang] = useState<Language>("cpp");

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-fetch metadata on url paste/change
  const prevUrlRef = useRef("");

  const handleFetchMetadata = async (targetUrl: string) => {
    if (!targetUrl || !targetUrl.startsWith("http")) return;
    setIsFetchingMetadata(true);
    setFetchFailed(false);

    try {
      const res = await fetch(`/api/metadata?url=${encodeURIComponent(targetUrl)}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setTitle(data.title || "");
        setPlatform(data.platform || "other");
        setDifficultyRaw(data.difficulty_raw || "");
        setDifficultyNorm(data.difficulty_norm || "unknown");
        setSourceTags(data.source_tags || []);
        toast.success("Metadata autofilled successfully!");
      } else {
        setFetchFailed(true);
        setPlatform("other");
        toast.error(data.error || "Could not auto-fill metadata. Please enter manually.");
      }
    } catch (err) {
      setFetchFailed(true);
      setPlatform("other");
      toast.error("Network error fetching metadata.");
    } finally {
      setIsFetchingMetadata(false);
    }
  };

  const handleUrlBlur = () => {
    if (url !== prevUrlRef.current) {
      prevUrlRef.current = url;
      handleFetchMetadata(url);
    }
  };

  const handleUrlKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      prevUrlRef.current = url;
      handleFetchMetadata(url);
    }
  };

  // Custom tags management
  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && tagInput.trim() !== "") {
      e.preventDefault();
      const newTag = tagInput.trim().toLowerCase();
      if (!customTags.includes(newTag)) {
        setCustomTags([...customTags, newTag]);
      }
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setCustomTags(customTags.filter((t) => t !== tagToRemove));
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!url) {
      toast.error("URL is required");
      return;
    }
    if (!title) {
      toast.error("Title is required");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/problems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          title,
          platform,
          difficulty_raw: difficultyRaw,
          difficulty_norm: difficultyNorm,
          source_tags: sourceTags,
          custom_tags: customTags,
          notes,
          is_public: isPublic,
          is_featured: isFeatured,
          // Local-midnight of the chosen day so the stored timestamp reads back as that
          // same calendar day in the user's timezone.
          solved_at: solvedDate ? new Date(`${solvedDate}T00:00:00`).toISOString() : null,
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        toast.error("Problem already exists.");
        router.push(`/admin/problems/${data.existing_id}`);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || "Failed to save problem");
      }

      // Persist the optional first-solution paste (best-effort; don't block navigation on it).
      if (code.trim()) {
        try {
          const solRes = await fetch("/api/solutions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              problem_id: data.id,
              language: codeLang,
              code,
              is_public_code: isPublic,
            }),
          });
          if (!solRes.ok) {
            const sd = await solRes.json().catch(() => ({}));
            toast.error(sd.error || "Problem saved, but the solution code couldn't be saved.");
          }
        } catch {
          toast.error("Problem saved, but the solution code couldn't be saved.");
        }
      }

      toast.success("Problem saved!");

      // If timer is checked, start timer immediately
      if (startTimerChecked) {
        await startTimer(data.id);
      }

      router.push(`/admin/problems/${data.id}`);
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mock a ProblemWithRelations for the Live Preview card
  const previewProblem: ProblemWithRelations = {
    id: "preview",
    url,
    title: title || "Problem Title",
    platform,
    platform_id: null,
    difficulty_raw: difficultyRaw || null,
    difficulty_norm: difficultyNorm,
    source_tags: sourceTags,
    custom_tags: customTags,
    is_featured: isFeatured,
    is_public: isPublic,
    notes,
    statement: null,
    metadata: {},
    solved_at: solvedDate ? new Date(`${solvedDate}T00:00:00`).toISOString() : null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    solutions: [],
    timing_sessions: [],
    total_seconds: 0,
    ai_tags: [],
  };

  return (
    <PaperSheet variant="page" className="cpj-develop p-[22px] md:p-[26px]">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/admin/problems" aria-label="Back to problems">
          <GhostButton className="mt-1 px-2 py-2">
            <ArrowLeft className="w-4 h-4" />
          </GhostButton>
        </Link>
        <div>
          <Cap>OPTIMISTIC</Cap>
          <h1 className="font-display text-[40px] leading-[0.9] tracking-[0.01em] text-ink uppercase mt-[5px]">
            FILE A NEW ONE
          </h1>
          <p className="font-body italic text-[15px] text-ink-soft mt-1">
            the best you can is good enough.
          </p>
        </div>
      </div>

      {/* Body - 2 columns */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-7 items-start">
        {/* Left: the form */}
        <form id="new-problem-form" onSubmit={handleSubmit} className="space-y-4">
          {/* URL + fetch chip */}
          <div className="space-y-1.5">
            <label htmlFor="url">
              <Cap>Problem URL</Cap>
            </label>
            <div className="flex items-stretch gap-2">
              <input
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={handleUrlBlur}
                onKeyDown={handleUrlKeyDown}
                placeholder="paste a Codeforces / LeetCode / AtCoder link..."
                className={`${INPUT_CLASS} flex-1 font-mono text-[13px]`}
                autoFocus
                required
              />
              <button
                type="button"
                onClick={() => {
                  prevUrlRef.current = url;
                  handleFetchMetadata(url);
                }}
                disabled={isFetchingMetadata}
                className="shrink-0 rounded-[2px] bg-blueprint px-3.5 font-type text-[12px] text-[#e7f1f3] disabled:opacity-60"
              >
                {isFetchingMetadata ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  "fetch ▸"
                )}
              </button>
            </div>
            <p className="font-mono text-[9px] tracking-[0.1em] text-ink-faint">
              ▸ reads title, rating &amp; tags · or capture it with the companion
            </p>
          </div>

          {/* Metadata loading state */}
          {isFetchingMetadata && (
            <div className="flex items-center gap-2 font-type text-[13px] text-ink-soft">
              <Loader2 className="w-4 h-4 animate-spin shrink-0 text-blood" />
              <span>reading the page...</span>
            </div>
          )}

          {/* Metadata fail / manual state */}
          {fetchFailed && (
            <div className="flex items-center gap-2 rounded-[3px] border border-blood/30 bg-blood/5 p-3 font-body text-[13px] text-ink-soft">
              <AlertTriangle className="w-4 h-4 shrink-0 text-blood" />
              <span>couldn&apos;t read it - fill it in by hand.</span>
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <label htmlFor="title">
              <Cap>Title</Cap>
            </label>
            <input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. G. Tree Queries"
              className={INPUT_CLASS}
              required
            />
          </div>

          {/* Platform · Rating · Solved on */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="platform">
                <Cap>Platform</Cap>
              </label>
              <Select value={platform} onValueChange={(val) => setPlatform(val as Platform)}>
                <SelectTrigger id="platform" className={SELECT_TRIGGER_CLASS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-paper-sheet border-paper-edge text-ink font-mono text-[12px]">
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
            </div>

            <div className="space-y-1.5">
              <label htmlFor="difficulty">
                <Cap>Rating</Cap>
              </label>
              <Select
                value={difficultyNorm}
                onValueChange={(val) => setDifficultyNorm(val as DifficultyNorm)}
              >
                <SelectTrigger id="difficulty" className={SELECT_TRIGGER_CLASS}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-paper-sheet border-paper-edge text-ink font-mono text-[12px]">
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                  <SelectItem value="expert">Expert</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="solved-date">
                <Cap>Solved On</Cap>
              </label>
              <input
                id="solved-date"
                type="date"
                value={solvedDate}
                max={localDateKey(new Date())}
                onChange={(e) => setSolvedDate(e.target.value)}
                className={`${INPUT_CLASS} font-mono text-[13px]`}
              />
            </div>
          </div>
          <p className="font-mono text-[9px] tracking-[0.1em] text-ink-faint -mt-1">
            ▸ solved-on drives the heatmap &amp; streaks · defaults to today
          </p>

          {/* Source tags (autofilled) */}
          {sourceTags.length > 0 && (
            <div className="space-y-1.5">
              <Cap>Source Tags · autofilled</Cap>
              <div className="flex flex-wrap gap-[6px]">
                {sourceTags.map((tag) => (
                  <TopicChip key={tag} tag={tag} />
                ))}
              </div>
            </div>
          )}

          {/* Topics - custom tags multiselect */}
          <div className="space-y-1.5">
            <label htmlFor="custom-tags">
              <Cap>Topics</Cap>
            </label>
            <input
              id="custom-tags"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder="type a topic + Enter to add..."
              className={INPUT_CLASS}
            />
            {customTags.length > 0 && (
              <div className="flex flex-wrap gap-[6px] pt-1">
                {customTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    aria-label={`Remove topic ${tag}`}
                    className="group inline-flex items-center"
                  >
                    <TopicChip
                      tag={`${tag} ×`}
                      className="cursor-pointer transition-opacity group-hover:opacity-70"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label htmlFor="notes">
              <Cap>
                Notes <span className="text-ink-faint normal-case">· optional · markdown</span>
              </Cap>
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="what the solution actually does..."
              className={`${INPUT_CLASS} min-h-[90px] resize-y`}
            />
            <p className="pt-0.5">
              <RedPen rotate={-3} className="text-[14px]">
                key insight goes here
              </RedPen>
            </p>
          </div>

          {/* Solution code (optional) */}
          <div className="space-y-1.5">
            <Cap>
              Solution Code{" "}
              <span className="text-ink-faint normal-case">· optional · first solution</span>
            </Cap>
            <CodeEditor
              value={code}
              onChange={setCode}
              language={codeLang}
              onLanguageChange={setCodeLang}
              label="paste solution"
            />
          </div>

          {/* Controls */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Cap className="normal-case tracking-normal text-[12px] text-ink">
                  Make public
                </Cap>
                <p className="font-body text-[12px] text-ink-soft">
                  show on the public portfolio page.
                </p>
              </div>
              <Switch id="public-toggle" checked={isPublic} onCheckedChange={setIsPublic} />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Cap className="normal-case tracking-normal text-[12px] text-ink">
                  Feature problem
                </Cap>
                <p className="font-body text-[12px] text-ink-soft">
                  pin highlighted at the top of the portfolio.
                </p>
              </div>
              <Switch id="featured-toggle" checked={isFeatured} onCheckedChange={setIsFeatured} />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Cap className="normal-case tracking-normal text-[12px] text-ink">
                  ▸ Start the gloaming after filing
                </Cap>
                <p className="font-body text-[12px] text-ink-soft">
                  launch the live timer on save to track the session.
                </p>
              </div>
              <Switch
                id="timer-chk"
                checked={startTimerChecked}
                onCheckedChange={setStartTimerChecked}
              />
            </div>
          </div>
        </form>

        {/* Right: sticky live preview */}
        <div className="lg:sticky lg:top-4">
          <p className="text-center font-mono text-[9px] tracking-[0.16em] text-ink-faint uppercase mb-2.5">
            How it&apos;ll sit in the drawer
          </p>
          <ProblemCard problem={previewProblem} variant="public" />

          <StampButton
            type="submit"
            form="new-problem-form"
            disabled={isSubmitting}
            className="w-full mt-4 text-[16px] py-3"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-[15px] h-[15px] animate-spin" /> filing...
              </>
            ) : (
              "▸ FILE IT"
            )}
          </StampButton>

          <Link href="/admin/problems" className="block text-center mt-2.5">
            <span className="font-mono text-[11px] text-ink-soft hover:text-blood transition-colors">
              cancel
            </span>
          </Link>

          <p className="mt-4 font-body text-[12px] leading-relaxed text-ink-soft">
            The left edge-tab is the difficulty colour. Source tags fill in from the URL automatically.
          </p>
        </div>
      </div>

      {/* Footer refrain */}
      <div className="mt-7 pt-4 border-t border-paper-edge flex items-center justify-between">
        <span className="font-body italic text-[12px] text-ink-faint">
          everything in its right place
        </span>
        <Cap>new entry</Cap>
      </div>
    </PaperSheet>
  );
}
