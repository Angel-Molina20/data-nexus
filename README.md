# DataNexus

DataNexus es una plataforma visual de consultas y reportes multifuente. El
repositorio contiene actualmente la **Fase 5**, con infraestructura, conexiones
MySQL, catálogo semántico y autenticación/autorización real.

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

No incluye OAuth, LDAP, SAML, MFA, constructor de consultas, generación SQL ni
reportes funcionales.

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

En algunos hosts Linux, el volumen enlazado de `frontend` puede conservar
archivos generados con el UID del contenedor. Los comandos de calidad funcionan;
cuando una herramienta deba reescribirlos, debe ejecutarse con el UID/GID del
host. No se cambió la estrategia de volúmenes en esta fase para no mezclar esa
incidencia de infraestructura con autenticación.

## Requisitos

- Docker Engine.
- Docker Compose v2 (`docker compose`).
- En hosts ARM, soporte de emulación `linux/amd64` para MySQL 5.6.

No es necesario instalar Python, Node.js ni las herramientas de calidad en el
host.

## Inicio rápido

1. Crea el archivo local de variables:

   ```bash
   cp .env.example .env
   ```

2. Revisa los valores ficticios de desarrollo y cámbialos si el entorno lo
   requiere.
   Genera una clave Fernet y asígnala a `CREDENTIAL_ENCRYPTION_KEY`:

   ```bash
   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
   ```

   No reutilices claves de desarrollo en producción. Perder la clave impide
   recuperar las credenciales cifradas.
3. Construye e inicia los servicios:

   ```bash
   make up
   ```

4. Comprueba su estado:

   ```bash
   make ps
   curl http://localhost:8000/api/v1/health
   curl http://localhost:8000/api/v1/health/ready
   ```

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
la estructura y `/queries/{id}/edit-json` ofrece el editor técnico ligero. Esta fase no compila,
previsualiza ni ejecuta SQL, no acepta nombres físicos arbitrarios y no toca la fuente MySQL.

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
