"use client";

import { FolderOpen, Save, Trash2, UserRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { deleteProduction, getProductions, saveProduction } from "@/lib/data-service";
import type { Production } from "@/lib/types";

const emptyProduction: Production = {
  id: "",
  title: "",
  subtitle: "",
  venue: "",
  status: "Activa",
  syncStatus: "Pendiente",
  lastUpdated: new Date().toISOString(),
  summary: "",
  departments: [],
  scenes: [],
};

export function ProjectManager() {
  const [projects, setProjects] = useState<Production[]>([]);
  const [form, setForm] = useState<Production>(emptyProduction);

  const loadProjects = useCallback(async () => {
    const data = await getProductions();
    setProjects(data);
    if (data.length > 0 && !form.id) {
      setForm(data[0]);
    }
  }, [form.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProjects();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadProjects]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalized: Production = {
      ...form,
      id: form.id || crypto.randomUUID(),
      lastUpdated: new Date().toISOString(),
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      venue: form.venue.trim(),
      summary: form.summary.trim(),
      departments: form.departments.length > 0 ? form.departments : [
        {
          id: crypto.randomUUID(),
          name: "Iluminación",
          responsable: "Responsable",
          notes: ["Primera nota de departamento"],
        },
      ],
      scenes: form.scenes.length > 0 ? form.scenes : [
        {
          id: crypto.randomUUID(),
          act: "Acto I",
          number: "1",
          title: "Escena inicial",
          summary: "Resumen de la escena",
        },
      ],
    };

    await saveProduction(normalized);
    const nextProjects = await getProductions();
    setProjects(nextProjects);
    setForm(normalized);
  };

  const handleEdit = (project: Production) => {
    setForm(project);
  };

  const handleDelete = async (id: string) => {
    await deleteProduction(id);
    const nextProjects = await getProductions();
    setProjects(nextProjects);
    if (nextProjects[0]) {
      setForm(nextProjects[0]);
    } else {
      setForm(emptyProduction);
    }
  };

  const setField = <K extends keyof Production>(key: K, value: Production[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Card className="border-slate-800 bg-slate-900/80">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Producciones</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Listado</h2>
          </div>
          <div className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-300">
            {projects.length} activos
          </div>
        </div>

        <div className="space-y-3">
          {projects.map((project) => (
            <div key={project.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.15em] text-slate-400">{project.status}</p>
                  <h3 className="mt-2 text-lg font-semibold text-white">{project.title}</h3>
                  <p className="mt-1 text-sm text-slate-300">{project.venue}</p>
                </div>
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.15em] text-emerald-300">
                  {project.syncStatus}
                </span>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <Button type="button" onClick={() => handleEdit(project)} className="border-slate-700 bg-slate-900 text-slate-100">
                  Editar
                </Button>
                <Button type="button" onClick={() => void handleDelete(project.id)} className="border-rose-500/20 bg-rose-500/10 text-rose-200">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="border-slate-800 bg-slate-900/80">
        <div className="mb-4 flex items-center gap-2 text-cyan-300">
          <FolderOpen className="h-5 w-5" />
          <span className="text-xs uppercase tracking-[0.2em]">Editor</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-300">
              <span>Título</span>
              <input
                value={form.title}
                onChange={(event) => setField("title", event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none ring-0 placeholder:text-slate-500"
                placeholder="Ej: La casa de Bernarda Alba"
              />
            </label>

            <label className="space-y-2 text-sm text-slate-300">
              <span>Temporada</span>
              <input
                value={form.subtitle}
                onChange={(event) => setField("subtitle", event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none placeholder:text-slate-500"
                placeholder="Ej: Temporada 2026"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-300">
              <span>Localidad / sala</span>
              <input
                value={form.venue}
                onChange={(event) => setField("venue", event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none placeholder:text-slate-500"
                placeholder="Teatro Principal"
              />
            </label>

            <label className="space-y-2 text-sm text-slate-300">
              <span>Estado</span>
              <select
                value={form.status}
                onChange={(event) => setField("status", event.target.value as Production["status"])}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
              >
                <option value="Activa">Activa</option>
                <option value="Archivada">Archivada</option>
              </select>
            </label>
          </div>

          <label className="block space-y-2 text-sm text-slate-300">
            <span>Resumen</span>
            <textarea
              value={form.summary}
              onChange={(event) => setField("summary", event.target.value)}
              className="min-h-28 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none placeholder:text-slate-500"
              placeholder="Describe la producción y su contexto técnico."
            />
          </label>

          <div className="flex items-center gap-2 text-sm text-slate-300">
            <UserRound className="h-4 w-4 text-cyan-300" />
            Departamentos: {form.departments.length}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-200">
              <Save className="mr-2 h-4 w-4" />
              Guardar producción
            </Button>
            <Button
              type="button"
              onClick={() => setForm(emptyProduction)}
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
