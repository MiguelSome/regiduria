# Plan 001 — Lanzar cues sin haber iniciado el cronómetro

- **Estado:** borrador
- **Fecha:** 2026-11-13
- **Spec:** `specs/001-lanzar-cues-sin-cronometro/spec.md` (aprobada)
- **Cobertura:** RF1–RF19 y CL1–CL21
- **Restricción de partida:** la verificación del proyecto es `npm run lint` + `npm run build` (no hay suite de tests; ver §10).

---

## 1. Resumen del enfoque

Hoy el modo función tiene un único interruptor de "función arrancada": el cronómetro. El lanzamiento de cues, la creación del registro, el bloqueo de la selección de producción y el render de la secuencia dependen todos de que el cronómetro esté en marcha.

El plan separa ese interruptor en dos estados independientes:

1. **Registro de la función abierto** (`performanceRecordRef.current` con `runReport`): se abre en el **primer lanzamiento de cue**, no al pulsar "Iniciar" (D2). Gobierna el bloqueo de la selección de producción y la persistencia.
2. **Cronómetro arrancado** (`timerState` y `runReport.timerStartedAt`): se arranca de forma independiente, antes o después de lanzar (D1/D8).

Con eso:

- La secuencia y el control de lanzamiento se muestran con el cronómetro en `idle`/`paused` (RF1, RF4, RF10).
- El registro se crea y guarda en el primer lanzamiento, por la vía existente (`performanceSaveQueue` → `savePerformance`) (RF5, RF17).
- El bloqueo de producción pasa a activarse al crear el registro (RF18).
- La finalización se dispara con la última cue, arrancado o no el cronómetro (RF6).
- Se añade un cierre del registro abierto al cambiar de producción o salir del modo (RF11).

Todo el cambio vive en `operation-mode.tsx` más un módulo nuevo de lógica pura (`src/lib/performance-run.ts`) y un campo opcional en `types.ts`. No se toca la capa de datos, ni Dexie, ni el store de UI.

---

## 2. Punto de partida: dónde están hoy las restricciones

| # | Restricción actual | Ubicación | Cómo cambia |
|---|---|---|---|
| R1 | `handleLaunchCue` exige `timerState === "running"` y aborta si no hay registro activo | `operation-mode.tsx:552-561` | Pasa a exigir "hay cue pendiente, cues cargados y función no finalizada"; si no hay registro, lo crea (§5.1) |
| R2 | El botón de lanzamiento está `disabled={timerState !== "running"}` | `operation-mode.tsx:1146` | `disabled` pasa a depender de: lanzamiento en curso, función finalizada o ausencia de cue pendiente |
| R3 | El único camino que crea el registro, bloquea la selección y arranca el cronómetro es `toggleTimer` | `operation-mode.tsx:408-462` | La creación del registro se extrae a un constructor puro reutilizado por lanzamiento e "Iniciar"; `toggleTimer` solo arranca el cronómetro |
| R4 | El bloqueo de selección se activa en `toggleTimer` y se libera al finalizar / cambiar de producción / desmontar | `operation-mode.tsx:419`, `583`, `591`, `643` | Se activa al crear el registro (primer lanzamiento); se libera en los mismos tres puntos |
| R5 | En `idle` se pinta un placeholder de espera en lugar de la secuencia | `operation-mode.tsx:1027-1038` | La sección de secuencia se renderiza también en `idle`; el placeholder queda solo para los estados no operativos (RF14) |
| R6 | El efecto de teclado del modo tec solo se registra con `timerState === "running"` | `operation-mode.tsx:325-353` | Se registra salvo en `finished`; el guard del lanzamiento evita efectos colaterales |
| R7 | El bloque del conmutador tec vive dentro de la rama no-`idle` | `operation-mode.tsx:1039-1083` | Al renderizar la secuencia en `idle`, el conmutador pasa a estar visible en espera |
| R8 | La incidencia rápida solo se pinta en `running`; el descanso se deshabilita sin motivo visible | `operation-mode.tsx:917-935`, `869-880` | Ambos se muestran siempre; en `idle` quedan `disabled` con motivo asociado (RF19) |
| R9 | `handleProductionChange` descarta el registro en memoria sin fijar `endedAt`; el desmontaje solo desbloquea | `operation-mode.tsx:628`, `643` | Ambos cierran antes el registro abierto (RF11, D10) |
| R10 | `savePerformance` no valida ni aplica schema; `runReport` no se consume fuera del componente | `data-service.ts:461-463`, `types.ts:171-178` | Sin cambios: basta con añadir un campo opcional al tipo |

---

## 3. Archivos que se crean o modifican

### 3.1 Se crea

- **`src/lib/performance-run.ts`** (nuevo) — lógica de dominio pura del registro de función: construcción del registro, actualización por lanzamiento, arranque del cronómetro en el informe, cierre del registro abierto y consulta de "registro abierto". Sin React, sin Dexie, sin `Date.now()` interno (el instante entra como parámetro). Cubre RF5, RF6, RF9, RF11, RF17, RF18 (la parte de cálculo) y da soporte a RF12/RF13.

### 3.2 Se modifican

- **`src/lib/types.ts`** — añadir `timerStartedAt?: string;` a `PerformanceRunReport` (`types.ts:171-178`). Campo opcional ⇒ los registros existentes siguen siendo válidos sin migración (D8, §4.2). No hay schema Zod de `Performance`, así que no hay nada más que ajustar; si en el futuro se añade, deberá declararse opcional.
- **`src/components/performance/operation-mode.tsx`** — único componente con cambios:
  - `handleLaunchCue`: desacoplado del cronómetro, con creación de registro, idempotencia y reversión (RF1, RF2, RF4, RF5, RF7, RF10, RF12, RF13, RF17, RF18).
  - `toggleTimer`: rama `idle` reescrita para arrancar sin recrear registro (RF3, RF9).
  - `persistPerformance`: se parte en `enqueueSave` (solo cola) + `persistPerformance` (cola + actualización del ref), para poder cerrar un registro sin repoblarlo (RF11).
  - `closeOpenRecordIfAny`: nueva función usada por `handleProductionChange` y por el desmontaje (RF11, D10).
  - Render: unificación de la sección de secuencia y estados no operativos (RF1, RF2, RF6, RF8, RF14, RF15, RF16), botón de lanzamiento con motivo (RF14), controles deshabilitados con motivo (RF19), conmutador tec en espera (RF16), anuncio de lanzamiento sin cronómetro (RF12, §5).
- **`src/components/layout/app-shell.tsx`** *(opcional, solo texto)* — el `title` del selector indica "durante una función en curso o en pausa" (`app-shell.tsx:89-93`); con el nuevo criterio el bloqueo también aplica en espera con registro abierto. Se propone ajustar la cadena para no describir mal el estado. No cambia la lógica del bloqueo (RF18, §4.4).
- **`MEMORY.md`** y **`README.md`** — documentación (§11).

### 3.3 No se tocan

`src/lib/data-service.ts` (persiste el objeto tal cual), `src/lib/db.ts` (no hay índices nuevos que declarar), `src/store/ui-store.ts` (la bandera `isProductionSelectionLocked` ya existe y se reutiliza), `src/components/pdf/script-page-preview.tsx` (solo se le sigue pasando la cue activa; el cambio de qué cue es "activa" en espera ya funciona porque `activeScriptCue = nextCue ?? cues[launchedCount - 1]`, `operation-mode.tsx:683`).

---

## 4. Funciones puras (con "hoy" como parámetro)

Todas en `src/lib/performance-run.ts`. El instante entra siempre como `now: number` (milisegundos), que es el equivalente inyectado de "hoy": ninguna de ellas lee el reloj, de modo que son deterministas y verificables sin montar el componente. Los textos/formatos de fecha se construyen con `new Date(now).toISOString()` dentro de la función, por lo que el resultado depende solo de las entradas.

```ts
// src/lib/performance-run.ts
import type { Performance, Production } from "@/lib/types";

/** Apertura del registro de la función (RF17). No fija `timerStartedAt`. */
export function buildPerformanceRecord(params: {
  production: Production;
  totalCues: number;
  now: number;
}): Performance;

/** Marca un lanzamiento y, si procede, finaliza la función (RF4, RF5, RF6). */
export function applyCueLaunch(params: {
  performance: Performance;
  launchedCueCount: number; // ya calculado por quien llama
  elapsedMs: number;
  isFinished: boolean;
  now: number;
}): Performance;

/** Registra el primer arranque del cronómetro; no pisa `startedAt` (RF9, D8). */
export function startTimerInReport(params: {
  performance: Performance;
  now: number;
}): Performance;

/** Fija `endedAt` y la duración acumulada de un registro abierto (RF11, D10). */
export function closeOpenRecord(params: {
  performance: Performance;
  elapsedMs: number;
  now: number;
}): Performance;

/** ¿Hay registro abierto (con informe y sin `endedAt`)? (RF11). */
export function isOpenRecord(performance: Performance | null | undefined): boolean;

/** ¿Puede lanzarse la siguiente cue? Cues cargados, no vacíos, no finalizada. (RF1, RF4, RF14) */
export function canLaunchNextCue(params: {
  cueCount: number | null;
  launchedCueCount: number;
  isTimerFinished: boolean;
  isLaunching: boolean;
}): boolean;
```

Detalles de comportamiento:

- `buildPerformanceRecord` reproduce exactamente el registro actual (`operation-mode.tsx:422-442`): `startedAt`, `date`, `time`, `prepared: 0`, `total: cues.length`, `notes: []`, `runReport` con `durationMs: 0`, `launchedCueCount: 0`, `breaks: []`, `quickIncidents: []`, **sin** `timerStartedAt`.
- `applyCueLaunch` fija `durationMs: elapsedMs`, `launchedCueCount` y añade `endedAt: new Date(now).toISOString()` solo si `isFinished`. Con el cronómetro nunca arrancado, `elapsedMs` es `0`, de modo que una función finalizada sin cronómetro queda con `durationMs: 0` (D6/CL17).
- `startTimerInReport` solo escribe `timerStartedAt` si aún es `undefined`; así, pausar/reanudar o abrir un descanso no lo reescriben.
- `closeOpenRecord` es idempotente: si ya hay `endedAt`, devuelve el mismo objeto sin cambios (protege frente a StrictMode y frente a dobles cierres).
- `canLaunchNextCue` centraliza la condición para que botón, teclado y guard usen el mismo criterio.

---

## 5. Algoritmo (pseudocódigo)

### 5.1 Lanzamiento de cue — RF1, RF2, RF4, RF5, RF7, RF10, RF12, RF13, RF17, RF18

```
handleLaunchCue():
  si isLaunchingRef.current            -> return          // RF7(b) antirrebote
  si no canLaunchNextCue(...)          -> return          // RF14, RF6
  nextCount = min(launchedCountRef.current + 1, cues.length)
  si nextCount == launchedCountRef.current -> return       // ya no hay pendientes

  isLaunchingRef.current = true; setIsLaunchingCue(true)
  previousRecord = performanceRecordRef.current
  now     = Date.now()
  elapsed = getElapsedAt(runStartedAt, elapsedBeforeRun, now)   // 0 si nunca arrancó (D1)
  isFinished  = nextCount == cues.length                        // RF6
  isFirstLaunch = previousRecord?.runReport == null

  base = isFirstLaunch
       ? buildPerformanceRecord({ production: selectedProduction, totalCues: cues.length, now })
       : previousRecord

  candidate = applyCueLaunch({ performance: base, launchedCueCount: nextCount,
                               elapsedMs: elapsed, isFinished, now })

  saved = await persistPerformance(candidate)   // cola secuencial existente + ref optimista

  si no saved:                                   // RF12 (primero) / RF13 (resto)
     performanceRecordRef.current = previousRecord   // reversión íntegra
     si isFirstLaunch: setProductionSelectionLocked(false)
     // el contador y la cue prevenida NO se tocan: siguen como antes
     isLaunchingRef.current = false; setIsLaunchingCue(false)
     return

  si isFirstLaunch: setProductionSelectionLocked(true)   // RF18
  launchedCountRef.current = nextCount; setLaunchedCount(nextCount)

  si isFinished:                                        // RF6
     runStartedAt = null; elapsedBeforeRun = elapsed
     setElapsedMs(elapsed)                              // 0 si nunca arrancó
     setTimerState("finished")
     setProductionSelectionLocked(false)                // RF6

  anunciar lanzamiento (región role="status"): cue lanzada y si el cronómetro está parado
  isLaunchingRef.current = false; setIsLaunchingCue(false)
```

Notas:

- **Nunca se arranca ni se reanuda el cronómetro al lanzar** (D1/RF4/RF10): no se toca `runStartedAt` ni `timerState` salvo la transición a `finished`.
- **Retroceso tec (←)** no pasa por aquí: sigue siendo `setLaunchedCount` en pantalla y no persiste (RF5/RF16, `operation-mode.tsx:343-348`), limitado a `launchedCount > 0` y deshabilitado en `finished` (CL12).
- **Cierre por cambio de producción en curso (CL7):** antes de crear o actualizar, si `selectedProduction.id !== candidate.productionId`, se aborta el lanzamiento (el registro saliente ya se habrá cerrado por §5.4).

### 5.2 Arranque independiente del cronómetro — RF3, RF9, CL15, CL18

```
toggleTimer(), rama idle:
  si isStartingFunctionRef.current -> return
  si no selectedProduction o cues vacíos -> return

  now = Date.now()
  existing = performanceRecordRef.current

  si existing?.runReport:                        // ya hay registro por un lanzamiento previo (CL18)
     isStartingFunctionRef.current = true; setIsStartingFunction(true)
     saved = await persistPerformance(startTimerInReport({ performance: existing, now }))
     isStartingFunctionRef.current = false; setIsStartingFunction(false)
     si no saved -> return                       // se queda en espera; el error lo muestra la cola
     runStartedAt = now; setTimerState("running"); setActiveTab("operation")
     return

  // sin registro: comportamiento actual + timerStartedAt (RF17/§6.1)
  isStartingFunctionRef.current = true; setIsStartingFunction(true)
  setProductionSelectionLocked(true)             // se mantiene el bloqueo inmediato (regresión 1)
  record = buildPerformanceRecord({ production, totalCues: cues.length, now })
  saved = await persistPerformance(startTimerInReport({ performance: record, now }))
  isStartingFunctionRef.current = false; setIsStartingFunction(false)
  si no saved:
     si performanceRecordRef.current?.id == record.id: performanceRecordRef.current = null
     setProductionSelectionLocked(false); return
  runStartedAt = now; elapsedBeforeRun = 0; launchedCountRef = 0
  setElapsedMs(0); setLaunchedCount(0); setTimerState("running"); setActiveTab("operation")
```

En la rama `paused` no se toca el informe (el `timerStartedAt` ya quedó fijado en el primer arranque) y se mantiene el bloqueo por descanso activo (`operation-mode.tsx:401`).

### 5.3 Finalización y estado "Finalizada" — RF6, RF8, D7

- La finalización ocurre dentro de `handleLaunchCue` (§5.1). `setTimerState("finished")` hace que:
  - el indicador pase a **"Finalizada"** (rama ya existente, `operation-mode.tsx:779-781`), prevaleciendo sobre "En espera" (D7);
  - el control de lanzamiento desaparezca: `nextCue` es `undefined` y se pinta el bloque "Todas las cues de esta función se han lanzado." (`operation-mode.tsx:1156-1160`);
  - el botón del cronómetro quede "Finalizada" deshabilitado (`operation-mode.tsx:831-867`, sin cambios);
  - se libere el bloqueo de selección.
- Con cues lanzadas y cronómetro en espera **y quedando cues pendientes**, el indicador sigue siendo "En espera" (RF8). No hace falta estado nuevo: `timerState` no cambia al lanzar.
- Producción de una sola cue: `nextCount === cues.length === 1` en el primer lanzamiento ⇒ finaliza (CL20).

### 5.4 Cierre del registro abierto — RF11, D10

```
closeOpenRecordIfAny():
  current = performanceRecordRef.current
  si no isOpenRecord(current) -> return
  now     = Date.now()
  elapsed = getElapsedAt(runStartedAt.current, elapsedBeforeRun.current, now)
  performanceRecordRef.current = null
  void enqueueSave(closeOpenRecord({ performance: current, elapsedMs: elapsed, now }))
```

- Se invoca **al inicio** de `handleProductionChange` (antes de reiniciar el contexto, `operation-mode.tsx:588-630`) y en la limpieza del efecto de desmontaje (`operation-mode.tsx:643`).
- Se usa `enqueueSave` (solo cola) y no `persistPerformance`, para que la cola no repoble `performanceRecordRef.current` con el registro ya cerrado. La cola es secuencial, de modo que el cierre se escribe después de cualquier guardado pendiente y en orden.
- Fire-and-forget (`void`) y no bloqueante: la navegación en cabina no puede esperar a IndexedDB; el cierre entra en la misma cola que el resto de guardados y no altera la UI. Si falla, se muestra el aviso ya existente (`runSaveError`).
- La recarga no se cubre: el estado del modo vive en memoria (limitación conocida, §9 de la spec).

### 5.5 Idempotencia y antirrebote — RF7, CL6

Tres capas superpuestas:

1. `isLaunchingRef.current` (ref, sincrónico) comprobado en la primera línea de `handleLaunchCue`: descarta cualquier activación mientras un lanzamiento está en curso, sin encolarla (RF7b).
2. Estado `isLaunchingCue` que pone el botón en `disabled` durante el guardado: cubre ratón, toque, Enter y Espacio (el `click()` del modo tec sobre un botón deshabilitado no dispara `onClick`).
3. El efecto de teclado ya ignora `event.repeat` y el foco en campos editables (`operation-mode.tsx:330-338`); se conserva.

---

## 6. Modelo de datos: `timerStartedAt` y semántica de `startedAt`

- `PerformanceRunReport.timerStartedAt?: string` (ISO 8601) = instante del **primer arranque del cronómetro**. Ausente ⇒ el cronómetro nunca arrancó (D8).
- `PerformanceRunReport.startedAt` (existente) pasa a significar **apertura del registro de la función**: se fija en el primer lanzamiento o, si se pulsa "Iniciar" sin lanzamientos previos, en ese instante (en cuyo caso ambos campos coinciden).
- `durationMs` deja de ser estrictamente "tiempo cronometrado": puede ser `0` con cues lanzadas y `0` en una función finalizada sin cronómetro (D6). El panel de control solo cuenta registros (`page.tsx:77-82`), así que no se ve afectado.
- **Sin migración:** al ser opcional, los registros existentes son válidos; los que no lo tengan se interpretan como "arranque de cronómetro no registrado". No se añaden índices en Dexie (`db.ts:22-55`), por lo que no hay cambio de versión de base de datos.
- `runReport` no se consume fuera de `operation-mode.tsx`, de modo que el cambio de semántica no rompe ninguna otra vista (verificado por búsqueda).

---

## 7. Cómo se pinta en la interfaz

### 7.1 Unificación del render de la columna de operación

Se sustituye la cascada actual:

```
paused && announcements ? tabpanel
  : idle ? placeholder de espera
  : secuencia
```

por:

```
paused && announcements ? tabpanel                     (sin cambios, fuera de alcance)
  : isSequenceAvailable ? secuencia                    (ahora también en idle)
  : estados no operativos
```

con

```
isSequenceAvailable = Boolean(selectedProductionId) && !cueLoadError && cues !== null && cues.length > 0
```

y el bloque de estados no operativos conservando los mensajes actuales: sin producción ("Crea o selecciona una producción para preparar la función."), error de carga (`role="alert"`), carga ("Cargando cues…") y producción vacía ("Esta producción no tiene cues para lanzar.") (RF14, CL1–CL4). El texto de espera "Al iniciar el cronómetro aparecerá aquí la primera cue de la función." se elimina (RF1).

Al ser la secuencia la misma rama que hoy, se conserva sin cambios el contador `X / N · %`, la barra `role="progressbar"` con `aria-valuetext`, las dos últimas lanzadas y las tres siguientes en cola (RF2, §6.8).

### 7.2 Control de lanzamiento

- `disabled = isLaunchingCue || timerState === "finished" || !nextCue`.
- Ya no se atenúa en `idle` ni en `paused` (RF1, RF4, RF10).
- Se conserva la etiqueta por tipo (Go/TOP/Cambio/Pincha/Lanzar) en texto y `aria-label` con el identificador (RF1, §5).
- Cuando no está disponible, se asocia un motivo con `aria-describedby` a un párrafo de motivo, para que no quede un botón pulsable sin efecto (RF14, §5).
- El foco se mantiene: el `launchButtonRef` sigue siendo el punto de foco tras lanzar, de modo que se puede encadenar con teclado (§5).

### 7.3 Estado del cronómetro

- Se conserva el badge textual "En espera / En curso / En pausa / Finalizada" (`operation-mode.tsx:766-782`) y el tiempo en `00:00:00` mientras no arranque (RF8).
- Se añade una región `role="status"` para anunciar el lanzamiento sin cronómetro ("Cue {identificador} lanzada. El cronómetro no está en marcha."), sin desplazar la vista (§5, sin sorpresas de scroll).

### 7.4 Conmutador tec y teclado

- El bloque del conmutador (botón `tec` + pista "tec activo: ← retrocede · → lanza") queda dentro de la sección de secuencia, por lo que pasa a ser visible y operable en espera (RF16, asumido).
- El efecto de teclado cambia su guarda a `if (!tecMode || timerState === "finished") return;` (R6). `→` sigue llamando a `launchButtonRef.current?.click()`, ahora operativo en espera/pausa/descanso (RF16, D4, D9). `←` sigue siendo no persistido, con suelo en 0 (CL12).
- Se mantiene la exclusión cuando el foco está en `input`/`textarea`/`select`/`contentEditable`, para no robar el foco a la preparación (RF15, §6.9).

### 7.5 Incidencias rápidas y descansos (RF19, D5, CL10, CL11)

- **Descanso:** se conserva la condición actual de habilitación (`running`/`paused` o descanso activo) y se añade, cuando `timerState === "idle"`, `aria-describedby` apuntando a un párrafo con el texto fijo **"Disponible al iniciar el cronómetro."**.
- **Incidencia rápida:** deja de estar oculta en `idle`/`paused`. Se pinta siempre (salvo con el formulario abierto) y se deshabilita en `idle` con el mismo motivo asociado; se habilita en `running` y `paused` (RF19, CL15).
- Ambos quedan **visibles y atenuados**, nunca ocultos.

### 7.6 Preparación a función y libreto

Sin cambios de estructura: la tarjeta de preparación (`operation-mode.tsx:1199-1297`) y el libreto (`ScriptPagePreview`) siguen igual; solo se benefician de que en espera ya hay una cue activa (`activeScriptCue = nextCue ?? cues[launchedCount - 1]`, `operation-mode.tsx:683`), por lo que el libreto abre en la página de la cue prevenida (RF15, §6.10).

---

## 8. Decisiones técnicas (con alternativa descartada)

| # | Decisión | Alternativa descartada | Motivo |
|---|---|---|---|
| DT1 | Crear el registro en el **primer lanzamiento** | Mantener la creación en "Iniciar" y retener los lanzamientos en memoria hasta arrancar | Los lanzamientos se perderían si el cronómetro nunca arranca y habría que persistirlos por otra vía (incumple RF5 y D2) |
| DT2 | Añadir **`timerStartedAt` opcional** y re-semantizar `startedAt` | (a) Reusar `startedAt` como arranque y añadir `recordOpenedAt`; (b) deducir el arranque de `durationMs`/`breaks` | (a) invalida la semántica de todos los registros existentes y exigiría migración (constitución, punto 2); (b) no puede representar "nunca arrancó" de forma fiable |
| DT3 | Extraer la lógica a **`src/lib/performance-run.ts`** (funciones puras con el instante inyectado) | Implementarlo todo dentro del componente | La constitución exige separar dominio de interfaz (punto 3) y hoy `operation-mode.tsx` ya tiene 1300 líneas; funciones puras permiten razonar y verificar el cálculo sin montar React |
| DT4 | Antirrebote con **ref sincrónica + estado `disabled`** | Confiar solo en `disabled` del botón | Las actualizaciones de estado son asíncronas: dos activaciones en el mismo tick (Enter+Espacio) pasarían antes de re-renderizar (RF7b) |
| DT5 | Cerrar el registro con **`enqueueSave` fire-and-forget** | `await` del cierre antes de cambiar de contexto | Bloquearía la navegación en cabina; la cola secuencial ya garantiza orden y el fallo se comunica por `runSaveError` |
| DT6 | **Unificar** la rama de render de la secuencia (se muestra también en `idle`) | Añadir un segundo bloque "en espera" con la misma secuencia | Duplicar la secuencia hace divergir RF1/RF6 y duplica el mantenimiento del contador y la cola de cues |
| DT7 | Reutilizar la bandera `isProductionSelectionLocked` de Zustand, cambiando **cuándo** se activa | Introducir un estado nuevo de "función abierta" en el store | La bandera ya existe y su efecto (deshabilitar el selector de la cabecera) es el que pide RF18; añadir estado global sería cambio fuera de alcance (§1.4) |
| DT8 | `handleProductionChange` cierra **antes** de reiniciar el contexto | Un efecto que observe el cambio de producción y cierre después | El reinicio ya limpia refs; cerrar después dejaría el registro sin `endedAt` (D10) |
| DT9 | **Sin infraestructura de tests nueva**; verificación por `lint` + `build` + guion manual | Añadir Vitest / `node --test` con un runner de TypeScript | Fuera del alcance de la spec y del stack actual (`package.json` no tiene script `test` ni runner de TS); sería una spec aparte (constitución, punto 7, es hoja de ruta). El código se deja preparado para testear (DT3) |

---

## 9. Riesgos técnicos y mitigación

| # | Riesgo | Mitigación |
|---|---|---|
| RG1 | **Doble lanzamiento** por doble clic, doble toque, tecla mantenida o Enter+Espacio | `isLaunchingRef` comprobada en la primera línea + botón `disabled` durante el guardado + filtro `event.repeat` existente (§5.5). Caso CL6 |
| RG2 | **Reversión incompleta del primer lanzamiento** (RF12/CL5): `persistPerformance` actualiza `performanceRecordRef` de forma optimista antes de que la cola guarde (`operation-mode.tsx:366`) | Se toma una instantánea `previousRecord` antes de persistir y se restaura si `saved === false`; el bloqueo de selección solo se activa **después** de un guardado correcto; el contador nunca se incrementa antes de confirmar |
| RG3 | **Desincronización entre `launchedCount` (estado) y `launchedCountRef` (ref)** | Ambos se actualizan en el mismo punto del flujo y solo tras el guardado correcto; el retroceso tec actualiza ambos (`operation-mode.tsx:345-347`) |
| RG4 | **Fallo de guardado en lanzamientos no primeros** (RF13/CL21): el registro en memoria quedaría con un contador mayor que el guardado | Igual que RG2: la instantánea previa se restaura y el contador no sube; el mensaje de error ya lo emite la cola y el botón vuelve a estar disponible para reintentar |
| RG5 | **StrictMode / doble desmontaje** en desarrollo podría cerrar un registro antes de tiempo o persistirlo dos veces | `closeOpenRecord` es idempotente (no reescribe si ya hay `endedAt`) y el ref se anula antes de encolar; en el doble montaje inicial no hay registro, porque este solo nace de una acción del usuario |
| RG6 | **Carrera con el cambio de producción** (CL7): un guardado en vuelo del registro saliente | La cola es secuencial y el contexto nuevo tiene estado propio (contador y cues reiniciados); `handleLaunchCue` aborta si la producción seleccionada no coincide con la del registro candidato |
| RG7 | **Cierre del registro que no llega a guardarse** al salir del modo | Fire-and-forget sobre la cola existente; si falla, se registra el error (`runSaveError`) y la cola sigue operativa. La recarga queda documentada como limitación conocida (CL13/§9) |
| RG8 | **Ambigüedad del indicador** ("En espera" con cues lanzadas vs. "Finalizada") | La precedencia se resuelve por `timerState`: `finished` ⇒ "Finalizada" (D7); `idle` con cues lanzadas y pendientes ⇒ "En espera" (RF8). No hay estado adicional |
| RG9 | **Habilitar la incidencia rápida en pausa** cambia el comportamiento actual (regresión §6.5) | El manejador ya calcula el tiempo transcurrido con `getElapsedAt` y exige informe; en pausa el informe existe y `elapsedBeforeRun` está fijado, así que el tiempo registrado es correcto. Se verifica en el guion manual (paso 10) |
| RG10 | **Botones deshabilitados sin motivo legible** (RF19) | `aria-describedby` a un párrafo con el texto fijo "Disponible al iniciar el cronómetro.", visible además de asociado; se comprueba con el guion manual |
| RG11 | **Foco robado a la preparación** al activar el modo tec | Se conserva la exclusión de `input`/`textarea`/`select`/`contentEditable` en el efecto de teclado (RF15) |
| RG12 | **Registros antiguos** con `startedAt` interpretado antes como "inicio del cronómetro" | El campo nuevo es opcional y no se migra nada; el único consumo de `runReport` está en este componente, que no lee `timerStartedAt` para calcular tiempos (§6) |

---

## 10. Estrategia de verificación

### 10.1 Automática (la disponible en el proyecto)

```bash
npm run lint
npm run build
```

Se ejecutan al cierre de cada tarea (tasks.md) y de nuevo al final. No deben aparecer avisos nuevos (regresión §6.15).

### 10.2 Tests automatizados: fuera de alcance (justificación)

- `package.json` solo tiene `dev`, `build`, `start` y `lint`; **no existe** script `test` ni runner de TypeScript (`tsx`/`ts-node`) en dependencias, por lo que el `node --test` de la plantilla de plan no es aplicable sin añadir infraestructura.
- La constitución (`docs/constitution.md:9`) declara que Vitest/Testing Library/Playwright **no existen todavía** y forman parte del estado objetivo, no del actual.
- Añadir esa infraestructura es un cambio de alcance mayor que esta spec no pide (§1.4). No se considera imprescindible algo mínimo porque la única lógica no trivial se ha aislado en funciones puras (DT3) que quedarán listas para un futuro spec de pruebas.
- Compensación: **guion manual guiado** (§10.3) y revisión del código de la idempotencia (RF7b), cuyo caso "guardado en curso" es difícil de reproducir a mano por la latencia de IndexedDB.

### 10.3 Guion manual guiado (pasos concretos)

Preparación: una producción con al menos 3 cues y libreto cargado; otra producción con 1 sola cue; otra sin cues.

1. **Secuencia en espera (RF1, RF14):** abrir `/modo-funcion` con la producción de 3 cues. Se ve `00:00:00`, indicador **"En espera"**, la cue 1 como "¡PREVENIDO!" y el botón de lanzamiento **habilitado**. Ya no aparece "Al iniciar el cronómetro aparecerá aquí la primera cue de la función." El conmutador `tec` es visible.
2. **Lanzar sin cronómetro (RF2, RF4, RF5, RF17):** pulsar el botón. El contador pasa a `1 / 3 · 33 %`, la cue 1 se mueve a lanzadas y la cue 2 queda prevenida. El cronómetro sigue en `00:00:00` y "En espera". Sin mensajes de error.
3. **Registro creado (RF17):** en DevTools → Application → IndexedDB → `regiduria-db` → `performances`, comprobar que hay **un** registro nuevo con `runReport.startedAt`, `durationMs: 0`, `launchedCueCount: 1` y **sin** `timerStartedAt`. El selector de producción de la cabecera está deshabilitado (RF18).
4. **Antirrebote (RF7a, CL6):** doble clic muy rápido sobre el botón y, por separado, pulsar Enter y Espacio casi a la vez. En cada prueba el contador sube **1**, nunca 2.
5. **Iniciar después de lanzar (RF3, RF9, CL18):** pulsar "Iniciar". El indicador pasa a "En curso", el tiempo arranca en `00:00:00`, el contador no se reinicia y en IndexedDB **sigue habiendo un solo registro**, ahora con `timerStartedAt` informado.
6. **Pausa (RF10, CL9):** pausar y lanzar otra cue. El contador sube, el indicador sigue "En pausa" y el cronómetro no se reanuda.
7. **Descanso activo (RF10, CL19):** con el cronómetro en marcha, abrir "Descanso", lanzar una cue durante el descanso y pulsar "Retomamos". El contador se conserva y el tiempo acumulado no se corrompe.
8. **Finalizar sin cronómetro (RF6, CL17, CL20):** cambiar de producción y repetir el flujo lanzando todas las cues **sin** arrancar el cronómetro. Al último lanzamiento: "Todas las cues de esta función se han lanzado.", indicador **"Finalizada"**, sin botón de lanzamiento, selector de producción habilitado, y el registro con `endedAt`, `durationMs: 0` y sin `timerStartedAt`. Repetir con la producción de 1 cue: el primer lanzamiento deja `1 / 1` y finalizada.
9. **Modo tec en espera (RF16, CL12):** activar `tec` en espera y usar `→` (lanza) y `←` (retrocede). `←` no baja de `0` y no altera el registro guardado. Con el foco en un campo de texto de la preparación, las flechas no lanzan ni retroceden.
10. **Controles deshabilitados con motivo (RF19, CL10, CL11):** con el cronómetro en espera, "Incidencia rápida" y "Descanso" se ven atenuados, `disabled`, con el texto "Disponible al iniciar el cronómetro."; pulsarlos no hace nada. Tras "Iniciar", ambos se habilitan y funcionan (incluida la incidencia rápida en pausa).
11. **Bloqueo del selector con registro abierto (RF18, nota de alcance de §4.4):** con cues lanzadas y el registro abierto, comprobar que el selector de producción de la cabecera está deshabilitado y que su `title` describe el motivo. Con el registro cerrado (función finalizada o sin lanzamientos), el selector vuelve a estar disponible.
12. **Cierre del registro abierto (RF11, CL7, CL13):** con el registro abierto y sin finalizar, salir del modo función (navegar a otra ruta) y volver. El registro anterior queda con `endedAt` y la duración acumulada (el cronómetro marca `0` si nunca arrancó), el modo arranca en `00:00:00` con el contador a `0 / N` de la producción y el selector habilitado. Este es el mismo camino de cierre que usa el cambio de producción (`closeOpenRecordIfAny`), que con el bloqueo activo solo es alcanzable desde otras páginas (fuera de alcance, §1.4).
13. **Estados no operativos (RF14, CL1–CL4):** con la producción sin cues se lee "Esta producción no tiene cues para lanzar." y no hay botón activo; al recargar con la red/almacenamiento lento se ve "Cargando cues…"; sin producción, la invitación a crear o seleccionar.
14. **Preparación a función (RF15):** en espera, lanzar los avisos 30/15/5 y marcar los seis checks; el contador de cues y el cronómetro no se alteran.
15. **Libreto (§6.10):** abrir el libreto en espera y lanzar cues; la página salta a la cue prevenida sin saltos de scroll.
16. **Regresión "Iniciar sin lanzar" (§6.1):** en una producción limpia, pulsar "Iniciar" sin lanzar nada: se crea el registro, se bloquea el selector y el cronómetro arranca desde `00:00:00` con `launchedCueCount: 0`.

---

## 11. Trazabilidad: qué cubre cada parte del plan

| Parte del plan | RF / CL | D |
|---|---|---|
| §2 R1/R2, §5.1, §7.1, §7.2 | RF1, RF2, RF4, RF10, RF14; CL1–CL4, CL9 | D3 |
| §5.1 (reversión), §9 RG2 | RF12; CL5, CL16 | — |
| §5.1 (fallo no primero), §9 RG4 | RF13; CL21 | — |
| §5.1, §5.5, §9 RG1 | RF7; CL6 | — |
| §5.1 (creación), §5.2, §6, §7.1 | RF5, RF17; CL16 | D2, D8 |
| §5.1 (bloqueo), §5.2, §5.4 | RF18; §6.7 | D2 |
| §5.1 (finalización), §5.3, §7.3 | RF6, RF8; CL8, CL14, CL17, CL20 | D6, D7 |
| §5.2, §6 | RF3, RF9; CL15, CL18 | D1, D8 |
| §5.4 | RF11; CL7, CL13 | D10 |
| §7.4 | RF16; CL12 | D4 |
| §7.5 | RF19; CL10, CL11 | D5 |
| §7.6 | RF15 | — |
| §4, §10 | Verificación y no regresión (§6) | — |

---

## 12. Documentación a actualizar al terminar

### 12.1 `MEMORY.md`

- **Estado actual:** añadir que el modo función permite lanzar cues sin que el cronómetro esté en marcha y que la función se registra desde el primer lanzamiento.
- **Decisiones importantes:** añadir
  - `startedAt` pasa a significar "apertura del registro de la función"; el arranque del cronómetro se guarda aparte en el campo opcional `timerStartedAt` (los registros anteriores siguen siendo válidos, sin migración).
  - El registro de función se crea en el primer lanzamiento de cue (con el cronómetro en espera o en pausa) y el bloqueo de la selección de producción se activa en ese momento.
  - El registro abierto se cierra con `endedAt` al cambiar de producción o al salir del modo función; la recarga de la página queda como limitación conocida.
  - Las incidencias rápidas y los descansos siguen requiriendo el cronómetro arrancado; en espera se muestran deshabilitados con el motivo "Disponible al iniciar el cronómetro.".
- **Errores a evitar:** añadir "No volver a atar el lanzamiento de cues al estado del cronómetro" y "No duplicar la secuencia de cues en dos ramas de render".

### 12.2 `README.md`

- Actualizar el bullet del modo función de "Estado actual" para reflejar que se pueden lanzar cues sin iniciar el cronómetro y que la función queda registrada desde el primer lanzamiento.
- Mantener la sección "Verificación" (`npm run lint` + `npm run build`); opcionalmente añadir una nota de que la comprobación funcional del modo función es manual, siguiendo el guion del plan.

---

## 13. Recordatorio de alcance

No se incluye: persistir el estado del modo entre recargas, cerrar registros que quedaron abiertos tras una recarga, corregir a posteriori tiempos sin cronómetro, reportes que distingan `startedAt` de `timerStartedAt`, bloquear el cambio de producción desde páginas distintas del modo función, lanzar desde el libreto, reordenar o saltar cues, ni cambios en la preparación a función o en los atajos de teclado existentes (§1.4 y §9 de la spec).
