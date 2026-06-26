"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { ModifiedBear } from "@/components/modified-bear";
import { PaperSheet } from "@/components/paper/paper-sheet";
import { StampButton } from "@/components/paper/stamp";
import { Cap } from "@/components/paper/bits";
import { PasswordField } from "@/components/paper/password-field";
import { ForgotPassword } from "@/components/forgot-password";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("error") === "invite_invalid") {
      toast.error("that invite link is invalid or already used. ask the operator for a fresh one.");
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("you have to fill it all in.");
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("you're in. everything in its right place.");
      router.push("/admin/problems");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "wrong. you don't belong here.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="cpj-desk min-h-screen w-full flex items-center justify-center p-6">
      <PaperSheet
        variant="page"
        className="cpj-develop w-full max-w-[360px] p-8 text-center"
      >
        {/* header */}
        <div className="select-none">
          <ModifiedBear className="w-[34px] h-[34px] mx-auto text-ink" />
          <div className="font-mono text-[12px] tracking-[0.2em] text-ink-soft mt-2.5">
            SOLVELOG
          </div>
          <p className="font-type text-[15px] text-blood mt-3">i don&apos;t belong here.</p>
        </div>

        <form onSubmit={handleLogin} className="text-left mt-6 space-y-3.5">
          <div>
            <Cap>EMAIL</Cap>
            <input
              type="email"
              autoComplete="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
              className="mt-1 w-full bg-paper-sheet border border-paper-edge rounded-[3px] px-3 py-2.5 font-body text-[15px] text-ink placeholder:text-ink-faint focus:outline-2 focus:outline-blood focus:outline-offset-2"
            />
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <Cap>PASSWORD</Cap>
              <ForgotPassword email={email} disabled={isLoading} />
            </div>
            <PasswordField
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
              wrapperClassName="mt-1"
            />
          </div>
          <StampButton type="submit" disabled={isLoading} className="w-full mt-1 py-3 text-[15px]">
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> waking up...
              </>
            ) : (
              "▸ sign in"
            )}
          </StampButton>
        </form>

        <p className="font-mono text-[9px] tracking-[0.1em] text-ink-faint mt-5">
          invite-only · request access on the home page
        </p>
      </PaperSheet>
    </div>
  );
}
