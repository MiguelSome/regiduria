import { IncidentManager } from "@/components/incidents/incident-manager";

export default function IncidenciasPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Registro</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Incidencias</h1>
      </div>
      <IncidentManager />
    </div>
  );
}
