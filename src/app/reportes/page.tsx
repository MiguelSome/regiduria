"use client";

import { liveQuery } from "dexie";
import { FileDown, FileText, Printer } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Card } from "@/components/ui/card";
import { getPerformances } from "@/lib/data-service";
import type { Performance } from "@/lib/types";

export default function ReportesPage() {
  const [performances, setPerformances] = useState<Performance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const subscription = liveQuery(() => getPerformances()).subscribe({
      next: (nextPerformances) => {
        setPerformances(nextPerformances);
        setIsLoading(false);
        setLoadError(false);
      },
      error: () => {
        setIsLoading(false);
        setLoadError(true);
      },
    });
    return () => subscription.unsubscribe();
  }, []);

  // Rehearsals are not persisted; legacy records without `mode` are standard
  // shows and must not appear in the dance list (RF24/RF25).
  const dancePerformances = performances
    .filter((performance) => performance.runReport?.mode === "show")
    .slice()
    .reverse();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Documentación</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Reportes y tablillas</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2 text-cyan-300">
            <FileText className="h-4 w-4" />
            <span className="text-xs uppercase tracking-[0.15em]">PDF</span>
          </div>
          <p className="mt-4 text-xl font-semibold text-white">Libreto y notas</p>
          <p className="mt-2 text-sm text-slate-300">Documentación centralizada por producción y función.</p>
        </Card>

        <Card className="border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2 text-cyan-300">
            <Printer className="h-4 w-4" />
            <span className="text-xs uppercase tracking-[0.15em]">Tablillas</span>
          </div>
          <p className="mt-4 text-xl font-semibold text-white">Información técnica</p>
          <p className="mt-2 text-sm text-slate-300">Listas de cues, departamentos y seguimientos por reparto.</p>
        </Card>

        <Card className="border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2 text-cyan-300">
            <FileDown className="h-4 w-4" />
            <span className="text-xs uppercase tracking-[0.15em]">Exportación</span>
          </div>
          <p className="mt-4 text-xl font-semibold text-white">Sincronización segura</p>
          <p className="mt-2 text-sm text-slate-300">Los cambios locales se marcan antes de exportar o guardar.</p>
        </Card>
      </div>

      <section
        aria-labelledby="reportes-danza-title"
        className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5"
      >
        <h2 id="reportes-danza-title" className="text-lg font-semibold text-white">
          Funciones de danza
        </h2>
        {isLoading ? (
          <p role="status" className="mt-3 text-sm text-slate-300">Cargando funciones…</p>
        ) : loadError ? (
          <p role="alert" className="mt-3 text-sm text-amber-300">
            No se pudieron cargar las funciones de danza.
          </p>
        ) : dancePerformances.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No hay funciones de danza registradas.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-800">
            {dancePerformances.map((performance) => {
              const isOpen = performance.runReport?.endedAt === undefined;
              return (
                <li
                  key={performance.id}
                  className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-white">{performance.title}</p>
                    <p className="text-xs text-slate-400">
                      {performance.date} · {performance.time} · {isOpen ? "Abierta" : "Finalizada"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {isOpen && (
                      <span className="rounded-full border border-amber-600/60 px-2 py-0.5 text-xs text-amber-300">
                        En curso
                      </span>
                    )}
                    <Link
                      href={`/reportes/imprimir?performance=${encodeURIComponent(performance.id)}`}
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-cyan-700 px-3 py-2 text-sm text-cyan-200 outline-none hover:bg-cyan-950/40 focus-visible:ring-2 focus-visible:ring-cyan-400"
                    >
                      <Printer className="h-4 w-4" />
                      Ver informe
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
