# Estado del proyecto DataNexus

Actualizado: 1 de agosto de 2026. Este documento describe la rama de trabajo de
la **Fase 9**, construida sobre `main` en `6d06ffd` (merge de la Fase 8).

## 1. Objetivo general

DataNexus es una plataforma empresarial para registrar fuentes de datos,
catalogar su estructura y relaciones, construir consultas visualmente y
convertirlas de forma segura a consultas parametrizadas. El diseño busca que el
núcleo sea multifuente: MySQL es el primer adaptador, pero los contratos deben
permitir PostgreSQL, SQL Server, Oracle, MongoDB, APIs y archivos.

El producto ya ejecuta consultas de solo lectura desde el AST validado y
presenta resultados paginados. Guardar reportes y exportarlos permanece para
fases posteriores.

## 2. Arquitectura y tecnologías actuales

### Backend

- Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2 y Alembic.
- PostgreSQL 17 como base interna para configuración, catálogo, seguridad,
  borradores y compilaciones.
- Redis 7.4 para rate limiting distribuido y preparación de trabajo futuro.
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
Redis, MySQL 5.6 y MySQL 8.4. Vite redirige `/api/v1` al backend en desarrollo.
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
- Base revisada: `6d06ffd`, también en `origin/main`.
- El árbol contiene la implementación local completa de la Fase 9 pendiente de
  commit; `AGENTS.md` y la creación inicial de este documento ya existían antes
  de comenzar la fase.

### Backend

- Diez migraciones, desde base inicial hasta `query_executions`.
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

## 7. Próxima fase

La siguiente fase debe ser **Fase 10: reportes reutilizables** sobre consultas y
metadatos de ejecución. Debe reutilizar los contratos de columnas y resultados,
sin almacenar datasets completos por defecto. Las exportaciones definitivas,
programaciones y dashboards avanzados deben permanecer para fases posteriores.

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
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
make up
make ps
make migrate
make seed-rbac
make create-admin
```

El comando de Fernet solo genera la clave que debe copiarse a
`CREDENTIAL_ENCRYPTION_KEY`; no se debe reutilizar una clave de desarrollo en
producción. `create-admin` solicita la contraseña interactivamente.

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
