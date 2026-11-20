"use client";

import { useEffect, useId, useRef, useState } from "react";

import type { Cue } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface CueNoteProps {
  cue: Cue;
  onSave: (observations: string) => Promise<void>;
  disabledReason?: string;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Inline observations editor. Only the text is handed to the parent, which
 * persists the whole cue with `saveCue` so timing and the schedule stay intact.
 */
export function CueNote({ cue, onSave, disabledReason }: CueNoteProps) {
  const labelId = useId();
  const reasonId = useId();
  const statusId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const saveButtonRef = useRef<HTMLButtonElement | null>(null);
  const synchronizedValueRef = useRef(cue.observations);
  const synchronizedCueIdRef = useRef(cue.id);
  const savingRef = useRef(false);
  const restoreFocusRef = useRef(false);
  const [draft, setDraft] = useState(cue.observations);
  const [status, setStatus] = useState<SaveStatus>("idle");

  // Follow external (already persisted) changes without overwriting unsaved text.
  useEffect(() => {
    if (synchronizedCueIdRef.current !== cue.id) {
      synchronizedCueIdRef.current = cue.id;
      synchronizedValueRef.current = cue.observations;
      setDraft(cue.observations);
      setStatus("idle");
      return;
    }
    if (draft === synchronizedValueRef.current && draft !== cue.observations) {
      setDraft(cue.observations);
    }
    synchronizedValueRef.current = cue.observations;
  }, [cue.id, cue.observations, draft]);

  // Returning focus to the always-mounted button keeps the keyboard flow stable.
  useEffect(() => {
    if (!restoreFocusRef.current || (status !== "saved" && status !== "error")) return;
    restoreFocusRef.current = false;
    saveButtonRef.current?.focus();
  }, [status]);

  const reason = disabledReason?.trim() ? disabledReason.trim() : undefined;
  const disabled = reason !== undefined;
  const saving = status === "saving";
  const describedBy = [reason ? reasonId : null, statusId].filter(Boolean).join(" ") || undefined;

  function statusText(): string {
    if (status === "saving") return "Guardando nota…";
    if (status === "saved") return "Nota guardada.";
    if (status === "error") return "No se pudo guardar la nota. Inténtalo de nuevo.";
    if (draft !== cue.observations) return "Nota sin guardar.";
    return "Sin cambios pendientes.";
  }

  async function handleSave() {
    if (disabled || savingRef.current) return;
    restoreFocusRef.current = Boolean(containerRef.current?.contains(document.activeElement));
    const text = draft;
    savingRef.current = true;
    setStatus("saving");
    try {
      await onSave(text);
      synchronizedValueRef.current = text;
      setStatus("saved");
    } catch {
      // The draft stays untouched so the user can retry without retyping.
      setStatus("error");
    } finally {
      savingRef.current = false;
    }
  }

  return (
    <div ref={containerRef} className="min-w-0 space-y-2">
      <label htmlFor={labelId} className="block text-xs font-semibold text-slate-300">
        {`Nota de ${cue.identifier}`}
      </label>
      <textarea
        id={labelId}
        value={draft}
        rows={3}
        disabled={disabled}
        readOnly={saving}
        aria-describedby={describedBy}
        onChange={(event) => {
          setDraft(event.target.value);
          if (status === "saved" || status === "error") setStatus("idle");
        }}
        placeholder="Observaciones para esta cue…"
        className="w-full min-w-0 resize-y rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm leading-relaxed text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
      />
      <button
        ref={saveButtonRef}
        type="button"
        onClick={() => void handleSave()}
        disabled={disabled || saving}
        aria-describedby={describedBy}
        className={cn(
          "inline-flex min-h-11 items-center justify-center rounded-lg border border-cyan-600 bg-cyan-950/40 px-4 py-2 text-sm font-semibold text-cyan-100 outline-none",
          "hover:bg-cyan-900/40 focus-visible:ring-2 focus-visible:ring-cyan-400",
          "disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-900 disabled:text-slate-400 disabled:opacity-70",
        )}
      >
        Guardar nota
      </button>
      {reason && (
        <p id={reasonId} className="text-xs font-medium text-amber-300">
          {reason}
        </p>
      )}
      <p
        id={statusId}
        role="status"
        aria-live={status === "error" ? "assertive" : "polite"}
        className={cn(
          "text-xs",
          status === "error" ? "text-amber-300"
            : status === "saved" ? "text-emerald-300" : "text-slate-400",
        )}
      >
        {statusText()}
      </p>
    </div>
  );
}

export default CueNote;
