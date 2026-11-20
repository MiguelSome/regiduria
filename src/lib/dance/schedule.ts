import type {
  Cue,
  CueTiming,
  DanceTrack,
  ResolvedTiming,
  Schedule,
  ScheduleWarning,
  ScheduledTrack,
} from "@/lib/types";

export interface BuildScheduleInput {
  tracks: DanceTrack[];
  cues: Cue[];
  now: number;
}

interface DurationParts {
  prefix: string;
  components: number[];
  hasNumber: boolean;
}

function compareText(first: string, second: string): number {
  const upperFirst = first.toUpperCase();
  const upperSecond = second.toUpperCase();
  if (upperFirst !== upperSecond) return upperFirst < upperSecond ? -1 : 1;
  if (first === second) return 0;
  return first < second ? -1 : 1;
}

/**
 * Splits a cue identifier into its text prefix and its trailing numeric
 * components. Components stay separate so 2.5 sorts before 2.10 (5 < 10),
 * which is the natural order used by the schedule (spec 002 §1.7, RF7).
 */
function splitIdentifier(identifier: string): DurationParts {
  const match = /^([\s\S]*?)(\d+(?:\.\d+)*)$/.exec(identifier);
  if (!match) return { prefix: identifier, components: [], hasNumber: false };
  return {
    prefix: match[1],
    components: match[2].split(".").map((part) => Number(part)),
    hasNumber: true,
  };
}

function compareDefinedStarts(first: number | undefined, second: number | undefined): number {
  if (first !== undefined && second !== undefined) return first - second;
  if (first !== undefined) return -1;
  if (second !== undefined) return 1;
  return 0;
}

function compareTracksForSchedule(first: DanceTrack, second: DanceTrack): number {
  return first.order - second.order
    || compareDefinedStarts(first.startAtMs, second.startAtMs)
    || compareText(first.id, second.id);
}

function findDuplicateWarnings(tracks: DanceTrack[], cues: Cue[]): ScheduleWarning[] {
  const warnings: ScheduleWarning[] = [];

  const tracksByOrder = new Map<number, string[]>();
  for (const track of tracks) {
    const ids = tracksByOrder.get(track.order) ?? [];
    ids.push(track.id);
    tracksByOrder.set(track.order, ids);
  }
  for (const order of [...tracksByOrder.keys()].sort((first, second) => first - second)) {
    const trackIds = tracksByOrder.get(order) ?? [];
    if (trackIds.length > 1) {
      warnings.push({
        code: "duplicate-track-order",
        message: `Varios tracks comparten el orden ${order}.`,
        trackIds,
        order,
      });
    }
  }

  const titles = new Map<string, { title: string; trackIds: string[] }>();
  for (const track of tracks) {
    const key = track.title.trim().toLowerCase();
    const group = titles.get(key) ?? { title: track.title, trackIds: [] };
    group.trackIds.push(track.id);
    titles.set(key, group);
  }
  for (const key of [...titles.keys()].sort(compareText)) {
    const group = titles.get(key);
    if (!group || group.trackIds.length < 2) continue;
    warnings.push({
      code: "duplicate-track-title",
      message: `Varios tracks comparten el título «${group.title}».`,
      trackIds: group.trackIds,
    });
  }

  const identifiers = new Map<string, { identifier: string; cueIds: string[] }>();
  for (const cue of cues) {
    const key = cue.identifier.trim().toLowerCase();
    const group = identifiers.get(key) ?? { identifier: cue.identifier, cueIds: [] };
    group.cueIds.push(cue.id);
    identifiers.set(key, group);
  }
  for (const key of [...identifiers.keys()].sort(compareText)) {
    const group = identifiers.get(key);
    if (!group || group.cueIds.length < 2) continue;
    warnings.push({
      code: "duplicate-cue-identifier",
      message: `Varios cues comparten el identificador «${group.identifier}».`,
      cueIds: group.cueIds,
    });
  }

  return warnings;
}

/** mm:ss | h:mm:ss, with seconds in 0..59. Invalid input has no duration. */
export function parseDurationToMs(text: string): number | null {
  const trimmed = text.trim();
  const shortMatch = /^(\d{1,2}):([0-5]\d)$/.exec(trimmed);
  if (shortMatch) {
    return Number(shortMatch[1]) * 60_000 + Number(shortMatch[2]) * 1_000;
  }

  const longMatch = /^(\d+):([0-5]\d):([0-5]\d)$/.exec(trimmed);
  if (!longMatch) return null;
  return Number(longMatch[1]) * 3_600_000
    + Number(longMatch[2]) * 60_000
    + Number(longMatch[3]) * 1_000;
}

/** Rounds to the nearest second (half up) and switches to h:mm:ss at one hour. */
export function formatClock(ms: number): string {
  const safeMs = Number.isFinite(ms) ? Math.max(0, ms) : 0;
  const totalSeconds = Math.round(safeMs / 1_000);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  const minutes = Math.floor(totalSeconds / 60) % 60;
  if (totalSeconds < 3_600) {
    return `${String(minutes).padStart(2, "0")}:${seconds}`;
  }
  const hours = Math.floor(totalSeconds / 3_600);
  return `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`;
}

/** One decimal with a comma and an explicit sign; |ms| < 100 is "a tiempo". */
export function formatTenths(ms: number): string {
  if (!Number.isFinite(ms) || Math.abs(ms) < 100) return "a tiempo";
  // Symmetric half-up rounding: -850 ms and +850 ms both move away from zero.
  const tenths = ms < 0 ? -Math.round(-ms / 100) : Math.round(ms / 100);
  const sign = tenths > 0 ? "+" : "−";
  return `${sign}${(Math.abs(tenths) / 10).toFixed(1).replace(".", ",")} s`;
}

/** Natural order: text prefix, numeric components, then the full text. */
export function naturalIdentifierCompare(a: string, b: string): number {
  const first = splitIdentifier(a);
  const second = splitIdentifier(b);
  const prefixComparison = compareText(first.prefix, second.prefix);
  if (prefixComparison !== 0) return prefixComparison;

  if (first.hasNumber && second.hasNumber) {
    const sharedLength = Math.min(first.components.length, second.components.length);
    for (let index = 0; index < sharedLength; index += 1) {
      if (first.components[index] !== second.components[index]) {
        return first.components[index] < second.components[index] ? -1 : 1;
      }
    }
    if (first.components.length !== second.components.length) {
      return first.components.length < second.components.length ? -1 : 1;
    }
  } else if (first.hasNumber !== second.hasNumber) {
    return first.hasNumber ? -1 : 1;
  }

  return compareText(a, b);
}

function resolveTimingWithStarts(cue: Cue, startById: Map<string, number>): ResolvedTiming {
  const timing = cue.timing;
  if (!timing) return { status: "untimed" };

  const { trackId, trackOffsetMs, atMs } = timing;
  // CL64: a trackId without an offset is not a link at all.
  if (trackId !== undefined && trackOffsetMs !== undefined) {
    const trackStartAtMs = startById.get(trackId);
    if (trackStartAtMs === undefined) return { status: "orphan" };
    return {
      status: "linked",
      atMs: trackStartAtMs + trackOffsetMs,
      trackId,
      trackStartAtMs,
      trackOffsetMs,
    };
  }

  if (atMs !== undefined) return { status: "absolute", atMs };
  return { status: "untimed" };
}

function compareCuesForSchedule(
  timings: Map<string, ResolvedTiming>,
): (first: Cue, second: Cue) => number {
  return (first, second) => {
    const firstAtMs = timings.get(first.id)?.atMs;
    const secondAtMs = timings.get(second.id)?.atMs;
    if (firstAtMs !== undefined && secondAtMs !== undefined && firstAtMs !== secondAtMs) {
      return firstAtMs - secondAtMs;
    }
    return naturalIdentifierCompare(first.identifier, second.identifier)
      || compareText(first.id, second.id);
  };
}

/** Derives the whole schedule. No clock, storage or React access. */
export function buildSchedule({ tracks, cues, now }: BuildScheduleInput): Schedule {
  const warnings: ScheduleWarning[] = [];
  const orderedTracks = [...tracks].sort(compareTracksForSchedule);
  const scheduledTracks: ScheduledTrack[] = [];
  const startById = new Map<string, number>();
  let knownEnd = 0;

  for (const track of orderedTracks) {
    const startAtMs = track.startAtMs ?? knownEnd;
    const durationMs = track.durationMs;
    const endAtMs = durationMs !== undefined && Number.isFinite(durationMs) && durationMs > 0
      ? startAtMs + durationMs
      : undefined;
    startById.set(track.id, startAtMs);

    if (startAtMs < knownEnd) {
      warnings.push({
        code: "track-overlap",
        message: `Solapa con el track anterior: «${track.title}».`,
        trackIds: [track.id],
      });
    }
    if (endAtMs === undefined) {
      warnings.push({
        code: "missing-track-duration",
        message: `Sin duración: «${track.title}».`,
        trackIds: [track.id],
      });
    } else {
      knownEnd = Math.max(knownEnd, endAtMs);
    }
    scheduledTracks.push({
      track,
      startAtMs,
      ...(endAtMs !== undefined ? { endAtMs } : {}),
    });
  }

  warnings.push(...findDuplicateWarnings(orderedTracks, cues));

  const timings = new Map<string, ResolvedTiming>();
  for (const cue of cues) {
    const resolved = resolveTimingWithStarts(cue, startById);
    timings.set(cue.id, resolved);
    if (resolved.status === "orphan") {
      warnings.push({
        code: "track-not-found",
        message: `Track no encontrado: «${cue.identifier}» apunta a un track que no existe.`,
        cueIds: [cue.id],
        ...(cue.timing?.trackId !== undefined ? { trackIds: [cue.timing.trackId] } : {}),
      });
    }
  }

  const compareCues = compareCuesForSchedule(timings);
  const timedCues = cues.filter((cue) => timings.get(cue.id)?.atMs !== undefined).sort(compareCues);
  const untimedCues = cues.filter((cue) => timings.get(cue.id)?.atMs === undefined).sort(compareCues);

  let totalMs = 0;
  for (const scheduledTrack of scheduledTracks) {
    if (scheduledTrack.endAtMs !== undefined) {
      totalMs = Math.max(totalMs, scheduledTrack.endAtMs);
    }
  }
  for (const cue of timedCues) {
    totalMs = Math.max(totalMs, timings.get(cue.id)?.atMs ?? 0);
  }

  return {
    tracks: scheduledTracks,
    timedCues,
    untimedCues,
    totals: {
      trackCount: tracks.length,
      cueCount: cues.length,
      totalMs,
      calculatedAt: new Date(now).toISOString(),
    },
    warnings,
  };
}

/** Resolves a cue against an already built schedule. Reports, never writes. */
export function resolveCueTiming(cue: Cue, schedule: Schedule): ResolvedTiming {
  const startById = new Map(
    schedule.tracks.map(({ track, startAtMs }) => [track.id, startAtMs]),
  );
  return resolveTimingWithStarts(cue, startById);
}

/**
 * Materializes the last computed absolute time when a track is unlinked or
 * deleted. `now` is part of the pure-function signature (plan §4) but this
 * result carries no ISO trace, so the instant is not consumed.
 */
export function materializeAtMs(cue: Cue, schedule: Schedule, now: number): Cue {
  void now;
  const timing: CueTiming | undefined = cue.timing;
  if (!timing) return cue;

  const resolved = resolveCueTiming(cue, schedule);
  const nextTiming: CueTiming = {
    ...(timing.alertBeforeMs !== undefined ? { alertBeforeMs: timing.alertBeforeMs } : {}),
    ...(resolved.atMs !== undefined ? { atMs: resolved.atMs } : {}),
  };
  return {
    ...cue,
    timing: Object.keys(nextTiming).length > 0 ? nextTiming : undefined,
  };
}
