# Technical Analysis: SPEC-170 — Per-User Granular Permission Management Panel

## 1. Overview

### Feature Summary

Build the missing API surface and admin UI for managing per-user permission overrides in the
Hospeda platform. The backend layer (DB schema, service, auth-time resolution) is ~95% complete.
The spec adds:

1. A **schema migration** to add an `effect: 'grant' | 'deny'` column to `user_permission`.
2. **Auth-resolution changes** in `actor.ts` to implement `(rolePerms ∪ grants) \ denies` with
   deny-wins semantics.
3. **Three API endpoints** under `/api/v1/admin/users/:id/permissions`.
4. **Service extension** to `assignPermissionToUser` to carry `effect`.
5. **Cache invalidation** on every write.
6. **Seed fix** to explicitly seed `PERMISSION_VIEW`, `PERMISSION_ASSIGN`, `PERMISSION_REVOKE` to
   SUPER_ADMIN (currently only `ACCESS_PERMISSIONS_MANAGE` is seeded; helpers already check the
   granular trio but SUPER_ADMIN passes only via its all-permissions short-circuit).
7. **Admin UI** replacing the stub card at `$id_.permissions.tsx`.
8. **Audit emission** on every grant / revoke / deny.

### Technical Complexity

**Rating:** Medium-High

**Justification:** The schema migration is low-risk (additive column with default). The hard part
is the auth-resolution change: it runs on EVERY authenticated request hot-path and a precedence
bug is a platform-wide auth failure. The UI has medium complexity (categorized picker with 4 visual
states). The service extension, seed fix, and audit emission are straightforward.

### Estimated Effort

**Total:** 24-32 hours

#### Breakdown

- Schema migration + DB model update: 2 h
- Zod schemas + type exports (@repo/schemas): 2 h
- Service extension (effect param + getUserPermissionsWithEffect): 3 h
- actor.ts resolution change: 2 h (+ 3 h unit tests = 5 h total for resolution)
- Seed fix (PERMISSION_* on SUPER_ADMIN): 1 h
- API routes (3 routes + router): 3 h
- Cache invalidation wiring: 1 h
- Audit emission: 1 h
- Admin UI (PermissionOverridesCard + picker + hooks): 7 h
- i18n keys: 1 h
- Integration / E2E tests: 3 h

---

## 2. Architecture Analysis

### Affected Layers

- [x] Database (schema migration — additive column)
- [x] Model / Repository (`RUserPermissionModel` — return shape change)
- [x] Service (`PermissionService.assignPermissionToUser`, new `getPermissionOverridesForUser`)
- [x] API (3 new routes under `/api/v1/admin/users/:id/permissions`)
- [x] Auth middleware (`actor.ts` — deny-override resolution)
- [x] Cache (`user-permissions-cache.ts` — invalidation on write)
- [x] Seed (`rolePermissions.seed.ts` — PERMISSION_* to SUPER_ADMIN)
- [x] Frontend (admin `$id_.permissions.tsx` replacement)

### New vs Existing

- **New entities / tables:** none
- **Modified entities:** `user_permission` (new `effect` column)
- **New schemas (Zod):** `UserPermissionOverrideSchema`, `UserPermissionOverridesResponseSchema`,
  `AssignUserPermissionOverrideBodySchema`, `DeleteUserPermissionOverrideParamsSchema`
- **Modified schemas:** `UserPermissionAssignmentSchema` (add `effect` field),
  `UserPermissionManagementInputSchema` (add optional `effect`)
- **Modified service methods:** `assignPermissionToUser` (add `effect` param)
- **New service methods:** `getPermissionOverridesForUser` (returns split by effect)
- **New API routes:** `GET`, `POST`, `DELETE /api/v1/admin/users/:id/permissions`
- **Modified middleware:** `actor.ts` (deny-override filtering)
- **Modified cache:** `user-permissions-cache.ts` (return shape + invalidation call-sites)
- **Reusable components:** `createAdminRoute` factory, `ResponseFactory`, `invalidateUserPermissionsCache`

### Architecture Diagram

```mermaid
sequenceDiagram
    participant Admin UI
    participant API Route
    participant PermissionService
    participant RUserPermissionModel
    participant UserPermsCache
    participant actor.ts

    Admin UI->>API Route: POST /admin/users/:id/permissions {permission, effect}
    API Route->>PermissionService: assignPermissionToUser(actor, {userId, permission, effect})
    PermissionService->>RUserPermissionModel: upsert {userId, permission, effect}
    PermissionService->>UserPermsCache: invalidateUserPermissionsCache({userId})
    PermissionService-->>API Route: {assigned: true}
    API Route-->>Admin UI: 201 Created

    Note over actor.ts: Next request by target user
    actor.ts->>UserPermsCache: getUserPermissions({userId})
    UserPermsCache->>RUserPermissionModel: findAll({userId})
    UserPermsCache-->>actor.ts: [{permission, effect}]
    actor.ts->>actor.ts: (rolePerms ∪ grants) \ denies
    actor.ts-->>actor.ts: actor.permissions = effectiveSet
```

---

## 3. Database Design

### Modified Table: `user_permission`

**Current schema** (`packages/db/src/schemas/user/r_user_permission.dbschema.ts`):
```
(userId UUID NOT NULL, permission permission_enum NOT NULL)
PK (userId, permission)
```

**Change:** add `effect` column with default `'grant'`.

**Drizzle schema change (exact):**

```typescript
// In r_user_permission.dbschema.ts — add ONE column; everything else untouched

// Option A: varchar + CHECK constraint (see discussion below)
effect: varchar('effect', { length: 10 }).notNull().default('grant')

// Option B: new pgEnum (see discussion below)
// effectPgEnum defined in enums.dbschema.ts
effect: effectPgEnum('effect').notNull().default('grant')
```

#### Decision required: varchar+check vs new pgEnum (PENDIENTE DEL OWNER)

Two viable approaches for the `effect` column type:

**Opcion 1 — `varchar('effect', { length: 10 }).notNull().default('grant')` + CHECK constraint**
- What it does: stores the string `'grant'` or `'deny'`; validity enforced by a manual CHECK constraint applied via `apply-postgres-extras.sh` (pattern already used for `billing_addon_purchases`).
- Pros: no new pgEnum in the DB catalog; minimal schema surface; additive-safe.
- Cons: CHECK constraint is invisible to Drizzle and must be hand-maintained in the extras script; the TypeScript type must be asserted manually in the model.
- Impact: requires a new entry in `packages/db/src/migrations/manual/0015_user_permission_effect_check.sql` and an idempotent `ALTER TABLE … ADD CONSTRAINT` in `apply-postgres-extras.sh`. The extras script already exists; this is a one-line addition.

**Opcion 2 — new `pgEnum('permission_effect_enum', ['grant', 'deny'])` + Drizzle declaration**
- What it does: creates a proper PostgreSQL enum type visible to Drizzle; the column is typed end-to-end.
- Pros: type safety at the DB level; Drizzle generates the column correctly; no manual CHECK needed.
- Cons: adds a new pg catalog type; changing enum values later requires an `ALTER TYPE`; slightly more Drizzle schema surface.
- Impact: add `PermissionEffectEnum = { GRANT: 'grant', DENY: 'deny' }` to `@repo/schemas`, define `PermissionEffectPgEnum = pgEnum(...)` in `enums.dbschema.ts`, and use it in `r_user_permission.dbschema.ts`.

**Recommendation:** Opcion 2 (pgEnum). The `effect` field has exactly two fixed values that will not expand; a proper pg enum is the idiomatic PostgreSQL choice and gives Drizzle full type coverage without a hidden CHECK constraint. The minor cost of a new catalog type is offset by end-to-end type safety.

**DECISION (owner, 2026-05-30): ✅ Opcion 2 — pgEnum `permission_effect_enum` (['grant','deny']).** Define `PermissionEffectEnum` in `@repo/schemas`, `PermissionEffectPgEnum = pgEnum(...)` in `enums.dbschema.ts`, use it in `r_user_permission.dbschema.ts`. No CHECK-constraint / extras-script changes needed.

#### Migration strategy

- **Development:** `pnpm db:push` (no migration file needed during feature development).
- **Production release:** `pnpm db:generate` to create `.sql` migration, then `pnpm db:migrate`. The column has a `DEFAULT 'grant'`, so existing rows are backfilled automatically at migration time — zero downtime.
- **Extras script:** If Option 1 chosen, add a new idempotent entry to `packages/db/src/migrations/manual/` and register it in `apply-postgres-extras.sh`.

#### Triggers manifest note

`user_permission` does NOT appear in the triggers manifest (`packages/db/docs/triggers-manifest.md`). The table has no `set_updated_at` trigger (it has no `updated_at` column), no `delete_entity_bookmarks` trigger, and no JSONB CHECK constraints. No extras-script changes are needed beyond the optional CHECK for Option 1.

#### PK impact

The composite PK `(userId, permission)` is unchanged. This enforces the invariant that a user cannot simultaneously have a `grant` and a `deny` for the same permission — the PK uniqueness constraint prevents it. Attempting to insert a `deny` when a `grant` already exists (same userId + permission) will violate the PK; callers must upsert (or delete + insert).

**Implementation note:** `assignPermissionToUser` currently does `findOne + create`. It must change to `upsert ON CONFLICT (userId, permission) DO UPDATE SET effect = EXCLUDED.effect` (or a delete + create pattern) to support changing effect on an existing override. This is the safe design: a single row per (user, permission) pair with the `effect` column capturing the direction.

#### Indexes

No new indexes needed. Existing `user_permission_userId_idx` and `user_permission_permission_idx` cover all query patterns for this feature.

---

## 4. Schema and Type Design

### New Zod schemas in `@repo/schemas`

File: `packages/schemas/src/entities/permission/permission.management.schema.ts` (extend existing)

```typescript
// New: effect enum schema
export const PermissionEffectSchema = z.enum(['grant', 'deny']);
export type PermissionEffect = z.infer<typeof PermissionEffectSchema>;

// Modified: UserPermissionAssignmentSchema — add effect (default 'grant' for backward compat)
export const UserPermissionAssignmentSchema = z.object({
    userId: UserIdSchema,
    permission: PermissionEnumSchema,
    effect: PermissionEffectSchema.default('grant')
});
export type UserPermissionAssignment = z.infer<typeof UserPermissionAssignmentSchema>;

// Modified: UserPermissionManagementInputSchema — add optional effect
export const UserPermissionManagementInputSchema = z.object({
    userId: UserIdSchema,
    permission: PermissionEnumSchema,
    effect: PermissionEffectSchema.optional().default('grant')
}).strict();
export type UserPermissionManagementInput = z.infer<typeof UserPermissionManagementInputSchema>;
```

File: `packages/schemas/src/entities/user/permission.schema.ts` (new schemas for API endpoints)

```typescript
// GET response shape
export const UserPermissionOverridesResponseSchema = z.object({
    fromRole: z.array(PermissionEnumSchema),
    grantOverrides: z.array(PermissionEnumSchema),
    denyOverrides: z.array(PermissionEnumSchema)
});
export type UserPermissionOverridesResponse = z.infer<typeof UserPermissionOverridesResponseSchema>;

// POST body
export const AssignUserPermissionOverrideBodySchema = z.object({
    permission: PermissionEnumSchema,
    effect: PermissionEffectSchema
}).strict();
export type AssignUserPermissionOverrideBody = z.infer<typeof AssignUserPermissionOverrideBodySchema>;

// DELETE params
export const DeleteUserPermissionOverrideParamsSchema = z.object({
    id: UserIdSchema,
    permission: PermissionEnumSchema
});
export type DeleteUserPermissionOverrideParams = z.infer<typeof DeleteUserPermissionOverrideParamsSchema>;
```

### Type exports

All new types are exported from the relevant `index.ts` files in `@repo/schemas` following the
existing pattern. No default exports.

---

## 5. Service Layer Design

### Modified: `PermissionService.assignPermissionToUser`

Current implementation does `findOne + create (if !exists)`. Must change to an **upsert** to handle
the case where the user already has an override with a different effect (e.g., currently `grant`,
admin wants to change to `deny`).

```typescript
// Pseudocode — keep the same runWithLoggingAndValidation wrapper
execute: async ({ userId, permission, effect = 'grant' }, actor) => {
    if (!canAssignPermissions(actor)) { throw FORBIDDEN }

    // UPSERT: insert or update effect on conflict
    await this.userPermissionModel.upsert(
        { userId: user, permission },
        { effect },
        ['userId', 'permission'] // conflict target = composite PK
    );

    // Invalidate cache so next request picks up the change
    invalidateUserPermissionsCache({ userId: user });

    // Emit audit event
    auditLog({ auditEvent: AuditEventType.PERMISSION_CHANGE, actorId: actor.id,
                targetUserId: user, permission, effect, action: 'assign' });

    return { assigned: true };
}
```

### New: `PermissionService.getPermissionOverridesForUser`

```typescript
/**
 * Returns the user's permission overrides split by effect (grant vs deny),
 * plus the role's permissions for display in the admin panel.
 *
 * @param actor - Must have PERMISSION_VIEW
 * @param input - { userId }
 */
public async getPermissionOverridesForUser(
    actor: Actor,
    input: { userId: string },
    ctx?: ServiceContext
): Promise<ServiceOutput<UserPermissionOverridesResponse>> {
    return this.runWithLoggingAndValidation({
        methodName: 'getPermissionOverridesForUser',
        input: { actor, ...input },
        schema: PermissionsByUserInputSchema,
        ctx,
        execute: async ({ userId }, actor) => {
            if (!canViewPermissions(actor)) { throw FORBIDDEN }

            // Get all user overrides (now includes effect column)
            const { items } = await this.userPermissionModel.findAll({ userId });

            const grantOverrides = items
                .filter(row => row.effect === 'grant')
                .map(row => row.permission);
            const denyOverrides = items
                .filter(row => row.effect === 'deny')
                .map(row => row.permission);

            // Get role permissions (needs the target user's role)
            const targetUser = await this.userModel.findById(userId);
            const { items: roleRows } = await this.rolePermissionModel.findAll(
                { role: targetUser.role }
            );
            const fromRole = roleRows.map(r => r.permission);

            return { fromRole, grantOverrides, denyOverrides };
        }
    });
}
```

**Note:** `getPermissionOverridesForUser` needs access to the user model to get the role. Two
approaches:

- **Option A:** inject `UserModel` into `PermissionService` constructor (already has two models).
- **Option B:** have the API route fetch the user's role separately and pass it to the service.

Recommendation: Option A (keeps logic in service layer per KISS). The API route remains thin.

### Modified: `PermissionService.removePermissionFromUser`

Add audit emission and cache invalidation (symmetrical to `assignPermissionToUser`):

```typescript
execute: async ({ userId, permission }, actor) => {
    if (!canRevokePermissions(actor)) { throw FORBIDDEN }
    // ... existing delete logic ...
    invalidateUserPermissionsCache({ userId: user });
    auditLog({ auditEvent: AuditEventType.PERMISSION_CHANGE, actorId: actor.id,
                targetUserId: user, permission, action: 'revoke' });
    return { removed: true };
}
```

### Validation rules

- `permission` must be a valid `PermissionEnum` value (Zod validates this).
- `effect` must be `'grant'` or `'deny'` (Zod validates this).
- Cannot assign permission to SUPER_ADMIN — **DECISION (owner, 2026-05-30): ✅ return 400** with a
  clear message ("cannot assign overrides to a SUPER_ADMIN") when the target user is a SUPER_ADMIN.
  Any override on a super is a no-op at resolution time (super short-circuits), so persisting it
  would be misleading orphan data. Fail loud instead. The guard lives in `assignPermissionToUser`
  (and the POST route surfaces it as 400). Applies to both grant and deny effects.

---

## 6. Auth Resolution Contract — actor.ts (CRITICAL)

This is the most sensitive change in the spec. The hot-path runs on every authenticated request.

### Current resolution (lines 164-173, actor.ts)

```typescript
const rolePermissions = await getPermissionsForRole(userRole);
const userPermissions = await getUserPermissions({ userId: user.id });
// Simple union-dedup:
const allPermissions = [...new Set([...rolePermissions, ...userPermissions])] as PermissionEnum[];
```

### Required resolution after SPEC-170

```typescript
// SUPER_ADMIN: unchanged — short-circuit applies BEFORE this block
// (actor.ts already returns all permissions for SUPER_ADMIN on line 153-163)

// For all other roles:
const rolePermissions = await getPermissionsForRole(userRole);      // PermissionEnum[]
const userOverrides = await getUserPermissionsWithEffect({ userId: user.id });
// userOverrides shape: { grants: PermissionEnum[], denies: PermissionEnum[] }

// Step 1: union of role perms and grant overrides
const unionSet = new Set([...rolePermissions, ...userOverrides.grants]);

// Step 2: subtract deny overrides (deny wins over grant)
for (const denied of userOverrides.denies) {
    unionSet.delete(denied);
}

const allPermissions = Array.from(unionSet) as PermissionEnum[];
```

**Key invariants:**
- `deny` NEVER applies to SUPER_ADMIN — the `if (userRole === RoleEnum.SUPER_ADMIN)` block (line 153)
  returns before this code runs. The super short-circuit is untouched.
- `deny` of a permission not in the role set is a no-op (deleting from a Set where the value is
  absent is a no-op in JavaScript).
- `grant` of a permission already in the role set is also a no-op (Set dedup handles it).

### Required cache change: `user-permissions-cache.ts`

Current `getUserPermissions` returns `PermissionEnum[]`. After SPEC-170 it must return the overrides
split by effect so `actor.ts` can apply the deny subtraction.

**New export:**

```typescript
export interface UserPermissionsWithEffect {
    readonly grants: readonly PermissionEnum[];
    readonly denies: readonly PermissionEnum[];
}

export async function getUserPermissionsWithEffect({
    userId
}: {
    readonly userId: string;
}): Promise<UserPermissionsWithEffect> { ... }
```

**Old `getUserPermissions` export:** can remain for backward compat (used by service queries), but
`actor.ts` must switch to `getUserPermissionsWithEffect`.

### Precedence cases requiring unit test coverage (EXHAUSTIVE)

All tests belong in `apps/api/src/middlewares/__tests__/actor.resolution.test.ts`.

| # | Scenario | Input | Expected actor.permissions |
|---|----------|-------|---------------------------|
| 1 | Perm only in role, no overrides | role: [P1], overrides: [] | [P1] |
| 2 | Perm in role + grant override (same perm) | role: [P1], grants: [P1] | [P1] (no duplicate) |
| 3 | Perm in role + deny override | role: [P1], denies: [P1] | [] (P1 removed) |
| 4 | Grant override for perm NOT in role | role: [], grants: [P2] | [P2] |
| 5 | Deny override for perm NOT in role | role: [], denies: [P3] | [] (no-op) |
| 6 | Both grant and deny for same perm | IMPOSSIBLE: PK prevents (userId, permission) duplicate. Test that only one row can exist. |
| 7 | SUPER_ADMIN with deny override | role: SUPER, denies: [P1] | ALL_PERMISSIONS (deny ignored via short-circuit) |
| 8 | SUPER_ADMIN with grant override | role: SUPER, grants: [P1] | ALL_PERMISSIONS (redundant, not harmful) |
| 9 | Multiple denies subtracted from role | role: [P1, P2, P3], denies: [P1, P3] | [P2] |
| 10 | Mixed: role perms + grants + denies | role: [P1, P2], grants: [P3], denies: [P2] | [P1, P3] |

---

## 7. Propagation of Changes to Active Sessions (DECISION PENDING)

### How permissions are resolved today

- `actor.permissions` is built **at request time**, not at login time. There is no JWT-embedded
  permission set. Every request calls `getUserPermissionsWithEffect` (after SPEC-170) and
  `getPermissionsForRole`, both of which check an **in-memory process-level cache**.
- `user-permissions-cache.ts` has a TTL of **5 minutes** (`CACHE_TTL_MS = 5 * 60 * 1000`).
- `role-permissions-cache.ts` has a TTL of **10 minutes**.
- `invalidateUserPermissionsCache({ userId })` is already exported and can be called to evict a
  specific user immediately.

### Option A: Eventual propagation (next cache expiry, max 5 min window)

**What it does:** After a grant/revoke/deny, do NOT call `invalidateUserPermissionsCache`. The change
takes effect when the user's cache entry expires (within 5 minutes).

**Pros:**
- Zero code change to cache invalidation.
- No risk of thundering-herd on invalidation.

**Cons:**
- A deny override takes up to 5 minutes to take effect. During that window the denied user retains
  the permission — this is a security-critical window for deny overrides.
- The admin panel has no feedback on when the change is effective.

**When to use:** Only acceptable if the use case is additive-only (no deny overrides). With deny
overrides in scope, this option is **not recommended**.

### Option B: Immediate cache invalidation on write (RECOMMENDED)

**What it does:** Call `invalidateUserPermissionsCache({ userId })` inside `assignPermissionToUser`
and `removePermissionFromUser` immediately after the DB write. The function is already exported from
`user-permissions-cache.ts` (line 104). The next request from the target user rebuilds the cache
from DB.

**Pros:**
- Deny overrides take effect on the user's very next request (no security window).
- Grant overrides also take effect immediately.
- Implementation is 2 lines — already have the function.
- Correct behavior for a security-sensitive operation (permission management).

**Cons:**
- The next request from the target user pays a DB lookup (bypass cache). This is one extra DB query
  per user per 5-minute window after a change, not per request. Cost is negligible.
- If the API is horizontally scaled (multiple instances), the in-memory cache in OTHER instances is
  NOT invalidated — each instance has its own Map. The target user's next request hits whichever
  instance; only that instance's cache is cold. The remaining instances expire within 5 min.

**Multi-instance gotcha:** This project runs on a single VPS (Coolify), so in practice there is one
instance per tier (prod / staging). The multi-instance cache-skew issue is theoretical for now but
should be documented for future scaling. A Redis-backed cache would eliminate this entirely (tracked
as a future improvement).

**RECOMMENDATION:** Option B. The `invalidateUserPermissionsCache` call already exists and is
already being planned for the service methods (§5). The security value of immediate deny-override
propagation far outweighs the negligible DB cost. Document the multi-instance caveat in code
comments.

**UI note (either option):** Show a toast after grant/revoke/deny that says "Changes take effect on
the user's next request" — even with immediate invalidation, the user's CURRENT in-flight requests
(if any) complete with old permissions. This is correct and expected behavior.

**DECISION (owner, 2026-05-30): ✅ Option B — immediate cache invalidation.** Call `invalidateUserPermissionsCache({ userId })` inside `assignPermissionToUser` and `removePermissionFromUser` after the DB write. Document the multi-instance cache-skew caveat in a code comment (single-VPS today, theoretical).

---

## 8. API Design

### Endpoints

All three routes live under `apps/api/src/routes/user/admin/permissions.ts` and are registered in
the user admin router, mounted at `/api/v1/admin/users`.

Route registration order in the user admin `index.ts` (IMPORTANT — must be before `/{id}`):
```
app.route('/:id/permissions', userPermissionsRoutes);
// /{id} routes registered after
```

#### GET /api/v1/admin/users/:id/permissions

**Purpose:** Return the split permission view for the user.
**Gating:** `PERMISSION_VIEW` (via `canViewPermissions`).
**Request params:** `{ id: UserIdSchema }` (the target user UUID)
**Response:** `UserPermissionOverridesResponseSchema`
```json
{
  "fromRole": ["accommodation.create", "accommodation.update.own"],
  "grantOverrides": ["post.hardDelete"],
  "denyOverrides": ["accommodation.view.all"]
}
```
**Status codes:** 200 OK, 401, 403, 404

#### POST /api/v1/admin/users/:id/permissions

**Purpose:** Create or update a per-user permission override.
**Gating:** `PERMISSION_ASSIGN` (via `canAssignPermissions`).
**Request params:** `{ id: UserIdSchema }`
**Request body:** `AssignUserPermissionOverrideBodySchema` = `{ permission, effect }`
**Response:** `{ assigned: boolean }`
**Status codes:** 201 Created, 400, 401, 403, 404

**Implementation note:** This is an upsert. If the user already has an override for that permission
with a different effect, the effect is updated. If same effect, returns `{ assigned: false }` (no-op).

#### DELETE /api/v1/admin/users/:id/permissions/:permission

**Purpose:** Remove a per-user override (grant or deny). The user falls back to role-only behavior.
**Gating:** `PERMISSION_REVOKE` (via `canRevokePermissions`).
**Request params:** `{ id: UserIdSchema, permission: PermissionEnumSchema }`
**Response:** `{ removed: boolean }`
**Status codes:** 200 OK, 401, 403, 404

### Route file pattern (follows SPEC-169 / accommodation admin pattern)

```typescript
// apps/api/src/routes/user/admin/permissions.ts

import { createAdminRoute } from '../../../utils/route-factory';
import { PermissionEnum } from '@repo/schemas';
import { AssignUserPermissionOverrideBodySchema, UserPermissionOverridesResponseSchema } from '@repo/schemas';

// GET
export const adminGetUserPermissionsRoute = createAdminRoute({
    method: 'get',
    path: '/:id/permissions',
    summary: 'Get user permission overrides (admin)',
    tags: ['Users'],
    requestParams: { id: UserIdSchema },
    responseSchema: UserPermissionOverridesResponseSchema,
    handler: async (ctx, params) => { ... }
});

// POST
export const adminAssignUserPermissionRoute = createAdminRoute({
    method: 'post',
    path: '/:id/permissions',
    summary: 'Grant or deny a permission override for a user (admin)',
    tags: ['Users'],
    requestParams: { id: UserIdSchema },
    requestBody: AssignUserPermissionOverrideBodySchema,
    responseSchema: z.object({ assigned: z.boolean() }),
    handler: async (ctx, params, body) => { ... }
});

// DELETE
export const adminRevokeUserPermissionRoute = createAdminRoute({
    method: 'delete',
    path: '/:id/permissions/:permission',
    summary: 'Remove a permission override for a user (admin)',
    tags: ['Users'],
    requestParams: { id: UserIdSchema, permission: PermissionEnumSchema },
    responseSchema: z.object({ removed: z.boolean() }),
    handler: async (ctx, params) => { ... }
});
```

**Note on `requiredPermissions` in `createAdminRoute`:** The three routes use different permissions
(`PERMISSION_VIEW`, `PERMISSION_ASSIGN`, `PERMISSION_REVOKE`). The `requiredPermissions` option
passes them to the middleware, which calls `actor.permissions.includes(...)`. This is in addition to
the base admin-access check (`ACCESS_PANEL_ADMIN | ACCESS_API_ADMIN`) that `createAdminRoute`
enforces by default.

### Middleware requirements

- Authentication required: yes (admin tier)
- Rate limiting: default admin rate limit (no special override needed)
- Custom middleware: none

---

## 9. Permission Catalog Grouping — Picker Mechanism

### The naming convention (verified from code)

All `PermissionEnum` values use the format `camelCaseCategory.action` (e.g.,
`accommodation.create`, `permission.assign`, `userBookmark.viewAny`). The TypeScript key names use
`UPPER_CASE_CATEGORY_ACTION` (e.g., `ACCOMMODATION_CREATE`, `PERMISSION_ASSIGN`).

`PermissionCategoryEnum` has 59 categories (verified from `permission.enum.ts` lines 1-60) with
`UPPER_CASE` values like `ACCOMMODATION`, `PERMISSION`, `USER_BOOKMARK`.

The i18n file `admin-pages.json` at `access.permissions.categories.*` already has human-readable
labels for ALL 59 categories (verified: full map present at lines 381-439).

### Prefix-derive approach (RECOMMENDED)

**How it works:** For each `PermissionEnum` key (e.g., `ACCOMMODATION_CREATE`), extract the leading
segment that matches a `PermissionCategoryEnum` value by longest-prefix match. Example:
- `ACCOMMODATION_LISTING_CREATE` → try `ACCOMMODATION_LISTING_CREATE` (not a category) → try
  `ACCOMMODATION_LISTING` (IS a category) → assigned to `ACCOMMODATION_LISTING`.
- `ACCOMMODATION_CREATE` → try `ACCOMMODATION_CREATE` (not a category) → try `ACCOMMODATION`
  (IS a category) → assigned to `ACCOMMODATION`.

This works because:
1. Category names are consistent prefixes of their permission names.
2. The `PermissionCategoryEnum` is already defined and has 59 categories.
3. The i18n labels are already in `admin-pages.json`.

**No hand-maintained static map needed.** The derivation is deterministic and can be computed at
runtime or as a build-time constant.

**Helper location:** `packages/schemas/src/utils/permission-grouping.ts` (new file).

```typescript
// packages/schemas/src/utils/permission-grouping.ts

/**
 * Derives the PermissionCategoryEnum for a given PermissionEnum key
 * by longest-prefix match against PermissionCategoryEnum values.
 *
 * Pre-computed at module load time for O(1) lookup.
 */
export const PERMISSION_TO_CATEGORY: Readonly<Record<PermissionEnum, PermissionCategoryEnum>> = (() => {
    const result = {} as Record<PermissionEnum, PermissionCategoryEnum>;
    const categories = Object.values(PermissionCategoryEnum)
        .sort((a, b) => b.length - a.length); // longest first for greedy match

    for (const permKey of Object.keys(PermissionEnum) as Array<keyof typeof PermissionEnum>) {
        const matched = categories.find(cat => permKey.startsWith(cat + '_') || permKey === cat);
        result[PermissionEnum[permKey]] = matched ?? PermissionCategoryEnum.SYSTEM; // fallback
    }
    return Object.freeze(result);
})();

/**
 * Returns permissions grouped by category.
 * Result is sorted alphabetically by category, permissions within each category
 * sorted alphabetically by key.
 */
export function getPermissionsByCategory(): ReadonlyMap<PermissionCategoryEnum, readonly PermissionEnum[]> { ... }
```

**Verification needed (not blocking):** After implementation, run a quick test to confirm that all
~270 permissions map to a non-fallback category. Any unmapped permissions would fall back to
`SYSTEM`. The test suite should assert no permission falls to the fallback unexpectedly.

**Labels:** `t('admin-pages.access.permissions.categories.ACCOMMODATION')` returns `'Alojamiento'`
etc. The hook in the UI calls `useTranslations()` and accesses
`t(`admin-pages.access.permissions.categories.${category}` as TranslationKey)`.

---

## 10. Frontend Design

### Component structure

```
apps/admin/src/features/users/
├── components/
│   ├── permissions/
│   │   ├── PermissionOverridesCard.tsx    — replaces the stub CardContent
│   │   ├── PermissionPicker.tsx           — categorized searchable picker dialog
│   │   ├── OverrideRow.tsx                — single override row (grant/deny badge + remove btn)
│   │   └── RolePermissionBadge.tsx        — read-only badge for role-inherited perm
└── hooks/
    ├── useUserPermissionOverrides.ts      — TanStack Query GET
    ├── useAssignUserPermission.ts         — TanStack Query mutation POST
    └── useRevokeUserPermission.ts         — TanStack Query mutation DELETE
```

The route file `$id_.permissions.tsx` becomes thin — it delegates to `PermissionsBody` which renders
`PermissionOverridesCard` plus the existing role-info cards.

### State management

TanStack Query for all server state.

```typescript
// useUserPermissionOverrides.ts
export function useUserPermissionOverrides(userId: string) {
    return useQuery({
        queryKey: ['users', userId, 'permissions'],
        queryFn: () => fetchApi(`/api/v1/admin/users/${userId}/permissions`),
        staleTime: 30_000
    });
}

// useAssignUserPermission.ts
export function useAssignUserPermission(userId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (body: AssignUserPermissionOverrideBody) =>
            fetchApi(`/api/v1/admin/users/${userId}/permissions`, {
                method: 'POST',
                body: JSON.stringify(body)
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users', userId, 'permissions'] });
        }
    });
}

// useRevokeUserPermission.ts — same pattern with DELETE
```

### Key components

#### PermissionOverridesCard

Replaces the stub `CardContent` body. Renders:
1. **Grant overrides section:** list of `OverrideRow` with green "grant" badge + remove button.
2. **Deny overrides section:** list of `OverrideRow` with red "deny" badge + remove button.
3. **Empty state:** if no overrides, show "No hay overrides directos" message.
4. **Add override button:** opens `PermissionPicker` dialog.

#### PermissionPicker (dialog)

- Searchable input that filters across all ~270 permissions by label or key.
- Permissions grouped by `PermissionCategoryEnum` label (from i18n).
- **4 visual states per permission:**
  - `from-role disabled + badge "Heredado"`: permission is in `fromRole`; can be turned into a
    deny override (button "Denegar" appears on hover/focus).
  - `grant-override active`: permission is in `grantOverrides`; shown with green badge; the picker
    omits it from the grantable list.
  - `deny-override active`: permission is in `denyOverrides`; shown with red badge; the picker
    shows it in the role section with "Denegado" label.
  - `grantable`: permission is neither in role nor in overrides; user can click to grant.
- **Sensitive permission warning (R-1):** when the admin selects a permission whose key contains
  `_VIEW_ALL`, `_READ_ALL`, or `_HARD_DELETE`, show an inline warning banner: "Este permiso tiene
  amplio alcance. Verifica que el usuario deba tenerlo."
- **Effect selector:** for each selectable permission, show "Otorgar / Denegar" radio or toggle
  before confirming.

#### OverrideRow

Props: `{ permission: PermissionEnum, effect: 'grant' | 'deny', onRemove: () => void }`.
Shows: permission label (from i18n or prettified key), effect badge, remove button with confirm
dialog.

### UI/UX considerations

- Responsive: the card works on mobile (single-column list) and desktop (denser layout).
- Accessibility: dialog uses Radix UI `Dialog` component (already available via Shadcn);
  keyboard navigation works out of the box.
- Loading states: TanStack Query `isLoading` → show skeleton rows in the card.
- Error states: `isError` → show an error alert with retry button.
- Optimistic updates: NOT recommended here given the security sensitivity; wait for server
  confirmation before updating UI.

### i18n keys needed (additions to admin-pages.json)

Under `admin-pages.access.users.permissions.*`:

```json
{
  "directOverrides": "Permisos Directos",
  "directOverridesDesc": "Permisos asignados directamente a este usuario (fuera de su rol)",
  "noDirectOverrides": "Sin overrides directos",
  "noDirectOverridesDesc": "Este usuario usa únicamente los permisos de su rol",
  "grantOverrides": "Permisos Otorgados",
  "denyOverrides": "Permisos Denegados",
  "addOverride": "Agregar override",
  "removeOverride": "Eliminar override",
  "confirmRemove": "¿Eliminar este override?",
  "confirmRemoveDesc": "El usuario volverá a los permisos de su rol",
  "effectGrant": "Otorgado",
  "effectDeny": "Denegado",
  "inheritedFromRole": "Heredado",
  "sensitivePermissionWarning": "Este permiso tiene amplio alcance. Verifica que el usuario deba tenerlo.",
  "changesTakeEffectNextRequest": "Los cambios toman efecto en la próxima solicitud del usuario",
  "searchPermissions": "Buscar permisos...",
  "selectEffect": "Seleccionar efecto",
  "grantPermission": "Otorgar",
  "denyPermission": "Denegar"
}
```

---

## 11. Audit Integration

### Where to emit

Audit events are emitted **inside the service methods**, not in the API routes. This ensures audit
coverage even if the service is called from other surfaces in the future.

```typescript
// In assignPermissionToUser (after successful upsert):
import { AuditEventType, auditLog } from '@repo/logger';

auditLog({
    auditEvent: AuditEventType.PERMISSION_CHANGE,
    actorId: actor.id,
    actorRole: actor.role,
    targetUserId: userId,
    permission,
    effect,
    action: 'assign', // 'assign' | 'revoke'
    timestamp: new Date().toISOString()
});

// In removePermissionFromUser (after successful delete):
auditLog({
    auditEvent: AuditEventType.PERMISSION_CHANGE,
    actorId: actor.id,
    actorRole: actor.role,
    targetUserId: userId,
    permission,
    action: 'revoke',
    timestamp: new Date().toISOString()
});
```

The `PERMISSION_CHANGE` event type already exists in `@repo/logger` (`audit-types.ts` line 33).
Check the `auditLog` function signature to confirm the payload shape matches.

---

## 12. Dependencies and Order

### Implementation order (with dependencies)

#### Phase 1 — Schema + Types (foundation, no external deps)

1. Add `PermissionEffectSchema` + modify `UserPermissionAssignmentSchema` + `UserPermissionManagementInputSchema` in `@repo/schemas` (30 min).
2. Add new API endpoint schemas (`UserPermissionOverridesResponseSchema`, `AssignUserPermissionOverrideBodySchema`, `DeleteUserPermissionOverrideParamsSchema`) (30 min).
3. Add `permission-grouping.ts` helper + tests in `@repo/schemas` (1 h).
4. Run `pnpm typecheck` across the monorepo to catch consumers of the modified schemas.

#### Phase 2 — Database migration

5. Add `effect` column to `r_user_permission.dbschema.ts` with chosen type (Option 1 or 2).
6. `pnpm db:push` (dev) or `pnpm db:generate` (prod path).
7. If Option 1 (varchar+check): add migration entry to extras script.
8. Update `RUserPermissionModel` return type if needed to surface `effect`.

#### Phase 3 — Cache extension

9. Modify `user-permissions-cache.ts`: add `getUserPermissionsWithEffect` export; keep `getUserPermissions` for backward compat.

#### Phase 4 — actor.ts resolution change

10. Replace current union logic with `(role ∪ grants) \ denies` formula.
11. Switch from `getUserPermissions` to `getUserPermissionsWithEffect`.
12. Write all 10 unit test cases from §6.

**This phase is a gate for everything that follows — no API or UI can be meaningfully tested without correct resolution.**

#### Phase 5 — Service extension

13. Modify `assignPermissionToUser`: add `effect` param, change `create` to upsert, add cache invalidation + audit.
14. Modify `removePermissionFromUser`: add cache invalidation + audit.
15. Add `getPermissionOverridesForUser` method (needs `UserModel` injected if Option A chosen from §5).
16. Write service unit tests for all modified methods.

#### Phase 6 — Seed fix

17. Add `PermissionEnum.PERMISSION_VIEW`, `PERMISSION_ASSIGN`, `PERMISSION_REVOKE` to the SUPER_ADMIN block in `rolePermissions.seed.ts` (they are NOT currently there — only `ACCESS_PERMISSIONS_MANAGE` is seeded at line 206).
18. Verify by running `pnpm db:fresh-dev` and checking that `canViewPermissions`, `canAssignPermissions`, `canRevokePermissions` return true for an actor with the SUPER_ADMIN seeded permissions.

#### Phase 7 — API routes

19. Create `apps/api/src/routes/user/admin/permissions.ts` with 3 routes.
20. Register in user admin `index.ts` (before `/:id` routes).
21. Write API integration tests (with mock actor headers).

#### Phase 8 — Admin UI

22. Add hooks (`useUserPermissionOverrides`, `useAssignUserPermission`, `useRevokeUserPermission`).
23. Build `OverrideRow` component.
24. Build `PermissionPicker` dialog component.
25. Build `PermissionOverridesCard` replacing stub body.
26. Wire into `$id_.permissions.tsx`.
27. Add i18n keys.
28. Write component tests (RTL).

#### Phase 9 — Integration / end-to-end

29. Write E2E test: grant override → re-authenticate → verify actor.permissions includes the new perm.
30. Write E2E test: deny override → re-authenticate → verify actor.permissions excludes the denied perm.
31. Verify AC-4 from spec (`spec.md` §7): override takes effect after re-auth.

### External dependencies

- None (no new packages needed).

### Internal dependencies

- `@repo/schemas` must be updated (Phase 1) before all other phases.
- `user-permissions-cache.ts` (Phase 3) must be updated before `actor.ts` (Phase 4).
- `actor.ts` (Phase 4) must be stable before API routes (Phase 7) can be integration-tested.
- Seed fix (Phase 6) can be done in parallel with API routes but must be done before manual QA.

---

## 13. Technical Risks and Challenges

### Risk 1: actor.ts precedence bug (R-4 from spec)

**Probability:** Medium
**Impact:** Very High (platform-wide auth regression)
**Description:** A mistake in the `(role ∪ grants) \ denies` formula could cause deny overrides not
to apply, or to wrongly apply to SUPER_ADMIN, or to incorrectly exclude a permission that should
remain.
**Mitigation:** The 10 unit test cases in §6 cover every precedence scenario. Tests must pass before
the PR is merged. The test file must be added BEFORE the implementation (TDD for this critical path).
Code review must verify the SUPER_ADMIN short-circuit is before the deny subtraction.

### Risk 2: cache invalidation in multi-instance deployments

**Probability:** Low (current: single instance per tier)
**Impact:** Medium (stale deny override for up to 5 minutes on the other instance)
**Description:** If the platform scales horizontally, invalidating one instance's cache does not
invalidate other instances.
**Mitigation:** Document in `user-permissions-cache.ts` as a known limitation. Add a TODO for
Redis-backed cache. Acceptable for current single-instance deployment. For immediate mitigation, the
5-minute TTL bounds the exposure.

### Risk 3: schema migration regression

**Probability:** Low
**Impact:** Medium (DB schema breakage)
**Description:** Adding the `effect` column could break existing `findAll` / `findOne` calls if the
model is not updated to handle the new field.
**Mitigation:** The column has `DEFAULT 'grant'` — existing rows are backfilled automatically.
Update model type; run integration tests against real DB before merging.

### Risk 4: broad-permission grants via the UI (R-1 from spec)

**Probability:** Medium (user error)
**Impact:** High (cross-tenant data exposure)
**Description:** An admin could inadvertently grant `ACCOMMODATION_VIEW_ALL` to a non-admin user,
re-opening the cross-tenant exposure that SPEC-169 closed for roles.
**Mitigation:** The "sensitive permission warning" in the picker (§10) surfaces this risk at grant
time. This is a UI-level mitigation only; no server-side block (the owner decided to keep the
full catalog accessible). SPEC-169's AC-6 regression test guards roles, not per-user overrides —
a follow-up audit test for per-user grants should be added.

### Risk 5: `UserPermissionManagementInputSchema` breaking change

**Probability:** Low
**Impact:** Low
**Description:** Adding `effect` with a default to the schema is additive. Existing callers that do
not pass `effect` get `'grant'` by default — backward compatible. However, the schema uses `.strict()`
— verify that adding the new optional field with a default does not break existing callers that
pass only `{ userId, permission }`.
**Mitigation:** `.strict()` rejects EXTRA keys, not MISSING keys with defaults. Adding `effect` to
the schema definition is safe — existing callers can continue to omit it.

### Performance considerations

- The deny subtraction in `actor.ts` is O(n) where n is the number of deny overrides. With ~270
  permissions maximum, this is negligible.
- `getUserPermissionsWithEffect` hits DB once per 5-minute window per user (same as current). No
  performance regression.

### Security considerations

- All three API routes are gated by granular permissions (`PERMISSION_VIEW`, `PERMISSION_ASSIGN`,
  `PERMISSION_REVOKE`) in addition to the base admin-access check.
- SUPER_ADMIN is exempt from deny overrides at the resolution level AND at the API level: the POST
  route returns **400** when the target user is a SUPER_ADMIN (owner decision 2026-05-30, see §5).
  No override (grant or deny) is ever persisted for a super.
- All inputs validated by Zod before reaching the service.

---

## 14. Migration and Rollback

### Database migration

**Forward:** add `effect permission_effect_enum NOT NULL DEFAULT 'grant'` to `user_permission`
(new pgEnum type, owner decision D1). Additive-only, zero-downtime. Existing rows become
`effect = 'grant'`.

**Rollback:** `ALTER TABLE user_permission DROP COLUMN effect`. Safe because the column is new and
no other table references it.

### Code rollback

- `actor.ts` change: revert to union-only formula. The old `getUserPermissions` export is preserved
  for backward compat, so reverting `actor.ts` does not require reverting `user-permissions-cache.ts`.
- API routes: unregister from user admin router.
- Seed fix: revert the PERMISSION_* additions from SUPER_ADMIN block. SUPER_ADMIN continues to pass
  via short-circuit — no functional regression.

### Data migration

No data migration needed (column default handles existing rows).

---

## 15. Technical Debt

### Known trade-offs

- **In-memory cache is process-local.** Redis-backed cache would solve multi-instance skew.
  Deferred because the platform runs single-instance per tier currently.
- **`getUserPermissions` kept for backward compat.** Two exports (`getUserPermissions` and
  `getUserPermissionsWithEffect`) in the same file is slightly redundant. Can be cleaned up
  once all callers are migrated to the new signature.
- **Upsert pattern in service.** Drizzle's `onConflictDoUpdate` may not be available in all
  model base class methods. The implementation may need a raw `db` query or a `hardDelete + create`
  pattern. This is a 30-minute implementation detail to resolve during coding.

### Future improvements

- **Redis-backed cache:** eliminates multi-instance stale-deny window.
- **Audit dashboard:** surface `PERMISSION_CHANGE` events in the admin UI (currently they go to logs
  only).
- **Bulk override management:** apply the same grant/deny to multiple users at once.
- **Per-user override history:** show who granted/denied what and when (requires audit log query).

### Monitoring needs

- Log `PERMISSION_CHANGE` audit events with full payload (already planned in §11).
- Alert on high-frequency permission changes from a single actor (potential abuse).

---

## 16. Approval Checklist

- [x] All PDR requirements addressable (spec §5 REQ-1 through REQ-6 all covered)
- [x] Architecture follows project patterns (`createAdminRoute`, `BaseCrudService`, `RO-RO`)
- [x] Database design is additive-safe (new column with default, PK unchanged)
- [x] API design is RESTful and consistent with existing admin routes
- [x] Frontend approach is clear (TanStack Query + Shadcn Dialog)
- [x] Testing strategy covers critical hot-path (10 unit tests for resolution)
- [x] Dependencies identified (Phase order 1-9 defined)
- [x] Risks assessed and mitigated
- [x] Effort estimated (24-32 h total)
- [x] Ready for task breakdown

### Owner decisions (resolved 2026-05-30 — ready for task atomization)

1. **`effect` column type** (§3): ✅ **pgEnum** `permission_effect_enum` (['grant','deny']).
2. **Session propagation** (§7): ✅ **immediate cache invalidation** (`invalidateUserPermissionsCache`
   on write; multi-instance caveat documented in code).
3. **SUPER_ADMIN assign guard** (§5): ✅ **return 400** on super targets (no override persisted for a
   super; fail loud rather than store no-op orphan data).

No open decisions remain. Tech-analysis is complete and ready for `/task-master:task-from-spec`.
