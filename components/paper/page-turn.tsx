import React from "react";
import { cn } from "@/lib/utils";

/**
 * PageTurn - wraps a problem sheet so it swings in on its spine (left) edge with
 * a shadow sweep, like turning a page in the case file (spec §5/§6). Pure CSS
 * 3-D (rotateY/opacity), compositor-only; reduced-motion collapses to an instant
 * show via the global guard. No hooks -> usable in Server or Client Components.
 */
export function PageTurn({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("cpj-page-perspective", className)}>
      <div className="cpj-page-turn">
        {children}
        <span className="cpj-page-sweep" aria-hidden />
      </div>
    </div>
  );
}
