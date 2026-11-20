"use client";

import { CueTypeBadge } from "@/components/cues/cue-type-badge";
import { formatClock, resolveCueTiming } from "@/lib/dance/schedule";
import type { Cue, Schedule, TrackState } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface LiveScheduleProps {
  cues: Cue[];
  schedule: Schedule;
  launchedIds: string[];
  notReachedIds: string[];
  trackStates: Record<string, TrackState>;
  nextCueId?: string;
  now: number;
}

type CueStateKind = "next" | "launched" | "not-reached" | "pending";

// T10/A2: the scale variable is set by app-shell; this view only consumes it.
const scaledHeadingStyle = { fontSize: "calc(1.125rem * var(--dance-font-scale, 1))" } as const;
const scaledTitleStyle = { fontSize: "calc(0.875rem * var(--dance-font-scale, 1))" } as const;
const scaledSmallStyle = { fontSize: "calc(0.75rem * var(--dance-font-scale, 1))" } as const;
const scaledTinyStyle = { fontSize: "calc(0.6875rem * var(--dance-font-scale, 1))" } as const;

const CUE_STATES: Record<CueStateKind, { label: string; icon: string; className: string }> = {
  next: {
    label: "La siguiente",
    icon: "▶",
    className: "border-cyan-400 bg-cyan-950 text-cyan-100",
  },
  launched: {
    label: "Lanzada",
    icon: "✓",
    className: "border-emerald-500 bg-emerald-950 text-emerald-100",
  },
  "not-reached": {
    label: "No alcanzada",
    icon: "!",
    className: "border-amber-500 bg-amber-950 text-amber-100",
  },
  pending: {
    label: "Pendiente",
    icon: "○",
    className: "border-slate-600 bg-slate-900 text-slate-300",
  },
};

function trackStateLabel(state: TrackState): string {
  if (state.status !== "Terminado") return state.status;
  if (state.endedBy === "duration") return "Terminado · por duración";
  if (state.endedBy === "manual") return "Terminado · manual";
  return "Terminado";
}

function trackStateClassName(state: TrackState): string {
  if (state.status === "En marcha") return "border-emerald-500 bg-emerald-950 text-emerald-100";
  if (state.status === "Pausado") return "border-amber-500 bg-amber-950 text-amber-100";
  if (state.status === "Terminado") return "border-sky-500 bg-sky-950 text-sky-100";
  return "border-slate-600 bg-slate-900 text-slate-300";
}

function trackStateIcon(state: TrackState): string {
  if (state.status === "En marcha") return "▶";
  if (state.status === "Pausado") return "Ⅱ";
  if (state.status === "Terminado") return "■";
  return "○";
}

function sampleTime(now: number): { iso?: string; text: string } {
  // The parent samples the instant at the UI boundary; 0 means "not sampled yet".
  if (!Number.isFinite(now) || now <= 0) return { text: "—" };
  const date = new Date(now);
  if (Number.isNaN(date.getTime())) return { text: "—" };
  return {
    iso: date.toISOString(),
    text: new Intl.DateTimeFormat("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date),
  };
}

/**
 * Read-only companion to the running cue list. It derives every time from the
 * schedule and never reads a clock, storage or launch controls.
 */
export function LiveSchedule({
  cues,
  schedule,
  launchedIds,
  notReachedIds,
  trackStates,
  nextCueId,
  now,
}: LiveScheduleProps) {
  const cueIds = new Set(cues.map((cue) => cue.id));
  const launched = new Set(launchedIds);
  const notReached = new Set(notReachedIds);
  const timedCues = schedule.timedCues.filter((cue) => cueIds.has(cue.id));
  const untimedCues = schedule.untimedCues.filter((cue) => cueIds.has(cue.id));
  const sample = sampleTime(now);

  function cueState(cue: Cue): CueStateKind {
    if (notReached.has(cue.id)) return "not-reached";
    if (launched.has(cue.id)) return "launched";
    if (nextCueId !== undefined && cue.id === nextCueId) return "next";
    return "pending";
  }

  function renderCue(cue: Cue) {
    const resolved = resolveCueTiming(cue, schedule);
    const track = resolved.trackId
      ? schedule.tracks.find(({ track: scheduled }) => scheduled.id === resolved.trackId)?.track
      : undefined;
    const stateKind = cueState(cue);
    const state = CUE_STATES[stateKind];
    const isNext = stateKind === "next";

    return (
      <li
        key={cue.id}
        aria-current={isNext ? "step" : undefined}
        className={cn(
          "min-w-0 rounded-lg border px-3 py-2",
          isNext
            ? "border-cyan-400 bg-cyan-950/30 ring-1 ring-cyan-400/60"
            : "border-slate-800 bg-slate-950/40",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <CueTypeBadge type={cue.type} includedTypes={cue.includedTypes} className="whitespace-nowrap">
              {cue.type}
            </CueTypeBadge>
            <span
              style={scaledTitleStyle}
              title={cue.identifier}
              className="min-w-0 break-words font-mono font-semibold text-slate-100"
            >
              {cue.identifier}
            </span>
            <span
              style={scaledTinyStyle}
              className={cn(
                "inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 font-semibold",
                state.className,
              )}
            >
              <span aria-hidden="true">{state.icon}</span>
              {state.label}
            </span>
          </div>
          <span
            style={scaledSmallStyle}
            title={resolved.atMs !== undefined ? formatClock(resolved.atMs) : "Sin tiempo"}
            className="min-w-0 max-w-full truncate font-mono font-semibold text-slate-200"
          >
            {resolved.atMs !== undefined ? formatClock(resolved.atMs) : "Sin tiempo"}
          </span>
        </div>
        <p style={scaledTitleStyle} className="mt-1 min-w-0 break-words text-slate-300">
          {cue.description || "—"}
        </p>
        <dl style={scaledTinyStyle} className="mt-2 flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-slate-400">
          <div className="flex min-w-0 gap-1">
            <dt>Track:</dt>
            <dd className="break-words">
              {track?.title ?? (resolved.status === "orphan" ? "Track no encontrado" : "—")}
            </dd>
          </div>
          <div className="flex gap-1">
            <dt>Objetivo:</dt>
            <dd className="font-mono">
              {resolved.trackOffsetMs !== undefined ? formatClock(resolved.trackOffsetMs) : "—"}
            </dd>
          </div>
        </dl>
      </li>
    );
  }

  return (
    <section
      aria-labelledby="live-schedule-title"
      className="min-w-0 space-y-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm shadow-slate-950/20"
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p style={scaledSmallStyle} className="break-words uppercase tracking-[0.2em] text-slate-400">
            Ejecución
          </p>
          <h2 id="live-schedule-title" style={scaledHeadingStyle} className="min-w-0 break-words font-semibold text-white">
            Escaleta viva
          </h2>
        </div>
        <p style={scaledSmallStyle} className="min-w-0 break-words text-slate-400">
          Instante de consulta:{" "}
          <time dateTime={sample.iso} title={sample.text} className="font-mono text-slate-300">
            {sample.text}
          </time>
        </p>
      </header>

      <dl style={scaledSmallStyle} className="flex min-w-0 flex-wrap gap-x-5 gap-y-1 text-slate-400">
        <div className="flex gap-1">
          <dt>Tracks:</dt>
          <dd className="font-semibold text-slate-200">{schedule.totals.trackCount}</dd>
        </div>
        <div className="flex gap-1">
          <dt>Cues:</dt>
          <dd className="font-semibold text-slate-200">{schedule.totals.cueCount}</dd>
        </div>
        <div className="flex gap-1">
          <dt>Duración total:</dt>
          <dd className="font-mono font-semibold text-slate-200">
            {formatClock(schedule.totals.totalMs)}
          </dd>
        </div>
      </dl>

      <section aria-labelledby="live-schedule-tracks-title" className="min-w-0">
        <h3 id="live-schedule-tracks-title" style={scaledTitleStyle} className="mb-2 min-w-0 break-words font-semibold text-cyan-200">
          Tracks
        </h3>
        {schedule.tracks.length === 0 ? (
          <p style={scaledSmallStyle} className="break-words text-slate-400">No hay tracks.</p>
        ) : (
          <ol className="divide-y divide-slate-800 rounded-lg border border-slate-800">
            {schedule.tracks.map(({ track, startAtMs, endAtMs }) => {
              const state = trackStates[track.id] ?? { status: "Pendiente" as const };
              const label = trackStateLabel(state);
              const times = `Inicio ${formatClock(startAtMs)} · ${
                endAtMs !== undefined ? `Fin ${formatClock(endAtMs)}` : "Sin duración"
              }`;
              return (
                <li key={track.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <p style={scaledTitleStyle} title={track.title} className="min-w-0 break-words font-medium text-slate-100">
                      {track.title}
                    </p>
                    <p style={scaledTinyStyle} title={times} className="min-w-0 break-words text-slate-400">
                      {times}
                    </p>
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span
                      style={scaledTinyStyle}
                      className={cn(
                        "inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 font-semibold",
                        trackStateClassName(state),
                      )}
                    >
                      <span aria-hidden="true">{trackStateIcon(state)}</span>
                      {label}
                    </span>
                    {state.activeMs !== undefined && (
                      <span
                        style={scaledSmallStyle}
                        title="Tiempo activo"
                        className="min-w-0 max-w-full truncate font-mono font-semibold text-slate-200"
                      >
                        {formatClock(state.activeMs)}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section aria-labelledby="live-schedule-cues-title" className="min-w-0">
        <h3 id="live-schedule-cues-title" style={scaledTitleStyle} className="mb-2 min-w-0 break-words font-semibold text-cyan-200">
          Cues
        </h3>
        {timedCues.length === 0 ? (
          <p style={scaledSmallStyle} className="break-words text-slate-400">No hay cues con tiempo.</p>
        ) : (
          <ol className="min-w-0 space-y-2">{timedCues.map(renderCue)}</ol>
        )}
      </section>

      <section aria-labelledby="live-schedule-untimed-title" className="min-w-0">
        <h3 id="live-schedule-untimed-title" style={scaledTitleStyle} className="mb-2 min-w-0 break-words font-semibold text-cyan-200">
          Sin tiempo
        </h3>
        {untimedCues.length === 0 ? (
          <p style={scaledSmallStyle} className="break-words text-slate-400">No hay cues sin tiempo.</p>
        ) : (
          <ol className="min-w-0 space-y-2">{untimedCues.map(renderCue)}</ol>
        )}
      </section>
    </section>
  );
}

export default LiveSchedule;
