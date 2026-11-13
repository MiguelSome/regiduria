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
  description: z.string().min(1),
  pie: z.string().trim().optional(),
  act: z.string(),
  scene: z.string(),
  department: departmentNameSchema,
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

export type ProductionInput = z.infer<typeof productionSchema>;
export type CueInput = z.infer<typeof cueSchema>;
export type ScriptLabelInput = z.infer<typeof scriptLabelSchema>;
export type IncidentInput = z.infer<typeof incidentSchema>;
