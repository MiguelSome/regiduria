export type NavigationItem = {
  label: string;
  href: string;
};

export const navigation: NavigationItem[] = [
  { label: "Panel", href: "/" },
  { label: "Proyectos", href: "/proyectos" },
  { label: "Libreto", href: "/libretos" },
  { label: "Cues", href: "/cues" },
  { label: "Modo función", href: "/modo-funcion" },
  { label: "Incidencias", href: "/incidencias" },
  { label: "Reportes", href: "/reportes" },
];
