import type { Cue, Incident, Performance, Production } from "@/lib/types";

export const productions: Production[] = [
  {
    id: "p-1",
    title: "La casa de Bernarda Alba",
    subtitle: "Temporada 2026",
    venue: "Teatro Principal",
    status: "Activa",
    syncStatus: "Sincronizado",
    lastUpdated: "2026-11-09T18:00:00.000Z",
    summary:
      "Producción centrada en el trabajo de la cuadrilla escénica y la coordinación de cues entre iluminación y maquinaria.",
    departments: [
      { id: "d-1", name: "Iluminación", responsable: "Lucía Ortega", notes: ["Cues de entrada para la escena final."] },
      { id: "d-2", name: "Sonido", responsable: "Marcos Alarcón", notes: ["Pista de fondo y transiciones. "] },
      { id: "d-3", name: "Maquinaria", responsable: "Elena Ruiz", notes: ["Escenario móvil con 3 cambios. "] },
      { id: "d-4", name: "Utilería", responsable: "Ana Cañete", notes: ["Revisión del mueble principal. "] },
      { id: "d-5", name: "Vestuario", responsable: "Sofía Vega", notes: ["Ajuste final de la última escena. "] },
    ],
    scenes: [
      { id: "s-1", act: "Acto I", number: "1", title: "La casa cerrada", summary: "Apertura y primera entrada." },
      { id: "s-2", act: "Acto I", number: "2", title: "La sentencia", summary: "Cambio de intensidad con gran silencio." },
      { id: "s-3", act: "Acto II", number: "3", title: "La noche de la boda", summary: "Punta de tensión en la cena." },
      { id: "s-4", act: "Acto II", number: "4", title: "La última escena", summary: "Desenlace y cierre emocional." },
    ],
  },
  {
    id: "p-2",
    title: "Los siete magníficos",
    subtitle: "Gira nacional",
    venue: "Sala Naranja",
    status: "Activa",
    syncStatus: "Pendiente",
    lastUpdated: "2026-11-07T12:15:00.000Z",
    summary:
      "Versión compacta para sala modular con sincronización local de notas y documentación de funciones.",
    departments: [
      { id: "d-6", name: "Iluminación", responsable: "Pablo Nieto", notes: ["Ajustar fondo en la última secuencia."] },
      { id: "d-7", name: "Caracterización", responsable: "Rita López", notes: ["Asignación de pelucas para escena 8."] },
      { id: "d-8", name: "Sonido", responsable: "Irene Sanz", notes: ["Revisar el cuelgue de la música final."] },
    ],
    scenes: [
      { id: "s-5", act: "Prólogo", number: "0", title: "Toma del escenario", summary: "Presentación del conjunto." },
      { id: "s-6", act: "Acto I", number: "1", title: "La primera salida", summary: "Tiempo de reacción del público." },
      { id: "s-7", act: "Acto I", number: "2", title: "El giro", summary: "Cambio en la dinámica del reparto." },
    ],
  },
];

export const cues: Cue[] = [
  {
    id: "c-1",
    productionId: "p-1",
    identifier: "LX-01",
    type: "LX",
    description: "Apertura general del escenario con caída de luz de fondo.",
    act: "Acto I",
    scene: "1",
    department: "Iluminación",
    observations: "Revisar la intensidad antes del primer parlamento.",
    status: "Preparado",
    executionState: "Preparación",
  },
  {
    id: "c-2",
    productionId: "p-1",
    identifier: "SON-04",
    type: "SON",
    description: "Tramo de ruido de viento y silencio durante la entrada.",
    act: "Acto I",
    scene: "2",
    department: "Sonido",
    observations: "Comprobar salida en dos canales.",
    status: "Pendiente",
    executionState: "Función",
  },
  {
    id: "c-3",
    productionId: "p-1",
    identifier: "MOV-12",
    type: "MOV",
    description: "Desplazamiento de la escenografía central y giro de la plataforma.",
    act: "Acto II",
    scene: "3",
    department: "Maquinaria",
    observations: "Confirmar la sincronía con la pista musical.",
    status: "Borrador",
    executionState: "Preparación",
  },
  {
    id: "c-4",
    productionId: "p-2",
    identifier: "UT-08",
    type: "UT",
    description: "Apertura del tronco con el objeto central de la secuencia.",
    act: "Acto I",
    scene: "1",
    department: "Utilería",
    observations: "Necesita un ensayo de maniobra antes del estreno.",
    status: "Ejecutado",
    executionState: "Función",
  },
];

export const incidents: Incident[] = [
  {
    id: "i-1",
    productionId: "p-1",
    title: "Falla en la señal de la lámpara de cocina",
    description: "Se detectó un tramo de iluminación con brillo irregular durante el último ensayo.",
    date: "2026-11-07",
    status: "Seguimiento",
  },
  {
    id: "i-2",
    productionId: "p-2",
    title: "Ajuste del escenario móvil",
    description: "Se ha pedido revisar el recorrido de la plataforma del primer acto antes del próximo ensayo.",
    date: "2026-11-08",
    status: "Abierta",
  },
];

export const performances: Performance[] = [
  {
    id: "f-1",
    productionId: "p-1",
    title: "Función 3",
    date: "2026-11-14",
    time: "20:30",
    prepared: 18,
    total: 24,
    notes: ["30 minutos antes", "Comprobado audio", "Punto de bloqueo 3"],
  },
  {
    id: "f-2",
    productionId: "p-2",
    title: "Función de prueba",
    date: "2026-11-12",
    time: "19:00",
    prepared: 12,
    total: 18,
    notes: ["Revisión de utilería", "Cues del acto I"] ,
  },
];

export const navigation = [
  { label: "Panel", href: "/" },
  { label: "Proyectos", href: "/proyectos" },
  { label: "Libreto", href: "/libretos" },
  { label: "Cues", href: "/cues" },
  { label: "Modo función", href: "/modo-funcion" },
  { label: "Incidencias", href: "/incidencias" },
  { label: "Reportes", href: "/reportes" },
];
