"use client";

import { useEffect, useState } from "react";

import { formatClock } from "@/lib/dance/schedule";
import { useDanceRuntimeStore } from "@/store/dance-runtime-store";

/** Show clock: only the in-memory runtime sample, never a second stopwatch. */
export function ShowClock() {
  const showSample = useDanceRuntimeStore((state) => state.showSample);
  const startShow = useDanceRuntimeStore((state) => state.startShow);
  const pauseShow = useDanceRuntimeStore((state) => state.pauseShow);
  const getShowActiveMs = useDanceRuntimeStore((state) => state.getShowActiveMs);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, []);

  const isPaused = showSample !== null && showSample.pausedAt !== null && showSample.pausedAt !== undefined;
  const status = !showSample ? "Detenido" : isPaused ? "Pausado" : "En marcha";

  function handleToggle() {
    const instant = Date.now();
    if (!showSample || isPaused) {
      startShow(instant);
    } else {
      pauseShow(instant);
    }
    setNow(instant);
  }

  const buttonLabel = !showSample ? "Iniciar espectáculo" : isPaused ? "Reanudar" : "Pausar";

  return (
    <section
      aria-label="Reloj de espectáculo"
      aria-live="off"
      className="w-full rounded-xl border border-slate-700 bg-slate-900/70 p-3 text-slate-100"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-slate-400">Espectáculo</p>
          <output
            style={{ fontSize: "calc(1.5rem * var(--dance-font-scale, 1))" }}
            className="block max-w-full font-mono text-2xl tabular-nums text-cyan-200"
          >
            {formatClock(getShowActiveMs(now ?? 0))}
          </output>
          <p className="text-[11px] text-slate-400">{status}</p>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          className="min-h-11 min-w-11 rounded-lg border border-cyan-600 bg-cyan-950/40 px-3 py-2 text-sm font-medium text-cyan-100 outline-none hover:bg-cyan-900/40 focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          {buttonLabel}
        </button>
      </div>
    </section>
  );
}

export default ShowClock;
