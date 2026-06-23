---
spec-id: SPEC-274
title: Image search & import (Unsplash/Pexels) for events and posts
type: feature
complexity: medium
status: draft
created: 2026-06-23T00:00:00Z
effort_estimate_hours: 12-20
tags: [images, media, search, import, unsplash, pexels, stock, events, posts, admin, editor]
---

# SPEC-274: Image search & import

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Integrar búsqueda de imágenes stock (Unsplash/Pexels) dentro del admin y web editor para que editors/hosts puedan buscar e importar imágenes para events, posts, y otras entidades sin salir del editor. Las imágenes se importan a Cloudinary con attribution correcta.

**Why now:** Muchos events/posts no tienen imágenes propias. Los editors actualmente buscan imágenes en Google o Unsplash manualmente, las descargan, y las suben. Integrar la búsqueda en el editor ahorra tiempo y asegura attribution correcta (requerimiento legal de Unsplash/Pexels API).

**Target users:** Editors (admin panel) y hosts (web editor — solo para sus entities).

### 2. Out of Scope

- AI image generation (text-to-image) — fuera de scope, diferente feature
- Image editing/crop (→ SPEC-273)
- Video search/import
- Búsqueda para accommodations/destinations — estas necesitan fotos reales, no stock
- Self-service para usuarios no autenticados

### 3. User Flow

#### 3.1 Admin editor — Search & import

1. Editor está creando/editando un event o post
2. En el campo "Imagen destacada" o "Galería", click "Buscar imágenes"
3. Se abre un modal/panel con búsqueda:
   - Input de texto (query: "concert", "beach sunset", "food festival")
   - Filtros: orientation (landscape/portrait/square), color
   - Grid de resultados ( thumbnails)
4. Click en una imagen → preview grande + attribution + botón "Importar"
5. "Importar" → imagen se sube a Cloudinary con attribution metadata
6. Imagen queda seleccionada como featured image o agregada a gallery

#### 3.2 Web (host) — Search & import (limited)

Mismo flujo pero solo para entities que el host own (ej: events que el host crea). No disponible para accommodations (necesitan fotos reales).

### 4. Providers

#### 4.1 Unsplash

- **API:** <https://unsplash.com/documentation>
- **Auth:** API key (client ID), rate limit 50 requests/hour (demo), 5000/hour (approved production)
- **Attribution:** Required — "Photo by [Photographer] on Unsplash"
- **License:** Free, commercial use allowed
- **Endpoints:** `GET /search/photos` (query, per_page, orientation, color)

#### 4.2 Pexels

- **API:** <https://www.pexels.com/api/>
- **Auth:** API key, rate limit 200 requests/hour
- **Attribution:** Required — "Photo by [Photographer] on Pexels"
- **License:** Free, commercial use allowed
- **Endpoints:** `GET /v1/search` (query, per_page, orientation, color)

#### 4.3 Strategy

- **Primary:** Unsplash (mayor catálogo, mejor calidad)
- **Fallback:** Pexels (si Unsplash rate-limited o sin resultados)
- **Selection:** User puede elegir provider (tab Unsplash / Pexels)
- **Rate limit handling:** Cache de búsquedas (redis o in-memory), fallback automático

### 5. Attribution & Legal

- Unsplash/Pexels requieren attribution del photographer
- Attribution se guarda en `ImageSchema.attribution` (campo ya existe en schema)
- Attribution se renderiza en web (alt text o caption visible)
- Attribution incluye: photographer name, provider, URL del original

```ts
attribution: {
    photographerName: "John Doe",
    photographerUrl: "https://unsplash.com/@johndoe",
    provider: "unsplash" | "pexels",
    originalUrl: "https://unsplash.com/photos/abc123",
    license: "Unsplash License" | "Pexels License"
}
```

### 6. Technical Approach

#### 6.1 Backend proxy

Los endpoints de búsqueda van via API (no client-side directo) para:

- Esconder API keys
- Rate limit handling + caching
- Normalizar response format (Unsplash y Pexels tienen shapes diferentes)
- Logging/auditing

#### 6.2 Import flow

1. User selecciona imagen → API recibe URL original + attribution
2. API descarga imagen desde Unsplash/Pexels
3. API sube a Cloudinary (mismo flujo que upload-entity)
4. Attribution se guarda en `ImageSchema.attribution`
5. Imagen queda en Cloudinary (CDN, transforms disponibles)

### 7. Data Model

No nueva tabla. Usa `ImageSchema.attribution` existente:

```ts
// packages/schemas/src/common/media.schema.ts — ImageAttributionSchema ya existe
export const ImageAttributionSchema = z.object({
    photographerName: z.string().optional(),
    photographerUrl: z.string().url().optional(),
    source: z.string().optional(), // "unsplash" | "pexels" | "user-upload"
    sourceUrl: z.string().url().optional(),
    license: z.string().optional()
});
```

Verificar si necesita extender o si los campos actuales son suficientes.

### 8. API Routes

| Route | Tier | Auth | Descripción |
|-------|------|------|-------------|
| `GET /api/v1/protected/media/search` | Protected | User | Buscar imágenes (query, provider, orientation) |
| `GET /api/v1/admin/media/search` | Admin | MEDIA_MANAGE | Buscar imágenes (admin) |
| `POST /api/v1/protected/media/import-stock` | Protected | User | Importar imagen stock a Cloudinary |
| `POST /api/v1/admin/media/import-stock` | Admin | MEDIA_MANAGE | Importar (admin) |

### 9. Entitlements

- Búsqueda: disponible para todos los usuarios autenticados (no requiere AI quota)
- Import: cuenta como upload normal (respeta gallery cap por entidad)
- No es un AI feature — es integración con APIs externas

### 10. Tasks

| Task | Title | Status |
|---|---|---|
| T-274-01 | Config: Unsplash + Pexels API keys en env registry | pending |
| T-274-02 | Service: ImageSearchService (proxy + normalize + cache) | pending |
| T-274-03 | Service: ImageImportService (download + upload to Cloudinary) | pending |
| T-274-04 | API: search + import-stock endpoints (protected + admin) | pending |
| T-274-05 | Schema: verificar/extender ImageAttributionSchema | pending |
| T-274-06 | Admin: ImageSearchModal component | pending |
| T-274-07 | Admin: integrar en ImageField (featured + gallery) | pending |
| T-274-08 | Web: ImageSearchModal component (host) | pending |
| T-274-09 | Web: integrar en event/post editor | pending |
| T-274-10 | Web: attribution render (alt text / caption) | pending |
| T-274-11 | i18n: strings es/en/pt | pending |
| T-274-12 | Tests: service + API + components | pending |

### 11. Acceptance Criteria

- [ ] Editor puede buscar imágenes por texto en el admin
- [ ] Resultados muestran thumbnail + photographer + provider
- [ ] Filtros de orientation funcionan
- [ ] Import sube imagen a Cloudinary con attribution correcta
- [ ] Attribution se renderiza en web (visible o en alt text)
- [ ] Rate limiting: fallback automático Unsplash → Pexels
- [ ] Gallery cap respeta el límite por entidad
- [ ] i18n completo
- [ ] API keys nunca expuestas al cliente

### 12. Risks

| Risk | Mitigation |
|---|---|
| Unsplash/Pexels API changes o deprecation | Abstracción con interface, fácil de swapear provider |
| Rate limit exceeded | Cache de búsquedas (TTL 1h), fallback provider |
| Attribution olvidada / no renderizada | CI check: imágenes con `source: 'unsplash'/'pexels'` DEBEN tener attribution |
| Calidad variable de stock images | Preview grande antes de importar, filtro de orientation |
| API key leaks | Server-side proxy, nunca client-side calls |

---

## Part 2 — Implementation Notes

### Source

Owner question (2026-06-23): "busqueda de imagenes e importacion para eventos y posts"

### Reference

- Media schemas: `packages/schemas/src/common/media.schema.ts` — `ImageAttributionSchema` ya existe
- Media upload: `apps/api/src/routes/media/` — pattern de upload a Cloudinary
- Cloudinary provider: `packages/media/src/server/` — `CloudinaryProvider`
- Entity editors: admin ImageField component, web host editor (SPEC-208)
- Env registry: `packages/config/src/env-registry.hospeda.ts` — pattern para nuevas API keys

### Cross-spec dependencies

- SPEC-273 (AI image enhancement) — complementario: import stock image → enhance
- SPEC-208 (web accommodation editor) — pero accommodations NO tienen stock search (fotos reales)
- SPEC-187 (rich text entity descriptions) — posts/events editors donde se integra
