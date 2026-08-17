---
title: 'Bing: IndexNow al publicar + alta en Webmaster Tools + señales que Bing pondera distinto'
linear: HOS-585
statusSource: linear
created: 2026-08-17
type: feature
areas:
  - web
  - api
  - devops
---

# Bing: IndexNow al publicar + alta en Webmaster Tools + señales que Bing pondera distinto

## 1. Summary

Hacer que Bing entere de cada publicación en minutos en vez de en semanas, y cerrar
las señales concretas que Bing pondera distinto a Google. Todo lo que entra acá tiene
**riesgo cero para el ranking actual en Google**: lo que sí lo tiene vive en HOS-586.

## 2. Problem

Continuación de HOS-117 (Done, 10/07), que dejó la infraestructura SEO/AEO madura.
Auditoría del 17/08 sobre `apps/web`: la base está bien y **no hay que tocarla**. Lo
que falta es específico de Bing, y son seis cosas.

**P-1 — No hay ningún mecanismo para avisar de contenido nuevo.** Cero menciones de
IndexNow en todo el repo. El viejo `bing.com/ping?sitemap=` está muerto. Hoy Bing se
entera de una ficha nueva cuando pasa a rastrear el sitemap, y no antes.

**P-2 — Bing Webmaster Tools sin dar de alta** (confirmado con el owner el 17/08).
Búsqueda de `msvalidate.01` y de la palabra "bing" en `apps/web/src` y en `docs/`:
cero coincidencias. Sin BWT no hay forma de ver si Cloudflare está desafiando a
bingbot, cuál es el estado real de indexación, ni el AI Performance report.

**P-3 — `bingbot` no está nombrado en `robots.txt`.** Cae en el bloque `*` y se
permite, así que **no está roto hoy**. Pero contradice la política que fijó HOS-369
WA-4: cada agente sobre el que el sitio tiene una opinión se nombra exactamente una
vez, en una sola dirección. Hoy Bing depende de un default.

**P-4 — Falta `telephone` en `LodgingBusinessJsonLd`.** Bing arma su paquete local
con NAP (nombre + dirección + teléfono). El componente emite `PostalAddress` completo
pero ningún teléfono.

**P-5 — `geo` (GeoCoordinates) probablemente vacío en toda ficha de alojamiento.** El
componente lo emite condicionalmente (`if (geo)`), pero el detalle público devuelve
`location: {}` — SPEC-097 despoja el pin exacto a propósito y lo único público es
`approximateLocation`. **No está verificado**: es la primera tarea de la spec.

**P-6 — `<html lang="es">` sin región,** y hreflang sólo genérico (`es`/`en`/`pt`/
`x-default`). Bing usa señales de país más explícitamente que Google.

## 3. Goals

- **G-1** — Cada publicación o actualización de contenido público indexable dispara un
  ping a IndexNow, automáticamente, sin intervención humana.
- **G-2** — `hospeda.com.ar` verificado en Bing Webmaster Tools, con el sitemap enviado
  y el geo-targeting configurado.
- **G-3** — `bingbot` nombrado explícitamente en `robots.txt`, con su política escrita
  y guardada por test.
- **G-4** — El JSON-LD de alojamiento emite NAP completo (teléfono) y coordenadas,
  cuando el dato existe.
- **G-5** — Señales de región: `<html lang>` con región y hreflang regionales
  **sumados** a los genéricos.

## 4. Non-goals

- **NG-1** — Reescribir títulos, meta descriptions o H1. Eso es HOS-586, y está afuera
  a propósito.
- **NG-2** — Arreglar los nombres crudos de servicios en el JSON-LD (`air_conditioning`).
  Es HOS-557, In Progress.
- **NG-3** — Darle al anfitrión dónde cargar su dirección. Es HOS-532. Esta spec
  **consume** ese dato cuando exista; no lo construye.
- **NG-4** — El problema del crawler de Meta que saltea Cloudflare. Es HOS-524.
- **NG-5** — 410 Gone para entidades borradas (HOS-256 / HOS-262). Ya sirve la señal de
  desindexación que Bing necesita.
- **NG-6** — Enviar a IndexNow todo el sitemap de una. Ver R-1.

## 5. Current baseline

Lo que YA está y no se toca:

| Qué | Dónde |
|---|---|
| `robots.txt` dinámico, política única por agente, `noindex` en staging por host | `apps/web/src/pages/robots.txt.ts` |
| sitemap-index → static + dynamic, con alternates hreflang y `lastmod` real | `apps/web/src/pages/sitemap-*.xml.ts`, `lib/seo/sitemap-xml.ts` |
| title / description / canonical / robots meta / OG / Twitter / hreflang | `apps/web/src/components/seo/SEOHead.astro` |
| 17 componentes JSON-LD + guard de cobertura en CI | `apps/web/src/components/seo/`, `test/integration/json-ld-coverage.test.ts` |
| Predicados de indexabilidad, uno por entidad | `lib/seo/partner-indexable.ts`, `author-indexable.ts`, `thin-destination.ts`, `promoted-facet-canonical.ts` |
| Fan-out de "este contenido cambió", con adapters y debounce | `packages/service-core/src/revalidation/` |
| Gate por entorno ya resuelto (`HOSPEDA_DEPLOY_ENV` → `resolveCacheTagEnvironment`) | `revalidation.service.ts` |

Dos restricciones del baseline que condicionan el diseño:

1. **La revalidación trabaja con TAGS, IndexNow necesita URLs.** No son lo mismo y la
   traducción no es trivial.
2. **El slug existe en el camino, pero se pierde al disparar.** `extractEntitySlug()`
   lo calcula y `debounceEntity()` lo usa como `debounceKeyId`, pero
   `fireIntoSharedPurgeWindow()` sólo propaga `entityType`, `entityId` (UUID) y `tags`.
   Un enganche a nivel del purge group **no tendría el slug**. Además hay eventos
   deliberadamente sin slug (`tag`, `amenity` devuelven `undefined`).

## 6. Proposed design

### 6.1 Dónde engancha el ping — decisión de diseño

Dos opciones reales:

**Opción A (recomendada) — enganchar en `scheduleRevalidation`, donde el slug todavía
existe.** El emisor de IndexNow es un colaborador propio con su propia ventana de
coalescencia, no un pasajero del purge de Cloudflare.

- *Pro*: el slug ya está ahí, sin round-trip a la base. Las necesidades de deduplicación
  de IndexNow (no reenviar URLs sin cambio) son distintas de las del purge de tags, y
  acoplarlas obliga a la peor de las dos. No toca el camino crítico de Cloudflare.
- *Contra*: un segundo mecanismo de debounce que mantener.

**Opción B — enganchar a nivel del purge group y resolver el slug desde `entityId`**
vía el `EntityResolver` existente.

- *Pro*: un solo punto de enganche, reusa el debounce que ya está.
- *Contra*: agrega una consulta a la base por cada purga; hereda la ventana de
  Cloudflare, que está calibrada para otra cosa; y los eventos sin slug quedan sin
  resolver igual.

**Recomendación: A.** El costo es un debounce propio; el beneficio es que las dos
integraciones puedan evolucionar sin pisarse.

### 6.2 Sólo se envía lo que el sitio serviría como indexable

Ésta es la regla que evita el daño real. IndexNow penaliza (429 y baja de scoring) al
que manda ruido. Antes de encolar una URL hay que pasarla por **el mismo predicado de
indexabilidad que ya usa el sitemap dinámico** — no por uno nuevo.

Consecuencia concreta: si una entidad deja de ser indexable, **no se manda**. Nunca se
envía una URL que la página serviría con `noindex`, ni una landing de faceta con 2+
valores (que es `noindex,follow` por `resolveFacetSeoDecision`).

### 6.3 Emisor — vive en `apps/web`, no en `apps/api` (corregido 17/08)

> **Corrección del diseño original.** Esta sección decía "módulo nuevo en `apps/api`".
> Está mal, y la evidencia es el propio repo: `cloudflare-revalidation.adapter.ts` NO
> llama a Cloudflare — hace `POST` al endpoint `/api/revalidate/` de `apps/web` con un
> secreto compartido, y ese archivo declara en su cabecera *"This endpoint holds the
> Cloudflare credentials; the API never sees them"*. La frontera de llamadas externas
> ya está en el web, y todo lo que IndexNow necesita vive de ese lado.

**El reparto, y por qué cada mitad está donde está:**

| Lado | Hace | Por qué sólo puede hacerlo ahí |
|---|---|---|
| `service-core` | Lee el toggle en cada envío. Decide **si** emitir. Manda `{entityType, slug}[]` al web. | Es el único con acceso a la base, y el toggle vive en `platform_settings`. El web no lee la base. |
| `apps/web` | Mapea entidad → URLs públicas canónicas (las 3 locales). Filtra por indexabilidad. Emite a `api.indexnow.org`. Sirve el `.txt`. | Tiene `buildUrl()`, los predicados de indexabilidad y el sitemap. Duplicar eso en `apps/api` viola el single-source-of-truth. |

- Adapter en `service-core` con la misma forma que `revalidation/adapters/`: uno real
  (POST a `/api/indexnow/` del web) y uno **noop**. Endpoint propio, hermano del de
  revalidación y NO colgado de él: si IndexNow falla, se apaga o se satura, el purge de
  caché no debe enterarse. Comparten origen, no destino.
- El noop se activa cuando el entorno resuelto no es producción. Mismo criterio y misma
  fuente (`HOSPEDA_DEPLOY_ENV`) que el gate de cache tags — no una variable nueva.
- **Defensa en profundidad en el web**: el endpoint rechaza si el host es uno de
  `HOSPEDA_NOINDEX_HOSTS`. Staging sirve `Disallow: /`; mandar sus URLs sería incoherente
  aunque el gate de entorno fallara.
- Envío en lote (`POST https://api.indexnow.org/indexnow`), con `host`, `key`,
  `keyLocation` y `urlList`.
- **No debe tirar nunca.** Igual que `RevalidationAdapter`: el error se captura en el
  resultado, porque el llamador es un hook fire-and-forget que corre al lado de una
  escritura de contenido que no puede fallar porque falló un ping.

### 6.4 La clave

- Se genera propia (hex, 8-128 chars). **No hace falta esperar el alta en BWT.**
- Se sirve desde `apps/web` como `text/plain` en `/<clave>.txt`.
- La trampa de host cruzado que esta sección advertía **ya no existe**: con el emisor en
  `apps/web` (§6.3), el `.txt` y las URLs enviadas salen del mismo origen por
  construcción. Se deja anotado porque era un riesgo real del diseño anterior y explica
  por qué el emisor no puede vivir en `apps/api` sin coordinar dos hosts.

### 6.5 El aviso se prende y se apaga desde el admin (decisión del owner, 17/08)

El ping **debe poder apagarse sin deploy**. La superficie ya existe y NO hay que
construir nada nuevo: `apps/admin/src/routes/_authed/platform/configuration/seo.tsx`
guarda contra un store genérico de settings con clave `seo.defaults`, validado por
`SeoDefaultsValueSchema`. El toggle es **un campo booleano más en ese schema y un
`Switch` en esa página** — sin tabla nueva, sin migración, sin pantalla nueva.

Se descartó una env var `HOSPEDA_INDEXNOW_ENABLED` por redundante: sin
`HOSPEDA_INDEXNOW_KEY` el emisor ya no puede funcionar, así que el corte duro existe
gratis. Dos interruptores para lo mismo son dos lugares donde mirar cuando algo no anda.

Quedan entonces **tres condiciones, y las tres tienen que darse** para que salga un ping:

1. El entorno resuelto es producción (`HOSPEDA_DEPLOY_ENV`) — si no, adapter noop.
2. `HOSPEDA_INDEXNOW_KEY` está definida.
3. El toggle del admin está en ON.

El emisor lee el toggle en cada envío, no al arrancar: apagarlo tiene que surtir efecto
sin reiniciar el API. Cachear ese valor por más que la ventana de debounce anula el
propósito del interruptor.

### 6.6 Bing Webmaster Tools

**Confirmado por el owner (17/08): `hospeda.com.ar` YA está cargado y verificado en
Google Search Console** — sin sitemap enviado ni nada más configurado. Así que el alta
en BWT es **importar la propiedad desde GSC**, sin tocar DNS ni meta tags. El fallback
`msvalidate.01` queda descartado.

Al importar hay que registrar si la propiedad de GSC es *Domain* (verificada por DNS,
cubre subdominios) o *URL prefix*, porque cambia qué termina cubriendo Bing.

Una vez adentro: enviar el sitemap y configurar geo-targeting a Argentina.

La verificación de si Cloudflare bloquea a bingbot **ya se hizo (17/08) y dio negativo**:
nada en Cloudflare lo bloquea ni lo desafía. Detalle completo en el comentario de
HOS-585. Lo único que sigue sin poder verificarse fuera de BWT es si el bingbot **real**
está rastreando — el plan free no ofrece filtro por user-agent en Security Analytics.

## 7. Data model / contracts

Sin migraciones. Sin tabla nueva.

**Campo nuevo en el schema de settings SEO** (`SeoDefaultsValueSchema`, clave
`seo.defaults` del store genérico que ya usa la página del admin):

| Campo | Tipo | Default | Para qué |
|---|---|---|---|
| `indexNowEnabled` | `boolean` | `false` | Prende/apaga el aviso a los buscadores. Arranca en OFF a propósito: el default seguro es no emitir. |

Arrancar en `false` es deliberado — un default `true` haría que el ping empiece a salir
solo en cuanto se despliegue, antes de que nadie verifique que la clave está bien
publicada. Que el primer envío sea un acto explícito es parte del diseño.

**Env vars nuevas** (siguen el workflow de `packages/config/src/env-registry.*`, más
Zod en `apps/api/src/utils/env.ts`, más `.env.example`):

| Var | App | Secreto | Para qué |
|---|---|---|---|
| `HOSPEDA_INDEXNOW_KEY` | api + web | sí | La clave. `web` la necesita para servir el `.txt`; `api`, para firmar el ping. |

`HOSPEDA_DEPLOY_ENV` ya existe y se reusa como gate. No se crea una var nueva para eso.

**Contrato de IndexNow** (documentar en la spec para que nadie lo re-derive):

```
POST https://api.indexnow.org/indexnow
Content-Type: application/json; charset=utf-8

{ "host": "...", "key": "...", "keyLocation": "https://.../<clave>.txt", "urlList": [...] }
```

| Código | Significado |
|---|---|
| 200 | Recibido |
| 202 | Aceptado, clave todavía sin validar |
| 400 | Formato inválido |
| 403 | Clave no encontrada o no coincide |
| 422 | La URL no pertenece al host |
| 429 | Tomado por spam |

Máximo 10.000 URLs por request. Una llamada alcanza a Bing, Yandex, Seznam, Naver y Yep.

## 8. UX / UI behavior

Ninguno. Es infraestructura, invisible para el usuario final.

## 9. Acceptance criteria

- **AC-1** — Publicar o editar una entidad pública indexable en producción encola su URL
  canónica y dispara un envío a IndexNow. Verificable con el conteo de envíos en BWT.
- **AC-2** — `GET https://hospeda.com.ar/<clave>.txt` devuelve **200**, `text/plain`, con
  la clave como único contenido.
- **AC-3** — La misma operación en staging **no** emite ningún request saliente a
  `api.indexnow.org`. Guardado por test, no sólo por configuración.
- **AC-4** — Una entidad que la página serviría con `noindex` **nunca** se encola. Test
  con el caso de faceta de 2+ valores.
- **AC-5** — Un fallo del emisor (timeout, 403, 429) **no** hace fallar la escritura de
  contenido que lo originó. Test con el adapter tirando.
- **AC-6** — `robots.txt` de producción contiene un bloque `User-agent: bingbot` con las
  mismas reglas de disallow que `*`. El test existente de `robots-policy` lo cubre.
- **AC-7** — `hospeda.com.ar` verificado en BWT, con el sitemap enviado y aceptado.
- **AC-8** — Una ficha de alojamiento con teléfono cargado emite `telephone` en su
  JSON-LD, y valida contra el validador de schema.org.
- **AC-9** — Una ficha con `approximateLocation` emite `geo` con `GeoCoordinates`, **sin
  exponer el pin exacto** que SPEC-097 despoja deliberadamente.
- **AC-10** — Toda página emite `hreflang` regional **además** del genérico. `es`, `en`,
  `pt` y `x-default` siguen presentes: un test lo afirma explícitamente.
- **AC-11** — Con el toggle del admin en **OFF**, no sale ningún request a
  `api.indexnow.org`, aunque el entorno sea producción y la clave esté definida. Test
  con las tres condiciones cruzadas, no sólo el caso feliz.
- **AC-12** — Apagar el toggle surte efecto **sin reiniciar el API**: el emisor lee el
  valor en cada envío. Test que cambia el setting entre dos envíos y afirma que el
  segundo no sale.
- **AC-13** — El valor por defecto de `indexNowEnabled` es `false`. Un despliegue nuevo
  no empieza a emitir solo.

## 10. Risks

- **R-1 — Mandar de más quema el dominio.** IndexNow puntúa al emisor: reenviar URLs sin
  cambio lleva a 429 y baja de prioridad. Mitigación: sólo cambios reales, nunca un
  barrido periódico del sitemap. Está como NG-6 justamente por eso.
- **R-2 — La clave filtrada permite que un tercero envíe URLs de nuestro dominio.** El
  daño está acotado (sólo puede enviar URLs que *pertenecen* al host, no inyectar
  contenido), pero conviene tratarla como secreto y poder rotarla: rotar = generar
  clave nueva, servir el `.txt` nuevo, cambiar la env var.
- **R-3 — Romper el hreflang al agregar región.** Reemplazar `hreflang="es"` por `es-AR`
  pierde la cobertura de es-ES / es-MX. Mitigado por AC-10, que lo afirma en un test.
- **R-4 — Acoplarse al debounce de Cloudflare.** Si se elige la Opción B, la ventana de
  IndexNow queda atada a una calibrada para purgar cache. Mitigado eligiendo A.
- **R-5 — P-5 puede ser falso.** El diseño asume que `geo` está vacío hoy. Si resulta
  que ya se emite, AC-9 se cierra sin trabajo. **Medir primero.**

## 11. Open questions

- ~~**OQ-1** — ¿Está Google Search Console configurado para `hospeda.com.ar`?~~
  **RESUELTA (17/08)**: sí, dominio cargado y verificado, sin sitemap enviado. El alta en
  BWT es importar desde GSC. Ver §6.6.
- **OQ-2** — ¿Se sirve el `.txt` de la clave como ruta Astro o como archivo en `public/`?
  Una ruta permite leerlo de la env var (rotación sin deploy de assets); `public/`
  es más simple pero fija la clave en el build.
- **OQ-3** — ¿Se le avisa a IndexNow también de las **bajas** (410 Gone)? El protocolo lo
  admite y acelera la desindexación, pero se cruza con HOS-256 / HOS-262, que todavía
  están en curso.

## 12. Implementation notes

Trampas ya identificadas. **No re-litigar ninguna de éstas:**

- **NO reintroducir `SearchAction` en `WebSiteJsonLd`.** Se sacó a propósito porque no
  hay página de búsqueda viva, y hay un test que lo guarda. Toda guía genérica de Bing
  te lo va a pedir.
- **NO poner `Crawl-delay` en `robots.txt`.** Google lo ignora, Bing lo **obedece**:
  ponerlo bajaría el rastreo de Bing. Es el consejo genérico que más daño hace.
- **NO exponer el pin exacto de un alojamiento** para llenar `geo`. SPEC-097 lo despoja
  deliberadamente; la fuente es `approximateLocation`.
- **IndexNow no depende de BWT.** El alta destraba el diagnóstico, no el ping. Las dos
  mitades pueden avanzar en paralelo.
- El emisor **no puede tirar nunca**, por el mismo motivo que `RevalidationAdapter`.

## 13. Linear

Canonical tracking:
HOS-585

Hermana: HOS-586 (auditoría de títulos / descriptions / H1 — la mitad con riesgo).
Predecesora: HOS-117 (SEO/AEO on-page hardening, Done).
