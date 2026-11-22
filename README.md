# Regiduría

Regiduría es una aplicación de gestión escénica para producciones teatrales, con foco en la coordinación de libretos, cues, funciones, incidencias y documentación técnica.

## Base técnica

- Next.js con App Router
- TypeScript
- Tailwind CSS
- Componentes accesibles y reutilizables
- Zustand para el estado global de la interfaz
- Zod para validación de modelos
- Dexie para persistencia local
- PDF.js como dependencia base para el visor de libretos

## Estructura funcional

- `src/app`: rutas principales de la aplicación.
- `src/components`: layout, dashboard, cues, visor de libretos y modo función.
- `src/lib`: modelos y validaciones, persistencia local con Dexie, servicios de acceso a datos y utilidades de cues, navegación y clases de estilo.
- `src/store`: estado del tema y sesión activa.

## Estado actual

La primera iteración incluye una base operativa con los siguientes módulos:

- panel general de producción
- gestión de proyectos creados por el usuario, con PDF obligatorio vinculado a cada obra, selección activa, guardado automático del editor y gestión de equipo artístico y técnico
- cues con diferenciación de preparación y función, campo Pie para registrar la acción que los dispara y mostrarla durante la función
- libreto PDF guardado localmente, con nombre visible derivado del archivo y editable, además de etiquetas de acto, escena y cue ubicadas en página
- cues de libreto con identificador automático editable; se admiten identificadores enteros y decimales (por ejemplo, LX-5.5), y la sugerencia automática continúa con el siguiente entero libre; en la edición de cues se pueden subir y bajar para fijar el orden de ejecución
- tipos de cue con colores identificativos: LX amarillo, SON verde, MOV azul, PREVENIR naranja, PROY gris, ENT/MUT gris claro, UT azul marino, SIM verde y AVISO rosa (VEST usa un tono neutro); las cues SIM muestran sus señales con franjas diagonales compartidas
- PREVENIR identifica un aviso asociado a un MOV con el prefijo PREV; puede compartir el número del MOV y no incrementa la numeración automática de movimientos
- cues simultáneos configurables con dos o más tipos de señal; los avisos a intérpretes se asignan al departamento Reparto
- modo función para ensayos y representaciones, con preparación previa, avisos temporizados 30/15/5, checklist por sonido y departamentos, un visor de libreto y lanzamiento de cues antes o después de iniciar el cronómetro sin perder el progreso
- incidencias y reportes
- sistema de persistencia local con Dexie; los proyectos, PDFs y equipos permanecen en el navegador donde se crean
- **modo danza**: proyectos sin PDF obligatorio, documento/escaleta derivada, tracks con cronómetro en tiempo activo, un único cronómetro de función que sirve de referencia temporal, cuentas atrás con bandas, lanzamiento integrado en `/modo-funcion` (un cue de sonido puede arrancar un track), ensayo/función, informe de desviaciones, plantillas y ajustes de accesibilidad; el flujo estándar con PDF sigue intacto

## Modo Danza

El modo se elige al crear el proyecto y no se puede cambiar después. En danza el documento principal es la escaleta estructurada; el PDF, si se aporta, es un libreto complementario. El cronómetro de cada track y el cronómetro único de función miden tiempo activo (sin pausas); este último es también la referencia de los cues con tiempo absoluto, y el informe guarda la desviación de cada cue respecto a su objetivo. No hay un reloj "Espectáculo" independiente.

En `/modo-funcion` las cues y el cronómetro ocupan el centro de la vista; los tracks aparecen debajo de las cues y el cierre de función está a la derecha, bajo la preparación. Los registros de sesiones anteriores se consultan pulsando "Registro de funciones". Para arrancar una canción sin buscar su track, crea un cue de sonido y en "Tiempo en la escaleta" usa **Vincular a track** y elige un track existente: al pinchar ese cue ("Pincha") el track empieza desde cero, y la tarjeta del cue lo indica. Si había otro track en marcha, se cierra con la regla de parada manual.

Rutas específicas:

- `/documento` y `/documento/imprimir`: documento y escaleta imprimible.
- `/plantillas`: biblioteca global de plantillas, con importación/exportación JSON y exportación de la escaleta del proyecto.
- `/ajustes`: bandas de cuenta atrás, tamaño de fuente, alto contraste, sonido y umbral por defecto.
- `/reportes` y `/reportes/imprimir`: funciones de danza e informe de desviaciones.
- `/modo-funcion`: ejecución de danza con pestaña interna "Documento"; no existe una ruta `/modo-danza` separada.

Ensayo permite lanzar fuera de orden sin crear registro. Función exige la siguiente cue de la escaleta, registra cada lanzamiento y ofrece dos vías de cierre: lanzar la última cue o "Finalizar función" (solo con un registro abierto). "Descartar función" elimina el registro y no contabiliza la función. Los registros abiertos de sesiones anteriores se muestran como limitación heredada de la spec 001.

## Verificación

```bash
npm run lint
npm run build
```

Además de `lint` y `build`, la verificación funcional del modo danza es el **guion manual de 26 pasos** de `specs/002-modo-danza/spec.md` §11, que incluye los recorridos de compatibilidad con la spec 001 y el proyecto estándar, la impresión en claro y la operación solo con teclado a 360 px.

El objetivo de esta versión es dejar una base sólida, profesional y extensible para continuar la implementación por fases con mayor detalle funcional.

## Abrir la aplicación desde otro ordenador

El repositorio de GitHub contiene el código fuente, pero GitHub no ejecuta por sí solo esta aplicación Next.js. Para abrirla en un navegador sin descargar el proyecto, hay que desplegarla en un servicio de hosting. Vercel puede construirla directamente desde GitHub:

[![Desplegar Regiduría con Vercel](https://vercel.com/button)](https://vercel.com/new)

1. Inicia sesión en Vercel o crea una cuenta.
2. Pulsa **Add New… → Project** y conecta GitHub si te lo solicita.
3. Importa el repositorio original `MiguelSome/regiduria` (no una copia o plantilla) y pulsa **Deploy**. Vercel detectará Next.js y usará los comandos de `package.json`.
4. Cuando termine, abre la URL `.vercel.app` que te proporcione Vercel desde cualquier ordenador.

Al conectar el repositorio original, cada commit nuevo en `main` generará una nueva versión de la aplicación. La primera compilación puede tardar unos minutos.

### Datos guardados en el navegador

La aplicación guarda actualmente los datos con IndexedDB en el propio navegador. Por eso, producciones, cues y PDF importados no se trasladan automáticamente entre ordenadores ni entre navegadores; cada uno tendrá su almacenamiento local. El despliegue permite abrir y probar la aplicación desde otros equipos, pero para compartir datos entre ellos hará falta añadir una base de datos remota y sincronización.
