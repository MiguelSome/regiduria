import { FileDown, FileText, Printer } from "lucide-react";

import { Card } from "@/components/ui/card";

export default function ReportesPage() {
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
    </div>
  );
}
