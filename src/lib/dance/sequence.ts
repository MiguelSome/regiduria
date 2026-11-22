import type { Cue, Schedule } from "@/lib/types";
import { resolveCueTiming } from "@/lib/dance/schedule";

export interface GetNextCandidateInput {
  cues: Cue[];
  schedule: Schedule;
  launchedIds: string[];
  notReachedIds: string[];
  now: number;
}

/**
 * First pending cue in the schedule order: absolute time first (already
 * ordered by `buildSchedule`, including the natural identifier and id
 * tie-breaks), then "Sin tiempo". Launched and not-reached cues are skipped.
 */
export function getNextCandidate(input: GetNextCandidateInput): Cue | undefined {
  const { cues, schedule, launchedIds, notReachedIds, now } = input;
  void now;
  const available = new Set(cues.map((cue) => cue.id));
  const excluded = new Set([...launchedIds, ...notReachedIds]);

  for (const cue of [...schedule.timedCues, ...schedule.untimedCues]) {
    if (available.has(cue.id) && !excluded.has(cue.id)) return cue;
  }
  return undefined;
}

export interface PropagateManualStopInput {
  trackId: string;
  cues: Cue[];
  schedule: Schedule;
  mode: "rehearsal" | "show";
  now: number;
  /** Optional session state; when absent, cue status decides what is pending. */
  launchedIds?: string[];
  notReachedIds?: string[];
}

export interface PropagateManualStopResult {
  notReachedIds: string[];
  nextCandidate?: Cue;
}

/**
 * Closing a track by hand marks its pending linked cues as "no alcanzado"
 * only in a show (D22/D31). In rehearsal nothing is marked, so the cues stay
 * pending and can be relaunched after restarting the track.
 */
export function propagateManualStop(input: PropagateManualStopInput): PropagateManualStopResult {
  const { trackId, cues, schedule, mode, now, launchedIds = [], notReachedIds = [] } = input;
  const excluded = new Set([...launchedIds, ...notReachedIds]);
  const isPending = (cue: Cue): boolean => !excluded.has(cue.id) && cue.status !== "Ejecutado";
  const notReached: string[] = [];

  if (mode === "show") {
    for (const cue of cues) {
      if (!isPending(cue)) continue;
      const resolved = resolveCueTiming(cue, schedule);
      if (resolved.status === "linked" && resolved.trackId === trackId) {
        notReached.push(cue.id);
      }
    }
  }

  return {
    notReachedIds: notReached,
    nextCandidate: getNextCandidate({
      cues,
      schedule,
      launchedIds,
      notReachedIds: [...notReachedIds, ...notReached],
      now,
    }),
  };
}
