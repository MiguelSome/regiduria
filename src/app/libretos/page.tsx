import { LibretoViewer } from "@/components/pdf/libreto-viewer";

export default function LibretoPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Documentación</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Libretos y escenas</h1>
      </div>
      <LibretoViewer />
    </div>
  );
}
