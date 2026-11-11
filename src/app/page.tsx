import { BookOpenText, ClipboardList, FolderKanban, Sparkles } from "lucide-react";

import { cues, incidents, performances, productions } from "@/lib/mock-data";

import { MetricCard } from "@/components/dashboard/metric-card";
import { CueTable } from "@/components/cues/cue-table";
import { OperationMode } from "@/components/performance/operation-mode";
import { Card } from "@/components/ui/card";

export default function HomePage() {
  const selectedProduction = productions[0];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Proyectos activos"
          value={String(productions.length)}
          helper="Producciones con estado operativo y documentación fresca"
          icon={<FolderKanban className="h-5 w-5" />}
        />
        <MetricCard
          label="Cues pendientes"
          value={String(cues.filter((cue) => cue.status !== "Ejecutado").length)}
          helper="Preparación técnica todavía en curso"
          icon={<ClipboardList className="h-5 w-5" />}
        />
        <MetricCard
          label="Funciones"
          value={String(performances.length)}
          helper="Funciones registradas para la próxima semana"
          icon={<Sparkles className="h-5 w-5" />}
        />
        <MetricCard
          label="Incidencias"
          value={String(incidents.length)}
          helper="Seguimiento activo de avisos y correcciones"
          icon={<BookOpenText className="h-5 w-5" />}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <Card className="border-slate-800 bg-slate-900/70">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Proyecto actual</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{selectedProduction.title}</h2>
              </div>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                {selectedProduction.status}
              </span>
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-300">{selectedProduction.summary}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Escenarios</p>
                <p className="mt-2 text-xl font-semibold text-white">{selectedProduction.scenes.length}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Departamentos</p>
                <p className="mt-2 text-xl font-semibold text-white">{selectedProduction.departments.length}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Sincronización</p>
                <p className="mt-2 text-xl font-semibold text-white">{selectedProduction.syncStatus}</p>
              </div>
            </div>
          </Card>

          <CueTable />
        </div>

        <div className="space-y-6">
          <OperationMode />
          <Card className="border-slate-800 bg-slate-900/70">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Notas rápidas</p>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              {selectedProduction.departments.map((department) => (
                <li key={department.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-white">{department.name}</span>
                    <span className="text-xs uppercase tracking-[0.15em] text-cyan-300">{department.responsable}</span>
                  </div>
                  <p className="mt-2 text-slate-400">{department.notes[0]}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>
    </div>
  );
}
