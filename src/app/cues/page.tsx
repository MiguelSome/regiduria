import { CueManager } from "@/components/cues/cue-manager";

export default function CuesPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Programa técnico</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Gestión de cues</h1>
      </div>
      <CueManager />
    </div>
  );
}
