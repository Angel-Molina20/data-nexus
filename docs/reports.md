# Reportes y exportaciones

## Arquitectura

Un reporte pertenece a un usuario, referencia `query_id` y fija `query_revision`. Al guardarlo se conserva una instantánea del AST de esa revisión; cambiar posteriormente la consulta no altera silenciosamente un reporte publicado. La vista previa y la exportación vuelven a validar esa instantánea y pasan exclusivamente por `QueryExecutionService`. No existe entrada de SQL libre.

`ReportExecutionService` aplica permisos sobre reporte, consulta y conexión, los parámetros tipados de la consulta, límites, timeout y la configuración visual. Los exportadores implementan un contrato común y se resuelven mediante `ReportExporterRegistry`. `LocalFileStorage` usa claves UUID distintas del nombre de descarga, evita path traversal y crea archivos con permisos `0600`.

La configuración JSON tiene `version: 1` y contiene diseño, encabezado, pie, zona horaria, locale y columnas. Cada columna declara `source_key`, visibilidad, posición, etiqueta, ancho, alineación y formato. El backend descarta columnas ocultas y detecta claves que ya no aparecen en el resultado.

## Estados

- Reporte: `draft`, `published`, `archived`.
- Exportación: `pending`, `processing`, `completed`, `failed`, `cancelled`, `expired`.

Solo los reportes publicados se exportan. La vista previa acepta borradores para facilitar su configuración. Los archivos completos no se guardan en PostgreSQL: el historial contiene solo metadatos y una clave interna no expuesta por la API.

## Endpoints

```text
POST   /api/v1/reports
GET    /api/v1/reports
GET    /api/v1/reports/{report_id}
PATCH  /api/v1/reports/{report_id}
DELETE /api/v1/reports/{report_id}
POST   /api/v1/reports/{report_id}/publish
POST   /api/v1/reports/{report_id}/archive
POST   /api/v1/reports/{report_id}/preview
POST   /api/v1/reports/{report_id}/execute
POST   /api/v1/reports/{report_id}/exports
GET    /api/v1/report-exports
GET    /api/v1/report-exports/{export_id}
GET    /api/v1/report-exports/{export_id}/download
DELETE /api/v1/report-exports/{export_id}
POST   /api/v1/report-exports/cleanup/expired
```

Las mutaciones requieren CSRF. La descarga vuelve a verificar propiedad, permiso `reports.download`, ACL vigente sobre la conexión y permisos actuales sobre campos sensibles. Una revocación posterior bloquea la descarga.

## Ejemplos

Crear un reporte a partir de una consulta guardada:

```json
{
  "name": "Estudiantes activos",
  "description": "Listado académico",
  "query_id": "00000000-0000-0000-0000-000000000001",
  "query_revision": 3,
  "configuration": {
    "version": 1,
    "layout": {"orientation": "landscape", "page_size": "A4", "show_generated_at": true, "show_page_numbers": true},
    "header": {"title": "Estudiantes activos", "subtitle": "Ciclo 2026", "description": null},
    "columns": [{"source_key": "student_name", "label": "Estudiante", "visible": true, "position": 0, "width": 180, "alignment": "left", "format": {"type": "text"}}],
    "footer": {"text": "DataNexus", "show_row_count": true},
    "locale": "es-EC",
    "timezone": "America/Guayaquil",
    "parameters": {}
  }
}
```

Vista previa:

```json
{"parameters": {"status": "active"}, "page": 1, "page_size": 25}
```

Exportar; se usa el mismo cuerpo para `csv`, `xlsx` y `pdf`:

```json
{"format": "csv", "parameters": {"status": "active"}, "options": {"file_name": "estudiantes-activos"}}
```

## Formatos

- CSV: UTF-8, BOM y delimitador configurables, quoting estándar y neutralización de celdas que empiezan por `=`, `+`, `-` o `@`.
- XLSX: archivo Open XML real, cabecera fija, autofiltro, anchos, números/fechas nativos y protección de fórmulas. No contiene macros.
- PDF: documento real multipágina, A4 o letter, vertical u horizontal, título, subtítulo, tabla y pie. No acepta HTML, JavaScript ni contenido remoto.

## Variables

```text
REPORT_PREVIEW_MAX_ROWS=100
REPORT_EXPORT_MAX_ROWS=100000
REPORT_EXPORT_BATCH_SIZE=500
REPORT_EXPORT_TIMEOUT_SECONDS=120
REPORT_EXPORT_MAX_FILE_SIZE_BYTES=52428800
REPORT_EXPORT_RETENTION_DAYS=7
REPORT_EXPORT_MAX_CONCURRENT_PER_USER=2
REPORT_EXPORT_ALLOWED_FORMATS=csv,xlsx,pdf
REPORT_EXPORT_STORAGE_BACKEND=local
REPORT_EXPORT_STORAGE_PATH=/app/storage/report-exports
REPORT_CSV_DELIMITER=,
REPORT_CSV_INCLUDE_BOM=true
REPORT_CSV_NULL_VALUE=
REPORT_CSV_PROTECT_FORMULAS=true
```

El máximo efectivo de filas también queda limitado por `QUERY_EXECUTION_MAX_ROWS`. La implementación inicial es síncrona y obtiene páginas limitadas antes de escribir; el contrato y el registro de estados permiten incorporar un worker/streaming distribuido en el futuro sin cambiar la API principal.

## Retención y limpieza

El volumen `report_exports` persiste los archivos. La limpieza puede ejecutarse manualmente o desde cron:

```bash
docker compose exec -T backend python -m app.cli cleanup-report-exports
```

El servicio elimina el archivo, marca el historial como `expired` y continúa aunque un archivo ya no exista.

## Pruebas

```bash
docker compose exec -T backend pytest -q tests/test_report_exporters.py tests/test_report_storage.py
docker compose exec -T frontend pnpm test
docker compose exec -T frontend pnpm test:e2e
```

Limitaciones conocidas: no hay programación, correo, almacenamiento S3/MinIO, colas distribuidas ni diseñador libre. PDF prioriza legibilidad tabular y no incluye gráficos. Las revisiones se fijan mediante instantánea porque el modelo actual de consultas conserva solo su revisión vigente.
