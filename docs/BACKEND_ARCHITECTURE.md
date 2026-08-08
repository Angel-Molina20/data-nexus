# Arquitectura backend de DataNexus

## Principios

El backend sigue una arquitectura modular pragmática. FastAPI presenta los
contratos HTTP, `application` coordina casos de uso, `domain` contiene reglas y
contratos independientes del transporte, e `infrastructure` implementa acceso a
PostgreSQL, MySQL, Redis, exportadores y almacenamiento.

```text
api -> application -> domain
          |              ^
          v              |
    infrastructure ------+
```

No se exige una entidad de dominio distinta de cada modelo SQLAlchemy cuando no
existe una transformación o regla que justifique esa duplicación.

## Directorios

- `app/api`: routers, schemas HTTP, handlers y composición de dependencias.
- `app/application`: servicios que coordinan autorización, repositorios,
  transacciones, adaptadores y respuestas.
- `app/domain`: AST, compilador, políticas, capacidades, relaciones y contratos.
- `app/infrastructure`: adaptadores, repositorios, cifrado, rate limiting,
  exportadores y storage.
- `app/db`: sesión y modelos SQLAlchemy de la base interna.
- `migrations`: historial Alembic inmutable.
- `tests`: pruebas unitarias e integración por comportamiento.

## Presentación y routers

Un endpoint recibe schemas validados, obtiene dependencias, llama a un servicio y
devuelve el resultado. No debe construir SQL, coordinar varios repositorios ni
implementar autorización de negocio. `api/context_factories.py` compone los
contextos de aplicación; `api/dependencies.py` conserva exclusivamente la
integración con `Depends`, cookies, CSRF y policies de request.

El router de reportes delega listado, compatibilidad de revisión, autorización de
exports, expiración, existencia de archivos y eliminación a servicios de
aplicación. El streaming HTTP permanece en presentación porque es una decisión
del transporte.

## Servicios y transacciones

Los contextos agrupan dependencias explícitas sin introducir un contenedor DI
externo. El servicio que modifica el agregado controla `commit`; los repositorios
hacen consultas, `add`, `flush` y operaciones de persistencia, pero no deciden la
transacción salvo una operación explícitamente documentada.

`application/query_execution` separa tres responsabilidades puras del orquestador:

- coerción y validación de parámetros;
- paginación inmutable del AST;
- serialización de ejecuciones e historial.

`QueryExecutionService` conserva coordinación, compilación, timeout, adaptación,
cancelación y persistencia del estado de ejecución.

## Repositorios

Los repositorios son explícitos por dominio. No existe un repositorio base
genérico. `schema_snapshots.py` contiene transformaciones puras del catálogo para
que `SchemaRepository` se concentre en persistencia y sincronización.

## Modelos, schemas y DTO

- SQLAlchemy representa persistencia interna.
- Pydantic en `api/schemas` representa requests y responses públicas.
- Pydantic/dataclasses del dominio representan AST, compilación, inspección y
  configuración de reportes.
- Se crean DTO adicionales solo cuando una frontera necesita una forma distinta.

Los documentos JSON heterogéneos usan `Any` deliberadamente en los bordes de AST,
filas, JSONB y drivers. Los servicios deben convertirlos a modelos tipados antes
de aplicar reglas.

## Errores y logging

`PublicError` conserva códigos, mensajes seguros y estados HTTP existentes. Los
handlers de `api/errors.py` centralizan su traducción. Los errores inesperados se
encadenan a un error público seguro; no se silencian. El backend usa
`logging.getLogger(__name__)`; `print` se reserva para salida deliberada de CLI.

## Adaptadores y compilación

El registro de adaptadores resuelve el motor. El dominio no importa PyMySQL ni
FastAPI. El AST validado es la única entrada del compilador; valores y SQL viajan
separados. `ensure_compiled_read_only` se aplica antes de ejecutar y también al
conteo derivado.

## Reglas de imports

- `domain` no importa FastAPI, SQLAlchemy, Redis ni drivers.
- `application` no importa `Request`, `Response`, `Depends` ni `HTTPException`.
- `infrastructure` puede implementar contratos del dominio y usar modelos DB.
- `api` puede importar application y schemas; no contiene reglas persistentes.
- Los imports locales requieren una razón de ciclo o carga diferida documentable.

## Testing

Las funciones puras se prueban directamente; servicios y endpoints se prueban
por comportamiento. Las integraciones MySQL usan los servicios de Compose. No se
reescriben migraciones históricas para acomodar una refactorización.

## Comandos

```bash
docker compose exec -T backend ruff format --check app tests migrations
docker compose exec -T backend ruff check app tests migrations
docker compose exec -T backend mypy app tests
docker compose exec -T backend pytest -q
```

