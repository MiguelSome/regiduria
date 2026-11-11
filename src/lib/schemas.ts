import { z } from "zod";

export const departmentSchema = z.object({
  id: z.string(),
  name: z.enum([
    "Iluminación",
    "Sonido",
    "Maquinaria",
    "Utilería",
    "Vestuario",
    "Caracterización",
    "Vídeo",
    "Regiduría",
    "Reparto",
  ]),
  responsable: z.string().min(1),
  notes: z.array(z.string()),
});

export const productionSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  venue: z.string().min(1),
  status: z.enum(["Activa", "Archivada"]),
  syncStatus: z.enum(["Sincronizado", "Pendiente", "Conflicto"]),
  lastUpdated: z.string(),
  summary: z.string().min(1),
  departments: z.array(departmentSchema),
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
  type: z.enum(["LX", "SON", "MOV", "PREVENIR", "PROY", "ENT/MUT", "UT", "SIM", "AVISO", "VEST"]),
  includedTypes: z
    .array(z.enum(["LX", "SON", "MOV", "PROY", "ENT/MUT", "UT", "AVISO", "VEST"]))
    .optional(),
  description: z.string().min(1),
  pie: z.string().trim().optional(),
  act: z.string(),
  scene: z.string(),
  department: z.enum([
    "Iluminación",
    "Sonido",
    "Maquinaria",
    "Utilería",
    "Vestuario",
    "Caracterización",
    "Vídeo",
    "Regiduría",
    "Reparto",
  ]),
  observations: z.string(),
  status: z.enum(["Borrador", "Preparado", "Ejecutado", "Pendiente"]),
  executionState: z.enum(["Preparación", "Función"]),
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
    cueType: z.enum(["LX", "SON", "MOV", "PREVENIR", "PROY", "ENT/MUT", "UT", "SIM", "AVISO", "VEST"]).optional(),
    cueIdentifierOverride: z.string().trim().min(1).optional(),
    includedTypes: z
      .array(z.enum(["LX", "SON", "MOV", "PROY", "ENT/MUT", "UT", "AVISO", "VEST"]))
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
      const prefix = label.cueType === "PREVENIR" ? "MOV" : label.cueType;
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
  status: z.enum(["Abierta", "Seguimiento", "Cerrada"]),
});

export type ProductionInput = z.infer<typeof productionSchema>;
export type CueInput = z.infer<typeof cueSchema>;
export type ScriptLabelInput = z.infer<typeof scriptLabelSchema>;
export type IncidentInput = z.infer<typeof incidentSchema>;
