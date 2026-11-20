import { DocumentView } from "@/components/dance/document-view";

export default function DocumentoPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Documentación</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Documento / escaleta</h1>
      </div>
      <DocumentView />
    </div>
  );
}
