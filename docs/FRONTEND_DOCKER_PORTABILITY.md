# Portabilidad Docker del frontend

El frontend de DataNexus se desarrolla y valida dentro de Docker. El host no
necesita Node.js, npm, pnpm ni Vite. La imagen fija Node 22.17 y pnpm 10.13.1;
Corepack activa pnpm durante la construcción.

## Requisitos

- Docker Engine o Docker Desktop.
- Docker Compose v2 mediante `docker compose`.
- Git para clonar el repositorio.

## Primer arranque

```bash
git clone <repositorio>
cd data-nexus
cp .env.example .env
docker compose up --build
```

Después abre `http://localhost:5173`. El navegador usa `/api/v1` y Vite envía
esas solicitudes a `http://backend:8000` por la red de Compose.

El primer arranque sincroniza las dependencias con el volumen
`frontend_node_modules`. Puede tardar más que un reinicio; el healthcheck ofrece
90 segundos de margen y valida que Vite responda realmente.

## Linux

Usa Docker Engine con un usuario autorizado para acceder al daemon. DataNexus
no requiere `sudo`, aunque la configuración del daemon pertenece al host. No
ejecutes pnpm en el host ni cambies permisos con `chmod 777`.

## Windows + Docker Desktop

Docker Desktop debe estar iniciado y configurado para contenedores Linux. En
PowerShell, crea el archivo de entorno sin depender de `cp`:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

Las rutas de Compose son relativas y los scripts del contenedor conservan LF
mediante `.gitattributes`. Esta compatibilidad está validada por diseño; aún
requiere una ejecución manual en un host Windows.

## WSL2

El flujo es el mismo que en Linux. Para mejorar el rendimiento del bind mount,
se recomienda clonar dentro del filesystem de WSL, por ejemplo
`~/projects/data-nexus`, en vez de `/mnt/c/...`. No es un requisito funcional.
La compatibilidad está validada por diseño y pendiente de prueba manual en WSL2.

## Dependencias

Ejecuta todas las operaciones desde el contenedor:

```bash
docker compose exec frontend /app/manage-dependencies.sh add <paquete>
docker compose exec frontend /app/manage-dependencies.sh add -D <paquete>
docker compose exec frontend /app/manage-dependencies.sh remove <paquete>
docker compose exec frontend pnpm lint
docker compose exec frontend pnpm typecheck
docker compose exec frontend pnpm test
docker compose exec frontend pnpm build
```

`package.json` y `pnpm-lock.yaml` están en el bind mount y los cambios quedan en
el repositorio; `node_modules` no. Tras cambiar dependencias, reconstruye para
que una imagen nueva también las contenga:

```bash
docker compose up -d --build frontend
```

El entrypoint compara una huella de ambos manifiestos con la del volumen. Si
cambian, ejecuta `pnpm install --frozen-lockfile`; si no, inicia Vite sin
reinstalar. Un lockfile desactualizado hace fallar deliberadamente el arranque.
El wrapper conserva el propietario original de los manifiestos en Linux y
devuelve el volumen al usuario `node`; evita archivos root sin depender del UID
concreto del host.

## Volúmenes y permisos

`frontend_node_modules` contiene exclusivamente dependencias del frontend y es
descartable. El código permanece en `./frontend`. El entrypoint prepara el
volumen como root dentro del contenedor y ejecuta pnpm y Vite como el usuario
`node` de la imagen (UID/GID interno 1000). No se mapea el UID/GID del host y no
se crean módulos en el host.

El store de pnpm está en la capa y filesystem internos del contenedor, separado
de `node_modules`; no añade otro volumen persistente porque la reconstrucción de
la imagen ya proporciona el caché reproducible.

## Reinicio

```bash
docker compose down
docker compose up -d
```

El volumen conserva dependencias y la huella evita reinstalarlas.

## Reconstrucción

```bash
docker compose build frontend
docker compose up -d frontend
```

Para observar el arranque: `docker compose logs -f frontend`.

## Reset completo

`docker compose down -v` elimina **todos** los volúmenes del proyecto, incluidos
PostgreSQL, Redis, MySQL y exportaciones. Puede destruir datos y no es una
solución habitual.

Para reiniciar solo dependencias, confirma el nombre con `docker volume ls`,
detén servicios y elimina únicamente el volumen descartable:

```bash
docker compose down
docker volume rm datanexus_frontend_node_modules
docker compose up -d --build frontend
```

## Hot reload

Los eventos nativos son el valor predeterminado. Si Docker Desktop o WSL2 no
propagan cambios, configura `VITE_USE_POLLING=true` en `.env` y recrea el
frontend. El polling no se activa globalmente porque consume más CPU.

## Troubleshooting

| Síntoma | Causa o diagnóstico | Solución segura |
| --- | --- | --- |
| `Permission denied` o `node_modules` no writable | Volumen antiguo con propietarios incompatibles; revisa los logs. | Recrea el contenedor. Si persiste, elimina solo `datanexus_frontend_node_modules` con servicios detenidos. |
| `pnpm command not found` | Se ejecutó en el host o se usa una imagen antigua. | Reconstruye el frontend y usa `docker compose exec frontend pnpm ...`. |
| `vite command not found` | Volumen vacío o instalación fallida. | Revisa logs y conectividad; reconstruye. No instales Vite en el host. |
| Puerto 5173 ocupado | Otro proceso usa el puerto publicado. | Cambia `FRONTEND_PORT` en `.env` y recrea el servicio. |
| Contenedor `unhealthy` | Vite no respondió después del arranque. | Consulta logs; valida lockfile, instalación y puerto. |
| Frontend sin backend | Backend no está listo o el proxy fue sobrescrito. | Revisa `docker compose ps`; el destino interno debe ser `http://backend:8000`. |
| Hot reload no funciona | El bind mount no propaga eventos. | Activa `VITE_USE_POLLING=true`; en WSL2 prefiere el filesystem Linux. |
| `/bin/sh^M: bad interpreter` | Checkout con CRLF. | Recupera el script respetando `.gitattributes`; no uses CRLF en scripts. |

## Matriz de validación

| Entorno | Estado |
| --- | --- |
| Linux + Docker Engine | probado en esta fase |
| Windows + Docker Desktop | compatible por diseño; pendiente validación manual |
| Windows + WSL2 | compatible por diseño; pendiente validación manual |
| Clon limpio | probado mediante entorno equivalente: imagen sin caché y volumen frontend nuevo |
| Sin `node_modules` host | probado |
| Sin volúmenes previos | probado para el volumen frontend; se preservaron deliberadamente las bases de datos |
| Reinicio normal | probado; no reinstaló dependencias |
| Reconstrucción limpia | probado con `docker compose build --no-cache frontend` |

La prueba no creó un segundo checkout físico ni se ejecutó en Windows. Se
eliminó exclusivamente el volumen descartable del frontend para reproducir las
condiciones relevantes de un clon nuevo sin arriesgar datos persistentes.
