# Workspace del constructor de consultas

## Alcance

La Fase 19 transforma `/queries/:id/builder` en un workspace de altura acotada.
No modifica el AST universal, el compilador ni los contratos de ejecución. Las
mejoras profundas de catálogo, filtros, relaciones, campos y resultados quedan
reservadas para las Fases 20–25.

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
5. Panel inferior con Resultados, Problemas, Parámetros, SQL, Complejidad y JSON
   técnico.

Cada región tiene scroll independiente. El documento no necesita scroll
vertical general en las resoluciones desktop validadas.

## Paneles y resize

No se añadió una librería. `QueryBuilderResizeHandle` implementa Pointer Events,
teclado y semántica `role="separator"`. Los divisores aceptan flechas, Home, End
y doble clic para restaurar su tamaño predeterminado.

Límites:

- catálogo: 240–450 px, 300 px por defecto;
- inspector: 280–480 px, 360 px por defecto;
- panel inferior: 160–520 px, 280 px por defecto.

Los paneles laterales y el inferior pueden plegarse. El modo enfoque oculta
temporalmente catálogo, inspector y contenido inferior sin cambiar ni perder su
estado persistido. Restablecer diseño recupera tamaños y colapsados por defecto.

## Preferencias visuales

`queryBuilderLayoutPreferences` centraliza carga, validación, guardado y reset.
El valor usa `version: 1` y se guarda en:

```text
localStorage["datanexus:query-builder:layout"]
```

Se persisten anchos izquierdo/derecho, altura inferior y los tres estados de
colapsado. La escritura tiene un debounce breve. Datos incompletos, corruptos,
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

## Resultados, validación y ejecución

La ejecución existente permanece montada dentro de Resultados para conservar
parámetros, resultado, paginación y estado al cambiar tabs. La toolbar solicita
ejecución o cancelación al mismo componente, sin cambiar payloads ni endpoints.

- Ejecutar abre Resultados.
- Validar abre Problemas mediante el reducer existente.
- Compilar abre SQL mediante el reducer existente.
- Los parámetros siguen editándose en el panel de ejecución; la tab Parámetros
  conserva el resumen declarado actual.

El SQL continúa siendo generado por backend y de solo lectura.

## Responsive

- Desde 1200 px se muestran las tres columnas si no están plegadas.
- En 1280×720 el canvas mantiene un mínimo de 320 px y el panel inferior puede
  minimizarse para ampliar la superficie.
- En 1366×768 se mantienen toolbar, catálogo, canvas, inspector y panel inferior
  dentro del viewport sin scroll del documento.
- Por debajo de 1200 px catálogo e inspector se abren como drawers del sistema
  de diseño y el canvas conserva el ancho disponible.
- Mobile ofrece el layout reducido y acceso a ambos drawers; no se declara
  edición visual completa como objetivo de esta fase.

## Accesibilidad

Las regiones se etiquetan como Catálogo de consulta, Lienzo de consulta,
Inspector y Resultados y validación. Los controles de colapsado tienen labels
dinámicos. Tabs exponen tablist/tab y selección. Los resize handles funcionan
con teclado y anuncian orientación, límites y valor actual. Drawers y modales
conservan Escape, foco y portal existentes.

## Límites intencionales

- No existe todavía árbol avanzado, selección masiva ni favoritos (Fase 20).
- No se reemplazó el editor WHERE/HAVING (Fase 21).
- No se añadió edición completa de relaciones (Fase 22).
- No se rediseñó la gestión avanzada de campos (Fase 23).
- La tabla de resultados conserva su implementación actual (Fase 25).
- El resize por teclado usa pasos de 16 px; no anuncia mensajes live adicionales.
