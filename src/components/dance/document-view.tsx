"use client";

import Link from "next/link";
import { liveQuery } from "dexie";
import { Fragment, useEffect, useMemo, useState } from "react";

import { CueTypeBadge } from "@/components/cues/cue-type-badge";
import { cueTypeOptions } from "@/lib/cue-presentation";
import {
  getCuesByProduction,
  getDanceTracks,
  getProductions,
  saveCue,
  saveDanceTrack,
} from "@/lib/data-service";
import { buildSchedule, formatClock, resolveCueTiming } from "@/lib/dance/schedule";
import type {
  Cue,
  CueType,
  DanceTrack,
  Production,
  Schedule,
  ScheduleWarningCode,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui-store";

const STANDARD_MESSAGE = "Este proyecto es estándar y no tiene documento de escaleta.";
const EMPTY_MESSAGE = "Este proyecto aún no tiene tracks ni cues.";
const LOCK_REASON = "En función la escaleta no se edita. Cambia a Ensayo.";
const LOCK_REASON_ID = "document-show-edit-reason";

const showTimingColumns = 8;
const untimedColumns = 5;

function formatPrintDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function warningLabel(code: ScheduleWarningCode): string {
  if (code === "track-overlap") return "Solape";
  if (code === "duplicate-track-order" || code === "duplicate-track-title"
    || code === "duplicate-cue-identifier") {
    return "Duplicado";
  }
  if (code === "missing-track-duration") return "Sin duración";
  return "Track no encontrado";
}

/** Text plus a discreet accent: colour never carries the warning alone. */
function warningAccent(code: ScheduleWarningCode): string {
  if (code === "track-overlap") return "border-l-amber-400 text-amber-200";
  if (code === "duplicate-track-order" || code === "duplicate-track-title"
    || code === "duplicate-cue-identifier") {
    return "border-l-sky-400 text-sky-200";
  }
  if (code === "missing-track-duration") return "border-l-slate-500 text-slate-300";
  return "border-l-orange-400 text-orange-200";
}

function cueTypeText(type: CueType): string {
  return cueTypeOptions.find((option) => option.value === type)?.label.split(" · ")[1] ?? type;
}

function groupLabel(cue: Cue): string {
  const act = cue.act.trim() || "Sin acto";
  const scene = cue.scene.trim() ? `Escena ${cue.scene.trim()}` : "Sin escena";
  return `${act} · ${scene}`;
}

interface InlineNoteProps {
  id: string;
  label: string;
  value: string;
  print: boolean;
  onSave: (nextValue: string) => Promise<void>;
  mutedClass: string;
}

/** Read-only text on paper; an explicit inline editor on screen. */
function InlineNote({ id, label, value, print, onSave, mutedClass }: InlineNoteProps) {
  // The parent keys this component by the persisted value, so a saved note
  // remounts it with the fresh text without an effect that resets the draft.
  const [draft, setDraft] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (print) {
    return <span className="whitespace-pre-wrap break-words">{value || "—"}</span>;
  }

  const hasChanges = draft !== value;

  async function handleSave() {
    if (!hasChanges || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      await onSave(draft);
    } catch {
      setError("No se pudo guardar la nota. Inténtalo de nuevo.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-1">
      <label htmlFor={id} className={cn("block text-[11px]", mutedClass)}>{label}</label>
      <textarea
        id={id}
        value={draft}
        rows={2}
        onChange={(event) => setDraft(event.target.value)}
        className="w-full min-w-[10rem] rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-1.5 text-xs leading-relaxed text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
      />
      {hasChanges && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="min-h-9 rounded-md border border-cyan-600 bg-cyan-950/40 px-2.5 py-1 text-xs font-medium text-cyan-100 outline-none hover:bg-cyan-900/40 focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Guardando…" : "Guardar nota"}
          </button>
          <button
            type="button"
            onClick={() => { setDraft(value); setError(null); }}
            disabled={isSaving}
            className="min-h-9 rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-300 outline-none hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Descartar
          </button>
        </div>
      )}
      {error ? (
        <p role="alert" className="text-[11px] text-amber-300">{error}</p>
      ) : (
        <span role="status" aria-live="polite" className="sr-only">
          {isSaving ? "Guardando nota" : hasChanges ? "Nota sin guardar" : "Nota guardada"}
        </span>
      )}
    </div>
  );
}

interface CueTableProps {
  cues: Cue[];
  schedule: Schedule;
  print: boolean;
  isShowMode: boolean;
  timed: boolean;
  mutedClass: string;
}

function CueTable({
  cues, schedule, print, isShowMode, timed, mutedClass,
}: CueTableProps) {
  const columnCount = timed ? showTimingColumns : untimedColumns;
  const groupStartIds = new Set<string>();
  let previousGroup = "";
  for (const cue of cues) {
    const group = groupLabel(cue);
    if (group !== previousGroup) {
      groupStartIds.add(cue.id);
      previousGroup = group;
    }
  }

  return (
    <div className={cn("overflow-x-auto", print && "overflow-visible")}>
      <table className={cn("w-full min-w-[52rem] border-collapse text-left text-xs", print && "min-w-0")}>
        <thead>
          <tr className={cn("border-b", print ? "border-slate-400" : "border-slate-700")}>
            <th scope="col" className="px-2 py-2 font-semibold">Identificador</th>
            <th scope="col" className="px-2 py-2 font-semibold">Tipo</th>
            <th scope="col" className="px-2 py-2 font-semibold">Descripción</th>
            {timed && (
              <>
                <th scope="col" className="px-2 py-2 font-semibold">Tiempo absoluto</th>
                <th scope="col" className="px-2 py-2 font-semibold">Track</th>
                <th scope="col" className="px-2 py-2 font-semibold">Objetivo en track</th>
              </>
            )}
            <th scope="col" className="px-2 py-2 font-semibold">Pie</th>
            <th scope="col" className="px-2 py-2 font-semibold">Observaciones</th>
          </tr>
        </thead>
        <tbody>
          {cues.map((cue) => {
            const resolved = resolveCueTiming(cue, schedule);
            const track = resolved.trackId
              ? schedule.tracks.find(({ track: scheduled }) => scheduled.id === resolved.trackId)?.track
              : undefined;
            const group = groupLabel(cue);
            const startsGroup = groupStartIds.has(cue.id);
            const lockedCell = isShowMode ? LOCK_REASON_ID : undefined;

            return (
              <Fragment key={cue.id}>
                {startsGroup && (
                  <tr className={cn("border-b", print ? "border-slate-300" : "border-slate-800")}>
                    <th
                      scope="colgroup"
                      colSpan={columnCount}
                      className={cn("px-2 pb-1 pt-3 text-left text-[11px] font-semibold uppercase tracking-wider", mutedClass)}
                    >
                      {group}
                    </th>
                  </tr>
                )}
                <tr className={cn("align-top border-b", print ? "border-slate-300" : "border-slate-800/70")}>
                  <td className="px-2 py-2 font-mono font-semibold">{cue.identifier}</td>
                  <td className="px-2 py-2">
                    <CueTypeBadge type={cue.type} includedTypes={cue.includedTypes} className="whitespace-nowrap">
                      {cue.type}
                    </CueTypeBadge>
                    <span className={cn("mt-1 block text-[11px]", mutedClass)}>{cueTypeText(cue.type)}</span>
                  </td>
                  <td className="min-w-[12rem] px-2 py-2">{cue.description || "—"}</td>
                  {timed && (
                    <>
                      <td className="whitespace-nowrap px-2 py-2 font-mono" title={lockedCell ? LOCK_REASON : undefined} aria-describedby={lockedCell}>
                        {resolved.atMs !== undefined ? formatClock(resolved.atMs) : "Sin tiempo"}
                      </td>
                      <td className="px-2 py-2" title={lockedCell ? LOCK_REASON : undefined} aria-describedby={lockedCell}>
                        {track?.title ?? (resolved.status === "orphan" ? "Track no encontrado" : "—")}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 font-mono" title={lockedCell ? LOCK_REASON : undefined} aria-describedby={lockedCell}>
                        {resolved.trackOffsetMs !== undefined ? formatClock(resolved.trackOffsetMs) : "—"}
                      </td>
                    </>
                  )}
                  <td className="min-w-[9rem] px-2 py-2">
                    <InlineNote
                      key={`cue-pie-${cue.id}-${cue.pie ?? ""}`}
                      id={`cue-pie-${cue.id}`}
                      label={`Pie de ${cue.identifier}`}
                      value={cue.pie ?? ""}
                      print={print}
                      mutedClass={mutedClass}
                      onSave={(nextValue) => saveCue({ ...cue, pie: nextValue })}
                    />
                  </td>
                  <td className="min-w-[12rem] px-2 py-2">
                    <InlineNote
                      key={`cue-observations-${cue.id}-${cue.observations}`}
                      id={`cue-observations-${cue.id}`}
                      label={`Observaciones de ${cue.identifier}`}
                      value={cue.observations}
                      print={print}
                      mutedClass={mutedClass}
                      onSave={(nextValue) => saveCue({ ...cue, observations: nextValue })}
                    />
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {cues.length === 0 && <p className={cn("px-2 py-3", mutedClass)}>No hay cues en esta sección.</p>}
    </div>
  );
}

interface DocumentViewProps {
  print?: boolean;
}

export function DocumentView({ print = false }: DocumentViewProps) {
  const selectedProjectId = useUiStore((state) => state.selectedProjectId);
  const executionMode = useUiStore((state) => state.executionMode);
  const [productions, setProductions] = useState<Production[]>([]);
  const [isLoadingProductions, setIsLoadingProductions] = useState(true);
  const [tracks, setTracks] = useState<DanceTrack[]>([]);
  const [cues, setCues] = useState<Cue[]>([]);
  const [now, setNow] = useState(0);
  const [loadedForId, setLoadedForId] = useState("");
  const [errorForId, setErrorForId] = useState("");
  const [productionsError, setProductionsError] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const subscription = liveQuery(() => getProductions()).subscribe({
      next: (nextProductions) => {
        setProductions(nextProductions);
        setIsLoadingProductions(false);
      },
      error: () => {
        setIsLoadingProductions(false);
        setProductionsError(true);
      },
    });
    return () => subscription.unsubscribe();
  }, []);

  const production = productions.find((item) => item.id === selectedProjectId) ?? productions[0];
  const productionId = production?.id ?? "";

  useEffect(() => {
    if (!productionId) return;
    const subscription = liveQuery(async () => {
      const [nextTracks, nextCues] = await Promise.all([
        getDanceTracks(productionId),
        getCuesByProduction(productionId),
      ]);
      return { tracks: nextTracks, cues: nextCues };
    }).subscribe({
      next: ({ tracks: nextTracks, cues: nextCues }) => {
        setTracks(nextTracks);
        setCues(nextCues);
        // `now` is injected here, at the UI boundary; domain code never reads a clock.
        setNow(Date.now());
        setLoadedForId(productionId);
        setErrorForId("");
        setAnnouncement(`Escaleta actualizada: ${nextTracks.length} tracks, ${nextCues.length} cues.`);
      },
      error: () => {
        setErrorForId(productionId);
      },
    });
    return () => subscription.unsubscribe();
  }, [productionId]);

  const isDataReady = Boolean(productionId) && loadedForId === productionId;
  const loadError = Boolean(productionId) && errorForId === productionId;

  // Derived on every data change: there is no stored or regenerated schedule.
  const schedule = useMemo(
    () => buildSchedule({
      tracks: isDataReady ? tracks : [],
      cues: isDataReady ? cues : [],
      now,
    }),
    [tracks, cues, now, isDataReady],
  );

  const isShowMode = executionMode === "show";
  const mutedClass = print ? "text-slate-600" : "text-slate-400";
  const headingClass = print ? "text-slate-900" : "text-white";
  const panelClass = print
    ? "border-0 p-0"
    : "rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-sm shadow-slate-950/20";

  let content: React.ReactNode;

  if (isLoadingProductions) {
    content = <p role="status" className="py-6 text-sm text-slate-300">Cargando producciones…</p>;
  } else if (productionsError) {
    content = <p role="alert" className="py-6 text-sm text-amber-300">No se pudieron cargar las producciones.</p>;
  } else if (!production) {
    content = <p className="py-6 text-sm text-slate-300">No hay ningún proyecto seleccionado.</p>;
  } else if (production.mode !== "dance") {
    content = (
      <div className={cn(panelClass, "space-y-3")}>
        <p className="text-sm text-slate-200">{STANDARD_MESSAGE}</p>
        <Link
          href="/libretos"
          className={cn(
            "inline-flex min-h-10 items-center rounded-lg border border-cyan-700 px-3 py-2 text-sm text-cyan-200 outline-none hover:bg-cyan-950/40 focus-visible:ring-2 focus-visible:ring-cyan-400",
            print && "no-print",
          )}
        >
          Ir a libretos
        </Link>
      </div>
    );
  } else if (loadError) {
    content = <p role="alert" className="py-6 text-sm text-amber-300">No se pudo cargar la escaleta.</p>;
  } else if (!isDataReady) {
    content = <p role="status" className="py-6 text-sm text-slate-300">Cargando escaleta…</p>;
  } else if (schedule.totals.trackCount === 0 && schedule.totals.cueCount === 0) {
    content = (
      <div className={cn(panelClass, "py-8")}>
        <p className="text-sm text-slate-200">{EMPTY_MESSAGE}</p>
      </div>
    );
  } else {
    content = (
      <>
        <section aria-labelledby="document-header-title" className={cn(panelClass, "space-y-4")}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <p className={cn("text-xs uppercase tracking-[0.2em]", mutedClass)}>
                Documento / escaleta
              </p>
              <h2 id="document-header-title" className={cn("text-xl font-semibold", headingClass)}>
                {production.title}
              </h2>
              {production.venue && (
                <p className={cn("text-sm", mutedClass)}>Sala: {production.venue}</p>
              )}
              {print && (
                <p className={cn("text-sm", mutedClass)}>
                  Fecha y hora: {formatPrintDateTime(schedule.totals.calculatedAt)}
                </p>
              )}
            </div>
            <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <div>
                <dt className={cn("text-xs uppercase tracking-wider", mutedClass)}>Tracks</dt>
                <dd className={cn("font-semibold", headingClass)}>{schedule.totals.trackCount}</dd>
              </div>
              <div>
                <dt className={cn("text-xs uppercase tracking-wider", mutedClass)}>Cues</dt>
                <dd className={cn("font-semibold", headingClass)}>{schedule.totals.cueCount}</dd>
              </div>
              <div>
                <dt className={cn("text-xs uppercase tracking-wider", mutedClass)}>Duración total</dt>
                <dd className={cn("font-mono font-semibold", headingClass)}>
                  {formatClock(schedule.totals.totalMs)}
                </dd>
              </div>
            </dl>
          </div>

          {!print && (
            <div className="no-print flex flex-wrap items-center gap-3 border-t border-slate-800 pt-3">
              <span className="text-xs text-slate-300">
                {isShowMode ? "Función en curso" : executionMode === "rehearsal" ? "Ensayo" : "Sin ejecución activa"}
              </span>
              {isShowMode && (
                <>
                  <button
                    type="button"
                    disabled
                    aria-describedby={LOCK_REASON_ID}
                    title={LOCK_REASON}
                    className="min-h-10 cursor-not-allowed rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400 opacity-70"
                  >
                    Editar estructura y tiempos
                  </button>
                  <p id={LOCK_REASON_ID} className="text-xs text-amber-300">{LOCK_REASON}</p>
                </>
              )}
            </div>
          )}
        </section>

        {schedule.warnings.length > 0 && (
          <section aria-labelledby="document-warnings-title" className={panelClass}>
            <h2 id="document-warnings-title" className={cn("mb-3 text-base font-semibold", headingClass)}>
              Avisos de la escaleta
            </h2>
            <ul className="space-y-2">
              {schedule.warnings.map((warning, index) => (
                <li
                  key={`${warning.code}-${index}`}
                  className={cn("border-l-2 pl-3 text-sm", warningAccent(warning.code))}
                >
                  <span className="font-semibold">{warningLabel(warning.code)}:</span>{" "}
                  {warning.message}
                </li>
              ))}
            </ul>
          </section>
        )}

        {schedule.tracks.length > 0 && (
          <section aria-labelledby="document-tracks-title" className={panelClass}>
            <h2 id="document-tracks-title" className={cn("mb-3 text-base font-semibold", headingClass)}>
              Tracks
            </h2>
            <div className={cn("overflow-x-auto", print && "overflow-visible")}>
              <table className={cn("w-full min-w-[42rem] border-collapse text-left text-xs", print && "min-w-0")}>
                <thead>
                  <tr className={cn("border-b", print ? "border-slate-400" : "border-slate-700")}>
                    <th scope="col" className="px-2 py-2 font-semibold">Título</th>
                    <th scope="col" className="px-2 py-2 font-semibold">Duración</th>
                    <th scope="col" className="px-2 py-2 font-semibold">Inicio calculado</th>
                    <th scope="col" className="px-2 py-2 font-semibold">Fin calculado</th>
                    <th scope="col" className="px-2 py-2 font-semibold">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.tracks.map(({ track, startAtMs, endAtMs }) => {
                    const hasDuration = track.durationMs !== undefined && track.durationMs > 0;
                    const lockedCell = isShowMode ? LOCK_REASON_ID : undefined;
                    return (
                      <tr
                        key={track.id}
                        className={cn("align-top border-b", print ? "border-slate-300" : "border-slate-800/70")}
                      >
                        <td className="min-w-[9rem] px-2 py-2 font-medium">{track.title}</td>
                        <td
                          className="whitespace-nowrap px-2 py-2 font-mono"
                          title={lockedCell ? LOCK_REASON : undefined}
                          aria-describedby={lockedCell}
                        >
                          {hasDuration ? formatClock(track.durationMs ?? 0) : "Sin duración"}
                        </td>
                        <td
                          className="whitespace-nowrap px-2 py-2 font-mono"
                          title={lockedCell ? LOCK_REASON : undefined}
                          aria-describedby={lockedCell}
                        >
                          {formatClock(startAtMs)}
                        </td>
                        <td
                          className="whitespace-nowrap px-2 py-2 font-mono"
                          title={lockedCell ? LOCK_REASON : undefined}
                          aria-describedby={lockedCell}
                        >
                          {endAtMs !== undefined ? formatClock(endAtMs) : "Sin duración"}
                        </td>
                        <td className="min-w-[12rem] px-2 py-2">
                          <InlineNote
                            key={`track-notes-${track.id}-${track.notes}`}
                            id={`track-notes-${track.id}`}
                            label={`Notas de ${track.title}`}
                            value={track.notes}
                            print={print}
                            mutedClass={mutedClass}
                            onSave={(nextValue) => saveDanceTrack({ ...track, notes: nextValue })}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {schedule.timedCues.length > 0 && (
          <section aria-labelledby="document-cues-title" className={panelClass}>
            <h2 id="document-cues-title" className={cn("mb-3 text-base font-semibold", headingClass)}>
              Cues
            </h2>
            <CueTable
              cues={schedule.timedCues}
              schedule={schedule}
              print={print}
              isShowMode={isShowMode}
              timed
              mutedClass={mutedClass}
            />
          </section>
        )}

        {schedule.untimedCues.length > 0 && (
          <section aria-labelledby="document-untimed-title" className={panelClass}>
            <h2 id="document-untimed-title" className={cn("mb-3 text-base font-semibold", headingClass)}>
              Sin tiempo
            </h2>
            <CueTable
              cues={schedule.untimedCues}
              schedule={schedule}
              print={print}
              isShowMode={isShowMode}
              timed={false}
              mutedClass={mutedClass}
            />
          </section>
        )}
      </>
    );
  }

  return (
    <div
      id={print ? "print-sheet" : undefined}
      className={print ? "space-y-4 bg-white p-6 text-slate-900" : "space-y-5"}
    >
      <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
      {content}
    </div>
  );
}
