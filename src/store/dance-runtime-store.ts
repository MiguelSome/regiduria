import { create } from "zustand";

import { getActiveElapsedMs } from "@/lib/dance/clock";
import type { ClockSample, DanceTrack, TrackState } from "@/lib/types";

/** In-memory state of a track during the current execution session (D21/D30). */
export type TrackRuntime = {
  status: "Pendiente" | "En marcha" | "Pausado" | "Terminado";
  sample: ClockSample | null;
  startedAtMs?: number;
  endedBy?: "duration" | "manual";
};

export interface DanceRuntimeState {
  productionId: string | null;
  showSample: ClockSample | null;
  trackRuntimes: Record<string, TrackRuntime>;
  notReachedIds: string[];
  hydrate(productionId: string, tracks: DanceTrack[], now: number): void;
  syncTracks(tracks: DanceTrack[], now: number): void;
  startShow(now: number): void;
  pauseShow(now: number): void;
  getShowActiveMs(now: number): number;
  startTrack(trackId: string, now: number): void;   // arranca también el show si no está iniciado (RF39)
  pauseTrack(trackId: string, now: number): void;
  resumeTrack(trackId: string, now: number): void;
  finishTrack(trackId: string, endedBy: "duration" | "manual", now: number): void;
  resetTrack(trackId: string, now: number): void;   // Ensayo: vuelve a Pendiente con tiempo 0
  getTrackActiveMs(trackId: string, now: number): number;
  getTrackState(trackId: string, now: number): TrackState;
  setNotReachedIds(ids: string[]): void;
  resetAll(now: number): void;                      // salir/finalizar/descartar
}

/**
 * Declared durations are part of the schedule, not of the persisted runtime.
 * Kept outside the store so the public contract stays exactly as agreed by
 * T5B/T6/T7; `hydrate`/`syncTracks` refresh it on every schedule change.
 */
const trackDurations = new Map<string, number>();

function rememberDurations(tracks: DanceTrack[]): void {
  trackDurations.clear();
  for (const track of tracks) {
    if (track.durationMs !== undefined && Number.isFinite(track.durationMs) && track.durationMs > 0) {
      trackDurations.set(track.id, track.durationMs);
    }
  }
}

function pendingRuntime(): TrackRuntime {
  return { status: "Pendiente", sample: null };
}

function freshSample(now: number): ClockSample {
  return { startedAt: new Date(now).toISOString(), elapsedBeforeMs: 0 };
}

function pausedSample(sample: ClockSample, now: number): ClockSample {
  return { ...sample, pausedAt: new Date(now).toISOString() };
}

/** Settles the active time into `elapsedBeforeMs` and restarts the segment. */
function resumedSample(sample: ClockSample, now: number): ClockSample {
  return {
    startedAt: new Date(now).toISOString(),
    elapsedBeforeMs: getActiveElapsedMs(sample, now),
  };
}

export const useDanceRuntimeStore = create<DanceRuntimeState>((set, get) => ({
  productionId: null,
  showSample: null,
  trackRuntimes: {},
  notReachedIds: [],

  hydrate: (productionId, tracks, now) => {
    void now;
    rememberDurations(tracks);
    const trackRuntimes: Record<string, TrackRuntime> = {};
    for (const track of tracks) trackRuntimes[track.id] = pendingRuntime();
    set({ productionId, showSample: null, trackRuntimes, notReachedIds: [] });
  },

  syncTracks: (tracks, now) => {
    void now;
    rememberDurations(tracks);
    set((state) => {
      const trackRuntimes: Record<string, TrackRuntime> = {};
      for (const track of tracks) {
        trackRuntimes[track.id] = state.trackRuntimes[track.id] ?? pendingRuntime();
      }
      return { trackRuntimes };
    });
  },

  startShow: (now) => set((state) => {
    if (!state.showSample) return { showSample: freshSample(now) };
    // There is no separate `resumeShow`: a paused clock resumes here (RF39).
    if (!state.showSample.pausedAt) return {};
    return { showSample: resumedSample(state.showSample, now) };
  }),

  pauseShow: (now) => set((state) => {
    if (!state.showSample || state.showSample.pausedAt) return {};
    return { showSample: pausedSample(state.showSample, now) };
  }),

  getShowActiveMs: (now) => {
    const sample = get().showSample;
    return sample ? getActiveElapsedMs(sample, now) : 0;
  },

  startTrack: (trackId, now) => {
    const state = get();
    const trackRuntimes = { ...state.trackRuntimes };
    // Defensive only: the UI confirms and closes the previous track manually.
    for (const [id, runtime] of Object.entries(trackRuntimes)) {
      if (id !== trackId && runtime.status === "En marcha" && runtime.sample) {
        trackRuntimes[id] = {
          ...runtime,
          status: "Pausado",
          sample: pausedSample(runtime.sample, now),
        };
      }
    }
    trackRuntimes[trackId] = {
      status: "En marcha",
      sample: freshSample(now),
      startedAtMs: now,
    };
    // Never restart or resume a show clock that is already running or paused.
    set({
      trackRuntimes,
      showSample: state.showSample ?? freshSample(now),
    });
  },

  pauseTrack: (trackId, now) => set((state) => {
    const runtime = state.trackRuntimes[trackId];
    if (!runtime || runtime.status !== "En marcha" || !runtime.sample) return {};
    return {
      trackRuntimes: {
        ...state.trackRuntimes,
        [trackId]: { ...runtime, status: "Pausado", sample: pausedSample(runtime.sample, now) },
      },
    };
  }),

  resumeTrack: (trackId, now) => set((state) => {
    const runtime = state.trackRuntimes[trackId];
    if (!runtime || runtime.status !== "Pausado" || !runtime.sample) return {};
    return {
      trackRuntimes: {
        ...state.trackRuntimes,
        [trackId]: { ...runtime, status: "En marcha", sample: resumedSample(runtime.sample, now) },
      },
    };
  }),

  finishTrack: (trackId, endedBy, now) => set((state) => {
    const runtime = state.trackRuntimes[trackId];
    if (!runtime) return {};
    const activeMs = runtime.sample ? getActiveElapsedMs(runtime.sample, now) : 0;
    const durationMs = trackDurations.get(trackId);
    // A natural end is exactly the declared duration, never a negative remainder.
    const finalMs = endedBy === "duration" && durationMs !== undefined ? durationMs : activeMs;
    return {
      trackRuntimes: {
        ...state.trackRuntimes,
        [trackId]: {
          status: "Terminado",
          sample: { startedAt: new Date(now).toISOString(), elapsedBeforeMs: finalMs },
          ...(runtime.startedAtMs !== undefined ? { startedAtMs: runtime.startedAtMs } : {}),
          endedBy,
        },
      },
    };
  }),

  resetTrack: (trackId, now) => {
    void now;
    set((state) => ({
      trackRuntimes: { ...state.trackRuntimes, [trackId]: pendingRuntime() },
    }));
  },

  getTrackActiveMs: (trackId, now) => {
    const runtime = get().trackRuntimes[trackId];
    return runtime?.sample ? getActiveElapsedMs(runtime.sample, now) : 0;
  },

  getTrackState: (trackId, now) => {
    const runtime = get().trackRuntimes[trackId];
    if (!runtime) return { status: "Pendiente" };
    const durationMs = trackDurations.get(trackId);
    return {
      status: runtime.status,
      ...(runtime.endedBy ? { endedBy: runtime.endedBy } : {}),
      activeMs: get().getTrackActiveMs(trackId, now),
      ...(durationMs !== undefined ? { durationMs } : {}),
    };
  },

  setNotReachedIds: (ids) => set({ notReachedIds: [...ids] }),

  resetAll: (now) => {
    void now;
    set({ productionId: null, showSample: null, trackRuntimes: {}, notReachedIds: [] });
  },
}));
