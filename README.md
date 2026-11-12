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
- TanStack Query para la gestión de datos remotos que se integrarán más adelante
- PDF.js como dependencia base para el visor de libretos

## Estructura funcional

- `src/app`: rutas principales de la aplicación.
- `src/components`: layout, dashboard, cues, visor de libretos y modo función.
- `src/lib`: modelos, validaciones, mock data y servicios de acceso a datos.
- `src/store`: estado del tema y sesión activa.

## Estado actual

La primera iteración incluye una base operativa con los siguientes módulos:

- panel general de producción
- gestión de proyectos
- cues con diferenciación de preparación y función, campo Pie para registrar la acción que los dispara y mostrarla durante la función
- libreto PDF guardado localmente, con nombre visible derivado del archivo y editable, además de etiquetas de acto, escena y cue ubicadas en página
- cues de libreto con identificador automático editable; se admiten identificadores enteros y decimales (por ejemplo, LX-5.5), y la sugerencia automática continúa con el siguiente entero libre
- tipos de cue con colores identificativos: LX amarillo, SON rojo, MOV azul, PREVENIR naranja, PROY gris, ENT/MUT gris claro, UT azul marino, SIM verde y AVISO rosa (VEST usa un tono neutro)
- PREVENIR identifica un aviso asociado a un MOV; puede compartir su identificador MOV y no incrementa la numeración automática de movimientos
- cues simultáneos configurables con dos o más tipos de señal; los avisos a intérpretes se asignan al departamento Reparto
- modo función para ensayos y representaciones, con preparación previa, avisos temporizados 30/15/5, checklist por sonido y departamentos, y un visor de libreto que sigue la página de la cue en prevenido y se navega con ↑/↓
- incidencias y reportes
- sistema de persistencia local con Dexie

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
