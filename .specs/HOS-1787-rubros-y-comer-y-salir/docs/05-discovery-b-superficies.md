---
title: Discovery B — editor, superficies y enganches en packages/verticals
linear: HOS-1787
statusSource: linear
created: 2026-10-25
base: origin/staging @ 2ebee74d0a
---

# 05-B · Discovery: editor, superficies y `packages/verticals`

Relevamiento read-only sobre `origin/staging` (HEAD `2ebee74d0a`), hecho por subagente con `rg`/Read
(sin codegraph, que indexa un checkout viejo). Rutas relativas a la raíz del repo.

## 1. Editor del dueño (`apps/web/src/lib/editor/`)

- `editor-registry.ts` es agnóstico: `EditorSection = {id, slug, group, labelKey, visibilityKey?}`.
  `visibilityKey` falla cerrado y tiene un solo uso (traducciones de alojamiento).
- **Las secciones propias de una vertical están AUSENTES, no ocultas**: un slug desconocido manda
  al hub (`resolve-listing-editor-page.ts`). Eso ya es el estado `AUSENTE` de DEC-FAC-009.
- Selección **binaria**: `listing-editor-registry.ts` hace
  `vertical === 'experience' ? buildExperienceEditorSections() : buildGastronomyEditorSections()`.
- Secciones:

| vertical | id : slug |
|---|---|
| compartidas gastro+exp (`LISTING_SHARED_EDITOR_SECTIONS`) | basicInfo:datos, openingHours:horarios, price:precio, amenities:servicios, media:fotos, contact:contacto, faqs:preguntas, translations:traducciones |
| gastronomía | menu:carta, dailySpecials:menu-del-dia, venueEvents:eventos |
| experiencia | meetingPoint:punto-de-encuentro, practicalInfo:datos-practicos |
| alojamiento (registro propio) | basicInfo, capacityPricing, location, amenities, photos, faqs, contact, seo, calendar, translations, externalReputation |

- Páginas Astro en `apps/web/src/pages/[lang]/mi-cuenta/comercio/[vertical]/[id]/editar/` (una por
  slug, cada una con el slug hard-codeado). `ListingEditor.client.tsx` ~880/897 hace
  `sectionId === 'meetingPoint' && vertical === 'experience'`.
- **El upsell hoy no existe como estado**: el editor no lee entitlements; los managers
  (`GastronomyDailySpecialsManager`, `GastronomyMenuManager`, `GastronomyVenueEventsManager`) muestran
  el formulario a todos y recién ante un 403 del PUT ponen `setIsLocked(true)` con la frase de
  upsell. `BLOQUEADA` de DEC-FAC-009 es nuevo.
- La maquinaria para leer el conjunto efectivo existe y no se usa en estas secciones:
  `apps/web/src/lib/entitlements-cache.ts` → `GET /api/v1/protected/users/me/effective-set?vertical=`.

**Ramas por vertical a reemplazar (web)**: `listing-editor-registry.ts:34,50`,
`resolve-listing-editor-page.ts:100`, `listing-editor-hub-status-model.ts:148`,
`ListingEditor.client.tsx:146,374,502,880,897`, `PriceSection.client.tsx:65`,
`BasicInfoSection.client.tsx:87,229`, `ListingCreateForm.client.tsx` (varias), `ListingFaqManager.client.tsx:181`,
`endpoints-protected.ts:5056`, `owner-listings.ts:91,202`, `mi-cuenta/comercio/index.astro:200`, el
tipo `GastronomyOrExperience`.

## 2. Ficha pública

- **Gastronomía** (`gastronomia/[slug].astro`, 547 líneas, + `[slug]/carta.astro`): componentes en
  orden fijo; deciden sólo por presencia de datos. El filtrado por entitlement lo hace la API
  (`apps/api/src/routes/gastronomy/public/getBySlug.ts`): `readEffectiveKeys` del **dueño** con 5
  claves y tres proyecciones (`menu-projection.ts`, `events-projection.ts`,
  `daily-specials-projection.ts`). Resultado: «el dueño no lo pagó» y «nunca lo cargó» son
  indistinguibles en la página pública.
- **Experiencia**: `getBySlug.ts` tiene `ownerGrantsDirections: false` hard-codeado (HOS-1049), no lee
  `manage_experience_directions`. Inconsistencia previa.
- **Alojamiento**: gating server-side en `apps/api/src/utils/entitlement-filter.ts`
  (`resolvePublicFieldGrants`).
- Las respuestas públicas son **compartidas y cacheadas en el borde** (`buildEntityCacheTags`,
  `applyCacheHeaders`): nada puede depender del visitante. Un cambio de plan o de rubro del dueño
  tiene que purgar.

**Precedente de colección por ruta**: `alojamientos/tipo/[type]/` (+ `page/[page].astro`), slug
español vía `lib/facet-slugs.ts` (`ACCOMMODATION_TYPE_SLUG_BY_ENUM`, 404 si no existe, 301 del slug
inglés en middleware), JSON-LD `CollectionPage`+`ItemList`+`BreadcrumbList`, cache class `catalog` con
tag de colección. Configuración en `lib/filters/facet-config.ts` (`FACET_CONFIG_BY_ID`, `FacetId`),
`lib/seo/promoted-facet-canonical.ts`, `lib/filters/facet-crawl-policy.ts`,
`lib/filters/canonical-facet-order.ts`; sitemap en `src/pages/sitemap-dynamic.xml.ts`
(`buildEntriesForStaticSlugs`), hreflang en `lib/seo/sitemap-xml.ts` y `components/seo/SEOHead.astro`.
**Ojo de nombres**: el web ya usa la palabra *facet* para «faceta de filtro» (`FacetId`,
`facet-config.ts`, `facet-slugs.ts`). Gastronomía y experiencia hoy filtran sólo por `?type=`, sin
landing, sin sitemap y sin mapa de slugs; `GASTRONOMY_TYPES` está inline en `gastronomia/index.astro:177`.

## 3. Autorización de escrituras del dueño (API)

- Declarativa por ruta: `listingAccess` en `createProtectedRoute`, aplicada por
  `apps/api/src/middlewares/listing-access.ts` (`ListingAccessConfig` en
  `apps/api/src/types/authorization.ts`) con `capabilities?: string[] | ({body}) => string[]`.
- Ejemplos: `putDailySpecials` → `['manage_gastronomy_daily_special']`; `putEvents` →
  `['manage_gastronomy_events']`; `putMenu` → `manage_gastronomy_menu` + gates de cuerpo
  (`menu-item-photo-gate.ts`, `menu-translations-gate.ts`); `uploadMenuFile`/`deleteMenuFile`;
  experiencia `patch.ts` con función sobre el body.
- Las lecturas no se gatean a propósito («construir» ≠ «mirar»).
- `NO_CAPABILITY` → `ServiceError(ENTITLEMENT_REQUIRED, …, {entitlementKey})` → 403 → upsell en la web.
- Guards vecinos: `apps/api/test/routes/coverage-step-coverage.guard.test.ts`,
  `content-edit-gate-coverage.guard.test.ts`, `listing-content-call.guard.test.ts`,
  `scripts/check-vertical-context.ts`.

## 4. `packages/verticals`

**Cadena de autorización** (`src/authorization/resolve-listing-access.ts`): precondición de
vertical del recurso → paso 1 (sin actor) → paso 3 (acción administrativa ACC_15/ACC_23) → paso 4
(`resource-step.ts`: dueño/ajeno + estado de publicación) → paso 5 (cobertura) → paso 6 (clave de la
operación + `requiredKeys` de la ruta, en AND, por `entitlement-step.ts`) → paso 7 (límite).
Resultado `{allowed:true, subjectId, evaluatedSteps} | {allowed:false, reason, key?…}`.
`listing-facts.ts` devuelve sólo `{ownerId, publicationStatus}`; `evaluatedSteps` está tipado
`(3|4|5|6|7)[]`; `scripts/check-step5-declared.ts` fija las listas de operaciones; puertos en
`apps/api/src/utils/listing-access/ports.ts` (`billing`, `effectiveSet`, `preTrialDraftLimits`,
`loadFacts`).

**Enganches posibles** para el rubro: (a) un paso nuevo entre 4 y 6, o (b) dentro del loop de
`requiredKeys`. Cualquiera de los dos pide extender los hechos (`loadFacts`) con los rubros y
enseñarles el paso a `evaluatedSteps` y a los guards de pasos.

**Conjunto efectivo** (`src/effective-set/resolve-effective-set.ts`): por `user + vertical`, nunca
por ficha ni por rubro; cache Redis en `src/effective-set-cache/`; endpoint
`apps/api/src/routes/user/protected/effective-set.ts`. Las páginas públicas leen las claves del dueño
con `readEffectiveKeys` (`apps/api/src/utils/listing-access/user-gate.ts`), fail-closed.

**Catálogo de claves**: `packages/schemas/src/catalog/` (`entitlement-keys.ts` con
`[key, scope, aggregation, enforcement, class]`, `key-catalog.ts`, `key-attributes.ts`,
`key-enums.ts`); espejo en base `packages/db/src/schemas/vertical/catalog-key.dbschema.ts`; valores por
plan en la base y en `scripts/production-catalog/catalog.ts`, cargados por la migración
`0144_production_plan_catalog.sql`. Claves relevantes: `manage_gastronomy_menu`, `menu_item_photos`,
`manage_gastronomy_daily_special`, `manage_gastronomy_events`, `multilingual_gastronomy_menu`,
`menu_qr_scan_metrics`, `manage_experience_directions`, `issue_experience_certificate`,
`manage_experience_private_galleries`.

## 5. Tipos descriptivos

- TS en `packages/schemas/src/enums/` (Gastronomy 9, Experience 14, Accommodation 13 valores);
  Postgres en `packages/db/src/schemas/enums.dbschema.ts` (`gastronomy_type_enum`, creado en
  `0017_acoustic_dust.sql`). Columna `type` NOT NULL de un solo valor.
- Agregar un valor: miembro en el `.enum.ts` → `ALTER TYPE … ADD VALUE` en migración (precedentes
  `0005`, `0009`) → los `Record<Enum, …>` exhaustivos (íconos, labels, slugs) no compilan hasta
  completarse → claves i18n (`gastronomy.types.*`) vigiladas por `check:i18n-keys`.
- No hay guard código ↔ base para estos enums más allá de
  `packages/db/test/schemas/enums.dbschema.test.ts`.

## 6. Admin

- `apps/admin/src/routes/_authed/gastronomies/{index,new,$id,$id_.edit,$id_.seo,$id_.gallery}.tsx`
  (ídem `experiences/`). Campos en `features/gastronomy/config/gastronomy-consolidated.config.ts` +
  `features/listing/config/listingSections.ts`.
- **El admin no tiene UI de carta, menú del día ni eventos.** Moderación compartida
  (`ListingModerationCard`, acciones REQUEST_FIX/TAKE_DOWN/LIFT/CLOSE_FIX_REQUEST), fijada por
  `apps/admin/test/listing-moderation-control.guard.test.ts`.

## 7. Patrón de espejo (plantilla para el espejo de rubros)

- Enum `packages/schemas/src/enums/vertical.enum.ts` (`VerticalEnum`) → tabla
  `packages/db/src/schemas/vertical/vertical.dbschema.ts` (`id varchar(32)` PK, CHECK sobre
  `quotedList(enum)`, sin auditoría ni soft delete) → filas generadas por
  `scripts/generate-catalog-sql.ts` (`buildLoads`/`LOAD_NAMES`) y commiteadas en migraciones
  versionadas → **GUARD:G18** `scripts/check-catalog-sql.ts` (paso propio de CI) compara filas
  acumuladas vs. generador y falla con UPDATE/DELETE/ON CONFLICT. Test positivo en
  `scripts/__tests__/check-catalog-sql.test.ts`.
- **G1(a)** `check-vertical-axis-items.ts`: cada `VerticalEnum` tiene su evento de activación.
- **G1(b)** (mismo script): prohíbe `x === 'gastronomy'|'experience' ? A : B` en `apps/api/src` y
  `packages/*/src`, con `DISPATCH_LITERALS = ['gastronomy','experience']`. **Exime `apps/web` y
  `apps/admin`** (owner, 2026-10-07) y no ve cadenas de `if` ni lookups con default. La mayor parte de
  la ramificación a eliminar vive justo en las dos apps eximidas.

## 8. Infraestructura de guards

- `scripts/check-*.{sh,ts}` (tests en `scripts/__tests__/`), inventarios JSON en `scripts/guards/`,
  `*.guard.test.ts` en `apps/*/test`.
- Registro: script `check:<name>` en el `package.json` raíz, en la cadena `check:guards`, **y un paso
  propio en `.github/workflows/ci.yml`** (estar en `check:guards` no lo hace correr en CI).
- Diseño habitual: piso mínimo de archivos escaneados (escaneo vacío = rojo), `run({root,…})` con
  árbol inyectado para control positivo, sección «lo que NO verifica».
- Precedentes de «sólo un módulo puede leer X»: `check-cloudinary-isolation.sh`,
  `check-sdk-outside-adapter.ts` (G12), `check-listing-clock.ts` + inventario (G-R6-B),
  `check-billing-verticals-boundary.ts` (G14), `check-listing-old-columns.ts`,
  `check-role-never-decides.ts`.

## 9. Subrecursos de gastronomía

| schema (`packages/schemas/src/entities/gastronomy/subtypes/`) | tabla |
|---|---|
| `gastronomy.menu.schema.ts` | `gastronomy_menu_sections`, `gastronomy_menu_items` |
| `gastronomy.daily-special.schema.ts` | `gastronomy_daily_specials` |
| `gastronomy.event.schema.ts` | `gastronomy_events` |
| `gastronomy.faq.schema.ts` | `gastronomy_faqs` |
| `gastronomy.media.schema.ts` | `gastronomy_media` |
| `gastronomy.review.schema.ts` | `gastronomy_reviews` |

Más `r_gastronomy_amenity`, `r_gastronomy_feature`. Servicios en
`packages/service-core/src/services/gastronomy/gastronomy.{menu,daily-specials,events,faq,media}.ts`.

## Hard-coding por vertical o por capacidad (lo que el mecanismo reemplaza)

1. Listas de secciones del editor por vertical y selección binaria.
2. Claves de capacidad como literales en `listingAccess.capabilities` de cada ruta.
3. Gating público hard-codeado en `gastronomy/public/getBySlug.ts` (5 claves, 3 proyecciones),
   `experience/public/getBySlug.ts` (`false` literal) y `utils/entitlement-filter.ts`.
4. Orden y presencia de componentes fijos en las páginas públicas.
5. `OPERATION_STEP6_KEY` por vertical.
6. Listas de tipos y labels por vertical en la web.
7. `PRE_TRIAL_DRAFT_LIMIT_KEYS_BY_VERTICAL`, `LIMIT_KEY_BY_VERTICAL` (`apps/web/src/lib/listing/vertical-usage.ts`).
8. `apps/api/src/routes/ai/protected/chat.ts:112-113` (mapa vertical → claves).

## Lo que esto cambia en el diseño (insumo para los sub-specs)

- `AUSENTE` ya existe (slug desconocido → hub); `BLOQUEADA` es nuevo en el editor y no existe en la
  ficha pública, donde lo bloqueado hoy se proyecta como ausente.
- El resolvedor necesita dos fuentes: rubros de la ficha (dato por ficha) y conjunto efectivo del
  dueño (por `user + vertical`). En lo público, por el dueño, nunca por el visitante, y con purga de
  cache al cambiar plan o rubro.
- Choque de nombre: *facet* ya significa «faceta de filtro» en el web. A revisar en la vuelta 1.
- G1(b) es el guard natural para extender (o reemplazar) al web y al admin.
