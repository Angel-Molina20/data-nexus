# Guía de estilo del backend

## Herramientas

- Python 3.12.
- Ruff format es el único formateador.
- Ruff check administra PEP 8, imports, errores, modernización y reglas async.
- MyPy se ejecuta en modo estricto.
- Pytest verifica comportamiento unitario e integración.

No se añaden Black ni isort porque duplicarían responsabilidades de Ruff.

## Convenciones

- Usar nombres explícitos, cuatro espacios y líneas de hasta 100 caracteres.
- Preferir `list[str]`, `dict[str, object]` y `str | None`.
- Tipar parámetros y retornos; no introducir ignores para ocultar un diseño débil.
- Usar genéricos cuando un helper preserve el tipo de una operación.
- Reservar `Any` para JSON/AST, filas dinámicas y APIs de librerías sin tipos
  suficientes; convertirlo al cruzar hacia reglas de negocio.
- Mantener imports al nivel de módulo. Un import local debe resolver un ciclo real
  o una dependencia opcional.

## Routers y servicios

- Routers: contrato, dependencias, llamada al servicio y respuesta HTTP.
- Servicios: reglas, autorización, coordinación y límite transaccional.
- Repositorios: consultas y persistencia, sin decisiones HTTP.
- No usar `HTTPException`, `Request`, `Response` ni `Depends` en application/domain.
- No construir consultas SQL o expresiones ORM en routers.

## Errores y logs

- Usar `PublicError` para errores públicos conocidos y preservar sus códigos.
- No usar `except Exception: pass`.
- Encadenar el error original al transformar fallos inesperados.
- Usar `logging.getLogger(__name__)`; no registrar secretos, parámetros o filas.
- `print` solo es válido para comandos CLI orientados al operador.

## Funciones y documentación

- Extraer una función cuando represente una responsabilidad independiente, no por
  un límite rígido de líneas.
- Preferir early returns si reducen anidamiento.
- Añadir docstrings a contratos o algoritmos no evidentes; evitar docstrings que
  repitan el nombre.
- Los comentarios explican restricciones y decisiones, no sintaxis obvia.

## Flujo obligatorio

```bash
docker compose exec -T backend ruff format app tests migrations
docker compose exec -T backend ruff check app tests migrations
docker compose exec -T backend mypy app tests
docker compose exec -T backend pytest -q
```

