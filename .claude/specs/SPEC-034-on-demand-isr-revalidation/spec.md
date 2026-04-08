---
spec-id: SPEC-034
title: On-Demand ISR Revalidation System
type: feature
complexity: high
status: approved
created: 2026-03-06T12:00:00.000Z
updated: 2026-03-16T14:00:00.000Z
supersedes: SPEC-009
depends-on: []
---

# SPEC-034: On-Demand ISR Revalidation System

## 1. Overview

System for on-demand cache invalidation of ISR-cached pages in the Astro web app (`apps/web`), triggered automatically when content changes in the admin panel, manually by super admins, and via scheduled cron jobs. The system uses Vercel's native ISR revalidation mechanism with an adapter pattern to support future migration to self-hosted infrastructure.

**Supersedes**: SPEC-009 (Admin ISR/Regeneration Management). SPEC-009 had fundamental conceptual errors about how ISR works in Astro+Vercel, proposed over-engineered solutions (job queue, page registry, 3 DB tables), and depended on a non-existent SPEC-005. This spec replaces it entirely with a correct, minimal, and pragmatic approach.

## 2. Goals

1. Content changes made in the admin panel are reflected on the web app within seconds (not hours)
2. Super admins can manually force revalidation of specific pages from the admin panel
3. Scheduled cron jobs revalidate pages periodically as a safety net
4. Revalidation intervals are configurable per entity type from the admin panel
5. All revalidation events are logged for audit and debugging
6. The system is designed to work with Vercel now and be portable to self-hosted later

## 3. Non-Goals (Out of Scope)

- CDN cache purging (Vercel handles this automatically with ISR)
- SSR pages (rendered on every request, no caching to invalidate)
- Page registry / tracking system (no table tracking every individual page)
- Job queue with priorities, rate limiting, concurrency control
- Real-time monitoring dashboard with health scores
- Alert system for stale pages
- A/B testing or preview modes
- Multi-site or staging regeneration
- Converting truly static pages (legal, about, contact) to SSR

## 4. Current State Analysis

### 4.1 Astro Configuration

```js
// apps/web/astro.config.mjs (current - line 47-50)
adapter: vercel({
    isr: true,       // Enables ISR but WITHOUT expiration or bypassToken
    imageService: true
}),
```

**Problem**: `isr: true` without `expiration` means cached pages **never expire** until the next deploy. Without `bypassToken`, there is **no way** to invalidate cached pages on-demand. The only way to refresh content is a full redeploy.

### 4.2 Page Rendering Strategy

The app uses a hybrid rendering approach. Pages fall into 4 categories:

**Category A - Static pages (prerender=true, NO DB data)**: These pages NEVER need revalidation.

| Page | Data Source |
|------|-------------|
| `[lang]/beneficios.astro` | Hardcoded |
| `[lang]/contacto.astro` | Hardcoded + form island |
| `[lang]/privacidad.astro` | Hardcoded |
| `[lang]/terminos-condiciones.astro` | Hardcoded |
| `[lang]/quienes-somos.astro` | Hardcoded |
| `[lang]/propietarios/index.astro` | Hardcoded |
| `[lang]/precios/turistas.astro` | Hardcoded fallbacks |
| `[lang]/precios/propietarios.astro` | Hardcoded fallbacks |
| `[lang]/auth/forgot-password.astro` | None |
| `[lang]/mapa-del-sitio.astro` | Hardcoded sitemap structure (NO API fetches) |
| `index.astro` (root redirect) | None |

**Category B - Detail pages (prerender=true, fetch DB data via getStaticPaths)**: These MUST be migrated to SSR for ISR to work.

| Page | getStaticPaths Pattern | Data Fetched |
|------|----------------------|--------------|
| `[lang]/alojamientos/[slug].astro` | `fetchAllPages()` all accommodations x3 locales | Single accommodation by slug |
| `[lang]/destinos/[...path].astro` | `fetchAllPages()` all destinations x3 locales | Single destination by path (catch-all) |
| `[lang]/eventos/[slug].astro` | `fetchAllPages()` all events x3 locales | Single event by slug |
| `[lang]/publicaciones/[slug].astro` | `fetchAllPages()` all posts x3 locales | Single post by slug + related posts |

**Category C - Listing pages (prerender=true, fetch DB data in frontmatter)**: These ALSO must be migrated to SSR for ISR to work.

| Page | getStaticPaths Pattern | Data Fetched |
|------|----------------------|--------------|
| `[lang]/destinos/index.astro` | `getStaticLocalePaths` (locale only) | Destinations list (page 1) |
| `[lang]/destinos/[slug]/alojamientos/index.astro` | `fetchAllPages()` destinations x3 locales | Destination data + its accommodations |

**Category D - Listing pages with query params (ISR-incompatible)**: These pages have `getStaticPaths()` generating locale/enum path combinations but handle query params (filters, pagination) at request time in the frontmatter. Since ISR ignores query params, all query param variants would share the same cache entry, serving incorrect results. They must be migrated to SSR AND **excluded from ISR**.

| Page | Current State | Query Params Used |
|------|--------------|-------------------|
| `[lang]/alojamientos/index.astro` | `getStaticPaths()` with `getStaticLocalePaths()`, no explicit `prerender` | `q`, `type`, `minPrice`, `maxPrice`, `capacity`, `amenity`, `rating`, `sort`, `page` |
| `[lang]/eventos/index.astro` | `getStaticPaths()` generating locale paths, no explicit `prerender` | `timeframe`, `category`, `page` |
| `[lang]/alojamientos/tipo/[type]/index.astro` | `getStaticPaths()` generating 7 URL slugs x3 locales = 21 paths, no explicit `prerender` | `sortBy`, `page`, `priceMin`, `priceMax`, `minGuests`, `minBedrooms`, `minBathrooms`, `minRating`, `hasWifi`, `hasPool`, `allowsPets`, `hasParking` |
| `[lang]/eventos/categoria/[category]/index.astro` | `getStaticPaths()` generating 5 URL slugs x3 locales = 15 paths, no explicit `prerender` | `page` |

**Important - URL slugs differ from DB enum values**: The web pages use URL-friendly slugs that do NOT match the DB enum values:

- **Accommodation types** (7 URL slugs): `hotel`, `hostel`, `cabin`, `apartment`, `camping`, `estancia`, `posada`. The DB `AccommodationTypeEnum` has 10 values: `APARTMENT`, `HOUSE`, `COUNTRY_HOUSE`, `CABIN`, `HOTEL`, `HOSTEL`, `CAMPING`, `ROOM`, `MOTEL`, `RESORT`. The page passes the URL slug directly to the API (e.g., `type: 'hotel'`), and the API handles the mapping internally.
- **Event categories** (5 URL slugs): `festival`, `fair`, `sport`, `cultural`, `gastronomy`. The DB `EventCategoryEnum` has 9 values: `MUSIC`, `CULTURE`, `SPORTS`, `GASTRONOMY`, `FESTIVAL`, `NATURE`, `THEATER`, `WORKSHOP`, `OTHER`. The page has a `CATEGORY_API_VALUE` map that converts URL slugs to API values (e.g., `fair` -> `FAIR`, `sport` -> `SPORTS`, `cultural` -> `CULTURE`).
- **Note**: `FAIR` appears in the web app's category map but is NOT in the DB `EventCategoryEnum`. This may be a preexisting mapping issue in the web app that should be investigated separately.

**Category E - Already SSR pages (prerender=false or no getStaticPaths)**: These are already server-rendered. ISR caching will apply to them automatically after the config change (except those in the exclude list).

| Page | Notes |
|------|-------|
| `[lang]/alojamientos/page/[page].astro` | Rewrites to index with `?page=N` |
| `[lang]/eventos/page/[page].astro` | Rewrites to index with `?page=N` |
| `[lang]/publicaciones/index.astro` | Full SSR |
| `[lang]/publicaciones/page/[page].astro` | Rewrites to index |
| `[lang]/publicaciones/etiqueta/[tag]/*` | Full SSR |
| `[lang]/destinos/page/[page].astro` | Rewrites to index |
| `[lang]/busqueda.astro` | SSR (query params, excluded from ISR) |
| `[lang]/mi-cuenta/*` (6 pages) | SSR, auth-protected (excluded from ISR) |
| `[lang]/auth/*` (5 pages) | SSR, auth flows (excluded from ISR) |
| `[lang]/feedback.astro` | SSR (excluded from ISR) |
| `404.astro`, `500.astro` | SSR error pages |

**Category F - Homepage (special case with Server Islands)**:

The homepage `[lang]/index.astro` currently has `prerender = true` and uses `getStaticLocalePaths`. It does **NOT** fetch data in its frontmatter. Instead, it uses Astro Server Islands (`server:defer`) for ALL dynamic sections:

- `AccommodationsSection` (server:defer)
- `DestinationsSection` (server:defer)
- `EventsSection` (server:defer)
- `PostsSection` (server:defer)

**Important**: Server Islands with `server:defer` are rendered independently on each request, NOT cached by ISR. This means:
- The homepage shell (static HTML structure) is cached by ISR
- The dynamic sections (featured accommodations, destinations, etc.) are **already fresh on every request**
- **No ISR revalidation is needed for the homepage** .. the Server Islands already solve the freshness problem
- The homepage STILL needs to be migrated from `prerender=true` to SSR so the Server Islands can render on-demand (prerendered pages bake Server Islands at build time)

**Key insight**: To enable ISR revalidation, data-driven pages (Categories B and C) must be **converted from prerender (SSG) to server-rendered (SSR)** so that ISR caching applies. Category D pages (4 listing pages with query params, including tipo/[type] and categoria/[category]) must also be converted to SSR and **excluded from ISR** because ISR ignores query params. The homepage (Category F) must also be converted to SSR, but for Server Islands to work correctly rather than for ISR revalidation.

### 4.3 Service Hook System

The service layer (`packages/service-core`) has a lifecycle hook system in `packages/service-core/src/base/base.crud.hooks.ts` with **20 hooks** (10 before/after pairs):

```
_beforeCreate       _afterCreate
_beforeUpdate       _afterUpdate
_beforeGetByField   _afterGetByField
_beforeList         _afterList
_beforeSoftDelete   _afterSoftDelete
_beforeHardDelete   _afterHardDelete
_beforeRestore      _afterRestore
_beforeSearch       _afterSearch
_beforeCount        _afterCount
_beforeUpdateVisibility  _afterUpdateVisibility
```

The inheritance chain is: `BaseCrudHooks` -> `BaseCrudPermissions` -> `BaseCrudRead` -> `BaseCrudWrite` -> `BaseCrudAdmin` -> `BaseCrudService` -> `BaseCrudRelatedService`.

Both `BaseCrudService` and `BaseCrudRelatedService` inherit all 20 hooks. Services that extend either class can override any hook.

**Current hook overrides by service**:

| Service | Class Extended | Hooks Overridden | Purpose |
|---------|---------------|-----------------|---------|
| `AccommodationService` | `BaseCrudService` | `_beforeCreate`, `_afterCreate`, `_beforeSoftDelete`, `_afterSoftDelete`, `_beforeHardDelete`, `_afterHardDelete` | Slug generation in `_beforeCreate`. Destination accommodation count updates in after hooks. **Note: does NOT currently override `_afterUpdate` or `_afterRestore`** |
| `DestinationService` | `BaseCrudService` | `_beforeCreate`, `_beforeUpdate` | Hierarchy path/pathIds/level computation, slug generation, cycle detection, descendant cascade on reparenting |
| `EventService` | `BaseCrudService` | `_beforeCreate`, `_beforeUpdate` | Slug generation |
| `PostService` | `BaseCrudService` | `_beforeCreate`, `_beforeUpdate` | Slug generation, validation |
| `AccommodationReviewService` | `BaseCrudService` | `_afterCreate`, `_beforeSoftDelete`, `_afterSoftDelete` | Accommodation rating/count recalculation. Uses `_beforeSoftDelete` to capture accommodationId before deletion. |
| `DestinationReviewService` | `BaseCrudService` | `_afterCreate`, `_beforeSoftDelete`, `_afterSoftDelete` | Destination rating/count recalculation. Same pattern as AccommodationReview. |
| `TagService` | `BaseCrudRelatedService` | None currently | Has hooks available via inheritance |
| `AmenityService` | `BaseCrudRelatedService` | `_beforeCreate`, `_beforeUpdate` | Slug generation |

**Hook signatures in BaseCrudHooks** (all hooks receive `(entity/result, actor)` and return the same type):

```typescript
// After entity creation/update - receives the full entity + actor
protected async _afterCreate(entity: TEntity, _actor: Actor): Promise<TEntity>
protected async _afterUpdate(entity: TEntity, _actor: Actor): Promise<TEntity>

// After delete/restore - receives count result + actor
protected async _afterSoftDelete(result: { count: number }, _actor: Actor): Promise<{ count: number }>
protected async _afterHardDelete(result: { count: number }, _actor: Actor): Promise<{ count: number }>
protected async _afterRestore(result: { count: number }, _actor: Actor): Promise<{ count: number }>
```

**Constructor pattern** (AccommodationService example):
```typescript
constructor(ctx: ServiceContext, model?: AccommodationModel) {
    super(ctx, AccommodationService.ENTITY_NAME);
    this.model = model ?? new AccommodationModel();
    this.destinationService = new DestinationService(ctx);
}
```

Where `ServiceContext` contains only: `{ logger?: ServiceLogger }`. Actor information (id, role, permissions) is passed as a separate `Actor` parameter to each CRUD method and hook, NOT through ServiceContext.

**This hook system is the natural attachment point for auto-revalidation triggers.**

### 4.4 How Vercel ISR Revalidation Works

Vercel's on-demand ISR revalidation does **not** require a custom endpoint. Instead:

1. Configure a `bypassToken` in `astro.config.mjs`
2. To invalidate a cached page, send an HTTP request to that page's URL with a special header:

```
GET https://hospeda.vercel.app/es/alojamientos/hotel-ejemplo/
Header: x-prerender-revalidate: <bypassToken>
```

3. Vercel invalidates the cache for that path
4. The next regular visitor request generates fresh content

**Note**: Vercel also accepts `HEAD` as the HTTP method for revalidation requests, which is slightly more correct semantically since the response body is discarded. The `GET` method shown here works identically. The `VercelRevalidationAdapter` uses `GET` for simplicity.

**Limitations**:
- No `Astro.revalidate()` API exists. Revalidation is always external via HTTP.
- No per-route ISR configuration. `expiration` is global.
- No cache tag support (unlike Next.js `revalidateTag()`). Only path-based invalidation.
- Query parameters are ignored by ISR. `/busqueda?q=foo` and `/busqueda?q=bar` share the same cache entry.
- ISR only works with Vercel Serverless Functions (not Edge Runtime).
- Server Islands (`server:defer`) are NOT cached by ISR .. they render fresh on every request.

## 5. Architecture

### 5.1 High-Level Flow

```
                AUTOMATIC TRIGGER                    MANUAL TRIGGER
                ================                    ==============
Admin edits accommodation          Super admin clicks "Regenerar"
         |                                    |
         v                                    v
AccommodationService._afterUpdate    Admin UI calls API endpoint
         |                                    |
         v                                    v
RevalidationService.revalidateEntity()   RevalidationService.revalidatePaths()
         |                                    |
         v                                    v
EntityPathMapper.getAffectedPaths()     (paths provided directly)
         |                                    |
         v                                    v
Debouncer (30s window)                  No debouncing (immediate)
         |                                    |
         v                                    v
RevalidationAdapter.revalidate({ path })
         |
         v
VercelAdapter: GET <siteUrl>/<path> + header x-prerender-revalidate
         |
         v
Log entry in revalidation_log table


                SCHEDULED TRIGGER
                =================
Cron job runs every hour
         |
         v
Check revalidation_config for each entity type
         |
         v
For entity types past their interval:
  - Query DB for all entities of that type
  - Construct paths via EntityPathMapper
  - Call RevalidationAdapter.revalidate() for each
  - Log results
```

### 5.2 Astro ISR Configuration Changes

```js
// apps/web/astro.config.mjs (target state - replace lines 47-50)
trailingSlash: 'always',  // Must be set before adapter
adapter: vercel({
    isr: {
        expiration: 86400,  // 24h safety net (seconds)
        bypassToken: process.env.HOSPEDA_REVALIDATION_SECRET,
        exclude: [
            /\/mi-cuenta\//,    // User-specific authenticated pages
            /\/auth\//,         // Auth flow pages (dynamic)
            /\/busqueda/,       // Search (query params ignored by ISR)
            /\/feedback/,       // Feedback form
            /^\/[a-z]{2}\/alojamientos\/$/,       // Accommodation listing (uses query params for filters)
            /^\/[a-z]{2}\/eventos\/$/,            // Event listing (uses query params for filters)
            /\/alojamientos\/tipo\/[^/]+\/$/,     // Type filter listing (uses query params for sort/price/capacity filters)
            /\/eventos\/categoria\/[^/]+\/$/,     // Category filter listing (uses query params for pagination)
        ],
    },
    imageService: true,
}),
```

**Configuration explained**:

| Setting | Value | Why |
|---------|-------|-----|
| `trailingSlash: 'always'` | Astro config | Ensures all generated URLs always have trailing slashes. Required for ISR exclude regex patterns to work consistently. The current config does not have this explicitly. Adding it prevents URL format inconsistencies. Add at the top level of `defineConfig()` in `apps/web/astro.config.mjs`. |
| `expiration: 86400` | 24 hours | Safety net. Even without on-demand revalidation, pages refresh at most every 24h. This is the global maximum staleness. |
| `bypassToken` | env var | Secret token used by the API to trigger on-demand revalidation. Must be the same value in both `apps/web` and `apps/api` env configs. |
| `exclude` patterns | RegExp[] | Routes that must NEVER be ISR-cached because they depend on auth state, query params (used in frontmatter for data filtering), or are user-specific. Includes listing pages with filters (alojamientos/index, eventos/index, tipo/[type], categoria/[category]). These routes render fresh on every request. **Note**: RegExp patterns in `exclude` require `@astrojs/vercel >= 8.1.0`. The project currently uses `^8.2.11`, so this is satisfied. |

**What the exclude patterns cover**:
- `/*/mi-cuenta/*` .. 6 account pages (SSR, auth-protected, user-specific content)
- `/*/auth/*` .. signin, signup, reset-password, verify-email (dynamic auth flows with cookies)
- `/*/busqueda` .. search page (ISR ignores query params, would serve wrong results)
- `/*/feedback` .. feedback form (fresh on every request)
- `/*/alojamientos/` (exact, trailing slash) .. accommodation listing page (uses query params for type/price/capacity/amenity/sort filtering)
- `/*/eventos/` (exact, trailing slash) .. event listing page (uses query params for timeframe/category filtering)
- `/*/alojamientos/tipo/*/` .. accommodation type filter page (uses query params for sortBy, price range, capacity, rating, amenity filters)
- `/*/eventos/categoria/*/` .. event category filter page (uses query params for pagination)

**What is NOT excluded** (gets ISR caching):
- All content detail pages (after migration from prerender)
- Content listing/index pages without query params: destinos/index, destinos/[slug]/alojamientos/index (after migration from prerender)
- Homepage (shell cached, Server Islands render fresh)
- Pagination pages (`/page/N/`) .. URL-based, works fine with ISR (already SSR)

### 5.3 Page Rendering Migration

**11 pages** must be converted from prerender/SSG (build-time) to SSR (on-demand). Of these, 7 will be ISR-cached and 4 will be ISR-excluded (because they use query params for filtering in the frontmatter).

**For each page, the migration involves**:

1. **Remove** `export const prerender = true;`
2. **Remove** the `getStaticPaths()` function (or the `getStaticLocalePaths` re-export)
3. **Add** locale validation in the frontmatter
4. **Add** data fetching in the frontmatter (fetch entity by slug/params)
5. **Add** 404 handling if entity not found
6. **Remove** `Astro.props` usage, replace with fetched data
7. **Keep** all template code, imports, and component usage unchanged

**Migration Pattern A: Detail pages with getStaticPaths + fetchAllPages**

Used by: `alojamientos/[slug]`, `destinos/[...path]`, `eventos/[slug]`, `publicaciones/[slug]`

```astro
---
// BEFORE (prerender = true with getStaticPaths)
export const prerender = true;

export async function getStaticPaths() {
    const items = await fetchAllPages<EntityPublic>({
        fetcher: (p) => api.list(p),
    });
    return SUPPORTED_LOCALES.flatMap((lang) =>
        items
            .filter((i) => Boolean(i.slug))
            .map((i) => ({
                params: { lang, slug: i.slug },
                props: { item: i },
            }))
    );
}

let item = Astro.props.item as EntityPublic | undefined;
if (!item) {
    // Fallback fetch for dev/preview
    const result = await api.getBySlug({ slug });
    if (!result.ok) return Astro.redirect(buildUrl({ locale, path: '404' }));
    item = result.data;
}
---

---
// AFTER (SSR with ISR caching)
import { isValidLocale, type SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';

const lang = Astro.params.lang;
if (!lang || !isValidLocale(lang)) return Astro.redirect('/es/');
const locale = lang as SupportedLocale;
const { slug } = Astro.params;

if (!slug) return Astro.redirect(buildUrl({ locale, path: '404' }));

const result = await api.getBySlug({ slug });
if (!result.ok) return Astro.redirect(buildUrl({ locale, path: '404' }));

const item = result.data;
---
```

**Migration Pattern B: Listing pages with getStaticLocalePaths**

Used by: `destinos/index`

```astro
---
// BEFORE
export const prerender = true;
export { getStaticLocalePaths as getStaticPaths } from '../../../lib/page-helpers';

const locale = (Astro.params.lang ?? 'es') as SupportedLocale;
const result = await destinationsApi.list({ page: 1, pageSize: 12 });
---

---
// AFTER
import { isValidLocale, type SupportedLocale } from '@/lib/i18n';

const lang = Astro.params.lang;
if (!lang || !isValidLocale(lang)) return Astro.redirect('/es/');
const locale = lang as SupportedLocale;

const result = await destinationsApi.list({ page: 1, pageSize: 12 });
---
```

**Migration Pattern C: Enum-based pages with getStaticPaths generating combinations (ISR-excluded)**

Used by: `alojamientos/tipo/[type]/index`, `eventos/categoria/[category]/index`. **Note**: These pages do NOT have explicit `prerender = true` (only `getStaticPaths`), and they use query params in the frontmatter for filtering. They are ISR-excluded (Pattern E) but follow the enum validation pattern below for the type/category param validation. The key difference from Pattern E (listing) is that they also need enum param validation.

```astro
---
// BEFORE
export const prerender = true;

export function getStaticPaths() {
    return SUPPORTED_LOCALES.flatMap((lang) =>
        TYPES.map((type) => ({ params: { lang, type } }))
    );
}

const { type } = Astro.params;
const locale = (Astro.params.lang ?? 'es') as SupportedLocale;
---

---
// AFTER
import { isValidLocale, type SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';

const lang = Astro.params.lang;
if (!lang || !isValidLocale(lang)) return Astro.redirect('/es/');
const locale = lang as SupportedLocale;

const { type } = Astro.params;
if (!type || !VALID_TYPES.includes(type)) {
    return Astro.redirect(buildUrl({ locale, path: '404' }));
}
---
```

**Migration Pattern D: Homepage with Server Islands**

```astro
---
// BEFORE
export const prerender = true;
export { getStaticLocalePaths as getStaticPaths } from '../../lib/page-helpers';
---

---
// AFTER (remove prerender and getStaticPaths)
import { isValidLocale, type SupportedLocale } from '@/lib/i18n';

const lang = Astro.params.lang;
if (!lang || !isValidLocale(lang)) return Astro.redirect('/es/');
const locale = lang as SupportedLocale;

// NOTE: No data fetching here. All dynamic sections use server:defer
// and render fresh on every request (not cached by ISR).
---
```

**Migration Pattern E: Listing pages with query param filtering (ISR-excluded)**

Used by: `alojamientos/index`, `eventos/index`

These pages have `getStaticPaths()` generating locale paths and handle extensive query param filtering. They must be migrated to SSR but **excluded from ISR** because ISR ignores query params.

```astro
---
// BEFORE
import { getStaticLocalePaths } from '../../../lib/page-helpers';

export function getStaticPaths() {
    return getStaticLocalePaths();
}

const locale = getLocaleFromParams(Astro.params);
if (!locale) return Astro.redirect('/es/');
// ... query param parsing continues
---

---
// AFTER
import { isValidLocale, type SupportedLocale } from '@/lib/i18n';

const lang = Astro.params.lang;
if (!lang || !isValidLocale(lang)) return Astro.redirect('/es/');
const locale = lang as SupportedLocale;

// ... query param parsing continues (unchanged)
---
```

**Complete list of pages to migrate** (11 total):

| # | Page File | Migration Pattern | ISR Cached? | Notes |
|---|-----------|-------------------|-------------|-------|
| 1 | `[lang]/alojamientos/[slug].astro` | A (detail) | Yes | Fetch single by slug. `accommodationsApi.getBySlug()` exists. |
| 2 | `[lang]/destinos/[...path].astro` | A (detail) | Yes | Fetch single by path. Handle catch-all param (may be string or array). Use `destinationsApi.getByPath()`. |
| 3 | `[lang]/destinos/index.astro` | B (listing) | Yes | Fetch destinations list. Simple locale validation. |
| 4 | `[lang]/destinos/[slug]/alojamientos/index.astro` | A (detail+listing) | Yes | **Already SSR** - no `prerender` or `getStaticPaths` to remove. Verify page still functions correctly and add any missing locale validation. No code changes needed if SSR works correctly. |
| 5 | `[lang]/eventos/[slug].astro` | A (detail) | Yes | Fetch single by slug. |
| 6 | `[lang]/publicaciones/[slug].astro` | A (detail) | Yes | Fetch single by slug + related posts fetch. |
| 7 | `[lang]/alojamientos/tipo/[type]/index.astro` | E (query param listing) | **No** (excluded) | **Already SSR** - no `prerender` or `getStaticPaths` to remove. Verify locale and type param validation exists. ISR exclusion via astro.config exclude pattern is still required. Uses query params for sortBy/price/capacity/rating/amenity filters. |
| 8 | `[lang]/eventos/categoria/[category]/index.astro` | E (query param listing) | **No** (excluded) | Validate category param against `ALLOWED_CATEGORIES` (5 URL slugs: festival, fair, sport, cultural, gastronomy). Has explicit `export const prerender = true;` AND `getStaticPaths()`. Both must be removed. Uses query params for pagination. |
| 9 | `[lang]/index.astro` (homepage) | D (Server Islands) | Yes (shell only) | Remove prerender. No data fetching needed (Server Islands handle it). |
| 10 | `[lang]/alojamientos/index.astro` | E (query param listing) | **No** (excluded) | **Already SSR** - no `getStaticPaths` found. ISR exclusion via astro.config exclude pattern is still required to prevent query param pages from being ISR-cached. |
| 11 | `[lang]/eventos/index.astro` | E (query param listing) | **No** (excluded) | **Already SSR** - no `getStaticPaths` found. ISR exclusion via astro.config exclude pattern is still required. |

**Pages that do NOT need migration** (already SSR or no DB data):

- All `/page/[page]/` pagination routes (already `prerender = false`)
- `[lang]/publicaciones/index.astro` (already full SSR, no `getStaticPaths`)
- `[lang]/publicaciones/etiqueta/[tag]/*` (already full SSR)
- `[lang]/busqueda.astro` (already `prerender = false`)
- `[lang]/mapa-del-sitio.astro` (hardcoded data, no DB fetches - stays prerender)
- All auth, account, error, and static content pages

**Migration checklist for each page**:
- [ ] Remove `export const prerender = true;`
- [ ] Remove `getStaticPaths()` function or `getStaticLocalePaths` re-export
- [ ] Add locale validation (`isValidLocale`)
- [ ] Add data fetching by params (slug, path, locale) in frontmatter
- [ ] Add 404 redirect if entity not found or invalid params
- [ ] Remove `Astro.props` usage, replace with fetched data variables
- [ ] Verify page renders correctly in dev mode (`pnpm dev`)
- [ ] Verify all imports still work without getStaticPaths context
- [ ] Run existing tests (update if needed)

**Exit criteria**: All 11 pages work as SSR. ISR caching verified on Vercel staging for pages 1-6 and 9. ISR exclusion verified for pages 7-8, 10-11 (query param pages render fresh every request). No prerender pages depend on DB data (except truly static pages). Documentation updated.

### 5.4 Revalidation Adapter Pattern

An abstract interface allows swapping the revalidation mechanism when migrating away from Vercel.

**Location**: `packages/service-core/src/revalidation/revalidation-adapter.ts`

```typescript
/**
 * Result of a single path revalidation attempt.
 */
export interface RevalidationResult {
  readonly path: string;
  readonly success: boolean;
  readonly durationMs: number;
  readonly error?: string;
}

/**
 * Abstract interface for cache revalidation.
 * Implementations handle vendor-specific invalidation mechanisms.
 */
export interface RevalidationAdapter {
  /**
   * Revalidate a single cached path.
   * @param params.path - The URL path to revalidate (e.g., "/es/alojamientos/hotel-ejemplo/")
   */
  revalidate(params: { readonly path: string }): Promise<RevalidationResult>;

  /**
   * Revalidate multiple paths. Default implementation calls revalidate() for each.
   * Implementations may override for batch optimization.
   */
  revalidateMany(params: {
    readonly paths: ReadonlyArray<string>;
  }): Promise<ReadonlyArray<RevalidationResult>>;
}
```

**VercelAdapter** (the only implementation for now):

**Location**: `packages/service-core/src/revalidation/adapters/vercel-adapter.ts`

```typescript
import { createLogger } from '@repo/logger';
import type { RevalidationAdapter, RevalidationResult } from '../revalidation-adapter';

const logger = createLogger('VercelRevalidationAdapter');

/**
 * Vercel ISR revalidation adapter.
 * Invalidates cached pages by sending a GET request with the bypass token header.
 *
 * Vercel documentation specifies using GET with the x-prerender-revalidate header.
 * The response body is discarded; only the cache invalidation side-effect matters.
 */
export class VercelRevalidationAdapter implements RevalidationAdapter {
  private readonly siteUrl: string;
  private readonly bypassToken: string;
  private readonly chunkSize: number;
  private readonly chunkDelayMs: number;

  constructor(params: {
    readonly siteUrl: string;
    readonly bypassToken: string;
    readonly chunkSize?: number;
    readonly chunkDelayMs?: number;
  }) {
    this.siteUrl = params.siteUrl.replace(/\/$/, '');
    this.bypassToken = params.bypassToken;
    this.chunkSize = params.chunkSize ?? 10;
    this.chunkDelayMs = params.chunkDelayMs ?? 200;
  }

  async revalidate(params: { readonly path: string }): Promise<RevalidationResult> {
    const startTime = Date.now();
    const url = `${this.siteUrl}${params.path}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'x-prerender-revalidate': this.bypassToken },
      });

      return {
        path: params.path,
        success: response.ok,
        durationMs: Date.now() - startTime,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        path: params.path,
        success: false,
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async revalidateMany(params: {
    readonly paths: ReadonlyArray<string>;
  }): Promise<ReadonlyArray<RevalidationResult>> {
    const results: RevalidationResult[] = [];

    for (let i = 0; i < params.paths.length; i += this.chunkSize) {
      const chunk = params.paths.slice(i, i + this.chunkSize);
      const chunkResults = await Promise.all(
        chunk.map((path) => this.revalidate({ path }))
      );
      results.push(...chunkResults);

      // Small delay between chunks to avoid overwhelming the server
      if (i + this.chunkSize < params.paths.length) {
        await new Promise((resolve) => setTimeout(resolve, this.chunkDelayMs));
      }
    }

    logger.info('Batch revalidation complete', {
      total: params.paths.length,
      succeeded: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    });

    return results;
  }
}
```

**NoOpAdapter** (for local development):

**Location**: `packages/service-core/src/revalidation/adapters/noop-adapter.ts`

```typescript
import { createLogger } from '@repo/logger';
import type { RevalidationAdapter, RevalidationResult } from '../revalidation-adapter';

const logger = createLogger('NoOpRevalidationAdapter');

/**
 * No-op adapter for local development.
 * Logs revalidation requests without actually revalidating.
 */
export class NoOpRevalidationAdapter implements RevalidationAdapter {
  async revalidate(params: { readonly path: string }): Promise<RevalidationResult> {
    logger.debug('Revalidation skipped (NoOp)', { path: params.path });
    return { path: params.path, success: true, durationMs: 0 };
  }

  async revalidateMany(params: {
    readonly paths: ReadonlyArray<string>;
  }): Promise<ReadonlyArray<RevalidationResult>> {
    logger.debug('Batch revalidation skipped (NoOp)', { count: params.paths.length });
    return params.paths.map((path) => ({
      path,
      success: true,
      durationMs: 0,
    }));
  }
}
```

**Adapter factory** (in API app initialization):

**Location**: `apps/api/src/lib/revalidation.ts`

```typescript
import { createLogger } from '@repo/logger';
import { VercelRevalidationAdapter, NoOpRevalidationAdapter } from '@repo/service-core';
import type { RevalidationAdapter } from '@repo/service-core';

const logger = createLogger('revalidation-factory');

/**
 * Creates the appropriate revalidation adapter based on environment.
 * Uses VercelAdapter in production, NoOpAdapter in development.
 */
export function createRevalidationAdapter(): RevalidationAdapter {
  const siteUrl = process.env.HOSPEDA_SITE_URL;
  const bypassToken = process.env.HOSPEDA_REVALIDATION_SECRET;

  if (!siteUrl || !bypassToken) {
    logger.warn('Revalidation disabled: missing HOSPEDA_SITE_URL or HOSPEDA_REVALIDATION_SECRET');
    return new NoOpRevalidationAdapter();
  }

  logger.info('Revalidation enabled with Vercel adapter', { siteUrl });
  return new VercelRevalidationAdapter({ siteUrl, bypassToken });
}
```

**Barrel export** for the revalidation module:

**Location**: `packages/service-core/src/revalidation/index.ts`

```typescript
export type { RevalidationAdapter, RevalidationResult } from './revalidation-adapter';
export { VercelRevalidationAdapter } from './adapters/vercel-adapter';
export { NoOpRevalidationAdapter } from './adapters/noop-adapter';
export { RevalidationService } from './revalidation.service';
export type { RevalidationServiceConfig } from './revalidation.service';
export { getAffectedPaths } from './entity-path-mapper';
export type { EntityChangeEvent, EntityType, EntityChangeData } from './entity-path-mapper';
export { initializeRevalidationService, getRevalidationService } from './revalidation-singleton';
```

**IMPORTANT - Update `packages/service-core/src/index.ts`**:

Add the following re-export to the main service-core barrel (`packages/service-core/src/index.ts`):

```typescript
/**
 * --- REVALIDATION ---
 * Exports the revalidation adapter pattern, entity path mapper, and singleton.
 */
export * from './revalidation';
```

Without this, importing `getRevalidationService` or `getAffectedPaths` from `@repo/service-core` will fail.

### 5.5 Entity-to-Paths Mapping

When an entity changes, the system must know which URL paths to invalidate. This mapping is a pure function with no side effects.

**Location**: `packages/service-core/src/revalidation/entity-path-mapper.ts`

**Supported locales**: `['es', 'en', 'pt']` (from `@repo/i18n`, exported as `locales`)

**Types**:

```typescript
// NOTE: @repo/i18n exports `locales` (array: ['es', 'en', 'pt']) and `Locale` (type).
// There is NO `SUPPORTED_LOCALES` export. The locales are passed as a parameter
// to getAffectedPaths() so no import from @repo/i18n is needed here.

export type EntityType =
  | 'accommodation'
  | 'destination'
  | 'event'
  | 'post'
  | 'accommodation_review'
  | 'destination_review'
  | 'tag'
  | 'amenity';

/**
 * Discriminated union of entity change data.
 * Each entity type requires specific fields to construct affected paths.
 */
export type EntityChangeData =
  | {
      readonly entityType: 'accommodation';
      readonly slug: string;
      readonly destinationPath: string; // Full hierarchical path (e.g., "/argentina/litoral/entre-rios"). Must be resolved by caller from destination's `path` field.
      readonly isFeatured: boolean;
      readonly type?: string; // AccommodationType enum value (e.g., 'HOTEL', 'CABIN'). For tipo/ page invalidation.
    }
  | {
      readonly entityType: 'destination';
      readonly slug: string;
      readonly path: string; // Full hierarchical path (e.g., "/argentina/litoral/entre-rios")
      readonly isFeatured: boolean;
    }
  | {
      readonly entityType: 'event';
      readonly slug: string;
      readonly isFeatured: boolean;
      readonly category?: string; // For categoria/ page invalidation
    }
  | {
      readonly entityType: 'post';
      readonly slug: string;
      readonly isFeatured: boolean;
      readonly tagSlugs?: ReadonlyArray<string>; // For etiqueta/ page invalidation
    }
  | {
      readonly entityType: 'accommodation_review';
      readonly accommodationSlug: string; // Must be resolved by caller
    }
  | {
      readonly entityType: 'destination_review';
      readonly destinationPath: string; // Must be resolved by caller
    }
  | {
      readonly entityType: 'tag';
      readonly accommodationSlugs: ReadonlyArray<string>; // Must be resolved by caller via r_entity_tag (entityType='accommodation')
      readonly destinationPaths: ReadonlyArray<string>; // Full hierarchical paths of destinations of those accommodations
    }
  | {
      readonly entityType: 'amenity';
      readonly accommodationSlugs: ReadonlyArray<string>; // Must be resolved by caller via r_accommodation_amenity
      readonly destinationPaths: ReadonlyArray<string>; // Full hierarchical paths of destinations of those accommodations
    };

export interface EntityChangeEvent {
  readonly entityId: string;
  readonly operation: 'create' | 'update' | 'delete';
  readonly data: EntityChangeData;
}
```

**Mapping rules**:

| Entity Changed | Operation | Paths to Invalidate |
|---|---|---|
| **Accommodation** | create/update/delete | Detail: `/{lang}/alojamientos/{slug}/` (x3 locales). Parent destination detail: `/{lang}/destinos/{destPath}/` (x3, using destination's full hierarchical `path` field with leading slash stripped, e.g., DB stores `/argentina/litoral/entre-rios`, URL becomes `destinos/argentina/litoral/entre-rios/`). Destination accommodations: `/{lang}/destinos/{destPath}/alojamientos/` (x3). Type listing: `/{lang}/alojamientos/tipo/{urlSlug}/` (x3, if type known AND has a URL slug mapping. Only 6 of 10 DB types have URL slugs. See `ACCOMMODATION_TYPE_TO_URL_SLUG`). |
| **Destination** | create/update/delete | Detail: `/{lang}/destinos/{path}/` (x3 locales, using full hierarchical path). Index: `/{lang}/destinos/` (x3). |
| **Event** | create/update/delete | Detail: `/{lang}/eventos/{slug}/` (x3 locales). Category listing: `/{lang}/eventos/categoria/{urlSlug}/` (x3, if category known AND has a URL slug mapping. Only 5 of 9 DB categories have URL slugs. See `EVENT_CATEGORY_TO_URL_SLUG`). |
| **Post** | create/update/delete/publish | Detail: `/{lang}/publicaciones/{slug}/` (x3 locales). Tag listings: `/{lang}/publicaciones/etiqueta/{tagSlug}/` (x3 per tag, if tags known). |
| **AccommodationReview** | create/update/delete | Parent accommodation detail: `/{lang}/alojamientos/{accommSlug}/` (x3). |
| **DestinationReview** | create/update/delete | Parent destination detail: `/{lang}/destinos/{destPath}/` (x3). |
| **Tag** | update/delete | All accommodations using that tag: `/{lang}/alojamientos/{slug}/` (x3 per accommodation). Their destination pages too. |
| **Amenity** | update/delete | All accommodations using that amenity: `/{lang}/alojamientos/{slug}/` (x3 per accommodation). Their destination pages too. |

**Important notes on path construction**:

- All paths MUST include trailing slashes (per `trailingSlash: 'always'` in astro.config).
- Destination paths use the full hierarchical path from the DB `path` field with the leading slash stripped. For example, if `destination.path = '/argentina/litoral/entre-rios'`, the URL is `/{lang}/destinos/argentina/litoral/entre-rios/`.
- **Homepage is NOT included** in any mapping because its dynamic content uses Server Islands (already fresh).
- **Pagination pages** (`/page/N/`) are NOT revalidated. The ISR `expiration: 86400` (24h) safety net handles staleness for pagination. Revalidating all page numbers would generate too many paths.
- For `delete` operations, the caller should conservatively include all paths the entity *could* have affected (e.g., always include type/category listings).

**Function signature**:

```typescript
/**
 * Returns all URL paths that must be revalidated when an entity changes.
 * Pure function. Does NOT trigger revalidation itself.
 *
 * @param params.event - The entity change event with resolved data
 * @param params.locales - Array of supported locale codes
 * @returns Array of URL paths to revalidate (with trailing slashes)
 */
export function getAffectedPaths(params: {
  readonly event: EntityChangeEvent;
  readonly locales: ReadonlyArray<string>;
}): ReadonlyArray<string>;
```

**Implementation example for accommodation**:

```typescript
function getAccommodationPaths(
  data: Extract<EntityChangeData, { entityType: 'accommodation' }>,
  locales: ReadonlyArray<string>,
): string[] {
  const paths: string[] = [];

  for (const lang of locales) {
    // Detail page
    paths.push(`/${lang}/alojamientos/${data.slug}/`);

    // Parent destination detail and accommodations listing
    // Uses the destination's full hierarchical path (e.g., "/argentina/litoral/entre-rios")
    // Strip leading slash from DB path to avoid double slash in URL
    if (data.destinationPath) {
      const destPath = data.destinationPath.replace(/^\//, '');
      paths.push(`/${lang}/destinos/${destPath}/`);
      paths.push(`/${lang}/destinos/${destPath}/alojamientos/`);
    }

    // Type listing (if type is known)
    // IMPORTANT: The DB enum values (e.g., 'HOTEL', 'CABIN') do NOT match URL slugs directly.
    // The web app uses its own ALLOWED_TYPES slugs: hotel, hostel, cabin, apartment, camping, estancia, posada.
    // A reverse mapping from DB enum to URL slug is required (see ACCOMMODATION_TYPE_TO_URL_SLUG).
    // Only types that have a URL slug should generate paths.
    if (data.type) {
      const urlSlug = ACCOMMODATION_TYPE_TO_URL_SLUG[data.type];
      if (urlSlug) {
        paths.push(`/${lang}/alojamientos/tipo/${urlSlug}/`);
      }
    }
  }

  return paths;
}
```

**URL slug mapping constants** (in `entity-path-mapper.ts`):

```typescript
/**
 * Maps DB AccommodationTypeEnum values to web app URL slugs.
 * Only types with URL slugs generate tipo/ page paths.
 * Source of truth: apps/web/src/pages/[lang]/alojamientos/tipo/[type]/index.astro ALLOWED_TYPES
 */
const ACCOMMODATION_TYPE_TO_URL_SLUG: Readonly<Record<string, string>> = {
  HOTEL: 'hotel',
  HOSTEL: 'hostel',
  CABIN: 'cabin',
  APARTMENT: 'apartment',
  CAMPING: 'camping',
  COUNTRY_HOUSE: 'estancia',
  // 'posada' exists in ALLOWED_TYPES but has no direct DB enum equivalent.
  // HOUSE, ROOM, MOTEL, RESORT have no URL slugs and are not mapped.
};

/**
 * Maps DB EventCategoryEnum values to web app URL slugs.
 * Only categories with URL slugs generate categoria/ page paths.
 * Source of truth: apps/web/src/pages/[lang]/eventos/categoria/[category]/index.astro ALLOWED_CATEGORIES
 */
const EVENT_CATEGORY_TO_URL_SLUG: Readonly<Record<string, string>> = {
  FESTIVAL: 'festival',
  FAIR: 'fair',         // Note: FAIR is not in EventCategoryEnum but IS in ALLOWED_CATEGORIES. Investigate separately.
  SPORTS: 'sport',
  CULTURE: 'cultural',  // Note: The web app's CATEGORY_API_VALUE maps 'cultural' → 'CULTURAL' (not 'CULTURE').
                        // This is a preexisting web app bug: the API filter receives 'CULTURAL' but the DB
                        // EventCategoryEnum stores 'CULTURE'. This means the categoria/cultural page may currently
                        // return empty results. Investigate separately — this bug is outside the scope of this spec.
                        // For ISR path construction, 'cultural' is the correct URL slug regardless.
  GASTRONOMY: 'gastronomy',
  // MUSIC, NATURE, THEATER, WORKSHOP, OTHER have no URL slugs and are not mapped.
};
```

**Destination `path` field format**: The DB `destinations.path` column stores the **full materialized hierarchical path with a leading slash**, e.g., `/argentina/litoral/entre-rios`. The catch-all route `[lang]/destinos/[...path].astro` converts this to a URL by joining the spread params with `/` (no leading slash). When constructing revalidation paths, strip the leading slash from the DB path: `/{lang}/destinos/${data.path.replace(/^\//, '')}/`.

### 5.6 RevalidationService

Central service that orchestrates revalidation. Lives in `packages/service-core`.

**Location**: `packages/service-core/src/revalidation/revalidation.service.ts`

```typescript
import { createLogger } from '@repo/logger';
import {
  AccommodationModel,
  DestinationModel,
  EventModel,
  PostModel,
  RevalidationConfigModel,
  RevalidationLogModel,
} from '@repo/db';
import type { RevalidationAdapter, RevalidationResult } from './revalidation-adapter';
import { getAffectedPaths, type EntityChangeEvent } from './entity-path-mapper';
// NOTE: @repo/i18n exports `locales` (array) and `Locale` (type). There is NO `SUPPORTED_LOCALES`.
// The locales are accepted as config: RevalidationServiceConfig.locales (ReadonlyArray<string>).
// Initialize with: import { locales } from '@repo/i18n'; ... new RevalidationService({ locales })

const logger = createLogger('RevalidationService');

export interface RevalidationServiceConfig {
  readonly adapter: RevalidationAdapter;
  /** Default debounce window in milliseconds. Default: 30000 (30 seconds) */
  readonly debounceMs?: number;
  /** Supported locales for path expansion */
  readonly locales: ReadonlyArray<string>;
  /** Maximum revalidations per cron run. Default: 500 */
  readonly maxCronRevalidations?: number;
  /** Log retention in days. Default: 30 */
  readonly logRetentionDays?: number;
}

// Note: The service uses RevalidationConfigModel and RevalidationLogModel
// from @repo/db directly (imported at the top of the file).
// No `db` instance needs to be passed in the config.

export class RevalidationService {
  private readonly adapter: RevalidationAdapter;
  private readonly defaultDebounceMs: number;
  private readonly locales: ReadonlyArray<string>;
  private readonly maxCronRevalidations: number;
  private readonly logRetentionDays: number;
  private readonly pendingRevalidations = new Map<string, NodeJS.Timeout>();

  constructor(config: RevalidationServiceConfig) {
    this.adapter = config.adapter;
    this.defaultDebounceMs = config.debounceMs ?? 30000;
    this.locales = config.locales;
    this.maxCronRevalidations = config.maxCronRevalidations ?? 500;
    this.logRetentionDays = config.logRetentionDays ?? 30;
  }

  /**
   * Called by service hooks after entity CRUD operations.
   * Determines affected paths and triggers revalidation with debouncing.
   * Fire-and-forget: errors are logged but never thrown.
   */
  async revalidateEntity(params: {
    readonly event: EntityChangeEvent;
  }): Promise<void> {
    const key = `${params.event.data.entityType}:${params.event.entityId}`;

    // Read config to check if auto-revalidation is enabled for this entity type
    // and get the debounce window
    const config = await this.getEntityConfig(params.event.data.entityType);
    if (!config?.enabled || !config?.autoRevalidateOnChange) {
      logger.debug('Auto-revalidation disabled for entity type', {
        entityType: params.event.data.entityType,
      });
      return;
    }

    const debounceMs = (config.debounceSeconds ?? 30) * 1000;

    // Clear any pending revalidation for this entity
    const existing = this.pendingRevalidations.get(key);
    if (existing) clearTimeout(existing);

    // Schedule revalidation after debounce window
    const timeout = setTimeout(async () => {
      this.pendingRevalidations.delete(key);
      try {
        const paths = getAffectedPaths({
          event: params.event,
          locales: this.locales,
        });
        const results = await this.adapter.revalidateMany({ paths });
        await this.logResults({
          results,
          trigger: 'auto',
          entityType: params.event.data.entityType,
          entityId: params.event.entityId,
        });
      } catch (error) {
        logger.error('Revalidation failed', {
          entityType: params.event.data.entityType,
          entityId: params.event.entityId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }, debounceMs);

    this.pendingRevalidations.set(key, timeout);
  }

  /**
   * Called by admin for manual revalidation. No debouncing.
   * Revalidates the specified paths immediately.
   */
  async revalidatePaths(params: {
    readonly paths: ReadonlyArray<string>;
    readonly reason: string;
    readonly triggeredBy: string; // User ID
  }): Promise<ReadonlyArray<RevalidationResult>> {
    const results = await this.adapter.revalidateMany({ paths: params.paths });
    await this.logResults({
      results,
      trigger: 'manual',
      triggeredBy: params.triggeredBy,
    });
    return results;
  }

  /**
   * Called by cron for scheduled revalidation.
   * Queries all active entities of the given type, constructs their paths,
   * and revalidates them in batches.
   *
   * Implementation:
   * 1. Determine which model to query based on entityType
   * 2. Query all active (non-deleted) entities
   * 3. For each entity, resolve the data needed for EntityChangeData
   * 4. Construct paths via getAffectedPaths
   * 5. Deduplicate paths and revalidate via adapter
   * 6. Log results as 'cron' trigger
   */
  async revalidateByEntityType(params: {
    readonly entityType: string;
  }): Promise<ReadonlyArray<RevalidationResult>> {
    const allPaths = new Set<string>();

    // This method delegates to entity-specific resolvers that:
    // 1. Query the appropriate model for all active entities
    // 2. For each entity, build EntityChangeData with resolved fields
    // 3. Call getAffectedPaths() and collect all paths
    //
    // Entity-specific resolvers are needed because each entity type
    // requires different fields (slug, destinationPath, type, category, tags, etc.)
    //
    // Example for 'accommodation':
    //   const model = new AccommodationModel();
    //   const { items: accommodations } = await model.findAll({ deletedAt: null });
    //   for (const acc of accommodations) {
    //     const dest = acc.destinationId ? await destModel.findById(acc.destinationId) : null;
    //     const paths = getAffectedPaths({
    //       event: {
    //         entityId: acc.id,
    //         operation: 'update',
    //         data: {
    //           entityType: 'accommodation',
    //           slug: acc.slug,
    //           destinationPath: dest?.path ?? '',
    //           isFeatured: acc.isFeatured ?? false,
    //           type: acc.type,
    //         },
    //       },
    //       locales: this.locales,
    //     });
    //     for (const p of paths) allPaths.add(p);
    //   }

    const entityResolvers: Record<string, () => Promise<ReadonlyArray<string>>> = {
      accommodation: () => this.resolveAccommodationPaths(),
      destination: () => this.resolveDestinationPaths(),
      event: () => this.resolveEventPaths(),
      post: () => this.resolvePostPaths(),
      // Reviews, tags, amenities are not revalidated by cron directly.
      // Their revalidation happens through their parent entity's cron revalidation.
    };

    const resolver = entityResolvers[params.entityType];
    if (!resolver) {
      logger.warn('No cron resolver for entity type', { entityType: params.entityType });
      return [];
    }

    const paths = await resolver();
    for (const p of paths) allPaths.add(p);

    // Enforce max revalidations per cron run
    const pathsArray = Array.from(allPaths).slice(0, this.maxCronRevalidations);

    if (pathsArray.length === 0) {
      logger.debug('No paths to revalidate for entity type', { entityType: params.entityType });
      return [];
    }

    const results = await this.adapter.revalidateMany({ paths: pathsArray });

    await this.logResults({
      results,
      trigger: 'cron',
      entityType: params.entityType,
    });

    return results;
  }

  // --- Private entity-specific path resolvers ---
  // Each resolver queries the DB for all active entities of a type and returns their affected paths.
  // Called by revalidateByEntityType(). Uses DB models directly (no permission checks needed for internal use).
  // Note: pageSize: 9999 is intentional — fetch all active entities. The maxCronRevalidations limit
  // in revalidateByEntityType() provides the upper bound on actual revalidation calls.

  private async resolveAccommodationPaths(): Promise<ReadonlyArray<string>> {
    const accModel = new AccommodationModel();
    const destModel = new DestinationModel();
    const { items } = await accModel.findAll({}, { pageSize: 9999 });
    const allPaths: string[] = [];

    for (const acc of items) {
      let destinationPath = '';
      if (acc.destinationId) {
        const dest = await destModel.findById(acc.destinationId);
        if (dest) destinationPath = dest.path ?? '';
      }
      const paths = getAffectedPaths({
        event: {
          entityId: acc.id,
          operation: 'update',
          data: {
            entityType: 'accommodation',
            slug: acc.slug,
            destinationPath,
            isFeatured: acc.isFeatured ?? false,
            type: acc.type,
          },
        },
        locales: this.locales,
      });
      allPaths.push(...paths);
    }
    return allPaths;
  }

  private async resolveDestinationPaths(): Promise<ReadonlyArray<string>> {
    const model = new DestinationModel();
    const { items } = await model.findAll({}, { pageSize: 9999 });
    const allPaths: string[] = [];

    for (const dest of items) {
      const paths = getAffectedPaths({
        event: {
          entityId: dest.id,
          operation: 'update',
          data: {
            entityType: 'destination',
            slug: dest.slug,
            path: dest.path ?? '',
            isFeatured: dest.isFeatured ?? false,
          },
        },
        locales: this.locales,
      });
      allPaths.push(...paths);
    }
    return allPaths;
  }

  private async resolveEventPaths(): Promise<ReadonlyArray<string>> {
    const model = new EventModel();
    const { items } = await model.findAll({}, { pageSize: 9999 });
    const allPaths: string[] = [];

    for (const event of items) {
      const paths = getAffectedPaths({
        event: {
          entityId: event.id,
          operation: 'update',
          data: {
            entityType: 'event',
            slug: event.slug,
            isFeatured: event.isFeatured ?? false,
            category: event.category,
          },
        },
        locales: this.locales,
      });
      allPaths.push(...paths);
    }
    return allPaths;
  }

  private async resolvePostPaths(): Promise<ReadonlyArray<string>> {
    const model = new PostModel();
    const { items } = await model.findAll({}, { pageSize: 9999 });
    const allPaths: string[] = [];

    for (const post of items) {
      // Note: Tag slugs are NOT resolved here to avoid N+1 queries at cron scale.
      // Tag listing pages (/publicaciones/etiqueta/{slug}/) will be covered by
      // the 24h ISR expiration safety net. This is acceptable for the cron resolver.
      // The auto-revalidation hook in PostService DOES resolve tags (single entity context).
      const paths = getAffectedPaths({
        event: {
          entityId: post.id,
          operation: 'update',
          data: {
            entityType: 'post',
            slug: post.slug,
            isFeatured: post.isFeatured ?? false,
            tagSlugs: [],
          },
        },
        locales: this.locales,
      });
      allPaths.push(...paths);
    }
    return allPaths;
  }

  // --- Private helper methods ---

  /**
   * Read revalidation config for an entity type from the revalidation_config table.
   */
  private async getEntityConfig(entityType: string): Promise<{
    enabled: boolean;
    autoRevalidateOnChange: boolean;
    debounceSeconds: number;
    cronIntervalMinutes: number;
  } | null> {
    const configModel = new RevalidationConfigModel();
    return configModel.findByEntityType(entityType);
  }

  /**
   * Log revalidation results to the revalidation_log table.
   */
  private async logResults(params: {
    readonly results: ReadonlyArray<RevalidationResult>;
    readonly trigger: 'auto' | 'manual' | 'cron';
    readonly entityType?: string;
    readonly entityId?: string;
    readonly triggeredBy?: string;
  }): Promise<void> {
    const logModel = new RevalidationLogModel();
    for (const result of params.results) {
      try {
        await logModel.create({
          path: result.path,
          entityType: params.entityType ?? null,
          entityId: params.entityId ?? null,
          trigger: params.trigger,
          triggeredBy: params.triggeredBy ?? null,
          status: result.success ? 'success' : 'failed',
          durationMs: result.durationMs,
          errorMessage: result.error ?? null,
          metadata: null,
        });
      } catch (error) {
        logger.error('Failed to log revalidation result', {
          path: result.path,
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    }
  }
}
```

### 5.7 Service Hook Integration

Each service that manages revalidatable entities must call `RevalidationService.revalidateEntity()` in its `_after*` hooks.

**Dependency Injection Pattern**:

The `RevalidationService` is injected as an **optional dependency** via a module-level singleton. This avoids modifying every service constructor:

**Location**: `packages/service-core/src/revalidation/revalidation-singleton.ts`

```typescript
import type { RevalidationService } from './revalidation.service';

/**
 * Module-level singleton for the RevalidationService.
 * Initialized once at API app startup. Services access it via getRevalidationService().
 * Returns undefined if not initialized (e.g., in tests or CLI scripts).
 */
let _instance: RevalidationService | undefined;

export function initializeRevalidationService(service: RevalidationService): void {
  _instance = service;
}

export function getRevalidationService(): RevalidationService | undefined {
  return _instance;
}
```

**API app initialization** (in `apps/api/src/app.ts`, inside the `initApp()` function):

```typescript
import { createRevalidationAdapter } from './lib/revalidation';
import { RevalidationService, initializeRevalidationService } from '@repo/service-core';

// In apps/api/src/app.ts, inside the initApp() function.
// NOTE: initApp() does NOT perform database initialization — that happens in
// apps/api/src/index.ts via initializeDatabase() BEFORE initApp() is called.
// However, since RevalidationService only accesses the DB when its methods are
// invoked (not at construction time), it is safe to initialize it here.
// The DB will already be initialized by the time any service method is called.
//
// Use `locales` from @repo/i18n instead of hardcoding to keep in sync:
import { locales } from '@repo/i18n';

const revalidationAdapter = createRevalidationAdapter();
const revalidationService = new RevalidationService({
  adapter: revalidationAdapter,
  locales: locales, // ['es', 'en', 'pt'] from @repo/i18n
});
initializeRevalidationService(revalidationService);
```

**Services to modify** (all in `packages/service-core/src/services/`):

**Important**: All `_after*` hooks receive an `Actor` parameter alongside the entity/result. The `_afterCreate` and `_afterUpdate` hooks receive the entity; `_afterSoftDelete`, `_afterHardDelete`, and `_afterRestore` hooks receive `{ count: number }` (not the entity). For delete/restore hooks, entity data must be captured in the corresponding `_before*` hook.

**Additional hooks to implement**: Beyond create/update/delete, two more hook types need revalidation:
- **`_afterRestore`**: When a soft-deleted entity is restored, its pages become visible again. Without revalidation, the cached 404/redirect would persist. Add `_afterRestore` hooks to AccommodationService, DestinationService, EventService, PostService. Use the same `_before*` capture pattern as delete hooks.
- **`_afterUpdateVisibility`**: When an entity's visibility changes (e.g., `PUBLISHED` -> `DRAFT`), the cached page must be revalidated to stop showing content that should be hidden. Add `_afterUpdateVisibility` hooks where visibility changes are supported.

**Warning about `DestinationService` and `PostService`**: Both services override the `update()` method directly (not just `_beforeUpdate`). Verify that the overridden `update()` method calls `super.update()` and that `super.update()` invokes `_afterUpdate`. If the override bypasses the hook chain, `_afterUpdate` won't fire and revalidation won't trigger. In that case, add the revalidation call directly inside the overridden `update()` method.

| Service | File Path | Hooks to Add Revalidation | Entity Data to Pass | Data Resolution Strategy |
|---------|-----------|--------------------------|-------------------|--------------------------|
| `AccommodationService` | `accommodation/accommodation.service.ts` | `_afterCreate` (extend existing), `_afterUpdate` (new override), `_afterSoftDelete` (extend existing), `_afterHardDelete` (extend existing), `_afterRestore` (new) | `slug`, `destinationPath`, `isFeatured`, `type` | `_afterCreate`/`_afterUpdate`: entity is available directly. For `_afterSoftDelete`/`_afterHardDelete`: use existing `_beforeSoftDelete`/`_beforeHardDelete` pattern to capture entity data before deletion. For `_afterRestore`: capture in `_beforeRestore` (new). Resolve `destinationPath` via destination model. Note: this service already has `_beforeCreate` and `_beforeHardDelete` overrides. |
| `DestinationService` | `destination/destination.service.ts` | `_afterCreate` (new override), `_afterUpdate` (new override), `_afterSoftDelete` (new), `_afterHardDelete` (new), `_afterRestore` (new) | `slug`, `path` (from entity's `path` field, e.g., `/argentina/litoral/entre-rios`), `isFeatured` | Entity has `path` and `slug` fields directly. For delete/restore hooks: capture in `_before*` hooks. **Warning**: This service overrides `update()` directly; verify `_afterUpdate` fires correctly (see note above). |
| `EventService` | `event/event.service.ts` | `_afterCreate` (new override), `_afterUpdate` (new override), `_afterSoftDelete` (new), `_afterHardDelete` (new), `_afterRestore` (new) | `slug`, `isFeatured`, `category` | Entity has all fields directly. For delete/restore hooks: capture in `_before*` hooks. Category must be mapped via `EVENT_CATEGORY_TO_URL_SLUG` to get the URL slug. |
| `PostService` | `post/post.service.ts` | `_afterCreate` (new override), `_afterUpdate` (new override), `_afterSoftDelete` (new), `_afterHardDelete` (new), `_afterRestore` (new) | `slug`, `isFeatured`, `tagSlugs` | Entity has `slug` and `isFeatured`. Tags must be queried from `r_entity_tag` table where `entityType = 'post'` and `entityId = entity.id`. **Warning**: This service overrides `update()` directly; verify `_afterUpdate` fires correctly (see note above). |
| `AccommodationReviewService` | `accommodationReview/accommodationReview.service.ts` | `_afterCreate` (extend existing), `_afterSoftDelete` (extend existing) | `accommodationSlug` | `_afterCreate`: resolve accommodation slug from `entity.accommodationId` via AccommodationModel. `_afterSoftDelete`: use already-captured `_lastDeletedAccommodationId` from existing `_beforeSoftDelete`. |
| `DestinationReviewService` | `destinationReview/destinationReview.service.ts` | `_afterCreate` (extend existing), `_afterSoftDelete` (extend existing) | `destinationPath` | Same pattern as AccommodationReview but resolve destination path instead. |
| `TagService` | `tag/tag.service.ts` | `_afterUpdate` (new), `_afterSoftDelete` (new), `_afterHardDelete` (new) | `accommodationSlugs` + `destinationPaths` | Query `r_entity_tag` table for `entityType = 'accommodation'` to find all accommodations using this tag, then resolve their destination paths. |
| `AmenityService` | `amenity/amenity.service.ts` | `_afterUpdate` (new), `_afterSoftDelete` (new), `_afterHardDelete` (new) | `accommodationSlugs` + `destinationPaths` | Query `r_accommodation_amenity` junction table for all accommodations with this amenity, then resolve their destination paths. |

**Hook implementation pattern** (AccommodationService example):

```typescript
// In AccommodationService

import { getRevalidationService } from '../../revalidation/revalidation-singleton';
import { DestinationModel } from '@repo/db';

/**
 * NEW override: _afterUpdate does not currently exist in AccommodationService.
 * Add it to trigger revalidation when an accommodation is updated.
 *
 * Hook signature: _afterUpdate(entity: TEntity, actor: Actor): Promise<TEntity>
 */
protected async _afterUpdate(entity: Accommodation, actor: Actor): Promise<Accommodation> {
  // Call parent (no-op in base, but follow convention)
  const result = await super._afterUpdate(entity, actor);

  // Trigger revalidation (fire-and-forget)
  this._triggerRevalidation(result, 'update');

  return result;
}

/**
 * EXTEND existing: _afterCreate already exists (updates destination count).
 * Add revalidation trigger after existing logic.
 */
protected async _afterCreate(entity: Accommodation, actor: Actor): Promise<Accommodation> {
  // Existing business logic (update destination accommodation count)
  const result = await super._afterCreate(entity, actor);

  // Trigger revalidation (fire-and-forget)
  this._triggerRevalidation(result, 'create');

  return result;
}

/**
 * Helper: resolve destination path and trigger revalidation.
 * Private method to avoid duplicating this logic in every hook.
 * Fire-and-forget: errors are logged but never thrown.
 */
private _triggerRevalidation(
  entity: Accommodation,
  operation: 'create' | 'update' | 'delete',
): void {
  const revalidationService = getRevalidationService();
  if (!revalidationService) return;

  // Resolve destination path from destinationId (async, fire-and-forget)
  (async () => {
    let destinationPath = '';
    if (entity.destinationId) {
      try {
        // Use a local DestinationModel instance to avoid permission checks.
        // AccommodationService has this.destinationService (a DestinationService),
        // but we use the model directly for lightweight internal lookups.
        const destinationModel = new DestinationModel();
        const dest = await destinationModel.findById(entity.destinationId);
        if (dest) {
          destinationPath = dest.path ?? '';
        }
      } catch {
        // If destination lookup fails, proceed without it
      }
    }

    await revalidationService.revalidateEntity({
      event: {
        entityId: entity.id,
        operation,
        data: {
          entityType: 'accommodation',
          slug: entity.slug,
          destinationPath,
          isFeatured: entity.isFeatured ?? false,
          type: entity.type,
        },
      },
    });
  })().catch((error) => {
    // Fire-and-forget: log but never fail the CRUD operation
    this.logger.error('Revalidation trigger failed', {
      entityType: 'accommodation',
      entityId: entity.id,
      error: error instanceof Error ? error.message : 'Unknown',
    });
  });
}

/**
 * For delete hooks: _afterSoftDelete and _afterHardDelete receive { count: number },
 * NOT the entity. Entity data must be captured BEFORE deletion.
 *
 * AccommodationService already has _beforeSoftDelete which captures the entity.
 * Extend it to also store revalidation data.
 */
private _lastDeletedRevalidationData?: {
  entityId: string;
  slug: string;
  destinationPath: string;
  type?: string;
};

protected async _beforeSoftDelete(id: string, actor: Actor): Promise<string> {
  // Existing logic (capture entity for destination count update)
  const result = await super._beforeSoftDelete(id, actor);

  // Capture revalidation data before entity is deleted
  try {
    const entity = await this.model.findById(id);
    if (entity) {
      let destinationPath = '';
      if (entity.destinationId) {
        const destinationModel = new DestinationModel();
        const dest = await destinationModel.findById(entity.destinationId);
        if (dest) destinationPath = dest.path ?? '';
      }
      this._lastDeletedRevalidationData = {
        entityId: id,
        slug: entity.slug,
        destinationPath,
        type: entity.type,
      };
    }
  } catch {
    // Non-critical: proceed without revalidation data
  }

  return result;
}

protected async _afterSoftDelete(
  result: { count: number },
  actor: Actor,
): Promise<{ count: number }> {
  // Existing logic (update destination count)
  const res = await super._afterSoftDelete(result, actor);

  // Trigger revalidation with captured data
  if (this._lastDeletedRevalidationData) {
    const data = this._lastDeletedRevalidationData;
    this._lastDeletedRevalidationData = undefined;

    const revalidationService = getRevalidationService();
    if (revalidationService) {
      revalidationService.revalidateEntity({
        event: {
          entityId: data.entityId,
          operation: 'delete',
          data: {
            entityType: 'accommodation',
            slug: data.slug,
            destinationPath: data.destinationPath,
            isFeatured: false, // Deleted entity is no longer featured
            type: data.type,
          },
        },
      }).catch((error) => {
        this.logger.error('Revalidation trigger failed after delete', {
          entityId: data.entityId,
          error: error instanceof Error ? error.message : 'Unknown',
        });
      });
    }
  }

  return res;
}
```

**Note**: The `_afterHardDelete` hook follows the same pattern as `_afterSoftDelete` above. Both capture entity data in a `_before*` hook and trigger revalidation in the `_after*` hook.

**Hook implementation for Tag** (polymorphic relation via `r_entity_tag`):

```typescript
// In TagService (extends BaseCrudRelatedService)
//
// Tags use a POLYMORPHIC relation table: r_entity_tag
//   Columns: entityType (text), entityId (uuid), tagId (uuid)
// To find accommodations using a tag, query:
//   SELECT * FROM r_entity_tag WHERE tagId = ? AND entityType = 'accommodation'
// Then resolve accommodation slugs and their destination paths.

import { getRevalidationService } from '../../revalidation/revalidation-singleton';
import { getDb, rEntityTag } from '@repo/db';
import { eq, and } from 'drizzle-orm';

protected async _afterUpdate(entity: Tag, actor: Actor): Promise<Tag> {
  const result = await super._afterUpdate(entity, actor);

  const revalidationService = getRevalidationService();
  if (revalidationService) {
    (async () => {
      // Query the polymorphic relation table for accommodations using this tag
      const db = getDb();
      const tagRelations = await db
        .select()
        .from(rEntityTag)
        .where(
          and(
            eq(rEntityTag.tagId, entity.id),
            eq(rEntityTag.entityType, 'accommodation'),
          ),
        );

      if (tagRelations.length === 0) return;

      // Resolve accommodation slugs and destination paths
      const accommodationIds = tagRelations.map((r) => r.entityId);
      const accommodationModel = new AccommodationModel();
      const destinationModel = new DestinationModel();

      const accommodationSlugs: string[] = [];
      const destinationPaths: string[] = [];

      for (const accId of accommodationIds) {
        const acc = await accommodationModel.findById(accId);
        if (acc) {
          accommodationSlugs.push(acc.slug);
          if (acc.destinationId) {
            const dest = await destinationModel.findById(acc.destinationId);
            if (dest?.path) destinationPaths.push(dest.path);
          }
        }
      }

      await revalidationService.revalidateEntity({
        event: {
          entityId: entity.id,
          operation: 'update',
          data: {
            entityType: 'tag',
            accommodationSlugs,
            destinationPaths: [...new Set(destinationPaths)],
          },
        },
      });
    })().catch((error) => {
      this.logger.error('Revalidation trigger failed', {
        entityType: 'tag',
        entityId: entity.id,
        error: error instanceof Error ? error.message : 'Unknown',
      });
    });
  }

  return result;
}
```

**Hook implementation for Amenity** (junction table `r_accommodation_amenity`):

```typescript
// In AmenityService (extends BaseCrudRelatedService)
//
// Amenities use a JUNCTION table: r_accommodation_amenity
//   PK: [accommodationId, amenityId]
// Query: SELECT * FROM r_accommodation_amenity WHERE amenityId = ?
// Same revalidation pattern as TagService, but simpler query.

import { getRevalidationService } from '../../revalidation/revalidation-singleton';
import { getDb, rAccommodationAmenity } from '@repo/db';
import { eq } from 'drizzle-orm';

protected async _afterUpdate(entity: Amenity, actor: Actor): Promise<Amenity> {
  const result = await super._afterUpdate(entity, actor);

  const revalidationService = getRevalidationService();
  if (revalidationService) {
    (async () => {
      const db = getDb();
      const amenityRelations = await db
        .select()
        .from(rAccommodationAmenity)
        .where(eq(rAccommodationAmenity.amenityId, entity.id));

      if (amenityRelations.length === 0) return;

      const accommodationModel = new AccommodationModel();
      const destinationModel = new DestinationModel();

      const accommodationSlugs: string[] = [];
      const destinationPaths: string[] = [];

      for (const rel of amenityRelations) {
        const acc = await accommodationModel.findById(rel.accommodationId);
        if (acc) {
          accommodationSlugs.push(acc.slug);
          if (acc.destinationId) {
            const dest = await destinationModel.findById(acc.destinationId);
            if (dest?.path) destinationPaths.push(dest.path);
          }
        }
      }

      await revalidationService.revalidateEntity({
        event: {
          entityId: entity.id,
          operation: 'update',
          data: {
            entityType: 'amenity',
            accommodationSlugs,
            destinationPaths: [...new Set(destinationPaths)],
          },
        },
      });
    })().catch((error) => {
      this.logger.error('Revalidation trigger failed', {
        entityType: 'amenity',
        entityId: entity.id,
        error: error instanceof Error ? error.message : 'Unknown',
      });
    });
  }

  return result;
}
```

**Critical rules**:
- Revalidation is **fire-and-forget**. It must NEVER block or fail the CRUD operation. Errors are logged but swallowed with `.catch()`.
- The cron job acts as a safety net for failed revalidations.
- If `getRevalidationService()` returns `undefined` (tests, CLI scripts), revalidation is silently skipped.

### 5.8 Debouncing Strategy

When an admin rapidly edits an entity (e.g., save, fix typo, save again), we avoid triggering multiple revalidations.

**Mechanism**: In-memory debounce map keyed by `entityType:entityId` inside `RevalidationService`.

**Debounce window**: Configurable per entity type in `revalidation_config` table (default 30 seconds).

**Manual revalidation bypasses debouncing**: When a super admin clicks "Regenerar", the revalidation happens immediately without debounce.

**Serverless limitation**: The in-memory `Map<string, NodeJS.Timeout>` and `setTimeout` approach has a known limitation on Vercel serverless: each request may execute in a different instance, and instances are destroyed between requests. This means:
- The debounce window is **best-effort**, not guaranteed. Two rapid edits from different requests may both trigger revalidation if they hit different instances.
- This is **acceptable** because revalidation is idempotent (revalidating the same path twice is harmless, just slightly wasteful).
- The debounce primarily helps during batch operations within a single long-running request (e.g., cron job processing multiple entities).
- If precise debouncing becomes critical in the future, consider using Redis with TTL keys (`SET key value EX 30 NX`) instead of in-memory state.
- The `maxCronRevalidations` limit (500) and chunk processing (10 at a time, 200ms delay) provide additional protection against excessive revalidation.

## 6. Database Schema

Two new tables in `packages/db/src/schemas/revalidation/`.

### 6.1 `revalidation_config` Table

Stores revalidation configuration per entity type. Editable from admin panel.

**Location**: `packages/db/src/schemas/revalidation/revalidation-config.dbschema.ts`

```typescript
import { boolean, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Configuration for per-entity-type revalidation behavior.
 * Controls auto-revalidation, cron intervals, and debounce settings.
 */
export const revalidationConfig = pgTable(
  'revalidation_config',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // `.unique()` on entityType already creates a unique index in PostgreSQL.
    // No additional explicit index is needed.
    entityType: text('entity_type').notNull().unique(),
    autoRevalidateOnChange: boolean('auto_revalidate_on_change').notNull().default(true),
    cronIntervalMinutes: integer('cron_interval_minutes').notNull().default(1440),
    debounceSeconds: integer('debounce_seconds').notNull().default(30),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  // No additional indexes needed: entityType.unique() already creates a unique index.
);
```

### 6.2 `revalidation_log` Table

Audit trail of all revalidation events.

**Location**: `packages/db/src/schemas/revalidation/revalidation-log.dbschema.ts`

```typescript
import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Audit log for all revalidation events (auto, manual, cron).
 * Used for debugging, monitoring, and stale detection.
 * Entries older than 30 days are cleaned up by the cron job.
 */
export const revalidationLog = pgTable(
  'revalidation_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    path: text('path').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    trigger: text('trigger').notNull(), // 'auto' | 'manual' | 'cron'
    triggeredBy: text('triggered_by'), // User ID for manual triggers
    status: text('status').notNull(), // 'success' | 'failed'
    durationMs: integer('duration_ms'),
    errorMessage: text('error_message'),
    metadata: text('metadata'), // JSON string for extra context (e.g., { reason: 'stale_detection' })
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    revalidation_log_entity_type_idx: index('revalidation_log_entity_type_idx').on(
      table.entityType,
    ),
    revalidation_log_trigger_idx: index('revalidation_log_trigger_idx').on(table.trigger),
    revalidation_log_created_at_idx: index('revalidation_log_created_at_idx').on(
      table.createdAt,
    ),
    revalidation_log_path_idx: index('revalidation_log_path_idx').on(table.path),
  }),
);
```

**Barrel export**: Create `packages/db/src/schemas/revalidation/index.ts`:

```typescript
export { revalidationConfig } from './revalidation-config.dbschema';
export { revalidationLog } from './revalidation-log.dbschema';
```

**IMPORTANT - Update `packages/db/src/schemas/index.ts`**:

The `packages/db/src/schemas/index.ts` exports all schema tables. Add:
```typescript
export * from './revalidation/index';
```
Check the exact format used by other schema domains in this file (e.g., `export * from './accommodation/index'`).

**IMPORTANT - Create `packages/db/src/models/revalidation/index.ts`**:

```typescript
export { RevalidationConfigModel } from './revalidation-config.model';
export { RevalidationLogModel } from './revalidation-log.model';
```

**IMPORTANT - Update `packages/db/src/models/index.ts`**:

Add:
```typescript
export * from './revalidation/index';
```
This makes `RevalidationConfigModel` and `RevalidationLogModel` available via `import { RevalidationConfigModel } from '@repo/db'`.

**Drizzle config**: The existing `packages/db/drizzle.config.ts` has `schema: ['./src/schemas', ...]` which auto-discovers subdirectories. No config change needed. Verify after creating files by running `pnpm db:generate`.

**Log retention**: 30 days, hardcoded in the cron job (see Section 10). Configurable in the future via env var if needed.

### 6.3 Database Models

Create Drizzle models following the BaseModel pattern.

**Location**: `packages/db/src/models/revalidation/revalidation-config.model.ts`

```typescript
import { BaseModel } from '../../base/base.model';
import { revalidationConfig } from '../../schemas/revalidation/revalidation-config.dbschema';

/**
 * Model for revalidation_config table operations.
 */
export class RevalidationConfigModel extends BaseModel<typeof revalidationConfig.$inferSelect> {
  protected table = revalidationConfig;
  protected entityName = 'revalidation_config';

  protected getTableName(): string {
    return 'revalidation_config';
  }

  /**
   * Find configuration for a specific entity type.
   */
  async findByEntityType(entityType: string) {
    return this.findOne({ entityType });
  }

  /**
   * Get all enabled configurations.
   */
  async findAllEnabled(): Promise<Array<typeof revalidationConfig.$inferSelect>> {
    const result = await this.findAll({ enabled: true });
    return result.items;
  }
}
```

**Location**: `packages/db/src/models/revalidation/revalidation-log.model.ts`

```typescript
import { and, desc, eq, lt } from 'drizzle-orm';
import { BaseModel } from '../../base/base.model';
import { revalidationLog } from '../../schemas/revalidation/revalidation-log.dbschema';

/**
 * Model for revalidation_log table operations.
 */
export class RevalidationLogModel extends BaseModel<typeof revalidationLog.$inferSelect> {
  protected table = revalidationLog;
  protected entityName = 'revalidation_log';

  protected getTableName(): string {
    return 'revalidation_log';
  }

  /**
   * Delete log entries older than the specified date.
   * Returns the number of deleted rows.
   *
   * NOTE: Drizzle ORM's .delete() does NOT expose a `rowCount` property on its
   * typed result. Use .returning() to collect deleted rows and return .length.
   * This also avoids relying on the underlying pg driver's rowCount behavior.
   */
  async deleteOlderThan(date: Date): Promise<number> {
    const db = this.getClient();
    const deleted = await db
      .delete(this.table)
      .where(lt(this.table.createdAt, date))
      .returning({ id: this.table.id });
    return deleted.length;
  }

  /**
   * Find the most recent cron-triggered entry for an entity type.
   */
  async findLastCronEntry(entityType: string): Promise<typeof revalidationLog.$inferSelect | null> {
    const db = this.getClient();
    const result = await db
      .select()
      .from(this.table)
      .where(
        and(
          eq(this.table.entityType, entityType),
          eq(this.table.trigger, 'cron'),
        )
      )
      .orderBy(desc(this.table.createdAt))
      .limit(1);
    return (result[0] as typeof revalidationLog.$inferSelect) ?? null;
  }
}
```

### 6.4 Seed Data

**Location**: `packages/seed/src/data/revalidation-config/`

Create JSON files for each entity type's default configuration.

**File**: `packages/seed/src/data/revalidation-config/defaults.json`

```json
[
  {
    "entityType": "accommodation",
    "autoRevalidateOnChange": true,
    "cronIntervalMinutes": 1440,
    "debounceSeconds": 30,
    "enabled": true
  },
  {
    "entityType": "destination",
    "autoRevalidateOnChange": true,
    "cronIntervalMinutes": 1440,
    "debounceSeconds": 30,
    "enabled": true
  },
  {
    "entityType": "event",
    "autoRevalidateOnChange": true,
    "cronIntervalMinutes": 360,
    "debounceSeconds": 30,
    "enabled": true
  },
  {
    "entityType": "post",
    "autoRevalidateOnChange": true,
    "cronIntervalMinutes": 1440,
    "debounceSeconds": 30,
    "enabled": true
  },
  {
    "entityType": "accommodation_review",
    "autoRevalidateOnChange": true,
    "cronIntervalMinutes": 1440,
    "debounceSeconds": 15,
    "enabled": true
  },
  {
    "entityType": "destination_review",
    "autoRevalidateOnChange": true,
    "cronIntervalMinutes": 1440,
    "debounceSeconds": 15,
    "enabled": true
  },
  {
    "entityType": "tag",
    "autoRevalidateOnChange": true,
    "cronIntervalMinutes": 4320,
    "debounceSeconds": 60,
    "enabled": true
  },
  {
    "entityType": "amenity",
    "autoRevalidateOnChange": true,
    "cronIntervalMinutes": 4320,
    "debounceSeconds": 60,
    "enabled": true
  }
]
```

**Rationale for defaults**:
- Events have shorter cron intervals (6h = 360min) because event dates/status change frequently
- Tags/amenities have longer intervals (72h = 4320min) because they change rarely
- Reviews have shorter debounce (15s) because they are created individually, not edited repeatedly

**Seed function**: `packages/seed/src/required/revalidation-config.seed.ts`

```typescript
import { RevalidationConfigModel } from '@repo/db';
import type { SeedContext } from '../types';
import defaults from '../data/revalidation-config/defaults.json';

/**
 * Seeds the revalidation_config table with default values for each entity type.
 * Uses upsert to avoid duplicates on re-runs.
 * Follows the SeedContext pattern used by all required seeds.
 */
export async function seedRevalidationConfig(context: SeedContext): Promise<void> {
  const { logger } = context;
  const model = new RevalidationConfigModel();

  for (const config of defaults) {
    const existing = await model.findByEntityType(config.entityType);
    if (!existing) {
      await model.create(config);
      logger?.info(`Seeded revalidation config for ${config.entityType}`);
    }
  }
}
```

Register in the seed manifest/runner (wherever `packages/seed/src/required/` seeds are registered).

### 6.5 Zod Schemas

**Location**: `packages/schemas/src/entities/revalidation/`

Following the codebase convention of multiple files per entity:

**File**: `packages/schemas/src/entities/revalidation/revalidation-config.schema.ts`

```typescript
import { z } from 'zod';

export const RevalidationEntityTypeEnum = z.enum([
  'accommodation',
  'destination',
  'event',
  'post',
  'accommodation_review',
  'destination_review',
  'tag',
  'amenity',
]);
export type RevalidationEntityType = z.infer<typeof RevalidationEntityTypeEnum>;

export const RevalidationConfigSchema = z.object({
  id: z.string().uuid(),
  entityType: RevalidationEntityTypeEnum,
  autoRevalidateOnChange: z.boolean(),
  cronIntervalMinutes: z.number().int().min(5).max(10080), // 5 min to 7 days
  debounceSeconds: z.number().int().min(5).max(300), // 5s to 5min
  enabled: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type RevalidationConfig = z.infer<typeof RevalidationConfigSchema>;
```

**File**: `packages/schemas/src/entities/revalidation/revalidation-config.crud.schema.ts`

```typescript
import { z } from 'zod';

export const UpdateRevalidationConfigInputSchema = z.object({
  autoRevalidateOnChange: z.boolean().optional(),
  cronIntervalMinutes: z.number().int().min(5).max(10080).optional(),
  debounceSeconds: z.number().int().min(5).max(300).optional(),
  enabled: z.boolean().optional(),
});
export type UpdateRevalidationConfigInput = z.infer<typeof UpdateRevalidationConfigInputSchema>;
```

**File**: `packages/schemas/src/entities/revalidation/revalidation-log.schema.ts`

```typescript
import { z } from 'zod';
import { RevalidationEntityTypeEnum } from './revalidation-config.schema';

export const RevalidationTriggerEnum = z.enum(['auto', 'manual', 'cron']);
export type RevalidationTrigger = z.infer<typeof RevalidationTriggerEnum>;

export const RevalidationStatusEnum = z.enum(['success', 'failed']);
export type RevalidationStatus = z.infer<typeof RevalidationStatusEnum>;

export const RevalidationLogSchema = z.object({
  id: z.string().uuid(),
  path: z.string(),
  entityType: RevalidationEntityTypeEnum.nullable(),
  entityId: z.string().nullable(),
  trigger: RevalidationTriggerEnum,
  triggeredBy: z.string().nullable(),
  status: RevalidationStatusEnum,
  durationMs: z.number().int().nullable(),
  errorMessage: z.string().nullable(),
  metadata: z.string().nullable(),
  createdAt: z.coerce.date(),
});
export type RevalidationLog = z.infer<typeof RevalidationLogSchema>;
```

**File**: `packages/schemas/src/entities/revalidation/revalidation-log.query.schema.ts`

```typescript
import { z } from 'zod';
import { RevalidationEntityTypeEnum } from './revalidation-config.schema';
import { RevalidationStatusEnum, RevalidationTriggerEnum } from './revalidation-log.schema';

export const RevalidationLogFilterSchema = z.object({
  entityType: RevalidationEntityTypeEnum.optional(),
  trigger: RevalidationTriggerEnum.optional(),
  status: RevalidationStatusEnum.optional(),
  path: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
export type RevalidationLogFilter = z.infer<typeof RevalidationLogFilterSchema>;
```

**File**: `packages/schemas/src/entities/revalidation/revalidation.http.schema.ts`

```typescript
import { z } from 'zod';
import { RevalidationEntityTypeEnum } from './revalidation-config.schema';

/** Request body for POST /api/v1/admin/revalidation/revalidate */
export const ManualRevalidateRequestSchema = z.object({
  paths: z.array(z.string().startsWith('/')).min(1).max(100),
  reason: z.string().min(1).max(500),
});
export type ManualRevalidateRequest = z.infer<typeof ManualRevalidateRequestSchema>;

/** Request body for POST /api/v1/admin/revalidation/revalidate-entity */
export const RevalidateEntityRequestSchema = z.object({
  entityType: RevalidationEntityTypeEnum,
  entityId: z.string().uuid(),
});
export type RevalidateEntityRequest = z.infer<typeof RevalidateEntityRequestSchema>;

/** Request body for POST /api/v1/admin/revalidation/revalidate-type */
export const RevalidateTypeRequestSchema = z.object({
  entityType: RevalidationEntityTypeEnum,
});
export type RevalidateTypeRequest = z.infer<typeof RevalidateTypeRequestSchema>;

/** Response for revalidation results */
export const RevalidationResultSchema = z.object({
  path: z.string(),
  success: z.boolean(),
  durationMs: z.number(),
  error: z.string().optional(),
});

export const RevalidationSummarySchema = z.object({
  total: z.number(),
  succeeded: z.number(),
  failed: z.number(),
});

export const RevalidationResponseSchema = z.object({
  results: z.array(RevalidationResultSchema),
  summary: RevalidationSummarySchema,
});
export type RevalidationResponse = z.infer<typeof RevalidationResponseSchema>;

/** Response for stats endpoint */
export const RevalidationStatsSchema = z.object({
  last24h: RevalidationSummarySchema,
  last7d: RevalidationSummarySchema,
  byTrigger: z.record(z.string(), z.number()),
  byEntityType: z.record(z.string(), z.number()),
  lastRevalidation: z.coerce.date().nullable(),
  lastCronRun: z.coerce.date().nullable(),
});
export type RevalidationStats = z.infer<typeof RevalidationStatsSchema>;
```

**File**: `packages/schemas/src/entities/revalidation/index.ts`

```typescript
// Config schemas
export * from './revalidation-config.schema';
export * from './revalidation-config.crud.schema';

// Log schemas
export * from './revalidation-log.schema';
export * from './revalidation-log.query.schema';

// HTTP schemas (API request/response)
export * from './revalidation.http.schema';
```

**IMPORTANT - Update `packages/schemas/src/entities/index.ts`**:

Add to the entity index (following the existing pattern with `.js` extension):
```typescript
export * from './revalidation/index.js';
```

This is the only change needed to expose all revalidation Zod schemas via `import { RevalidationConfigSchema, ... } from '@repo/schemas'`. The `packages/schemas/src/index.ts` already re-exports everything from `entities/index.ts`.

## 7. API Endpoints

All endpoints require the appropriate revalidation permission (see Section 8).

**Route file location**: `apps/api/src/routes/revalidation/admin/`

**Route mounting** (add to `apps/api/src/routes/index.ts`):
```typescript
import { adminRevalidationRoutes } from './revalidation/admin/index';

// In the admin routes section:
app.route('/api/v1/admin/revalidation', adminRevalidationRoutes);
```

### 7.1 Manual Revalidation

**File**: `apps/api/src/routes/revalidation/admin/revalidate.ts`

```typescript
import {
  ManualRevalidateRequestSchema,
  RevalidationResponseSchema,
  PermissionEnum,
  type ManualRevalidateRequest,
  type ServiceErrorCode,
} from '@repo/schemas';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';
import { getRevalidationService } from '@repo/service-core';

export const adminRevalidateRoute = createAdminRoute({
  method: 'post',
  path: '/revalidate',
  summary: 'Trigger manual revalidation',
  description: 'Revalidates specific paths immediately. No debouncing.',
  tags: ['Revalidation'],
  requiredPermissions: [PermissionEnum.REVALIDATION_TRIGGER],
  requestBody: ManualRevalidateRequestSchema,
  responseSchema: RevalidationResponseSchema,
  handler: async (
    ctx: Context,
    _params: Record<string, unknown>,
    body: Record<string, unknown>,
  ) => {
    const actor = getActorFromContext(ctx);
    const data = body as ManualRevalidateRequest;
    const revalidationService = getRevalidationService();

    if (!revalidationService) {
      throw new Error('Revalidation service not initialized');
    }

    const results = await revalidationService.revalidatePaths({
      paths: data.paths,
      reason: data.reason,
      triggeredBy: actor.id,
    });

    return {
      results,
      summary: {
        total: results.length,
        succeeded: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
      },
    };
  },
});
```

**Response** (200):
```json
{
  "success": true,
  "data": {
    "results": [
      { "path": "/es/alojamientos/hotel-ejemplo/", "success": true, "durationMs": 245 },
      { "path": "/en/alojamientos/hotel-ejemplo/", "success": true, "durationMs": 312 }
    ],
    "summary": { "total": 2, "succeeded": 2, "failed": 0 }
  }
}
```

### 7.2 Revalidate by Entity

```
POST /api/v1/admin/revalidation/revalidate-entity
```

**File**: `apps/api/src/routes/revalidation/admin/revalidate-entity.ts`

Uses `RevalidateEntityRequestSchema` (`{ entityType, entityId }`).

The handler must look up the entity from the database, build an `EntityChangeData` object, call `getAffectedPaths()` to determine which URLs to invalidate, then call `revalidatePaths()`.

**Critical**: The handler needs a `resolveEntityData()` helper that switches on `entityType` to load the entity from the correct model and build `EntityChangeData`. This is similar to the `resolveAccommodationPaths()` private method in `RevalidationService.revalidateByEntityType()`.

```typescript
import {
  RevalidateEntityRequestSchema,
  RevalidationResponseSchema,
  PermissionEnum,
  type RevalidateEntityRequest,
} from '@repo/schemas';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { createAdminRoute } from '../../../utils/route-factory';
import { getRevalidationService, getAffectedPaths } from '@repo/service-core';
import {
  AccommodationModel,
  DestinationModel,
  EventModel,
  PostModel,
} from '@repo/db';

/**
 * Resolves EntityChangeData for an entity by loading it from the DB.
 * Returns null if entity not found or entityType not supported.
 */
async function resolveEntityData(
  entityType: string,
  entityId: string,
): Promise<import('@repo/service-core').EntityChangeData | null> {
  switch (entityType) {
    case 'accommodation': {
      const model = new AccommodationModel();
      const acc = await model.findById(entityId);
      if (!acc) return null;
      let destinationPath = '';
      if (acc.destinationId) {
        const destModel = new DestinationModel();
        const dest = await destModel.findById(acc.destinationId);
        if (dest) destinationPath = dest.path ?? '';
      }
      return {
        entityType: 'accommodation',
        slug: acc.slug,
        destinationPath,
        isFeatured: acc.isFeatured ?? false,
        type: acc.type,
      };
    }
    case 'destination': {
      const model = new DestinationModel();
      const dest = await model.findById(entityId);
      if (!dest) return null;
      return {
        entityType: 'destination',
        slug: dest.slug,
        path: dest.path ?? '',
        isFeatured: dest.isFeatured ?? false,
      };
    }
    case 'event': {
      const model = new EventModel();
      const event = await model.findById(entityId);
      if (!event) return null;
      return {
        entityType: 'event',
        slug: event.slug,
        isFeatured: event.isFeatured ?? false,
        category: event.category,
      };
    }
    case 'post': {
      const model = new PostModel();
      const post = await model.findById(entityId);
      if (!post) return null;
      // NOTE: For tag slugs, query r_entity_tag WHERE entityType='post' AND entityId=entityId
      // For simplicity in manual revalidation, pass empty tagSlugs (all post paths still revalidated)
      return {
        entityType: 'post',
        slug: post.slug,
        isFeatured: post.isFeatured ?? false,
        tagSlugs: [], // Tag listing pages not revalidated by manual entity button (acceptable for V1)
      };
    }
    default:
      return null;
  }
}

export const adminRevalidateEntityRoute = createAdminRoute({
  method: 'post',
  path: '/revalidate-entity',
  summary: 'Trigger manual revalidation for a specific entity',
  description: 'Loads entity from DB, resolves affected paths, and revalidates immediately. No debouncing.',
  tags: ['Revalidation'],
  requiredPermissions: [PermissionEnum.REVALIDATION_TRIGGER],
  requestBody: RevalidateEntityRequestSchema,
  responseSchema: RevalidationResponseSchema,
  handler: async (
    ctx: Context,
    _params: Record<string, unknown>,
    body: Record<string, unknown>,
  ) => {
    const actor = getActorFromContext(ctx);
    const data = body as RevalidateEntityRequest;
    const revalidationService = getRevalidationService();

    if (!revalidationService) {
      throw new Error('Revalidation service not initialized');
    }

    const entityData = await resolveEntityData(data.entityType, data.entityId);
    if (!entityData) {
      throw new Error(`Entity not found: ${data.entityType} ${data.entityId}`);
    }

    // Import locales for path expansion
    const { locales } = await import('@repo/i18n');
    const paths = getAffectedPaths({
      event: { entityId: data.entityId, operation: 'update', data: entityData },
      locales,
    });

    const results = await revalidationService.revalidatePaths({
      paths,
      reason: `Manual revalidation for ${data.entityType} ${data.entityId}`,
      triggeredBy: actor.id,
    });

    return {
      results,
      summary: {
        total: results.length,
        succeeded: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
      },
    };
  },
});
```

**Note**: `EventModel` and `PostModel` must be exported from `@repo/db`. Verify they are already in `packages/db/src/models/index.ts`. If not, add the exports.

**Note on tag slugs**: For `post` entity revalidation, tag listing pages (`/publicaciones/etiqueta/{slug}/`) are NOT revalidated by this endpoint (tagSlugs is empty). This is acceptable for V1 manual revalidation. The auto-revalidation hook in PostService DOES query the tags. If needed, add a DB query here as well following the same pattern as the service hook.

### 7.3 Revalidate by Entity Type (Batch)

```
POST /api/v1/admin/revalidation/revalidate-type
```

**File**: `apps/api/src/routes/revalidation/admin/revalidate-type.ts`

Uses `RevalidateTypeRequestSchema` (`{ entityType }`). Delegates entirely to `revalidationService.revalidateByEntityType()` which handles DB queries, path resolution, chunking, and logging internally.

```typescript
import {
  RevalidateTypeRequestSchema,
  RevalidationResponseSchema,
  PermissionEnum,
  type RevalidateTypeRequest,
} from '@repo/schemas';
import type { Context } from 'hono';
import { createAdminRoute } from '../../../utils/route-factory';
import { getRevalidationService } from '@repo/service-core';

export const adminRevalidateTypeRoute = createAdminRoute({
  method: 'post',
  path: '/revalidate-type',
  summary: 'Trigger batch revalidation for all entities of a type',
  description: 'Revalidates all pages for the given entity type. May revalidate hundreds of paths. Processes in chunks of 10 with 200ms delay.',
  tags: ['Revalidation'],
  requiredPermissions: [PermissionEnum.REVALIDATION_TRIGGER],
  requestBody: RevalidateTypeRequestSchema,
  responseSchema: RevalidationResponseSchema,
  handler: async (
    _ctx: Context,
    _params: Record<string, unknown>,
    body: Record<string, unknown>,
  ) => {
    const data = body as RevalidateTypeRequest;
    const revalidationService = getRevalidationService();

    if (!revalidationService) {
      throw new Error('Revalidation service not initialized');
    }

    const results = await revalidationService.revalidateByEntityType({
      entityType: data.entityType,
    });

    return {
      results,
      summary: {
        total: results.length,
        succeeded: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
      },
    };
  },
});
```

**Warning**: This endpoint can trigger hundreds of HTTP requests to the web app (one per affected path). The `maxCronRevalidations` limit (500) in `RevalidationService` prevents runaway revalidation. The admin UI should show a confirmation dialog before calling this endpoint.

### 7.4 Revalidation Config

```
GET  /api/v1/admin/revalidation/config
PUT  /api/v1/admin/revalidation/config/:entityType
```

**File**: `apps/api/src/routes/revalidation/admin/get-config.ts`

```typescript
import { RevalidationConfigSchema, PermissionEnum } from '@repo/schemas';
import { z } from 'zod';
import { createAdminRoute } from '../../../utils/route-factory';
import { RevalidationConfigModel } from '@repo/db';

export const adminGetConfigRoute = createAdminRoute({
  method: 'get',
  path: '/config',
  summary: 'Get all revalidation configuration entries',
  tags: ['Revalidation'],
  requiredPermissions: [PermissionEnum.REVALIDATION_CONFIG_VIEW],
  responseSchema: z.array(RevalidationConfigSchema),
  handler: async () => {
    const model = new RevalidationConfigModel();
    return model.findAllEnabled();
    // NOTE: findAllEnabled() returns all entries (enabled=true).
    // To return ALL entries regardless of enabled flag, use:
    // const { items } = await model.findAll({});
    // return items;
  },
});
```

**File**: `apps/api/src/routes/revalidation/admin/update-config.ts`

```typescript
import {
  UpdateRevalidationConfigInputSchema,
  RevalidationConfigSchema,
  RevalidationEntityTypeEnum,
  PermissionEnum,
  type UpdateRevalidationConfigInput,
} from '@repo/schemas';
import type { Context } from 'hono';
import { createAdminRoute } from '../../../utils/route-factory';
import { RevalidationConfigModel } from '@repo/db';

export const adminUpdateConfigRoute = createAdminRoute({
  method: 'put',
  path: '/config/:entityType',
  summary: 'Update revalidation config for an entity type',
  tags: ['Revalidation'],
  requiredPermissions: [PermissionEnum.REVALIDATION_CONFIG_EDIT],
  requestBody: UpdateRevalidationConfigInputSchema,
  responseSchema: RevalidationConfigSchema,
  handler: async (
    _ctx: Context,
    params: Record<string, unknown>,
    body: Record<string, unknown>,
  ) => {
    const entityType = RevalidationEntityTypeEnum.parse(params.entityType);
    const data = body as UpdateRevalidationConfigInput;
    const model = new RevalidationConfigModel();

    const existing = await model.findByEntityType(entityType);
    if (!existing) {
      throw new Error(`Config not found for entity type: ${entityType}`);
    }

    // BaseModel.update(where, data) returns updated entity or null
    const updated = await model.update({ id: existing.id }, data);
    if (!updated) {
      throw new Error(`Failed to update config for entity type: ${entityType}`);
    }
    return updated;
  },
});
```

**Note on `BaseModel.update()`**: The first argument is the `where` condition (Drizzle-compatible object), second is the data to update. Check `BaseModel.updateById(id, data)` as an alternative if it exists — it may be simpler than `update({ id }, data)`.

### 7.5 Revalidation Log

```
GET /api/v1/admin/revalidation/log
```

**File**: `apps/api/src/routes/revalidation/admin/get-log.ts`

```typescript
import {
  RevalidationLogSchema,
  RevalidationLogFilterSchema,
  PermissionEnum,
} from '@repo/schemas';
import { z } from 'zod';
import type { Context } from 'hono';
import { createAdminRoute } from '../../../utils/route-factory';
import { RevalidationLogModel } from '@repo/db';

// NOTE: `createAdminListRoute` auto-merges PaginationQuerySchema (page, pageSize).
// Since the admin list route factory is used, `requestQuery` only needs the
// filter-specific fields (entityType, trigger, status, path, dateFrom, dateTo).
// Pagination (page, pageSize) is added automatically.
export const adminGetLogRoute = createAdminRoute({
  method: 'get',
  path: '/log',
  summary: 'Get paginated revalidation audit log',
  tags: ['Revalidation'],
  requiredPermissions: [PermissionEnum.REVALIDATION_LOG_VIEW],
  requestQuery: RevalidationLogFilterSchema,
  responseSchema: z.object({
    items: z.array(RevalidationLogSchema),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
  }),
  handler: async (
    _ctx: Context,
    _params: Record<string, unknown>,
    _body: Record<string, unknown>,
    query: Record<string, unknown>,
  ) => {
    const model = new RevalidationLogModel();
    const { page = 1, pageSize = 20, ...filters } = query as {
      page?: number;
      pageSize?: number;
      entityType?: string;
      trigger?: string;
      status?: string;
      path?: string;
      dateFrom?: Date;
      dateTo?: Date;
    };

    // Build where conditions from filters
    // NOTE: BaseModel.findAll() accepts a plain object for simple equality filters.
    // For date range filtering (dateFrom/dateTo), use a raw Drizzle query:
    //   const db = getDb();
    //   const conditions = []; // build with and()/gte()/lte() from drizzle-orm
    //   const result = await db.select().from(revalidationLog).where(and(...conditions))...
    // For V1, implement with simple equality filters available in BaseModel:
    const whereConditions: Record<string, unknown> = {};
    if (filters.entityType) whereConditions.entityType = filters.entityType;
    if (filters.trigger) whereConditions.trigger = filters.trigger;
    if (filters.status) whereConditions.status = filters.status;
    if (filters.path) whereConditions.path = filters.path;
    // dateFrom/dateTo require raw Drizzle query (see note above)

    const { items, total } = await model.findAll(whereConditions, {
      page: Number(page),
      pageSize: Number(pageSize),
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    return { items, total, page: Number(page), pageSize: Number(pageSize) };
  },
});
```

**Implementation note for date range filtering**: `BaseModel.findAll()` accepts simple equality filters but does NOT support range queries (gte/lte). For `dateFrom`/`dateTo` date range filtering, use a raw Drizzle query with `gte(table.createdAt, dateFrom)` and `lte(table.createdAt, dateTo)`. The V1 implementation can omit date filtering from the handler (only equality filters) and add it as a follow-up enhancement if needed.

### 7.6 Revalidation Stats

```
GET /api/v1/admin/revalidation/stats
```

**File**: `apps/api/src/routes/revalidation/admin/get-stats.ts`

```typescript
import { RevalidationStatsSchema, PermissionEnum } from '@repo/schemas';
import { createAdminRoute } from '../../../utils/route-factory';
import { RevalidationLogModel } from '@repo/db';

export const adminGetStatsRoute = createAdminRoute({
  method: 'get',
  path: '/stats',
  summary: 'Get revalidation statistics',
  tags: ['Revalidation'],
  requiredPermissions: [PermissionEnum.REVALIDATION_LOG_VIEW],
  responseSchema: RevalidationStatsSchema,
  handler: async () => {
    const logModel = new RevalidationLogModel();

    // NOTE: RevalidationStatsSchema requires aggregated data that BaseModel.findAll()
    // cannot produce directly (GROUP BY, COUNT, date arithmetic).
    // Use raw Drizzle queries via getDb() for the aggregations.
    // The implementation below shows the structure; use Drizzle's sql`` tag or
    // .groupBy() for efficient aggregation.
    //
    // Example using getDb() + Drizzle:
    //
    //   const db = getDb();
    //   const now = new Date();
    //   const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    //   const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    //
    //   // Count by trigger (last 7d)
    //   const byTrigger = await db
    //     .select({ trigger: revalidationLog.trigger, count: count() })
    //     .from(revalidationLog)
    //     .where(gte(revalidationLog.createdAt, last7d))
    //     .groupBy(revalidationLog.trigger);
    //
    //   // Count by entityType (last 7d)
    //   const byEntityType = await db
    //     .select({ entityType: revalidationLog.entityType, count: count() })
    //     .from(revalidationLog)
    //     .where(gte(revalidationLog.createdAt, last7d))
    //     .groupBy(revalidationLog.entityType);
    //
    //   // Last revalidation
    //   const lastEntry = await logModel.findLastEntry(); // add this method to model
    //
    //   // Last cron run
    //   const lastCron = await logModel.findLastCronEntry('accommodation'); // any type

    // For V1, return a simplified stats object querying from RevalidationLogModel.
    // The RevalidationLogModel.findAll() supports simple filtering.
    // Full aggregation can be implemented as a follow-up.

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Simple approach: fetch recent entries and aggregate in JS
    // For production with large datasets, replace with raw SQL GROUP BY queries
    const { items: recent24h } = await logModel.findAll({}, { page: 1, pageSize: 1000, sortBy: 'createdAt', sortOrder: 'desc' });
    const entries24h = recent24h.filter(e => e.createdAt >= last24h);
    const entries7d = recent24h.filter(e => e.createdAt >= last7d);

    // Group by trigger and entityType from recent 7d entries
    const byTrigger: Record<string, number> = {};
    const byEntityType: Record<string, number> = {};
    for (const entry of entries7d) {
      byTrigger[entry.trigger] = (byTrigger[entry.trigger] ?? 0) + 1;
      if (entry.entityType) {
        byEntityType[entry.entityType] = (byEntityType[entry.entityType] ?? 0) + 1;
      }
    }

    const lastEntry = recent24h[0] ?? null;
    const lastCron = entries7d.find(e => e.trigger === 'cron') ?? null;

    return {
      last24h: {
        total: entries24h.length,
        succeeded: entries24h.filter(e => e.status === 'success').length,
        failed: entries24h.filter(e => e.status === 'failed').length,
      },
      last7d: {
        total: entries7d.length,
        succeeded: entries7d.filter(e => e.status === 'success').length,
        failed: entries7d.filter(e => e.status === 'failed').length,
      },
      byTrigger,
      byEntityType,
      lastRevalidation: lastEntry?.createdAt ?? null,
      lastCronRun: lastCron?.createdAt ?? null,
    };
  },
});
```

**Production note**: The V1 implementation fetches up to 1000 recent log entries and aggregates in JavaScript. For production deployments with high revalidation volume, replace with raw Drizzle `GROUP BY` queries using `getDb()` for efficiency. This is a known limitation of V1 that should be addressed before the revalidation volume exceeds a few thousand entries per day.

### 7.7 Route Barrel Export

**File**: `apps/api/src/routes/revalidation/admin/index.ts`

```typescript
import { createRouter } from '../../../utils/create-app';
import { adminRevalidateRoute } from './revalidate';
import { adminRevalidateEntityRoute } from './revalidate-entity';
import { adminRevalidateTypeRoute } from './revalidate-type';
import { adminGetConfigRoute } from './get-config';
import { adminUpdateConfigRoute } from './update-config';
import { adminGetLogRoute } from './get-log';
import { adminGetStatsRoute } from './get-stats';

// NOTE: createRouter() returns OpenAPIHono<AppBindings> — the same type returned by createAdminRoute().
// This is NOT new Hono() — it carries OpenAPI and AppBindings configuration required by the codebase.
// Pattern confirmed against apps/api/src/routes/post/admin/index.ts.
const app = createRouter();

app.route('/', adminRevalidateRoute);
app.route('/', adminRevalidateEntityRoute);
app.route('/', adminRevalidateTypeRoute);
app.route('/', adminGetConfigRoute);
app.route('/', adminUpdateConfigRoute);
app.route('/', adminGetLogRoute);
app.route('/', adminGetStatsRoute);

export { app as adminRevalidationRoutes };
```

## 8. Permissions

### 8.1 New Permissions

Add to `packages/schemas/src/enums/permission.enum.ts`:

**Add category** (in `PermissionCategoryEnum`):
```typescript
REVALIDATION = 'REVALIDATION',
```

**Add permissions** (in `PermissionEnum`, following existing `ENTITY_ACTION` naming):

```typescript
// REVALIDATION: Permissions related to ISR page revalidation
REVALIDATION_TRIGGER = 'revalidation.trigger',
REVALIDATION_CONFIG_VIEW = 'revalidation.config.view',
REVALIDATION_CONFIG_EDIT = 'revalidation.config.edit',
REVALIDATION_LOG_VIEW = 'revalidation.log.view',
```

### 8.2 Who Gets These Permissions

| Role | Permissions Granted | Rationale |
|---|---|---|
| `SUPER_ADMIN` | All 4 revalidation permissions | Full system control |
| `ADMIN` | None | Content managers don't need cache control. Auto-revalidation handles their changes transparently. |
| `MODERATOR` | None | Same as admin |
| `USER` | None | No admin access |

**Important**: Auto-revalidation (from service hooks) does NOT require any permission. It fires automatically for all users who edit content through the admin panel, regardless of role. The permissions only control **manual** revalidation, **configuration**, and **log viewing**.

### 8.3 Permission Seed Data

Add the new permissions to the permissions seed data (wherever permissions are seeded, typically in `packages/seed/src/required/`). Associate them with the SUPER_ADMIN role.

## 9. Admin UI

### 9.1 Entity Page "Regenerar" Button

Add a "Regenerar pagina" button to each entity's detail/edit page in the admin panel. This button is **only visible** to users with `REVALIDATION_TRIGGER` permission.

**Affected admin pages** (existing entity detail/edit pages):

- Accommodation edit page
- Destination edit page
- Event edit page
- Post edit page

**Button component**:

**File**: `apps/admin/src/components/revalidation/RevalidateEntityButton.tsx`

```tsx
import { useMutation } from '@tanstack/react-query';
import { PermissionEnum } from '@repo/schemas';
import { RotateCcwIcon } from '@repo/icons';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useHasAnyPermission } from '@/hooks/use-user-permissions';
import { fetchApi } from '@/lib/api/client';
import type { RevalidationEntityType } from '@repo/schemas';

interface RevalidateEntityButtonProps {
  readonly entityType: RevalidationEntityType;
  readonly entityId: string;
}

export function RevalidateEntityButton({ entityType, entityId }: RevalidateEntityButtonProps) {
  const canTrigger = useHasAnyPermission([PermissionEnum.REVALIDATION_TRIGGER]);
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async () => {
      return fetchApi<{ data: { summary: { succeeded: number; failed: number; total: number } } }>({
        path: '/api/v1/admin/revalidation/revalidate-entity',
        method: 'POST',
        body: { entityType, entityId },
      });
    },
    onSuccess: (data) => {
      toast({
        title: 'Pagina regenerada',
        description: `${data.data.summary.succeeded} rutas actualizadas exitosamente`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Error al regenerar',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive',
      });
    },
  });

  if (!canTrigger) {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
    >
      <RotateCcwIcon
        className={`mr-2 h-4 w-4 ${mutation.isPending ? 'animate-spin' : ''}`}
      />
      {mutation.isPending ? 'Regenerando...' : 'Regenerar pagina'}
    </Button>
  );
}
```

**Button placement**: In the entity edit page header, next to existing action buttons (e.g., "Guardar", "Eliminar"). Use `variant="outline"` to differentiate from primary actions.

### 9.2 Revalidation Management Page

New admin page at `/admin/revalidation/` accessible only to users with revalidation permissions.

**Page file**: `apps/admin/src/routes/_authed/revalidation/index.tsx` (TanStack Start file-based routing, under `_authed/` for auth-protected routes)

**Page layout**:

```
/admin/revalidation/
|
+-- Stats Cards (top row)
|   +-- Total Revalidations (24h)
|   +-- Success Rate (24h)
|   +-- Failed (24h)
|   +-- Last Revalidation (timestamp)
|
+-- Quick Actions
|   +-- "Regenerar por tipo" dropdown (select entity type) + "Regenerar" button
|   +-- Confirmation dialog: "Esto regenerara X paginas de tipo Y. Continuar?"
|
+-- Tabs
    +-- Tab: Log
    |   +-- Filters: entity type, trigger (auto/manual/cron), status, date range
    |   +-- Columns: Fecha, Path, Tipo, Trigger, Estado, Duracion, Accion
    |   +-- Row actions: "Regenerar de nuevo" (re-trigger for failed entries)
    |   +-- Pagination
    |
    +-- Tab: Configuracion
        +-- Table of entity types with editable fields:
        |   +-- Entity Type | Auto-revalidar | Intervalo Cron | Debounce | Habilitado
        |   +-- Each row has inline edit or opens edit dialog
        +-- "Guardar cambios" button
```

### 9.3 Navigation Entry

Add "Revalidacion" entry to the admin sidebar navigation.

**Option A (recommended)**: Add to the existing `administration.section.tsx` as a new group or link.

**File to modify**: `apps/admin/src/config/sections/administration.section.tsx`

Add a new link inside the "Sistema" group (or create a new group if none exists for system tools):

```typescript
sidebar.link(
  'revalidation',
  'Revalidacion ISR',
  '/revalidation',
  <RotateCcwIcon className="h-4 w-4" />,
  [
    PermissionEnum.REVALIDATION_TRIGGER,
    PermissionEnum.REVALIDATION_CONFIG_VIEW,
    PermissionEnum.REVALIDATION_LOG_VIEW,
  ],
),
```

**Visibility**: Only visible to users with at least one revalidation permission (OR logic, handled automatically by `filterByPermissions`).

## 10. Cron Scheduled Revalidation

### 10.1 Cron Job Definition

**Location**: `apps/api/src/cron/jobs/page-revalidation.job.ts`

```typescript
import type { CronJobDefinition } from '../types';
import { env } from '../../utils/env';
import { getRevalidationService } from '@repo/service-core';
import { RevalidationConfigModel, RevalidationLogModel } from '@repo/db';

/**
 * Periodic page revalidation cron job.
 * Acts as a safety net for failed auto-revalidations.
 *
 * Logic:
 * 1. Read all enabled entries from revalidation_config table
 * 2. For each entity type, check if cron interval has elapsed since last cron run
 * 3. Revalidate entity types that are due
 * 4. Detect stale entities (updatedAt > last revalidation)
 * 5. Clean up log entries older than 30 days
 */
export const pageRevalidationJob: CronJobDefinition = {
  name: 'page-revalidation',
  description: 'Periodic ISR page revalidation safety net and stale detection',
  // env.HOSPEDA_REVALIDATION_CRON_SCHEDULE has default '0 * * * *' from ApiEnvSchema.
  // Read at module load time (safe: env is validated in index.ts before setupRoutes() imports this file).
  schedule: env.HOSPEDA_REVALIDATION_CRON_SCHEDULE,
  enabled: true,
  timeoutMs: 120000, // 2 minutes

  handler: async (ctx) => {
    const { logger, startedAt, dryRun } = ctx;
    logger.info('Starting page revalidation cron', { dryRun });

    const revalidationService = getRevalidationService();
    if (!revalidationService) {
      return {
        success: true,
        message: 'Revalidation service not initialized, skipping',
        processed: 0,
        errors: 0,
        durationMs: Date.now() - startedAt.getTime(),
      };
    }

    let processed = 0;
    let errors = 0;
    const configModel = new RevalidationConfigModel();
    const logModel = new RevalidationLogModel();

    try {
      // Step 1: Read all enabled configs
      const configs = await configModel.findAllEnabled();
      logger.info('Found enabled configs', { count: configs.length });

      // Step 2-3: Check each entity type and revalidate if due
      for (const config of configs) {
        const lastCron = await logModel.findLastCronEntry(config.entityType);
        const lastCronTime = lastCron?.createdAt?.getTime() ?? 0;
        const intervalMs = config.cronIntervalMinutes * 60 * 1000;
        const now = Date.now();

        if (now - lastCronTime < intervalMs) {
          logger.debug('Skipping entity type (interval not elapsed)', {
            entityType: config.entityType,
            lastCron: lastCron?.createdAt?.toISOString(),
            intervalMinutes: config.cronIntervalMinutes,
          });
          continue;
        }

        logger.info('Revalidating entity type', { entityType: config.entityType });

        if (!dryRun) {
          const results = await revalidationService.revalidateByEntityType({
            entityType: config.entityType,
          });
          processed += results.filter((r) => r.success).length;
          errors += results.filter((r) => !r.success).length;
        } else {
          logger.info('Dry run: would revalidate', { entityType: config.entityType });
        }
      }

      // Step 4: Stale detection
      // For each entity type, find entities where updatedAt is MORE RECENT
      // than the last successful revalidation log entry for that entity.
      // This catches entities whose auto-revalidation failed silently.
      //
      // Implementation per entity type:
      //   1. Get all active entities with their updatedAt timestamps
      //   2. For each entity, query revalidation_log for the most recent
      //      successful entry matching that entityId
      //   3. If no log entry exists, OR entity.updatedAt > lastLog.createdAt,
      //      the entity is "stale" and needs revalidation
      //   4. Revalidate stale entities with metadata: '{"reason":"stale_detection"}'
      //
      // Note: This is a safety net. In normal operation, auto-revalidation
      // from service hooks handles all changes. Stale detection catches
      // edge cases where auto-revalidation was skipped or failed.
      //
      // Performance consideration: For large datasets, limit stale detection
      // to entities updated in the last 48 hours to avoid scanning the
      // entire table on every cron run.

      // Step 5: Clean up old logs
      if (!dryRun) {
        const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
        const deletedCount = await logModel.deleteOlderThan(cutoffDate);
        if (deletedCount > 0) {
          logger.info('Cleaned up old log entries', { deletedCount });
        }
      }

      const durationMs = Date.now() - startedAt.getTime();
      return {
        success: true,
        message: `Revalidated ${processed} paths, ${errors} failures`,
        processed,
        errors,
        durationMs,
        details: { configsChecked: configs.length, dryRun },
      };
    } catch (error) {
      const durationMs = Date.now() - startedAt.getTime();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Page revalidation cron failed', { error: errorMessage });
      return {
        success: false,
        message: `Failed: ${errorMessage}`,
        processed,
        errors: errors + 1,
        durationMs,
        details: { error: errorMessage },
      };
    }
  },
};
```

### 10.2 Registration

**File to modify**: `apps/api/src/cron/registry.ts`

Add import and registration:

```typescript
import { pageRevalidationJob } from './jobs/page-revalidation.job';

export const cronJobs: CronJobDefinition[] = [
  // ... existing jobs
  pageRevalidationJob,
];
```

### 10.3 Cron Schedule Override

The schedule is read from `env.HOSPEDA_REVALIDATION_CRON_SCHEDULE` directly in the job definition (`schedule: env.HOSPEDA_REVALIDATION_CRON_SCHEDULE`). The `ApiEnvSchema` defines this field with `.default('0 * * * *')`, so it is always a string (never undefined).

**Why this works**: The `CronJobDefinition.schedule` field is a `string` (not a function). By reading `env` at module initialization time, the schedule is set once when the cron job module is imported during `setupRoutes()`, which runs inside `initApp()`, which runs AFTER `validateApiEnv()` in `index.ts`. The validated `env` object is available by this point.

**To change the schedule**: Set `HOSPEDA_REVALIDATION_CRON_SCHEDULE=*/30 * * * *` (every 30 minutes) in `.env` and restart the API.

## 11. Environment Variables

### 11.1 New Variables

| Variable | Used By | Required | Default | Description |
|---|---|---|---|---|
| `HOSPEDA_REVALIDATION_SECRET` | `apps/web` (astro.config), `apps/api` | YES (prod) | none | Shared secret for ISR bypass token. Must be the same value in both apps. Minimum 32 characters. Generate with: `openssl rand -hex 32` |
| `HOSPEDA_REVALIDATION_CRON_SCHEDULE` | `apps/api` | NO | `0 * * * *` | Cron schedule expression for periodic revalidation. |

### 11.2 Existing Variables Used

| Variable | Used By | Purpose |
|---|---|---|
| `HOSPEDA_SITE_URL` | `apps/api` | Base URL for revalidation HTTP requests (e.g., `https://hospeda.vercel.app`) |

### 11.3 .env.example Updates

**Add to `apps/api/.env.example`**:

```bash
# ISR Revalidation
# Shared secret between web and API for on-demand ISR cache invalidation.
# Must be the same value as in the web app config. Minimum 32 characters.
# Generate with: openssl rand -hex 32
HOSPEDA_REVALIDATION_SECRET=

# Cron schedule for periodic page revalidation (default: every hour)
# HOSPEDA_REVALIDATION_CRON_SCHEDULE=0 * * * *
```

**Create `apps/web/.env.example`** (or add to existing if recreated):

```bash
# ISR Revalidation
# Shared secret for Vercel ISR bypass token.
# Must be the same value as in the API config.
HOSPEDA_REVALIDATION_SECRET=
```

### 11.4 Env Validation

**In `apps/web/src/env.ts`** (add to the `serverEnvSchema`):

```typescript
// Add to the existing serverEnvSchema:
HOSPEDA_REVALIDATION_SECRET: z.string().min(32).optional(),
```

**In `apps/web/src/lib/env.ts`** (following the existing pattern using `_env` from `validateWebEnv()`):

```typescript
/**
 * Get the ISR revalidation secret for server-side use.
 * Returns undefined in development (ISR bypass not needed locally).
 *
 * Note: For astro.config.mjs, use `process.env.HOSPEDA_REVALIDATION_SECRET` directly
 * (Node.js context). This function is for Astro runtime server-side code only.
 *
 * @returns The revalidation secret or undefined
 */
export function getRevalidationSecret(): string | undefined {
  return _env.HOSPEDA_REVALIDATION_SECRET;
}
```

(Where `_env` is the existing `validateWebEnv()` result at the top of `src/lib/env.ts`)

**In `apps/api/src/utils/env.ts`** (following existing Zod schema pattern, add to `ApiEnvSchema`):

```typescript
// Add to the existing ApiEnvSchema:
HOSPEDA_REVALIDATION_SECRET: z.string().min(32).optional(),
HOSPEDA_REVALIDATION_CRON_SCHEDULE: z.string().optional().default('0 * * * *'),
```

In development (when `NODE_ENV !== 'production'`), the revalidation secret is optional. The `NoOpAdapter` is used when it's missing.

## 12. Security

### 12.1 Bypass Token

- The `HOSPEDA_REVALIDATION_SECRET` must be a cryptographically random string of at least 32 characters.
- It is used as the `bypassToken` in Vercel ISR config AND as the `x-prerender-revalidate` header value.
- It must NEVER be exposed in client-side code, logs, or error messages.
- It must NEVER be committed to version control.
- Generate with: `openssl rand -hex 32`

### 12.2 API Endpoint Protection

All admin revalidation endpoints are protected by:
1. Authentication (Better Auth session required)
2. Authorization (specific `REVALIDATION_*` permission checks per endpoint)
3. Rate limiting (same rate limits as other admin endpoints)

### 12.3 Abuse Prevention

- Batch revalidation (`revalidate-type`) processes in chunks of 10 with a 200ms delay between chunks to avoid overwhelming the web app.
- The cron job has a maximum of 500 revalidations per run to prevent runaway revalidation loops.
- All revalidation attempts are logged, making abuse detectable.
- Manual revalidation request body is limited to 100 paths maximum.

## 13. i18n

### 13.1 Translation Keys

Create a new translation file for admin revalidation UI:

**File**: `packages/i18n/src/locales/es/admin-revalidation.json`

```json
{
  "title": "Revalidacion ISR",
  "description": "Gestion de cache y regeneracion de paginas",
  "stats": {
    "total24h": "Total (24h)",
    "successRate": "Tasa de exito",
    "failed24h": "Fallidas (24h)",
    "lastRevalidation": "Ultima revalidacion"
  },
  "actions": {
    "regenerate": "Regenerar pagina",
    "regenerating": "Regenerando...",
    "regenerateByType": "Regenerar por tipo",
    "regenerateAll": "Regenerar todo"
  },
  "toast": {
    "success": "Pagina regenerada exitosamente",
    "successCount": "{{count}} rutas actualizadas exitosamente",
    "error": "Error al regenerar pagina",
    "errorDetail": "Error al regenerar: {{error}}"
  },
  "confirm": {
    "title": "Confirmar regeneracion",
    "message": "Esto regenerara todas las paginas de tipo \"{{type}}\". Continuar?",
    "confirm": "Regenerar",
    "cancel": "Cancelar"
  },
  "log": {
    "title": "Registro de revalidacion",
    "columns": {
      "date": "Fecha",
      "path": "Ruta",
      "entityType": "Tipo",
      "trigger": "Disparador",
      "status": "Estado",
      "duration": "Duracion",
      "actions": "Acciones"
    },
    "triggers": {
      "auto": "Automatico",
      "manual": "Manual",
      "cron": "Programado"
    },
    "statuses": {
      "success": "Exitoso",
      "failed": "Fallido"
    },
    "retrigger": "Regenerar de nuevo"
  },
  "config": {
    "title": "Configuracion",
    "columns": {
      "entityType": "Tipo de entidad",
      "autoRevalidate": "Auto-revalidar",
      "cronInterval": "Intervalo cron (min)",
      "debounce": "Debounce (seg)",
      "enabled": "Habilitado"
    },
    "save": "Guardar cambios",
    "saved": "Configuracion guardada"
  },
  "entityTypes": {
    "accommodation": "Alojamiento",
    "destination": "Destino",
    "event": "Evento",
    "post": "Publicacion",
    "accommodation_review": "Resena de alojamiento",
    "destination_review": "Resena de destino",
    "tag": "Etiqueta",
    "amenity": "Amenidad"
  }
}
```

Create equivalent files for `en/admin-revalidation.json` and `pt/admin-revalidation.json`.

**Register the new translation namespace** in `packages/i18n/src/config.ts`:

1. Add `'admin-revalidation'` to the `namespaces` array (around line 19-55)
2. Add static imports for the JSON files in the locale loading section (around lines 99-204), following the existing pattern:
   ```typescript
   // In the es locale imports:
   import esAdminRevalidation from './locales/es/admin-revalidation.json';
   // In the en locale imports:
   import enAdminRevalidation from './locales/en/admin-revalidation.json';
   // In the pt locale imports:
   import ptAdminRevalidation from './locales/pt/admin-revalidation.json';
   ```
3. Add the imported objects to their respective locale resource maps in the same file.

## 14. Implementation Phases

### Phase 1: Foundation & Configuration (~15 tasks)

**Prerequisites**: None

**Deliverables**:
1. Update `astro.config.mjs` with `bypassToken`, `expiration`, and `exclude` patterns
2. Add `HOSPEDA_REVALIDATION_SECRET` to `.env.example` files and env validation
3. Add `REVALIDATION` to `PermissionCategoryEnum` and add 4 permissions to `PermissionEnum`
4. Create DB schema files (`revalidation-config.dbschema.ts`, `revalidation-log.dbschema.ts`) in `packages/db/src/schemas/revalidation/`
5. Create DB model files (`RevalidationConfigModel`, `RevalidationLogModel`) in `packages/db/src/models/revalidation/`
6. Generate and apply Drizzle migration (`pnpm db:generate`, `pnpm db:migrate`)
7. Create Zod schemas in `packages/schemas/src/entities/revalidation/` (6 files + barrel)
8. Register schemas in the schemas package barrel export
9. Create seed data for `revalidation_config` defaults
10. Create `RevalidationAdapter` interface in `packages/service-core/src/revalidation/`
11. Implement `VercelRevalidationAdapter`
12. Implement `NoOpRevalidationAdapter`
13. Create adapter factory function in `apps/api/src/lib/revalidation.ts`
14. Create barrel export `packages/service-core/src/revalidation/index.ts`
15. Write unit tests for adapters and schemas

**Exit criteria**: Astro config updated. Adapter pattern implemented with tests. DB tables created and seeded. Permissions exist. Env vars documented and validated.

### Phase 2: Page Rendering Migration (~14 tasks)

**Prerequisites**: Phase 1 (ISR config with bypassToken must be in place)

**Deliverables**:
1. Migrate `[lang]/alojamientos/[slug].astro` (Pattern A)
2. Migrate `[lang]/destinos/[...path].astro` (Pattern A, catch-all handling)
3. Migrate `[lang]/destinos/index.astro` (Pattern B)
4. Verify `[lang]/destinos/[slug]/alojamientos/index.astro` (ALREADY SSR - check for prerender/getStaticPaths first; no migration needed if already SSR)
5. Migrate `[lang]/eventos/[slug].astro` (Pattern A)
6. Migrate `[lang]/publicaciones/[slug].astro` (Pattern A + related posts)
7. Verify `[lang]/alojamientos/tipo/[type]/index.astro` (ALREADY SSR - no prerender or getStaticPaths to remove; ISR exclusion via astro.config exclude pattern is still required)
8. Migrate `[lang]/eventos/categoria/[category]/index.astro` (Pattern E, ISR-excluded. Has `export const prerender = true;` AND `getStaticPaths()` - both must be removed)
9. Migrate `[lang]/index.astro` homepage (Pattern D, Server Islands)
10. Verify `[lang]/alojamientos/index.astro` (ALREADY SSR - no getStaticPaths found; ISR exclusion via astro.config exclude pattern is still required)
11. Verify `[lang]/eventos/index.astro` (ALREADY SSR - no getStaticPaths found; ISR exclusion via astro.config exclude pattern is still required)
12. Verify each page works correctly as SSR in dev mode
13. Update `apps/web/CLAUDE.md` rendering documentation
14. Write/update tests for migrated pages

**Exit criteria**: All 11 pages work as SSR. ISR caching verified on Vercel staging for pages 1-6 and 9. Pages 7-8, 10-11 render fresh on every request (ISR-excluded due to query params). No prerender pages depend on DB data. Documentation updated.

### Phase 3: Revalidation Core (~22 tasks)

**Prerequisites**: Phase 1

**Deliverables**:
1. Implement `EntityPathMapper.getAffectedPaths()` with all mapping rules and discriminated union types
2. Write comprehensive unit tests for entity-to-paths mapping (every entity type + operation combination)
3. Implement `RevalidationService` with `revalidateEntity`, `revalidatePaths`, `revalidateByEntityType`
4. Implement debouncing logic in `RevalidationService`
5. Implement logging to `revalidation_log` table
6. Create revalidation singleton (`initializeRevalidationService` / `getRevalidationService`)
7. Initialize `RevalidationService` in API app bootstrap
8. Integrate hooks in `AccommodationService` (5 hooks) with destination slug resolution
9. Integrate hooks in `DestinationService` (5 hooks)
10. Integrate hooks in `EventService` (5 hooks)
11. Integrate hooks in `PostService` (5 hooks) with tag slug resolution
12. Integrate hooks in `AccommodationReviewService` (3 hooks) with accommodation slug resolution
13. Integrate hooks in `DestinationReviewService` (3 hooks) with destination path resolution
14. Integrate hooks in `TagService` (3 hooks) with batch accommodation lookup
15. Integrate hooks in `AmenityService` (3 hooks) with batch accommodation lookup
16. Add `_afterRestore` hooks to AccommodationService, DestinationService, EventService, PostService with `_before*` capture pattern
17. Add `_afterUpdateVisibility` hooks where visibility changes are supported
18. Verify `_afterUpdate` fires correctly in DestinationService and PostService (both override `update()` directly)
19. Create URL slug mapping constants (`ACCOMMODATION_TYPE_TO_URL_SLUG`, `EVENT_CATEGORY_TO_URL_SLUG`) in entity-path-mapper.ts
20. Write integration tests for service hooks triggering revalidation
21. Write unit tests for debouncing
22. Write unit tests for RevalidationService

**Exit criteria**: Editing any entity from admin automatically triggers revalidation of affected pages. Debouncing works. All events are logged. Tests pass with 90%+ coverage.

### Phase 4: Admin Manual Revalidation (~14 tasks)

**Prerequisites**: Phase 3

**Deliverables**:
1. Create `POST /revalidate` endpoint using `createAdminRoute`
2. Create `POST /revalidate-entity` endpoint
3. Create `POST /revalidate-type` endpoint
4. Create `GET /stats` endpoint
5. Create `GET /log` endpoint using `createAdminListRoute`
6. Create `GET /config` endpoint
7. Create `PUT /config/:entityType` endpoint
8. Create route barrel export and mount in `routes/index.ts`
9. Write API endpoint tests
10. Create `RevalidateEntityButton` component
11. Add button to accommodation, destination, event, and post edit pages
12. Create revalidation management page (`/admin/revalidation/`)
13. Add navigation entry in admin sidebar (in `administration.section.tsx`)
14. Create i18n translation files (es, en, pt)

**Exit criteria**: Super admins can manually revalidate from entity pages and the dedicated management page. Config is editable. Log is viewable. All endpoints tested.

### Phase 5: Scheduled Revalidation - Cron (~8 tasks)

**Prerequisites**: Phase 3

**Deliverables**:
1. Create `page-revalidation.job.ts` following `CronJobDefinition` interface
2. Implement interval-based revalidation logic (read config, check elapsed time)
3. Implement stale detection logic (entities updated after last revalidation)
4. Implement log cleanup (delete entries older than 30 days)
5. Register cron job in `apps/api/src/cron/registry.ts`
6. Add `HOSPEDA_REVALIDATION_CRON_SCHEDULE` env var support
7. Write cron job unit tests
8. Verify cron integration with existing infrastructure

**Exit criteria**: Cron job runs on schedule. Revalidates entities past their configured interval. Detects stale entities. Cleans up old logs. Tests pass.

## 15. Testing Strategy

### 15.1 Unit Tests

| Component | Test Focus | Location |
|---|---|---|
| `VercelRevalidationAdapter` | HTTP request formation (correct URL, GET method, `x-prerender-revalidate` header), error handling, chunk processing | `packages/service-core/test/revalidation/vercel-adapter.test.ts` |
| `NoOpRevalidationAdapter` | Returns success without side effects | `packages/service-core/test/revalidation/noop-adapter.test.ts` |
| `EntityPathMapper` | Correct paths for every entity type + operation, locale expansion, trailing slashes, hierarchical destination paths | `packages/service-core/test/revalidation/entity-path-mapper.test.ts` |
| `RevalidationService` | Debouncing, config reads, logging, adapter delegation, singleton pattern | `packages/service-core/test/revalidation/revalidation-service.test.ts` |
| Zod schemas | Validation rules, edge cases, type inference | `packages/schemas/test/entities/revalidation/` |

### 15.2 Integration Tests

| Scenario | What to Verify |
|---|---|
| Update accommodation via admin API | Revalidation triggered for detail + destination + type listing paths |
| Create event via admin API | Revalidation triggered for detail + category listing paths |
| Delete post via admin API | Revalidation triggered for detail page + tag listing paths |
| Create accommodation review | Revalidation triggered for parent accommodation detail page |
| Update tag | Batch revalidation triggered for all accommodations with that tag |
| Rapid double-edit (within 30s) | Only ONE revalidation fires (debouncing works) |
| Manual revalidation API call | Revalidation fires immediately, no debouncing, logged as 'manual' |
| Cron job execution | Revalidates entity types past their interval, skips others |
| Entity type with `enabled: false` | No auto-revalidation triggered |

### 15.3 E2E Verification (Manual, on Vercel Staging)

1. Create/edit an accommodation in admin
2. Visit the web page .. verify it shows cached (old) content
3. Wait for auto-revalidation (or trigger manual via admin button)
4. Refresh the web page .. verify it shows updated content
5. Check revalidation log in admin panel .. verify entry exists
6. Edit revalidation config (change debounce time) .. verify change takes effect

### 15.4 Adapter Testing Details

The `VercelRevalidationAdapter` tests should mock `fetch` to verify:
- Correct URL construction (`${siteUrl}${path}`) with trailing slash preserved
- Correct header (`x-prerender-revalidate: ${bypassToken}`)
- HTTP method is `GET` (not HEAD, not POST)
- Error handling for network failures (`fetch` throws)
- Error handling for non-200 responses (e.g., 404, 500)
- Chunk processing (batches of `chunkSize`) with delay between chunks
- Timing measurement (`durationMs`)

## 15.5 SEO Impact Assessment

**Impact of migrating prerender → SSR**:

| Aspect | Impact | Mitigation |
|--------|--------|------------|
| **First request latency** | SSR pages have higher TTFB than prerendered static HTML on the first request (cold start). | ISR caching eliminates this for subsequent requests. The 24h `expiration` safety net ensures pages are always served from cache after the first request. Vercel's serverless functions have ~50-100ms cold start. |
| **Sitemap generation** | Pages that used `getStaticPaths()` may have contributed paths to the sitemap. After migration, verify the sitemap still includes all entity URLs. | Check `apps/web/src/pages/[lang]/mapa-del-sitio.astro` .. it uses hardcoded data (no API calls), so it is NOT affected. If a dynamic sitemap exists (via Astro integration), verify it works with SSR pages. |
| **Crawling behavior** | Googlebot may notice changes in response headers (no `x-vercel-cache: HIT` on first visit). | ISR-cached pages return identical content to prerendered pages after the first request. No SEO impact expected. |
| **Core Web Vitals** | TTFB may increase slightly for uncached pages. | ISR caching keeps TTFB identical to static for cached pages. Monitor Vercel Analytics after deployment. |
| **Meta tags / JSON-LD** | No change. All SEO components (SEOHead, JsonLd) are in the template section, not in getStaticPaths. | Verify each migrated page still renders correct meta tags and JSON-LD in dev mode. |

**Conclusion**: The SSR migration has minimal SEO impact because ISR caching makes pages behave like static pages for all visitors except the first one after a revalidation. The `expiration: 86400` ensures pages are never stale for more than 24 hours even without on-demand revalidation.

## 16. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|---|---|---|---|
| **Page migration breaks existing pages** | High | Medium | Migrate one page at a time. Test each in dev mode. Deploy to staging before production. Keep git history clean for easy revert. |
| **ISR cache not invalidating** | Medium | Low | The `expiration: 86400` provides a 24h safety net. Cron provides a second safety net. Monitor revalidation logs. |
| **Revalidation overloads web app** | Medium | Low | Chunk processing (10 at a time, 200ms delay). Debouncing (30s). Cron max 500 per run. |
| **Bypass token leaked** | High | Low | Env var validation. Never in client code. Rotate if compromised. |
| **Vendor lock-in (Vercel ISR)** | Medium | Known | Adapter pattern allows swapping to CloudflareAdapter, RedisCacheAdapter, etc. Only VercelAdapter needs replacement. |
| **Tag/amenity batch revalidation too large** | Low | Low | If a tag is used by 500+ accommodations, batch revalidation creates 1500+ paths (x3 locales). Chunk processing handles this but it could be slow. Add a warning in admin UI for batch operations. |
| **SSR performance regression** | Medium | Medium | ISR caching mitigates this. First request is slower than prerendered, but subsequent requests are served from cache. Monitor Vercel function execution times. |
| **Server Islands behavior with ISR** | Low | Low | Server Islands (`server:defer`) render fresh on every request regardless of ISR cache state. No revalidation needed for Server Island content. Documented in spec. |
| **Destination hierarchical paths** | Low | Medium | Destinations use catch-all routes with hierarchical paths. The DB `path` field stores the full materialized path with a leading slash (e.g., `/argentina/litoral/entre-rios`). EntityPathMapper must strip the leading slash when constructing URLs. The `slug` field alone (e.g., `entre-rios`) is NOT sufficient for URL construction. |
| **Query param pages served stale by ISR** | Medium | High | ISR ignores query params. `/alojamientos/?type=HOTEL` and `/alojamientos/` share the same cache entry. These pages are excluded from ISR in the spec to prevent this. If the exclude regex is wrong, users could see unfiltered results when filtering. |
| **Delete hooks lack entity data** | Low | Low | `_afterSoftDelete` and `_afterHardDelete` receive `{ count: number }`, not the entity. Entity data must be captured in `_beforeSoftDelete`/`_beforeHardDelete` hooks. This pattern already exists in AccommodationService and review services. |
| **Debounce lost in serverless** | Low | High | In-memory `setTimeout` and `Map` are lost when Vercel serverless instances terminate between requests. Debounce is best-effort only. Acceptable because revalidation is idempotent. See Section 5.8. |
| **Destination reparenting cascade** | Medium | Low | When a destination's parent changes, all descendant paths change. The current spec only revalidates the edited destination, not descendants or their accommodations. For V1, the cron safety net (24h max) handles this. If reparenting is frequent, a future enhancement should walk the subtree and revalidate all affected paths. |
| **URL slug ↔ DB enum mismatch** | Medium | Known | Accommodation types and event categories use different identifiers in URLs vs DB. The `ACCOMMODATION_TYPE_TO_URL_SLUG` and `EVENT_CATEGORY_TO_URL_SLUG` constants must be maintained in sync with the web app's `ALLOWED_TYPES` and `ALLOWED_CATEGORIES`. If the web app adds new types/categories, the mapping must be updated or tipo/categoria pages won't be revalidated for those new values. |
| **Restore without revalidation** | Medium | Medium | If `_afterRestore` hooks are not implemented, restoring a soft-deleted entity won't trigger revalidation. The cached 404/redirect would persist for up to 24h (ISR expiration). `_afterRestore` hooks are included in this spec. |
| **DestinationService/PostService override update()** | Medium | Medium | Both services override `update()` directly. If the override doesn't invoke `_afterUpdate` via `super.update()`, the revalidation hook won't fire. Must verify during implementation. |
| **`CULTURAL` vs `CULTURE` event category bug** | Low | Known | The web app's `CATEGORY_API_VALUE` maps the URL slug `cultural` → `'CULTURAL'` when calling the API, but the DB `EventCategoryEnum` stores `CULTURE` (not `CULTURAL`). This is a preexisting web app bug that may cause `/eventos/categoria/cultural/` to return empty results. It is out of scope for this spec. For ISR path construction, `CULTURE: 'cultural'` in `EVENT_CATEGORY_TO_URL_SLUG` is correct — the URL path `/eventos/categoria/cultural/` is valid regardless of the filtering bug. |

## 17. Supersedes

This spec supersedes **SPEC-009: Admin ISR/Regeneration Management**.

**Reasons for replacement**:

1. **Conceptual error**: SPEC-009 assumed ISR applies to prerendered pages. It does not. ISR only applies to server-rendered (on-demand) routes in Astro+Vercel.
2. **Over-engineering**: SPEC-009 proposed a page registry table, job queue with priorities/rate-limiting/concurrency, and a real-time monitoring dashboard. This spec achieves the same goals with simpler architecture.
3. **Missing dependency**: SPEC-009 depended on SPEC-005 which does not exist.
4. **Incorrect revalidation mechanism**: SPEC-009 proposed a custom `/api/revalidate` endpoint. Vercel's native mechanism uses the `bypassToken` header approach.
5. **No page migration plan**: SPEC-009 did not address the need to convert pages from `prerender = true` to SSR for ISR to work.

**Deprecation status**: SPEC-009 has been fully deleted. All relevant context is preserved in this section.

## 18. Glossary

| Term | Definition |
|---|---|
| **ISR** | Incremental Static Regeneration. Vercel feature that caches server-rendered pages and serves them as static until invalidated. |
| **Revalidation** | The act of invalidating a cached page so the next request generates fresh content. |
| **Bypass Token** | A secret string configured in Vercel that, when sent as a header, invalidates the ISR cache for the requested path. |
| **Prerender** | Astro's mechanism for generating static HTML at build time. Pages with `export const prerender = true` are prerendered. |
| **SSR** | Server-Side Rendering. Pages rendered on the server for each request (or first request with ISR). |
| **Server Islands** | Astro feature (`server:defer`) where components render independently on the server, separate from the page's ISR cache. |
| **Debouncing** | Delaying an action until a quiet period has passed. Multiple rapid edits result in a single revalidation. |
| **Entity-to-Paths Mapping** | Logic that determines which URL paths are affected when a database entity changes. |
| **Safety Net** | The `expiration` config and cron jobs that ensure pages eventually refresh even if on-demand revalidation fails. |
| **Fire-and-Forget** | Pattern where revalidation is triggered asynchronously. Errors are logged but never block the CRUD operation. |

## 19. File Inventory

Complete list of files to create or modify, organized by package:

### New Files

| # | File Path | Description |
|---|-----------|-------------|
| 1 | `packages/service-core/src/revalidation/revalidation-adapter.ts` | Adapter interface + RevalidationResult type |
| 2 | `packages/service-core/src/revalidation/adapters/vercel-adapter.ts` | Vercel ISR adapter implementation |
| 3 | `packages/service-core/src/revalidation/adapters/noop-adapter.ts` | No-op adapter for development |
| 4 | `packages/service-core/src/revalidation/entity-path-mapper.ts` | Entity-to-paths mapping function |
| 5 | `packages/service-core/src/revalidation/revalidation.service.ts` | Central revalidation service |
| 6 | `packages/service-core/src/revalidation/revalidation-singleton.ts` | Module-level singleton for DI |
| 7 | `packages/service-core/src/revalidation/index.ts` | Barrel export |
| 8 | `packages/db/src/schemas/revalidation/revalidation-config.dbschema.ts` | Config table schema |
| 9 | `packages/db/src/schemas/revalidation/revalidation-log.dbschema.ts` | Log table schema |
| 10 | `packages/db/src/schemas/revalidation/index.ts` | DB schema barrel |
| 11 | `packages/db/src/models/revalidation/revalidation-config.model.ts` | Config model |
| 12 | `packages/db/src/models/revalidation/revalidation-log.model.ts` | Log model |
| 13 | `packages/schemas/src/entities/revalidation/revalidation-config.schema.ts` | Config Zod schema |
| 14 | `packages/schemas/src/entities/revalidation/revalidation-config.crud.schema.ts` | Config CRUD schemas |
| 15 | `packages/schemas/src/entities/revalidation/revalidation-log.schema.ts` | Log Zod schema |
| 16 | `packages/schemas/src/entities/revalidation/revalidation-log.query.schema.ts` | Log filter schema |
| 17 | `packages/schemas/src/entities/revalidation/revalidation.http.schema.ts` | HTTP request/response schemas |
| 18 | `packages/schemas/src/entities/revalidation/index.ts` | Schema barrel |
| 19 | `packages/seed/src/data/revalidation-config/defaults.json` | Default config seed data |
| 20 | `packages/seed/src/required/revalidation-config.seed.ts` | Config seed function |
| 21 | `apps/api/src/lib/revalidation.ts` | Adapter factory |
| 22 | `apps/api/src/routes/revalidation/admin/revalidate.ts` | Manual revalidate endpoint |
| 23 | `apps/api/src/routes/revalidation/admin/revalidate-entity.ts` | Revalidate by entity endpoint |
| 24 | `apps/api/src/routes/revalidation/admin/revalidate-type.ts` | Revalidate by type endpoint |
| 25 | `apps/api/src/routes/revalidation/admin/get-config.ts` | Get config endpoint |
| 26 | `apps/api/src/routes/revalidation/admin/update-config.ts` | Update config endpoint |
| 27 | `apps/api/src/routes/revalidation/admin/get-log.ts` | Get log endpoint |
| 28 | `apps/api/src/routes/revalidation/admin/get-stats.ts` | Get stats endpoint |
| 29 | `apps/api/src/routes/revalidation/admin/index.ts` | Route barrel |
| 30 | `apps/api/src/cron/jobs/page-revalidation.job.ts` | Cron job |
| 31 | `apps/admin/src/components/revalidation/RevalidateEntityButton.tsx` | Entity revalidate button |
| 32 | `apps/admin/src/routes/_authed/revalidation/index.tsx` | Management page |
| 33 | `packages/i18n/src/locales/es/admin-revalidation.json` | Spanish translations |
| 34 | `packages/i18n/src/locales/en/admin-revalidation.json` | English translations |
| 35 | `packages/i18n/src/locales/pt/admin-revalidation.json` | Portuguese translations |

### Files to Modify

| # | File Path | Change |
|---|-----------|--------|
| 1 | `apps/web/astro.config.mjs` | ISR config: bypassToken, expiration, exclude (including alojamientos and eventos index) |
| 2 | `apps/web/src/pages/[lang]/alojamientos/[slug].astro` | Remove prerender, migrate to SSR (Pattern A) |
| 3 | `apps/web/src/pages/[lang]/destinos/[...path].astro` | Remove prerender, migrate to SSR (Pattern A) |
| 4 | `apps/web/src/pages/[lang]/destinos/index.astro` | Remove prerender, migrate to SSR (Pattern B) |
| 5 | `apps/web/src/pages/[lang]/destinos/[slug]/alojamientos/index.astro` | **VERIFY FIRST: This page may already be SSR.** Check for prerender/getStaticPaths. If already SSR, no migration needed. |
| 6 | `apps/web/src/pages/[lang]/eventos/[slug].astro` | Remove prerender, migrate to SSR (Pattern A) |
| 7 | `apps/web/src/pages/[lang]/publicaciones/[slug].astro` | Remove prerender, migrate to SSR (Pattern A) |
| 8 | `apps/web/src/pages/[lang]/alojamientos/tipo/[type]/index.astro` | **VERIFY FIRST: This page may already be SSR. Check if getStaticPaths exists before making changes.** If already SSR, no page code changes needed. ISR exclusion via astro.config exclude pattern is still required. |
| 9 | `apps/web/src/pages/[lang]/eventos/categoria/[category]/index.astro` | Remove `export const prerender = true;` AND getStaticPaths, add locale/category validation (Pattern E, ISR-excluded). |
| 10 | `apps/web/src/pages/[lang]/index.astro` | Remove prerender (Server Islands need SSR) (Pattern D) |
| 11 | `apps/web/src/pages/[lang]/alojamientos/index.astro` | **VERIFY FIRST: This page may already be SSR.** If no getStaticPaths found, no migration needed, only ISR exclusion via astro.config. |
| 12 | `apps/web/src/pages/[lang]/eventos/index.astro` | **VERIFY FIRST: This page may already be SSR.** If no getStaticPaths found, no migration needed, only ISR exclusion via astro.config. |
| 13 | `apps/web/src/lib/env.ts` | Add `getRevalidationSecret()` helper |
| 14 | `apps/api/src/utils/env.ts` | Add revalidation env vars to ApiEnvSchema |
| 15 | `apps/api/.env.example` | Add revalidation env vars |
| 16 | `packages/schemas/src/enums/permission.enum.ts` | Add REVALIDATION category + 4 permissions |
| 17 | `packages/service-core/src/services/accommodation/accommodation.service.ts` | Add _afterUpdate (new), _afterRestore (new), extend _afterCreate, _afterSoftDelete, _afterHardDelete with revalidation. Note: already has _beforeCreate, _beforeHardDelete. |
| 18 | `packages/service-core/src/services/destination/destination.service.ts` | Add revalidation hooks (_afterCreate, _afterUpdate, _afterSoftDelete, _afterHardDelete, _afterRestore new). Warning: overrides `update()` directly - verify _afterUpdate fires. |
| 19 | `packages/service-core/src/services/event/event.service.ts` | Add revalidation hooks (same pattern + _afterRestore). Category mapped via EVENT_CATEGORY_TO_URL_SLUG. |
| 20 | `packages/service-core/src/services/post/post.service.ts` | Add revalidation hooks (same pattern + _afterRestore, plus tag slug resolution via r_entity_tag). Warning: overrides `update()` directly. |
| 21 | `packages/service-core/src/services/accommodationReview/accommodationReview.service.ts` | Extend existing _afterCreate and _afterSoftDelete with revalidation |
| 22 | `packages/service-core/src/services/destinationReview/destinationReview.service.ts` | Extend existing _afterCreate and _afterSoftDelete with revalidation |
| 23 | `packages/service-core/src/services/tag/tag.service.ts` | Add revalidation hooks (_afterUpdate, _afterSoftDelete, _afterHardDelete) with r_entity_tag query |
| 24 | `packages/service-core/src/services/amenity/amenity.service.ts` | Add revalidation hooks (_afterUpdate, _afterSoftDelete, _afterHardDelete) with r_accommodation_amenity query |
| 25 | `packages/service-core/src/index.ts` | Re-export revalidation module (adapter, service, singleton, types) |
| 26 | `packages/db/src/models/index.ts` | Export RevalidationConfigModel and RevalidationLogModel |
| 27 | `packages/db/src/schemas/index.ts` | Export revalidation schema tables |
| 28 | `packages/schemas/src/entities/index.ts` | Export revalidation entity schemas |
| 29 | `apps/api/src/routes/index.ts` | Mount admin revalidation routes |
| 30 | `apps/api/src/cron/registry.ts` | Register page-revalidation cron job |
| 31 | `apps/admin/src/config/sections/administration.section.tsx` | Add revalidation nav entry |
| 32 | `apps/web/CLAUDE.md` | Update rendering strategy documentation |
| 33 | `packages/seed/src/required/index.ts` | Register revalidation config seed (add after existing seeds, no FK dependency) |
| 34 | `packages/i18n/src/locales/es/index.ts` (or equivalent loader) | Register `admin-revalidation` namespace |

## 20. Spec Revision Log

| Date | Changes |
|------|---------|
| 2026-03-06T22:00 | **Exhaustive review and corrections**: Fixed 22 issues found during codebase verification. Key changes: (1) Fixed API result format from `result.success` to `result.ok` in migration examples. (2) Fixed ServiceContext type description (only has `logger`, not userId/role/permissions). (3) Fixed hook signatures to include `Actor` parameter. (4) Corrected AccommodationService hooks (does NOT override `_afterUpdate` currently). (5) Fixed event categories (9, not 5) and accommodation types (10, not 7). (6) Replaced non-existent `ArrowsClockwiseIcon` with `RotateCcwIcon`. (7) Added `alojamientos/index.astro` and `eventos/index.astro` to migration list (were incorrectly listed as "already SSR"). (8) Changed `destinationSlug` to `destinationPath` in EntityChangeData (destinations use hierarchical `path` field). (9) Fixed Tag relation queries to use polymorphic `r_entity_tag` table. (10) Fixed Amenity relation queries to use `r_accommodation_amenity` junction table. (11) Implemented `revalidateByEntityType` (was stub). (12) Added detailed stale detection logic in cron job. (13) Added complete delete hook pattern (data capture in `_before*`, revalidation in `_after*`). (14) Fixed homepage Server Islands count (4, not 5 - no ReviewsSection). (15) Added ISR exclude patterns for query-param listing pages. (16) Added SEO Impact Assessment section. (17) Added barrel export updates to file inventory. (18) Added new risks for query param pages and delete hooks. |
| 2026-03-06T23:30 | **Second exhaustive review against codebase**: Fixed 21 issues found by cross-referencing every spec claim against actual source code using 5 parallel exploration agents. Key changes: **(CRITICAL)** (1) Fixed `actor.userId` to `actor.id` (Actor type has `id` field). (2) Moved `tipo/[type]` and `categoria/[category]` pages from ISR-cached to ISR-excluded (both use query params in frontmatter for filtering). (3) Fixed that these pages do NOT have `prerender = true`. (4) Corrected accommodation types from 10 DB enum values to 7 URL slugs, event categories from 9 to 5 URL slugs, documented slug-to-enum mapping discrepancy. (5) Fixed `this.db.delete()` to `this.getClient().delete()` in RevalidationLogModel (BaseModel uses `getClient()` not `this.db`). (6) Added serverless debounce limitation (in-memory `setTimeout`/`Map` lost between Vercel instances). **(HIGH)** (7) Added `_beforeCreate` and `_beforeHardDelete` to AccommodationService hooks table. (8) Added warning about DestinationService/PostService overriding `update()` directly. (9) Fixed seed function to accept `SeedContext` parameter. (10) Fixed admin route path to `_authed/revalidation/`. (11) Added `_afterRestore` hooks to all 4 main entity services. (12) Added `_afterUpdateVisibility` hooks requirement. (13) Documented destination `path` field format (`/argentina/litoral/entre-rios` with leading slash). **(MEDIUM)** (14) Created `ACCOMMODATION_TYPE_TO_URL_SLUG` and `EVENT_CATEGORY_TO_URL_SLUG` mapping constants. (15) Added destination reparenting cascade risk. (16) Specified exact i18n namespace registration steps in `config.ts`. (17) Updated Phase 3 tasks from 18 to 22. (18) Added 5 new risks to Section 16. (19) Updated file inventory with corrected paths and descriptions. (20) Noted `FAIR` category exists in web app but not in DB EventCategoryEnum. (21) Added ISR exclude regex patterns for tipo and categoria. |
| 2026-03-07T00:00 | **Fix #22**: Replaced `this.destinationModel.findById()` with local `new DestinationModel()` instances in AccommodationService hook examples (Sections 5.5 `_triggerRevalidation` and `_beforeSoftDelete`). `AccommodationService` has `this.destinationService` (a `DestinationService`), not `this.destinationModel`. Using a local model instance is intentional to avoid permission checks for internal lookups. Added `import { DestinationModel } from '@repo/db'` to the AccommodationService import block. |
| 2026-03-16T12:00 | **Fourth exhaustive review - 8 corrections**: Cross-referenced spec against actual source code AND Vercel/Astro documentation via live web research. **(CRITICAL)** (C1) Removed incorrect `import type { SUPPORTED_LOCALES } from '@repo/i18n'` from entity-path-mapper.ts and revalidation.service.ts — `SUPPORTED_LOCALES` does NOT exist in `@repo/i18n`. The package exports `locales` (array: ['es', 'en', 'pt']) and `Locale` (type). Added clarifying comments. (C2) Changed hardcoded `locales: ['es', 'en', 'pt']` in initApp bootstrap to `import { locales } from '@repo/i18n'; ... locales: locales` to stay in sync with i18n config. (C3) Fixed `deleteOlderThan()` in `RevalidationLogModel` — Drizzle ORM's `.delete()` does not expose a `rowCount` property on its typed result. Replaced with `.returning({ id: table.id })` pattern and return `deleted.length`. **(SIGNIFICANT)** (S1) Clarified `initApp()` vs `index.ts` placement — added comment explaining DB initialization happens in `index.ts` before `initApp()` is called, so model access inside `RevalidationService` is safe. (S2) Removed redundant index on `entityType` in `revalidation_config` schema — `.unique()` already creates a unique index in PostgreSQL. (S3) Added FULL handler implementations for sections 7.2–7.6 (`revalidate-entity`, `revalidate-type`, `get-config`, `update-config`, `get-log`, `get-stats`) — previously only 7.1 had implementation code. (S4) Added `initializeRevalidationService`/`getRevalidationService` to service-core revalidation barrel export. Added IMPORTANT notes for updating `packages/service-core/src/index.ts`, `packages/db/src/models/index.ts`, `packages/db/src/schemas/index.ts`, and `packages/schemas/src/entities/index.ts` barrel exports with exact code snippets — previously mentioned in file inventory but not detailed. (S5) Added verification note for `EventModel`/`PostModel` availability in `@repo/db` (needed by revalidate-entity handler). |
| 2026-03-16T14:00 | **Fifth exhaustive review - 7 corrections**: Full analysis with 4 parallel exploration agents + live Vercel/Astro documentation research. **(HIGH)** (H1) Section 7.7: Replaced `new Hono()` with `createRouter()` from `utils/create-app` — `new Hono()` misses `OpenAPIHono<AppBindings>` configuration; all existing route barrels use `createRouter()`. Removed stale "IMPORTANT: verify pattern" note (pattern now confirmed and applied). (H2) Section 5.6: Added full TypeScript implementations of the 4 private resolver methods (`resolveAccommodationPaths`, `resolveDestinationPaths`, `resolveEventPaths`, `resolvePostPaths`) — previously only shown as a comment block. Added complete DB model imports to `revalidation.service.ts`. **(MEDIUM)** (M1) Section 10.1 & 10.3: Fixed cron schedule override — `CronJobDefinition.schedule` is a fixed `string`, not overridable at runtime. Updated job definition to use `schedule: env.HOSPEDA_REVALIDATION_CRON_SCHEDULE` (validated env with default `'0 * * * *'`). Added explanation of initialization timing (safe because cron modules are imported after `validateApiEnv()`). (M2) Section 5.5: Added explicit note about `cultural` → `CULTURAL` vs `CULTURE` DB enum mismatch in `EVENT_CATEGORY_TO_URL_SLUG` comment — a preexisting web app bug that was missing from spec (spec already noted `FAIR` discrepancy). Added to Section 16 risks table. **(LOW)** (L1) Section 4.4: Added note that Vercel also accepts `HEAD` for revalidation requests (not just `GET`). (L2) Section 5.2 config table: Added note that RegExp in `exclude` requires `@astrojs/vercel >= 8.1.0` (project uses `^8.2.11`, satisfied). (L3) Section 5.7 constructor: Fixed `AccommodationService` constructor signature to include optional `model?: AccommodationModel` param matching actual implementation. |
| 2026-03-16T00:00 | **Third exhaustive review - 12 critical fixes**: **(CRITICAL)** (C1) Fixed `import { db }` to `import { getDb }` in TagService and AmenityService - `@repo/db` does NOT export `db`. Also removed subpath `@repo/db/schemas` import (schemas are exported from `@repo/db` directly). Added `const db = getDb();` inside each async IIFE before query. (C2) Fixed `BaseModel.findAll()` return type - returns `{ items: T[], total: number }` not `T[]`. Fixed `findAllEnabled()` to destructure `result.items`. Fixed comment example in `revalidateByEntityType` to use `{ items: accommodations }` destructuring. (C3) Fixed `RevalidationLogModel.findLastCronEntry()` - `findOne()` doesn't support `orderBy` option (2nd param is `tx`). Replaced with raw Drizzle query using `desc()` and `.limit(1)`. Added `and, desc, eq` to drizzle-orm imports. (C4) Fixed `RevalidateEntityButton.tsx` URL - relative `/api/v1/...` hits admin server (port 3000) not API (port 3001). Use `fetchApi` from `@/lib/api/client.ts`. (C5) Fixed `usePermissions()` - hook doesn't exist. Use `useHasAnyPermission([...])` from `@/hooks/use-user-permissions`. Changed `const { hasPermission } = usePermissions()` to `const canTrigger = useHasAnyPermission([PermissionEnum.REVALIDATION_TRIGGER])` and updated guard accordingly. (C6) Fixed route mounting pattern - `route.mount(app)` doesn't exist. Actual pattern is `app.route('/', route)`. **(HIGH)** (H1) Fixed `eventos/categoria/[category]/index.astro` - DOES have `export const prerender = true;` (spec said it didn't). Updated both Section 5.3 migration table and Section 14 Phase 2 deliverable #8 and Section 19 item #9. (H2) 4 pages already SSR: `destinos/[slug]/alojamientos/index.astro`, `alojamientos/tipo/[type]/index.astro`, `alojamientos/index.astro`, `eventos/index.astro` - marked as "VERIFY FIRST / Already SSR" in Section 5.3 migration table, Section 14 Phase 2 deliverables, and Section 19 Files to Modify. (H3) Added `trailingSlash: 'always'` to astro.config.mjs proposed changes - currently missing from config. Added to code snippet and configuration table with explanation. (H4) Fixed API initialization location - use `apps/api/src/app.ts` inside `initApp()`, not `index.ts`. Updated comment and function label. **(MEDIUM)** (M1) Fixed web app env validation - `HOSPEDA_REVALIDATION_SECRET` must be added to `serverEnvSchema` in `apps/web/src/env.ts`. `getRevalidationSecret()` should use `_env` from `validateWebEnv()`. Added note that astro.config.mjs uses `process.env` directly (Node.js context), not this function. |
