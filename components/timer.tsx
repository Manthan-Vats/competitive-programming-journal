"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useRouter } from "next/navigation";
import { Play, Square, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { TimingSession } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Define Context Type
interface TimerContextType {
  activeSessionId: string | null;
  activeProblemId: string | null;
  activeStartISO: string | null;
  elapsedSeconds: number;
  startTimer: (problemId: string) => Promise<void>;
  stopTimer: () => Promise<void>;
  isLoading: boolean;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

export const useTimerContext = () => {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error("useTimerContext must be used within a TimerProvider");
  }
  return context;
};

export const TimerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeProblemId, setActiveProblemId] = useState<string | null>(null);
  const [activeStartISO, setActiveStartISO] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Sync state from localStorage on mount
  useEffect(() => {
    const sId = localStorage.getItem("cpj_active_session_id");
    const pId = localStorage.getItem("cpj_active_problem_id");
    const startStr = localStorage.getItem("cpj_active_session_start");

    if (sId && pId && startStr) {
      setActiveSessionId(sId);
      setActiveProblemId(pId);
      setActiveStartISO(startStr);

      const startTime = new Date(startStr).getTime();
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setElapsedSeconds(elapsed > 0 ? elapsed : 0);
    }
    setIsLoading(false);
  }, []);

  // Live elapsed counter
  useEffect(() => {
    if (!activeStartISO) {
      setElapsedSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      const startTime = new Date(activeStartISO).getTime();
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setElapsedSeconds(elapsed > 0 ? elapsed : 0);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeStartISO]);

  const startTimer = useCallback(async (problemId: string) => {
    setIsLoading(true);
    const startedAt = new Date().toISOString();
    try {
      const res = await fetch("/api/timing-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem_id: problemId, started_at: startedAt }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to start session");
      }

      localStorage.setItem("cpj_active_session_id", data.id);
      localStorage.setItem("cpj_active_problem_id", problemId);
      localStorage.setItem("cpj_active_session_start", startedAt);

      setActiveSessionId(data.id);
      setActiveProblemId(problemId);
      setActiveStartISO(startedAt);
      setElapsedSeconds(0);

      toast.success("Timer started!");
    } catch (err: any) {
      toast.error(err.message || "An error occurred starting the timer");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const stopTimer = useCallback(async () => {
    if (!activeSessionId) return;
    setIsLoading(true);
    const endedAt = new Date().toISOString();
    try {
      const res = await fetch(`/api/timing-sessions/${activeSessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ended_at: endedAt }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to stop session");
      }

      localStorage.removeItem("cpj_active_session_id");
      localStorage.removeItem("cpj_active_problem_id");
      localStorage.removeItem("cpj_active_session_start");

      setActiveSessionId(null);
      setActiveProblemId(null);
      setActiveStartISO(null);
      setElapsedSeconds(0);

      toast.success("Timer stopped and session saved!");
    } catch (err: any) {
      toast.error(err.message || "An error occurred stopping the timer");
    } finally {
      setIsLoading(false);
    }
  }, [activeSessionId]);

  return (
    <TimerContext.Provider
      value={{
        activeSessionId,
        activeProblemId,
        activeStartISO,
        elapsedSeconds,
        startTimer,
        stopTimer,
        isLoading,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
};

// Mode 1: Compact Header Indicator
export const TimerIndicator: React.FC = () => {
  const { activeProblemId, elapsedSeconds, activeStartISO } = useTimerContext();
  const router = useRouter();

  if (!activeStartISO) return null;

  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;

  const displayTime = [hours, minutes, seconds]
    .map((v) => v.toString().padStart(2, "0"))
    .join(":");

  return (
    <div
      onClick={() => router.push(`/admin/problems/${activeProblemId}`)}
      className="flex items-center gap-2 bg-paper-sheet text-ink px-3 py-1.5 rounded-[3px] cursor-pointer cpj-card-shadow font-mono text-[13px] select-none"
      title="the gloaming - back to the problem"
    >
      <span className="w-[7px] h-[7px] rounded-full bg-blood cpj-pulse" />
      <span className="text-ink-faint text-[9px] tracking-[0.16em] uppercase">the gloaming</span>
      <span className="tabular-nums">{displayTime}</span>
    </div>
  );
};

// Helper for formatting duration
const formatSeconds = (totalSeconds: number): string => {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
};

// Mode 2: Full Embedded Timer Component
interface TimerProps {
  problemId: string;
  sessions: TimingSession[];
  onSessionUpdate: () => void;
}

export const Timer: React.FC<TimerProps> = ({
  problemId,
  sessions,
  onSessionUpdate,
}) => {
  const {
    activeProblemId,
    startTimer,
    stopTimer,
    elapsedSeconds,
    isLoading,
  } = useTimerContext();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [manualStart, setManualStart] = useState("");
  const [manualEnd, setManualEnd] = useState("");
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  const isActiveForThisProblem = activeProblemId === problemId;

  // Calculate sum of finished sessions
  const finishedTimeSeconds = useMemo(() => {
    return sessions.reduce((acc, s) => {
      if (s.started_at && s.ended_at) {
        const start = new Date(s.started_at).getTime();
        const end = new Date(s.ended_at).getTime();
        return acc + Math.floor((end - start) / 1000);
      }
      return acc;
    }, 0);
  }, [sessions]);

  // Total elapsed (finished + active)
  const totalSeconds = finishedTimeSeconds + (isActiveForThisProblem ? elapsedSeconds : 0);

  const handleStartStop = async () => {
    if (isActiveForThisProblem) {
      await stopTimer();
    } else {
      await startTimer(problemId);
    }
    onSessionUpdate();
  };

  const handleAddManualSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualStart || !manualEnd) {
      toast.error("Please fill in both start and end times.");
      return;
    }
    const startMs = new Date(manualStart).getTime();
    const endMs = new Date(manualEnd).getTime();

    if (endMs <= startMs) {
      toast.error("End time must be after start time.");
      return;
    }

    setIsSubmittingManual(true);
    try {
      const res = await fetch("/api/timing-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem_id: problemId,
          started_at: new Date(manualStart).toISOString(),
          ended_at: new Date(manualEnd).toISOString(),
          is_manual: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create manual session");
      }

      toast.success("Manual session added!");
      setDialogOpen(false);
      setManualStart("");
      setManualEnd("");
      onSessionUpdate();
    } catch (err: any) {
      toast.error(err.message || "Error adding manual session");
    } finally {
      setIsSubmittingManual(false);
    }
  };

  return (
    <div className="bg-paper-sheet cpj-card-shadow p-4 rounded-[3px] w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-ink-faint text-[10px] uppercase tracking-[0.16em] font-mono">
            THE GLOAMING
          </h4>
          <p className="font-mono text-[22px] text-blood mt-1 flex items-center gap-2">
            {formatSeconds(totalSeconds)}
            {isActiveForThisProblem && (
              <span className="flex items-center gap-[5px] text-[10px] uppercase tracking-[0.18em] text-blood/70 select-none">
                <span className="w-[7px] h-[7px] rounded-full bg-blood cpj-pulse" />
                present tense
              </span>
            )}
          </p>
          <span className="text-[12px] text-ink-faint font-mono">
            across {sessions.length + (isActiveForThisProblem ? 1 : 0)} sessions
          </span>
        </div>

        <div className="flex gap-[8px]">
          <Button
            onClick={handleStartStop}
            disabled={isLoading}
            variant={isActiveForThisProblem ? "destructive" : "default"}
            size="sm"
            className="flex items-center gap-[6px]"
          >
            {isLoading ? (
              <Loader2 className="w-[14px] h-[14px] animate-spin" />
            ) : isActiveForThisProblem ? (
              <>
                <Square className="w-[14px] h-[14px] fill-current" /> Stop
              </>
            ) : (
              <>
                <Play className="w-[14px] h-[14px] fill-current" /> Start
              </>
            )}
          </Button>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger
              render={
                <Button variant="outline" size="sm" className="flex items-center gap-[6px]">
                  <Plus className="w-[14px] h-[14px]" /> Manual
                </Button>
              }
            />
            <DialogContent className="bg-paper-sheet border-paper-edge text-ink">
              <DialogHeader>
                <DialogTitle className="font-type text-[16px] text-ink">
                  add a manual session
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddManualSession} className="space-y-4 py-2">
                <div className="space-y-1">
                  <Label htmlFor="started_at" className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-faint">
                    Start Time
                  </Label>
                  <Input
                    id="started_at"
                    type="datetime-local"
                    value={manualStart}
                    onChange={(e) => setManualStart(e.target.value)}
                    className="bg-paper-sheet border-input focus:border-blood text-[13px] text-ink"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ended_at" className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-faint">
                    End Time
                  </Label>
                  <Input
                    id="ended_at"
                    type="datetime-local"
                    value={manualEnd}
                    onChange={(e) => setManualEnd(e.target.value)}
                    className="bg-paper-sheet border-input focus:border-blood text-[13px] text-ink"
                    required
                  />
                </div>
                <DialogFooter className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    disabled={isSubmittingManual}
                    className="text-[12px]"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmittingManual} className="text-[12px]">
                    {isSubmittingManual ? (
                      <Loader2 className="w-[14px] h-[14px] animate-spin" />
                    ) : (
                      "Add Session"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Sessions History List */}
      {sessions.length > 0 && (
        <div className="border-t border-paper-edge pt-[10px] space-y-[6px] max-h-[160px] overflow-y-auto pr-1">
          {sessions.map((s, idx) => {
            const start = new Date(s.started_at);
            const labelStr = start.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            const diff = s.ended_at
              ? Math.floor((new Date(s.ended_at).getTime() - start.getTime()) / 1000)
              : 0;

            return (
              <div
                key={s.id || idx}
                className="flex justify-between text-[12px] text-ink-soft font-body py-[2px]"
              >
                <span>{labelStr}</span>
                <span className="font-mono">{formatSeconds(diff)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
