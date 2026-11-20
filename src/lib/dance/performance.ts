// Dance extensions of the performance record. Convives with `performance-run.ts`
// (spec 001) without changing it: no React, no Dexie and no internal clock.
// Every instant enters as `now`; ISO strings are built from that injection (plan §4).
import type {
  CueLaunchEvent,
  Performance,
  PerformanceRunReport,
  TrackRun,
} from "@/lib/types";

function iso(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

function localDate(timestamp: number): string {
  const date = new Date(timestamp);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function localTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Same shape as the 001 record plus the empty dance collections (D30, D35). */
function emptyDanceRunReport(now: number): PerformanceRunReport {
  return {
    startedAt: iso(now),
    durationMs: 0,
    launchedCueCount: 0,
    breaks: [],
    quickIncidents: [],
    mode: "show",
    cueLaunches: [],
    trackRuns: [],
  };
}

function newRecordId(productionId: string, now: number): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `dance-${productionId}-${now}`;
}

export interface OpenDanceRecordInput {
  productionId: string;
  totalCues: number;
  now: number;
}

/**
 * Opens a dance performance record. The caller can replace `title` with the
 * production title; only `productionId` is part of this pure contract.
 */
export function openDanceRecord(input: OpenDanceRecordInput): Performance {
  const { productionId, totalCues, now } = input;
  return {
    id: newRecordId(productionId, now),
    productionId,
    title: productionId,
    date: localDate(now),
    time: localTime(now),
    prepared: 0,
    total: totalCues,
    notes: [],
    runReport: emptyDanceRunReport(now),
  };
}

export interface AppendLaunchInput {
  performance: Performance;
  event: CueLaunchEvent;
  isFinished: boolean;
  elapsedMs: number;
  now: number;
}

/**
 * Appends one launch snapshot and keeps the inherited counter in sync. A
 * repeated `event.id` is a no-op, so retries cannot duplicate a mark (RF18).
 */
export function appendLaunch(input: AppendLaunchInput): Performance {
  const { performance, event, isFinished, elapsedMs, now } = input;
  const runReport = performance.runReport ?? emptyDanceRunReport(now);
  const existing = runReport.cueLaunches ?? [];
  if (existing.some((launch) => launch.id === event.id)) return performance;

  const cueLaunches = [...existing, event];
  return {
    ...performance,
    runReport: {
      ...runReport,
      mode: runReport.mode ?? "show",
      cueLaunches,
      launchedCueCount: cueLaunches.length,
      durationMs: elapsedMs,
      ...(isFinished ? { endedAt: iso(now) } : {}),
    },
  };
}

export interface CloseTrackRunInput {
  trackId: string;
  title: string;
  startedAtMs: number;
  activeMs: number;
  endedBy: "duration" | "manual";
  now: number;
}

/** A `TrackRun` is only ever built closed (D30/D31). */
export function closeTrackRun(input: CloseTrackRunInput): TrackRun {
  const { trackId, title, startedAtMs, activeMs, endedBy, now } = input;
  return {
    trackId,
    title,
    startedAt: iso(startedAtMs),
    endedAt: iso(now),
    actualElapsedMs: Number.isFinite(activeMs) ? activeMs : 0,
    endedBy,
  };
}

export interface FinishPerformanceInput {
  performance: Performance;
  trackRuns: TrackRun[];
  elapsedMs: number;
  now: number;
}

/**
 * Closes the record and merges closed `TrackRun`s by track id. Already closed
 * records are returned untouched, so double closes are harmless.
 */
export function finishPerformance(input: FinishPerformanceInput): Performance {
  const { performance, trackRuns, elapsedMs, now } = input;
  const runReport = performance.runReport;
  if (runReport?.endedAt) return performance;

  const base = runReport ?? emptyDanceRunReport(now);
  const mergedRuns = new Map((base.trackRuns ?? []).map((run) => [run.trackId, run]));
  for (const run of trackRuns) mergedRuns.set(run.trackId, run);

  return {
    ...performance,
    runReport: {
      ...base,
      mode: base.mode ?? "show",
      durationMs: elapsedMs,
      endedAt: iso(now),
      trackRuns: [...mergedRuns.values()],
    },
  };
}

/** Only the open record created by this in-memory session qualifies (D33). */
export function isSessionOpenRecord(
  performance: Performance | null | undefined,
  sessionId: string,
): boolean {
  return Boolean(performance?.runReport && !performance.runReport.endedAt
    && performance.id === sessionId);
}
