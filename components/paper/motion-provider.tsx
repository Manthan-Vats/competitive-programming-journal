"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Flip } from "gsap/Flip";

/**
 * MotionProvider - one shared Lenis smooth-scroll loop synced to GSAP
 * ScrollTrigger + Flip (00_FOUNDATIONS §5). Honours prefers-reduced-motion:
 * when set, Lenis is NOT initialised (native scroll) and reveals collapse to a
 * plain opacity fade (CSS path in globals.css).
 *
 * It also wires the two GLOBAL, opt-in motions from the spec so any screen can
 * use them declaratively (no per-screen GSAP code):
 *
 *   • reveal-develop - mark a section `data-reveal`; it enters like a developing
 *     photograph as it scrolls into view. Add `data-reveal-stagger` to stagger
 *     the element's direct children instead of the element itself.
 *   • number-type - mark a figure `data-count="34"`; it clatters up from 0 with
 *     irregular per-digit timing when it first enters view. Optional
 *     `data-count-suffix` is appended verbatim (e.g. "½", "h").
 *
 * Re-runs on route change so client-navigated pages get their reveals wired.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    gsap.registerPlugin(ScrollTrigger, Flip);

    let lenis: Lenis | null = null;
    let onTick: ((t: number) => void) | null = null;
    const triggers: ScrollTrigger[] = [];

    if (!reduce) {
      lenis = new Lenis({ lerp: 0.08, syncTouch: true });
      lenis.on("scroll", ScrollTrigger.update);
      onTick = (time: number) => lenis!.raf(time * 1000);
      gsap.ticker.add(onTick);
      gsap.ticker.lagSmoothing(0);
    }

    //  3-D card tilt (delegated, rAF-batched, pointer only)
    // One document listener tilts whichever [data-tilt] element the cursor is
    // over. Writes only CSS vars so it composes with seeded rotation; skipped
    // entirely under reduced-motion or touch.
    let tiltEl: HTMLElement | null = null;
    let lastX = 0;
    let lastY = 0;
    let tiltRaf = 0;
    const resetTilt = (el: HTMLElement) => {
      el.style.setProperty("--tx", "0deg");
      el.style.setProperty("--ty", "0deg");
    };
    const applyTilt = () => {
      tiltRaf = 0;
      if (!tiltEl) return;
      const r = tiltEl.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const px = (lastX - r.left) / r.width - 0.5;
      const py = (lastY - r.top) / r.height - 0.5;
      const MAX = 6;
      tiltEl.style.setProperty("--ty", (px * MAX).toFixed(2) + "deg");
      tiltEl.style.setProperty("--tx", (-py * MAX).toFixed(2) + "deg");
    };
    const onTiltMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const el = (e.target as HTMLElement | null)?.closest?.(
        "[data-tilt]"
      ) as HTMLElement | null;
      if (el !== tiltEl) {
        if (tiltEl) resetTilt(tiltEl);
        tiltEl = el;
      }
      if (!el) return;
      lastX = e.clientX;
      lastY = e.clientY;
      if (!tiltRaf) tiltRaf = requestAnimationFrame(applyTilt);
    };
    if (!reduce) {
      document.addEventListener("pointermove", onTiltMove, { passive: true });
    }

    let cleanupCtx: gsap.Context | undefined;

    // Wait a frame so freshly-navigated DOM is in place before measuring.
    const raf = requestAnimationFrame(() => {
      const ctx = gsap.context(() => {
        //  reveal-develop
        const reveals = gsap.utils.toArray<HTMLElement>("[data-reveal]");
        reveals.forEach((el) => {
          const staggerChildren = el.hasAttribute("data-reveal-stagger");
          const targets = staggerChildren
            ? (Array.from(el.children) as HTMLElement[])
            : [el];
          if (targets.length === 0) return;

          if (reduce) {
            gsap.fromTo(
              targets,
              { autoAlpha: 0 },
              {
                autoAlpha: 1,
                duration: 0.2,
                stagger: 0,
                scrollTrigger: { trigger: el, start: "top 92%", once: true },
              }
            );
            return;
          }

          const st = gsap.fromTo(
            targets,
            { autoAlpha: 0, y: 14, filter: "blur(6px)" },
            {
              autoAlpha: 1,
              y: 0,
              filter: "blur(0px)",
              duration: 0.62,
              ease: "power3.out",
              stagger: staggerChildren ? 0.08 : 0,
              scrollTrigger: { trigger: el, start: "top 88%", once: true },
            }
          );
          if (st.scrollTrigger) triggers.push(st.scrollTrigger);
        });

        //  number-type
        const counters = gsap.utils.toArray<HTMLElement>("[data-count]");
        counters.forEach((el) => {
          const target = parseFloat(el.getAttribute("data-count") || "0");
          if (!isFinite(target)) return;
          const suffix = el.getAttribute("data-count-suffix") || "";
          const decimals = (el.getAttribute("data-count") || "").includes(".") ? 1 : 0;
          const obj = { v: 0 };

          if (reduce) {
            el.textContent = target.toFixed(decimals) + suffix;
            return;
          }

          el.textContent = "0" + suffix;
          const tw = gsap.to(obj, {
            v: target,
            duration: 0.9,
            ease: "power2.out",
            onUpdate: () => {
              el.textContent = obj.v.toFixed(decimals) + suffix;
            },
            onComplete: () => {
              el.textContent = target.toFixed(decimals) + suffix;
            },
            scrollTrigger: { trigger: el, start: "top 92%", once: true },
          });
          if (tw.scrollTrigger) triggers.push(tw.scrollTrigger);
        });
      });

      ScrollTrigger.refresh();
      // store ctx for cleanup
      cleanupCtx = ctx;
    });

    return () => {
      cancelAnimationFrame(raf);
      if (tiltRaf) cancelAnimationFrame(tiltRaf);
      document.removeEventListener("pointermove", onTiltMove);
      if (tiltEl) resetTilt(tiltEl);
      triggers.forEach((t) => t.kill());
      cleanupCtx?.revert();
      if (onTick) gsap.ticker.remove(onTick);
      lenis?.destroy();
    };
  }, [pathname]);

  return <>{children}</>;
}
