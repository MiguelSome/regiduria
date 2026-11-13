# Tareas 001 — Lanzar cues sin haber iniciado el cronómetro

- **Spec:** `specs/001-lanzar-cues-sin-cronometro/spec.md` (aprobada)
- **Plan:** `specs/001-lanzar-cues-sin-cronometro/plan.md`
- **Total:** 10 tareas, en orden de dependencia. Cada tarea deja `npm run lint` y `npm run build` en verde.
- **Verificación común:** al terminar cada tarea, ejecutar `npm run lint` y `npm run build` sin avisos nuevos. Los pasos manuales referenciados son los del guion de `plan.md` §10.3.

---

- [x] **T1 — Modelo y lógica pura del registro de función**
  - **Cubre:** RF17, RF9, RF11 (parte de cálculo) y soporte de RF5, RF6, RF12, RF13, RF14; §4.2 (D8).
  - **Archivos:** `src/lib/types.ts` (añadir `timerStartedAt?: string;` a `PerformanceRunReport`), `src/lib/performance-run.ts` (nuevo).
  - **Cambios:** declarar el campo opcional en el tipo y crear las funciones puras `buildPerformanceRecord`, `applyCueLaunch`, `startTimerInReport`, `closeOpenRecord`, `isOpenRecord` y `canLaunchNextCue`, todas con el instante como parámetro `now` y sin leer el reloj ni tocar Dexie (plan.md §4).
  - **Hecho cuando:** `timerStartedAt` es opcional en `PerformanceRunReport`; las seis funciones existen con las firmas del plan; ningún registro existente requiere migración ni se añade índice en `db.ts`; `lint` y `build` pasan.
  - **Verificación:** `npm run lint` + `npm run build`; revisión de tipos en el editor (los literales `runReport` actuales de `operation-mode.tsx:435-441` siguen compilando sin `timerStartedAt`).
  - **Depende de:** — (ninguna).

- [x] **T2 — Lanzar cues con el cronómetro en espera y en pausa (con creación del registro)**
  - **Cubre:** RF1, RF2, RF4, RF5, RF10, RF14, RF17, RF18; CL1, CL2, CL3, CL4, CL9.
  - **Archivos:** `src/components/performance/operation-mode.tsx` (y uso de `performance-run.ts`).
  - **Cambios:**
    1. `handleLaunchCue`: guard basado en `canLaunchNextCue` (no en `timerState === "running"`); si no hay registro, construirlo con `buildPerformanceRecord` y persistirlo con la cola existente; actualizar el informe con `applyCueLaunch`; activar el bloqueo de la selección solo tras guardado correcto; añadir `isLaunchingRef` sincrónica + estado `isLaunchingCue` para que el `await` no permita solapes (base de T5).
    2. Botón de lanzamiento: `disabled={isLaunchingCue || timerState === "finished" || !nextCue}` (ya no depende de `running`).
    3. Render: unificar la rama de la secuencia para que se muestre también en `idle` (`isSequenceAvailable`), eliminando el texto "Al iniciar el cronómetro aparecerá aquí la primera cue de la función." y conservando los mensajes de estados no operativos (sin producción, error de carga, cargando, sin cues).
  - **Hecho cuando:** con el cronómetro en `00:00:00` se ve la cue prevenida con el botón habilitado; un lanzamiento incrementa el contador, mueve la cue a lanzadas y no arranca el cronómetro; el primer lanzamiento crea y guarda un registro con `startedAt`, `durationMs: 0`, `launchedCueCount: 1`, sin `timerStartedAt`, y bloquea el selector de producción; en pausa se comporta igual; `lint` y `build` pasan.
  - **Verificación:** guion manual pasos 1, 2, 3, 6, 13; inspección en IndexedDB de `performances`.
  - **Depende de:** T1.

- [x] **T3 — Reversión íntegra del primer lanzamiento si el registro no puede crearse**
  - **Cubre:** RF12; CL5, CL16.
  - **Archivos:** `src/components/performance/operation-mode.tsx`.
  - **Cambios:** capturar una instantánea del registro previo (normalmente `null`) antes de persistir el primer lanzamiento y restaurarla si `saved === false`: no incrementar el contador, no mover la cue prevenida, no bloquear el selector, dejar el cronómetro igual y mostrar el error legible (reutilizando `runSaveError` con mensaje en español), permitiendo reintentar.
  - **Hecho cuando:** forzando el fallo de guardado (o revisando el flujo), el contador vuelve a `0`, la cue 1 sigue prevenida, el selector no queda bloqueado, no queda registro ni a medias, aparece el aviso y un nuevo intento puede lanzar; `lint` y `build` pasan.
  - **Verificación:** guion manual paso 3 tras provocar el fallo; revisión del flujo de reversión (plan.md §5.1); `npm run lint` + `npm run build`.
  - **Depende de:** T2.

- [x] **T4 — Fallo de guardado en lanzamientos no primeros**
  - **Cubre:** RF13; CL21.
  - **Archivos:** `src/components/performance/operation-mode.tsx`.
  - **Cambios:** aplicar la misma instantánea/reversión cuando ya existe registro: si el guardado falla, el contador no se incrementa, la cue afectada sigue prevenida, el registro en memoria vuelve a su último estado guardado consistente y el botón queda disponible para reintentar sin recargar.
  - **Hecho cuando:** con un registro ya creado, un fallo de guardado deja `launchedCueCount` en el valor anterior, muestra el aviso y permite completar el lanzamiento al reintentar; `lint` y `build` pasan.
  - **Verificación:** revisión del flujo de reversión (plan.md §5.1) y comprobación de que el estado en pantalla y el ref quedan alineados; `npm run lint` + `npm run build`.
  - **Depende de:** T2, T3.

- [x] **T5 — Idempotencia y antirrebote del lanzamiento**
  - **Cubre:** RF7; CL6.
  - **Archivos:** `src/components/performance/operation-mode.tsx`.
  - **Cambios:** completar las tres capas del plan.md §5.5: ref sincrónica comprobada en la primera línea de `handleLaunchCue`, botón `disabled` mientras `isLaunchingCue`, y conservación del filtro `event.repeat` y del foco en campos editables del efecto de teclado. Garantizar que una activación durante el guardado no se encola (no se llama a la persistencia).
  - **Hecho cuando:** un doble clic, un doble toque, una tecla mantenida y una activación simultánea Enter+Espacio producen **un solo** incremento; con un guardado pendiente, activar de nuevo no incrementa ni encola; terminado el guardado, la siguiente activación sí lanza la cue siguiente; `lint` y `build` pasan.
  - **Verificación:** guion manual paso 4; revisión de código de la guarda sincrónica (el caso "guardado en curso" se valida por inspección, por la latencia de IndexedDB).
  - **Depende de:** T2.

- [x] **T6 — Finalización sin cronómetro y estado "Finalizada"**
  - **Cubre:** RF6, RF8; CL8, CL14, CL17, CL20.
  - **Archivos:** `src/components/performance/operation-mode.tsx`.
  - **Cambios:** cerrar el flujo de finalización del lanzamiento: al lanzar la última cue, fijar `endedAt`, dejar `durationMs` a `0` si el cronómetro nunca arrancó (o al tiempo acumulado si arrancó), pasar `timerState` a `finished`, liberar el bloqueo de la selección y retirar el control de lanzamiento. Confirmar que el indicador muestra "Finalizada" (prevaleciendo sobre "En espera") y que el bloque "Todas las cues de esta función se han lanzado." aparece. Verificar el caso de producción con una sola cue.
  - **Hecho cuando:** lanzar la última cue sin cronómetro muestra "Todas las cues…", el indicador "Finalizada", sin control de lanzamiento y con el selector habilitado, y el registro queda con `endedAt`, `durationMs: 0` y sin `timerStartedAt`; con una producción de una cue, el primer lanzamiento deja `1 / 1` y finalizada; con cues lanzadas y pendientes el indicador sigue siendo "En espera"; `lint` y `build` pasan.
  - **Verificación:** guion manual pasos 8 y 3; inspección en IndexedDB.
  - **Depende de:** T2.

- [x] **T7 — Arrancar el cronómetro de forma independiente (campo `timerStartedAt`)**
  - **Cubre:** RF3, RF9; CL15, CL18.
  - **Archivos:** `src/components/performance/operation-mode.tsx`.
  - **Cambios:** reescribir la rama `idle` de `toggleTimer` según plan.md §5.2: si ya existe registro por un lanzamiento previo, no crear otro y solo fijar `timerStartedAt` con `startTimerInReport` antes de arrancar; si no existe, mantener el comportamiento actual (crear, bloquear el selector y arrancar desde cero) añadiendo `timerStartedAt` en el mismo instante. Mantener el bloqueo por descanso activo en la rama `paused`.
  - **Hecho cuando:** pulsar "Iniciar" tras lanzar cues arranca el cronómetro en `00:00:00`, conserva el contador, no crea un segundo registro y guarda `timerStartedAt`; pausar y reanudar no reescribe `timerStartedAt`; el descanso sigue sin poder abrirse en espera; `lint` y `build` pasan.
  - **Verificación:** guion manual pasos 5, 7 y 16; inspección en IndexedDB (un solo registro).
  - **Verificación realizada:** al iniciar tras lanzar una cue, el contador y el registro se conservaron; `timerStartedAt` se guardó una sola vez y permaneció intacto tras pausar y reanudar.
  - **Depende de:** T1, T2.

- [ ] **T8 — Cerrar el registro abierto al cambiar de producción o salir del modo**
  - **Cubre:** RF11; CL7, CL13.
  - **Archivos:** `src/components/performance/operation-mode.tsx`; opcionalmente el texto del `title` del selector en `src/components/layout/app-shell.tsx` (solo copy).
  - **Cambios:** partir `persistPerformance` en `enqueueSave` (solo cola) y `persistPerformance` (cola + actualización del ref); añadir `closeOpenRecordIfAny` (plan.md §5.4) y llamarla al inicio de `handleProductionChange` y en la limpieza del efecto de desmontaje, antes de reiniciar el contexto y de anular el ref. Mantener la liberación del bloqueo de selección.
  - **Hecho cuando:** salir del modo función con un registro abierto lo deja con `endedAt` y la duración acumulada, reinicia el cronómetro a `00:00:00`, el contador a `0 / N` y libera el selector; el cierre no repuebla `performanceRecordRef` ni bloquea la navegación; `closeOpenRecord` no reescribe un registro ya cerrado; `lint` y `build` pasan.
  - **Verificación:** guion manual pasos 11 y 12; inspección en IndexedDB del registro cerrado.
  - **Depende de:** T2, T7.

- [ ] **T9 — Controles deshabilitados con motivo, conmutador tec en espera y flechas**
  - **Cubre:** RF16, RF19, RF15; CL10, CL11, CL12, CL19.
  - **Archivos:** `src/components/performance/operation-mode.tsx`.
  - **Cambios:**
    1. Mostrar siempre el control de descanso y el de incidencia rápida; en `idle` deshabilitarlos y asociarles con `aria-describedby` un párrafo con el texto fijo "Disponible al iniciar el cronómetro." (habilitados en `running` y `paused`).
    2. Efecto de teclado del modo tec: guarda `if (!tecMode || timerState === "finished") return;` y `←` con suelo en `0`, sin persistir, no disponible tras finalizar.
    3. Anunciar el lanzamiento sin cronómetro en una región `role="status"`.
  - **Hecho cuando:** en espera ambos controles se ven atenuados, `disabled` y con el motivo asociado, y pulsarlos no hace nada; tras "Iniciar" se habilitan; el conmutador `tec` es visible y operable en espera y `→`/`←` funcionan sin foco en campos de texto; `←` no baja de `0` y no altera el registro guardado; `lint` y `build` pasan.
  - **Verificación:** guion manual pasos 9, 10 y 14; `npm run lint` + `npm run build`.
  - **Depende de:** T2.

- [ ] **T10 — Documentación y verificación final**
  - **Cubre:** regresiones de §6 y estrategia de verificación de §10; RF15.
  - **Archivos:** `MEMORY.md`, `README.md`.
  - **Cambios:** añadir a `MEMORY.md` el nuevo estado del modo función y las decisiones (semántica de `startedAt` y `timerStartedAt`, registro desde el primer lanzamiento, cierre del registro abierto y limitación conocida de la recarga, controles deshabilitados con motivo) y las líneas de "Errores a evitar"; actualizar el bullet del modo función en `README.md` y dejar la verificación como `npm run lint` + `npm run build` más el guion manual (plan.md §12).
  - **Hecho cuando:** `MEMORY.md` y `README.md` reflejan el comportamiento implementado; `npm run lint` y `npm run build` pasan sin avisos nuevos; se ha recorrido el guion manual completo de `plan.md` §10.3 (16 pasos) sin fallos.
  - **Verificación:** `npm run lint` + `npm run build` + recorrido del guion manual de principio a fin.
  - **Depende de:** T1–T9.

---

## Orden y dependencias (resumen)

| Tarea | Título | Depende de | RF/CL |
|---|---|---|---|
| T1 | Modelo y lógica pura del registro de función | — | RF17, RF9, RF11 (cálculo) |
| T2 | Lanzar cues en espera y en pausa + creación del registro | T1 | RF1, RF2, RF4, RF5, RF10, RF14, RF17, RF18; CL1–CL4, CL9 |
| T3 | Reversión del primer lanzamiento | T2 | RF12; CL5, CL16 |
| T4 | Fallo de guardado en lanzamientos no primeros | T2, T3 | RF13; CL21 |
| T5 | Idempotencia y antirrebote | T2 | RF7; CL6 |
| T6 | Finalización sin cronómetro y "Finalizada" | T2 | RF6, RF8; CL8, CL14, CL17, CL20 |
| T7 | Arranque independiente del cronómetro (`timerStartedAt`) | T1, T2 | RF3, RF9; CL15, CL18 |
| T8 | Cierre del registro abierto | T2, T7 | RF11; CL7, CL13 |
| T9 | Controles deshabilitados con motivo, tec y flechas | T2 | RF15, RF16, RF19; CL10–CL12, CL19 |
| T10 | Documentación y verificación final | T1–T9 | §6, §10 |
