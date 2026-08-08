# Portabilidad Docker del backend e infraestructura

DataNexus ejecuta Python, PostgreSQL, Redis, MySQL, Alembic y todas las
herramientas backend dentro de contenedores Linux. El host solo necesita Git,
Docker y Docker Compose v2.

## Requisitos

- Docker Engine o Docker Desktop.
- Docker Compose v2 (`docker compose`).
- Git.
- Emulación `linux/amd64` en ARM para la instancia de pruebas MySQL 5.6.

No instales Python, pip, MySQL ni Redis en el host.

## Primer arranque

```bash
git clone <repositorio>
cd data-nexus
cp .env.example .env
docker compose up --build
```

En PowerShell:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

Espera a que `docker compose ps` muestre backend, frontend, PostgreSQL, Redis y
MySQL saludables. `migrations` y `report-storage-init` deben terminar con código
0. Abre `http://localhost:5173`.

La clave Fernet incluida en `.env.example` es pública y sirve exclusivamente
para un entorno descartable. Reemplázala antes de almacenar credenciales reales.
Puedes generar otra sin Python en el host:

```bash
docker compose run --rm --no-deps backend python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

## Backend y dependencias

La imagen fija Python 3.12.13 sobre Debian Bookworm slim. El entorno virtual
vive en `/opt/venv`, fuera de `/app`, por lo que el bind mount de desarrollo no
oculta dependencias. `requirements.lock` restringe las dependencias directas y
transitivas; `pyproject.toml` conserva los rangos compatibles del proyecto.

Para actualizar dependencias, modifica `pyproject.toml`, resuelve y valida el
lock dentro de una imagen/contenedor deliberado, y reconstruye:

```bash
docker compose build --no-cache backend
docker compose up -d backend
```

No ejecutes pip ni crees `.venv` en el host.

El backend se ejecuta como el usuario no root `datanexus`. Python no escribe
bytecode y Ruff, MyPy y Pytest usan `/tmp` para sus cachés. Los logs salen por
stdout/stderr.

## PostgreSQL

PostgreSQL 17.10 Alpine guarda la base interna en `postgres_data`. Su healthcheck
usa `pg_isready`; el servicio de migraciones no comienza hasta que PostgreSQL
está saludable. El backend no comienza hasta que las migraciones terminan.

## Redis

Redis 7.4.9 Alpine se utiliza para rate limiting distribuido de autenticación.
Su healthcheck usa `redis-cli ping`. El backend espera a Redis saludable. El
volumen `redis_data` conserva el AOF configurado actualmente.

## MySQL

`mysql56_data` y `mysql8_data` pertenecen a fixtures de integración MySQL 5.6.51
y MySQL 8.4.10. No son la base interna de DataNexus. Los adaptadores se conectan a
`mysql56` y `mysql8` mediante DNS de la red Compose.

## Migraciones

Compose aplica una sola cadena Alembic con el servicio one-shot `migrations`:

```text
postgres healthy → migrations exit 0 → backend
```

Comandos desde Docker:

```bash
docker compose run --rm migrations
docker compose exec backend alembic current
docker compose exec backend alembic history
docker compose exec backend alembic revision --autogenerate -m "descripcion"
docker compose exec backend alembic downgrade -1
```

Crear o revertir migraciones modifica datos y debe hacerse deliberadamente. En
producción no ejecutes múltiples migradores concurrentes.

El backend sincroniza roles y permisos de forma idempotente al arrancar. El
primer administrador continúa siendo una acción interactiva:

```bash
docker compose exec backend python -m app.cli create-admin
```

## Almacenamiento de reportes

`report_exports` se monta en `/app/storage/report-exports`. El servicio
`report-storage-init` crea el directorio, lo asigna por nombre a
`datanexus:datanexus` y aplica modo `0700`. Los archivos exportados usan `0600`.
No existe bind mount ni ruta del host para este storage.

## Volúmenes

| Volumen | Contenido | Tratamiento |
| --- | --- | --- |
| `postgres_data` | configuración, usuarios, catálogo, consultas y reportes | persistente; crítico |
| `redis_data` | AOF de Redis/rate limiting | persistente |
| `mysql56_data` | fixture MySQL 5.6 | persistente de desarrollo |
| `mysql8_data` | fixture MySQL 8 | persistente de desarrollo |
| `report_exports` | archivos CSV/XLSX/PDF | persistente; puede contener datos sensibles |
| `frontend_node_modules` | dependencias frontend | descartable |

`docker compose down` conserva todos los volúmenes.

## Redes, puertos y variables

Compose crea una red aislada por proyecto; no usa IPs fijas. Entre contenedores
se usan `postgres:5432`, `redis:6379`, `backend:8000`, `mysql56:3306` y
`mysql8:3306`. `BACKEND_HOST_PORT` controla únicamente el puerto publicado; el
puerto interno permanece en 8000.

`DATANEXUS_ENV_FILE` permite seleccionar otro archivo de entorno y por defecto
apunta a `.env`. Los valores `*_HOST_PORT` solo afectan al host.

## Linux

Usa un usuario con acceso al daemon Docker. DataNexus no requiere `sudo` en sus
comandos ni mapea el UID del host. El backend no escribe artefactos sobre el
bind mount durante el flujo normal.

## Windows + Docker Desktop

Usa contenedores Linux y comandos PowerShell indicados arriba. Las rutas son
relativas, la red está aislada por proyecto y los scripts/textos conservan LF.
Compatible por diseño; pendiente de validación manual real en Windows.

## WSL2

Se recomienda clonar en `~/projects/data-nexus` dentro del filesystem Linux de
WSL en vez de `/mnt/c/...` para mejorar el rendimiento de bind mounts. No es un
requisito funcional. Compatible por diseño; pendiente de validación manual.

## Operación y calidad

```bash
docker compose up --build
docker compose down
docker compose ps -a
docker compose logs -f backend migrations
docker compose exec backend ruff check app tests migrations
docker compose exec backend mypy app tests
docker compose exec backend pytest -q
```

## Reset completo

`docker compose down -v` elimina PostgreSQL, Redis, ambos MySQL, exportaciones y
dependencias frontend. Es destructivo y no debe usarse como solución habitual.
Antes de ejecutarlo, exporta o respalda cualquier dato necesario y confirma el
nombre del proyecto Compose.

Para pruebas destructivas usa un proyecto aislado (`docker compose -p nombre`)
y puertos alternos. El nombre de proyecto también aísla redes y volúmenes.

## Troubleshooting

| Problema | Diagnóstico probable | Solución segura |
| --- | --- | --- |
| Backend `permission denied` | Bind mount o storage heredado con permisos incorrectos. | Revisa `docker compose logs backend report-storage-init`; no uses `chmod 777`. Recrea el init de storage. |
| Database connection refused | PostgreSQL no está saludable o el host interno fue sobrescrito. | Usa `docker compose ps -a`; dentro de Docker debe ser `postgres:5432`. |
| Redis unavailable | Redis no está saludable o su volumen tiene un error. | Revisa `docker compose logs redis` y `docker compose exec redis redis-cli ping`. |
| Migration failed | Variables incorrectas, migración inválida o base incompatible. | Revisa `docker compose logs migrations`; corrige la causa antes de iniciar backend. |
| One-shot no resuelve `postgres` o menciona la red antigua al actualizar desde Fase 11 | Compose reutilizó `migrations`/`report-storage-init` conectados a la antigua red global. | Ejecuta una sola vez `docker compose rm -sf migrations report-storage-init` y después `docker compose up -d`. No elimina volúmenes. |
| Storage no writable | El inicializador no terminó o el volumen conserva propietario incorrecto. | Ejecuta `docker compose up report-storage-init` y verifica que termine en 0. |
| Backend `unhealthy` | Uvicorn no inició o `/api/v1/health` no responde. | Revisa logs y conserva el puerto interno 8000; cambia solo `BACKEND_HOST_PORT`. |
| Puerto ocupado | Otro proceso publica el mismo puerto. | Cambia el `*_HOST_PORT` correspondiente en `.env`. |
| Variable faltante | `.env` no existe o está incompleto. | Copia de nuevo `.env.example`, conserva secretos reales y revisa `docker compose config`. |
| `bad interpreter` o `^M` | Checkout CRLF. | Recupera el archivo respetando `.gitattributes`; los scripts internos deben usar LF. |

## Matriz de compatibilidad

| Entorno | Estado |
| --- | --- |
| Linux + Docker Engine | probado |
| Windows + Docker Desktop | compatible por diseño; pendiente validación manual |
| Windows + WSL2 | compatible por diseño; pendiente validación manual |
| Base vacía | probado: 11 migraciones y 29 tablas públicas |
| Redis vacío | probado: inicio con 0 claves |
| Storage vacío | probado: creación, permisos y escritura |
| Sin Python host | probado por flujo Docker; ninguna operación requiere Python host |
| Sin MySQL host | probado con MySQL 5.6/8 en Compose |
| Sin Redis host | probado con Redis en Compose |
| Reinicio normal | probado con persistencia de PostgreSQL y storage |
| Reconstrucción backend | probado |

La validación limpia usó `.env.example` directamente, un nombre de proyecto
aislado, puertos alternos y seis volúmenes nuevos. No fue un segundo checkout
físico, pero reprodujo las dependencias y el estado persistente de un clon nuevo.
