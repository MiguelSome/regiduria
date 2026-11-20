"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDancePreferences, getProduction, saveDancePreferences } from "@/lib/data-service";
import { DEFAULT_DANCE_PREFERENCES, validateDancePreferences } from "@/lib/dance/preferences";
import type { CountdownBand, DancePreferences } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui-store";

const COLORS: CountdownBand["color"][] = ["red", "orange", "green", "blue", "yellow"];
const COLOR_LABELS: Record<CountdownBand["color"], string> = {
  red: "Rojo",
  orange: "Naranja",
  green: "Verde",
  blue: "Azul",
  yellow: "Amarillo",
};

const FONT_SCALE_OPTIONS: Array<{ value: DancePreferences["fontScale"]; label: string }> = [
  { value: "normal", label: "Normal (100 %)" },
  { value: "grande", label: "Grande (125 %)" },
  { value: "muy-grande", label: "Muy grande (150 %)" },
];

const BAND_RULE_ID = "dance-band-rule";
const NORMALIZE_HINT_ID = "dance-normalize-hint";
const FONT_HINT_ID = "dance-font-hint";
const CONTRAST_HINT_ID = "dance-contrast-hint";
const SOUND_HINT_ID = "dance-sound-hint";
const THRESHOLD_HINT_ID = "dance-threshold-hint";

const inputClass = "min-h-11 w-full min-w-0 rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-2 text-sm text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400";
const checkClass = "mt-0.5 h-4 w-4 shrink-0 accent-cyan-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300";
const actionButtonClass = "min-h-11 min-w-11 rounded-lg border border-slate-600 bg-slate-900/60 px-3 py-2 text-xs font-medium text-slate-200 outline-none hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-50";
const saveButtonClass = "min-h-11 min-w-11 rounded-lg border border-cyan-600 bg-cyan-950/40 px-4 py-2 text-sm font-medium text-cyan-100 outline-none hover:bg-cyan-900/40 focus-visible:ring-2 focus-visible:ring-cyan-400 aria-disabled:opacity-70";

interface BandDraft {
  min: string;
  max: string;
  color: CountdownBand["color"];
  label: string;
}

interface PreferencesForm {
  bands: BandDraft[];
  fontScale: DancePreferences["fontScale"];
  highContrast: boolean;
  soundFeedback: boolean;
  alertMs: string;
}

/** Empty fields stay NaN so validation rejects them instead of reading as zero. */
function parseField(value: string): number {
  const trimmed = value.trim();
  return trimmed === "" ? Number.NaN : Number(trimmed);
}

function toForm(preferences: DancePreferences): PreferencesForm {
  return {
    bands: preferences.countdownBands.map((band) => ({
      min: String(band.minSeconds),
      max: String(band.maxSeconds),
      color: band.color,
      label: band.label,
    })),
    fontScale: preferences.fontScale,
    highContrast: preferences.highContrast,
    soundFeedback: preferences.soundFeedback,
    alertMs: String(preferences.defaultAlertBeforeMs),
  };
}

/** A plain object shaped like the persisted preference; `validate` stamps `now`. */
function toDraft(form: PreferencesForm): DancePreferences {
  return {
    id: "dance",
    countdownBands: form.bands.map((band) => ({
      minSeconds: parseField(band.min),
      maxSeconds: parseField(band.max),
      color: band.color,
      label: band.label,
    })),
    fontScale: form.fontScale,
    highContrast: form.highContrast,
    soundFeedback: form.soundFeedback,
    defaultAlertBeforeMs: parseField(form.alertMs),
    updatedAt: DEFAULT_DANCE_PREFERENCES.updatedAt,
  };
}

/** Sorts by lower bound and replays each width from zero (CL49, D34). */
function normalizeBands(bands: BandDraft[]): BandDraft[] {
  const ordered = [...bands].sort((first, second) => parseField(first.min) - parseField(second.min));
  let nextMin = 0;
  return ordered.map((band) => {
    const min = parseField(band.min);
    const max = parseField(band.max);
    const width = Number.isFinite(min) && Number.isFinite(max) && max >= min
      ? Math.max(1, max - min + 1)
      : 1;
    const normalized = { ...band, min: String(nextMin), max: String(nextMin + width - 1) };
    nextMin += width;
    return normalized;
  });
}

function appendBand(bands: BandDraft[]): BandDraft[] {
  const lastMax = bands.reduce((max, band) => Math.max(max, parseField(band.max)), -1);
  const start = Number.isFinite(lastMax) ? Math.max(0, lastMax + 1) : 0;
  const used = new Set(bands.map((band) => band.color));
  const color = COLORS.find((candidate) => !used.has(candidate)) ?? "blue";
  return [...bands, { min: String(start), max: String(start), color, label: `Banda ${bands.length + 1}` }];
}

export function PreferencesPanel() {
  const selectedProjectId = useUiStore((state) => state.selectedProjectId);
  const setDancePreferences = useUiStore((state) => state.setDancePreferences);
  const [projectAccess, setProjectAccess] = useState<{
    projectId: string;
    status: "dance" | "unavailable" | "error";
  } | null>(null);
  const [form, setForm] = useState<PreferencesForm>(() => toForm(DEFAULT_DANCE_PREFERENCES));
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    let active = true;
    if (!selectedProjectId) return;
    void getProduction(selectedProjectId)
      .then((production) => {
        if (active) {
          setProjectAccess({
            projectId: selectedProjectId,
            status: production?.mode === "dance" ? "dance" : "unavailable",
          });
        }
      })
      .catch((error: unknown) => {
        console.error(error);
        if (active) setProjectAccess({ projectId: selectedProjectId, status: "error" });
      });

    return () => { active = false; };
  }, [selectedProjectId]);
  const settingsAccess = !selectedProjectId
    ? "unavailable"
    : projectAccess?.projectId === selectedProjectId
      ? projectAccess.status
      : "loading";

  useEffect(() => {
    let cancelled = false;
    void getDancePreferences()
      .then((stored) => {
        if (cancelled) return;
        setForm(toForm(stored ?? DEFAULT_DANCE_PREFERENCES));
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError("No se pudieron cargar las preferencias guardadas. Se muestran los valores por defecto.");
        setForm(toForm(DEFAULT_DANCE_PREFERENCES));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  function updateForm(change: (current: PreferencesForm) => PreferencesForm): void {
    setForm(change);
    setErrorMessage(null);
    setStatusMessage(null);
  }

  function changeBand(index: number, patch: Partial<BandDraft>): void {
    updateForm((current) => ({
      ...current,
      bands: current.bands.map((band, bandIndex) => (bandIndex === index ? { ...band, ...patch } : band)),
    }));
  }

  function removeBand(index: number): void {
    updateForm((current) => (current.bands.length <= 1
      ? current
      : { ...current, bands: current.bands.filter((_, bandIndex) => bandIndex !== index) }));
  }

  async function handleSave(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (savingRef.current) return;
    setErrorMessage(null);
    setStatusMessage(null);

    const draft = toDraft(form);
    let preferences: DancePreferences;
    try {
      preferences = validateDancePreferences(draft, Date.now());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Las preferencias de danza no son válidas.");
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    try {
      await saveDancePreferences(preferences);
      setDancePreferences(preferences);
      setStatusMessage("Preferencias guardadas. Se aplican a la ejecución de danza.");
    } catch {
      setErrorMessage("No se pudieron guardar las preferencias. Inténtalo de nuevo.");
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  if (settingsAccess === "loading") {
    return <p role="status" className="text-sm text-slate-400">Comprobando el proyecto seleccionado…</p>;
  }

  if (settingsAccess !== "dance") {
    return (
      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Ajustes disponibles en Danza</h2>
        <p className="text-sm leading-6 text-slate-300">
          La cuenta atrás, los tracks y sus avisos solo se configuran en proyectos de Danza.
          Selecciona uno o crea un proyecto nuevo para acceder a estos ajustes.
        </p>
        {settingsAccess === "error" && (
          <p role="alert" className="text-sm text-amber-300">
            No se pudo comprobar el proyecto seleccionado.
          </p>
        )}
        <Link
          href="/proyectos"
          className="inline-flex min-h-10 items-center rounded-lg border border-cyan-700 px-3 py-2 text-sm text-cyan-200 outline-none hover:bg-cyan-950/40 focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          Ir a proyectos
        </Link>
      </Card>
    );
  }

  return (
    <Card aria-labelledby="dance-preferences-title" className="space-y-6">
      <header className="space-y-1">
        <h2 id="dance-preferences-title" className="text-lg font-semibold text-white">Ejecución de danza</h2>
        <p className="text-sm text-slate-400">
          Preferencias compartidas por los proyectos de Danza de este dispositivo. No afectan a proyectos estándar.
        </p>
      </header>

      {loadError && (
        <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
          {loadError}
        </p>
      )}
      {isLoading && <p role="status" className="text-sm text-slate-400">Cargando preferencias…</p>}

      <form onSubmit={(event) => void handleSave(event)} noValidate className="space-y-6">
        <section aria-labelledby="dance-bands-title" className="space-y-3">
          <div className="space-y-1">
            <h3 id="dance-bands-title" className="text-sm font-semibold text-slate-200">Bandas de la cuenta atrás</h3>
            <p id={BAND_RULE_ID} className="text-xs leading-5 text-slate-400">
              Regla: bandas contiguas desde 0 s, sin huecos ni solapes; el mínimo de cada banda es el máximo anterior + 1,
              con enteros ≥ 0 y el máximo de la banda superior entre 1 y 60 s. La paleta es cerrada: rojo, naranja,
              verde, azul y amarillo; no se admiten colores hexadecimales. Debe quedar al menos una banda.
            </p>
            <p id={NORMALIZE_HINT_ID} className="text-xs leading-5 text-slate-400">
              «Normalizar desde 0» ordena por mínimo y recalcula los extremos desde 0 conservando el ancho de cada banda
              (máximo − mínimo + 1).
            </p>
          </div>

          <ul className="space-y-3">
            {form.bands.map((band, index) => (
              <li key={index} className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                <p className="text-xs font-medium text-slate-400">Banda {index + 1}</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="min-w-0">
                    <label htmlFor={`band-min-${index}`} className="mb-1 block text-xs text-slate-300">Mínimo (s)</label>
                    <input
                      id={`band-min-${index}`}
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={band.min}
                      onChange={(event) => changeBand(index, { min: event.target.value })}
                      aria-describedby={BAND_RULE_ID}
                      className={inputClass}
                    />
                  </div>
                  <div className="min-w-0">
                    <label htmlFor={`band-max-${index}`} className="mb-1 block text-xs text-slate-300">Máximo (s)</label>
                    <input
                      id={`band-max-${index}`}
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={band.max}
                      onChange={(event) => changeBand(index, { max: event.target.value })}
                      aria-describedby={BAND_RULE_ID}
                      className={inputClass}
                    />
                  </div>
                  <div className="min-w-0">
                    <label htmlFor={`band-color-${index}`} className="mb-1 block text-xs text-slate-300">Color</label>
                    <select
                      id={`band-color-${index}`}
                      value={band.color}
                      onChange={(event) => changeBand(index, { color: event.target.value as CountdownBand["color"] })}
                      aria-describedby={BAND_RULE_ID}
                      className={inputClass}
                    >
                      {COLORS.map((color) => (
                        <option key={color} value={color}>{COLOR_LABELS[color]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-0">
                    <label htmlFor={`band-label-${index}`} className="mb-1 block text-xs text-slate-300">Etiqueta</label>
                    <input
                      id={`band-label-${index}`}
                      type="text"
                      value={band.label}
                      onChange={(event) => changeBand(index, { label: event.target.value })}
                      aria-describedby={BAND_RULE_ID}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={() => removeBand(index)}
                    disabled={form.bands.length <= 1}
                    aria-label={`Quitar banda ${index + 1}`}
                    aria-describedby={form.bands.length <= 1 ? BAND_RULE_ID : undefined}
                    className={actionButtonClass}
                  >
                    Quitar
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => updateForm((current) => ({ ...current, bands: appendBand(current.bands) }))} className={actionButtonClass}>
              Añadir banda
            </Button>
            <Button
              type="button"
              onClick={() => updateForm((current) => ({ ...current, bands: normalizeBands(current.bands) }))}
              aria-describedby={NORMALIZE_HINT_ID}
              className={actionButtonClass}
            >
              Normalizar desde 0
            </Button>
          </div>
        </section>

        <fieldset className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <legend className="px-1 text-sm font-semibold text-slate-200">Tamaño de fuente</legend>
          <p id={FONT_HINT_ID} className="text-xs leading-5 text-slate-400">
            Se aplica a relojes, cuentas atrás, identificadores y avisos de la ejecución de danza.
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {FONT_SCALE_OPTIONS.map((option) => (
              <label
                key={option.value}
                htmlFor={`font-scale-${option.value}`}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-2 text-sm text-slate-200 focus-within:border-cyan-400"
              >
                <input
                  id={`font-scale-${option.value}`}
                  type="radio"
                  name="dance-font-scale"
                  value={option.value}
                  checked={form.fontScale === option.value}
                  onChange={() => updateForm((current) => ({ ...current, fontScale: option.value }))}
                  aria-describedby={FONT_HINT_ID}
                  className={checkClass}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <section aria-labelledby="dance-feedback-title" className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <h3 id="dance-feedback-title" className="text-sm font-semibold text-slate-200">Visualización y avisos</h3>
          <div className="flex items-start gap-2">
            <input
              id="dance-high-contrast"
              type="checkbox"
              checked={form.highContrast}
              onChange={(event) => updateForm((current) => ({ ...current, highContrast: event.target.checked }))}
              aria-describedby={CONTRAST_HINT_ID}
              className={checkClass}
            />
            <div className="min-w-0">
              <label htmlFor="dance-high-contrast" className="block text-sm text-slate-200">Alto contraste</label>
              <p id={CONTRAST_HINT_ID} className="text-xs leading-5 text-slate-400">
                Refuerza el contraste de cuentas atrás y avisos sin perder la distinción entre bandas.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <input
              id="dance-sound-feedback"
              type="checkbox"
              checked={form.soundFeedback}
              onChange={(event) => updateForm((current) => ({ ...current, soundFeedback: event.target.checked }))}
              aria-describedby={SOUND_HINT_ID}
              className={checkClass}
            />
            <div className="min-w-0">
              <label htmlFor="dance-sound-feedback" className="block text-sm text-slate-200">Confirmación sonora</label>
              <p id={SOUND_HINT_ID} className="text-xs leading-5 text-slate-400">
                Aviso breve al lanzar una cue. Si el navegador bloquea el audio, la confirmación visual sigue funcionando.
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="dance-threshold-title" className="space-y-2">
          <h3 id="dance-threshold-title" className="text-sm font-semibold text-slate-200">Umbral por defecto (ms)</h3>
          <div className="max-w-xs">
            <label htmlFor="dance-default-alert" className="mb-1 block text-xs text-slate-300">
              Milisegundos antes del objetivo
            </label>
            <input
              id="dance-default-alert"
              type="number"
              min={1000}
              max={60000}
              step={1}
              inputMode="numeric"
              value={form.alertMs}
              onChange={(event) => updateForm((current) => ({ ...current, alertMs: event.target.value }))}
              aria-describedby={THRESHOLD_HINT_ID}
              className={inputClass}
            />
          </div>
          <p id={THRESHOLD_HINT_ID} className="text-xs leading-5 text-slate-400">
            Entre 1000 y 60000 ms, y dentro de la cobertura de las bandas (máximo de la banda superior × 1000).
          </p>
        </section>

        <footer className="space-y-2 border-t border-slate-800 pt-4">
          <div role="alert" className="min-h-5 text-sm text-amber-300">{errorMessage}</div>
          <div role="status" className="min-h-5 text-sm text-emerald-300">{statusMessage}</div>
          <Button type="submit" aria-disabled={isSaving} className={cn(saveButtonClass, isSaving && "opacity-70")}>
            {isSaving ? "Guardando…" : "Guardar preferencias"}
          </Button>
        </footer>
      </form>
    </Card>
  );
}
