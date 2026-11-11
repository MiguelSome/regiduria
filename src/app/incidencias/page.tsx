import { incidents } from "@/lib/mock-data";

import { Card } from "@/components/ui/card";

export default function IncidenciasPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Registro</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Incidencias</h1>
      </div>

      <div className="grid gap-4">
        {incidents.map((incident) => (
          <Card key={incident.id} className="border-slate-800 bg-slate-900/80">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-400">{incident.date}</p>
                <h2 className="mt-2 text-xl font-semibold text-white">{incident.title}</h2>
              </div>
              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300">
                {incident.status}
              </span>
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-300">{incident.description}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
