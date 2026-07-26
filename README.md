# DataNexus

DataNexus es una plataforma visual de consultas y reportes multifuente. El
repositorio contiene actualmente la **Fase 2**, con infraestructura, shell
visual responsive y gestión segura de conexiones MySQL.

## Alcance actual

- API FastAPI con health, readiness y CRUD/pruebas de conexiones mediante UUID.
- Frontend React, TypeScript, Vite y Tailwind CSS con rutas iniciales.
- Layout SaaS responsive con sidebar, navegación principal y páginas temporales.
- Dashboard visual con datos simulados explícitos y estado real del backend.
- PostgreSQL como base interna y Redis como infraestructura auxiliar.
- MySQL 5.6 y MySQL 8 como fuentes externas de pruebas de integración.
- Credenciales cifradas con Fernet, política SSRF y auditoría básica.
- Alembic y herramientas de pruebas, linting y comprobación de tipos.

No incluye autenticación, sincronización de esquemas, constructor de consultas
ni reportes funcionales.

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

La migración inicial es una base vacía: confirma que Alembic funciona sin crear
tablas de negocio.

## Operación de Docker Compose

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
