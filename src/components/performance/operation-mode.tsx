"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpenText,
  BellRing,
  CheckCircle2,
  Clock3,
  ListChecks,
  Pause,
  Play,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { ScriptPagePreview } from "@/components/pdf/script-page-preview";
import { CueTypeBadge } from "@/components/cues/cue-type-badge";
import { Countdown } from "@/components/dance/countdown";
import { CueNote } from "@/components/dance/cue-note";
import { LiveSchedule } from "@/components/dance/live-schedule";
import { ModeBadge } from "@/components/dance/mode-badge";
import { ShowClock } from "@/components/dance/show-clock";
import { TrackPanel } from "@/components/dance/track-panel";
import {
  deletePerformance,
  getCuesByProduction,
  getDanceTracks,
  getPerformances,
  getProductions,
  getScriptDocument,
  getScriptLabels,
  saveCue,
  savePerformance,
} from "@/lib/data-service";
import { getLaunchAvailability, LAUNCH_REASON_NOT_NEXT } from "@/lib/dance/clock";
import {
  appendLaunch,
  closeTrackRun,
  finishPerformance,
  isSessionOpenRecord,
  openDanceRecord,
} from "@/lib/dance/performance";
import { buildCueLaunchEvent } from "@/lib/dance/report";
import { buildSchedule, resolveCueTiming } from "@/lib/dance/schedule";
import { getNextCandidate } from "@/lib/dance/sequence";
import {
  applyCueLaunch,
  buildPerformanceRecord,
  canLaunchNextCue,
  isOpenRecord,
  startTimerInReport,
} from "@/lib/performance-run";
import type {
  Cue,
  CueComponentType,
  CueLaunchEvent,
  CueType,
  DanceTrack,
  Performance,
  Production,
  ScriptDocument,
  ScriptLabel,
  TrackRun,
} from "@/lib/types";
import { useDanceRuntimeStore } from "@/store/dance-runtime-store";
import { useUiStore } from "@/store/ui-store";

const launchActionByType: Partial<Record<CueType, string>> = {
  LX: "Go",
  MOV: "TOP",
  UT: "Cambio",
  SON: "Pincha",
  PROY: "Pincha",
  PREVENIR: "Prevenido",
};

type TimerState = "idle" | "running" | "paused" | "finished";
type OperationTab = "operation" | "announcements" | "document";

const DANCE_LAUNCH_REASON_ID = "dance-launch-disabled-reason";
const DANCE_FINISH_REASON_ID = "dance-finish-disabled-reason";
const DANCE_START_REASON_ID = "dance-start-disabled-reason";
const DANCE_BREAK_REASON_ID = "dance-break-disabled-reason";
const DANCE_LIBRETO_REASON_ID = "dance-libreto-disabled-reason";
const DANCE_INCIDENT_REASON_ID = "dance-incident-saving-reason";
const DANCE_FINISH_ERROR = "No se pudo finalizar la función. Inténtalo de nuevo.";
const DANCE_DISCARD_ERROR = "No se pudo descartar la función. Inténtalo de nuevo.";

// T10/A2: preferencia de tamaño definida por la entrega de app-shell; aquí solo se consume.
const scaledClockStyle = { fontSize: "calc(2.25rem * var(--dance-font-scale, 1))" } as const;
const scaledBreakStyle = { fontSize: "calc(1.125rem * var(--dance-font-scale, 1))" } as const;
const scaledSmStyle = { fontSize: "calc(0.875rem * var(--dance-font-scale, 1))" } as const;
const scaledTinyStyle = { fontSize: "calc(0.75rem * var(--dance-font-scale, 1))" } as const;
type PreparationAlertState = "idle" | "running30" | "waiting15" | "running15" | "waiting5" | "done";
type PreparationCheckKey =
  | "soundPassed"
  | "microphones"
  | "stageManagement"
  | "machinery"
  | "lights"
  | "props";
type PreparationChecks = Record<PreparationCheckKey, boolean>;

const departmentChecks: { key: PreparationCheckKey; label: string }[] = [
  { key: "stageManagement", label: "Regiduría" },
  { key: "machinery", label: "Maquinaria" },
  { key: "lights", label: "Luces" },
  { key: "props", label: "Utilería" },
];

function getLaunchActionLabel(
  type: CueType,
  includedTypes?: readonly CueComponentType[],
): string {
  if (type === "SIM") {
    return includedTypes?.some((includedType) => includedType === "MOV" || includedType === "UT")
      ? "TOP"
      : "Go";
  }

  return launchActionByType[type] ?? "Lanzar";
}

/** Clock reads stay in effects and handlers; the helper keeps React render pure. */
function currentInstant(): number {
  return Date.now();
}

function getCueNumber(identifier: string): number {
  const suffix = identifier.match(/(\d+(?:\.\d+)?)$/)?.[1];
  return suffix ? Number(suffix) : Number.MAX_SAFE_INTEGER;
}

function orderCues(cues: Cue[], labels: ScriptLabel[], production?: Production): Cue[] {
  const scriptPositionByCueId = new Map<string, number>();
  labels.forEach((label, index) => {
    if (label.category === "cue" && label.cueId) {
      scriptPositionByCueId.set(label.cueId, index);
    }
  });

  const scenePosition = new Map(
    production?.scenes.map((scene, index) => [`${scene.act}\u0000${scene.number}`, index]) ?? [],
  );
  const getScenePosition = (cue: Cue) =>
    scenePosition.get(`${cue.act}\u0000${cue.scene}`) ?? Number.MAX_SAFE_INTEGER;

  return [...cues].sort((first, second) => {
    const firstScriptPosition = scriptPositionByCueId.get(first.id);
    const secondScriptPosition = scriptPositionByCueId.get(second.id);
    if (firstScriptPosition !== undefined && secondScriptPosition !== undefined) {
      return firstScriptPosition - secondScriptPosition;
    }

    const sceneDifference = getScenePosition(first) - getScenePosition(second);
    if (sceneDifference !== 0) return sceneDifference;
    if (firstScriptPosition !== undefined) return -1;
    if (secondScriptPosition !== undefined) return 1;

    return getCueNumber(first.identifier) - getCueNumber(second.identifier) ||
      first.identifier.localeCompare(second.identifier);
  });
}

function getCueScriptPage(cue: Cue | undefined, labels: ScriptLabel[]): number | undefined {
  if (!cue) return undefined;
  const label =
    labels.find((item) => item.category === "cue" && item.id === cue.scriptLabelId) ??
    labels.find((item) => item.category === "cue" && item.cueId === cue.id);
  return label?.page;
}

function formatElapsedTime(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function getElapsedAt(
  runStartedAt: number | null,
  elapsedBeforeRun: number,
  timestamp: number,
): number {
  return elapsedBeforeRun + (runStartedAt === null ? 0 : timestamp - runStartedAt);
}

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function getPreparationAlertLabel(state: PreparationAlertState): string {
  switch (state) {
    case "idle":
    case "running30":
      return "Aviso 30'";
    case "waiting15":
      return "AVISO 15";
    case "running15":
      return "Aviso 15'";
    case "waiting5":
      return "AVISO 5";
    case "done":
      return "Avisos completados";
  }
}

export function OperationMode() {
  const [productions, setProductions] = useState<Production[]>([]);
  const [selectedProductionId, setSelectedProductionId] = useState("");
  const [cues, setCues] = useState<Cue[] | null>(null);
  const [danceTracks, setDanceTracks] = useState<DanceTrack[]>([]);
  const [danceNotReachedIds, setDanceNotReachedIds] = useState<string[]>([]);
  const [danceLaunchedIds, setDanceLaunchedIds] = useState<string[]>([]);
  const [danceSelectedCueId, setDanceSelectedCueId] = useState<string | null>(null);
  const [danceShowBlockedByRecord, setDanceShowBlockedByRecord] = useState(false);
  const [dancePreviousOpenRecords, setDancePreviousOpenRecords] = useState<Performance[]>([]);
  const [danceFinishedReportId, setDanceFinishedReportId] = useState<string | null>(null);
  const [danceNow, setDanceNow] = useState(0);
  const [cueLoadError, setCueLoadError] = useState<string | null>(null);
  const [productionLoadError, setProductionLoadError] = useState<string | null>(null);
  const [runSaveError, setRunSaveError] = useState<string | null>(null);
  // T10/A2: one polite region for milestones only. Clock ticks never write here.
  const [milestoneAnnouncement, setMilestoneAnnouncement] = useState("");
  const [scriptDocument, setScriptDocument] = useState<ScriptDocument | null>(null);
  const [scriptLabels, setScriptLabels] = useState<ScriptLabel[]>([]);
  const [scriptDocumentLoading, setScriptDocumentLoading] = useState(true);
  const [manualScriptPage, setManualScriptPage] = useState<{ cueId: string | null; page: number }>({
    cueId: null,
    page: 1,
  });
  const [totalScriptPages, setTotalScriptPages] = useState(0);
  const [isLibretoOpen, setIsLibretoOpen] = useState(false);
  const [timerState, setTimerState] = useState<TimerState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [launchedCount, setLaunchedCount] = useState(0);
  const [breakStartedAt, setBreakStartedAt] = useState<number | null>(null);
  const [breakElapsedMs, setBreakElapsedMs] = useState(0);
  const [isQuickIncidentOpen, setIsQuickIncidentOpen] = useState(false);
  const [quickIncidentDescription, setQuickIncidentDescription] = useState("");
  const [quickIncidentSaved, setQuickIncidentSaved] = useState(false);
  const [quickIncidentMoment, setQuickIncidentMoment] = useState<{
    occurredAt: number;
    elapsedMs: number;
  } | null>(null);
  const [isStartingFunction, setIsStartingFunction] = useState(false);
  const [isLaunchingCue, setIsLaunchingCue] = useState(false);
  const [isSavingQuickIncident, setIsSavingQuickIncident] = useState(false);
  const [tecMode, setTecMode] = useState(false);
  const [activeTab, setActiveTab] = useState<OperationTab>("operation");
  const [preparationAlertState, setPreparationAlertState] = useState<PreparationAlertState>("idle");
  const [preparationAlertSeconds, setPreparationAlertSeconds] = useState(30 * 60);
  const [preparationChecks, setPreparationChecks] = useState<PreparationChecks>({
    soundPassed: false,
    microphones: false,
    stageManagement: false,
    machinery: false,
    lights: false,
    props: false,
  });
  const activeProjectId = useUiStore((state) => state.selectedProjectId);
  const setActiveProjectId = useUiStore((state) => state.setSelectedProjectId);
  const setProductionSelectionLocked = useUiStore((state) => state.setProductionSelectionLocked);
  const executionMode = useUiStore((state) => state.executionMode);
  const setExecutionMode = useUiStore((state) => state.setExecutionMode);
  const danceTrackRuntimes = useDanceRuntimeStore((state) => state.trackRuntimes);
  const getDanceTrackState = useDanceRuntimeStore((state) => state.getTrackState);
  const getDanceTrackActiveMs = useDanceRuntimeStore((state) => state.getTrackActiveMs);
  const getDanceShowActiveMs = useDanceRuntimeStore((state) => state.getShowActiveMs);
  const danceShowSample = useDanceRuntimeStore((state) => state.showSample);
  const runtimeNotReachedIds = useDanceRuntimeStore((state) => state.notReachedIds);
  const selectedProduction = productions.find((production) => production.id === selectedProductionId);
  // Danza comparte el carril de control de /modo-funcion; el proyecto estándar no ve nada de esta capa.
  const danceProduction = selectedProduction?.mode === "dance" ? selectedProduction : null;
  const danceProductionId = danceProduction?.id ?? null;

  // D6: a dance session always opens in FUNCIÓN; the mode is not remembered.
  useEffect(() => {
    if (danceProductionId && executionMode === null) setExecutionMode("show");
  }, [danceProductionId, executionMode, setExecutionMode]);

  const runStartedAt = useRef<number | null>(null);
  const elapsedBeforeRun = useRef(0);
  const launchedCountRef = useRef(0);
  const breakStartedAtRef = useRef<number | null>(null);
  const performanceRecordRef = useRef<Performance | null>(null);
  const performanceSaveQueue = useRef<Promise<void>>(Promise.resolve());
  const isStartingFunctionRef = useRef(false);
  const isLaunchingRef = useRef(false);
  const isFinishingDanceRef = useRef(false);
  const isDiscardingDanceRef = useRef(false);
  const danceLaunchedIdsRef = useRef<string[]>([]);
  // A failed save keeps the captured instant here so a retry never replaces it.
  const pendingDanceLaunchRef = useRef<{ event: CueLaunchEvent; elapsedMs: number } | null>(null);
  const launchButtonRef = useRef<HTMLButtonElement | null>(null);
  const preparationAlertDeadline = useRef<number | null>(null);

  /** Stable so child panels can announce milestones without re-subscribing. */
  const announceMilestone = useCallback((message: string): void => {
    setMilestoneAnnouncement(message);
  }, []);

  // Clearing the text lets an identical milestone be announced again later.
  useEffect(() => {
    if (!milestoneAnnouncement) return;
    const timer = window.setTimeout(() => setMilestoneAnnouncement(""), 1200);
    return () => window.clearTimeout(timer);
  }, [milestoneAnnouncement]);

  useEffect(() => {
    let active = true;

    const loadProductions = async () => {
      try {
        const nextProductions = await getProductions();
        if (!active) return;

        setProductions(nextProductions);
        const currentProjectId = useUiStore.getState().selectedProjectId;
        const selected =
          nextProductions.find((production) => production.id === currentProjectId) ??
          nextProductions[0];
        const nextId = selected?.id ?? "";
        const shouldUpdateActiveProject = nextId !== currentProjectId;
        setSelectedProductionId(nextId);
        if (shouldUpdateActiveProject) setActiveProjectId(nextId);
        setProductionLoadError(null);
      } catch (loadError) {
        console.error(loadError);
        if (active) setProductionLoadError("No se pudieron cargar las producciones.");
      }
    };

    void loadProductions();
    return () => {
      active = false;
    };
  }, [setActiveProjectId]);

  useEffect(() => {
    let active = true;

    const loadCues = async () => {
      if (!selectedProduction) return;

      try {
        const [productionCues, document] = await Promise.all([
          getCuesByProduction(selectedProduction.id),
          getScriptDocument(selectedProduction.id),
        ]);
        const labels = document ? await getScriptLabels(document.id) : [];
        if (active) {
          setCues(orderCues(productionCues, labels, selectedProduction));
          setScriptDocument(document ?? null);
          setScriptLabels(labels);
          setScriptDocumentLoading(false);
        }
      } catch (loadError) {
        console.error(loadError);
        if (active) {
          setCueLoadError("No se pudieron cargar los cues de esta producción.");
          setScriptDocumentLoading(false);
        }
      }
    };

    void loadCues();
    return () => {
      active = false;
    };
  }, [selectedProduction]);

  useEffect(() => {
    if (!danceProductionId) return;
    let active = true;

    const loadDanceTracks = async () => {
      try {
        const tracks = await getDanceTracks(danceProductionId);
        if (!active) return;
        setDanceTracks(tracks);
        useDanceRuntimeStore.getState().hydrate(danceProductionId, tracks, currentInstant());
      } catch (loadError) {
        console.error(loadError);
        if (active) setDanceTracks([]);
      }
    };

    void loadDanceTracks();
    return () => {
      active = false;
    };
  }, [danceProductionId]);

  useEffect(() => {
    return () => {
      setDanceTracks([]);
      setDanceNotReachedIds([]);
      setDanceLaunchedIds([]);
      setDanceSelectedCueId(null);
      danceLaunchedIdsRef.current = [];
      pendingDanceLaunchRef.current = null;
      useDanceRuntimeStore.getState().resetAll(currentInstant());
    };
  }, [selectedProductionId]);

  // The only dance clock: an effect, never a render read. It drives track
  // states and countdown props for dance productions only (T5/T6).
  useEffect(() => {
    if (!danceProductionId) return;

    const tick = () => setDanceNow(currentInstant());
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [danceProductionId]);

  useEffect(() => {
    if (timerState !== "running") return;

    const interval = window.setInterval(() => {
      const start = runStartedAt.current;
      if (start !== null) {
        setElapsedMs(elapsedBeforeRun.current + currentInstant() - start);
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, [timerState]);

  useEffect(() => {
    if (breakStartedAt === null) return;

    const interval = window.setInterval(() => {
      setBreakElapsedMs(currentInstant() - breakStartedAt);
    }, 250);

    return () => window.clearInterval(interval);
  }, [breakStartedAt]);

  useEffect(() => {
    if (preparationAlertState !== "running30" && preparationAlertState !== "running15") return;

    const interval = window.setInterval(() => {
      const deadline = preparationAlertDeadline.current;
      if (deadline === null) return;

      const remaining = Math.max(0, Math.ceil((deadline - currentInstant()) / 1000));
      if (preparationAlertState === "running30" && remaining <= 15 * 60) {
        preparationAlertDeadline.current = null;
        setPreparationAlertSeconds(15 * 60);
        setPreparationAlertState("waiting15");
      } else if (preparationAlertState === "running15" && remaining <= 5 * 60) {
        preparationAlertDeadline.current = null;
        setPreparationAlertSeconds(5 * 60);
        setPreparationAlertState("waiting5");
      } else {
        setPreparationAlertSeconds(remaining);
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, [preparationAlertState]);

  useEffect(() => {
    if (!tecMode || timerState === "finished") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        event.repeat ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        launchButtonRef.current?.click();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        const previousCount = Math.max(launchedCountRef.current - 1, 0);
        launchedCountRef.current = previousCount;
        setLaunchedCount(previousCount);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tecMode, timerState]);

  useEffect(() => {
    if (!isLibretoOpen) return;

    const previousOverflow = window.document.body.style.overflow;
    window.document.body.style.overflow = "hidden";
    return () => {
      window.document.body.style.overflow = previousOverflow;
    };
  }, [isLibretoOpen]);

  /** Render-safe mirror of the open record used by the badge's block reason. */
  const syncDanceOpenRecordState = (record: Performance | null): void => {
    setDanceShowBlockedByRecord(isSessionOpenRecord(record, record?.id ?? ""));
  };

  /**
   * D33: only the record opened by this in-memory session qualifies for
   * closing or discarding. Never called during render: handlers read the ref.
   */
  const sessionOpenRecord = (): Performance | null => {
    const record = performanceRecordRef.current;
    return danceProduction && record?.productionId === danceProduction.id
      && isSessionOpenRecord(record, record.id)
      ? record
      : null;
  };

  /** Open records from other sessions are listed but never acted upon (CL62). */
  const reloadDancePreviousOpenRecords = useCallback(
    async (isActive: () => boolean = () => true): Promise<void> => {
      if (!danceProductionId) {
        setDancePreviousOpenRecords([]);
        return;
      }
      try {
        const records = await getPerformances();
        if (!isActive()) return;
        const currentId = performanceRecordRef.current?.id ?? null;
        setDancePreviousOpenRecords(records.filter((record) =>
          record.productionId === danceProductionId
          && Boolean(record.runReport && !record.runReport.endedAt)
          && record.id !== currentId
        ));
      } catch (loadError) {
        console.error(loadError);
      }
    },
    [danceProductionId],
  );

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void reloadDancePreviousOpenRecords(() => active);
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [reloadDancePreviousOpenRecords]);

  const persistPerformance = (performance: Performance): Promise<boolean> => {
    performanceRecordRef.current = performance;
    syncDanceOpenRecordState(performance);
    const saveResult = performanceSaveQueue.current.then(async () => {
      try {
        await savePerformance(performance);
        setRunSaveError(null);
        return true;
      } catch (saveError) {
        console.error(saveError);
        setRunSaveError("No se pudo guardar el registro de la función.");
        return false;
      }
    });
    performanceSaveQueue.current = saveResult.then(() => undefined);
    return saveResult;
  };

  const reloadDanceTracks = async (): Promise<void> => {
    if (!danceProductionId) return;
    try {
      const nextTracks = await getDanceTracks(danceProductionId);
      setDanceTracks(nextTracks);
      useDanceRuntimeStore.getState().syncTracks(nextTracks, currentInstant());
    } catch (loadError) {
      console.error(loadError);
    }
  };

  /** Shared by the mode badge only: a confirmed toggle starts a fresh session. */
  const resetDanceExecution = (nextMode: "rehearsal" | "show"): void => {
    const now = currentInstant();
    setTimerState("idle");
    setElapsedMs(0);
    runStartedAt.current = null;
    elapsedBeforeRun.current = 0;
    launchedCountRef.current = 0;
    setLaunchedCount(0);
    performanceRecordRef.current = null;
    syncDanceOpenRecordState(null);
    setProductionSelectionLocked(false);
    setDanceLaunchedIds([]);
    danceLaunchedIdsRef.current = [];
    setDanceNotReachedIds([]);
    setDanceSelectedCueId(null);
    setDanceFinishedReportId(null);
    pendingDanceLaunchRef.current = null;
    breakStartedAtRef.current = null;
    setBreakStartedAt(null);
    setBreakElapsedMs(0);
    isStartingFunctionRef.current = false;
    setIsStartingFunction(false);
    isLaunchingRef.current = false;
    setIsLaunchingCue(false);
    setActiveTab("operation");
    setRunSaveError(null);
    useDanceRuntimeStore.getState().resetAll(now);
    setDanceNow(now);
    setExecutionMode(nextMode);
  };

  const handleToggleExecutionMode = (): void => {
    if (!danceProduction) return;
    const mode = executionMode ?? "show";
    if (mode === "show") {
      const currentRecord = performanceRecordRef.current;
      const hasOpenRecord = isSessionOpenRecord(currentRecord, currentRecord?.id ?? "");
      const hasRunningTrack = Object.values(useDanceRuntimeStore.getState().trackRuntimes)
        .some((runtime) => runtime.status === "En marcha");
      if (hasOpenRecord || hasRunningTrack) return;
      if (!window.confirm(
        "Cambiar a Ensayo reiniciará la ejecución: cronómetros, tracks y lanzamientos volverán a cero. ¿Continuar?",
      )) {
        return;
      }
    } else if (!window.confirm(
      "Cambiar a Función reiniciará la ejecución: cronómetros, tracks y lanzamientos volverán a cero. ¿Continuar?",
    )) {
      return;
    }

    resetDanceExecution(mode === "show" ? "rehearsal" : "show");
    announceMilestone(mode === "show" ? "Modo Ensayo" : "Modo Función");
  };

  const handleNotReached = (ids: string[]): void => {
    // El panel entrega la lista total; se conserva tal cual en estado local y en el store.
    setDanceNotReachedIds(ids);
    useDanceRuntimeStore.getState().setNotReachedIds(ids);
  };

  const handleTrackClosed = (input: {
    trackId: string; title: string; activeMs: number;
    startedAtMs: number;
    endedBy: "duration" | "manual"; now: number;
  }): void => {
    announceMilestone(input.endedBy === "duration"
      ? `Track ${input.title} terminado por duración`
      : `Track ${input.title} detenido`);
    // T8 aún no aporta `closeTrackRun`; el cierre se construye aquí y usa la cola de la 001.
    // Sin registro abierto no se inventa uno: el cierre queda solo en memoria.
    const currentPerformance = performanceRecordRef.current;
    if (!currentPerformance?.runReport) return;

    const trackRun = closeTrackRun({
      trackId: input.trackId,
      title: input.title,
      startedAtMs: input.startedAtMs,
      activeMs: input.activeMs,
      endedBy: input.endedBy,
      now: input.now,
    });
    const updatedPerformance: Performance = {
      ...currentPerformance,
      runReport: {
        ...currentPerformance.runReport,
        trackRuns: [...(currentPerformance.runReport.trackRuns ?? []), trackRun],
      },
    };
    void persistPerformance(updatedPerformance);
  };

  const toggleTimer = async () => {
    if (timerState === "running") {
      const now = currentInstant();
      const total = getElapsedAt(runStartedAt.current, elapsedBeforeRun.current, now);
      elapsedBeforeRun.current = total;
      setElapsedMs(total);
      runStartedAt.current = null;
      setTimerState("paused");
      const currentPerformance = performanceRecordRef.current;
      if (currentPerformance?.runReport) {
        void persistPerformance({
          ...currentPerformance,
          runReport: { ...currentPerformance.runReport, durationMs: total },
        });
      }
      return;
    }

    if (timerState === "paused") {
      if (breakStartedAtRef.current !== null) return;
      runStartedAt.current = currentInstant();
      setTimerState("running");
      setActiveTab("operation");
      return;
    }

    if (
      timerState !== "idle" ||
      isStartingFunctionRef.current ||
      isLaunchingRef.current ||
      !selectedProduction ||
      !cues?.length
    ) {
      return;
    }

    isStartingFunctionRef.current = true;
    setIsStartingFunction(true);
    const now = currentInstant();
    const previousPerformance = performanceRecordRef.current;
    const openPerformance =
      isOpenRecord(previousPerformance) &&
      previousPerformance?.productionId === selectedProduction.id
        ? previousPerformance
        : null;
    const hasOpenRecord = openPerformance !== null;
    const basePerformance = openPerformance
      ? openPerformance
      : buildPerformanceRecord({ production: selectedProduction, totalCues: cues.length, now });
    const performance = startTimerInReport({ performance: basePerformance, now });
    if (!hasOpenRecord) setProductionSelectionLocked(true);

    const saved = await persistPerformance(performance);
    isStartingFunctionRef.current = false;
    setIsStartingFunction(false);
    if (!saved) {
      if (performanceRecordRef.current?.id === performance.id) {
        performanceRecordRef.current = previousPerformance;
        syncDanceOpenRecordState(previousPerformance);
      }
      if (!hasOpenRecord) setProductionSelectionLocked(false);
      return;
    }

    runStartedAt.current = now;
    elapsedBeforeRun.current = 0;
    setElapsedMs(0);
    setTimerState("running");
    setActiveTab("operation");
  };

  const toggleBreak = async () => {
    const currentPerformance = performanceRecordRef.current;
    if (!currentPerformance?.runReport) return;

    const now = currentInstant();
    const activeBreakStart = breakStartedAtRef.current;
    if (activeBreakStart !== null) {
      const breaks = [...currentPerformance.runReport.breaks];
      const lastBreak = breaks[breaks.length - 1];
      if (!lastBreak || lastBreak.endedAt) return;

      const endedAt = new Date(now).toISOString();
      const durationMs = now - activeBreakStart;
      breaks[breaks.length - 1] = { ...lastBreak, endedAt, durationMs };
      const updatedPerformance: Performance = {
        ...currentPerformance,
        runReport: { ...currentPerformance.runReport, breaks },
      };
      if (!(await persistPerformance(updatedPerformance))) return;

      breakStartedAtRef.current = null;
      setBreakStartedAt(null);
      setBreakElapsedMs(0);
      runStartedAt.current = now;
      setTimerState("running");
      setActiveTab("operation");
      announceMilestone("Descanso finalizado");
      return;
    }

    if (timerState !== "running" && timerState !== "paused") return;
    const elapsed = getElapsedAt(runStartedAt.current, elapsedBeforeRun.current, now);
    const breaks = [
      ...currentPerformance.runReport.breaks,
      { startedAt: new Date(now).toISOString(), durationMs: 0 },
    ];
    const updatedPerformance: Performance = {
      ...currentPerformance,
      runReport: { ...currentPerformance.runReport, durationMs: elapsed, breaks },
    };

    if (timerState === "running") {
      elapsedBeforeRun.current = elapsed;
      runStartedAt.current = null;
      setElapsedMs(elapsed);
      setTimerState("paused");
    }
    breakStartedAtRef.current = now;
    setBreakStartedAt(now);
    setBreakElapsedMs(0);
    announceMilestone("Descanso iniciado");
    void persistPerformance(updatedPerformance);
  };

  const handleQuickIncident = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const description = quickIncidentDescription.trim();
    const currentPerformance = performanceRecordRef.current;
    if (!description || !currentPerformance?.runReport || !quickIncidentMoment || isSavingQuickIncident) return;

    setIsSavingQuickIncident(true);
    const elapsedMs = quickIncidentMoment.elapsedMs;
    const updatedPerformance: Performance = {
      ...currentPerformance,
      runReport: {
        ...currentPerformance.runReport,
        durationMs: elapsedMs,
        quickIncidents: [
          ...currentPerformance.runReport.quickIncidents,
          {
            id: crypto.randomUUID(),
            occurredAt: new Date(quickIncidentMoment.occurredAt).toISOString(),
            elapsedMs,
            elapsedMinutes: Math.floor(elapsedMs / 60_000),
            description,
          },
        ],
      },
    };

    const saved = await persistPerformance(updatedPerformance);
    setIsSavingQuickIncident(false);
    if (saved) {
      setQuickIncidentDescription("");
      setQuickIncidentMoment(null);
      setIsQuickIncidentOpen(false);
      setQuickIncidentSaved(true);
    }
  };

  const handleLaunchCue = async (cueOverride?: Cue) => {
    // Synchronous guard: while a launch is being saved, further activations are
    // ignored instead of queued (RF7). The button `disabled` state alone is not
    // enough, because React state updates are asynchronous.
    if (isLaunchingRef.current) return;

    if (danceProduction) {
      if (!cues || timerState === "finished") return;
      const cue = cueOverride ?? danceCandidate;
      if (!cue) return;

      const runtime = useDanceRuntimeStore.getState();
      const now = currentInstant();
      const mode = executionMode ?? "show";
      if (mode === "show" && cue.id !== danceCandidate?.id) {
        setRunSaveError(LAUNCH_REASON_NOT_NEXT);
        return;
      }
      const resolved = resolveCueTiming(cue, danceSchedule);
      const trackState = resolved.trackId ? runtime.getTrackState(resolved.trackId, now) : undefined;
      const showSample = runtime.showSample;
      const availability = getLaunchAvailability({
        candidate: cue,
        trackState,
        showRunning: showSample !== null && !showSample.pausedAt,
        mode,
        now,
      });
      if (!availability.launchable) {
        // One aria-live/alert region, shared with the inherited save errors.
        setRunSaveError(availability.reason ?? null);
        return;
      }

      const nextLaunchedIds = mode === "rehearsal"
        ? [...new Set([...danceLaunchedIdsRef.current, cue.id])]
        : [...danceLaunchedIdsRef.current, cue.id];
      const nextCount = mode === "rehearsal"
        ? Math.min(Math.max(launchedCountRef.current, nextLaunchedIds.length), cues.length)
        : Math.min(launchedCountRef.current + 1, cues.length);
      if (mode === "show" && (nextLaunchedIds.length === danceLaunchedIdsRef.current.length
        || nextCount === launchedCountRef.current)) return;

      const isFinished = !getNextCandidate({
        cues,
        schedule: danceSchedule,
        launchedIds: nextLaunchedIds,
        notReachedIds: danceExcludedIds,
        now: 0,
      });
      const elapsed = getElapsedAt(runStartedAt.current, elapsedBeforeRun.current, now);

      isLaunchingRef.current = true;
      setIsLaunchingCue(true);
      setRunSaveError(null);

      if (mode === "rehearsal") {
        // D7: rehearsal changes only in-memory state: no record and no lock.
        pendingDanceLaunchRef.current = null;
        danceLaunchedIdsRef.current = nextLaunchedIds;
        setDanceLaunchedIds(nextLaunchedIds);
        launchedCountRef.current = nextCount;
        setLaunchedCount(nextCount);
        announceMilestone(`Cue ${cue.identifier} lanzada`);
        isLaunchingRef.current = false;
        setIsLaunchingCue(false);
        return;
      }

      const previousRecord = performanceRecordRef.current;
      const hasOpenRecord = Boolean(previousRecord
        && previousRecord.productionId === danceProduction.id
        && isSessionOpenRecord(previousRecord, previousRecord.id));
      const isFirstLaunch = !hasOpenRecord;

      // Instant and active offsets are captured before saving: the snapshot and
      // its deviation are fixed once (D35/RF23).
      const trackActiveMs = resolved.trackId && trackState && trackState.status !== "Pendiente"
        ? runtime.getTrackActiveMs(resolved.trackId, now)
        : undefined;
      const showActiveMs = showSample ? runtime.getShowActiveMs(now) : undefined;
      const targetOffsetMs = resolved.status === "linked"
        ? resolved.trackOffsetMs
        : resolved.status === "absolute" ? resolved.atMs : undefined;
      const actualOffsetMs = resolved.status === "linked"
        ? trackActiveMs
        : resolved.status === "absolute" ? showActiveMs : undefined;

      const retry = pendingDanceLaunchRef.current;
      const event = retry?.event ?? buildCueLaunchEvent({
        cue,
        launchedAtMs: now,
        elapsedMs: elapsed,
        ...(showActiveMs !== undefined ? { showActiveMs } : {}),
        ...(resolved.trackStartAtMs !== undefined
          ? { trackStartAt: new Date(resolved.trackStartAtMs).toISOString() }
          : {}),
        ...(targetOffsetMs !== undefined ? { targetOffsetMs } : {}),
        ...(actualOffsetMs !== undefined ? { actualOffsetMs } : {}),
        now,
      });
      const launchElapsedMs = retry?.elapsedMs ?? elapsed;
      pendingDanceLaunchRef.current = { event, elapsedMs: launchElapsedMs };

      const revertDanceLaunch = () => {
        performanceRecordRef.current = previousRecord;
        syncDanceOpenRecordState(previousRecord);
        if (isFirstLaunch) setProductionSelectionLocked(false);
        isLaunchingRef.current = false;
        setIsLaunchingCue(false);
        // The pending snapshot is kept so a retry reuses the original instant.
      };

      let launchPerformance: Performance;
      try {
        const recordNow = Date.parse(event.launchedAt);
        const base: Performance = hasOpenRecord && previousRecord
          ? previousRecord
          : {
              ...openDanceRecord({
                productionId: danceProduction.id,
                totalCues: cues.length,
                now: recordNow,
              }),
              title: danceProduction.title,
            };
        launchPerformance = appendLaunch({
          performance: base,
          event,
          isFinished,
          elapsedMs: launchElapsedMs,
          now: recordNow,
        });
      } catch (buildError) {
        console.error(buildError);
        revertDanceLaunch();
        setRunSaveError("No se pudo crear el registro de la función. Vuelve a intentar el lanzamiento.");
        return;
      }

      const saved = await persistPerformance(launchPerformance);
      if (!saved) {
        revertDanceLaunch();
        return;
      }

      pendingDanceLaunchRef.current = null;
      if (isFirstLaunch) setProductionSelectionLocked(true);
      danceLaunchedIdsRef.current = nextLaunchedIds;
      setDanceLaunchedIds(nextLaunchedIds);
      launchedCountRef.current = nextCount;
      setLaunchedCount(nextCount);
      announceMilestone(isFinished
        ? `Cue ${cue.identifier} lanzada. Función finalizada`
        : `Cue ${cue.identifier} lanzada`);

      if (isFinished) {
        runStartedAt.current = null;
        elapsedBeforeRun.current = launchElapsedMs;
        setElapsedMs(launchElapsedMs);
        setTimerState("finished");
        setProductionSelectionLocked(false);
      }

      isLaunchingRef.current = false;
      setIsLaunchingCue(false);
      return;
    }

    const cueCount = cues?.length ?? null;
    const canLaunch = canLaunchNextCue({
      cueCount,
      launchedCueCount: launchedCountRef.current,
      isTimerFinished: timerState === "finished",
      isLaunching: isLaunchingRef.current,
    });
    if (!canLaunch || !selectedProduction || cueCount === null) return;

    const nextCount = Math.min(launchedCountRef.current + 1, cueCount);
    if (nextCount === launchedCountRef.current) return;

    isLaunchingRef.current = true;
    setIsLaunchingCue(true);

    const previousRecord = performanceRecordRef.current;
    const isFirstLaunch = !previousRecord?.runReport;
    const now = currentInstant();
    const elapsed = getElapsedAt(runStartedAt.current, elapsedBeforeRun.current, now);
    const isFinished = nextCount === cueCount;

    // Full reversal of a launch that cannot be completed. The snapshot taken
    // before the launch is restored, so the counter and the warned cue are not
    // touched, the timer keeps its state and the launch control becomes
    // available again for a retry. Two cases share this reversal:
    //
    // - First launch (RF12, CL5): there was no record, so the snapshot is
    //   `null` and no record is left behind. The production selection must not
    //   stay locked.
    // - Later launches (RF13, CL21): the snapshot is the record of the last
    //   successful save, so the saved `launchedCueCount` and the record in
    //   memory stay aligned and the production selection keeps its lock.
    const revertFailedLaunch = () => {
      performanceRecordRef.current = previousRecord;
      syncDanceOpenRecordState(previousRecord);
      if (isFirstLaunch) setProductionSelectionLocked(false);
      isLaunchingRef.current = false;
      setIsLaunchingCue(false);
    };

    let candidate: Performance;
    try {
      let base: Performance;
      if (isFirstLaunch) {
        // There is no open record yet: the launch opens it, even with the timer
        // stopped, so that no launch is lost (RF5, RF17).
        base = buildPerformanceRecord({ production: selectedProduction, totalCues: cueCount, now });
      } else if (previousRecord) {
        base = previousRecord;
      } else {
        throw new Error("Missing performance record for the cue launch");
      }

      candidate = applyCueLaunch({
        performance: base,
        launchedCueCount: nextCount,
        elapsedMs: elapsed,
        isFinished,
        now,
      });
    } catch (buildError) {
      // The record could not even be built, so nothing was saved (RF12).
      console.error(buildError);
      revertFailedLaunch();
      setRunSaveError("No se pudo crear el registro de la función. Vuelve a intentar el lanzamiento.");
      return;
    }

    const saved = await persistPerformance(candidate);

    if (!saved) {
      // The save queue already reported the failure (RF12/RF13). Nothing was
      // written, so the launch is undone and the record in memory goes back to
      // the last consistent saved state: the counter stays at its previous
      // value, the affected cue is still warned, the saved `launchedCueCount`
      // is preserved and the launch can be retried without reloading (RF13).
      revertFailedLaunch();
      return;
    }

    // The production selection is locked as soon as the record exists (RF18).
    if (isFirstLaunch) setProductionSelectionLocked(true);

    launchedCountRef.current = nextCount;
    setLaunchedCount(nextCount);
    const launchedIdentifier = cues?.[nextCount - 1]?.identifier ?? String(nextCount);
    announceMilestone(isFinished
      ? `Cue ${launchedIdentifier} lanzada. Función finalizada`
      : `Cue ${launchedIdentifier} lanzada`);

    if (isFinished) {
      runStartedAt.current = null;
      elapsedBeforeRun.current = elapsed;
      setElapsedMs(elapsed);
      setTimerState("finished");
      setProductionSelectionLocked(false);
    }

    isLaunchingRef.current = false;
    setIsLaunchingCue(false);
  };

  /** T8: close only this session's open record, with its still-open track runs. */
  const handleFinishDanceShow = async (): Promise<void> => {
    if (!danceProduction || danceMode !== "show" || isFinishingDanceRef.current) return;
    const record = sessionOpenRecord();
    if (!record) return;

    isFinishingDanceRef.current = true;
    try {
      const pendingCues = danceSequence.filter((cue) =>
        !danceLaunchedIds.includes(cue.id) && !danceExcludedIds.includes(cue.id)
      );
      if (pendingCues.length > 0 && !window.confirm(
        `Se cerrará la función con ${pendingCues.length} cues sin lanzar; quedarán como no alcanzadas.`
      )) {
        return;
      }

      const now = currentInstant();
      const elapsed = getElapsedAt(runStartedAt.current, elapsedBeforeRun.current, now);
      const runtime = useDanceRuntimeStore.getState();
      const trackRuns: TrackRun[] = [];
      for (const [trackId, trackRuntime] of Object.entries(runtime.trackRuntimes)) {
        if (trackRuntime.status !== "En marcha" && trackRuntime.status !== "Pausado") continue;
        const activeMs = runtime.getTrackActiveMs(trackId, now);
        const parsedStart = trackRuntime.startedAtMs
          ?? (trackRuntime.sample ? Date.parse(trackRuntime.sample.startedAt) : Number.NaN);
        trackRuns.push(closeTrackRun({
          trackId,
          title: danceTracks.find((track) => track.id === trackId)?.title ?? trackId,
          startedAtMs: Number.isFinite(parsedStart) ? parsedStart : now - activeMs,
          activeMs,
          endedBy: "manual",
          now,
        }));
      }

      const closed = finishPerformance({ performance: record, trackRuns, elapsedMs: elapsed, now });
      setRunSaveError(null);
      const saved = await persistPerformance(closed);
      if (!saved) {
        // The open record, the production lock and the running clocks stay put.
        performanceRecordRef.current = record;
        syncDanceOpenRecordState(record);
        setRunSaveError(DANCE_FINISH_ERROR);
        return;
      }

      runStartedAt.current = null;
      elapsedBeforeRun.current = elapsed;
      setElapsedMs(elapsed);
      setTimerState("finished");
      runtime.pauseShow(now);
      for (const track of danceTracks) {
        if (runtime.getTrackState(track.id, now).status !== "Terminado") {
          runtime.finishTrack(track.id, "manual", now);
        }
      }
      // The report derives this from `endedAt`; the live schedule mirrors it.
      const pendingWithTarget = pendingCues.filter((cue) => {
        const resolved = resolveCueTiming(cue, danceSchedule);
        return resolved.status === "linked" || resolved.status === "absolute";
      });
      handleNotReached([...new Set([
        ...danceExcludedIds,
        ...pendingWithTarget.map((cue) => cue.id),
      ])]);
      setProductionSelectionLocked(false);
      setDanceFinishedReportId(closed.id);
      announceMilestone("Función finalizada");
      await reloadDancePreviousOpenRecords();
    } finally {
      isFinishingDanceRef.current = false;
    }
  };

  /** T8: a discard really deletes the record and resets the whole session. */
  const handleDiscardDanceShow = async (): Promise<void> => {
    if (!danceProduction || danceMode !== "show" || isDiscardingDanceRef.current) return;
    const record = sessionOpenRecord();
    if (!record) return;

    isDiscardingDanceRef.current = true;
    try {
      if (!window.confirm(
        "Se anulará esta función: se borrará su registro y no contará en métricas ni en informes."
      )) {
        return;
      }
      try {
        await deletePerformance(record.id);
      } catch (deleteError) {
        console.error(deleteError);
        setRunSaveError(DANCE_DISCARD_ERROR);
        return;
      }
      setDanceFinishedReportId(null);
      pendingDanceLaunchRef.current = null;
      resetDanceExecution("show");
      announceMilestone("Función descartada");
      await reloadDancePreviousOpenRecords();
    } finally {
      isDiscardingDanceRef.current = false;
    }
  };

  /** Notes are the only editable cue field during a show; timing is untouched. */
  const handleSaveCueNote = async (cue: Cue, observations: string): Promise<void> => {
    await saveCue({ ...cue, observations });
    setCues((current) => current?.map((item) => (
      item.id === cue.id ? { ...item, observations } : item
    )) ?? current);
  };

  const handleProductionChange = useCallback((productionId: string) => {
    setSelectedProductionId(productionId);
    setActiveProjectId(productionId);
    setProductionSelectionLocked(false);
    setCues(null);
    setCueLoadError(null);
    setScriptDocument(null);
    setScriptLabels([]);
    setScriptDocumentLoading(true);
    setTotalScriptPages(0);
    setManualScriptPage({ cueId: null, page: 1 });
    setIsLibretoOpen(false);
    setTimerState("idle");
    setElapsedMs(0);
    elapsedBeforeRun.current = 0;
    runStartedAt.current = null;
    setLaunchedCount(0);
    launchedCountRef.current = 0;
    setDanceLaunchedIds([]);
    danceLaunchedIdsRef.current = [];
    setDanceNotReachedIds([]);
    setDanceSelectedCueId(null);
    setDanceFinishedReportId(null);
    setDancePreviousOpenRecords([]);
    pendingDanceLaunchRef.current = null;
    setBreakStartedAt(null);
    breakStartedAtRef.current = null;
    setBreakElapsedMs(0);
    setIsQuickIncidentOpen(false);
    setQuickIncidentDescription("");
    setQuickIncidentSaved(false);
    setQuickIncidentMoment(null);
    isStartingFunctionRef.current = false;
    setIsStartingFunction(false);
    setTecMode(false);
    setActiveTab("operation");
    setPreparationAlertState("idle");
    preparationAlertDeadline.current = null;
    setPreparationAlertSeconds(30 * 60);
    setPreparationChecks({
      soundPassed: false,
      microphones: false,
      stageManagement: false,
      machinery: false,
      lights: false,
      props: false,
    });
    performanceRecordRef.current = null;
    syncDanceOpenRecordState(null);
    setExecutionMode(null);
    setRunSaveError(null);
  }, [setActiveProjectId, setExecutionMode, setProductionSelectionLocked]);

  useEffect(() => {
    if (selectedProductionId === activeProjectId || (activeProjectId && productions.length === 0)) {
      return;
    }

    const timer = window.setTimeout(() => {
      handleProductionChange(activeProjectId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeProjectId, handleProductionChange, productions.length, selectedProductionId]);

  useEffect(() => () => setProductionSelectionLocked(false), [setProductionSelectionLocked]);

  const handlePreparationAlert = () => {
    if (preparationAlertState === "idle") {
      preparationAlertDeadline.current = currentInstant() + 30 * 60 * 1000;
      setPreparationAlertSeconds(30 * 60);
      setPreparationAlertState("running30");
    } else if (preparationAlertState === "waiting15") {
      preparationAlertDeadline.current = currentInstant() + preparationAlertSeconds * 1000;
      setPreparationAlertState("running15");
    } else if (preparationAlertState === "waiting5") {
      preparationAlertDeadline.current = null;
      setPreparationAlertState("done");
    }
  };

  const togglePreparationCheck = (key: PreparationCheckKey) => {
    setPreparationChecks((current) => ({ ...current, [key]: !current[key] }));
  };

  const completedAlertCount =
    preparationAlertState === "idle"
      ? 0
      : preparationAlertState === "running30" || preparationAlertState === "waiting15"
        ? 1
        : preparationAlertState === "running15" || preparationAlertState === "waiting5"
          ? 2
          : 3;
  const completedCheckCount = Object.values(preparationChecks).filter(Boolean).length;
  const progress = Math.round(((completedAlertCount + completedCheckCount) / 9) * 100);
  const isPreparationAlertRunning =
    preparationAlertState === "running30" || preparationAlertState === "running15";
  const isPreparationAlertWaiting =
    preparationAlertState === "waiting15" || preparationAlertState === "waiting5";

  // Danza derives its sequence from the pure schedule. Standard keeps the
  // inherited positional sequence untouched.
  const danceMode = executionMode ?? "show";
  const danceSchedule = buildSchedule({ tracks: danceTracks, cues: cues ?? [], now: 0 });
  const danceSequence = [...danceSchedule.timedCues, ...danceSchedule.untimedCues];
  const danceExcludedIds = [...new Set([...danceNotReachedIds, ...runtimeNotReachedIds])];
  const danceCandidate = getNextCandidate({
    cues: cues ?? [],
    schedule: danceSchedule,
    launchedIds: danceLaunchedIds,
    notReachedIds: danceExcludedIds,
    now: 0,
  });
  // Rehearsal may point at any cue; a show always follows the pure candidate.
  const danceLaunchCue = danceProduction
    ? (danceMode === "rehearsal"
        ? danceSequence.find((cue) => cue.id === danceSelectedCueId) ?? danceCandidate
        : danceCandidate)
    : undefined;
  const danceCandidateIndex = danceCandidate
    ? danceSequence.findIndex((item) => item.id === danceCandidate.id)
    : -1;
  const danceLaunchIndex = danceLaunchCue
    ? danceSequence.findIndex((item) => item.id === danceLaunchCue.id)
    : -1;
  const danceResolved = danceLaunchCue ? resolveCueTiming(danceLaunchCue, danceSchedule) : undefined;
  const danceTrackId = danceResolved?.status === "linked" ? danceResolved.trackId : undefined;
  const danceTrackState = danceTrackId ? getDanceTrackState(danceTrackId, danceNow) : undefined;
  const danceTrackActiveMs = danceTrackId && danceTrackState?.status !== "Pendiente"
    ? getDanceTrackActiveMs(danceTrackId, danceNow)
    : undefined;
  // No sample means no reference: a missing show clock must not invent `0`.
  const danceShowActiveMs = danceShowSample ? getDanceShowActiveMs(danceNow) : undefined;
  const danceShowRunning = danceShowSample !== null && !danceShowSample.pausedAt;
  const danceAvailability = danceLaunchCue
    ? getLaunchAvailability({
        candidate: danceLaunchCue,
        trackState: danceTrackState,
        showRunning: danceShowRunning,
        mode: danceMode,
        now: danceNow,
      })
    : undefined;
  const danceLaunchDisabledReason = danceAvailability && !danceAvailability.launchable
    ? danceAvailability.reason
    : undefined;

  // CL27: the badge exposes the block before the control is ever activated.
  const danceToggleReason = (() => {
    if (!danceProduction || danceMode !== "show") return undefined;
    const hasOpenRecord = danceShowBlockedByRecord;
    const hasRunningTrack = Object.values(danceTrackRuntimes)
      .some((runtime) => runtime.status === "En marcha");
    if (hasOpenRecord && hasRunningTrack) {
      return "Cierra la función y detén los tracks antes de cambiar a Ensayo.";
    }
    if (hasOpenRecord) return "No se puede cambiar a Ensayo con una función abierta.";
    if (hasRunningTrack) return "No se puede cambiar a Ensayo con un track en marcha.";
    return undefined;
  })();
  const danceFinishReason = danceProduction && danceMode === "show" && !danceShowBlockedByRecord
    ? Object.values(danceTrackRuntimes).some((runtime) => runtime.status === "En marcha")
      ? "Inicia la función o lanza una cue para poder finalizarla."
      : "No hay ninguna función en curso."
    : undefined;
  const showOperationTabs = timerState === "paused" || Boolean(danceProduction);

  // Vía 1 (last cue) closes the record inside the inherited launch flow; the
  // report link becomes available only once that closure is actually saved.
  useEffect(() => {
    if (!danceProduction || danceMode !== "show" || timerState !== "finished") return;
    const record = performanceRecordRef.current;
    if (record?.runReport?.endedAt && record.id !== danceFinishedReportId) {
      setDanceFinishedReportId(record.id);
    }
  }, [danceProduction, danceFinishedReportId, danceMode, timerState]);

  const launchedCues = danceProduction
    ? danceSequence.filter((cue) => danceLaunchedIds.includes(cue.id)).slice(-2)
    : cues?.slice(Math.max(0, launchedCount - 2), launchedCount) ?? [];
  const nextCue = danceProduction ? danceLaunchCue : cues?.[launchedCount];
  const launchCueReason = (() => {
    if (timerState === "finished") return "La función ya ha finalizado.";
    if (isLaunchingCue) return "Espera a que termine el lanzamiento anterior.";
    if (!nextCue) return "No hay ninguna cue pendiente de lanzar.";
    return danceProduction ? danceLaunchDisabledReason : undefined;
  })();
  const nextCueNumber = danceProduction && danceLaunchIndex >= 0
    ? danceLaunchIndex + 1
    : launchedCount + 1;
  const followingCues = danceProduction && danceCandidateIndex >= 0
    ? danceSequence.slice(danceCandidateIndex + 1, danceCandidateIndex + 4)
    : cues?.slice(launchedCount + 1, launchedCount + 4) ?? [];
  const cueProgress = cues?.length ? Math.round((launchedCount / cues.length) * 100) : 0;
  const isSequenceAvailable =
    Boolean(selectedProductionId) && !cueLoadError && cues !== null && cues.length > 0;
  const canStartFunction = Boolean(selectedProductionId && cues?.length);
  // T10/A2: every disabled control exposes the reason next to it.
  const startFunctionReason = (() => {
    if (timerState === "finished") return "La función ya ha finalizado.";
    if (isStartingFunction) return "Iniciando la función.";
    if (isLaunchingCue) return "Espera a que termine el lanzamiento.";
    if (breakStartedAt !== null) return "Retoma el descanso antes de continuar.";
    if (timerState === "idle" && !canStartFunction) {
      return "Crea o selecciona una producción con cues para iniciar la función.";
    }
    return undefined;
  })();
  const breakFunctionReason = breakStartedAt === null
    && timerState !== "running"
    && timerState !== "paused"
    ? "Inicia la función para poder registrar un descanso."
    : undefined;
  const libretoReason = !selectedProductionId
    ? "Selecciona una producción para ver su libreto."
    : undefined;
  const activeScriptCue = nextCue ?? cues?.[launchedCount - 1];
  const activeScriptCuePage = getCueScriptPage(activeScriptCue, scriptLabels);
  const requestedScriptPage =
    manualScriptPage.cueId === activeScriptCue?.id
      ? manualScriptPage.page
      : activeScriptCuePage ?? 1;
  const scriptPage = totalScriptPages > 0
    ? Math.max(1, Math.min(requestedScriptPage, totalScriptPages))
    : Math.max(1, requestedScriptPage);

  useEffect(() => {
    if (!isLibretoOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      if (event.key === "Escape") {
        setIsLibretoOpen(false);
      } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        if (totalScriptPages === 0) return;

        const page = event.key === "ArrowUp" ? scriptPage - 1 : scriptPage + 1;
        setManualScriptPage({
          cueId: activeScriptCue?.id ?? null,
          page: Math.max(1, Math.min(page, totalScriptPages)),
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeScriptCue?.id, isLibretoOpen, scriptPage, totalScriptPages]);

  return (
    <Card className={`border-slate-800 bg-slate-900/80 ${
      isLibretoOpen
        ? "fixed inset-0 z-50 flex h-dvh w-screen flex-col overflow-hidden rounded-none border-0 bg-slate-950 p-3 sm:p-4"
        : ""
    }`}>
      {/* T10/A2: the only polite milestone region. Save errors keep their role="alert". */}
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {milestoneAnnouncement}
      </p>
      <div className={`mb-5 flex flex-wrap items-center justify-between gap-3 ${isLibretoOpen ? "mb-3 shrink-0" : ""}`}>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Modo función</p>
        <h2 className="mt-2 text-xl font-semibold text-white">
          {selectedProduction?.title ?? "Selecciona una producción"}
        </h2>
        {productionLoadError && (
          <p role="alert" className="mt-2 text-sm text-rose-300">{productionLoadError}</p>
        )}
        </div>
      <div className="flex flex-wrap items-center gap-3">
        {!selectedProductionId && (
          <Link href="/proyectos" style={scaledSmStyle} className="inline-flex min-h-11 min-w-11 items-center rounded-xl border border-cyan-500/30 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">
            Crear proyecto
          </Link>
        )}
          <button
            type="button"
          disabled={!selectedProductionId}
          aria-describedby={libretoReason ? DANCE_LIBRETO_REASON_ID : undefined}
            aria-pressed={isLibretoOpen}
            aria-controls="libreto-performance-view"
            aria-keyshortcuts={isLibretoOpen ? "Escape" : undefined}
            onClick={() => {
              if (!isLibretoOpen) setActiveTab("operation");
              setIsLibretoOpen((open) => !open);
            }}
            style={scaledSmStyle}
            className={`inline-flex min-h-11 min-w-11 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
              isLibretoOpen
                ? "border-cyan-300 bg-cyan-400 text-slate-950"
                : "border-slate-600 bg-slate-900 text-slate-200 hover:border-slate-400"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <BookOpenText className="h-4 w-4" />
            Libreto
          </button>
          {libretoReason && (
            <p id={DANCE_LIBRETO_REASON_ID} className="w-full min-w-0 break-words text-[11px] text-amber-300">
              {libretoReason}
            </p>
          )}
          <span className={`rounded-full border px-3 py-1.5 text-sm ${
            timerState === "running"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : timerState === "paused"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                : timerState === "finished"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-slate-700 bg-slate-950 text-slate-300"
          }`}>
            {timerState === "running"
              ? "En curso"
              : timerState === "paused"
                ? "En pausa"
                : timerState === "finished"
                  ? "Finalizada"
                  : "En espera"}
          </span>
        </div>
        {danceProduction && (
          <div className="w-full min-w-0">
            <ModeBadge
              mode={danceMode}
              canToggle={!danceToggleReason}
              toggleReason={danceToggleReason}
              onToggle={handleToggleExecutionMode}
            />
          </div>
        )}
      </div>

      <div className={`grid gap-5 ${
        isLibretoOpen
          ? "min-h-0 flex-1 grid-rows-[minmax(0,65fr)_minmax(0,35fr)] md:grid-cols-[minmax(0,1.85fr)_minmax(17rem,1fr)] md:grid-rows-1"
          : "xl:grid-cols-[1.25fr_0.75fr]"
      }`}>
        {isLibretoOpen && (
          <div className="min-h-0 md:col-start-1 md:row-start-1">
            <ScriptPagePreview
              document={scriptDocument}
              documentLoading={scriptDocumentLoading}
              pageNumber={scriptPage}
              onPageChange={(page) =>
                setManualScriptPage({ cueId: activeScriptCue?.id ?? null, page })
              }
              onPageCountChange={setTotalScriptPages}
              cueIdentifier={activeScriptCue?.identifier}
              cueHasPage={activeScriptCuePage !== undefined}
            />
          </div>
        )}

        <div
          id="operation-control-rail"
          role={isLibretoOpen ? "region" : undefined}
          aria-label={isLibretoOpen ? "Cronómetro y secuencia de cues" : undefined}
          className={`space-y-4 ${
            isLibretoOpen ? "min-h-0 overflow-y-auto pr-1 md:col-start-2 md:row-start-1" : ""
          }`}
        >
          <section className="rounded-2xl border border-slate-700 bg-slate-950 p-5">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm text-slate-400">Cronómetro</p>
                <p
                  style={scaledClockStyle}
                  className="mt-2 min-w-0 max-w-full font-mono text-4xl font-semibold tabular-nums text-white sm:text-5xl"
                  aria-label={`Tiempo de función ${formatElapsedTime(elapsedMs)}`}
                  aria-live="off"
                >
                  {formatElapsedTime(elapsedMs)}
                </p>
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <button
                  type="button"
                  onClick={toggleTimer}
                  disabled={
                    timerState === "finished" ||
                    isStartingFunction ||
                    isLaunchingCue ||
                    breakStartedAt !== null ||
                    (timerState === "idle" && !canStartFunction)
                  }
                  aria-label={
                    timerState === "running"
                      ? "Pausar función"
                      : timerState === "paused"
                        ? "Reanudar función"
                        : timerState === "finished"
                          ? "Función finalizada"
                          : isStartingFunction
                            ? "Iniciando función"
                            : "Iniciar función"
                  }
                  aria-describedby={startFunctionReason ? DANCE_START_REASON_ID : undefined}
                  style={scaledSmStyle}
                  className={`inline-flex min-h-12 min-w-11 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                    timerState === "running"
                      ? "bg-amber-600 hover:bg-amber-500 focus-visible:outline-amber-300"
                      : "bg-emerald-600 hover:bg-emerald-500 focus-visible:outline-emerald-300"
                  }`}
                >
                  {timerState === "running"
                    ? <Pause className="h-5 w-5" />
                    : timerState === "finished"
                      ? <CheckCircle2 className="h-5 w-5" />
                      : <Play className="h-5 w-5" />}
                  {timerState === "running"
                    ? "Pausar"
                    : timerState === "paused"
                      ? "Reanudar"
                      : timerState === "finished"
                        ? "Finalizada"
                        : isStartingFunction
                          ? "Iniciando…"
                          : "Iniciar"}
                </button>
                <button
                  type="button"
                  onClick={() => void toggleBreak()}
                  disabled={
                    breakStartedAt === null &&
                    timerState !== "running" &&
                    timerState !== "paused"
                  }
                  aria-describedby={breakFunctionReason ? DANCE_BREAK_REASON_ID : undefined}
                  style={scaledSmStyle}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
                >
                  {breakStartedAt === null ? "Descanso" : "Retomamos"}
                </button>
                {startFunctionReason && (
                  <p id={DANCE_START_REASON_ID} className="min-w-0 break-words text-[11px] text-amber-300">
                    {startFunctionReason}
                  </p>
                )}
                {breakFunctionReason && (
                  <p id={DANCE_BREAK_REASON_ID} className="min-w-0 break-words text-[11px] text-amber-300">
                    {breakFunctionReason}
                  </p>
                )}
              </div>
            </div>

            {breakStartedAt !== null && (
              <p
                style={scaledBreakStyle}
                className="mt-3 min-w-0 max-w-full break-words text-right font-mono text-lg tabular-nums text-amber-200"
                aria-label={`Duración del descanso ${formatElapsedTime(breakElapsedMs)}`}
                aria-live="off"
              >
                Descanso {formatElapsedTime(breakElapsedMs)}
              </p>
            )}

            <div className="mt-5">
              <div className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-2 text-sm">
                <span style={scaledSmStyle} className="min-w-0 break-words text-slate-400">
                  Progreso de cues
                </span>
                <span style={scaledSmStyle} className="min-w-0 break-words font-semibold tabular-nums text-cyan-200">
                  {launchedCount}/{cues?.length ?? 0} · {cueProgress}%
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="Progreso de cues"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={cueProgress}
                aria-valuetext={`${launchedCount} de ${cues?.length ?? 0} cues lanzadas`}
                className="h-2.5 overflow-hidden rounded-full bg-slate-800"
              >
                <div
                  className="h-full rounded-full bg-cyan-400 transition-[width] duration-300"
                  style={{ width: `${cueProgress}%` }}
                />
              </div>
            </div>

            {(timerState === "running" || isQuickIncidentOpen) && (
              <div className="mt-4">
                {timerState === "running" && !isQuickIncidentOpen && (
                  <button
                    type="button"
                    onClick={() => {
                      const occurredAt = currentInstant();
                      setQuickIncidentSaved(false);
                      setQuickIncidentMoment({
                        occurredAt,
                        elapsedMs: getElapsedAt(runStartedAt.current, elapsedBeforeRun.current, occurredAt),
                      });
                      setIsQuickIncidentOpen(true);
                    }}
                    style={scaledSmStyle}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300"
                  >
                    Incidencia rápida
                  </button>
                )}
                {isQuickIncidentOpen && (
                  <form
                    onSubmit={handleQuickIncident}
                    className="space-y-3 rounded-xl border border-rose-500/25 bg-rose-500/5 p-3"
                  >
                    <label className="block space-y-2 text-sm text-slate-200">
                      <span>Descripción de la incidencia</span>
                      <textarea
                        autoFocus
                        required
                        value={quickIncidentDescription}
                        onChange={(event) => setQuickIncidentDescription(event.target.value)}
                        className="min-h-20 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                        placeholder="Describe brevemente lo ocurrido"
                      />
                    </label>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="submit"
                        disabled={isSavingQuickIncident}
                        aria-describedby={isSavingQuickIncident ? DANCE_INCIDENT_REASON_ID : undefined}
                        style={scaledSmStyle}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:cursor-wait disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300"
                      >
                        {isSavingQuickIncident ? "Guardando…" : "Guardar incidencia"}
                      </button>
                      {isSavingQuickIncident && (
                        <p id={DANCE_INCIDENT_REASON_ID} className="min-w-0 break-words text-[11px] text-amber-300">
                          Guardando la incidencia.
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setIsQuickIncidentOpen(false);
                          setQuickIncidentMoment(null);
                        }}
                        style={scaledSmStyle}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                )}
                {quickIncidentSaved && (
                  <p role="status" className="mt-2 text-sm text-emerald-300">
                    Incidencia guardada para el reporte.
                  </p>
                )}
              </div>
            )}

            {runSaveError && (
              <div role="alert" className="mt-3 space-y-2">
                <p className="text-sm text-rose-300">{runSaveError}</p>
                {(runSaveError === DANCE_FINISH_ERROR || runSaveError === DANCE_DISCARD_ERROR) && (
                  <button
                    type="button"
                    onClick={() => void (runSaveError === DANCE_FINISH_ERROR
                      ? handleFinishDanceShow()
                      : handleDiscardDanceShow())}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300"
                  >
                    {runSaveError === DANCE_FINISH_ERROR
                      ? "Reintentar finalización"
                      : "Reintentar descarte"}
                  </button>
                )}
              </div>
            )}
          </section>

          {danceProduction && danceMode === "show" && (
            <section
              aria-label="Cierre de función"
              className="rounded-2xl border border-slate-700 bg-slate-950 p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-cyan-200">Cierre de función</h3>
                {danceFinishedReportId && (
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                    Finalizada
                  </span>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleFinishDanceShow()}
                  disabled={!danceShowBlockedByRecord}
                  aria-describedby={danceFinishReason ? DANCE_FINISH_REASON_ID : undefined}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                >
                  Finalizar función
                </button>
                {danceShowBlockedByRecord && (
                  <button
                    type="button"
                    onClick={() => void handleDiscardDanceShow()}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300"
                  >
                    Descartar función
                  </button>
                )}
                {danceFinishedReportId && (
                  <Link
                    href={`/reportes/imprimir?performance=${danceFinishedReportId}`}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-semibold text-cyan-200 hover:border-cyan-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                  >
                    Ver informe
                  </Link>
                )}
              </div>
              {danceFinishReason && (
                <p id={DANCE_FINISH_REASON_ID} className="mt-3 text-xs text-amber-300">
                  {danceFinishReason}
                </p>
              )}
              {dancePreviousOpenRecords.length > 0 && (
                <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2">
                  <p className="text-xs font-semibold text-slate-300">Registros de sesiones anteriores</p>
                  <ul className="mt-1 space-y-1">
                    {dancePreviousOpenRecords.map((record) => (
                      <li key={record.id} className="text-xs text-slate-400">
                        registro de una sesión anterior: {record.title} · {record.date} {record.time}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {danceProduction && (
            <div className="space-y-4">
              <ShowClock />
              <TrackPanel
                productionId={danceProduction.id}
                tracks={danceTracks}
                cues={cues ?? []}
                mode={executionMode ?? "show"}
                notReachedIds={danceNotReachedIds}
                onTracksChanged={() => void reloadDanceTracks()}
                onTrackClosed={handleTrackClosed}
                onNotReached={handleNotReached}
                onAnnounce={announceMilestone}
              />
            </div>
          )}

          {showOperationTabs && (
            <div role="tablist" aria-label="Pestañas de función" className="flex flex-wrap gap-3 border-b border-slate-700">
              <button
                id="operation-tab-operation"
                type="button"
                role="tab"
                aria-controls="operation-panel-operation"
                aria-selected={activeTab === "operation"}
                onClick={() => setActiveTab("operation")}
                className={`min-h-11 min-w-11 border-b-2 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
                  activeTab === "operation"
                    ? "border-cyan-400 text-cyan-200"
                    : "border-transparent text-slate-400 hover:text-white"
                }`}
              >
                Operación
              </button>
              {danceProduction && (
                <button
                  id="operation-tab-document"
                  type="button"
                  role="tab"
                  aria-controls="operation-panel-document"
                  aria-selected={activeTab === "document"}
                  onClick={() => setActiveTab("document")}
                  className={`min-h-11 min-w-11 border-b-2 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
                    activeTab === "document"
                      ? "border-cyan-400 text-cyan-200"
                      : "border-transparent text-slate-400 hover:text-white"
                  }`}
                >
                  Documento
                </button>
              )}
              <button
                id="operation-tab-announcements"
                type="button"
                role="tab"
                aria-controls="operation-panel-announcements"
                aria-selected={activeTab === "announcements"}
                onClick={() => setActiveTab("announcements")}
                className={`min-h-11 min-w-11 border-b-2 px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300 ${
                  activeTab === "announcements"
                    ? "border-rose-400 text-rose-200"
                    : "border-transparent text-slate-300 hover:text-white"
                }`}
              >
                AVISOS EN SALA
              </button>
            </div>
          )}

          {showOperationTabs && activeTab === "announcements" ? (
            <section
              id="operation-panel-announcements"
              role="tabpanel"
              aria-labelledby="operation-tab-announcements"
              className="rounded-2xl border border-rose-500/25 bg-rose-500/5 p-5"
            >
              <div className="flex items-center gap-3">
                <BellRing className="h-5 w-5 text-rose-300" />
                <h3 className="font-semibold text-white">AVISOS EN SALA</h3>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Este espacio queda preparado para configurar los avisos al público.
              </p>
            </section>
          ) : showOperationTabs && activeTab === "document" && danceProduction ? (
            <section
              id="operation-panel-document"
              role="tabpanel"
              aria-labelledby="operation-tab-document"
              className="min-w-0"
            >
              <LiveSchedule
                cues={cues ?? []}
                schedule={danceSchedule}
                launchedIds={danceLaunchedIds}
                notReachedIds={danceExcludedIds}
                trackStates={Object.fromEntries(
                  danceTracks.map((track) => [
                    track.id,
                    getDanceTrackState(track.id, danceNow),
                  ] as const),
                )}
                nextCueId={danceCandidate?.id}
                now={danceNow}
              />
            </section>
          ) : isSequenceAvailable ? (
            <section
              id={showOperationTabs ? "operation-panel-operation" : undefined}
              role={showOperationTabs ? "tabpanel" : undefined}
              aria-labelledby={showOperationTabs ? "operation-tab-operation" : undefined}
              aria-label="Secuencia de cues"
              className="space-y-3"
            >
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                <h3 className="min-w-0 break-words font-semibold text-white">Secuencia de cues</h3>
                <span style={scaledTinyStyle} className="min-w-0 break-words text-xs text-slate-400">
                  {launchedCount} / {cues?.length ?? "…"} lanzadas
                </span>
              </div>

              <>
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                    <p style={scaledTinyStyle} className="min-w-0 break-words text-xs text-slate-400">
                      {launchedCount} / {cues?.length ?? 0} lanzadas
                    </p>
                    <button
                      type="button"
                      aria-pressed={tecMode}
                      aria-keyshortcuts={tecMode ? "ArrowLeft ArrowRight" : undefined}
                      title="Activa las flechas izquierda y derecha para retroceder o lanzar cues"
                      onClick={() => setTecMode((enabled) => !enabled)}
                      style={scaledSmStyle}
                      className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border px-4 py-2 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
                        tecMode
                          ? "border-cyan-300 bg-cyan-400 text-slate-950"
                          : "border-slate-600 bg-slate-900 text-slate-200 hover:border-slate-400"
                      }`}
                    >
                      tec
                    </button>
                  </div>
                  {tecMode && (
                    <p role="status" className="text-xs text-cyan-200">
                      tec activo: ← retrocede · → lanza
                    </p>
                  )}

                  {danceProduction && danceMode === "rehearsal" && (
                    <div className="min-w-0 space-y-1">
                      <label htmlFor="dance-rehearsal-cue-select" className="block text-xs font-semibold text-slate-300">
                        Cue a lanzar
                      </label>
                      <select
                        id="dance-rehearsal-cue-select"
                        value={danceLaunchCue?.id ?? ""}
                        onChange={(event) => setDanceSelectedCueId(event.target.value || null)}
                        className="min-h-11 w-full min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                      >
                        <option value="" disabled>Sin cues</option>
                        {danceSequence.map((cue, index) => (
                          <option key={cue.id} value={cue.id}>
                            {`${index + 1}. ${cue.identifier} — ${cue.description || "Sin descripción"}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <ol className="space-y-2">
                    {launchedCues.map((cue) => (
                      <li
                        key={cue.id}
                        className="flex items-start justify-between gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <CueTypeBadge
                              type={cue.type}
                              includedTypes={cue.includedTypes}
                              className="px-2 py-0.5"
                            >
                              {cue.type}
                            </CueTypeBadge>
                            <span className="font-semibold text-white">{cue.identifier}</span>
                          </div>
                          <p className="mt-1 text-sm text-slate-300">{cue.description}</p>
                          {cue.pie?.trim() && (
                            <p className="mt-1 text-xs text-cyan-200">
                              <span className="font-semibold">Pie:</span> {cue.pie}
                            </p>
                          )}
                        </div>
                        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-300">
                          <CheckCircle2 className="h-4 w-4" />
                          Lanzado
                        </span>
                      </li>
                    ))}
                  </ol>

                  {nextCue ? (
                    <div className="rounded-2xl border border-rose-500/50 bg-rose-500/5 p-4">
                      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-rose-400/50 bg-rose-500/15 px-3 py-1 text-xs font-bold tracking-wide text-rose-200">
                            ¡PREVENIDO!
                          </span>
                          {nextCue.pie?.trim() && (
                            <p className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-1.5 text-sm leading-6 text-cyan-100">
                              <span className="font-semibold text-cyan-300">Pie:</span> {nextCue.pie}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-slate-400">
                          Cue {nextCueNumber} de {cues?.length ?? 0}
                        </span>
                      </div>
                      {danceProduction && danceLaunchCue && danceResolved && (
                        <Countdown
                          cue={danceLaunchCue}
                          resolved={danceResolved}
                          trackState={danceTrackState}
                          trackActiveMs={danceTrackActiveMs}
                          showActiveMs={danceShowActiveMs}
                          isNext
                          launched={false}
                          onLaunch={() => void handleLaunchCue(danceLaunchCue)}
                          launchDisabledReason={danceLaunchDisabledReason}
                        />
                      )}
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <CueTypeBadge
                              type={nextCue.type}
                              includedTypes={nextCue.includedTypes}
                            >
                              {nextCue.type}
                            </CueTypeBadge>
                            <h4 className="text-xl font-semibold text-white">{nextCue.identifier}</h4>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-300">{nextCue.description}</p>
                          <p className="mt-2 text-xs text-slate-500">
                            {nextCue.act} · Escena {nextCue.scene} · {nextCue.department}
                          </p>
                        </div>
                        <button
                          ref={launchButtonRef}
                          type="button"
                          disabled={
                            isLaunchingCue || timerState === "finished" || !nextCue
                            || Boolean(danceProduction && danceLaunchDisabledReason)
                          }
                          onClick={() => void handleLaunchCue(danceProduction ? danceLaunchCue : undefined)}
                          // A held key repeats its default activation (RF7a). The
                          // click is a mouse event and cannot see `event.repeat`,
                          // so the repeated keydown default action is cancelled
                          // here: only the first press of the held key launches.
                          onKeyDown={(event) => {
                            if (event.repeat) event.preventDefault();
                          }}
                          aria-label={`${getLaunchActionLabel(nextCue.type, nextCue.includedTypes)} cue ${nextCue.identifier}`}
                          aria-describedby={launchCueReason ? DANCE_LAUNCH_REASON_ID : undefined}
                          style={scaledSmStyle}
                          className="inline-flex min-h-11 min-w-11 max-w-full items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
                        >
                          <Play className="h-4 w-4" />
                          {getLaunchActionLabel(nextCue.type, nextCue.includedTypes)}
                        </button>
                        {launchCueReason && (
                          <p id={DANCE_LAUNCH_REASON_ID} className="min-w-0 break-words text-xs font-medium text-amber-300">
                            {launchCueReason}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                      Todas las cues de esta función se han lanzado.
                    </div>
                  )}

                  {followingCues.length > 0 && (
                    <ol aria-label="Tres cues siguientes" className="space-y-2">
                      {followingCues.map((cue, index) => (
                        <li
                          key={cue.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="shrink-0 text-xs text-slate-500">
                              Cue {nextCueNumber + index + 1}
                            </span>
                            <CueTypeBadge
                              type={cue.type}
                              includedTypes={cue.includedTypes}
                              className="shrink-0 px-2 py-0.5"
                            >
                              {cue.type}
                            </CueTypeBadge>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-200">{cue.identifier}</p>
                              <p className="truncate text-xs text-slate-500">{cue.description}</p>
                              {cue.pie?.trim() && (
                                <p className="truncate text-xs text-cyan-200">
                                  <span className="font-semibold">Pie:</span> {cue.pie}
                                </p>
                              )}
                            </div>
                          </div>
                          <span className="shrink-0 text-xs text-slate-500">En cola</span>
                        </li>
                      ))}
                    </ol>
                  )}

                  {danceProduction && danceLaunchCue && (
                    <section
                      aria-label={`Nota de ${danceLaunchCue.identifier}`}
                      className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/70 p-4"
                    >
                      <h3 className="mb-3 text-sm font-semibold text-cyan-200">Nota de cue</h3>
                      <CueNote
                        key={danceLaunchCue.id}
                        cue={danceLaunchCue}
                        onSave={(observations) => handleSaveCueNote(danceLaunchCue, observations)}
                      />
                    </section>
                  )}
                </>
            </section>
          ) : (
            <section className="rounded-2xl border border-dashed border-slate-700 p-5 text-sm text-slate-400">
              {!selectedProductionId ? (
                "Crea o selecciona una producción para preparar la función."
              ) : cueLoadError ? (
                <p role="alert" className="text-rose-300">{cueLoadError}</p>
              ) : cues === null ? (
                "Cargando cues de la producción…"
              ) : (
                "Esta producción no tiene cues para lanzar."
              )}
            </section>
          )}
        </div>

        {!isLibretoOpen && (
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-cyan-300">
                <ListChecks className="h-4 w-4" />
                <h3 className="text-sm font-semibold">Preparación a función</h3>
              </div>
              <span className="text-sm font-semibold text-slate-200">{progress}%</span>
            </div>
            <div
              role="progressbar"
              aria-label="Preparación a función"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              aria-valuetext={`${completedCheckCount} de 6 checks y ${completedAlertCount} de 3 avisos completados`}
              className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-800"
            >
              <div className="h-full rounded-full bg-cyan-400" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {completedCheckCount}/6 checks · {completedAlertCount}/3 avisos
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handlePreparationAlert}
                disabled={isPreparationAlertRunning || preparationAlertState === "done"}
                aria-label={getPreparationAlertLabel(preparationAlertState)}
                className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-default ${
                  isPreparationAlertWaiting
                    ? "border-red-400 bg-red-600 text-white hover:bg-red-500"
                    : isPreparationAlertRunning || preparationAlertState === "done"
                      ? "border-emerald-400 bg-emerald-600 text-white"
                      : "border-slate-600 bg-slate-900 text-slate-200 hover:border-slate-400"
                }`}
              >
                {preparationAlertState === "done"
                  ? <CheckCircle2 className="h-4 w-4" />
                  : <Clock3 className="h-4 w-4" />}
                {getPreparationAlertLabel(preparationAlertState)}
              </button>
              {preparationAlertState !== "idle" && (
                <div className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
                  <span className="text-xs text-slate-400">Cuenta atrás</span>
                  <span
                    aria-label={`Quedan ${formatCountdown(preparationAlertSeconds)}`}
                    aria-live="off"
                    className="font-mono text-lg font-semibold tabular-nums text-white"
                  >
                    {formatCountdown(preparationAlertSeconds)}
                  </span>
                </div>
              )}
            </div>

            <fieldset className="mt-5 space-y-2">
              <legend className="text-sm font-medium text-slate-200">Sonido</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {([
                  { key: "soundPassed", label: "Pasada" },
                  { key: "microphones", label: "Micros" },
                ] as const).map((check) => (
                  <label
                    key={check.key}
                    className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200"
                  >
                    <input
                      type="checkbox"
                      checked={preparationChecks[check.key]}
                      onChange={() => togglePreparationCheck(check.key)}
                      className="h-4 w-4 accent-emerald-500"
                    />
                    {check.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="mt-4 space-y-2">
              <legend className="text-sm font-medium text-slate-200">Departamentos</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {departmentChecks.map((check) => (
                  <label
                    key={check.key}
                    className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200"
                  >
                    <input
                      type="checkbox"
                      checked={preparationChecks[check.key]}
                      onChange={() => togglePreparationCheck(check.key)}
                      className="h-4 w-4 accent-emerald-500"
                    />
                    {check.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </section>

        </div>
        )}
      </div>
    </Card>
  );
}
