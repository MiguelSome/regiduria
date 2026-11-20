import type { CountdownBand, DancePreferences } from "@/lib/types";

const COUNTDOWN_COLORS = ["red", "orange", "green", "blue", "yellow"] as const;
const FONT_SCALES = ["normal", "grande", "muy-grande"] as const;

/**
 * Fixed ISO trace for the immutable default: a module constant cannot receive
 * the injected `now`. Callers that persist preferences must go through
 * `validateDancePreferences(input, now)` to stamp a real instant (plan §4).
 */
const DEFAULT_UPDATED_AT = "1970-01-01T00:00:00.000Z";

export const DEFAULT_DANCE_PREFERENCES: DancePreferences = {
  id: "dance",
  countdownBands: [
    { minSeconds: 4, maxSeconds: 10, color: "red", label: "Rojo" },
    { minSeconds: 2, maxSeconds: 3, color: "orange", label: "Naranja" },
    { minSeconds: 0, maxSeconds: 1, color: "green", label: "Verde" },
  ],
  fontScale: "muy-grande",
  highContrast: false,
  soundFeedback: false,
  defaultAlertBeforeMs: 10_000,
  updatedAt: DEFAULT_UPDATED_AT,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseBand(value: unknown, index: number): CountdownBand {
  if (!isRecord(value)) {
    throw new Error(`La banda ${index + 1} de las preferencias no es válida.`);
  }
  const { minSeconds, maxSeconds, color, label } = value;
  if (!Number.isInteger(minSeconds) || (minSeconds as number) < 0
    || !Number.isInteger(maxSeconds) || (maxSeconds as number) < 0) {
    throw new Error(`La banda ${index + 1} debe tener límites enteros mayores o iguales que 0.`);
  }
  if ((maxSeconds as number) < (minSeconds as number)) {
    throw new Error(`La banda ${index + 1} tiene maxSeconds menor que minSeconds.`);
  }
  if (typeof color !== "string" || !COUNTDOWN_COLORS.includes(color as CountdownBand["color"])) {
    throw new Error(`La banda ${index + 1} usa un color fuera de la paleta permitida (red, orange, green, blue, yellow).`);
  }
  if (typeof label !== "string" || label.trim().length === 0) {
    throw new Error(`La banda ${index + 1} necesita una etiqueta no vacía.`);
  }
  return {
    minSeconds: minSeconds as number,
    maxSeconds: maxSeconds as number,
    color: color as CountdownBand["color"],
    label: label.trim(),
  };
}

/**
 * Validates and normalises dance preferences without writing to Dexie. Bands
 * must be contiguous from 0, use the closed five-colour palette, cover the
 * default alert threshold and carry a label (RF14, CL49, D34).
 */
export function validateDancePreferences(input: unknown, now: number): DancePreferences {
  if (!isRecord(input)) {
    throw new Error("Las preferencias de danza deben ser un objeto.");
  }
  if (input.id !== undefined && input.id !== "dance") {
    throw new Error("El identificador de las preferencias de danza debe ser «dance».");
  }
  if (!Array.isArray(input.countdownBands) || input.countdownBands.length === 0) {
    throw new Error("Las bandas de la cuenta atrás no pueden estar vacías.");
  }

  const bands = input.countdownBands.map(parseBand);
  const ordered = [...bands].sort((first, second) => first.minSeconds - second.minSeconds);
  if (ordered[0].minSeconds !== 0) {
    throw new Error("Las bandas de la cuenta atrás deben ser contiguas desde 0.");
  }
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index].minSeconds !== ordered[index - 1].maxSeconds + 1) {
      throw new Error("Las bandas de la cuenta atrás tienen huecos o solapes.");
    }
  }

  const maxCovered = Math.max(...ordered.map((band) => band.maxSeconds));
  if (maxCovered < 1 || maxCovered > 60) {
    throw new Error("El máximo de la banda superior debe estar entre 1 y 60 segundos.");
  }
  const alert = input.defaultAlertBeforeMs;
  if (!Number.isFinite(alert) || (alert as number) < 1_000
    || (alert as number) > 60_000 || (alert as number) > maxCovered * 1_000) {
    throw new Error("El umbral por defecto debe estar dentro de la cobertura de las bandas (1–60 s).");
  }
  if (typeof input.fontScale !== "string" || !FONT_SCALES.includes(input.fontScale as DancePreferences["fontScale"])) {
    throw new Error("El tamaño de letra debe ser normal, grande o muy-grande.");
  }
  if (typeof input.highContrast !== "boolean" || typeof input.soundFeedback !== "boolean") {
    throw new Error("Alto contraste y sonido deben ser valores booleanos.");
  }
  if (!Number.isFinite(now)) {
    throw new Error("El instante «now» de las preferencias no es válido.");
  }

  return {
    id: "dance",
    countdownBands: bands,
    fontScale: input.fontScale as DancePreferences["fontScale"],
    highContrast: input.highContrast,
    soundFeedback: input.soundFeedback,
    defaultAlertBeforeMs: alert as number,
    updatedAt: new Date(now).toISOString(),
  };
}
