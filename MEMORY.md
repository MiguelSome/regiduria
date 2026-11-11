# Memory

## Estado actual
- Se ha iniciado la aplicación Regiduría en un proyecto nuevo con Next.js, TypeScript y Tailwind.
- La base incluye shell principal, panel de control, gestión de proyectos, cues, modo función, incidencias y reportes.
- La persistencia local se ha preparado con Dexie y la estructura se organiza por módulo para facilitar ampliación.
- El libreto guarda su PDF, nombre visible editable y etiquetas de acto, escena y cue en IndexedDB; las etiquetas cue se sincronizan con el listado de cues.

## Decisiones importantes
- Se ha priorizado una base sólida y usable antes de cargar toda la funcionalidad de producción.
- La arquitectura mantiene una separación clara entre tipos, validación, datos, interfaz y persistencia.
- Se ha evitado introducir complejidad de microservicios o backend real en esta fase inicial.
- Los cues creados desde el PDF reciben un identificador automático según su tipo y posición. El identificador admite decimales y se puede editar; la sugerencia automática continúa con el siguiente entero libre.
- PREVENIR es un aviso naranja asociado a Maquinaria: usa el identificador MOV relacionado sin incrementar la numeración de movimientos.
- Cada cue puede guardar un Pie textual; se conserva al editar cues vinculados al PDF y se muestra en el modo función.
- La preparación de función combina el aviso temporizado 30/15/5 con seis checks de sonido y departamentos; el progreso llega al 100 % cuando se completan los nueve pasos.
- Los tipos de cue comparten colores entre el visor del libreto y las listas. Los cues SIM requieren dos o más componentes y los AVISO se asignan a Reparto.

## Errores a evitar
- No sobrecargar el MVP con funciones no priorizadas.
- No mezclar lógica de negocio con componentes visuales.
- No ignorar la distinción entre preparación y ejecución de los cues.
