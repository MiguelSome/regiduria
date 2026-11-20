"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  FileText,
  FolderOpen,
  Plus,
  Save,
  Trash2,
  Upload,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createEmptyProjectTeam, ProjectTeamDialog } from "@/components/projects/project-team-dialog";
import {
  createProductionWithoutPdf,
  createProductionWithPdf,
  deleteAllProductions,
  deleteProduction,
  deleteScriptDocument,
  getProductions,
  getScheduleTemplate,
  getScheduleTemplates,
  getScriptDocument,
  saveCue,
  saveDanceTrack,
  saveProduction,
  saveScriptDocument,
} from "@/lib/data-service";
import { applyTemplateToProject } from "@/lib/dance/templates";
import type { DepartmentName, Production, ScheduleTemplate, ScriptDocument } from "@/lib/types";
import { useUiStore } from "@/store/ui-store";

const technicalDepartments: DepartmentName[] = [
  "Regiduría",
  "Iluminación",
  "Sonido",
  "Maquinaria",
  "Utilería",
  "Vestuario",
  "Caracterización",
  "Vídeo",
];

function createBlankProduction(): Production {
  return {
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
    team: createEmptyProjectTeam(),
  };
}

function cloneProduction(project: Production): Production {
  const projectTeam = project.team ?? createEmptyProjectTeam();
  return {
    ...project,
    departments: project.departments.map((department) => ({
      ...department,
      notes: [...department.notes],
    })),
    scenes: project.scenes.map((scene) => ({ ...scene })),
    team: {
      ...projectTeam,
      technical: projectTeam.technical.map((department) => ({
        ...department,
        head: department.head ||
          project.departments.find((item) => item.name === department.department)?.responsable ||
          "",
        technicians: department.technicians.map((technician) => ({ ...technician })),
      })),
      artistic: projectTeam.artistic.map((member) => ({ ...member })),
    },
  };
}

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function ProjectManager() {
  const [projects, setProjects] = useState<Production[]>([]);
  const [form, setForm] = useState<Production>(createBlankProduction);
  const [isCreating, setIsCreating] = useState(false);
  const [isTeamOpen, setIsTeamOpen] = useState(false);
  const [pdfDocument, setPdfDocument] = useState<ScriptDocument | null>(null);
  const [newPdfFile, setNewPdfFile] = useState<File | null>(null);
  const [newProjectMode, setNewProjectMode] = useState<"standard" | "dance">("standard");
  const [initialTemplateId, setInitialTemplateId] = useState("");
  const [scheduleTemplates, setScheduleTemplates] = useState<ScheduleTemplate[]>([]);
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const selectedProjectId = useUiStore((state) => state.selectedProjectId);
  const setSelectedProjectId = useUiStore((state) => state.setSelectedProjectId);
  const createPdfInputRef = useRef<HTMLInputElement | null>(null);
  const replacePdfInputRef = useRef<HTMLInputElement | null>(null);
  const saveRevision = useRef(0);

  const loadProjects = useCallback(async () => {
    try {
      const data = await getProductions();
      setProjects(data);
      const activeProject = data.find((project) => project.id === selectedProjectId) ?? data[0];
      if (activeProject) {
        if (activeProject.id !== selectedProjectId) setSelectedProjectId(activeProject.id);
        setForm(cloneProduction(activeProject));
        setIsCreating(false);
      } else {
        setSelectedProjectId("");
        setForm(createBlankProduction());
      }
    } catch (loadError) {
      console.error(loadError);
      setError("No se pudieron cargar los proyectos guardados.");
    }
  }, [selectedProjectId, setSelectedProjectId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProjects();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadProjects]);

  useEffect(() => {
    if (isCreating || !form.id || selectedProjectId !== form.id) return;

    const revision = ++saveRevision.current;
    const timeout = window.setTimeout(() => {
      setSaveState("saving");
      void saveProduction({ ...form, lastUpdated: new Date().toISOString() })
        .then(() => {
          if (revision !== saveRevision.current) return;
          setProjects((current) => current.map((project) =>
            project.id === form.id ? { ...form, lastUpdated: new Date().toISOString() } : project,
          ));
          setSaveState("saved");
          setError(null);
        })
        .catch((saveError: unknown) => {
          console.error(saveError);
          if (revision !== saveRevision.current) return;
          setSaveState("error");
          setError("No se pudieron guardar los cambios del proyecto.");
        });
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [form, isCreating, selectedProjectId]);

  useEffect(() => {
    let active = true;
    if (!form.id || isCreating) return;

    void getScriptDocument(form.id)
      .then((document) => {
        if (active) setPdfDocument(document ?? null);
      })
      .catch((loadError: unknown) => {
        console.error(loadError);
        if (active) setError("No se pudo consultar el PDF asociado al proyecto.");
      });

    return () => {
      active = false;
    };
  }, [form.id, isCreating]);

  useEffect(() => {
    if (!isCreating) return;
    let active = true;
    void getScheduleTemplates()
      .then((templates) => {
        if (active) setScheduleTemplates(templates);
      })
      .catch((loadError: unknown) => {
        console.error(loadError);
      });
    return () => {
      active = false;
    };
  }, [isCreating]);

  const beginNewProject = () => {
    saveRevision.current += 1;
    setError(null);
    setSaveState("idle");
    setPdfDocument(null);
    setNewPdfFile(null);
    setNewProjectMode("standard");
    setInitialTemplateId("");
    setForm(createBlankProduction());
    setIsCreating(true);
  };

  const selectProject = async (project: Production, saveCurrent = true) => {
    if (saveCurrent && form.id && form.id === selectedProjectId && !isCreating) {
      try {
        await saveProduction({ ...form, lastUpdated: new Date().toISOString() });
      } catch (saveError) {
        console.error(saveError);
        setError("No se pudieron guardar los cambios; sigue seleccionado el proyecto actual.");
        return;
      }
    }

    saveRevision.current += 1;
    setError(null);
    setSaveState("idle");
    setNewPdfFile(null);
    setPdfDocument(null);
    setForm(cloneProduction(project));
    setSelectedProjectId(project.id);
    setIsCreating(false);
  };

  const setField = <K extends keyof Production>(key: K, value: Production[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleCreateProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const isDance = newProjectMode === "dance";
    // Solo en el alta de un proyecto de danza se aplica la plantilla elegida (RF27).
    const templateIdToApply = isDance ? initialTemplateId.trim() : "";
    if (!isDance && !newPdfFile) {
      setError("Selecciona el PDF de la obra para crear el proyecto.");
      return;
    }
    if (newPdfFile && !isPdf(newPdfFile)) {
      setError("El archivo seleccionado no es un PDF válido.");
      return;
    }

    const project: Production = {
      ...form,
      mode: newProjectMode,
      id: crypto.randomUUID(),
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      venue: form.venue.trim(),
      summary: form.summary.trim(),
      lastUpdated: new Date().toISOString(),
      departments: technicalDepartments.map((name) => ({
        id: crypto.randomUUID(),
        name,
        responsable: "",
        notes: [],
      })),
      scenes: [],
      team: form.team ?? createEmptyProjectTeam(),
    };

    let createdProject = project;
    let projectCreated = false;
    let isApplyingTemplate = false;

    try {
      if (newPdfFile) {
        await createProductionWithPdf(project, newPdfFile.name, newPdfFile);
      } else {
        // Danza allows creating a project with only its name (RF2).
        await createProductionWithoutPdf(project);
      }
      projectCreated = true;

      if (templateIdToApply) {
        isApplyingTemplate = true;
        const template = await getScheduleTemplate(templateIdToApply);
        if (!template) {
          throw new Error(`No se encontró la plantilla «${templateIdToApply}».`);
        }
        // applyTemplateToProject crea ids nuevos para tracks y cues y devuelve un
        // templateOrigin fijo: la copia no comparte ningún id con la plantilla (D10/D36).
        const { tracks, cues, templateOrigin } = applyTemplateToProject({
          template,
          productionId: project.id,
          now: Date.now(),
        });
        for (const track of tracks) {
          await saveDanceTrack(track);
        }
        for (const cue of cues) {
          await saveCue(cue);
        }
        // `project` ya contiene `mode`; al extenderlo se conserva junto a la trazabilidad.
        createdProject = { ...project, templateOrigin };
        await saveProduction(createdProject);
        isApplyingTemplate = false;
      }

      // Se completan todas las lecturas asíncronas antes de tocar el estado de la interfaz:
      // así un fallo puede deshacer la creación sin dejar el proyecto recién creado seleccionado.
      const nextProjects = await getProductions();
      const scriptDocument = newPdfFile ? await getScriptDocument(project.id) ?? null : null;
      setProjects(nextProjects);
      setForm(cloneProduction(createdProject));
      setSelectedProjectId(project.id);
      setIsCreating(false);
      setNewPdfFile(null);
      setPdfDocument(scriptDocument);
      setSaveState("saved");
    } catch (saveError) {
      console.error(saveError);
      if (projectCreated) {
        try {
          if (newPdfFile) {
            const document = await getScriptDocument(project.id);
            if (document) await deleteScriptDocument(project.id);
          }
          await deleteProduction(project.id);
        } catch (rollbackError) {
          console.error(rollbackError);
        }
      }
      // Se permanece en el alta con los campos escritos, sin seleccionar el proyecto
      // deshecho, para que el usuario pueda volver a intentarlo.
      setIsCreating(true);
      setSaveState("idle");
      const templateError = "No se pudo aplicar la plantilla. Se ha deshecho la creación del proyecto; inténtalo de nuevo.";
      const creationError = newPdfFile
        ? "No se pudo crear el proyecto y guardar su PDF."
        : "No se pudo crear el proyecto de danza.";
      setError(isApplyingTemplate ? templateError : creationError);
    } finally {
      setInitialTemplateId("");
    }
  };

  const handleReplacePdf = async (file: File | undefined) => {
    if (!file || !form.id) return;
    if (!isPdf(file)) {
      setError("El archivo seleccionado no es un PDF válido.");
      return;
    }
    if (pdfDocument && !window.confirm(
      "Reemplazar el PDF eliminará las etiquetas del libreto y los cues asociados a ese documento. ¿Quieres continuar?",
    )) {
      return;
    }

    setIsSavingPdf(true);
    setError(null);
    try {
      const document = await saveScriptDocument(form.id, file.name, file);
      setPdfDocument(document);
      setSaveState("saved");
    } catch (saveError) {
      console.error(saveError);
      setError("No se pudo guardar el PDF en este proyecto.");
    } finally {
      setIsSavingPdf(false);
    }
  };

  const handleDeleteProject = async (project: Production) => {
    if (!window.confirm(`Se eliminarán “${project.title}” y su PDF, cues y etiquetas. ¿Quieres continuar?`)) {
      return;
    }

    try {
      await deleteProduction(project.id);
      const nextProjects = await getProductions();
      setProjects(nextProjects);
      const nextActiveProject = nextProjects[0];
      if (nextActiveProject) {
        await selectProject(nextActiveProject, project.id !== form.id);
      } else {
        setSelectedProjectId("");
        setForm(createBlankProduction());
        setPdfDocument(null);
        setIsCreating(false);
      }
      setError(null);
    } catch (deleteError) {
      console.error(deleteError);
      setError("No se pudo eliminar el proyecto.");
    }
  };

  const handleDeleteAllProjects = async () => {
    if (!window.confirm(
      `Se eliminarán los ${projects.length} proyectos guardados y todos sus PDF, cues, etiquetas y datos de función. Esta acción no se puede deshacer. ¿Quieres continuar?`,
    )) {
      return;
    }

    try {
      await deleteAllProductions();
      setProjects([]);
      setSelectedProjectId("");
      setForm(createBlankProduction());
      setPdfDocument(null);
      setIsCreating(false);
      setSaveState("idle");
      setError(null);
    } catch (deleteError) {
      console.error(deleteError);
      setError("No se pudieron eliminar todos los proyectos.");
    }
  };

  const handleTeamChange = (team: NonNullable<Production["team"]>) => {
    setForm((current) => ({
      ...current,
      team,
      departments: current.departments.map((department) => {
        const teamDepartment = team.technical.find((item) => item.department === department.name);
        return teamDepartment ? { ...department, responsable: teamDepartment.head } : department;
      }),
    }));
  };

  const isSelectedPdfFile = newPdfFile ?? null;

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card className="border-slate-800 bg-slate-900/80">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Archivo de obras</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Proyectos</h2>
            </div>
            <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200">
              {projects.length}
            </span>
          </div>

          {projects.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-6 text-center">
              <FolderOpen className="h-9 w-9 text-slate-500" />
              <h3 className="mt-4 text-lg font-semibold text-white">Aún no hay proyectos</h3>
              <p className="mt-2 max-w-xs text-sm leading-6 text-slate-400">
                Crea un proyecto estándar con PDF o uno de Danza con documento y escaleta.
              </p>
              <Button
                type="button"
                onClick={beginNewProject}
                className="mt-5 border-cyan-400/40 bg-cyan-400 text-slate-950 hover:border-cyan-300 hover:bg-cyan-300"
              >
                <Plus className="mr-2 h-4 w-4" />
                Crear proyecto
              </Button>
            </div>
          ) : (
            <>
              <ul className="space-y-2">
                {projects.map((project) => {
                  const isSelected = project.id === selectedProjectId;
                  return (
                    <li key={project.id}>
                      <div className={`rounded-xl border p-3 ${
                        isSelected
                          ? "border-cyan-400/50 bg-cyan-500/5"
                          : "border-slate-800 bg-slate-950"
                      }`}>
                        <button
                          type="button"
                          onClick={() => void selectProject(project)}
                          aria-pressed={isSelected}
                          className="w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                        >
                          <span className="flex items-start justify-between gap-3">
                            <span className="min-w-0">
                              <span className="block truncate font-semibold text-white">{project.title}</span>
                              <span className="mt-1 block truncate text-sm text-slate-400">
                                {[project.subtitle, project.venue].filter(Boolean).join(" · ") || "Sin temporada ni sala"}
                              </span>
                            </span>
                            {isSelected && <Check className="h-4 w-4 shrink-0 text-cyan-300" />}
                          </span>
                        </button>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                            <FileText className="h-3.5 w-3.5" />
                            {project.id === form.id && pdfDocument ? "PDF cargado" : "Obra"}
                          </span>
                          <button
                            type="button"
                            onClick={() => void handleDeleteProject(project)}
                            aria-label={`Eliminar ${project.title}`}
                            className="rounded-md p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-800 pt-4">
                <Button type="button" onClick={beginNewProject} className="border-slate-700 bg-slate-900">
                  <Plus className="mr-2 h-4 w-4" />
                  Crear proyecto
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleDeleteAllProjects()}
                  className="border-rose-500/30 bg-rose-500/5 text-rose-200 hover:border-rose-400 hover:bg-rose-500/10"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar todos
                </Button>
              </div>
            </>
          )}
        </Card>

        {projects.length > 0 || isCreating ? (
          <Card className="border-slate-800 bg-slate-900/80">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Editor del proyecto</p>
                <h2 className="mt-1 text-xl font-semibold text-white">
                  {isCreating ? "Nuevo proyecto" : form.title || "Proyecto sin título"}
                </h2>
                {!isCreating && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 text-slate-300">
                      {form.mode === "dance" ? "Danza" : "Estándar"}
                    </span>
                    {form.templateOrigin && (
                      <span className="text-slate-400">
                        Plantilla: {form.templateOrigin.name} (v{form.templateOrigin.version})
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                {!isCreating && (
                  <span role="status" className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                    {saveState === "saving" ? (
                      "Guardando…"
                    ) : saveState === "saved" ? (
                      <><Check className="h-3.5 w-3.5 text-emerald-300" /> Guardado</>
                    ) : saveState === "error" ? (
                      "Error al guardar"
                    ) : (
                      "Guardado automático"
                    )}
                  </span>
                )}
                <Button
                  type="button"
                  onClick={() => setIsTeamOpen(true)}
                  disabled={!form.id && !isCreating}
                  className="border-cyan-500/30 bg-cyan-500/10 text-cyan-200"
                >
                  <Users className="mr-2 h-4 w-4" />
                  Equipo
                </Button>
              </div>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              {isCreating && (
                <fieldset className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <legend className="px-1 text-sm font-medium text-slate-200">Modo del proyecto</legend>
                  <div className="mt-2 grid gap-3 md:grid-cols-2">
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-800 bg-slate-900 p-3 focus-within:border-cyan-400">
                      <input
                        type="radio"
                        name="project-mode"
                        value="standard"
                        checked={newProjectMode === "standard"}
                        onChange={() => setNewProjectMode("standard")}
                        className="mt-1 h-4 w-4 shrink-0 accent-cyan-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                      />
                      <span className="space-y-1">
                        <span className="block text-sm font-medium text-white">Estándar (PDF)</span>
                        <span className="block text-xs leading-5 text-slate-400">
                          el espectáculo se prepara a partir de su libreto PDF.
                        </span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-800 bg-slate-900 p-3 focus-within:border-cyan-400">
                      <input
                        type="radio"
                        name="project-mode"
                        value="dance"
                        checked={newProjectMode === "dance"}
                        onChange={() => setNewProjectMode("dance")}
                        className="mt-1 h-4 w-4 shrink-0 accent-cyan-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                      />
                      <span className="space-y-1">
                        <span className="block text-sm font-medium text-white">Danza (documento + escaleta)</span>
                        <span className="block text-xs leading-5 text-slate-400">
                          el espectáculo se documenta dentro de la aplicación y genera su propia escaleta.
                        </span>
                      </span>
                    </label>
                  </div>
                </fieldset>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5 text-sm text-slate-300">
                  <span>Nombre de la obra <span className="text-rose-300">*</span></span>
                  <input
                    required
                    value={form.title}
                    onChange={(event) => setField("title", event.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-cyan-400"
                    placeholder="Ej.: La casa de Bernarda Alba"
                  />
                </label>

                <label className="space-y-1.5 text-sm text-slate-300">
                  <span>Temporada</span>
                  <input
                    value={form.subtitle}
                    onChange={(event) => setField("subtitle", event.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-cyan-400"
                    placeholder="Ej.: Temporada 2026"
                  />
                </label>

                <label className="space-y-1.5 text-sm text-slate-300">
                  <span>Localidad / sala</span>
                  <input
                    value={form.venue}
                    onChange={(event) => setField("venue", event.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-cyan-400"
                    placeholder="Nombre de la sala"
                  />
                </label>

                {!isCreating && (
                  <label className="space-y-1.5 text-sm text-slate-300">
                    <span>Estado</span>
                    <select
                      value={form.status}
                      onChange={(event) => setField("status", event.target.value as Production["status"])}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-cyan-400"
                    >
                      <option value="Activa">Activa</option>
                      <option value="Archivada">Archivada</option>
                    </select>
                  </label>
                )}
              </div>

              <label className="block space-y-1.5 text-sm text-slate-300">
                <span>Resumen</span>
                <textarea
                  value={form.summary}
                  onChange={(event) => setField("summary", event.target.value)}
                  className="min-h-24 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-cyan-400"
                  placeholder="Contexto de la producción"
                />
              </label>

              <section className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="rounded-lg bg-slate-800 p-2 text-cyan-300">
                      <FileText className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-medium text-white">PDF de la obra</h3>
                      <p className="truncate text-xs text-slate-400">
                        {isCreating
                          ? isSelectedPdfFile?.name ?? (newProjectMode === "dance"
                              ? "Opcional en danza; puedes añadirlo más tarde."
                              : "Sin PDF seleccionado.")
                          : pdfDocument?.fileName ?? "Aún no hay un PDF vinculado."}
                      </p>
                    </div>
                  </div>
                  {isCreating ? (
                    <Button
                      type="button"
                      onClick={() => createPdfInputRef.current?.click()}
                      className="border-slate-700 bg-slate-900"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Elegir PDF
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => {
                        replacePdfInputRef.current?.click();
                      }}
                      disabled={isSavingPdf}
                      className="border-slate-700 bg-slate-900"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      {isSavingPdf ? "Guardando PDF…" : pdfDocument ? "Reemplazar PDF" : "Añadir PDF"}
                    </Button>
                  )}
                  <input
                    ref={createPdfInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setNewPdfFile(file);
                      setError(file && !isPdf(file) ? "El archivo seleccionado no es un PDF válido." : null);
                      event.target.value = "";
                    }}
                  />
                  <input
                    ref={replacePdfInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      void handleReplacePdf(file);
                      event.target.value = "";
                    }}
                  />
                </div>
                {isCreating && newProjectMode === "standard" && !newPdfFile && (
                  <p className="mt-3 text-xs text-slate-400">
                    Selecciona el PDF de la obra para crear el proyecto.
                  </p>
                )}
              </section>

              {isCreating && newProjectMode === "dance" && (
                <label className="block space-y-1.5 text-sm text-slate-300">
                  <span>Plantilla inicial</span>
                  <select
                    value={initialTemplateId}
                    onChange={(event) => setInitialTemplateId(event.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none focus:border-cyan-400"
                  >
                    <option value="">Empezar de cero</option>
                    {scheduleTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} (v{template.version})
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="flex flex-wrap items-center gap-3 border-t border-slate-800 pt-4">
                {isCreating ? (
                  <>
                    <Button
                      type="submit"
                      disabled={newProjectMode === "standard" && !newPdfFile}
                      className="border-cyan-400/40 bg-cyan-400 text-slate-950 hover:border-cyan-300 hover:bg-cyan-300"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      Crear proyecto
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        setIsCreating(false);
                        if (projects[0]) void selectProject(projects[0], false);
                        else setForm(createBlankProduction());
                      }}
                      className="border-slate-700 bg-slate-900"
                    >
                      Cancelar
                    </Button>
                  </>
                ) : (
                  <p className="text-xs text-slate-500">
                    Los cambios se guardan automáticamente en este proyecto.
                  </p>
                )}
              </div>
            </form>
          </Card>
        ) : null}
      </div>

      {isTeamOpen && (
        <ProjectTeamDialog
          team={form.team ?? createEmptyProjectTeam()}
          onChange={handleTeamChange}
          onClose={() => setIsTeamOpen(false)}
        />
      )}
    </div>
  );
}
