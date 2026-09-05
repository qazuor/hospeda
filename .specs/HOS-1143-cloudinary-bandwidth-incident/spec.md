---
title: Incidente Cloudinary — 70,66 GB en 30 días por el ciclo de imágenes del seed en CI
linear: HOS-1143
statusSource: linear
created: 2026-09-04
updated: 2026-09-04
type: fix
areas:
  - devops
  - web
---

# Incidente Cloudinary — el ciclo de imágenes del seed en CI

> **Nota de revisión (2026-09-04).** La primera versión de esta spec atribuyó el
> gasto al servidor SSR resolviendo `/_image` dentro del CI, y planificó siete
> hijos alrededor de esa hipótesis. La causa real es otra y cinco de esos siete
> hijos apuntan a una superficie que resultó ser el 0,43% del tráfico. Este
> documento es la versión corregida, con todo verificado por medición.

## 1. Resumen

Cloudinary registró **70,66 GB de bandwidth y 312.099 transformaciones** en 30
días, llevando la cuenta a **382,70 de 225 créditos (170% del plan Plus)**.

La causa es el **pipeline de subida de imágenes del seed**, ejecutándose en cada
run de CI: descarga el original de cada imagen desde `res.cloudinary.com` para
volver a subirla a Cloudinary. El cache que evitaría esa descarga vive en un
archivo gitignoreado, así que en un runner limpio falla el 100% de las veces.

Corregido en HOS-1144 (PR #3206, mergeado a `staging` el 2026-09-05).

## 2. El problema

### Métricas del incidente (dashboard, ventana de 30 días al 2026-09-04)

| Métrica | Valor |
|---|---|
| Requests | 340.080 |
| Image impressions | 339.860 |
| Transformaciones | 312.099 |
| Bandwidth | 70,66 GB |
| Storage | 946,98 MB (2.996 assets) |
| UA `node` | 69,6 GB (98,50%) |
| Sin referrer | 69,66 GB (98,59%) |
| Origen EEUU | 68,28 GB (96,62%) |
| Referrer `hospeda.com.ar` | **308,38 MB (0,43%)** |
| Transformación `webp` | 308.198 requests (90,62%) |

### Lo que de verdad se paga

El consumo en créditos se desglosa así, y la suma cierra exacta contra los
382,70 facturados:

| | | créditos |
|---|---|---|
| Bandwidth | 70,66 GB | 70,7 |
| Transformaciones | 312.099 | 312,1 |
| | | **382,8** |

**El bandwidth es el 18% de la factura.** Toda la investigación inicial midió
GB, que es la columna menor. Las transformaciones (312.099) siguen al tráfico
casi 1:1 con las impresiones (339.860) y los requests (340.080): no son un
consumo aparte, es el mismo request cobrado por dos vías.

## 3. Causa raíz (verificada)

Tres líneas del repo:

| | |
|---|---|
| `apps/e2e/seeds/e2e-seed.ts:69` | `HOSPEDA_CLOUDINARY_FOLDER_ROOT ?? 'hospeda/e2e/seed/'` |
| `packages/seed/src/utils/cloudinary-upload.ts:281` | `await fetch(originalUrl)` — baja el original para re-subirlo |
| `packages/seed/.gitignore:1` | `.cloudinary-cache.json` — el cache está gitignoreado |

El chequeo de cache-hit (`cloudinary-upload.ts:263`) consulta ese archivo. En un
runner con checkout limpio no existe, y ningún workflow lo cachea con
`actions/cache`, así que es cache-miss en el 100% de las imágenes de cada run.

`e2e-pr.yml` y `a11y-sweep.yml` corren en **cada PR**. Un seed completo procesa
2.242 imágenes, de las cuales **468 están alojadas en Cloudinary** a ~212 KB de
promedio: unos 99 MB de delivery por run, más el mismo volumen subido de vuelta.

### Las cuatro mediciones que lo confirman

1. **Correlación temporal, 12 de 12 días sin excepción.** Los días con pico en
   el dashboard tienen 144-423 runs de workflows que levantan la web; los días
   sin pico, entre 4 y 41. Medido con `gh run list --created <fecha>`, que
   cubre sólo 2,4 días con su tope de 1000 — se corren 300-400 runs diarios.

2. **Peso.** El promedio del incidente es 218 KB/request; el de 12 originales
   del seed, 212 KB. Proyección: 340.080 × 212 KB = 68,8 GB contra los 70,66
   reportados. Con el preset `card` (21,5 KB) el incidente sería de 7 GB.

3. **Formato.** El `webp = 90,62%` del dashboard **no** son transformaciones.
   `f_auto` devuelve JPEG a cualquier cliente que no manda `Accept: image/webp`
   (medido en tres presets, jpeg las tres veces). El único camino que devuelve
   webp a un cliente Node es pedir el **original sin transformar**, porque los
   assets subidos ya son `.webp`.

4. **Confirmación externa.** El soporte de Cloudinary reportó la correlación con
   llamadas a la Admin API `resources/image?prefix=hospeda/e2e/*`, sugiriendo
   mirar "qué pasa después de recibir el resultado".

### Lo que se descartó, y cómo

- **El VPS**: 44 ms de RTT desde Argentina a `216.238.103.219` (Vultr) ⇒ está en
  Sudamérica, no puede ser el 96,6% de EEUU.
- **Un scraper externo**: encaja con la firma `node` + sin referrer + EEUU tan
  bien como el CI, pero no con la correlación 12/12 contra los runs.
- **`astro build`**: `apps/web` es `output: 'server'` con **cero** páginas
  `prerender = true`. El build no resuelve ninguna imagen remota.
- **Uploads con transformaciones eager**: `CloudinaryProvider.upload()` no pide
  `eager`, y el seed no le pasa `transformation`. Subir no transforma.

## 4. Errores de la primera versión de esta spec

Se dejan documentados porque son el tipo de error que se repite:

1. **Una cita inventada.** Se atribuyó a `packages/media/CLAUDE.md` la afirmación
   de que las imágenes remotas "nunca" llegan a `/_image`. Ese archivo no
   menciona `/_image` ni una vez.
2. **5 de 14 componentes mal clasificados.** `CardMeta`, `PostRelatedEntityCard`,
   `LatestArticlesSection`, `TestimonialsSection` y `autores/[slug]` fueron
   listados con doble optimización por tener el guard `isCloudinaryDeliveryUrl`,
   pero su valor nunca pasó por `getMediaUrl`. La presencia del guard no prueba
   el doble transform: hay que trazar el productor.
3. **Faltaba `OwnerCard.astro:29-39`**, que sí la tiene.
4. **`Cache-Control`**: se afirmó `private` + `CDN-Cache-Control: no-store`. El
   original responde `public, no-transform, immutable, max-age=2592000`, y
   `CDN-Cache-Control` no aparece en ninguna respuesta.
5. **El camino del seed se descartó dos veces con el argumento equivocado**:
   "solo corre en cache-miss". El cache-miss es el caso normal en CI, no la
   excepción — el cache está gitignoreado.

## 5. Qué se hizo

| | | estado |
|---|---|---|
| HOS-1144 | H1 — corte del ciclo en CI (`HOSPEDA_USE_LOCAL_MEDIA_PLACEHOLDERS`) | mergeado, PR #3206 |
| HOS-1157 | P0 — Strict Transformations rompía `/_image` con 500 | Done, verificado |
| HOS-1162 | re-habilitar `e2e-pr` y `a11y-sweep` | habilitados; falta confirmar en el dashboard |
| HOS-1163 | round-trip de fondo (468 imágenes, todos los entornos) | Backlog |

Evidencia del primer run con el fix, del log del propio seed:

```
[seed:images] tally uploaded=0 cached=0 failures=0 skippedExample=1748 skippedPlaceholder=472
```

Antes: 2.242 descargas más 2.242 subidas por run.

### Dos bugs de producción encontrados en el camino

Ninguno depende del flag; existían y costaban en cada render no cacheado.

- `destinos/[...path].astro:518` construía el hero de 1200×675 desde el objeto
  media crudo. Verificado contra el sitio real: `/es/destinos/colon/` emitía
  `/_image?href=...featured.webp` sin ninguna transformación en el path.
- `publicaciones/[slug].astro:301` armaba la imagen de entidad relacionada con
  `String()` para un thumbnail de 80×56.

Los dos detrás de un `!url.includes('placeholder')` que se lee como protección y
**nunca puede ser falso** para una URL real de Cloudinary.

## 6. Los hijos que quedan, y cuándo despertarlos

**Vivos:**

- **HOS-1163** — elimina el round-trip en todos los entornos, no sólo en CI.
  Ataca bandwidth, transformaciones y storage a la vez. Lo más rentable que queda.
- **H3 (HOS-1146)** — congelar el catálogo de variantes. Prerrequisito para
  volver a activar Strict Transformations sin romper producción.
- **H2 (HOS-1145)** — higiene. Bajado a Medium: la doble optimización no es la
  fuente del costo.

**Dormidos por decisión:**

- **H4 (HOS-1147, Worker), H5 (HOS-1148, cutover), H7 (HOS-1150, Cloudflare
  Images)** gobiernan el **delivery público**, que son 308,38 MB al mes: **0,3
  créditos de 225**. Se diseñaron cuando se creía que el gasto era el delivery.
  **Criterio para despertarlos**: que el referrer `hospeda.com.ar` pase de esos
  308 MB a decenas de GB, o que se quiera salir de Cloudinary por razones que no
  sean el costo. En ese caso se re-evalúan con su propia justificación, no
  heredando la urgencia de este incidente.
- **H6 (HOS-1149)** — bloqueado por H3. Se activó el 2026-09-04 y se apagó el
  mismo día por HOS-1157.

## 7. Riesgos vivos

- **R-1.** El flag de HOS-1144 deja la URL original de Cloudinary en la DB del
  seed (no reescribe el bloque `media`, porque una ruta relativa no pasa
  `MediaSchema`, cuyo `mediaAssetUrl` es `z.url({ protocol: /^https?$/ })`). La
  capa de render es entonces la única defensa para esas URLs, y por eso el guard
  `scripts/check-local-media-placeholders.sh` cubre `<Image>` además de
  `getImage()`.
- **R-2.** Registrar una env var trippea conteos congelados en `packages/config`
  que `env:check:registry` no cubre (`EXPECTED_VAR_COUNT` y el snapshot por
  categoría). Rompió el CI una vez.
- **R-3.** Cachear `.cloudinary-cache.json` con `actions/cache` choca con el cron
  `cloudinary-e2e-cleanup` (`0 2 * * 0`), que borra todo el prefijo
  `hospeda/e2e/`: un cache restaurado sobrevive al barrido y apunta a assets que
  ya no existen.

## 8. Preguntas abiertas

- **OQ-1.** ¿Las transformaciones caen junto con el bandwidth? La lectura es que
  siguen al tráfico 1:1, pero no está verificado. Se comprueba en el gráfico
  **diario** del dashboard, no en el total de 30 días, que queda diluido por la
  historia previa. Si el bandwidth baja y las transformaciones no, hay un segundo
  consumidor sin identificar y se resolvió menos de una quinta parte del costo.
- **OQ-2.** ¿El aislamiento por entorno de las 468 imágenes (`hospeda/{env}/`) es
  un requisito real o una propiedad heredada que nadie ejerce? Es la decisión
  bloqueante de HOS-1163.
- **OQ-3.** ¿Aplica el mismo razonamiento a las 1.774 imágenes de Pexels y
  Unsplash? No cuestan bandwidth de Cloudinary, pero sí uploads y tiempo de seed
  en cada run.

## 9. Linear

Tracking canónico: HOS-1143
