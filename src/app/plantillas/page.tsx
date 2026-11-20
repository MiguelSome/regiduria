import { TemplateManager } from "@/components/dance/template-manager";

export default function PlantillasPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Biblioteca global</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Plantillas</h1>
      </div>
      <TemplateManager />
    </div>
  );
}
