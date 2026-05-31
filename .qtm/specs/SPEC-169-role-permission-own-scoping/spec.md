---
id: SPEC-169
slug: role-permission-own-scoping
title: Role Permission Audit + Owner-Scoped Data Access
status: draft
owner: qazuor
created: 2026-05-28
relatedSpecs:
  - SPEC-143  # billing entitlements / test-user matrix (role x plan)
  - SPEC-154  # admin config-driven IA (sidebar permission gates)
  - SPEC-164  # admin billing super-only (adjacent permission tightening)
tags:
  - security
  - permissions
  - data-leak
---

# SPEC-169 — Role Permission Audit + Owner-Scoped Data Access

> ⛔ **DECISION PROTOCOL (read first, applies to the whole spec):** In every single case —
> without exception — if a change or decision is not *extremely* clear-cut, if there is even
> the slightest ambiguity, or if there is more than one viable option, **STOP and consult the
> owner (qazuor)**. Do not decide autonomously. See §12.

## 1. Summary

A `HOST` user can open the **global accommodations list** (`/accommodations`) by typing
the URL and see **every accommodation on the platform, with real data** — not just their
own. The admin sidebar hides the link, but the page is reachable and the API returns the
full dataset.

Root cause is **not** the frontend route guard gap. It is a **mis-granted permission in
the role seed**: `RoleEnum.HOST` holds `PermissionEnum.ACCOMMODATION_VIEW_ALL`, the
"see every accommodation" permission. The same anti-pattern exists for `CLIENT_MANAGER`.

This spec covers: (a) a **full per-role audit** of all `_VIEW_ALL` / `_READ_ALL` /
`_VIEW_PRIVATE` grants, (b) a new **owner-scoped permission tier** (`_VIEW_OWN`) with
**server-side forced scoping**, and (c) **defense-in-depth** route guards in the admin app.

## 2. Evidence (the leak chain)

1. **Seed grant** — `packages/seed/src/required/rolePermissions.seed.ts:734`
   ```ts
   [RoleEnum.HOST]: [
       // ACCOMMODATION: Own accommodations only   <-- comment says "own only"
       ...
       PermissionEnum.ACCOMMODATION_VIEW_ALL,        // <-- but grants "view ALL"
   ```
2. **Shared endpoint** — `/me/accommodations` reuses the admin list endpoint:
   `apps/admin/src/features/accommodations/hooks/useAccommodationQuery.ts:93-94`
   → `GET /api/v1/admin/accommodations?ownerId=<self>`
3. **Endpoint gate** — that endpoint requires `ACCOMMODATION_VIEW_ALL`:
   `apps/api/src/routes/accommodation/admin/list.ts:29` → service
   `checkCanAdminList` at `packages/service-core/src/services/accommodation/accommodation.permissions.ts:184`.
4. **`ownerId` is an OPTIONAL query filter, not an enforcement** — drop the filter and
   the same endpoint returns everything.

Net result: HOST has the permission the endpoint demands, so the API returns all rows.
The frontend "empty shell" hypothesis from the first audit pass was **wrong** — confirmed
empirically by the user (real rows visible).

### 2.1 Second vector — the detail/view endpoint leaks too (verified)

The same root cause exposes a **second** vector beyond the list:

- `GET /api/v1/admin/accommodations/:id` (`apps/api/src/routes/accommodation/admin/getById.ts:24`)
  requires `ACCOMMODATION_VIEW_ALL` at the route middleware, then calls
  `accommodationService.getById` → `_canView` → `checkCanView`.
- `checkCanView` (`accommodation.permissions.ts:143`) returns "allowed" as soon as the actor
  holds `ACCOMMODATION_VIEW_ALL`. Since HOST holds it, **a HOST can open the full admin
  detail of ANY accommodation — including PRIVATE and RESTRICTED ones owned by others.**
- All accommodation sub-tabs (amenities, pricing, gallery, reviews) and the edit data load
  fetch through this same `getById` (`useAccommodationQuery.ts:33,229`), so they inherit the leak.

**Consequence for the fix:** owner-scoping must cover **`getById`, not just `adminList`**.
And when `VIEW_ALL` is removed from HOST, the `getById` route middleware (which demands
`VIEW_ALL`) would start returning 403 even for the HOST's *own* accommodations — breaking
`/me/accommodations` → view/edit. So the route gate and the service check both need the
`VIEW_ALL` OR `VIEW_OWN` treatment (see §5.2).

### 2.2 Write/destructive operations — verified SAFE for accommodation (audit the rest)

A HOST **cannot** modify or delete another host's accommodation. Verified end-to-end:

| Operation | Check | Ownership enforced? |
|-----------|-------|---------------------|
| `update` | `checkGenericPermission(UPDATE_ANY, UPDATE_OWN, isOwner)` (`permissions.ts:43`) | ✅ HOST has only `_OWN` → `isOwner` required |
| `softDelete` | same pattern (`:71`) | ✅ |
| `hardDelete` | requires `ACCOMMODATION_HARD_DELETE` — HOST does **not** hold it (`:89`) | ✅ |
| `restore` | same pattern (`:106`) | ✅ |
| `publish` | explicit `isOwner` (`"only the owner or an admin"`, `service.ts:950-957`) | ✅ |
| `updateVisibility` | `_canUpdateVisibility` → `checkCanUpdate` → `isOwner` (`service.ts:463`) | ✅ |
| `setFeaturedStatus` | `_canUpdate` → `isOwner` | ✅ |

**So the HOST leak is READ-ONLY** (data exposure), not write/manipulation. This is reassuring
but does NOT close the spec, for two reasons:

1. The safe pattern (`checkGenericPermission` + `isOwner`, or an explicit owner check) must be
   **confirmed consistent across every owner-scoped entity** — posts (`authorId`), events,
   sponsorships, destinations, etc. — not assumed from the accommodation sample.
2. The audit must include **API routes with no admin UI** — `hardDelete` (`/{id}/hard`),
   `batch`, `restore` — which never surface in the page-level sweep but exist and mutate by id.

## 3. Audit findings (non-staff roles)

Scan of `_VIEW_ALL` / `_READ_ALL` / `_VIEW_PRIVATE` in non-staff roles:

| Role | Flagged permissions | Assessment |
|------|--------------------|------------|
| **HOST** | `ACCOMMODATION_VIEW_ALL` | 🔴 **Confirmed leak.** Should be own-scoped. |
| **CLIENT_MANAGER** | `USER_READ_ALL`, `ACCOMMODATION_VIEW_ALL`, `ACCOMMODATION_VIEW_PRIVATE`, `DESTINATION_VIEW_ALL`, `DESTINATION_VIEW_PRIVATE` | 🟡 **Deferred (owner decision).** Role is not in use yet, so the latent leak is inactive. Flagged as **known debt** — revisit when the role is activated. **Out of scope** for SPEC-169 implementation (see §11). |
| **EDITOR** | `POST_VIEW_ALL`, `POST_VIEW_PRIVATE`, `EVENT_VIEW_PRIVATE` | 🟢 **Confirmed legitimate (owner decision).** The editorial role sees all editorial content (posts/events) by default. A SUPER_ADMIN may narrow this per-user via **direct permission overrides** (already supported by the user-permissions model). Keep, with an inline rationale comment in the seed. |
| SPONSOR, USER | — | 🟢 Clean. |

> The audit must be re-run programmatically as task 1 and the table above promoted to the
> source-of-truth decision record (one row per flagged grant, with a keep/replace verdict).

## 4. Goals / Non-goals

**Goals**
- Eliminate cross-tenant data exposure for owner-scoped roles (HOST). CLIENT_MANAGER is deferred (§8 Q2, §11).
- Introduce an explicit, enforceable `_VIEW_OWN` permission tier with **server-side** scoping.
- Add defense-in-depth route guards so owner-scoped roles never even render staff-only list routes.
- Produce a documented, reviewed verdict for **every** flagged `_VIEW_ALL`/`_READ_ALL` grant.
- Confirm that **every write/destructive admin operation** (incl. UI-less routes) on owner-scoped
  entities enforces ownership for `_OWN`-only actors. (Accommodation is already compliant — §2.2 —
  this goal is the cross-entity confirmation + regression guard.)

**Non-goals**
- Reworking the entire permission enum taxonomy.
- Changing the admin IA/sidebar config (SPEC-154 territory) beyond what defense-in-depth needs.
- Billing/entitlement limits (SPEC-143/145).

## 5. Design

### 5.1 New permission tier: `_VIEW_OWN`

Add owner-scoped view permissions where a role must list/view only its own records:
- `ACCOMMODATION_VIEW_OWN` (definite)
- `DESTINATION_VIEW_OWN`, and any other entity surfaced by the §3 audit as own-scoped.

`_VIEW_OWN` is **strictly weaker** than `_VIEW_ALL`: it never exposes other owners' rows
and never exposes `PRIVATE`-visibility records that aren't the actor's.

### 5.2 Server-side forced owner-scoping (the core enforcement)

In the list service path (`adminList` / the read base in
`packages/service-core/src/base/base.crud.read.ts`), resolve scope from permissions —
**never** trust the client `ownerId`:

```
adminList(actor, query):
    if actor has _VIEW_ALL:        proceed unscoped (staff)
    elif actor has _VIEW_OWN:      query.ownerId = actor.id   // FORCED, overrides any client value
    else:                          throw FORBIDDEN
```

This closes the "drop the filter" bypass: an actor with only `_VIEW_OWN` is *physically
unable* to widen the query server-side. `checkCanAdminList` is updated to accept either
permission; the scoping decision lives in the service, not the route.

**The same treatment applies to the detail endpoint (`getById`)** — see §2.1. Two changes:

- **Route middleware** for `GET /api/v1/admin/accommodations/:id` must accept
  `ACCOMMODATION_VIEW_ALL` **OR** `ACCOMMODATION_VIEW_OWN` (otherwise removing `VIEW_ALL`
  from HOST 403s their own detail/edit/sub-tabs).
- **New service check `_canAdminView`**, distinct from the generic `_canView`:
  ```
  _canAdminView(actor, entity):
      if actor has _VIEW_ALL:   allow (staff — any record)
      elif actor has _VIEW_OWN:  allow ONLY if isOwner(actor, entity); else FORBIDDEN/NOT_FOUND
      else:                      FORBIDDEN
  ```
  This must NOT reuse the generic `checkCanView`, which returns "allowed" for any `PUBLIC`
  record (appropriate for the public read path, but on the **admin** endpoint it would leak
  admin-grade fields of a public competitor's listing to a `_VIEW_OWN`-only actor). Mirror of
  the `_canAdminList` vs `_canList` split that already exists in the base service.

### 5.3 Seed correction

- Remove `ACCOMMODATION_VIEW_ALL` from HOST; add `ACCOMMODATION_VIEW_OWN`.
- Apply the §3 verdicts to CLIENT_MANAGER (pending §8 Q2) and document EDITOR's legitimate grants.

### 5.4 Defense-in-depth: admin route guards (capa 3)

Independently of the API fix, the admin app must not render staff-only list routes for
owner-scoped roles. Preferred mechanism is a **`beforeLoad`** check (server-side in the
loader, page never mounts) over `RoutePermissionGuard` (client-side `useEffect`, mounts +
fetches before redirecting). For `/accommodations`, an owner-scoped role redirects to
`/me/accommodations`. This is belt-and-suspenders: even with the API fixed, the front
should send the user to the surface they actually own.

### 5.5 Relation selectors — dedicated lookup endpoints (Q3 → Option A)

Relation selectors must stop depending on the heavyweight admin list endpoints (which is
what forces broad view grants). Introduce a minimal lookup tier:

- `GET /api/v1/admin/<entity>/options?q=<term>&limit=<n>` returning **only** `{ id, label, slug }`
  (label = display name; no admin/private fields, no pricing, no contact data).
- Returns matches regardless of publication state (includes DRAFT) so relations can target
  unpublished entities — this is why Option C (public-only) was rejected.
- Gated lightly: `ACCESS_PANEL_ADMIN` is sufficient (the payload exposes only public-grade
  identity fields). No `_VIEW_ALL` required.
- Migrate the existing selectors to it:
  - `OwnerSelect` (`apps/admin/src/components/selects/OwnerSelect.tsx`)
  - `DestinationSelect` (`apps/admin/src/components/selects/DestinationSelect.tsx`)
  - generic entity search (`apps/admin/src/lib/utils/entity-search.utils.ts`)
  - any entity-select under `apps/admin/src/components/entity-form/fields/entity-selects/`
- Net effect: EDITOR (and every role) can populate relation selectors with **zero** broad
  view permission. Detailed inspection of an entity happens on the public web, not in admin.

> Scope guard: the `/options` endpoint pattern is added for the entities actually used as
> relation targets (surfaced by the §3/task-1 audit), not blindly for all entities.

### 5.6 Per-entity ownership resolver

Forced owner-scoping (§5.2) needs to know *which column* identifies the owner — it is not
always `ownerId`:

- `accommodation` → `ownerId`
- `post` → `authorId`
- others → TBD by the task-1 audit (`createdById`, etc.)

Define a small per-entity ownership descriptor consumed by both the list scoping and
`_canAdminView`:

```
ownership(entity-type) -> { ownerColumn: 'ownerId' | 'authorId' | ...,
                            isOwner(actor, entity): boolean }
```

`accommodation` already has `isOwner(actor, entity) => entity.ownerId === actor.id`
(`accommodation.permissions.ts:14`). Generalize this into a resolver so the forced-scope
filter (`where[ownerColumn] = actor.id`) and the `isOwner` check stay consistent and are
defined exactly once per entity. Entities that are never owner-scoped (no `_VIEW_OWN` role)
do not need a descriptor.

> Open consideration for design phase: keep the resolver minimal (only entities that get a
> `_VIEW_OWN` grant) rather than a platform-wide ownership registry. YAGNI.

## 6. Functional Requirements

- **REQ-1** A HOST hitting `GET /api/v1/admin/accommodations` (with or without `ownerId`) receives **only their own** accommodations.
- **REQ-2** A HOST who removes/forges the `ownerId` query param still receives only their own rows (server forces scope).
- **REQ-3** A HOST (with `ACCOMMODATION_VIEW_OWN`, not `_VIEW_ALL`) hitting `GET /api/v1/admin/accommodations/:id`:
  - for their **own** accommodation → `200` with full admin detail (and all sub-tabs / edit load work).
  - for an accommodation they do **not** own (any visibility, including PUBLIC) → `403`/`404` via the new `_canAdminView` check (NOT the generic `checkCanView`, which would allow PUBLIC).
- **REQ-4** `/me/accommodations` continues to work for HOST after `ACCOMMODATION_VIEW_ALL` is removed.
- **REQ-5** Staff roles (ADMIN, SUPER_ADMIN) keep full unscoped list access.
- **REQ-6** Every flagged `_VIEW_ALL`/`_READ_ALL` grant in §3 has a recorded keep/replace verdict; EDITOR's kept grants carry an inline rationale comment in the seed.
- **REQ-7** (Defense-in-depth) An owner-scoped role navigating to `/accommodations` is redirected to `/me/accommodations` before any global data fetch.
- **REQ-8** Relation selectors (destination, owner, accommodation, etc.) work for any role with only `ACCESS_PANEL_ADMIN`, via the `/options` lookup endpoint, without requiring any `_VIEW_ALL`/`_READ_ALL` grant. The endpoint returns only `{id, label, slug}` and can surface DRAFT entities.
- **REQ-9** Every write/destructive admin endpoint of an owner-scoped entity (update, soft/hard delete, restore, publish, visibility, featured, media, batch — including routes with no admin UI) enforces ownership (`isOwner`) for actors holding only the `_OWN` permission. Verified across all owner-scoped entities by the audit; accommodation already complies (§2.2) and serves as the reference pattern + regression baseline.

## 7. Acceptance Criteria (BDD)

```
AC-1  Given a HOST with ACCOMMODATION_VIEW_OWN (not _VIEW_ALL)
      When they GET /api/v1/admin/accommodations without ownerId
      Then the response contains only accommodations where ownerId == actor.id.

AC-2  Given the same HOST
      When they GET /api/v1/admin/accommodations?ownerId=<some-other-user>
      Then the server ignores the param and still returns only their own rows.

AC-3  Given a HOST
      When they open /accommodations in the admin app
      Then they are redirected to /me/accommodations and no platform-wide list is rendered.

AC-4  Given an ADMIN with ACCOMMODATION_VIEW_ALL
      When they GET /api/v1/admin/accommodations
      Then they receive the full unscoped list (no regression).

AC-5  Given a HOST after the seed change
      When they open /me/accommodations
      Then they see exactly their own accommodations (REQ-4 regression guard).

AC-6  Given the role-permission seed
      When the audit test runs
      Then no non-staff role holds a _VIEW_ALL/_READ_ALL grant unless it is in the
      documented allow-list with a rationale.

AC-7  Given an EDITOR (no ACCOMMODATION/DESTINATION _VIEW_ALL)
      When they open a relation selector while creating/editing a post or event
      Then the selector loads matches (including DRAFT) from /api/v1/admin/<entity>/options
      And the selector never calls a heavyweight admin list endpoint requiring _VIEW_ALL.

AC-8  Given a HOST with ACCOMMODATION_VIEW_OWN (not _VIEW_ALL)
      When they open the detail/view/edit (or any sub-tab) of THEIR OWN accommodation
      Then it loads with 200 (no regression from removing _VIEW_ALL).

AC-9  Given the same HOST
      When they GET /api/v1/admin/accommodations/:id for a PUBLIC accommodation owned by someone else
      Then they receive 403/404 (the admin detail of others' listings is not exposed,
      even for PUBLIC-visibility records).

AC-10 Given a HOST with only _OWN write permissions
      When they attempt update / softDelete / hardDelete / restore / publish / visibility /
      featured / media-delete on an accommodation owned by another user
      (via the API directly, no UI) Then every one returns FORBIDDEN and no mutation occurs.

AC-11 Given the audit (task 1)
      When it inspects every owner-scoped entity's write/destructive ops (incl. UI-less routes)
      Then each one is shown to enforce isOwner for _OWN-only actors, or is flagged as a gap to fix.
```

## 8. Open Questions

- **Q1 — EDITOR** ✅ RESOLVED (owner, 2026-05-28): EDITOR keeps full editorial visibility
  (`POST_VIEW_ALL`, `POST_VIEW_PRIVATE`, `EVENT_VIEW_PRIVATE`). A SUPER_ADMIN can narrow it
  per-user via direct permission overrides (existing model). Action: add a rationale comment
  in the seed; no permission change for EDITOR's editorial grants.
- **Q2 — CLIENT_MANAGER** ⏸️ DEFERRED (owner, 2026-05-28): the role is not used yet. Leave
  its grants as-is for now, flag as known debt, and address in a future spec when the role is
  activated. Removed from this spec's implementation scope (§11).
- **Q3 — Relation selectors (the EDITOR cross-entity-relation problem)** ✅ RESOLVED
  (owner, 2026-05-28): **Option A** — a dedicated lightweight lookup endpoint. Selectors
  must be able to surface DRAFT/unpublished entities, so the public-only Option C is
  insufficient. Design in §5.5.
  When an EDITOR creates/edits a post or event, the form's relation selectors (destination,
  owner, accommodation, etc.) currently call the **admin list endpoints** that require
  `_VIEW_ALL`/`_READ_ALL`:
  - `OwnerSelect` → `/api/v1/admin/users` (`apps/admin/src/components/selects/OwnerSelect.tsx:114`)
  - `DestinationSelect` → `/api/v1/admin/destinations` (`DestinationSelect.tsx:109-110`)
  - generic entity search → `/api/v1/admin/<entity>/search` (`lib/utils/entity-search.utils.ts:106`)

  So removing broad view permissions breaks the selectors, and granting `_VIEW_ALL` reopens
  the leak. Options (decision needed):
  - **Option A — Dedicated lookup endpoint.** New `GET /api/v1/admin/<entity>/options?q=`
    returning only `{id, label, slug}` for non-private records, gated by a light permission
    (or just `ACCESS_PANEL_ADMIN`, since it exposes only public-grade fields). Migrate all
    selectors to it. Nobody needs `_VIEW_ALL` for relations. *(Most correct; most work —
    one lookup route + selector migration.)*
  - **Option B — Keep `_VIEW_ALL` for EDITOR on related entities.** Zero new work, but
    reintroduces the exact exposure this spec closes. *(Not recommended.)*
  - **Option C — Point selectors at the PUBLIC endpoints.** Reuse `/api/v1/public/<entity>/list`
    (already exists for several entities), which returns only published/public records with
    public fields; detail viewing happens on the public web (per owner's suggestion). Cheaper
    than A, but selectors can't surface DRAFT/unpublished entities. *(Good if relations only
    ever target published entities.)*

  Decision: selectors DO need DRAFT entities → **Option A**. Option C rejected for that reason.

## 9. Risks

- **R-1** Removing `_VIEW_ALL` from a role that *also* depends on it for a different,
  legitimate surface could break that surface. Mitigation: REQ-4 + AC-5 regression guard;
  grep every consumer of each removed permission before removing.
- **R-2** Other entities may reuse the admin-endpoint-with-optional-ownerId pattern and
  leak the same way. Mitigation: the audit (task 1) must enumerate all such endpoints, not
  just accommodations.
- **R-3** `ownerId` forcing must handle entities whose ownership column isn't literally
  `ownerId` (e.g. `authorId`, `createdById`). Mitigation: per-entity ownership resolver.
- **R-4** SPEC-143 test-user matrix and existing tests assume current grants; updating the
  seed may shift fixtures. Mitigation: run the full suite, update fixtures in the same PR.

## 10. High-level task outline (not yet atomized)

1. **Audit** — two passes. (a) Read: programmatic scan of all roles × `_VIEW_ALL`/`_READ_ALL`/
   `_VIEW_PRIVATE`; enumerate every admin list/getById endpoint that accepts an optional owner
   filter. (b) Write: for every owner-scoped entity, verify each write/destructive op
   (update/softDelete/hardDelete/restore/publish/visibility/featured/media/**batch**) enforces
   `isOwner` for `_OWN`-only actors — **including API routes with no admin UI** (`/{id}/hard`,
   `batch`, `restore`). Output: decision table + ownership-enforcement matrix (entity × op).
2. **Schema** — add `_VIEW_OWN` permission(s) to `permission.enum.ts` + tests.
3. **Service** — forced owner-scoping in BOTH paths: `adminList` (force `ownerColumn = actor.id`) and `getById` via a new `_canAdminView` (VIEW_ALL→any, VIEW_OWN→isOwner only). Update `checkCanAdminList`; add the per-entity ownership resolver (§5.6). Update the `getById` route middleware to accept `_VIEW_ALL` OR `_VIEW_OWN`. Unit tests for the 3-way branch on both paths.
4. **Seed** — apply verdicts (remove HOST `_VIEW_ALL`, add `_VIEW_OWN`; document EDITOR rationale; CLIENT_MANAGER deferred — leave + flag as debt).
4b. **Lookup endpoints (Q3 → Option A)** — add `GET /api/v1/admin/<entity>/options` (id/label/slug, DRAFT-inclusive, `ACCESS_PANEL_ADMIN`-gated) for the entities used as relation targets; migrate `OwnerSelect`, `DestinationSelect`, generic entity-search, and entity-select fields to it.
5. **Front (defense-in-depth)** — `beforeLoad` guard on owner-scoped list routes → redirect to `/me/*`.
6. **Regression** — `/me/accommodations` works; staff unscoped works; integration tests for AC-1..AC-6.
7. **Docs** — record the permission model + the allow-list rationale.

## 11. Out of scope

- **CLIENT_MANAGER permission tightening** — deferred (§8 Q2). The role is unused; its
  latent `_VIEW_ALL`/`USER_READ_ALL` grants are documented as known debt for a future spec.
- The cosmetic frontend route-guard gaps on *other* unprotected routes (users views,
  settings/critical, /dev/icon-comparison) surfaced in the broader admin audit — those are
  tracked separately; this spec only adds the front guard needed for the owner-scoped fix.

## 12. Decision protocol (mandatory for implementation)

This rule **overrides any agent default** for the entire lifecycle of this spec — planning,
task atomization, and implementation:

> **In every single case — without exception — if a change or decision is not extremely
> clear-cut, if there is even the slightest ambiguity, or if there is more than one viable
> option, the implementer MUST stop and consult the owner (qazuor) before proceeding. No
> autonomous decisions. Silence is not approval.**

When in doubt: present the options with (1) what each does, (2) pros, (3) cons, (4) impact on
existing code; number them; recommend one with justification; then **wait for explicit
approval**.

Non-exhaustive list of points this explicitly governs:
- Which entities receive a `_VIEW_OWN` permission (and the exact permission names).
- The precise `_canAdminView` semantics for non-`PUBLIC` visibilities (PRIVATE/RESTRICTED).
- The ownership resolver shape and which entities get a descriptor (§5.6).
- Which routes receive the `beforeLoad` guard, and the redirect target.
- The `/options` endpoint payload shape, gating, and which entities get one.
- Any seed grant removal/addition (HOST, EDITOR rationale wording, etc.).
- **CLIENT_MANAGER is deferred — do not touch it at all without asking first.**
- Any borderline grant the audit (task 1) surfaces.
- Any deviation from this spec, however small.
