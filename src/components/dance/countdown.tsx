"use client";

import { useEffect, useRef, useState } from "react";

import {
  bandForSeconds,
  getCountdownSeconds,
  getCueTargetMs,
  sliceBands,
} from "@/lib/dance/clock";
import { DEFAULT_DANCE_PREFERENCES } from "@/lib/dance/preferences";
import type {
  CountdownBand,
  Cue,
  DancePreferences,
  ResolvedTiming,
  TrackState,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui-store";

export interface CountdownProps {
  cue: Cue;
  resolved: ResolvedTiming;
  trackState?: TrackState;
  trackActiveMs?: number;
  showActiveMs?: number;
}

const TICK_MS = 250;

/** Static Tailwind classes: the closed five-colour palette plus neutral (D34). */
const BAND_STYLES: Record<CountdownBand["color"] | "neutral", {
  frame: string;
  label: string;
}> = {
  red: { frame: "border-red-600 bg-red-950 text-red-50", label: "Rojo" },
  orange: { frame: "border-orange-600 bg-orange-950 text-orange-50", label: "Naranja" },
  green: { frame: "border-green-600 bg-green-950 text-green-50", label: "Verde" },
  blue: { frame: "border-blue-600 bg-blue-950 text-blue-50", label: "Azul" },
  yellow: { frame: "border-yellow-600 bg-yellow-950 text-yellow-50", label: "Amarillo" },
  neutral: { frame: "border-slate-600 bg-slate-900 text-slate-100", label: "Neutro" },
};

/** T9 caches preferences in the UI store; until then the fixed default applies. */
type PreferencesCache = { dancePreferences?: DancePreferences | null };

interface ReferenceInfo {
  available: boolean;
  /** A track ended by duration with the target at its duration stays at 0 (CL59). */
  forceReached: boolean;
}

function getReferenceInfo(input: {
  resolved: ResolvedTiming;
  targetMs: number;
  trackState?: TrackState;
  showActiveMs?: number;
}): ReferenceInfo {
  const { resolved, targetMs, trackState, showActiveMs } = input;
  if (resolved.status === "absolute") {
    return {
      available: showActiveMs !== undefined && Number.isFinite(showActiveMs),
      forceReached: false,
    };
  }
  if (resolved.status !== "linked" || !trackState || trackState.status === "Pendiente") {
    return { available: false, forceReached: false };
  }
  if (trackState.status === "Terminado") {
    const finalCue = trackState.endedBy === "duration"
      && trackState.durationMs !== undefined
      && trackState.durationMs === targetMs;
    return { available: finalCue, forceReached: finalCue };
  }
  // En marcha is live; Pausado keeps only an already-reached alert (CL11).
  return { available: true, forceReached: false };
}

/** Optional, non-blocking confirmation; a blocked AudioContext is harmless (CL48). */
function playLaunchBeep(): void {
  try {
    const AudioContextCtor = window.AudioContext;
    if (!AudioContextCtor) return;
    const context = new AudioContextCtor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.value = 0.08;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.12);
    oscillator.onended = () => { void context.close().catch(() => undefined); };
  } catch {
    // Visual confirmation stands on its own; no retries, no error surfaced.
  }
}

/**
 * Countdown figure only. It changes colour with the active band and sits next
 * to the existing Go control; launching is handled by that control (not here).
 */
export function Countdown({
  cue,
  resolved,
  trackState,
  trackActiveMs,
  showActiveMs,
}: CountdownProps) {
  // The only clock read in this component: an effect, never render or handlers.
  const [now, setNow] = useState<number | null>(null);
  const cachedPreferences = useUiStore(
    (state) => (state as typeof state & PreferencesCache).dancePreferences,
  );
  const beepedCueRef = useRef<string | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    beepedCueRef.current = null;
  }, [cue.id]);

  const preferences = cachedPreferences ?? DEFAULT_DANCE_PREFERENCES;
  const targetMs = getCueTargetMs({
    cue,
    resolved,
    trackActiveMs,
    showActiveMs,
    now: now ?? 0,
  });
  const reference = targetMs === undefined
    ? { available: false, forceReached: false }
    : getReferenceInfo({ resolved, targetMs, trackState, showActiveMs });

  const alertBeforeMs = cue.timing?.alertBeforeMs ?? preferences.defaultAlertBeforeMs;
  const activeMs = resolved.status === "absolute" ? showActiveMs : trackActiveMs;
  const seconds = targetMs === undefined || !reference.available
    ? undefined
    : getCountdownSeconds(
      targetMs,
      reference.forceReached ? targetMs : activeMs,
      alertBeforeMs,
    );
  const band = seconds === undefined ? null : bandForSeconds(seconds, sliceBands(
    preferences.countdownBands,
    Math.ceil(alertBeforeMs / 1_000),
  ));
  const style = band ? BAND_STYLES[band.color] : BAND_STYLES.neutral;
  const visible = now !== null && reference.available && seconds !== undefined
    && trackState?.status !== "Pausado";

  useEffect(() => {
    if (!visible || seconds !== 0 || !preferences.soundFeedback) return;
    if (beepedCueRef.current === cue.id) return;
    beepedCueRef.current = cue.id;
    playLaunchBeep();
  }, [visible, seconds, preferences.soundFeedback, cue.id]);

  if (!visible || seconds === undefined) return null;

  return (
    <output
      aria-live="off"
      aria-label={`${seconds} segundos, banda ${style.label}`}
      data-band={band?.color ?? "neutral"}
      style={{ fontSize: "calc(1.875rem * var(--dance-font-scale, 1))" }}
      className={cn(
        "dance-band-frame inline-flex min-h-11 min-w-0 max-w-full items-center justify-center rounded-lg border-2 px-3 py-1 font-mono text-3xl font-bold tabular-nums",
        style.frame,
      )}
    >
      {seconds}
    </output>
  );
}

export default Countdown;
