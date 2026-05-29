# ADR-028: Role Permission Audit + Owner-Scoped Data Access

**Status**: Accepted
**Date**: 2026-05-29
**Spec**: SPEC-169

## Context

A role-permission audit (SPEC-169 T-001/T-002) of the live seed
(`packages/seed/src/required/rolePermissions.seed.ts`) surfaced a real,
read-only **cross-tenant data leak**:

- `RoleEnum.HOST` held `ACCOMMODATION_VIEW_ALL`.
- The admin panel's `/me/accommodations` view reuses the admin
  accommodation endpoints (`GET /api/v1/admin/accommodations`,
  `GET /api/v1/admin/accommodations/{id}`, `.../faqs`).
- Those endpoints gated on `ACCOMMODATION_VIEW_ALL`. So a HOST — intended to
  see only their own listings — could list and open **every** accommodation
  in the system, including other owners' drafts and private data.

The write side was already safe: every owner-scoped write op
(`update`/`softDelete`/`restore`) enforced `isOwner` for `_OWN`-only actors,
and `hardDelete` was staff-only. The leak was purely on the **read** path.

### Audit findings (the full matrix)

- **Only non-staff broad grants** in the live seed: `HOST` (`ACCOMMODATION_VIEW_ALL`,
  the leak), `EDITOR` (`POST_VIEW_PRIVATE`/`POST_VIEW_DRAFT`/`EVENT_VIEW_PRIVATE`/
  `EVENT_VIEW_DRAFT` — legitimate editorial visibility), and `CLIENT_MANAGER`
  (5 broad grants — role currently unused, deferred). `USER`/`SPONSOR` clean.
- **Accommodation was the ONLY non-staff-exploitable read leak.** Every other
  leak-shaped admin endpoint is gated by permissions only staff (or the
  `SUPER_ADMIN` catch-all) hold.
- A correct reference implementation of forced owner-scoping already existed:
  `apps/api/src/routes/conversations/admin/list.ts`.

### Goal

Close the accommodation read leak, build a **systemic** guard so no future
role silently re-acquires a broad grant, and unblock the admin selectors that
relied on HOST/EDITOR holding broad `_VIEW_ALL` grants — without fabricating
unused permissions or over-engineering a generic framework (KISS / YAGNI).

## Considered Options

### Option A — Add `_VIEW_OWN` to every entity (rejected)

Mint `*_VIEW_OWN` for accommodation, post, event, destination, etc. and wire
owner-scoping everywhere.

- Symmetric, "complete".
- **Cons**: most of those permissions would be **dead code** — no role holds
  them, no panel assigns them, no endpoint is exploitable today. They would
  rot and give a false sense of coverage.
- Rejected: violates YAGNI; the real exposure is accommodation only.

### Option B — Just remove `ACCOMMODATION_VIEW_ALL` from HOST (rejected)

Drop the grant and let HOST fall back to `_VIEW` (PUBLIC-only).

- Minimal.
- **Cons**: breaks `/me/accommodations` — a HOST could no longer see their own
  DRAFT/PRIVATE listings via the admin endpoints. No mechanism to scope a list
  to "mine".
- Rejected: trades a read leak for a broken core feature.

### Option C — `_VIEW_OWN` tier for accommodation + server-forced scoping + systemic audit test (adopted)

A new `ACCOMMODATION_VIEW_OWN` tier, the service forces owner-scoping when the
actor holds only `_VIEW_OWN`, and a single regression test guards **all**
non-staff roles against broad grants.

- Closes the real leak; preserves `/me/accommodations`.
- The audit test — not a pile of unused permissions — provides the systemic,
  cross-entity protection.
- Generic-but-minimal ownership resolver lets future entities replicate the
  pattern when they actually need it.
- Adopted.

## Decision

Adopt **Option C**. The permission model now has, for read access:

| Tier | Meaning | Enforcement |
|------|---------|-------------|
| `_VIEW` (implicit) | PUBLIC rows only | `checkCanView` |
| `ACCOMMODATION_VIEW_OWN` | Only rows the actor owns (any visibility) | Server forces `ownerId = actor.id` |
| `ACCOMMODATION_VIEW_ALL` | All rows, any owner, any visibility | No scoping (staff) |

### 1. New permission

`ACCOMMODATION_VIEW_OWN = 'accommodation.viewOwn'` added to `PermissionEnum`
(`packages/schemas/src/enums/permission.enum.ts`). `PermissionEnumSchema` is
`z.nativeEnum`, so the value is picked up automatically. **Only accommodation**
gets a `_VIEW_OWN` (decision D1).

### 2. Ownership resolver (generic, minimal)

`packages/service-core/src/utils/ownership.ts` defines an
`OwnershipDescriptor { ownerColumn, isOwner }`, an `OWNERSHIP_REGISTRY`
(accommodation only → `ownerColumn: 'ownerId'`), and `getOwnershipDescriptor()`.
This single-sources the `isOwner` predicate so the list, detail, and FAQs paths
agree. Future entities replicate by adding a registry entry (decision D3).

### 3. `_canAdminView` ≠ `_canView`

`checkCanAdminView` (accommodation.permissions) is a dedicated check:
`VIEW_ALL` → any row; `VIEW_OWN` → `isOwner` else **404 NOT_FOUND**; neither →
FORBIDDEN. A non-owned row returns **404, never 403** — we do not confirm the
resource exists (anti-enumeration, decision D2). It does **not** reuse
`checkCanView`, which would wrongly allow any PUBLIC row.

### 4. Forced owner-scoping on the list

`AccommodationService._executeAdminSearch` forces
`entityFilters.ownerId = actor.id` for a `VIEW_OWN`-only actor, **overwriting**
any client-supplied or forged `ownerId`. A `VIEW_ALL` actor lists unscoped;
neither permission → FORBIDDEN at `checkCanAdminList`. Detail and FAQs
(`adminGetById` / `adminGetFaqs`) run `checkCanAdminView`.

### 5. Route-gate pattern (factory is AND-only)

The admin route factory middleware uses `hasAllPermissions` (AND-only — it
cannot express "VIEW_ALL OR VIEW_OWN"). Resolution: the admin route declares
**no** `requiredPermissions`, so the middleware only enforces admin-panel
access; the **service** decides `VIEW_ALL` vs `VIEW_OWN` and owner-scopes.
This is the canonical pattern for any "staff sees all / owner sees own" route.

### 6. `/options` lookup tier

Removing broad grants from HOST/EDITOR broke admin selectors that fetched full
entity lists just to populate a dropdown. New lightweight
`GET /api/v1/admin/<entity>/options` endpoints return `{ id, label, slug }`
(accommodation additionally `type` + `destination`), DRAFT-inclusive, gated on
**`ACCESS_PANEL_ADMIN`** (editor + admin both hold it) — decision D4. Entities:
users, destinations, accommodations, events, event-organizers, event-locations.
Label fallbacks: users `displayName ?? email` (PII tradeoff accepted, staff-only
surface), event-locations `placeName ?? slug` (D4 addendum). `checkCanFindOptions`
is a shared, entity-agnostic check in `service-core/src/utils/permission.ts`.

### 7. Front guard

`apps/admin/src/lib/owner-scoped-guard.ts` (`decideOwnerScopedRedirect`, pure
fn) is wired into the `/accommodations` list route `beforeLoad`: an actor with
`VIEW_OWN` and not `VIEW_ALL` is redirected to `/me/accommodations`. **Only the
list route** is guarded — detail/edit/new are covered server-side (D5).

### 8. Seed changes + systemic guard

- HOST: `ACCOMMODATION_VIEW_ALL` → `ACCOMMODATION_VIEW_OWN`.
- EDITOR: keep its editorial broad grants, with a rationale comment.
- `CLIENT_MANAGER`: **untouched** (known debt, see below).
- `packages/seed/test/role-permission-audit.test.ts` (AC-6) is the systemic
  guard: it reverse-maps `ROLE_PERMISSIONS` and **fails** if any non-staff role
  holds a broad grant (`_VIEW_ALL`/`_READ_ALL`/`_VIEW_PRIVATE`/`_VIEW_DRAFT`)
  outside an explicit allow-list (EDITOR's 4 editorial grants; CLIENT_MANAGER's
  tracked debt). Re-adding `ACCOMMODATION_VIEW_ALL` to HOST fails this test.

## Per-role verdict (from the T-001/T-002 audit)

| Role | Broad grants | Verdict |
|------|--------------|---------|
| `SUPER_ADMIN` / `ADMIN` | many | Staff — expected, no change |
| `EDITOR` | `POST_VIEW_PRIVATE/DRAFT`, `EVENT_VIEW_PRIVATE/DRAFT` | **KEEP** — legitimate editorial visibility; narrow per-user via SPEC-170 |
| `HOST` | `ACCOMMODATION_VIEW_ALL` | **FIX** → `ACCOMMODATION_VIEW_OWN` (the leak) |
| `CLIENT_MANAGER` | `USER_READ_ALL`, `ACCOMMODATION_VIEW_ALL`, `ACCOMMODATION_VIEW_PRIVATE`, `DESTINATION_VIEW_ALL`, `DESTINATION_VIEW_PRIVATE` | **DEFER** — role unused; tracked debt, revisit when activated |
| `SPONSOR` / `USER` / `GUEST` | none | Clean |

## What this spec did NOT do (explicit scope guards)

- **Posts are not modified** beyond documentation (decision D7). Posts use a
  different model — automatic author-fallback on update/delete/publish,
  permission-only on restore/hardDelete — not the OWN/ANY tier. Adding
  `_OWN` post perms now would be dead code. The granular per-user model for
  posts is deferred to SPEC-170.
- **CLIENT_MANAGER is not tightened** — the role is unused; tightening it now
  is untestable churn. Tracked as known debt (allow-listed in AC-6 with a
  comment) and in `.claude/specs/SPEC-169-role-permission-own-scoping/debt-items.md`.
- The broken `PostSponsorshipSelectField` (points at an unmounted
  `/admin/post-sponsorships` route) is a separate bug, left with a SPEC-169/OQ1
  comment for whoever mounts the route to wire `/options`-style gating.

## Consequences

### Positive

- The cross-tenant accommodation read leak is closed at the service layer
  (client cannot forge `ownerId` to escape the scope).
- A single audit test protects **every** non-staff role from regressions, with
  far less surface than per-entity `_VIEW_OWN` permissions.
- Selectors work for editor/admin without broad grants via the `/options` tier.
- The ownership resolver + route-gate pattern give a clear, documented recipe
  for the next entity that needs owner-scoping.

### Negative

- The "service decides, route declares no permission" pattern is non-obvious to
  a reader expecting `requiredPermissions` on every admin route. Mitigated by
  this ADR and the living reference (`docs/security/permission-model.md`).
- 404-for-non-owned can confuse debugging (looks like a missing row). This is
  intentional (anti-enumeration).

### Neutral

- `CLIENT_MANAGER` keeps broad grants until it is activated; the debt is
  explicit and test-guarded against silently spreading to other roles.

## References

- `packages/schemas/src/enums/permission.enum.ts` — `ACCOMMODATION_VIEW_OWN`
- `packages/service-core/src/utils/ownership.ts` — resolver + registry
- `packages/service-core/src/utils/permission.ts` — `checkCanFindOptions`
- `packages/service-core/src/services/accommodation/accommodation.permissions.ts`
  — `checkCanAdminView` / `checkCanAdminList`
- `packages/service-core/src/services/accommodation/accommodation.service.ts`
  — `adminGetById` / `adminGetFaqs` / `findOptions` / `_executeAdminSearch`
- `packages/seed/src/required/rolePermissions.seed.ts` — HOST/EDITOR/CLIENT_MANAGER
- `packages/seed/test/role-permission-audit.test.ts` — AC-6 systemic guard
- `apps/api/src/routes/accommodation/admin/{list,getById,getFaqs,options}.ts`
- `apps/admin/src/lib/owner-scoped-guard.ts` — front redirect guard
- `docs/security/permission-model.md` — living reference for the tiers
- `.claude/specs/SPEC-169-role-permission-own-scoping/decision-log.md` — D1–D7 + OQ1–OQ5
- SPEC-170 — per-user permission panel (deferred granular overrides)
