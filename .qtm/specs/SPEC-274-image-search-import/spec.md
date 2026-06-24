---
spec-id: SPEC-274
title: Stock image search & import (Unsplash/Pexels) — admin editor, v1
type: feature
complexity: medium
status: draft
created: 2026-06-23T00:00:00Z
decided: 2026-06-23
model_fit: basic
effort_estimate_hours: 12-20
tags: [images, media, search, import, unsplash, pexels, stock, events, posts, admin, editor]
---

# SPEC-274: Stock image search & import (Unsplash/Pexels)

> ## ✅ RECON DONE + DECISIONS RESOLVED (2026-06-23)
>
> El código real se relevó con un Explore subagent (no se adivinó). El recon
> destapó divergencias con los supuestos del spec original: ver `## 3. Recon
> Findings`. Decisiones de producto tomadas por el owner:
>
> - **Scope v1 = SOLO ADMIN.** El flujo web-host se difiere a un follow-up. Razón:
>   el editor host de web es accommodation-only (`PhotoSection.client.tsx`), y las
>   accommodations están fuera de scope (necesitan fotos reales). Los editores host
>   de events/posts en web **no existen todavía** — construirlos es otra spec.
> - **Sin cache.** Cada búsqueda pega a la API fresca (stateless proxy). Sin tabla
>   nueva, sin migración. Para un editor de baja concurrencia alcanza. Cache DB-TTL
>   se difiere a follow-up si la quota se vuelve un problema.
> - **Solo tabs, sin auto-fallback.** El usuario elige Unsplash o Pexels por tab.
>   No hay detección de rate-limit + reintento cross-provider en v1.
> - **Attribution = caption visible + link.** "Foto por [autor] en [provider]" visible
>   con link al perfil del autor. Requisito legal de los TOS de Unsplash/Pexels
>   (exigen attribution visible + hotlink, no solo alt-text).

---

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Integrar búsqueda de imágenes stock (Unsplash/Pexels) dentro del **admin**
para que los editors busquen e importen imágenes para **events y posts** sin salir del
editor. Las imágenes se descargan server-side y se suben a Cloudinary con attribution
correcta, que luego se renderiza en la web pública.

**Why now:** Muchos events/posts no tienen imagen propia. Hoy los editors buscan en
Google/Unsplash manualmente, descargan y suben. Integrar la búsqueda en el editor ahorra
tiempo y, sobre todo, **asegura attribution correcta**, que es un requerimiento legal de
las APIs de Unsplash/Pexels (no opcional).

**Target users:** Editors (admin panel). Hosts en web → follow-up (fuera de scope v1).

### 2. Out of Scope (v1)

- **Flujo web-host** (búsqueda en el editor de web) → follow-up; hoy no hay editor host
  de events/posts en web.
- AI image generation (text-to-image) → feature distinta.
- Image editing/crop → SPEC-273.
- Video search/import.
- Búsqueda para accommodations/destinations → necesitan fotos reales, no stock.
- Cache de búsquedas (DB-TTL) → follow-up si la quota lo exige.
- Auto-fallback Unsplash→Pexels por rate-limit → el usuario cambia de tab manualmente.
- Self-service para usuarios no autenticados.

### 3. Recon Findings (código real, no supuestos)

Estos hallazgos contradicen el spec original y son la base del fix catalog. Cada uno
con archivo + por qué importa.

| # | Finding | Archivo | Impacto |
|---|---------|---------|---------|
| R1 | El schema de attribution real es `{ photographer, sourceUrl, license }` — **NO** `photographerName`/`originalUrl`, y **no existe** campo `provider` | `packages/schemas/src/common/media.schema.ts:12-27` | El spec original usaba nombres inexistentes. Hay que alinear y **agregar** `provider`. |
| R2 | `attribution` falta en `BaseMediaObjectSchema` (el shape de create/update) | `packages/schemas/src/common/media.schema.ts:130-193` | Sin esto, todo PATCH **dropea silenciosamente** la attribution. Hay que agregarla ahí también. |
| R3 | `CloudinaryProvider.upload()` solo acepta `{ file: Buffer }` — **no hay** "upload from URL" | `packages/media/src/server/cloudinary.provider.ts:232-266`, `types.ts:23-34` | Hay que fetch→buffer→upload. El patrón ya existe (ver R4). |
| R4 | Patrón "fetch URL → buffer → Cloudinary" ya implementado | `packages/service-core/src/services/social/social-image-pipeline.service.ts:141-372` | Reusar este patrón 1:1. No inventar nada. |
| R5 | **No existe** `MEDIA_MANAGE`. Solo `MEDIA_UPLOAD` y `MEDIA_DELETE` | `packages/schemas/src/enums/permission.enum.ts:784-785` | Las rutas admin se gatean con `MEDIA_UPLOAD` (no inventar permiso nuevo). |
| R6 | **No hay** picker/modal de librería de imágenes en admin. Solo file-upload | `apps/admin/src/components/entity-form/fields/ImageField.tsx`, `GalleryField.tsx` | El `ImageSearchModal` se construye de cero. El `Dialog`/lightbox de `ImageField` (líneas 357-401) es el patrón de modal a espejar. |
| R7 | Attribution **nunca se renderiza** en `apps/web` | grep `apps/web/src` → 0 hits de render de `photographer`/`sourceUrl` | El componente de attribution visible es UI **net-new**. |
| R8 | El único patrón de cache existente es DB-backed TTL (exchange-rate). No hay Redis/in-memory | `packages/service-core/src/services/exchange-rate/exchange-rate-fetcher.ts` | Justifica la decisión "stateless v1": cache exigiría tabla+migración. |
| R9 | `safeExternalFetch` (`@repo/utils/safe-fetch`) es el primitivo SSRF-hardened obligatorio para fetch externo | usado en `accommodation-import.service.ts` | Las llamadas a Unsplash/Pexels y la descarga de la imagen DEBEN usarlo, no `fetch()` crudo. |
| R10 | Gallery caps: hard cap por entidad (`event:10`, `post:15`) + soft cap billing (solo accommodations) | `packages/schemas/src/common/media-upload.schema.ts:32-39` | El import cuenta contra el cap. Reutilizar el check del upload route existente. |
| R11 | `ImageValue` del admin (`{url,caption,description,alt,moderationState}`) es más angosto que `ImageSchema` — no lleva `attribution` | `apps/admin/src/components/entity-form/fields/ImageField.tsx:25-31` | El campo de attribution hay que sumarlo al `ImageValue`/`GalleryImage` del admin. |

### 4. Providers

#### 4.1 Unsplash

- **API:** <https://unsplash.com/documentation>
- **Auth:** Access Key (client ID), header `Authorization: Client-ID <key>`.
- **Rate limit:** 50 req/hora (demo), 5000/hora (producción aprobada).
- **Search:** `GET https://api.unsplash.com/search/photos?query=&per_page=&orientation=&page=`
- **Attribution requerida:** "Photo by [Photographer] on Unsplash", con links UTM.
- **⚠️ Requisito TOS duro:** al importar una foto **hay que pegarle al endpoint de
  download trigger** `GET <photo.links.download_location>` (con el Client-ID). No es
  para descargar la imagen — es un ping de tracking que Unsplash **exige** en sus API
  guidelines. Omitirlo viola los TOS y puede revocar la app. Ver `## 6.3`.

#### 4.2 Pexels

- **API:** <https://www.pexels.com/api/>
- **Auth:** header `Authorization: <api_key>`.
- **Rate limit:** 200 req/hora.
- **Search:** `GET https://api.pexels.com/v1/search?query=&per_page=&orientation=&page=`
- **Attribution requerida:** "Photo by [Photographer] on Pexels" + link a pexels.com.
- Sin endpoint de download trigger.

#### 4.3 Strategy (v1)

- El usuario elige provider por **tab** (Unsplash | Pexels). Default: Unsplash.
- **Sin** auto-fallback por rate-limit (decisión owner). Si un provider responde 429,
  se muestra un mensaje "límite alcanzado, probá el otro proveedor" y el usuario cambia
  de tab.
- **Sin** cache (decisión owner). Cada búsqueda es una llamada fresca.

### 5. User Stories (con acceptance checks testeables)

#### US-1 — Buscar imágenes en el admin editor

**Como** editor, **quiero** buscar imágenes stock por texto desde el editor de un
event/post, **para** no tener que salir a buscar/descargar manualmente.

- **GIVEN** un editor con permiso `MEDIA_UPLOAD` editando un event
  **WHEN** hace click en "Buscar imágenes" en el campo featured/gallery
  **THEN** se abre `ImageSearchModal` con input de query, tabs (Unsplash/Pexels),
  filtro de orientation, y un grid vacío con prompt.
- **GIVEN** el modal abierto en tab Unsplash
  **WHEN** escribe "concert" y busca
  **THEN** la UI llama `GET /api/v1/admin/media/search?provider=unsplash&query=concert`
  y muestra un grid de thumbnails normalizados (cada uno con photographer + provider).
- **GIVEN** una búsqueda sin resultados
  **WHEN** la API devuelve `results: []`
  **THEN** se muestra empty-state "Sin resultados para «concert»" (no error).
- **GIVEN** Unsplash devuelve 429 (rate-limited)
  **WHEN** la API propaga el rate-limit
  **THEN** la UI muestra "Límite de Unsplash alcanzado, probá Pexels" y NO rompe.

#### US-2 — Importar una imagen seleccionada

**Como** editor, **quiero** importar una imagen del grid a la entidad, **para** que
quede como featured o en la galería con attribution correcta.

- **GIVEN** un resultado seleccionado (preview grande + attribution + botón "Importar")
  **WHEN** hace click en "Importar"
  **THEN** la UI llama `POST /api/v1/admin/media/import-stock` con el provider + photo id.
- **GIVEN** el import en curso
  **WHEN** el backend procesa
  **THEN** el backend: (1) [Unsplash] pega el download trigger, (2) descarga los bytes
  con `safeExternalFetch`, (3) sube el buffer a Cloudinary vía `CloudinaryProvider.upload`,
  (4) devuelve `{ url, publicId, attribution: { photographer, sourceUrl, license, provider } }`.
- **GIVEN** el import exitoso
  **WHEN** el modal se cierra
  **THEN** la imagen queda seteada como featured (o agregada a gallery) **con su
  attribution** persistida en el payload del form.
- **GIVEN** la entidad ya está en su gallery cap (ej: post con 15 imágenes)
  **WHEN** intenta importar una más
  **THEN** el backend rechaza con el mismo error de cap que el upload normal
  (`ENTITY_GALLERY_CAPS.post = 15`), y la UI muestra el mensaje de límite.

#### US-3 — Attribution se renderiza en la web pública

**Como** visitante, **quiero** ver el crédito del fotógrafo, **para** que la plataforma
cumpla la licencia (y el fotógrafo reciba crédito).

- **GIVEN** un post/event público cuya imagen tiene `attribution.provider = 'unsplash'`
  **WHEN** se renderiza la página
  **THEN** debajo/sobre la imagen aparece "Foto por [photographer] en Unsplash", con el
  nombre linkeado a `attribution.sourceUrl` (perfil del autor) y `rel="nofollow"`.
- **GIVEN** una imagen sin attribution (`source: 'user-upload'` o sin campo)
  **WHEN** se renderiza
  **THEN** NO se muestra ningún crédito (no romper, no string vacío).

#### US-4 — API keys nunca expuestas

- **GIVEN** el bundle del cliente admin
  **WHEN** se inspecciona
  **THEN** `HOSPEDA_UNSPLASH_ACCESS_KEY` / `HOSPEDA_PEXELS_API_KEY` no aparecen — todas
  las llamadas a los providers pasan por el proxy del API server.

### 6. Technical Approach

#### 6.1 Backend proxy (search)

`ImageSearchService` en service-core normaliza ambos providers a un shape común:

```ts
type StockImageResult = {
    providerId: string;        // id de la foto en el provider
    provider: 'unsplash' | 'pexels';
    thumbUrl: string;          // url chica para el grid
    fullUrl: string;           // url para descargar al importar
    width: number;
    height: number;
    photographer: string;
    photographerUrl: string;   // perfil del autor → va a attribution.sourceUrl
    downloadLocation?: string; // SOLO unsplash: el trigger endpoint
};
```

- Una `search({ provider, query, orientation, page })` que ramifica por provider, llama
  con `safeExternalFetch` (R9), y mapea la respuesta cruda al `StockImageResult[]`.
- El mapeo es lo único provider-específico; el resto es común.

#### 6.2 Import flow (`ImageImportService`)

Reusar el patrón de `SocialImagePipelineService` (R4) paso a paso:

1. Recibe `{ provider, providerId, fullUrl, downloadLocation, photographer, photographerUrl }`.
2. **[Unsplash únicamente]** `GET downloadLocation` con el Client-ID (download trigger, R en `4.1`).
3. `safeExternalFetch(fullUrl)` → `Buffer` (timeout 15s, igual que el pipeline social).
4. `CloudinaryProvider.upload({ file: buffer, folder: <entity folder>, tags: ['stock', provider] })`.
5. Construye `attribution = { photographer, sourceUrl: photographerUrl, license: <Unsplash|Pexels License>, provider }`.
6. Devuelve `{ url, publicId, attribution }`. El cap se chequea **antes** del upload,
   reutilizando el helper del admin upload route (R10).

#### 6.3 Attribution persistence (schema)

- **Alinear y extender** `ImageAttributionSchema` (R1): mantener `photographer`,
  `sourceUrl`, `license`; **agregar** `provider: z.enum(['unsplash','pexels','user-upload']).optional()`.
- **Agregar `attribution`** a `BaseMediaObjectSchema` (R2) para que create/update no la
  dropeen. El media se guarda como **jsonb** → **no requiere migración de DB**, solo el
  cambio de zod schema.
- Sumar `attribution` al `ImageValue`/`GalleryImage` del admin (R11) para que el modal
  pueda setearlo y el form lo mande en el PATCH.

#### 6.4 Permisos y tiers (v1 = admin only)

| Route | Tier | Auth | Descripción |
|-------|------|------|-------------|
| `GET /api/v1/admin/media/search` | Admin | `MEDIA_UPLOAD` | Buscar (query, provider, orientation, page) |
| `POST /api/v1/admin/media/import-stock` | Admin | `MEDIA_UPLOAD` | Importar imagen stock a Cloudinary |

> Las rutas `protected/*` del spec original quedan **fuera de v1** (follow-up web-host).

### 7. Data Model

Sin tablas nuevas. Solo el cambio de zod schema de `6.3` (jsonb, sin migración).

### 8. Tasks

| Task | Title | Status |
|---|---|---|
| T-274-01 | Config: registrar `HOSPEDA_UNSPLASH_ACCESS_KEY` + `HOSPEDA_PEXELS_API_KEY` en env registry (`apps: ['api']`, secret) + zod en `apps/api/src/utils/env.ts` + `.env.example` | pending |
| T-274-02 | Schema: alinear `ImageAttributionSchema` (agregar `provider`) + agregar `attribution` a `BaseMediaObjectSchema` + tests | pending |
| T-274-03 | Service: `ImageSearchService` (proxy Unsplash+Pexels, normalize a `StockImageResult`, `safeExternalFetch`) | pending |
| T-274-04 | Service: `ImageImportService` (download trigger Unsplash + fetch buffer + Cloudinary upload, reusar patrón social-image-pipeline) | pending |
| T-274-05 | API: `GET /admin/media/search` + `POST /admin/media/import-stock` (gate `MEDIA_UPLOAD`, cap check reusado) | pending |
| T-274-06 | Admin: `ImageSearchModal` component (input, tabs Unsplash/Pexels, orientation filter, grid, preview, importar) — espejar el `Dialog` de `ImageField` | pending |
| T-274-07 | Admin: integrar el modal en `ImageField` (featured) y `GalleryField` (gallery) + sumar `attribution` a `ImageValue`/`GalleryImage` | pending |
| T-274-08 | Web: componente de attribution visible (`ImageAttribution.astro`) — "Foto por X en Provider" + link nofollow | pending |
| T-274-09 | Web: integrar `ImageAttribution` en las páginas públicas de event y post detail | pending |
| T-274-10 | i18n: strings es/en/pt (buscar, importar, attribution, empty/rate-limit states) | pending |
| T-274-11 | Tests: service (search normalize + import) + API (gate, cap, import shape) + components | pending |

### 9. Acceptance Criteria

- [ ] Editor puede buscar imágenes por texto en el admin (Unsplash y Pexels por tab).
- [ ] Resultados muestran thumbnail + photographer + provider.
- [ ] Filtro de orientation funciona.
- [ ] Import sube la imagen a Cloudinary con `attribution` completa (`photographer`,
      `sourceUrl`, `license`, `provider`).
- [ ] **[Unsplash]** el download trigger se pega en cada import (verificable por log/test).
- [ ] Attribution se renderiza visible en la web pública (event/post detail) con link al autor.
- [ ] Gallery cap respeta el límite por entidad (`event:10`, `post:15`).
- [ ] Rate-limit (429) → mensaje claro, no rompe; el usuario cambia de tab.
- [ ] i18n completo (es/en/pt).
- [ ] API keys nunca expuestas al cliente (todo vía proxy).
- [ ] Todas las llamadas externas usan `safeExternalFetch` (no `fetch()` crudo).

### 10. Risks

| Risk | Mitigation |
|---|---|
| Olvidar el download trigger de Unsplash (violación TOS) | Test que verifica que el import a Unsplash pega `downloadLocation`. Documentado en `4.1` y `6.3`. |
| Attribution se dropea en PATCH (R2) | T-274-02 agrega `attribution` a `BaseMediaObjectSchema` + test de round-trip create/update. |
| Quemar quota de API (50/hr demo Unsplash) | Stateless v1 acepta el riesgo; mitiga con per-page chico (ej 24) y debounce en el input. Cache → follow-up. |
| API key leak | Server-side proxy, `secret: true` en registry, nunca client-side. |
| Cambio/deprecación de API del provider | Normalización en `StockImageResult` aísla el shape; swap de provider es local al mapper. |
| Imagen importada cuenta mal contra el cap | Reusar el check del admin upload route (R10), no reimplementar. |

---

## Part 2 — Implementation Notes

### Source

Owner question (2026-06-23): "busqueda de imagenes e importacion para eventos y posts".
Refinado 2026-06-23 con recon de código real + 4 decisiones de owner (ver banner).

### Reference (verificado en recon)

- Media schema: `packages/schemas/src/common/media.schema.ts` — `ImageAttributionSchema`
  (`:12-27`, shape real `photographer/sourceUrl/license`), `BaseMediaObjectSchema`
  (`:130-193`, le falta attribution).
- Cloudinary: `packages/media/src/server/cloudinary.provider.ts:232-266`
  (`upload({file:Buffer})` — sin upload-from-URL).
- Patrón fetch→buffer→upload: `packages/service-core/src/services/social/social-image-pipeline.service.ts:141-372`.
- SSRF fetch: `@repo/utils/safe-fetch` (`safeExternalFetch`), usado en
  `accommodation-import.service.ts`.
- Permisos: `packages/schemas/src/enums/permission.enum.ts:784-785` (`MEDIA_UPLOAD`/`MEDIA_DELETE`; no hay `MEDIA_MANAGE`).
- Admin fields: `apps/admin/src/components/entity-form/fields/ImageField.tsx` (Dialog/lightbox `:357-401` como patrón de modal), `GalleryField.tsx`.
- Gallery caps: `packages/schemas/src/common/media-upload.schema.ts:32-39`.
- Env registry pattern: `packages/config/src/env-registry.hospeda.ts` (`HOSPEDA_APIFY_TOKEN` `:1512-1530` como molde).
- Cache pattern (referencia, NO se usa en v1): `packages/service-core/src/services/exchange-rate/exchange-rate-fetcher.ts`.

### Cross-spec dependencies

- SPEC-273 (AI image enhancement) — complementario: import stock → enhance.
- SPEC-208 (web accommodation editor) — accommodations NO tienen stock search (fotos reales).
- SPEC-187 (rich text entity descriptions) — posts/events editors donde se integra.
- **Follow-up web-host** (no allocado): replicar el flujo en el editor host de web cuando
  existan editores host de events/posts.

---

## Model Fit Verdict

**BÁSICO.** Con las 4 decisiones tomadas, el trabajo es mecánico y tiene patrón de
referencia para cada pieza no trivial:

- El **import** (la parte más sutil) reusa 1:1 `SocialImagePipelineService` (fetch URL →
  buffer → `CloudinaryProvider.upload`). No hay método nuevo en el provider ni
  "upload-from-URL" que inventar.
- El **search proxy** es un fetch + mapeo a un shape común; lo único provider-específico
  es el mapper, todo lo demás es compartido.
- El **modal admin** se espeja del `Dialog`/lightbox que ya existe en `ImageField`.
- El **schema change** es jsonb → sin migración, solo zod + tests.
- **Sin cache, sin auto-fallback, sin web-host** → se elimina toda la superficie potente
  (tabla+TTL, detección de rate-limit cross-provider, editores host inexistentes).

**Dos guardarraíles que el implementador NO puede saltear** (están como AC + test):
(1) el **download trigger de Unsplash** es un requisito TOS duro, no opcional;
(2) `attribution` debe agregarse a `BaseMediaObjectSchema` o se dropea en cada PATCH (R2).
Ambos están documentados con su archivo:línea. Criterios de aceptación cerrados y
testeables. Sin decisiones abiertas.
