# Estado del proyecto DataNexus

Actualizado: 8 de agosto de 2026. Las Fases 0–12 están completadas; la rama de
trabajo actual corresponde a la **Fase 13**, sistema de diseño y base visual del
frontend.

## 1. Objetivo general

DataNexus es una plataforma empresarial para registrar fuentes de datos,
catalogar su estructura y relaciones, construir consultas visualmente y
convertirlas de forma segura a consultas parametrizadas. El diseño busca que el
núcleo sea multifuente: MySQL es el primer adaptador, pero los contratos deben
permitir PostgreSQL, SQL Server, Oracle, MongoDB, APIs y archivos.

El producto ejecuta consultas de solo lectura desde el AST validado, presenta
resultados paginados y ofrece reportes reutilizables exportables a CSV, XLSX y
PDF.

## 2. Arquitectura y tecnologías actuales

### Backend

- Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2 y Alembic.
- PostgreSQL 17.10 como base interna para configuración, catálogo, seguridad,
  borradores y compilaciones.
- Redis 7.4.9 para rate limiting distribuido y preparación de trabajo futuro.
- Arquitectura separada en `domain`, `application`, `infrastructure` y `api`.
- Repositorios para persistencia y servicios de aplicación; routers delgados.
- Registro de adaptadores de fuentes y registro de compiladores extensibles.
- PyMySQL y SQLAlchemy para MySQL; Psycopg para PostgreSQL interno.
- Fernet para credenciales reversibles de fuentes y Argon2id para contraseñas
  de usuarios.
- Ruff, MyPy estricto y Pytest para calidad.

### Frontend

- React 19, TypeScript estricto, Vite 7 y Tailwind CSS 4.
- React Router 7, TanStack Query, React Hook Form y Zod.
- React Flow (`@xyflow/react`) para grafos de relaciones y consultas.
- Lucide React para iconografía y Vitest/Testing Library para pruebas.
- Shell SaaS responsive basado en la referencia
  `docs/design/frontend-reference.png`; la imagen no se incrusta en el producto.
- Cliente HTTP central con rutas relativas `/api/v1`, cookies incluidas y CSRF
  en mutaciones.

### Infraestructura

Docker Compose levanta servicios separados para frontend, backend, PostgreSQL,
Redis, MySQL 5.6.51 y MySQL 8.4.10. Vite redirige `/api/v1` al backend en desarrollo.
MySQL 5.6 usa `linux/amd64`, por lo que puede requerir emulación en hosts ARM.

## 3. Fases completadas

La conversación usa Fase 0 para infraestructura; por ello su Fase 8 equivale al
paso 9 de la lista histórica de `AGENTS.md`.

### Fase 0 — Infraestructura

- Docker Compose, FastAPI, React/Vite, PostgreSQL, Redis, MySQL 5.6 y MySQL 8.
- Health checks, configuración por entorno, Alembic y herramientas de calidad.

### Fase 1 — Layout visual

- Sidebar oscuro colapsable, header, contenido claro y navegación responsive.
- Estado activo, menú móvil, componentes reutilizables y páginas base.
- Dashboard integrado con el health check público.

### Fase 2 — Gestión segura de conexiones MySQL

- Probar, crear, listar, consultar, editar, revalidar y eliminar conexiones UUID.
- Credenciales cifradas con Fernet y nunca expuestas en respuestas.
- `DataSourceAdapter`, registro extensible y `MySQLAdapter` con timeouts y SSL.
- Detección de proveedor, versión y capacidades para MySQL 5.6/8, Percona y
  advertencia limitada para MariaDB.
- Política SSRF configurable, errores públicos sanitizados y auditoría.
- Asistente y pantallas frontend de conexiones.

### Fase 3 — Sincronización y exploración de esquemas

- Inspección por lotes de `information_schema` para tablas, vistas, columnas,
  índices y claves foráneas, sin leer filas de negocio.
- Catálogo universal persistido, sincronizaciones transaccionales, cambios,
  eliminación lógica y reactivación.
- Bloqueo advisory de PostgreSQL para evitar sincronizaciones concurrentes.
- Explorador frontend, detalle de entidad, historial y resumen.

### Fase 4 — Relaciones lógicas y capa semántica

- Vista unificada de relaciones físicas, inferidas, manuales y polimórficas.
- Detección por convenciones, confianza determinista, fingerprints y rechazo
  persistente de sugerencias.
- Relaciones compuestas y regla polimórfica obligatoria de discriminador más ID.
- Nombres de negocio, visibilidad, tipos semánticos y campos sensibles.
- Listas, formularios y grafo básico con React Flow.

### Fase 5 — Autenticación, usuarios, roles y permisos

- Sesiones opacas persistidas en PostgreSQL mediante cookie HttpOnly.
- CSRF asociado a sesión, validación de Origin y expiración/revocación.
- Contraseñas Argon2id, política, bloqueo temporal y rate limiting con Redis.
- Usuarios, roles, permisos, asignaciones y acceso por conexión
  `viewer < analyst < manager`.
- Seeder RBAC idempotente y comando interactivo `create-admin`.
- Rutas protegidas, menús por permisos, login, cambio de contraseña, usuarios y
  matriz de roles. El logout limpia sesión y caché y vuelve al login.

### Fase 6 — Modelo universal de consultas

- AST JSON versionado `1.0`, tipado con Pydantic y referencias UUID al catálogo.
- Sources, campos, expresiones, predicados, funciones, agregaciones, joins,
  parámetros, subconsultas/correlación y UNION/UNION ALL.
- Pipeline de validación estructural, catálogo, scopes, tipos, autorización y
  capacidades; normalización, complejidad y fingerprint determinista.
- Borradores `SavedQuery` con JSONB y control optimista por `revision`.
- Lista, creación, detalle y editor JSON técnico en el frontend.

### Fase 7 — Compilador SQL seguro para MySQL

- Contrato y registro de compiladores, `MySQLDialect`, aliases y parámetros
  centralizados.
- Compilación determinista de SELECT para MySQL 5.6 y 8 desde el AST validado.
- Resolución exclusiva de identificadores desde PostgreSQL; valores separados
  mediante placeholders.
- Soporte de filtros, funciones, agregaciones, joins físicos/lógicos/
  polimórficos, subconsultas, correlación y UNION.
- Persistencia de plantillas compiladas sin valores y vista previa frontend con
  `executed=false`.
- Se corrigió el orden de registro de sources de joins: ahora se pueden
  seleccionar campos de una entidad relacionada y compilar en ambas direcciones.

### Fase 8 — Constructor visual de consultas

- Integrada en `main` mediante el merge `6d06ffd`.
- Ruta `/queries/:id/builder`, asistente de creación y acceso desde lista/detalle.
- Estado AST-first local, actualizaciones inmutables, undo/redo, dirty state,
  confirmación de salida y conflicto de revisión.
- Catálogo, lienzo React Flow, inspector, panel inferior, selección de campos,
  relaciones confirmadas y mappings polimórficos.
- Edición inicial de filtros, agrupación, HAVING, orden, DISTINCT, límites,
  parámetros y UNION; validación local/remota y compilación backend.
- Layout de nodos guardado en `metadata.builder_layout` y excluido del
  fingerprint lógico.
- Eliminación de joins desde el inspector con limpieza de referencias
  dependientes y posibilidad de deshacer.
- Vista SQL de solo lectura; no existe botón de ejecución.

### Fase 9 — Ejecución segura y resultados

- Endpoints para crear, listar, consultar y cancelar ejecuciones.
- Nueva migración `20260803_0010` y tabla `query_executions`, aislada por usuario
  y sin persistir filas, parámetros ni secretos.
- `QueryExecutionService` reutiliza validación, catálogo, compilador y registro
  de adaptadores existentes; no acepta SQL desde la API.
- Parámetros declarados obligatorios, tipos, defaults y rechazo de valores
  adicionales validados nuevamente en backend.
- Paginación aplicada a una copia del AST, límites lógicos y físicos, límite de
  bytes, timeout, concurrencia por usuario y conteo total opt-in.
- MySQL ejecuta en transacción de solo lectura, lee una ventana acotada,
  normaliza fechas, decimales, JSON y binarios, y libera siempre los recursos.
- Cancelación best-effort mediante UUID conocido antes del POST y registro local
  de adaptadores activos con limpieza garantizada.
- Constructor integrado con panel de parámetros, carga/cancelación,
  reejecución, tabla dinámica, paginación, truncamiento e inspector accesible.
- Playwright incorporado con flujos de ejecución/paginación/reejecución y
  timeout controlado.

## 4. Decisiones técnicas importantes

- El AST universal es la fuente de verdad. El frontend no genera SQL.
- Solo el compilador backend traduce AST validado; no acepta SQL, funciones,
  tablas ni columnas arbitrarias.
- La compilación utiliza únicamente el catálogo local y no abre MySQL.
- MySQL externo se usa para probar conexiones y sincronizar metadatos; las
  credenciales se descifran solo durante esas operaciones.
- Todos los recursos públicos usan UUID.
- Las relaciones inferidas nunca se activan automáticamente; un fingerprint
  estable evita que los rechazos reaparezcan sin cambios materiales.
- Una relación polimórfica siempre conserva la condición de ID y la condición
  del discriminador; este último se compila como parámetro.
- Los objetos de esquema desaparecidos se desactivan, no se borran, para
  conservar historial y configuración semántica.
- Las sesiones usan tokens opacos; el navegador no guarda tokens en
  `localStorage` ni `sessionStorage`.
- Los permisos son códigos centralizados; no se dispersan comparaciones de roles.
- La API usa rutas relativas para funcionar detrás de un reverse proxy bajo el
  mismo dominio.

## 5. Problemas y limitaciones conocidos

- No hay EXPLAIN, reportes ni exportaciones.
- La creación de ejecuciones sigue siendo síncrona. La cancelación activa es
  best-effort y local al proceso; múltiples workers requerirán coordinación
  compartida y cancelación nativa del motor.
- Los resultados no se persisten: navegar entre páginas reejecuta el AST.
- El conteo total está desactivado por defecto y ejecuta una segunda consulta
  cuando se habilita expresamente.
- El constructor visual actual es una primera implementación funcional. Los
  editores avanzados de expresiones recursivas, CASE/CAST/funciones,
  subconsultas correlacionadas y UNION tienen menos asistencia visual que el AST
  y el editor JSON; deben revisarse y completarse en fases posteriores sin
  introducir SQL editable.
- La experiencia del constructor prioriza escritorio; en tamaños pequeños los
  paneles se ocultan y la edición móvil completa aún es limitada.
- No hay autosave ni merge automático de conflictos; el guardado es explícito y
  el usuario debe recargar o duplicar ante un conflicto de revisión.
- La sincronización de esquema es síncrona. Catálogos muy grandes requerirán
  workers en una fase futura.
- La protección SSRF inicial reduce el riesgo, pero no es defensa absoluta ante
  DNS rebinding.
- El descubrimiento remoto de valores polimórficos permanece deshabilitado por
  defecto por privacidad.
- MariaDB se reconoce, pero solo tiene compatibilidad limitada; PostgreSQL,
  SQL Server, Oracle y MongoDB aún no son fuentes externas implementadas.
- El rate limiting distribuido existe para autenticación; las pruebas de
  conexiones externas todavía requieren una política distribuida equivalente.
- En algunos hosts Linux el bind mount del frontend puede crear archivos con el
  UID del contenedor. Para herramientas que escriben, usar el UID/GID del host.
- El encabezado inicial de `README.md` todavía dice Fase 5 y afirma que no hay
  constructor/generación SQL; las secciones posteriores sí documentan Fases
  6–8. Debe corregirse en una tarea documental posterior para evitar mensajes
  contradictorios.
- No hay infraestructura E2E Playwright/Cypress; las pruebas frontend actuales
  son Vitest/Testing Library.

## 6. Estado actual

### Git

- Rama: `main`.
- Base revisada: `5a6f139`, también en `origin/main`.
- La Fase 11 se desarrolla sobre la integración completa de reportes y
  exportaciones.

### Backend

- Once migraciones, desde base inicial hasta reportes y exportaciones.
- Routers para health, auth, usuarios, roles, acceso, conexiones, esquemas,
  relaciones, catálogo semántico, modelo de consultas y compilaciones.
- La última verificación produjo Ruff correcto, MyPy correcto y **85 pruebas
  Pytest aprobadas**, incluidas **5 pruebas de integración MySQL** contra MySQL
  5.6 y MySQL 8.
- El health público es mínimo; readiness detallado requiere autenticación.

### Frontend

- Rutas funcionales para login, administración, conexiones, esquema,
  relaciones, catálogo semántico y consultas.
- Rutas de consultas: `/queries`, `/queries/new`, `/queries/:id`,
  `/queries/:id/builder`, `/queries/:id/edit-json` y `/queries/:id/compile`.
- La última verificación produjo lint y TypeScript correctos, **19 pruebas
  frontend aprobadas**, build de producción correcto y **2 flujos Playwright
  aprobados**.
- El diseño conserva el shell SaaS de la referencia y React Flow está activo en
  relaciones y constructor.

## 7. Fase actual

La **Fase 13** inicia la modernización visual con tokens semánticos y componentes
reutilizables, sin rediseñar todavía las pantallas funcionales.

## 8. Archivos principales para una nueva sesión

Leer primero:

- `AGENTS.md`
- `docs/PROJECT_STATUS.md`
- `README.md`
- `.env.example`
- `docker-compose.yml`
- `Makefile`

Backend:

- `backend/app/main.py` y `backend/app/core/config.py`
- `backend/app/api/dependencies.py` y `backend/app/api/errors.py`
- `backend/app/api/routers/`
- `backend/app/application/queries.py`
- `backend/app/application/compilations.py`
- `backend/app/application/executions.py`
- `backend/app/domain/query_execution/`
- `backend/app/api/routers/executions.py`
- `backend/app/infrastructure/repositories/executions.py`
- `backend/app/domain/query_model/`
- `backend/app/domain/query_compiler/`
- `backend/app/infrastructure/repositories/queries.py`
- `backend/app/infrastructure/repositories/compilations.py`
- `backend/app/infrastructure/adapters/mysql.py`
- `backend/app/db/models/` y `backend/migrations/versions/`
- `backend/tests/test_query_model.py`
- `backend/tests/test_query_compiler.py`

Frontend:

- `frontend/src/router/router.tsx`
- `frontend/src/features/auth/`
- `frontend/src/services/shared.ts`
- `frontend/src/services/queries.ts`
- `frontend/src/features/queries/types.ts`
- `frontend/src/features/query-builder/`
- `frontend/src/features/query-execution/`
- `frontend/src/services/executions.ts`
- `frontend/e2e/query-execution.spec.ts`
- `frontend/src/pages/QueryBuilderPage.tsx`
- `frontend/src/pages/QueryJsonEditorPage.tsx`
- `frontend/src/pages/QueryCompilePage.tsx`
- `frontend/src/pages/NewQueryPage.tsx`
- `frontend/src/styles/index.css`

## 9. Comandos de operación y validación

### Preparación e inicio

```bash
cp .env.example .env
docker compose up --build
docker compose ps -a
make create-admin
```

La clave Fernet pública de `.env.example` solo sirve para desarrollo
descartable y debe reemplazarse antes de guardar credenciales reales. Alembic y
el seeding RBAC idempotente forman parte del arranque. `create-admin` permanece
interactivo.

URLs de desarrollo:

- Frontend: `http://localhost:5173`
- API: `http://localhost:8000/api/v1`
- OpenAPI en desarrollo: `http://localhost:8000/docs`
- MySQL 5.6: `localhost:3307`
- MySQL 8: `localhost:3308`

### Salud, logs y Compose

```bash
curl http://localhost:8000/api/v1/health
docker compose ps
docker compose logs backend frontend
docker compose config
```

`/api/v1/health/ready` es detallado y está protegido; debe consultarse con una
sesión válida.

### Calidad y pruebas

```bash
make backend-lint
make backend-typecheck
make backend-test
make frontend-lint
make frontend-typecheck
make frontend-test
make frontend-build
git diff --check
```

Equivalentes directos útiles:

```bash
docker compose exec -T backend ruff check app tests migrations
docker compose exec -T backend mypy app tests
docker compose exec -T backend pytest -q
docker compose exec -T frontend pnpm lint
docker compose exec -T frontend pnpm typecheck
docker compose exec -T frontend pnpm test
docker compose exec -T frontend pnpm build
```

Si el frontend necesita escribir archivos en un bind mount con permisos del
host:

```bash
docker compose exec -T --user "$(id -u):$(id -g)" frontend pnpm lint
```

### Detener o reconstruir

```bash
make logs
make down
make build
```

`make clean` elimina volúmenes y datos locales; usarlo únicamente en un entorno
desechable y de forma deliberada.

## 10. Fase 10 — reportes, exportaciones y cierre del roadmap inicial

Estado: **completada el 7 de agosto de 2026**. El roadmap inicial 0–10 queda
cerrado sin incorporar SQL libre ni operaciones de escritura.

### Resultado

- Reportes reutilizables asociados a una consulta guardada, revisión concreta e
  instantánea inmutable de su AST.
- Estados borrador, publicado y archivado; CRUD, filtros, publicación,
  archivado, vista previa y ejecución.
- Configuración visual v1: encabezado, pie, orientación, página, locale, zona
  horaria, visibilidad, orden, etiqueta, ancho, alineación y formato de columnas.
- Exportadores reales desacoplados para CSV UTF-8, XLSX Open XML y PDF.
- Historial de exportaciones sin filas, parámetros, credenciales ni SQL
  interpolado.
- Descarga autenticada con revalidación de propiedad, ACL de conexión y campos
  sensibles; expiración, eliminación idempotente y limpieza administrativa.
- Almacenamiento local mediante claves UUID, prevención de path traversal,
  archivos `0600` y volumen Docker persistente preparado por un contenedor init
  no permanente.
- Pantallas de listado, creación/edición, vista previa, publicación, exportación
  e historial, con alternativa de teclado para reordenar columnas.

### Endpoints añadidos

```text
POST/GET              /api/v1/reports
GET/PATCH/DELETE      /api/v1/reports/{report_id}
POST                  /api/v1/reports/{report_id}/publish
POST                  /api/v1/reports/{report_id}/archive
POST                  /api/v1/reports/{report_id}/preview
POST                  /api/v1/reports/{report_id}/execute
POST                  /api/v1/reports/{report_id}/exports
GET                   /api/v1/report-exports
GET/DELETE            /api/v1/report-exports/{export_id}
GET                   /api/v1/report-exports/{export_id}/download
POST                  /api/v1/report-exports/cleanup/expired
```

### Persistencia y dependencias

La migración `20260807_0011_reports.py` crea `reports` y `report_exports` con
FK, restricciones e índices por propietario, consulta, conexión, estado y
fechas. Los archivos permanecen en storage y no como BLOB. Se añadieron
`openpyxl` para XLSX y `reportlab` para PDF; ambos generan archivos reales sin
macros, HTML de usuario, JavaScript ni recursos remotos.

### Variables añadidas

`REPORT_PREVIEW_MAX_ROWS`, `REPORT_EXPORT_MAX_ROWS`,
`REPORT_EXPORT_BATCH_SIZE`, `REPORT_EXPORT_TIMEOUT_SECONDS`,
`REPORT_EXPORT_MAX_FILE_SIZE_BYTES`, `REPORT_EXPORT_RETENTION_DAYS`,
`REPORT_EXPORT_MAX_CONCURRENT_PER_USER`, `REPORT_EXPORT_ALLOWED_FORMATS`,
`REPORT_EXPORT_STORAGE_BACKEND`, `REPORT_EXPORT_STORAGE_PATH`,
`REPORT_CSV_DELIMITER`, `REPORT_CSV_INCLUDE_BOM`, `REPORT_CSV_NULL_VALUE` y
`REPORT_CSV_PROTECT_FORMULAS`. Los valores y límites están documentados en
`docs/reports.md` y `.env.example`.

### Archivos principales

- Backend: `app/domain/reports/`, `app/application/reports.py`,
  `app/infrastructure/exporters/`, `app/infrastructure/storage/`,
  `app/infrastructure/repositories/reports.py`, `app/api/routers/reports.py` y
  `app/api/schemas/reports.py`.
- Frontend: `src/features/reports/`, `src/services/reports.ts`,
  `src/pages/ReportsPage.tsx`, `ReportEditorPage.tsx` y `ReportDetailPage.tsx`.
- Pruebas: `tests/test_report_exporters.py`, `test_report_storage.py`, pruebas de
  componentes/páginas y `e2e/reports.spec.ts`.
- Operación: migración 0011, volumen `report_exports`, servicio
  `report-storage-init`, comando `python -m app.cli cleanup-report-exports`.

### Decisiones y límites conocidos

El modelo previo no conserva una tabla histórica de revisiones de consultas;
por ello el reporte guarda además la instantánea validada del AST. Actualizar la
revisión es una acción explícita. La exportación inicial es síncrona y obtiene
páginas acotadas; el máximo efectivo también respeta
`QUERY_EXECUTION_MAX_ROWS`. La interfaz y los estados admiten evolucionar a un
worker con streaming/distribución. No se implementaron programaciones, correo,
S3/MinIO, dashboards, gráficos ni diseñador libre.

### Documentación y operación final

- Arquitectura y API: `docs/reports.md`.
- Validación integral manual: `docs/MANUAL_TESTING.md`.
- Instalación y recorrido de usuario: `README.md`.
- Limpieza: `docker compose exec -T backend python -m app.cli cleanup-report-exports`.

El backend continúa siendo la única capa que valida AST, resuelve parámetros y
compila SQL parametrizado de solo lectura. Los reportes no almacenan resultados
completos y las funcionalidades de las Fases 0–9 conservan sus contratos.

## 11. Fase 11 — portabilidad Docker del frontend

Estado: **completada el 8 de agosto de 2026**.

- Node queda fijado en 22.17.0 sobre Alpine 3.22 y pnpm en 10.13.1 mediante
  Corepack y `packageManager`.
- `frontend_node_modules` aísla completamente las dependencias del host. El
  store de pnpm permanece separado dentro de la imagen y el contenedor.
- Un entrypoint POSIX calcula la huella de `package.json` y `pnpm-lock.yaml`,
  instala con `--frozen-lockfile` solo al cambiar y ejecuta Vite como usuario
  no root `node`.
- No se mapea el UID/GID del host. La preparación privilegiada se limita a los
  directorios Docker de dependencias; el código fuente no recibe `chown`.
- Vite usa `backend:8000` en la red Docker. El polling es opt-in mediante
  `VITE_USE_POLLING`; el healthcheck permite la inicialización inicial.
- `.gitattributes` fuerza LF en scripts y archivos de configuración de texto.
- Linux fue validado en el entorno actual. Windows Docker Desktop y WSL2 son
  compatibles por diseño, pendientes de validación manual real.
- La operación y troubleshooting están en
  `docs/FRONTEND_DOCKER_PORTABILITY.md`.
- Validación Linux: `docker compose config`, build normal y sin caché, arranque
  con volumen frontend eliminado, proxy al backend, healthcheck, reinicio sin
  reinstalación, lint, TypeScript, 23 pruebas Vitest y build correctos.
- La salida de Vite y los `tsbuildinfo` se dirigen a `/tmp`, evitando artefactos
  del contenedor con propietarios incompatibles sobre el bind mount.
- Windows Docker Desktop y WSL2 no fueron probados realmente; permanecen como
  compatibles por diseño y pendientes de validación manual.

## 12. Fase 12 — portabilidad Docker del backend e infraestructura

Estado: **completada el 8 de agosto de 2026**.

- Python está fijado en 3.12.13 sobre Debian Bookworm slim. El entorno virtual
  vive en `/opt/venv` y no puede ser ocultado por `./backend:/app`.
- `requirements.lock` restringe dependencias directas y transitivas; pip,
  setuptools y wheel también tienen versiones fijas durante el build.
- El backend corre como `datanexus` no root, con UTF-8 y UTC. Bytecode y caches
  de Ruff, MyPy y Pytest no se escriben en el bind mount.
- Compose implementa `postgres healthy → migrations completed → backend`; el
  backend espera además Redis saludable y storage preparado.
- El servicio one-shot `migrations` aplica Alembic hasta head una sola vez por
  arranque. El seeding RBAC del backend continúa siendo idempotente.
- `report-storage-init` asigna el volumen por nombre de usuario, sin UID/GID
  hardcodeados. `report_exports` queda `0700` y los exports conservan `0600`.
- La red ya no tiene nombre global fijo: Compose la aísla por proyecto. El
  puerto interno backend es 8000 y `BACKEND_HOST_PORT` controla solo el host.
- `.env.example` puede iniciar el stack sin Python host y contiene únicamente
  credenciales de desarrollo públicas/ficticias. `DATANEXUS_ENV_FILE` permite
  seleccionar otro archivo de entorno.
- Validación limpia en un proyecto aislado: PostgreSQL/Redis/MySQL/storage y
  frontend sin volúmenes previos, 11 migraciones hasta `20260807_0011`, 29
  tablas públicas, Redis con 0 claves iniciales y todos los servicios sanos.
- Validación de calidad: Ruff correcto, MyPy correcto en 140 archivos y 95
  pruebas Pytest aprobadas. Build normal, reinicio con persistencia y health
  HTTP correctos.
- Windows Docker Desktop y WSL2 no fueron probados realmente; son compatibles
  por diseño y requieren validación manual.
- Un entorno existente de Fase 11 puede requerir recrear una sola vez el
  migrador y el inicializador al adoptar la nueva red aislada:
  `docker compose rm -sf migrations report-storage-init`, seguido de
  `docker compose up -d`. No elimina volúmenes ni requiere borrar datos.
- Guía de operación, migraciones, volúmenes, reset y troubleshooting:
  `docs/BACKEND_DOCKER_PORTABILITY.md`.

## 13. Fase 13 — sistema de diseño y base visual del frontend

Estado: **completada el 8 de agosto de 2026**.

- Tailwind CSS 4 continúa como única solución de estilos. Variables CSS con
  prefijo `--dn-` definen colores semánticos, tipografía, radios y sombras;
  `@theme inline` los expone como utilidades semánticas.
- El tema claro es el único modo activo. Los tokens de superficie/texto están
  preparados para dark mode, pero no existe selector y no se declara soporte
  funcional todavía.
- Se incorporaron primitivas tipadas para acciones, formularios, Card, Panel,
  Badge, Alert, estados de feedback, Modal, ConfirmDialog, Drawer, Tabs, tabla,
  paginación, toolbar, búsqueda, código y detalles técnicos.
- `AppLayout`, `PageContainer`, `PageHeader`, `PageSection`, `TopHeader`,
  `StatusBadge` y `EmptyState` consumen ya la base; las clases históricas siguen
  funcionando sobre tokens para permitir migración gradual sin rediseño masivo.
- La revisión visual posterior corrigió el contenido visible de `IconButton`,
  separación entre etiqueta/estado y etiqueta/métrica, quiebre seguro de SQL
  mode y navegación de retorno desde detalle, edición, esquema, relaciones,
  semántica y sugerencias. Los regresos apuntan al padre lógico y no dependen
  del historial del navegador.
- En el detalle de conexión, el regreso se presenta como breadcrumb y las
  operaciones probar/editar/eliminar se agrupan en un menú contextual; esquema,
  relaciones y semántica permanecen como destinos visibles. El icono de cierre
  de sesión usa el símbolo Power con 24 px y un trazo reforzado mediante una
  regla CSS dedicada. El disparador de más acciones usa superficie, borde e
  icono de 20 px para conservar contraste sobre el fondo de página.
- Modal gestiona Escape, trap y restauración de foco; Tabs soporta flechas,
  Home/End; los formularios enlazan label, ayuda y error mediante ARIA. El focus
  visible es global y las animaciones respetan reducción de movimiento.
- No se añadió ninguna dependencia. Lucide permanece como familia única de
  iconos y no se introdujeron Storybook, librería UI ni proveedor de toast.
- Pruebas específicas cubren Button, Input, Select, Modal, Tabs, Alert y estado
  vacío. ESLint y TypeScript finalizaron correctamente, las 33 pruebas Vitest
  aprobaron y el build Vite completó; permanece el aviso no bloqueante del chunk
  principal de 797.87 kB previo a una futura estrategia de code splitting.
- El contenedor frontend permaneció healthy y una revisión Chromium headless a
  1440 × 1000 confirmó que la pantalla de acceso se sirve sin regresiones
  visibles. No se ejecutó una suite de snapshots visuales porque no existe esa
  infraestructura.
- Documentación de uso y convenciones: `docs/FRONTEND_DESIGN_SYSTEM.md`.
- Límites: no se rediseñaron login, dashboard, navegación funcional ni
  constructor; la migración de controles específicos de cada feature queda para
  sus fases visuales correspondientes.
