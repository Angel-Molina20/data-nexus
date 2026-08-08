# Sistema de diseño del frontend

## Filosofía visual

DataNexus usa una interfaz de herramienta de datos: superficies claras, controles
compactos, jerarquía tipográfica fuerte y azul reservado para la acción primaria.
Los componentes deben expresar su intención mediante variantes semánticas, no
mediante colores físicos. Una sección debe tener una sola acción primaria visible;
`danger` se reserva para operaciones destructivas.

La implementación usa Tailwind CSS 4, variables CSS y Lucide React. No hay una
segunda librería UI. Los componentes están en `frontend/src/components/ui`, los
elementos de página en `components/layout` y la compatibilidad con las clases
históricas se conserva en `styles/index.css` durante la migración gradual.

## Tokens

Los valores fuente usan el prefijo `--dn-`; `@theme inline` los expone como
utilidades semánticas de Tailwind (`bg-surface`, `text-muted`, `border-border`).

| Grupo | Tokens principales |
| --- | --- |
| Superficie | `background`, `surface`, `surface-muted` |
| Bordes | `border`, `border-strong` |
| Texto | `foreground`, `foreground-secondary`, `muted` |
| Acción | `primary`, `primary-hover`, `primary-active`, `focus`, `disabled` |
| Estado | `success`, `warning`, `danger`, `info` |
| Radio | `sm` 6 px, `md` 10 px, `lg` 14 px, completo con `rounded-full` |
| Sombra | `shadow-sm`, `shadow-md`, `shadow-lg` |

El tema claro está activo. `[data-theme="dark"]` redefine los tokens de superficie
y texto para permitir una futura implementación; no existe todavía selector de
tema ni se declara el modo oscuro como funcional.

## Tipografía y espaciado

Se mantiene Inter si está disponible y la pila de fuentes del sistema como
fallback, sin descargar fuentes externas. Las clases `text-display`,
`text-heading-1`, `text-heading-2`, `text-heading-3`, `text-body`,
`text-body-small`, `text-label`, `text-caption` y `text-code` forman la escala.
SQL, JSON y logs usan la pila monoespaciada del sistema.

El espaciado sigue la escala Tailwind equivalente a 4, 8, 12, 16, 20, 24, 32,
40, 48 y 64 px. Se evita introducir valores arbitrarios en componentes nuevos.
Las sombras se limitan a jerarquía de superficies, overlays y elementos
interactivos.

## Layout

- `AppLayout` contiene sidebar, header sticky y área principal responsive.
- `PageContainer` controla ancho (`full` o `centered`) y separación (`default`
  o `compact`).
- `PageHeader` acepta eyebrow, título, descripción, estado, breadcrumb opcional
  y acciones.
- `PageSection` agrupa contenido administrativo; `Panel` ofrece header compacto,
  body con scroll, footer y colapso para interfaces de herramientas.

Los breakpoints de Tailwind son la referencia. El shell conserva prioridad de
escritorio y las páginas administrativas siguen operables desde 320 px. La
densidad `comfortable`/`compact` se ofrece en tablas sin selector global.

## Acciones y formularios

`Button` ofrece `primary`, `secondary`, `ghost`, `danger` y `link`; tamaños
`sm`, `md`, `lg`; iconos inicial/final y estado loading. `IconButton` exige un
`label`, que aporta nombre accesible y tooltip nativo. Todos son botones reales.

`FormField` centraliza label, requerido, ayuda, descripción y error. `Input`,
`Textarea` y `Select` enlazan automáticamente `aria-describedby` y
`aria-invalid`. `Select` contempla placeholder, carga y lista vacía. También
existen `Checkbox`, `Radio` y `Switch`. `FormSection` estructura formularios
largos.

```tsx
<Input label="Nombre" required error={errors.name} />
<Button loading={saving} startIcon={<Save />}>Guardar</Button>
```

## Superficies, feedback y estados

- `Card` (`default`, `interactive`, `muted`, `outlined`) representa una unidad
  de contenido; `Panel` representa una herramienta o inspector.
- `Badge` normaliza `neutral`, `info`, `success`, `warning` y `danger`.
- `Alert` admite título, descripción, acción y cierre en cuatro severidades.
- `EmptyStateBase`, `LoadingState`, `Skeleton`, `Spinner` y `ErrorState` cubren
  vacíos, espera y fallo sin depender del texto `Loading...`.
- `StatusIndicator` combina forma/icono, color y texto; nunca comunica estado
  solo por color.

Mapa recomendado: activo/conectado/completado/publicado → `success`;
ejecutando → `info`; borrador/inactivo → `neutral`; warning/archivado →
`warning`; error/desconectado/cancelado → `danger`.

## Overlays y navegación de contenido

`Modal` usa portal, diálogo etiquetado, cierre por Escape y backdrop, trap de
foco y restauración del foco. `ConfirmDialog` estandariza confirmaciones
destructivas. `Drawer` aporta inspector lateral responsive. `Tabs` implementa
roles ARIA y navegación con flechas, Home y End.

Los mensajes transitorios actuales continúan siendo inline; no se añadió un
proveedor de toast porque el proyecto no tenía uno y duplicar infraestructura
en esta fase no aporta valor. Cuando exista una necesidad funcional, debe usar
las mismas severidades de `Alert`.

## Datos y herramientas

`DataTable` cubre caption accesible, carga, error, vacío, scroll horizontal,
header sticky opcional y dos densidades. `Pagination` unifica navegación y
tamaño de página. `Toolbar`, `SearchInput`, `CodeBlock`, `KeyValueList`,
`Divider`, `ScrollArea` y `Tooltip` forman la base para constructor, resultados
y pantallas de detalle.

## Accesibilidad

Los controles incluyen focus visible global, nombres accesibles, estados
disabled, HTML semántico y áreas de interacción de al menos 32 px (40 px por
defecto). Modal y tabs tienen gestión de teclado. Las animaciones respetan
`prefers-reduced-motion`. En nuevas pantallas no usar `div` clicable ni comunicar
estado solo mediante color.

## Convenciones

- Componentes y archivos en PascalCase; props estrictamente tipadas y sin `any`.
- Componer antes de duplicar clases; `cx` une clases condicionales sin una
  dependencia externa.
- Usar tokens semánticos en componentes compartidos. Los colores físicos quedan
  para detalles internos (por ejemplo, fondos suaves de severidad).
- No convertir cada bloque en Card. Usar `Panel` para herramientas con scroll y
  secciones planas cuando la agrupación ya es evidente.
- Las páginas componen componentes de feature; la coordinación de estado/API se
  encapsula en hooks. Consulta `docs/FRONTEND_ARCHITECTURE.md`.
- Prettier es la fuente de verdad del formato. No comprimir JSX manualmente.
- Ejecutar validaciones exclusivamente en Docker:

```bash
docker compose exec -T frontend pnpm lint
docker compose exec -T frontend pnpm format:check
docker compose exec -T frontend pnpm typecheck
docker compose exec -T frontend pnpm test
docker compose exec -T frontend pnpm build
```

## Autenticación

`AuthLayout` ofrece una composición de autenticación dividida y acotada para
escritorio. El panel de identidad puede contener branding y una representación
conceptual ligera; en tamaños menores se oculta para dar prioridad al formulario.
No deben añadirse enlaces o controles de autenticación sin un flujo backend real.

`LoginForm` compone las primitivas existentes (`Card`, `Input`, `IconButton`,
`Button` y `Alert`) y delega la coordinación a `useLogin`. Los campos conservan
`name`, labels y autocomplete adecuados para gestores de contraseñas. Los errores
de campo permanecen junto al control y los errores de credenciales/red se muestran
dentro del formulario con mensajes seguros. La contraseña nunca sale del estado
local administrado por React Hook Form.

El panel visual es exclusivo del login y usa CSS/SVG propio sin recursos remotos.
Debe respetarse `prefers-reduced-motion`, `100dvh` con fallback y el ancho máximo
del shell para pantallas ultra-wide.

## Dashboard

El dashboard usa una jerarquía estable: contexto y acciones, métricas compactas y
recursos recientes. Las estadísticas emplean Card con un solo acento azul suave;
no se asigna un color intenso diferente a cada métrica ni se muestran tendencias
sin datos reales. Los listados usan Panel, estados semánticos y filas con área de
interacción clara cuando existe un destino real.

Durante carga, cada bloque conserva su geometría mediante skeletons. Un cero real
se muestra como `0`; un bloque no autorizado o no disponible no se disfraza como
cero. En móvil, las métricas y paneles pasan a una columna sin convertir los
listados en tablas horizontales. El onboarding solo aparece cuando no existe una
primera conexión y hay permiso para crearla.

## Límites de la fase 13

No se rediseñaron login, dashboard, navegación funcional ni constructor. Las
clases heredadas continúan disponibles y ahora se apoyan en tokens; su adopción
componente a componente corresponde a las fases visuales siguientes. No se
activó dark mode, no se agregó Storybook y no se añadió una librería de toast.
