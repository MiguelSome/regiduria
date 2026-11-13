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
- cues de libreto con identificador automático editable; se admiten identificadores enteros y decimales (por ejemplo, LX-5.5), y la sugerencia automática continúa con el siguiente entero libre
- tipos de cue con colores identificativos: LX amarillo, SON verde, MOV azul, PREVENIR naranja, PROY gris, ENT/MUT gris claro, UT azul marino, SIM verde y AVISO rosa (VEST usa un tono neutro); las cues SIM muestran sus señales con franjas diagonales compartidas
- PREVENIR identifica un aviso asociado a un MOV con el prefijo PREV; puede compartir el número del MOV y no incrementa la numeración automática de movimientos
- cues simultáneos configurables con dos o más tipos de señal; los avisos a intérpretes se asignan al departamento Reparto
- modo función para ensayos y representaciones, con preparación previa, avisos temporizados 30/15/5, checklist por sonido y departamentos, un visor de libreto y lanzamiento de cues antes o después de iniciar el cronómetro sin perder el progreso
- incidencias y reportes
- sistema de persistencia local con Dexie; los proyectos, PDFs y equipos permanecen en el navegador donde se crean

## Verificación

```bash
npm run lint
npm run build
```

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
