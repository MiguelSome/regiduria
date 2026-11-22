import type {
  DeviationReport,
  DeviationReportEntry,
  Performance,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export interface DeviationReportViewProps {
  performance: Performance;
  report: DeviationReport;
  print?: boolean;
}

function formatPrintDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

interface EntryListProps {
  id: string;
  title: string;
  entries: DeviationReportEntry[];
  mutedClass: string;
  headingClass: string;
  panelClass: string;
}

function EntryList({ id, title, entries, mutedClass, headingClass, panelClass }: EntryListProps) {
  return (
    <section aria-labelledby={`${id}-title`} className={panelClass}>
      <h2 id={`${id}-title`} className={cn("mb-3 text-base font-semibold", headingClass)}>
        {title} <span className={cn("font-normal", mutedClass)}>({entries.length})</span>
      </h2>
      {entries.length === 0 ? (
        <p className={cn("text-sm", mutedClass)}>Ninguno.</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li
              key={`${entry.cueId}-${entry.cueIdentifier}`}
              className="border-b border-slate-300 pb-2 text-sm last:border-0"
            >
              <span className="font-mono font-semibold">{entry.cueIdentifier}</span>
              <span> · {entry.trackTitle} · {entry.cueDescription || "—"}</span>
              {entry.targetText && <span> · objetivo {entry.targetText}</span>}
              {entry.cuePie && (
                <span className={cn("mt-1 block whitespace-pre-wrap break-words text-[11px]", mutedClass)}>
                  Pie: {entry.cuePie}
                </span>
              )}
              {entry.cueObservations && (
                <span className={cn("mt-1 block whitespace-pre-wrap break-words text-[11px]", mutedClass)}>
                  Observaciones: {entry.cueObservations}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Read-only view of the deviation report. Every text comes from the derived
 * report (launch snapshots), so editing a cue afterwards cannot change it
 * (RF24/D35). No controls are rendered, in print or on screen.
 */
export function DeviationReportView({ performance, report, print = false }: DeviationReportViewProps) {
  const mutedClass = print ? "text-slate-600" : "text-slate-400";
  const headingClass = print ? "text-slate-900" : "text-white";
  const panelClass = print
    ? "border-0 p-0"
    : "rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-sm shadow-slate-950/20";
  const { summary } = report;
  const maxText = summary.maxDeviation
    ? `${summary.maxDeviation.cueIdentifier} · ${summary.maxDeviation.deviationText}`
    : "—";

  return (
    <div
      id={print ? "print-sheet" : undefined}
      className={print ? "space-y-4 bg-white p-6 text-slate-900" : "space-y-5"}
    >
      <section aria-labelledby="report-header-title" className={panelClass}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <p className={cn("text-xs uppercase tracking-[0.2em]", mutedClass)}>
              Informe de desviaciones
            </p>
            <h1 id="report-header-title" className={cn("text-2xl font-semibold", headingClass)}>
              {performance.title}
            </h1>
            <p className={cn("text-sm", mutedClass)}>
              Función: {performance.date} · {performance.time}
            </p>
          </div>
          <p className={cn("text-sm", mutedClass)}>
            Fecha y hora: {formatPrintDateTime(report.generatedAt)}
          </p>
        </div>
      </section>

      <section aria-labelledby="report-summary-title" className={panelClass}>
        <h2 id="report-summary-title" className={cn("mb-3 text-base font-semibold", headingClass)}>
          Resumen
        </h2>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
          <div>
            <dt className={cn("text-xs uppercase tracking-wider", mutedClass)}>Cues lanzados</dt>
            <dd className={cn("font-semibold", headingClass)}>{summary.launchedCount}</dd>
          </div>
          <div>
            <dt className={cn("text-xs uppercase tracking-wider", mutedClass)}>Cues con objetivo</dt>
            <dd className={cn("font-semibold", headingClass)}>{summary.withTargetCount}</dd>
          </div>
          <div>
            <dt className={cn("text-xs uppercase tracking-wider", mutedClass)}>Desviación media</dt>
            <dd className={cn("font-mono font-semibold", headingClass)}>{summary.averageText}</dd>
          </div>
          <div>
            <dt className={cn("text-xs uppercase tracking-wider", mutedClass)}>Desviación máxima</dt>
            <dd className={cn("font-mono font-semibold", headingClass)}>{maxText}</dd>
          </div>
          <div>
            <dt className={cn("text-xs uppercase tracking-wider", mutedClass)}>No alcanzados</dt>
            <dd className={cn("font-semibold", headingClass)}>{summary.notReachedCount}</dd>
          </div>
        </dl>
        {summary.launchedCount === 0 && (
          <p className={cn("mt-3 text-sm", mutedClass)}>Sin cues lanzados.</p>
        )}
        {summary.withTargetCount === 0 && (
          <p className={cn("mt-3 text-sm", mutedClass)}>Sin objetivos.</p>
        )}
      </section>

      <section aria-labelledby="report-rows-title" className={panelClass}>
        <h2 id="report-rows-title" className={cn("mb-3 text-base font-semibold", headingClass)}>
          Desviaciones por cue
        </h2>
        <div className={cn("overflow-x-auto", print && "overflow-visible")}>
          <table className={cn("w-full min-w-[48rem] border-collapse text-left text-xs", print && "min-w-0")}>
            <thead>
              <tr className={cn("border-b", print ? "border-slate-400" : "border-slate-700")}>
                <th scope="col" className="px-2 py-2 font-semibold">Identificador</th>
                <th scope="col" className="px-2 py-2 font-semibold">Track</th>
                <th scope="col" className="px-2 py-2 font-semibold">Objetivo</th>
                <th scope="col" className="px-2 py-2 font-semibold">Real</th>
                <th scope="col" className="px-2 py-2 font-semibold">Desviación</th>
                <th scope="col" className="px-2 py-2 font-semibold">Estado</th>
                <th scope="col" className="px-2 py-2 font-semibold">Descripción y notas</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr
                  key={`${row.cueId}-${row.launchedAt}`}
                  className={cn("align-top border-b", print ? "border-slate-300" : "border-slate-800/70")}
                >
                  <td className="px-2 py-2 font-mono font-semibold">{row.cueIdentifier}</td>
                  <td className="px-2 py-2">{row.trackTitle}</td>
                  <td className="whitespace-nowrap px-2 py-2 font-mono">{row.targetText}</td>
                  <td className="whitespace-nowrap px-2 py-2 font-mono">{row.actualText ?? "—"}</td>
                  <td className="whitespace-nowrap px-2 py-2 font-mono font-semibold">{row.deviationText}</td>
                  <td className="px-2 py-2">{row.onTime ? "a tiempo" : "Desviado"}</td>
                  <td className="px-2 py-2">
                    <span className="whitespace-pre-wrap break-words">{row.cueDescription || "—"}</span>
                    {row.cuePie && (
                      <span className={cn("mt-1 block whitespace-pre-wrap break-words text-[11px]", mutedClass)}>
                        Pie: {row.cuePie}
                      </span>
                    )}
                    {row.cueObservations && (
                      <span className={cn("mt-1 block whitespace-pre-wrap break-words text-[11px]", mutedClass)}>
                        Observaciones: {row.cueObservations}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {report.rows.length === 0 && (
            <p className={cn("px-2 py-3 text-sm", mutedClass)}>No hay desviaciones medidas.</p>
          )}
        </div>
      </section>

      <EntryList
        id="report-launched-without-target"
        title="Lanzados sin objetivo"
        entries={report.launchedWithoutTarget}
        mutedClass={mutedClass}
        headingClass={headingClass}
        panelClass={panelClass}
      />
      <EntryList
        id="report-launched-without-reference"
        title="Lanzados sin referencia temporal"
        entries={report.launchedWithoutReference}
        mutedClass={mutedClass}
        headingClass={headingClass}
        panelClass={panelClass}
      />
      <EntryList
        id="report-pending-without-target"
        title="Pendientes sin objetivo al cerrar"
        entries={report.pendingWithoutTarget}
        mutedClass={mutedClass}
        headingClass={headingClass}
        panelClass={panelClass}
      />
      <EntryList
        id="report-not-reached"
        title="No alcanzados"
        entries={report.notReached}
        mutedClass={mutedClass}
        headingClass={headingClass}
        panelClass={panelClass}
      />
    </div>
  );
}
