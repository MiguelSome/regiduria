export type NavigationItem = {
  label: string;
  href: string;
  /** Only offered when the selected production is a dance project. */
  danceOnly?: boolean;
};

export interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

export const navigationGroups: NavigationGroup[] = [
  {
    label: "General",
    items: [
      { label: "Panel", href: "/" },
      { label: "Proyectos", href: "/proyectos" },
      { label: "Cues", href: "/cues" },
      { label: "Libreto", href: "/libretos" },
      { label: "Modo función", href: "/modo-funcion" },
      { label: "Incidencias", href: "/incidencias" },
      { label: "Reportes", href: "/reportes" },
    ],
  },
  {
    label: "Danza",
    items: [
      { label: "Documento", href: "/documento", danceOnly: true },
      { label: "Imprimir documento", href: "/documento/imprimir", danceOnly: true },
      { label: "Plantillas", href: "/plantillas" },
      { label: "Ajustes", href: "/ajustes", danceOnly: true },
    ],
  },
];
