import { FolderOpen, UsersRound } from "lucide-react";

import { productions } from "@/lib/mock-data";

import { Card } from "@/components/ui/card";

export default function ProyectosPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Gestión</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Producciones</h1>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {productions.map((project) => (
          <Card key={project.id} className="border-slate-800 bg-slate-900/80">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">{project.subtitle}</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{project.title}</h2>
              </div>
              <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-300">
                {project.syncStatus}
              </span>
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-300">{project.summary}</p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <div className="flex items-center gap-2 text-cyan-300">
                  <FolderOpen className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-[0.15em]">Escenas</span>
                </div>
                <p className="mt-2 text-xl font-semibold text-white">{project.scenes.length}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <div className="flex items-center gap-2 text-cyan-300">
                  <UsersRound className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-[0.15em]">Departamentos</span>
                </div>
                <p className="mt-2 text-xl font-semibold text-white">{project.departments.length}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
