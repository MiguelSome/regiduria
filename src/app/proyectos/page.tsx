import { ProjectManager } from "@/components/projects/project-manager";

export default function ProyectosPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Gestión</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Producciones</h1>
      </div>
      <ProjectManager />
    </div>
  );
}
