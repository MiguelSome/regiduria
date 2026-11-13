# Spec 001 — Lanzar cues sin haber iniciado el cronómetro

- **Estado:** lista para aprobación
- **Fecha:** 2026-11-13
- **Ámbito:** Modo función (ejecución de una función)
- **Prioridad constitucional:** Fiabilidad en modo función (punto 5) — seguridad operativa en directo
- **Decisiones tomadas:** D1–D10 (§8). No quedan decisiones abiertas ni contradicciones conocidas.

---

## 1. Objetivo y alcance

### 1.1 Objetivo

Permitir que, en el modo función, el regidor/a pueda empezar a lanzar cues **sin que el cronómetro de función esté en marcha**, eliminando la dependencia actual entre "iniciar la función" (arrancar el cronómetro) y "empezar a lanzar cues".

### 1.2 Por qué

Hoy el único camino para llegar a la secuencia de cues es pulsar "Iniciar", que a la vez crea el registro de la función, bloquea la selección de producción y arranca el cronómetro. Eso obliga a que el tiempo de función empiece a contar en el momento del primer lanzamiento, aunque la realidad de cabina sea otra (ensayo de arranque, preavisos, función que empieza con el cronómetro parado, comprobación de cues antes de dar el "go" real). El resultado es que el regidor/a no puede operar la secuencia sin falsear el tiempo de la función.

### 1.3 Alcance incluido

- Mostrar la secuencia de cues y el control de lanzamiento de la cue prevenida cuando el cronómetro está en espera o en pausa.
- Registrar los lanzamientos hechos con el cronómetro parado, sin perderlos y sin bloquear la interfaz.
- Crear el registro de la función en el primer lanzamiento de cue, aunque el cronómetro no esté en marcha, y activar en ese momento el bloqueo de la selección de producción.
- Mantener coherente el estado de la función (progreso de cues, estado del cronómetro, registro de la función).
- Dar la función por finalizada al lanzar la última cue, sin necesidad de haber arrancado el cronómetro, mostrando el indicador "Finalizada".
- Cerrar el registro abierto cuando se cambia de producción o se sale del modo función.
- Mensajes y estados de error legibles cuando el lanzamiento no puede completarse, con reversión del primer lanzamiento si el registro no puede crearse y con reintento en fallos de guardado posteriores.
- Dejar visible y con motivo el estado deshabilitado de incidencias rápidas y descansos mientras el cronómetro esté en espera.
- Accesibilidad y legibilidad del control de lanzamiento en estado "sin cronómetro".

### 1.4 Fuera de alcance

- Rediseñar el modelo de tiempos más allá de (a) la nueva semántica de `startedAt` como "apertura del registro de la función" y (b) el nuevo campo opcional `timerStartedAt` (arranque del cronómetro, D8). No se redefinen unidades ni se migran los registros existentes.
- Persistir el estado del modo función entre recargas de la aplicación (hoy es estado en memoria; sigue siéndolo).
- Cerrar automáticamente registros que quedaron abiertos tras una recarga (limitación conocida; ver §9).
- Añadir nuevos tipos de registro, exportación de reportes o sincronización remota.
- Cambiar el orden, la selección o la edición de cues.
- Cambiar la preparación a función (avisos 30/15/5 y checks).
- Atajos de teclado distintos de los ya existentes.
- Bloquear o condicionar el cambio de producción desde páginas distintas del modo función (el bloqueo actual solo inhabilita el selector de la cabecera; ver RF11 y §4.4).

---

## 2. Requisitos funcionales (EARS)

### Visibilidad y acceso al lanzamiento

**RF1** — Cuando el modo función esté en espera (cronómetro sin iniciar) o en pausa, exista una producción seleccionada y sus cues estén cargadas y no estén vacías, el sistema deberá mostrar la secuencia de cues con la primera cue pendiente en estado "prevenida" y su control de lanzamiento operativo.

- *Criterio de aceptación:* con el cronómetro mostrando `00:00:00` y sin haber pulsado "Iniciar", se ve el bloque de cue prevenida con su identificador, tipo, descripción y un botón de lanzamiento habilitado (no atenuado), y ya no aparece el texto de espera "Al iniciar el cronómetro aparecerá aquí la primera cue de la función." El mismo bloque con el botón habilitado se ve también con el cronómetro en pausa.

**RF2** — Mientras el modo función esté en espera, el sistema deberá mantener visibles y actualizados el contador de cues lanzadas, el progreso de cues y la lista de cues ya lanzadas.

- *Criterio de aceptación:* el contador muestra `0 / N · 0 %` en espera, y se actualiza inmediatamente tras cada lanzamiento sin cambiar de pantalla.

**RF3** — El sistema deberá permitir iniciar el cronómetro de forma independiente de los lanzamientos ya realizados, mientras la función no haya quedado finalizada (es decir, mientras queden cues pendientes).

- *Criterio de aceptación:* tras lanzar una o más cues con el cronómetro en espera y quedando cues pendientes, el botón de cronómetro sigue disponible y al pulsarlo la función pasa a "En curso" sin reiniciar ni perder las cues lanzadas. Si la producción tiene una sola cue, tras su lanzamiento la función queda finalizada (RF6) y el botón muestra "Finalizada" deshabilitado, sin contradicción con este requisito.

### Lanzamiento de cues

**RF4** — Cuando el usuario active el control de lanzamiento de la cue prevenida y el cronómetro esté en espera o en pausa, el sistema deberá registrar el lanzamiento (marcar la cue como lanzada y avanzar el contador) sin exigir que el cronómetro esté en marcha y sin mostrar ningún error por ese motivo.

- *Criterio de aceptación:* con cronómetro en espera o en pausa, un lanzamiento incrementa el contador en 1, mueve la cue a la lista de lanzadas y presenta la siguiente cue como prevenida, sin mensaje de error y sin arrancar ni reanudar el cronómetro.

**RF5** — El sistema deberá garantizar que ningún lanzamiento efectivo de cue se pierde por el hecho de no haber iniciado el cronómetro: todo lanzamiento deberá quedar reflejado en el registro de la función, creándose dicho registro en el primer lanzamiento aunque el cronómetro esté en espera o en pausa. El retroceso con la flecha ← del modo tec es una acción de pantalla **no persistida** y no cuenta como lanzamiento.

- *Criterio de aceptación:* tras lanzar cues con el cronómetro en espera, el registro de la función guardado refleja el número de cues lanzadas; ningún lanzamiento efectivo desaparece ni queda solo en pantalla; un retroceso con ← no modifica el registro guardado.

**RF6** — Cuando el usuario lance la última cue pendiente, el sistema deberá dar la función por finalizada en la misma acción (marcar la cue como lanzada, fijar `endedAt`, congelar la duración, mostrar el indicador "Finalizada", retirar el control de lanzamiento y liberar la selección de producción), con independencia de que el cronómetro se haya iniciado o no; la duración registrada será `0` si el cronómetro nunca se inició, o el tiempo acumulado si llegó a arrancar. Si la producción tiene una sola cue, el primer lanzamiento es también el último y finaliza la función.

- *Criterio de aceptación:* al lanzar la última cue se muestra "Todas las cues de esta función se han lanzado", el indicador del cronómetro muestra "Finalizada", no queda ningún control de lanzamiento activo, la selección de producción vuelve a estar disponible y el registro queda con `endedAt` fijado; si el cronómetro nunca arrancó, `durationMs` es `0`. Con una producción de una sola cue, el primer lanzamiento deja el contador en `1 / 1` y la función finalizada.

**RF7** — El sistema deberá registrar cada lanzamiento de cue de forma **idempotente y con antirrebote**: una misma activación del control deberá contar como máximo un lanzamiento, y **mientras un lanzamiento esté en curso o su guardado no haya terminado, las activaciones adicionales deberán ignorarse** (no encolarse ni contarse).

- *Criterio de aceptación:*
  - (a) un doble clic, un doble toque táctil, una pulsación de tecla mantenida (`event.repeat`) o una activación simultánea por Enter y Espacio producen **un solo** incremento del contador;
  - (b) con un lanzamiento en curso (guardado pendiente de confirmación), activar de nuevo el control —por botón, tecla o toque— no incrementa el contador y no deja un segundo lanzamiento encolado;
  - (c) una vez terminado el guardado, la siguiente activación sí lanza la cue siguiente (el control vuelve a estar disponible).

### Estado del cronómetro y coherencia

**RF8** — Mientras el cronómetro esté en espera, se hayan lanzado cues y la función **no haya quedado finalizada**, el sistema deberá mostrar de forma textual y persistente que el tiempo de función no está corriendo, de modo que no pueda confundirse con una función cronometrada.

- *Criterio de aceptación:* con cues lanzadas, cronómetro en espera y quedando cues pendientes, el indicador de estado muestra "En espera" (no solo un color) y el tiempo permanece en `00:00:00` mientras no se inicie el cronómetro. Si la función se finaliza (RF6), el indicador pasa a "Finalizada" (D7) y este requisito deja de aplicar.

**RF9** — Cuando el usuario inicie el cronómetro después de haber lanzado cues, el sistema deberá empezar a contar el tiempo de función desde ese instante, de modo que el tiempo de función sea siempre el tiempo real de función y los lanzamientos previos no alteren la cuenta.

- *Criterio de aceptación:* el tiempo de función comienza en `00:00:00` en el momento de iniciar y avanza de forma continua; los lanzamientos previos siguen contabilizados y no se han sumado al tiempo; el registro guarda el instante de ese arranque en el campo opcional `timerStartedAt` (D8).

**RF10** — Mientras el cronómetro esté en pausa (incluido un descanso activo), el sistema deberá permitir el lanzamiento de cues con el mismo comportamiento que en espera, sin exigir reanudar el cronómetro.

- *Criterio de aceptación:* con el cronómetro en pausa o con un descanso activo, el control de lanzamiento está operativo, lanza la cue prevenida y no reanuda el cronómetro ni cierra el descanso; el tiempo acumulado no se altera por el lanzamiento.

**RF11** — Cuando el usuario cambie de producción, salga del modo función o reinicie el modo función, el sistema deberá cerrar el registro abierto (fijando `endedAt` y la duración acumulada), volver al estado de espera con el contador de cues a cero, liberar el bloqueo de la selección de producción y no conservar lanzamientos residuales.

- *Criterio de aceptación:* tras cambiar de producción o salir del modo función, el cronómetro muestra `00:00:00`, el contador `0 / N` de la nueva producción, no se conserva ningún lanzamiento de la anterior y el registro que estaba abierto queda con `endedAt` fijado; el selector de producción de la cabecera vuelve a estar habilitado.
- *Nota de alcance:* con el bloqueo activo, la única vía **dentro del alcance** para cambiar de producción es finalizar la función (RF6) o salir del modo función; el bloqueo actual solo inhabilita el selector de la cabecera (`app-shell.tsx`), por lo que el cambio de producción desde otras páginas queda **fuera de alcance** (§1.4).

### Errores y avisos

**RF12** *(requisito padre del caso CL5)* — Si el usuario activa el **primer** lanzamiento de cue y no existe un registro de función ni puede crearse o guardarse, entonces el sistema deberá **revertir íntegramente** ese lanzamiento (contador, cue prevenida, bloqueo de selección de producción y registro), dejar el estado de la función como estaba antes de la activación y mostrar un mensaje de error legible en español, permitiendo reintentar.

- *Criterio de aceptación:* el contador vuelve a su valor anterior (`0` en el primer lanzamiento), la cue vuelve a mostrarse como prevenida, la selección de producción **no** queda bloqueada, no queda ningún registro creado ni parcialmente guardado, aparece un aviso con el motivo, el cronómetro no cambia de estado y la interfaz no se bloquea; un nuevo intento puede volver a lanzar.

**RF13** — Si falla el guardado del registro durante un lanzamiento que **no es el primero** (ya existe registro de la función), entonces el sistema deberá mostrar el error, **no incrementar el contador de cues lanzadas**, conservar el registro en su último estado guardado consistente y permitir reintentar el mismo lanzamiento sin recargar la página.

- *Criterio de aceptación:* el contador permanece en el valor previo, la cue afectada sigue mostrándose como prevenida, aparece un aviso de que no se pudo guardar, el registro guardado conserva el `launchedCueCount` anterior, y al reintentar el lanzamiento puede completarse sin recargar.

**RF14** — Si la producción no tiene cues o los cues no han terminado de cargarse, entonces el sistema deberá indicar esa situación y no mostrar un control de lanzamiento operativo.

- *Criterio de aceptación:* sin cues, se muestra "Esta producción no tiene cues para lanzar."; mientras cargan, se muestra el estado de carga y no hay botón de lanzamiento activo.

### Operación en cabina

**RF15** — Mientras la función esté en espera, el sistema deberá mantener accesibles los controles de preparación a función (aviso temporizado y checks) sin interferir con los lanzamientos.

- *Criterio de aceptación:* los avisos y checks siguen funcionando en espera y su uso no altera el contador de cues ni el estado del cronómetro.

**RF16** — Donde el modo "tec" esté activo, el sistema deberá permitir lanzar cues con la flecha derecha sin que el cronómetro tenga que estar en marcha (en espera, en pausa o en un descanso activo) y permitir retroceder el contador con la flecha izquierda, con el mismo criterio que el botón de lanzamiento.

- *Criterio de aceptación:* con tec activo y cronómetro en espera o en pausa, la flecha derecha lanza la cue prevenida y la flecha izquierda retrocede el contador, sin activarse cuando el foco está en un campo de texto. El retroceso ← se queda en `0` (nunca negativo), es una acción **no persistida** (RF5), está disponible mientras la función no haya finalizado y deja de estar disponible tras finalizar (RF6). El conmutador tec es visible y operable también en espera (ver §8, asumido).

### Registro de la función y otros controles

**RF17** — Cuando el usuario lance la primera cue y aún no exista registro de la función, el sistema deberá crear el registro (`Performance` con su `runReport`) en ese primer lanzamiento, aunque el cronómetro esté en espera o en pausa; `startedAt` pasa a significar "apertura del registro de la función" y no "inicio del cronómetro", y el campo opcional `timerStartedAt` (arranque del cronómetro) queda sin definir.

- *Criterio de aceptación:* con el cronómetro en `00:00:00`, el primer lanzamiento crea y guarda un registro con `startedAt` igual a ese instante, `durationMs` `0`, `launchedCueCount` `1` y sin `timerStartedAt`; si después se pulsa "Iniciar", no se crea un segundo registro ni se reinicia el contador.

**RF18** — Cuando se cree el registro de la función en el primer lanzamiento, el sistema deberá activar el bloqueo de la selección de producción en ese momento, en lugar de al pulsar "Iniciar".

- *Criterio de aceptación:* tras el primer lanzamiento con el cronómetro en espera, la selección de producción queda bloqueada; el bloqueo solo se libera al finalizar la función (RF6) o al salir del modo función (RF11). Si "Iniciar" se pulsa antes de cualquier lanzamiento, el bloqueo se activa igual que hasta ahora.

**RF19** — Mientras el cronómetro esté en espera (nunca arrancado), el sistema deberá **mostrar** los controles de incidencia rápida y de descanso en estado **deshabilitado y con motivo visible**, sin permitir su activación; en cuanto el cronómetro arranque (en marcha o en pausa) deberán quedar habilitados.

- *Texto fijo del motivo:* "Disponible al iniciar el cronómetro."
- *Criterio de aceptación:* con el cronómetro en espera, ambos controles se muestran (no se ocultan) atenuados y `disabled`, cada uno con el texto de motivo "Disponible al iniciar el cronómetro." asociado de forma accesible (`aria-describedby` o equivalente); pulsarlos no produce ningún efecto; al pulsar "Iniciar" pasan a estar habilitados y funcionan como hasta ahora.

---

## 3. Casos límite y comportamientos ante errores

| # | Caso | Comportamiento esperado |
|---|------|-------------------------|
| CL1 | Producción sin cues | Se muestra el mensaje de "sin cues"; no hay control de lanzamiento operativo (RF14). |
| CL2 | Cues en carga | Se muestra el estado de carga; el lanzamiento no está disponible (RF14). |
| CL3 | Error al cargar cues | Se muestra el error con `role="alert"`; no se puede lanzar (RF14). |
| CL4 | Sin producción seleccionada | No hay control de lanzamiento; se invita a crear o seleccionar producción (RF1/RF14). |
| CL5 | Fallo al crear/guardar el registro de la función en el **primer** lanzamiento | Se revierte íntegramente el lanzamiento (contador y cue prevenida vuelven a su estado anterior), no se bloquea la selección de producción, no queda registro y se muestra el error; se puede reintentar (RF12). |
| CL6 | Doble activación rápida del lanzamiento (doble clic, doble toque, tecla mantenida, Enter+Espacio) | Un solo lanzamiento (RF7). |
| CL7 | Lanzamiento durante un cambio de producción | Se impide el lanzamiento de la producción saliente; el registro saliente se cierra con `endedAt` (D10/RF11); no se mezclan cues ni contadores. |
| CL8 | Cronómetro en `finished` | No hay cue pendiente ni control de lanzamiento (RF6). |
| CL9 | Lanzamiento con el cronómetro en pausa | Permitido: lanza igual que en espera, sin reanudar el cronómetro (D3/RF10). |
| CL10 | Descanso con el cronómetro en espera | No disponible: control visible, deshabilitado y con el motivo "Disponible al iniciar el cronómetro." (D5/RF19). |
| CL11 | Incidencia rápida con el cronómetro en espera | No disponible: control visible, deshabilitado y con el mismo motivo (D5/RF19). |
| CL12 | Retroceso del contador (tec ←) por debajo de 0 | Se queda en 0; nunca negativo; no se persiste (RF5/RF16). |
| CL13 | Recarga de la página con cues lanzadas sin cronómetro | El estado en memoria se pierde (comportamiento actual del modo función); el registro ya creado permanece. Si ese registro estaba abierto, no puede cerrarse de forma determinista con el alcance actual (limitación conocida, §9). El bloqueo de la selección de producción se libera porque vive solo en memoria (Zustand), de modo que el selector de la cabecera queda disponible tras recargar. |
| CL14 | Lanzamiento tras finalizar todas las cues | No hay control de lanzamiento; solo se puede reiniciar cambiando de producción o volviendo a entrar (RF6/RF11). |
| CL15 | Cronómetro en espera con cues lanzadas y después iniciarlo y abrir un descanso | El descanso solo puede abrirse con el cronómetro arrancado (en marcha o en pausa); los lanzamientos previos se conservan y los tiempos ya registrados no se corrompen (D5/RF10/RF19). |
| CL16 | Primer lanzamiento con el cronómetro en espera | Se crea y guarda el registro de la función y se bloquea la selección de producción (D2); si el guardado falla, se revierte el lanzamiento y no se bloquea (RF12/RF17/RF18). |
| CL17 | Cronómetro nunca arrancado y última cue lanzada | La función queda finalizada, el indicador muestra "Finalizada", la producción se desbloquea y el registro queda con `endedAt` fijado, `durationMs` `0` y sin `timerStartedAt` (D6/D7/D8). |
| CL18 | Pulsar "Iniciar" después de lanzamientos previos | Arranca el cronómetro sin crear un segundo registro ni reiniciar el contador; el tiempo empieza en `00:00:00` y el registro guarda `timerStartedAt` (D1/D8/RF9). |
| CL19 | Reanudar con un descanso activo (cronómetro en pausa) | No se puede reanudar mientras el descanso esté activo; sí se pueden lanzar cues durante el descanso (D9/RF10); los lanzamientos previos se conservan. |
| CL20 | Producción con una sola cue | El primer lanzamiento es también el último: contador `1 / 1`, función finalizada e indicador "Finalizada" (RF6/D7). |
| CL21 | Fallo de guardado en un lanzamiento no primero | Se muestra el error, el contador no se incrementa, el registro conserva su último estado guardado y se puede reintentar el mismo lanzamiento sin recargar (RF13). |

---

## 4. Impacto en el modelo de datos / registro de la función

### 4.1 Momento de creación del registro (D2)

El registro de la función (`Performance` con su `runReport`) se crea en el **primer lanzamiento de cue**, aunque el cronómetro esté en espera o en pausa. Se descarta mantenerlo solo al pulsar "Iniciar" (obligaría a retener los lanzamientos en memoria y a persistirlos por otra vía, y los lanzamientos se perderían si el cronómetro nunca arranca, incumpliendo RF5). Consecuencia: `startedAt` pasa a significar "apertura del registro de la función". El botón "Iniciar" sigue existiendo: si no hay registro, lo crea y arranca el cronómetro como hoy; si ya hay registro (por un lanzamiento previo), solo arranca el cronómetro sin recrearlo ni reiniciar el contador.

### 4.2 Semántica de los tiempos (D1, D6, D8)

Decisión cerrada con **D8**: se **añade** al modelo un campo **opcional** que separa la apertura del registro del arranque del cronómetro.

- `startedAt` (existente, ahora re-semantizado) = **apertura del registro de la función**.
- `timerStartedAt` (**nuevo, opcional**, ISO 8601, dentro de `PerformanceRunReport`) = **instante del primer arranque del cronómetro**. Si está ausente, el cronómetro nunca arrancó. Es un campo opcional, por lo que los registros ya existentes siguen siendo válidos sin migración (constitución, punto 2).
- `durationMs` deja de ser estrictamente "tiempo de función cronometrado": puede ser `0` con cues ya lanzadas y `0` en una función finalizada sin cronómetro (D6).
- El tiempo de función sigue siendo tiempo real de función: al arrancar el cronómetro después de lanzar cues, la cuenta empieza en ese instante (D1). No se corrige ni se estima el tiempo de los lanzamientos previos.
- Los registros existentes no se migran: los que no tengan `timerStartedAt` se interpretan como "arranque de cronómetro no registrado" y siguen siendo legibles y válidos.

### 4.3 Incidencias rápidas y descansos (D5, D9)

- Las incidencias rápidas guardan un tiempo transcurrido (`elapsedMs`, `elapsedMinutes`) calculado desde el cronómetro; por eso siguen requiriendo el cronómetro arrancado y **no** se habilitan con el cronómetro en espera (D5). No se registran con tiempo `0`.
- Los descansos registran duración y se mantienen ligados a función en marcha o en pausa; no se abren en espera (D5).
- Durante un **descanso activo** sí se pueden lanzar cues (D9): un descanso es una pausa, por lo que aplica RF10.

### 4.4 Bloqueo de selección de producción y cierre del registro (D2, D10)

- El bloqueo de la selección de producción pasa a activarse en el primer lanzamiento (cuando se crea el registro) en lugar de al pulsar "Iniciar" (D2). Se libera al finalizar la función (RF6) o al salir del modo función (RF11).
- El bloqueo **actual** solo inhabilita el selector de producción de la cabecera (`app-shell.tsx:83-94`). El cambio de producción desde otras páginas queda **fuera de alcance** (§1.4).
- **Registro abierto y su destino (D10):**
  - **Cambio de producción:** el registro abierto (creado en esta función y sin `endedAt`) se cierra fijando `endedAt` y la duración acumulada antes de reiniciar el contexto (RF11).
  - **Salir del modo función:** el registro abierto se cierra con `endedAt` y duración acumulada (RF11).
  - **Recarga de la página:** el estado del modo función vive en memoria y no se persiste, por lo que **no** es posible cerrar de forma determinista el registro abierto; éste queda sin `endedAt` (limitación conocida, §9). El bloqueo de la selección de producción se libera porque reside solo en el estado de UI en memoria (Zustand), de modo que el selector de la cabecera queda disponible tras recargar.

### 4.5 Persistencia y compatibilidad

- El registro de la función se guarda por la vía actual de persistencia local (Dexie). **Corrección respecto a la versión anterior de esta spec:** `savePerformance` **no** aplica ninguna validación ni schema; persiste el objeto tal cual (`data-service.ts:461-463`). Hoy **no existe** un schema Zod de `Performance` (solo `departmentSchema`, `productionSchema`, `cueSchema`, `scriptLabelSchema`, `incidentSchema`).
- Como el nuevo campo `timerStartedAt` es opcional, no rompe los registros previos ni requiere migración. Si en el futuro se añade un schema de `Performance`, `timerStartedAt` deberá declararse opcional.
- El contador de funciones del panel de control (`page.tsx:77-82`) debe seguir leyendo correctamente las funciones con `durationMs` `0`.

---

## 5. Efectos en la interfaz y accesibilidad

- **Visibilidad del lanzamiento en espera y en pausa:** el bloque de cue prevenida y su botón deben ser claramente el elemento dominante de la columna de operación, con el mismo tratamiento visual que en función en curso (tipo de cue con su color, identificador grande, descripción, pie si lo hay).
- **Distinción inequívoca del estado del cronómetro:** el estado se comunica con texto ("En espera", "En curso", "En pausa", "Finalizada"), no solo con color. Con cues lanzadas, cronómetro en espera y cues pendientes debe seguir leyéndose "En espera" (RF8). Al finalizar la función sin haber arrancado el cronómetro, el indicador debe mostrar **"Finalizada"** (D7/RF6); es decir, RF6 prevalece sobre RF8 en cuanto la función queda finalizada.
- **Etiquetas de acción por tipo de cue:** el botón de lanzamiento conserva la acción según tipo (Go, TOP, Cambio, Pincha, Lanzar) tanto en su texto como en su `aria-label`, incluyendo el identificador de la cue.
- **Estado deshabilitado comprensible:** cuando el lanzamiento no esté disponible (carga, sin cues, sin producción) el botón debe estar atenuado y con motivo comprensible, nunca pulsable sin efecto. Con el cronómetro en pausa el lanzamiento ya no se atenúa.
- **Controles de incidencia y descanso (alternativa elegida en RF19):** con el cronómetro en espera se **muestran deshabilitados con motivo visible**, con el texto fijo **"Disponible al iniciar el cronómetro."** (hoy el descanso se deshabilita sin motivo visible y la incidencia rápida ni siquiera se muestra: `operation-mode.tsx:869-880` y `917-935`).
- **Conmutador tec en espera:** debe ser visible y operable también en espera (lo exige D4); hoy su bloque solo se renderiza cuando el cronómetro no está en espera (`operation-mode.tsx:1027-1078`).
- **Retroceso ←:** se mantiene como acción de pantalla **no persistida** (comportamiento actual), disponible en espera, en pausa y en curso, y no disponible tras finalizar (RF16).
- **Anuncios a lector de pantalla:** el lanzamiento realizado sin cronómetro debe anunciarse (región de estado) indicando la cue lanzada y que el cronómetro no está en marcha; los errores de lanzamiento o guardado se anuncian como alerta; el motivo de los controles deshabilitados se asocia al control (`aria-describedby` o equivalente).
- **Teclado y foco:** el lanzamiento debe ser operable con teclado (Enter/Espacio) y con las flechas en modo tec; tras lanzar, el foco debe permanecer en un punto predecible para poder encadenar lanzamientos sin mirar la pantalla. No se debe robar el foco a los campos de preparación.
- **Tamaño y contraste:** el control de lanzamiento mantiene un área táctil amplia y contraste alto sobre el tema oscuro de bajo brillo propio de cabina.
- **Progreso accesible:** el progreso de cues se mantiene como barra con valor textual ("X de N cues lanzadas").
- **Sin sorpresas de scroll:** lanzar cues en espera no debe provocar saltos de scroll ni desplazar la vista del libreto si está abierto.

---

## 6. Qué NO se debe romper (regresiones a evitar)

1. **Flujo "Iniciar función" actual:** al pulsarlo con producción y cues válidos, si aún no hay registro, se crea el registro, se bloquea la selección de producción y el cronómetro arranca desde cero.
2. **Iniciar con lanzamientos previos:** pulsar "Iniciar" tras lanzar cues no crea un segundo registro, no reinicia el contador y arranca el cronómetro desde `00:00:00`.
3. **Pausa / reanudar:** pausar fija el tiempo transcurrido, reanudar continúa desde ahí, y no se puede reanudar con un descanso activo.
4. **Descanso / "Retomamos":** apertura y cierre de descanso con su duración registrada, y reanudación del cronómetro al retomar; sigue sin poder abrirse con el cronómetro en espera.
5. **Incidencia rápida:** alta de incidencia con su tiempo transcurrido, guardado y confirmación, y el bloqueo de envíos duplicados mientras guarda; sigue requiriendo el cronómetro arrancado.
6. **Finalización de la función:** al lanzar la última cue se marca el final, se fija `endedAt` y se libera el bloqueo de selección de producción, con o sin cronómetro.
7. **Liberación del bloqueo:** al salir del modo función o al finalizar, la selección de producción vuelve a estar disponible.
8. **Progreso y contadores:** contador de lanzadas, porcentaje, cues lanzadas mostradas (las dos últimas) y las tres siguientes en cola.
9. **Modo tec:** ← retrocede y → lanza, sin activarse cuando el foco está en un campo de texto editable.
10. **Libreto:** apertura/cierre, bloqueo del scroll de fondo, navegación de páginas y página de la cue activa.
11. **Preparación a función:** avisos 30/15/5, cuenta atrás y los seis checks, con su progreso al 100 %.
12. **Persistencia y errores de guardado:** cola de guardado secuencial, mensaje de error de guardado y recuperación sin recargar.
13. **Panel de control:** el contador de funciones realizadas sigue leyéndose correctamente, incluidas las funciones con `durationMs` `0`. *(Corrección respecto a la versión anterior de esta spec: en el panel de control no hay ninguna lista de funciones, solo el contador de `page.tsx:77-82`.)*
14. **Estados no operativos:** producción sin cues, cues cargando, error de carga de cues y error de carga de producciones siguen mostrando sus mensajes.
15. **Calidad:** siguen pasando `npm run lint` y `npm run build`, sin avisos nuevos. *(Corrección respecto a la versión anterior de esta spec: la verificación actual es `npm run lint` y `npm run build`; `node --test` no existe en este proyecto.)*

---

## 7. Trazabilidad resumida

| Requisito / decisión | Cubre |
|----------------------|-------|
| RF1, RF2 | Acceso a la secuencia y progreso en espera y en pausa |
| RF3, RF9 | Independencia entre iniciar el cronómetro y lanzar (D1) |
| RF4, RF10 | Lanzamiento sin cronómetro y en pausa, incluido descanso activo (D3, D9) |
| RF5, RF17 | Registro de la función y no pérdida de lanzamientos; retroceso no persistido (D2, D8) |
| RF6 | Finalización sin cronómetro e indicador "Finalizada" (D6, D7) |
| RF7 | Idempotencia y antirrebote del lanzamiento |
| RF8 | Estado textual "En espera" con cues lanzadas y cues pendientes |
| RF11 | Cierre del registro abierto y reinicio de contexto (D10) |
| RF12 | Reversión íntegra del primer lanzamiento sin registro (padre de CL5) |
| RF13 | Fallo de guardado en lanzamientos no primeros (CL21) |
| RF14 | Estados no operativos (sin cues, carga, error de carga) |
| RF15 | Convivencia con preparación a función |
| RF16 | Modo tec, incluido el retroceso no persistido (D4) |
| RF18 | Bloqueo de la selección de producción en el primer lanzamiento (D2) |
| RF19 | Incidencias rápidas y descansos deshabilitados con motivo (D5) |
| D6, D7 | Finalización y estado "Finalizada" sin cronómetro (RF6, RF8, §5) |
| D8 | Campo opcional `timerStartedAt` (RF9, RF17, §4.2) |
| D9 | Lanzamiento durante descanso activo (RF10, RF16, §4.3) |
| D10 | Cierre del registro abierto al cambiar de producción o salir (RF11, §4.4) |

---

## 8. Decisiones tomadas

- **D1 — Cronómetro al lanzar.** Al lanzar una cue con el cronómetro parado, **el cronómetro sigue parado**; puede arrancarse después de forma independiente. El tiempo de función sigue siendo tiempo real de función (RF3, RF9).
- **D2 — Registro de la función.** El registro (`Performance` + `runReport`) **se crea en el primer lanzamiento de cue**, aunque el cronómetro esté parado, para que ningún lanzamiento se pierda. `startedAt` pasa a significar "apertura del registro". El **bloqueo de la selección de producción** se activa en ese primer lanzamiento, en lugar de al pulsar "Iniciar" (RF5, RF17, RF18).
- **D3 — Lanzar en pausa.** Lanzar funciona igual con el cronómetro **en espera y en pausa** (no solo en curso) (RF4, RF10).
- **D4 — Modo tec.** La flecha → también lanza cues **sin cronómetro** (espera y pausa), igual que el botón; la flecha ← retrocede el contador como acción de pantalla no persistida (RF16).
- **D5 — Incidencias rápidas y descansos.** Siguen **requiriendo el cronómetro arrancado** (en marcha o en pausa); con el cronómetro en espera se muestran deshabilitados con motivo visible (RF19).
- **D6 — Última cue sin cronómetro.** Al lanzar la última cue, la función **se da por finalizada** y se desbloquea la producción, aunque el cronómetro nunca se haya arrancado. La duración queda a `0` (o al tiempo acumulado si el cronómetro llegó a arrancar) (RF6).
- **D7 — Indicador al finalizar sin cronómetro.** Al finalizar la función sin haber arrancado el cronómetro, el **indicador del cronómetro muestra "Finalizada"** (RF6, §5). Prevalece sobre el "En espera" de RF8 en cuanto la función queda finalizada.
- **D8 — Campo opcional de arranque del cronómetro.** Se **añade un campo opcional** al modelo (`timerStartedAt` en `PerformanceRunReport`) para registrar por separado la **apertura del registro** (`startedAt`) y el **arranque del cronómetro** (`timerStartedAt`). Es opcional para mantener la compatibilidad con los registros ya existentes y su auditoría (constitución, punto 2) (RF9, RF17, §4.2).
- **D9 — Lanzar durante un descanso activo.** Durante un **descanso activo** sí se puede lanzar: un descanso es una pausa (RF10, RF16, §4.3).
- **D10 — Cierre del registro abierto.** Al **cambiar de producción** o **salir del modo función** con un registro abierto, éste **se cierra con hora de fin (`endedAt`)** y la duración acumulada (RF11, §4.4). La recarga queda fuera de esta garantía por no persistirse el estado del modo función (limitación conocida, §9).

### Asumidos (defaults aceptados)

- El **conmutador tec debe estar disponible en espera** (lo exige D4); hoy su bloque solo se renderiza cuando el cronómetro no está en espera (`operation-mode.tsx:1027-1078`).
- En un **descanso activo** se puede lanzar (D9).
- Ante **fallo de guardado**, se muestra el error, **no se incrementa** el contador de cues lanzadas y se permite reintentar (RF12/RF13).
- La **recarga** no puede cerrar de forma determinista un registro abierto; queda documentada como limitación conocida (§9).

---

## 9. Fuera de alcance / posibles versiones futuras

- Persistir y recuperar el estado del modo función tras recargar (incluido el contador de cues lanzadas).
- **Cerrar automáticamente los registros que quedaron abiertos tras una recarga** (limitación conocida, §4.4/CL13).
- Corregir a posteriori los tiempos de una función registrada sin cronómetro.
- Reportes/tabillas que muestren de forma explícita "función con cues lanzadas sin cronómetro" o que distingan `startedAt` de `timerStartedAt`.
- Bloquear o condicionar el cambio de producción desde páginas distintas del modo función.
- Lanzamiento de cues desde el libreto (clic directo sobre una etiqueta de cue).
- Reordenar o saltar cues durante la función.
