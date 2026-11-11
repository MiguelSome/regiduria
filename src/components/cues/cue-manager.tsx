"use client";

import { Save, Trash2, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  cueComponentOptions,
  cueDepartmentByType,
  cueTypeOptions,
  getCueColorClasses,
} from "@/lib/cue-presentation";
import {
  getCueIdentifierNumber,
  getCueIdentifierPattern,
  getCueIdentifierType,
  getNextCueIdentifier,
} from "@/lib/cue-identifiers";
import { deleteCue, getAllCues, getProductions, saveCue } from "@/lib/data-service";
import type { Cue, CueType, Production } from "@/lib/types";

const emptyCue: Cue = {
  id: "",
  productionId: "",
  identifier: "",
  type: "LX",
  description: "",
  act: "Acto I",
  scene: "1",
  department: "Iluminación",
  observations: "",
  status: "Borrador",
  executionState: "Preparación",
};

function getNextIdentifier(cues: Cue[], type: CueType): string {
  const identifierType = getCueIdentifierType(type);
  const maxNumber = cues.reduce((max, cue) => {
    if (cue.type !== identifierType) return max;
    const number = getCueIdentifierNumber(cue.identifier, identifierType);
    return number !== undefined ? Math.max(max, number) : max;
  }, 0);

  return getNextCueIdentifier(type, maxNumber);
}

export function CueManager() {
  const [projects, setProjects] = useState<Production[]>([]);
  const [cues, setCues] = useState<Cue[]>([]);
  const [selectedProductionId, setSelectedProductionId] = useState<string>("");
  const [form, setForm] = useState<Cue>(emptyCue);

  const loadData = async () => {
    const nextProjects = await getProductions();
    setProjects(nextProjects);

    if (nextProjects.length > 0) {
      setSelectedProductionId((current) => current || nextProjects[0].id);
    }

    const nextCues = await getAllCues();
    setCues(nextCues);

    const requestedCueId = new URLSearchParams(window.location.search).get("edit");
    const requestedCue = nextCues.find((cue) => cue.id === requestedCueId);
    if (requestedCue) {
      setSelectedProductionId(requestedCue.productionId);
      setForm({ ...requestedCue });
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!selectedProductionId || form.productionId) {
      return;
    }

    const timer = window.setTimeout(() => {
      setForm((current) => ({ ...current, productionId: selectedProductionId }));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [selectedProductionId, form.productionId]);

  const visibleCues = useMemo(
    () => cues.filter((cue) => cue.productionId === selectedProductionId),
    [cues, selectedProductionId],
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized: Cue = {
      ...form,
      id: form.id || crypto.randomUUID(),
      productionId: selectedProductionId || form.productionId,
      identifier: form.identifier.trim() || getNextIdentifier(visibleCues, form.type),
      description: form.description.trim(),
      pie: form.pie?.trim() ?? "",
      observations: form.observations.trim(),
    };

    await saveCue(normalized);
    const nextCues = await getAllCues();
    setCues(nextCues);
    setForm({ ...normalized });
  };

  const handleDelete = async (cue: Cue) => {
    const message = cue.scriptDocumentId
      ? "Se eliminará también su etiqueta en el libreto y se ajustarán los números siguientes. ¿Quieres continuar?"
      : "¿Quieres borrar este cue?";
    if (!window.confirm(message)) return;

    await deleteCue(cue.id);
    const nextCues = await getAllCues();
    setCues(nextCues);
  };

  const setField = <K extends keyof Cue>(key: K, value: Cue[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <Card className="border-slate-800 bg-slate-900/80">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Lista</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Cues por producción</h2>
          </div>
          <div className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-300">
            {visibleCues.length} registros
          </div>
        </div>

        <div className="space-y-3">
          {visibleCues.map((cue) => (
            <div key={cue.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getCueColorClasses(cue.type)}`}>
                    {cue.type}
                  </span>
                  <h3 className="mt-2 text-lg font-semibold text-white">{cue.identifier}</h3>
                  {cue.type === "SIM" && cue.includedTypes && (
                    <p className="mt-1 text-xs text-green-200">{cue.includedTypes.join(" + ")}</p>
                  )}
                  <p className="mt-1 text-sm text-slate-300">{cue.description}</p>
                  {cue.pie?.trim() && (
                    <p className="mt-2 text-sm text-cyan-200">
                      <span className="font-semibold">Pie:</span> {cue.pie}
                    </p>
                  )}
                </div>
                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.15em] text-amber-300">
                  {cue.status}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                <span>{cue.act} · {cue.scene}</span>
                <span>{cue.department}</span>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <Button type="button" onClick={() => setForm(cue)} className="border-slate-700 bg-slate-900 text-slate-100">
                  Editar
                </Button>
                <Button type="button" onClick={() => void handleDelete(cue)} className="border-rose-500/20 bg-rose-500/10 text-rose-200">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Borrar
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="border-slate-800 bg-slate-900/80">
        <div className="mb-4 flex items-center gap-2 text-cyan-300">
          <Wrench className="h-5 w-5" />
          <span className="text-xs uppercase tracking-[0.2em]">Editor de cue</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-2 text-sm text-slate-300">
            <span>Producción</span>
            <select
              value={selectedProductionId}
              onChange={(event) => {
                setSelectedProductionId(event.target.value);
                setForm((current) => ({ ...current, productionId: event.target.value }));
              }}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.title}</option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-300">
              <span>Identificador</span>
              <input
                value={form.identifier}
                onChange={(event) => setField("identifier", event.target.value)}
                pattern={form.scriptDocumentId ? getCueIdentifierPattern(form.type) : undefined}
                required={Boolean(form.scriptDocumentId)}
                title={form.scriptDocumentId ? "Usa un número entero o decimal, como MOV-5.5." : undefined}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none placeholder:text-slate-500"
                placeholder={`${getCueIdentifierType(form.type)}-01`}
              />
            </label>

            <label className="space-y-2 text-sm text-slate-300">
              <span>Tipo</span>
              <select
                value={form.type}
                disabled={Boolean(form.scriptDocumentId)}
                onChange={(event) => {
                  const nextType = event.target.value as CueType;
                  setField("type", nextType);
                  setField("identifier", getNextIdentifier(visibleCues, nextType));
                  setField("department", cueDepartmentByType[nextType]);
                  setField("includedTypes", nextType === "SIM" ? ["LX", "MOV"] : undefined);
                }}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
              >
                {cueTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>

          {form.type === "PREVENIR" && (
            <p className="rounded-lg border border-orange-400/30 bg-orange-500/10 px-3 py-2 text-sm text-orange-200">
              PREVENIR avisa sobre un movimiento MOV y no incrementa su numeración.
            </p>
          )}

          {form.type === "SIM" && (
            <fieldset className="space-y-2">
              <legend className="text-sm text-slate-300">Señales que coinciden</legend>
              <div className="grid grid-cols-2 gap-2">
                {cueComponentOptions.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-slate-200"
                  >
                    <input
                      type="checkbox"
                      checked={form.includedTypes?.includes(option.value) ?? false}
                      onChange={(event) => {
                        const current = form.includedTypes ?? [];
                        setField(
                          "includedTypes",
                          event.target.checked
                            ? [...current, option.value]
                            : current.filter((value) => value !== option.value),
                        );
                      }}
                      className="accent-green-500"
                    />
                    {option.value}
                  </label>
                ))}
              </div>
              {(form.includedTypes?.length ?? 0) < 2 && (
                <p className="text-xs text-rose-300">Selecciona al menos dos tipos para un cambio simultáneo.</p>
              )}
            </fieldset>
          )}

          <label className="block space-y-2 text-sm text-slate-300">
            <span>Descripción</span>
            <textarea
              value={form.description}
              onChange={(event) => setField("description", event.target.value)}
              className="min-h-20 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none placeholder:text-slate-500"
              placeholder="Descripción del cue técnico"
            />
          </label>

          <label className="block space-y-2 text-sm text-slate-300">
            <span>Pie</span>
            <textarea
              value={form.pie ?? ""}
              onChange={(event) => setField("pie", event.target.value)}
              className="min-h-16 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none placeholder:text-slate-500"
              placeholder="Acción que da pie a este cue"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-300">
              <span>Acto</span>
              <input
                value={form.act}
                disabled={Boolean(form.scriptDocumentId)}
                onChange={(event) => setField("act", event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
              />
            </label>

            <label className="space-y-2 text-sm text-slate-300">
              <span>Escena</span>
              <input
                value={form.scene}
                disabled={Boolean(form.scriptDocumentId)}
                onChange={(event) => setField("scene", event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-300">
              <span>Departamento</span>
              <select
                value={form.department}
                onChange={(event) => setField("department", event.target.value as Cue["department"])}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
              >
                <option value="Iluminación">Iluminación</option>
                <option value="Sonido">Sonido</option>
                <option value="Maquinaria">Maquinaria</option>
                <option value="Utilería">Utilería</option>
                <option value="Vestuario">Vestuario</option>
                <option value="Caracterización">Caracterización</option>
                <option value="Vídeo">Vídeo</option>
                <option value="Regiduría">Regiduría</option>
                <option value="Reparto">Reparto</option>
              </select>
            </label>

            <label className="space-y-2 text-sm text-slate-300">
              <span>Estado</span>
              <select
                value={form.status}
                onChange={(event) => setField("status", event.target.value as Cue["status"])}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
              >
                <option value="Borrador">Borrador</option>
                <option value="Preparado">Preparado</option>
                <option value="Ejecutado">Ejecutado</option>
                <option value="Pendiente">Pendiente</option>
              </select>
            </label>
          </div>

          <label className="block space-y-2 text-sm text-slate-300">
            <span>Observaciones</span>
            <textarea
              value={form.observations}
              onChange={(event) => setField("observations", event.target.value)}
              className="min-h-20 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none placeholder:text-slate-500"
              placeholder="Anotaciones del responsable"
            />
          </label>

          {form.scriptDocumentId && (
            <p className="text-xs leading-5 text-cyan-200">
              Puedes editar el identificador, la descripción y el pie. Tipo, acto y escena siguen vinculados a la etiqueta del PDF.
            </p>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button
              type="submit"
              disabled={form.type === "SIM" && (form.includedTypes?.length ?? 0) < 2}
              className="border-cyan-500/30 bg-cyan-500/10 text-cyan-200"
            >
              <Save className="mr-2 h-4 w-4" />
              Guardar cue
            </Button>
            <Button
              type="button"
              onClick={() => setForm({ ...emptyCue, productionId: selectedProductionId })}
              className="border-slate-700 bg-slate-900 text-slate-100"
            >
              Nuevo
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
