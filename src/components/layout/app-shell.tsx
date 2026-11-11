"use client";

import Link from "next/link";
import { Moon, SunMedium, Theater, Wrench } from "lucide-react";
import { useEffect } from "react";

import { navigation } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui-store";

import { Button } from "@/components/ui/button";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isDark, toggleTheme } = useUiStore();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-cyan-500/15 p-2 text-cyan-300">
              <Theater className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Producción</p>
              <h1 className="text-lg font-semibold text-white">Regiduría</h1>
            </div>
          </div>

          <nav className="hidden items-center gap-2 md:flex">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-900 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 sm:flex">
              <Wrench className="h-3.5 w-3.5 text-cyan-300" />
              Sistema local + sincronización segura
            </div>
            <Button
              type="button"
              aria-label="Alternar tema oscuro"
              onClick={toggleTheme}
              className={cn(
                "h-10 w-10 rounded-full border-slate-700 bg-slate-900 p-0 text-slate-200",
                isDark ? "text-amber-300" : "text-slate-200",
              )}
            >
              {isDark ? <SunMedium className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="border-t border-slate-800 md:hidden">
          <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-3 sm:px-6">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <aside className="hidden w-72 shrink-0 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 lg:block">
          <p className="mb-4 text-xs uppercase tracking-[0.2em] text-slate-400">Módulos</p>
          <div className="space-y-2">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex rounded-xl border border-transparent px-3 py-2 text-sm text-slate-300 transition hover:border-slate-700 hover:bg-slate-900 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </aside>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
