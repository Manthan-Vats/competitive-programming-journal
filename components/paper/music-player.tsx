"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, Disc3, X, GripVertical } from "lucide-react";
import { TRACKS } from "@/lib/tracks";

/**
 * MusicPlayer - the journal's TRACKLIST, a compact floating record player.
 *
 * - OFF by default; audio only starts on a user click (no autoplay-block trip).
 * - Missing files are handled gracefully: a track that 404s is marked unavailable and the
 *   player stays quiet instead of erroring (so it works before you've added every mp3).
 * - Collapses to a small needle chip; the open state + last track index are remembered.
 * - DRAGGABLE: grab the grip handle and drop it anywhere; the position is remembered and
 *   re-clamped into view on resize. Defaults to the bottom-RIGHT so it never sits over the
 *   sidebar EXIT button (bottom-left).
 * - Dark "board" styling so it reads on both the dark desk (public) and paper (admin).
 */
const LS_OPEN = "cpj_music_open";
const LS_INDEX = "cpj_music_index";
const LS_POS = "cpj_music_pos";
const MARGIN = 16; // px gap from the viewport edge

type Pos = { x: number; y: number };

export function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const [mounted, setMounted] = useState(false);

  // drag bookkeeping (refs so listeners stay stable)
  const drag = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);

  // clamp a position so the whole box stays on screen
  const clamp = useCallback((p: Pos): Pos => {
    if (typeof window === "undefined") return p;
    const el = boxRef.current;
    const w = el?.offsetWidth ?? 220;
    const h = el?.offsetHeight ?? 56;
    return {
      x: Math.min(Math.max(MARGIN, p.x), Math.max(MARGIN, window.innerWidth - w - MARGIN)),
      y: Math.min(Math.max(MARGIN, p.y), Math.max(MARGIN, window.innerHeight - h - MARGIN)),
    };
  }, []);

  // default = bottom-right corner
  const defaultPos = useCallback((): Pos => {
    if (typeof window === "undefined") return { x: 0, y: 0 };
    const el = boxRef.current;
    const w = el?.offsetWidth ?? 220;
    const h = el?.offsetHeight ?? 56;
    return { x: window.innerWidth - w - MARGIN, y: window.innerHeight - h - MARGIN };
  }, []);

  // restore preferences (never auto-plays - autoplay is blocked until a user gesture anyway)
  useEffect(() => {
    setMounted(true);
    try {
      setOpen(localStorage.getItem(LS_OPEN) === "1");
      const i = parseInt(localStorage.getItem(LS_INDEX) || "0", 10);
      if (!Number.isNaN(i) && i >= 0 && i < TRACKS.length) setIndex(i);
      const raw = localStorage.getItem(LS_POS);
      if (raw) {
        const p = JSON.parse(raw) as Pos;
        if (typeof p?.x === "number" && typeof p?.y === "number") setPos(p);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // once we have real dimensions, place at default if no stored position; clamp on resize
  useEffect(() => {
    if (!mounted) return;
    setPos((p) => clamp(p ?? defaultPos()));
    const onResize = () => setPos((p) => (p ? clamp(p) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [mounted, open, clamp, defaultPos]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_OPEN, open ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [open]);

  const track = TRACKS[index];

  const playIndex = useCallback((i: number) => {
    const next = ((i % TRACKS.length) + TRACKS.length) % TRACKS.length;
    setIndex(next);
    setUnavailable(false);
    try {
      localStorage.setItem(LS_INDEX, String(next));
    } catch {
      /* ignore */
    }
    // let the new src bind, then play
    requestAnimationFrame(() => {
      const a = audioRef.current;
      if (!a) return;
      a.load();
      a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    });
  }, []);

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      setUnavailable(false);
      a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  }, [playing]);

  // ---- drag handlers (pointer events; works for mouse + touch) ----
  const onDragMove = useCallback(
    (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      d.moved = true;
      setPos(clamp({ x: e.clientX - d.dx, y: e.clientY - d.dy }));
    },
    [clamp],
  );

  const onDragEnd = useCallback(() => {
    window.removeEventListener("pointermove", onDragMove);
    window.removeEventListener("pointerup", onDragEnd);
    drag.current = null;
    setPos((p) => {
      if (p) {
        try {
          localStorage.setItem(LS_POS, JSON.stringify(p));
        } catch {
          /* ignore */
        }
      }
      return p;
    });
  }, [onDragMove]);

  const onDragStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const el = boxRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      drag.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top, moved: false };
      window.addEventListener("pointermove", onDragMove);
      window.addEventListener("pointerup", onDragEnd);
    },
    [onDragMove, onDragEnd],
  );

  if (!TRACKS.length) return null;

  // position: fixed via inline left/top once measured; render off-screen-safe until mounted
  const style: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y }
    : { right: MARGIN, bottom: MARGIN };

  const handle = (
    <button
      onPointerDown={onDragStart}
      aria-label="drag player"
      title="drag to move"
      className="cursor-grab active:cursor-grabbing touch-none p-0.5 text-[#6f6855] hover:text-[#b3ab92] transition-colors"
    >
      <GripVertical className="w-3.5 h-3.5" />
    </button>
  );

  return (
    <div
      ref={boxRef}
      style={style}
      className={`fixed z-40 select-none print:hidden ${mounted ? "" : "opacity-0"}`}
    >
      <audio
        ref={audioRef}
        src={track.src}
        onEnded={() => playIndex(index + 1)}
        onError={() => {
          setPlaying(false);
          setUnavailable(true);
        }}
        preload="none"
      />

      {open ? (
        <div className="flex items-center gap-2 rounded-[4px] border border-white/10 bg-[#1c1813]/95 backdrop-blur px-2 py-2 shadow-[0_6px_24px_rgba(0,0,0,0.4)]">
          {handle}
          <Disc3
            className={`w-4 h-4 text-[#d98f8f] shrink-0 ${playing ? "animate-spin [animation-duration:3.5s]" : ""}`}
          />
          <div className="min-w-[120px] max-w-[180px] leading-tight">
            <div className="font-mono text-[11px] text-[#efe7cf] truncate">
              {unavailable ? "track not loaded" : track.title}
            </div>
            <div className="font-mono text-[9px] tracking-[0.08em] text-[#857d65] truncate">
              {unavailable ? "drop the .mp3 in public/audio" : track.album}
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => playIndex(index - 1)}
              aria-label="previous track"
              className="p-1 text-[#b3ab92] hover:text-[#efe7cf] transition-colors"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={togglePlay}
              aria-label={playing ? "pause" : "play"}
              className="p-1 text-blood hover:text-[#d98f8f] transition-colors"
            >
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              onClick={() => playIndex(index + 1)}
              aria-label="next track"
              className="p-1 text-[#b3ab92] hover:text-[#efe7cf] transition-colors"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            onClick={() => {
              audioRef.current?.pause();
              setPlaying(false);
              setOpen(false);
            }}
            aria-label="close player"
            className="p-1 text-[#857d65] hover:text-[#d98f8f] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-[#1c1813]/90 backdrop-blur pl-1.5 pr-3 py-2 shadow-[0_4px_18px_rgba(0,0,0,0.35)] hover:border-blood/50 transition-colors">
          {handle}
          <button
            onClick={() => setOpen(true)}
            aria-label="open the tracklist"
            title="TRACKLIST"
            className="flex items-center gap-1.5"
          >
            <Disc3 className={`w-4 h-4 text-[#d98f8f] ${playing ? "animate-spin [animation-duration:3.5s]" : ""}`} />
            <span className="font-mono text-[10px] tracking-[0.16em] text-[#cdc3a3] uppercase">
              tracklist
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

export default MusicPlayer;
