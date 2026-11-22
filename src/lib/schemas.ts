import { z } from "zod";

import { CUE_COMPONENT_TYPES, CUE_TYPES, DEPARTMENT_NAMES } from "@/lib/types";

// Enum schemas built from the single source of truth in "@/lib/types".
const departmentNameSchema = z.enum(DEPARTMENT_NAMES);
const cueTypeSchema = z.enum(CUE_TYPES);
const cueComponentTypeSchema = z.enum(CUE_COMPONENT_TYPES);

export const departmentSchema = z.object({
  id: z.string(),
  name: departmentNameSchema,
  responsable: z.string(),
  notes: z.array(z.string()),
});

const projectTeamSchema = z.object({
  technical: z.array(z.object({
    department: departmentNameSchema,
    head: z.string(),
    technicians: z.array(z.object({
      id: z.string(),
      name: z.string(),
      tag: z.string(),
    })),
  })),
  artistic: z.array(z.object({
    id: z.string(),
    name: z.string(),
    role: z.string(),
    character: z.string().optional(),
  })),
});

const templateOriginSchema = z.object({
  templateId: z.string().min(1),
  name: z.string().min(1),
  version: z.number().int().positive(),
});

const cueTimingSchema = z.object({
  trackId: z.string().optional(),
  trackOffsetMs: z.number().int().min(0).optional(),
  atMs: z.number().int().min(0).max(86_400_000).optional(),
  alertBeforeMs: z.number().int().min(1_000).max(60_000).optional(),
  startsTrackId: z.string().optional(),
});

export const productionSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  subtitle: z.string(),
  venue: z.string(),
  status: z.enum(["Activa", "Archivada"]),
  syncStatus: z.enum(["Sincronizado", "Pendiente", "Conflicto"]),
  lastUpdated: z.string(),
  summary: z.string(),
  departments: z.array(departmentSchema),
  team: projectTeamSchema.optional(),
  mode: z.enum(["standard", "dance"]).optional(),
  templateOrigin: templateOriginSchema.optional(),
  scenes: z.array(
    z.object({
      id: z.string(),
      act: z.string(),
      number: z.string(),
      title: z.string(),
      summary: z.string(),
    }),
  ),
});

export const cueSchema = z.object({
  id: z.string(),
  productionId: z.string(),
  identifier: z.string().min(1),
  type: cueTypeSchema,
  includedTypes: z
    .array(cueComponentTypeSchema)
    .optional(),
  timing: cueTimingSchema.optional(),
  description: z.string().min(1),
  pie: z.string().trim().optional(),
  act: z.string(),
  scene: z.string(),
  department: departmentNameSchema,
  observations: z.string(),
  status: z.enum(["Borrador", "Preparado", "Ejecutado", "Pendiente"]),
  executionState: z.enum(["Preparación", "Función"]),
  order: z.number({ error: "El orden del cue debe ser un número." })
    .int({ error: "El orden del cue debe ser un número entero." })
    .optional(),
  scriptDocumentId: z.string().optional(),
  scriptLabelId: z.string().optional(),
}).refine((cue) => cue.type !== "SIM" || (cue.includedTypes?.length ?? 0) >= 2, {
  message: "Un cue simultáneo debe incluir al menos dos tipos.",
  path: ["includedTypes"],
});

export const scriptLabelSchema = z
  .object({
    documentId: z.string().min(1),
    productionId: z.string().min(1),
    category: z.enum(["act", "scene", "cue"]),
    title: z.string().trim().min(1),
    pie: z.string().trim().optional(),
    page: z.number().int().positive(),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    cueType: cueTypeSchema.optional(),
    cueIdentifierOverride: z.string().trim().min(1).optional(),
    includedTypes: z
      .array(cueComponentTypeSchema)
      .optional(),
  })
  .superRefine((label, context) => {
    if (label.category === "cue" && !label.cueType) {
      context.addIssue({
        code: "custom",
        message: "Selecciona el tipo de cue.",
        path: ["cueType"],
      });
    }

    if (label.category === "cue" && label.cueType === "SIM" && (label.includedTypes?.length ?? 0) < 2) {
      context.addIssue({
        code: "custom",
        message: "Un cue simultáneo debe incluir al menos dos tipos.",
        path: ["includedTypes"],
      });
    }

    if (label.category === "cue" && label.cueIdentifierOverride) {
      const prefix = label.cueType === "PREVENIR" ? "PREV" : label.cueType;
      const escapedPrefix = prefix?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (!prefix || !new RegExp(`^${escapedPrefix}-\\d+(?:\\.\\d+)?$`, "i").test(label.cueIdentifierOverride)) {
        context.addIssue({
          code: "custom",
          message: "El identificador debe usar un número entero o decimal, como LX-5.5.",
          path: ["cueIdentifierOverride"],
        });
      }
    }
  });

export const incidentSchema = z.object({
  id: z.string(),
  productionId: z.string(),
  title: z.string().min(1),
  description: z.string().min(1),
  date: z.string(),
  createdAt: z.string().optional(),
  departments: z.array(departmentNameSchema).optional(),
  status: z.enum(["Abierta", "Seguimiento", "Cerrada"]),
});

const performanceBreakSchema = z.object({
  startedAt: z.string(),
  endedAt: z.string().optional(),
  durationMs: z.number(),
});

const performanceQuickIncidentSchema = z.object({
  id: z.string(),
  occurredAt: z.string(),
  elapsedMs: z.number(),
  elapsedMinutes: z.number(),
  description: z.string(),
});

const cueLaunchEventSchema = z.object({
  id: z.string(),
  cueId: z.string(),
  cueIdentifier: z.string(),
  cueDescription: z.string(),
  cuePie: z.string().optional(),
  cueObservations: z.string().optional(),
  launchedAt: z.string(),
  elapsedMs: z.number(),
  showOffsetMs: z.number().optional(),
  trackId: z.string().optional(),
  trackStartAt: z.string().optional(),
  targetOffsetMs: z.number().optional(),
  actualOffsetMs: z.number().optional(),
  deviationMs: z.number().optional(),
});

const trackRunSchema = z.object({
  trackId: z.string(),
  title: z.string(),
  startedAt: z.string(),
  endedAt: z.string(),
  actualElapsedMs: z.number(),
  endedBy: z.enum(["duration", "manual"]),
});

const performanceRunReportSchema = z.object({
  startedAt: z.string(),
  endedAt: z.string().optional(),
  durationMs: z.number(),
  launchedCueCount: z.number(),
  breaks: z.array(performanceBreakSchema),
  quickIncidents: z.array(performanceQuickIncidentSchema),
  timerStartedAt: z.string().optional(),
  mode: z.literal("show").optional(),
  cueLaunches: z.array(cueLaunchEventSchema).optional(),
  trackRuns: z.array(trackRunSchema).optional(),
});

export const performanceSchema = z.object({
  id: z.string(),
  productionId: z.string(),
  title: z.string(),
  date: z.string(),
  time: z.string(),
  prepared: z.number(),
  total: z.number(),
  notes: z.array(z.string()),
  runReport: performanceRunReportSchema.optional(),
});

// Dance tracks, templates and preferences (spec 002 §4.2, §4.4, §4.6).
// Messages are Spanish; unknown keys are kept so future fields survive a write.
const nonEmptyText = (message: string) => z.string().trim().min(1, { error: message });

/** The JSON contract uses `null` for absent optional values (spec 002 §RF30). */
const nullAsUndefined = (value: unknown) => (value === null ? undefined : value);

const isoDateSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  error: "La fecha debe ser una cadena ISO válida.",
});

const cueStatusSchema = z.enum(["Borrador", "Preparado", "Ejecutado", "Pendiente"]);
const cueExecutionStateSchema = z.enum(["Preparación", "Función"]);

export const danceTrackSchema = z.object({
  id: nonEmptyText("El identificador del track es obligatorio."),
  productionId: nonEmptyText("La producción del track es obligatoria."),
  title: nonEmptyText("El título del track no puede estar vacío."),
  durationMs: z.preprocess(nullAsUndefined, z.number({ error: "La duración del track debe ser un número." })
    .int({ error: "La duración del track debe ser un número entero." })
    .positive({ error: "La duración del track debe ser mayor que 0." })
    .optional()),
  order: z.number({ error: "El orden del track debe ser un número." })
    .int({ error: "El orden del track debe ser un número entero." }),
  startAtMs: z.preprocess(nullAsUndefined, z.number({ error: "El inicio del track debe ser un número." })
    .int({ error: "El inicio del track debe ser un número entero." })
    .min(0, { error: "El inicio del track no puede ser negativo." })
    .max(86_400_000, { error: "El inicio del track no puede superar 24 horas." })
    .optional()),
  notes: z.string({ error: "Las notas del track deben ser texto." }),
}).passthrough();

export const scheduleTemplateTrackSchema = z.object({
  key: nonEmptyText("La clave del track de la plantilla es obligatoria."),
  title: nonEmptyText("El título del track no puede estar vacío."),
  durationMs: z.preprocess(nullAsUndefined, z.number({ error: "La duración del track debe ser un número." })
    .int({ error: "La duración del track debe ser un número entero." })
    .positive({ error: "La duración del track debe ser mayor que 0." })
    .optional()),
  order: z.number({ error: "El orden del track debe ser un número." })
    .int({ error: "El orden del track debe ser un número entero." }),
  startAtMs: z.preprocess(nullAsUndefined, z.number({ error: "El inicio del track debe ser un número." })
    .int({ error: "El inicio del track debe ser un número entero." })
    .min(0, { error: "El inicio del track no puede ser negativo." })
    .max(86_400_000, { error: "El inicio del track no puede superar 24 horas." })
    .optional()),
  notes: z.string({ error: "Las notas del track deben ser texto." }),
}).passthrough();

export const scheduleTemplateCueSchema = z.object({
  identifier: nonEmptyText("El identificador del cue no puede estar vacío."),
  type: cueTypeSchema,
  includedTypes: z.preprocess(nullAsUndefined, z.array(cueComponentTypeSchema).optional()),
  description: z.preprocess(
    nullAsUndefined,
    nonEmptyText("La descripción del cue no puede estar vacía.").default("Cue"),
  ),
  pie: z.preprocess(nullAsUndefined, z.string().optional()),
  observations: z.string({ error: "Las observaciones deben ser texto." }).default(""),
  department: departmentNameSchema.default("Regiduría"),
  act: z.string({ error: "El acto debe ser texto." }).default("Acto I"),
  scene: z.string({ error: "La escena debe ser texto." }).default("1"),
  status: cueStatusSchema.default("Borrador"),
  executionState: cueExecutionStateSchema.default("Preparación"),
  trackKey: z.preprocess(
    nullAsUndefined,
    z.string().min(1, { error: "La clave de track no puede estar vacía." }).optional(),
  ),
  startsTrackKey: z.preprocess(
    nullAsUndefined,
    z.string().min(1, { error: "La clave del track iniciado no puede estar vacía." }).optional(),
  ),
  trackOffsetMs: z.preprocess(nullAsUndefined, z.number({ error: "El objetivo del cue debe ser un número." })
    .int({ error: "El objetivo del cue debe ser un número entero." })
    .min(0, { error: "El objetivo del cue no puede ser negativo." })
    .optional()),
  atMs: z.preprocess(nullAsUndefined, z.number({ error: "El tiempo del cue debe ser un número." })
    .int({ error: "El tiempo del cue debe ser un número entero." })
    .min(0, { error: "El tiempo del cue no puede ser negativo." })
    .max(86_400_000, { error: "El tiempo del cue no puede superar 24 horas." })
    .optional()),
  alertBeforeMs: z.number({ error: "El umbral de aviso debe ser un número." })
    .int({ error: "El umbral de aviso debe ser un número entero." })
    .min(1_000, { error: "El umbral de aviso debe ser al menos 1000 ms." })
    .max(60_000, { error: "El umbral de aviso no puede superar 60000 ms." })
    .default(10_000),
  order: z.preprocess(nullAsUndefined, z.number({ error: "El orden del cue debe ser un número." })
    .int({ error: "El orden del cue debe ser un número entero." })
    .optional()),
}).passthrough().refine(
  (cue) => cue.type !== "SIM" || (cue.includedTypes?.length ?? 0) >= 2,
  {
    error: "Un cue simultáneo necesita al menos dos tipos.",
    path: ["includedTypes"],
  },
);

export const scheduleTemplateSchema = z.object({
  id: z.string().min(1, { error: "El identificador de la plantilla es obligatorio." }).optional(),
  name: nonEmptyText("El nombre de la plantilla no puede estar vacío."),
  description: z.preprocess(
    nullAsUndefined,
    z.string({ error: "La descripción de la plantilla debe ser texto." }).default(""),
  ),
  version: z.number({ error: "La versión de la plantilla debe ser un número." })
    .int({ error: "La versión de la plantilla debe ser un número entero." })
    .positive({ error: "La versión de la plantilla debe ser al menos 1." }),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  sourceTemplateId: z.preprocess(nullAsUndefined, z.string().optional()),
  tracks: z.array(scheduleTemplateTrackSchema),
  cues: z.array(scheduleTemplateCueSchema),
}).passthrough().superRefine((template, context) => {
  const keys = new Set<string>();
  for (const track of template.tracks) {
    if (keys.has(track.key)) {
      context.addIssue({
        code: "custom",
        message: `La clave de track «${track.key}» está repetida en la plantilla.`,
        path: ["tracks"],
      });
      return;
    }
    keys.add(track.key);
  }
});

export const templateFileSchema = z.object({
  format: z.literal("regiduria.schedule-template", {
    error: "El formato del archivo debe ser regiduria.schedule-template.",
  }),
  formatVersion: z.literal(1, { error: "La versión del formato de archivo no es compatible." }),
  kind: z.enum(["template", "schedule"], {
    error: "El archivo debe ser una plantilla o una escaleta.",
  }),
  exportedAt: isoDateSchema,
  template: scheduleTemplateSchema,
}).passthrough();

const countdownBandSchema = z.object({
  minSeconds: z.number({ error: "El mínimo de la banda debe ser un número." })
    .int({ error: "El mínimo de la banda debe ser un número entero." })
    .min(0, { error: "El mínimo de la banda no puede ser negativo." }),
  maxSeconds: z.number({ error: "El máximo de la banda debe ser un número." })
    .int({ error: "El máximo de la banda debe ser un número entero." })
    .min(0, { error: "El máximo de la banda no puede ser negativo." }),
  color: z.enum(["red", "orange", "green", "blue", "yellow"], {
    error: "El color de la banda debe ser red, orange, green, blue o yellow.",
  }),
  label: nonEmptyText("Cada banda necesita una etiqueta no vacía."),
}).passthrough().refine((band) => band.maxSeconds >= band.minSeconds, {
  error: "El máximo de la banda no puede ser menor que el mínimo.",
  path: ["maxSeconds"],
});

export const dancePreferencesSchema = z.object({
  id: z.literal("dance", { error: "El identificador de las preferencias debe ser dance." }),
  countdownBands: z.array(countdownBandSchema).min(1, {
    error: "Las bandas de la cuenta atrás no pueden estar vacías.",
  }),
  fontScale: z.enum(["normal", "grande", "muy-grande"], {
    error: "El tamaño de letra debe ser normal, grande o muy-grande.",
  }),
  highContrast: z.boolean({ error: "El alto contraste debe ser verdadero o falso." }),
  soundFeedback: z.boolean({ error: "El sonido debe ser verdadero o falso." }),
  defaultAlertBeforeMs: z.number({ error: "El umbral por defecto debe ser un número." })
    .int({ error: "El umbral por defecto debe ser un número entero." })
    .min(1_000, { error: "El umbral por defecto debe ser al menos 1000 ms." })
    .max(60_000, { error: "El umbral por defecto no puede superar 60000 ms." }),
  updatedAt: isoDateSchema,
}).passthrough().superRefine((preferences, context) => {
  const ordered = [...preferences.countdownBands].sort((first, second) => first.minSeconds - second.minSeconds);
  if (ordered[0].minSeconds !== 0) {
    context.addIssue({
      code: "custom",
      message: "Las bandas de la cuenta atrás deben ser contiguas desde 0.",
      path: ["countdownBands"],
    });
    return;
  }
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index].minSeconds !== ordered[index - 1].maxSeconds + 1) {
      context.addIssue({
        code: "custom",
        message: "Las bandas de la cuenta atrás tienen huecos o solapes.",
        path: ["countdownBands"],
      });
      return;
    }
  }
  const maxCovered = Math.max(...ordered.map((band) => band.maxSeconds));
  if (maxCovered < 1 || maxCovered > 60) {
    context.addIssue({
      code: "custom",
      message: "El máximo de la banda superior debe estar entre 1 y 60 segundos.",
      path: ["countdownBands"],
    });
    return;
  }
  if (preferences.defaultAlertBeforeMs > maxCovered * 1_000) {
    context.addIssue({
      code: "custom",
      message: "El umbral por defecto debe estar dentro de la cobertura de las bandas.",
      path: ["defaultAlertBeforeMs"],
    });
  }
});

export type ProductionInput = z.infer<typeof productionSchema>;
export type CueInput = z.infer<typeof cueSchema>;
export type ScriptLabelInput = z.infer<typeof scriptLabelSchema>;
export type IncidentInput = z.infer<typeof incidentSchema>;
export type PerformanceInput = z.infer<typeof performanceSchema>;
