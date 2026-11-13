"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { liveQuery } from "dexie";
import { Moon, SunMedium, Theater, Wrench } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { getProductions } from "@/lib/data-service";
import { navigation } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import type { Production } from "@/lib/types";
import { useUiStore } from "@/store/ui-store";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    isDark,
    toggleTheme,
    selectedProjectId,
    setSelectedProjectId,
    isProductionSelectionLocked,
  } = useUiStore();
  const [productions, setProductions] = useState<Production[]>([]);
  const [isProductionsLoading, setIsProductionsLoading] = useState(true);
  const [productionLoadError, setProductionLoadError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  useEffect(() => {
    const savedProjectId = window.localStorage.getItem("regiduria:active-project") ?? "";
    useUiStore.getState().setSelectedProjectId(savedProjectId);

    const subscription = liveQuery(() => getProductions()).subscribe({
      next: (nextProductions) => {
        setProductions(nextProductions);
        setIsProductionsLoading(false);
        setProductionLoadError(null);

        const currentProjectId = useUiStore.getState().selectedProjectId;
        const selectedProject =
          nextProductions.find((production) => production.id === currentProjectId) ??
          nextProductions[0];
        const nextProjectId = selectedProject?.id ?? "";
        if (nextProjectId !== currentProjectId) {
          useUiStore.getState().setSelectedProjectId(nextProjectId);
        }
      },
      error: (error: unknown) => {
        console.error(error);
        setIsProductionsLoading(false);
        setProductionLoadError("No se pudieron cargar las producciones.");
      },
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/85 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-cyan-500/15 p-2 text-cyan-300">
                <Theater className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Producción</p>
                <h1 className="text-lg font-semibold text-white">Regiduría</h1>
              </div>
            </div>

            <div className="flex w-full items-center justify-end gap-3 sm:w-auto">
              <label className="min-w-0 flex-1 space-y-1 sm:w-56 sm:flex-none">
                <span className="block text-xs text-slate-400">Producción</span>
                <select
                  aria-label="Producción"
                  value={selectedProjectId}
                  disabled={
                    isProductionsLoading ||
                    productions.length === 0 ||
                    Boolean(productionLoadError) ||
                    isProductionSelectionLocked
                  }
                  title={
                    isProductionSelectionLocked
                      ? "No se puede cambiar de producción durante una función en curso o en pausa."
                      : productionLoadError ?? undefined
                  }
                  onChange={(event) => setSelectedProjectId(event.target.value)}
                  className="min-h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {productionLoadError ? (
                    <option value="">Error al cargar producciones</option>
                  ) : isProductionsLoading && productions.length === 0 ? (
                    <option value="">Cargando producciones…</option>
                  ) : productions.length === 0 ? (
                    <option value="">No hay proyectos</option>
                  ) : (
                    productions.map((production) => (
                      <option key={production.id} value={production.id}>{production.title}</option>
                    ))
                  )}
                </select>
              </label>
              <Button
                type="button"
                aria-label="Alternar tema oscuro"
                onClick={toggleTheme}
                className={cn(
                  "h-10 w-10 shrink-0 rounded-full border-slate-700 bg-slate-900 p-0 text-slate-200",
                  isDark ? "text-amber-300" : "text-slate-200",
                )}
              >
                {isDark ? <SunMedium className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800">
          <div className="mx-auto hidden max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 md:flex lg:px-8">
            <nav aria-label="Navegación principal" className="flex flex-wrap items-center gap-3">
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={pathname === item.href ? "page" : undefined}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-2 text-sm transition hover:border-slate-600 hover:bg-slate-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300",
                    pathname === item.href
                      ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-100"
                      : "border-slate-800 bg-slate-900 text-slate-300",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="hidden shrink-0 items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 lg:flex">
              <Wrench className="h-3.5 w-3.5 text-cyan-300" />
              Sistema local + sincronización segura
            </div>
          </div>
          <nav
            aria-label="Navegación principal"
            className="mx-auto flex max-w-7xl gap-3 overflow-x-auto px-4 py-3 sm:px-6 md:hidden"
          >
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-2 text-xs hover:border-slate-500 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300",
                  pathname === item.href
                    ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-100"
                    : "border-slate-700 bg-slate-900 text-slate-300",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <main>{children}</main>
      </div>
    </div>
  );
}
