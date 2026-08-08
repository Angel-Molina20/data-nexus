# Validación manual de DataNexus

## Preparación

1. Copiar `.env.example` a `.env`, configurar una clave Fernet y levantar `docker compose up -d --build`.
2. Ejecutar `docker compose exec -T backend alembic upgrade head` y `python -m app.cli seed-rbac`.
3. Crear el administrador con `python -m app.cli create-admin` si no existe.
4. Confirmar que PostgreSQL, Redis, MySQL 5.6, MySQL 8, backend y frontend están saludables con `docker compose ps`.

## Conexiones y catálogo

1. Registrar conexiones separadas a `mysql56:3306` y `mysql8:3306` con usuarios de solo lectura.
2. Probar cada conexión y confirmar proveedor, versión y capacidades.
3. Sincronizar ambos esquemas; comprobar tablas, vistas, campos, índices y relaciones.
4. Crear una relación polimórfica y verificar que el join usa discriminador y campo identificador.

## Consultas y ejecución

1. Crear y guardar una consulta simple; validar, compilar y comprobar placeholders sin valores interpolados.
2. Probar join, filtro parametrizado, agrupación/agregación, subconsulta y UNION.
3. Ejecutar con valores válidos; comprobar columnas dinámicas, `NULL`, fechas, decimales, JSON y paginación.
4. Cambiar de página, modificar un parámetro y volver a ejecutar sin perder el AST.
5. Usar una consulta lenta controlada para comprobar cancelación o timeout y posterior reejecución.
6. Confirmar que ninguna API acepta una cadena SQL libre.

## Reportes

1. Abrir Reportes y crear uno desde una consulta guardada y su revisión vigente.
2. Cambiar título/subtítulo, ocultar una columna, renombrar otra, reordenar con botones y seleccionar formatos/alineación.
3. Guardar como borrador y previsualizar datos reales. Confirmar que una columna oculta no aparece.
4. Publicar. Modificar después la consulta guardada y comprobar la advertencia de revisión sin cambio silencioso del reporte.
5. Completar parámetros requeridos y exportar CSV, XLSX y PDF.
6. CSV: comprobar UTF-8, comillas/saltos de línea y que un valor iniciado por `=` se neutraliza.
7. XLSX: abrir el archivo, comprobar cabecera fija, filtro, orden, números y fechas nativos; confirmar que no hay macros.
8. PDF: comprobar título, orientación, varias páginas, pie, caracteres UTF-8 y legibilidad.
9. Verificar historial, fila/tamaño/expiración y volver a descargar.
10. Revocar acceso a la conexión o campos sensibles e intentar descargar otra vez: debe denegarse.
11. Archivar el reporte y confirmar que desaparece del listado activo y no se exporta.
12. Eliminar una exportación y confirmar que la descarga deja de estar disponible.

## Expiración y límites

1. Reducir temporalmente retención, máximo de filas, tamaño y timeout en `.env`.
2. Provocar cada límite y confirmar error seguro, historial fallido y ausencia de archivo parcial.
3. Ejecutar `docker compose exec -T backend python -m app.cli cleanup-report-exports` y confirmar estado `expired`.
4. Reiniciar backend y verificar que una exportación no expirada sigue disponible en el volumen.

## Seguridad y cierre

1. Revisar logs buscando contraseñas, tokens, parámetros, filas, SQL interpolado y rutas internas: no deben aparecer.
2. Intentar descargar una exportación con otro usuario: debe responder como no encontrada o denegada.
3. Ejecutar Ruff, MyPy, Pytest, lint, typecheck, tests, build y E2E.
4. Construir sin caché y repetir healthchecks y una exportación real en MySQL 5.6 y MySQL 8.
