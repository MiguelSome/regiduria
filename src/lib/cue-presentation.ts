import type { CueComponentType, CueType, DepartmentName } from "@/lib/types";

export const cueDepartmentByType: Record<CueType, DepartmentName> = {
  LX: "Iluminación",
  SON: "Sonido",
  MOV: "Maquinaria",
  PREVENIR: "Maquinaria",
  PROY: "Vídeo",
  "ENT/MUT": "Regiduría",
  UT: "Utilería",
  SIM: "Regiduría",
  AVISO: "Reparto",
  VEST: "Vestuario",
};

export const cueTypeOptions: { value: CueType; label: string }[] = [
  { value: "LX", label: "LX · Memoria de luz" },
  { value: "SON", label: "SON · Sonido" },
  { value: "MOV", label: "MOV · Movimiento" },
  { value: "PREVENIR", label: "PREVENIR · Aviso de movimiento" },
  { value: "PROY", label: "PROY · Proyección de vídeo" },
  { value: "ENT/MUT", label: "ENT/MUT · Entradas y mutis" },
  { value: "UT", label: "UT · Utilería" },
  { value: "SIM", label: "SIM · Cambio simultáneo" },
  { value: "AVISO", label: "AVISO · Intérpretes" },
  { value: "VEST", label: "VEST · Vestuario" },
];

export const cueComponentOptions = cueTypeOptions.filter(
  (option): option is { value: CueComponentType; label: string } =>
    option.value !== "SIM" && option.value !== "PREVENIR",
);

const cueColorClasses: Record<CueType, string> = {
  LX: "border-yellow-300 bg-yellow-300 text-slate-950",
  SON: "border-green-400 bg-green-600 text-white",
  MOV: "border-blue-400 bg-blue-600 text-white",
  PREVENIR: "border-orange-400 bg-orange-500 text-slate-950",
  PROY: "border-gray-400 bg-gray-600 text-white",
  "ENT/MUT": "border-gray-300 bg-gray-200 text-slate-900",
  UT: "border-blue-800 bg-blue-950 text-blue-100",
  SIM: "border-green-400 bg-green-600 text-white",
  AVISO: "border-pink-300 bg-pink-500 text-white",
  VEST: "border-slate-400 bg-slate-600 text-white",
};

export function getCueColorClasses(type: CueType): string {
  return cueColorClasses[type];
}

const cueColorValues: Record<CueComponentType, string> = {
  LX: "#fcd34d",
  SON: "#16a34a",
  MOV: "#2563eb",
  PROY: "#4b5563",
  "ENT/MUT": "#e5e7eb",
  UT: "#172554",
  AVISO: "#ec4899",
  VEST: "#475569",
};

export function getCueComponentOrder(
  includedTypes: readonly CueComponentType[] = [],
): CueComponentType[] {
  return cueComponentOptions
    .map((option) => option.value)
    .filter((type) => includedTypes.includes(type));
}

export function getCueMixedColorStyle(
  type: CueType,
  includedTypes?: readonly CueComponentType[],
) {
  if (type !== "SIM") return undefined;

  const orderedTypes = getCueComponentOrder(includedTypes);
  if (orderedTypes.length < 2) return undefined;

  const bandSize = 100 / orderedTypes.length;
  const bands = orderedTypes.map((componentType, index) => {
    const start = index * bandSize;
    const end = (index + 1) * bandSize;
    return `${cueColorValues[componentType]} ${start}% ${end}%`;
  });

  return {
    backgroundImage: `linear-gradient(135deg, ${bands.join(", ")})`,
    textShadow: "0 1px 2px rgba(0, 0, 0, 0.9)",
  };
}

const departmentCueType: Record<DepartmentName, CueType> = {
  Iluminación: "LX",
  Sonido: "SON",
  Maquinaria: "MOV",
  Utilería: "UT",
  Vestuario: "VEST",
  Caracterización: "VEST",
  Vídeo: "PROY",
  Regiduría: "ENT/MUT",
  Reparto: "AVISO",
};

export function getDepartmentCueColorClasses(department: DepartmentName): string {
  return getCueColorClasses(departmentCueType[department]);
}
