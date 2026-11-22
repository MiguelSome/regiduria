# Memory

## Estado actual
- Regiduría trabaja con dos modos de proyecto: **estándar** (PDF obligatorio, libreto, cues y modo función de la spec 001) y **danza** (sin PDF obligatorio, escaleta estructurada como documento principal).
- Modo Danza (spec 002): escaleta derivada de tracks y cues con tiempos, un único cronómetro visible de función que sirve además de referencia temporal, cronómetros de track en tiempo activo, cuentas atrás con bandas, lanzamiento integrado en `/modo-funcion`, ensayo/función, informe de desviaciones, plantillas globales y preferencias accesibles.
- Superficies nuevas: `/documento` y `/documento/imprimir` (documento/escaleta), `/plantillas`, `/ajustes`, `/reportes/imprimir` y pestaña interna "Documento" en `/modo-funcion`.
- Persistencia local con Dexie v5; los datos siguen guardándose en el navegador. Los schemas Zod declaran todos los campos nuevos sin recortarlos.
- Se mantiene la base anterior: shell principal, gestión de proyectos y equipos, cues con identificadores decimales y Pie, libreto PDF con etiquetas, preparación de función con avisos 30/15/5 y checklist, incidencias y reportes.

## Decisiones importantes
- El modo de proyecto se fija al crear y no se puede cambiar después.
- Danza no exige PDF: el documento es la escaleta derivada; si se sube un PDF, sirve como libreto complementario y no sustituye al documento.
- Ensayo: lanzamiento libre, sin registro ni bloqueo de producción; no persiste. Función: secuencia estricta de la siguiente cue, registro con instantáneas y desviaciones, tracks e informe.
- El tiempo de referencia es el **tiempo activo** (sin pausas). La escaleta no se persiste como copia: se deriva de tracks y cues con `now` inyectado.
- Las preferencias son globales y se editan en `/ajustes`: bandas contiguas de paleta cerrada, tamaño de fuente, alto contraste y sonido. Se aplican a la ejecución abierta y persisten; no afectan al flujo estándar ni a las vistas imprimibles.
- Las plantillas son copias independientes: se guardan con `templateOrigin` fijo, sin vínculo vivo, y solo se aplican al crear un proyecto. El JSON usa un sobre versionado; un `trackKey` o `startsTrackKey` huérfano se repara al importar informando de ello.
- Los `TrackRun` se registran al cerrar la función y el cronómetro de función queda congelado en su último valor, igual que su referencia temporal interna. Hay dos vías de cierre: lanzar la última cue o "Finalizar función" (solo con registro abierto de la sesión). "Descartar función" borra el registro y no cuenta en métricas ni informes.
- Por decisión posterior a la spec 002 no hay reloj "Espectáculo" visible: el cronómetro de función es el único reloj de pantalla y arranca/pausa la referencia interna usada por cues con `atMs` y por el informe.
- No hay un botón "¡Lanzar!" separado: lanza el botón Go/TOP/Pincha ya existente, que mantiene siempre su color. La cuenta atrás es solo el número coloreado por banda (rojo/naranja/verde con los defaults) y se sitúa junto a ese botón, sin etiqueta de color visible.
- En `/modo-funcion` el panel "Cierre de función" está a la derecha, debajo de "Preparación a función"; los registros de sesiones anteriores quedan ocultos tras el botón "Registro de funciones". Los tracks se muestran **debajo** de las cues: la vista prioriza cues y cronómetro.
- Las cues se pueden reordenar desde `/cues` con botones **Subir**/**Bajar** (campo `Cue.order`). El intercambio respeta el filtro visible y renumbera toda la producción. El orden manual manda en cues sin tiempo y en empates de tiempo; las cues con tiempos distintos siguen ordenadas por tiempo. Se conserva en plantillas como `order`.
- La opción del editor de cues se llama **"Vincular a track"** (campo `CueTiming.startsTrackId`). Al elegir un track existente y pinchar el cue —«Pincha» en sonido—, ese track comienza desde cero sin buscarlo en la lista; la tarjeta del siguiente cue muestra el aviso «Al pinchar este cue se inicia el track…». Se valida que el track exista y tenga duración, y que el cue no tenga además un objetivo dentro de ese mismo track. Si otro track está en marcha o pausado se aplica la regla de parada manual (confirmación, `TrackRun` y pendientes "no alcanzados" en Función). El enlace se conserva en plantillas como `startsTrackKey`.
- La ejecución de danza vive en `/modo-funcion` (no existe `/modo-danza`). La capa `src/lib/dance/*` es pura: sin `Date.now()`, Dexie ni React; el instante siempre se inyecta.
- Limitación heredada de la 001: los registros abiertos de sesiones anteriores se listan como "registro de una sesión anterior" (ocultos tras "Registro de funciones") y no se pueden recuperar ni cerrar desde la sesión actual.

## Errores a evitar
- No perder `mode`, `timing` ni campos del informe al validar con Zod: los schemas declaran todos los campos sin recortarlos.
- No reconstruir el informe leyendo el cue actual: usar las instantáneas guardadas en cada lanzamiento.
- No persistir la escaleta ni copias derivadas: se calcula bajo demanda.
- No reabrir las tareas pendientes de la spec 001 (T8/T9/T10).
- No usar `Date.now()` dentro de `src/lib/dance/*`: el instante se inyecta desde la UI.
- No mezclar plantillas con proyectos en vivo: importar JSON crea siempre una plantilla, nunca un proyecto.
