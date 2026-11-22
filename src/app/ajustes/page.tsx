import { PreferencesPanel } from "@/components/dance/preferences-panel";

export default function AjustesPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Configuración</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Ajustes de Danza</h1>
      </div>
      <PreferencesPanel />
    </div>
  );
}
