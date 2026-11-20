"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from "react";

import {
  bandForSeconds,
  getCountdownSeconds,
  getCueTargetMs,
  getLaunchAvailability,
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
  isNext: boolean;
  launched: boolean;
  onLaunch: () => void;
  launchDisabledReason?: string;
}

const TICK_MS = 250;
const NON_NEXT_REASON = "En función solo se puede lanzar la siguiente cue de la escaleta.";

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
    gain.gain.value = 0.05;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.12);
    oscillator.onended = () => { void context.close().catch(() => undefined); };
  } catch {
    // Visual confirmation stands on its own; no retries, no error surfaced.
  }
}

export function Countdown({
  cue,
  resolved,
  trackState,
  trackActiveMs,
  showActiveMs,
  isNext,
  launched,
  onLaunch,
  launchDisabledReason,
}: CountdownProps) {
  // The only clock read in this component: an effect, never render or handlers.
  const [now, setNow] = useState<number | null>(null);
  const cachedPreferences = useUiStore(
    (state) => (state as typeof state & PreferencesCache).dancePreferences,
  );
  const executionMode = useUiStore((state) => state.executionMode);
  const lastActivationRef = useRef<number | null>(null);
  const beepedCueRef = useRef<string | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    lastActivationRef.current = null;
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

  const showFigure = now !== null && !launched && reference.available
    && trackState?.status !== "Pausado" && seconds !== undefined;
  const showLaunch = now !== null && !launched && isNext && reference.available && seconds === 0;

  const availability = getLaunchAvailability({
    candidate: cue,
    trackState,
    showRunning: showActiveMs !== undefined,
    mode: executionMode === "rehearsal" ? "rehearsal" : "show",
    now: now ?? 0,
  });
  const explicitReason = launchDisabledReason?.trim() ? launchDisabledReason.trim() : undefined;
  const reason = explicitReason
    ?? (!isNext ? NON_NEXT_REASON : undefined)
    ?? availability.reason;
  const disabled = reason !== undefined;

  useEffect(() => {
    if (!showLaunch || disabled || !preferences.soundFeedback) return;
    if (beepedCueRef.current === cue.id) return;
    beepedCueRef.current = cue.id;
    playLaunchBeep();
  }, [showLaunch, disabled, preferences.soundFeedback, cue.id]);

  if (now === null || launched || targetMs === undefined || !reference.available) return null;
  if (!showFigure && !showLaunch) return null;

  const reasonId = `countdown-launch-reason-${cue.id}`;
  const activationNow = now;

  function handleClick(event: ReactMouseEvent<HTMLButtonElement>) {
    if (disabled || event.detail > 1) return;
    // Same synchronous guard for click, double click and repeated key activation.
    if (lastActivationRef.current !== null
      && activationNow - lastActivationRef.current < 1_000) return;
    lastActivationRef.current = activationNow;
    onLaunch();
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.repeat) event.preventDefault();
  }

  return (
    <section
      aria-label={`Cuenta atrás de ${cue.identifier}`}
      className="flex min-w-0 max-w-full flex-wrap items-center gap-3"
    >
      {showFigure && seconds !== undefined && (
        <output
          aria-live="off"
          aria-label={`${seconds} segundos, banda ${style.label}`}
          data-band={band?.color ?? "neutral"}
          style={{ fontSize: "calc(1.875rem * var(--dance-font-scale, 1))" }}
          className={cn(
            "dance-band-frame inline-flex min-h-11 min-w-0 max-w-full items-center gap-2 rounded-lg border-2 px-3 py-1 font-mono text-3xl font-bold tabular-nums",
            style.frame,
          )}
        >
          <span>{seconds}</span>
          <span className="text-sm font-semibold">{style.label}</span>
        </output>
      )}
      {showLaunch && (
        <>
          <button
            type="button"
            aria-live="assertive"
            aria-describedby={reason ? reasonId : undefined}
            disabled={disabled}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            style={{ fontSize: "calc(1.125rem * var(--dance-font-scale, 1))" }}
            className={cn(
              "dance-launch-flash inline-flex min-h-11 min-w-11 max-w-full items-center justify-center gap-2 rounded-lg border-2 border-red-400 bg-red-950 px-4 py-2 text-lg font-extrabold text-red-50 outline-none focus-visible:ring-4 focus-visible:ring-yellow-300 disabled:cursor-not-allowed disabled:border-slate-600 disabled:bg-slate-800 disabled:text-slate-300",
            )}
          >
            <span aria-hidden="true">▶</span>
            <span>¡Lanzar!</span>
          </button>
          {reason && (
            <p id={reasonId} className="min-w-0 text-xs font-medium text-amber-300">{reason}</p>
          )}
        </>
      )}
    </section>
  );
}

export default Countdown;
