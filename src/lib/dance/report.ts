import type {
  Cue,
  CueLaunchEvent,
  DanceTrack,
  DeviationMaxEntry,
  DeviationReport,
  DeviationReportEntry,
  DeviationReportRow,
  PerformanceRunReport,
  TrackRun,
} from "@/lib/types";
import { formatClock, formatTenths, naturalIdentifierCompare } from "@/lib/dance/schedule";

export interface BuildCueLaunchEventInput {
  cue: Cue;
  launchedAtMs: number;
  elapsedMs: number;
  showActiveMs?: number;
  trackStartAt?: string;
  targetOffsetMs?: number;
  actualOffsetMs?: number;
  now: number;
}

/**
 * Captures the cue at activation time. The deviation is computed once from
 * the active-time offsets; without a reference there is no deviation at all
 * (D35/RF23). Nothing is persisted here.
 */
export function buildCueLaunchEvent(input: BuildCueLaunchEventInput): CueLaunchEvent {
  const {
    cue, launchedAtMs, elapsedMs, showActiveMs,
    trackStartAt, targetOffsetMs, actualOffsetMs, now,
  } = input;
  void now;
  const hasReference = targetOffsetMs !== undefined && actualOffsetMs !== undefined
    && Number.isFinite(targetOffsetMs) && Number.isFinite(actualOffsetMs);

  return {
    id: `${cue.id}:${launchedAtMs}`,
    cueId: cue.id,
    cueIdentifier: cue.identifier,
    cueDescription: cue.description,
    ...(cue.pie !== undefined ? { cuePie: cue.pie } : {}),
    ...(cue.observations !== undefined ? { cueObservations: cue.observations } : {}),
    launchedAt: new Date(launchedAtMs).toISOString(),
    elapsedMs,
    ...(showActiveMs !== undefined ? { showOffsetMs: showActiveMs } : {}),
    ...(cue.timing?.trackId !== undefined ? { trackId: cue.timing.trackId } : {}),
    ...(trackStartAt !== undefined ? { trackStartAt } : {}),
    ...(targetOffsetMs !== undefined ? { targetOffsetMs } : {}),
    ...(actualOffsetMs !== undefined ? { actualOffsetMs } : {}),
    ...(hasReference ? { deviationMs: actualOffsetMs! - targetOffsetMs! } : {}),
  };
}

export interface BuildDeviationReportInput {
  runReport: PerformanceRunReport;
  cues: Cue[];
  tracks: DanceTrack[];
  now: number;
}

function trackTitleFor(trackId: string | undefined, titles: Map<string, string>): string {
  return trackId !== undefined ? titles.get(trackId) ?? "—" : "—";
}

function snapshotEntry(
  event: CueLaunchEvent,
  titles: Map<string, string>,
): DeviationReportEntry {
  return {
    cueId: event.cueId,
    cueIdentifier: event.cueIdentifier,
    trackTitle: trackTitleFor(event.trackId, titles),
    cueDescription: event.cueDescription,
    ...(event.cuePie !== undefined ? { cuePie: event.cuePie } : {}),
    ...(event.cueObservations !== undefined ? { cueObservations: event.cueObservations } : {}),
  };
}

function currentCueEntry(
  cue: Cue,
  titles: Map<string, string>,
  targetOffsetMs?: number,
): DeviationReportEntry {
  return {
    cueId: cue.id,
    cueIdentifier: cue.identifier,
    trackTitle: trackTitleFor(cue.timing?.trackId, titles),
    cueDescription: cue.description,
    ...(cue.pie !== undefined ? { cuePie: cue.pie } : {}),
    ...(cue.observations !== undefined ? { cueObservations: cue.observations } : {}),
    ...(targetOffsetMs !== undefined
      ? { targetOffsetMs, targetText: formatClock(targetOffsetMs) }
      : {}),
  };
}

/**
 * Derives the whole report from the record. Launch rows use only the event
 * snapshots, never the current cue (D35/RF24). A legacy record without
 * `cueLaunches` falls back to the inherited `launchedCueCount`; no division by
 * zero and no empty averages (`—`). No clock is read and nothing is written.
 */
export function buildDeviationReport(input: BuildDeviationReportInput): DeviationReport {
  const { runReport, cues, tracks, now } = input;
  const launches = runReport.cueLaunches ?? [];
  const hasLaunchDetails = runReport.cueLaunches !== undefined;
  const titles = new Map(tracks.map((track) => [track.id, track.title]));
  const runs = new Map<string, TrackRun>((runReport.trackRuns ?? []).map((run) => [run.trackId, run]));
  const manuallyStopped = new Set(
    (runReport.trackRuns ?? []).filter((run) => run.endedBy === "manual").map((run) => run.trackId),
  );
  const launchedIds = new Set<string>();

  const rows: DeviationReportRow[] = [];
  const launchedWithoutTarget: DeviationReportEntry[] = [];
  const launchedWithoutReference: DeviationReportEntry[] = [];

  for (const event of launches) {
    launchedIds.add(event.cueId);
    const base = snapshotEntry(event, titles);
    if (event.targetOffsetMs === undefined) {
      launchedWithoutTarget.push(base);
      continue;
    }
    if (event.deviationMs === undefined) {
      launchedWithoutReference.push({
        ...base,
        targetOffsetMs: event.targetOffsetMs,
        targetText: formatClock(event.targetOffsetMs),
      });
      continue;
    }
    rows.push({
      ...base,
      targetOffsetMs: event.targetOffsetMs,
      targetText: formatClock(event.targetOffsetMs),
      ...(event.actualOffsetMs !== undefined
        ? { actualOffsetMs: event.actualOffsetMs, actualText: formatClock(event.actualOffsetMs) }
        : {}),
      deviationMs: event.deviationMs,
      deviationText: formatTenths(event.deviationMs),
      onTime: Math.abs(event.deviationMs) < 100,
      launchedAt: event.launchedAt,
    });
  }

  const deviations = rows.map((row) => row.deviationMs).filter(Number.isFinite);
  const averageDeviationMs = deviations.length > 0
    ? deviations.reduce((sum, value) => sum + value, 0) / deviations.length
    : undefined;
  let maxDeviation: DeviationMaxEntry | undefined;
  for (const row of rows) {
    // Rows follow launch order, so an absolute tie keeps the earliest cue.
    if (!maxDeviation || Math.abs(row.deviationMs) > Math.abs(maxDeviation.deviationMs)) {
      maxDeviation = {
        cueId: row.cueId,
        cueIdentifier: row.cueIdentifier,
        deviationMs: row.deviationMs,
        deviationText: row.deviationText,
      };
    }
  }

  const notReached: DeviationReportEntry[] = [];
  const pendingWithoutTarget: DeviationReportEntry[] = [];
  if (hasLaunchDetails) {
    const closed = runReport.endedAt !== undefined;
    const showOffsets = launches
      .map((event) => event.showOffsetMs)
      .filter((value): value is number => value !== undefined && Number.isFinite(value));
    const maxShowOffset = showOffsets.length > 0 ? Math.max(...showOffsets) : undefined;
    const orderedCues = [...cues].sort(
      (first, second) => naturalIdentifierCompare(first.identifier, second.identifier)
        || first.id.localeCompare(second.id),
    );

    for (const cue of orderedCues) {
      if (launchedIds.has(cue.id) || cue.status === "Ejecutado") continue;
      const timing = cue.timing;
      const linked = timing?.trackId !== undefined && timing?.trackOffsetMs !== undefined;
      const targetOffsetMs = linked ? timing!.trackOffsetMs! : timing?.atMs;
      if (targetOffsetMs === undefined) {
        if (closed) pendingWithoutTarget.push(currentCueEntry(cue, titles));
        continue;
      }

      const run = linked ? runs.get(timing!.trackId!) : undefined;
      const endedAtDurationTarget = run?.endedBy === "duration"
        && run.actualElapsedMs === targetOffsetMs;
      const objectiveReached = endedAtDurationTarget
        ? false // Still launchable indefinitely (CL59/D23) until launched or finalised.
        : run
          ? run.actualElapsedMs >= targetOffsetMs
          : maxShowOffset !== undefined && maxShowOffset >= targetOffsetMs;
      const stoppedManually = linked && manuallyStopped.has(timing!.trackId!);

      if (closed || stoppedManually || objectiveReached) {
        notReached.push(currentCueEntry(cue, titles, targetOffsetMs));
      }
    }
  }

  return {
    rows,
    summary: {
      launchedCount: hasLaunchDetails ? launches.length : runReport.launchedCueCount,
      withTargetCount: launches.filter((event) => event.targetOffsetMs !== undefined).length,
      ...(averageDeviationMs !== undefined ? { averageDeviationMs } : {}),
      averageText: averageDeviationMs === undefined ? "—" : formatTenths(averageDeviationMs),
      ...(maxDeviation !== undefined ? { maxDeviation } : {}),
      notReachedCount: notReached.length,
    },
    launchedWithoutTarget,
    launchedWithoutReference,
    pendingWithoutTarget,
    notReached,
    generatedAt: new Date(now).toISOString(),
  };
}
