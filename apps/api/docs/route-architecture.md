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

## Related Documentation

- `docs/development/route-factories.md` - factory API reference
- `docs/ACTOR_SYSTEM.md` - actor resolution and `getActorFromContext`
- `docs/development/actor-system.md` - actor patterns in handlers
- `docs/ERROR_HANDLING.md` - `ServiceError` and `handleRouteError`
- `docs/development/response-factory.md` - `ResponseFactory` reference
- `packages/schemas/src/common/admin-search.schema.ts` - `AdminSearchBaseSchema`
- `packages/schemas/src/enums/permission.enum.ts` - full `PermissionEnum` listing
