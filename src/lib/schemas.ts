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
  type: z.enum(["LX", "SON", "MOV", "UT", "VEST"]),
  description: z.string().min(1),
  act: z.string(),
  scene: z.string(),
  department: z.enum([
    "Iluminación",
    "Sonido",
    "Maquinaria",
    "Utilería",
    "Vestuario",
    "Caracterización",
  ]),
  observations: z.string(),
  status: z.enum(["Borrador", "Preparado", "Ejecutado", "Pendiente"]),
  executionState: z.enum(["Preparación", "Función"]),
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
export type IncidentInput = z.infer<typeof incidentSchema>;
