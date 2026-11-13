// Single source of truth for the domain lists. Types and Zod schemas are built from these arrays.
export const DEPARTMENT_NAMES = [
  "Iluminación",
  "Sonido",
  "Maquinaria",
  "Utilería",
  "Vestuario",
  "Caracterización",
  "Vídeo",
  "Regiduría",
  "Reparto",
] as const;

export const CUE_TYPES = [
  "LX",
  "SON",
  "MOV",
  "PREVENIR",
  "PROY",
  "ENT/MUT",
  "UT",
  "SIM",
  "AVISO",
  "VEST",
] as const;

// Types that can be combined inside a SIM cue: every cue type except SIM and PREVENIR.
export const CUE_COMPONENT_TYPES = [
  "LX",
  "SON",
  "MOV",
  "PROY",
  "ENT/MUT",
  "UT",
  "AVISO",
  "VEST",
] as const satisfies readonly CueType[];

export type CueType = (typeof CUE_TYPES)[number];
export type CueComponentType = (typeof CUE_COMPONENT_TYPES)[number];
export type ScriptLabelCategory = "act" | "scene" | "cue";
export type CueStatus = "Borrador" | "Preparado" | "Ejecutado" | "Pendiente";
export type DepartmentName = (typeof DEPARTMENT_NAMES)[number];

export type SyncStatus = "Sincronizado" | "Pendiente" | "Conflicto";

export interface Department {
  id: string;
  name: DepartmentName;
  responsable: string;
  notes: string[];
}

export interface TechnicalStaffMember {
  id: string;
  name: string;
  tag: string;
}

export interface TechnicalDepartmentTeam {
  department: DepartmentName;
  head: string;
  technicians: TechnicalStaffMember[];
}

export interface ArtisticTeamMember {
  id: string;
  name: string;
  role: string;
  character?: string;
}

export interface ProjectTeam {
  technical: TechnicalDepartmentTeam[];
  artistic: ArtisticTeamMember[];
}

export interface Scene {
  id: string;
  act: string;
  number: string;
  title: string;
  summary: string;
}

export interface Production {
  id: string;
  title: string;
  subtitle: string;
  venue: string;
  status: "Activa" | "Archivada";
  syncStatus: SyncStatus;
  lastUpdated: string;
  summary: string;
  departments: Department[];
  scenes: Scene[];
  team?: ProjectTeam;
}

export interface Cue {
  id: string;
  productionId: string;
  identifier: string;
  type: CueType;
  description: string;
  pie?: string;
  act: string;
  scene: string;
  department: DepartmentName;
  observations: string;
  status: CueStatus;
  executionState: "Preparación" | "Función";
  scriptDocumentId?: string;
  scriptLabelId?: string;
  includedTypes?: CueComponentType[];
}

export interface ScriptDocument {
  id: string;
  productionId: string;
  fileName: string;
  displayName?: string;
  pdfData: Blob;
  updatedAt: string;
}

export interface ScriptLabel {
  id: string;
  documentId: string;
  productionId: string;
  category: ScriptLabelCategory;
  title: string;
  pie?: string;
  page: number;
  x: number;
  y: number;
  cueType?: CueType;
  includedTypes?: CueComponentType[];
  cueId?: string;
  cueIdentifier?: string;
  cueIdentifierOverride?: string;
}

export type ScriptLabelDraft = Omit<ScriptLabel, "id" | "cueId">;

export interface Incident {
  id: string;
  productionId: string;
  title: string;
  description: string;
  date: string;
  createdAt?: string;
  departments?: DepartmentName[];
  status: "Abierta" | "Seguimiento" | "Cerrada";
}

export interface PerformanceBreak {
  startedAt: string;
  endedAt?: string;
  durationMs: number;
}

export interface PerformanceQuickIncident {
  id: string;
  occurredAt: string;
  elapsedMs: number;
  elapsedMinutes: number;
  description: string;
}

export interface PerformanceRunReport {
  // Opening of the performance record. Cues can be launched before the timer starts.
  startedAt: string;
  endedAt?: string;
  durationMs: number;
  launchedCueCount: number;
  breaks: PerformanceBreak[];
  quickIncidents: PerformanceQuickIncident[];
  // First time the timer was started. Optional: older records have no timer start.
  timerStartedAt?: string;
}

export interface Performance {
  id: string;
  productionId: string;
  title: string;
  date: string;
  time: string;
  prepared: number;
  total: number;
  notes: string[];
  runReport?: PerformanceRunReport;
}

export interface Performer {
  id: string;
  name: string;
  role: string;
  department: DepartmentName;
}
