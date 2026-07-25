# DataNexus

DataNexus es una plataforma visual de consultas y reportes multifuente. El
repositorio contiene actualmente la **Fase 0**, una infraestructura de
desarrollo funcional sin modelos ni funcionalidades de negocio.

## Alcance actual

- API FastAPI con endpoints de health y readiness.
- Frontend React, TypeScript, Vite y Tailwind CSS con rutas iniciales.
- PostgreSQL como base interna y Redis como infraestructura auxiliar.
- MySQL 5.6 y MySQL 8 como fuentes externas para futuras pruebas de integración.
- Alembic y herramientas de pruebas, linting y comprobación de tipos.

No incluye autenticación, gestión de conexiones, adaptadores, sincronización de
esquemas, constructor de consultas ni reportes.

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
```

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
├── frontend/                # React, Vite, rutas, páginas y servicios
├── docs/design/             # Referencia visual para fases posteriores
├── docker-compose.yml
├── Makefile
└── .env.example
```

La referencia visual no se incorpora en la interfaz durante esta fase.
