import { AlarmClockCheck, Eye, Wrench } from "lucide-react";

import { cues } from "@/lib/mock-data";
import type { Cue } from "@/lib/types";

import { Card } from "@/components/ui/card";

const statusClasses: Record<Cue["status"], string> = {
  Borrador: "bg-slate-700 text-slate-100",
  Preparado: "bg-emerald-500/15 text-emerald-300",
  Ejecutado: "bg-amber-500/15 text-amber-300",
  Pendiente: "bg-rose-500/15 text-rose-300",
};

export function CueTable() {
  return (
    <Card className="border-slate-800 bg-slate-900/70">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Cues activos</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Programa técnico</h2>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-300">
          <Wrench className="h-4 w-4 text-cyan-300" />
          Orden protegido
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="min-w-full divide-y divide-slate-800 text-left text-sm text-slate-200">
          <thead className="bg-slate-950 text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Identificador</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Escena</th>
              <th className="px-4 py-3 font-medium">Departamento</th>
              <th className="px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-900/50">
            {cues.map((cue) => (
              <tr key={cue.id} className="hover:bg-slate-900/90">
                <td className="px-4 py-3 font-medium text-white">{cue.identifier}</td>
                <td className="px-4 py-3">{cue.type}</td>
                <td className="px-4 py-3">{cue.act} · {cue.scene}</td>
                <td className="px-4 py-3 text-slate-300">{cue.department}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs ${statusClasses[cue.status]}`}>
                    {cue.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
          <div className="flex items-center gap-2 text-cyan-300">
            <Eye className="h-4 w-4" />
            <span className="text-xs uppercase tracking-[0.15em]">Sincronía</span>
          </div>
          <p className="mt-2 text-sm text-slate-300">Relación libreto-cue mantenida por escena y acto.</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
          <div className="flex items-center gap-2 text-cyan-300">
            <AlarmClockCheck className="h-4 w-4" />
            <span className="text-xs uppercase tracking-[0.15em]">Preparación</span>
          </div>
          <p className="mt-2 text-sm text-slate-300">La ejecución durante función se distingue del estado de preparación.</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
          <div className="flex items-center gap-2 text-cyan-300">
            <Wrench className="h-4 w-4" />
            <span className="text-xs uppercase tracking-[0.15em]">Seguridad</span>
          </div>
          <p className="mt-2 text-sm text-slate-300">No se reordenan ni renumeran automáticamente los cues.</p>
        </div>
      </div>
    </Card>
  );
}
