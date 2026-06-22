"use client";

import React, { useState, useEffect } from "react";
import { Loader2, ExternalLink } from "lucide-react";
import type { Profile } from "@/types";
import { toast } from "sonner";
import { SyncHistory } from "@/components/sync-history";
import { VerifyHandles } from "@/components/verify-handles";
import { ShareCard } from "@/components/share-card";
import { AIAnalysis } from "@/components/ai-analysis";
import { PaperSheet } from "@/components/paper/paper-sheet";
import { StampButton } from "@/components/paper/stamp";
import { Cap } from "@/components/paper/bits";
import { useSfx } from "@/components/paper/sound-provider";

interface HandleLink {
  key: keyof Pick<Profile, "cf_handle" | "lc_handle" | "ac_handle" | "github_handle">;
  label: string;
  placeholder: string;
  href: (h: string) => string;
}

const HANDLE_LINKS: HandleLink[] = [
  { key: "cf_handle", label: "Codeforces", placeholder: "tourist", href: (h) => `https://codeforces.com/profile/${h}` },
  { key: "lc_handle", label: "LeetCode", placeholder: "your-handle", href: (h) => `https://leetcode.com/${h}` },
  { key: "ac_handle", label: "AtCoder", placeholder: "your-handle", href: (h) => `https://atcoder.jp/users/${h}` },
  { key: "github_handle", label: "GitHub", placeholder: "your-handle", href: (h) => `https://github.com/${h}` },
];

const EMPTY: Profile = {
  id: "", user_id: "", username: "", display_name: "", bio: "",
  cf_handle: "", lc_handle: "", ac_handle: "", github_handle: "", updated_at: "",
};

const inputCls =
  "w-full bg-paper-sheet border border-paper-edge rounded-[3px] px-3 py-2.5 font-body text-[15px] text-ink placeholder:text-ink-faint focus:outline-2 focus:outline-blood focus:outline-offset-2";

export default function SettingsPage() {
  const [form, setForm] = useState<Profile>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { enabled: soundOn, toggle: toggleSound } = useSfx();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/profile");
        const data = await res.json();
        if (active && res.ok && data) setForm({ ...EMPTY, ...data });
      } catch {
        toast.error("could not load your profile.");
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const update = (key: keyof Profile, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username,
          display_name: form.display_name,
          bio: form.bio,
          cf_handle: form.cf_handle,
          lc_handle: form.lc_handle,
          ac_handle: form.ac_handle,
          github_handle: form.github_handle,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setForm({ ...EMPTY, ...data });
      toast.success("saved. everything in its right place.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "an error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  // One continuous dossier sheet: sections are divided by ruled hairlines + typed
  // labels, NOT detached floating cards (R2). Inner blocks that must read as filed
  // items (the live library card, judge cards) keep their raised look.
  const Section = ({ cap, children }: { cap: string; children: React.ReactNode }) => (
    <section className="mt-6 pt-6 border-t border-paper-edge">
      <Cap>{cap}</Cap>
      <div className="mt-3">{children}</div>
    </section>
  );

  return (
    <PaperSheet variant="page" className="cpj-develop p-[22px] md:p-[26px]">
      <div>
        <Cap>05 · SETTINGS</Cap>
        <h1 className="font-display text-[38px] leading-[0.9] mt-1">HOW TO DISAPPEAR</h1>
        <p className="font-body italic text-[14px] text-ink-soft mt-0.5">
          your portfolio identity - the face on the public page.
        </p>
      </div>

      {/* ① PUBLIC IDENTITY */}
      <Section cap="① PUBLIC IDENTITY · the library card">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-6 items-start">
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {isLoading ? (
              <div className="flex items-center gap-2 text-ink-soft text-[12px] py-8 justify-center font-mono">
                <Loader2 className="w-4 h-4 animate-spin" /> loading profile...
              </div>
            ) : (
              <>
                <div>
                  <Cap>PUBLIC HANDLE</Cap>
                  <div className="flex items-stretch mt-1">
                    <span className="font-mono text-[13px] text-ink-faint bg-[#E4DCC6] border border-r-0 border-paper-edge rounded-l-[3px] px-2 flex items-center">
                      /u/
                    </span>
                    <input
                      value={form.username ?? ""}
                      onChange={(e) => update("username", e.target.value)}
                      placeholder="your-handle"
                      className={`${inputCls} rounded-l-none`}
                    />
                  </div>
                </div>
                <div>
                  <Cap>DISPLAY NAME</Cap>
                  <input value={form.display_name ?? ""} onChange={(e) => update("display_name", e.target.value)} placeholder="e.g. Thom Yorke" className={`mt-1 ${inputCls}`} />
                </div>
                <div>
                  <Cap>BIO</Cap>
                  <textarea value={form.bio ?? ""} onChange={(e) => update("bio", e.target.value)} placeholder="a short line for the portfolio hero." className={`mt-1 ${inputCls} min-h-[80px] resize-y`} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {HANDLE_LINKS.map((h) => (
                    <div key={h.key}>
                      <Cap>{h.label}</Cap>
                      <input value={(form[h.key] as string) ?? ""} onChange={(e) => update(h.key, e.target.value)} placeholder={h.placeholder} className={`mt-1 ${inputCls}`} />
                    </div>
                  ))}
                </div>
                <StampButton type="submit" disabled={isSaving} className="text-[13px]">
                  {isSaving ? <><Loader2 className="w-[14px] h-[14px] animate-spin" /> saving...</> : "save changes"}
                </StampButton>
              </>
            )}
          </form>

          {/* live library-card preview */}
          <div>
            <Cap className="text-center mb-2">LIVE PREVIEW</Cap>
            <div className="bg-paper border border-paper-edge rounded-[3px] cpj-card-shadow p-4">
              <div className="border-b border-dashed border-ink/30 pb-2 mb-2.5 font-mono text-[9px] tracking-[0.16em] text-ink-faint">
                CP JOURNAL · PUBLIC IDENTITY · /u/{form.username || "..."}
              </div>
              <p className="font-display text-[24px] leading-[0.95] uppercase">
                {form.display_name?.trim() || "Competitive Programmer"}
              </p>
              <p className="font-body text-[13px] leading-[1.5] text-ink-soft my-2">
                {form.bio?.trim() || "A personal competitive programming portfolio."}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {HANDLE_LINKS.filter((h) => (form[h.key] as string)?.trim()).map((h) => (
                  <a
                    key={h.key}
                    href={h.href((form[h.key] as string).trim())}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-[11px] border border-blueprint text-blueprint px-2 py-0.5 rounded-[2px] hover:bg-blueprint/5"
                  >
                    {h.label}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ② VERIFY */}
      <Section cap="② VERIFY YOUR HANDLES · the notary">
        <VerifyHandles cfHandle={form.cf_handle} lcHandle={form.lc_handle} githubHandle={form.github_handle} username={form.username} />
      </Section>

      {/* ③ SHOW OFF */}
      <Section cap="③ SHOW OFF · your achievement card">
        <ShareCard username={form.username} />
      </Section>

      {/* ④ SYNC */}
      <Section cap="④ SYNC FROM THE JUDGES · the filing clerk">
        <SyncHistory cfHandle={form.cf_handle} lcHandle={form.lc_handle} />
      </Section>

      {/* ⑤ AI LIBRARIAN */}
      <Section cap="⑤ THE AI LIBRARIAN · analyze the shelf">
        <AIAnalysis />
      </Section>

      {/* ⑥ PREFERENCES */}
      <Section cap="⑥ PREFERENCES">
        <button onClick={toggleSound} aria-pressed={soundOn} className="inline-flex items-center gap-3 cursor-pointer font-mono text-[12px] text-ink-soft">
          <span className={`w-[34px] h-[18px] rounded-full border border-paper-edge relative transition-colors ${soundOn ? "bg-blood" : "bg-[#d8d0bb]"}`}>
            <span className={`absolute top-[1px] w-[14px] h-[14px] rounded-full bg-paper shadow transition-all ${soundOn ? "left-[17px]" : "left-[1px]"}`} />
          </span>
          Sound - typewriter / stamp / page-turn <span className="text-ink-faint">({soundOn ? "on" : "off"})</span>
        </button>
      </Section>
    </PaperSheet>
  );
}
