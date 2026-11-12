export type CueType =
  | "LX"
  | "SON"
  | "MOV"
  | "PREVENIR"
  | "PROY"
  | "ENT/MUT"
  | "UT"
  | "SIM"
  | "AVISO"
  | "VEST";
export type CueComponentType = Exclude<CueType, "SIM" | "PREVENIR">;
export type ScriptLabelCategory = "act" | "scene" | "cue";
export type CueStatus = "Borrador" | "Preparado" | "Ejecutado" | "Pendiente";
export type DepartmentName =
  | "Iluminación"
  | "Sonido"
  | "Maquinaria"
  | "Utilería"
  | "Vestuario"
  | "Caracterización"
  | "Vídeo"
  | "Regiduría"
  | "Reparto";

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
  status: "Abierta" | "Seguimiento" | "Cerrada";
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
}

export interface Performer {
  id: string;
  name: string;
  role: string;
  department: DepartmentName;
}
