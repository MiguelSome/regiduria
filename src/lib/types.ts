export type CueType = "LX" | "SON" | "MOV" | "UT" | "VEST";
export type CueStatus = "Borrador" | "Preparado" | "Ejecutado" | "Pendiente";
export type DepartmentName =
  | "Iluminación"
  | "Sonido"
  | "Maquinaria"
  | "Utilería"
  | "Vestuario"
  | "Caracterización";

export type SyncStatus = "Sincronizado" | "Pendiente" | "Conflicto";

export interface Department {
  id: string;
  name: DepartmentName;
  responsable: string;
  notes: string[];
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
}

export interface Cue {
  id: string;
  productionId: string;
  identifier: string;
  type: CueType;
  description: string;
  act: string;
  scene: string;
  department: DepartmentName;
  observations: string;
  status: CueStatus;
  executionState: "Preparación" | "Función";
}

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
