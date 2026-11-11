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
- cues con diferenciación de preparación y función
- libreto y organización por actos y escenas
- modo función para ensayos y representaciones
- incidencias y reportes
- sistema de persistencia local con Dexie

## Verificación

```bash
npm run lint
npm run build
```

El objetivo de esta versión es dejar una base sólida, profesional y extensible para continuar la implementación por fases con mayor detalle funcional.
