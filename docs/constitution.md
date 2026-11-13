# Constitución de la Aplicación de Regiduría Escénica

> **Nota de estado: este documento describe el estado objetivo / hoja de ruta, no el estado actual.**
>
> Los 8 puntos siguientes son **objetivos normativos** (hacia dónde va el proyecto), no una descripción de lo ya implementado. A fecha de hoy, la implementación difiere de esa visión al menos en:
>
> - **Persistencia**: hoy es **local**, con Dexie sobre IndexedDB en el navegador. **No** hay Supabase, PostgreSQL, Auth, Storage ni políticas RLS.
> - **PWA / Service Workers**: aún **no implementados**; la aplicación no se instala como PWA ni opera sin conexión mediante Service Worker.
> - **Pruebas automatizadas**: aún **no existen** Vitest, Testing Library ni Playwright. La verificación actual es `npm run lint` y `npm run build`.
> - **shadcn/ui**: aún **no adoptado**; hoy solo hay componentes propios en `src/components/ui/`.
> - **Estado remoto/caché**: hoy no hay TanStack Query; el estado de UI se gestiona con Zustand (`src/store/ui-store.ts`) y los datos viven en Dexie.
>
> Las menciones a Supabase/PostgreSQL, RLS, Service Workers, TanStack Query, shadcn/ui y pruebas automatizadas dentro del texto describen, por tanto, el destino previsto y no el código actual.

1. **Stack tecnológico oficial**: Frontend basado en **React (Next.js App Router) + TypeScript + Tailwind CSS + componentes accesibles (shadcn/ui)**; backend y persistencia remota mediante **Supabase (PostgreSQL, Auth, Storage)**.
2. **Spec y trazabilidad**: El desarrollo se guía por las especificaciones funcionales y técnicas del proyecto. Cualquier cambio crítico en el modelo de datos (tablas como `Cue`, `ScriptVersion`, `Incident` o `Performance`) debe documentarse y actualizarse manteniendo compatibilidad y auditoría de datos.
3. **Arquitectura modular y separación de capas**: La lógica de dominio (cues, cálculos de tiempos, validaciones y permisos) se aísla de la interfaz de usuario. Se separa el estado remoto/caché (TanStack Query) del estado local de UI (Zustand), evitando almacenes globales monolíticos.
4. **Modo Offline-First y PWA**: La aplicación debe poder funcionar e instalarse como PWA. El visor de libretos (PDF.js), la secuencia de cues, checklists e incidencias deben persistir localmente mediante **IndexedDB (Dexie) y Service Workers**, permitiendo la operación fluida sin conectividad a red.
5. **Fiabilidad en Modo Función**: La prioridad absoluta es la seguridad operativa durante el directo. La interfaz de cabina prioriza el tema oscuro de bajo brillo, visibilidad clara de cues y cronómetro, y la sincronización a través de una cola idempotente con resolución explícita de conflictos tras recuperar la red.
6. **Seguridad y permisos granulares**: Control de acceso basado en roles (Regidor/a, Técnico/a por departamento, Consulta) reforzado en servidor mediante políticas de seguridad a nivel de fila (**RLS** en PostgreSQL) y cifrado de datos.
7. **Calidad y pruebas automatizadas**: Cobertura obligatoria mediante pruebas unitarias (Vitest), de componentes (Testing Library) y de flujo completo (Playwright), asegurando el correcto funcionamiento de la navegación de cues, exportación de reportes PDF y comportamiento sin conexión.
8. **Idioma y convenciones**: Textos de interfaz, mensajes de error, reportes y documentación en **español**; código fuente, identificadores, entidades del modelo de datos y comentarios técnicos en **inglés sencillo y consistente**.
