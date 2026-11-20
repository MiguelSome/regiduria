"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";

export interface ModeBadgeProps {
  mode: "rehearsal" | "show";
  canToggle: boolean;
  toggleReason?: string;
  onToggle: () => void;
}

/**
 * Permanent execution-mode badge plus its single toggle. The parent owns the
 * confirmation and the state reset; this component only reports the intent.
 */
export function ModeBadge({ mode, canToggle, toggleReason, onToggle }: ModeBadgeProps) {
  const reasonId = useId();
  const isRehearsal = mode === "rehearsal";
  const badgeText = isRehearsal ? "ENSAYO" : "FUNCIÓN";
  const targetText = isRehearsal ? "Función" : "Ensayo";
  const reason = toggleReason?.trim() ? toggleReason.trim() : undefined;

  return (
    <section
      aria-label="Modo de ejecución"
      className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 shadow-sm shadow-slate-950/20"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          aria-label={`Modo de ejecución: ${badgeText}`}
          className={cn(
            "inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1 text-sm font-bold tracking-wide outline-none",
            isRehearsal
              ? "border-sky-400 bg-sky-950 text-sky-100"
              : "border-cyan-400 bg-cyan-950 text-cyan-100",
          )}
        >
          <span aria-hidden="true">{isRehearsal ? "◐" : "●"}</span>
          {badgeText}
        </span>
        <button
          type="button"
          onClick={onToggle}
          disabled={!canToggle}
          aria-describedby={reason ? reasonId : undefined}
          title={reason}
          className={cn(
            "inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-100 outline-none",
            "hover:border-cyan-500 hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-cyan-400",
            "disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-900 disabled:text-slate-400 disabled:opacity-70",
          )}
        >
          {`Cambiar a ${targetText}`}
        </button>
      </div>
      {reason && (
        <p id={reasonId} className="mt-2 text-xs font-medium text-amber-300">
          {reason}
        </p>
      )}
    </section>
  );
}

export default ModeBadge;
