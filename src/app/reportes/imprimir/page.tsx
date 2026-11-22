"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { DeviationReportView } from "@/components/dance/deviation-report";
import { getCuesByProduction, getDanceTracks, getPerformances } from "@/lib/data-service";
import { buildDeviationReport } from "@/lib/dance/report";
import type { DeviationReport, Performance } from "@/lib/types";

type ReportState =
  | { id: string; status: "ready"; performance: Performance; report: DeviationReport }
  | { id: string; status: "empty"; message: string }
  | { id: string; status: "error" };

function MessageSheet({ message }: { message: string }) {
  return (
    <div id="print-sheet" className="bg-white p-6 text-slate-900">
      <p className="text-sm">{message}</p>
    </div>
  );
}

function ReporteImprimirContent() {
  const searchParams = useSearchParams();
  const performanceId = searchParams.get("performance");
  const [state, setState] = useState<ReportState | null>(null);

  useEffect(() => {
    if (!performanceId) return;
    let cancelled = false;

    void (async () => {
      try {
        const performances = await getPerformances();
        const performance = performances.find((item) => item.id === performanceId);
        if (!performance) {
          if (!cancelled) {
            setState({
              id: performanceId,
              status: "empty",
              message: "No se encontró la función solicitada.",
            });
          }
          return;
        }

        const runReport = performance.runReport;
        if (runReport?.mode !== "show") {
          if (!cancelled) {
            setState({
              id: performanceId,
              status: "empty",
              message: "Esta función no es de danza y no tiene informe de desviaciones.",
            });
          }
          return;
        }

        const [cues, tracks] = await Promise.all([
          getCuesByProduction(performance.productionId),
          getDanceTracks(performance.productionId),
        ]);
        // The report is derived in the UI layer from the stored record; the
        // instant is injected here, never read inside domain code.
        const report = buildDeviationReport({ runReport, cues, tracks, now: Date.now() });
        if (!cancelled) setState({ id: performanceId, status: "ready", performance, report });
      } catch {
        if (!cancelled) setState({ id: performanceId, status: "error" });
      }
    })();

    return () => { cancelled = true; };
  }, [performanceId]);

  if (!performanceId) {
    return <MessageSheet message="No se indicó la función que se quiere imprimir." />;
  }
  if (!state || state.id !== performanceId) {
    return <MessageSheet message="Cargando informe…" />;
  }
  if (state.status === "ready") {
    return <DeviationReportView performance={state.performance} report={state.report} print />;
  }
  if (state.status === "empty") return <MessageSheet message={state.message} />;
  return <MessageSheet message="No se pudo cargar el informe. Inténtalo de nuevo." />;
}

export default function ReportesImprimirPage() {
  return (
    <Suspense fallback={<MessageSheet message="Cargando informe…" />}>
      <ReporteImprimirContent />
    </Suspense>
  );
}
