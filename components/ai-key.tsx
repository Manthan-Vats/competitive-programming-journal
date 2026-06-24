"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Loader2, KeyRound, CheckCircle, ExternalLink, Trash2, ShieldCheck } from "lucide-react";
import { StampButton } from "@/components/paper/stamp";
import { PasswordField } from "@/components/paper/password-field";
import { Cap } from "@/components/paper/bits";
import { toast } from "sonner";

interface KeyMeta {
  configured: boolean;
  hint: string | null;
  encryption_ready?: boolean;
}

// BYOK panel: each user supplies their OWN free Gemini key. It's stored encrypted server-side and
// used only to analyze that user's own solutions; this component only ever sees { configured, hint }
// - never the key itself.
export function AIKey({ onChange }: { onChange?: (configured: boolean) => void }) {
  const [meta, setMeta] = useState<KeyMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/ai-key");
      if (res.ok) {
        const data = (await res.json()) as KeyMeta;
        setMeta(data);
        onChange?.(data.configured);
      }
    } catch {
      // keep previous
    } finally {
      setLoading(false);
    }
  }, [onChange]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = async () => {
    if (!value.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/ai-key", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: value.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save key");
      setMeta(data);
      onChange?.(!!data.configured);
      setValue("");
      setEditing(false);
      toast.success("Gemini key saved. The AI librarian is awake.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save key");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/ai-key", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove key");
      setMeta({ configured: false, hint: null });
      onChange?.(false);
      toast.success("Key removed. AI is now off for your account.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove key");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-ink-soft text-[12px] py-2 font-mono">
        <Loader2 className="w-4 h-4 animate-spin" /> Checking key...
      </div>
    );
  }

  const showForm = editing || !meta?.configured;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-blood" />
        <h4 className="text-[13px] font-semibold text-ink font-type uppercase tracking-wider">
          Your Gemini API Key
        </h4>
      </div>

      {meta?.configured && !editing ? (
        <div className="flex flex-wrap items-center gap-3 text-[12px] font-mono">
          <span className="inline-flex items-center gap-1.5 text-t-green">
            <CheckCircle className="w-3.5 h-3.5" /> key set
          </span>
          <span className="text-ink-faint">•••• {meta.hint}</span>
          <button onClick={() => setEditing(true)} className="text-blueprint hover:underline">
            replace
          </button>
          <button
            onClick={remove}
            disabled={saving}
            className="inline-flex items-center gap-1 text-blood hover:underline disabled:opacity-50"
          >
            <Trash2 className="w-3 h-3" /> remove
          </button>
        </div>
      ) : (
        <p className="text-[12px] text-ink-soft font-body leading-relaxed">
          The AI features (algorithm tagging, hints, critiques, pattern cards) run on Google&apos;s
          Gemini. Add your own <strong>free</strong> key to switch them on - it powers only your own
          analyses and spends only your own quota.{" "}
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-blueprint hover:underline"
          >
            Get a free key <ExternalLink className="w-3 h-3" />
          </a>
        </p>
      )}

      {showForm && (
        <div className="space-y-2">
          <Cap>PASTE KEY (from Google AI Studio)</Cap>
          <PasswordField
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="AIzaSy... or AQ...."
            autoComplete="off"
            spellCheck={false}
          />
          <div className="flex items-center gap-3">
            <StampButton onClick={save} disabled={saving || !value.trim()} className="text-[13px]">
              {saving ? (
                <>
                  <Loader2 className="w-[14px] h-[14px] animate-spin" /> verifying...
                </>
              ) : (
                "save key"
              )}
            </StampButton>
            {editing && meta?.configured && (
              <button
                onClick={() => {
                  setEditing(false);
                  setValue("");
                }}
                disabled={saving}
                className="font-mono text-[12px] text-ink-faint hover:text-ink"
              >
                cancel
              </button>
            )}
          </div>
        </div>
      )}

      <p className="flex items-start gap-1.5 text-[11px] text-ink-faint font-body leading-relaxed">
        <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-ink-soft" />
        Stored encrypted (AES-256-GCM); never shown again and never sent back to your browser. We
        verify it with one tiny request when you save it.
      </p>
    </div>
  );
}
