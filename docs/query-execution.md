# Ejecución segura de consultas

## Flujo

`POST /api/v1/query-executions` recibe exclusivamente un AST universal, vuelve
a validarlo contra catálogo, permisos y capacidades, resuelve parámetros
declarados, aplica paginación al AST y usa el compilador registrado. El SQL
resultante se verifica como `SELECT` único y se ejecuta mediante el adaptador de
la fuente en una transacción de solo lectura. No existe un contrato que acepte
SQL libre.

El adaptador MySQL usa lectura incremental, limita filas y bytes, normaliza el
resultado y siempre revierte la transacción. Fechas y horas usan ISO 8601, los
decimales se serializan como texto para conservar precisión y los binarios se
reducen a metadatos de tamaño.

## API

```text
POST /api/v1/query-executions
GET  /api/v1/query-executions
GET  /api/v1/query-executions/{execution_id}
POST /api/v1/query-executions/{execution_id}/cancel
```

Ejemplo mínimo:

```json
{
  "execution_id": "0198aa82-1ea7-7000-8000-000000000001",
  "connection_id": "0198aa82-1ea7-7000-8000-000000000002",
  "query_id": "0198aa82-1ea7-7000-8000-000000000003",
  "query_revision": 3,
  "ast": { "schema_version": "1.0", "connection_id": "...", "query": {} },
  "parameters": { "active": true },
  "pagination": { "page": 1, "page_size": 50 },
  "options": { "include_total_count": false, "include_compiled_sql": false }
}
```

La respuesta contiene metadatos de ejecución, columnas neutrales, filas de la
página, advertencias y motor/versión. El SQL parametrizado se incluye solo si
la petición o la configuración lo permiten; nunca contiene valores
interpolados. El historial guarda metadatos y errores sanitizados, no filas ni
parámetros.

## Estados y errores

Estados: `pending`, `running`, `completed`, `failed`, `cancelled` y
`timed_out`. Los errores públicos usan códigos estables como
`QUERY_AST_INVALID`, `QUERY_PARAMETER_MISSING`, `QUERY_PARAMETER_INVALID`,
`QUERY_PARAMETER_UNKNOWN`, `QUERY_NOT_READ_ONLY`, `QUERY_EXECUTION_FAILED`,
`QUERY_EXECUTION_TIMEOUT`, `QUERY_EXECUTION_CANCELLED`,
`QUERY_CONNECTION_UNAVAILABLE`, `QUERY_CONCURRENCY_LIMIT` y
`QUERY_EXECUTION_NOT_FOUND`.

Los mensajes del driver se transforman en mensajes seguros. Los logs y el
historial no incluyen credenciales, SQL con valores, parámetros ni filas.

## Paginación y conteo

La página comienza en 1. La ventana se aplica sobre una copia del AST antes de
compilar y respeta el límite lógico existente: se devuelve el menor límite
aplicable. Se solicita una fila adicional para determinar `truncated` sin
cargar el conjunto completo.

El conteo está desactivado por defecto. Si se habilita y solicita, se compila el
AST base sin paginación y se envuelve el SELECT generado como subconsulta de
conteo. Esto conserva GROUP BY, DISTINCT, UNION y subconsultas sin manipular
identificadores ni valores del usuario.

## Cancelación y timeout

El navegador genera `execution_id` antes del POST. Así puede llamar al endpoint
de cancelación mientras la petición síncrona sigue activa. El registro activo
es local al proceso, se limpia en `finally` y el adaptador invalida la conexión
en uso. La operación es idempotente. El timeout de aplicación intenta la misma
cancelación y marca `timed_out`.

Esta cancelación es best-effort y local al worker. Una futura ejecución
asíncrona/distribuida deberá sustituir el registro en memoria por coordinación
compartida y cancelación nativa por identificador del servidor.

## Configuración

```env
QUERY_EXECUTION_DEFAULT_PAGE_SIZE=50
QUERY_EXECUTION_MAX_PAGE_SIZE=500
QUERY_EXECUTION_MAX_ROWS=5000
QUERY_EXECUTION_TIMEOUT_SECONDS=30
QUERY_EXECUTION_MAX_RESPONSE_BYTES=10485760
QUERY_EXECUTION_HISTORY_LIMIT=50
QUERY_EXECUTION_INCLUDE_SQL_BY_DEFAULT=false
QUERY_EXECUTION_ALLOW_TOTAL_COUNT=false
QUERY_EXECUTION_MAX_CONCURRENT_PER_USER=3
```

## Pruebas

```bash
make migrate
make backend-lint
make backend-typecheck
make backend-test
make frontend-lint
make frontend-typecheck
make frontend-test
make frontend-build

# E2E en la imagen oficial, sin modificar la imagen de desarrollo
docker run --rm --network host \
  -v "$PWD/frontend:/work" -v /work/node_modules -w /work \
  mcr.microsoft.com/playwright:v1.62.1-noble \
  bash -lc "corepack enable && pnpm install --frozen-lockfile && pnpm test:e2e"
```

## Limitaciones

- La creación es síncrona; el contrato permite migrar después a aceptación
  asíncrona.
- La cancelación activa solo coordina procesos dentro del mismo worker.
- No se persisten páginas de resultados; cambiar de página reejecuta el AST.
- El conteo se ejecuta como una segunda consulta y puede ser costoso.
- No se implementan exportaciones, datasets permanentes ni reportes en esta fase.
