"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

import { deleteDanceTrack, saveDanceTrack } from "@/lib/data-service";
import {
  LAUNCH_REASON_ADD_DURATION,
  LAUNCH_REASON_NO_EDIT_IN_SHOW,
} from "@/lib/dance/clock";
import { propagateManualStop } from "@/lib/dance/sequence";
import { buildSchedule, formatClock, parseDurationToMs, resolveCueTiming } from "@/lib/dance/schedule";
import type { Cue, DanceTrack, Schedule, TrackStateStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useDanceRuntimeStore, type TrackRuntime } from "@/store/dance-runtime-store";

export interface TrackPanelProps {
  productionId: string;
  tracks: DanceTrack[];
  cues: Cue[];
  mode: "rehearsal" | "show";
  variant?: "operation" | "management";
  notReachedIds: string[];
  onTracksChanged: () => void;
  onTrackClosed?: (input: {
    trackId: string; title: string; activeMs: number;
    startedAtMs: number;
    endedBy: "duration" | "manual"; now: number;
  }) => void;
  onNotReached?: (ids: string[]) => void;
  /** T10/A2: milestones travel to the single polite region in the parent. */
  onAnnounce?: (message: string) => void;
}

const MAX_START_MS = 24 * 3_600_000;
const EDIT_LOCK_ID = "track-panel-show-edit-reason";
const FIRST_TRACK_REASON_ID = "track-panel-first-reason";
const LAST_TRACK_REASON_ID = "track-panel-last-reason";
const SHOW_START_REASON = "En función solo se puede iniciar el primer track Pendiente.";
const DURATION_ERROR = "Duración no válida. Usa mm:ss o h:mm:ss, con segundos entre 00 y 59 y mayor que cero.";
const START_ERROR = "Inicio no válido. Usa un entero de milisegundos o mm:ss / h:mm:ss entre 00:00 y 24:00:00.";

// T10/A2: the scale variable is set by app-shell; this panel only consumes it.
const scaledTitleStyle = { fontSize: "calc(0.875rem * var(--dance-font-scale, 1))" } as const;
const scaledBaseStyle = { fontSize: "calc(1rem * var(--dance-font-scale, 1))" } as const;
const scaledSmallStyle = { fontSize: "calc(0.75rem * var(--dance-font-scale, 1))" } as const;
const scaledTinyStyle = { fontSize: "calc(0.6875rem * var(--dance-font-scale, 1))" } as const;

const buttonClass = "min-h-11 min-w-11 rounded-lg border px-3 py-2 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-cyan-400";
const primaryButtonClass = cn(buttonClass, "border-cyan-600 bg-cyan-950/40 text-cyan-100 hover:bg-cyan-900/40");
const secondaryButtonClass = cn(buttonClass, "border-slate-600 bg-slate-900/60 text-slate-200 hover:bg-slate-800");
const dangerButtonClass = cn(buttonClass, "border-amber-600 bg-amber-950/30 text-amber-100 hover:bg-amber-900/30");
const disabledButtonClass = "cursor-not-allowed border-slate-700 bg-slate-900/40 text-slate-400 opacity-70";

interface TrackDraft {
  id?: string;
  title: string;
  duration: string;
  start: string;
  order: number;
  notes: string;
}

interface ParsedInput {
  value?: number;
  error?: string;
}

function mergeUnique(base: string[], added: string[]): string[] {
  return [...new Set([...base, ...added])];
}

/** Clock read only from UI effects/handlers; kept outside render for React purity. */
function currentInstant(): number {
  return Date.now();
}

function draftFromTrack(track: DanceTrack): TrackDraft {
  return {
    id: track.id,
    title: track.title,
    duration: track.durationMs !== undefined ? formatClock(track.durationMs) : "",
    start: track.startAtMs !== undefined ? formatClock(track.startAtMs) : "",
    order: track.order,
    notes: track.notes,
  };
}

function parseDurationInput(text: string): ParsedInput {
  const trimmed = text.trim();
  if (!trimmed) return {}; // valid draft: "Sin duración"
  const value = parseDurationToMs(trimmed);
  if (value === null || value <= 0) return { error: DURATION_ERROR };
  return { value };
}

function parseStartInput(text: string): ParsedInput {
  const trimmed = text.trim();
  if (!trimmed) return {}; // empty means derived start
  if (/^\d+$/.test(trimmed)) {
    const value = Number(trimmed);
    if (!Number.isSafeInteger(value) || value > MAX_START_MS) return { error: START_ERROR };
    return { value };
  }
  const value = parseDurationToMs(trimmed);
  if (value === null || value > MAX_START_MS) return { error: START_ERROR };
  return { value };
}

function statusText(runtime: TrackRuntime | undefined): string {
  if (!runtime) return "Pendiente";
  if (runtime.status !== "Terminado") return runtime.status;
  return runtime.endedBy === "duration" ? "Terminado · duración" : "Terminado · manual";
}

function statusClass(runtime: TrackRuntime | undefined): string {
  if (!runtime || runtime.status === "Pendiente") return "border-slate-600 text-slate-300";
  if (runtime.status === "En marcha") return "border-cyan-500 text-cyan-200";
  if (runtime.status === "Pausado") return "border-amber-500 text-amber-200";
  return "border-slate-500 text-slate-400";
}

function createTrackId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `track-${currentInstant()}-${Math.random().toString(36).slice(2)}`;
}

export function TrackPanel({
  productionId,
  tracks,
  cues,
  mode,
  variant = "operation",
  notReachedIds,
  onTracksChanged,
  onTrackClosed,
  onNotReached,
  onAnnounce,
}: TrackPanelProps) {
  const schedule = useMemo(() => buildSchedule({ tracks, cues, now: 0 }), [tracks, cues]);
  const trackRuntimes = useDanceRuntimeStore((state) => state.trackRuntimes);
  const runtimeNotReachedIds = useDanceRuntimeStore((state) => state.notReachedIds);
  const [now, setNow] = useState<number | null>(null);
  const [draft, setDraft] = useState<TrackDraft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const tracksRef = useRef(tracks);
  const cuesRef = useRef(cues);
  const scheduleRef = useRef<Schedule>(schedule);
  const modeRef = useRef(mode);
  const onTrackClosedRef = useRef(onTrackClosed);
  const onNotReachedRef = useRef(onNotReached);

  useEffect(() => {
    tracksRef.current = tracks;
    cuesRef.current = cues;
    scheduleRef.current = schedule;
    modeRef.current = mode;
    onTrackClosedRef.current = onTrackClosed;
    onNotReachedRef.current = onNotReached;
  }, [tracks, cues, schedule, mode, onTrackClosed, onNotReached]);

  const allNotReached = useMemo(
    () => mergeUnique(notReachedIds, runtimeNotReachedIds),
    [notReachedIds, runtimeNotReachedIds],
  );

  const linkedByTrack = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const cue of cues) {
      const resolved = resolveCueTiming(cue, schedule);
      if (resolved.status !== "linked" || !resolved.trackId) continue;
      const ids = map.get(resolved.trackId) ?? [];
      ids.push(cue.id);
      map.set(resolved.trackId, ids);
    }
    return map;
  }, [cues, schedule]);

  const warningsByTrack = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const warning of schedule.warnings) {
      if (warning.code === "missing-track-duration") continue;
      for (const trackId of warning.trackIds ?? []) {
        const messages = map.get(trackId) ?? [];
        messages.push(warning.message);
        map.set(trackId, messages);
      }
    }
    return map;
  }, [schedule]);

  const pendingByTrack = useMemo(() => {
    const map = new Map<string, number>();
    const excluded = new Set([...allNotReached, ...cues.filter((cue) => cue.status === "Ejecutado").map((cue) => cue.id)]);
    for (const [trackId, cueIds] of linkedByTrack) {
      map.set(trackId, cueIds.filter((cueId) => !excluded.has(cueId)).length);
    }
    return map;
  }, [allNotReached, linkedByTrack, cues]);

  const firstPendingId = schedule.tracks.find(
    ({ track }) => (trackRuntimes[track.id]?.status ?? "Pendiente") === "Pendiente",
  )?.track.id;

  useEffect(() => {
    if (variant === "management") return;
    useDanceRuntimeStore.getState().hydrate(productionId, tracksRef.current, currentInstant());
  }, [productionId, variant]);

  useEffect(() => {
    if (variant === "management") return;
    useDanceRuntimeStore.getState().syncTracks(tracks, currentInstant());
  }, [tracks, variant]);

  useEffect(() => {
    if (variant === "management") return;
    const tick = () => {
      const instant = currentInstant();
      setNow(instant);
      const state = useDanceRuntimeStore.getState();
      for (const [trackId, runtime] of Object.entries(state.trackRuntimes)) {
        if (runtime.status !== "En marcha") continue;
        const scheduled = scheduleRef.current.tracks.find(({ track }) => track.id === trackId);
        const durationMs = scheduled?.track.durationMs;
        if (durationMs === undefined || !Number.isFinite(durationMs) || durationMs <= 0) continue;
        if (state.getTrackActiveMs(trackId, instant) < durationMs) continue;
        state.finishTrack(trackId, "duration", instant);
        onTrackClosedRef.current?.({
          trackId,
          title: scheduled?.track.title ?? trackId,
          activeMs: durationMs,
          startedAtMs: runtime.startedAtMs ?? instant - durationMs,
          endedBy: "duration",
          now: instant,
        });
      }
    };
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [variant]);

  const currentNow = now ?? 0;

  const closeManually = (track: DanceTrack, instant: number): void => {
    const state = useDanceRuntimeStore.getState();
    const activeMs = state.getTrackActiveMs(track.id, instant);
    state.finishTrack(track.id, "manual", instant);
    onTrackClosedRef.current?.({
      trackId: track.id,
      title: track.title,
      activeMs,
      startedAtMs: state.trackRuntimes[track.id]?.startedAtMs ?? instant - activeMs,
      endedBy: "manual",
      now: instant,
    });

    if (modeRef.current !== "show") return;
    const previousNotReached = mergeUnique(state.notReachedIds, notReachedIds);
    const launchedIds = cuesRef.current
      .filter((cue) => cue.status === "Ejecutado")
      .map((cue) => cue.id);
    const result = propagateManualStop({
      trackId: track.id,
      cues: cuesRef.current,
      schedule: scheduleRef.current,
      mode: "show",
      now: instant,
      launchedIds,
      notReachedIds: previousNotReached,
    });
    const combined = mergeUnique(previousNotReached, result.notReachedIds);
    state.setNotReachedIds(combined);
    onNotReachedRef.current?.(combined);
  };

  /** Returns false when the user declines to close the previously active track. */
  const stopOtherActiveTracks = (exceptId: string, instant: number): boolean => {
    const state = useDanceRuntimeStore.getState();
    const others = Object.entries(state.trackRuntimes)
      .filter(([trackId, runtime]) => trackId !== exceptId
        && (runtime.status === "En marcha" || runtime.status === "Pausado"))
      .map(([trackId]) => tracksRef.current.find((track) => track.id === trackId))
      .filter((track): track is DanceTrack => Boolean(track));
    if (others.length === 0) return true;

    const pendingDetails = others.map((track) => `${track.title}: ${pendingByTrack.get(track.id) ?? 0}`);
    const consequence = modeRef.current === "show"
      ? "sus cues pendientes pasarán a «no alcanzado»"
      : "sus cues pendientes quedarán pendientes";
    if (!window.confirm(
      `Hay otro track en marcha o pausado (${pendingDetails.join(", ")}). Al continuar se detendrá y ${consequence}. ¿Continuar?`,
    )) {
      return false;
    }
    for (const track of others) closeManually(track, instant);
    return true;
  };

  const handleStart = (track: DanceTrack): void => {
    const instant = currentInstant();
    if (!stopOtherActiveTracks(track.id, instant)) return;
    useDanceRuntimeStore.getState().startTrack(track.id, instant);
    setNow(instant);
    onAnnounce?.(`Track ${track.title} iniciado`);
  };

  const handlePause = (track: DanceTrack): void => {
    const instant = currentInstant();
    useDanceRuntimeStore.getState().pauseTrack(track.id, instant);
    setNow(instant);
    onAnnounce?.(`Track ${track.title} pausado`);
  };

  const handleResume = (track: DanceTrack): void => {
    const instant = currentInstant();
    if (!stopOtherActiveTracks(track.id, instant)) return;
    useDanceRuntimeStore.getState().resumeTrack(track.id, instant);
    setNow(instant);
    onAnnounce?.(`Track ${track.title} reanudado`);
  };

  const handleStop = (track: DanceTrack): void => {
    const pending = pendingByTrack.get(track.id) ?? 0;
    if (pending > 0 && !window.confirm(
      `Quedan ${pending} ${pending === 1 ? "cue pendiente" : "cues pendientes"} vinculados a «${track.title}». ¿Detener el track?`,
    )) {
      return;
    }
    const instant = currentInstant();
    closeManually(track, instant);
    setNow(instant);
  };

  const handleReset = (track: DanceTrack): void => {
    const instant = currentInstant();
    useDanceRuntimeStore.getState().resetTrack(track.id, instant);
    setNow(instant);
    onAnnounce?.(`Track ${track.title} reiniciado`);
  };

  function openNewDraft(): void {
    const maxOrder = tracks.reduce((maximum, track) => Math.max(maximum, track.order), -1);
    setDraft({ title: "", duration: "", start: "", order: maxOrder + 1, notes: "" });
    setFormError(null);
    setActionError(null);
  }

  function openEditDraft(track: DanceTrack): void {
    setDraft(draftFromTrack(track));
    setFormError(null);
    setActionError(null);
  }

  async function handleSaveDraft(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!draft || isSaving) return;

    const title = draft.title.trim();
    if (!title) {
      setFormError("Escribe un título para el track.");
      return;
    }
    const duration = parseDurationInput(draft.duration);
    if (duration.error) {
      setFormError(duration.error);
      return;
    }
    const start = parseStartInput(draft.start);
    if (start.error) {
      setFormError(start.error);
      return;
    }
    const order = Math.trunc(Number(draft.order));
    if (!Number.isFinite(order) || order < 0) {
      setFormError("El orden debe ser un entero mayor o igual que 0.");
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      const track: DanceTrack = {
        id: draft.id ?? createTrackId(),
        productionId,
        title,
        order,
        notes: draft.notes.trim(),
        ...(duration.value !== undefined ? { durationMs: duration.value } : {}),
        ...(start.value !== undefined ? { startAtMs: start.value } : {}),
      };
      await saveDanceTrack(track);
      setDraft(null);
      onTracksChanged();
    } catch {
      setFormError("No se pudo guardar el track. Inténtalo de nuevo.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(track: DanceTrack): Promise<void> {
    const linkedCount = linkedByTrack.get(track.id)?.length ?? 0;
    const detail = linkedCount > 0
      ? ` ${linkedCount} ${linkedCount === 1 ? "cue quedará desvinculado" : "cues quedarán desvinculados"} y conservarán su último tiempo calculado.`
      : "";
    if (!window.confirm(`¿Eliminar el track «${track.title}»?${detail}`)) return;
    try {
      await deleteDanceTrack(track.id);
      setActionError(null);
      onTracksChanged();
    } catch {
      setActionError("No se pudo eliminar el track. Inténtalo de nuevo.");
    }
  }

  async function handleMove(track: DanceTrack, direction: -1 | 1): Promise<void> {
    const index = schedule.tracks.findIndex(({ track: item }) => item.id === track.id);
    const neighbor = schedule.tracks[index + direction]?.track;
    if (!neighbor) return;
    const updates: DanceTrack[] = track.order === neighbor.order
      ? [{ ...track, order: neighbor.order + direction }]
      : [{ ...track, order: neighbor.order }, { ...neighbor, order: track.order }];
    try {
      for (const updated of updates) await saveDanceTrack(updated);
      setActionError(null);
      onTracksChanged();
    } catch {
      setActionError("No se pudo reordenar el track. Inténtalo de nuevo.");
    }
  }

  const isShow = mode === "show";

  return (
    <section aria-labelledby="track-panel-title" className="w-full space-y-3 text-slate-100">
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 id="track-panel-title" style={scaledBaseStyle} className="break-words font-semibold">
            Tracks
          </h2>
          <p style={scaledSmallStyle} className="break-words text-slate-400">
            {variant === "operation"
              ? "Tiempo activo: las pausas no desplazan los objetivos."
              : "Define el orden, la duración y el inicio de cada track."}
          </p>
        </div>
        <button
          type="button"
          onClick={openNewDraft}
          disabled={isShow}
          aria-describedby={isShow ? EDIT_LOCK_ID : undefined}
          style={scaledSmallStyle}
          className={cn(primaryButtonClass, isShow && disabledButtonClass)}
        >
          Nuevo track
        </button>
      </header>

      {isShow && (
        <p id={EDIT_LOCK_ID} style={scaledSmallStyle} className="min-w-0 break-words rounded-lg border-l-2 border-amber-400 bg-slate-900/60 px-3 py-2 text-amber-200">
          {LAUNCH_REASON_NO_EDIT_IN_SHOW}
        </p>
      )}

      {draft && (
        <form
          onSubmit={(event) => void handleSaveDraft(event)}
          className="space-y-3 rounded-xl border border-cyan-800 bg-slate-900/80 p-3"
        >
          <h3 style={scaledTitleStyle} className="min-w-0 break-words font-semibold text-cyan-100">
            {draft.id ? "Editar track" : "Nuevo track"}
          </h3>
          <div className="grid min-w-0 gap-2 sm:grid-cols-2">
            <label style={scaledSmallStyle} className="flex min-w-0 flex-col gap-1 text-slate-300">
              Título
              <input
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                style={scaledTitleStyle}
                className="min-h-11 w-full min-w-0 rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-2 text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              />
            </label>
            <label style={scaledSmallStyle} className="flex min-w-0 flex-col gap-1 text-slate-300">
              Orden
              <input
                type="number"
                min={0}
                value={draft.order}
                onChange={(event) => setDraft({ ...draft, order: Number(event.target.value) })}
                style={scaledTitleStyle}
                className="min-h-11 w-full min-w-0 rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-2 text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              />
            </label>
            <label style={scaledSmallStyle} className="flex min-w-0 flex-col gap-1 text-slate-300">
              Duración (mm:ss o h:mm:ss)
              <input
                value={draft.duration}
                onChange={(event) => setDraft({ ...draft, duration: event.target.value })}
                aria-describedby="track-duration-hint"
                placeholder="2:00"
                style={scaledTitleStyle}
                className="min-h-11 w-full min-w-0 rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-2 font-mono text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              />
            </label>
            <label style={scaledSmallStyle} className="flex min-w-0 flex-col gap-1 text-slate-300">
              Inicio (opcional)
              <input
                value={draft.start}
                onChange={(event) => setDraft({ ...draft, start: event.target.value })}
                aria-describedby="track-start-hint"
                placeholder="00:00"
                style={scaledTitleStyle}
                className="min-h-11 w-full min-w-0 rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-2 font-mono text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              />
            </label>
          </div>
          <p id="track-duration-hint" style={scaledTinyStyle} className="min-w-0 break-words text-slate-400">
            Vacío guarda el track como «Sin duración» y no se puede iniciar. Se admiten 1:30 y 1:02:30.
          </p>
          <p id="track-start-hint" style={scaledTinyStyle} className="min-w-0 break-words text-slate-400">
            Vacío = inicio derivado. Si se fija, entero de milisegundos o tiempo hasta 24:00:00; el solape se avisa, no se corrige.
          </p>
          <label style={scaledSmallStyle} className="flex min-w-0 flex-col gap-1 text-slate-300">
            Notas
            <textarea
              value={draft.notes}
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
              rows={2}
              style={scaledTitleStyle}
              className="w-full min-w-0 rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-2 text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            />
          </label>
          {formError && <p role="alert" style={scaledSmallStyle} className="min-w-0 break-words text-amber-300">{formError}</p>}
          <div className="flex min-w-0 flex-wrap gap-2">
            <button
              type="submit"
              disabled={isSaving}
              aria-describedby={isSaving ? "track-saving-reason" : undefined}
              style={scaledSmallStyle}
              className={cn(primaryButtonClass, isSaving && disabledButtonClass)}
            >
              {isSaving ? "Guardando…" : "Guardar track"}
            </button>
            {isSaving && (
              <p id="track-saving-reason" style={scaledTinyStyle} className="min-w-0 break-words text-amber-300">
                Guardando el track.
              </p>
            )}
            <button
              type="button"
              onClick={() => { setDraft(null); setFormError(null); }}
              style={scaledSmallStyle}
              className={secondaryButtonClass}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {actionError && <p role="alert" style={scaledSmallStyle} className="min-w-0 break-words text-amber-300">{actionError}</p>}

      {schedule.tracks.length === 0 ? (
        <p style={scaledTitleStyle} className="min-w-0 break-words rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-slate-300">
          Este proyecto aún no tiene tracks. Añade el primero para construir la escaleta.
        </p>
      ) : (
        <ul className="min-w-0 space-y-3">
          {schedule.tracks.map(({ track, startAtMs, endAtMs }, index) => {
            const runtime = trackRuntimes[track.id];
            const status: TrackStateStatus = runtime?.status ?? "Pendiente";
            const canStart = track.durationMs !== undefined && track.durationMs > 0;
            const isFirstPending = firstPendingId === track.id;
            const startDisabledReason = !canStart
              ? LAUNCH_REASON_ADD_DURATION
              : isShow && !isFirstPending ? SHOW_START_REASON : undefined;
            const startReasonId = `track-start-reason-${track.id}`;
            const activeMs = runtime?.sample
              ? useDanceRuntimeStore.getState().getTrackActiveMs(track.id, currentNow)
              : 0;
            const shownActiveMs = status === "Terminado" && runtime?.endedBy === "duration"
              ? track.durationMs ?? activeMs
              : activeMs;
            const remainingMs = track.durationMs !== undefined
              ? Math.max(0, track.durationMs - shownActiveMs)
              : undefined;
            const isActive = status === "En marcha" || status === "Pausado";

            return (
              <li key={track.id} className="min-w-0 rounded-xl border border-slate-700 bg-slate-900/70 p-3">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 style={scaledTitleStyle} className="min-w-0 break-words font-semibold">{track.title}</h3>
                    <p style={scaledTinyStyle} className="min-w-0 break-words text-slate-400">
                      Orden {index + 1} · Inicio {formatClock(startAtMs)} · Fin{" "}
                      {endAtMs !== undefined ? formatClock(endAtMs) : "Sin duración"}
                    </p>
                  </div>
                  {variant === "operation" && (
                    <span style={scaledTinyStyle} className={cn("max-w-full whitespace-nowrap rounded-full border px-2 py-1", statusClass(runtime))}>
                      {statusText(runtime)}
                    </span>
                  )}
                </div>

                {variant === "operation" ? (
                  <dl className="mt-3 grid min-w-0 grid-cols-2 gap-2 text-xs sm:grid-cols-4" aria-live="off">
                    <div className="min-w-0">
                      <dt style={scaledTinyStyle} className="text-slate-400">Duración</dt>
                      <dd style={scaledTitleStyle} className="min-w-0 break-words font-mono text-slate-100">
                        {track.durationMs !== undefined ? formatClock(track.durationMs) : "Sin duración"}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt style={scaledTinyStyle} className="text-slate-400">Transcurrido</dt>
                      <dd style={scaledTitleStyle} className="min-w-0 break-words font-mono text-cyan-200">{formatClock(shownActiveMs)}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt style={scaledTinyStyle} className="text-slate-400">Restante</dt>
                      <dd style={scaledTitleStyle} className="min-w-0 break-words font-mono text-slate-100">
                        {remainingMs !== undefined ? formatClock(remainingMs) : "Sin duración"}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt style={scaledTinyStyle} className="text-slate-400">Cues vinculados</dt>
                      <dd style={scaledTitleStyle} className="min-w-0 break-words text-slate-100">{linkedByTrack.get(track.id)?.length ?? 0}</dd>
                    </div>
                  </dl>
                ) : (
                  <dl className="mt-3 grid min-w-0 grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                    <div className="min-w-0">
                      <dt style={scaledTinyStyle} className="text-slate-400">Duración</dt>
                      <dd style={scaledTitleStyle} className="min-w-0 break-words font-mono text-slate-100">
                        {track.durationMs !== undefined ? formatClock(track.durationMs) : "Sin duración"}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt style={scaledTinyStyle} className="text-slate-400">Cues vinculados</dt>
                      <dd style={scaledTitleStyle} className="min-w-0 break-words text-slate-100">{linkedByTrack.get(track.id)?.length ?? 0}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt style={scaledTinyStyle} className="text-slate-400">Inicio calculado</dt>
                      <dd style={scaledTitleStyle} className="min-w-0 break-words font-mono text-slate-100">{formatClock(startAtMs)}</dd>
                    </div>
                  </dl>
                )}

                {track.notes.trim() && (
                  <p style={scaledSmallStyle} className="mt-2 min-w-0 break-words text-slate-300">
                    <span className="font-semibold">Notas:</span> {track.notes}
                  </p>
                )}

                {(warningsByTrack.get(track.id) ?? []).map((message, warningIndex) => (
                  <p
                    key={`${track.id}-warning-${warningIndex}`}
                    style={scaledTinyStyle}
                    className="mt-2 min-w-0 break-words border-l-2 border-amber-400 pl-2 text-amber-200"
                  >
                    {message}
                  </p>
                ))}

                {variant === "operation" && status === "Pendiente" && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleStart(track)}
                      disabled={Boolean(startDisabledReason)}
                      aria-describedby={startDisabledReason ? startReasonId : undefined}
                      style={scaledSmallStyle}
                      className={cn(primaryButtonClass, startDisabledReason && disabledButtonClass)}
                    >
                      Iniciar track
                    </button>
                    {startDisabledReason && (
                      <p id={startReasonId} style={scaledTinyStyle} className="mt-1 min-w-0 break-words text-amber-300">
                        {startDisabledReason}
                      </p>
                    )}
                  </>
                )}

                {variant === "operation" && status === "En marcha" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => handlePause(track)} style={scaledSmallStyle} className={secondaryButtonClass}>
                      Pausar track
                    </button>
                    <button type="button" onClick={() => handleStop(track)} style={scaledSmallStyle} className={dangerButtonClass}>
                      Detener track
                    </button>
                  </div>
                )}

                {variant === "operation" && status === "Pausado" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => handleResume(track)} style={scaledSmallStyle} className={primaryButtonClass}>
                      Reanudar track
                    </button>
                    <button type="button" onClick={() => handleStop(track)} style={scaledSmallStyle} className={dangerButtonClass}>
                      Detener track
                    </button>
                  </div>
                )}

                {variant === "operation" && status === "Terminado" && !isShow && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => handleReset(track)} style={scaledSmallStyle} className={secondaryButtonClass}>
                      Reiniciar track
                    </button>
                  </div>
                )}

                {variant === "operation" && isActive && (
                  <p style={scaledTinyStyle} className="mt-1 min-w-0 break-words text-slate-400">
                    {pendingByTrack.get(track.id) ?? 0} cues pendientes vinculados.
                  </p>
                )}

                <div className="mt-3 flex min-w-0 flex-wrap gap-2 border-t border-slate-800 pt-3">
                  <button
                    type="button"
                    onClick={() => openEditDraft(track)}
                    disabled={isShow}
                    aria-describedby={isShow ? EDIT_LOCK_ID : undefined}
                    style={scaledSmallStyle}
                    className={cn(secondaryButtonClass, isShow && disabledButtonClass)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleMove(track, -1)}
                    disabled={isShow || index === 0}
                    aria-describedby={isShow ? EDIT_LOCK_ID : !isShow && index === 0 ? FIRST_TRACK_REASON_ID : undefined}
                    style={scaledSmallStyle}
                    className={cn(secondaryButtonClass, (isShow || index === 0) && disabledButtonClass)}
                  >
                    Subir
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleMove(track, 1)}
                    disabled={isShow || index === schedule.tracks.length - 1}
                    aria-describedby={isShow ? EDIT_LOCK_ID : !isShow && index === schedule.tracks.length - 1 ? LAST_TRACK_REASON_ID : undefined}
                    style={scaledSmallStyle}
                    className={cn(secondaryButtonClass, (isShow || index === schedule.tracks.length - 1) && disabledButtonClass)}
                  >
                    Bajar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(track)}
                    disabled={isShow}
                    aria-describedby={isShow ? EDIT_LOCK_ID : undefined}
                    style={scaledSmallStyle}
                    className={cn(dangerButtonClass, isShow && disabledButtonClass)}
                  >
                    Eliminar
                  </button>
                  {!isShow && index === 0 && (
                    <p id={FIRST_TRACK_REASON_ID} style={scaledTinyStyle} className="w-full min-w-0 break-words text-amber-300">
                      Es el primer track; no se puede subir.
                    </p>
                  )}
                  {!isShow && index === schedule.tracks.length - 1 && (
                    <p id={LAST_TRACK_REASON_ID} style={scaledTinyStyle} className="w-full min-w-0 break-words text-amber-300">
                      Es el último track; no se puede bajar.
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default TrackPanel;
