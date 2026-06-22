"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * SoundProvider - faint, OFF-by-default paper SFX (00_FOUNDATIONS §5).
 *
 * Replaces the old heavy WebGL AudioProvider/turntable. Sounds are SYNTHESIZED
 * with the Web Audio API (no asset files to ship): a typewriter key, a stamp
 * thunk, a soft page riffle. Never autoplays; the preference is stored.
 */

type SfxName =
  | "type"
  | "stamp"
  | "page"
  | "file"
  | "konami"
  | "glitch"
  | "click";

interface SoundCtx {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  toggle: () => void;
  sfx: (name: SfxName) => void;
}

const Ctx = createContext<SoundCtx | null>(null);
const STORAGE_KEY = "cpj_sound_on";

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const acRef = useRef<AudioContext | null>(null);

  // hydrate the stored preference (off by default)
  useEffect(() => {
    try {
      setEnabledState(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    try {
      localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const ac = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    if (!acRef.current) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return null;
      acRef.current = new AC();
    }
    return acRef.current;
  }, []);

  const sfx = useCallback(
    (name: SfxName) => {
      if (!enabled) return;
      const ctx = ac();
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const t = ctx.currentTime;

      const noiseBurst = (dur: number, freq: number, vol: number) => {
        const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++)
          data[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(bp).connect(g).connect(ctx.destination);
        src.start(t);
        src.stop(t + dur);
      };

      const tone = (
        freq: number,
        dur: number,
        vol: number,
        type: OscillatorType = "sine"
      ) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(ctx.destination);
        o.start(t);
        o.stop(t + dur);
      };

      switch (name) {
        case "type":
        case "click":
          noiseBurst(0.03, 2600, 0.18);
          break;
        case "stamp":
        case "file":
          tone(120, 0.12, 0.22, "sine");
          noiseBurst(0.06, 700, 0.16);
          break;
        case "page":
          noiseBurst(0.22, 1600, 0.1);
          break;
        case "konami":
          tone(440, 0.1, 0.16, "triangle");
          tone(660, 0.14, 0.14, "triangle");
          break;
        case "glitch":
          noiseBurst(0.12, 1200, 0.14);
          break;
      }
    },
    [enabled, ac]
  );

  const value = useMemo<SoundCtx>(
    () => ({ enabled, setEnabled, toggle: () => setEnabled(!enabled), sfx }),
    [enabled, setEnabled, sfx]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSfx(): SoundCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // safe no-op fallback if used outside the provider
    return {
      enabled: false,
      setEnabled: () => {},
      toggle: () => {},
      sfx: () => {},
    };
  }
  return ctx;
}
