import type { CueType } from "@/lib/types";

export function getCueIdentifierType(type: CueType): CueType {
  return type === "PREVENIR" ? "MOV" : type;
}

export function getCueIdentifierNumber(
  identifier: string,
  type: CueType,
): number | undefined {
  const prefix = `${getCueIdentifierType(type)}-`;
  if (!identifier.toUpperCase().startsWith(prefix)) return undefined;

  const suffix = identifier.slice(prefix.length);
  if (!/^\d+(?:\.\d+)?$/.test(suffix)) return undefined;

  const number = Number(suffix);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

export function getNextCueIdentifier(type: CueType, currentMaximum: number): string {
  const nextNumber = Math.floor(currentMaximum) + 1;
  return `${getCueIdentifierType(type)}-${String(nextNumber).padStart(2, "0")}`;
}

export function getCueIdentifierPattern(type: CueType): string {
  const prefix = getCueIdentifierType(type);
  const caseInsensitivePrefix = [...prefix]
    .map((character) => {
      if (!/[a-z]/i.test(character)) return character;
      return `[${character.toLowerCase()}${character.toUpperCase()}]`;
    })
    .join("");

  return `${caseInsensitivePrefix}-[0-9]+(?:\\.[0-9]+)?`;
}
