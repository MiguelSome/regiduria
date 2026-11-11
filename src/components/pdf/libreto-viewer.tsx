"use client";

import { FileText, MapPinned } from "lucide-react";

import { productions } from "@/lib/mock-data";

import { Card } from "@/components/ui/card";

export function LibretoViewer() {
  const production = productions[0];

  return (
    <Card className="border-slate-800 bg-slate-900/75">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Libreto</p>
          <h2 className="mt-2 text-xl font-semibold text-white">{production.title}</h2>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-300">
          <FileText className="h-4 w-4 text-cyan-300" />
          PDF local
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.8fr_0.9fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="mb-4 flex items-center justify-between text-sm text-slate-300">
            <span>Acto I · página 12</span>
            <span>Escena 2</span>
          </div>
          <div className="space-y-4 rounded-xl border border-slate-800 bg-white p-5 text-slate-700 shadow-inner">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Texto del libreto</p>
            <p className="text-lg font-medium leading-8">
              “No sé si la noche se ha vuelto más larga, pero la paz del jardín ya no llega a la casa.”
            </p>
            <p className="text-sm leading-7 text-slate-600">
              La escena mantiene la tensión del silencio, mientras la luz de fondo desciende para preparar la entrada del diálogo principal.
            </p>
            <div className="h-px bg-slate-200" />
            <p className="text-sm leading-7 text-slate-600">
              La evolución del cue LX-01 deberá seguir la respiración de la escena sin desalinear la intención del director.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {production.scenes.map((scene) => (
            <div key={scene.id} className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-cyan-300">
                  <MapPinned className="h-4 w-4" />
                  <span className="text-sm font-medium text-white">{scene.act}</span>
                </div>
                <span className="text-xs uppercase tracking-[0.15em] text-slate-400">{scene.number}</span>
              </div>
              <p className="mt-2 text-base font-medium text-white">{scene.title}</p>
              <p className="mt-2 text-sm text-slate-300">{scene.summary}</p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
