"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ModifiedBear } from "@/components/modified-bear";
import { PaperSheet } from "@/components/paper/paper-sheet";
import { StampButton, GhostButton } from "@/components/paper/stamp";
import { Cap } from "@/components/paper/bits";
import { PasswordField } from "@/components/paper/password-field";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function SetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;
      setHasSession(!!user);
      setChecking(false);
    })();
    return () => {
      active = false;
    };
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("those don't match.");
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("you're in. everything in its right place.");
      router.push("/admin/problems");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "failed to set password");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="cpj-desk min-h-screen w-full flex items-center justify-center p-6">
      <PaperSheet variant="page" className="cpj-develop w-full max-w-[360px] p-8 text-center">
        <div className="select-none">
          <ModifiedBear className="w-[34px] h-[34px] mx-auto text-ink" />
          <Cap className="mt-2.5">OPTIMISTIC</Cap>
          <p className="font-type text-[14px] text-ink-soft mt-1">
            the best you can is good enough.
          </p>
        </div>

        {checking ? (
          <div className="flex items-center justify-center gap-2 text-ink-soft text-[12px] py-6 font-mono">
            <Loader2 className="w-4 h-4 animate-spin" /> checking your invite...
          </div>
        ) : !hasSession ? (
          <div className="mt-6 space-y-3">
            <p className="font-body text-[14px] text-ink-soft">
              this invite link is invalid or expired. ask the operator for a new one.
            </p>
            <GhostButton onClick={() => router.push("/login")} className="w-full justify-center">
              back to login
            </GhostButton>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="text-left mt-6 space-y-3.5">
            <div>
              <Cap>NEW PASSWORD</Cap>
              <PasswordField
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSaving}
                required
                wrapperClassName="mt-1"
              />
            </div>
            <div>
              <Cap>CONFIRM</Cap>
              <PasswordField
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={isSaving}
                required
                wrapperClassName="mt-1"
              />
            </div>
            <StampButton type="submit" disabled={isSaving} className="w-full mt-1 py-3 text-[15px]">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "▸ set password"}
            </StampButton>
          </form>
        )}
      </PaperSheet>
    </div>
  );
}
