// Pure domain logic for the performance run record.
// No React, no Dexie and no internal clock: the current instant always enters as `now`.
import type { Performance, PerformanceRunReport, Production } from "@/lib/types";

function formatLocalDate(timestamp: number): string {
  const date = new Date(timestamp);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function toIsoString(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

function emptyRunReport(now: number): PerformanceRunReport {
  return {
    startedAt: toIsoString(now),
    durationMs: 0,
    launchedCueCount: 0,
    breaks: [],
    quickIncidents: [],
  };
}

/**
 * Opens the performance record (RF17). It does not set `timerStartedAt`:
 * the timer start is recorded separately when the timer is started.
 */
export function buildPerformanceRecord(params: {
  production: Production;
  totalCues: number;
  now: number;
}): Performance {
  const { production, totalCues, now } = params;

  return {
    id: crypto.randomUUID(),
    productionId: production.id,
    title: production.title,
    date: formatLocalDate(now),
    time: new Date(now).toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    prepared: 0,
    total: totalCues,
    notes: [],
    runReport: {
      startedAt: toIsoString(now),
      durationMs: 0,
      launchedCueCount: 0,
      breaks: [],
      quickIncidents: [],
    },
  };
}

/**
 * Records a cue launch and, when it is the last pending cue, finishes the run
 * (RF4, RF5, RF6). `durationMs` is the elapsed time given by the caller, so a
 * run finished without a started timer stays at `0` (D6).
 */
export function applyCueLaunch(params: {
  performance: Performance;
  launchedCueCount: number;
  elapsedMs: number;
  isFinished: boolean;
  now: number;
}): Performance {
  const { performance, launchedCueCount, elapsedMs, isFinished, now } = params;
  // A launch must never be lost, so a record without a report is opened here.
  const runReport = performance.runReport ?? emptyRunReport(now);

  return {
    ...performance,
    runReport: {
      ...runReport,
      durationMs: elapsedMs,
      launchedCueCount,
      ...(isFinished ? { endedAt: toIsoString(now) } : {}),
    },
  };
}

/**
 * Records the first timer start in the report; it never overwrites `startedAt`
 * and it does not touch an already recorded timer start (RF9, D8).
 */
export function startTimerInReport(params: {
  performance: Performance;
  now: number;
}): Performance {
  const { performance, now } = params;
  if (!performance.runReport || performance.runReport.timerStartedAt) {
    return performance;
  }

  return {
    ...performance,
    runReport: { ...performance.runReport, timerStartedAt: toIsoString(now) },
  };
}

/**
 * Closes an open record by fixing `endedAt` and the accumulated duration
 * (RF11, D10). It is idempotent: a record that is already closed is returned
 * unchanged, so double closes (for example under StrictMode) are harmless.
 */
export function closeOpenRecord(params: {
  performance: Performance;
  elapsedMs: number;
  now: number;
}): Performance {
  const { performance, elapsedMs, now } = params;
  if (!performance.runReport || performance.runReport.endedAt) {
    return performance;
  }

  return {
    ...performance,
    runReport: {
      ...performance.runReport,
      endedAt: toIsoString(now),
      durationMs: elapsedMs,
    },
  };
}

/** Is there an open record (with a report and without `endedAt`)? (RF11). */
export function isOpenRecord(performance: Performance | null | undefined): boolean {
  return Boolean(performance?.runReport && !performance.runReport.endedAt);
}

/**
 * Can the next cue be launched? Requires loaded and non-empty cues and a run
 * that is neither finished nor currently saving a launch (RF1, RF4, RF14).
 */
export function canLaunchNextCue(params: {
  cueCount: number | null;
  launchedCueCount: number;
  isTimerFinished: boolean;
  isLaunching: boolean;
}): boolean {
  const { cueCount, launchedCueCount, isTimerFinished, isLaunching } = params;

  if (isLaunching || isTimerFinished) return false;
  if (cueCount === null || cueCount <= 0) return false;

  return launchedCueCount < cueCount;
}
