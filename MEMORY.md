# Memory

## Estado actual
- Se ha iniciado la aplicación Regiduría en un proyecto nuevo con Next.js, TypeScript y Tailwind.
- La base incluye shell principal, panel de control, gestión de proyectos, cues, modo función, incidencias y reportes.
- La persistencia local se ha preparado con Dexie y la estructura se organiza por módulo para facilitar ampliación.

## Decisiones importantes
- Se ha priorizado una base sólida y usable antes de cargar toda la funcionalidad de producción.
- La arquitectura mantiene una separación clara entre tipos, validación, datos, interfaz y persistencia.
- Se ha evitado introducir complejidad de microservicios o backend real en esta fase inicial.

## Errores a evitar
- No sobrecargar el MVP con funciones no priorizadas.
- No mezclar lógica de negocio con componentes visuales.
- No ignorar la distinción entre preparación y ejecución de los cues.
