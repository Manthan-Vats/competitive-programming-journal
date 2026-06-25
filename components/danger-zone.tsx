"use client";

import React, { useState } from "react";
import { Loader2, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { StampButton } from "@/components/paper/stamp";
import { Cap } from "@/components/paper/bits";

// Self-service data controls for the Settings "danger zone": export everything we hold, or delete
// the account permanently. Talks to /api/account (GET = export, DELETE = wipe). Deletion requires
// the user to type DELETE, mirroring the server-side confirm guard.
export const DangerZone: React.FC = () => {
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState("");

  const onExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/account");
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "cp-journal-export.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("your data is on its way down.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "could not export your data");
    } finally {
      setExporting(false);
    }
  };

  const onDelete = async () => {
    if (confirm !== "DELETE") {
      toast.error('type DELETE to confirm.');
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Delete failed");
      toast.success("account erased. how to disappear completely.");
      // Session cookies are cleared server-side; send the (now anonymous) browser home.
      window.location.href = "/login";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "could not delete your account");
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* export */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <Cap>EXPORT YOUR DATA</Cap>
          <p className="font-body text-[13px] text-ink-soft mt-1 max-w-md">
            Download everything filed under your name - problems, solutions, analyses, timings,
            verifications - as one JSON file. Your encrypted API key is never included.
          </p>
        </div>
        <StampButton type="button" onClick={onExport} disabled={exporting} className="text-[13px] shrink-0">
          {exporting ? <><Loader2 className="w-[14px] h-[14px] animate-spin" /> packing...</> : <><Download className="w-[14px] h-[14px]" /> export</>}
        </StampButton>
      </div>

      {/* delete */}
      <div className="border border-blood/40 bg-blood/[0.03] rounded-[3px] p-4">
        <Cap>DELETE ACCOUNT</Cap>
        <p className="font-body text-[13px] text-ink-soft mt-1 max-w-md">
          Permanently erase your account and <em>all</em> your data. This cannot be undone. Type{" "}
          <span className="font-mono text-blood">DELETE</span> to confirm.
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 mt-3">
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="DELETE"
            aria-label="Type DELETE to confirm account deletion"
            className="w-full sm:w-[160px] bg-paper-sheet border border-paper-edge rounded-[3px] px-3 py-2 font-mono text-[13px] text-ink placeholder:text-ink-faint focus:outline-2 focus:outline-blood focus:outline-offset-2"
          />
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting || confirm !== "DELETE"}
            className="inline-flex items-center justify-center gap-1.5 font-mono text-[13px] text-paper bg-blood px-3.5 py-2 rounded-[3px] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity cursor-pointer shrink-0"
          >
            {deleting ? <><Loader2 className="w-[14px] h-[14px] animate-spin" /> erasing...</> : <><Trash2 className="w-[14px] h-[14px]" /> delete forever</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DangerZone;
