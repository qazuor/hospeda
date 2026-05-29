# Permission Model — Tiers, Owner-Scoping & Lookups

> **Living reference.** This document explains how the permission model works
> day-to-day and how to extend it. The *why* behind the owner-scoping design is
> in [ADR-028](../decisions/ADR-028-role-permission-own-scoping.md). When the
> two disagree, the ADR records the decision; update this file to match.

## Golden rule

**Never check roles. Always check `PermissionEnum`.** Roles are just bundles of
permissions assigned in the seed (`ROLE_PERMISSIONS`). Services and routes check
permissions; the seed maps permissions to roles; a future admin panel (SPEC-170)
will override permissions per user. See `packages/service-core/CLAUDE.md`
("CRITICAL: Granular Permission Pattern").

## Read-access tiers

For an entity that supports owner-scoping, read access has three tiers:

| Tier | Permission shape | Sees | Enforcement |
|------|------------------|------|-------------|
| Public | (none / implicit `_VIEW`) | PUBLIC rows only | `checkCanView` |
| Owner | `<entity>.viewOwn` | Only rows the actor owns (any visibility) | Service forces `ownerId = actor.id` |
| All | `<entity>.viewAll` | Every row, any owner, any visibility | No scoping (staff) |

Today **only `accommodation`** implements all three tiers
(`ACCOMMODATION_VIEW_OWN` / `ACCOMMODATION_VIEW_ALL`). Other entities expose
only Public + All because no non-staff role needs an owner-scoped view of them
(see ADR-028 "Considered Options A"). Add `_VIEW_OWN` to an entity only when a
real role needs it — not preemptively (YAGNI).

### Key behaviors

- **Non-owned detail → 404, not 403.** `checkCanAdminView` returns
  `NOT_FOUND` for a `_VIEW_OWN`-only actor hitting someone else's row, even a
  PUBLIC one. We do not confirm the row exists (anti-enumeration).
- **Forced scoping is server-side and non-overridable.** A `_VIEW_OWN`-only
  actor's `ownerId` filter is forced to `actor.id`, overwriting any
  client-supplied or forged value. The client cannot escape the scope.
- **`_canAdminView` is not `_canView`.** The admin view check must not fall back
  to "any PUBLIC row" — that would re-open the leak.

## The route-gate pattern (important)

The admin route factory middleware uses `hasAllPermissions` — it is **AND-only**
and cannot express "VIEW_ALL **OR** VIEW_OWN". So for any "staff sees all /
owner sees own" route:

```ts
// apps/api/src/routes/<entity>/admin/list.ts
export const adminListRoute = createAdminListRoute({
    // NO requiredPermissions: [VIEW_ALL] here.
    // The middleware only enforces admin-panel access (ACCESS_PANEL_ADMIN /
    // ACCESS_API_ADMIN). The SERVICE decides VIEW_ALL vs VIEW_OWN and scopes.
    ...
});
```

The service then enforces the entity-specific permission:

```ts
// checkCanAdminList: accept VIEW_ALL OR VIEW_OWN, else FORBIDDEN.
// _executeAdminSearch: if VIEW_OWN-only, force entityFilters.ownerId = actor.id.
// adminGetById / adminGetFaqs: run checkCanAdminView (VIEW_ALL | owner-or-404).
```

Reference implementation:
`apps/api/src/routes/accommodation/admin/{list,getById,getFaqs}.ts` +
`packages/service-core/src/services/accommodation/accommodation.{service,permissions}.ts`.
(`apps/api/src/routes/conversations/admin/list.ts` is the original pattern.)

## Ownership resolver

`isOwner` is single-sourced so the list, detail, and FAQs paths cannot drift:

```ts
// packages/service-core/src/utils/ownership.ts
const desc = getOwnershipDescriptor('accommodation'); // { ownerColumn, isOwner }
if (desc.isOwner(actor, entity)) { /* allow */ }
```

`OWNERSHIP_REGISTRY` currently holds accommodation only.

## Adding `_VIEW_OWN` to a new entity (recipe)

1. Add `<ENTITY>_VIEW_OWN = '<entity>.viewOwn'` to `PermissionEnum`
   (`packages/schemas/src/enums/permission.enum.ts`). The schema is
   `z.nativeEnum`, so no list to update — but add an enum-consistency assertion.
2. Add an `OWNERSHIP_REGISTRY` entry in `service-core/src/utils/ownership.ts`
   (`ownerColumn`, `isOwner`).
3. Add `checkCanAdminView` + `checkCanAdminList` to the entity's `.permissions`
   file (copy accommodation's).
4. Override `adminGetById` / `_executeAdminSearch` in the service to force
   owner-scoping for the `_VIEW_OWN`-only branch.
5. Drop `requiredPermissions: [VIEW_ALL]` from the admin list/detail routes
   (the service now decides).
6. Update the seed role(s) and confirm the AC-6 audit test still passes (the
   new `_VIEW_OWN` is owner-scoped, so it is **not** a "broad grant").
7. Add a `beforeLoad` redirect guard on the admin list route if a role should
   land on a `/me/...` view instead.

## The `/options` lookup tier

Admin selectors (owner dropdown, destination picker, etc.) must NOT require
broad `_VIEW_ALL` grants just to populate a list. Use the lightweight lookup
endpoint instead:

- **Route**: `GET /api/v1/admin/<entity>/options` — declares **no**
  `requiredPermissions`; the middleware enforces only admin-panel access. Must
  be registered **before** `/{id}` so "options" is not parsed as an id.
- **Gate**: `checkCanFindOptions` (shared, entity-agnostic) — passes for any
  actor with `ACCESS_PANEL_ADMIN` or `ACCESS_API_ADMIN` (editor + admin).
- **Payload**: `{ id, label, slug }` (accommodation adds `type` + `destination`).
  DRAFT-inclusive (excludes only soft-deleted rows).
- **Label fallbacks**: users `displayName ?? email` (PII tradeoff accepted —
  staff-only surface); event-locations `placeName ?? slug`.

Entities with `/options` today: users, destinations, accommodations, events,
event-organizers, event-locations.

## Per-role verdict (current)

| Role | Read posture |
|------|--------------|
| `SUPER_ADMIN` / `ADMIN` | All entities (staff) |
| `EDITOR` | All **editorial** content (posts + events, incl. private/draft) by design; `ACCESS_PANEL_ADMIN` for `/options` |
| `HOST` | **Own** accommodations only (`ACCOMMODATION_VIEW_OWN`); `ACCESS_PANEL_ADMIN` for `/options` |
| `CLIENT_MANAGER` | Broad grants **not yet tightened** — role unused, tracked debt (see [debt-items.md](../../.claude/specs/SPEC-169-role-permission-own-scoping/debt-items.md)) |
| `SPONSOR` / `USER` / `GUEST` | Public only |

## The systemic guard

`packages/seed/test/role-permission-audit.test.ts` (AC-6) reverse-maps
`ROLE_PERMISSIONS` and fails if any **non-staff** role holds a broad grant
(`_VIEW_ALL` / `_READ_ALL` / `_VIEW_PRIVATE` / `_VIEW_DRAFT`) outside an explicit
allow-list. This is the regression net: re-adding `ACCOMMODATION_VIEW_ALL` to
HOST — or granting any new broad permission to a non-staff role — fails CI. Keep
the allow-list honest: an entry there is a deliberate, documented exception
(EDITOR's editorial grants; CLIENT_MANAGER's tracked debt), not a dumping ground.

## Related

- [ADR-028](../decisions/ADR-028-role-permission-own-scoping.md) — the decision
- `packages/service-core/CLAUDE.md` — permission-check coding rules
- `apps/api/docs/route-architecture.md` — three-tier route model
- SPEC-170 — per-user permission overrides (the future admin panel)
