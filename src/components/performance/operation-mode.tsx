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
import {
  getCuesByProduction,
  getProductions,
  getScriptDocument,
  getScriptLabels,
  savePerformance,
} from "@/lib/data-service";
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
  CueType,
  Performance,
  Production,
  ScriptDocument,
  ScriptLabel,
} from "@/lib/types";
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
type OperationTab = "operation" | "announcements";
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
  const [cueLoadError, setCueLoadError] = useState<string | null>(null);
  const [productionLoadError, setProductionLoadError] = useState<string | null>(null);
  const [runSaveError, setRunSaveError] = useState<string | null>(null);
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
  const selectedProduction = productions.find((production) => production.id === selectedProductionId);
  const runStartedAt = useRef<number | null>(null);
  const elapsedBeforeRun = useRef(0);
  const launchedCountRef = useRef(0);
  const breakStartedAtRef = useRef<number | null>(null);
  const performanceRecordRef = useRef<Performance | null>(null);
  const performanceSaveQueue = useRef<Promise<void>>(Promise.resolve());
  const isStartingFunctionRef = useRef(false);
  const isLaunchingRef = useRef(false);
  const launchButtonRef = useRef<HTMLButtonElement | null>(null);
  const preparationAlertDeadline = useRef<number | null>(null);

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
    if (timerState !== "running") return;

    const interval = window.setInterval(() => {
      const start = runStartedAt.current;
      if (start !== null) {
        setElapsedMs(elapsedBeforeRun.current + Date.now() - start);
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, [timerState]);

  useEffect(() => {
    if (breakStartedAt === null) return;

    const interval = window.setInterval(() => {
      setBreakElapsedMs(Date.now() - breakStartedAt);
    }, 250);

    return () => window.clearInterval(interval);
  }, [breakStartedAt]);

  useEffect(() => {
    if (preparationAlertState !== "running30" && preparationAlertState !== "running15") return;

    const interval = window.setInterval(() => {
      const deadline = preparationAlertDeadline.current;
      if (deadline === null) return;

      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
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

  const persistPerformance = (performance: Performance): Promise<boolean> => {
    performanceRecordRef.current = performance;
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

  const toggleTimer = async () => {
    if (timerState === "running") {
      const now = Date.now();
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
      runStartedAt.current = Date.now();
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
    const now = Date.now();
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

    const now = Date.now();
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

  const handleLaunchCue = async () => {
    // Synchronous guard: while a launch is being saved, further activations are
    // ignored instead of queued (RF7). The button `disabled` state alone is not
    // enough, because React state updates are asynchronous.
    if (isLaunchingRef.current) return;

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
    const now = Date.now();
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
    setRunSaveError(null);
  }, [setActiveProjectId, setProductionSelectionLocked]);

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
      preparationAlertDeadline.current = Date.now() + 30 * 60 * 1000;
      setPreparationAlertSeconds(30 * 60);
      setPreparationAlertState("running30");
    } else if (preparationAlertState === "waiting15") {
      preparationAlertDeadline.current = Date.now() + preparationAlertSeconds * 1000;
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

  const launchedCues = cues?.slice(Math.max(0, launchedCount - 2), launchedCount) ?? [];
  const nextCue = cues?.[launchedCount];
  const followingCues = cues?.slice(launchedCount + 1, launchedCount + 4) ?? [];
  const cueProgress = cues?.length ? Math.round((launchedCount / cues.length) * 100) : 0;
  const isSequenceAvailable =
    Boolean(selectedProductionId) && !cueLoadError && cues !== null && cues.length > 0;
  const canStartFunction = Boolean(selectedProductionId && cues?.length);
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
          <Link href="/proyectos" className="min-h-10 rounded-xl border border-cyan-500/30 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-500/10">
            Crear proyecto
          </Link>
        )}
          <button
            type="button"
          disabled={!selectedProductionId}
            aria-pressed={isLibretoOpen}
            aria-controls="libreto-performance-view"
            aria-keyshortcuts={isLibretoOpen ? "Escape" : undefined}
            onClick={() => {
              if (!isLibretoOpen) setActiveTab("operation");
              setIsLibretoOpen((open) => !open);
            }}
            className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
              isLibretoOpen
                ? "border-cyan-300 bg-cyan-400 text-slate-950"
                : "border-slate-600 bg-slate-900 text-slate-200 hover:border-slate-400"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <BookOpenText className="h-4 w-4" />
            Libreto
          </button>
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
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm text-slate-400">Cronómetro</p>
                <p
                  className="mt-2 font-mono text-4xl font-semibold tabular-nums text-white sm:text-5xl"
                  aria-label={`Tiempo de función ${formatElapsedTime(elapsedMs)}`}
                  aria-live="off"
                >
                  {formatElapsedTime(elapsedMs)}
                </p>
              </div>
              <div className="flex flex-col gap-2">
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
                  className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
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
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {breakStartedAt === null ? "Descanso" : "Retomamos"}
                </button>
              </div>
            </div>

            {breakStartedAt !== null && (
              <p
                className="mt-3 text-right font-mono text-lg tabular-nums text-amber-200"
                aria-label={`Duración del descanso ${formatElapsedTime(breakElapsedMs)}`}
                aria-live="off"
              >
                Descanso {formatElapsedTime(breakElapsedMs)}
              </p>
            )}

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-slate-400">Progreso de cues</span>
                <span className="font-semibold tabular-nums text-cyan-200">
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
                      const occurredAt = Date.now();
                      setQuickIncidentSaved(false);
                      setQuickIncidentMoment({
                        occurredAt,
                        elapsedMs: getElapsedAt(runStartedAt.current, elapsedBeforeRun.current, occurredAt),
                      });
                      setIsQuickIncidentOpen(true);
                    }}
                    className="min-h-10 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/20"
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
                        className="min-h-10 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:cursor-wait disabled:opacity-50"
                      >
                        {isSavingQuickIncident ? "Guardando…" : "Guardar incidencia"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsQuickIncidentOpen(false);
                          setQuickIncidentMoment(null);
                        }}
                        className="min-h-10 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
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
              <p role="alert" className="mt-3 text-sm text-rose-300">{runSaveError}</p>
            )}
          </section>

          {timerState === "paused" && (
            <div role="tablist" aria-label="Pestañas de función" className="flex flex-wrap gap-3 border-b border-slate-700">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "operation"}
                onClick={() => setActiveTab("operation")}
                className={`border-b-2 px-3 py-2 text-sm ${
                  activeTab === "operation"
                    ? "border-cyan-400 text-cyan-200"
                    : "border-transparent text-slate-400 hover:text-white"
                }`}
              >
                Operación
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "announcements"}
                onClick={() => setActiveTab("announcements")}
                className={`border-b-2 px-3 py-2 text-sm font-semibold ${
                  activeTab === "announcements"
                    ? "border-rose-400 text-rose-200"
                    : "border-transparent text-slate-300 hover:text-white"
                }`}
              >
                AVISOS EN SALA
              </button>
            </div>
          )}

          {timerState === "paused" && activeTab === "announcements" ? (
            <section role="tabpanel" className="rounded-2xl border border-rose-500/25 bg-rose-500/5 p-5">
              <div className="flex items-center gap-3">
                <BellRing className="h-5 w-5 text-rose-300" />
                <h3 className="font-semibold text-white">AVISOS EN SALA</h3>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Este espacio queda preparado para configurar los avisos al público.
              </p>
            </section>
          ) : isSequenceAvailable ? (
            <section aria-label="Secuencia de cues" className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-white">Secuencia de cues</h3>
                <span className="text-xs text-slate-400">{launchedCount} / {cues?.length ?? "…"} lanzadas</span>
              </div>

              <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-slate-400">
                      {launchedCount} / {cues?.length ?? 0} lanzadas
                    </p>
                    <button
                      type="button"
                      aria-pressed={tecMode}
                      aria-keyshortcuts={tecMode ? "ArrowLeft ArrowRight" : undefined}
                      title="Activa las flechas izquierda y derecha para retroceder o lanzar cues"
                      onClick={() => setTecMode((enabled) => !enabled)}
                      className={`min-h-10 rounded-lg border px-4 py-2 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
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
                          Cue {launchedCount + 1} de {cues?.length ?? 0}
                        </span>
                      </div>
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
                          disabled={isLaunchingCue || timerState === "finished" || !nextCue}
                          onClick={() => void handleLaunchCue()}
                          // A held key repeats its default activation (RF7a). The
                          // click is a mouse event and cannot see `event.repeat`,
                          // so the repeated keydown default action is cancelled
                          // here: only the first press of the held key launches.
                          onKeyDown={(event) => {
                            if (event.repeat) event.preventDefault();
                          }}
                          aria-label={`${getLaunchActionLabel(nextCue.type, nextCue.includedTypes)} cue ${nextCue.identifier}`}
                          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
                        >
                          <Play className="h-4 w-4" />
                          {getLaunchActionLabel(nextCue.type, nextCue.includedTypes)}
                        </button>
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
                              Cue {launchedCount + index + 2}
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
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-default ${
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
