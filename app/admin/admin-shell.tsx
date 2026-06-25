"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  BarChart2,
  Brain,
  Settings,
  Mail,
  Plus,
  Menu,
  Volume2,
  VolumeX,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { TimerProvider, TimerIndicator } from "@/components/timer";
import { ModifiedBear } from "@/components/modified-bear";
import { StampButton } from "@/components/paper/stamp";
import { useSfx } from "@/components/paper/sound-provider";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { OnboardingTour } from "@/components/onboarding-tour";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  icon: React.ReactNode;
  label: string;
  etab: string;
}

export function AdminShell({
  children,
  isOperator = false,
}: {
  children: React.ReactNode;
  isOperator?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { enabled: soundOn, toggle: toggleSound } = useSfx();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success("signed out");
      router.push("/login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "failed to sign out");
    }
  };

  const navItems: NavItem[] = [
    { href: "/admin", icon: <LayoutDashboard className="w-[14px] h-[14px]" />, label: "Dashboard", etab: "var(--color-blood)" },
    { href: "/admin/problems", icon: <BookOpen className="w-[14px] h-[14px]" />, label: "Problems", etab: "var(--color-t-yellow)" },
    { href: "/admin/analytics", icon: <BarChart2 className="w-[14px] h-[14px]" />, label: "Analytics", etab: "var(--color-t-blue)" },
    { href: "/admin/revision", icon: <Brain className="w-[14px] h-[14px]" />, label: "Revision", etab: "var(--color-t-green)" },
    { href: "/admin/settings", icon: <Settings className="w-[14px] h-[14px]" />, label: "Settings", etab: "var(--color-t-orange)" },
    ...(isOperator
      ? [{ href: "/admin/invites", icon: <Mail className="w-[14px] h-[14px]" />, label: "Invites", etab: "var(--color-t-red)" }]
      : []),
  ];

  const SpineContent = () => (
    <nav className="flex flex-col min-h-full bg-board py-3" aria-label="Journal sections">
      {/* TOP cluster - pinned to the top of the viewport */}
      <div className="sticky top-0 z-10 bg-board pt-1">
        <Link
          href="/"
          className="flex items-center gap-2 px-4 pb-3.5 group"
          target="_blank"
        >
          <ModifiedBear className="w-[15px] h-[15px] text-blood shrink-0" />
          <span className="font-mono text-[13px] tracking-[0.16em] text-[#efe7cf]">
            CP JOURNAL
          </span>
        </Link>
        <div className="font-mono text-[10px] tracking-[0.22em] text-[#8d856c] px-4 pb-1.5">
          TRACKLIST
        </div>

        {navItems.map((item, idx) => {
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              onClick={() => setIsMobileOpen(false)}
              className={cn(
                "relative flex items-center gap-[9px] px-4 py-[9px] font-mono text-[13px] transition-colors",
                isActive
                  ? "text-[#f4eed8] bg-blood/[0.18]"
                  : "text-[#b3ab92] hover:text-[#efe7cf]"
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-blood" />
              )}
              <span
                className={cn(
                  "text-[10px] w-[14px] tabular-nums",
                  isActive ? "text-blood" : "text-[#857d65]"
                )}
              >
                {String(idx + 1).padStart(2, "0")}
              </span>
              {item.icon}
              <span>{item.label}</span>
              <span
                aria-hidden
                className="absolute right-0 top-1/2 -translate-y-1/2 w-[6px] h-[18px] rounded-r-[2px] opacity-85"
                style={{ background: item.etab }}
              />
            </Link>
          );
        })}
      </div>

      {/* spacer so the bottom cluster sits at the foot of the journal */}
      <div className="flex-1" />

      {/* BOTTOM cluster - pinned to the bottom: view public, then EXIT below it */}
      <div className="sticky bottom-0 bg-board pb-1">
        <div className="h-px bg-white/[0.08] mx-4 mb-1.5" />
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          data-tour="view-public"
          className="flex items-center gap-2 px-4 py-[7px] font-mono text-[12px] text-[#cdc3a3] hover:text-acid transition-colors"
        >
          view public
        </a>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2 px-4 py-2.5 mt-1 border-t border-white/[0.08] font-type text-[13px] tracking-[0.12em] text-[#d98f8f] hover:text-[#fbe9e7] hover:bg-blood/25 transition-colors"
        >
          EXIT
          <span className="ml-auto font-mark text-[10px] text-[#867e69] tracking-normal normal-case">
            music for a film
          </span>
        </button>
      </div>
    </nav>
  );

  return (
    <TimerProvider>
      {/* The desk: one consistent surface with an even inset on all four sides, so the
          bound journal (spine + page) reads as a single object resting on it. */}
      <div className="cpj-desk min-h-screen flex p-2 md:p-3">
        {/* desktop spine - a BOUND board that runs the full document height (stretch);
            the nav itself is sticky INSIDE so it stays in view while you scroll. This
            kills the old "sidebar stops before the bottom" dark gap. */}
        <aside className="hidden md:flex md:flex-col w-[158px] shrink-0 self-stretch bg-board rounded-l-[6px] shadow-[inset_-8px_0_14px_rgba(0,0,0,0.45)]">
          <SpineContent />
        </aside>

        {/* main column */}
        <div className="flex-1 min-w-0 flex flex-col pl-2 md:pl-3">
          {/* header band */}
          <header className="flex items-center justify-between gap-3 px-1 md:px-4 py-2 sticky top-0 z-30">
            <div className="flex items-center md:hidden">
              <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
                <SheetTrigger
                  render={
                    <button className="p-2 text-[#e8e0c8] bg-board rounded-[3px]">
                      <Menu className="w-5 h-5" />
                    </button>
                  }
                />
                <SheetContent side="left" className="p-0 w-[200px] bg-board border-0">
                  <SpineContent />
                </SheetContent>
              </Sheet>
            </div>

            <div className="flex-1 flex justify-center">
              <TimerIndicator />
            </div>

            <div className="flex items-center gap-2">
              <OnboardingTour />
              <button
                onClick={toggleSound}
                title={soundOn ? "sound on" : "sound off"}
                aria-pressed={soundOn}
                className={cn(
                  "flex items-center gap-1.5 font-mono text-[10px] rounded-[2px] px-2 py-1.5 border cpj-card-shadow transition-colors",
                  soundOn
                    ? "bg-blood text-[#fbe9e7] border-blood-deep"
                    : "bg-paper-sheet text-ink-soft border-paper-edge hover:text-blood"
                )}
              >
                {soundOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>
              <Link href="/admin/problems/new">
                <StampButton className="text-[12px] py-2 px-3">
                  <Plus className="w-[14px] h-[14px] stroke-[2.5px]" />
                  <span className="hidden sm:inline">ADD PROBLEM</span>
                </StampButton>
              </Link>
            </div>
          </header>

          {/* the page sheet */}
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </TimerProvider>
  );
}
