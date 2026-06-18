# Route Architecture Guide

Developer reference for the three-tier route architecture used throughout the Hospeda API.

---

## Three-Tier URL Convention

All entity routes are split across three URL prefixes. Each tier enforces its own authorization at the middleware level.

| Tier | URL Prefix | Auth | Purpose |
|------|-----------|------|---------|
| Public | `/api/v1/public/<entity>` | None | Read-only, published content only |
| Protected | `/api/v1/protected/<entity>` | User session required | CRUD on own resources |
| Admin | `/api/v1/admin/<entity>` | Admin role + `PermissionEnum` | Full CRUD, all resources |

### How Authorization Is Enforced

Authorization is applied per-route via the factory functions. Each factory injects a pre-configured middleware into the route's middleware chain before the handler executes.

- `publicAuthMiddleware()` - passes all requests through (guests allowed)
- `protectedAuthMiddleware(permissions?)` - rejects unauthenticated actors with 401; optionally checks all listed permissions (403 on failure)
- `adminAuthMiddleware(permissions?)` - rejects guests (401), then rejects actors without admin access (403), then optionally checks all listed permissions (403 on failure)

Admin access is granted when the actor has `RoleEnum.SUPER_ADMIN` or holds either `PermissionEnum.ACCESS_PANEL_ADMIN` or `PermissionEnum.ACCESS_API_ADMIN`.

---

## Factory Functions

Import all factories from `../../utils/route-factory`.

### Single-Resource Routes

| Factory | Tier | `skipAuth` | Use when |
|---------|------|-----------|----------|
| `createSimpleRoute` | System | configurable | Health checks, info endpoints, non-entity GET/POST |
| `createPublicRoute` | Public | `true` | Public GET for a single resource |
| `createProtectedRoute` | Protected | `false` | Authenticated write on own resource |
| `createAdminRoute` | Admin | `false` | Admin write/read on any resource |
| `createCRUDRoute` | Any | configurable | Generic CRUD - use tier-specific factories instead |
| `createOpenApiRoute` | Any | configurable | Alias - same as `createCRUDRoute` |

### Paginated List Routes

| Factory | Tier | `skipAuth` |
|---------|------|-----------|
| `createPublicListRoute` | Public | `true` |
| `createProtectedListRoute` | Protected | `false` |
| `createAdminListRoute` | Admin | `false` |
| `createListRoute` | Any | configurable |

`createListRoute` and its tier variants automatically merge `PaginationQuerySchema` (`page`, `pageSize`) with any custom `requestQuery` fields. Unknown query parameters are rejected with 400.

### Handler Signatures

#### Simple route

```typescript
handler: async (ctx: Context) => Promise<ResponseData>
```

#### CRUD / public / protected / admin route

```typescript
handler: async (
  ctx: Context,
  params: Record<string, unknown>,   // validated path params
  body: Record<string, unknown>,     // validated request body
  query?: Record<string, unknown>   // validated query params
) => Promise<ResponseData>
```

**List route** - handler must return `{ items, pagination }`:

```typescript
handler: async (ctx, params, body, query) => {
  return {
    items: result.data?.items || [],
    pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
  };
}
```

### Route Options

All factories accept an `options` field:

```typescript
options?: {
  skipAuth?: boolean;
  skipValidation?: boolean;
  customRateLimit?: { requests: number; windowMs: number };
  cacheTTL?: number;                    // seconds
  middlewares?: MiddlewareHandler[];    // prepended before handler
  authorizationLevel?: AuthorizationLevel;
  requiredPermissions?: PermissionEnum[];
  ownership?: OwnershipConfig;
}
```

The tier-specific factories (`createPublicRoute`, `createProtectedRoute`, `createAdminRoute`, `createPublicListRoute`, `createProtectedListRoute`, `createAdminListRoute`) set `skipAuth` and inject the correct auth middleware automatically. Pass `requiredPermissions` at the top level of the config (not inside `options`) when using these factories.

---

## Standard Admin List Query Params

All admin list routes use entity-specific schemas that extend `AdminSearchBaseSchema` from `@repo/schemas`.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | `number` | `1` | Page number (1-based) |
| `pageSize` | `number` | `20` | Items per page (max 100) |
| `search` | `string?` | - | Text search across name/title/description |
| `sort` | `string` | `createdAt:desc` | Format: `field:asc` or `field:desc` |
| `status` | `all\|DRAFT\|ACTIVE\|ARCHIVED` | `all` | Lifecycle status filter |
| `includeDeleted` | `boolean` | `false` | Include soft-deleted records |
| `createdAfter` | `ISO 8601 date?` | - | Lower bound on `createdAt` |
| `createdBefore` | `ISO 8601 date?` | - | Upper bound on `createdAt` |

Entity schemas extend this base and add entity-specific filters (e.g., `destinationId`, `category`, `isFeatured`).

```typescript
// Example entity admin search schema
import { AdminSearchBaseSchema } from '@repo/schemas';

export const AccommodationAdminSearchSchema = AdminSearchBaseSchema.extend({
  destinationId: z.string().uuid().optional(),
  isFeatured: z.coerce.boolean().optional()
});
```

---

## Entity Route Directory Structure

```
src/routes/<entity>/
  index.ts              # Re-exports from subdirectories only
  public/
    index.ts            # Assembles public router and exports it
    list.ts             # createPublicListRoute
    getById.ts          # createPublicRoute
    getBySlug.ts        # createPublicRoute
    ...
  protected/
    index.ts            # Assembles protected router and exports it
    create.ts           # createProtectedRoute
    update.ts           # createProtectedRoute
    patch.ts            # createProtectedRoute
    softDelete.ts       # createProtectedRoute
    import-from-url.ts  # createProtectedRoute (non-CRUD action: stateless URL import; OR-permission check + lazy AI quota — see docs/billing/endpoint-gate-matrix.md)
    ...
  admin/
    index.ts            # Assembles admin router and exports it
    list.ts             # createAdminListRoute
    getById.ts          # createAdminRoute
    create.ts           # createAdminRoute
    update.ts           # createAdminRoute
    patch.ts            # createAdminRoute
    delete.ts           # createAdminRoute  (soft delete)
    hardDelete.ts       # createAdminRoute
    restore.ts          # createAdminRoute
    batch.ts            # createAdminRoute
    ...
```

### Entity Barrel (`index.ts`)

The entity barrel only re-exports. No route registration happens here.

```typescript
// src/routes/accommodation/index.ts
export { adminAccommodationRoutes }     from './admin/index.js';
export { protectedAccommodationRoutes } from './protected/index.js';
export { publicAccommodationRoutes }    from './public/index.js';
```

### Tier Index Pattern

Each tier's `index.ts` creates a router, mounts all route files onto it, and exports the result.

```typescript
// src/routes/accommodation/admin/index.ts
import { createRouter } from '../../../utils/create-app';
import { adminListAccommodationsRoute }   from './list';
import { adminCreateAccommodationRoute }  from './create';
import { adminGetAccommodationByIdRoute } from './getById';
// ...

const app = createRouter();

app.route('/', adminListAccommodationsRoute);
app.route('/', adminCreateAccommodationRoute);
app.route('/', adminGetAccommodationByIdRoute);
// ...

export { app as adminAccommodationRoutes };
```

### Registration in `routes/index.ts`

```typescript
import {
  adminAccommodationRoutes,
  protectedAccommodationRoutes,
  publicAccommodationRoutes
} from './accommodation';

// Public tier
app.route('/api/v1/public/accommodations',     publicAccommodationRoutes);

// Protected tier
app.route('/api/v1/protected/accommodations',  protectedAccommodationRoutes);

// Admin tier
app.route('/api/v1/admin/accommodations',      adminAccommodationRoutes);
```

---

## Entities

The following entities use the three-tier structure:

| Entity | Public routes | Protected routes | Admin routes |
|--------|:---:|:---:|:---:|
| `accommodation` | yes | yes | yes |
| `destination` | yes | yes | yes |
| `event` | yes | yes | yes |
| `post` | yes | yes | yes |
| `amenity` | yes | yes | yes |
| `feature` | yes | yes | yes |
| `attraction` | yes | yes | yes |
| `tag` | yes | no | yes |
| `event-location` | yes | yes | yes |
| `event-organizer` | yes | yes | yes |
| `post-sponsor` | no | no | yes (admin-only) |
| `owner-promotion` | yes (legacy router) | no | yes |
| `views` | yes (capture only) | yes (read own/all) | no |
| `gastronomy` | yes | yes | yes |
| `gastronomy/reviews` | yes (approved only) | yes (create) | yes (full moderation) |
| `experience` | yes | yes | yes |
| `experience/reviews` | yes (approved only) | yes (create) | yes (full moderation) |
| `commerce` (leads + subscription) | yes (create-lead) | no | yes |
| `accommodation/external-listings` | no | yes (owner CRUD) | no |
| `accommodation/external-reputation` | yes (GET cached block) | yes (master-toggle, refresh) | yes (force-disable) |

---

## Permission Model

Admin routes declare required `PermissionEnum` values at the route level. The middleware checks that the actor holds **all** listed permissions.

```typescript
// src/routes/accommodation/admin/create.ts
import { PermissionEnum } from '@repo/schemas';
import { createAdminRoute } from '../../../utils/route-factory';

export const adminCreateAccommodationRoute = createAdminRoute({
  method: 'post',
  path: '/',
  summary: 'Create accommodation',
  description: 'Creates a new accommodation. Admin only.',
  tags: ['Accommodations'],
  requiredPermissions: [PermissionEnum.ACCOMMODATION_CREATE],
  requestBody: AccommodationCreateInputSchema,
  responseSchema: AccommodationAdminSchema,
  handler: async (ctx, _params, body) => {
    const actor = getActorFromContext(ctx);
    const result = await accommodationService.create(actor, body as AccommodationCreateInput);

    if (result.error) {
      throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
    }

    return result.data;
  }
});
```

Protected routes may also require permissions via `requiredPermissions`. The difference is that protected routes check the actor is authenticated first, then check permissions - they do not require admin-level access.

### Common Accommodation Permissions

```
ACCOMMODATION_CREATE
ACCOMMODATION_UPDATE_OWN
ACCOMMODATION_UPDATE_ANY
ACCOMMODATION_DELETE_OWN
ACCOMMODATION_DELETE_ANY
ACCOMMODATION_RESTORE_ANY
ACCOMMODATION_HARD_DELETE
ACCOMMODATION_VIEW_ALL
ACCOMMODATION_PUBLISH
```

All values follow the pattern `<ENTITY>_<ACTION>` in the enum, mapping to dot-notation strings (e.g., `accommodation.create`). Always reference `PermissionEnum` from `@repo/schemas`; never use raw strings.

---

## How to Add a New Entity

### 1. Create the directory structure

```bash
mkdir -p src/routes/<entity>/{public,protected,admin}
```

### 2. Create public routes

```typescript
// src/routes/<entity>/public/list.ts
import { createPublicListRoute } from '../../../utils/route-factory';
import { EntityPublicSchema, EntitySearchHttpSchema } from '@repo/schemas';
import { EntityService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';

const entityService = new EntityService({ logger: apiLogger });

export const publicListEntityRoute = createPublicListRoute({
  method: 'get',
  path: '/',
  summary: 'List entities',
  description: 'Returns a paginated list of public entities',
  tags: ['Entities'],
  requestQuery: EntitySearchHttpSchema.shape,
  responseSchema: EntityPublicSchema,
  handler: async (ctx, _params, _body, query) => {
    const actor = getActorFromContext(ctx);
    const { page, pageSize } = extractPaginationParams(query || {});
    const result = await entityService.list(actor, { page, pageSize });

    if (result.error) {
      throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
    }

    return {
      items: result.data?.items || [],
      pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
    };
  },
  options: { cacheTTL: 300 }
});
```

```typescript
// src/routes/<entity>/public/getById.ts
import { createPublicRoute } from '../../../utils/route-factory';
import { z } from 'zod';

export const publicGetEntityByIdRoute = createPublicRoute({
  method: 'get',
  path: '/:id',
  summary: 'Get entity by ID',
  description: 'Returns a single public entity by ID',
  tags: ['Entities'],
  requestParams: { id: z.string().uuid() },
  responseSchema: EntityPublicSchema,
  handler: async (ctx, params) => {
    const actor = getActorFromContext(ctx);
    const result = await entityService.findById(actor, params.id as string);

    if (result.error) {
      throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
    }

    return result.data;
  }
});
```

```typescript
// src/routes/<entity>/public/index.ts
import { createRouter } from '../../../utils/create-app';
import { publicListEntityRoute }     from './list';
import { publicGetEntityByIdRoute }  from './getById';

const app = createRouter();

app.route('/', publicListEntityRoute);
app.route('/', publicGetEntityByIdRoute);

export { app as publicEntityRoutes };
```

### 3. Create protected routes

```typescript
// src/routes/<entity>/protected/create.ts
import { createProtectedRoute } from '../../../utils/route-factory';
import { PermissionEnum } from '@repo/schemas';

export const protectedCreateEntityRoute = createProtectedRoute({
  method: 'post',
  path: '/',
  summary: 'Create entity',
  description: 'Creates a new entity for the authenticated user',
  tags: ['Entities'],
  requiredPermissions: [PermissionEnum.ENTITY_CREATE],
  requestBody: EntityCreateInputSchema,
  responseSchema: EntityProtectedSchema,
  handler: async (ctx, _params, body) => {
    const actor = getActorFromContext(ctx);
    const result = await entityService.create(actor, body as EntityCreateInput);

    if (result.error) {
      throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
    }

    return result.data;
  }
});
```

```typescript
// src/routes/<entity>/protected/index.ts
import { createRouter } from '../../../utils/create-app';
import { protectedCreateEntityRoute } from './create';

const app = createRouter();

app.route('/', protectedCreateEntityRoute);

export { app as protectedEntityRoutes };
```

### 4. Create admin routes

```typescript
// src/routes/<entity>/admin/list.ts
import { createAdminListRoute } from '../../../utils/route-factory';

export const adminListEntityRoute = createAdminListRoute({
  method: 'get',
  path: '/',
  summary: 'List all entities (admin)',
  description: 'Returns all entities including deleted ones',
  tags: ['Entities'],
  requestQuery: EntityAdminSearchSchema.shape,
  responseSchema: EntityAdminSchema,
  handler: async (ctx, _params, _body, query) => {
    const actor = getActorFromContext(ctx);
    const { page, pageSize } = extractPaginationParams(query || {});
    const result = await entityService.list(actor, { page, pageSize });

    if (result.error) {
      throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
    }

    return {
      items: result.data?.items || [],
      pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
    };
  }
});
```

```typescript
// src/routes/<entity>/admin/index.ts
import { createRouter } from '../../../utils/create-app';
import { adminListEntityRoute }   from './list';
import { adminCreateEntityRoute } from './create';
// ...

const app = createRouter();

app.route('/', adminListEntityRoute);
app.route('/', adminCreateEntityRoute);

export { app as adminEntityRoutes };
```

### 5. Create the entity barrel

```typescript
// src/routes/<entity>/index.ts
export { adminEntityRoutes }     from './admin/index.js';
export { protectedEntityRoutes } from './protected/index.js';
export { publicEntityRoutes }    from './public/index.js';
```

### 6. Register in `routes/index.ts`

```typescript
import {
  adminEntityRoutes,
  protectedEntityRoutes,
  publicEntityRoutes
} from './<entity>';

// Inside setupRoutes():
app.route('/api/v1/public/<entity>s',     publicEntityRoutes);
app.route('/api/v1/protected/<entity>s',  protectedEntityRoutes);
app.route('/api/v1/admin/<entity>s',      adminEntityRoutes);
```

---

## View Tracking Routes (SPEC-159)

View tracking uses a non-standard layout: one public write endpoint and three protected
read endpoints, all under the `views` path. There is no admin tier.

### Public capture

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| `POST` | `/api/v1/public/views` | None (`skipAuth: true`) | Fire-and-forget; always returns **202 Accepted**. Bot UA matches get a fake-202 (no signal to crawlers). Rate limited to **30 requests/min per IP**. |

Request body: `{ entityType: 'ACCOMMODATION' | 'POST' | 'EVENT', entityId: uuid }`.
`visitorHash` is computed **server-side** (daily-salted SHA-256 of truncated IP + UA); raw IPs
are never stored. See the privacy note in `docs/guides/view-tracking-privacy.md`.

### Protected reads

| Method | Path | Permission | Response |
|--------|------|-----------|---------|
| `GET` | `/api/v1/protected/views/accommodations/me?window=7d\|30d` | `ACCOMMODATION_VIEW_OWN` | `[{ entityId, unique, total }]` scoped to the actor's own accommodations only |
| `GET` | `/api/v1/protected/views/posts?window=7d\|30d` | `POST_VIEW_ALL` | `[{ entityId, unique, total }]` for requested post ids |
| `GET` | `/api/v1/protected/views/events?window=7d\|30d` | `EVENT_VIEW_ALL` | `[{ entityId, unique, total }]` for requested event ids |

All three read routes use `cacheTTL: 60`. Unique-visitor counts are **approximate** (cookieless
dedup — see privacy note). The `window` query param is required (`7d` or `30d`).

---

## Gastronomy Routes (SPEC-239)

Gastronomy listings follow the standard three-tier structure mounted at:

- `/api/v1/public/gastronomies` — public reads, no auth
- `/api/v1/protected/gastronomies` — owner-scoped edits, session required
- `/api/v1/admin/gastronomies` — full CRUD, `PermissionEnum.COMMERCE_*`

Reviews have their own admin sub-router mounted at
`/api/v1/admin/gastronomies/reviews`.

### Public tier

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/api/v1/public/gastronomies` | Paginated list (filter by type, priceRange, destinationId, isFeatured, ownerId) |
| `GET` | `/api/v1/public/gastronomies/{id}` | Get by UUID; 404 when not publicly visible |
| `GET` | `/api/v1/public/gastronomies/slug/{slug}` | Get by URL slug; null when not found |
| `GET` | `/api/v1/public/gastronomies/destination/{destinationId}` | Paginated list filtered by destination |
| `GET` | `/api/v1/public/gastronomies/{gastronomyId}/faqs` | Ordered FAQ list (displayOrder ASC NULLS LAST) |
| `GET` | `/api/v1/public/gastronomies/{gastronomyId}/reviews` | Paginated APPROVED-only reviews |

### Protected tier (session required, owner-scoped)

| Method | Path | Permission | Notes |
|--------|------|-----------|-------|
| `GET` | `/api/v1/protected/gastronomies/{id}` | Auth only | Returns `GastronomyProtectedSchema` (includes ownerId, contactInfo, audit fields) |
| `PATCH` | `/api/v1/protected/gastronomies/{id}` | `COMMERCE_*_EDIT_OWN` (per-section, enforced in service) | Operational fields only; identity fields silently stripped by Zod |
| `POST` | `/api/v1/protected/gastronomies/{id}/faqs` | `COMMERCE_FAQS_EDIT_OWN` | displayOrder auto-assigned as max+1 |
| `PUT` | `/api/v1/protected/gastronomies/{id}/faqs/{faqId}` | `COMMERCE_FAQS_EDIT_OWN` | Update existing FAQ |
| `DELETE` | `/api/v1/protected/gastronomies/{id}/faqs/{faqId}` | Auth only | Removal always allowed |
| `PUT` | `/api/v1/protected/gastronomies/{id}/faqs/reorder` | `COMMERCE_FAQS_EDIT_OWN` | Bulk displayOrder update |
| `POST` | `/api/v1/protected/gastronomies/{gastronomyId}/reviews` | Auth only | Review starts in PENDING state; one per user per listing enforced |

### Admin tier

| Method | Path | `requiredPermissions` | Notes |
|--------|------|-----------------------|-------|
| `GET` | `/api/v1/admin/gastronomies` | `COMMERCE_VIEW_ALL` | Paginated list with full admin details |
| `POST` | `/api/v1/admin/gastronomies` | `COMMERCE_CREATE` | Create listing |
| `GET` | `/api/v1/admin/gastronomies/options` | Panel access only | Lightweight `{id, label, slug, type, destination}` for relation selectors |
| `POST` | `/api/v1/admin/gastronomies/batch` | `COMMERCE_VIEW_ALL` | Resolve multiple UUIDs to display labels |
| `GET` | `/api/v1/admin/gastronomies/{id}` | `COMMERCE_VIEW_ALL` | Full admin details |
| `PUT` | `/api/v1/admin/gastronomies/{id}` | `COMMERCE_EDIT_ALL` | Full update |
| `PATCH` | `/api/v1/admin/gastronomies/{id}` | `COMMERCE_EDIT_ALL` | Partial update |
| `DELETE` | `/api/v1/admin/gastronomies/{id}` | `COMMERCE_DELETE` | Soft delete |
| `DELETE` | `/api/v1/admin/gastronomies/{id}/hard` | `COMMERCE_DELETE` | Permanent delete |
| `POST` | `/api/v1/admin/gastronomies/{id}/restore` | `COMMERCE_EDIT_ALL` | Restore soft-deleted listing |
| `POST` | `/api/v1/admin/gastronomies/{id}/assign-owner` | `COMMERCE_EDIT_ALL` | Set or replace the `COMMERCE_OWNER` |
| `GET` | `/api/v1/admin/gastronomies/{id}/faqs` | `COMMERCE_VIEW_ALL` | All FAQs including drafts |
| `POST` | `/api/v1/admin/gastronomies/{id}/faqs` | `COMMERCE_EDIT_ALL` | Add FAQ |
| `PUT` | `/api/v1/admin/gastronomies/{id}/faqs/{faqId}` | `COMMERCE_EDIT_ALL` | Update FAQ |
| `DELETE` | `/api/v1/admin/gastronomies/{id}/faqs/{faqId}` | `COMMERCE_EDIT_ALL` | Remove FAQ |
| `PATCH` | `/api/v1/admin/gastronomies/{id}/faqs/reorder` | `COMMERCE_EDIT_ALL` | Bulk displayOrder update |

### Gastronomy Reviews — Admin

Reviews are mounted on a separate sub-router at `/api/v1/admin/gastronomies/reviews`.

| Method | Path | `requiredPermissions` | Notes |
|--------|------|-----------------------|-------|
| `GET` | `/api/v1/admin/gastronomies/reviews` | `COMMERCE_MODERATE_REVIEW` | All reviews including PENDING and REJECTED |
| `GET` | `/api/v1/admin/gastronomies/reviews/{id}` | `COMMERCE_MODERATE_REVIEW` | Full review with moderation fields |
| `PUT` | `/api/v1/admin/gastronomies/reviews/{id}` | `COMMERCE_EDIT_ALL` + `COMMERCE_MODERATE_REVIEW` | Update review content |
| `DELETE` | `/api/v1/admin/gastronomies/reviews/{id}` | `COMMERCE_MODERATE_REVIEW` | Soft delete |
| `POST` | `/api/v1/admin/gastronomies/reviews/{id}/moderate` | `COMMERCE_MODERATE_REVIEW` | Approve or reject; triggers rating recompute |

---

## Experience Routes (SPEC-240)

Experience listings follow the standard three-tier structure mounted at:

- `/api/v1/public/experiences` — public reads, no auth
- `/api/v1/protected/experiences` — owner-scoped edits, session required
- `/api/v1/admin/experiences` — full CRUD, `PermissionEnum.COMMERCE_*`

Reviews have their own admin sub-router mounted at
`/api/v1/admin/experiences/reviews`.

### Public tier

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/api/v1/public/experiences` | Paginated list (filter by type, destinationId, isFeatured, ownerId) |
| `GET` | `/api/v1/public/experiences/{id}` | Get by UUID; 404 when not publicly visible |
| `GET` | `/api/v1/public/experiences/slug/{slug}` | Get by URL slug; null when not found |
| `GET` | `/api/v1/public/experiences/destination/{destinationId}` | Paginated list filtered by destination |
| `GET` | `/api/v1/public/experiences/{experienceId}/faqs` | Ordered FAQ list (displayOrder ASC NULLS LAST) |
| `GET` | `/api/v1/public/experiences/{experienceId}/reviews` | Paginated APPROVED-only reviews |

### Protected tier (session required, owner-scoped)

| Method | Path | Permission | Notes |
|--------|------|-----------|-------|
| `GET` | `/api/v1/protected/experiences/{id}` | Auth only | Returns `ExperienceProtectedSchema` (includes ownerId, contactInfo, audit fields) |
| `PATCH` | `/api/v1/protected/experiences/{id}` | `COMMERCE_*_EDIT_OWN` (per-section, enforced in service) | Operational fields only; identity fields silently stripped by Zod |
| `POST` | `/api/v1/protected/experiences/{id}/faqs` | `COMMERCE_FAQS_EDIT_OWN` | displayOrder auto-assigned as max+1 |
| `PUT` | `/api/v1/protected/experiences/{id}/faqs/{faqId}` | `COMMERCE_FAQS_EDIT_OWN` | Update existing FAQ |
| `DELETE` | `/api/v1/protected/experiences/{id}/faqs/{faqId}` | Auth only | Removal always allowed |
| `PUT` | `/api/v1/protected/experiences/{id}/faqs/reorder` | `COMMERCE_FAQS_EDIT_OWN` | Bulk displayOrder update |
| `POST` | `/api/v1/protected/experiences/{experienceId}/reviews` | Auth only | Review starts in PENDING state; one per user per listing enforced |

### Admin tier

| Method | Path | `requiredPermissions` | Notes |
|--------|------|-----------------------|-------|
| `GET` | `/api/v1/admin/experiences` | `COMMERCE_VIEW_ALL` | Paginated list with full admin details |
| `POST` | `/api/v1/admin/experiences` | `COMMERCE_CREATE` | Create listing |
| `GET` | `/api/v1/admin/experiences/options` | Panel access only | Lightweight `{id, label, slug, type, destination}` for relation selectors |
| `POST` | `/api/v1/admin/experiences/batch` | `COMMERCE_VIEW_ALL` | Resolve multiple UUIDs to display labels |
| `GET` | `/api/v1/admin/experiences/{id}` | `COMMERCE_VIEW_ALL` | Full admin details |
| `PUT` | `/api/v1/admin/experiences/{id}` | `COMMERCE_EDIT_ALL` | Full update |
| `PATCH` | `/api/v1/admin/experiences/{id}` | `COMMERCE_EDIT_ALL` | Partial update |
| `DELETE` | `/api/v1/admin/experiences/{id}` | `COMMERCE_DELETE` | Soft delete |
| `DELETE` | `/api/v1/admin/experiences/{id}/hard` | `COMMERCE_DELETE` | Permanent delete |
| `POST` | `/api/v1/admin/experiences/{id}/restore` | `COMMERCE_EDIT_ALL` | Restore soft-deleted listing |
| `POST` | `/api/v1/admin/experiences/{id}/toggle-subscription` | `COMMERCE_EDIT_ALL` | Toggle MercadoPago subscription active/inactive |
| `POST` | `/api/v1/admin/experiences/{id}/assign-owner` | `COMMERCE_EDIT_ALL` | Set or replace the `COMMERCE_OWNER` |
| `GET` | `/api/v1/admin/experiences/{id}/faqs` | `COMMERCE_VIEW_ALL` | All FAQs including drafts |
| `POST` | `/api/v1/admin/experiences/{id}/faqs` | `COMMERCE_EDIT_ALL` | Add FAQ |
| `PUT` | `/api/v1/admin/experiences/{id}/faqs/{faqId}` | `COMMERCE_EDIT_ALL` | Update FAQ |
| `DELETE` | `/api/v1/admin/experiences/{id}/faqs/{faqId}` | `COMMERCE_EDIT_ALL` | Remove FAQ |
| `PATCH` | `/api/v1/admin/experiences/{id}/faqs/reorder` | `COMMERCE_EDIT_ALL` | Bulk displayOrder update |

### Experience Reviews — Admin

Reviews are mounted on a separate sub-router at `/api/v1/admin/experiences/reviews`.

| Method | Path | `requiredPermissions` | Notes |
|--------|------|-----------------------|-------|
| `GET` | `/api/v1/admin/experiences/reviews` | `COMMERCE_MODERATE_REVIEW` | All reviews including PENDING and REJECTED |
| `GET` | `/api/v1/admin/experiences/reviews/{id}` | `COMMERCE_MODERATE_REVIEW` | Full review with moderation fields |
| `PUT` | `/api/v1/admin/experiences/reviews/{id}` | `COMMERCE_EDIT_ALL` + `COMMERCE_MODERATE_REVIEW` | Update review content |
| `DELETE` | `/api/v1/admin/experiences/reviews/{id}` | `COMMERCE_MODERATE_REVIEW` | Soft delete |
| `POST` | `/api/v1/admin/experiences/reviews/{id}/moderate` | `COMMERCE_MODERATE_REVIEW` | Approve or reject; triggers rating recompute |

---

## Commerce Routes (SPEC-239)

Commerce routes handle lead intake and subscription provisioning for the
admin-sells flow. They are mounted at:

- `/api/v1/public/commerce` — unauthenticated lead submission
- `/api/v1/admin/commerce` — lead inbox, owner provisioning, subscription start

There is no protected commerce tier (merchants operate exclusively through the
protected gastronomy tier once provisioned as `COMMERCE_OWNER`).

### Public tier

| Method | Path | Notes |
|--------|------|-------|
| `POST` | `/api/v1/public/commerce/leads` | Submit "Sumar mi negocio" lead form. No auth. Honeypot spam guard (`_hp` field). Rate-limited to 5 req/min per IP. Silent 200 on honeypot trigger. |

### Admin tier

| Method | Path | `requiredPermissions` | Notes |
|--------|------|-----------------------|-------|
| `GET` | `/api/v1/admin/commerce/leads` | `COMMERCE_VIEW_ALL` | Paginated lead list; filterable by `status` and `domain` |
| `POST` | `/api/v1/admin/commerce/leads/:id/handle` | `COMMERCE_EDIT_ALL` | Approve or reject a lead; idempotent (overwrites previous decision) |
| `POST` | `/api/v1/admin/commerce/leads/:id/provision-owner` | `COMMERCE_EDIT_ALL` | Create a `COMMERCE_OWNER` user from an approved lead; emails temp credentials; never returns the password |
| `POST` | `/api/v1/admin/commerce/listings/:entityType/:entityId/start-subscription` | `COMMERCE_EDIT_ALL` | Provisions a MercadoPago preapproval recurring subscription for the listing. `entityType` is currently `gastronomy` only. Requires the listing to have an owner assigned first. |

---

## External Reputation Routes (SPEC-237)

Routes for displaying and managing external-platform reputation data
(Google Places review snippets, Booking/Airbnb aggregate ratings) on
accommodation detail pages. Mounted under the accommodation URL namespace.

Key invariant: these routes operate on a **separate cached entity**
(`accommodation_external_reputation`) and must never affect
`accommodations.averageRating`. See
[ADR-036](../../../docs/decisions/ADR-036-external-reputation-separate-entity.md)
for the full design rationale.

### Public tier

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/api/v1/public/accommodations/:id/external-reputation` | Returns the cached reputation block for all enabled platforms. No auth. Google snippets are included only when `snippetsFetchedAt` is within the 30-day TTL; they are stripped (aggregate-only) once expired. Never returns snippet text for Booking/Airbnb/generic. |

### Protected tier (session required)

| Method | Path | `requiredPermissions` | Notes |
|--------|------|-----------------------|-------|
| `GET` | `/api/v1/protected/accommodations/:id/external-listings` | `ACCOMMODATION_UPDATE_OWN` | List all external listing registrations for the actor's accommodation. |
| `POST` | `/api/v1/protected/accommodations/:id/external-listings` | `ACCOMMODATION_UPDATE_OWN` | Register a new external platform link (URL, platform, per-listing display flags). |
| `PATCH` | `/api/v1/protected/accommodations/:id/external-listings/:listingId` | `ACCOMMODATION_UPDATE_OWN` | Update display flags (`showReviews`, `showLink`, `showRating`) on an existing listing. |
| `DELETE` | `/api/v1/protected/accommodations/:id/external-listings/:listingId` | `ACCOMMODATION_UPDATE_OWN` | Remove an external listing registration; cascades to its reputation cache row. |
| `PATCH` | `/api/v1/protected/accommodations/:id/external-reputation/master-toggle` | `ACCOMMODATION_UPDATE_OWN` | Set `show_external_reputation` on the accommodation row. When `false`, the public detail page hides the entire external reputation block. |
| `POST` | `/api/v1/protected/accommodations/:id/external-reputation/refresh` | `ACCOMMODATION_UPDATE_OWN` | Trigger an on-demand reputation refresh. Rate-limited per owner to prevent quota abuse — returns **429** with a `Retry-After` header when the window has not elapsed. |

### Admin tier

| Method | Path | `requiredPermissions` | Notes |
|--------|------|-----------------------|-------|
| `POST` | `/api/v1/admin/accommodations/:id/external-reputation/disable` | `ACCOMMODATION_UPDATE_ANY` | Force `show_external_reputation = false` for any accommodation. Admin override — bypasses owner ownership check. |

### Environment variables required

The following env vars must be set in Coolify for the external reputation feature
to function on staging and production:

| Variable | Purpose |
|----------|---------|
| `HOSPEDA_GOOGLE_PLACES_API_KEY` | Google Places API (New) key for fetching ratings and review snippets. |
| `HOSPEDA_APIFY_TOKEN` | Apify API token used by Booking/Airbnb/generic scrapers. |
| `HOSPEDA_EXTREP_CRON_SCHEDULE` | Cron expression for the weekly refresh job. Defaults to `0 2 * * 1` (Monday 02:00 UTC). |

---

## Anti-Patterns

**Never PUT/POST/DELETE in the public tier.**
Public routes are read-only. Mutation endpoints belong in protected or admin tiers.

```typescript
// WRONG
export const publicCreateRoute = createPublicRoute({
  method: 'post', // mutation on a public route
  // ...
});

// CORRECT
export const protectedCreateRoute = createProtectedRoute({
  method: 'post',
  // ...
});
```

**Never skip auth on admin routes.**
Admin routes must always use `createAdminRoute` or `createAdminListRoute`. Do not pass `skipAuth: true` through `options` on an admin route.

```typescript
// WRONG
export const adminRoute = createAdminRoute({
  // ...
  options: { skipAuth: true } // negates the admin middleware
});
```

**Never check roles directly. Use `PermissionEnum`.**
Services and routes must not compare `actor.role` to string literals. Always use `PermissionEnum` values and let `adminAuthMiddleware` or `protectedAuthMiddleware` enforce access.

```typescript
// WRONG - in a route handler
if (actor.role !== 'admin') {
  throw new HTTPException(403);
}

// CORRECT - declare at route level
export const adminRoute = createAdminRoute({
  requiredPermissions: [PermissionEnum.ACCOMMODATION_DELETE_ANY],
  handler: async (ctx, params) => {
    // actor already passed admin + permission checks
  }
});
```

**Never mix tiers in one router.**
Each tier index file must only contain routes belonging to that tier. Do not import admin route files into a public or protected index, or vice versa.

```typescript
// WRONG
// src/routes/accommodation/public/index.ts
import { adminCreateAccommodationRoute } from '../admin/create'; // wrong tier
app.route('/', adminCreateAccommodationRoute);

// CORRECT - each tier index only mounts its own routes
```

---

## Response Format

All factory functions wrap handler return values in the standard envelope automatically.

#### Success

```json
{
  "success": true,
  "data": { },
  "metadata": {
    "timestamp": "2026-01-01T00:00:00.000Z",
    "requestId": "req_abc123"
  }
}
```

**Paginated success** (list routes)

```json
{
  "success": true,
  "data": [ ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 150,
    "totalPages": 8
  },
  "metadata": { "timestamp": "..." }
}
```

#### Error

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Accommodation not found"
  },
  "metadata": { "timestamp": "..." }
}
```

HTTP status codes set by the factory:

| Method | Success code |
|--------|-------------|
| GET | 200 |
| POST | 201 |
| PUT / PATCH | 200 |
| DELETE (with body) | 200 |
| DELETE (no body) | 204 |

---

## CORS — media routes

Media upload and delete routes (`POST /api/v1/admin/media/upload`, `DELETE /api/v1/admin/media`, `POST /api/v1/protected/media/upload`) inherit the global CORS configuration from `src/middlewares/cors.ts` (`createCorsMiddleware` → `getCorsConfig`). No per-route CORS override is applied.

| Setting | Value (default) | Source |
|---------|-----------------|--------|
| Allowed origins | `HOSPEDA_SITE_URL` (web) and `HOSPEDA_ADMIN_URL` (admin) | `API_CORS_ORIGINS` env (comma-separated) |
| Allowed methods | `GET, POST, PUT, DELETE, PATCH, OPTIONS` | `API_CORS_ALLOW_METHODS` env |
| Allowed headers | `Content-Type, Authorization, X-Requested-With` | `API_CORS_ALLOW_HEADERS` env |
| Credentials | `true` (forced `false` if any origin is `*`) | `API_CORS_ALLOW_CREDENTIALS` env |
| Preflight cache (`Access-Control-Max-Age`) | `86400` seconds | `API_CORS_MAX_AGE` env |

Per-route notes:

- The `OPTIONS` preflight is handled by Hono's CORS middleware before authentication runs, so unauthenticated browsers can negotiate the upload contract without hitting `401`.
- Multipart uploads MUST send `Content-Type: multipart/form-data; boundary=...` (the boundary is set by the browser — clients should not override it manually). Cookie-based auth flows additionally rely on `Authorization` being present in `API_CORS_ALLOW_HEADERS`.
- Wildcard origins (`*`) are incompatible with credentialed uploads: `createCorsMiddleware` automatically downgrades `credentials` to `false` in that case (see `src/middlewares/cors.ts`). Production deployments must enumerate explicit origins for the web and admin apps.

See also: `apps/api/docs/cors-configuration.md` for the global CORS configuration reference and `originVerificationMiddleware` defense-in-depth check.

---

## Related Documentation

- `docs/development/route-factories.md` - factory API reference
- `docs/ACTOR_SYSTEM.md` - actor resolution and `getActorFromContext`
- `docs/development/actor-system.md` - actor patterns in handlers
- `docs/ERROR_HANDLING.md` - `ServiceError` and `handleRouteError`
- `docs/development/response-factory.md` - `ResponseFactory` reference
- `packages/schemas/src/common/admin-search.schema.ts` - `AdminSearchBaseSchema`
- `packages/schemas/src/enums/permission.enum.ts` - full `PermissionEnum` listing
