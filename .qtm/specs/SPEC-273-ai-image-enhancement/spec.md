---
spec-id: SPEC-273
title: AI image enhancement + manual editing (crop, rotate, filters) for all entity images
type: feature
complexity: high
status: draft
created: 2026-06-23T00:00:00Z
effort_estimate_hours: 32-48
tags: [ai, images, media, cloudinary, editing, crop, rotate, enhancement, admin, web, host]
---

# SPEC-273: AI image enhancement + manual editing

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Proveer herramientas de mejora de imágenes para todas las entidades (accommodations, events, posts, destinations, gastronomy, experiences): (a) enhancement automático por IA (brightness, contrast, color correction, noise reduction) y (b) edición manual (crop, rotate, flip, filters) integrado con Cloudinary.

**Why now:** La calidad de imágenes impacta conversión y perception de la plataforma. Muchos hosts/editores suben fotos de baja calidad. Cloudinary ya tiene transforms nativos (crop, rotate, filters) que se pueden usar sin costos adicionales. AI enhancement agrega valor diferencial.

**Target users:** Hosts (web) y Editors/Admins (admin panel).

### 2. Out of Scope

- Búsqueda/importación de imágenes stock (→ SPEC separada)
- Video editing
- Background removal advanced (separate feature)
- Batch processing automatizado (MVP es per-image, on-demand)
- Mobile app editing (SPEC-243)

### 3. Two Enhancement Tracks

#### 3.1 AI Enhancement (automático)

| Feature | Descripción | Implementación |
|---------|-------------|----------------|
| Auto-brightness | Ajusta brillo automáticamente | Cloudinary `e_auto_brightness` o AI API |
| Auto-contrast | Ajusta contraste | Cloudinary `e_auto_contrast` |
| Color enhancement | Satura colores naturalmente | Cloudinary `e_auto_color` o `e_saturation:auto` |
| Noise reduction | Reduce ruido de imagen | Cloudinary `e_reduce_noise` |
| Sharpen | Realza detalles | Cloudinary `e_sharpen` |
| Auto-orient | Corrige orientación EXIF | Cloudinary `a_auto_right` |
| Upscale (AI) | Aumenta resolución con IA | Cloudinary `e_enhance` o AI upscale API |

**Approach:** Usar Cloudinary transforms nativos primero (gratis, instantáneo). Para upscale/restore avanzado, evaluar Cloudinary AI add-on o @repo/ai-core con un vision model.

#### 3.2 Manual Editing (interactivo)

| Feature | Descripción | Implementación |
|---------|-------------|----------------|
| Crop | Recortar con aspect ratio libre o preset | Cloudinary `c_crop` o client-side cropper |
| Rotate | Rotar 90°/180°/270° | Cloudinary `a_90` / `a_180` / `a_270` |
| Flip | Espejar horizontal/vertical | Cloudinary `a_hflip` / `a_vflip` |
| Filters | B&W, sepia, vintage | Cloudinary `e_grayscale` / `e_sepia` |
| Brightness/contrast | Sliders manuales | Cloudinary `e_brightness:X` / `e_contrast:X` |
| Saturation | Slider | Cloudinary `e_saturation:X` |
| Reset | Volver a original | Re-fetch original URL |

**Approach:** Client-side image editor (react-image-crop o Cropper.js) para crop preview, luego aplicar transforms via Cloudinary URL params o explicit upload.

### 4. User Flow

#### 4.1 Web (host) — Image editor

1. Host sube o selecciona imagen en accommodation editor
2. Click "Mejorar" → panel de edición
3. **AI auto-enhance:** botón "Mejorar automáticamente" → preview before/after
4. **Manual:** tabs (Crop, Rotate, Filters, Adjust)
   - Crop: drag to select area, aspect ratio presets (16:9, 4:3, 1:1, free)
   - Rotate: buttons 90° left/right
   - Filters: presets (B&W, sepia, vintage, none)
   - Adjust: sliders (brightness, contrast, saturation)
5. "Aplicar" → guarda la versión editada en Cloudinary
6. "Cancelar" → descarta cambios
7. "Reset" → vuelve a la imagen original

#### 4.2 Admin — Image editor

Mismo flujo, accesible desde cualquier entidad (accommodation, event, post, destination, gastronomy, experience).

### 5. Technical Approach

#### 5.1 Cloudinary Transforms (primary)

Cloudinary supports URL-based transforms sin re-upload:

```
https://res.cloudinary.com/hospeda/image/upload/e_auto_brightness,e_auto_contrast,e_saturation:auto/v1/hospeda/prod/accommodations/abc/featured.jpg
```

**Pros:** Instantáneo, no re-upload, gratis (incluido en plan).
**Contras:** Transform es on-the-fly (no persiste). Para persistir, usar `explicit` API.

#### 5.2 Persist edited version

Opción A: Re-upload con transforms aplicados (genera nuevo asset en Cloudinary)
Opción B: Cloudinary `explicit` API para generar una derived version
Opción C: Guardar transform params en DB y aplicar on-the-fly (cada request)

**Recomendado:** Opción A (re-upload) — simplicidad, el edited reemplaza el original.

#### 5.3 Client-side editor

- **Crop:** `react-easy-crop` o `react-image-crop` (ligero, touch-friendly)
- **Preview:** Apply transforms as CSS filters for preview, then upload final
- **Mobile:** Touch gestures (pinch zoom, drag) en cropper

#### 5.4 AI Enhancement (advanced)

- **V1:** Cloudinary auto-enhance transforms (gratis)
- **V2:** @repo/ai-core con vision model para:
  - Detectar y corregir lighting issues
  - Sugerir crop óptimo (subject detection)
  - Upscale de baja resolución
  - Remove artifacts

### 6. Data Model

#### 6.1 Image schema extension

`packages/schemas/src/common/media.schema.ts` — `ImageSchema`:

```ts
// Nuevos campos opcionales (additive):
editHistory: z.array(z.object({
    transform: z.string(), // Cloudinary transform string
    appliedAt: z.string().datetime(),
    appliedById: z.string().uuid(),
    type: z.enum(['ai_enhance', 'crop', 'rotate', 'filter', 'adjust'])
})).optional(),
originalUrl: z.string().url().optional(), // URL antes de edits
isEdited: z.boolean().optional()
```

No nueva tabla — campos van en el jsonb `media` existente.

### 7. API Routes

| Route | Tier | Auth | Descripción |
|-------|------|------|-------------|
| `POST /api/v1/protected/media/enhance` | Protected | Owner | AI auto-enhance — devuelve URL preview |
| `POST /api/v1/protected/media/apply-edit` | Protected | Owner | Aplicar edits y persistir |
| `POST /api/v1/protected/media/reset-edit` | Protected | Owner | Volver a original |
| `POST /api/v1/admin/media/enhance` | Admin | MEDIA_MANAGE | AI auto-enhance (admin) |
| `POST /api/v1/admin/media/apply-edit` | Admin | MEDIA_MANAGE | Aplicar edits (admin) |

### 8. Entitlements

- AI enhancement: usa el feature `ai_image_enhance` en @repo/ai-core
- Manual editing: gratis (Cloudinary transforms incluidos), no requiere entitlement
- Limits: AI enhancement tiene quota por plan (como otros AI features)

### 9. Tasks

| Task | Title | Status |
|---|---|---|
| T-273-01 | Schema: agregar `editHistory`, `originalUrl`, `isEdited` a ImageSchema | pending |
| T-273-02 | Service: MediaEnhanceService (Cloudinary transforms) | pending |
| T-273-03 | API: enhance + apply-edit + reset-edit endpoints | pending |
| T-273-04 | AI: integrar ai-core para V2 enhancement | pending |
| T-273-05 | Web: ImageEditor component (crop, rotate, filters, adjust) | pending |
| T-273-06 | Web: AI auto-enhance button + before/after preview | pending |
| T-273-07 | Web: integrar en accommodation editor (host) | pending |
| T-273-08 | Admin: ImageEditor component (mismo, para todas las entidades) | pending |
| T-273-09 | Admin: integrar en entity editors | pending |
| T-273-10 | i18n: strings es/en/pt | pending |
| T-273-11 | Tests: service + API + components | pending |
| T-273-12 | Entitlements: ai_image_enhance quota + gate | pending |

### 10. Acceptance Criteria

- [ ] Host puede hacer AI auto-enhance en cualquier imagen de su alojamiento
- [ ] Host puede crop, rotate, flip, aplicar filters y ajustar brightness/contrast/saturation
- [ ] Edits se persisten en Cloudinary (no solo on-the-fly)
- [ ] Host puede resetear a original
- [ ] Admin tiene las mismas herramientas para todas las entidades
- [ ] AI enhancement respeta quota por plan
- [ ] Mobile: crop funciona con touch gestures
- [ ] i18n completo
- [ ] Edit history visible (qué edits se aplicaron)

### 11. Risks

| Risk | Mitigation |
|---|---|
| Cloudinary transform limits (plan-dependent) | Verificar límites, usar explicit API para persistir |
| AI enhancement quality variable | Preview before/after, usuario decide aplicar |
| Edit history crece sin bound | Limitar a últimas 10 entries |
| Re-upload genera nuevo public_id | Mantener original public_id para reset |
| Performance: crop preview en mobile | Client-side con CSS transforms, no server round-trip para preview |

---

## Part 2 — Implementation Notes

### Source

Owner question (2026-06-23): "mejora de imagenes por IA + edicion manual (crop, rotate, etc) para todas las imagenes (alojamientos, eventos, posts, etc)"

### Reference

- Media package: `packages/media/` — Cloudinary provider, presets, URL helpers
- Media schemas: `packages/schemas/src/common/media.schema.ts`, `media-upload.schema.ts`
- Media routes: `apps/api/src/routes/media/` (admin + protected upload/delete)
- AI core: `@repo/ai-core` (SPEC-173) — pattern para AI features
- Cloudinary transforms: <https://cloudinary.com/documentation/transformation_reference>
- Entity editors: admin (apps/admin), web host (SPEC-208)

### Cross-spec dependencies

- SPEC-173 (AI core) — foundation para AI enhancement
- SPEC-208 (web accommodation editor) — donde se integra en web
- SPEC-211 (AI monetization) — quota/entitlements pattern
