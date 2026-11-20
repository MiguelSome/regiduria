"use client";

import { liveQuery } from "dexie";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  deleteScheduleTemplate,
  getCuesByProduction,
  getDanceTracks,
  getProductions,
  getScheduleTemplate,
  getScheduleTemplates,
  saveScheduleTemplate,
} from "@/lib/data-service";
import { buildSchedule, formatClock } from "@/lib/dance/schedule";
import {
  buildTemplateExport,
  buildTemplateFromSchedule,
  uniqueTemplateName,
  validateTemplateFile,
  type TemplateSelection,
} from "@/lib/dance/templates";
import type {
  Cue,
  CueTiming,
  DanceTrack,
  Production,
  ScheduleTemplate,
  TemplateFile,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui-store";

/**
 * `buildSchedule` only uses `now` for its ISO trace. The real instant is
 * injected in the UI handlers that write; rendering stays deterministic.
 */
const SCHEDULE_CALCULATION_NOW = 0;
const LINKED_CUE_REASON = "Selecciona también su track para incluir este cue.";
const TEMPLATE_JSON_FORMAT = "regiduria.schedule-template";
const TEMPLATE_JSON_VERSION = 1;

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function messageFromError(error: unknown): string {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : "No se pudo completar la operación. Inténtalo de nuevo.";
}

function createTemplateId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `tpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Safe, recognizable download name derived from the template/project name. */
function templateFileName(sourceName: string): string {
  const slug = sourceName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return `${slug || "plantilla"}.regiduria-plantilla.json`;
}

function downloadTemplateJson(file: TemplateFile, sourceName: string): void {
  const blob = new Blob([JSON.stringify(file, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = templateFileName(sourceName);
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** CL64: a trackId without an offset is not a link, so it behaves as a loose cue. */
function normalizeCues(cues: Cue[]): Cue[] {
  return cues.map((cue) => {
    const timing = cue.timing;
    if (!timing || timing.trackId === undefined || timing.trackOffsetMs !== undefined) {
      return cue;
    }
    const nextTiming: CueTiming = {
      ...(timing.atMs !== undefined ? { atMs: timing.atMs } : {}),
      ...(timing.alertBeforeMs !== undefined ? { alertBeforeMs: timing.alertBeforeMs } : {}),
    };
    return { ...cue, timing: Object.keys(nextTiming).length > 0 ? nextTiming : undefined };
  });
}

function isLooseCue(cue: Cue, tracks: DanceTrack[]): boolean {
  const timing = cue.timing;
  if (!timing || timing.trackId === undefined || timing.trackOffsetMs === undefined) return true;
  return !tracks.some((track) => track.id === timing.trackId);
}

/** A template has local keys, so it becomes a synthetic schedule for the shared form. */
function templateToScheduleEntities(template: ScheduleTemplate): {
  tracks: DanceTrack[];
  cues: Cue[];
} {
  const tracks: DanceTrack[] = template.tracks.map((track) => ({
    id: track.key,
    productionId: template.id,
    title: track.title,
    ...(track.durationMs !== undefined ? { durationMs: track.durationMs } : {}),
    order: track.order,
    ...(track.startAtMs !== undefined ? { startAtMs: track.startAtMs } : {}),
    notes: track.notes,
  }));
  const knownKeys = new Set(tracks.map((track) => track.id));

  const cues: Cue[] = template.cues.map((cue, index) => {
    const timing: CueTiming = {
      ...(cue.alertBeforeMs !== undefined ? { alertBeforeMs: cue.alertBeforeMs } : {}),
    };
    if (
      cue.trackKey !== undefined
      && knownKeys.has(cue.trackKey)
      && cue.trackOffsetMs !== undefined
    ) {
      timing.trackId = cue.trackKey;
      timing.trackOffsetMs = cue.trackOffsetMs;
    } else if (cue.atMs !== undefined) {
      timing.atMs = cue.atMs;
    }

    return {
      id: `template-cue-${index}`,
      productionId: template.id,
      identifier: cue.identifier,
      type: cue.type,
      ...(cue.includedTypes && cue.includedTypes.length > 0
        ? { includedTypes: [...cue.includedTypes] }
        : {}),
      description: cue.description,
      ...(cue.pie !== undefined ? { pie: cue.pie } : {}),
      act: cue.act,
      scene: cue.scene,
      department: cue.department,
      observations: cue.observations,
      status: cue.status,
      executionState: cue.executionState,
      timing: Object.keys(timing).length > 0 ? timing : undefined,
    };
  });

  return { tracks, cues };
}

interface TemplateDraft {
  kind: "create" | "edit";
  templateId?: string;
  sourceTemplateId?: string;
  originalName?: string;
  version?: number;
  createdAt?: string;
  name: string;
  description: string;
  tracks: DanceTrack[];
  cues: Cue[];
}

interface RenameDraft {
  template: ScheduleTemplate;
  name: string;
  description: string;
  error: string | null;
  isSaving: boolean;
}

interface TemplateFormProps {
  formId: string;
  title: string;
  submitLabel: string;
  name: string;
  description: string;
  tracks: DanceTrack[];
  cues: Cue[];
  selection: TemplateSelection;
  isSaving: boolean;
  error: string | null;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onToggleTrack: (trackId: string) => void;
  onToggleLooseCue: (cueId: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}

/** Whole tracks and loose cues, with disabled linked-cue controls (CL51, D17). */
function TemplateForm({
  formId,
  title,
  submitLabel,
  name,
  description,
  tracks,
  cues,
  selection,
  isSaving,
  error,
  onNameChange,
  onDescriptionChange,
  onToggleTrack,
  onToggleLooseCue,
  onSubmit,
  onCancel,
}: TemplateFormProps) {
  const schedule = useMemo(
    () => buildSchedule({ tracks, cues, now: SCHEDULE_CALCULATION_NOW }),
    [tracks, cues],
  );

  const trackById = new Map(schedule.tracks.map(({ track }) => [track.id, track]));
  const linkedCuesByTrack = new Map<string, Cue[]>();
  const looseCues: Cue[] = [];
  for (const cue of [...schedule.timedCues, ...schedule.untimedCues]) {
    const timing = cue.timing;
    const trackId = timing?.trackId;
    if (
      trackId !== undefined
      && timing?.trackOffsetMs !== undefined
      && trackById.has(trackId)
    ) {
      const linked = linkedCuesByTrack.get(trackId) ?? [];
      linked.push(cue);
      linkedCuesByTrack.set(trackId, linked);
    } else {
      looseCues.push(cue);
    }
  }

  const checkClass = "h-4 w-4 shrink-0 accent-cyan-400 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400";
  const fieldClass = "w-full rounded-lg border border-slate-700 bg-slate-950/60 px-2.5 py-2 text-sm text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-slate-100">{title}</h3>
        <p className="text-xs text-slate-400">
          Los tracks se incluyen completos; los cues vinculados no se pueden desmarcar por separado.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor={`${formId}-name`} className="block text-xs font-medium text-slate-300">
            Nombre <span aria-hidden="true">*</span>
          </label>
          <input
            id={`${formId}-name`}
            type="text"
            required
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            className={fieldClass}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${formId}-description`} className="block text-xs font-medium text-slate-300">
            Descripción (opcional)
          </label>
          <input
            id={`${formId}-description`}
            type="text"
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            className={fieldClass}
          />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-slate-200">Tracks completos</legend>
        {schedule.tracks.length === 0 && (
          <p className="text-xs text-slate-400">No hay tracks en esta escaleta.</p>
        )}
        {schedule.tracks.map(({ track }) => {
          const selected = selection.trackKeys.includes(track.id);
          const linked = linkedCuesByTrack.get(track.id) ?? [];
          return (
            <div key={track.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
              <label className="flex flex-wrap items-center gap-2 text-sm text-slate-100">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onToggleTrack(track.id)}
                  className={checkClass}
                />
                <span className="font-medium">{track.title}</span>
                <span className="text-xs text-slate-400">
                  {track.durationMs !== undefined ? formatClock(track.durationMs) : "Sin duración"}
                </span>
              </label>
              {linked.length > 0 && (
                <ul className="mt-2 space-y-2 pl-6">
                  {linked.map((cue) => {
                    const reasonId = `${formId}-cue-reason-${cue.id}`;
                    return (
                      <li key={cue.id} className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled
                            readOnly
                            aria-describedby={reasonId}
                            className={cn(checkClass, "disabled:opacity-60")}
                          />
                          <span className="font-mono font-semibold">{cue.identifier}</span>
                          <span className="text-slate-400">{cue.description}</span>
                          <span className="font-mono text-slate-400">
                            {cue.timing?.trackOffsetMs !== undefined
                              ? formatClock(cue.timing.trackOffsetMs)
                              : "Sin objetivo"}
                          </span>
                        </div>
                        <p
                          id={reasonId}
                          className={cn(
                            "text-[11px]",
                            selected ? "text-slate-500" : "text-amber-300",
                          )}
                        >
                          {selected
                            ? "Se incluye con el track seleccionado."
                            : LINKED_CUE_REASON}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-slate-200">Cues sueltos</legend>
        {looseCues.length === 0 && (
          <p className="text-xs text-slate-400">No hay cues sueltos en esta escaleta.</p>
        )}
        {looseCues.map((cue) => (
          <label
            key={cue.id}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-300"
          >
            <input
              type="checkbox"
              checked={selection.looseCueIds.includes(cue.id)}
              onChange={() => onToggleLooseCue(cue.id)}
              className={checkClass}
            />
            <span className="font-mono font-semibold text-slate-100">{cue.identifier}</span>
            <span className="min-w-[8rem] flex-1">{cue.description}</span>
            <span className="font-mono text-slate-400">
              {cue.timing?.atMs !== undefined ? formatClock(cue.timing.atMs) : "Sin tiempo"}
            </span>
          </label>
        ))}
      </fieldset>

      {schedule.warnings.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-300">
          {schedule.warnings.map((warning, index) => (
            <li key={`${warning.code}-${index}`}>{warning.message}</li>
          ))}
        </ul>
      )}

      <p className="text-xs text-slate-400">
        Seleccionados: {selection.trackKeys.length} tracks · {selection.looseCueIds.length} cues sueltos
      </p>

      {error && (
        <p role="alert" className="rounded-lg border border-amber-700/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          disabled={isSaving}
          className="min-h-10 border-cyan-700 bg-cyan-950/50 text-cyan-100 hover:bg-cyan-900/50 focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          {isSaving ? "Guardando…" : submitLabel}
        </Button>
        <Button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="min-h-10 focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export function TemplateManager() {
  const selectedProjectId = useUiStore((state) => state.selectedProjectId);
  const [productions, setProductions] = useState<Production[]>([]);
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [templatesError, setTemplatesError] = useState(false);
  const [tracks, setTracks] = useState<DanceTrack[]>([]);
  const [cues, setCues] = useState<Cue[]>([]);
  const [loadedForId, setLoadedForId] = useState("");
  const [draft, setDraft] = useState<TemplateDraft | null>(null);
  const [selection, setSelection] = useState<TemplateSelection>({
    trackKeys: [],
    looseCueIds: [],
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSavingForm, setIsSavingForm] = useState(false);
  const [renameDraft, setRenameDraft] = useState<RenameDraft | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState("");
  const [isExportingSchedule, setIsExportingSchedule] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportEnvelope, setExportEnvelope] = useState<
    Pick<TemplateFile, "format" | "formatVersion" | "kind" | "exportedAt"> | null
  >(null);

  useEffect(() => {
    const subscription = liveQuery(() => getProductions()).subscribe({
      next: (nextProductions) => setProductions(nextProductions),
      error: () => setProductions([]),
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const subscription = liveQuery(() => getScheduleTemplates()).subscribe({
      next: (nextTemplates) => {
        setTemplates(nextTemplates);
        setIsLoadingTemplates(false);
        setTemplatesError(false);
      },
      error: () => {
        setIsLoadingTemplates(false);
        setTemplatesError(true);
      },
    });
    return () => subscription.unsubscribe();
  }, []);

  const danceProduction = productions.find(
    (production) => production.id === selectedProjectId && production.mode === "dance",
  );
  const danceProductionId = danceProduction?.id ?? "";

  useEffect(() => {
    // No dance project: the stale sample is never used because `canCreate`
    // requires the current id, so there is nothing to reset synchronously.
    if (!danceProductionId) return;
    const subscription = liveQuery(async () => {
      const [nextTracks, nextCues] = await Promise.all([
        getDanceTracks(danceProductionId),
        getCuesByProduction(danceProductionId),
      ]);
      return { tracks: nextTracks, cues: normalizeCues(nextCues) };
    }).subscribe({
      next: ({ tracks: nextTracks, cues: nextCues }) => {
        setTracks(nextTracks);
        setCues(nextCues);
        setLoadedForId(danceProductionId);
      },
      error: () => setLoadedForId(""),
    });
    return () => subscription.unsubscribe();
  }, [danceProductionId]);

  const canCreate = Boolean(danceProductionId) && loadedForId === danceProductionId;

  function resetForm() {
    setDraft(null);
    setSelection({ trackKeys: [], looseCueIds: [] });
    setFormError(null);
  }

  function handleOpenCreate() {
    if (!canCreate) return;
    setActionError(null);
    setRenameDraft(null);
    setDraft({
      kind: "create",
      name: "",
      description: "",
      tracks,
      cues,
    });
    setSelection({
      trackKeys: tracks.map((track) => track.id),
      looseCueIds: cues.filter((cue) => isLooseCue(cue, tracks)).map((cue) => cue.id),
    });
    setFormError(null);
  }

  async function handleOpenEdit(template: ScheduleTemplate) {
    setActionError(null);
    setRenameDraft(null);
    setFormError(null);
    try {
      const fresh = (await getScheduleTemplate(template.id)) ?? template;
      const entities = templateToScheduleEntities(fresh);
      setDraft({
        kind: "edit",
        templateId: fresh.id,
        sourceTemplateId: fresh.sourceTemplateId,
        originalName: fresh.name,
        version: fresh.version,
        createdAt: fresh.createdAt,
        name: fresh.name,
        description: fresh.description,
        tracks: entities.tracks,
        cues: entities.cues,
      });
      setSelection({
        trackKeys: entities.tracks.map((track) => track.id),
        looseCueIds: entities.cues
          .filter((cue) => isLooseCue(cue, entities.tracks))
          .map((cue) => cue.id),
      });
    } catch (error) {
      setActionError(messageFromError(error));
    }
  }

  function handleToggleTrack(trackId: string) {
    setSelection((current) => ({
      ...current,
      trackKeys: current.trackKeys.includes(trackId)
        ? current.trackKeys.filter((key) => key !== trackId)
        : [...current.trackKeys, trackId],
    }));
  }

  function handleToggleLooseCue(cueId: string) {
    setSelection((current) => ({
      ...current,
      looseCueIds: current.looseCueIds.includes(cueId)
        ? current.looseCueIds.filter((id) => id !== cueId)
        : [...current.looseCueIds, cueId],
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || isSavingForm) return;
    setIsSavingForm(true);
    setFormError(null);
    try {
      const now = Date.now();
      const schedule = buildSchedule({ tracks: draft.tracks, cues: draft.cues, now });
      // Read the current names before writing so a rapid second save also suffixes.
      const currentTemplates = await getScheduleTemplates();
      const existingNames = currentTemplates
        .filter((template) => template.id !== draft.templateId)
        .map((template) => template.name);
      const built = buildTemplateFromSchedule({
        name: draft.name,
        description: draft.description,
        schedule,
        selection,
        existingNames,
        now,
      });
      if (built.tracks.length === 0 && built.cues.length === 0) {
        throw new Error("Selecciona al menos un track o un cue suelto.");
      }

      if (draft.kind === "edit") {
        const nextVersion = (draft.version ?? 1) + 1;
        await saveScheduleTemplate({
          ...built,
          id: draft.templateId ?? built.id,
          ...(draft.sourceTemplateId !== undefined
            ? { sourceTemplateId: draft.sourceTemplateId }
            : {}),
          version: nextVersion,
          createdAt: draft.createdAt ?? built.createdAt,
          updatedAt: new Date(now).toISOString(),
        });
        setAnnouncement(`Plantilla «${built.name}» actualizada a la versión ${nextVersion}.`);
      } else {
        await saveScheduleTemplate(built);
        setAnnouncement(`Plantilla «${built.name}» guardada como versión 1.`);
      }
      resetForm();
    } catch (error) {
      setFormError(messageFromError(error));
    } finally {
      setIsSavingForm(false);
    }
  }

  async function handleDuplicate(template: ScheduleTemplate) {
    setActionError(null);
    try {
      const now = Date.now();
      const currentTemplates = await getScheduleTemplates();
      const copy: ScheduleTemplate = {
        ...template,
        id: createTemplateId(),
        name: uniqueTemplateName(template.name, currentTemplates.map((item) => item.name)),
        description: template.description ?? "",
        version: 1,
        createdAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString(),
        sourceTemplateId: template.id,
        tracks: template.tracks.map((track) => ({ ...track })),
        cues: template.cues.map((cue) => ({
          ...cue,
          ...(cue.includedTypes ? { includedTypes: [...cue.includedTypes] } : {}),
        })),
      };
      await saveScheduleTemplate(copy);
      setAnnouncement(`Plantilla «${copy.name}» creada como duplicado.`);
    } catch (error) {
      setActionError(messageFromError(error));
    }
  }

  function handleOpenRename(template: ScheduleTemplate) {
    setActionError(null);
    resetForm();
    setRenameDraft({
      template,
      name: template.name,
      description: template.description,
      error: null,
      isSaving: false,
    });
  }

  async function handleRenameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!renameDraft || renameDraft.isSaving) return;
    const current = renameDraft;
    setRenameDraft({ ...current, error: null, isSaving: true });
    try {
      const [fresh, currentTemplates] = await Promise.all([
        getScheduleTemplate(current.template.id),
        getScheduleTemplates(),
      ]);
      const source = fresh ?? current.template;
      const now = Date.now();
      const updated: ScheduleTemplate = {
        ...source,
        name: uniqueTemplateName(
          current.name,
          currentTemplates
            .filter((template) => template.id !== source.id)
            .map((template) => template.name),
        ),
        description: current.description,
        version: source.version,
        createdAt: source.createdAt,
        updatedAt: new Date(now).toISOString(),
        tracks: source.tracks.map((track) => ({ ...track })),
        cues: source.cues.map((cue) => ({
          ...cue,
          ...(cue.includedTypes ? { includedTypes: [...cue.includedTypes] } : {}),
        })),
      };
      await saveScheduleTemplate(updated);
      setAnnouncement(`Plantilla «${updated.name}» renombrada; versión ${updated.version} sin cambios.`);
      setRenameDraft(null);
    } catch (error) {
      setRenameDraft({ ...current, error: messageFromError(error), isSaving: false });
    }
  }

  async function handleDelete(template: ScheduleTemplate) {
    const confirmed = window.confirm(
      `¿Eliminar la plantilla «${template.name}»? Los proyectos que la usaron no cambian.`,
    );
    if (!confirmed) return;
    setActionError(null);
    try {
      await deleteScheduleTemplate(template.id);
      setAnnouncement(`Plantilla «${template.name}» eliminada; los proyectos no han cambiado.`);
      if (draft?.templateId === template.id) resetForm();
      if (renameDraft?.template.id === template.id) setRenameDraft(null);
    } catch (error) {
      setActionError(messageFromError(error));
    }
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setIsImporting(true);
    setImportError(null);
    setImportStatus("");
    setActionError(null);
    try {
      const text = await file.text();
      const result = validateTemplateFile(text, Date.now());
      if (!result.ok) {
        // CL38: an invalid file performs no writes at all.
        setImportError(result.error);
        return;
      }

      const currentTemplates = await getScheduleTemplates();
      const name = uniqueTemplateName(
        result.template.name,
        currentTemplates.map((template) => template.name),
      );
      const imported: ScheduleTemplate = {
        ...result.template,
        id: createTemplateId(),
        name,
        version: 1,
      };
      await saveScheduleTemplate(imported);
      setTemplates(await getScheduleTemplates());

      const repairs = result.repairs.length > 0
        ? result.repairs.map((repair) => (
          `${repair.count} ${repair.count === 1 ? "vínculo reparado" : "vínculos reparados"}: ${repair.messages.join(" ")}`
        )).join(" ")
        : "No hubo vínculos huérfanos que reparar.";
      setImportStatus(`Importada la plantilla «${name}» como versión 1. ${repairs}`);
      setAnnouncement(`Plantilla «${name}» importada desde JSON como plantilla nueva.`);
    } catch (error) {
      setImportError(messageFromError(error));
    } finally {
      // Allows re-importing the same file after a fix.
      input.value = "";
      setIsImporting(false);
    }
  }

  function handleExportTemplate(template: ScheduleTemplate) {
    setExportError(null);
    setExportEnvelope(null);
    try {
      const file = buildTemplateExport({ template, kind: "template", now: Date.now() });
      downloadTemplateJson(file, template.name);
      setExportEnvelope({
        format: file.format,
        formatVersion: file.formatVersion,
        kind: file.kind,
        exportedAt: file.exportedAt,
      });
      setAnnouncement(`Plantilla «${template.name}» exportada a JSON.`);
    } catch (error) {
      setExportError(messageFromError(error));
    }
  }

  async function handleExportSchedule() {
    const production = danceProduction;
    if (!production || !canCreate || isExportingSchedule) return;
    setExportError(null);
    setExportEnvelope(null);
    setIsExportingSchedule(true);
    try {
      const now = Date.now();
      // Read-only: the exported schedule is built from fresh data, never saved back.
      const [freshTracks, freshCues] = await Promise.all([
        getDanceTracks(production.id),
        getCuesByProduction(production.id),
      ]);
      const normalized = normalizeCues(freshCues);
      const schedule = buildSchedule({ tracks: freshTracks, cues: normalized, now });
      const sourceTemplate = buildTemplateFromSchedule({
        name: production.title,
        description: `Escaleta exportada del proyecto «${production.title}».`,
        schedule,
        selection: {
          trackKeys: freshTracks.map((track) => track.id),
          looseCueIds: normalized
            .filter((cue) => isLooseCue(cue, freshTracks))
            .map((cue) => cue.id),
        },
        existingNames: [],
        now,
      });
      if (sourceTemplate.tracks.length === 0 && sourceTemplate.cues.length === 0) {
        throw new Error("El proyecto no tiene tracks ni cues para exportar.");
      }

      const file = buildTemplateExport({ template: sourceTemplate, kind: "schedule", now });
      downloadTemplateJson(file, production.title);
      setExportEnvelope({
        format: file.format,
        formatVersion: file.formatVersion,
        kind: file.kind,
        exportedAt: file.exportedAt,
      });
      setAnnouncement(`Escaleta de «${production.title}» exportada a JSON; se importa como plantilla.`);
    } catch (error) {
      setExportError(messageFromError(error));
    } finally {
      setIsExportingSchedule(false);
    }
  }

  return (
    <div className="space-y-5">
      <span className="sr-only" role="status" aria-live="polite">{announcement}</span>

      <Card className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-slate-100">Plantillas de escaleta</h2>
            <p className="text-xs text-slate-400">
              Biblioteca global: no necesita un proyecto seleccionado y nunca modifica proyectos.
            </p>
          </div>
          <div className="space-y-1">
            {canCreate ? (
              <Button
                type="button"
                onClick={handleOpenCreate}
                className="min-h-10 border-cyan-700 bg-cyan-950/50 text-cyan-100 hover:bg-cyan-900/50 focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                Guardar escaleta como plantilla
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  disabled
                  aria-describedby="template-create-reason"
                  className="min-h-10 focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  Guardar escaleta como plantilla
                </Button>
                <p id="template-create-reason" className="text-[11px] text-amber-300">
                  {danceProductionId
                    ? "Cargando la escaleta del proyecto de danza…"
                    : "Selecciona un proyecto de danza para guardar su escaleta como plantilla."}
                </p>
              </>
            )}
          </div>
        </div>

        {actionError && (
          <p role="alert" className="rounded-lg border border-amber-700/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
            {actionError}
          </p>
        )}

        {draft && (
          <Card className="border-slate-700 bg-slate-950/80">
            <TemplateForm
              formId={draft.templateId ?? "new"}
              title={draft.kind === "edit" ? "Editar contenido de la plantilla" : "Nueva plantilla desde la escaleta"}
              submitLabel={draft.kind === "edit" ? "Guardar nueva versión" : "Guardar plantilla"}
              name={draft.name}
              description={draft.description}
              tracks={draft.tracks}
              cues={draft.cues}
              selection={selection}
              isSaving={isSavingForm}
              error={formError}
              onNameChange={(value) => setDraft((current) => current ? { ...current, name: value } : current)}
              onDescriptionChange={(value) => setDraft((current) => current ? { ...current, description: value } : current)}
              onToggleTrack={handleToggleTrack}
              onToggleLooseCue={handleToggleLooseCue}
              onSubmit={(event) => void handleSubmit(event)}
              onCancel={resetForm}
            />
          </Card>
        )}

        {renameDraft && (
          <Card className="border-slate-700 bg-slate-950/80">
            <form onSubmit={(event) => void handleRenameSubmit(event)} className="space-y-3">
              <h3 className="text-base font-semibold text-slate-100">
                Renombrar / describir «{renameDraft.template.name}»
              </h3>
              <p className="text-xs text-slate-400">
                El contenido y la versión no cambian.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor={`rename-name-${renameDraft.template.id}`} className="block text-xs font-medium text-slate-300">
                    Nombre <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id={`rename-name-${renameDraft.template.id}`}
                    type="text"
                    required
                    value={renameDraft.name}
                    onChange={(event) => setRenameDraft((current) => current ? { ...current, name: event.target.value } : current)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-2.5 py-2 text-sm text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor={`rename-description-${renameDraft.template.id}`} className="block text-xs font-medium text-slate-300">
                    Descripción (opcional)
                  </label>
                  <input
                    id={`rename-description-${renameDraft.template.id}`}
                    type="text"
                    value={renameDraft.description}
                    onChange={(event) => setRenameDraft((current) => current ? { ...current, description: event.target.value } : current)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-2.5 py-2 text-sm text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                  />
                </div>
              </div>
              {renameDraft.error && (
                <p role="alert" className="rounded-lg border border-amber-700/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
                  {renameDraft.error}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  disabled={renameDraft.isSaving}
                  className="min-h-10 border-cyan-700 bg-cyan-950/50 text-cyan-100 hover:bg-cyan-900/50 focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  {renameDraft.isSaving ? "Guardando…" : "Guardar cambios"}
                </Button>
                <Button
                  type="button"
                  onClick={() => setRenameDraft(null)}
                  disabled={renameDraft.isSaving}
                  className="min-h-10 focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </Card>
        )}
      </Card>

      <Card className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-100">Importar / exportar JSON</h2>
          <p className="text-xs text-slate-400">
            Los archivos se importan siempre como plantillas nuevas; nunca crean proyectos ni
            modifican los existentes.
          </p>
          <p className="text-[11px] text-slate-500">
            Sobre JSON: <code>format</code> «{TEMPLATE_JSON_FORMAT}» · <code>formatVersion</code>{" "}
            {TEMPLATE_JSON_VERSION} · <code>kind</code> «template» (plantilla) o «schedule»
            (escaleta de proyecto, importable como plantilla).
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <label htmlFor="template-json-file" className="block text-xs font-medium text-slate-300">
              Importar archivo JSON
            </label>
            <input
              id="template-json-file"
              type="file"
              accept=".json,application/json"
              onChange={(event) => void handleImportFile(event)}
              disabled={isImporting}
              className="block max-w-full text-xs text-slate-300 file:mr-3 file:min-h-10 file:rounded-md file:border file:border-slate-600 file:bg-slate-900 file:px-3 file:py-2 file:text-xs file:font-medium file:text-slate-100 file:hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 disabled:opacity-50"
            />
          </div>
          <div className="space-y-1">
            {canCreate ? (
              <Button
                type="button"
                onClick={() => void handleExportSchedule()}
                disabled={isExportingSchedule}
                className="min-h-10 border-cyan-700 bg-cyan-950/50 text-cyan-100 hover:bg-cyan-900/50 focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                {isExportingSchedule ? "Exportando…" : "Exportar escaleta del proyecto"}
              </Button>
            ) : (
              <Button
                type="button"
                disabled
                aria-describedby="template-schedule-export-reason"
                className="min-h-10 focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                Exportar escaleta del proyecto
              </Button>
            )}
            <p id="template-schedule-export-reason" className="text-[11px] text-slate-500">
              {canCreate
                ? "Solo lectura: incluye todos los tracks, cues sueltos y vínculos; no modifica el proyecto."
                : danceProductionId
                  ? "Cargando la escaleta del proyecto de danza…"
                  : "Selecciona un proyecto de danza para exportar su escaleta."}
            </p>
          </div>
        </div>

        {importError && (
          <p role="alert" className="rounded-lg border border-amber-700/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
            {importError}
          </p>
        )}
        {exportError && (
          <p role="alert" className="rounded-lg border border-amber-700/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
            {exportError}
          </p>
        )}
        {importStatus && (
          <p role="status" className="rounded-lg border border-cyan-800/60 bg-cyan-950/30 px-3 py-2 text-xs text-cyan-100">
            {importStatus}
          </p>
        )}
        {exportEnvelope && (
          <p role="status" className="rounded-lg border border-cyan-800/60 bg-cyan-950/30 px-3 py-2 text-xs text-cyan-100">
            JSON exportado: format «{exportEnvelope.format}» · formatVersion{" "}
            {exportEnvelope.formatVersion} · kind «{exportEnvelope.kind}» · exportedAt{" "}
            {exportEnvelope.exportedAt}.
          </p>
        )}
      </Card>

      {isLoadingTemplates && (
        <p role="status" className="text-sm text-slate-300">Cargando plantillas…</p>
      )}
      {!isLoadingTemplates && templatesError && (
        <p role="alert" className="text-sm text-amber-300">No se pudieron cargar las plantillas.</p>
      )}
      {!isLoadingTemplates && !templatesError && templates.length === 0 && (
        <Card>
          <p className="text-sm text-slate-300">
            Todavía no hay plantillas. Guarda una escaleta para empezar.
          </p>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => (
          <Card key={template.id} className="flex flex-col gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="break-words text-base font-semibold text-slate-100">{template.name}</h3>
                <span className="rounded-full border border-cyan-800 bg-cyan-950/40 px-2 py-0.5 text-xs text-cyan-200">
                  v{template.version}
                </span>
              </div>
              <p className="break-words text-xs text-slate-400">
                {template.description || "Sin descripción"}
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-slate-500">Tracks</dt>
                <dd className="font-mono text-slate-200">{template.tracks.length}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Cues</dt>
                <dd className="font-mono text-slate-200">{template.cues.length}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-slate-500">Creada</dt>
                <dd className="text-slate-300">{formatDate(template.createdAt)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-slate-500">Actualizada</dt>
                <dd className="text-slate-300">{formatDate(template.updatedAt)}</dd>
              </div>
            </dl>

            {template.sourceTemplateId && (
              <p className="text-[11px] text-slate-500">Duplicado de otra plantilla.</p>
            )}

            <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-3">
              <Button
                type="button"
                onClick={() => void handleOpenEdit(template)}
                aria-label={`Editar contenido de ${template.name}`}
                className="min-h-10 border-cyan-700 bg-cyan-950/40 text-cyan-100 hover:bg-cyan-900/40 focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                Editar contenido
              </Button>
              <Button
                type="button"
                onClick={() => handleOpenRename(template)}
                aria-label={`Renombrar o describir ${template.name}`}
                className="min-h-10 focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                Renombrar/describir
              </Button>
              <Button
                type="button"
                onClick={() => void handleDuplicate(template)}
                aria-label={`Duplicar ${template.name}`}
                className="min-h-10 focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                Duplicar
              </Button>
              <Button
                type="button"
                onClick={() => handleExportTemplate(template)}
                aria-label={`Exportar ${template.name} a JSON`}
                className="min-h-10 focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                Exportar JSON
              </Button>
              <Button
                type="button"
                onClick={() => void handleDelete(template)}
                aria-label={`Eliminar ${template.name}`}
                className="min-h-10 border-amber-800 text-amber-200 hover:bg-amber-950/40 focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                Eliminar
              </Button>
            </div>
            <p className="text-[11px] text-slate-500">
              JSON: <code>format</code> «{TEMPLATE_JSON_FORMAT}» · <code>formatVersion</code>{" "}
              {TEMPLATE_JSON_VERSION} · <code>kind</code> «template»
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
