# Plan 002 — Modo Danza: documento, escaleta y ejecución sincronizada

- **Estado:** borrador
- **Fecha:** 2026-11-17
- **Spec:** `specs/002-modo-danza/spec.md` (v3, aprobada; RF1–RF41, D1–D37, CL1–CL64)
- **Cobertura:** RF1–RF41 y CL1–CL64; fases (a)–(g) del encargo
- **Restricción de partida:** la verificación del proyecto es `npm run lint` + `npm run build` + guion manual de **26 pasos** (spec 002 §11). No hay suite de tests automatizados y esta spec no la añade (§1.4, §9).
- **Convivencia con la spec 001:** los T1–T10 de este plan **no reabren ni asumen completados** los T8, T9 y T10 pendientes de `specs/001-lanzar-cues-sin-cronometro/tasks.md`. La 002 reutiliza el código ya presente de la 001 (cola `performanceSaveQueue`, `performanceRecordRef`, `closeOpenRecordIfAny` si ya existe, bandera `isProductionSelectionLocked`) y **no implementa** esos tres pendientes. Si en el repositorio aparecen antes, el código de la 002 debe seguir siendo compatible con ellos (§9 RG10).

---

## 1. Resumen del enfoque

La aplicación hoy asume un solo tipo de espectáculo: libreto PDF + cues etiquetados + un cronómetro global de función. La spec 002 no sustituye ese flujo: añade un **modo del proyecto** (`standard` | `dance`) fijado al crear y una capa de danza que se activa solo para esos proyectos.

El plan separa siete bloques en orden de dependencia, de modo que cada tarea deje lint+build en verde:

- **(a) Modelo y dominio puro** (T1–T3): campos opcionales en `types.ts`, schemas Zod que **no recortan** los campos nuevos (RF40, D25/D37), Dexie v5 sin migración destructiva, y módulos `src/lib/dance/*` con la escaleta, el tiempo activo, la secuencia, las desviaciones, el informe y el contrato JSON. Ninguna función lee `Date.now()`: el instante entra como `now`.
- **(b) Proyecto y documento** (T4): selector de modo, alta sin PDF, ficha, navegación condicionada y `/documento` + `/documento/imprimir` como vistas de la escaleta derivada.
- **(c) Tracks y reloj** (T5): ciclo de vida del track, cronómetro propio y reloj de espectáculo independiente, ambos en tiempo activo, con `TrackRun` persistido solo al cerrar (D30).
- **(d) Cuenta atrás y lanzamiento** (T6): objetivo calculado, bandas cerradas, aviso "¡Lanzar!" para la candidata, idempotencia, reversión ante fallo y captura de desviaciones con instantáneas del cue (D35).
- **(e) Ejecución y cierre** (T7–T8): badge/cambio de modo, ensayo libre vs función secuencial, escaleta viva, notas, edición bloqueada; después, las dos vías de finalización, el descarte, el informe y los reportes.
- **(f) Plantillas y preferencias** (T9): biblioteca global, editor con la misma UI de escaleta, copia independiente, versionado, JSON validado, `/ajustes` y tabla `appSettings`.
- **(g) Accesibilidad y verificación** (T10): escalado, alto contraste, teclado/lector de pantalla, `prefers-reduced-motion`, 360 px, documentación y recorrido completo del guion §11.

Principio rector: **la escaleta, la siguiente cue y el informe nunca se persisten como copia** (§4.7 de la spec); son funciones puras sobre tracks + cues + registro. Así no puede haber desincronización entre lo que se ve y lo que se imprime.

---

## 2. Punto de partida: dónde están hoy las restricciones

| # | Restricción actual | Ubicación | Cómo cambia |
|---|---|---|---|
| R1 | `Production` no tiene `mode` ni `templateOrigin`; `productionSchema` no los declara | `types.ts:86-98`, `schemas.ts:35-55` | Añadir ambos como opcionales al tipo **y** al schema (RF40); ausente = estándar |
| R2 | `Cue` no tiene `timing`; `cueSchema` no lo declara | `types.ts:100-116`, `schemas.ts:57-78` | Añadir `CueTiming` opcional y validarlo en `cueSchema` (RF6, RF40) |
| R3 | `saveCue` preserva tipo/acto/escena pero no un tiempo previo | `data-service.ts:241-278` | En **las dos ramas**, conservar `timing` del cue existente si el entrante no lo trae (CL45, D25) |
| R4 | No hay `performanceSchema`; `savePerformance` hace `put` directo | `data-service.ts:461-463` | Crear el schema con `mode?`, `cueLaunches?`, `trackRuns?` opcionales y validar antes de persistir (D37) |
| R5 | `PerformanceRunReport` solo tiene contador, pausas e incidencias | `types.ts:171-181` | Añadir los tres campos opcionales y las entidades `CueLaunchEvent`/`TrackRun` (§4.5) |
| R6 | Dexie llega a v4; no hay tablas de danza | `db.ts:22-82` | Añadir `version(5)` con `danceTracks`, `scheduleTemplates`, `appSettings`; sin `upgrade` destructiva (RF35) |
| R7 | Alta de proyecto exige PDF y llama siempre a `createProductionWithPdf` | `project-manager.tsx:205-247` | Selector de modo; en Danza el PDF es opcional y se usa una nueva ruta de creación (RF1, RF2) |
| R8 | Navegación fija de siete entradas; no hay rutas de danza | `navigation.ts:6-14`, `app-shell.tsx:128-156` | Añadir las rutas de aplicación y condicionar las de proyecto al modo (RF41) |
| R9 | `orderCues` ordena por número de cue y acto/escena del PDF | `operation-mode.tsx:89-119` | Reutilizar para el flujo estándar; para danza usar el orden temporal de `src/lib/dance/schedule.ts` (RF7, RF38) |
| R10 | `OperationTab = "operation" \| "announcements"`; una sola vista de ejecución | `operation-mode.tsx:53` | Ampliar con la pestaña interna "Documento" (consulta) y el informe; el badge vive en la barra de la vista (D4, D14) |
| R11 | Un único cronómetro con `timerState`, `getElapsedAt` y marcas absolutas | `operation-mode.tsx:137-144`, `289-320` | Reutilizar el patrón para track y reloj de espectáculo; **no** añadir otro motor acumulativo (D3, D32) |
| R12 | El lanzamiento ya es idempotente y revierte el primer guardado (spec 001) | `operation-mode.tsx:550-620` | Extender, no reescribir: añadir instantánea, desviación e idempotencia compartida con el aviso "¡Lanzar!" (RF18, RF23) |
| R13 | No hay preferencias ni ajustes; tema global en Zustand | `ui-store.ts:1-30` | Añadir caché de preferencias de danza en el store, fuente en `appSettings` (D13, D28) |
| R14 | `reportes/page.tsx` es informativo/placeholder | `src/app/reportes/page.tsx` | Añadir la lista de funciones de danza y el acceso a `/reportes/imprimir` sin borrar el contenido actual (RF24, regresión §6.8) |

---

## 3. Archivos que se crean o modifican

### 3.1 Se crean (lógica pura y superficies)

- **`src/lib/dance/schedule.ts`** — parseo/formatos de tiempo, comparación natural de identificadores, cadena de inicios, orden de cues, sección "Sin tiempo", totales y avisos (solape, duplicados, sin duración, track no encontrado). Cubre RF4–RF8, RF12, RF38, CL2, CL4–CL9, CL15, CL44, CL50, CL64.
- **`src/lib/dance/clock.ts`** — tiempo activo de track/reloj, objetivo de cue, cuenta atrás, recorte de bandas y disponibilidad de la referencia. Cubre RF12–RF15, RF23, RF39, D32/D34.
- **`src/lib/dance/sequence.ts`** — siguiente cue (candidata), lanzabilidad con motivo, y propagación de "no alcanzado" al detener un track. Cubre RF16, RF17, RF22, RF38, D18/D31.
- **`src/lib/dance/report.ts`** — informe de desviaciones y formato (`+0,8 s`, "a tiempo"), media con signo, máxima en valor absoluto, no alcanzados y listas aparte. Cubre RF24, RF25, D22/D35.
- **`src/lib/dance/templates.ts`** — construcción/validación del contrato JSON, nombres únicos, reparación de `trackKey` huérfanos, aplicación como copia. Cubre RF26–RF30, RF34, D10/D17/D27.
- **`src/lib/dance/preferences.ts`** — valores por defecto y validación de bandas contiguas/tamaño/contraste/sonido. Cubre RF14, RF32, D28/D34.
- **`src/lib/dance/performance.ts`** — extensiones del registro de función: apertura, `CueLaunchEvent` con instantánea y desviación, `TrackRun` al cerrar, cierre y borrado. Convive con `src/lib/performance-run.ts` de la 001 sin modificarlo. Cubre RF18, RF23, RF24, RF36, RF37, D30/D33.
- **Rutas App Router:** `src/app/documento/page.tsx`, `src/app/documento/imprimir/page.tsx`, `src/app/plantillas/page.tsx`, `src/app/ajustes/page.tsx`, `src/app/reportes/imprimir/page.tsx`.
- **Componentes nuevos:** `src/components/dance/document-view.tsx` (escaleta + impresión), `src/components/dance/track-panel.tsx`, `src/components/dance/countdown.tsx`, `src/components/dance/show-clock.tsx`, `src/components/dance/mode-badge.tsx`, `src/components/dance/template-manager.tsx`, `src/components/dance/preferences-panel.tsx`, `src/components/dance/deviation-report.tsx`. Se agrupan bajo `src/components/dance/` para no inflar más `operation-mode.tsx`.
- **`src/components/dance/style.css` o clases en Tailwind** para los cinco colores de la paleta, el parpadeo de 400 ms on/off y los factores de escala; sin colores libres (D34).

### 3.2 Se modifican

- **`src/lib/types.ts`** — `Production.mode?`, `Production.templateOrigin?`, `Cue.timing?`, `PerformanceRunReport.mode?/cueLaunches?/trackRuns?` y las interfaces nuevas (`DanceTrack`, `CueTiming`, `ScheduleTemplate*`, `CueLaunchEvent`, `TrackRun`, `CountdownBand`, `DancePreferences`, `TemplateOrigin`, `TemplateFile`).
- **`src/lib/schemas.ts`** — declarar los campos anteriores en `productionSchema`, `cueSchema` y el nuevo `performanceSchema`; añadir `danceTrackSchema`, `scheduleTemplateSchema`, `dancePreferencesSchema` y `templateFileSchema` (validación antes de escribir, RF30).
- **`src/lib/data-service.ts`** — crud de las tres tablas nuevas; `saveProduction`/`createProductionWithPdf` conservan `mode` y `templateOrigin`; `saveCue` conserva `timing` en todas las ramas; `savePerformance` valida con `performanceSchema`; cascadas de `deleteProduction`/`deleteAllProductions` y desvinculación materializando `atMs` al borrar un track (RF35).
- **`src/lib/db.ts`** — `version(5)` con los índices de §4.8 de la spec, sin `upgrade` que reescriba datos.
- **`src/lib/navigation.ts`** y **`src/components/layout/app-shell.tsx`** — entradas nuevas y condicionamiento por modo; `/plantillas` y `/ajustes` siempre visibles (RF41c).
- **`src/components/projects/project-manager.tsx`** — selector de modo, PDF opcional en danza, plantilla inicial al crear, etiqueta de modo/origen en la ficha (RF1–RF3, RF27).
- **`src/components/cues/cue-manager.tsx`** y **`src/components/pdf/libreto-viewer.tsx`** — sección de tiempo (vínculo, objetivo, umbral) solo en proyectos de danza; el visor de PDF sigue igual y admite libreto ausente (CL52, CL53).
- **`src/components/performance/operation-mode.tsx`** — integración de los paneles de danza, pestaña interna "Documento", badge/cambio de modo, tracks, reloj, cuenta atrás, aviso, escaleta viva, notas, finalizar/descartar y cableado con los módulos puros. Se conservan las garantías de la 001 (regresión §6.2).
- **`src/components/performance/report-list.tsx`** (o el fichero que hoy renderice `/reportes`) — lista de funciones de danza y enlace al informe imprimible.
- **`src/store/ui-store.ts`** — caché de `dancePreferences` y `setDancePreferences`; se hidrora desde `appSettings` al arrancar. La bandera `isProductionSelectionLocked` se reutiliza sin cambiar su forma.
- **`MEMORY.md`, `README.md`** — documentación final (T10; este plan no los edita).

### 3.3 No se tocan

`src/lib/performance-run.ts` (se reutiliza tal cual; las extensiones van en `src/lib/dance/performance.ts`), los archivos de `specs/001-lanzar-cues-sin-cronometro/`, `specs/002-modo-danza/spec.md`, la ruta/CRUD de incidencias, y los archivos de configuración de Next.js. El flujo estándar de PDF, numeración de cues y preparación a función sigue exactamente igual.

---

## 4. Funciones puras (con "hoy" como parámetro)

Convención: toda función pública de `src/lib/dance/*` recibe `now: number` (milisegundos) como último parámetro cuando produce o consume un instante, ISO o fecha de impresión/exportación. **Ninguna llama a `Date.now()` ni lee reloj, Dexie o React.** Las que solo calculan reciben el estado ya resuelto; el `now` inyectado permite reproducir el resultado y es el equivalente de "hoy" del plan 001. Los textos ISO se construyen con `new Date(now).toISOString()` dentro de la función.

```ts
// src/lib/dance/schedule.ts
export function parseDurationToMs(text: string): number | null;          // mm:ss | h:mm:ss; null si inválido
export function formatClock(ms: number): string;                         // mm:ss / h:mm:ss, redondeo al segundo
export function formatTenths(ms: number): string;                        // "+0,8 s" | "−0,4 s" | "a tiempo"
export function naturalIdentifierCompare(a: string, b: string): number;  // LX-2 < LX-10; LX-2.5 < LX-2.10
export function buildSchedule(input: {
  tracks: DanceTrack[];
  cues: Cue[];
  now: number;
}): Schedule;   // { tracks: ScheduledTrack[], timedCues: Cue[], untimedCues: Cue[], totals, warnings[] }

export function resolveCueTiming(cue: Cue, schedule: Schedule): ResolvedTiming;
// "linked" | "orphan" | "absolute" | "untimed"; huérfano = aviso "Track no encontrado", sin escritura
export function materializeAtMs(cue: Cue, schedule: Schedule, now: number): Cue;  // al desvincular/borrar track

// src/lib/dance/clock.ts
export function getActiveElapsedMs(sample: ClockSample, now: number): number;
// ClockSample = { startedAt: string; elapsedBeforeMs: number; pausedAt?: string | null; pausedTotalMs?: number }
export function getCueTargetMs(input: {
  cue: Cue; resolved: ResolvedTiming; trackActiveMs?: number; showActiveMs?: number; now: number;
}): number | undefined;                    // objetivo en tiempo activo; undefined sin referencia
export function getCountdownSeconds(targetMs: number, activeMs: number, alertBeforeMs: number): number | undefined;
export function sliceBands(bands: CountdownBand[], thresholdSeconds: number): CountdownBand[];
export function bandForSeconds(seconds: number, bands: CountdownBand[]): CountdownBand | null;  // null = neutro
export function getLaunchAvailability(input: {
  candidate: Cue; trackState?: TrackState; showRunning: boolean; mode: "rehearsal" | "show"; now: number;
}): { launchable: boolean; reason?: string };   // motivos fijos del §1.7/RF22

// src/lib/dance/sequence.ts
export function getNextCandidate(input: {
  cues: Cue[]; schedule: Schedule; launchedIds: string[]; notReachedIds: string[]; now: number;
}): Cue | undefined;
export function propagateManualStop(input: {
  trackId: string; cues: Cue[]; schedule: Schedule; mode: "rehearsal" | "show"; now: number;
}): { notReachedIds: string[]; nextCandidate?: Cue };   // en Ensayo no marca no alcanzados

// src/lib/dance/report.ts
export function buildDeviationReport(input: {
  runReport: PerformanceRunReport; cues: Cue[]; tracks: DanceTrack[]; now: number;
}): DeviationReport;   // fuente autoritativa = cueLaunches + instantáneas; nunca lee el cue actual para el texto
export function buildCueLaunchEvent(input: {
  cue: Cue; launchedAtMs: number; elapsedMs: number; showActiveMs?: number;
  trackStartAt?: string; targetOffsetMs?: number; actualOffsetMs?: number; now: number;
}): CueLaunchEvent;    // deviationMs = actual − target; ausente si no hay referencia

// src/lib/dance/templates.ts
export function buildTemplateFromSchedule(input: {
  name: string; description: string; schedule: Schedule; selection: TemplateSelection;
  existingNames: string[]; now: number;
}): ScheduleTemplate;                    // selección = tracks completos + cues sueltos (D17)
export function validateTemplateFile(input: unknown, now: number):
  | { ok: true; template: ScheduleTemplate; repairs: RepairNotice[] }
  | { ok: false; error: string };        // valida antes de escribir; repara trackKey huérfano
export function buildTemplateExport(input: {
  template: ScheduleTemplate; kind: "template" | "schedule"; now: number;
}): TemplateFile;                       // sobre con format/formatVersion/kind/exportedAt
export function uniqueTemplateName(name: string, existingNames: string[]): string;  // " (2)", " (3)"…
export function applyTemplateToProject(input: {
  template: ScheduleTemplate; productionId: string; now: number;
}): { tracks: DanceTrack[]; cues: Cue[]; templateOrigin: TemplateOrigin };  // ids nuevos, sin vínculo vivo

// src/lib/dance/preferences.ts
export const DEFAULT_DANCE_PREFERENCES: DancePreferences;  // rojo {4,10}, naranja {2,3}, verde {0,1}, sonido false
export function validateDancePreferences(input: unknown, now: number): DancePreferences;
// bandas contiguas desde 0, sin huecos/solapes, paleta cerrada y etiqueta no vacía

// src/lib/dance/performance.ts (convive con performance-run.ts)
export function openDanceRecord(input: { productionId: string; totalCues: number; now: number }): Performance;
export function appendLaunch(input: {
  performance: Performance; event: CueLaunchEvent; isFinished: boolean; elapsedMs: number; now: number;
}): Performance;                         // launchedCueCount = cueLaunches.length;-endedAt solo si isFinished
export function closeTrackRun(input: {
  trackId: string; title: string; startedAtMs: number; activeMs: number;
  endedBy: "duration" | "manual"; now: number;
}): TrackRun;                             // solo se persiste al cerrar (D30)
export function finishPerformance(input: {
  performance: Performance; trackRuns: TrackRun[]; elapsedMs: number; now: number;
}): Performance;                          // endedAt + cierre de tracks; idempotente
export function isSessionOpenRecord(performance: Performance | null | undefined, sessionId: string): boolean;
```

Detalles de comportamiento que el implementer debe respetar:

- `buildSchedule` es la **única** fuente de inicios, tiempos absolutos derivados, orden y totales; ni `atMs` derivado ni la escaleta se escriben en IndexedDB (§4.7).
- `getActiveElapsedMs` descuenta `pausedTotalMs` y el tramo `pausedAt → now`; es la base compartida de track, reloj de espectáculo y desviaciones (D32). Pausar no desplaza objetivos.
- `getLaunchAvailability` devuelve los motivos literales de la spec: "Reanuda el track para lanzar esta cue.", "En función solo se puede lanzar la siguiente cue de la escaleta.", "Añade una duración para lanzar este track." y "En función la escaleta no se edita. Cambia a Ensayo."
- `bandForSeconds` recibe bandas ya recortadas por `sliceBands`; fuera de la cobertura devuelve `null` (color neutro, CL49).
- `buildDeviationReport` redondea a **una décima con coma** y trata `|desviación| < 0,1 s` como "a tiempo", nunca `−0,0 s` (RF24d). La media es con signo; la máxima es la de mayor valor absoluto con desempate por orden cronológico (D35).
- `validateTemplateFile` **no escribe nada** por su cuenta: devuelve datos o error; la reparación de `trackKey` se informa, no bloquea (CL39).

---

## 5. Algoritmo (pseudocódigo por fase)

### 5.1 Escaleta y formatos — T2

```
buildSchedule(tracks, cues, now):
  ordenTracks = tracks por order ↑, luego startAtMs definido (menor primero, ausentes al final), luego id
  finConocido = 0
  para cada track en ordenTracks:
    inicio = startAtMs ?? finConocido
    fin = durationMs válida ? inicio + durationMs : undefined
    si inicio < finConocido -> aviso "Solapa con el track anterior" (no se corrige)
    si fin != undefined -> finConocido = max(finConocido, fin)
  para cada cue:
    resuelto = resolveCueTiming(cue, schedule)   // vinculado | huérfano | absoluto | sin tiempo
    tiempoAbsoluto = vinculado ? inicioTrack + trackOffsetMs : atMs
  timedCues   = cues con tiempoAbsoluto, ordenados por tiempo ↑, identificador natural, id
  untimedCues = resto, ordenados por identificador natural, id
  totalMs = max(fin de tracks con duración, max tiempoAbsoluto de cue)
  avisos de duplicados (order, título, identificador) sin renumerar (D16)
```

### 5.2 Reloj, objetivo y cuenta atrás — T3, T5, T6

```
iniciarPrimerTrack():
  si track sin durationMs -> no iniciar; motivo "Añade una duración para lanzar este track."
  si no hay showStartedAt -> showStartedAt = now        // RF39, solo la primera vez
  trackRun = { startedAt: now, elapsedBeforeMs: 0, pausedAt: null }
  estado = "En marcha"

getCueTargetMs(cue):
  si vinculado -> tiempo activo del track en este instante comparado con trackOffsetMs
  si atMs y reloj en marcha -> tiempo activo del reloj comparado con atMs
  si no -> undefined (sin cuenta atrás, sin desviación)

pintarCuentaAtras():
  restante = targetMs - activeMs
  si track Pausado -> ocultar (no congelar cifra)
  si restante <= 0 -> seconds = 0  y  aviso "¡Lanzar!" (nunca negativo)
  si restante > alertBeforeMs -> no se pinta
  banda = bandForSeconds(seconds, sliceBands(bandas, umbral))
```

### 5.3 Lanzamiento — T6, T7

```
handleLaunchCue(controlOrigen):
  si isLaunchingRef.current -> return                       // CL21, CL22
  candidata = getNextCandidate(...)                         // RF38
  si modo === "show" y (!candidata o !launchable) -> return con motivo
  now = Date.now();  isLaunchingRef = true
  instantes activos = getActiveElapsedMs(track/show, now)   // antes de guardar (RF23d)
  evento = buildCueLaunchEvent({... now })                  // instantánea del cue (D35)
  candidato = appendLaunch({ performance, evento, isFinished, elapsedMs, now })
  guardado = await persistPerformance(candidato)            // cola existente de la 001
  si falla: restaurar instantánea; primer lanzamiento revierte todo (CL25);
            posteriores conservan el instante original (CL26)
  si modo === "rehearsal": no persistir nada, solo estado en memoria (D7)
  anunciar lanzamiento; foco estable
```

### 5.4 Cierre y descarte — T8

```
finalizarFunction():
  si !isOpenRecord(registro de la sesión actual) -> deshabilitado con motivo (CL32)
  si pendientes -> confirmación "Se cerrará la función con N cues sin lanzar…"
  cerrar registro (endedAt/durationMs), cerrar TrackRun abiertos, detener reloj y cronómetro
  marcar no alcanzados / pendiente no lanzado, liberar selección, ofrecer informe
  idempotente ante doble activación (g)

descartarFunction():
  solo registro abierto de la sesión actual (isSessionOpenRecord)
  confirmación; borrar registro; contadores y relojes a 0; tracks a Pendiente; modo sigue en Función
  si falla el borrado: conservar registro y estado, error con reintento (CL35)
```

### 5.5 Plantillas y preferencias — T9, T10

```
guardarPlantilla(seleccion):
  validar nombre no vacío; SIM con >= 2 includedTypes; trackOffsetMs <= durationMs
  nombre = uniqueTemplateName(nombre, nombresExistentes)
  write(templateSchema.parse(buildTemplateFromSchedule(...)))   // nada parcial

importarJSON(archivo):
  parsear -> validateTemplateFile(input, now)
  si error -> mensaje en español, cero escrituras
  si ok -> nombre único + write; informar reparaciones (trackKey huérfano)

exportarEscaleta(): buildTemplateExport({ template: scheduleComoTemplate, kind: "schedule", now })
```

---

## 6. Modelo de datos y validación (RF40, RF35)

- **`Production.mode?: "standard" | "dance"`** y **`templateOrigin?: { templateId, name, version }`** en el tipo y en `productionSchema`. `saveProduction` y `createProductionWithPdf` persisten el objeto validado **completo**; no se normaliza a estándar si el modo viene informado.
- **`Cue.timing?: { trackId?, trackOffsetMs?, atMs?, alertBeforeMs? }`** en el tipo y en `cueSchema`, con `trackOffsetMs ≥ 0`, `atMs` en `[0, 86_400_000]`, `alertBeforeMs` en `[1_000, 60_000]`. `trackId` sin `trackOffsetMs` se resuelve como **sin vínculo** (CL64). `saveCue` conserva el `timing` guardado cuando el entrante no lo trae, en la rama de libreto y en la normal (CL45).
- **`PerformanceRunReport.mode?/cueLaunches?/trackRuns?`** opcionales y **`performanceSchema`** nuevo; `savePerformance` valida con él. Registros antiguos sin esos campos siguen siendo válidos y cuentan como función (RF25).
- **Dexie v5:** `danceTracks: "id, productionId, order"`, `scheduleTemplates: "id, name, updatedAt"`, `appSettings: "id"`. Sin cambiar claves existentes, sin `upgrade` que borre datos; `appSettings` guarda una fila `"dance"`.
- **Integridad:** `atMs` derivado no se persiste como fuente; se materializa al desvincular o borrar el track (RF35). Borrar producción elimina sus tracks; `deleteAllProductions` conserva plantillas y preferencias (CL42). Un `TrackRun` solo se escribe cerrado (D30).
- **Sin migración destructiva:** datos anteriores se leen con defaults; ninguna Entidad nueva es obligatoria.

---

## 7. Superficies y render

| Superficie | Cambio principal | RF |
|---|---|---|
| `/proyectos` | Grupo de opciones "Estándar (PDF)" / "Danza (documento + escaleta)", preseleccionado estándar; PDF opcional en danza; selector de plantilla inicial y "Empezar de cero"; etiqueta de modo y `templateOrigin` en la ficha | RF1–RF3, RF27 |
| `/documento`, `/documento/imprimir` | Tres secciones (Tracks, Cues, Sin tiempo), totales, avisos; edición libre sin ejecución o en Ensayo, solo lectura salvo notas en Función; impresión en claro sin controles | RF4, RF5, RF7, RF8, RF11, RF31, CL47 |
| `/cues`, `/libretos` | Sección de tiempo solo en danza; libreto opcional y complementario, mensaje si no hay PDF | RF6, CL52, CL53 |
| `/modo-funcion` | Badge ENSAYO/FUNCIÓN + cambio protegido; paneles de tracks, reloj "Espectáculo", cuenta atrás, "¡Lanzar!", escaleta viva, notas, Finalizar/Descartar; pestaña interna "Documento" (consulta) | RF9, RF11, RF13–RF23, RF31, RF36–RF39 |
| `/reportes`, `/reportes/imprimir` | Lista de funciones de danza, informe imprimible desde el registro; los ensayos no aparecen | RF24, RF25, RF41 |
| `/plantillas` | Biblioteca global, editor con UI de escaleta, duplicar/renombrar/eliminar/exportar/importar; sin acciones sobre proyectos | RF26–RF30, RF34, RF41c |
| `/ajustes` | Bandas, tamaño, alto contraste, sonido y umbral por defecto, validados y persistentes | RF14, RF32 |

Reglas de render: el color nunca es la única información (etiqueta textual de banda y tipo de cue); tres relojes con etiquetas distintas; controles no disponibles **atenuados con motivo** asociado (`aria-describedby`), nunca pulsables sin efecto; el aviso "¡Lanzar!" solo para la candidata, `≥ 44×44 px`, parpadeo 400 ms on/off y alternativa estática con `prefers-reduced-motion`; impresión siempre clara y con tamaño fijo.

---

## 8. Decisiones técnicas (con alternativa descartada)

| # | Decisión | Alternativa descartada | Motivo |
|---|---|---|---|
| DT1 | Cue existente + `Cue.timing` opcional (D1) | Entidad `DanceCue` paralela | Duplicaría tipos, colores, numeración y el camino de lanzamiento |
| DT2 | Escaleta/siguiente/informe como funciones puras (D2, D12, §4.7) | Persistir una copia de la escaleta y del informe | Copias desincronizables; el informe debe ser reproducible desde el registro |
| DT3 | Danza dentro de `/modo-funcion` (D4) | Ruta `/modo-danza` | Duplicaría cronómetro, preparación, incidencias y libreto |
| DT4 | Vista imprimible + impresión del navegador (D5) | Librería de generación de PDF | Nueva dependencia y peores resultados para algo que el navegador ya hace |
| DT5 | Función por defecto (D6) + ensayo solo en memoria (D7) | Persistir `mode: "rehearsal"` y recordar último modo | Exigiría filtrar métricas en todas las vistas y podría generar métricas falsas |
| DT6 | Declarar `mode`, `templateOrigin`, `timing` y campos de informe en los schemas (D25) | Confiar en el guardado "tal cual" | Zod recorta claves desconocidas: se perderían modo, tiempo e informe (RF40) |
| DT7 | `performanceSchema` con opcionales + `savePerformance` validado (D37) | Seguir con `put` directo | Único camino capaz de recortar o aceptar silenciosamente datos mal formados del informe |
| DT8 | Módulos `src/lib/dance/*` puros con `now` inyectado | Implementar cálculos dentro de los componentes | Constitución punto 3; permite razonar sobre pausas, secuencia y desviaciones sin montar React |
| DT9 | Dexie v5 aditiva, sin `upgrade` destructivo | Reescribir datos existentes al subir de versión | Constitución punto 2: compatibilidad y auditoría; todos los campos son opcionales |
| DT10 | Reloj de espectáculo y tracks en memoria, tiempo activo (D21, D30, D32) | Persistir reloj/`TrackRun` abiertos y usar tiempo de pared | Una recarga dejaría ejecuciones huérfanas; el tiempo de pared falsely cuenta las pausas como retraso |
| DT11 | `TrackRun` solo al cerrar, con `endedBy: "duration" \| "manual"` (D31) | Estado "detenido" separado | El manual y el natural son el mismo estado Terminado con distinto motivo; evita un cuarto estado |
| DT12 | Plantillas como copia con `trackKey` local y JSON validado (D10, D17, D27) | Vínculo vivo al proyecto / importar como proyecto | Rompería el aislamiento (RF29) y obligaría a decidir modo, PDF y colisiones en la importación |
| DT13 | Preferencias en `appSettings` + caché en Zustand (D13, D28) | `localStorage` suelto o preferencias por proyecto | Sin validación ni versionado; el regidor quiere una cabina coherente entre obras |
| DT14 | Paleta cerrada de cinco colores y bandas contiguas recortadas (D34) | Color hexadecimal libre / bandas con huecos | Rompería contraste AA y la comparación visual; el color nunca es la única información |
| DT15 | Sin tests automatizados: lint + build + guion §11 | Añadir `node --test`/Vitest con runner de TS | Fuera de alcance (spec §1.4 y §9); no hay script `test` ni runner. La lógica queda aislada en DT8 para una spec futura |
| DT16 | No reabrir los T8/T9/T10 pendientes de la 001; reutilizar su cola y refs | Reimplementar cierre de registro, tec y controles deshabilitados | Evita divergir de la 001 y respeta el alcance de esta spec (convivencia, §9 RG10) |

---

## 9. Riesgos técnicos y mitigación

| # | Riesgo | Mitigación |
|---|---|---|
| RG1 | Regresión del flujo estándar y de la 001 | El modo se decide al crear; ausente = estándar. No se toca `orderCues`, numeración ni preparación; guion §11 pasos 2 y 24 |
| RG2 | Guardar una nota borre `timing` (CL45) | `saveCue` conserva el tiempo previo en las dos ramas + schema declara `timing`; verificado en §11 paso 15 |
| RG3 | Carrera entre guardados, finalizar y descartar | Misma cola secuencial de la 001; refs sincrónicas de lanzamiento y cierre idempotente; sin doble registro |
| RG4 | Pausas que desplacen objetivos (D32) | Un solo `getActiveElapsedMs` para track, reloj y desviación; §11 pasos 5, 6 y 7 |
| RG5 | Track terminado por duración con cue en el final (CL59) | `endedBy: "duration"` mantiene la referencia; `0` + "¡Lanzar!" indefinidos; desviación `0`; §11 paso 25 |
| RG6 | Editar un cue cambie el informe ya cerrado (D35) | Instantáneas `cueDescription/cuePie/cueObservations` en `CueLaunchEvent`; §11 paso 10 |
| RG7 | Registro abierto de sesión anterior (D33, CL62) | `isSessionOpenRecord` por id de sesión en memoria; se lista como "sesión anterior" sin tocarlo; §11 pasos 12 y 23 |
| RG8 | Escritura parcial al importar JSON corrupto | `validateTemplateFile` devuelve datos o error antes de cualquier `put`; reparaciones informadas; §11 paso 16 |
| RG9 | Foco, anuncios y 360 px (RF33) | Una sola región `aria-live` + asertiva para "¡Lanzar!"/errores; anunciar solo segundos del umbral; revisión con teclado en §11 paso 17 |
| RG10 | Convivencia con T8/T9/T10 pendientes de la 001 | No se editan sus archivos ni se duplican sus funciones; si ya están implementadas, se comprueba que la cola y el bloqueo sigan siendo los mismos antes de cablear la 002 |

---

## 10. Estrategia de verificación

### 10.1 Automática (la disponible)

```bash
npm run lint
npm run build
```

Al cierre de **cada** tarea y de nuevo al final, sin avisos nuevos (regresión §6.10). Cada tarea de `tasks.md` lo exige en "Hecho cuando".

### 10.2 Tests automatizados: fuera de alcance (justificación)

- `package.json` no tiene script `test` ni runner de TypeScript; `node --test` sobre TS requeriría añadir infraestructura (`tsx`/compilación previa), explicitamente fuera de alcance (spec §1.4 y §9).
- La constitución declara Vitest/Testing Library/Playwright como estado objetivo, no actual.
- Compensación: lógica no trivial aislada en funciones puras con `now` inyectado (DT8/DT15), revisión de código de idempotencia y del flujo de reversión, y el guion manual guiado.

### 10.3 Guion manual (spec 002 §11, 26 pasos)

El guion completo está en la spec y **no se duplica aquí**. Referencia rápida por fase:

| Fase | Pasos del guion §11 |
|---|---|
| (a) Modelo y dominio (T1–T3) | 4, 8, 10, 15, 20, 22 |
| (b) Proyecto y documento (T4) | 2, 3, 4, 15, 24 |
| (c) Tracks y reloj (T5) | 5, 6, 20, 22, 25, 26 |
| (d) Cuenta atrás y lanzamiento (T6) | 7, 8, 9, 18, 19, 25 |
| (e) Ejecución y cierre (T7–T8) | 10, 11, 12, 13, 14, 17, 18, 20, 23, 26 |
| (f) Plantillas y ajustes (T9) | 3, 16, 21 |
| (g) Accesibilidad y cierre (T10) | 1, 7, 16, 17, 24 + recorrido completo 1–26 |

Preparación: un proyecto de danza con 3 tracks (uno con duración, uno sin duración, uno con inicio solapado) y cues en `0:30`, `1:00`, `1:30` y sin tiempo; un proyecto estándar anterior; un registro cerrado de prueba insertado en IndexedDB con desviaciones `+800/+40/−800 ms` (paso 10).

---

## 11. Trazabilidad: qué cubre cada parte del plan

| Parte del plan | RF / CL | D |
|---|---|---|
| §2 R1–R6, §3.2 (types/schemas/db/data-service), §6, T1 | RF3, RF27, RF35, RF40; CL1, CL42, CL45, CL46, CL62 | D25, D36, D37 |
| §4 `schedule.ts`, §5.1, T2 | RF4, RF5, RF6, RF7, RF8 (formatos), RF12, RF38; CL2, CL4–CL9, CL15, CL44, CL50, CL64 | D2, D8, D12, D16 |
| §4 `clock.ts`/`sequence.ts`/`report.ts`/`preferences.ts`, §5.2, T3 | RF13, RF14, RF17, RF23, RF24, RF25, RF38, RF39; CL10, CL11, CL19, CL23, CL24, CL37, CL57 | D21, D22, D32, D34, D35 |
| §3.1 rutas, §7, T4 | RF1, RF2, RF3, RF4, RF6, RF8, RF11, RF41; CL1, CL2, CL7–CL9, CL46, CL52, CL53, CL63 | D2, D5, D29 |
| §4 `clock.ts`, §5.2, T5 | RF5, RF9, RF10, RF35, RF39; CL3–CL6, CL20, CL43, CL44, CL58–CL60, CL64 | D3, D9, D30, D31 |
| §4 `clock.ts`/`performance.ts`, §5.3, T6 | RF12–RF18, RF23, RF31 (captura); CL10–CL16, CL18, CL21–CL26, CL48, CL49, CL59 | D18, D23, D31, D34, D35 |
| §5.3, §7, T7 | RF11, RF16, RF17, RF19–RF22, RF31, RF33 (foco), RF38; CL17, CL18, CL27–CL29, CL54, CL58, CL60, CL63 | D6, D7, D14, D18 |
| §4 `performance.ts`/`report.ts`, §5.4, T8 | RF8 (informe), RF24, RF25, RF35, RF36, RF37; CL12, CL13, CL30–CL37, CL57, CL62 | D19, D20, D22, D33 |
| §4 `templates.ts`/`preferences.ts`, §5.5, T9 | RF26–RF30, RF32, RF34, RF41c; CL38–CL41, CL50, CL51, CL55, CL56, CL61 | D10, D11, D13, D17, D27, D28 |
| §7, §10, T10 | RF8, RF14, RF32, RF33, RF41, regresiones §6; CL1, CL24, CL47, CL49 | D5, D13, D14, D34 |

---

## 12. Documentación a actualizar al terminar (T10)

- **`MEMORY.md`:** estado actual con el Modo Danza y sus superficies; decisiones (modo fijado al crear, ensayo no persistido, tiempo activo como referencia, plantillas como copia, `TrackRun` solo al cerrar, campos nuevos declarados en schemas, registro abierto de sesión anterior como limitación); errores a evitar ("no perder `mode`/`timing`/informe al validar", "no reconstruir el informe leyendo el cue actual", "no persistir la escaleta").
- **`README.md`:** bullet del modo danza, nuevas rutas y verificación (`npm run lint` + `npm run build` + guion §11).

---

## 13. Recordatorio de alcance

No se incluye (spec §9): audio de tracks, multi-track simultáneo, búsqueda/etiquetas de plantillas, historial de versiones con restauración, aplicar plantilla a proyecto ya creado, importar JSON como proyecto, persistir ensayos, PWA/offline, pruebas automatizadas, editor de libreto de texto, cambio de modo de proyecto ya creado ni persistencia de la ejecución entre recargas (incluida la recuperación de registros abiertos de sesiones anteriores).
