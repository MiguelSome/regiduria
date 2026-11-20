import type {
  ClockSample,
  CountdownBand,
  Cue,
  LaunchAvailability,
  ResolvedTiming,
  TrackState,
} from "@/lib/types";

/** Fixed reasons from spec 002 §1.7/RF22. Exported so UI tasks reuse the exact text. */
export const LAUNCH_REASON_RESUME_TRACK = "Reanuda el track para lanzar esta cue.";
export const LAUNCH_REASON_NOT_NEXT =
  "En función solo se puede lanzar la siguiente cue de la escaleta.";
export const LAUNCH_REASON_ADD_DURATION = "Añade una duración para lanzar este track.";
export const LAUNCH_REASON_NO_EDIT_IN_SHOW = "En función la escaleta no se edita. Cambia a Ensayo.";
/** Complement for an `atMs` cue whose show clock has not been started (CL19/CL57). */
export const LAUNCH_REASON_START_SHOW_CLOCK = "Inicia el espectáculo para lanzar esta cue.";

/**
 * Active (pause-free) elapsed time. One shared base for tracks, the show clock
 * and deviations: pausing never shifts a target (D32). Invalid instants are
 * treated as absent instead of producing a negative or NaN figure.
 */
export function getActiveElapsedMs(sample: ClockSample, now: number): number {
  const startedAtMs = Date.parse(sample.startedAt);
  const elapsedBeforeMs = Number.isFinite(sample.elapsedBeforeMs)
    ? Math.max(0, sample.elapsedBeforeMs)
    : 0;
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(now)) return elapsedBeforeMs;

  const sinceStart = Math.max(0, now - startedAtMs);
  const pausedTotalMs = Number.isFinite(sample.pausedTotalMs)
    ? Math.max(0, sample.pausedTotalMs!)
    : 0;
  let pausedSince = 0;
  if (sample.pausedAt) {
    const pausedAtMs = Date.parse(sample.pausedAt);
    if (Number.isFinite(pausedAtMs)) pausedSince = Math.max(0, now - pausedAtMs);
  }

  const activeMs = sinceStart + elapsedBeforeMs - pausedTotalMs - pausedSince;
  return Number.isFinite(activeMs) ? Math.max(0, activeMs) : 0;
}

export interface GetCueTargetInput {
  cue: Cue;
  resolved: ResolvedTiming;
  trackActiveMs?: number;
  showActiveMs?: number;
  now: number;
}

/**
 * Target expressed in active time. A linked cue uses its offset inside the
 * track; an absolute cue uses `atMs` only when the show clock is running.
 * No clock, no storage: the instant is injected and no target is invented.
 */
export function getCueTargetMs(input: GetCueTargetInput): number | undefined {
  const { cue, resolved, showActiveMs, now } = input;
  void cue; // `resolved` is authoritative; the cue is part of the stable signature.
  void now;
  void input.trackActiveMs; // Reference availability is decided by the countdown/launch rules.

  if (resolved.status === "linked") {
    return Number.isFinite(resolved.trackOffsetMs) ? resolved.trackOffsetMs : undefined;
  }
  if (resolved.status === "absolute" && showActiveMs !== undefined && Number.isFinite(showActiveMs)) {
    return Number.isFinite(resolved.atMs) ? resolved.atMs : undefined;
  }
  return undefined;
}

/**
 * Whole seconds left until the target, rounded up so the last displayed
 * figure is `1` before `0`. `0` once reached (never negative), `undefined`
 * when a reference is missing or the target is beyond the alert threshold.
 */
export function getCountdownSeconds(
  targetMs: number | undefined,
  activeMs: number | undefined,
  alertBeforeMs: number | undefined,
): number | undefined {
  if (targetMs === undefined || activeMs === undefined || alertBeforeMs === undefined) return undefined;
  if (![targetMs, activeMs, alertBeforeMs].every(Number.isFinite)) return undefined;
  if (alertBeforeMs <= 0) return undefined;

  const remainingMs = targetMs - activeMs;
  if (remainingMs <= 0) return 0;
  if (remainingMs > alertBeforeMs) return undefined;
  return Math.ceil(remainingMs / 1_000);
}

/** Clips every band to `[0, thresholdSeconds]`, drops empty ones and sorts from 0 up. */
export function sliceBands(
  bands: CountdownBand[],
  thresholdSeconds: number,
): CountdownBand[] {
  const threshold = Number.isFinite(thresholdSeconds) ? Math.max(0, thresholdSeconds) : 0;
  return bands
    .map((band) => ({
      ...band,
      minSeconds: Math.max(0, band.minSeconds),
      maxSeconds: Math.min(threshold, band.maxSeconds),
    }))
    .filter((band) => band.maxSeconds >= band.minSeconds && band.maxSeconds > 0)
    .sort((first, second) => first.minSeconds - second.minSeconds);
}

/** Already-sliced bands only; `null` means neutral colour (CL49). */
export function bandForSeconds(
  seconds: number,
  bands: CountdownBand[],
): CountdownBand | null {
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  for (const band of bands) {
    if (seconds >= band.minSeconds && seconds <= band.maxSeconds) return band;
  }
  return null;
}

export interface GetLaunchAvailabilityInput {
  candidate: Cue;
  trackState?: TrackState;
  showRunning: boolean;
  mode: "rehearsal" | "show";
  now: number;
}

/**
 * Whether a cue may be launched. Rehearsal is free and records nothing (D7).
 * In a show, D23/CL18 require a live reference: running track, or a track that
 * ended by duration with the target exactly at the duration. A manually ended
 * or paused track, or an `atMs` cue without a show clock, is not launchable.
 */
export function getLaunchAvailability(input: GetLaunchAvailabilityInput): LaunchAvailability {
  const { candidate, trackState, showRunning, mode, now } = input;
  void now;
  if (mode === "rehearsal") return { launchable: true };

  const timing = candidate.timing;
  const linked = timing !== undefined
    && timing.trackId !== undefined
    && timing.trackOffsetMs !== undefined
    && trackState !== undefined;

  if (linked) {
    const state = trackState!;
    if (state.status === "Pausado") {
      return { launchable: false, reason: LAUNCH_REASON_RESUME_TRACK };
    }
    if (state.durationMs === undefined) {
      return { launchable: false, reason: LAUNCH_REASON_ADD_DURATION };
    }
    if (state.status === "Pendiente") {
      return { launchable: false, reason: LAUNCH_REASON_RESUME_TRACK };
    }
    if (state.status === "Terminado") {
      if (state.endedBy === "manual") {
        // Its pending cues are already "no alcanzados" (CL18/D22/D31).
        return { launchable: false, reason: LAUNCH_REASON_RESUME_TRACK };
      }
      // Ended by duration: only the cue whose target is the duration stays live.
      if (timing!.trackOffsetMs === state.durationMs) return { launchable: true };
      return { launchable: false, reason: LAUNCH_REASON_RESUME_TRACK };
    }
    return { launchable: true };
  }

  if (timing?.atMs !== undefined) {
    return showRunning
      ? { launchable: true }
      : { launchable: false, reason: LAUNCH_REASON_START_SHOW_CLOCK };
  }

  // "Sin tiempo": no temporal reference to satisfy, but still a pending cue.
  return { launchable: true };
}
