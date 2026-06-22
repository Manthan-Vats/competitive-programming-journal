"use client";

import React, { useState, useEffect, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Trash2,
  ExternalLink,
  Plus,
  Play,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Edit2,
} from "lucide-react";
import { ProblemWithRelations, Language, SolutionWithRelations } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { Timer } from "@/components/timer";
import { CodeEditor } from "@/components/code-editor";
import { CopyButton } from "@/components/copy-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaperSheet } from "@/components/paper/paper-sheet";
import { PageTurn } from "@/components/paper/page-turn";
import { StampButton, GhostButton } from "@/components/paper/stamp";
import { Cap, TopicChip, RedPen } from "@/components/paper/bits";
import { PaperTabs } from "@/components/paper/tabs";
import { DIFFICULTY_COLOR } from "@/lib/paper";
import { renderMarkdown } from "@/lib/markdown";

export default function ProblemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [problem, setProblem] = useState<ProblemWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // Active tab (statement / solution / notes)
  const [activeTab, setActiveTab] = useState<"statement" | "solution" | "notes">("solution");

  // Notes editing states
  const [notesText, setNotesText] = useState("");
  const [notesPreview, setNotesPreview] = useState(false);

  // Custom tags editing states
  const [tagInput, setTagInput] = useState("");

  // Solutions lists collapsible state
  const [expandedSolutions, setExpandedSolutions] = useState<Record<string, boolean>>({});

  // New Solution Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLanguage, setNewLanguage] = useState<Language>("cpp");
  const [newCode, setNewCode] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newIsPublicCode, setNewIsPublicCode] = useState(true);
  const [isSubmittingSolution, setIsSubmittingSolution] = useState(false);

  // Edit Solution states
  const [editingSolutionId, setEditingSolutionId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [editLanguage, setEditLanguage] = useState<Language>("cpp");
  const [editIsPublicCode, setEditIsPublicCode] = useState(true);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const fetchProblem = useCallback(async () => {
    try {
      const res = await fetch(`/api/problems/${id}`);
      if (!res.ok) throw new Error("Problem not found");
      const data = await res.json();
      setProblem(data);
      setNotesText(data.notes || "");
    } catch (err: any) {
      toast.error(err.message || "Failed to load problem details");
      router.push("/admin/problems");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  // Initial fetch and Supabase Realtime subscriptions
  useEffect(() => {
    fetchProblem();

    // Subscribe to solution status changes and analysis insertions
    const solChannel = supabase
      .channel(`db-solution-changes-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "solutions",
          filter: `problem_id=eq.${id}`,
        },
        () => {
          fetchProblem();
        }
      )
      // NOTE: no separate ai_analyses listener - it has no problem_id to filter on (so it would
      // fire for every tenant's analyses), and completing an analysis also flips the parent
      // solution's ai_status, which the solutions listener above already catches.
      // Reflect changes to the problem row itself (e.g. extension re-capture enrichment).
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "problems",
          filter: `id=eq.${id}`,
        },
        () => {
          fetchProblem();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(solChannel);
    };
  }, [id, fetchProblem, supabase]);

  // Toggle problem details
  const handleToggleSwitch = async (field: "is_public" | "is_featured", val: boolean) => {
    if (!problem) return;
    try {
      const res = await fetch(`/api/problems/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: val }),
      });
      if (!res.ok) throw new Error("Failed to update status");

      setProblem({ ...problem, [field]: val });
      toast.success(`${field === "is_public" ? "Visibility" : "Featured"} status updated.`);
    } catch (err: any) {
      toast.error(err.message || "Error updating problem fields");
    }
  };

  // Delete problem
  const handleDeleteProblem = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/problems/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete problem");
      toast.success("Problem deleted successfully.");
      router.push("/admin/problems");
    } catch (err: any) {
      toast.error(err.message || "Error deleting problem");
      setIsDeleting(false);
    }
  };

  // Save notes
  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    try {
      const res = await fetch(`/api/problems/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notesText }),
      });
      if (!res.ok) throw new Error("Failed to save notes");
      toast.success("Notes saved!");
      setProblem(problem ? { ...problem, notes: notesText } : null);
    } catch (err: any) {
      toast.error(err.message || "Error saving notes");
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Custom tags management
  const handleAddTag = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && tagInput.trim() !== "") {
      e.preventDefault();
      if (!problem) return;

      const newTag = tagInput.trim().toLowerCase();
      if (problem.custom_tags.includes(newTag)) {
        setTagInput("");
        return;
      }

      const updatedTags = [...problem.custom_tags, newTag];

      try {
        const res = await fetch(`/api/problems/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ custom_tags: updatedTags }),
        });
        if (!res.ok) throw new Error("Failed to add tag");

        setProblem({ ...problem, custom_tags: updatedTags });
        setTagInput("");
        toast.success("Tag added!");
      } catch (err: any) {
        toast.error(err.message || "Error saving tag");
      }
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!problem) return;

    const updatedTags = problem.custom_tags.filter((t) => t !== tagToRemove);

    try {
      const res = await fetch(`/api/problems/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ custom_tags: updatedTags }),
      });
      if (!res.ok) throw new Error("Failed to remove tag");

      setProblem({ ...problem, custom_tags: updatedTags });
      toast.success("Tag removed!");
    } catch (err: any) {
      toast.error(err.message || "Error deleting tag");
    }
  };

  // Toggle code collapsible block
  const toggleSolutionExpand = (solId: string) => {
    setExpandedSolutions((prev) => ({
      ...prev,
      [solId]: !prev[solId],
    }));
  };

  // Save new solution
  const handleAddSolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) {
      toast.error("Please insert code content.");
      return;
    }

    setIsSubmittingSolution(true);
    try {
      const res = await fetch("/api/solutions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem_id: id,
          language: newLanguage,
          code: newCode,
          label: newLabel,
          is_public_code: newIsPublicCode,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add solution");

      toast.success("Solution added! AI analysis scheduled in background.");

      // Reset state
      setNewCode("");
      setNewLabel("");
      setShowAddForm(false);
      fetchProblem();
    } catch (err: any) {
      toast.error(err.message || "Error adding solution");
    } finally {
      setIsSubmittingSolution(false);
    }
  };

  // Delete solution
  const handleDeleteSolution = async (solId: string) => {
    if (!confirm("Are you sure you want to delete this solution?")) return;

    try {
      const res = await fetch(`/api/solutions/${solId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete solution");
      toast.success("Solution deleted.");
      fetchProblem();
    } catch (err: any) {
      toast.error(err.message || "Error deleting solution");
    }
  };

  // Edit solution setup
  const startEditSolution = (sol: SolutionWithRelations) => {
    setEditingSolutionId(sol.id);
    setEditCode(sol.code);
    setEditLabel(sol.label || "");
    setEditLanguage(sol.language);
    setEditIsPublicCode(sol.is_public_code);
  };

  const handleSaveEditSolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCode.trim()) {
      toast.error("Please insert code content.");
      return;
    }

    setIsSubmittingEdit(true);
    try {
      const res = await fetch(`/api/solutions/${editingSolutionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: editLanguage,
          code: editCode,
          label: editLabel,
          is_public_code: editIsPublicCode,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update solution");

      toast.success("Solution updated! AI re-analysis scheduled.");
      setEditingSolutionId(null);
      fetchProblem();
    } catch (err: any) {
      toast.error(err.message || "Error updating solution");
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Re-run AI analysis
  const handleTriggerAnalysis = async (solId: string) => {
    toast.info("Triggering AI code analysis...");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solution_id: solId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("AI analysis complete!");
        fetchProblem();
      } else {
        toast.error(data.error || "AI analysis failed");
      }
    } catch (err: any) {
      toast.error("Network error triggering AI analysis");
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center flex-col gap-3 py-24">
        <Loader2 className="w-8 h-8 text-blood animate-spin" />
        <span className="text-[13px] text-ink-soft font-type cpj-caret">
          waking the problem from its sleep
        </span>
      </div>
    );
  }

  if (!problem) return null;

  const diffColor =
    DIFFICULTY_COLOR[problem.difficulty_norm] || DIFFICULTY_COLOR.unknown;

  return (
    <PageTurn>
    <PaperSheet variant="page" className="p-[22px] md:p-[26px]">
      <main className="space-y-6">
        {/* Title Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-paper-edge pb-4">
          <div className="space-y-2">
            <Link
              href="/admin/problems"
              className="font-mono text-[10px] tracking-[0.16em] text-ink-faint hover:text-ink uppercase inline-flex items-center gap-1"
            >
              ◂ back · the bends
            </Link>
            <div className="flex items-center gap-3 flex-wrap">
              <span
                className="font-mono text-[10px] font-semibold tracking-[0.1em] uppercase px-2 py-0.5 rounded-[2px] text-[#231a00]"
                style={{ background: diffColor }}
              >
                {problem.platform} · {problem.difficulty_raw || problem.difficulty_norm}
              </span>
              <h1
                className="font-display text-[30px] md:text-[40px] uppercase tracking-[0.01em] text-ink leading-[0.9]"
              >
                {problem.title}
              </h1>
              <a
                href={problem.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink-faint hover:text-blueprint transition-colors inline-block"
                title="Open problem in judge platform"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            {(problem.metadata?.timeLimit || problem.metadata?.memoryLimit) && (
              <div className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.1em] text-ink-faint uppercase pt-1">
                {problem.metadata.timeLimit && (
                  <span title="Time limit">TL {problem.metadata.timeLimit}</span>
                )}
                {problem.metadata.timeLimit && problem.metadata.memoryLimit && (
                  <span>·</span>
                )}
                {problem.metadata.memoryLimit && (
                  <span title="Memory limit">ML {problem.metadata.memoryLimit}</span>
                )}
              </div>
            )}
            {/* Source / judge tag chips under the title */}
            {problem.source_tags?.length > 0 && (
              <div className="flex flex-wrap gap-[5px] pt-1">
                {problem.source_tags.map((tag) => (
                  <TopicChip key={tag} tag={tag} />
                ))}
              </div>
            )}
          </div>

          {/* The gloaming Timer */}
          <div className="shrink-0">
            <Timer
              problemId={id}
              sessions={problem.timing_sessions || []}
              onSessionUpdate={fetchProblem}
            />
          </div>
        </div>

        {/* Privacy + feature controls (the Redaction metaphor) */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* is_public - Redaction toggle */}
          <button
            type="button"
            aria-pressed={problem.is_public}
            aria-live="polite"
            onClick={() => handleToggleSwitch("is_public", !problem.is_public)}
            className="relative inline-block group"
            title="Toggle public / private"
          >
            {problem.is_public ? (
              <span className="cpj-stamp-land inline-block font-type text-[13px] text-blood border-2 border-blood px-3 py-[3px] rounded-[2px]">
                PUBLIC
              </span>
            ) : (
              <span className="inline-flex items-center justify-center bg-ink rounded-[2px] px-3 py-[5px]">
                <span className="font-mono text-[10px] tracking-[0.16em] text-paper-edge">
                  ▮ PRIVATE - click to reveal ▸
                </span>
              </span>
            )}
          </button>

          {/* is_featured - pin toggle */}
          <button
            type="button"
            aria-pressed={problem.is_featured}
            onClick={() => handleToggleSwitch("is_featured", !problem.is_featured)}
            className={
              problem.is_featured
                ? "font-type text-[12px] text-t-orange border border-t-orange px-2.5 py-1 rounded-[2px]"
                : "font-type text-[12px] text-ink-soft border border-dashed border-[#b3a988] px-2.5 py-1 rounded-[2px] hover:text-ink"
            }
            title="Feature on the public wall"
          >
            ON THE WALL
          </button>

          <Dialog>
            <DialogTrigger
              render={
                <GhostButton className="text-blood border-blood/40 hover:bg-blood/5">
                  <Trash2 className="w-3.5 h-3.5" /> remove from file
                </GhostButton>
              }
            />
            <DialogContent className="bg-paper-sheet border-paper-edge text-ink">
              <DialogHeader>
                <DialogTitle className="font-type text-[16px]">Delete Problem</DialogTitle>
                <DialogDescription className="text-ink-soft text-[13px] font-body pt-2">
                  Are you sure you want to delete this problem? This will permanently erase the problem record, notes, all associated solutions, and timer sessions. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="pt-2 gap-2">
                <GhostButton disabled={isDeleting}>Cancel</GhostButton>
                <StampButton onClick={handleDeleteProblem} disabled={isDeleting}>
                  {isDeleting ? "Deleting..." : "Delete Permanently"}
                </StampButton>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tabs */}
        <PaperTabs
          tabs={[
            { id: "statement", label: "statement" },
            { id: "solution", label: "solution" },
            { id: "notes", label: "notes" },
          ]}
          active={activeTab}
          onChange={(t) => setActiveTab(t as typeof activeTab)}
        />

        {/* STATEMENT TAB */}
        {activeTab === "statement" && (
          <div role="tabpanel" className="space-y-3">
            {problem.statement ? (
              <p
                data-lenis-prevent
                className="font-body text-[16px] leading-[1.62] text-ink whitespace-pre-wrap max-h-[440px] overflow-y-auto pr-2"
              >
                {problem.statement}
              </p>
            ) : (
              <p className="font-body text-[15px] text-ink-soft italic">
                no statement on file -{" "}
                <a
                  href={problem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blueprint hover:underline not-italic"
                >
                  open original
                </a>
              </p>
            )}
            <Cap>
              LIMITS · {problem.metadata?.timeLimit ? `time ${problem.metadata.timeLimit}` : "time -"} ·{" "}
              {problem.metadata?.memoryLimit ? `memory ${problem.metadata.memoryLimit}` : "memory -"} ·{" "}
              <a
                href={problem.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blueprint hover:underline"
              >
                open original
              </a>
            </Cap>
          </div>
        )}

        {/* SOLUTION TAB */}
        {activeTab === "solution" && (
          <div role="tabpanel" className="space-y-4">
            <div className="flex items-center justify-between">
              <Cap>SOLUTIONS ({problem.solutions?.length || 0})</Cap>
              {!showAddForm && !editingSolutionId && (
                <GhostButton onClick={() => setShowAddForm(true)}>
                  <Plus className="w-3 h-3" /> attach solution
                </GhostButton>
              )}
            </div>

            {/* Inline Add Solution Form */}
            {showAddForm && (
              <PaperSheet variant="card" className="p-4">
                <form onSubmit={handleAddSolution} className="space-y-4">
                  <div className="flex items-center justify-between border-b border-paper-edge pb-2">
                    <span className="font-type text-[13px] text-ink">New Solution Code</span>
                    <GhostButton type="button" onClick={() => setShowAddForm(false)}>
                      Cancel
                    </GhostButton>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="lang" className="font-mono text-[10px] tracking-[0.14em] text-ink-faint uppercase">
                        Language
                      </Label>
                      <Select
                        value={newLanguage}
                        onValueChange={(val: string | null) => setNewLanguage((val || "cpp") as Language)}
                      >
                        <SelectTrigger id="lang" className="h-8 bg-paper-sheet border-paper-edge text-[12px] text-ink">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-paper-sheet border-paper-edge text-[12px] text-ink">
                          <SelectItem value="cpp">C++</SelectItem>
                          <SelectItem value="python">Python</SelectItem>
                          <SelectItem value="java">Java</SelectItem>
                          <SelectItem value="go">Go</SelectItem>
                          <SelectItem value="rust">Rust</SelectItem>
                          <SelectItem value="js">JavaScript</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="label" className="font-mono text-[10px] tracking-[0.14em] text-ink-faint uppercase">
                        Approach Label
                      </Label>
                      <Input
                        id="label"
                        placeholder="e.g. Iterative DP"
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        className="h-8 bg-paper-sheet border-paper-edge text-[12px] text-ink"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="code-public" className="font-mono text-[10px] tracking-[0.14em] text-ink-faint uppercase">
                      Make code visible in public portfolio
                    </Label>
                    <Switch
                      id="code-public"
                      checked={newIsPublicCode}
                      onCheckedChange={setNewIsPublicCode}
                    />
                  </div>

                  <CodeEditor
                    value={newCode}
                    onChange={setNewCode}
                    language={newLanguage}
                    onLanguageChange={setNewLanguage}
                  />

                  <StampButton type="submit" disabled={isSubmittingSolution} className="w-full">
                    {isSubmittingSolution ? "Saving..." : "FILE IT"}
                  </StampButton>
                </form>
              </PaperSheet>
            )}

            {/* Inline Edit Solution Form */}
            {editingSolutionId && (
              <PaperSheet variant="card" className="p-4">
                <form onSubmit={handleSaveEditSolution} className="space-y-4">
                  <div className="flex items-center justify-between border-b border-paper-edge pb-2">
                    <span className="font-type text-[13px] text-ink">Edit Solution Code</span>
                    <GhostButton type="button" onClick={() => setEditingSolutionId(null)}>
                      Cancel
                    </GhostButton>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="edit-lang" className="font-mono text-[10px] tracking-[0.14em] text-ink-faint uppercase">
                        Language
                      </Label>
                      <Select
                        value={editLanguage}
                        onValueChange={(val: string | null) => setEditLanguage((val || "cpp") as Language)}
                      >
                        <SelectTrigger id="edit-lang" className="h-8 bg-paper-sheet border-paper-edge text-[12px] text-ink">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-paper-sheet border-paper-edge text-[12px] text-ink">
                          <SelectItem value="cpp">C++</SelectItem>
                          <SelectItem value="python">Python</SelectItem>
                          <SelectItem value="java">Java</SelectItem>
                          <SelectItem value="go">Go</SelectItem>
                          <SelectItem value="rust">Rust</SelectItem>
                          <SelectItem value="js">JavaScript</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="edit-label" className="font-mono text-[10px] tracking-[0.14em] text-ink-faint uppercase">
                        Approach Label
                      </Label>
                      <Input
                        id="edit-label"
                        placeholder="e.g. Iterative DP"
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        className="h-8 bg-paper-sheet border-paper-edge text-[12px] text-ink"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="edit-code-public" className="font-mono text-[10px] tracking-[0.14em] text-ink-faint uppercase">
                      Make code visible in public portfolio
                    </Label>
                    <Switch
                      id="edit-code-public"
                      checked={editIsPublicCode}
                      onCheckedChange={setEditIsPublicCode}
                    />
                  </div>

                  <CodeEditor
                    value={editCode}
                    onChange={setEditCode}
                    language={editLanguage}
                    onLanguageChange={setEditLanguage}
                  />

                  <StampButton type="submit" disabled={isSubmittingEdit} className="w-full">
                    {isSubmittingEdit ? "Updating..." : "Update Solution"}
                  </StampButton>
                </form>
              </PaperSheet>
            )}

            {/* List Solutions */}
            {problem.solutions?.length === 0 && !showAddForm ? (
              <div className="cpj-graph cpj-card-shadow rounded-[3px] p-6 text-center text-ink-faint font-body text-[14px]">
                No code submissions logged.
              </div>
            ) : (
              <div className="space-y-3">
                {problem.solutions?.map((sol) => {
                  const isExpanded = !!expandedSolutions[sol.id];
                  const analysis = sol.ai_analyses?.[0] || null;

                  return (
                    <PaperSheet key={sol.id} variant="card" className="overflow-hidden">
                      {/* Header bar of solution card */}
                      <div className="flex items-center justify-between px-4 py-3 border-b border-paper-edge select-none">
                        <div
                          onClick={() => toggleSolutionExpand(sol.id)}
                          className="flex-1 flex items-center gap-2.5 cursor-pointer"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-ink-faint" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-ink-faint" />
                          )}
                          <span className="font-mono text-[11px] tracking-[0.1em] text-ink uppercase border border-paper-edge px-2 py-0.5 rounded-[2px] bg-paper">
                            {sol.language}
                          </span>
                          {!sol.is_public_code && (
                            <span className="font-mono text-[9px] tracking-[0.16em] text-paper-edge bg-ink px-2 py-0.5 rounded-[2px]">
                              ▮ PRIVATE
                            </span>
                          )}
                          {sol.label && (
                            <span className="font-body text-[13px] text-ink-soft max-w-[140px] truncate">
                              {sol.label}
                            </span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2.5 shrink-0">
                          <button
                            onClick={() => startEditSolution(sol)}
                            className="text-ink-faint hover:text-ink transition-colors p-1"
                            title="Edit solution code"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteSolution(sol.id)}
                            className="text-ink-faint hover:text-blood transition-colors p-1"
                            title="Delete solution"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Content panel */}
                      {isExpanded && (
                        <div className="p-4 space-y-4">
                          {/* Code Display - graph-paper insert */}
                          <div className="relative cpj-graph cpj-card-shadow rounded-[3px] overflow-hidden">
                            <div
                              className="absolute left-[38px] top-0 bottom-0 w-px bg-margin-red pointer-events-none"
                              aria-hidden
                            />
                            <div className="relative flex items-center justify-end px-3 pt-2.5 pb-1">
                              <CopyButton code={sol.code} />
                            </div>
                            <pre data-lenis-prevent className="cpj-code relative px-4 pb-3.5 pl-[14px] overflow-auto text-[13px] font-mono leading-[1.65] text-ink max-h-[320px]">
                              <code>
                                {sol.code.split("\n").map((ln, li) => (
                                  <span key={li} className="line">
                                    {ln || " "}
                                  </span>
                                ))}
                              </code>
                            </pre>
                          </div>

                          {/* AI CLASSIFIED strip */}
                          <div className="relative bg-paper-sheet border-l-[3px] border-blueprint cpj-card-shadow rounded-[2px] px-3.5 py-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <Cap className="text-blueprint">⧉ CLASSIFIED</Cap>

                              {sol.ai_status === "pending" && (
                                <span className="font-mono text-[10px] tracking-[0.14em] text-ink-faint flex items-center gap-1.5 cpj-caret uppercase">
                                  <Loader2 className="w-3 h-3 animate-spin" /> reading the solution
                                </span>
                              )}
                              {sol.ai_status === "done" && (
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[10px] tracking-[0.14em] text-t-green flex items-center gap-1 uppercase">
                                    <CheckCircle className="w-3 h-3" /> analyzed
                                  </span>
                                  <button
                                    onClick={() => handleTriggerAnalysis(sol.id)}
                                    className="font-mono text-[10px] text-blueprint hover:underline cursor-pointer"
                                    title="Re-run AI analysis on this solution"
                                  >
                                    re-analyze
                                  </button>
                                </div>
                              )}
                              {sol.ai_status === "failed" && (
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[10px] tracking-[0.14em] text-blood flex items-center gap-1 uppercase">
                                    <AlertCircle className="w-3 h-3" /> failed
                                  </span>
                                  <button
                                    onClick={() => handleTriggerAnalysis(sol.id)}
                                    className="font-mono text-[10px] text-blueprint hover:underline cursor-pointer"
                                  >
                                    re-analyze
                                  </button>
                                </div>
                              )}
                              {sol.ai_status === "none" && (
                                <button
                                  onClick={() => handleTriggerAnalysis(sol.id)}
                                  className="font-mono text-[10px] tracking-[0.14em] text-blueprint hover:underline flex items-center gap-1 cursor-pointer uppercase"
                                >
                                  <Play className="w-3 h-3 fill-current" /> ai-tag this
                                </button>
                              )}
                            </div>

                            {/* Relevance guard (W6 L1): warn when the AI thinks this code does
                                not match the problem - catches wrong/junk pastes. */}
                            {sol.ai_status === "done" &&
                              analysis?.raw_response?.solves_problem === "no" && (
                                <div className="flex items-start gap-1.5 text-[11px] text-blood font-body leading-snug bg-blood/[0.06] border border-blood/30 rounded-[2px] px-2 py-1.5">
                                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                  <span>
                                    This code may not match the problem.
                                    {analysis.raw_response.relevance_note
                                      ? ` ${analysis.raw_response.relevance_note}`
                                      : " Double-check it's the right solution."}
                                  </span>
                                </div>
                              )}

                            {/* AI analysis chips */}
                            {sol.ai_status === "done" && analysis && (
                              <div className="space-y-1.5 pt-1">
                                {analysis.algorithms?.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 items-baseline">
                                    <span className="font-mono text-[9px] tracking-[0.16em] text-ink-faint w-[74px] shrink-0 uppercase">Algorithms</span>
                                    {analysis.algorithms.map((tag: string) => (
                                      <TopicChip key={tag} tag={tag} />
                                    ))}
                                  </div>
                                )}
                                {analysis.data_structures?.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 items-baseline">
                                    <span className="font-mono text-[9px] tracking-[0.16em] text-ink-faint w-[74px] shrink-0 uppercase">Data</span>
                                    {analysis.data_structures.map((tag: string) => (
                                      <TopicChip key={tag} tag={tag} />
                                    ))}
                                  </div>
                                )}
                                {analysis.techniques?.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 items-baseline">
                                    <span className="font-mono text-[9px] tracking-[0.16em] text-ink-faint w-[74px] shrink-0 uppercase">Techniques</span>
                                    {analysis.techniques.map((tag: string) => (
                                      <TopicChip key={tag} tag={tag} />
                                    ))}
                                  </div>
                                )}
                                {analysis.math_concepts?.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 items-baseline">
                                    <span className="font-mono text-[9px] tracking-[0.16em] text-ink-faint w-[74px] shrink-0 uppercase">Concepts</span>
                                    {analysis.math_concepts.map((tag: string) => (
                                      <TopicChip key={tag} tag={tag} />
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </PaperSheet>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* NOTES TAB */}
        {activeTab === "notes" && (
          <div role="tabpanel" className="space-y-6">
            <PaperSheet variant="card" className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Cap>JOURNAL NOTES</Cap>
                <div className="flex items-center gap-2">
                  <GhostButton onClick={() => setNotesPreview(!notesPreview)}>
                    {notesPreview ? "Edit Mode" : "Preview"}
                  </GhostButton>
                  <StampButton onClick={handleSaveNotes} disabled={isSavingNotes} className="px-3 py-1.5 text-[12px]">
                    {isSavingNotes ? "Saving..." : "Save Notes"}
                  </StampButton>
                </div>
              </div>

              {notesPreview ? (
                <div
                  className="font-body text-[16px] leading-[1.6] text-ink p-3 min-h-[120px] bg-paper rounded-[2px]"
                  dangerouslySetInnerHTML={{
                    __html:
                      renderMarkdown(notesText) ||
                      "<i>No notes saved. Click edit to log insights.</i>",
                  }}
                />
              ) : (
                <Textarea
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  placeholder="Log your thoughts, complexity analysis, or alternate approaches here (Markdown supported)..."
                  className="bg-paper-sheet border-paper-edge focus:border-blood min-h-[160px] text-[16px] font-body text-ink leading-[1.6]"
                />
              )}
              <div className="pt-1">
                <RedPen rotate={-2}>don&apos;t trust int here</RedPen>
              </div>
            </PaperSheet>

            {/* Custom Tags */}
            <div className="space-y-2">
              <Cap>CUSTOM TAGS</Cap>
              <div className="flex flex-wrap gap-[5px] items-center">
                {problem.custom_tags?.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handleRemoveTag(tag)}
                    className="font-mono text-[10px] px-[7px] py-[2px] rounded-[2px] bg-paper-sheet border border-paper-edge text-ink cursor-pointer hover:bg-blood/10 hover:text-blood hover:border-blood/30 transition-all"
                    title="Click to remove tag"
                  >
                    {tag} &times;
                  </button>
                ))}
                <input
                  type="text"
                  placeholder="+ add tag"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                  className="bg-transparent border border-dashed border-[#b3a988] rounded-[2px] font-mono text-[10px] text-ink-soft px-2 py-[3px] outline-none focus:border-blood w-[90px] focus:w-[130px] transition-all"
                />
              </div>
            </div>
          </div>
        )}

        {/* footer refrain */}
        <div className="flex items-center justify-between border-t border-paper-edge pt-3 mt-2">
          <span className="font-body italic text-[13px] text-ink-faint">
            everything in its right place
          </span>
          <Cap>weird fishes / arpeggi</Cap>
        </div>
      </main>
    </PaperSheet>
    </PageTurn>
  );
}
