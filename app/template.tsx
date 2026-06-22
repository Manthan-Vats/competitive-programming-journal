import React from "react";
import { TransitionShell } from "@/components/transition-shell";

/**
 * App Router template - re-mounts on every navigation, so the jigsaw
 * "falling into place" enter animation replays per route change.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <TransitionShell>{children}</TransitionShell>;
}
