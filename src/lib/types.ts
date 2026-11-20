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

export interface TemplateOrigin {
  templateId: string;
  name: string;
  version: number;
}

export interface DanceTrack {
  id: string;
  productionId: string;
  title: string;
  durationMs?: number;
  order: number;
  startAtMs?: number;
  notes: string;
}

export interface CueTiming {
  trackId?: string;
  trackOffsetMs?: number;
  atMs?: number;
  alertBeforeMs?: number;
}

/** A track with its derived start/end. Computed by buildSchedule; never persisted. */
export interface ScheduledTrack {
  track: DanceTrack;
  startAtMs: number;
  endAtMs?: number;
}

export type ResolvedTimingStatus = "linked" | "orphan" | "absolute" | "untimed";

/** The timing of a cue resolved against a schedule. Computed; never persisted. */
export interface ResolvedTiming {
  status: ResolvedTimingStatus;
  atMs?: number;
  trackId?: string;
  trackStartAtMs?: number;
  trackOffsetMs?: number;
}

export type ScheduleWarningCode =
  | "track-overlap"
  | "missing-track-duration"
  | "duplicate-track-order"
  | "duplicate-track-title"
  | "duplicate-cue-identifier"
  | "track-not-found";

/** A non-blocking schedule notice. It is reported, never written to storage. */
export interface ScheduleWarning {
  code: ScheduleWarningCode;
  message: string;
  trackIds?: string[];
  cueIds?: string[];
  order?: number;
}

export interface ScheduleTotals {
  trackCount: number;
  cueCount: number;
  totalMs: number;
  /** ISO trace of the injected `now`; no clock is read inside the domain layer. */
  calculatedAt: string;
}

/** Fully derived document/schedule: the single source of starts, order and totals. */
export interface Schedule {
  tracks: ScheduledTrack[];
  timedCues: Cue[];
  untimedCues: Cue[];
  totals: ScheduleTotals;
  warnings: ScheduleWarning[];
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
  mode?: "standard" | "dance";
  templateOrigin?: TemplateOrigin;
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
  timing?: CueTiming;
}

export interface ScheduleTemplateTrack {
  key: string;
  title: string;
  durationMs?: number;
  order: number;
  startAtMs?: number;
  notes: string;
}

export interface ScheduleTemplateCue {
  identifier: string;
  type: CueType;
  includedTypes?: CueComponentType[];
  description: string;
  pie?: string;
  observations: string;
  department: DepartmentName;
  act: string;
  scene: string;
  status: CueStatus;
  executionState: "Preparación" | "Función";
  trackKey?: string;
  trackOffsetMs?: number;
  atMs?: number;
  alertBeforeMs: number;
}

export interface ScheduleTemplate {
  id: string;
  name: string;
  description: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  sourceTemplateId?: string;
  tracks: ScheduleTemplateTrack[];
  cues: ScheduleTemplateCue[];
}

export interface TemplateFile {
  format: "regiduria.schedule-template";
  formatVersion: 1;
  kind: "template" | "schedule";
  exportedAt: string;
  template: ScheduleTemplate;
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

export interface CueLaunchEvent {
  id: string;
  cueId: string;
  cueIdentifier: string;
  cueDescription: string;
  cuePie?: string;
  cueObservations?: string;
  launchedAt: string;
  elapsedMs: number;
  showOffsetMs?: number;
  trackId?: string;
  trackStartAt?: string;
  targetOffsetMs?: number;
  actualOffsetMs?: number;
  deviationMs?: number;
}

export interface TrackRun {
  trackId: string;
  title: string;
  startedAt: string;
  endedAt: string;
  actualElapsedMs: number;
  endedBy: "duration" | "manual";
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
  // Dance execution data. Absent means a standard show (RF25).
  mode?: "show";
  cueLaunches?: CueLaunchEvent[];
  trackRuns?: TrackRun[];
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

export interface CountdownBand {
  minSeconds: number;
  maxSeconds: number;
  color: "red" | "orange" | "green" | "blue" | "yellow";
  label: string;
}

export interface DancePreferences {
  id: "dance";
  countdownBands: CountdownBand[];
  fontScale: "normal" | "grande" | "muy-grande";
  highContrast: boolean;
  soundFeedback: boolean;
  defaultAlertBeforeMs: number;
  updatedAt: string;
}

/** A paused-capable stopwatch sample. All instants are ISO; `now` is injected. */
export interface ClockSample {
  startedAt: string;
  elapsedBeforeMs: number;
  pausedAt?: string | null;
  pausedTotalMs?: number;
}

export type TrackStateStatus = "Pendiente" | "En marcha" | "Pausado" | "Terminado";

/** Live, non-persisted state of the referenced track. */
export interface TrackState {
  status: TrackStateStatus;
  endedBy?: "duration" | "manual";
  /** Active (pause-free) elapsed time of the track, when available. */
  activeMs?: number;
  /** Declared duration; absence means the track has no duration. */
  durationMs?: number;
}

export interface LaunchAvailability {
  launchable: boolean;
  /** Fixed reason from spec 002 §1.7/RF22 when a control must be disabled. */
  reason?: string;
}

/** One row of the deviation report, built only from a launch snapshot. */
export interface DeviationReportRow {
  cueId: string;
  cueIdentifier: string;
  trackTitle: string;
  targetOffsetMs: number;
  targetText: string;
  actualOffsetMs?: number;
  actualText?: string;
  deviationMs: number;
  deviationText: string;
  onTime: boolean;
  /** Snapshot text captured at launch; the live cue is never read. */
  cueDescription: string;
  cuePie?: string;
  cueObservations?: string;
  launchedAt: string;
}

/** A list entry (without target, without reference, not reached or pending). */
export interface DeviationReportEntry {
  cueId: string;
  cueIdentifier: string;
  trackTitle: string;
  cueDescription: string;
  cuePie?: string;
  cueObservations?: string;
  targetOffsetMs?: number;
  targetText?: string;
}

export interface DeviationMaxEntry {
  cueId: string;
  cueIdentifier: string;
  deviationMs: number;
  deviationText: string;
}

export interface DeviationReportSummary {
  launchedCount: number;
  withTargetCount: number;
  /** Signed arithmetic mean; absent when there is no measured deviation. */
  averageDeviationMs?: number;
  averageText: string;
  maxDeviation?: DeviationMaxEntry;
  notReachedCount: number;
}

/** Fully derived report: a pure function of the run record, never persisted. */
export interface DeviationReport {
  rows: DeviationReportRow[];
  summary: DeviationReportSummary;
  launchedWithoutTarget: DeviationReportEntry[];
  launchedWithoutReference: DeviationReportEntry[];
  pendingWithoutTarget: DeviationReportEntry[];
  notReached: DeviationReportEntry[];
  generatedAt: string;
}
