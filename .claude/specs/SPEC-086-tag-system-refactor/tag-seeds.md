# Tag Seeds — Canonical Content

> **Status**: Approved (content lists provided by product, 2026-04-29)
> **Scope**: Source of truth for all tag seed content (INTERNAL, SYSTEM, POST_TAG) and example assignments
> **Related**: `spec.md` (sections R-2, R-3, R-4, E-3, Phase 10), `decisions.md` D-001, D-002, D-006, D-024

This document is the canonical source for tag seed content. Implementation tasks reference this doc instead of duplicating lists. If a tag is added or removed here, the seed JSON files and tasks must be updated to match.

---

## Audience and Visibility (Critical)

The user-tag system (INTERNAL + SYSTEM + USER) is **admin-panel-only**:

- **Admin panel** (`apps/admin`, accessed by HOST / EDITOR / ADMIN / SUPER_ADMIN roles): full tag UI — pickers, manager, moderation. This is where every tag interaction happens.
- **Web public** (`apps/web`, accessed by anonymous + USER role): **never** displays user-tags. Not on accommodation pages, not on event pages, not on posts. Regular guest users use the existing **bookmarks** feature for personal organization, not tags.

The PostTag system is **public**: PostTags appear on blog post pages and drive public URL filters in the web app. They are the only tag-like feature visible to anonymous and regular USER-role visitors.

This applies cross-cutting and is restated in `decisions.md` D-024.

---

## Conventions

- All `name` values are in **Spanish (es-AR)**, no i18n in v1 (D-015).
- The `slug` column is **only meaningful for POST_TAG** (drives public URLs). For INTERNAL and SYSTEM, the slug column is **dropped from DB** (D-002, D-018) — the slugs listed below are used only as **stable filenames** for seed JSONs (e.g., `internal-001-revisar-contenido.json`), not stored.
- All `appliesTo` lists are **descriptive, not enforced**. The DB does not gate which tag goes on which entity.
- All seeded tags use `lifecycleState: ACTIVE`, `createdById: SYSTEM_USER_ID`, `ownerId: NULL` (for INTERNAL/SYSTEM).

---

## INTERNAL Tags (25)

Operational labels for moderation, quality, support, and commercial control. **Visible only to admin/super-admin** in the admin panel. Never visible to HOST, EDITOR, or any web user.

| # | Nombre | Slug (file) | Applies to | Use case |
|---|---|---|---|---|
| 1 | Revisar contenido | `revisar-contenido` | ACCOMMODATION, DESTINATION, EVENT, POST, REVIEW | Content needs manual admin review |
| 2 | Datos incompletos | `datos-incompletos` | ACCOMMODATION, DESTINATION, EVENT, POST, USER | Important fields missing |
| 3 | Revisar SEO | `revisar-seo` | ACCOMMODATION, DESTINATION, EVENT, POST | Title / description / keywords missing or poor |
| 4 | Revisar imágenes | `revisar-imagenes` | ACCOMMODATION, DESTINATION, EVENT, POST | Bad, missing, repeated, or unrepresentative images |
| 5 | Revisar ubicación | `revisar-ubicacion` | ACCOMMODATION, DESTINATION, EVENT | Coordinates / city / address suspicious |
| 6 | Revisar contacto | `revisar-contacto` | ACCOMMODATION, EVENT, USER | Phone / email / WhatsApp / social links to validate |
| 7 | Pendiente de aprobación | `pendiente-aprobacion` | ACCOMMODATION, EVENT, POST | Created but not yet approved |
| 8 | Aprobado manualmente | `aprobado-manualmente` | ACCOMMODATION, EVENT, POST | Approved by admin review |
| 9 | Publicación bloqueada | `publicacion-bloqueada` | ACCOMMODATION, EVENT, POST, USER | Blocked from publishing temporarily |
| 10 | Posible duplicado | `posible-duplicado` | ACCOMMODATION, DESTINATION, EVENT, POST | Possibly duplicated entry |
| 11 | Contenido sospechoso | `contenido-sospechoso` | ACCOMMODATION, EVENT, POST, REVIEW, USER | Text / images / data look fake or problematic |
| 12 | Cliente prioritario | `cliente-prioritario` | USER, BILLING_SUBSCRIPTION | Commercial preferential treatment |
| 13 | Cliente nuevo | `cliente-nuevo` | USER | Recently onboarded account or owner |
| 14 | Cliente inactivo | `cliente-inactivo` | USER, BILLING_SUBSCRIPTION | No recent activity |
| 15 | Riesgo de baja | `riesgo-baja` | USER, BILLING_SUBSCRIPTION | Likely to leave platform |
| 16 | Pago pendiente | `pago-pendiente` | USER, BILLING_SUBSCRIPTION, PAYMENT | Outstanding debt / due / pending renewal |
| 17 | Beneficio manual | `beneficio-manual` | USER, BILLING_SUBSCRIPTION | Access / improvement granted manually by admin |
| 18 | Candidato destacado | `candidato-destacado` | ACCOMMODATION, DESTINATION, EVENT, POST | Candidate to be featured |
| 19 | Alta calidad | `alta-calidad` | ACCOMMODATION, DESTINATION, EVENT, POST | Very complete and well-presented |
| 20 | Baja calidad | `baja-calidad` | ACCOMMODATION, DESTINATION, EVENT, POST | Poor / incomplete / needs improvement |
| 21 | Importado | `importado` | ACCOMMODATION, DESTINATION, EVENT, POST, USER | Loaded via initial or external import |
| 22 | Seed inicial | `seed-inicial` | ACCOMMODATION, DESTINATION, EVENT, POST | Created by production seed |
| 23 | Requiere traducción | `requiere-traduccion` | ACCOMMODATION, DESTINATION, EVENT, POST | Pending i18n |
| 24 | Requiere actualización | `requiere-actualizacion` | ACCOMMODATION, DESTINATION, EVENT, POST | Information possibly outdated |
| 25 | Revisar legal | `revisar-legal` | ACCOMMODATION, EVENT, POST, USER | Text / permissions / image rights / sensitive data to review |

---

## SYSTEM Tags (30)

Generic platform tags any authenticated **admin panel user** (HOST / EDITOR / ADMIN / SUPER_ADMIN) can apply for personal organization within their workspace. Not visible in the public web.

Per-user attribution is preserved (D-007): user A applying "Favorito" to entity X creates A's own assignment; another admin applying "Favorito" to the same X creates a separate row.

| # | Nombre | Slug (file) | Applies to (typical) | Use case |
|---|---|---|---|---|
| 1 | Favorito | `favorito` | * (all) | Mark an important entity for the user |
| 2 | Importante | `importante` | * | Needs special attention |
| 3 | Revisar luego | `revisar-luego` | * | User wants to revisit later |
| 4 | Pendiente | `pendiente` | * | Still incomplete or unresolved |
| 5 | En progreso | `en-progreso` | * | User is currently working on it |
| 6 | Completado | `completado` | * | Already reviewed or finished |
| 7 | Archivado | `archivado` | * | User-archived without deleting |
| 8 | Borrador | `borrador` | ACCOMMODATION, EVENT, POST | Content not ready yet |
| 9 | Listo para publicar | `listo-para-publicar` | ACCOMMODATION, EVENT, POST | User considers it finished |
| 10 | Publicado | `publicado` | ACCOMMODATION, EVENT, POST | User-marked as published / active |
| 11 | Pausado | `pausado` | ACCOMMODATION, EVENT, POST | Temporarily stopped |
| 12 | Urgente | `urgente` | * | Requires fast action |
| 13 | Contactar | `contactar` | USER, ACCOMMODATION, EVENT | Needs to contact someone |
| 14 | Esperando respuesta | `esperando-respuesta` | USER, ACCOMMODATION, EVENT | Awaiting external response |
| 15 | Validar datos | `validar-datos` | * | User wants to confirm information |
| 16 | Actualizar información | `actualizar-informacion` | * | Data possibly outdated |
| 17 | Mejorar contenido | `mejorar-contenido` | ACCOMMODATION, DESTINATION, EVENT, POST | Text / images / data to improve |
| 18 | Agregar fotos | `agregar-fotos` | ACCOMMODATION, DESTINATION, EVENT, POST | Missing images / gallery |
| 19 | Mejorar fotos | `mejorar-fotos` | ACCOMMODATION, DESTINATION, EVENT, POST | Existing images low quality |
| 20 | Revisar precio | `revisar-precio` | ACCOMMODATION, EVENT | Price / fare / conditions to review |
| 21 | Revisar disponibilidad | `revisar-disponibilidad` | ACCOMMODATION, EVENT | Calendar / capacity / dates to review |
| 22 | Cliente activo | `cliente-activo` | USER | Customer with current activity |
| 23 | Cliente inactivo | `cliente-inactivo` | USER | Customer without recent movement |
| 24 | Cliente potencial | `cliente-potencial` | USER | Lead or possible commercial contact |
| 25 | Seguimiento comercial | `seguimiento-comercial` | USER, BILLING_SUBSCRIPTION | Sales / renewal follow-up needed |
| 26 | Alta prioridad | `alta-prioridad` | * | High user priority |
| 27 | Baja prioridad | `baja-prioridad` | * | Low priority |
| 28 | Para destacar | `para-destacar` | ACCOMMODATION, DESTINATION, EVENT, POST | Candidate to feature in user's panel |
| 29 | Temporal | `temporal` | * | Temporary mark, not definitive |
| 30 | Personalizado | `personalizado` | * | Free / general use when no other tag fits |

`*` = applies to any entityType the user works with (depends on role).

### Naming overlap with INTERNAL

Both lists contain `Cliente inactivo`. This is intentional and allowed — INTERNAL and SYSTEM live under partial unique indexes per type (D-018), so the same name across types is permitted. The INTERNAL `Cliente inactivo` is admin-flagged (visible only to admins). The SYSTEM `Cliente inactivo` is user-applied (each admin panel user marks their own customer view independently). Different scopes, both useful.

The cross-type name collision check only fires for **USER** tags colliding with INTERNAL or SYSTEM (D-002 invariant). USER tags never collide with INTERNAL/SYSTEM at runtime because users cannot create with reserved names.

---

## POST_TAG (34)

Public, SEO-driven thematic tags for blog posts. Coexist with post categories (which are separate, hierarchical, exclusive — these tags are flat, multi-applicable, thematic).

These appear in **public web URLs** like `/blog?tag=guia-de-viaje` and on blog post pages.

| # | Nombre | Slug | Use case |
|---|---|---|---|
| 1 | Guía de viaje | `guia-de-viaje` | Practical guide-style posts |
| 2 | Consejos para viajar | `consejos-para-viajar` | General travel tips |
| 3 | Qué hacer | `que-hacer` | Activity ideas |
| 4 | Dónde comer | `donde-comer` | Gastronomic recommendations |
| 5 | Alojamiento | `alojamiento` | Posts about lodging |
| 6 | Destinos | `destinos` | Posts about cities or localities |
| 7 | Eventos locales | `eventos-locales` | Festivals, fairs, activities |
| 8 | Cultura entrerriana | `cultura-entrerriana` | Traditions, history, regional identity |
| 9 | Naturaleza entrerriana | `naturaleza-entrerriana` | Landscapes, reserves, river, flora/fauna |
| 10 | Turismo termal | `turismo-termal` | Thermal baths and wellness |
| 11 | Turismo rural | `turismo-rural` | Countryside, ranches, rural experiences |
| 12 | Playas de río | `playas-de-rio` | Beaches, coasts, Uruguay/Paraná river |
| 13 | Escapadas | `escapadas` | Short trips |
| 14 | Fin de semana largo | `fin-de-semana-largo` | Long weekend / holiday content |
| 15 | Viajar en familia | `viajar-en-familia` | Family travel plans |
| 16 | Viajar en pareja | `viajar-en-pareja` | Romantic / couples trips |
| 17 | Viajar con mascotas | `viajar-con-mascotas` | Pet-friendly tips |
| 18 | Presupuesto bajo | `presupuesto-bajo` | Budget options |
| 19 | Experiencias premium | `experiencias-premium` | Higher-end content |
| 20 | Recomendaciones locales | `recomendaciones-locales` | Local-perspective content |
| 21 | Imperdibles | `imperdibles` | Featured places or plans |
| 22 | Temporada alta | `temporada-alta` | Summer / holidays / high demand |
| 23 | Temporada baja | `temporada-baja` | Off-season trips |
| 24 | Verano | `verano` | Seasonal — summer |
| 25 | Invierno | `invierno` | Seasonal — winter |
| 26 | Primavera | `primavera` | Seasonal — spring |
| 27 | Carnaval | `carnaval` | Carnival and popular festivals |
| 28 | Semana Santa | `semana-santa` | Easter Week content |
| 29 | Historia | `historia` | Heritage, historical events |
| 30 | Arquitectura | `arquitectura` | Buildings, historical centers, monuments |
| 31 | Fotografía | `fotografia` | Photogenic places |
| 32 | Itinerarios | `itinerarios` | Suggested routes |
| 33 | Mapa turístico | `mapa-turistico` | Geographic / route content |
| 34 | Novedades Hospeda | `novedades-hospeda` | Platform's own news |

### Reclassification of existing 43 JSONs

The 43 existing files in `packages/seed/src/data/tag/` (e.g., `gastronomia`, `naturaleza`, `termas`) are **obsolete**. The implementation deletes them and creates 34 new JSONs from this list. There is partial naming overlap (`historia`, `arquitectura`, `verano`, `invierno`, `fotografia`) but the new list is the source of truth — old files are dropped wholesale, new ones generated.

---

## Example Assignments (E-3)

These assignments are seeded only in dev/staging via the example seed manifest. They populate realistic data so the admin panel UI flows can be tested.

Test users referenced (from existing user fixtures): `host-test-user`, `editor-test-user`, `admin-test-user`. Super-admin test user does **not** receive example USER tags or assignments — they exercise moderation views, not personal organization (E-1 baseline).

### USER tag assignments by HOST role

The HOST test user owns 3 example accommodations (`acc-1`, `acc-2`, `acc-3`) per existing fixtures. Apply:

| Tag (SYSTEM) | Entity | `assignedById` |
|---|---|---|
| `Favorito` | acc-1 | host-test-user |
| `Favorito` | acc-2 | host-test-user |
| `Importante` | acc-1 | host-test-user |
| `Revisar luego` | acc-3 | host-test-user |
| `Mejorar fotos` | acc-2 | host-test-user |
| `Revisar precio` | acc-1 | host-test-user |
| `Cliente potencial` | (a USER entity, e.g., a recently registered guest) | host-test-user |

### USER tag assignments by EDITOR role

The EDITOR test user authors several example posts. Apply:

| Tag (SYSTEM) | Entity | `assignedById` |
|---|---|---|
| `Borrador` | post-draft-1 | editor-test-user |
| `Borrador` | post-draft-2 | editor-test-user |
| `Listo para publicar` | post-1 | editor-test-user |
| `Revisar luego` | post-2 | editor-test-user |
| `Pendiente` | post-3 | editor-test-user |
| `Mejorar contenido` | post-draft-1 | editor-test-user |

### USER tag assignments by ADMIN role

The ADMIN test user works across entities. Apply mostly INTERNAL since admin role can use them, plus some SYSTEM:

| Tag (type) | Entity | `assignedById` |
|---|---|---|
| `Pendiente de aprobación` (INTERNAL) | acc-3 | admin-test-user |
| `Datos incompletos` (INTERNAL) | dest-1 | admin-test-user |
| `Posible duplicado` (INTERNAL) | event-2 | admin-test-user |
| `Revisar imágenes` (INTERNAL) | post-3 | admin-test-user |
| `Cliente prioritario` (INTERNAL) | host-test-user (USER entity) | admin-test-user |
| `Importante` (SYSTEM) | acc-1 | admin-test-user |
| `Validar datos` (SYSTEM) | dest-2 | admin-test-user |

### PostTag assignments to test posts (E-2)

Each example blog post gets 2–4 PostTags chosen by content theme. Suggested mappings (implementation may adjust based on actual post fixtures):

| Post | PostTags |
|---|---|
| post-1 (gastronomic guide) | `guia-de-viaje`, `donde-comer`, `recomendaciones-locales` |
| post-2 (family trip plan) | `viajar-en-familia`, `escapadas`, `fin-de-semana-largo` |
| post-3 (thermal baths) | `turismo-termal`, `relax`, `cultura-entrerriana` |
| post-draft-1 (winter content) | `invierno`, `temporada-baja`, `escapadas` |
| post-draft-2 (carnival) | `carnaval`, `eventos-locales`, `cultura-entrerriana` |

PostTag assignments use the simple `r_post_post_tag` join (no per-user attribution — D-001).

---

## Implementation Notes

1. Seed file naming pattern under `packages/seed/src/data/tag/`:
   - `internal-001-revisar-contenido.json` … `internal-025-revisar-legal.json`
   - `system-001-favorito.json` … `system-030-personalizado.json`
2. Seed file naming pattern under `packages/seed/src/data/postTag/` (new directory):
   - `001-guia-de-viaje.json` … `034-novedades-hospeda.json`
3. Existing 43 files in `packages/seed/src/data/tag/*.json` are deleted as part of T-038.
4. Each seed JSON contains: `name`, `description` (single-sentence Spanish description from "Use case" column), `color` (palette aligned by implementer), `lifecycleState: "ACTIVE"`. INTERNAL/SYSTEM omit `slug`. POST_TAG includes `slug`.
5. All seeds idempotent: re-running creates no duplicates.
6. Color palette: aligned with design system at implementation time. The implementer chooses from `TagColorPgEnum` based on tag semantic (e.g., red for risk/blocker, green for verified, yellow for pending, blue for informational). Final color matrix is not part of this doc.

---

## Open Items

These are content / product items, not architectural — they can be resolved during seed implementation:

1. Final mapping of color values per tag (TagColorPgEnum).
2. Final mapping of icon values per tag (optional column, not required for v1).
3. Concrete entity IDs for E-3 assignments depend on test fixture IDs at runtime — implementation reads them from the existing user/accommodation/post fixtures and applies tags by name lookup.
