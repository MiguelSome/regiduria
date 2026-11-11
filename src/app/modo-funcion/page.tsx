import { OperationMode } from "@/components/performance/operation-mode";

export default function FuncionPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Ensayo y representación</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Modo función</h1>
      </div>
      <OperationMode />
    </div>
  );
}
