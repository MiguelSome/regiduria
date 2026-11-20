import { scheduleTemplateSchema, templateFileSchema } from "@/lib/schemas";
import type {
  Cue,
  CueTiming,
  DanceTrack,
  Schedule,
  ScheduleTemplate,
  ScheduleTemplateCue,
  ScheduleTemplateTrack,
  TemplateFile,
  TemplateOrigin,
} from "@/lib/types";

/** Whole tracks (with every linked cue) plus loose, untimed cues (D17). */
export interface TemplateSelection {
  trackKeys: string[];
  looseCueIds: string[];
}

/** Non-blocking repairs reported when importing a JSON file (CL39). */
export interface RepairNotice {
  count: number;
  messages: string[];
}

interface BuildTemplateFromScheduleInput {
  name: string;
  description: string;
  schedule: Schedule;
  selection: TemplateSelection;
  existingNames: string[];
  now: number;
}

interface BuildTemplateExportInput {
  template: ScheduleTemplate;
  kind: "template" | "schedule";
  now: number;
}

interface ApplyTemplateToProjectInput {
  template: ScheduleTemplate;
  productionId: string;
  now: number;
}

const DEFAULT_ALERT_BEFORE_MS = 10_000;

function requireNow(now: number): void {
  if (!Number.isFinite(now)) {
    throw new Error("El instante «now» de la plantilla no es válido.");
  }
}

function isoNow(now: number): string {
  requireNow(now);
  return new Date(now).toISOString();
}

/** Fresh id with a fallback for environments without `crypto.randomUUID`. */
function createId(now: number): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    try {
      return globalThis.crypto.randomUUID();
    } catch {
      // Fall through to the deterministic-seeded fallback.
    }
  }
  return `tpl-${new Date(now).getTime().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function firstIssue(error: unknown): string {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues?: Array<{ message?: string; path?: Array<string | number> }> }).issues;
    const issue = issues?.[0];
    if (issue?.message) {
      const path = issue.path?.join(".");
      return path ? `${issue.message} (${path})` : issue.message;
    }
  }
  return error instanceof Error ? error.message : "No se pudo validar la plantilla.";
}

/** Adds " (2)", " (3)"… so an existing template is never overwritten (CL40). */
export function uniqueTemplateName(name: string, existingNames: string[]): string {
  const base = name.trim();
  if (!base) {
    throw new Error("El nombre de la plantilla no puede estar vacío.");
  }
  const used = new Set(existingNames.map((existing) => existing.trim().toLowerCase()));
  if (!used.has(base.toLowerCase())) return base;

  let suffix = 2;
  while (used.has(`${base} (${suffix})`.toLowerCase())) suffix += 1;
  return `${base} (${suffix})`;
}

/**
 * Builds a portable template. A cue linked to a track can only be selected by
 * selecting that track; the derived `atMs` of linked cues is never stored.
 */
export function buildTemplateFromSchedule({
  name,
  description,
  schedule,
  selection,
  existingNames,
  now,
}: BuildTemplateFromScheduleInput): ScheduleTemplate {
  requireNow(now);
  const templateName = uniqueTemplateName(name, existingNames);
  const selectedTrackIds = new Set(selection.trackKeys);
  const selectedLooseIds = new Set(selection.looseCueIds);
  const trackById = new Map(schedule.tracks.map(({ track }) => [track.id, track]));
  const trackKeys = new Map<string, string>();

  for (const trackId of selectedTrackIds) {
    if (!trackById.has(trackId)) {
      throw new Error(`El track seleccionado «${trackId}» no existe en la escaleta.`);
    }
  }

  const tracks: ScheduleTemplateTrack[] = [];
  for (const { track } of schedule.tracks) {
    if (!selectedTrackIds.has(track.id)) continue;
    const key = `t${tracks.length + 1}`;
    trackKeys.set(track.id, key);
    tracks.push({
      key,
      title: track.title.trim() || "Sin título",
      ...(track.durationMs !== undefined ? { durationMs: track.durationMs } : {}),
      order: track.order,
      ...(track.startAtMs !== undefined ? { startAtMs: track.startAtMs } : {}),
      notes: track.notes ?? "",
    });
  }

  const seenCueIds = new Set<string>();
  const includedCues: Cue[] = [];
  for (const cue of [...schedule.timedCues, ...schedule.untimedCues]) {
    if (seenCueIds.has(cue.id)) continue;
    seenCueIds.add(cue.id);

    const linkedTrackId = cue.timing?.trackId;
    const linkedTrackExists = linkedTrackId !== undefined && trackById.has(linkedTrackId);
    if (selectedLooseIds.has(cue.id) && linkedTrackExists && !selectedTrackIds.has(linkedTrackId!)) {
      const title = trackById.get(linkedTrackId!)?.title ?? linkedTrackId;
      throw new Error(
        `El cue «${cue.identifier}» pertenece al track «${title}». Selecciona ese track para incluir sus cues.`,
      );
    }
    if (linkedTrackId !== undefined && trackKeys.has(linkedTrackId)) {
      includedCues.push(cue);
    } else if (selectedLooseIds.has(cue.id)) {
      includedCues.push(cue);
    }
  }

  const cues: ScheduleTemplateCue[] = includedCues.map((cue) => {
    if (cue.type === "SIM" && (cue.includedTypes?.length ?? 0) < 2) {
      throw new Error(`El cue simultáneo «${cue.identifier}» necesita al menos dos tipos.`);
    }

    const timing = cue.timing;
    const key = timing?.trackId !== undefined ? trackKeys.get(timing.trackId) : undefined;
    if (key && timing?.trackOffsetMs !== undefined) {
      const track = trackById.get(timing.trackId!);
      const duration = track?.durationMs;
      if (duration === undefined || !Number.isFinite(duration) || duration <= 0) {
        throw new Error(
          `El track «${track?.title ?? timing.trackId}» no tiene duración; no se puede guardar el objetivo del cue «${cue.identifier}».`,
        );
      }
      if (timing.trackOffsetMs > duration) {
        throw new Error(
          `El objetivo del cue «${cue.identifier}» supera la duración del track «${track?.title ?? timing.trackId}».`,
        );
      }
    }

    const alertBeforeMs = timing?.alertBeforeMs ?? DEFAULT_ALERT_BEFORE_MS;
    if (!Number.isInteger(alertBeforeMs) || alertBeforeMs < 1_000 || alertBeforeMs > 60_000) {
      throw new Error(`El umbral de aviso del cue «${cue.identifier}» debe estar entre 1000 y 60000 ms.`);
    }

    const base: ScheduleTemplateCue = {
      identifier: cue.identifier.trim() || "Cue",
      type: cue.type,
      ...(cue.includedTypes && cue.includedTypes.length > 0
        ? { includedTypes: [...cue.includedTypes] }
        : {}),
      description: cue.description.trim() || cue.identifier.trim() || "Cue",
      ...(cue.pie !== undefined ? { pie: cue.pie } : {}),
      observations: cue.observations ?? "",
      department: cue.department ?? "Regiduría",
      act: cue.act ?? "Acto I",
      scene: cue.scene ?? "1",
      status: "Borrador",
      executionState: "Preparación",
      alertBeforeMs,
    };

    if (key && timing?.trackOffsetMs !== undefined) {
      return { ...base, trackKey: key, trackOffsetMs: timing.trackOffsetMs };
    }
    if (timing?.atMs !== undefined) {
      return { ...base, atMs: timing.atMs };
    }
    return base;
  });

  const template: ScheduleTemplate = {
    id: createId(now),
    name: templateName,
    description: description ?? "",
    version: 1,
    createdAt: isoNow(now),
    updatedAt: isoNow(now),
    tracks,
    cues,
  };

  try {
    return scheduleTemplateSchema.parse(template) as ScheduleTemplate;
  } catch (error) {
    throw new Error(`La plantilla no es válida: ${firstIssue(error)}`);
  }
}

/**
 * Validates an imported envelope without touching Dexie. Orphan `trackKey`s
 * are repaired instead of rejected (CL39); anything else invalid is an error.
 */
export function validateTemplateFile(input: unknown, now: number):
  | { ok: true; template: ScheduleTemplate; repairs: RepairNotice[] }
  | { ok: false; error: string } {
  requireNow(now);

  let candidate: unknown = input;
  if (typeof input === "string") {
    try {
      candidate = JSON.parse(input);
    } catch {
      return { ok: false, error: "El archivo no contiene JSON válido." };
    }
  }

  const parsed = templateFileSchema.safeParse(candidate);
  if (!parsed.success) {
    return { ok: false, error: `El archivo de plantilla no es válido: ${firstIssue(parsed.error)}` };
  }

  const file = parsed.data;
  const seenKeys = new Set<string>();
  for (const track of file.template.tracks) {
    if (seenKeys.has(track.key)) {
      return { ok: false, error: `La clave de track «${track.key}» está repetida en la plantilla.` };
    }
    seenKeys.add(track.key);
  }

  const repairs: RepairNotice = { count: 0, messages: [] };
  const cues: ScheduleTemplateCue[] = [];
  for (const cue of file.template.cues) {
    if (cue.type === "SIM" && (cue.includedTypes?.length ?? 0) < 2) {
      return { ok: false, error: "Un cue simultáneo necesita al menos dos tipos." };
    }

    const base: ScheduleTemplateCue = {
      identifier: cue.identifier,
      type: cue.type,
      ...(cue.includedTypes !== undefined ? { includedTypes: [...cue.includedTypes] } : {}),
      description: cue.description,
      ...(cue.pie !== undefined ? { pie: cue.pie } : {}),
      observations: cue.observations,
      department: cue.department,
      act: cue.act,
      scene: cue.scene,
      status: cue.status,
      executionState: cue.executionState,
      alertBeforeMs: cue.alertBeforeMs,
    };

    if (cue.trackKey !== undefined) {
      const track = file.template.tracks.find((candidateTrack) => candidateTrack.key === cue.trackKey);
      if (!track) {
        repairs.count += 1;
        repairs.messages.push(
          `El cue «${cue.identifier}» apuntaba al track «${cue.trackKey}», que no existe; se ha desvinculado${
            cue.atMs !== undefined ? " conservando su tiempo absoluto." : " y ha quedado sin tiempo."
          }`,
        );
        cues.push(cue.atMs !== undefined ? { ...base, atMs: cue.atMs } : base);
        continue;
      }
      if (cue.trackOffsetMs !== undefined) {
        if (track.durationMs === undefined) {
          return {
            ok: false,
            error: `El track «${track.title}» no tiene duración; no se puede validar el objetivo del cue «${cue.identifier}».`,
          };
        }
        if (cue.trackOffsetMs > track.durationMs) {
          return {
            ok: false,
            error: `El objetivo del cue «${cue.identifier}» supera la duración del track «${track.title}».`,
          };
        }
        cues.push({ ...base, trackKey: track.key, trackOffsetMs: cue.trackOffsetMs });
        continue;
      }
    }
    cues.push(cue.atMs !== undefined ? { ...base, atMs: cue.atMs } : base);
  }

  const template: ScheduleTemplate = {
    id: createId(now),
    name: file.template.name,
    description: file.template.description,
    version: 1,
    createdAt: isoNow(now),
    updatedAt: isoNow(now),
    tracks: file.template.tracks.map((track) => ({
      key: track.key,
      title: track.title,
      ...(track.durationMs !== undefined ? { durationMs: track.durationMs } : {}),
      order: track.order,
      ...(track.startAtMs !== undefined ? { startAtMs: track.startAtMs } : {}),
      notes: track.notes,
    })),
    cues,
  };

  try {
    return {
      ok: true,
      template: scheduleTemplateSchema.parse(template) as ScheduleTemplate,
      repairs: repairs.count > 0 ? [repairs] : [],
    };
  } catch (error) {
    return { ok: false, error: `La plantilla importada no es válida: ${firstIssue(error)}` };
  }
}

/** Builds the JSON envelope; no production or cue ids travel in it. */
export function buildTemplateExport({ template, kind, now }: BuildTemplateExportInput): TemplateFile {
  requireNow(now);
  let validated: ScheduleTemplate;
  try {
    validated = scheduleTemplateSchema.parse(template) as ScheduleTemplate;
  } catch (error) {
    throw new Error(`La plantilla no se puede exportar: ${firstIssue(error)}`);
  }

  const portableTemplate: ScheduleTemplate = {
    id: validated.id,
    name: validated.name,
    description: validated.description,
    version: validated.version,
    createdAt: validated.createdAt,
    updatedAt: validated.updatedAt,
    tracks: validated.tracks.map((track) => ({
      key: track.key,
      title: track.title,
      ...(track.durationMs !== undefined ? { durationMs: track.durationMs } : {}),
      order: track.order,
      ...(track.startAtMs !== undefined ? { startAtMs: track.startAtMs } : {}),
      notes: track.notes,
    })),
    cues: validated.cues.map((cue) => ({
      identifier: cue.identifier,
      type: cue.type,
      ...(cue.includedTypes !== undefined ? { includedTypes: [...cue.includedTypes] } : {}),
      description: cue.description,
      ...(cue.pie !== undefined ? { pie: cue.pie } : {}),
      observations: cue.observations,
      department: cue.department,
      act: cue.act,
      scene: cue.scene,
      status: cue.status,
      executionState: cue.executionState,
      ...(cue.trackKey !== undefined ? { trackKey: cue.trackKey } : {}),
      ...(cue.trackOffsetMs !== undefined ? { trackOffsetMs: cue.trackOffsetMs } : {}),
      ...(cue.atMs !== undefined ? { atMs: cue.atMs } : {}),
      alertBeforeMs: cue.alertBeforeMs,
    })),
  };

  const file: TemplateFile = {
    format: "regiduria.schedule-template",
    formatVersion: 1,
    kind,
    exportedAt: isoNow(now),
    template: portableTemplate,
  };

  const checked = templateFileSchema.safeParse(file);
  if (!checked.success) {
    throw new Error(`No se pudo exportar la plantilla: ${firstIssue(checked.error)}`);
  }
  return file;
}

/** Copies a template into an empty project with fresh ids and a fixed origin. */
export function applyTemplateToProject({
  template,
  productionId,
  now,
}: ApplyTemplateToProjectInput): { tracks: DanceTrack[]; cues: Cue[]; templateOrigin: TemplateOrigin } {
  requireNow(now);
  let validated: ScheduleTemplate;
  try {
    validated = scheduleTemplateSchema.parse(template) as ScheduleTemplate;
  } catch (error) {
    throw new Error(`La plantilla no se puede aplicar: ${firstIssue(error)}`);
  }

  const idsByKey = new Map<string, string>();
  for (const track of validated.tracks) {
    idsByKey.set(track.key, createId(now));
  }

  const tracks: DanceTrack[] = validated.tracks.map((track) => ({
    id: idsByKey.get(track.key)!,
    productionId,
    title: track.title,
    ...(track.durationMs !== undefined ? { durationMs: track.durationMs } : {}),
    order: track.order,
    ...(track.startAtMs !== undefined ? { startAtMs: track.startAtMs } : {}),
    notes: track.notes,
  }));

  const cues: Cue[] = validated.cues.map((cue) => {
    const trackId = cue.trackKey !== undefined ? idsByKey.get(cue.trackKey) : undefined;
    const timing: CueTiming = { alertBeforeMs: cue.alertBeforeMs };
    if (trackId !== undefined && cue.trackOffsetMs !== undefined) {
      timing.trackId = trackId;
      timing.trackOffsetMs = cue.trackOffsetMs;
    } else if (cue.atMs !== undefined) {
      timing.atMs = cue.atMs;
    }
    return {
      id: createId(now),
      productionId,
      identifier: cue.identifier,
      type: cue.type,
      ...(cue.includedTypes !== undefined ? { includedTypes: [...cue.includedTypes] } : {}),
      description: cue.description,
      ...(cue.pie !== undefined ? { pie: cue.pie } : {}),
      act: cue.act,
      scene: cue.scene,
      department: cue.department,
      observations: cue.observations,
      status: cue.status,
      executionState: cue.executionState,
      timing,
    };
  });

  return {
    tracks,
    cues,
    templateOrigin: {
      templateId: validated.id ?? template.id ?? createId(now),
      name: validated.name,
      version: validated.version,
    },
  };
}
