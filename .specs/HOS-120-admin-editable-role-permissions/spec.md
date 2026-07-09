---
title: Admin UI for editable role → permission mapping
linear: HOS-120
statusSource: linear
created: 2026-07-09
type: feature
areas:
  - admin
  - api
  - auth
---

# Admin UI for editable role → permission mapping

## 1. Summary

Make the **role → permission mapping editable from the admin panel**. Today the
`role_permission` table is the runtime source of truth, but it is only ever
populated from the seed constant `ROLE_PERMISSIONS`, and the admin pages that
show it (`/access/roles`, `/access/permissions`) are **read-only**. This spec
adds the ability to grant/revoke permissions to the 10 existing roles directly
from the admin UI, with lock-out safeguards and an audit trail.

Per-user permission overrides already exist and work (SPEC-170); they are **out
of scope** and untouched.

## 2. Problem

An operator cannot adjust what a role can do without a code change + reseed.
Changing a role's permission set today means editing the `ROLE_PERMISSIONS`
constant in `packages/seed`, generating a data-migration, and deploying. That is
slow, requires an engineer, and is invisible to operators who own the access
model. The DB already drives runtime authorization, so the mapping *could* be
edited live — the only missing pieces are the admin endpoints, cache
invalidation on write, and an editable UI.

## 3. Goals

- G-1: Operators with permission-management rights can add/remove permissions
  for any of the 10 existing roles from the admin panel.
- G-2: Changes take effect **immediately** (no waiting for the 10-minute cache
  TTL) for all users holding the edited role.
- G-3: The DB (`role_permission`) is the definitive source of truth at runtime;
  the seed constant `ROLE_PERMISSIONS` only bootstraps a fresh database and for
  future permission additions.
- G-4: Lock-out is structurally prevented (an operator cannot destroy their own
  or the system's ability to manage permissions).
- G-5: Every role-permission change is recorded in the audit log (who, which
  role, which permission, grant vs revoke, when).

## 4. Non-goals

- NG-1: Creating or deleting roles. Roles remain a Postgres `enum`
  (`RolePgEnum`); turning them into DB rows is a separate rearchitecture and is
  explicitly out of scope.
- NG-2: Editing per-user permission overrides — already shipped (SPEC-170),
  untouched here.
- NG-3: Editing the `SUPER_ADMIN` role's effective permissions. `actor.ts`
  short-circuits `SUPER_ADMIN` to all permissions regardless of the DB, so its
  mapping is inert; the UI shows it read-only.
- NG-4: Changing the permission catalog itself (adding/removing
  `PermissionEnum` members) — that stays a code change.
- NG-5: Cross-process cache coherency via Redis. Caches remain process-local;
  see R-3.

## 5. Current baseline

### Enums & source of truth

- `RoleEnum` — `packages/schemas/src/enums/role.enum.ts` (10 roles:
  `SUPER_ADMIN, ADMIN, CLIENT_MANAGER, EDITOR, HOST, COMMERCE_OWNER, SPONSOR,
  USER, GUEST, SYSTEM`).
- `PermissionEnum` — `packages/schemas/src/enums/permission.enum.ts` (~660
  members) + `PermissionCategoryEnum` for grouping.
- `ROLE_PERMISSIONS` seed constant — `packages/seed/src/required/rolePermissions.seed.ts`
  (bootstrap-only after this spec).

### Tables (all already exist — no schema change expected)

- `role_permission` — `packages/db/src/schemas/user/r_role_permission.dbschema.ts`
  (composite PK `(role, permission)`, both enum columns).
- `user_permission` — `packages/db/src/schemas/user/r_user_permission.dbschema.ts`
  (out of scope; per-user overrides).
- `users.role` — `packages/db/src/schemas/user/user.dbschema.ts:98` (single
  enum column, one role per user).

### Runtime resolution

- `apps/api/src/middlewares/actor.ts`: effective set =
  `(rolePermissions ∪ userGrants) \ userDenies`; `SUPER_ADMIN` short-circuited
  to all permissions (`actor.ts:154`); deny wins.
- Role permissions read through `apps/api/src/utils/role-permissions-cache.ts`
  (queries `role_permission`, **10-minute TTL, in-memory**).
- User overrides read through `apps/api/src/utils/user-permissions-cache.ts`
  (5-minute TTL, already has invalidation wired in `permission.effects.ts`).

### Service layer (methods exist, unused)

- `packages/service-core/src/services/permission/permission.service.ts`:
  - `assignPermissionToRole` (`:88`) — already implemented.
  - `removePermissionFromRole` (`:120`) — already implemented.
  - No route currently calls either (verified: only tests reference them).
  - Cache-invalidation registry: `permission.effects.ts`, wired at startup in
    `apps/api/src/index.ts`.

### Admin API (per-user, the pattern to mirror)

- `apps/api/src/routes/user/admin/permissions.ts` —
  `GET/POST/DELETE /api/v1/admin/users/{id}/permissions`, gated by the
  `PERMISSION_VIEW / PERMISSION_ASSIGN / PERMISSION_REVOKE` trio, returns a
  split view (fromRole / grant / deny), rejects targeting `SUPER_ADMIN`.

### Admin UI (read-only today)

- `/access/roles` — `apps/admin/src/routes/_authed/access/roles.tsx` (read-only
  role catalog).
- `/access/permissions` — `apps/admin/src/routes/_authed/access/permissions.tsx`
  (read-only permission catalog grouped by category).
- Per-user override editor to mirror:
  `apps/admin/src/routes/_authed/access/users/$id_.permissions.tsx` +
  `apps/admin/src/features/users/components/permissions/` (`PermissionOverridesCard`,
  `PermissionPicker`, `OverrideRow`, `RolePermissionBadge`) + hook
  `apps/admin/src/hooks/use-user-permissions.ts`.

### Policy tests (must stay valid)

- `packages/seed/test/role-permission-audit.test.ts` (SPEC-169 broad-grant
  allow-list) + `packages/seed/scripts/audit-role-permissions.ts`. These assert
  properties of the **seed baseline** (`ROLE_PERMISSIONS`), not the live DB — see
  IN-4.

## 6. Proposed design

Three phases. Nothing here requires a DB schema change (all tables exist).

### Phase 1 — API

1. New admin route module for role-permission editing (mirror the user one):
   - `GET  /api/v1/admin/roles/{role}/permissions` — list the role's current
     permissions (from `role_permission`). Optionally include full catalog with
     an `assigned` flag to power the picker, or let the UI diff against the
     read-only catalog endpoint.
   - `POST /api/v1/admin/roles/{role}/permissions` — body `{ permission }`;
     grants the permission (wraps `assignPermissionToRole`).
   - `DELETE /api/v1/admin/roles/{role}/permissions/{permission}` — revokes it
     (wraps `removePermissionFromRole`).
2. Gate all three with the existing `PERMISSION_VIEW / PERMISSION_ASSIGN /
   PERMISSION_REVOKE` trio (VIEW for GET, ASSIGN for POST, REVOKE for DELETE).
3. **Immediate cache invalidation**: on any successful write, invalidate the
   `role-permissions-cache` for the edited role (and clear the process-local
   entry) so the next request recomputes. Wire this the same way
   `permission.effects.ts` invalidates the user cache today.
4. **Safeguard validation** (enforced server-side, not just UI):
   - Reject any write targeting `role = SUPER_ADMIN` → `403`/`409` with a clear
     error (`ROLE_NOT_EDITABLE`).
   - Reject any write where the target role equals the **actor's own role** →
     `403` (`CANNOT_EDIT_OWN_ROLE`).
   - (Because only a `SUPER_ADMIN` can therefore edit the `ADMIN` role, and
     `SUPER_ADMIN` is immune, the system always retains a recovery path — see
     R-1.)
5. Zod schemas for params/body in `@repo/schemas` (reuse `RoleEnum` /
   `PermissionEnum`). Validate `role` and `permission` are valid enum members.

### Phase 2 — Admin UI

1. Turn `/access/roles` (or a `/access/roles/{role}` detail route) into an
   editable view, reusing the `PermissionOverridesCard` / `PermissionPicker`
   pattern and a new `use-role-permissions.ts` hook (mirror
   `use-user-permissions.ts`).
2. Show `SUPER_ADMIN` and the current user's own role as **read-only** (badge +
   disabled controls) with an explanatory tooltip.
3. **Impact preview + confirmation** before persisting: show how many users
   currently hold the role (needs a count — see §7) and a summary of what will
   change, then require explicit confirmation.
4. On success, surface a toast and reflect the new state; rely on the API's
   immediate invalidation so behavior is correct on next navigation.

### Phase 3 — Audit

1. On every successful grant/revoke at the role level, write an audit-log entry
   (SPEC-162 audit layer): actor id, action (`ROLE_PERMISSION_GRANT` /
   `ROLE_PERMISSION_REVOKE`), target role, permission, timestamp.
2. Prefer emitting the audit entry from the service methods (or a thin wrapper)
   so it cannot be bypassed by a future second caller of
   `assignPermissionToRole` / `removePermissionFromRole`.

## 7. Data model / contracts

**No new tables or columns.** Uses existing `role_permission`.

### Endpoints (new)

| Method | Path | Gate | Body | Returns |
|---|---|---|---|---|
| GET | `/api/v1/admin/roles/{role}/permissions` | `PERMISSION_VIEW` | — | role's permissions (+ optional catalog with `assigned` flags) |
| POST | `/api/v1/admin/roles/{role}/permissions` | `PERMISSION_ASSIGN` | `{ permission: PermissionEnum }` | updated permission set |
| DELETE | `/api/v1/admin/roles/{role}/permissions/{permission}` | `PERMISSION_REVOKE` | — | updated permission set |

### Supporting query

- User-count-per-role for the impact preview: a `COUNT(*)` on `users` grouped by
  `role` (index `users_role_idx` already exists). Expose via the GET response or
  a small dedicated endpoint (e.g. `GET /api/v1/admin/roles/{role}` returning
  `{ role, permissionCount, userCount }`). Decide during implementation (OQ-2).

### Error contract

- `403 ROLE_NOT_EDITABLE` — target is `SUPER_ADMIN`.
- `403 CANNOT_EDIT_OWN_ROLE` — target equals actor's role.
- `400` — invalid `role` / `permission` enum value.
- `409` — permission already granted / not present on revoke (idempotency
  decision — OQ-3).

## 8. UX / UI behavior

- `/access/roles` lists all 10 roles. Each editable role opens a detail/editor
  reusing the per-user override component pattern.
- Permission picker grouped by `PermissionCategoryEnum` (same grouping as the
  read-only catalog page).
- `SUPER_ADMIN` row: read-only badge + tooltip ("Always has all permissions;
  not editable").
- The actor's own role: read-only badge + tooltip ("You cannot edit your own
  role").
- Save flow: select changes → **impact preview** ("This role is held by N
  users. Adding X / removing Y.") → confirm → toast on success.
- Errors from the safeguard validation surface inline (not just a generic
  failure).

## 9. Acceptance criteria

- AC-1: A `SUPER_ADMIN` can add a permission to the `EDITOR` role from the UI;
  an `EDITOR` user's next request reflects it **without** a 10-minute wait.
- AC-2: A `SUPER_ADMIN` can remove a permission from a role and it disappears
  from affected users' effective set immediately.
- AC-3: The `SUPER_ADMIN` role is not editable via UI or API (API returns
  `ROLE_NOT_EDITABLE`).
- AC-4: An actor cannot edit the role they themselves hold (API returns
  `CANNOT_EDIT_OWN_ROLE`); the UI shows it read-only.
- AC-5: Editing a role shows the count of users holding that role before the
  change is confirmed.
- AC-6: Every grant/revoke at the role level produces an audit-log entry with
  actor, role, permission, and action.
- AC-7: A fresh DB (`db:fresh`) still seeds `role_permission` from
  `ROLE_PERMISSIONS` and boots with the same defaults as before (bootstrap
  unbroken).
- AC-8: Endpoints are gated by the correct `PERMISSION_VIEW/ASSIGN/REVOKE`
  permission; an actor lacking them gets `403`.
- AC-9: SPEC-169 role-permission audit tests still pass (they validate the seed
  baseline, unaffected by live edits).

## 10. Risks

- R-1: **Lock-out.** Mitigated structurally: `SUPER_ADMIN` immune + can't edit
  own role ⇒ only a `SUPER_ADMIN` can edit `ADMIN`, and a `SUPER_ADMIN` can
  always self-recover. Documented limitation: editing the `ADMIN` role always
  requires a `SUPER_ADMIN` to exist (one always should).
- R-2: **Stale reads across processes.** With multiple API instances, the
  in-process `role-permissions-cache` invalidation only clears the instance that
  handled the write; other instances still expire on their 10-min TTL. Acceptable
  for now (matches current user-cache behavior); a Redis-backed invalidation is
  the scale-out path (NG-5).
- R-3: **Divergence between constant and DB.** After the first live edit,
  `ROLE_PERMISSIONS` and `role_permission` intentionally diverge. Anyone reading
  the constant must know it is bootstrap-only, not live truth (IN-4).
- R-4: **New permissions added later** (a new `PermissionEnum` member for a new
  feature) still need to reach live roles via the seed data-migration carril —
  live edits don't replace that path for *catalog* additions.

## 11. Open questions

- OQ-1: Should `CLIENT_MANAGER` (currently unused per a KNOWN DEBT comment in
  `rolePermissions.seed.ts:740`) be editable/visible like any other role, or
  hidden until it has a purpose? Default: show it (it's a real enum member).
- OQ-2: Impact-preview user count — fold into the GET response, or a dedicated
  `GET /api/v1/admin/roles/{role}` endpoint? (Implementation detail.)
- OQ-3: Idempotency of grant-already-present / revoke-not-present — return `409`
  or treat as no-op `200`? (Mirror whatever the per-user override endpoint does
  for consistency.)
- OQ-4: Bulk edit (apply several permission changes in one confirmation) vs
  one-at-a-time writes. Default: one-at-a-time to match the existing per-user
  pattern; revisit if UX demands batching.

## 12. Implementation notes

- IN-1: The service methods `assignPermissionToRole` / `removePermissionFromRole`
  already exist — Phase 1 is mostly wiring routes + cache invalidation +
  safeguard validation, not new business logic.
- IN-2: Mirror `apps/api/src/routes/user/admin/permissions.ts` closely — same
  gate trio, same response shape philosophy, same `SUPER_ADMIN` rejection.
- IN-3: Mirror the admin UI stack from
  `apps/admin/src/features/users/components/permissions/` — new
  `use-role-permissions.ts` hook alongside `use-user-permissions.ts`.
- IN-4: Add a code comment on `ROLE_PERMISSIONS` (and/or the audit test files)
  stating it is the **bootstrap baseline**, that the live DB is authoritative
  post-seed, and that divergence is expected — so nobody "fixes" the tests by
  syncing them to a mutated DB.
- IN-5: Emit the audit entry from the service layer (or a wrapper) so it can't be
  bypassed by a future direct caller.
- IN-6: No migration expected. If implementation reveals a schema need, follow
  the three-carril migration rules and add the `release-migration` label +
  `area-db` to HOS-120.

## 13. Linear

Canonical tracking:
HOS-120
