# Spec 002 — Modo Danza: documento estructurado, escaleta y ejecución sincronizada

- **Estado:** lista para aprobación (v3)
- **Fecha:** 2026-11-16
- **Ámbito:** Proyectos de danza (documento y escaleta), ejecución con tracks, cues cronometradas y reloj de espectáculo, plantillas de escaleta
- **Prioridad constitucional:** Fiabilidad en modo función (punto 5) y separación entre dominio y UI (punto 3); compatibilidad y auditoría del modelo de datos (punto 2)
- **Decisiones tomadas:** D1–D37 (§8). Sin preguntas abiertas (§10). Respuesta punto por punto a las revisiones QA v2 y v3 en §12.
- **Interacción con spec 001:** esta spec **no reabre** `specs/001-lanzar-cues-sin-cronometro/`. Todo lo que la 001 garantiza para proyectos estándar se conserva intacto (§6). En proyectos de danza se documentan **excepciones explícitas y acotadas**: el ensayo no persiste (D7), "Descartar función" anula un registro abierto de la sesión (D20) y la parada manual de un track en Función cierra sus cues pendientes como no alcanzados (D31). Fuera de ellas, el modo función de danza cumple la 001 (RF22, RF36, RF37).

---

## 1. Objetivo y alcance

### 1.1 Objetivo

Añadir a la aplicación un **Modo Danza** transversal, elegido al crear el proyecto, en el que:

1. El espectáculo se documenta dentro de la aplicación como una **escaleta estructurada** (tracks + cues con tiempos), editable y exportable a PDF.
2. La **escaleta cronológica se genera automáticamente** a partir de esos datos, sin teclearla dos veces.
3. El regidor/a puede **lanzar tracks** con su propio cronómetro, disponer de un **reloj de espectáculo** independiente y recibir **cuentas atrás por cue** con código de colores y aviso "¡Lanzar!" cuando el objetivo se alcanza.
4. La ejecución distingue **ensayo** y **función**, con secuencia temporal estricta en función, **dos vías de finalización**, descarte de una función abierta por error y un **informe de desviaciones** de la función.
5. Los tiempos reales y las desviaciones se miden **siempre** contra el **tiempo activo** del reloj de espectáculo y del track, aunque el cronómetro de función no esté en marcha; las pausas no desplazan objetivos ni cuentan como retraso.
6. La estructura de una escaleta se puede **guardar como plantilla reutilizable**, versionada, duplicable y compartible en JSON, sin acoplarse a los proyectos ya creados.

### 1.2 Por qué

Hoy toda la aplicación asume un espectáculo con libreto PDF: los cues nacen de etiquetas sobre el PDF y el modo función es una secuencia estrictamente lineal de cues con un único cronómetro global. Un espectáculo de danza no tiene libreto de texto ni una secuencia de "go" por cue: tiene **música y tramos cronometrados**, con cues que caen en un punto exacto de un track (la luz de un canon, un cambio de escena a los 1:30 de un tema de 2:00). Con el modelo actual eso obliga a llevar la escaleta en papel, a cronometrar a mano y a reconstruir después las desviaciones de oído.

Resolverlo añadiendo cues con tiempo y tracks con duración convierte la aplicación en herramienta de cabina real para danza **sin tocar el flujo de teatro**, que sigue funcionando exactamente igual.

### 1.3 Alcance incluido

- **Selector de modo al crear proyecto**: "Estándar (PDF)" o "Danza (documento + escaleta)", con persistencia del modo y condicionamiento de la interfaz.
- **Documento estructurado (escaleta)** del proyecto de danza: tracks, cues, tiempos, notas, bloques/escenas; vista en la aplicación y **exportación a PDF por impresión del navegador**.
- **Generación automática de la escaleta cronológica** a partir de los tiempos declarados, con orden determinista y totales.
- **Tracks** con duración, orden, inicio explícito opcional y notas, con **cronómetro propio** basado en marcas de tiempo absolutas (sin reproducción de audio) y ciclo de vida cerrado de cuatro estados (Pendiente, En marcha, Pausado, Terminado), donde "detener" es una transición manual a Terminado que distingue el fin natural por duración.
- **Tiempo por cue**: vínculo a un track con tiempo objetivo dentro del track (admitido desde `0` hasta la duración, incluido el final exacto del track), o tiempo absoluto desde el inicio del espectáculo.
- **Reloj de espectáculo** independiente, que arranca con el primer track o con un botón y sirve de referencia para todos los tiempos y desviaciones; su valor es **tiempo activo** (se pausa con la función o el descanso y se reanuda sin recuperar el tiempo perdido).
- **Cuenta atrás sincronizada** por cue vinculada, con umbral configurable, **paleta de bandas cerrada y accesible** y aviso **"¡Lanzar!"** persistente.
- **Secuencia temporal en función**: solo se puede lanzar la siguiente cue pendiente de la escaleta; el aviso "¡Lanzar!" corresponde siempre a esa cue.
- **Feedback al lanzar**: confirmación visual inequívoca y confirmación sonora opcional.
- **Modo de ejecución ensayo vs función** (distinto del **modo del proyecto**, estándar o danza): badge permanente, cambio protegido por confirmación, navegación libre en ensayo, navegación restringida en función, **registro de desviaciones** e **informe post-función**, con datos separados.
- **Dos vías de finalización**: lanzar la última cue (como la 001) y un botón **"Finalizar función"**, disponible solo con un **registro abierto** (aunque no haya lanzamientos), que cierra con cues pendientes marcándolos como **"no alcanzados"**.
- **"Descartar función"**: anula el registro abierto de la **sesión actual** si se lanzó por error en modo función. No actúa sobre registros abiertos de sesiones anteriores.
- **Parada manual de track con pendientes**: en Función, detener un track cierra sus cues pendientes como **"no alcanzados"** y avanza la secuencia; en Ensayo quedan pendientes y se pueden relanzar.
- **Plantillas de escaleta globales**: crear desde la escaleta actual (completa, o parcial con tracks completos y cues sueltos sin track), aplicar al crear un proyecto, duplicar, editar con versionado simple, eliminar, **exportar/importar JSON**, con aislamiento total respecto a proyectos y disponibles en cualquier modo.
- **Notas por cue durante la ejecución**, reutilizando los campos existentes de cue.
- **Accesibilidad configurable**: tamaño de fuente y alto contraste, persistidos y aplicados a la ejecución y al documento; teclado y anuncios para lector de pantalla.
- **Exportación JSON de la escaleta** de un proyecto.
- **Persistencia local de todo lo anterior** y **compatibilidad total con proyectos estándar ya existentes**, incluida la ruta de validación y guardado de los campos nuevos.

### 1.4 Fuera de alcance (fase 1)

Se documenta aquí y **no se implementa** en esta fase (§9):

- Reproducción de audio de los tracks (los tracks son lógicos, con cronómetro).
- Multi-track simultáneo (varios cronómetros de track a la vez).
- Editor de texto enriquecido o un segundo libreto de texto; el libreto PDF de danza sigue siendo el PDF subido, si existe.
- Biblioteca de plantillas con búsqueda, etiquetas y filtros.
- Historial completo de versiones de plantilla con restauración.
- **Aplicar una plantilla a un proyecto ya creado** (en fase 1 solo al crear el proyecto) y **importar un JSON como proyecto nuevo** (solo como plantilla).
- PWA/offline real con Service Worker y sincronización remota.
- Pruebas automatizadas (la verificación sigue siendo `npm run lint`, `npm run build` y guion manual).
- Cambiar el modo de un proyecto ya creado.
- Persistir el estado de la ejecución entre recargas (incluido el reloj de espectáculo y los tracks en marcha).
- **Recuperar o cerrar registros abiertos de sesiones anteriores** tras una recarga: se listan como "registro de una sesión anterior" y quedan como limitación conocida heredada de la 001 (§3 CL36, RF36, RF37).
- **Colores libres o personalizados por hexadecimal** en las bandas de cuenta atrás: la paleta es cerrada (§4.6).
- Historial de ensayos o desviaciones sobre ensayos.
- Exportación a PDF de documentos distintos del documento/escaleta y del informe de desviaciones.

### 1.5 Qué se reutiliza y qué no se duplica

| Necesidad | Se reutiliza | No se crea |
|---|---|---|
| Cue de danza (tipo, color, identificador, departamento, descripción, pie, observaciones, estado) | Entidad `Cue` + campos opcionales de tiempo/vínculo | **No** hay `DanceCue` paralela: duplicaría tipos, colores y numeración |
| Bloques y escenas | Campos existentes `Cue.act` y `Cue.scene` | No se crea entidad "bloque"; `Production.scenes` sigue sin usarse |
| Cronómetro | Mismo patrón de marcas absolutas + `elapsedBeforeRun` ya usado en modo función | No se introduce otro motor de tiempo ni `setInterval` acumulativo |
| Modo ensayo/función | `Performance` + `PerformanceRunReport` con un campo `mode` y eventos por cue y por track | No se crea una tabla de "ensayos" separada |
| Notas en ejecución | `Cue.observations` y `Cue.pie` | No se crea un sistema de anotaciones nuevo |
| Ejecución | Vista de `/modo-funcion` con paneles adicionales si el proyecto es de danza | **No** se crea `/modo-danza` |
| PDF | Vista imprimible + impresión del navegador ("Guardar como PDF") | No se añade librería de PDF |
| Escaleta | Derivada de `DanceTrack` + `Cue` (función de dominio pura) | No se persiste una copia de la escaleta que pueda desincronizarse |
| Preferencias | Una tabla de ajustes local validada | No se guardan preferencias dentro de `Production` |

### 1.6 Superficies y navegación

Cada función de danza vive en una superficie concreta. Las superficies de **proyecto** dependen del modo del proyecto seleccionado; las de **aplicación** existen siempre (RF41).

| Superficie | Ruta | Qué contiene | Condición de acceso |
|---|---|---|---|
| Alta y ficha de proyecto | `/proyectos` | Selector de modo, PDF opcional en danza, elección de plantilla inicial, etiqueta de modo en la ficha | Siempre; el selector de modo solo al crear |
| Documento / escaleta | `/documento` | Tracks, cues cronológicos y "Sin tiempo"; **ruta independiente de edición**, editable sin ejecución activa y en Ensayo, de solo lectura en Función (solo notas, RF31) | Solo con proyecto de danza seleccionado; en estándar, mensaje explicativo y enlace a `/libretos` |
| Vista imprimible del documento | `/documento/imprimir` | Documento sin navegación ni controles, siempre claro | Solo con proyecto de danza; mismo contenido que `/documento` |
| Plantillas de escaleta | `/plantillas` | Biblioteca, editor de plantilla, duplicar, eliminar, exportar e importar JSON | **Superficie de aplicación**, sin proyecto asociado; enlace de navegación visible en cualquier modo; en un proyecto estándar no se ofrece aplicar al proyecto ni crear proyecto desde plantilla |
| Ajustes de danza | `/ajustes` | Bandas de color, tamaño de fuente, alto contraste, sonido, umbral por defecto | Siempre (preferencia local de la aplicación) |
| Ejecución | `/modo-funcion` | Badge ENSAYO/FUNCIÓN, control de cambio de modo, tracks, cuentas atrás, escaleta viva, notas, finalizar y descartar | Siempre que haya proyecto; los paneles de danza solo con proyecto de danza |
| Vista imprimible del informe | `/reportes/imprimir` | Informe de desviaciones con el mismo estilo de impresión que el documento | Solo para una función de danza elegida |
| Cues con tiempo | `/cues` | Editor de cue con la sección de tiempo (vínculo, objetivo, umbral) | Solo muestra la sección de tiempo en proyectos de danza |
| Libreto PDF | `/libretos` | PDF opcional del proyecto de danza | Solo si el proyecto tiene PDF |
| Reportes | `/reportes` | Lista de funciones en modo función de proyectos de danza y acceso a su informe | Siempre; la lista de danza solo aparece si hay funciones de danza |
| Incidencias | `/incidencias` | Sin cambios | Siempre |

Reglas de navegación:

- **RF3b queda resuelto así:** las plantillas son una superficie de **aplicación**, no de proyecto. La entrada `/plantillas` se muestra siempre en la navegación (también en proyectos estándar) y la biblioteca es global; lo que un proyecto estándar **no** ofrece son los controles de danza del proyecto: aplicar una plantilla al proyecto ni crear un proyecto desde plantilla. La ficha de un proyecto estándar no muestra plantillas.
- La **pestaña interna "Documento"** de `/modo-funcion` es una vista de consulta dentro de la ejecución: cambiar a ella y volver conserva la sesión y los cronómetros. **Salir de la vista de ejecución** significa abandonar `/modo-funcion`. La ruta `/documento` es independiente y sirve para editar la escaleta (RF11).
- **Edición en `/documento`:** es editable cuando **no hay una ejecución activa**; durante Ensayo sigue siendo editable; durante Función es de **solo lectura**, salvo notas y observaciones (RF31).
- En un proyecto estándar **no** aparecen en la navegación `/documento`, `/documento/imprimir` ni los controles de danza de `/modo-funcion`; si se accede por URL directa a `/documento` con un proyecto estándar, se muestra el mensaje "Este proyecto es estándar y no tiene documento de escaleta." y un enlace a `/libretos`.
- `/plantillas` y `/ajustes` no dependen del proyecto seleccionado y nunca modifican proyectos.
- El PDF nunca es imprescindible en danza: `/libretos` puede estar vacío sin afectar al resto.

### 1.7 Terminología

Para evitar lecturas cruzadas, esta spec usa dos "modos" con nombres distintos y nunca los mezcla:

| Término | Valores | Dónde vive | Qué significa |
|---|---|---|---|
| **Modo del proyecto** | `standard` \| `dance` | `Production.mode`, fijado al crear | Determina si el proyecto tiene documento, tracks y funciones de danza. No se cambia después. |
| **Modo de ejecución** | `rehearsal` \| `show` | Sesión de `/modo-funcion`, **no persistido** en fase 1 | Determina las reglas de la ejecución: Ensayo (libre, sin registro) o Función (secuencia única y registro). |

- **Estados del track:** solo `Pendiente | En marcha | Pausado | Terminado`. No existe "detenido" como estado aparte: **detener** es la transición manual a `Terminado` con `endedBy: "manual"`; el fin por duración es `Terminado` con `endedBy: "duration"`. Un `Terminado` no se reanuda en Función; en Ensayo se puede **Reiniciar** (vuelve a `Pendiente` con tiempo `0`).
- **Tiempo activo:** tiempo transcurrido **sin pausas**. Es la referencia de los objetivos, instantes reales y desviaciones, tanto del track como del reloj de espectáculo. Una pausa no avanza el tiempo activo ni desplaza los objetivos.
- **Registro abierto:** cualquier `runReport` **sin `endedAt`**, con **cero o más** lanzamientos. Lo crea el arranque del cronómetro de función o el primer lanzamiento, y bloquea la producción igual que en la 001. "Finalizar" y "Descartar" solo actúan sobre el registro abierto de la sesión actual.
- **Siguiente (candidata) vs lanzable:** la **siguiente** es la única cue pendiente según el orden temporal (RF38); **lanzable** es la siguiente cuando su referencia está disponible (track En marcha o Terminado por duración con referencia válida, o reloj de espectáculo en marcha para `atMs`). Una siguiente puede estar visible pero no lanzable, con motivo.
- **Orden natural de identificadores:** se compara el **valor numérico** del tramo numérico final (así `LX-2.5` va antes que `LX-2.10`, porque `2,5 < 2,10` en valor); a igual valor numérico, se compara el **texto** completo y, si persiste el empate, el `id`.

---

## 2. Requisitos funcionales (EARS)

### A. Modo del proyecto

**RF1** — Cuando el usuario inicie la creación de un proyecto, el sistema deberá ofrecer una elección explícita y obligatoria entre dos modos, con la etiqueta y la descripción indicadas, y no deberá crear el proyecto sin un modo elegido.

- Etiquetas: **"Estándar (PDF)"** y **"Danza (documento + escaleta)"**.
- Descripción de "Estándar (PDF)": el espectáculo se prepara a partir de su libreto PDF. Descripción de "Danza (documento + escaleta)": el espectáculo se documenta dentro de la aplicación y genera su propia escaleta.
- *Criterio de aceptación:* en el formulario de alta aparecen las dos opciones como control seleccionable accesible (grupo con nombre, no solo color); "Estándar (PDF)" viene preseleccionado; se puede crear un proyecto con cualquiera de las dos; el proyecto creado muestra su modo en la ficha y en la cabecera de la vista de ejecución.

**RF2** — Cuando el modo elegido sea "Danza", el sistema deberá permitir crear el proyecto **sin PDF**, y cuando el modo sea "Estándar" deberá seguir exigiendo el PDF como hasta ahora.

- *Criterio de aceptación:*
  - (a) en Danza se puede crear el proyecto con solo el nombre de la obra, sin seleccionar archivo, y queda operativo (documento, tracks y cues disponibles);
  - (b) en Danza se puede añadir o reemplazar el PDF más tarde y el documento estructurado funciona igual con o sin PDF;
  - (c) en Estándar el botón de creación sigue deshabilitado sin PDF y se mantiene el mensaje "Selecciona el PDF de la obra para crear el proyecto.".

**RF3** — Cuando se guarde un proyecto, el sistema deberá **conservar su modo a través de la validación y del guardado** y deberá aplicar la interfaz y las funcionalidades de danza **solo** a proyectos de danza; un proyecto sin modo almacenado se considerará estándar.

- El modo se fija al crear el proyecto y **no existe ningún control para cambiarlo** después; no hay "intento de cambio" que la interfaz deba gestionar.
- *Criterio de aceptación:*
  - (a) tras recargar la aplicación, un proyecto creado en Danza sigue en Danza y muestra sus tracks y su documento; un proyecto creado antes de esta funcionalidad se muestra como estándar y no gana ningún control de danza;
  - (b) en un proyecto estándar no aparecen selector de tracks, cuentas atrás, vínculos cue↔track, aplicación de plantillas al proyecto, creación de proyecto desde plantilla, badge de ensayo/función ni exportación de escaleta, y las rutas de danza de proyecto no se ofrecen en la navegación (§1.6, RF41); la biblioteca global `/plantillas` sí sigue accesible por URL y en la navegación (RF41c);
  - (c) el modo sobrevive a un guardado completo del proyecto y a una recarga: `saveProduction` y `createProductionWithPdf` persisten `Production.mode` sin recortarlo (RF40);
  - (d) la ficha del proyecto y la cabecera de la ejecución muestran el modo como texto ("Estándar" / "Danza").

### B. Documento y escaleta

**RF4** — Cuando el proyecto sea de danza, el sistema deberá mostrar un **documento estructurado** con la escaleta generada automáticamente a partir de los tracks y los cues, sin exigir que el usuario la escriba aparte.

- Forma del documento, en este orden:
  1. **Tracks**: fila por track en orden manual, con título, duración, inicio calculado, fin calculado y notas.
  2. **Cues**: fila por cue en orden cronológico, con identificador, tipo, descripción, tiempo absoluto, track, objetivo dentro del track, pie y observaciones; los actos y escenas existentes agrupan visualmente el listado, sin crear una entidad nueva.
  3. **Sin tiempo**: cues sin tiempo ni vínculo, al final, en orden de identificador.
  4. Totales en cabecera: número de tracks, número de cues y duración total.
- *Criterio de aceptación:*
  - (a) al añadir o modificar un track o el tiempo de un cue, el documento refleja el cambio sin ninguna acción de "regenerar";
  - (b) no existe ningún campo editable de "texto de escaleta";
  - (c) si no hay datos, se muestra un estado vacío explicativo ("Este proyecto aún no tiene tracks ni cues.");
  - (d) los cues sin tiempo aparecen siempre en la sección "Sin tiempo", nunca intercalados entre los cronológicos.

**RF5** — El sistema deberá permitir crear, renombrar, reordenar, editar la duración, fijar o limpiar el **inicio explícito** y anotar los tracks de un proyecto de danza, y deberá validar la duración y el inicio antes de guardarlos.

- Formato de entrada de duración: `mm:ss` (se admite `h:mm:ss` en espectáculos de más de una hora). Se almacena como milisegundos.
- `startAtMs` (campo "Inicio"): vacío = inicio derivado; si se rellena, es un instante absoluto desde `00:00` del espectáculo. Validación: entero `≥ 0` y `≤ 24:00:00`.
- *Criterio de aceptación:*
  - (a) se puede crear un track con título y duración, cambiar su orden, fijar y limpiar su inicio, y ver el resultado reflejado en el documento;
  - (b) una duración vacía, cero, negativa o mal formada (`1:75`, `abc`) se rechaza con mensaje en español y no se guarda;
  - (c) un inicio negativo o mal formado se rechaza; un inicio anterior al fin del track anterior **no** se rechaza, se guarda y se muestra el aviso de solape de RF7;
  - (d) el track guardado conserva su duración y su inicio tras recargar.

**RF6** — El sistema deberá permitir asignar a cada cue un tiempo dentro del espectáculo, bien **vinculándolo a un track con un tiempo objetivo dentro del track**, bien indicando un **tiempo absoluto** desde el inicio del espectáculo.

- Regla de coherencia: si el cue tiene vínculo a un track, su tiempo absoluto **se deriva** del inicio calculado del track más el objetivo y se muestra como calculado (no editable directamente); para cambiarlo se edita el objetivo o se quita el vínculo. Si el cue no tiene vínculo, el tiempo absoluto es editable.
- El tiempo objetivo debe cumplir `0 ≤ objetivo ≤ duración del track`. El valor exactamente igual a la duración es válido y representa el **final del track** (RF9, RF13).
- *Criterio de aceptación:*
  - (a) desde la página de cues y desde el documento se puede asignar track y objetivo a un cue, y el tiempo absoluto aparece calculado;
  - (b) un objetivo fuera del rango del track impide guardar y explica el rango válido;
  - (c) quitar el vínculo convierte el tiempo en absoluto editable, conservando el último valor calculado (RF30d, RF35);
  - (d) el tiempo asignado sobrevive a la recarga y se refleja en el documento y en la escaleta impresa;
  - (e) editar solo las notas u observaciones de ese cue **no borra su tiempo** (RF31, RF40).

**RF7** — El sistema deberá ordenar la escaleta de forma determinista, calcular los inicios de cada track y calcular la duración total sin intervención manual.

- **Orden de tracks:** por `order` ascendente; a igual `order`, el que tenga `startAtMs` (menor primero); a igualdad, por `id`. Órdenes duplicados se permiten con aviso (CL6).
- **Cadena de inicios:** con los tracks ya ordenados, sea `finConocido = 0`:
  1. `inicio(i) = startAtMs` si está definido; si no, `inicio(i) = finConocido`.
  2. `fin(i) = inicio(i) + durationMs` si el track tiene duración válida; si no tiene duración, `fin(i)` no existe y **no** se modifica `finConocido`.
  3. Si `fin(i)` existe, `finConocido = max(finConocido, fin(i))`.
  4. Un track con `startAtMs` anterior a `finConocido` se coloca en su inicio explícito y se marca **"Solapa con el track anterior"**; no se autocorrige.
- **Orden de cues:** por tiempo absoluto ascendente (derivado o `atMs`); a igual tiempo, por **identificador con comparación numérica natural** (prefijo y valor: `LX-2` antes que `LX-10`, no orden lexicográfico; con decimales se compara el valor numérico, de modo que `LX-2.5` va antes que `LX-2.10`); a igual valor numérico, por texto y luego `id`. Los cues sin tiempo van al final, en orden de identificador natural y luego `id`.
- **Duración total:** `max(fin de todos los tracks con duración, mayor tiempo absoluto de cue)`. "Último track" a efectos de duración es el de mayor **fin**, no el último en orden manual.
- *Criterio de aceptación:*
  - (a) con dos tracks de `2:00` y `3:00` y un cue en el track 1 a `1:30`, la escaleta muestra el track 1 en `00:00`, el track 2 en `02:00`, el cue en `01:30` y una duración total de `05:00`;
  - (b) reordenar los tracks recalcula los inicios y el total;
  - (c) un track con inicio explícito `01:00` detrás de uno que termina en `02:00` se muestra en `01:00` con aviso de solape y sin corrección automática;
  - (d) un track sin duración entre dos tracks no avanza la cadena: el siguiente sin inicio explícito empieza en el último fin conocido y el track incompleto se muestra como "Sin duración";
  - (e) con cues `LX-2` y `LX-10` al mismo tiempo, se listan `LX-2` y después `LX-10`; con `LX-2.5` y `LX-2.10`, se listan `LX-2.5` y después `LX-2.10` (valor numérico, no texto);
  - (f) la duración total no depende del orden manual si un track posterior termina antes.

**RF8** — Cuando el usuario solicite imprimir o exportar el documento a PDF, el sistema deberá mostrar una **vista imprimible** y delegar en la impresión del navegador, sin añadir librerías de PDF.

- Contenido de la vista imprimible: título, sala, fecha de impresión, escaleta con tracks y cues, totales y notas. Sin navegación, sin botones, sin fondos oscuros.
- **Formato de tiempos:** `mm:ss` hasta `59:59` y `h:mm:ss` a partir de una hora. En pantalla y en impresión, los tiempos absolutos, transcurridos y restantes se redondean al **segundo más próximo** (medio segundo hacia arriba). Las desviaciones y los instantes reales del informe se expresan en décimas de segundo (RF24). Una misma columna no mezcla precisiones.
- *Criterio de aceptación:*
  - (a) la vista imprimible se ve con fondo blanco y texto negro aunque el tema de la aplicación sea oscuro;
  - (b) no aparece ningún elemento de interfaz (cabecera de la app, botones, selectores) en la impresión ni en el PDF resultante;
  - (c) las filas de tracks y cues no se cortan entre páginas y la cabecera de tabla se repite en cada página;
  - (d) el tipo de cada cue se identifica con su texto además de su color, de modo que se entienda en blanco y negro;
  - (e) los tiempos impresos coinciden exactamente con los mostrados en la aplicación, con el mismo formato y redondeo.

### C. Tracks y cronómetro

**RF9** — El sistema deberá permitir **lanzar manualmente** un track, poniendo en marcha su cronómetro propio, y deberá mostrar su **tiempo activo** transcurrido y el restante, con un ciclo de vida explícito y una única forma de terminar.

- Estados de un track en la sesión: **Pendiente** (no iniciado en esta sesión), **En marcha**, **Pausado** y **Terminado**. No existe "detenido" como estado distinto (§1.7). El campo `endedBy: "duration" | "manual"` distingue el fin natural de la parada manual.
- Operaciones: iniciar, pausar, reanudar y **detener** (acción manual con confirmación si quedan cues pendientes de ese track). El cronómetro se calcula con marcas de tiempo absolutas; el repintado periódico solo visualiza el tiempo, nunca lo acumula.
- **Tiempo activo:** el cronómetro del track acumula solo tiempo sin pausas. Los objetivos, instantes reales y desviaciones de sus cues se miden en ese tiempo activo (RF13, RF23).
- **Fin natural por duración:** al llegar a la duración, el track pasa a **Terminado** con `endedBy: "duration"`, el restante queda en `00:00` (nunca negativo), el transcurrido se fija en la duración y se cierra su `TrackRun`. Si la **siguiente** cue pendiente tiene como objetivo exactamente la duración, su control de lanzamiento **sigue habilitado indefinidamente** con la referencia del final del track (instante real = duración), mostrando `0` y "¡Lanzar!" hasta que se lance o la función se detenga/finalice.
- **Parada manual:** detener un track lo lleva a **Terminado** con `endedBy: "manual"` y cierra su `TrackRun` con el tiempo activo acumulado. En **Función**, sus cues pendientes quedan **"no alcanzados"** y la secuencia avanza a la siguiente cue (de otro track o con `atMs`). En **Ensayo** no se marcan no alcanzados: quedan pendientes y se puede reiniciar el track o relanzarlos.
- Solo puede haber **un track en marcha** a la vez. Al iniciar un track mientras otro está En marcha o Pausado se aplica al anterior la misma regla que la parada manual (confirmación, cierre de `TrackRun`, y en Función sus pendientes como no alcanzados) antes de iniciar el nuevo.
- *Criterio de aceptación:*
  - (a) al iniciar un track de `2:00` se ve el transcurrido creciente y el restante decreciente hasta `00:00`, y al llegar se marca "Terminado" con `endedBy: "duration"` y sin restante negativo;
  - (b) pausar congela ambos valores en **tiempo activo** y reanudar continúa desde ese tiempo; el tiempo perdido por la pausa no se recupera ni desplaza los objetivos de sus cues;
  - (c) el cronómetro del track es independiente del cronómetro de función y del reloj de espectáculo: iniciar uno no arranca, pausa ni finaliza los otros, salvo que el inicio del primer track arranque el reloj de espectáculo si aún no estaba en marcha (RF39);
  - (d) un track Terminado no ofrece reanudar; en Ensayo ofrece reiniciar (vuelta a `Pendiente` con tiempo `0`) y en Función no (RF22);
  - (e) detener manualmente un track con pendientes pide confirmación; al confirmar, el track queda Terminado con `endedBy: "manual"` y, en Función, sus pendientes pasan a "no alcanzado" y la siguiente cue pasa a ser de otro track o con `atMs`;
  - (f) en Ensayo, detener un track con pendientes no los marca como no alcanzados: quedan pendientes y se pueden relanzar al reiniciar el track;
  - (g) si la siguiente cue tiene objetivo igual a la duración, al llegar el track a `00:00` su control sigue activo indefinidamente con `0` y "¡Lanzar!" hasta que se lance o la función termine.

**RF10** — Mientras un track no tenga una duración válida, el sistema deberá permitir guardarlo como borrador pero **no** deberá iniciar su cronómetro, e indicará el motivo.

- *Criterio de aceptación:* un track sin duración se ve en el documento marcado como "Sin duración"; su control de inicio está deshabilitado y asociado de forma accesible al motivo "Añade una duración para lanzar este track."; los cues vinculados a él siguen visibles pero no generan cuenta atrás.

**RF11** — El sistema deberá permitir navegar el documento durante la ejecución sin detener los cronómetros y deberá permitir o bloquear la edición según el **modo de ejecución** y la superficie.

- **Navegación durante la ejecución:** abrir la **pestaña interna "Documento"** de `/modo-funcion` (junto a Ejecución e Informe) —no otra pestaña del navegador— consultar la escaleta y volver no reinicia ni desfasa ningún cronómetro. La pestaña interna mantiene la sesión; **salir de la vista de ejecución** es abandonar `/modo-funcion`.
- **Ruta `/documento`:** es una superficie independiente de edición de la escaleta. Es **editable** cuando **no hay una ejecución activa**; durante **Ensayo** sigue siendo editable; durante **Función** es de **solo lectura** (solo notas y observaciones, RF31).
- **Edición en Ensayo:** se puede editar todo (cues, tiempos, tracks, orden) sin detener cronómetros; la escaleta viva, los totales y las cuentas atrás se recalculan al guardar.
- **Edición en Función:** la estructura y los tiempos están **bloqueados**: crear, borrar, reordenar tracks o cues y editar tiempos o vínculos no está disponible, con el motivo "En función la escaleta no se edita. Cambia a Ensayo." Solo se pueden editar notas y observaciones (RF31), que no alteran secuencia, total ni contador.
- *Criterio de aceptación:*
  - (a) con un track en marcha, cambiar a la pestaña interna "Documento" y volver no reinicia ni desfasa el cronómetro;
  - (b) el estado del track (Pendiente, En marcha, Pausado, Terminado) se lee en la escaleta viva;
  - (c) en Ensayo, editar el tiempo de un cue pendiente actualiza su cuenta atrás sin detener el track;
  - (d) en Función, los controles de estructura y tiempo de `/documento` y de la pestaña interna aparecen deshabilitados con su motivo, y guardar una nota no cambia la secuencia ni el total;
  - (e) sin ejecución activa, `/documento` permite editar tracks y cues; fuera de la ejecución no hay pestaña interna que conservar;
  - (f) abrir la pestaña interna "Documento" no equivale a navegar a `/documento`: la ruta es edición y la pestaña es consulta dentro de la sesión.

### D. Vínculo cue↔track, cuenta atrás y colores

**RF12** — Cuando un cue tenga un objetivo temporal, el sistema deberá poder calcular su instante objetivo exacto con la referencia temporal que corresponda, medida en **tiempo activo**.

- **Cue vinculado:** `objetivo = inicio real del track en esta ejecución + trackOffsetMs`, evaluado sobre el **tiempo activo** del track. Una pausa del track no avanza el objetivo ni genera retraso.
- **Cue sin vínculo con `atMs`:** `objetivo = showStartedAt + atMs`, evaluado sobre el **tiempo activo** del reloj de espectáculo (el reloj se pausa con la función o el descanso y se reanuda al reanudar).
- El cálculo se rehace con el inicio real de cada ejecución y con el tiempo activo acumulado, nunca con el inicio calculado en la escaleta ni con tiempo de pared.
- *Criterio de aceptación:*
  - (a) con el track iniciado a las `12:00:00.000`, sin pausas, y un objetivo de `1:30`, el instante objetivo es `12:01:30.000`;
  - (b) con el track pausado 20 s y reanudado, el objetivo de `1:30` se alcanza a las `12:01:50` de tiempo de pared pero a los `1:30` de tiempo activo; la desviación sigue siendo `0` si se lanza en ese instante activo;
  - (c) con el reloj de espectáculo iniciado a las `19:59:00.000`, sin pausas, y un cue a `00:30`, el instante objetivo es `19:59:30.000`;
  - (d) si el reloj de espectáculo no se ha iniciado, un cue con `atMs` no tiene objetivo calculable y se trata según RF23 (sin referencia) y RF13 (sin cuenta atrás).

**RF13** — Cuando un cue tenga objetivo temporal y su referencia esté en marcha (el track vinculado o el reloj de espectáculo), y el cue no se haya lanzado, el sistema deberá mostrar la cuenta atrás del cue a partir del umbral configurado en ese cue y hasta `0`.

- Umbral por defecto: **10 segundos** antes del objetivo. Configurable por cue en el rango `1–60` segundos.
- Con el track **Pausado** la cuenta atrás se **oculta** y no se promete ninguna cifra congelada en pantalla; al reanudar se recalcula con el tiempo activo restante.
- Con el track **Terminado por duración** (`endedBy: "duration"`), si la siguiente cue pendiente tiene objetivo igual a la duración, se muestra `0` y su "¡Lanzar!" de forma **indefinida** (la referencia es el final del track). El resto de cues pendientes de ese track no generan cuenta atrás.
- Con el track **Terminado manualmente** (`endedBy: "manual"`) antes del objetivo no hay cuenta atrás ni "¡Lanzar!"; en Función sus pendientes ya quedaron "no alcanzados" (RF9).
- **Cue sin vínculo con `atMs`:** la cuenta atrás se calcula contra el **tiempo activo** del reloj de espectáculo. Si el reloj no está en marcha, no hay cuenta atrás; al arrancarlo se recalcula. Al alcanzar o superar el objetivo con el reloj en marcha se aplica la misma regla de "¡Lanzar!".
- **Objetivo alcanzado o superado:** si la referencia está en marcha (o el track terminó por duración con la referencia del final), el cue sigue pendiente y el tiempo ya alcanzó o superó el objetivo, **no** se muestra una cuenta atrás negativa: se muestra el aviso "¡Lanzar!" de RF15.
- *Criterio de aceptación:*
  - (a) con un track de `2:00` y un cue a `1:30`, la cuenta atrás no se ve a `1:05` y empieza a verse en `1:20`, mostrando `10`, `9`, `8`… `0`;
  - (b) con umbral de 5 s, empieza a verse en `1:25` y muestra `5`, `4`, `3`, `2`, `1`, `0`;
  - (c) pausar el track oculta la cuenta atrás; reanudar la recalcula con el tiempo activo restante y, si ya se pasó del objetivo, se muestra "¡Lanzar!" y nunca una cifra negativa;
  - (d) lanzar el cue hace desaparecer su cuenta atrás de inmediato;
  - (e) a `0` se muestran **ambos**: la cifra `0` y el aviso "¡Lanzar!";
  - (f) con el reloj de espectáculo iniciado a las `19:59:00`, un cue a `00:30` y umbral 10 s, la cuenta atrás empieza a las `19:59:20` y a las `19:59:30` se ve `0` y "¡Lanzar!"; sin reloj en marcha no se ve cuenta atrás; pausar la función detiene el reloj y la cuenta atrás se recalcula al reanudar;
  - (g) con un track de `2:00` y la siguiente cue a `2:00`, al llegar el track a `00:00` se ve `0` y "¡Lanzar!" y el control sigue habilitado indefinidamente hasta lanzar o finalizar/detener la función;
  - (h) si el track se detiene manualmente antes del objetivo, no hay cuenta atrás ni "¡Lanzar!" y, en Función, el cue figura como "no alcanzado".

**RF14** — El sistema deberá colorear cada segundo de cuenta atrás según la **paleta cerrada de bandas** configurada, cuyo valor por defecto es: segundos 10 a 4 en **rojo**, segundos 3 y 2 en **naranja**, segundos 1 y 0 en **verde**.

- **Modelo de banda:** `CountdownBand { minSeconds: number; maxSeconds: number; color: "red" | "orange" | "green" | "blue" | "yellow" }`, con `minSeconds ≤ maxSeconds` y enteros `≥ 0`.
- **Valores por defecto:** rojo `{4,10}`, naranja `{2,3}`, verde `{0,1}`.
- La paleta es **cerrada y accesible**: solo `red`, `orange`, `green`, `blue` y `yellow`, con clases predefinidas que cumplen contraste **AA (≥ 4,5:1)** sobre el fondo oscuro de la cifra. **No se admiten colores hexadecimales libres.**
- **Validación:** las bandas deben cubrir de forma **contigua desde `0` hasta el umbral máximo** (por defecto 10), sin huecos ni solapes; la banda que contiene `0` debe tener `minSeconds = 0`; para un umbral menor que 10, las bandas se **recortan** a `[0, umbral]` (por ejemplo, umbral 5: rojo `4–5`, naranja `2–3`, verde `0–1`).
- Fuera de las bandas definidas (más segundos que el máximo de banda) la cuenta atrás se muestra en color neutro.
- Cada banda lleva **etiqueta textual** obligatoria ("Rojo", "Naranja", "Verde", "Azul", "Amarillo"), que se muestra junto al número; el color nunca es la única información.
- *Criterio de aceptación:*
  - (a) en la secuencia por defecto se ven exactamente siete segundos rojos (`10,9,8,7,6,5,4`), dos naranjas (`3,2`) y dos verdes (`1,0`), con sus etiquetas textuales y contraste AA;
  - (b) una configuración inválida (por ejemplo verde de 2 a 0 y naranja de 3 a 2, que deja el 2 duplicado) se rechaza con mensaje y no se guarda;
  - (c) la configuración guardada se aplica a las cuentas atrás de todos los proyectos de danza y persiste tras recargar;
  - (d) el color nunca es la única información: cada segundo se muestra también como número y cada banda tiene su etiqueta textual accesible;
  - (e) con umbral de 30 s y bandas por defecto (`máx. 10`), los segundos `30…11` se ven en neutro y de `10` a `0` con las bandas;
  - (f) con umbral 5, las bandas se recortan a rojo `4–5`, naranja `2–3` y verde `0–1`, cubriendo `0–5` sin huecos;
  - (g) no existe ningún control para introducir un color hexadecimal; las únicas opciones son las cinco de la paleta.

**RF15** — Cuando la cuenta atrás de la **siguiente cue pendiente** llegue a `0` con su referencia disponible (track En marcha o Terminado por duración con referencia válida, o reloj de espectáculo en marcha), o al reanudar con el objetivo ya alcanzado, y el cue no se haya lanzado, el sistema deberá mostrar el aviso **"¡Lanzar!"**, destacado y persistente.

- El aviso corresponde **solo a la siguiente cue pendiente** (RF38). Las demás cues no muestran "¡Lanzar!" ni control de lanzamiento hasta que les toque.
- El aviso debe poder activarse directamente para lanzar el cue (el propio aviso u otro control de lanzamiento de esa cue), siempre que la secuencia y el estado de la referencia lo permitan (RF22, RF38).
- Con el track Pausado el aviso puede permanecer visible si el objetivo ya se superó, pero su control de lanzamiento está deshabilitado con el motivo "Reanuda el track para lanzar esta cue." (D23). Con el track Terminado manualmente antes del objetivo, no hay aviso.
- El parpadeo debe respetar `prefers-reduced-motion`: sin animación en ese caso, sustituido por un borde y un icono estáticos de igual prominencia; en ningún caso debe superar 3 destellos por segundo.
- *Criterio de aceptación:*
  - (a) al llegar a `0` sin lanzar, la **siguiente** cue pendiente muestra el aviso de inmediato y lo mantiene aunque pasen 30 s;
  - (b) lanzar el cue desde el aviso lo registra y retira el aviso;
  - (c) con `prefers-reduced-motion` activo no hay parpadeo y el aviso sigue siendo inequívoco;
  - (d) el aviso no aparece si el track se detiene manualmente antes de llegar al objetivo, ni si el reloj de espectáculo no está en marcha en un cue con `atMs`;
  - (e) si el objetivo se superó mientras el track estaba pausado, al volver a "En marcha" el aviso está visible aunque la cuenta atrás nunca haya llegado a pintarse;
  - (f) con un track Terminado por duración y la siguiente cue en el final exacto del track, el aviso permanece visible indefinidamente hasta lanzar o finalizar/detener la función.

**RF16** — Cuando haya varias cues con cuenta atrás, el sistema deberá destacar **solo** la de la siguiente cue pendiente de la secuencia y deberá mantener el resto visibles sin competir con ella.

- Las cuentas atrás de cues que no son la siguiente se muestran sin tamaño destacado, sin "¡Lanzar!" y sin control de lanzamiento activo.
- *Criterio de aceptación:*
  - (a) con tres cues en un track, solo la siguiente muestra cuenta atrás destacada; los demás aparecen con su tiempo y su estado;
  - (b) al lanzar la destacada, pasa a destacarse la siguiente sin recargar;
  - (c) si la cuenta atrás de una cue no siguiente llega a `0`, no se muestra su "¡Lanzar!" hasta que esa cue pase a ser la siguiente (CL16);
  - (d) si dos cues comparten tiempo absoluto, se destaca primero la de identificador natural menor (RF38).

**RF17** — El sistema deberá mostrar en la vista de ejecución una **escaleta viva combinada** con tracks y cues en orden cronológico y el estado de cada elemento (Pendiente, Próxima, Lanzado, No alcanzado; track Pendiente, En marcha, Pausado, Terminado).

- La escaleta viva es la vista combinada de tracks y cues por tiempo (los cues sin tiempo al final); no sustituye a la escaleta impresa ni añade campos editables.
- *Criterio de aceptación:* la escaleta viva refleja los lanzamientos al instante y permanece legible a tamaño reducido; su estado se anuncia de forma accesible (RF33); en Función solo la siguiente cue muestra control de lanzamiento activo.

**RF18** — Cuando el usuario lance un cue, el sistema deberá confirmarlo de forma inequívoca y deberá contar un único lanzamiento por activación.

- Confirmación visual: cambio de estado del cue, aviso de confirmación con su identificador y, si está activada, confirmación **sonora opcional** (desactivada por defecto).
- Idempotencia: una misma activación (doble clic, doble toque, tecla mantenida, activación simultánea por dos controles) cuenta como máximo un lanzamiento; mientras un lanzamiento está en curso no se encola otro.
- **Fallo de guardado (alineado con la 001):** el instante se captura en la activación, pero el lanzamiento no es efectivo hasta guardarse. Si falla el **primer** lanzamiento (creación del registro), se revierte íntegramente (contador, cue prevenida/estado, bloqueo de producción y registro) y se muestra error legible. Si falla uno posterior, el contador no se incrementa, se conserva el último estado guardado y se reintenta **con el mismo instante capturado**.
- *Criterio de aceptación:*
  - (a) un doble clic sobre el mismo control incrementa en 1 los cues lanzados;
  - (b) lanzar el mismo cue desde el control de lanzamiento general y desde el aviso "¡Lanzar!" a la vez produce una sola marca;
  - (c) con la confirmación sonora activada y el navegador bloqueando audio, se ve la confirmación visual y no aparece ningún error bloqueante;
  - (d) la marca de tiempo del lanzamiento se toma en el instante de la activación, no cuando termina el guardado;
  - (e) un fallo del primer lanzamiento deja el contador en su valor anterior, la producción sin bloquear y ningún registro creado;
  - (f) un fallo posterior no incrementa el contador y el reintento guarda el instante original, no el del reintento.

### E. Modo ensayo vs modo función

**RF19** — Mientras se muestre la vista de ejecución de un proyecto de danza, el sistema deberá mostrar de forma permanente el **badge "ENSAYO" o "FUNCIÓN"** en la barra superior de esa vista, visible en todas sus pestañas internas.

- Junto al badge vive el **control de cambio de modo** ("Cambiar a Ensayo" / "Cambiar a Función"), operable con teclado; es el único punto de cambio de modo.
- El badge comunica el modo con texto, no solo con color, y se mantiene visible al cambiar de pestaña interna, al abrir el documento y al abrir el informe.
- *Criterio de aceptación:*
  - (a) el badge se lee "FUNCIÓN" al entrar en la ejecución de un proyecto de danza (modo por defecto);
  - (b) sigue visible tras cambiar de pestaña y tras lanzar cues;
  - (c) su texto y el del control de cambio forman parte de la información anunciada al lector de pantalla;
  - (d) el control de cambio se alcanza con Tab, se activa con Enter o Espacio y su estado bloqueado expone el motivo.

**RF20** — Cuando el usuario cambie entre ensayo y función, el sistema deberá exigir **confirmación explícita** y deberá **reiniciar el estado de la ejecución** (cronómetros, reloj de espectáculo, cues lanzadas, tracks y avisos), sin arrastrar datos de un modo al otro.

- **Bloqueo del cambio:** se bloquea **solo** si existe un **registro abierto** (cualquier `runReport` sin `endedAt`, creado al arrancar el cronómetro o al primer lanzamiento, aunque tenga cero lanzamientos) o un track En marcha. En Ensayo, como no se persiste nada, el cambio está permitido con confirmación aunque haya lanzamientos o un track en marcha, y reinicia el estado.
- *Criterio de aceptación:*
  - (a) el cambio pide confirmación con un texto que nombra el modo de destino y advierte de que se reinicia la ejecución;
  - (b) cancelar la confirmación deja el modo y el estado intactos;
  - (c) en Función, con un registro de función abierto o un track En marcha, el control está deshabilitado con motivo visible y no cambia nada;
  - (d) en Ensayo, con lanzamientos o track En marcha, el cambio está disponible con la misma confirmación;
  - (e) tras confirmar: contadores a `0`, cronómetros a `00:00`, reloj de espectáculo detenido, ningún track iniciado y ninguna cuenta atrás visible.

**RF21** — Mientras el modo sea **Ensayo**, el sistema deberá permitir la navegación libre: lanzar cualquier cue pendiente, volver a un cue anterior, saltar cues, reiniciar tracks y editar la escaleta.

- En ensayo **no** se registran tiempos reales, desviaciones ni informes, no se crea registro de función y no se bloquea la selección de producción (excepción D7).
- *Criterio de aceptación:*
  - (a) en ensayo se puede lanzar el cue 5 sin haber lanzado el 1, y se puede volver a poner el cursor en el cue 1;
  - (b) al salir de ensayo o cambiar de producción no queda ningún registro de función nuevo;
  - (c) el contador de funciones y cualquier métrica no cambian por ensayar;
  - (d) el selector de producción de la cabecera sigue disponible durante el ensayo;
  - (e) reiniciar un track Terminado en ensayo lo devuelve a `00:00` En marcha sin afectar al registro de ninguna función.

**RF22** — Mientras el modo de ejecución sea **Función**, el sistema deberá impedir la navegación libre: no se podrá rebobinar, saltar cues ni reiniciar tracks ya lanzados, y cualquier intento deberá explicarse.

- La **secuencia de cues** es la escaleta temporal (RF38): solo la **siguiente cue pendiente** (candidata) puede lanzarse. La candidata se muestra siempre, pero su control está **lanzable** solo si su referencia está disponible: track `En marcha`, track `Terminado` por duración con referencia válida (objetivo = duración), o cue con `atMs` con el reloj de espectáculo en marcha. Si el track está `Pausado` o terminado manualmente, o falta el reloj para `atMs`, la candidata se ve con el control deshabilitado y su motivo.
- Los demás cues no muestran "¡Lanzar!" ni control de lanzamiento hasta que sean la siguiente (RF15, RF16, RF38).
- La **finalización** tiene dos vías (RF36): lanzar la última pendiente, como la 001, o pulsar "Finalizar función" con un registro abierto.
- El bloqueo de producción se activa con el **registro abierto** (arranque del cronómetro o primer lanzamiento), como en la 001, y se libera al finalizar (RF36) o al descartar (RF37).
- **Tracks en función:** no se reinicia un track Terminado; solo se puede iniciar el **primer track Pendiente** del orden de la escaleta. Iniciarlo mientras otro está En marcha o Pausado aplica al anterior la regla de parada manual (confirmación, cierre de `TrackRun`, pendientes del anterior "no alcanzados") y avanza la secuencia.
- **Detener un track manualmente** con cues pendientes es una acción explícita con confirmación: en Función, sus pendientes quedan **"no alcanzados"** y la secuencia avanza a la siguiente cue (de otro track o con `atMs`). Es la salida determinista distinta de "Finalizar función".
- *Criterio de aceptación:*
  - (a) en función no se ofrece ningún control de retroceso, salto ni reinicio de track, y su ausencia se explica con un texto fijo accesible;
  - (b) un intento de rebobinar o saltar (atajo, control externo o reintento manual) no altera el estado y muestra un aviso del tipo "En función no se puede retroceder ni saltar. Cambia a Ensayo para ensayar.";
  - (c) solo la siguiente cue pendiente tiene su control potencialmente activo; el resto lo muestra deshabilitado con el motivo "En función solo se puede lanzar la siguiente cue de la escaleta.";
  - (d) si la siguiente cue no es lanzable (track Pausado o terminado manualmente, o `atMs` sin reloj), se muestra con su motivo y no se lanza;
  - (e) lanzar la última cue pendiente finaliza la función como en la 001 (RF36a);
  - (f) "Finalizar función" está disponible con un registro abierto y exige confirmación si hay pendientes (RF36b);
  - (g) el bloqueo de producción se activa con el registro abierto y se libera al finalizar o descartar;
  - (h) detener manualmente un track con 2 pendientes pide confirmación, los deja "no alcanzados" y hace siguiente a la cue de otro track o con `atMs`.

**RF23** — Mientras el modo de ejecución sea **Función**, el sistema deberá registrar, por cada cue lanzado, su instante real de lanzamiento y su desviación respecto al objetivo cuando exista una referencia temporal, medida en **tiempo activo**.

- **Cue vinculado a track:** `actualOffsetMs` = **tiempo activo del track** en el instante de lanzamiento; `targetOffsetMs` = objetivo declarado; `desviación = actualOffsetMs − targetOffsetMs`. No se usa tiempo de pared ni el tiempo con pausas.
- **Cue sin track con `atMs`:** `actualOffsetMs` = **tiempo activo del reloj de espectáculo** en el instante de lanzamiento; `desviación = actualOffsetMs − atMs`.
- **Cue con objetivo en el final del track:** si el track terminó por duración y el objetivo es la duración, el instante real es la duración (aunque se lance más tarde); `actualOffsetMs = durationMs` y la desviación es `0`.
- **Cue sin objetivo:** se registra como lanzado, sin desviación, y se cuenta aparte.
- **Cue con objetivo pero sin referencia:** el track nunca llegó a iniciarse, o es un `atMs` lanzado sin reloj de espectáculo. Se registra como lanzado **sin desviación** y se informa como "sin referencia temporal" (RF24). No se inventa una desviación.
- En Función, la candidata solo se lanza si es **lanzable** (track `En marcha` o terminado por duración con referencia, o reloj en marcha para `atMs`); si no, el control está deshabilitado y no se fabrica ningún registro.
- El instante se captura en la activación y se guarda con precisión de milisegundos; la desviación se calcula una vez y **no se recalcula** a posteriori.
- La desviación se mide contra el tiempo activo del track y del reloj de espectáculo **aunque el cronómetro de función no esté en marcha**.
- *Criterio de aceptación:*
  - (a) un cue con objetivo `1:30` lanzado a `1:30,8` de tiempo activo queda registrado con desviación `+0,8 s`;
  - (b) las desviaciones sobreviven a la recarga y no se recalculan;
  - (c) un cue con `atMs` lanzado con el reloj de espectáculo en marcha registra desviación aunque el cronómetro de función esté en espera;
  - (d) un cue lanzado sin referencia temporal se guarda con el lanzamiento y sin desviación, y el informe lo lista en "sin referencia";
  - (e) la marca se guarda aunque falle el guardado inmediato, reintentándose sin cambiar el instante registrado (RF18);
  - (f) ninguna marca se pierde si la función se inicia sin cronómetro o se cierra al cambiar de producción (salvo descarte explícito, RF37);
  - (g) pausar el track 20 s y lanzar el cue en su tiempo activo objetivo produce desviación `0`, no `+20 s`;
  - (h) con el track terminado por duración y el cue a la duración, lanzarlo 5 s después en tiempo de pared registra `actualOffsetMs = durationMs` y desviación `0`.

**RF24** — Cuando la función de danza finalice, el sistema deberá mostrar un **informe de desviaciones** de esa función y deberá permitir consultarlo después.

- **Fuente autoritativa:** `cueLaunches` del registro. `launchedCueCount` se mantiene sincronizado con el número de lanzamientos al guardar; si un registro antiguo no tiene `cueLaunches`, se usa el contador heredado.
- **Instantánea del cue:** cada `CueLaunchEvent` guarda en el momento del lanzamiento `cueDescription`, `cuePie?` y `cueObservations?`, de modo que el informe es **reproducible** aunque el cue se edite después. El informe sigue siendo una función pura de `PerformanceRunReport`.
- Contenido por cue con objetivo: identificador, track (o "—"), objetivo, instante real, desviación con signo y una décima (formato `+0,8 s`, `−0,4 s`, coma decimal) y estado `a tiempo` cuando `|desviación| < 0,1 s`.
  - Una desviación cuyo redondeo a una décima es `0,0` (por ejemplo `−0,04 s`) se muestra como **"a tiempo"**, nunca como `−0,0 s`.
- Resumen: cues lanzados, cues con objetivo, **desviación media** (media aritmética **con signo** de las desviaciones de los cues lanzados con objetivo y referencia; si no hay ninguna, `—`; redondeo a una décima), **desviación máxima** (la de **mayor valor absoluto**; si hay empate, la del primer cue en orden cronológico; se muestra con el identificador de su cue y con signo) y número de cues **no alcanzados**.
- Listas aparte: cues lanzados sin objetivo y cues lanzados "sin referencia temporal"; cues pendientes sin objetivo al cerrar ("pendiente no lanzado").
- **"No alcanzado":** cue con objetivo que nunca se lanzó y que cumple una de estas condiciones: su instante objetivo se alcanzó con la referencia (track en marcha o terminado por duración, o reloj de espectáculo); su track se detuvo manualmente en Función antes del objetivo; o seguía pendiente al finalizar la función. No es una desviación.
- Las **notas y observaciones del cue (RF31)** aparecen junto a su fila (RF31b).
- El informe es **imprimible** con el mismo estilo y componentes de la vista imprimible del documento (RF8), en `/reportes/imprimir` (RF41).
- Consulta posterior: para proyectos de danza, `/reportes` muestra las funciones en modo función con su informe y permite abrirlo e imprimirlo.
- *Criterio de aceptación:*
  - (a) al finalizar la función aparece el acceso al informe de esa función;
  - (b) el informe muestra el ejemplo "Cue LX-2 · track «Entrada» · objetivo 01:30 · real 01:30,8 · +0,8 s";
  - (c) un cue cuyo objetivo se superó sin lanzarse aparece como "no alcanzado" y no como desviación;
  - (d) un cue lanzado con 0,04 s de adelanto aparece "a tiempo", no `−0,0 s`;
  - (e) la media y la máxima llevan signo y una décima; sin desviaciones, la media muestra `—` sin dividir por cero;
  - (f) tras recargar, el informe de la última función sigue consultable desde reportes;
  - (g) la vista imprimible del informe sale en claro, sin controles y con los mismos formatos de tiempo;
  - (h) la nota escrita en un cue durante la función aparece en su fila;
  - (i) los ensayos no aparecen en reportes;
  - (j) editar después la descripción, el pie o las observaciones del cue no cambia el informe: se muestran las instantáneas del lanzamiento;
  - (k) un cue pendiente cuyo track se detuvo manualmente en Función aparece como "no alcanzado".

**RF25** — El sistema deberá mantener separadas las métricas de ensayo y de función.

- Los recuentos de funciones y los informes consideran solo registros en modo función; los registros antiguos sin modo se consideran función.
- *Criterio de aceptación:* ensayar N veces no altera el contador de funciones del panel; el informe de desviaciones solo lista funciones; ningún registro antiguo desaparece del contador; una función descartada (RF37) no aparece en el contador ni en reportes.

### F. Plantillas de escaleta

**RF26** — El sistema deberá permitir guardar la escaleta de un proyecto —completa o una parte seleccionada— como **plantilla** reutilizable, con **nombre obligatorio** y **descripción opcional**, y con versión.

- La selección parcial admite **dos tipos de elemento**:
  - **tracks completos, con todos sus cues vinculados**: al seleccionar un track se incluyen sus cues y no se pueden desmarcar por separado;
  - **cues sueltos sin track**, con su tiempo absoluto.
- La selección **no** admite un cue perteneciente a un track sin incluir también ese track: el control lo impide y se explica el motivo.
- Contenido de la plantilla, suficiente para reconstruir cues válidos al aplicarla:
  - tracks: `key`, título, duración, `order`, `startAtMs`, notas;
  - cues: identificador, tipo, `includedTypes` (obligatorio con ≥ 2 tipos si el tipo es SIM), descripción, `pie`, observaciones, departamento, acto, escena, `status` (por defecto `"Borrador"`), `executionState` (por defecto `"Preparación"`), `alertBeforeMs`, `trackKey`, `trackOffsetMs` y `atMs` cuando sea cue suelto.
- **Nombre único:** si al crear o guardar ya existe una plantilla con el mismo nombre, se añade automáticamente el sufijo `" (2)"`, `" (3)"`…; nunca se sobrescribe ni se rechaza por duplicado. La misma regla se aplica al duplicar, importar y renombrar (RF28, RF30).
- **Validación de offset:** si `trackOffsetMs` supera la `durationMs` del track referenciado, la operación se **rechaza** con mensaje en español y no se escribe nada.
- *Criterio de aceptación:*
  - (a) guardar como plantilla con nombre vacío se rechaza con mensaje; sin descripción se guarda;
  - (b) la plantilla creada aparece en la lista de plantillas con su nombre, versión `1` y fecha;
  - (c) al reabrir la plantilla se ven todos los tracks y cues guardados, con sus vínculos, tiempos, inicios explícitos, `status` y `executionState`;
  - (d) al guardar una selección parcial que incluye un track, la plantilla contiene ese track y **todos** sus cues, sin posibilidad de dejarlos fuera;
  - (e) intentar incluir un cue de un track sin su track no es posible: el control está deshabilitado o se marca automáticamente el track, con el motivo explicado;
  - (f) los cues sueltos sin track se guardan con su tiempo absoluto y sin vínculo (`trackKey` ausente), y al aplicar la plantilla quedan como cues sin track con ese tiempo;
  - (g) una plantilla con un cue SIM sin dos `includedTypes` no se puede guardar; la plantilla guardada, al aplicarse, produce cues válidos;
  - (h) guardar con un nombre ya existente crea otra plantilla con sufijo `" (2)"` y no sobrescribe la anterior;
  - (i) guardar un cue cuyo `trackOffsetMs` supera la duración del track se rechaza con mensaje y no persiste ningún cambio.

**RF27** — Cuando el usuario cree un proyecto de danza, el sistema deberá permitir empezar **desde cero** o **aplicar una plantilla existente** y editarla después.

- Aplicar una plantilla crea una **copia independiente**: tracks y cues nuevos del proyecto, con identificadores nuevos, sin ningún vínculo vivo con la plantilla. Al aplicar se fija en el proyecto `templateOrigin: { templateId, name, version }` (trazabilidad); este valor **no cambia** aunque la plantilla se edite después.
- **La aplicación de plantillas solo existe en el alta del proyecto.** No hay acción "Aplicar plantilla" sobre un proyecto ya creado en fase 1 (§9).
- Destino del contenido: se crea en un proyecto vacío, por lo que no hay colisión posible con contenido previo; los identificadores repetidos **dentro** de la plantilla se permiten y se avisan (D16, CL50).
- *Criterio de aceptación:*
  - (a) al crear el proyecto se ofrece la lista de plantillas y la opción "Empezar de cero";
  - (b) aplicar una plantilla deja el proyecto con los mismos tracks, cues, inicios y vínculos que la plantilla, y el documento ya generado;
  - (c) el proyecto resultante es válido: los cues SIM conservan sus dos o más tipos y los tiempos caen dentro de la duración de su track;
  - (d) editar el proyecto no cambia la plantilla;
  - (e) la ficha del proyecto indica de qué plantilla y versión se copió (`templateOrigin`), solo como trazabilidad, y ese dato no cambia al editar la plantilla;
  - (f) sobre un proyecto existente no aparece en ninguna superficie la opción de aplicar una plantilla.

**RF28** — El sistema deberá permitir duplicar, renombrar, editar y eliminar plantillas, y deberá **incrementar la versión** cada vez que se guarde una edición de su **contenido**.

- Superficie de edición: en `/plantillas`, cada plantilla se abre en un editor propio que **reutiliza la misma interfaz de escaleta** en "modo plantilla" (tracks, cues, tiempos, orden), sin vincularse a ningún proyecto. Guardar cambios de contenido incrementa la versión.
- Renombrar y cambiar la descripción **no** incrementan la versión; no alteran tracks ni cues. Si el nuevo nombre ya existe, se aplica el sufijo automático `" (2)"`, `" (3)"`… (RF26).
- Duplicar crea una plantilla nueva, con nombre propio, versión `1` y sin cambios en la original; si el nombre ya existe, se aplica el mismo sufijo automático.
- Eliminar exige confirmación e indica que no afecta a ningún proyecto.
- *Criterio de aceptación:*
  - (a) duplicar y renombrar no alteran la plantilla original;
  - (b) tras dos ediciones de contenido guardadas, la versión es `3` (empezó en `1`); renombrar y cambiar la descripción no la incrementan;
  - (c) el editor de plantilla permite añadir un track, un cue vinculado y un cue suelto, y guardarlos con su tiempo;
  - (d) eliminar una plantilla usada por proyectos existentes deja esos proyectos intactos;
  - (e) la versión mostrada en un proyecto ya creado no cambia al editar la plantilla;
  - (f) duplicar o renombrar con un nombre ya existente produce la nueva plantilla o el nuevo nombre con sufijo `" (2)"`/`" (3)"`, sin sobrescribir ni rechazar.

**RF29** — El sistema deberá garantizar el **aislamiento** entre plantillas y proyectos en ambos sentidos.

- Ninguna edición, duplicado, eliminación, importación o versionado de una plantilla puede modificar tracks, cues, tiempos o vínculos de un proyecto existente; ninguna edición del proyecto modifica la plantilla.
- *Criterio de aceptación:*
  - (a) editar un cue de un proyecto creado desde una plantilla no cambia la plantilla;
  - (b) editar la plantilla no cambia el proyecto;
  - (c) eliminar la plantilla no rompe el proyecto;
  - (d) tras recargar, las dos copias siguen siendo independientes.

**RF30** — El sistema deberá **exportar** una plantilla a un archivo JSON e **importarla** desde un archivo JSON, validando su contenido antes de escribir nada.

- **Contrato JSON:**
  ```
  {
    "format": "regiduria.schedule-template",
    "formatVersion": 1,
    "kind": "template",
    "exportedAt": "2026-11-16T10:00:00.000Z",
    "template": {
      "name": "…", "description": "…", "version": 1,
      "tracks": [ { "key": "t1", "title": "…", "durationMs": 120000, "order": 0, "startAtMs": null, "notes": "…" } ],
      "cues": [ { "identifier": "LX-1", "type": "LX", "description": "…", "department": "Iluminación",
                  "act": "", "scene": "", "status": "Borrador", "trackKey": "t1",
                  "trackOffsetMs": 90000, "atMs": null, "alertBeforeMs": 10000 } ]
    }
  }
  ```
- `format` y `formatVersion` son obligatorios y deben coincidir con los soportados; `kind` debe ser `"template"` (o `"schedule"` en la exportación de proyecto, RF34, que se importa igualmente **como plantilla**).
- Validación antes de escribir: estructura, enums de tipo y departamento, `includedTypes` de SIM (≥ 2), números enteros ≥ 0, `durationMs` si existe > 0, `alertBeforeMs` entre 1 000 y 60 000, y `trackOffsetMs ≤ durationMs` del track referenciado cuando el `trackKey` **sí existe**. Un `trackKey` huérfano **no** se rechaza: es un caso de reparación (siguiente viñeta). Si un `trackOffsetMs` supera la duración del track referenciado, la importación se **rechaza** con mensaje en español y no escribe nada.
- **Nombre:** si ya existe una plantilla con el mismo nombre, la importación crea una nueva con sufijo automático `" (2)"`, `" (3)"`… **nunca sobrescribe**; el nombre es obligatorio y la descripción opcional.
- **Track inexistente al importar (reparación, no rechazo):** el cue se **desvincula**; si tenía `atMs` en el archivo, se conserva; si solo tenía `trackOffsetMs`, queda "sin tiempo" y se informa del número de reparaciones de cada forma. La validación no bloquea por este motivo.
- *Criterio de aceptación:*
  - (a) exportar una plantilla produce un archivo descargable con nombre reconocible (`*.regiduria-plantilla.json`) y el contenido completo del contrato;
  - (b) importar ese mismo archivo crea una plantilla equivalente con versión `1` y nombre único si ya existía uno igual;
  - (c) un archivo no JSON, sin `format`/`formatVersion`, con `kind` incorrecto o con tipos inválidos se rechaza con mensaje en español y **no** deja ninguna plantilla parcial;
  - (d) un cue con `trackKey` inexistente se importa desvinculado y se informa del número de reparaciones;
  - (e) la importación nunca sobrescribe una plantilla existente: crea una nueva con sufijo si hace falta;
  - (f) el JSON exportado e importado sin cambios produce una plantilla con los mismos tracks, inicios, cues y tiempos;
  - (g) importar un cue cuyo `trackOffsetMs` supera la duración de su track se rechaza con mensaje y no deja ninguna plantilla parcial.

### G. Notas durante la ejecución

**RF31** — El sistema deberá permitir anotar un cue durante la ejecución (ensayo o función) sin salir de la vista de ejecución y sin detener cronómetros.

- Se reutilizan el campo `observations` (nota) y `pie` (acción que da pie al cue); no se crea un sistema de anotaciones nuevo.
- Guardar la nota **nunca** modifica `Cue.timing` ni ningún otro campo del cue (RF40): se persiste el cue completo con su tiempo ya guardado.
- *Criterio de aceptación:*
  - (a) se puede escribir una nota de un cue en marcha y guardarla con confirmación visible, tanto en Ensayo como en Función;
  - (b) la nota aparece en el documento, en la escaleta impresa y en el informe de la función;
  - (c) guardar la nota no altera el cronómetro de track ni el de función, ni mueve la secuencia de cues, ni cambia el total;
  - (d) la nota no borra el vínculo, el objetivo ni el umbral del cue;
  - (e) un fallo de guardado no pierde el texto escrito y permite reintentar.

### H. Accesibilidad y preferencias

**RF32** — El sistema deberá permitir configurar el **tamaño de fuente**, el **modo de alto contraste**, las **bandas de color** y la **confirmación sonora**, y deberá persistir esas preferencias.

- Niveles de tamaño: `normal`, `grande` y `muy grande` (factores `1`, `1,25` y `1,5`), aplicados a cronómetros, reloj de espectáculo, cuentas atrás, identificadores, botones de lanzamiento y escaleta viva. El aviso "¡Lanzar!" entra en el mismo escalado.
- Las preferencias se editan en `/ajustes`, sección "Ejecución de danza", y se guardan en la tabla local `appSettings` (§4.6). Validación de bandas según RF14.
- *Criterio de aceptación:*
  - (a) al subir el tamaño, la cuenta atrás, el identificador de cue y "¡Lanzar!" crecen sin romper la disposición ni cortar contenido;
  - (b) el alto contraste mantiene la distinción de las bandas de color y alcanza contraste mínimo AA (4,5:1) en texto, incluido el texto de "¡Lanzar!";
  - (c) cambiar bandas, tamaño, contraste o sonido en `/ajustes` se aplica a la ejecución abierta y persiste tras recargar;
  - (d) la preferencia no afecta al flujo estándar ni a las vistas imprimibles (que siempre son claras y con tamaño fijo);
  - (e) una configuración de bandas inválida no sustituye a la última válida.

**RF33** — El sistema deberá permitir operar la ejecución de danza solo con teclado y deberá anunciar los hitos relevantes a lectores de pantalla.

- **Pasos verificables con teclado:**
  1. iniciar el track siguiente desde su botón con `Enter` o `Espacio`;
  2. lanzar la cue siguiente desde su único control activo, que recibe el foco visible;
  3. llegar al control de cambio de modo situado junto al badge y activarlo; si está bloqueado, se anuncia el motivo;
  4. escribir una nota, guardarla y volver al lanzamiento sin perder el foco de forma errática.
- **Hitos anunciados:** inicio de la cuenta atrás; solo los segundos que existan en el umbral entre `10`, `5`, `3`, `2`, `1` y `0` (con umbral 5 se anuncian `5,3,2,1,0`; con umbral 10, `10,5,3,2,1,0`); aparición de "¡Lanzar!"; lanzamiento confirmado; track iniciado/pausado/detenido/terminado; objetivo superado y cue "no alcanzado"; cambio de modo; finalización; descarte; errores. **Nunca** se anuncia cada segundo.
- **Parpadeo verificable:** animación de `400 ms` encendido y `400 ms` apagado (1,25 Hz, muy por debajo de 3 Hz); con `prefers-reduced-motion: reduce` no hay animación y se muestran borde e icono estáticos.
- **Tamaño de referencia:** a `360 px` de ancho de viewport, las operaciones principales (track, cuenta atrás, "¡Lanzar!", badge y cambio de modo) son visibles y accionables **sin scroll horizontal**; solo la escaleta viva puede requerir scroll vertical. Objetivo táctil mínimo de `44×44 px`.
- *Criterio de aceptación:*
  - (a) se completan los cuatro pasos de teclado con foco visible y sin ratón;
  - (b) los anuncios usan una región `aria-live="polite"` y "¡Lanzar!", "no alcanzado" y los errores usan anuncio asertivo;
  - (c) los controles deshabilitados exponen su motivo (`aria-describedby` o equivalente);
  - (d) lanzar no roba el foco de un campo de texto ni provoca saltos de scroll;
  - (e) con `prefers-reduced-motion` no hay animación de parpadeo y el aviso sigue siendo inequívoco;
  - (f) a `360 px` no aparece scroll horizontal en las operaciones principales.

### I. Persistencia y exportación

**RF34** — El sistema deberá permitir **exportar la escaleta completa de un proyecto a JSON** e importarla **como plantilla**.

- La exportación usa el mismo sobre que RF30 con `kind: "schedule"` y el bloque `template` relleno con la escaleta del proyecto, sin ids de producción ni de cue.
- La importación de un `kind: "schedule"` crea una plantilla nueva con el nombre del proyecto (o sufijo si ya existe). **No** crea un proyecto nuevo en fase 1 (§9).
- *Criterio de aceptación:*
  - (a) la exportación incluye tracks, inicios, cues, tiempos, vínculos y notas con `formatVersion`;
  - (b) el archivo exportado se importa en `/plantillas` como plantilla nueva y conserva tracks y vínculos;
  - (c) un archivo corrupto o con `kind` desconocido se rechaza sin efecto;
  - (d) no existe ninguna acción de importar un JSON como proyecto.

**RF35** — El sistema deberá persistir en el almacenamiento local los tracks, los tiempos de cue, los vínculos, las plantillas, los informes y las preferencias, y deberá mantener la integridad entre ellos.

- Nuevas entidades y campos son **opcionales**, de modo que los datos existentes siguen siendo válidos sin migración.
- **`atMs` derivado:** mientras un cue está vinculado, su tiempo absoluto **no se persiste** como fuente (puede existir un valor residual, pero la fuente es el vínculo). Al desvincular o al borrar su track, se **materializa** el último tiempo absoluto calculado en `atMs`.
- **Track inexistente:** se detecta al calcular (no se persiste ninguna marca). Un `trackId` que no resuelve se trata como cue sin tiempo, con aviso "Track no encontrado" y sin romper la escaleta ni las cuentas atrás; el usuario puede desvincular o reasignar. Un `trackId` **sin `trackOffsetMs`** se trata directamente como **sin vínculo** (no hay cue vinculado sin objetivo).
- **Cascadas:** eliminar una producción elimina sus `danceTracks` (sus cues ya se eliminan con la producción); eliminar un track desvincula sus cues materializando su tiempo y avisando antes; `deleteAllProductions` vacía producciones, cues, tracks, incidencias y funciones, y **conserva plantillas y preferencias**.
- **Tablas e índices (Dexie v5):** `danceTracks: "id, productionId, order"`, `scheduleTemplates: "id, name, updatedAt"`, `appSettings: "id"`. Las tablas existentes no cambian de clave. Las plantillas son independientes: no tienen `productionId`.
- *Criterio de aceptación:*
  - (a) tracks, inicios, tiempos, vínculos, plantillas, informes y preferencias sobreviven a la recarga;
  - (b) abrir la aplicación con datos anteriores a esta funcionalidad no produce errores ni pérdidas;
  - (c) un cue con referencia a un track inexistente se trata como desvinculado y se marca con un aviso, sin escribirlo automáticamente;
  - (d) eliminar una producción elimina sus tracks y no deja huérfanos visibles;
  - (e) eliminar un track pide confirmación indicando cuántos cues quedarán desvinculados y, al confirmar, esos cues conservan su último tiempo absoluto como `atMs`;
  - (f) borrar todas las producciones deja las plantillas y las preferencias intactas;
  - (g) un cue desvinculado que solo tenía `trackOffsetMs` queda "sin tiempo" y se informa;
  - (h) `Production.mode`, `Cue.timing` y los campos de danza del informe se conservan tras guardar y recargar (RF40).

### J. Finalización, descarte, secuencia, reloj de espectáculo, persistencia y superficies

**RF36** — Mientras el modo de ejecución sea **Función**, el sistema deberá ofrecer **dos vías de finalización** con el mismo efecto de cierre, y el botón "Finalizar función" deberá estar disponible **solo con un registro abierto**.

- **Vía 1 — última cue:** al lanzar la última cue pendiente de la secuencia, la función finaliza en la misma acción, como en la 001 (RF22).
- **Vía 2 — "Finalizar función":** botón explícito, habilitado **solo si existe un registro abierto** (cualquier `runReport` sin `endedAt`, aunque tenga 0 lanzamientos). Si solo hay un track En marcha y **no** hay registro, está deshabilitado con el motivo visible "Inicia la función o lanza una cue para poder finalizarla.". Si hay cues pendientes, pide confirmación con el texto "Se cerrará la función con N cues sin lanzar; quedarán como no alcanzadas.".
- Efecto común al cerrar:
  1. se cierra el registro abierto (`endedAt` y `durationMs`);
  2. se cierran los `TrackRun` abiertos con su tiempo activo y los tracks quedan Terminados;
  3. el **reloj de espectáculo** y el cronómetro de función se detienen y quedan congelados en su último valor;
  4. las cues pendientes con objetivo quedan **no alcanzadas**; las pendientes sin objetivo quedan "pendiente no lanzado";
  5. se guarda el informe con sus lanzamientos, sus instantáneas y sus tracks;
  6. se libera el bloqueo de la selección de producción y se muestra "Finalizada" y el acceso al informe (RF24).
- **Registros de sesiones anteriores:** "Finalizar función" **no** actúa sobre registros abiertos que quedaron de una sesión anterior (sin estado de sesión en memoria). Esos registros se listan como "registro de una sesión anterior" y quedan como limitación conocida (001). Solo se finaliza el registro abierto de la sesión actual.
- Si no hay registro abierto ni track en marcha, el botón está deshabilitado con el motivo "No hay ninguna función en curso.".
- *Criterio de aceptación:*
  - (a) lanzar la última cue pendiente finaliza igual que en la 001 y deja `endedAt` fijado;
  - (b) "Finalizar función" con 3 cues pendientes pide confirmación, cierra el registro, deja esos 3 como "no alcanzado" en el informe y libera la producción;
  - (c) tras finalizar, todos los tracks figuran Terminados y ninguno sigue en marcha, y los `TrackRun` abiertos quedan cerrados;
  - (d) el reloj de espectáculo queda detenido y no sigue avanzando en pantalla;
  - (e) con un registro abierto sin lanzamientos (creado al arrancar el cronómetro), finalizar cierra el registro con 0 lanzamientos y un informe "sin cues lanzados";
  - (f) con solo un track En marcha y sin registro, el botón está deshabilitado con el motivo "Inicia la función o lanza una cue para poder finalizarla.";
  - (g) finalizar no crea un segundo registro y es idempotente ante doble activación;
  - (h) un registro abierto de una sesión anterior aparece como "registro de una sesión anterior" y "Finalizar función" no lo modifica.

**RF37** — Mientras el modo sea **Función**, el sistema deberá ofrecer **"Descartar función"** para anular el registro abierto de la sesión actual, con confirmación explícita.

- Disponible solo si existe un registro **abierto creado en la sesión actual** (aunque tenga 0 lanzamientos). Nunca afecta a un registro ya cerrado ni a un registro abierto de una **sesión anterior**, que se muestra como "registro de una sesión anterior" y no se puede descartar desde esta sesión.
- La confirmación explica: "Se anulará esta función: se borrará su registro y no contará en métricas ni en informes.".
- Al confirmar: se elimina el registro del almacenamiento; contadores a `0`; tracks detenidos y reiniciados a Pendiente; reloj de espectáculo detenido; cronómetro de función a `00:00`; lanzamientos de la sesión olvidados; producción desbloqueada. El modo sigue en Función.
- Si el borrado falla: se conserva el registro, no se resetea el estado y se muestra un error con reintento.
- *Criterio de aceptación:*
  - (a) sin registro abierto de la sesión actual, la acción no se ofrece; con solo un registro de una sesión anterior, tampoco;
  - (b) cancelar la confirmación no cambia nada;
  - (c) tras descartar, el contador de funciones y `/reportes` no muestran esa función, ni siquiera tras recargar;
  - (d) el registro descartado no reaparece al volver al proyecto;
  - (e) un fallo de borrado no deja la interfaz sin registro pero con contadores a cero;
  - (f) la acción no existe en Ensayo ni en proyectos estándar.

**RF38** — Mientras el modo de ejecución sea **Función**, el sistema deberá imponer una **secuencia temporal única** y distinguir entre la **siguiente cue (candidata)** y la **cue lanzable**.

- **Orden de la secuencia:** cues con tiempo por tiempo absoluto ascendente; desempate por **identificador natural numérico** (prefijo + valor, `LX-2` antes que `LX-10`; con decimales, valor numérico: `LX-2.5` antes que `LX-2.10`) y después por `id`. Los cues **sin tiempo** van al final de la secuencia, tras todos los temporales, en orden de identificador natural y luego `id`.
- **Siguiente (candidata):** primera cue pendiente en ese orden. Es la única con cuenta atrás destacada, la única a la que corresponde "¡Lanzar!" y la única cuyo control puede estar activo.
- **Lanzable:** la candidata está habilitada solo si su referencia está disponible: track vinculado `En marcha`, track `Terminado` por duración con referencia válida (objetivo = duración), o cue con `atMs` y reloj de espectáculo en marcha. Si el track está `Pausado` o terminado manualmente, o falta el reloj para `atMs`, la candidata **se muestra** pero su control está **deshabilitado con motivo**.
- Si dos cues comparten tiempo, se lanzan en el orden indicado: al lanzar la primera, la segunda pasa a ser la siguiente.
- Si la cuenta atrás de una cue que no es la siguiente llega a `0`, su "¡Lanzar!" no aparece hasta que pase a ser la siguiente; mientras tanto se ve su cuenta atrás sin destacar (RF16).
- En Función, cuando un track se detiene manualmente, sus pendientes pasan a "no alcanzado" y la siguiente pasa a ser la cue de otro track o con `atMs` (RF9, RF22).
- *Criterio de aceptación:*
  - (a) con cues en `0:30`, `1:00` y `1:30`, en Función solo el de `0:30` es siguiente; tras lanzarlo, pasa a serlo el de `1:00`;
  - (b) con `LX-2` y `LX-10` en `1:00`, la siguiente es `LX-2` y después `LX-10`; con `LX-2.5` y `LX-2.10`, `LX-2.5` y después `LX-2.10`;
  - (c) un cue sin tiempo nunca es siguiente mientras quede cualquier cue con tiempo pendiente;
  - (d) dos cues sin tiempo se ordenan por identificador natural y luego `id`;
  - (e) una cue no siguiente no puede lanzarse por ningún control y muestra el motivo;
  - (f) en Ensayo esta restricción no aplica (RF21);
  - (g) la siguiente cue con el track Pausado se ve pero su control está deshabilitado con el motivo "Reanuda el track para lanzar esta cue.";
  - (h) la siguiente cue con el track terminado por duración y objetivo en la duración está lanzable indefinidamente;
  - (i) tras detener manualmente un track, sus pendientes dejan de ser siguiente y la secuencia avanza a la cue de otro track o con `atMs`.

**RF39** — El sistema deberá disponer de un **reloj de espectáculo** propio, independiente del cronómetro de función y del cronómetro de track, que sirva de referencia temporal de la ejecución.

- Arranca con el **primer track** que se inicia (en Ensayo o Función) o al pulsar **"Iniciar espectáculo"**. Solo arranca una vez por ejecución; iniciar tracks posteriores no lo reinicia.
- Se **pausa** cuando se pausa el cronómetro de función o se activa un descanso, y se **reanuda** al reanudar. El tiempo en pausa no avanza el reloj ni desplaza los objetivos de los cues con `atMs` (es **tiempo activo**). Pausar solo un track **no** pausa el reloj de espectáculo.
- Se detiene al finalizar la función (RF36), al descartar (RF37), al salir de la vista de ejecución, al cambiar de producción y al cambiar de modo (RF20). En Ensayo puede estar en marcha, pero no genera ningún registro.
- Semántica: `showStartedAt` es el instante de arranque y el valor mostrado es el **tiempo activo** acumulado (suma de tramos sin pausa). Se muestra como "Espectáculo `mm:ss` / `h:mm:ss`", con etiqueta distinta de "Función" y de "Track".
- Los tiempos absolutos y las desviaciones de cues con `atMs` se miden contra este reloj en tiempo activo (RF12, RF23).
- *Criterio de aceptación:*
  - (a) al iniciar el primer track, el reloj de espectáculo empieza a contar aunque el cronómetro de función siga en `00:00:00`;
  - (b) "Iniciar espectáculo" arranca el reloj sin iniciar ningún track ni el cronómetro de función;
  - (c) pausar el cronómetro de función o activar un descanso pausa el reloj de espectáculo y, al reanudar, continúa desde el mismo tiempo activo; pausar solo un track no lo pausa;
  - (d) iniciar un segundo track no reinicia el reloj de espectáculo;
  - (e) al finalizar, descartar o salir de la vista, el reloj se detiene y no reaparece en marcha al volver (limitación de estado en memoria, CL36);
  - (f) el reloj es etiquetado como "Espectáculo" y no se confunde visualmente con los otros dos.

**RF40** — El sistema deberá **conservar los campos nuevos a través de la validación y del guardado**: `Production.mode`, `Production.templateOrigin`, `Cue.timing` y los campos de danza de `PerformanceRunReport`.

- `productionSchema` deberá declarar `mode` y `templateOrigin` opcionales; `cueSchema` deberá declarar `timing` opcional con sus validaciones; el objeto validado que se persiste no puede perder esas claves.
- `saveProduction` y `createProductionWithPdf` persisten el modo y el origen de plantilla; `saveCue` persiste `timing` en todas sus ramas, incluida la de cues con libreto, y **si el objeto entrante no trae `timing`, conserva el ya guardado** (guardar solo notas no borra el tiempo).
- Debe existir `performanceSchema` con `mode?`, `cueLaunches?` y `trackRuns?` **todos opcionales**, y `savePerformance` valida con él antes de persistir; la validación no recorta ni elimina esos campos y un registro antiguo sin ellos sigue siendo válido.
- *Criterio de aceptación (ida y vuelta):*
  - (a) crear un proyecto Danza, guardarlo, recargar y comprobar que sigue en Danza con su documento;
  - (b) guardar un cue con `timing` (vínculo + objetivo + umbral), recargar y comprobar que conserva `timing` completo;
  - (c) editar solo la nota de ese cue y guardar: `timing` permanece idéntico;
  - (d) lanzar cues en función, recargar y comprobar que `cueLaunches` y `trackRuns` siguen en el registro con sus valores;
  - (e) guardar un proyecto estándar sin `mode` no añade claves ni rompe la validación;
  - (f) `savePerformance` valida un registro con `mode`, `cueLaunches` y `trackRuns` opcionales y los persiste completos; un registro antiguo sin esos campos también se guarda;
  - (g) aplicar una plantilla fija `templateOrigin` y editar después la plantilla no cambia ese valor en el proyecto.

**RF41** — El sistema deberá ubicar cada función de danza en la superficie definida en §1.6 y deberá impedir que un proyecto estándar acceda a superficies de danza.

- Rutas: `/documento`, `/documento/imprimir`, `/plantillas`, `/ajustes`, `/reportes/imprimir`, además de las existentes `/proyectos`, `/cues`, `/libretos`, `/modo-funcion`, `/reportes` e `/incidencias`.
- `/plantillas` y `/ajustes` son superficies de **aplicación**: no dependen del proyecto seleccionado, la entrada de `/plantillas` se muestra en la navegación en cualquier modo y no ofrecen aplicar plantillas a proyectos existentes ni crear un proyecto desde plantilla en un proyecto estándar.
- *Criterio de aceptación:*
  - (a) con un proyecto de danza, la navegación ofrece documento, plantillas, ajustes y reportes de danza;
  - (b) con un proyecto estándar, no se ofrecen `/documento`, `/documento/imprimir` ni controles de danza, y el acceso directo a `/documento` muestra el mensaje explicativo de §1.6;
  - (c) `/plantillas` y `/ajustes` funcionan sin ningún proyecto seleccionado;
  - (d) ninguna acción de `/plantillas` modifica un proyecto existente (RF29);
  - (e) con un proyecto estándar, `/plantillas` es accesible por URL y desde la navegación como biblioteca global, pero no ofrece aplicar al proyecto ni crear proyecto desde plantilla.

---

## 2.1 Dependencias entre requisitos

- **RF2 → RF1:** la ausencia de PDF obligatorio solo aplica si el modo elegido es Danza.
- **RF3 → RF1, RF40:** la persistencia y el condicionamiento de la UI dependen de que el modo se elija y se guarde sin recortes.
- **RF4 → RF5, RF6:** sin tracks ni tiempos no hay escaleta que generar.
- **RF7 → RF5, RF6:** el orden, los inicios y los totales se calculan sobre tracks y tiempos.
- **RF8 → RF4, RF7:** la impresión consume la escaleta ya ordenada y calculada.
- **RF9 → RF39, RF13, RF23:** iniciar el primer track arranca el reloj de espectáculo; sus estados y su tiempo activo alimentan cuentas atrás y desviaciones.
- **RF11 → RF9:** la escaleta viva muestra el estado del cronómetro de track.
- **RF12 → RF6, RF9, RF39:** el objetivo se calcula con el tiempo activo del track o del reloj de espectáculo.
- **RF13 → RF9, RF12, RF39:** sin referencia en marcha (o sin fin de track por duración) no hay cuenta atrás.
- **RF14 → RF13, RF32:** las bandas de color son una preferencia aplicada a cuentas atrás visibles.
- **RF15 → RF9, RF13, RF18, RF38:** "¡Lanzar!" nace del vencimiento de la cuenta atrás (incluido el final de track por duración) y solo es lanzable la siguiente.
- **RF16 → RF13, RF38:** el destacado único depende de la secuencia temporal.
- **RF17 → RF4, RF18, RF38:** la escaleta viva refleja la secuencia y los lanzamientos.
- **RF19 → RF3:** solo hay badge en proyectos de danza.
- **RF20 → RF19, RF36, RF37:** el cambio de modo presupone badge, registro abierto y descarte.
- **RF21, RF22 → RF9, RF20, RF38:** las reglas de navegación dependen del modo de ejecución, de la secuencia y del cierre de tracks.
- **RF23 → RF9, RF12, RF22, RF39:** solo se registran desviaciones en función, contra objetivos con referencia real y tiempo activo.
- **RF24 → RF23, RF36:** el informe se construye con las marcas registradas y el cierre de la función.
- **RF25 → RF23, RF37:** la separación de métricas depende de que ensayo no genere registros y de que el descarte borre el suyo.
- **RF26 → RF4, RF6, RF28, RF30:** la plantilla guarda tracks y vínculos existentes y comparte reglas de nombre y validación.
- **RF27 → RF26, RF40:** aplicar presupone una plantilla creada o importada y fija `templateOrigin` sin perderlo al guardar.
- **RF30, RF34 → RF26, RF27:** importar/exportar JSON reutiliza el mismo contrato y las mismas validaciones.
- **RF31 → RF3, RF40:** las notas viven en la ejecución y su guardado no puede borrar el tiempo.
- **RF32, RF33 → RF3, RF13, RF15:** accesibilidad aplicada a cuentas atrás, aviso y cambio de modo.
- **RF35 → RF3, RF6, RF26, RF40:** persistencia de todo lo anterior con integridad referencial y sin vínculos sin objetivo.
- **RF36, RF37 → RF9, RF22, RF23, RF24, RF35:** finalización y descarte cierran o anulan el registro que alimenta el informe y cierran los tracks abiertos.
- **RF38 → RF7, RF9, RF16:** la secuencia temporal usa el mismo orden determinista que la escaleta y distingue candidata de lanzable.
- **RF39 → RF9, RF23:** el reloj de espectáculo es la referencia en tiempo activo de los tiempos absolutos y las desviaciones.
- **RF40 → RF3, RF27, RF35:** la validación conserva `mode`, `templateOrigin`, `timing` y los campos del informe al guardar.
- **RF41 → RF3:** las superficies de danza de proyecto solo se ofrecen a proyectos de danza; `/plantillas` y `/ajustes` son de aplicación y siempre accesibles.

---

## 3. Casos límite y comportamientos ante errores

| # | Caso | Comportamiento esperado |
|---|------|-------------------------|
| CL1 | Proyecto estándar (nuevo o anterior) con la interfaz de danza disponible | No aparece ningún control, badge, sección, ruta ni exportación de danza; el flujo PDF y la spec 001 se comportan igual (RF3, RF41, §6). |
| CL2 | Proyecto de danza sin tracks ni cues | Documento con estado vacío explicativo; sin cuentas atrás ni cronómetros; se puede crear el primer track (RF4). |
| CL3 | Track sin duración | Se guarda como borrador, se marca "Sin duración" y no se puede iniciar; motivo visible (RF10). |
| CL4 | Track sin duración en medio de la cadena | No avanza el fin conocido: el siguiente track sin inicio explícito empieza en el último fin conocido y el incompleto se muestra "Sin duración" (RF7). |
| CL5 | Track con inicio explícito anterior al fin del anterior | Se coloca en su inicio, se marca "Solapa con el track anterior" y no se autocorrige (RF5, RF7). |
| CL6 | Dos tracks con el mismo `order` | Se permiten con aviso; desempate por `startAtMs` y luego `id` (RF7). |
| CL7 | Cue sin tiempo ni vínculo | Se agrupa en "Sin tiempo" al final del documento y de la secuencia; no genera cuenta atrás, no puede ser siguiente mientras queden cues con tiempo y no genera desviación (RF7, RF38). |
| CL8 | Objetivo dentro del track mayor que su duración | No se guarda; mensaje con el rango válido `00:00–duración` (RF6). |
| CL9 | Duración, tiempo o inicio con formato inválido (`1:75`, `-0:10`, `abc`) | Rechazo con mensaje en español; no se guarda; el valor anterior se conserva (RF5). |
| CL10 | Cuenta atrás en curso y el track se pausa | La cuenta atrás se oculta y se recalcula al reanudar; no se promete ninguna cifra congelada (RF13). |
| CL11 | Se reanuda el track con el objetivo ya superado | Se muestra "¡Lanzar!" y nunca una cuenta atrás negativa; con el track pausado el lanzamiento está deshabilitado con motivo (RF13, RF15, RF38). |
| CL12 | Track detenido manualmente antes de llegar al objetivo del cue | Desaparece la cuenta atrás y no se muestra "¡Lanzar!". En Función, los pendientes de ese track se marcan "no alcanzados" y la secuencia avanza; en Ensayo siguen pendientes y se pueden relanzar al reiniciar el track (RF9, RF13, RF22, RF24). |
| CL13 | El track llega a `00:00` con un cue pendiente | Si el cue es la siguiente y su objetivo es exactamente la duración, queda lanzable indefinidamente con `0` y "¡Lanzar!"; los demás pendientes con objetivo ya alcanzado se marcan "no alcanzado" en el informe. Nunca se muestra restante negativo (RF9, RF13, RF24). |
| CL14 | La cuenta atrás llega a `0` | Se muestran a la vez la cifra `0` y "¡Lanzar!", con la banda del 0 y el aviso en color de peligro (RF13, RF15). |
| CL15 | Dos cues comparten tiempo absoluto | Se ordenan por identificador natural (`LX-2` antes que `LX-10`) y luego `id`; se lanzan en ese orden y solo la primera es siguiente (RF7, RF38). |
| CL16 | La cuenta atrás de una cue no siguiente llega a `0` | No aparece su "¡Lanzar!" ni su control; espera a ser la siguiente (RF16, RF38). |
| CL17 | Intento de lanzar una cue que no es la siguiente en Función | Sin efecto; el control está deshabilitado con el motivo "En función solo se puede lanzar la siguiente cue de la escaleta." (RF22, RF38). |
| CL18 | La siguiente cue es de un track pausado o terminado manualmente | En Función se muestra como candidata pero **no es lanzable**: control deshabilitado con "Reanuda el track para lanzar esta cue." si está pausado; si terminó manualmente, sus pendientes son "no alcanzado" y la secuencia ya avanzó. Si terminó por duración con objetivo en la duración, **sí** es lanzable (RF9, RF15, RF22, RF38, D23). |
| CL19 | Cue con `atMs` lanzado sin haber arrancado el reloj de espectáculo | Se registra como lanzado sin desviación y se informa como "sin referencia temporal" (RF12, RF23, RF24). |
| CL20 | Se inicia un segundo track | El reloj de espectáculo no se reinicia; solo arranca con el primero o con "Iniciar espectáculo" (RF39). |
| CL21 | Doble activación del mismo lanzamiento | Un solo lanzamiento y una sola marca (RF18). |
| CL22 | Lanzamiento simultáneo desde dos controles | Un solo lanzamiento; no se duplica la marca de desviación (RF18). |
| CL23 | Cue lanzado a mano antes de que empiece su cuenta atrás | Se registra como lanzado; la cuenta atrás no llega a mostrarse; la desviación es negativa respecto al objetivo (RF23). |
| CL24 | Cue lanzado después de `0` | La desviación es positiva; el aviso "¡Lanzar!" desaparece al lanzar (RF15, RF23). |
| CL25 | Fallo al crear/guardar el registro en el primer lanzamiento | Se revierte íntegramente: contador, estado de la cue, bloqueo de producción y registro; error legible y reintento (RF18). |
| CL26 | Fallo de guardado en un lanzamiento posterior | El contador no se incrementa, se conserva el último estado y el reintento usa el instante original (RF18, RF23). |
| CL27 | Cambio de modo en Función con registro abierto o track En marcha | Bloqueado, con motivo visible y sin efecto (RF20). |
| CL28 | Cambio de modo en Ensayo con lanzamientos o track En marcha | Permitido con confirmación; al aceptar se reinicia todo y no se arrastra nada (RF20, RF21). |
| CL29 | Intento de rebobinar, saltar o reiniciar un track en Función | Sin efecto y con aviso explicativo que remite a Ensayo (RF22). |
| CL30 | "Finalizar función" con registro abierto y cues pendientes | Confirmación que indica cuántos quedan; los pendientes con objetivo pasan a "no alcanzado" y los sin objetivo a "pendiente no lanzado"; se cierran registro y `TrackRun`, se libera la producción y se ofrece el informe (RF24, RF36). |
| CL31 | Finalizar con registro abierto sin ningún lanzamiento (solo cronómetro) | Se cierra con 0 lanzamientos e informe "sin cues lanzados" (RF20, RF36). |
| CL32 | "Finalizar función" sin registro abierto | Deshabilitado. Si hay un track En marcha, el motivo es "Inicia la función o lanza una cue para poder finalizarla."; si no hay registro ni track, "No hay ninguna función en curso.". No se crea ningún registro (RF36). |
| CL33 | "Descartar función" con un registro abierto | Confirmación; se borra el registro; contadores, tracks y relojes a cero; no cuenta en métricas ni reportes; el modo sigue en Función (RF37). |
| CL34 | "Descartar función" sin registro abierto | No se ofrece la acción (RF37). |
| CL35 | Fallo al descartar la función | Se conserva el registro y el estado; error con reintento; nunca contadores a cero con registro vivo (RF37). |
| CL36 | Recarga de la página en mitad de una ejecución | El estado en memoria se pierde (limitación conocida, igual que en la 001): cronómetros, reloj de espectáculo y tracks en marcha. El registro ya abierto permanece en el almacenamiento sin `endedAt` y no queda ningún `TrackRun` abierto, porque solo se persiste al cerrarse. Al volver, ese registro se lista como "registro de una sesión anterior" y "Finalizar"/"Descartar" de la sesión nueva no actúan sobre él (RF35, RF36, RF37, §9). |
| CL37 | Función sin ningún cue con objetivo | El informe se genera con "sin objetivos" y lista los cues lanzados sin desviación; no divide por cero ni muestra medias vacías (RF24). |
| CL38 | Archivo JSON de plantilla corrupto, truncado, con `formatVersion` no soportada, `kind` incorrecto o tipos inválidos | Error legible, ninguna escritura parcial y ninguna plantilla creada (RF30). |
| CL39 | Plantilla con cues cuyo `trackKey` no existe al importar | **No se rechaza**: se importa reparando, desvinculando esos cues, conservando `atMs` si lo tenían y quedando "sin tiempo" si solo tenían `trackOffsetMs`; se informa del número de reparaciones (RF30). |
| CL40 | Importar o duplicar una plantilla con un nombre ya existente | Se crea una nueva con sufijo `" (2)"`, `" (3)"`…; nunca se sobrescribe (RF30). |
| CL41 | Eliminar una plantilla usada por proyectos | Confirmación; los proyectos no cambian (RF28, RF29). |
| CL42 | Eliminar una producción de danza / borrar todas las producciones | Se eliminan sus tracks; las plantillas y las preferencias sobreviven a `deleteAllProductions` (RF35). |
| CL43 | Eliminar un track con cues vinculados | Confirmación con el número de cues; al confirmar, cada cue conserva su último tiempo absoluto como `atMs`; si solo tenía `trackOffsetMs`, queda "sin tiempo" y se informa (RF35). |
| CL44 | Cue con `trackId` que no existe (dato importado o manipulado) | Se trata como sin tiempo y se marca "Track no encontrado"; no se escribe automáticamente; se ofrece desvincular o reasignar (RF35). |
| CL45 | Guardar solo la nota de un cue con tiempo | El tiempo, el vínculo y el umbral se conservan intactos; no cambia la escaleta ni la secuencia (RF31, RF40). |
| CL46 | Recarga tras crear un proyecto Danza y guardar cues con tiempo | El proyecto sigue en Danza y los cues conservan `timing`; los lanzamientos y tracks del informe siguen presentes (RF3, RF35, RF40). |
| CL47 | Imprimir con el tema oscuro o con alto contraste | La vista imprimible es siempre clara, con texto negro y sin fondos; el PDF no hereda el tema (RF8, RF32). |
| CL48 | Navegador bloquea el audio de confirmación | Solo confirmación visual, sin error bloqueante y sin reintentos en bucle (RF18). |
| CL49 | Configuración de bandas solapadas, con huecos, sin banda de `0`, con color fuera de la paleta o que no cubre el umbral | Rechazo con mensaje; se mantiene la configuración válida anterior. Los colores solo pueden ser `red`, `orange`, `green`, `blue` o `yellow`; no se acepta hexadecimal libre (RF14, RF32). |
| CL50 | Dos tracks con el mismo título o dos cues con el mismo identificador en el mismo proyecto o plantilla | Se permite guardar, pero el documento y la plantilla muestran un aviso de duplicados para que el usuario decida (RF7, RF26, D16). |
| CL51 | Guardar una plantilla parcial seleccionando un cue de un track sin incluir el track | No se permite: el track se marca automáticamente con todos sus cues o el control aparece deshabilitado con el motivo; nunca se genera una plantilla con cues desligados de su línea de tiempo (RF26, D17). |
| CL52 | Proyecto de danza sin PDF e intento de abrir el libreto | Mensaje "Este proyecto no tiene un PDF de libreto."; el documento estructurado sigue disponible (RF2, RF4, RF41). |
| CL53 | Proyecto de danza con PDF subido | El PDF sigue accesible como libreto complementario; el documento estructurado es el contenido principal y no se sustituye por el PDF (RF41, D2). |
| CL54 | Intento de editar estructura o tiempos en Función | Bloqueado con motivo "En función la escaleta no se edita. Cambia a Ensayo."; las notas siguen editables (RF11, RF31). |
| CL55 | Plantilla con un cue SIM con menos de dos `includedTypes` | No se puede guardar ni importar; el mensaje indica que un cue simultáneo necesita al menos dos tipos (RF26, RF30). |
| CL56 | Editar solo el nombre o la descripción de una plantilla | No incrementa la versión y no altera tracks ni cues (RF28). |
| CL57 | Lanzar la última cue pendiente con el reloj de espectáculo parado | La función finaliza igual (vía 1) y las desviaciones sin referencia se informan como tales (RF23, RF36). |
| CL58 | Iniciar un track posterior saltándose uno Pendiente en Función | El inicio no se ofrece: solo el primer track Pendiente es iniciable; el control muestra el motivo (RF22). |
| CL59 | La siguiente cue tiene objetivo exactamente igual a la duración del track | Al llegar el track a `00:00` queda Terminado por `duration` y la cue sigue lanzable **indefinidamente** con `0` y "¡Lanzar!"; al lanzarla, `actualOffsetMs = durationMs` y desviación `0`. Solo deja de estar disponible si se lanza o la función se detiene/finaliza (RF9, RF13, RF23, RF38). |
| CL60 | Detener manualmente un track con cues pendientes | En Función pide confirmación y, al confirmar, el track queda Terminado con `endedBy: "manual"`, sus pendientes pasan a "no alcanzado" y la secuencia avanza a otra cue. En Ensayo no se marcan no alcanzados: quedan pendientes y se relanzan al reiniciar el track (RF9, RF22, RF24). |
| CL61 | Plantilla con `trackOffsetMs` mayor que la `durationMs` de su track | La operación se rechaza con mensaje en español y no se escribe ninguna plantilla parcial; no se recorta el offset ni se crea un cue inválido (RF26, RF30). |
| CL62 | Registro abierto de una sesión anterior tras recargar | Se lista como "registro de una sesión anterior"; "Finalizar función" y "Descartar función" de la sesión actual no lo modifican ni lo borran. Queda como limitación conocida de la 001, sin recuperación determinista (RF36, RF37, CL36, §9). |
| CL63 | Edición de `/documento` según el estado | Sin ejecución activa es editable; durante Ensayo sigue editable; durante Función es de solo lectura salvo notas y observaciones. La pestaña interna "Documento" de `/modo-funcion` es consulta y no equivale a la ruta `/documento` (RF11, RF31). |
| CL64 | `Cue.timing.trackId` sin `trackOffsetMs` | Se trata como **sin vínculo**: no hay cue vinculado sin objetivo. No se inventa un offset ni se genera cuenta atrás; el cue se resuelve como sin tiempo o con su `atMs` si lo tiene (RF6, RF35, §4.3). |

---

## 4. Impacto en el modelo de datos

Todos los campos y entidades nuevos son **opcionales o nuevos registros**: no se migra ni se reescribe ningún dato existente. Se añade una versión del esquema local (Dexie) con las tablas nuevas; las tablas actuales no cambian de clave. **Los campos nuevos deben declararse en la ruta de validación** para que no se recorten al guardar (RF40).

### 4.1 Producción

- `Production.mode?: "standard" | "dance"` — ausente = `"standard"`. Es el **modo del proyecto** (distinto del modo de ejecución de la sesión, §1.7) y determina toda la interfaz de danza (RF3).
- `Production.templateOrigin?: { templateId: string; name: string; version: number }` — se fija al aplicar una plantilla y **no cambia** al editar la plantilla después (RF27, RF40). Es trazabilidad, no un vínculo vivo.
- Ambos deben estar declarados en el esquema de validación y conservarse en `saveProduction` y `createProductionWithPdf` (RF40).
- Se mantiene `Production.scenes` como está (sin uso).

### 4.2 Track

```
DanceTrack {
  id: string;
  productionId: string;
  title: string;
  durationMs?: number;      // ausente = borrador sin duración (RF10); si existe, > 0
  order: number;            // orden manual; duplicados permitidos con aviso (RF7)
  startAtMs?: number;       // inicio explícito desde 00:00; ausente = derivado (RF5, RF7)
  notes: string;
}
```

- `startAtMs` se fija y se limpia desde la ficha del track; `≥ 0` y `≤ 86 400 000` (24 h), **mismo rango que `atMs`**.
- El cronómetro del track y los objetivos de sus cues se miden en **tiempo activo** (sin pausas); los estados posibles son `Pendiente | En marcha | Pausado | Terminado` y el cierre manual se distingue con `endedBy` (§4.5) (RF9).
- Un inicio explícito anterior al fin del track anterior no se rechaza: se avisa de solape y no se autocorrige (RF7).
- La cadena de inicios y el total se calculan con el algoritmo de RF7; ningún inicio derivado se persiste.

### 4.3 Tiempo de cue (campos opcionales en `Cue`)

```
Cue.timing?: {
  trackId?: string;         // vínculo al track (opcional)
  trackOffsetMs?: number;   // objetivo dentro del track (opcional), >= 0
  atMs?: number;            // tiempo absoluto desde 00:00 (opcional), >= 0
  alertBeforeMs?: number;   // umbral de cuenta atrás, por defecto 10000, rango 1000..60000
}
```

- Si `trackId` + `trackOffsetMs` existen, `atMs` es **derivado**: no es la fuente y no se edita; no se persiste como fuente (RF35).
- Un `trackId` **sin `trackOffsetMs`** se trata como **sin vínculo** (RF35): no existe cue vinculado sin objetivo.
- Si no hay vínculo, `atMs` es la fuente editable; rango `0 ≤ atMs ≤ 86 400 000` (24 h), **el mismo que `startAtMs`**.
- `trackOffsetMs` admite `0 ≤ objetivo ≤ duración`; el valor igual a la duración es válido (final del track, RF9).
- Al desvincular o borrar el track se **materializa** el último tiempo absoluto calculado en `atMs`; si no era calculable (solo `trackOffsetMs` sin track), el cue queda "sin tiempo" y se informa (RF35).
- Resolución de un cue: **vinculado** (`trackId` resuelve), **huérfano** (`trackId` no resuelve: se trata como sin tiempo, con aviso, sin escritura automática) o **sin tiempo**. Es un cálculo, no un campo persistido.
- `alertBeforeMs` se valida en el rango 1 000–60 000; fuera de rango se rechaza al guardar (RF13, RF40).

### 4.4 Plantilla

```
ScheduleTemplate {
  id: string;
  name: string;                    // obligatorio; si se repite, sufijo " (2)", " (3)"… (nunca sobrescribe)
  description: string;             // opcional (cadena vacía si no se indica)
  version: number;                 // 1; incrementa al guardar contenido (RF28)
  createdAt: string;
  updatedAt: string;
  sourceTemplateId?: string;       // solo si es duplicado
  tracks: ScheduleTemplateTrack[];
  cues: ScheduleTemplateCue[];
}

ScheduleTemplateTrack {
  key: string;                     // clave local, única dentro de la plantilla
  title: string;
  durationMs?: number;
  order: number;
  startAtMs?: number;
  notes: string;
}

ScheduleTemplateCue {
  identifier: string;
  type: CueType;
  includedTypes?: CueComponentType[];  // obligatorio con >= 2 si type = "SIM"
  description: string;
  pie?: string;
  observations: string;
  department: DepartmentName;
  act: string;
  scene: string;
  status: CueStatus;               // por defecto "Borrador" al crear
  executionState: CueExecutionState; // por defecto "Preparación" al crear
  trackKey?: string;               // ausente = cue suelto con atMs
  trackOffsetMs?: number;
  atMs?: number;
  alertBeforeMs: number;           // por defecto 10000
}
```

- **Defaults al crear/aplicar:** `status = "Borrador"`, `executionState = "Preparación"`, `alertBeforeMs = 10000`. El resto de campos se completan con los valores por defecto del `Cue` vigente, de modo que el cue reconstruido es válido.
- **Nombre:** obligatorio; si ya existe, se añade `" (2)"`, `" (3)"`… en creación, guardado desde proyecto, duplicado, importación y renombrado (RF26, RF28, RF30).
- **Validación de offset:** `trackOffsetMs ≤ durationMs` del track referenciado; si lo supera, se rechaza la operación y no se escribe nada (RF26, RF30).
- `trackKey` es una clave local de la plantilla (no un id de track) para poder remapear los vínculos al aplicarla (RF27). Un `trackKey` huérfano no bloquea la importación: se repara desvinculando el cue (RF30).
- Un cue sin `trackKey` es un **cue suelto**: se guarda con su `atMs` y se aplica como cue sin track con ese tiempo absoluto (RF26).
- Un cue con `trackKey` debe apuntar a un track presente en la misma plantilla; si no, la importación lo desvincula y lo informa (RF30).
- El contrato JSON que envuelve la plantilla se define en RF30 y RF34: `format`, `formatVersion`, `kind` (`template` | `schedule`), `exportedAt` y `template`.
- Al aplicar, los campos ausentes de un cue se completan con los valores por defecto indicados, de modo que el `Cue` resultante cumple el esquema vigente.

### 4.5 Registro de función (campos opcionales en `PerformanceRunReport`)

```
PerformanceRunReport.mode?: "show";   // ausente = "show". En fase 1 no se escribe "rehearsal" (D7)
PerformanceRunReport.cueLaunches?: CueLaunchEvent[];
PerformanceRunReport.trackRuns?: TrackRun[];

CueLaunchEvent {
  id: string;
  cueId: string;
  cueIdentifier: string;
  cueDescription: string;     // instantánea en el lanzamiento (informe reproducible)
  cuePie?: string;            // instantánea
  cueObservations?: string;   // instantánea
  launchedAt: string;        // ISO, instante real capturado en la activación (RF18, RF23)
  elapsedMs: number;         // tiempo desde la apertura del registro, coherente con la 001
  showOffsetMs?: number;     // tiempo activo del reloj de espectáculo en el lanzamiento; ausente si no había reloj
  trackId?: string;
  trackStartAt?: string;     // inicio real del track en esta ejecución
  targetOffsetMs?: number;   // objetivo dentro del track, si lo tenía
  actualOffsetMs?: number;   // tiempo activo del track en el lanzamiento, si se pudo calcular
  deviationMs?: number;      // real − objetivo; ausente si no había referencia (RF23)
}

TrackRun {
  trackId: string;
  title: string;
  startedAt: string;
  endedAt: string;           // solo se persisten ejecuciones cerradas
  actualElapsedMs: number;   // tiempo activo acumulado, sin pausas
  endedBy: "duration" | "manual"; // distingue fin natural de parada manual (RF9)
}
```

- **`performanceSchema`:** `savePerformance` valida con un esquema que declara `mode?`, `cueLaunches?` y `trackRuns?` como **opcionales**; la validación no recorta esos campos (RF40).

- Los registros antiguos sin `mode` se interpretan como `"show"` (RF25) y siguen siendo válidos.
- En modo ensayo **no se persiste ningún registro** (D7): no hay `mode: "rehearsal"` que escribir y el valor queda reservado para fase 2 (§9), no en el modelo de fase 1.
- `launchedCueCount` se mantiene sincronizado con `cueLaunches.length` al guardar (RF24).
- **Un `TrackRun` solo se persiste cuando se cierra** (parada manual, fin natural por duración, cambio de track, salida de la vista, finalización o descarte) y lleva `endedBy: "duration" | "manual"`. Mientras el track está En marcha o Pausado, su tiempo activo vive en memoria (D30); así una recarga nunca deja una ejecución abierta en el almacenamiento.
- Las **instantáneas** `cueDescription`, `cuePie` y `cueObservations` se escriben en el lanzamiento y son la fuente del informe, de modo que editar el cue después no altera el informe (RF24).
- `showStartedAt` **no se persiste**: es estado de sesión (RF39); se pierde al recargar, como los cronómetros (CL36). Su valor visible y los offsets son **tiempo activo**.

### 4.6 Preferencias de danza

```
CountdownBand {
  minSeconds: number;               // entero >= 0
  maxSeconds: number;               // entero >= minSeconds
  color: "red" | "orange" | "green" | "blue" | "yellow";  // paleta cerrada, sin hex libre
  label: string;                    // obligatoria, no vacía
}

DancePreferences {                    // tabla appSettings, fila id = "dance"
  id: "dance";
  countdownBands: CountdownBand[];
  fontScale: "normal" | "grande" | "muy-grande";   // factores 1, 1,25 y 1,5
  highContrast: boolean;
  soundFeedback: boolean;             // por defecto false
  defaultAlertBeforeMs: number;       // por defecto 10000
  updatedAt: string;
}
```

- Valores por defecto de `countdownBands`: `{4,10,"red","Rojo"}`, `{2,3,"orange","Naranja"}`, `{0,1,"green","Verde"}`. Las clases predefinidas de la paleta usan `#DC2626`, `#EA580C` y `#16A34A` en tema claro y cumplen AA sobre el fondo de la cifra (RF14).
- Validación: bandas contiguas desde `0`, sin huecos ni solapes; banda de `0` obligatoria; máximo de la banda superior entre `1` y `60`; `defaultAlertBeforeMs` dentro de la cobertura; `label` no vacía; contraste AA del color contra el fondo de la cifra en tema claro y oscuro (RF14).
- Son preferencias locales de la aplicación, no datos del espectáculo: no se incluyen en las exportaciones JSON ni se comparten entre dispositivos (D13).

### 4.7 Datos derivados (no persistidos)

- La **escaleta** (orden, inicios calculados, tiempos absolutos derivados, duración total, sección "Sin tiempo") es siempre una función pura de `DanceTrack[] + Cue[]`.
- La **siguiente cue** de la secuencia en función es una función pura del mismo conjunto y del estado de la sesión (RF38).
- El **informe de desviaciones** es una función pura de `PerformanceRunReport` (no se guarda una copia del informe).
- La **detección de track inexistente** y la **materialización de `atMs`** son operaciones de cálculo/guardado, nunca marcas persistidas aparte (RF35).
- El **reloj de espectáculo** y los tracks en marcha son estado de sesión en memoria, no datos persistidos (RF39, D30).

### 4.8 Almacenamiento local

- Nueva versión del esquema local con las tablas: `danceTracks: "id, productionId, order"`, `scheduleTemplates: "id, name, updatedAt"`, `appSettings: "id"`.
- `danceTracks` pertenece a una producción; `scheduleTemplates` no tiene `productionId` (aislamiento, RF29); `appSettings` guarda una única fila de preferencias de danza.
- `performances` mantiene su clave; el informe extendido vive dentro de `Performance.runReport`.
- Sin migración destructiva: los registros existentes sin los campos nuevos se leen con los valores por defecto definidos aquí.

---

## 5. Efectos en la interfaz y accesibilidad

- **Selector de modo en el alta:** control de dos opciones con etiqueta y descripción, preseleccionado "Estándar (PDF)", navegable con teclado y con el modo explicado en texto. En Danza, el PDF es opcional y se puede elegir plantilla inicial o "Empezar de cero".
- **Ficha del proyecto:** el modo se muestra como etiqueta textual ("Estándar" / "Danza") junto al título; en danza se indica el origen de plantilla y versión, solo como trazabilidad.
- **Navegación:** las rutas de §1.6; documento, plantillas, ajustes y reportes de danza se ofrecen según el modo del proyecto, salvo plantillas y ajustes, que son de aplicación.
- **Documento/escaleta:** tres secciones ("Tracks", "Cues", "Sin tiempo") con columnas de tiempo, track, cue, tipo, descripción y notas; en cabecera, totales (tracks, cues, duración); avisos visibles de solape, duplicados, "Sin duración" y "Track no encontrado". Sin fondos chillones; el color del tipo de cue acompaña, nunca sustituye al texto.
- **Tres relojes distinguidos:** "Función" (cronómetro de función), "Espectáculo" (reloj de espectáculo) y el del track activo. El de track es la cifra dominante de su panel, con etiqueta de estado textual ("Pendiente", "En marcha", "Pausado", "Terminado"). Ninguno se confunde con otro por color o disposición.
- **Cuenta atrás:** números grandes, banda de color de fondo o borde con alto contraste, y la etiqueta textual de la banda junto al número, para que el color no sea la única información (RF14). A `0` se ven la cifra y "¡Lanzar!".
- **"¡Lanzar!":** el elemento más prominente cuando aparece; área táctil amplia (`≥ 44×44 px`), parpadeo de 400 ms on/off y alternativa estática con `prefers-reduced-motion` (RF15, RF33). Solo aparece para la cue siguiente (RF38).
- **Badge de modo y cambio:** badge permanente en la barra superior de la ejecución, con texto "ENSAYO"/"FUNCIÓN", color propio y `aria-label`; junto a él, el control "Cambiar a Ensayo"/"Cambiar a Función", con confirmación y motivo cuando está bloqueado (RF19, RF20).
- **Finalizar y descartar:** "Finalizar función" y "Descartar función" en la barra o panel de acciones de la ejecución, con confirmación cuando corresponde y estado deshabilitado con motivo (RF36, RF37). "Descartar" se presenta como acción destructiva, separada visualmente.
- **Bloqueos comprensibles:** todo control no disponible por el modo (rebobinar en función, lanzar una cue no siguiente, iniciar track sin duración, iniciar un track que no toca, editar la escaleta en función, cambiar de modo con registro abierto) se muestra atenuado con motivo asociado, nunca pulsable sin efecto.
- **Escaleta viva:** vista combinada con estado por track y por cue, siguiente cue destacada, legible a `360 px` de ancho sin scroll horizontal en las operaciones principales (RF33).
- **Alto contraste y tamaño:** ambas preferencias actúan sobre los tres relojes, cuentas atrás, identificadores, botones de lanzamiento y "¡Lanzar!"; contraste mínimo AA; las vistas imprimibles siempre son claras y con tamaño fijo (RF32).
- **Foco y teclado:** orden de tabulación estable (track → lanzamiento → cambio de modo → notas); el lanzamiento no roba el foco; los atajos no se activan cuando el foco está en un campo editable (como ya ocurre en el modo tec de la 001).
- **Anuncios:** región `aria-live="polite"` para hitos y una región asertiva para "¡Lanzar!", "no alcanzado" y errores; solo se anuncian los segundos del umbral que existan, nunca todos (RF33).
- **Notas:** campo de nota accesible desde la fila del cue en ejecución, con guardado confirmado y sin mover la secuencia ni los cronómetros (RF31).
- **Sin sorpresas:** iniciar un track, lanzar un cue, finalizar, descartar o guardar una nota no desplaza el scroll ni cierra el documento abierto.

---

## 6. Qué NO se debe romper (regresiones a evitar)

1. **Flujo Estándar completo:** creación de proyecto con PDF obligatorio, subida y reemplazo de PDF, etiquetas de acto/escena/cue, generación y numeración de cues desde el PDF, borrado en cascada. Nada de esto cambia (RF2, RF3).
2. **Modo función de la spec 001:** lanzar cues sin cronómetro, creación del registro en el primer lanzamiento, finalización por última cue, bloqueo de producción, antirrebote, reversión en el primer lanzamiento fallido, reintento en fallos posteriores con el instante original, cierre del registro al cambiar de producción o salir. En proyectos estándar debe comportarse **exactamente** igual; en proyectos de danza conserva esas garantías (RF18, RF22, RF36) con **tres excepciones explícitas y acotadas**: el ensayo no persiste (D7), "Descartar función" anula el registro abierto de la sesión (D20, RF37) y detener manualmente un track en Función cierra sus cues pendientes como "no alcanzados" (D31, RF9).
3. **Cronómetro de función intacto:** el cronómetro de track y el reloj de espectáculo no alteran el de función, ni sus descansos, ni la preparación de función (avisos 30/15/5 y seis checks), ni las incidencias rápidas. El único acoplamiento permitido es que el primer track arranque el reloj de espectáculo (RF9, RF39).
4. **Progreso de cues:** contador, porcentaje, últimas lanzadas y cola de siguientes siguen funcionando en proyectos estándar; en danza se añaden la escaleta viva y la secuencia temporal sin quitar lo existente (RF17, RF38).
5. **Libreto PDF:** sigue funcionando en proyectos estándar; en danza es opcional y complementario, sin sustituir al documento (CL52, CL53).
6. **Preparación y modo tec:** los atajos existentes no cambian de significado en proyectos estándar; en danza, el retroceso no está disponible en modo función (RF22).
7. **Panel de control:** el contador de funciones sigue leyendo correctamente los registros con `durationMs` 0 y sin `mode` (RF25).
8. **Incidencias y reportes:** la página de incidencias no cambia; reportes deja de ser un placeholder vacío **solo** para añadir el informe de funciones de danza, sin eliminar el contenido informativo actual (RF24).
9. **Persistencia y validación:** los datos existentes se abren sin migración destructiva; ninguna operación de danza modifica cues o producciones estándar; los campos nuevos (`Production.mode`, `Cue.timing`, informe) **no se pierden al guardar** y guardar una nota no borra el tiempo (RF35, RF40).
10. **Calidad:** siguen pasando `npm run lint` y `npm run build`, sin avisos nuevos. No se inventan pruebas automatizadas: la verificación es el lint, el build y el guion manual de §11.

---

## 7. Trazabilidad resumida

| Requisito / decisión | Cubre la petición |
|---|---|
| RF1, RF2, RF3, RF40 | Selector de modo al crear, persistencia real del modo, PDF opcional en danza |
| RF4, RF7, RF17 | Documento estructurado, orden determinista y escaleta generada/viva |
| RF5, RF6, RF10 | Tracks con duración, orden, inicio explícito y notas; cues con tiempo; borradores |
| RF8, RF41 | PDF por impresión y superficies de navegación |
| RF9, RF39 | Cronómetro de track, ciclo de vida y reloj de espectáculo independiente |
| RF12, RF13, RF14, RF15, RF16 | Objetivo calculado, cuenta atrás, colores exactos, "¡Lanzar!" y destacado único |
| RF18, RF23 | Lanzamiento idempotente, fallos de guardado y desviaciones con referencia real |
| RF19, RF20 | Badge permanente, control de cambio y bloqueo acotado |
| RF21, RF22, RF38 | Ensayo libre vs función con secuencia temporal única |
| RF24, RF25 | Informe de desviaciones, "no alcanzado" y métricas separadas |
| RF36, RF37 | Doble vía de finalización y descarte de función |
| RF26, RF27, RF28, RF29, RF30 | Plantillas: crear (total/parcial), aplicar al crear, editar/versionar, aislar, JSON |
| RF31 | Notas por cue en ejecución sin borrar el tiempo |
| RF32, RF33 | Accesibilidad configurable y operación por teclado/lector |
| RF34, RF35 | Exportación JSON de escaleta e integridad/persistencia |
| D2, D4, D5 | Documento = escaleta; integración en `/modo-funcion`; PDF por impresión |
| D6, D7, D8 | Modo por defecto, ensayo no persistido, un tiempo por cue |
| D9, D10, D11 | Un track en marcha, plantilla como copia, versionado simple |
| D12, D13, D14, D15 | Orden derivado, preferencias locales, badge en la ejecución, informe consultable |
| D16, D17 | Duplicados tolerados y selección parcial de plantilla |
| D18, D19, D20 | Secuencia única, dos finalizaciones, descarte acotado |
| D21, D22, D23 | Reloj de espectáculo, definición de "no alcanzado", lanzamiento solo con track en marcha |
| D24, D25, D26, D27 | Timing no persistido, validación sin recortes, editor de plantilla, contrato JSON |
| D28, D29, D30 | Preferencias validadas, superficies, `TrackRun` solo al cerrar |
| D31, D32, D33 | Fin de track por duración vs parada manual, tiempo activo, registro abierto y finalización/descarte acotados |
| D34, D35, D36, D37 | Paleta cerrada de bandas, instantáneas del cue en el informe, origen de plantilla, esquema de función validado |
| RF12, RF13, RF23, RF39 | Tiempo activo como referencia de objetivos, cuentas atrás y desviaciones |
| RF14, RF32, RF33 | Bandas contiguas y paleta cerrada con etiqueta y contraste |
| RF22, RF36, RF37, RF38 | Candidata vs lanzable, finalización con registro, descarte y secuencia única |

---

## 8. Decisiones tomadas

- **D1 — Cue reutilizado.** Los cues de danza son la entidad `Cue` existente más un campo opcional `timing`. Se descarta crear `DanceCue` porque duplicaría tipos, colores, numeración, departamentos y toda la lógica de ejecución, y obligaría a mantener dos caminos de lanzamiento.
- **D2 — El documento es la escaleta.** El "documento estructurado" es la escaleta derivada de tracks y cues; no hay editor de texto enriquecido ni un segundo libreto. Se descarta un editor de texto porque duplicaría el libreto y no aporta nada a la operación.
- **D3 — Sin audio.** Los tracks son lógicos: duración + cronómetro. Se descarta reproducir audio porque introduce gestión de archivos, licencias, buffers y fallos de reproducción sin mejorar la operación (el regidor ya lanza la música desde su reproductor).
- **D4 — Ejecución integrada.** El modo danza vive dentro de la vista de `/modo-funcion`, con paneles adicionales cuando el proyecto es de danza. Se descarta una ruta `/modo-danza` para no duplicar cronómetros, preparación, incidencias y libreto.
- **D5 — PDF por impresión.** La exportación usa una vista imprimible y el "Guardar como PDF" del navegador. Se descarta añadir una librería de generación de PDF: coste alto, resultados peores y una dependencia nueva para algo que el navegador hace bien.
- **D6 — Modo por defecto: Función.** Al entrar en la ejecución de un proyecto de danza el modo es "FUNCIÓN", porque el caso de uso crítico es la función y un ensayo mal etiquetado no debe poder generar métricas falsas. No se recuerda el último modo usado: entrar siempre en "FUNCIÓN" evita arrancar una función creyendo que se está ensayando.
- **D7 — El ensayo no se persiste.** El ensayo no crea registro de función, no guarda desviaciones y no bloquea la producción: es una herramienta de trabajo. Se descarta persistir ensayos con `mode: "rehearsal"` porque exigiría filtrar métricas en todas las vistas y añadiría registros que ninguna vista consulta. Consecuencia asumida: durante un ensayo los lanzamientos no quedan registrados (excepción explícita y acotada a danza+ensayo; los proyectos estándar conservan la garantía de la 001).
- **D8 — Un único tiempo por cue.** Un cue puede tener vínculo a track + objetivo, o tiempo absoluto, pero no ambos como fuentes: si hay vínculo, el absoluto se deriva. Se descarta mantener dos tiempos editables porque generarían contradicciones en la escaleta.
- **D9 — Un track en marcha a la vez.** Se descarta el multi-track simultáneo en fase 1 (fase 2): un solo cronómetro de track activo, con confirmación al cambiar de track.
- **D10 — Plantilla = copia.** Aplicar una plantilla crea copias independientes; no hay vínculo vivo. Se descarta referenciar la plantilla desde el proyecto (sincronización implícita) porque rompería el aislamiento exigido y haría impredecible el proyecto.
- **D11 — Versionado simple.** La plantilla guarda un número de versión que incrementa al guardar contenido; no hay historial ni restauración en fase 1 (fase 2). Se descarta guardar snapshots de cada versión porque no hay requisito de restaurar todavía.
- **D12 — Orden de escaleta derivado.** Tracks consecutivos por orden, con inicio explícito opcional; cues por tiempo absoluto, con identificador natural como desempate; sin tiempo al final. Se descarta ordenar manualmente la escaleta completa porque introduciría un tercer orden que mantener.
- **D13 — Preferencias locales.** Colores, tamaño, contraste y sonido son preferencias de la aplicación, no del espectáculo: no se exportan ni se comparten. Se descarta guardarlas por producción porque el regidor quiere una cabina coherente entre obras.
- **D14 — Badge en la barra de la ejecución.** El badge ENSAYO/FUNCIÓN vive en la barra superior de la vista de ejecución (visible en todas sus pestañas internas), no en la cabecera global de la aplicación. Se descarta la cabecera global porque el modo solo existe mientras hay una ejecución abierta y la cabecera no conoce ese estado sin acoplarse a la vista.
- **D15 — Informe consultable.** El informe de desviaciones se muestra al finalizar y queda consultable en reportes para proyectos de danza. Se descarta dejarlo solo en memoria porque se perdería en la primera recarga y no serviría para revisar la función al día siguiente.
- **D16 — Identificadores duplicados tolerados.** En proyectos y plantillas se permiten identificadores repetidos (y órdenes de track repetidos), con aviso visible; no hay renumeración automática. Se descarta forzar unicidad en el modelo porque la aplicación ya permite identificadores libres y una restricción nueva rompería datos existentes.
- **D17 — Selección parcial de plantilla.** Se pueden guardar tracks completos (con todos sus cues) y cues sueltos sin track. Se descarta la selección granular de cualquier cue, incluidos los de un track: produciría plantillas con cues desligados de su línea de tiempo, cuentas atrás imposibles y escaletas incoherentes (RF26, §4.4).
- **D18 — Secuencia temporal única en función.** En Función solo se puede lanzar la siguiente cue pendiente según la escaleta temporal (tiempo absoluto, identificador natural, `id`; sin tiempo al final). Se descarta permitir lanzar cualquier cue y "resaltar" una: haría imposible saber cuál es el "go" real y rompería la trazabilidad de desviaciones. El aviso "¡Lanzar!" se reserva para la siguiente.
- **D19 — Dos vías de finalización.** La función se cierra al lanzar la última cue (001) o con "Finalizar función", que permite cerrar con pendientes marcándolos "no alcanzado". Se descarta exigir lanzar todas las cues: en un espectáculo real se cancela un número y el registro debe poder cerrarse sin falsear lanzamientos.
- **D20 — "Descartar función".** Anula (borra) el registro abierto de la sesión actual cuando se lanzó por error en Función. Se descarta marcarlo como "descartado" con un campo: borrar evita que todas las métricas tengan que filtrar y cumple "no cuenta en métricas ni informes". Es una excepción explícita y acotada a danza+Función; no afecta a proyectos estándar ni a registros cerrados.
- **D21 — Reloj de espectáculo propio.** Un reloj independiente (`showStartedAt`) que arranca con el primer track o con un botón y sirve de referencia absoluta. Se descarta usar el cronómetro de función como referencia: la 001 permite función sin cronómetro y las desviaciones deben existir igualmente.
- **D22 — "No alcanzado".** Cue con objetivo que no se lanzó y cuyo instante objetivo se alcanzó con la referencia disponible, o que seguía pendiente al finalizar la función, o cuyo track se detuvo manualmente en Función antes del objetivo (D31). En Ensayo la parada manual **no** marca "no alcanzado": los cues quedan pendientes y se pueden relanzar al reiniciar el track. Se descarta equipararlo a "desviación positiva": no hubo lanzamiento que medir (RF24).
- **D23 — Referencia disponible para lanzar un cue vinculado (en Función).** El control está habilitado solo si el track está `En marcha` o si terminó por duración y el objetivo del cue es exactamente la duración (referencia = final del track, lanzamiento indefinido con desviación `0`). Con el track `Pausado` o terminado manualmente, la candidata se muestra pero el control está deshabilitado con motivo; en Ensayo se permite lanzar sin desviación. Se descarta permitir el lanzamiento con el track pausado: el instante real no tiene referencia fiable y la desviación sería falsa (RF22, RF38).
- **D24 — `atMs` derivado no se persiste como fuente.** Mientras hay vínculo, la fuente es `trackId + trackOffsetMs`; al desvincular o borrar el track se materializa el último cálculo. Se descarta guardar siempre ambos: se desincronizarían al mover el track.
- **D25 — La ruta de validación conserva los campos nuevos.** `productionSchema` declara `mode` y `templateOrigin`; `cueSchema` declara `timing`; `performanceSchema` declara `mode`, `cueLaunches` y `trackRuns` como opcionales y `savePerformance` valida con él. `saveCue` conserva `timing` si el objeto entrante no lo trae. Se descarta confiar en el guardado "tal cual": Zod recorta claves desconocidas y se perderían el modo, el origen de plantilla, el tiempo y el informe (RF40).
- **D26 — Editor de plantilla con la misma UI de escaleta.** La plantilla se edita en `/plantillas` reutilizando la interfaz de tracks/cues en modo plantilla; la versión incrementa solo al guardar contenido. Se descarta un editor distinto: duplicaría la lógica y permitiría plantillas que no se pueden aplicar.
- **D27 — Contrato JSON con sobre explícito.** `format`, `formatVersion`, `kind` y `template`; la importación valida antes de escribir y siempre crea una plantilla (nunca un proyecto). Se descarta importar como proyecto en fase 1: requiere decidir modo, PDF, nombre y conflictos de producción.
- **D28 — Preferencias en tabla local validada.** `appSettings` con una fila `"dance"`, validada como el resto de entidades. Se descarta `localStorage` suelto: no se valida, no se versiona con el esquema y complica la migración.
- **D29 — Superficies explícitas.** `/documento`, `/documento/imprimir`, `/plantillas`, `/ajustes`, `/reportes/imprimir` además de las existentes. Las plantillas y los ajustes son superficies de **aplicación**; el resto, de proyecto y condicionadas al modo. Se descarta meter todo en `/modo-funcion`: la preparación no debe mezclarse con la ejecución.
- **D30 — `TrackRun` solo al cerrar.** Las ejecuciones de track se persisten únicamente cerradas; mientras corren viven en memoria. Se descarta escribir un `TrackRun` abierto: una recarga dejaría una ejecución huérfana sin forma determinista de cerrarla.
- **D31 — Fin de track por duración y parada manual.** Al llegar a la duración, el track queda Terminado con `endedBy: "duration"`; si la siguiente cue pendiente tiene el objetivo en la duración, su "¡Lanzar!" y su control siguen disponibles indefinidamente con la referencia del final del track (instante real = duración, desviación `0`). Detener manualmente un track lo cierra con `endedBy: "manual"` y, en Función, marca sus pendientes como "no alcanzados" y avanza la secuencia; en Ensayo quedan pendientes y se pueden relanzar. Se descarta dejar la parada manual sin salida determinista distinta de "Finalizar función" (RF9, RF13, RF22, RF24, RF38).
- **D32 — Tiempo activo como referencia única.** Los objetivos, instantes reales y desviaciones se miden con el tiempo activo del track y del reloj de espectáculo, excluyendo pausas y descansos: una pausa no desplaza objetivos ni cuenta como retraso. Se descarta usar tiempo de pared para los cues de track (RF12, RF23, RF39).
- **D33 — Registro abierto y finalización.** Cualquier `runReport` sin `endedAt` es un registro abierto, con cero o más lanzamientos; el arranque del cronómetro lo crea y bloquea la producción como en la 001. "Finalizar función" exige un registro abierto y "Descartar función" solo actúa sobre el registro abierto de la sesión actual; los registros abiertos de sesiones anteriores se listan como tales y no se tocan. Se descarta inventar una recuperación determinista tras recarga (RF20, RF36, RF37, CL62).
- **D34 — Paleta cerrada de bandas y recorte por umbral.** Las bandas son contiguas desde `0`, con colores de una paleta cerrada de cinco valores y etiqueta textual; para umbrales menores que el máximo se recortan a `[0, umbral]`. Se descarta aceptar hexadecimal libre o bandas con huecos/solapes porque romperían la comparación visual y la accesibilidad (RF14, RF32).
- **D35 — Instantánea del cue en el informe.** `CueLaunchEvent` guarda descripción, pie y observaciones en el momento del lanzamiento, de modo que el informe sea reproducible aunque el cue se edite después. Se descarta reconstruir el informe leyendo el cue actual: dejaría de ser una función pura del registro (RF24, RF31).
- **D36 — Origen de plantilla como trazabilidad.** `Production.templateOrigin` se fija al aplicar una plantilla y no cambia aunque la plantilla se edite o se elimine. Se descarta un vínculo vivo: haría impredecible el proyecto y rompería el aislamiento (RF27, RF29, RF40).
- **D37 — Validación del registro de función.** `performanceSchema` declara `mode?`, `cueLaunches?` y `trackRuns?` como opcionales y `savePerformance` valida con él antes de persistir. Se descarta dejar ese guardado sin validar: sería el único camino capaz de recortar o aceptar silenciosamente datos mal formados del informe (RF40).

---

## 9. Fuera de alcance / posibles versiones futuras

- **Multi-track simultáneo:** varios cronómetros de track a la vez, con cuentas atrás de cues de distintos tracks en paralelo.
- **Biblioteca de plantillas** con búsqueda, etiquetas y filtros (hoy: lista simple).
- **Historial de versiones de plantilla** con restauración de una versión anterior.
- **Aplicar una plantilla a un proyecto ya creado** (con confirmación, añadido, orden y renumeración).
- **Importar un JSON como proyecto nuevo** (hoy solo como plantilla).
- **Persistir ensayos** (`PerformanceRunReport.mode: "rehearsal"`), con sus desviaciones y comparativas ensayo/función.
- **Reproducción de audio** de los tracks dentro de la aplicación.
- **PWA/offline real** con Service Worker y sincronización remota de los datos de danza.
- **Pruebas automatizadas** de las funciones de escaleta, desviaciones y cuenta atrás.
- **Edición del libreto de texto** de danza; se sigue usando el PDF subido, si existe.
- **Cambio de modo** de un proyecto ya creado (estándar ↔ danza).
- **Persistencia de la ejecución entre recargas**, incluida la recuperación de un registro abierto, del reloj de espectáculo y de los tracks en marcha (limitación heredada de la 001).
- **Exportación a PDF** de otros documentos (tablillas de departamentos, incidencias).

---

## 10. Decisiones cerradas (consultas resueltas)

- **P1 — Modo por defecto → D6.** Se mantiene **FUNCIÓN** al entrar en la ejecución de un proyecto de danza; no se recuerda el último modo usado por proyecto.
- **P2 — "Parte" de una plantilla → D17 y RF26.** La selección parcial admite tracks completos (con sus cues) y cues sueltos sin track; no se puede incluir un cue de un track sin el track.
- **P3 — Fin de función con pendientes → D19, D31, D33 y RF36.** Dos vías: última cue y "Finalizar función", esta última solo con un registro abierto; los pendientes con objetivo quedan "no alcanzado", también cuando se detiene manualmente su track en Función.
- **P4 — Secuencia en función → D18 y RF38.** Solo la siguiente cue pendiente de la escaleta temporal; desempate por identificador natural y `id`.
- **P5 — Cambio de modo y descarte → RF20, RF37, D20.** El cambio solo se bloquea con registro abierto o track en marcha; el descarte anula el registro abierto de la sesión.
- **P6 — Reloj de espectáculo → D21, D32 y RF39.** Reloj propio que arranca con el primer track o con un botón; referencia de tiempos absolutos y desviaciones en tiempo activo.
- **P7 — Fin de track y registro abierto → D31, D33 y RF36/RF37.** Al llegar a la duración el track queda Terminado por `duration`; la parada manual lo cierra por `manual` y en Función marca sus pendientes como "no alcanzado". "Finalizar" exige registro abierto y ni "Finalizar" ni "Descartar" actúan sobre registros abiertos de sesiones anteriores.

No quedan preguntas abiertas en esta spec.

---

## 11. Verificación (guion manual)

No se añaden pruebas automatizadas. La verificación de esta spec es:

1. `npm run lint` y `npm run build` sin errores ni avisos nuevos.
2. **Compatibilidad estándar + 001:** abrir un proyecto estándar creado antes de esta funcionalidad; comprobar que no aparece nada de danza, que el flujo PDF funciona y que el modo función de la 001 se comporta igual (lanzar sin cronómetro, registro en el primer lanzamiento, finalización por última cue, bloqueo de producción, reversión si falla el primer guardado).
3. **Alta:** crear un proyecto Danza sin PDF (modo, documento vacío, tracks disponibles); comprobar que un proyecto Estándar sigue exigiendo PDF y muestra el mensaje de RF2. Recargar y comprobar que el proyecto sigue en Danza (RF3, RF40).
4. **Documento y orden:** crear tracks `2:00` y `3:00`, un cue a `1:30` en el track 1; comprobar inicios, orden, total `05:00`, formato `mm:ss` y vista imprimible en claro sin controles. Añadir un inicio explícito que solape, un track sin duración y dos tracks con el mismo `order`, y comprobar avisos y cadena de inicios. Añadir `LX-2` y `LX-10` al mismo tiempo y comprobar el orden natural.
5. **Track:** iniciar el track 1; comprobar transcurrido/restante hasta `00:00`, parada automática y estado "Terminado" sin restante negativo; pausar, reanudar y comprobar que no se recupera el tiempo en pausa; iniciar el track 2 con confirmación.
6. **Reloj de espectáculo:** comprobar que el primer track lo arranca, que "Iniciar espectáculo" lo arranca sin track ni cronómetro de función, que un segundo track no lo reinicia, que pausar **solo un track no lo pausa** y que pausar la función o activar un descanso sí lo pausa y al reanudar continúa desde el mismo tiempo activo. Comprobar la etiqueta "Espectáculo" frente a "Función" (RF39).
7. **Cuenta atrás y colores:** con el track 1 en marcha, comprobar que a los `1:20` aparece `10…0` con siete segundos en rojo (`#DC2626`), dos en naranja (`#EA580C`) y dos en verde (`#16A34A`), con sus etiquetas textuales, y a `0` la cifra `0` **y** "¡Lanzar!" solo en la **siguiente** cue. Pausar: la cuenta atrás se oculta y al reanudar se recalcula en tiempo activo. Con un umbral de 5 comprobar el recorte `4–5`, `2–3`, `0–1` y que una configuración con huecos o color hexadecimal se rechaza. Reanudar pasada la hora del objetivo: aparece "¡Lanzar!" sin cifra negativa. Detener manualmente el track antes del objetivo: no hay "¡Lanzar!"; en Función sus pendientes pasan a "no alcanzado" y la secuencia avanza, y en Ensayo quedan pendientes y se relanzan al reiniciar (RF13–RF15, D31, D34).
8. **Secuencia temporal:** con cues en `0:30`, `1:00` y `1:30` y un cue sin tiempo, comprobar que en Función solo se puede lanzar el de `0:30`, que tras lanzarlo pasa el turno al de `1:00`, que el sin tiempo queda al final y que un intento de lanzar otro muestra el motivo. Comprobar que la cuenta atrás de una cue no siguiente no muestra "¡Lanzar!" aunque llegue a `0`, que con `LX-2`/`LX-10` al mismo tiempo se lanza primero `LX-2`, que no se ofrece iniciar un track posterior saltándose uno Pendiente, y que una cue candidata con el track Pausado se ve pero su control está deshabilitado con el motivo "Reanuda el track para lanzar esta cue." (RF22, RF38, CL58, CL18).
9. **Fallo de guardado:** simular un fallo de almacenamiento (por ejemplo, bloqueando IndexedDB desde las herramientas del navegador); comprobar que el primer lanzamiento se revierte por completo (contador, estado y bloqueo) y que un fallo posterior no incrementa el contador y reintenta con el instante original.
10. **Función e informe — verificación determinista del formato:** insertar en IndexedDB (`performances`) un registro de prueba cerrado (`endedAt` fijado, `mode: "show"`) con `cueLaunches` que incluyan desviaciones conocidas `+800 ms`, `+40 ms`, `−800 ms`, un cue sin objetivo y un cue "no alcanzado", con `cueDescription`/`cuePie`/`cueObservations` como instantáneas. Abrir `/reportes` y comprobar el formato exacto: `+0,8 s`, `+0,04 s` mostrado como **"a tiempo"**, `−0,8 s`, media y máxima con signo y una décima, y el "no alcanzado" fuera de las desviaciones. El informe se renderiza solo desde el registro, sin depender de una ejecución en vivo. Después editar la descripción/observaciones del cue original y comprobar que el informe no cambia (RF24, D35).
    - **Captura en vivo:** comprobar que al lanzar se registra una desviación con su signo y su nota, **sin exigir un valor exacto al milisegundo** (depende del instante del pulsador). Finalizar lanzando la última cue y comprobar `endedAt`, "Finalizada", desbloqueo de producción e informe tras recargar y en `/reportes`; comprobar que el ensayo no aparece y que la versión `/reportes/imprimir` sale en claro.
11. **Finalización con pendientes:** en una función nueva, lanzar una cue, pulsar "Finalizar función" con 3 pendientes, confirmar y comprobar que los pendientes con objetivo figuran como "no alcanzado", los sin objetivo como "pendiente no lanzado", que todos los tracks quedan Terminados, que el reloj de espectáculo se detiene y que la producción se libera. Comprobar el caso de registro abierto **sin lanzamientos** (creado al arrancar el cronómetro: el botón está habilitado y cierra con 0 lanzamientos), el botón deshabilitado con solo un track En marcha y sin registro (motivo "Inicia la función o lanza una cue para poder finalizarla.") y el botón deshabilitado sin registro ni track (motivo "No hay ninguna función en curso."). Confirmar que "Finalizar" es idempotente ante doble activación (RF36, D33).
12. **Descartar función:** lanzar una cue en Función, descartar con confirmación y comprobar que el registro desaparece, que el contador y `/reportes` no lo muestran ni tras recargar, que los tracks vuelven a Pendiente y que el modo sigue en Función. Comprobar que sin registro abierto la acción no se ofrece, que cancelar la confirmación no cambia nada y que un registro abierto de una sesión anterior aparece como "registro de una sesión anterior" y **no** se descarta ni se finaliza (RF37, CL62).
13. **Cambio de modo:** con un registro abierto, comprobar que el cambio está bloqueado con motivo; en Ensayo, con lanzamientos y un track en marcha, comprobar que se permite con confirmación y que reinicia relojes, contadores y tracks.
14. **Ensayo:** lanzar fuera de orden, retroceder, reiniciar un track y editar un tiempo sin detener cronómetros; comprobar que no se crea registro ni se bloquea la producción y que el contador de funciones no cambia.
15. **Persistencia de campos:** crear un cue con vínculo, objetivo y umbral; recargar y comprobar `mode` y `timing`; editar **solo** la nota del cue y guardar; recargar y comprobar que `timing` sigue idéntico y que la escaleta, la secuencia y el total no han cambiado. Comprobar que los lanzamientos y los tracks del informe siguen tras recargar.
16. **Plantillas:** guardar una plantilla parcial con un track y un cue suelto; comprobar que el track arrastra todos sus cues y que un cue de un track sin el track no se puede seleccionar. Añadir un cue SIM y comprobar que no se guarda sin dos tipos. Editar contenido dos veces y comprobar versión `3`; renombrar y comprobar que no sube. Duplicar e importar con nombre repetido y comprobar el sufijo `" (2)"`. Exportar, importar y comprobar equivalencia; probar un JSON corrupto, un `kind` incorrecto y un `trackKey` inexistente (desvinculación informada). Probar un cue con `trackOffsetMs` mayor que la duración de su track y comprobar que se rechaza sin escribir nada. Aplicar al crear un proyecto y comprobar aislamiento en ambos sentidos.
17. **Accesibilidad:** recorrer con teclado los cuatro pasos de RF33 (iniciar track, lanzar la siguiente, cambiar de modo, escribir y guardar nota) con foco visible; comprobar anuncios solo de los segundos del umbral, `aria-live` y motivo de controles deshabilitados; activar `prefers-reduced-motion` y comprobar que no hay parpadeo (y que con animación es de 400 ms on/off); probar tamaño muy grande, alto contraste y ancho de `360 px` sin scroll horizontal en las operaciones principales.
18. **Edición bloqueada en Función:** con una función abierta, comprobar que crear/borrar/reordenar tracks o cues y editar tiempos o vínculos (tanto en `/documento` como en la pestaña interna "Documento") aparece deshabilitado con el motivo "En función la escaleta no se edita. Cambia a Ensayo.", mientras que las notas sí se pueden guardar sin mover la secuencia ni el total (RF11, CL54).
19. **Idempotencia de lanzamiento:** hacer doble clic/doble toque en el control y activar a la vez el botón general y el aviso "¡Lanzar!"; comprobar en cada caso que el contador aumenta **1** y que aparece una sola marca en `cueLaunches` (RF18, CL21, CL22).
20. **Cue con `atMs` sin reloj:** con un cue suelto con tiempo absoluto y sin haber pulsado "Iniciar espectáculo" ni iniciado track, comprobar que no hay cuenta atrás y que se informa "sin referencia temporal" sin desviación inventada; en Función la candidata se ve con el control deshabilitado hasta que arranque el reloj, mientras que en Ensayo se puede lanzar libremente y **no** se crea ningún registro (RF12, RF21, RF23, RF38, CL19).
21. **Exportación/importación de escaleta:** exportar la escaleta de un proyecto (`kind: "schedule"`), comprobar el sobre con `format`/`formatVersion` y que el archivo se importa en `/plantillas` como plantilla nueva conservando tracks y vínculos; comprobar que no existe acción de importar un JSON como proyecto (RF34).
22. **Cascadas de borrado:** eliminar un track con cues vinculados, comprobar la confirmación con el número de cues y que al aceptar conservan su último tiempo como `atMs` (o quedan "sin tiempo"); eliminar una producción de danza y comprobar que no quedan tracks huérfanos; ejecutar "borrar todas las producciones" y comprobar que las plantillas y las preferencias sobreviven (RF35, CL42, CL43).
23. **Recarga en mitad de ejecución:** con un track en marcha y un registro abierto, recargar la página; comprobar que los cronómetros y el reloj de espectáculo se pierden, que el registro abierto aparece como "registro de una sesión anterior", que no hay `TrackRun` abierto y que "Finalizar"/"Descartar" de la sesión nueva no lo modifican (CL36, CL62).
24. **Navegación de proyecto estándar:** abrir un proyecto estándar y comprobar que la navegación no ofrece `/documento` ni `/documento/imprimir`, que el acceso directo a `/documento` muestra "Este proyecto es estándar y no tiene documento de escaleta." con enlace a `/libretos`, y que `/plantillas` sigue accesible por URL y desde la navegación como biblioteca global sin acciones de aplicación al proyecto (RF41, CL1).
25. **Fin de track por duración con cue en el final:** crear un track de `1:00` con su siguiente cue a `1:00`; al llegar a `00:00` comprobar que el track queda Terminado con `endedBy: "duration"`, que se muestran `0` y "¡Lanzar!" **indefinidamente**, que el control sigue habilitado, que al lanzarlo se registra `actualOffsetMs = durationMs` y desviación `0`, y que cualquier otro pendiente con objetivo ya alcanzado figura como "no alcanzado" (RF9, RF13, RF23, RF38, CL59).
26. **Parada manual con pendientes:** en Función, detener manualmente un track con dos cues pendientes; comprobar la confirmación, que el track queda Terminado con `endedBy: "manual"`, que esos dos cues figuran "no alcanzados" en el informe y que la siguiente cue pasa a ser de otro track o con `atMs`. Repetir en Ensayo y comprobar que nada se marca "no alcanzado" y que los cues se relanzan al reiniciar el track (D31, RF9, RF22, RF24, CL60).

---

## 12. Respuesta a las revisiones QA (v2 y v3)

### 12.1 Revisión QA de la v2

| Punto | Dónde queda resuelto |
|---|---|
| **B1** Persistencia descarta `mode` y `timing` | RF40 (nuevo), RF3 (criterio de persistencia del modo), §4.1–4.3, §4.8, RF35h, CL45, CL46, D25 |
| **B2** Contradicción cuenta atrás / `¡Lanzar!` al superar el objetivo | RF13 (regla y criterios c–f), RF15 (a–e), RF16, CL10, CL11, CL12, CL14 |
| **B3** Finalización incompatible con "no alcanzado" | RF36 (nuevo), RF24 (definición), RF20, CL13, CL30, CL31, CL32, CL57, D19, D22 |
| **B4** Secuencia/lanzamiento de danza | RF38 (nuevo), RF22, RF16, RF7, CL15, CL16, CL17, CL58, D18 |
| **B5** Reloj de referencia, objetivo, desviación y fallo de guardado | RF39 (nuevo), RF23, RF12, RF13 (f), RF15 (d), RF18 (e–f), CL19, CL20, CL25, CL26, D21, D23 |
| **M1** `startAtMs` sin uso/validación/algoritmo | RF5, RF7 (algoritmo completo), §4.2, CL4, CL5, CL6 |
| **M2** Ciclo de vida del track y `TrackRun` | RF9, RF22 (tracks en función), §4.5, D30, CL13, CL36 |
| **M3** Edición de cues en ejecución | RF11, RF22, CL54 |
| **M4** Plantillas incompletas/incoherentes | RF26 (contenido), RF27 (solo al crear), RF28 (editor), RF30 (contrato y desvinculación), RF34 (solo plantilla), §4.4, D26, D27, CL39, CL40, CL51, CL55, CL56 |
| **M5** Preferencias sin modelo/validación | RF14, RF32, §4.6, CL49, D28 |
| **M6** Navegación y superficies | §1.6, RF41 (nuevo), RF3 (criterio b), CL1, CL52, CL53, D29 |
| **M7** Orden determinista y forma de escaleta | RF7, RF4, RF8, §4.7, CL6, CL15, CL50 |
| **M8** Informe ambiguo | RF24 (fuente, media, máxima, `a tiempo`, formatos, impresión, notas), CL24, CL37 |
| **M9** Integridad de datos | RF35, §4.3, §4.8, CL42, CL43, CL44, D24 |
| **M10** Accesibilidad no verificable | RF33 (pasos, hitos, 400 ms, 360 px), RF19 (control de cambio), RF20, RF32, §5 |
| **m1** Renombrar `EscaletaTemplate` | §4.4: `ScheduleTemplate`, `ScheduleTemplateTrack`, `ScheduleTemplateCue` (UI sigue en español) |
| **m2** Nombre obligatorio y unicidad | RF26, RF30, §4.4, CL40 |
| **m3** "Otra pestaña" = pestaña interna | RF11 (primera viñeta) |
| **m4** A `0`, colores exactos y "¡Lanzar!" | RF13e, RF14, RF33, §4.6, §5 |
| **m5** `mode: "rehearsal"` reservado | §4.5 (solo `"show"` en fase 1), RF25, §9 |
| **m6** Formato y redondeo de tiempos | RF8 (formato y redondeo), RF24 (décimas), §5 |
| **m7** "Congela y oculta" | RF13 (se oculta y se recalcula; sin promesa de cifra congelada), CL10 |
| **m8** «Intentar cambiar el modo» | RF3 (se elimina el criterio de intento: no existe control de cambio de modo), §1.6, D29 |
| **m9** CL23 «cambios sin guardar» | Caso eliminado: los guardados son por operación (§6.9, RF31, RF40). La numeración de casos límite vigente es la de §3 |

### 12.2 Revisión QA de la v3 (22 puntos)

| Punto | Dónde queda resuelto |
|---|---|
| **1** Cue con objetivo = duración del track (fin de track) | RF6 (rango `0..duración`), RF9 (estados, `endedBy`, fin natural, parada manual), RF13, RF15(f), RF23, RF38(h), CL13, CL59, D23, D31 |
| **2** Pausa y referencia temporal | RF9(b), RF12, RF13(c), RF23, RF39, §4.5 (`TrackRun` en tiempo activo), §4.7, D32 |
| **3** Track detenido/superado con cues pendientes | RF9 (parada manual y cambio de track), RF22 (tracks en función), RF24 ("no alcanzado"), RF38, CL12, CL18, CL60, D22, D31 |
| **4** Definición única de "registro abierto" | §1.7, RF20 (bloqueo con 0 lanzamientos), RF36(e), CL31, D33 |
| **5** "Finalizar función" sin registro | RF36 (habilitado solo con registro abierto y motivos), RF37, CL32, D33 |
| **6** "Siguiente cue" vs "control habilitado" | §1.7, RF22 (candidata/lanzable), RF38, CL17, CL18, D23 |
| **7** Alcance de "¡Lanzar!" | RF15 (solo la siguiente pendiente), RF16, CL16, CL15 |
| **8** `trackKey` huérfano en plantilla | RF30 (reparación, no rechazo), RF35, CL39, CL44, §4.4 |
| **9** `trackOffsetMs` > duración en plantilla | RF26 (validación), RF30, §4.4, CL61, §11.16 |
| **10** `ScheduleTemplateCue` incompleto | RF26 (contenido), §4.4 (`status`, `executionState`, defaults), CL55 |
| **11** Origen de plantilla en `Production` | §4.1 (`templateOrigin`), RF27(e), RF40(g), D36 |
| **12** Modelo de bandas de color | RF14, RF32, §4.6 (`CountdownBand`, paleta cerrada, recorte), §5, CL49, D34 |
| **13** Informe y notas | RF24 (instantáneas y reproducible), RF31(b), §4.5, §4.7, D35 |
| **14** Registros abiertos de sesiones anteriores | RF36 (registros de sesiones anteriores), RF37, CL36, CL62, D33 |
| **15** Terminología de track | §1.7 (cuatro estados, "detener" = transición), RF9, RF22, RF39 |
| **16** `/plantillas` y proyectos estándar | §1.6 (superficie global), RF3(b), RF41(c,e), CL1 |
| **17** Pestaña "Documento" vs ruta `/documento` | §1.6, RF11, RF39, CL63 |
| **18** Edición en `/documento` | §1.6 (editable sin ejecución y en Ensayo; solo lectura en Función), RF11, CL54, CL63 |
| **19** Unicidad de nombre de plantilla | RF26 (sufijo), RF28 (renombrado), RF30 (importación), §4.4, CL40 |
| **20** Esquema de `Performance` | RF40 (`performanceSchema` opcional en `savePerformance`), §4.5, D25, D37 |
| **21** Verificación determinista de desviaciones | §11.10 (fixture en IndexedDB, formatos exactos y captura en vivo sin exigir milisegundo) |
| **22** Guion de verificación completo | §11.5, §11.7–§11.8 y §11.18–§11.26 (edición en Función, doble activación, secuencia, `atMs` sin reloj, `kind: "schedule"`, cascadas, recarga, navegación estándar, fin por duración y parada manual) |

Opcionales de la misma revisión, también cerrados: terminología de los dos modos (§1.5 y §1.7), orden natural con decimales por valor numérico y desempate por texto/`id` (§1.7, RF7, RF38), `trackId` sin `trackOffsetMs` = sin vínculo (RF6, RF35, §4.3, CL64) y rango común `0–24 h` para `atMs` y `startAtMs` (§4.2, §4.3).

No queda ningún punto de las revisiones v2 ni v3 sin cerrar.

