"use client";

import { BellRing, CheckCircle2, Clock3, ListChecks, Play, TimerReset } from "lucide-react";

import { performances } from "@/lib/mock-data";

import { Card } from "@/components/ui/card";

const checklist = [
  "Comprobar luz general",
  "Revisar audio de apertura",
  "Confirmar escenario móvil",
  "Verificar utilería de entrada",
];

export function OperationMode() {
  const currentShow = performances[0];
  const progress = Math.round((currentShow.prepared / currentShow.total) * 100);

  return (
    <Card className="border-slate-800 bg-slate-900/80">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Modo función</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Panel de operación</h2>
        </div>
        <div className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-sm text-cyan-300">
          Estable · local
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Siguiente señal</p>
                <p className="mt-1 text-2xl font-semibold text-white">LX-03</p>
              </div>
              <div className="rounded-xl bg-emerald-500/15 p-2 text-emerald-300">
                <Play className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-slate-900 p-3 text-sm text-slate-300">
              <Clock3 className="h-4 w-4 text-cyan-300" />
              Escena actual: Acto I · 2 · La sentencia
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>Preparación de la función</span>
              <span>{progress}%</span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-cyan-400" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <div className="flex items-center gap-2 text-cyan-300">
              <ListChecks className="h-4 w-4" />
              <span className="text-sm uppercase tracking-[0.15em]">Checklist</span>
            </div>
            <div className="mt-4 space-y-3">
              {checklist.map((item, index) => (
                <div key={item} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-2.5">
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full ${index < 2 ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-700 text-slate-300"}`}>
                    {index < 2 ? <CheckCircle2 className="h-4 w-4" /> : <TimerReset className="h-4 w-4" />}
                  </div>
                  <span className="text-sm text-slate-200">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Cronómetro</p>
                <p className="mt-2 text-3xl font-semibold text-white">00:42:16</p>
              </div>
              <div className="rounded-xl bg-cyan-500/10 p-2 text-cyan-300">
                <Clock3 className="h-6 w-6" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-sm text-slate-400">Avisos y recordatorios</p>
            <div className="mt-3 space-y-3">
              {[
                "30 minutos antes",
                "15 minutos antes",
                "5 minutos antes",
              ].map((alert) => (
                <div key={alert} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-2.5">
                  <div className="flex items-center gap-2 text-slate-200">
                    <BellRing className="h-4 w-4 text-cyan-300" />
                    {alert}
                  </div>
                  <span className="text-xs uppercase tracking-[0.15em] text-amber-300">Activo</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-sm text-slate-400">Próxima función</p>
            <p className="mt-2 text-xl font-semibold text-white">{currentShow.title}</p>
            <p className="mt-1 text-sm text-slate-300">{currentShow.date} · {currentShow.time}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
