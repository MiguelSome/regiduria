"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, MouseEvent } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  MapPinned,
  Trash2,
  Upload,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";

import { Card } from "@/components/ui/card";
import { CueTypeBadge } from "@/components/cues/cue-type-badge";
import {
  cueComponentOptions,
  cueDepartmentByType,
  cueTypeOptions,
  getCueColorClasses,
  getCueMixedColorStyle,
} from "@/lib/cue-presentation";
import {
  getCueIdentifierPattern,
  getCueIdentifierType,
} from "@/lib/cue-identifiers";
import {
  deleteScriptDocument,
  deleteScriptLabel,
  getCuesByProduction,
  getProductions,
  getNextScriptCueIdentifier,
  getScriptDocument,
  getScriptLabels,
  renameScriptDocument,
  saveScriptDocument,
  saveScriptLabel,
} from "@/lib/data-service";
import type {
  Cue,
  CueComponentType,
  CueType,
  DepartmentName,
  Production,
  ScriptLabel,
  ScriptLabelCategory,
} from "@/lib/types";
import { useUiStore } from "@/store/ui-store";

pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

type PdfStatus = "idle" | "loading" | "ready" | "error";
type ClickedPoint = { page: number; x: number; y: number };
type LabelSection = "structure" | "cues";

function getCategoryLabel(category: ScriptLabelCategory): string {
  if (category === "act") return "Acto";
  if (category === "scene") return "Escena";
  return "Cue";
}

function getMarkerColor(
  category: ScriptLabelCategory,
  cueType?: CueType,
  includedTypes?: readonly CueComponentType[],
) {
  if (category === "act") {
    return { className: "border-violet-300 bg-violet-600 text-white", style: undefined };
  }
  if (category === "scene") {
    return { className: "border-amber-300 bg-amber-500 text-slate-950", style: undefined };
  }

  const type = cueType ?? "LX";
  const style = getCueMixedColorStyle(type, includedTypes);
  return {
    className: `${getCueColorClasses(type)} ${style ? "border-white/70" : ""}`,
    style,
  };
}

const hiddenLabelDepartments = new Set<DepartmentName>([
  "Reparto",
  "Vestuario",
  "Vídeo",
  "Regiduría",
]);

const noProduction: Production = {
  id: "",
  title: "",
  subtitle: "",
  venue: "",
  status: "Activa",
  syncStatus: "Pendiente",
  lastUpdated: "",
  summary: "",
  departments: [],
  scenes: [],
};

export function LibretoViewer() {
  const [projects, setProjects] = useState<Production[]>([]);
  const selectedProjectId = useUiStore((state) => state.selectedProjectId);
  const setSelectedProjectId = useUiStore((state) => state.setSelectedProjectId);
  const production = projects.find((project) => project.id === selectedProjectId) ?? noProduction;
  const [projectsLoading, setProjectsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pdfTask, setPdfTask] = useState<pdfjsLib.PDFDocumentLoadingTask | null>(null);
  const cueIdentifierRequestId = useRef(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scriptDocument, setScriptDocument] = useState<Awaited<ReturnType<typeof getScriptDocument>>>();
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [labels, setLabels] = useState<ScriptLabel[]>([]);
  const [cues, setCues] = useState<Cue[]>([]);
  const [status, setStatus] = useState<PdfStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [clickedPoint, setClickedPoint] = useState<ClickedPoint | null>(null);
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
  const [expandedDepartment, setExpandedDepartment] = useState<DepartmentName | null>(null);
  const [expandedAct, setExpandedAct] = useState<string | null>(null);
  const [labelSection, setLabelSection] = useState<LabelSection | null>(null);
  const [category, setCategory] = useState<ScriptLabelCategory | "">("");
  const [cueType, setCueType] = useState<CueType>("LX");
  const [includedTypes, setIncludedTypes] = useState<CueComponentType[]>(["LX", "MOV"]);
  const [cueIdentifier, setCueIdentifier] = useState("");
  const [cueIdentifierSuggestion, setCueIdentifierSuggestion] = useState("");
  const [cueIdentifierLoading, setCueIdentifierLoading] = useState(false);
  const [labelTitle, setLabelTitle] = useState("");
  const [labelPie, setLabelPie] = useState("");

  useEffect(() => {
    let active = true;
    void getProductions()
      .then((savedProjects) => {
        if (!active) return;
        setProjects(savedProjects);
        const selectedProject =
          savedProjects.find((project) => project.id === selectedProjectId) ?? savedProjects[0];
        setSelectedProjectId(selectedProject?.id ?? "");
        setProjectsLoading(false);
      })
      .catch((loadError: unknown) => {
        console.error(loadError);
        if (active) {
          setStatus("error");
          setError("No se pudieron cargar los proyectos guardados.");
          setProjectsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedProjectId, setSelectedProjectId]);

  useEffect(() => {
    let active = true;

    const restoreSavedPdf = async () => {
      try {
        const savedDocument = production.id
          ? await getScriptDocument(production.id)
          : undefined;
        if (!production.id || !savedDocument) {
          if (!active) return;
          setPdfDoc(null);
          setPdfTask(null);
          setScriptDocument(undefined);
          setLabels([]);
          setCues([]);
          setTotalPages(0);
          setPageNumber(1);
          setStatus("idle");
          return;
        }

        const bytes = new Uint8Array(await savedDocument.pdfData.arrayBuffer());
        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        const loadedDocument = await loadingTask.promise;
        const [savedLabels, productionCues] = await Promise.all([
          getScriptLabels(savedDocument.id),
          getCuesByProduction(production.id),
        ]);

        if (!active) {
          await loadingTask.destroy();
          return;
        }

        setScriptDocument(savedDocument);
        setLabels(savedLabels);
        setCues(productionCues);
        setPdfDoc(loadedDocument);
        setPdfTask(loadingTask);
        setTotalPages(loadedDocument.numPages);
        setStatus("ready");
      } catch (loadError) {
        console.error(loadError);
        if (active) {
          setStatus("error");
          setError("No se pudo recuperar el libreto guardado en este dispositivo.");
        }
      }
    };

    void restoreSavedPdf();
    return () => {
      active = false;
    };
  }, [production.id]);

  useEffect(() => {
    if (!pdfDoc) return;

    let cancelled = false;
    let renderTask: pdfjsLib.RenderTask | undefined;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.15 });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        const context = canvas.getContext("2d");
        if (!context) {
          throw new Error("No se pudo preparar el lienzo para el PDF.");
        }

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        renderTask = page.render({ canvas, canvasContext: context, viewport });
        await renderTask.promise;
      } catch (renderError) {
        if (!cancelled) {
          console.error(renderError);
          setError("No se pudo dibujar esta página del PDF.");
        }
      }
    };

    void renderPage();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pageNumber, pdfDoc]);

  useEffect(() => {
    return () => {
      if (pdfTask) void pdfTask.destroy();
    };
  }, [pdfTask]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setStatus("error");
      setError("Selecciona un archivo PDF válido.");
      return;
    }

    if (
      scriptDocument &&
      !window.confirm(
        "Ya hay un libreto guardado. Reemplazarlo eliminará sus etiquetas y los cues generados desde ellas. ¿Quieres continuar?",
      )
    ) {
      return;
    }

    let loadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;
    try {
      setStatus("loading");
      setError(null);
      const bytes = new Uint8Array(await file.arrayBuffer());
      loadingTask = pdfjsLib.getDocument({ data: bytes });
      const loadedDocument = await loadingTask.promise;
      const savedDocument = await saveScriptDocument(production.id, file.name, file);
      const [savedLabels, productionCues] = await Promise.all([
        getScriptLabels(savedDocument.id),
        getCuesByProduction(production.id),
      ]);

      setScriptDocument(savedDocument);
      setIsEditingName(false);
      setPdfDoc(loadedDocument);
      setPdfTask(loadingTask);
      loadingTask = null;
      setLabels(savedLabels);
      setCues(productionCues);
      setTotalPages(loadedDocument.numPages);
      setPageNumber(1);
      setClickedPoint(null);
      setSelectedLabelId(null);
      setExpandedDepartment(null);
      setExpandedAct(null);
      setStatus("ready");
    } catch (loadError) {
      if (loadingTask) void loadingTask.destroy();
      console.error(loadError);
      setStatus("error");
      setError("No se pudo leer o guardar el PDF. Comprueba el archivo y el espacio disponible.");
    }
  };

  const handlePageClick = (event: MouseEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;

    setClickedPoint({
      page: pageNumber,
      x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
      y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
    });
    cueIdentifierRequestId.current += 1;
    setCueIdentifierLoading(false);
    setSelectedLabelId(null);
    setLabelSection(null);
    setCategory("");
    setCueIdentifier("");
    setCueIdentifierSuggestion("");
    setLabelTitle("");
    setLabelPie("");
  };

  const handleCueTypeSelect = async (nextType: CueType) => {
    if (!clickedPoint || !scriptDocument) return;

    const requestId = ++cueIdentifierRequestId.current;
    setCueType(nextType);
    setIncludedTypes(nextType === "SIM" ? ["LX", "MOV"] : []);
    setCueIdentifier("");
    setCueIdentifierSuggestion("");
    setCueIdentifierLoading(true);
    setCategory("cue");
    setLabelTitle("");
    setLabelPie("");
    setError(null);

    try {
      const identifier = await getNextScriptCueIdentifier(
        scriptDocument.id,
        production.id,
        clickedPoint.page,
        clickedPoint.x,
        clickedPoint.y,
        nextType,
      );
      if (requestId !== cueIdentifierRequestId.current) return;
      setCueIdentifier(identifier);
      setCueIdentifierSuggestion(identifier);
    } catch (identifierError) {
      console.error(identifierError);
      if (requestId === cueIdentifierRequestId.current) {
        setError("No se pudo calcular el identificador del cue.");
      }
    } finally {
      if (requestId === cueIdentifierRequestId.current) {
        setCueIdentifierLoading(false);
      }
    }
  };

  const handleSaveLabel = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!scriptDocument || !clickedPoint || !category) return;

    try {
      setError(null);
      const createdLabel = await saveScriptLabel({
        documentId: scriptDocument.id,
        productionId: production.id,
        category,
        title: labelTitle.trim(),
        page: clickedPoint.page,
        x: clickedPoint.x,
        y: clickedPoint.y,
        ...(category === "cue"
          ? {
              cueType,
              pie: labelPie.trim(),
              ...(cueIdentifier.trim() !== cueIdentifierSuggestion
                ? { cueIdentifierOverride: cueIdentifier.trim() }
                : {}),
              ...(cueType === "SIM" ? { includedTypes } : {}),
            }
          : {}),
      });
      const [nextLabels, productionCues] = await Promise.all([
        getScriptLabels(scriptDocument.id),
        getCuesByProduction(production.id),
      ]);
      setLabels(nextLabels);
      setCues(productionCues);
      setSelectedLabelId(createdLabel.id);
      setClickedPoint(null);
      setLabelSection(null);
      setCategory("");
      setCueIdentifier("");
      setCueIdentifierSuggestion("");
      setLabelTitle("");
      setLabelPie("");
      setStatus("ready");
    } catch (saveError) {
      console.error(saveError);
      setError("No se pudo guardar la etiqueta. Revisa el texto e inténtalo de nuevo.");
    }
  };

  const handleDeleteLabel = async (label: ScriptLabel) => {
    if (
      !window.confirm(
        label.category === "cue"
          ? "¿Eliminar esta etiqueta y el cue asociado? Se actualizará la numeración del resto de cues de este tipo."
          : "¿Eliminar esta etiqueta del libreto?",
      )
    ) {
      return;
    }

    try {
      await deleteScriptLabel(label.id);
      if (scriptDocument) {
        const [nextLabels, productionCues] = await Promise.all([
          getScriptLabels(scriptDocument.id),
          getCuesByProduction(production.id),
        ]);
        setLabels(nextLabels);
        setCues(productionCues);
      }
      setSelectedLabelId(null);
      setError(null);
    } catch (deleteError) {
      console.error(deleteError);
      setError("No se pudo eliminar la etiqueta.");
    }
  };

  const handleDeleteDocument = async () => {
    if (!scriptDocument) return;
    if (
      !window.confirm(
        "Quitar el PDF eliminará también sus etiquetas y los cues generados desde ellas. ¿Quieres continuar?",
      )
    ) {
      return;
    }

    try {
      await deleteScriptDocument(production.id);
      setPdfDoc(null);
      setPdfTask(null);
      setScriptDocument(undefined);
      setIsEditingName(false);
      setLabels([]);
      setCues(await getCuesByProduction(production.id));
      setPageNumber(1);
      setTotalPages(0);
      setSelectedLabelId(null);
      setExpandedDepartment(null);
      setExpandedAct(null);
      setClickedPoint(null);
      setStatus("idle");
      setError(null);
    } catch (deleteError) {
      console.error(deleteError);
      setError("No se pudo quitar el PDF guardado.");
    }
  };

  const handleRenameDocument = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!scriptDocument) return;

    try {
      setIsSavingName(true);
      setError(null);
      const updatedDocument = await renameScriptDocument(scriptDocument.id, nameDraft);
      setScriptDocument(updatedDocument);
      setIsEditingName(false);
    } catch (renameError) {
      console.error(renameError);
      setError("No se pudo guardar el nombre del libreto.");
    } finally {
      setIsSavingName(false);
    }
  };

  const selectedLabel = labels.find((label) => label.id === selectedLabelId);
  const labelsOnPage = labels.filter((label) => label.page === pageNumber);
  const currentPageLabel = pdfDoc ? `Pág. ${pageNumber} de ${totalPages}` : "Sin documento";
  const libretoName = scriptDocument
    ? scriptDocument.displayName ?? scriptDocument.fileName.replace(/\.pdf$/i, "")
    : production.title;
  const cueById = new Map(cues.map((cue) => [cue.id, cue]));
  const departmentNames = Array.from(new Set<DepartmentName>([
    ...production.departments.map((department) => department.name),
    ...Object.values(cueDepartmentByType),
    ...cues.map((cue) => cue.department),
  ])).filter((department) => !hiddenLabelDepartments.has(department));
  const labelsByDepartment = new Map<DepartmentName, ScriptLabel[]>();
  for (const label of labels) {
    if (label.category !== "cue") continue;
    const department =
      (label.cueId ? cueById.get(label.cueId)?.department : undefined) ??
      (label.cueType ? cueDepartmentByType[label.cueType] : undefined);
    if (!department) continue;
    labelsByDepartment.set(department, [...(labelsByDepartment.get(department) ?? []), label]);
  }
  const actNames = Array.from(new Set(production.scenes.map((scene) => scene.act)));

  if (!production.id) {
    return (
      <Card className="flex min-h-64 flex-col items-center justify-center border-dashed border-slate-700 bg-slate-900/60 text-center">
        <FileText className="h-9 w-9 text-slate-500" />
        <h2 className="mt-4 text-lg font-semibold text-white">
          {projectsLoading ? "Cargando proyectos…" : "Selecciona un proyecto"}
        </h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
          {projectsLoading
            ? "Estamos buscando las obras guardadas en este navegador."
            : "Crea un proyecto y añade su PDF para trabajar con el libreto."}
        </p>
        {!projectsLoading && (
          <Link
            href="/proyectos"
            className="mt-4 rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
          >
            Ir a proyectos
          </Link>
        )}
      </Card>
    );
  }

  const renderLabelButton = (label: ScriptLabel) => (
    <button
      key={label.id}
      type="button"
      onClick={() => {
        setPageNumber(label.page);
        setClickedPoint(null);
        setSelectedLabelId(label.id);
      }}
      className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left ${
        label.category === "cue"
          ? `${getCueColorClasses(label.cueType ?? "LX")} ${
              getCueMixedColorStyle(label.cueType ?? "LX", label.includedTypes)
                ? "border-white/70"
                : ""
            }`
          : selectedLabelId === label.id
            ? "border-cyan-400/50 bg-cyan-500/10"
            : "border-slate-800 bg-slate-900 hover:border-slate-600"
      } ${selectedLabelId === label.id ? "ring-2 ring-cyan-300" : ""}`}
      style={
        label.category === "cue"
          ? getCueMixedColorStyle(label.cueType ?? "LX", label.includedTypes)
          : undefined
      }
    >
      <span className={`min-w-0 truncate text-sm ${label.category === "cue" && (label.cueType === "LX" || label.cueType === "PREVENIR") ? "text-slate-950" : "text-slate-200"}`}>
        {label.category === "cue"
          ? `${label.cueType === "PREVENIR" ? "PREVENIR · " : ""}${label.cueIdentifier ?? label.cueType}${label.cueType === "SIM" && label.includedTypes?.length ? ` · ${label.includedTypes.join("+")}` : ""}`
          : getCategoryLabel(label.category)}
        {" · "}
        {label.title}
      </span>
      <span className={`shrink-0 text-xs ${label.category === "cue" && (label.cueType === "LX" || label.cueType === "PREVENIR") ? "text-slate-950" : "text-slate-400"}`}>
        Pág. {label.page}
      </span>
    </button>
  );

  return (
    <Card className="border-slate-800 bg-slate-900/75">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Libreto</p>
          {isEditingName && scriptDocument ? (
            <form onSubmit={handleRenameDocument} className="mt-2 flex flex-wrap items-center gap-3">
              <input
                autoFocus
                required
                maxLength={120}
                aria-label="Nombre del libreto"
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                className="min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-lg font-semibold text-white outline-none focus:border-cyan-400"
              />
              <button
                type="submit"
                disabled={!nameDraft.trim() || isSavingName}
                className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-50"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setIsEditingName(false)}
                className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
              >
                Cancelar
              </button>
            </form>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-white">{libretoName}</h2>
              {scriptDocument && (
                <button
                  type="button"
                  aria-label="Editar nombre del libreto"
                  onClick={() => {
                    setNameDraft(libretoName);
                    setIsEditingName(true);
                  }}
                  className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:border-cyan-500/50 hover:text-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                >
                  edit
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex max-w-full items-center gap-2 rounded-full border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-300">
            <FileText className="h-4 w-4 shrink-0 text-cyan-300" />
            <span className="truncate">{scriptDocument?.fileName ?? "PDF local"}</span>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-sm font-medium text-cyan-200 hover:border-cyan-400 hover:bg-cyan-500/15"
          >
            <Upload className="h-4 w-4" />
            {scriptDocument ? "Reemplazar PDF" : "Cargar PDF"}
          </button>
          {scriptDocument && (
            <button
              type="button"
              onClick={() => void handleDeleteDocument()}
              className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-sm font-medium text-rose-200 hover:bg-rose-500/20"
            >
              <Trash2 className="h-4 w-4" />
              Quitar PDF
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            hidden
            onChange={handleFileChange}
          />
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}
      {status === "loading" && (
        <p role="status" className="mb-4 text-sm text-cyan-200">Cargando y guardando PDF…</p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.8fr_0.9fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="mb-4 flex items-center justify-between gap-3 text-sm text-slate-300">
            <span>{currentPageLabel}</span>
            <span>{pdfDoc ? "Pulsa en la página para añadir una etiqueta" : "Sin documento"}</span>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-100 p-3 shadow-inner">
            {!pdfDoc && status !== "loading" && (
              <div className="flex min-h-64 flex-col items-center justify-center gap-4 text-center text-slate-700">
                <FileText className="h-12 w-12 text-slate-400" />
                <div>
                  <p className="text-lg font-medium">No hay PDF cargado</p>
                  <p className="text-sm">Importa un documento para visualizarlo y marcarlo.</p>
                </div>
              </div>
            )}

            {pdfDoc && (
              <div className="space-y-3">
                <div className="relative mx-auto w-full max-w-[900px]">
                  <canvas
                    ref={canvasRef}
                    onClick={handlePageClick}
                    aria-label={`Página ${pageNumber} del libreto. Pulsa para añadir una etiqueta.`}
                    className="block h-auto w-full cursor-crosshair rounded-lg border border-slate-300 bg-white"
                  />
                  <div className="pointer-events-none absolute inset-0">
                    {labelsOnPage.map((label) => {
                      const markerColor = getMarkerColor(
                        label.category,
                        label.cueType,
                        label.includedTypes,
                      );
                      return (
                      <button
                        key={label.id}
                        type="button"
                        aria-label={`${getCategoryLabel(label.category)}: ${label.title}${
                          label.category === "cue" && label.includedTypes?.length
                            ? ` · ${label.includedTypes.join(" + ")}`
                            : ""
                        }`}
                        title={`${getCategoryLabel(label.category)} · ${label.title}`}
                        onClick={() => {
                          setClickedPoint(null);
                          setSelectedLabelId(label.id);
                        }}
                        className={`pointer-events-auto absolute max-w-36 -translate-x-1/2 -translate-y-1/2 truncate rounded-full border px-2 py-1 text-[10px] font-bold shadow-lg ${markerColor.className} ${
                          selectedLabelId === label.id ? "ring-2 ring-white ring-offset-2 ring-offset-slate-900" : ""
                        }`}
                        style={{
                          left: `${label.x * 100}%`,
                          top: `${label.y * 100}%`,
                          ...markerColor.style,
                        }}
                      >
                        {label.category === "cue"
                          ? `${label.cueIdentifier ?? `${label.cueType ?? "CUE"}-…`}${label.cueType === "SIM" && label.includedTypes?.length ? ` · ${label.includedTypes.join("+")}` : ""}`
                          : `${label.category === "act" ? "ACT" : "ESC"} · ${label.title}`}
                      </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs uppercase tracking-[0.15em] text-slate-600">
                  <button
                    type="button"
                    disabled={pageNumber <= 1}
                    onClick={() => {
                      setPageNumber((current) => Math.max(1, current - 1));
                      setClickedPoint(null);
                      setSelectedLabelId(null);
                    }}
                    className="inline-flex items-center gap-1 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </button>
                  <span>Página {pageNumber}</span>
                  <button
                    type="button"
                    disabled={pageNumber >= totalPages}
                    onClick={() => {
                      setPageNumber((current) => Math.min(totalPages, current + 1));
                      setClickedPoint(null);
                      setSelectedLabelId(null);
                    }}
                    className="inline-flex items-center gap-1 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <section className="rounded-xl border border-slate-800 bg-slate-950 p-4" aria-labelledby="script-labels-title">
            <div className="flex items-center gap-2 text-cyan-300">
              <MapPinned className="h-4 w-4" />
              <h3 id="script-labels-title" className="text-sm font-medium text-white">Etiquetas del libreto</h3>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              Consulta las etiquetas por departamento o revisa la estructura del libreto.
            </p>

            <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
              {departmentNames.map((department) => {
                const departmentLabels = labelsByDepartment.get(department) ?? [];
                const isExpanded = expandedDepartment === department;
                return (
                  <div key={department}>
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => setExpandedDepartment((current) => current === department ? null : department)}
                      className="flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-left text-sm text-slate-200 hover:border-cyan-500/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                    >
                      <span>{department}</span>
                      <span className="flex items-center gap-2 text-xs text-slate-400">
                        {departmentLabels.length}
                        <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="mt-2 space-y-2 pl-2">
                        {departmentLabels.length > 0
                          ? departmentLabels.map(renderLabelButton)
                          : <p className="rounded-lg border border-dashed border-slate-700 p-3 text-xs text-slate-400">Aún no hay etiquetas para este departamento.</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {clickedPoint && (
            <section
              role="dialog"
              aria-labelledby="new-label-title"
              className="rounded-xl border border-cyan-500/30 bg-slate-950 p-4 shadow-xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.15em] text-cyan-300">Página {clickedPoint.page}</p>
                  <h3 id="new-label-title" className="mt-1 text-base font-semibold text-white">Nueva etiqueta</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setClickedPoint(null)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  aria-expanded={labelSection === "structure"}
                  aria-controls="structure-label-options"
                  onClick={() => {
                    setLabelSection((current) => current === "structure" ? null : "structure");
                    setCategory("");
                    setLabelTitle("");
                    setLabelPie("");
                  }}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                    labelSection === "structure"
                      ? "border-cyan-400 bg-cyan-500/15 text-cyan-100"
                      : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500"
                  } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300`}
                >
                  Estructura
                </button>
                <button
                  type="button"
                  aria-expanded={labelSection === "cues"}
                  aria-controls="cue-label-options"
                  onClick={() => {
                    setLabelSection((current) => current === "cues" ? null : "cues");
                    setCategory("");
                    setLabelTitle("");
                    setLabelPie("");
                  }}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                    labelSection === "cues"
                      ? "border-cyan-400 bg-cyan-500/15 text-cyan-100"
                      : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500"
                  } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300`}
                >
                  Cues
                </button>
              </div>

              {labelSection === "structure" && (
                <div id="structure-label-options" className="mt-3 grid grid-cols-2 gap-2">
                  {([
                    { value: "act", label: "Acto" },
                    { value: "scene", label: "Escena" },
                  ] as const).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={category === option.value}
                      onClick={() => {
                        setCategory(option.value);
                        setLabelTitle("");
                        setLabelPie("");
                      }}
                      className={`rounded-lg border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 ${
                        category === option.value
                          ? "border-violet-300 bg-violet-600/25 text-violet-100"
                          : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}

              {labelSection === "cues" && (
                <div id="cue-label-options" className="mt-3 grid grid-cols-2 gap-2">
                  {cueTypeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={category === "cue" && cueType === option.value}
                      onClick={() => void handleCueTypeSelect(option.value)}
                      className={`rounded-lg border px-2 py-2 text-left text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${getCueColorClasses(option.value)} ${
                        option.value === "SIM" ? "border-white/70" : ""
                      } ${
                        category === "cue" && cueType === option.value ? "ring-2 ring-white" : ""
                      }`}
                      style={
                        option.value === "SIM"
                          ? getCueMixedColorStyle(option.value, includedTypes)
                          : undefined
                      }
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}

              {category && (
                <form onSubmit={handleSaveLabel} className="mt-4 space-y-3">
                  {category === "cue" && (
                    <>
                      <p className="text-sm text-slate-300">
                        Tipo seleccionado:{" "}
                        <CueTypeBadge
                          type={cueType}
                          includedTypes={cueType === "SIM" ? includedTypes : undefined}
                          className="ml-1 px-2 py-0.5"
                        >
                          {cueType}
                        </CueTypeBadge>
                      </p>
                      <label className="block space-y-1.5 text-sm text-slate-300">
                        <span>Identificador</span>
                        <input
                          required
                          value={cueIdentifier}
                          onChange={(event) => setCueIdentifier(event.target.value)}
                          pattern={getCueIdentifierPattern(cueType)}
                          title={`Usa ${getCueIdentifierType(cueType)} con un número entero o decimal, como ${getCueIdentifierType(cueType)}-5.5.`}
                          placeholder={`${getCueIdentifierType(cueType)}-01`}
                          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white placeholder:text-slate-500"
                        />
                        <span className="block text-xs text-slate-400">
                          {cueIdentifierLoading
                            ? "Calculando el siguiente identificador…"
                            : "Se propone el siguiente número disponible; puedes cambiarlo."}
                        </span>
                      </label>
                      {cueType === "PREVENIR" && (
                        <p className="rounded-lg border border-orange-400/30 bg-orange-500/10 px-3 py-2 text-xs text-orange-200">
                          Este aviso usa el prefijo PREV, puede compartir el número de su MOV y no incrementa su numeración.
                        </p>
                      )}
                    </>
                  )}
                  {category === "cue" && cueType === "SIM" && (
                    <fieldset className="space-y-2">
                      <legend className="text-sm text-slate-300">Señales que coinciden</legend>
                      <div className="grid grid-cols-2 gap-2">
                        {cueComponentOptions.map((option) => (
                          <label
                            key={option.value}
                            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-slate-200"
                          >
                            <input
                              type="checkbox"
                              checked={includedTypes.includes(option.value)}
                              onChange={(event) => {
                                setIncludedTypes((current) => event.target.checked
                                  ? [...current, option.value]
                                  : current.filter((value) => value !== option.value));
                              }}
                              className="accent-green-500"
                            />
                            {option.value}
                          </label>
                        ))}
                      </div>
                      {includedTypes.length < 2 && (
                        <p className="text-xs text-rose-300">Selecciona al menos dos tipos para un cambio simultáneo.</p>
                      )}
                    </fieldset>
                  )}
                  <label className="block space-y-1.5 text-sm text-slate-300">
                    <span>{category === "cue" ? "Descripción" : "Nombre de la etiqueta"}</span>
                    <input
                      autoFocus
                      required
                      value={labelTitle}
                      onChange={(event) => setLabelTitle(event.target.value)}
                      placeholder={category === "act" ? "Ej.: Acto I" : category === "scene" ? "Ej.: Escena 2" : "Ej.: Cambio de luz"}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white placeholder:text-slate-500"
                    />
                  </label>
                  {category === "cue" && (
                    <label className="block space-y-1.5 text-sm text-slate-300">
                      <span>Pie</span>
                      <textarea
                        value={labelPie}
                        onChange={(event) => setLabelPie(event.target.value)}
                        placeholder="Acción que da pie a este cue"
                        className="min-h-16 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white placeholder:text-slate-500"
                      />
                    </label>
                  )}
                  <button
                    type="submit"
                    disabled={
                      !labelTitle.trim() ||
                      !scriptDocument ||
                      (category === "cue" && (cueIdentifierLoading || !cueIdentifier.trim())) ||
                      (category === "cue" && cueType === "SIM" && includedTypes.length < 2)
                    }
                    className="w-full rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Crear {getCategoryLabel(category).toLowerCase()}
                  </button>
                </form>
              )}
            </section>
          )}

          {selectedLabel && (
            <section className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="text-xs uppercase tracking-[0.15em] text-slate-400">
                {getCategoryLabel(selectedLabel.category)} · Página {selectedLabel.page}
              </p>
              {selectedLabel.category === "cue" && selectedLabel.cueType && (
                <CueTypeBadge
                  type={selectedLabel.cueType}
                  includedTypes={selectedLabel.includedTypes}
                  className="mt-2"
                >
                  {selectedLabel.cueType}
                </CueTypeBadge>
              )}
              <p className="mt-2 font-medium text-white">
                {selectedLabel.cueIdentifier ? `${selectedLabel.cueIdentifier} · ` : ""}
                {selectedLabel.title}
              </p>
              {selectedLabel.cueType === "SIM" && selectedLabel.includedTypes && (
                <p className="mt-1 text-sm text-green-200">
                  Señales: {selectedLabel.includedTypes.join(" + ")}
                </p>
              )}
              {selectedLabel.category === "cue" && selectedLabel.cueId && (
                <Link
                  href={`/cues?edit=${encodeURIComponent(selectedLabel.cueId)}`}
                  className="mt-4 inline-flex rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                >
                  Editar cue
                </Link>
              )}
              <button
                type="button"
                onClick={() => void handleDeleteLabel(selectedLabel)}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200 hover:bg-rose-500/20"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar etiqueta
              </button>
            </section>
          )}

          <section className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
            <h3 className="text-sm font-medium text-white">Estructura</h3>
            <div className="mt-3 space-y-2">
              {actNames.map((act) => {
                const actScenes = production.scenes.filter((scene) => scene.act === act);
                const isExpanded = expandedAct === act;
                return (
                  <div key={act}>
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => setExpandedAct((current) => current === act ? null : act)}
                      className="flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-left text-sm text-slate-200 hover:border-cyan-500/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                    >
                      <span>{act}</span>
                      <span className="flex items-center gap-2 text-xs text-slate-400">
                        {actScenes.length} {actScenes.length === 1 ? "escena" : "escenas"}
                        <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="mt-2 space-y-2 pl-2">
                        {actScenes.map((scene) => (
                          <div key={scene.id} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-medium text-white">{scene.title}</span>
                              <span className="shrink-0 text-xs text-slate-400">Escena {scene.number}</span>
                            </div>
                            {scene.summary && <p className="mt-1 text-xs leading-5 text-slate-400">{scene.summary}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </Card>
  );
}
