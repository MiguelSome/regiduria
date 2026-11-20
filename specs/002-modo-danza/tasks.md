# Tareas 002 — Modo Danza: documento, escaleta y ejecución sincronizada

- **Spec:** `specs/002-modo-danza/spec.md` (v3, aprobada; RF1–RF41, CL1–CL64, guion manual §11 de 26 pasos)
- **Plan:** `specs/002-modo-danza/plan.md`
- **Total:** 10 tareas, en orden de dependencia. Cada tarea deja `npm run lint` y `npm run build` en verde.
- **Verificación común:** al terminar cada tarea, ejecutar `npm run lint` y `npm run build` sin avisos nuevos. Los pasos manuales referenciados son los del guion de la **spec 002 §11**. No se crean tests automatizados (spec §1.4/§9; plan §10.2).
- **Convivencia:** estos T1–T10 no reabren los T8, T9 y T10 pendientes de la spec 001; reutilizan la cola de guardados, los refs y el bloqueo ya presentes sin duplicarlos.

---

- [x] **T1 — Modelo, schemas, Dexie v5 y persistencia sin recortes**
  - **Cubre:** RF3 (persistencia del modo), RF27 (trazabilidad `templateOrigin`), RF35, RF40; CL1, CL42, CL45, CL46, CL62.
  - **Fase:** (a) modelo.
  - **Archivos:** `src/lib/types.ts`, `src/lib/schemas.ts`, `src/lib/data-service.ts`, `src/lib/db.ts`.
  - **Cambios:**
    1. Tipos: `Production.mode?` y `templateOrigin?`; `Cue.timing?`; `PerformanceRunReport.mode?/cueLaunches?/trackRuns?` y las interfaces `DanceTrack`, `CueTiming`, `TemplateOrigin`, `ScheduleTemplate*`, `CueLaunchEvent`, `TrackRun`, `CountdownBand`, `DancePreferences`, `TemplateFile`.
    2. Schemas: declarar `mode`/`templateOrigin` en `productionSchema`, `timing` en `cueSchema` (con `alertBeforeMs` 1000–60000 y `atMs` ≤ 24 h), y crear `performanceSchema` con los tres campos nuevos **opcionales**; `savePerformance` valida con él (RF40, D25/D37).
    3. `saveProduction` y `createProductionWithPdf` persisten el objeto validado completo; **`saveCue` conserva `timing` del cue existente en las dos ramas** (normal y libreto) cuando el entrante no lo trae (CL45). Añadir una ruta de creación sin PDF que conserve `mode`/`templateOrigin` (la usa T4).
    4. Dexie `version(5)` con `danceTracks: "id, productionId, order"`, `scheduleTemplates: "id, name, updatedAt"`, `appSettings: "id"`; sin `upgrade` destructiva. Cascadas: borrar producción elimina sus tracks; `deleteAllProductions` conserva plantillas y preferencias; borrar un track desvincula materializando `atMs` (RF35, CL42). CRUD de las tres tablas nuevas en `data-service.ts`.
  - **Hecho cuando:** un proyecto con `mode: "dance"` y un cue con `timing` sobreviven a guardar+recargar; guardar solo la nota de un cue deja `timing` idéntico; `savePerformance` acepta un registro antiguo sin campos nuevos y otro con `mode`/`cueLaunches`/`trackRuns` sin recortarlos; las tres tablas nuevas existen en IndexedDB y los datos anteriores se abren sin error; `deleteAllProductions` no borra plantillas ni preferencias; `lint` y `build` pasan.
  - **Verificación:** guion §11 pasos 15 y 22; inspección en IndexedDB de `productions`, `cues` y `performances`; `npm run lint` + `npm run build`.
  - **Depende de:** — (ninguna).

- [x] **T2 — Lógica pura de escaleta, orden, tiempos y formatos**
  - **Cubre:** RF4, RF5, RF6, RF7, RF8 (formatos), RF12, RF38 (orden); CL2, CL4, CL5, CL6, CL7, CL8, CL9, CL15, CL44, CL50, CL64.
  - **Fase:** (a) dominio — escaleta.
  - **Archivos:** `src/lib/dance/schedule.ts` (nuevo); tipos de apoyo en `src/lib/types.ts` si hacen falta.
  - **Cambios:** implementar `parseDurationToMs`, `formatClock`, `formatTenths`, `naturalIdentifierCompare`, `buildSchedule`, `resolveCueTiming` y `materializeAtMs` según plan §4/§5.1. Cadena de inicios con `startAtMs` opcional y aviso de solape sin autocorrección; track sin duración no avanza `finConocido`; orden de cues por tiempo absoluto, identificador natural (valor numérico: `LX-2.5` antes que `LX-2.10`) y `id`; "Sin tiempo" al final; total = max(fin de tracks, mayor tiempo de cue). Avisos de duplicados y de "Track no encontrado" sin escribirlos. `formatClock` redondea al segundo y cambia a `h:mm:ss` a partir de una hora; `formatTenths` usa coma decimal. `trackId` sin `trackOffsetMs` se resuelve como sin vínculo (CL64).
  - **Hecho cuando:** con tracks de `2:00`/`3:00` y cue a `1:30`, `buildSchedule` devuelve inicios `00:00`/`02:00`, total `05:00`; un inicio solapado se marca sin corregirse; `LX-2` precede a `LX-10` y `LX-2.5` a `LX-2.10`; un track huérfano o sin offset se resuelve sin romper la escaleta; duraciones `1:75`/`abc` devuelven `null`; ninguna función lee reloj ni escribe en Dexie; `lint` y `build` pasan.
  - **Verificación:** guion §11 pasos 3 y 4 (inicios, total, orden natural, formatos, avisos); revisión de las firmas del plan §4; `npm run lint` + `npm run build`.
  - **Depende de:** T1.

- [x] **T3 — Lógica pura de tiempo activo, secuencia, desviaciones e informe**
  - **Cubre:** RF13 (cálculo), RF14 (cálculo de bandas), RF17 (datos), RF23, RF24, RF25, RF38, RF39 (tiempo activo); CL10, CL11, CL19, CL23, CL24, CL37, CL57.
  - **Fase:** (a) dominio — ejecución e informe.
  - **Archivos:** `src/lib/dance/clock.ts`, `src/lib/dance/sequence.ts`, `src/lib/dance/report.ts`, `src/lib/dance/preferences.ts` (nuevos).
  - **Cambios:** implementar `getActiveElapsedMs`, `getCueTargetMs`, `getCountdownSeconds`, `sliceBands`, `bandForSeconds`, `getLaunchAvailability`, `getNextCandidate`, `propagateManualStop`, `buildDeviationReport`, `buildCueLaunchEvent`, `DEFAULT_DANCE_PREFERENCES` y `validateDancePreferences` (plan §4/§5.2). Tiempo activo = transcurrido menos pausas, para track y reloj por igual (D32). Cuenta atrás: oculta con track Pausado, `0` y nunca negativa al superar el objetivo, `undefined` sin referencia. Bandas contiguas recortadas a `[0, umbral]`, paleta de cinco colores y color neutro fuera de cobertura (D34). Informe desde `cueLaunches` + instantáneas: desviación con signo y una décima, "a tiempo" si `|d| < 0,1 s`, media con signo sin dividir por cero, máxima por valor absoluto, no alcanzados y listas aparte (D22/D35).
  - **Hecho cuando:** una pausa de 20 s no desplaza el objetivo ni genera desviación; un cue `atMs` sin reloj da `undefined` y no inventa desviación; con bandas por defecto el umbral 5 se recorta a rojo `4–5`/naranja `2–3`/verde `0–1` y una configuración con huecos se rechaza; el informe de un registro con `+800/+40/−800 ms` y sin desviaciones produce `+0,8 s`, "a tiempo", `−0,8 s` y media/máxima correctas sin dividir por cero; `lint` y `build` pasan.
  - **Verificación:** guion §11 pasos 8, 10 (formato determinista del informe) y 20; `npm run lint` + `npm run build`.
  - **Depende de:** T2.

- [x] **T4 — Alta de proyecto, ficha, navegación y documento/escaleta con impresión**
  - **Cubre:** RF1, RF2, RF3, RF4, RF6, RF8 (vista), RF11 (ruta de edición), RF41; CL1, CL2, CL7, CL8, CL9, CL46, CL52, CL53, CL63.
  - **Fase:** (b) superficies de proyecto y documento.
  - **Archivos:** `src/components/projects/project-manager.tsx`, `src/components/cues/cue-manager.tsx`, `src/components/pdf/libreto-viewer.tsx`, `src/lib/navigation.ts`, `src/components/layout/app-shell.tsx`, `src/app/documento/page.tsx`, `src/app/documento/imprimir/page.tsx`, `src/components/dance/document-view.tsx` (nuevos).
  - **Cambios:** selector accesible de modo con etiquetas y descripción exactas, preseleccionado estándar; en Danza el PDF es opcional y se ofrece "Empezar de cero" o plantilla inicial (la aplicación de plantillas se cablea en T9); en Estándar se mantiene el mensaje y el botón deshabilitado sin PDF. Ficha con etiqueta de modo y `templateOrigin`. Navegación: `/documento` y `/documento/imprimir` solo en danza, `/plantillas` y `/ajustes` siempre, acceso directo a `/documento` en estándar muestra el mensaje del §1.6 con enlace a `/libretos`. Documento consume `buildSchedule` (T2): Tracks, Cues, Sin tiempo, totales, avisos; sin campo de "texto de escaleta". Sección de tiempo en `/cues` solo en danza; libreto ausente muestra el mensaje de CL52. Vista `/documento/imprimir`: fondo blanco, texto negro, sin controles, cabecera repetida, filas no partidas, tipo en texto, mismos formatos que pantalla (CL47 se afina en T10). `/documento` editable sin ejecución/en Ensayo, solo lectura salvo notas en Función (CL63; el bloqueo se comparte con T7).
  - **Hecho cuando:** se pueden crear proyectos de ambos modos y el de danza funciona sin PDF; tras recargar sigue en Danza; el documento refleja altas/cambios sin "regenerar"; el estándar no muestra nada de danza y el flujo PDF y la 001 siguen igual; la impresión sale en claro sin UI; `lint` y `build` pasan.
  - **Verificación:** guion §11 pasos 2, 3, 4, 15 y 24; `npm run lint` + `npm run build`.
  - **Depende de:** T1, T2.

- [x] **T5 — Tracks, cronómetro de track y reloj de espectáculo**
  - **Cubre:** RF5 (UI tracks), RF9, RF10, RF35 (cascadas de track), RF39; CL3, CL4, CL5, CL6, CL20, CL43, CL44, CL58, CL59, CL60, CL64.
  - **Fase:** (c) tracks y reloj.
  - **Archivos:** `src/components/dance/track-panel.tsx`, `src/components/dance/show-clock.tsx` (nuevos), `src/components/performance/operation-mode.tsx` (cableado), `src/lib/data-service.ts` (cascada de track).
  - **Cambios:** alta/edición/reorden/inicio explícito/notas de tracks con validación `mm:ss`/`h:mm:ss` y rango de `startAtMs` (0–24 h); borrador "Sin duración" no iniciable con motivo accesible. Ciclo Pendiente → En marcha → Pausado → Terminado con `endedBy: "duration" | "manual"`; transcurrido/restante en tiempo activo usando `getActiveElapsedMs`; un solo track en marcha (confirmación al cambiar; en Función solo el primer track Pendiente). Fin natural fija transcurrido = duración y restante `00:00` sin negativo; parada manual cierra `TrackRun` y en Función marca pendientes "no alcanzados" (propagación de T3), en Ensayo no. Reloj de espectáculo: arranca con el primer track o con "Iniciar espectáculo", se pausa con la función/descanso pero no con un track, se detiene al salir/cambiar/finalizar/descartar, etiquetado "Espectáculo". Borrar track pide confirmación con el número de cues y materializa `atMs` (CL43).
  - **Hecho cuando:** el track `2:00` llega a `00:00` Terminado por duration sin negativo; pausar no.recupera el tiempo; iniciar el segundo track con confirmación no reinicia el reloj; pausar solo el track no pausa el espectáculo pero pausar la función sí; detener manualmente con pendientes pide confirmación y solo marca "no alcanzado" en Función; `lint` y `build` pasan.
  - **Verificación:** guion §11 pasos 5, 6, 20, 22, 25 y 26; `npm run lint` + `npm run build`.
  - **Depende de:** T1, T2, T3.

- [x] **T6 — Cuenta atrás, bandas, "¡Lanzar!" y lanzamiento idempotente con desviación**
  - **Cubre:** RF12, RF13, RF14, RF15, RF16, RF18, RF23 (captura), RF31 (captura); CL10, CL11, CL12, CL13, CL14, CL15, CL16, CL18, CL21, CL22, CL23, CL24, CL25, CL26, CL48, CL49, CL59.
  - **Fase:** (d) cuenta atrás y lanzamiento.
  - **Archivos:** `src/components/dance/countdown.tsx` (nuevo), `src/lib/dance/performance.ts` (nuevo), `src/components/performance/operation-mode.tsx`.
  - **Cambios:** pintar cuenta atrás desde `getCueTargetMs`/`getCountdownSeconds` con la banda recortada y su etiqueta textual; `0` muestra cifra **y** "¡Lanzar!" solo para la candidata (T3), sin cifras negativas; oculta con track Pausado, se recalcula al reanudar; track Terminado por duración con objetivo en la duración mantiene `0` + "¡Lanzar!" indefinidos; track Terminado manualmente no muestra aviso (CL12). "¡Lanzar!" es el control de lanzamiento de esa cue, activable con teclado y con parpadeo 400 ms on/off / alternativa estática con `prefers-reduced-motion` (el detalle de accesibilidad se cierra en T10). Confirmación visual y sonora opcional (desactivada por defecto; audio bloqueado no genera error). Idempotencia: ref sincrónica + botón `disabled` durante el guardado + `event.repeat`, compartida por el botón general y el aviso (CL21, CL22). Captura del instante en la activación, antes del guardado; `buildCueLaunchEvent` guarda instantáneas y desviación calculada una vez; reutilizar la cola de la 001 con reversión íntegra del primer lanzamiento (CL25) y reintento con el instante original en fallos posteriores (CL26). En Ensayo no se persiste nada (D7).
  - **Hecho cuando:** a `1:20` aparece `10…0` con siete rojos/dos naranjas/dos verdes y etiquetas; pausar oculta y reanudar recalcula en tiempo activo; al superar el objetivo aparece "¡Lanzar!" sin negativo; doble clic y activación simultánea de ambos controles producen **una** marca; un fallo del primer guardado revierte contador/estado/bloqueo y un fallo posterior conserva el instante; audio bloqueado no rompe la confirmación visual; `lint` y `build` pasan.
  - **Verificación:** guion §11 pasos 7, 8, 9, 18, 19 y 25; `npm run lint` + `npm run build`.
  - **Depende de:** T3, T5.

- [x] **T7 — Badge/cambio de modo, ensayo vs función, escaleta viva y notas**
  - **Cubre:** RF11 (pestaña interna), RF16, RF17, RF19, RF20, RF21, RF22, RF31, RF33 (foco), RF38; CL17, CL18, CL27, CL28, CL29, CL54, CL58, CL60, CL63.
  - **Fase:** (e) ejecución.
  - **Archivos:** `src/components/dance/mode-badge.tsx`, `src/components/dance/live-schedule.tsx`, `src/components/dance/cue-note.tsx` (nuevos), `src/components/performance/operation-mode.tsx`, `src/store/ui-store.ts` (si hace falta estado compartido de preferencias).
  - **Cambios:** badge "ENSAYO"/"FUNCIÓN" en la barra de la vista, visible en todas las pestañas internas; modo por defecto FUNCIÓN (D6), control de cambio con confirmación que reinicia cronómetros, reloj, tracks y contadores, bloqueado solo con registro abierto o track En marcha (CL27) y permitido en Ensayo (CL28). Ensayo: lanzar cualquier cue, retroceder, saltar, reiniciar track y editar escaleta sin registrar ni bloquear producción (D7). Función: secuencia de `getNextCandidate`, solo la candidata lanzable con motivos literales (CL17, CL18), sin retroceso/salto/reinicio (CL29), solo primer track Pendiente (CL58), parada manual con "no alcanzados" (CL60). Pestaña interna "Documento" de consulta que conserva la sesión al cambiar y volver; `/documento` en Función bloquea estructura/tiempos con "En función la escaleta no se edita. Cambia a Ensayo." (CL54, CL63). Escaleta viva combinada con estados y siguiente destacada (RF17). Nota por cue en ejecución reutilizando `observations`/`pie` con guardado confirmado, sin mover secuencia ni cronómetros y sin borrar `timing` (RF31). Foco estable tras lanzar y al guardar nota; motivos en controles deshabilitados.
  - **Hecho cuando:** el badge se lee "FUNCIÓN" al entrar y sigue visible al cambiar de pestaña; el cambio se bloquea con registro abierto y reinicia todo en Ensayo; en Ensayo se lanza fuera de orden sin crear registro ni bloquear; en Función solo la candidata tiene control activo; cambiar a la pestaña "Documento" y volver no desfasa cronómetros; la edición de estructura está bloqueada en Función pero las notas se guardan sin alterar el tiempo; `lint` y `build` pasan.
  - **Verificación:** guion §11 pasos 12, 13, 14, 17, 18, 20 y 26; `npm run lint` + `npm run build`.
  - **Depende de:** T2, T3, T5, T6.

- [x] **T8 — Finalizar, descartar, informe, reportes y métricas separadas**
  - **Cubre:** RF8 (informe impresible), RF24, RF25, RF35 (cierre de `TrackRun`), RF36, RF37; CL12, CL13, CL30, CL31, CL32, CL33, CL34, CL35, CL36, CL37, CL57, CL62.
  - **Fase:** (e) cierre e informes.
  - **Archivos:** `src/app/reportes/page.tsx`, `src/app/reportes/imprimir/page.tsx`, `src/components/dance/deviation-report.tsx`, `src/components/performance/operation-mode.tsx`, `src/lib/data-service.ts` (borrado del registro descartado).
  - **Cambios:** "Finalizar función" habilitado **solo** con registro abierto `sin endedAt` de la sesión actual (D33): motivos "Inicia la función o lanza una cue para poder finalizarla." / "No hay ninguna función en curso."; confirmación con N pendientes; cierra registro, `TrackRun` abiertos, reloj y cronómetro; marca pendientes con objetivo "no alcanzado" y sin objetivo "pendiente no lanzado"; ofrece informe; idempotente y sin segundo registro; vía 1 = última cue (001). "Descartar función" solo sobre el registro abierto de la sesión: confirmación, borrado real, contadores/relojes/tracks a cero, modo sigue en Función, error con reintento si falla (CL35); inexistente en Ensayo y proyectos estándar. Registros abiertos de sesiones anteriores se listan como "registro de una sesión anterior" y no se tocan (CL62). Informe: `buildDeviationReport` (T3) con instantáneas, formato exacto y consulta posterior en `/reportes`; `/reportes/imprimir` con el mismo estilo claro del documento; ensayos no aparecen; recuentos solo de funciones (RF25).
  - **Hecho cuando:** lanzar la última cue finaliza como en la 001; "Finalizar" con 3 pendientes pide confirmación, deja los "no alcanzado", cierra tracks y reloj y libera la producción; con registro abierto sin lanzamientos cierra con informe "sin cues lanzados"; sin registro está deshabilitado con el motivo correcto; descartar borra el registro de la sesión y no aparece tras recargar; un registro de sesión anterior no se finaliza ni se descarta; el informe imprimible sale en claro y no cambia al editar el cue; `lint` y `build` pasan.
  - **Verificación:** guion §11 pasos 10, 11, 12, 23, 25 y 26; `npm run lint` + `npm run build`.
  - **Depende de:** T3, T6, T7.

- [x] **T9 — Plantillas globales, JSON, preferencias y `/ajustes`**
  - **Cubre:** RF26, RF27, RF28, RF29, RF30, RF32, RF34, RF41 (aplicación); CL38, CL39, CL40, CL41, CL50, CL51, CL55, CL56, CL61.
  - **Fase:** (f) plantillas y preferencias.
  - **Archivos:** `src/lib/dance/templates.ts` (nuevo), `src/app/plantillas/page.tsx`, `src/app/ajustes/page.tsx`, `src/components/dance/template-manager.tsx`, `src/components/dance/preferences-panel.tsx` (nuevos), `src/components/projects/project-manager.tsx` (aplicar al crear), `src/store/ui-store.ts`.
  - **Cambios:** guardar plantilla total/parcial (tracks completos con sus cues + cues sueltos; un cue de track sin el track no se puede seleccionar) con nombre obligatorio, descripción opcional, sufijo `" (2)"` ante duplicados y validación de `trackOffsetMs ≤ durationMs`; SIM requiere ≥ 2 `includedTypes` (CL51, CL55, CL61). Editor en `/plantillas` reutilizando la UI de escaleta: editar contenido incrementa versión; renombrar/describir no (CL56); duplicar y eliminar con confirmación; aislamiento total con proyectos (RF29). Contrato JSON con `format`/`formatVersion`/`kind`/`exportedAt`/`template` y validación antes de cualquier escritura; `trackKey` huérfano se repara desvinculando e informando; corrupto/kind inválido se rechaza sin escritura parcial; importar siempre crea plantilla, nunca proyecto. Exportación de escaleta de proyecto con `kind: "schedule"` importable como plantilla. Aplicar solo al crear proyecto: copia independiente con ids nuevos y `templateOrigin` fijo (D10/D36). `/ajustes`: bandas (paleta cerrada, contiguas, etiqueta), tamaño `normal/grande/muy grande`, alto contraste, sonido y umbral por defecto; validados por `validateDancePreferences` y persistidos en `appSettings` con caché en el store; configuración inválida no sustituye a la última válida (CL49). `/plantillas` y `/ajustes` funcionan sin proyecto y no ofrecen aplicar a proyectos existentes (RF41c).
  - **Hecho cuando:** guardar sin nombre o con offset fuera de rango se rechaza sin escribir; duplicar/importar con nombre repetido produce sufijo; editar contenido dos veces da versión `3` y renombrar no la sube; JSON corrupto/kind incorrecto no crea nada y `trackKey` inexistente se repara informando; aplicar al crear deja copias independientes y `templateOrigin` estable; los ajustes persisten tras recargar y una configuración inválida se rechaza; `lint` y `build` pasan.
  - **Verificación:** guion §11 pasos 3, 16 y 21; `npm run lint` + `npm run build`.
  - **Depende de:** T2, T3, T4.

- [x] **T10 — Accesibilidad, superficies finales, documentación y verificación completa**
  - **Cubre:** RF8, RF14, RF32, RF33, RF41, regresiones de §6; CL1, CL24, CL47, CL49; y cierre de cobertura de RF1–RF41 / CL1–CL64.
  - **Fase:** (g) accesibilidad y verificación manual.
  - **Archivos:** `src/components/dance/*` (ajustes de escala/contraste/animación), `src/components/performance/operation-mode.tsx`, `src/components/layout/app-shell.tsx`, `MEMORY.md`, `README.md`.
  - **Cambios:** aplicar `fontScale` (1, 1,25, 1,5) a cronómetros, reloj, cuentas atrás, identificadores, botones, "¡Lanzar!" y escaleta viva sin romper la disposición; alto contraste AA manteniendo las bandas; parpadeo 400 ms on/off con `prefers-reduced-motion` → borde e icono estáticos; región `aria-live="polite"` para hitos y asertiva para "¡Lanzar!"/"no alcanzado"/errores, anunciando solo los segundos del umbral que existan; motivos (`aria-describedby`) en todos los controles deshabilitados; recorrido de teclado (iniciar track → lanzar → cambio de modo → nota) con foco visible y sin robarlo ni saltar scroll; 360 px sin scroll horizontal en operaciones principales y objetivos táctiles de 44×44 px. Confirmar impresión siempre clara con tema oscuro/alto contraste (CL47) y navegación de estándar (CL1, CL24). Actualizar `MEMORY.md` y `README.md` según plan §12.
  - **Hecho cuando:** los cuatro pasos de teclado se completan sin ratón; no se anuncia cada segundo; con `prefers-reduced-motion` no hay parpadeo; tamaño muy grande/alto contraste y 360 px sin scroll horizontal; la impresión del documento y del informe sale en claro; documentación actualizada; `npm run lint` y `npm run build` pasan sin avisos nuevos; **recorrido completo del guion §11 (26 pasos) sin fallos**, incluidos los pasos 1, 2 y 24 de compatibilidad con la 001 y el estándar.
  - **Verificación:** guion §11 pasos 1, 7, 16, 17, 24 y recorrido completo 1–26; `npm run lint` + `npm run build`.
  - **Depende de:** T1–T9.

---

## Orden y dependencias (resumen)

| Tarea | Título | Fase | Depende de | RF/CL (resumen) |
|---|---|---|---|---|
| T1 | Modelo, schemas, Dexie v5 y persistencia | (a) | — | RF3, RF27, RF35, RF40; CL1, CL42, CL45, CL46, CL62 |
| T2 | Escaleta, orden, tiempos y formatos | (a) | T1 | RF4–RF8, RF12, RF38; CL2, CL4–CL9, CL15, CL44, CL50, CL64 |
| T3 | Tiempo activo, secuencia, desviaciones e informe | (a) | T2 | RF13, RF14, RF17, RF23–RF25, RF38, RF39; CL10, CL11, CL19, CL23, CL24, CL37, CL57 |
| T4 | Alta, ficha, navegación y documento con impresión | (b) | T1, T2 | RF1–RF4, RF6, RF8, RF11, RF41; CL1, CL2, CL7–CL9, CL46, CL52, CL53, CL63 |
| T5 | Tracks, cronómetro y reloj de espectáculo | (c) | T1, T2, T3 | RF5, RF9, RF10, RF35, RF39; CL3–CL6, CL20, CL43, CL44, CL58–CL60, CL64 |
| T6 | Cuenta atrás, bandas, "¡Lanzar!" y lanzamiento | (d) | T3, T5 | RF12–RF18, RF23, RF31; CL10–CL16, CL18, CL21–CL26, CL48, CL49, CL59 |
| T7 | Badge/cambio de modo, ensayo/función, notas | (e) | T2, T3, T5, T6 | RF11, RF16, RF17, RF19–RF22, RF31, RF33, RF38; CL17, CL18, CL27–CL29, CL54, CL58, CL60, CL63 |
| T8 | Finalizar, descartar, informe y reportes | (e) | T3, T6, T7 | RF8, RF24, RF25, RF35–RF37; CL12, CL13, CL30–CL37, CL57, CL62 |
| T9 | Plantillas, JSON, preferencias y `/ajustes` | (f) | T2, T3, T4 | RF26–RF30, RF32, RF34, RF41; CL38–CL41, CL50, CL51, CL55, CL56, CL61 |
| T10 | Accesibilidad, documentación y verificación | (g) | T1–T9 | RF8, RF14, RF32, RF33, RF41 + regresiones; CL1, CL24, CL47, CL49 |

## Cobertura completa (comprobación)

- **RF1–RF41:** RF1-T4 · RF2-T4 · RF3-T1/T4 · RF4-T2/T4 · RF5-T2/T5 · RF6-T2/T4 · RF7-T2 · RF8-T4/T8/T10 · RF9-T5 · RF10-T5 · RF11-T4/T7 · RF12-T2/T3/T6 · RF13-T3/T6 · RF14-T3/T6/T9/T10 · RF15-T6 · RF16-T6/T7 · RF17-T3/T7 · RF18-T6 · RF19-T7 · RF20-T7 · RF21-T7 · RF22-T7 · RF23-T3/T6 · RF24-T3/T8 · RF25-T3/T8 · RF26-T9 · RF27-T1/T9 · RF28-T9 · RF29-T9 · RF30-T9 · RF31-T6/T7 · RF32-T9/T10 · RF33-T7/T10 · RF34-T9 · RF35-T1/T5/T8 · RF36-T8 · RF37-T8 · RF38-T2/T3/T7 · RF39-T3/T5 · RF40-T1 · RF41-T4/T9/T10.
- **CL1–CL64:** CL1-T1/T4/T10 · CL2-T2/T4 · CL3-T5 · CL4-T2/T5 · CL5-T2/T5 · CL6-T2/T5 · CL7-T2/T4 · CL8-T2/T4 · CL9-T2/T4 · CL10-T3/T6 · CL11-T3/T6 · CL12-T6/T8 · CL13-T6/T8 · CL14-T6 · CL15-T2/T6 · CL16-T6 · CL17-T7 · CL18-T6/T7 · CL19-T3/T5 · CL20-T5 · CL21-T6 · CL22-T6 · CL23-T3/T6 · CL24-T3/T10 · CL25-T6 · CL26-T6 · CL27-T7 · CL28-T7 · CL29-T7 · CL30-T8 · CL31-T8 · CL32-T8 · CL33-T8 · CL34-T8 · CL35-T8 · CL36-T8 · CL37-T3/T8 · CL38-T9 · CL39-T9 · CL40-T9 · CL41-T9 · CL42-T1/T5 · CL43-T5 · CL44-T2/T5 · CL45-T1/T7 · CL46-T1/T4 · CL47-T10 · CL48-T6 · CL49-T6/T9/T10 · CL50-T2/T9 · CL51-T9 · CL52-T4 · CL53-T4 · CL54-T7 · CL55-T9 · CL56-T9 · CL57-T3/T8 · CL58-T5/T7 · CL59-T5/T6 · CL60-T5/T7/T8 · CL61-T9 · CL62-T1/T8 · CL63-T4/T7 · CL64-T2/T5.
