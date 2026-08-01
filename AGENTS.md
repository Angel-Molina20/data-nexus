# DataNexus

## Inicio obligatorio de sesión

* Antes de revisar, planificar o modificar el proyecto, toda nueva sesión debe
  leer completamente `docs/PROJECT_STATUS.md` junto con este archivo.

## Objetivo

DataNexus es una plataforma visual de consultas y reportes multifuente.

Debe permitir:

* Registrar conexiones a fuentes de datos.
* Detectar automáticamente el motor, proveedor, versión y capacidades.
* Explorar entidades, campos, relaciones e índices.
* Configurar relaciones físicas, inferidas, manuales y polimórficas.
* Construir consultas mediante una interfaz visual.
* Generar consultas parametrizadas.
* Ejecutar consultas de solo lectura.
* Guardar reportes reutilizables.
* Exportar resultados.
* Incorporar nuevos motores mediante adaptadores.

## Arquitectura

* Utilizar una arquitectura modular y basada en adaptadores.
* El núcleo del sistema no debe depender directamente de MySQL.
* Cada motor de datos debe implementarse mediante un adaptador independiente.
* El frontend no debe construir SQL directamente.
* Las consultas deben representarse mediante un modelo universal serializable a JSON.
* Separar claramente dominio, aplicación, infraestructura y presentación.
* Los routers o controladores no deben contener lógica de negocio.
* Aplicar principios SOLID.
* Evitar archivos excesivamente grandes.
* Evitar dependencias innecesarias entre módulos.
* No agregar dependencias externas sin justificar su necesidad.
* Diseñar contratos que permitan incorporar fuentes SQL y NoSQL.

## Compatibilidad

* MySQL 5.6 es la versión mínima inicial.
* MySQL 8 puede habilitar capacidades adicionales.
* Las funcionalidades deben validarse mediante perfiles de capacidades.
* No dispersar comparaciones de versiones por el código.
* Un reporte universal debe funcionar desde MySQL 5.6 en adelante.
* Las funciones exclusivas de MySQL 8 deben bloquearse o reescribirse de forma segura.
* No asumir que MariaDB, Percona y MySQL tienen capacidades idénticas.
* Mantener abierta la arquitectura para PostgreSQL, SQL Server, Oracle y MongoDB.

## Seguridad

* Todas las consultas deben ser parametrizadas.
* No permitir SQL arbitrario en el MVP.
* Validar tablas, entidades, columnas y campos contra el catálogo sincronizado.
* Las credenciales deben guardarse cifradas.
* Nunca escribir contraseñas, tokens o cadenas de conexión completas en logs.
* Nunca devolver contraseñas desde la API.
* El sistema debe utilizar inicialmente conexiones de solo lectura.
* No permitir inicialmente INSERT, UPDATE, DELETE, DROP, ALTER, CREATE ni TRUNCATE.
* Los secretos deben obtenerse mediante variables de entorno.
* Ocultar información sensible en errores y respuestas.
* Aplicar límites de tiempo, filas, relaciones y profundidad de subconsultas.

## Backend

* Utilizar Python 3.12.
* Utilizar FastAPI.
* Utilizar Pydantic v2.
* Utilizar SQLAlchemy 2.
* Utilizar PostgreSQL como base interna de DataNexus.
* Utilizar Alembic para migraciones.
* Aplicar tipado estricto.
* Utilizar Ruff.
* Utilizar MyPy.
* Utilizar Pytest.
* Mantener los routers delgados.
* Implementar servicios y repositorios claramente separados.
* Centralizar el manejo de errores.
* Usar logging estructurado.
* Documentar la API mediante OpenAPI.
* Implementar pruebas unitarias y de integración.
* No utilizar pandas para procesar grandes cantidades de datos completos en memoria.
* Utilizar procesamiento por bloques cuando sea necesario.

## Adaptadores

Cada fuente de datos debe implementar un contrato equivalente a:

* Probar conexión.
* Inspeccionar servidor.
* Detectar versión.
* Detectar proveedor.
* Detectar capacidades.
* Inspeccionar esquema o estructura.
* Validar una consulta universal.
* Compilar una consulta al lenguaje nativo.
* Ejecutar una consulta.
* Normalizar los resultados.
* Obtener un plan de ejecución cuando el motor lo soporte.

No colocar condicionales globales por motor cuando pueda utilizarse un registro de adaptadores.

## Modelo universal de datos

El dominio debe utilizar términos generales:

* Fuente de datos.
* Contenedor.
* Entidad.
* Campo.
* Registro.
* Relación.
* Consulta.
* Resultado.

Las implementaciones específicas pueden traducir:

* Entidad a tabla, vista o colección.
* Campo a columna o propiedad de documento.
* Registro a fila o documento.
* Consulta a SQL o pipeline de agregación.

## Relaciones

Soportar:

* Relaciones físicas.
* Relaciones inferidas.
* Relaciones manuales.
* Relaciones polimórficas.
* Referencias.
* Documentos embebidos en fuentes NoSQL.

Una relación polimórfica como `class` y `class_id` debe utilizar ambas condiciones.

Ejemplo conceptual:

* `documents.class = "Student"`
* `documents.class_id = students.id`

Nunca relacionar únicamente `class_id`.

Las relaciones inferidas deben mostrarse como sugerencias y requerir confirmación de un administrador.

## Frontend

* Utilizar React.
* Utilizar TypeScript estricto.
* Utilizar Vite.
* Utilizar Tailwind CSS.
* Utilizar React Router.
* Utilizar React Flow para diagramas de entidades y consultas.
* Utilizar TanStack Query para estado del servidor.
* Utilizar TanStack Table para resultados.
* Utilizar React Hook Form y Zod para formularios.
* Utilizar Lucide React para iconos.
* Utilizar componentes accesibles y reutilizables.
* Mantener los datos simulados separados de los componentes visuales.
* No acoplar componentes a respuestas directas de un motor específico.
* Evitar estilos duplicados.
* Mantener rutas y funcionalidades divididas por features.
* Corregir errores de consola y TypeScript antes de terminar una tarea.

## Diseño visual

* La referencia visual principal está en `docs/design/frontend-reference.png`.
* La imagen debe utilizarse como guía y no mostrarse dentro del producto.
* Cada bloque del collage representa una página independiente.
* Mantener una interfaz empresarial tipo SaaS.
* Utilizar sidebar oscuro y contenido principal claro.
* Utilizar azul como color principal.
* Mantener espaciado, bordes, proporciones y tipografía consistentes.
* Usar tarjetas blancas y estados mediante badges.
* Priorizar escritorio para el constructor visual.
* Mantener responsive básico para tablet y móvil.
* Revisar cada pantalla en el navegador.
* Comparar visualmente las pantallas con la referencia.
* No reproducir el collage mediante posiciones absolutas.
* Construir páginas y componentes reales.

## Docker e infraestructura

* El proyecto debe ejecutarse mediante Docker Compose.
* Mantener servicios separados para frontend y backend.
* Utilizar PostgreSQL como base interna.
* Utilizar Redis para caché y trabajos en segundo plano.
* Mantener instancias de MySQL 5.6 y MySQL 8 para pruebas de integración.
* Configurar health checks cuando sea posible.
* No hardcodear credenciales.
* Documentar todos los comandos de desarrollo.
* Mantener `.env` fuera del control de versiones.
* Proporcionar `.env.example` sin secretos reales.

## Calidad

* Todo cambio funcional debe incluir pruebas.
* Ejecutar Ruff, MyPy y Pytest en el backend.
* Ejecutar lint y comprobación de TypeScript en el frontend.
* Mantener el código formateado.
* No ignorar errores de tipos sin justificación.
* No desactivar reglas globalmente para ocultar problemas.
* Mantener documentación clara.
* Agregar comentarios solo cuando expliquen decisiones que el código no expresa por sí mismo.

## Flujo de trabajo

* Trabajar una fase a la vez.
* No implementar funcionalidades fuera del alcance solicitado.
* Antes de modificar archivos, revisar el estado actual del repositorio.
* Antes de implementar, enumerar los archivos que serán creados o modificados.
* Explicar brevemente las decisiones técnicas relevantes.
* Conservar archivos existentes salvo que sea necesario modificarlos.
* Ejecutar pruebas, linting y comprobaciones de tipos antes de finalizar.
* Corregir los errores encontrados.
* No avanzar de fase si la actual no funciona.
* Actualizar el README cuando cambien los comandos de instalación o ejecución.
* Crear implementaciones funcionales; evitar mocks ocultos o funcionalidades que aparenten estar terminadas.
* Indicar claramente cualquier limitación pendiente.
* No modificar áreas no relacionadas con la tarea actual.

## Fases iniciales

1. Infraestructura.
2. Layout visual.
3. Gestión de conexiones MySQL.
4. Detección de versiones y capacidades.
5. Sincronización de esquema.
6. Catálogo de relaciones.
7. Modelo universal de consultas.
8. Compilador MySQL.
9. Constructor visual.
10. Reportes.
11. Exportaciones.
12. Segundo adaptador de datos.
