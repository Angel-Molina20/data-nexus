# Workspace del constructor de consultas

## Alcance

La Fase 19 transforma `/queries/:id/builder` en un workspace de altura acotada,
la Fase 20 integra la selección directa de campos y la Fase 21 reemplaza el
editor técnico de WHERE/HAVING por un editor visual. No se modifican el
compilador ni los contratos de ejecución. Relaciones, campos avanzados y
resultados permanecen reservados para las Fases 22–25.

## Estructura

El shell global detecta únicamente la ruta del constructor y le entrega el alto
restante bajo el header de DataNexus mediante una cadena flex `min-height: 0`.
No se usa una resta fija de píxeles del viewport.
Al entrar, la navegación global se colapsa para devolver 176 px al canvas y
puede expandirse de nuevo desde su control habitual.

El workspace contiene:

1. Toolbar sticky con retorno contextual, nombre, estado de guardado,
   undo/redo, Guardar, Validar, Ejecutar/Cancelar y menú secundario.
2. Catálogo izquierdo con la búsqueda, entidades y campos existentes.
3. Canvas React Flow central como superficie principal.
4. Inspector derecho con contexto de entidad/relación y los editores actuales.
5. Navegación principal con Vista visual, Filtros, SQL, Resultados y Problemas.

Vista visual conserva catálogo, canvas e inspector. Las demás opciones son
subpantallas amplias y no se apilan debajo del lienzo. Cada región tiene scroll
independiente y el documento no necesita scroll vertical general.

El inspector agrupa los campos seleccionados por source/alias. Cada entidad se
presenta como un acordeón con contador y permanece cerrada por defecto. Dentro,
los campos usan filas compactas; alias y estado auxiliar solo se editan al
expandir una fila. Agregaciones y expresiones quedan en un grupo separado. El
orden global de SELECT y sus acciones de mover/eliminar no cambian.

El catálogo izquierdo divide las entidades en `Tablas` y `Vistas`, ambas con
contador y expansión independiente. Tablas inicia abierta y Vistas cerrada;
una búsqueda abre temporalmente las secciones con resultados. La clasificación
proviene de `entity_type` y no crea peticiones adicionales.

En el inspector, la entidad principal ocupa una fila compacta identificada como
BASE y los joins viven dentro de un acordeón `Relaciones` con contador. Cada
relación conserva tipo, origen físico/lógico/polimórfico y acción de eliminación
sin usar una tarjeta alta por join.

## Paneles y resize

No se añadió una librería. `QueryBuilderResizeHandle` implementa Pointer Events,
teclado y semántica `role="separator"`. Los divisores aceptan flechas, Home, End
y doble clic para restaurar su tamaño predeterminado.

Límites:

- catálogo: 240–450 px, 300 px por defecto;
- inspector: 280–480 px, 360 px por defecto;

Los paneles laterales pueden plegarse. El modo enfoque oculta temporalmente
catálogo e inspector sin cambiar ni perder su estado. Restablecer diseño
recupera tamaños y colapsados por defecto.

## Preferencias visuales

`queryBuilderLayoutPreferences` centraliza carga, validación, guardado y reset.
El valor usa `version: 1` y se guarda en:

```text
localStorage["datanexus:query-builder:layout"]
```

Se persisten anchos izquierdo/derecho y los estados históricos de layout. La
navegación de subpantallas es estado de sesión y no entra al documento. La
escritura tiene un debounce breve. Datos incompletos, corruptos,
fuera de límites o con otra versión vuelven a defaults.

Estas preferencias nunca pasan por el reducer del constructor, no se escriben
en `metadata.builder_layout`, no cambian el fingerprint y no activan dirty ni
undo/redo. El layout de nodos continúa siendo parte del metadata visual de la
consulta y conserva su comportamiento previo.

## Canvas y selección

React Flow permanece montado al cambiar tabs. Un `ResizeObserver` observa su
contenedor y ejecuta `fitView` en el siguiente animation frame cuando cambia el
espacio disponible. No recrea el AST ni elimina las posiciones guardadas de los
nodos. Continúan disponibles zoom, pan, drag, minimap y controls.

Seleccionar un nodo o edge actualiza únicamente el contexto del inspector. Un
clic en el fondo limpia esa selección y muestra un estado vacío compacto.

## Catálogo de entidades y campos

El panel izquierdo contiene un explorador expandible. El header y
`SearchInput` permanecen visibles mientras la lista usa scroll propio. Varias
entidades pueden quedar abiertas y sus campos se montan únicamente al expandir
la entidad. Cada detalle se conserva cinco minutos en la caché existente de
TanStack Query.

La búsqueda es parcial y case-insensitive sobre schema, nombre físico/visible
de entidad y nombre físico/visible de campo. El mismo endpoint paginado devuelve
las entidades coincidentes; no existe una petición de búsqueda por cada tabla.
El frontend consume páginas de 100 hasta completar el resultado. Durante una
búsqueda las coincidencias se expanden temporalmente y, al limpiarla, vuelve el
conjunto de expansión que el usuario mantenía en la sesión. La expansión no se
persiste entre sesiones ni entra en las preferencias del workspace.

Cada entidad presenta el contador `seleccionados / total` y el badge `En uso`
cuando ya corresponde a un source del AST. Expandir una entidad no la añade. Si
no está en uso, la acción de relación abre el flujo existente de relaciones
confirmadas; no se crea un `CROSS JOIN` implícito. Solo después de incorporarla
es posible seleccionar sus campos.

Los campos muestran checkbox, PK, FK y clasificación sensible. El tooltip del
tipo incluye `column_type` y nullable; el FK indica el destino cuando la
metadata física lo permite. Los campos ocultos, sensibles sin permiso y todos
los controles semánticos en read-only están deshabilitados. Seleccionar el
nombre de un campo lo distingue para inspección y enfoca su entidad, pero no
cambia su inclusión.

Los checkboxes se derivan siempre de `query.select`; no existe una copia local
de `checked`. Seleccionar o deseleccionar invoca `queryActions.setFields`, por
lo que una operación individual o `Seleccionar todos` crea una única entrada de
historial, cambia dirty/fingerprint y funciona con undo/redo. La selección
masiva omite campos restringidos. Quitar una columna de SELECT conserva sus
referencias válidas e independientes en GROUP BY, ORDER BY, WHERE o HAVING; no
elimina configuraciones silenciosamente. Si el borrador queda sin columnas, la
validación local existente lo señala hasta que el usuario seleccione otra.

Búsqueda, scroll, expansión, colapso e inspección son estado visual de sesión:
no cambian AST, fingerprint, dirty ni historial. El frontend nunca genera SQL.

## Editor visual de filtros

La subpantalla `Filtros` usa el ancho disponible y separa WHERE de HAVING con
tabs accesibles. WHERE filtra filas antes de agregación; HAVING filtra el
resultado agregado. Filtros ya no se duplica en el inspector.

`QueryFilterEditor` coordina presentación y estado efímero. El catálogo de
operadores, normalización de tipos, creación de predicados y operaciones sobre
el árbol viven en `filters/model`. El frontend transforma elecciones a AST 1.0
y nunca concatena ni genera SQL.

### Campos, operadores y fuentes

El selector busca por alias, entidad y campo, y solo incluye sources presentes
en la consulta. Varias instancias de una entidad se distinguen por alias. Los
campos inactivos, ocultos o sensibles sin permiso no pueden seleccionarse.
HAVING añade las agregaciones existentes en SELECT con su label/alias; WHERE no
ofrece agregaciones.

- string: igual, diferente, contiene/no contiene, empieza/termina con,
  LIKE/NOT LIKE, IN/NOT IN e IS NULL/IS NOT NULL;
- integer y decimal: comparaciones, BETWEEN/NOT BETWEEN, IN/NOT IN y NULL;
- date, datetime y time: comparaciones temporales, BETWEEN/NOT BETWEEN, IN y
  NULL;
- boolean: igual/diferente, IN y NULL, con selector Verdadero/Falso;
- json, binary y unknown: conjunto mínimo seguro de igualdad y NULL.

Las fuentes disponibles son literal, parámetro compatible, campo compatible y
subconsulta guardada, según operador. Los literales usan controles por tipo; decimal se conserva como
string en el AST para no perder precisión. BETWEEN exige dos extremos e IN una
lista no vacía. IS NULL/IS NOT NULL no mantiene lado derecho y nunca se produce
`campo = NULL`. No se consultan valores DISTINCT.

`IN (subquery)`, `NOT IN (subquery)`, `EXISTS` y `NOT EXISTS` disponen de un
draft visual especializado. La consulta se elige entre las consultas guardadas
de la misma conexión; IN exige exactamente una columna, mientras EXISTS puede
usar cualquier proyección válida. La correlación asistida compara un campo
interno con un `outer_field` de la consulta principal y añade la comparación al
WHERE interno. Editar una condición embebida conserva `query_id`, QueryBody,
correlation y los predicados que el editor no modifica.
El mismo editor, reutilizado tanto por filtros como por subconsultas añadidas a
SELECT, permite incorporar múltiples condiciones WHERE internas mediante campo,
operador, fuente y valor. Cada condición se valida como draft y, al aplicar, se
combina con AND sin sustituir el WHERE original ni la correlación.

El editor de expresiones SELECT incluye `GROUP_CONCAT` como agregación de texto
con un argumento. No se modela como función escalar: participa correctamente en
la detección de agregaciones, GROUP BY y HAVING, y el SQL continúa generándose
exclusivamente en el compilador backend.

Las expresiones SELECT complejas agrupadas usan `GroupByItem.position`. El
compilador emite el ordinal controlado (`GROUP BY 1`, `GROUP BY 2`) en lugar de
repetir funciones, CASE o subconsultas completas. Los campos físicos simples
continúan compilándose como `alias.campo`. Las consultas existentes que aún
guardan la expresión compleja completa se reconocen y compilan por posición sin
modificar su semántica.

### Drafts, grupos e historial

Una condición incompleta vive únicamente como `FilterDraft`: no entra al AST,
no marca dirty y no crea grupos vacíos. `Aplicar condición` realiza un solo
reemplazo del documento. Editar también usa draft, de modo que escribir un valor
no genera un undo por carácter. Cambiar campo recalcula operadores y limpia
valores o referencias incompatibles; cambiar operador reinicia cardinalidad y
fuente cuando corresponde.

Los grupos soportan AND/OR, anidamiento, condiciones y subgrupos. Se conserva el
orden del array AST. Duplicar hace una copia estructural; mover arriba/abajo es
la alternativa accesible a drag and drop. El root no se elimina y eliminar un
grupo requiere confirmación con el número de condiciones. Cada alta aplicada,
edición aplicada, duplicación, eliminación, reorder o cambio AND/OR es un paso
de undo/redo. Tabs, búsquedas, menús y drafts no alteran dirty/fingerprint.

### Validación, compatibilidad y seguridad

La validación local detecta grupos/listas vacíos y campos fuera de contexto; el
backend sigue siendo la validación definitiva de AST, catálogo, scopes, tipos,
capacidades y permisos. Un problema con path WHERE/HAVING abre Filtros y el área
correspondiente. Las condiciones legacy representables se editan visualmente;
cualquier forma válida no representable se conserva completa. Un round-trip
sin cambios no reescribe predicados.

Read-only permite tabs e inspección, pero oculta acciones de mutación. Los
valores siguen parametrizados por el compilador backend y no se interpolan en
SQL, logs ni preview. En desktop las filas hacen wrap; el panel usa scroll
propio en 1920×1080, 1440×900, 1366×768 y 1280×720.

## Resultados, validación y ejecución

La ejecución permanece montada entre las subpantallas SQL y Resultados para
conservar parámetros, resultado, paginación y estado al cambiar de vista. SQL
usa un editor de solo lectura con numeración de líneas y una columna lateral de
parámetros y opciones derivadas del AST. Tras ejecutar correctamente, el
workspace navega a Resultados, donde métricas, tabla y paginación usan el área
principal. La toolbar solicita ejecución o cancelación al mismo componente, sin
cambiar payloads ni endpoints.

La compilación no se duplica en el menú de acciones. Vista visual ofrece
`Compilar` como acción principal y SQL ofrece `Recompilar` junto al código para
refrescarlo después de cambios en el AST.

Orden, Parámetros y UNION exponen eliminación explícita. Quitar un orden es
inmediato y reversible con undo; parámetros y ramas UNION solicitan confirmación
por su mayor impacto. Un parámetro eliminado no borra expresiones que lo usaban:
esas referencias permanecen en el AST y la validación las marca para corrección.

Agrupar valida localmente la misma regla esencial del compilador: cuando hay una
agregación o GROUP BY, cada expresión seleccionada no agregada debe estar
agrupada (literales y parámetros quedan exentos). Cada faltante aparece como
`QUERY_GROUPING_INVALID` en Problemas. Compilar/Recompilar abre Problemas sin
llamar al backend mientras existan estos errores. `Agregar todos los campos`
incorpora en una sola operación los campos SELECT pendientes, omite agregaciones
y duplicados y produce un único paso de undo.
Las expresiones se comparan mediante una representación canónica con claves
ordenadas, por lo que el orden de propiedades JSON no produce falsos faltantes.
Las filas y problemas de GROUP BY muestran `alias.campo`, no IDs internos. La
sección incluye `Agregaciones activas` con representaciones como `COUNT(*)` o
`COUNT(students.Nombre)` y permite eliminarlas directamente. Al quitar la última
agregación, GROUP BY deja de ser obligatorio salvo que aún existan agrupaciones
explícitas.

COUNT se configura mediante un argumento explícito: `*`, cualquier campo activo
de las entidades/aliases incorporados a la consulta (aunque no esté en SELECT),
o una expresión subquery ya existente en el AST. Para campos se permite
`COUNT(DISTINCT campo)`. No se crea SQL ni una subconsulta incompleta desde este
control; crear una subconsulta nueva sigue reservado al editor compartido de
subconsultas.

GROUP BY permite quitar todos sus campos con confirmación. El vaciado completo
es una única mutación AST, marca dirty una vez y genera un solo paso de undo.

El AST admite expresiones SELECT de función (`concat`, `coalesce`, texto,
fechas y matemáticas), CASE y subquery. Campos ofrece `Añadir expresión`, un
editor draft que crea funciones con argumentos campo/literal/parámetro/subquery
existente y condicionales IF representados portably como CASE. El commit añade
un único SelectItem AST y un paso de undo; no existe SQL libre. La creación de
una subquery nueva permite elegir una consulta guardada de la misma conexión e
incrusta su QueryBody con un ID nuevo; también reutiliza subqueries del AST.
Puede correlacionarla eligiendo campo exterior e interior: el editor añade al
WHERE hijo una comparación AND con `outer_field` y registra `correlation`, sin
sobrescribir filtros existentes. Las expresiones creadas exponen Editar y
conservan su `select_id`; la edición visual profunda del QueryBody anidado sigue
pendiente.

- Compilar desde Vista visual abre SQL.
- Ejecutar solo está disponible como acción principal en SQL/Resultados y, tras
  completarse, abre Resultados.
- Validar abre Problemas mediante el reducer existente.
- Los parámetros se editan junto al SQL antes de ejecutar.

El SQL continúa siendo generado por backend y de solo lectura.

## Responsive

- Desde 1200 px se muestran las tres columnas si no están plegadas.
- En 1280×720 el canvas mantiene un mínimo de 320 px; Filtros y Resultados usan
  toda la superficie bajo la navegación.
- En 1366×768 se mantienen toolbar, navegación, catálogo, canvas e inspector
  dentro del viewport sin scroll del documento.
- Por debajo de 1200 px catálogo e inspector se abren como drawers del sistema
  de diseño y el canvas conserva el ancho disponible.
- Mobile ofrece el layout reducido y acceso a ambos drawers; no se declara
  edición visual completa como objetivo de esta fase.

## Accesibilidad

Las regiones se etiquetan como Catálogo de consulta, Lienzo de consulta,
Inspector, Parámetros y Resultados. La navegación de vistas expone tablist/tab y
selección. Los controles de colapsado tienen labels dinámicos. Los resize handles funcionan
con teclado y anuncian orientación, límites y valor actual. Drawers y modales
conservan Escape, foco y portal existentes.

## Límites intencionales

- No se añadió edición completa de relaciones (Fase 22).
- No se añadieron alias, agregaciones, expresiones ni orden avanzado desde el
  catálogo (Fase 23).
- La tabla de resultados conserva su implementación actual (Fase 25).
- El resize por teclado usa pasos de 16 px; no anuncia mensajes live adicionales.
- No hay virtualización todavía: paginación de summaries y render lazy de campos
  cubren esta fase; la optimización global corresponde a la Fase 28.
