# Arquitectura del frontend

## Objetivo

El frontend sigue una arquitectura feature-first incremental. Las páginas
componen bloques, los hooks coordinan estado y llamadas remotas, las APIs se
agrupan por dominio y los componentes globales no conocen reglas de negocio.
Esta estructura evita una reescritura completa y conserva las rutas y contratos
de las Fases 0–13.

## Estructura

```text
frontend/src/
├── app/
│   ├── layout/       # shell raíz
│   ├── providers/    # providers globales
│   ├── router/       # definición única de rutas
│   ├── constants.ts
│   └── navigation.ts
├── components/
│   ├── ui/           # design system sin conocimiento de features
│   ├── layout/       # composición de páginas
│   ├── feedback/     # estados compartidos
│   └── navigation/   # navegación reutilizable
├── features/
│   ├── auth/
│   ├── connections/
│   ├── queries/
│   ├── query-builder/
│   ├── query-execution/
│   ├── relationships/
│   ├── reports/
│   └── schema/
├── pages/            # composición y parámetros de ruta
└── shared/
    └── api/           # cliente HTTP y health transversal
```

Una feature crea únicamente las carpetas que necesita:

- `api/`: operaciones HTTP del dominio.
- `components/`: presentación específica de la feature.
- `hooks/`: coordinación y estado reutilizable o de página.
- `model/`: estado local, constantes y transformaciones del dominio.
- `types.ts`: contratos del dominio usados por UI/API.
- `schema.ts`: validación Zod del dominio.

No deben crearse carpetas vacías para completar una plantilla.

## app

`app/router/router.tsx` conserva todas las URLs públicas. `AppProviders` crea el
cliente TanStack Query y monta la sesión. `app/layout/AppLayout.tsx` contiene el
shell global. Ninguno de estos módulos contiene comportamiento específico de
conexiones, consultas o reportes.

## Pages

Una página resuelve parámetros de ruta, estados raíz de carga/error y compone
feature components. Ejemplos actuales:

- `ConnectionsPage` compone header, filtros y tabla a partir de
  `useConnectionsPage`.
- `ReportEditorPage` compone `ReportEditorForm` a partir de
  `useReportEditorPage`.
- `QueryBuilderPage` carga el borrador y delega el resto a
  `QueryBuilderWorkspace`.

No se debe hacer `fetch`, transformar DTO complejos o implementar tablas
extensas directamente en una página.

## APIs y cliente HTTP

Cada dominio expone su API en `features/<feature>/api/*Api.ts`. Todas estas APIs
usan `shared/api/httpClient.ts`, única capa responsable de:

- base `/api/v1`;
- JSON y headers comunes;
- cookies de sesión;
- CSRF;
- transformación base de errores;
- notificación de una respuesta no autorizada.

El cliente HTTP no depende de ninguna feature. Los componentes no llaman
`fetch` directamente. `shared/api/health.ts` queda separado porque el endpoint
público tiene un contrato mínimo y no usa sesión.

## Hooks y estado

- TanStack Query representa estado remoto y caché.
- React Hook Form se usa para formularios con schema.
- Estado local permanece cerca del componente cuando no se comparte.
- Context se reserva para sesión/autorización global.
- No existe Redux, Zustand ni otro store global.

Los hooks de página devuelven grupos con nombres semánticos, no JSX.
`useReportEditorPage` conserva un único `ReportDraft`, deriva la consulta
seleccionada y encapsula inicialización/persistencia. El constructor mantiene el
AST en su reducer existente; `useQueryBuilderController` coordina consultas,
guardado, validación, compilación, atajos y conflicto de revisión.

## Query builder

El constructor está dividido en:

- page de carga;
- controller hook;
- workspace de composición;
- header/toolbar;
- catálogo;
- canvas;
- inspector;
- panel inferior de validación/SQL/parámetros;
- ejecución y resultados;
- diálogo de relaciones.

El AST universal continúa siendo la fuente de verdad. Layout temporal, historial
undo/redo, validación y ejecución siguen separados conceptualmente. El inspector
contiene editores independientes para campos, filtros, grouping, orden,
parámetros y UNION; separarlos en archivos individuales es deuda técnica segura
para una siguiente iteración.

## Tipos, schemas y utilidades

Los tipos viven junto a su dominio: `connections/types.ts`, `queries/types.ts`,
`query-execution/types.ts`, `relationships/types.ts`, `reports/types.ts` y
`schema/types.ts`. No existe un archivo global de tipos de negocio.

Los schemas Zod de conexiones permanecen en `features/connections/schema.ts` y
son reutilizados por creación y edición. `features/reports/model/reportEditor.ts`
define el borrador, opciones y defaults del editor. Los formatters transversales
deben ir a `shared/utils`; los formatters exclusivos de un dominio permanecen en
la feature.

## Dirección de imports

La dirección aceptada es:

```text
app/pages → features → components/shared
```

- `shared` no importa `features` ni `app`.
- `components/ui` no importa features.
- una feature puede consumir otra cuando el caso de uso lo requiere, por
  ejemplo reports consume consultas guardadas.
- las APIs importan tipos de su propio dominio y el cliente compartido.
- evitar barrels indiscriminados y ciclos; preferir imports directos.

No se añadió una herramienta pesada de boundaries. ESLint, TypeScript estricto
y revisión de imports mantienen las reglas por ahora.

## Componentes y naming

- Componentes, tipos y archivos de componentes: PascalCase.
- Hooks: prefijo `use` y responsabilidad explícita.
- Booleanos: `is`, `has`, `can` o `should`.
- Handlers: describen la acción (`requestDelete`, `updateParameter`).
- Props tipadas, sin `any` ni casts dobles.
- Los componentes visuales globales se reutilizan desde el sistema de diseño.

## Formato y validación

Prettier 3.6.2 es la fuente de verdad para TypeScript, TSX, JavaScript, JSX y
JSON. El lockfile se excluye del formateo automático.

```bash
docker compose exec -T frontend pnpm format
docker compose exec -T frontend pnpm format:check
docker compose exec -T frontend pnpm lint
docker compose exec -T frontend pnpm typecheck
docker compose exec -T frontend pnpm test
docker compose exec -T frontend pnpm build
```

Todos los comandos se ejecutan dentro de Docker; no se requiere Node o pnpm en
el host.

## Auth y login

La feature `auth` mantiene separadas sus responsabilidades:

- `api/authApi.ts`: contrato HTTP existente;
- `schemas/loginSchema.ts`: validación local del formulario;
- `hooks/useLogin.ts`: mutación, clasificación segura de errores, caché y
  redirección;
- `components/`: layout, identidad, formulario y campo de contraseña;
- `pages/LoginPage.tsx`: composición y estados de restauración/sesión existente.

Usuario y contraseña no pertenecen a estado global. La restauración de sesión se
resuelve antes de renderizar el formulario y las rutas públicas/protegidas siguen
siendo responsabilidad del router y `AuthProvider`.

## Dashboard

`features/dashboard` contiene un vertical completo y pequeño:

- `api/dashboardApi.ts` consume el resumen autenticado mediante el cliente HTTP
  común;
- `hooks/useDashboard.ts` define la consulta, caché y refresco;
- `types.ts` representa el contrato agregado;
- `components/` presenta header, acciones autorizadas, métricas, recursos
  recientes y onboarding;
- `pages/HomePage.tsx` solo compone estados y bloques.

El resumen es una proyección de lectura: nunca dispara pruebas de conexión ni
descarga filas de consultas. Los controles de creación se derivan de
`AuthProvider`; la ausencia visual de una acción no sustituye la autorización del
backend. Los formatters transversales de números, duración y fecha relativa viven
en `shared/utils/formatters.ts`.
