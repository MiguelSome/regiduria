"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpenText, ChevronDown, ChevronUp, FileText } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";

import type { ScriptDocument } from "@/lib/types";

pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface ScriptPagePreviewProps {
  document: ScriptDocument | null;
  documentLoading: boolean;
  pageNumber: number;
  onPageChange: (page: number) => void;
  onPageCountChange: (pageCount: number) => void;
  cueIdentifier?: string;
  cueHasPage?: boolean;
}

export function ScriptPagePreview({
  document,
  documentLoading,
  pageNumber,
  onPageChange,
  onPageCountChange,
  cueIdentifier,
  cueHasPage = false,
}: ScriptPagePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loadedPdf, setLoadedPdf] = useState<{
    documentId: string;
    pdfDocument: pdfjsLib.PDFDocumentProxy;
  } | null>(null);
  const [loadError, setLoadError] = useState<{ documentId: string; message: string } | null>(null);
  const pdfDocument =
    document && loadedPdf?.documentId === document.id ? loadedPdf.pdfDocument : null;
  const error = document && loadError?.documentId === document.id ? loadError.message : null;
  const totalPages = pdfDocument?.numPages ?? 0;
  const documentName = document
    ? document.displayName ?? document.fileName.replace(/\.pdf$/i, "")
    : "";

  useEffect(() => {
    let active = true;
    let loadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;

    if (!document) return;
    const loadPdf = async () => {
      try {
        const bytes = new Uint8Array(await document.pdfData.arrayBuffer());
        if (!active) return;

        loadingTask = pdfjsLib.getDocument({ data: bytes });
        const loadedDocument = await loadingTask.promise;
        if (!active) {
          await loadingTask.destroy();
          return;
        }

        setLoadedPdf({ documentId: document.id, pdfDocument: loadedDocument });
        onPageCountChange(loadedDocument.numPages);
      } catch (loadError) {
        if (!active) return;
        console.error(loadError);
        setLoadError({
          documentId: document.id,
          message: "No se pudo abrir el PDF del libreto.",
        });
      }
    };

    void loadPdf();
    return () => {
      active = false;
      if (loadingTask) void loadingTask.destroy();
    };
  }, [document, onPageCountChange]);

  useEffect(() => {
    if (!document || !pdfDocument || pageNumber < 1 || pageNumber > pdfDocument.numPages) return;
    const documentId = document.id;

    let cancelled = false;
    let renderTask: pdfjsLib.RenderTask | undefined;

    const renderPage = async () => {
      try {
        const page = await pdfDocument.getPage(pageNumber);
        if (cancelled) return;

        const viewport = page.getViewport({ scale: 1.35 });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext("2d");
        if (!context) {
          throw new Error("No se pudo preparar el lienzo para el PDF.");
        }

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        renderTask = page.render({ canvas, canvasContext: context, viewport });
        await renderTask.promise;
      } catch (renderError) {
        if (cancelled) return;
        if (renderError instanceof Error && renderError.name === "RenderingCancelledException") return;
        console.error(renderError);
        setLoadError({
          documentId,
          message: "No se pudo dibujar esta página del PDF.",
        });
      }
    };

    void renderPage();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [document, pageNumber, pdfDocument]);

  const goToPage = (page: number) => {
    onPageChange(Math.min(totalPages, Math.max(1, page)));
  };

  return (
    <section
      id="libreto-performance-view"
      aria-label="Libreto durante la función"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <BookOpenText className="h-4 w-4 shrink-0 text-cyan-300" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white">Libreto</h3>
            <p className="truncate text-xs text-slate-400">
              {documentName || "PDF de la producción"}
            </p>
          </div>
        </div>

        {totalPages > 0 && (
          <nav aria-label="Navegación del libreto" className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => goToPage(pageNumber - 1)}
              disabled={pageNumber <= 1}
              aria-label="Página anterior"
              title="Página anterior (flecha arriba)"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <span className="min-w-24 text-center text-xs tabular-nums text-slate-300">
              Página {pageNumber} de {totalPages}
            </span>
            <button
              type="button"
              onClick={() => goToPage(pageNumber + 1)}
              disabled={pageNumber >= totalPages}
              aria-label="Página siguiente"
              title="Página siguiente (flecha abajo)"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </nav>
        )}
      </header>

      {pdfDocument && !error && cueIdentifier && !cueHasPage && (
        <p role="status" className="border-b border-amber-500/20 bg-amber-500/5 px-4 py-2 text-xs text-amber-200">
          {cueIdentifier} no tiene una página etiquetada. Usa ↑ y ↓ para buscarla.
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-auto bg-slate-900 p-3 sm:p-5">
        {documentLoading ? (
          <p role="status" className="flex min-h-48 items-center justify-center text-sm text-slate-300">
            Cargando libreto…
          </p>
        ) : !document ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
            <FileText className="h-9 w-9 text-slate-500" />
            <div>
              <p className="font-medium text-white">No hay PDF cargado</p>
              <p className="mt-1 max-w-sm text-sm text-slate-400">
                Carga el libreto de esta producción para mostrar la página de cada cue.
              </p>
            </div>
          </div>
        ) : error ? (
          <p role="alert" className="flex min-h-48 items-center justify-center text-sm text-rose-200">
            {error}
          </p>
        ) : !pdfDocument ? (
          <p role="status" className="flex min-h-48 items-center justify-center text-sm text-slate-300">
            Cargando libreto…
          </p>
        ) : (
          <div className="mx-auto w-full max-w-[900px]">
            <canvas
              ref={canvasRef}
              aria-label={`Página ${pageNumber} del libreto`}
              className="block h-auto w-full rounded-md border border-slate-300 bg-white shadow-xl"
            />
          </div>
        )}
      </div>

      {totalPages > 0 && (
        <p className="shrink-0 border-t border-slate-800 px-4 py-2 text-center text-xs text-slate-500">
          ↑ página anterior · ↓ página siguiente
        </p>
      )}
    </section>
  );
}
