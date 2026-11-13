"use client";

import Link from "next/link";
import { Plus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDepartmentCueColorClasses } from "@/lib/cue-presentation";
import { getIncidents, getProductions, saveIncident } from "@/lib/data-service";
import type { DepartmentName, Incident, Production } from "@/lib/types";
import { useUiStore } from "@/store/ui-store";

const departments: DepartmentName[] = [
  "Regiduría",
  "Iluminación",
  "Sonido",
  "Maquinaria",
  "Utilería",
  "Vestuario",
  "Caracterización",
  "Vídeo",
  "Reparto",
];

const incidentStatuses: Incident["status"][] = ["Abierta", "Seguimiento", "Cerrada"];

const statusStyles: Record<Incident["status"], string> = {
  Abierta: "border-red-500/30 bg-red-500/10 text-red-300",
  Seguimiento: "border-orange-500/30 bg-orange-500/10 text-orange-300",
  Cerrada: "border-green-500/30 bg-green-500/10 text-green-300",
};

const statusRailStyles: Record<Incident["status"], string> = {
  Abierta: "border-l-red-500",
  Seguimiento: "border-l-orange-400",
  Cerrada: "border-l-green-500",
};

function getLocalDateTimeValue(date: Date): string {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "No se pudo completar la operación.";
}

interface IncidentDraft {
  title: string;
  description: string;
  dateTime: string;
  departments: DepartmentName[];
}

export function IncidentManager() {
  const [productions, setProductions] = useState<Production[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedClosedIds, setExpandedClosedIds] = useState<Set<string>>(() => new Set());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draft, setDraft] = useState<IncidentDraft>({
    title: "",
    description: "",
    dateTime: "",
    departments: [],
  });
  const activeProjectId = useUiStore((state) => state.selectedProjectId);
  const setActiveProjectId = useUiStore((state) => state.setSelectedProjectId);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [nextProductions, nextIncidents] = await Promise.all([
        getProductions(),
        getIncidents(),
      ]);
      setProductions(nextProductions);
      setIncidents(nextIncidents);

      const activeProduction =
        nextProductions.find((production) => production.id === activeProjectId) ??
        nextProductions[0];
      const nextProductionId = activeProduction?.id ?? "";
      if (nextProductionId !== activeProjectId) setActiveProjectId(nextProductionId);
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [activeProjectId, setActiveProjectId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsDialogOpen(false);
    };
    if (!isDialogOpen) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDialogOpen]);

  const visibleIncidents = useMemo(
    () => incidents.filter((incident) => incident.productionId === activeProjectId),
    [activeProjectId, incidents],
  );

  const openCreateDialog = () => {
    setDraft({
      title: "",
      description: "",
      dateTime: getLocalDateTimeValue(new Date()),
      departments: [],
    });
    setSaveError(null);
    setIsDialogOpen(true);
  };

  const toggleDepartment = (department: DepartmentName) => {
    setDraft((current) => ({
      ...current,
      departments: current.departments.includes(department)
        ? current.departments.filter((item) => item !== department)
        : [...current.departments, department],
    }));
  };

  const handleCreateIncident = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeProjectId || draft.departments.length === 0 || isSaving) return;

    const title = draft.title.trim();
    const description = draft.description.trim();
    if (!title || !description) {
      setSaveError("Completa el título y la descripción de la incidencia.");
      return;
    }

    const incidentDate = new Date(draft.dateTime);
    if (Number.isNaN(incidentDate.getTime())) {
      setSaveError("Indica una fecha y hora válidas para la incidencia.");
      return;
    }

    const now = new Date().toISOString();
    const incident: Incident = {
      id: crypto.randomUUID(),
      productionId: activeProjectId,
      title,
      description,
      date: incidentDate.toISOString(),
      createdAt: now,
      departments: draft.departments,
      status: "Abierta",
    };

    setIsSaving(true);
    setSaveError(null);
    try {
      await saveIncident(incident);
      setIncidents((current) =>
        [incident, ...current].sort((first, second) => second.date.localeCompare(first.date)),
      );
      setIsDialogOpen(false);
    } catch (error) {
      setSaveError(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (incident: Incident, status: Incident["status"]) => {
    const updatedIncident = { ...incident, status };
    setSaveError(null);
    try {
      await saveIncident(updatedIncident);
      setIncidents((current) =>
        current.map((item) => item.id === incident.id ? updatedIncident : item),
      );
      setExpandedClosedIds((current) => {
        const next = new Set(current);
        next.delete(incident.id);
        return next;
      });
    } catch (error) {
      setSaveError(getErrorMessage(error));
    }
  };

  const toggleClosedIncident = (id: string) => {
    setExpandedClosedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section className="space-y-5">
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={openCreateDialog}
          disabled={!activeProjectId}
          className="gap-2 border-cyan-400/40 bg-cyan-400/10 text-cyan-100 hover:border-cyan-300 hover:bg-cyan-400/20"
        >
          <Plus aria-hidden="true" size={16} />
          Crear nueva incidencia
        </Button>
      </div>

      {saveError && !isDialogOpen && <p role="alert" className="text-sm text-red-300">{saveError}</p>}

      {loadError ? (
        <Card className="border-red-500/30 bg-red-950/30 p-5">
          <p role="alert" className="text-sm text-red-200">
            No se pudieron cargar las incidencias: {loadError}
          </p>
          <Button
            type="button"
            onClick={() => void loadData()}
            className="mt-4"
          >
            Reintentar
          </Button>
        </Card>
      ) : isLoading ? (
        <p className="py-8 text-center text-sm text-slate-400">Cargando incidencias…</p>
      ) : productions.length === 0 ? (
        <Card className="border-slate-800 bg-slate-900/80 p-6 text-center">
          <h2 className="text-lg font-semibold text-white">Crea una producción para registrar incidencias</h2>
          <Link
            href="/proyectos"
            className="mt-4 inline-flex rounded-md border border-cyan-400/40 bg-cyan-400/10 px-3 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-400/20"
          >
            Ir a proyectos
          </Link>
        </Card>
      ) : visibleIncidents.length === 0 ? (
        <Card className="border-slate-800 bg-slate-900/80 p-6 text-center">
          <h2 className="text-lg font-semibold text-white">Sin incidencias para esta producción</h2>
          <p className="mt-2 text-sm text-slate-400">
            Las incidencias que registres aquí quedarán asociadas a {productions.find((item) => item.id === activeProjectId)?.title}.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {visibleIncidents.map((incident) => {
            const isExpanded = incident.status !== "Cerrada" || expandedClosedIds.has(incident.id);
            const createdAt = incident.createdAt ?? incident.date;

            return (
              <Card
                key={incident.id}
                className={`border-slate-800 border-l-4 bg-slate-900/80 ${statusRailStyles[incident.status]}`}
              >
                {incident.status === "Cerrada" && !isExpanded ? (
                  <button
                    type="button"
                    aria-label={`Mostrar detalles de ${incident.title}`}
                    aria-expanded={false}
                    onClick={() => toggleClosedIncident(incident.id)}
                    className="flex w-full flex-col gap-1 p-4 text-left sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="font-semibold text-green-300">{incident.title}</span>
                    <time className="text-sm text-slate-400" dateTime={createdAt}>
                      {formatDateTime(createdAt)}
                    </time>
                  </button>
                ) : (
                  <div className="space-y-3 p-4">
                    {incident.status === "Cerrada" && (
                      <button
                        type="button"
                        aria-label={`Ocultar detalles de ${incident.title}`}
                        aria-expanded={true}
                        onClick={() => toggleClosedIncident(incident.id)}
                        className="text-sm text-slate-400 underline underline-offset-4 hover:text-white"
                      >
                        Ocultar detalles
                      </button>
                    )}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <time className="text-sm text-slate-400" dateTime={createdAt}>
                          Fecha de creación · {formatDateTime(createdAt)}
                        </time>
                        <h2 className="mt-2 text-lg font-semibold text-white">{incident.title}</h2>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusStyles[incident.status]}`}>
                          {incident.status}
                        </span>
                        <label className="sr-only" htmlFor={`incident-status-${incident.id}`}>
                          Estado de {incident.title}
                        </label>
                        <select
                          id={`incident-status-${incident.id}`}
                          value={incident.status}
                          onChange={(event) => {
                            const nextStatus = incidentStatuses.find((status) => status === event.target.value);
                            if (nextStatus) void handleStatusChange(incident, nextStatus);
                          }}
                          className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                        >
                          {incidentStatuses.map((status) => <option key={status}>{status}</option>)}
                        </select>
                      </div>
                    </div>
                    <p className="text-sm leading-6 text-slate-300">{incident.description}</p>
                    <p className="text-xs text-slate-400">
                      Fecha de la incidencia · {formatDateTime(incident.date)}
                    </p>
                    {incident.departments && incident.departments.length > 0 && (
                      <div className="flex flex-wrap gap-3" aria-label="Departamentos involucrados">
                        {incident.departments.map((department) => (
                          <span
                            key={department}
                            className={`rounded-md border px-2 py-1 text-xs font-medium ${getDepartmentCueColorClasses(department)}`}
                          >
                            {department}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {isDialogOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSaving) setIsDialogOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="incident-dialog-title"
            className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-400">Incidencia · {productions.find((item) => item.id === activeProjectId)?.title}</p>
                <h2 id="incident-dialog-title" className="mt-1 text-xl font-semibold text-white">
                  Crear nueva incidencia
                </h2>
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                disabled={isSaving}
                onClick={() => setIsDialogOpen(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50"
              >
                <X aria-hidden="true" size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateIncident} className="space-y-4">
              <label className="block space-y-2 text-sm text-slate-300">
                <span>Título</span>
                <input
                  required
                  value={draft.title}
                  onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                />
              </label>
              <label className="block space-y-2 text-sm text-slate-300">
                <span>Descripción</span>
                <textarea
                  required
                  rows={4}
                  value={draft.description}
                  onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                  className="w-full resize-y rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                />
              </label>
              <label className="block space-y-2 text-sm text-slate-300">
                <span>Fecha y hora de la incidencia</span>
                <input
                  type="datetime-local"
                  required
                  value={draft.dateTime}
                  onChange={(event) => setDraft((current) => ({ ...current, dateTime: event.target.value }))}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                />
              </label>
              <fieldset className="space-y-2">
                <legend className="text-sm text-slate-300">Departamentos involucrados</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {departments.map((department) => (
                    <label key={department} className="flex items-center gap-2 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={draft.departments.includes(department)}
                        onChange={() => toggleDepartment(department)}
                        className="size-4 accent-cyan-400"
                      />
                      <span className={`rounded-md border px-2 py-0.5 text-xs ${getDepartmentCueColorClasses(department)}`}>
                        {department}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {draft.departments.length === 0 && (
                <p className="text-xs text-slate-400">Selecciona al menos un departamento.</p>
              )}
              {saveError && <p role="alert" className="text-sm text-red-300">{saveError}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" disabled={isSaving} onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving || draft.departments.length === 0}
                  className="border-cyan-400/40 bg-cyan-400/10 text-cyan-100 hover:border-cyan-300 hover:bg-cyan-400/20"
                >
                  {isSaving ? "Guardando…" : "Crear incidencia"}
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
