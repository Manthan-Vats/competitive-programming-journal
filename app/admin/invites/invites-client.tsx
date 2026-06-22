"use client";

import React, { useEffect, useState } from "react";
import { Loader2, Mail, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PaperSheet } from "@/components/paper/paper-sheet";
import { StampButton, GhostButton, Stamp } from "@/components/paper/stamp";
import { Cap } from "@/components/paper/bits";
import { ModifiedBear } from "@/components/modified-bear";

interface AccessRequest {
  id: string;
  email: string;
  note: string | null;
  status: "pending" | "invited" | "rejected";
  created_at: string;
  reviewed_at: string | null;
}

function LocalTime({ iso }: { iso: string }) {
  const [text, setText] = useState("");
  useEffect(() => {
    setText(new Date(iso).toLocaleString());
  }, [iso]);
  return <span suppressHydrationWarning>{text || " "}</span>;
}

export function InvitesClient({ initialRequests }: { initialRequests: AccessRequest[] }) {
  const [requests, setRequests] = useState<AccessRequest[]>(initialRequests);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [manualEmail, setManualEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);

  const approve = async (req: AccessRequest) => {
    setBusyId(req.id);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: req.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to invite");
      setRequests((prev) =>
        prev.map((r) => (r.id === req.id ? { ...r, status: "invited", reviewed_at: new Date().toISOString() } : r))
      );
      toast.success(
        data.alreadyRegistered
          ? `${req.email} already has an account - they can just sign in.`
          : `invite sent to ${req.email}.`
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "failed to send invite");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (req: AccessRequest) => {
    setBusyId(req.id);
    try {
      const res = await fetch(`/api/access-requests/${req.id}`, { method: "PATCH" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to reject");
      setRequests((prev) =>
        prev.map((r) => (r.id === req.id ? { ...r, status: "rejected", reviewed_at: new Date().toISOString() } : r))
      );
      toast.success(`rejected ${req.email}.`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "failed to reject");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (req: AccessRequest) => {
    setBusyId(req.id);
    try {
      const res = await fetch(`/api/access-requests/${req.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to remove");
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
      toast.success(`removed ${req.email}.`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "failed to remove");
    } finally {
      setBusyId(null);
    }
  };

  const inviteManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualEmail.trim()) return;
    setIsInviting(true);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: manualEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to invite");
      toast.success(
        data.alreadyRegistered
          ? `${data.email} already has an account - they can just sign in.`
          : `invite sent to ${data.email}.`
      );
      setManualEmail("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "failed to send invite");
    } finally {
      setIsInviting(false);
    }
  };

  const pending = Array.from(
    new Map(requests.filter((r) => r.status === "pending").map((r) => [r.email, r])).values()
  );
  const handled = requests.filter((r) => r.status !== "pending");

  const inputCls =
    "w-full bg-paper-sheet border border-paper-edge rounded-[3px] px-3 py-2.5 font-body text-[15px] text-ink placeholder:text-ink-faint focus:outline-2 focus:outline-blood focus:outline-offset-2";

  return (
    <PaperSheet variant="page" className="cpj-develop p-[22px] md:p-[26px]">
      <div>
        <Cap>06 · INVITES</Cap>
        <h1 className="font-display text-[40px] leading-[0.9] mt-1">WHO CAN ENTER</h1>
        <p className="font-body italic text-[14px] text-ink-soft mt-0.5">
          approve a request to send a one-click invite.
        </p>
      </div>

      {/* manual invite */}
      <div className="bg-paper-sheet cpj-card-shadow rounded-[3px] p-4 mt-5">
        <Cap>THE GUEST PASS</Cap>
        <form onSubmit={inviteManual} className="flex flex-col sm:flex-row gap-3 sm:items-center mt-2.5">
          <input
            type="email"
            value={manualEmail}
            onChange={(e) => setManualEmail(e.target.value)}
            placeholder="email to invite..."
            className={inputCls}
            disabled={isInviting}
          />
          <StampButton type="submit" disabled={isInviting} className="shrink-0">
            {isInviting ? <Loader2 className="w-4 h-4 animate-spin" /> : "▸ SEND INVITE"}
          </StampButton>
        </form>
        <p className="font-mono text-[9px] tracking-[0.1em] text-ink-faint mt-2">
          ▸ sends a one-click invite to any address · no paid domain needed
        </p>
      </div>

      {/* pending */}
      <div className="mt-5">
        <Cap className="mb-2.5">PENDING · at the door ({pending.length})</Cap>
        {pending.length === 0 ? (
          <div className="text-center py-8 flex flex-col items-center gap-2">
            <ModifiedBear className="w-8 h-8 text-ink-faint opacity-50" />
            <p className="font-body italic text-[14px] text-ink-soft">no one waiting at the door.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pending.map((req) => (
              <div key={req.id} className="bg-paper-sheet cpj-card-shadow rounded-[3px] p-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Mail className="w-[14px] h-[14px] text-ink-faint shrink-0" />
                    <span className="font-body text-[16px] text-ink truncate">{req.email}</span>
                  </div>
                  {req.note && <p className="font-body italic text-[13px] text-ink-soft pl-6 mt-0.5">{req.note}</p>}
                  <p className="font-mono text-[10px] text-ink-faint pl-6 mt-0.5">
                    <LocalTime iso={req.created_at} />
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <StampButton onClick={() => approve(req)} disabled={busyId === req.id} className="text-[12px] py-1.5 px-3">
                    {busyId === req.id ? <Loader2 className="w-[14px] h-[14px] animate-spin" /> : "approve"}
                  </StampButton>
                  <GhostButton onClick={() => reject(req)} disabled={busyId === req.id}>
                    reject
                  </GhostButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* history */}
      {handled.length > 0 && (
        <div className="mt-5">
          <Cap className="mb-2.5">HISTORY · the ledger</Cap>
          <div className="space-y-1.5">
            {handled.map((req) => (
              <div key={req.id} className="flex items-center justify-between gap-4 px-4 py-2.5 border-b border-dotted border-paper-edge">
                <span className="font-body text-[15px] text-ink truncate">{req.email}</span>
                <div className="flex items-center gap-2.5 shrink-0">
                  {req.status === "invited" ? (
                    <Stamp label="INVITED" tone="green" size="sm" rotate={-3} />
                  ) : (
                    <Stamp label="REJECTED" tone="faded" size="sm" rotate={-3} />
                  )}
                  <button
                    onClick={() => remove(req)}
                    disabled={busyId === req.id}
                    title="remove from history"
                    className="text-ink-faint hover:text-blood"
                  >
                    {busyId === req.id ? <Loader2 className="w-[13px] h-[13px] animate-spin" /> : <Trash2 className="w-[13px] h-[13px]" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </PaperSheet>
  );
}
