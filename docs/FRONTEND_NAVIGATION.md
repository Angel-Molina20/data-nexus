# Navegación frontend de DataNexus

## Estrategia

La URL es la fuente de verdad para el estado de listado que debe sobrevivir a
refresh, back/forward y enlaces compartidos. `location.state.from` conserva el
origen inmediato de una navegación profunda, pero cada pantalla define siempre
un fallback porque ese estado puede no existir al abrir un deep link.

Los enlaces que abren recursos usan `returnState(location)`. El retorno se
resuelve con `useReturnNavigation`; solo se aceptan rutas que comienzan con una
barra simple. URLs externas, protocol-relative, barras invertidas y saltos de
línea se rechazan para impedir open redirects.

## Rutas y retorno

`app/router/routes.ts` centraliza builders de rutas dinámicas y codifica IDs.
`BackButton` es un link cuando navega, por lo que conserva teclado, menú
contextual y apertura en otra pestaña. Su destino es `state.from` válido o el
fallback del módulo:

- conexión → `/connections`;
- consulta/constructor → `/queries`;
- reporte/editor → `/reports`;
- metadata y relaciones → detalle de conexión o catálogo correspondiente.

Cancelar descarta el flujo actual y vuelve al origen. Volver representa
navegación contextual. Cerrar se reserva para paneles o herramientas, como el
constructor. Tras crear se continúa en detalle/constructor; tras editar se
regresa al detalle. Al eliminar una conexión abierta se vuelve al origen seguro.

## Breadcrumbs y PageHeader

`Breadcrumbs` renderiza un `nav` con nombre accesible, enlaces reales y
`aria-current="page"`. `PageHeader` integra `backAction` y `breadcrumbs` sin que
cada página cree un encabezado paralelo. En anchos pequeños los textos se
truncan y el conjunto puede envolver sin provocar scroll horizontal.

## Query params y listados

| Listado | Parámetros persistidos en URL |
| --- | --- |
| Conexiones | `search`, `status`, `page`, `page_size` |
| Consultas | `page`, `page_size` |
| Reportes | `search`, `status`, `page`, `page_size` |

Cambiar búsqueda, filtro o tamaño reinicia `page=1`. No se inventaron búsqueda,
ordenamiento ni filtros que las APIs actuales no soporten. Ningún parámetro URL
contiene credenciales, tokens, SQL o parámetros de ejecución.

## Cambios sin guardar

`useUnsavedChangesGuard` combina el blocker de React Router con
`beforeunload`. La navegación interna abre `UnsavedChangesDialog`, basado en
`ConfirmDialog`, con “Cancelar” para seguir editando y “Salir sin guardar”.
Refresh/cierre usa el aviso nativo obligatorio del navegador. El guard solo se
activa con cambios reales y permite navegar después de guardar sin un aviso
falso.

Lo utilizan conexión nueva/edición, consulta nueva, editor JSON, constructor,
editor de reportes y formularios de relaciones manuales/polimórficas. Un error
de guardado mantiene el draft dirty y al usuario en la pantalla.

## Scroll, historial y accesibilidad

El layout guarda scroll por `location.key` durante la sesión. POP restaura la
posición; PUSH/REPLACE comienza arriba. El scroll es memoria temporal: un refresh
conserva filtros y recurso, pero comienza desde una posición segura.

Modal restaura el foco al control que inició la navegación. Enlaces,
breadcrumbs y botones tienen foco visible y tamaño táctil. El título del
documento sigue la sección con el formato `<pantalla> | DataNexus`.

## Deep links y errores

Las pantallas profundas cargan sus recursos desde el ID de la URL. Al refrescar
o entrar directamente no dependen de `state.from`; BackButton usa el fallback.
404 y acceso denegado muestran una explicación y retorno seguro, sin redirigir
silenciosamente al dashboard.

## Estado solo en memoria

Permanecen locales los paneles abiertos, selección del constructor, hover,
modales, valores de formulario y parámetros de ejecución/reporte. No se coloca
el AST, credenciales ni valores sensibles en la URL.

## Límites actuales

Ejecuciones y exportaciones se presentan dentro del constructor o detalle de
reporte; no existen rutas independientes a las que añadir retorno. El futuro
rediseño del constructor deberá conservar este contrato de origen al separar
resultados, inspector o stepper. No se creó un historial global paralelo al de
React Router.
