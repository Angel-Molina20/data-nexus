# DataNexus

DataNexus es una plataforma visual de consultas y reportes multifuente. El
roadmap inicial está completo hasta la **Fase 10**, con constructor visual,
ejecución segura y reportes reutilizables exportables a CSV, XLSX y PDF.
La Fase 11 inicia el segundo roadmap con un frontend reproducible y portable en
Docker; consulta [`docs/FRONTEND_DOCKER_PORTABILITY.md`](docs/FRONTEND_DOCKER_PORTABILITY.md).
La Fase 12 extiende el mismo flujo reproducible al backend, migraciones y
servicios; consulta [`docs/BACKEND_DOCKER_PORTABILITY.md`](docs/BACKEND_DOCKER_PORTABILITY.md).
La Fase 13 incorpora la base visual reutilizable del frontend; tokens,
componentes, accesibilidad y convenciones se documentan en
[`docs/FRONTEND_DESIGN_SYSTEM.md`](docs/FRONTEND_DESIGN_SYSTEM.md).
La organización feature-first, reglas de imports, APIs, hooks y formato del
frontend se documentan en
[`docs/FRONTEND_ARCHITECTURE.md`](docs/FRONTEND_ARCHITECTURE.md).

## Alcance actual

- API FastAPI con health, readiness y CRUD/pruebas de conexiones mediante UUID.
- Frontend React, TypeScript, Vite y Tailwind CSS con rutas iniciales.
- Layout SaaS responsive con sidebar, navegación principal y páginas temporales.
- Dashboard visual con datos simulados explícitos y estado real del backend.
- PostgreSQL como base interna y Redis como infraestructura auxiliar.
- MySQL 5.6 y MySQL 8 como fuentes externas de pruebas de integración.
- Credenciales cifradas con Fernet, política SSRF y auditoría básica.
- Sincronización transaccional de tablas, vistas, campos, índices y claves
  foráneas físicas hacia PostgreSQL.
- Explorador de esquemas, historial y cambios con eliminación lógica.
- Catálogo unificado de relaciones físicas, inferidas, manuales y polimórficas.
- Nombres de negocio, tipos semánticos, visibilidad, campos sensibles y grafo
  básico mediante React Flow.
- Sesiones opacas, cookies HttpOnly, CSRF, Argon2id, RBAC y acceso por conexión.
- Alembic y herramientas de pruebas, linting y comprobación de tipos.

No incluye OAuth, LDAP, SAML, MFA, editor SQL libre, programaciones, envíos
automáticos ni dashboards avanzados.

## Reportes y exportaciones

Desde `/reports` se crea un reporte a partir de una consulta guardada. El reporte
fija su revisión y una instantánea del AST, permite configurar presentación y
columnas, ofrece vista previa real y exporta CSV, XLSX o PDF. Cada ejecución
reutiliza el servicio seguro de consultas; el navegador nunca envía SQL.

Los archivos se guardan fuera de PostgreSQL en el volumen `report_exports`, con
nombre interno aleatorio, permisos restrictivos, historial y expiración. La
descarga revalida permisos actuales. Consulta
[`docs/reports.md`](docs/reports.md) para arquitectura, endpoints, contratos y
variables, y [`docs/MANUAL_TESTING.md`](docs/MANUAL_TESTING.md) para el recorrido
manual completo.

Limpieza manual o desde cron:

```bash
docker compose exec -T backend python -m app.cli cleanup-report-exports
```

## Ejecución de consultas

El constructor permite ejecutar exclusivamente el AST universal validado. El
backend aplica compilación parametrizada, transacción de solo lectura,
paginación, límites de filas/tamaño, timeout, cancelación best-effort e
historial de metadatos. La tabla frontend admite columnas dinámicas,
renderizadores por tipo e inspección de valores. Consulta
[`docs/query-execution.md`](docs/query-execution.md) para contratos, variables,
seguridad, pruebas y limitaciones.

## Autenticación y autorización

DataNexus ya no funciona anónimamente. Solo `/api/v1/health` permanece público;
readiness y todos los recursos de las Fases 2–4 requieren sesión.

Las sesiones usan tokens opacos aleatorios. El navegador recibe una cookie
HttpOnly y PostgreSQL guarda únicamente SHA-256 del token. Hay expiración por
inactividad y absoluta, revocación persistente y rotación al cambiar la
contraseña. En producción se exige HTTPS y `SESSION_COOKIE_SECURE=true`.

Las contraseñas utilizan Argon2id con salt automático y rehash oportunista. No
se cifran con Fernet y nunca se devuelven hashes. La política, bloqueo temporal
y límites de intentos se configuran en `.env`.

Las mutaciones requieren un token CSRF asociado a la sesión mediante
`X-CSRF-Token`, además de validar Origin. El frontend obtiene el token desde un
endpoint controlado, usa `credentials: include` y no guarda tokens en
`localStorage` ni `sessionStorage`.

Inicializa roles y permisos y crea el primer administrador de forma interactiva:

```bash
make migrate
make seed-rbac
make create-admin
```

`create-admin` solicita correo, nombre, contraseña y confirmación sin exponer la
contraseña en argumentos del proceso. No existe usuario ni contraseña
predeterminada. Los roles de sistema son `administrator`, `analyst` y `viewer`;
las decisiones backend usan permisos, no comparaciones de nombres de rol.

El acceso a cada conexión usa `viewer < analyst < manager`. Salvo el
superusuario bootstrap, un permiso global no concede por sí solo acceso a una
fuente. Los recursos ajenos responden como no encontrados.

El rate limiting de login se distribuye con Redis por IP y cuenta normalizada.
Los bloqueos, logins, cambios de contraseña, usuarios, roles, accesos y
revocaciones generan auditoría sanitizada sin contraseñas, cookies, CSRF ni
tokens.

Variables principales:

```text
PASSWORD_MIN_LENGTH=12
SESSION_IDLE_TIMEOUT_MINUTES=60
SESSION_ABSOLUTE_TIMEOUT_HOURS=12
SESSION_COOKIE_SECURE=false
MAX_FAILED_LOGIN_ATTEMPTS=5
ACCOUNT_LOCK_MINUTES=15
LOGIN_RATE_LIMIT_PER_MINUTE=5
LOGIN_ACCOUNT_RATE_LIMIT_PER_15_MINUTES=10
ALLOWED_ORIGINS=http://localhost:5173
```

Tras un reverse proxy deben conservarse HTTPS, cookies Secure, Origin correcto
y cabeceras de cliente confiables. La recuperación por correo, OAuth, LDAP,
Microsoft Entra ID, SAML y MFA quedan expresamente pendientes.

## Requisitos

- Docker Engine.
- Docker Compose v2 (`docker compose`).
- En hosts ARM, soporte de emulación `linux/amd64` para MySQL 5.6.

No es necesario instalar Python, Node.js, npm, pnpm, Vite ni las herramientas
de calidad en el host.

## Inicio rápido

1. Crea el archivo local de variables:

   ```bash
   cp .env.example .env
   ```

   En PowerShell usa `Copy-Item .env.example .env`.

2. Revisa los valores ficticios de desarrollo y cámbialos si el entorno lo
   requiere. La clave Fernet de ejemplo es pública y solo permite un arranque
   local descartable. Antes de guardar credenciales reales, genera otra dentro
   de Docker siguiendo la guía de portabilidad backend. Perder la clave impide
   recuperar las credenciales cifradas.
3. Construye e inicia los servicios directamente con Docker Compose:

   ```bash
   docker compose up --build
   ```

4. Comprueba su estado:

   ```bash
   docker compose ps
   curl http://localhost:8000/api/v1/health
   curl http://localhost:8000/api/v1/health/ready
   ```

`Makefile` permanece como conveniencia, pero no es obligatorio. En el primer
arranque el contenedor inicializa su volumen privado de `node_modules`; nunca se
debe ejecutar `npm install` ni `pnpm install` en el host.
Para añadir o quitar paquetes usa `frontend/manage-dependencies.sh` mediante
`docker compose exec`, como documenta la guía de portabilidad.
Compose aplica Alembic automáticamente una sola vez antes de iniciar el backend
y prepara el volumen de exportaciones sin intervención manual.

## URLs y puertos

| Recurso | URL o puerto del host |
| --- | --- |
| Frontend | http://localhost:5173 |
| Backend | http://localhost:8000 |
| OpenAPI | http://localhost:8000/docs |
| PostgreSQL | `localhost:5432` |
| Redis | `localhost:6379` |
| MySQL 5.6 | `localhost:3307` |
| MySQL 8 | `localhost:3308` |

Los puertos del host pueden ajustarse en `.env`. Dentro de Docker, los servicios
usan sus puertos nativos.

## Migraciones y calidad

Todos los comandos se ejecutan dentro de los contenedores:

```bash
make migrate
make backend-test
make backend-lint
make backend-typecheck
make frontend-lint
make frontend-typecheck
make frontend-test
make frontend-build
docker compose exec -T frontend pnpm test:e2e
```

## Conexiones MySQL

El asistente `/connections/new` selecciona MySQL, recibe la configuración y
exige una prueba correcta antes de guardar. La edición deja la contraseña vacía
para conservar la actual.

```text
POST   /api/v1/connections/test
POST   /api/v1/connections
GET    /api/v1/connections
GET    /api/v1/connections/{uuid}
PATCH  /api/v1/connections/{uuid}
DELETE /api/v1/connections/{uuid}
POST   /api/v1/connections/{uuid}/test
```

Las respuestas y auditorías nunca incluyen contraseñas ni cadenas de conexión.
MariaDB se detecta y advierte explícitamente, pero su compatibilidad completa no
está garantizada.

## Seguridad de red y producción

La política inicial bloquea loopback, direcciones no especificadas y link-local,
resuelve DNS y permite configurar redes privadas con
`ALLOW_PRIVATE_DATABASE_HOSTS`, `ALLOWED_DATABASE_HOSTS` y
`BLOCKED_DATABASE_HOSTS`. `mysql56` y `mysql8` están permitidos en desarrollo.
Esta medida reduce SSRF, pero no elimina totalmente el riesgo de DNS rebinding.

En producción el backend no debe publicar el puerto 8000: debe usar `expose` en
una red privada y un reverse proxy debe servir frontend y `/api/*` bajo el mismo
dominio. `APP_ENV=production` deshabilita Swagger, ReDoc y OpenAPI. Compose
mantiene el puerto y la documentación para desarrollo.

MySQL 5.6 es legacy, requiere `linux/amd64` y puede presentar limitaciones TLS
en plataformas modernas. El rate limiting distribuido de las pruebas queda
pendiente; no se añadió un limitador en memoria incompatible con múltiples
instancias.

## Sincronización y exploración de esquemas

Desde el detalle de una conexión se puede abrir **Explorar esquema** o llamar:

```text
POST /api/v1/connections/{uuid}/schema/synchronize
GET  /api/v1/connections/{uuid}/schema/summary
GET  /api/v1/connections/{uuid}/schema/entities
GET  /api/v1/connections/{uuid}/schema/entities/{entity_uuid}
GET  /api/v1/connections/{uuid}/schema/relationships
GET  /api/v1/connections/{uuid}/schema/synchronizations
GET  /api/v1/connections/{uuid}/schema/synchronizations/{sync_uuid}
GET  /api/v1/connections/{uuid}/schema/changes
```

La inspección ejecuta cuatro consultas parametrizadas y por lotes sobre
`information_schema`: entidades, columnas, índices y claves foráneas. Nunca
ejecuta `SELECT` sobre tablas del usuario ni guarda registros, definiciones de
vistas, rutinas, triggers o eventos. Para el usuario remoto se recomiendan
únicamente `SELECT` y `SHOW VIEW`, además de visibilidad de `information_schema`.

`TABLE_ROWS` es una estimación —especialmente con InnoDB— y no se considera un
cambio estructural. Los objetos ausentes se marcan inactivos y se conservan en
el historial; si reaparecen, se reactivan. Las claves foráneas físicas
permanecen como fuente de verdad del esquema remoto y se proyectan en el
catálogo unificado sin duplicarlas.

La sincronización es síncrona, usa un bloqueo advisory de PostgreSQL por
conexión y guarda el catálogo en una transacción. Se configura con
`SCHEMA_SYNC_TIMEOUT_SECONDS`, `SCHEMA_SYNC_MAX_ENTITIES`,
`SCHEMA_SYNC_INCLUDE_VIEWS` y `SCHEMA_SYNC_INCLUDE_SYSTEM_SCHEMAS`. Si una
fuente supera el límite, debe aumentarse deliberadamente antes de reintentar.
Fuentes con miles de entidades requerirán ejecución asíncrona en una fase
posterior. MySQL 5.6 y MySQL 8 están cubiertos; los metadatos opcionales no
disponibles generan advertencias, mientras que no poder leer tablas o columnas
falla de forma controlada y conserva el catálogo anterior.

## Relaciones y capa semántica

Las relaciones se administran desde
`/connections/{uuid}/relationships`; el catálogo semántico, desde
`/connections/{uuid}/semantic-catalog`. El catálogo diferencia:

- **Física:** clave foránea MySQL, confirmada y no editable estructuralmente.
- **Inferida:** sugerencia local como `student_id → students.id`; requiere
  confirmación.
- **Manual:** pares de campos elegidos por un administrador, incluso compuestos.
- **Polimórfica:** discriminador e identificador obligatorios, por ejemplo
  `documents.class = "Student"` y `documents.class_id = students.id`.

La detección trabaja exclusivamente con PostgreSQL después de sincronizar; no
consulta datos remotos. Puntúa la coincidencia de nombre, compatibilidad de
tipo, PK/unique e índice de origen, y penaliza ambigüedad o metadatos inactivos.
`0.85–1.00` es confianza alta, `0.60–0.84` media y el resto baja. Ningún nivel
confirma automáticamente.

El fingerprint SHA-256 estable incluye conexión, tipo, entidades, campos,
origen y condiciones, pero excluye confianza, fechas y etiquetas. Por eso un
rechazo no reaparece salvo que cambie materialmente la sugerencia. Las tablas
puente son candidatos informativos y no crean relaciones muchos-a-muchos.

La compatibilidad distingue compatible, compatible con advertencia e
incompatible; bloquea tipos incompatibles y valida signo, longitud y precisión.
La cardinalidad se estima con unicidad/PK y puede ajustarse manualmente. Las
relaciones compuestas conservan el orden de sus pares.

La capa semántica extiende entidades y campos físicos sin copiarlos. Conserva
nombres visibles, singular/plural, descripción, dominio, tags, visibilidad,
tipo semántico, formato y marca sensible. La resincronización no borra esta
configuración; si desaparece un campo o entidad relacionado, la relación queda
inválida y deshabilitada.

Los morph maps (`Student`, `student`, `App\Models\Student`, etc.) se ingresan
explícitamente: DataNexus nunca supone que una clase corresponde a una tabla.
El descubrimiento de valores está deshabilitado por defecto y esta entrega no
lee esos valores de negocio; el endpoint devuelve un error público controlado.

```text
RELATIONSHIP_DETECTION_ENABLED=true
RELATIONSHIP_MIN_CONFIDENCE=0.50
RELATIONSHIP_MAX_CANDIDATES=1000
RELATIONSHIP_MAX_COMPOSITE_FIELDS=8
POLYMORPHIC_MAX_MAPPINGS=100
ENABLE_POLYMORPHIC_VALUE_DISCOVERY=false
POLYMORPHIC_VALUE_DISCOVERY_LIMIT=100
POLYMORPHIC_VALUE_DISCOVERY_TIMEOUT_SECONDS=10
```

Los nombres, tags, discriminadores y mappings tienen límites de longitud y
cantidad. No se exponen credenciales o URLs, no se ejecuta SQL aportado por el
usuario y no se modifica MySQL. El catálogo prepara el futuro compilador, pero
esta fase todavía no genera ni ejecuta consultas.

## Operación de Docker Compose

## Modelo universal de consultas

DataNexus representa cada consulta mediante un AST JSON versionado (`schema_version: 1.0`).
El frontend nunca envía SQL: referencia conexiones, entidades, campos y relaciones mediante UUID,
y utiliza identificadores locales para sources, scopes y aliases. El modelo incluye selecciones,
expresiones, funciones universales, agregaciones, predicados, joins físicos/lógicos/polimórficos,
parámetros, agrupación, HAVING, ordenamiento, subconsultas correlacionadas, EXISTS, IN y UNION.

La API expone el JSON Schema en `GET /api/v1/query-model/schema` y permite validar,
normalizar y calcular complejidad sin consultar MySQL. La validación se realiza contra el catálogo
local de PostgreSQL, revisa visibilidad semántica, campos sensibles, acceso `analyst`, relaciones y
capacidades detectadas. Una relación polimórfica requiere tanto relación como mapping, conservando
el discriminador y el identificador para el futuro compilador.

Los borradores se guardan en `saved_queries` como JSONB, con propietario, fingerprint SHA-256,
resultado de validación, complejidad y revisión optimista. Un `PATCH` con revisión antigua responde
`QUERY_REVISION_CONFLICT`; no sobrescribe cambios silenciosamente. Los parámetros sensibles no
pueden guardar defaults y los documentos nunca contienen valores de ejecución.

```text
GET/POST /api/v1/queries
GET/PATCH/DELETE /api/v1/queries/{uuid}
POST /api/v1/queries/{uuid}/validate
POST /api/v1/queries/{uuid}/duplicate
POST /api/v1/queries/{uuid}/archive
```

Los límites `QUERY_MAX_*` controlan tamaño, nodos, profundidad, joins, selecciones, parámetros,
unions, valores IN y límite declarado. `/queries/new` crea plantillas AST; `/queries/{id}` muestra
la estructura y `/queries/{id}/edit-json` ofrece el editor técnico ligero.

## Compilador SQL seguro para MySQL

La Fase 7 incorpora un registro extensible de compiladores y el primer dialecto para MySQL. El
compilador recibe exclusivamente el AST universal validado, crea un snapshot del catálogo guardado
en PostgreSQL y resuelve desde allí esquemas, tablas, columnas y relaciones. No abre conexiones a
MySQL durante esta operación.

El SQL generado contiene identificadores citados y placeholders `:p_N`. Literales, parámetros
declarados, límites y discriminadores polimórficos permanecen separados del texto SQL. Las
relaciones polimórficas siempre incluyen la comparación del identificador y la condición del
discriminador. No se aceptan nombres físicos, funciones, operadores ni fragmentos SQL libres.

El dialecto soporta SELECT, DISTINCT, expresiones, funciones universales controladas, agregaciones,
CASE, CAST, filtros, GROUP BY, HAVING, ORDER BY, joins físicos/lógicos/polimórficos, subconsultas,
correlación, EXISTS, IN, UNION, LIMIT y OFFSET. MySQL 5.6 y MySQL 8 utilizan el perfil de capacidades
detectado; no se generan CTE, funciones de ventana ni JSON_TABLE. Percona usa el perfil MySQL y
MariaDB genera una advertencia de compatibilidad limitada.

```text
POST /api/v1/query-compiler/compile
GET  /api/v1/query-compiler/capabilities/{connection_id}
POST /api/v1/queries/{query_id}/compile
GET  /api/v1/queries/{query_id}/compilations
GET  /api/v1/queries/{query_id}/compilations/{compilation_id}
```

Las compilaciones de borradores pueden persistir el template parametrizado, fingerprints,
capacidades y metadata, pero nunca valores reales de parámetros. Requieren `queries.compile` y
acceso `analyst` o superior. `/queries/:id/compile` muestra una vista previa de solo lectura; no
existe botón ni endpoint de ejecución.

```text
QUERY_COMPILATION_TIMEOUT_SECONDS=10
QUERY_MAX_GENERATED_SQL_KB=512
QUERY_MAX_BOUND_PARAMETERS=5000
QUERY_COMPILER_PRETTY_SQL=true
QUERY_COMPILER_STORE_RESULTS=true
```

Esta fase no ejecuta consultas, no conecta con MySQL para compilar y no permite editar el SQL
producido. La ejecución, resultados y parámetros reales corresponden a una fase posterior.

## Constructor visual de consultas (Fase 8)

La ruta `/queries/:queryId/builder` edita directamente el AST universal. El catálogo izquierdo
utiliza entidades y campos sincronizados; React Flow representa fuentes y joins; el inspector
configura selección, filtros `WHERE`/`HAVING`, agregaciones, agrupación, orden, parámetros y
ramas `UNION`. Las relaciones físicas, inferidas confirmadas, manuales y polimórficas se añaden
por UUID; estas últimas requieren un mapping que conserva discriminador e identificador.

El constructor mantiene undo/redo, cambios sin guardar y revisión optimista. Las posiciones del
diagrama viven en `metadata.builder_layout`, se validan en backend y no forman parte del
fingerprint lógico. La validación y la complejidad proceden del modelo universal; el SQL mostrado
procede exclusivamente del compilador backend, contiene placeholders, es de solo lectura y
siempre informa `executed=false`.

En escritorio se muestran catálogo, lienzo e inspector simultáneamente; en resoluciones menores
los paneles se colapsan para priorizar el lienzo. Drag and drop no es obligatorio para operar:
campos, relaciones y orden también disponen de botones accesibles. Los límites visuales pueden
ajustarse con `VITE_QUERY_BUILDER_*`, pero los controles de seguridad reales permanecen en el
backend. Esta fase no ejecuta consultas, no muestra resultados, no persiste valores reales de
parámetros y no permite escribir o editar SQL.

```bash
make build       # construir imágenes
make up          # construir e iniciar en segundo plano
make logs        # seguir logs
make ps          # listar servicios
make down        # detener y retirar contenedores
make clean       # retirar contenedores y volúmenes de desarrollo
```

`make clean` elimina los datos persistidos de PostgreSQL, Redis y ambas
instancias MySQL. No lo uses si necesitas conservar datos locales.

## Limitaciones conocidas de MySQL 5.6

MySQL 5.6 está fuera de soporte upstream y su imagen oficial
`mysql:5.6.51` es legacy. El servicio se fija a `linux/amd64`; en equipos ARM
depende de emulación y puede iniciar lentamente o no estar disponible si el
host no admite esa arquitectura. No se sustituye por MariaDB. Esta instancia
solo se usa como fuente externa de pruebas y el backend no depende de ella para
arrancar.

## Estructura

```text
.
├── backend/                 # FastAPI, SQLAlchemy, Alembic y pruebas
│   ├── app/
│   │   ├── api/             # Routers y contratos HTTP
│   │   ├── core/            # Configuración y logging
│   │   └── db/              # Motor, sesiones y base declarativa
│   ├── migrations/
│   └── tests/
├── frontend/                # React, shell visual, rutas, páginas y servicios
├── docs/design/             # Referencia visual para fases posteriores
├── docker-compose.yml
├── Makefile
└── .env.example
```

La referencia visual no se incorpora en la interfaz durante esta fase.
