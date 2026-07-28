---
title: Multi-role capabilities — one account, several hats
linear: HOS-296
statusSource: linear
created: 2026-07-28
type: feature
areas:
  - auth
  - api
  - db
  - web
  - admin
---

# Multi-role capabilities — one account, several hats

## 1. Summary

Replace the single `users.role` enum column with a real many-to-many
user↔role relation, so one account (one email) can simultaneously be a
tourist, a host and a commerce owner. Permission resolution becomes a union
over the user's roles; role writes become "add a hat" instead of "replace the
hat"; the role-keyed gates in `apps/web`, `apps/mobile` and the API
middlewares are migrated to ask "does this user hold role X" rather than "is
this user's role X".

This is the capability axis only. The two neighbouring axes stay exactly as
they are.

## 2. Problem

A user is HOST **or** COMMERCE_OWNER, never both. `users.role`
(`packages/db/src/schemas/user/user.dbschema.ts:98`) is a single non-null
`role_enum` column with default `USER`. Three concrete consequences,
all observed in the 2026-07-24 production smoke:

1. **A registered host cannot add their restaurant.** The commerce lead
   approval path creates a *new* account; if the email already exists it
   collides, and the only way to "fix" it is to overwrite the user's role,
   destroying their host capability.
2. **A commerce owner silently loses their commerce hat.**
   `_assignHostRoleIfNeeded`
   (`packages/service-core/src/services/accommodation/accommodation.service.ts:1961-1985`)
   does `update(users, { role: HOST })` for any owner whose role is not in
   `PRIVILEGED_ROLES = {HOST, ADMIN, CLIENT_MANAGER, SUPER_ADMIN}`
   (declared at `:213-218`) when their accommodation goes `ACTIVE`. That set
   omits `COMMERCE_OWNER` — **and also `SPONSOR` and `EDITOR`**, so the same
   write destroys those roles too. It is wrapped in a `try/catch` that logs and
   swallows (1979-1984), so it fails silently in both directions. This is a
   live data-loss bug today, independent of this migration (see G-6 and R-4).
3. **Payments break.** The commerce charge must reach the user's MercadoPago
   account, which is keyed by email. Forcing a second email for the commerce
   hat means the money cannot go where it belongs. This is what blocked the
   commerce-billing smoke.

The data layer is already multi-role-ready: `accommodations.owner_id`,
`gastronomies.owner_id` and `experiences.owner_id` are three independent FKs
to `users.id`, so one user id can already own rows across all three verticals.
The blocker is entirely `users.role` and its downstream gates.

## 3. Goals

- **G-1** — A user holds a *set* of roles. Granting one never removes another.
- **G-2** — Effective permissions are the union over the held roles, then the
  existing per-user overrides: `(⋃ perms(role_i) ∪ grants) \ denies`.
- **G-3** — Every write that today assigns `users.role` becomes an additive
  grant, or an explicit, audited revoke. No write silently drops a hat.
- **G-4** — Commerce provisioning resolves an existing account by email and
  grants it the commerce hat, instead of unconditionally creating a new user.
- **G-5** — Every role-keyed read gate answers "does the user hold role X",
  across `apps/web`, `apps/api`, `apps/admin` and `apps/mobile`.
- **G-6** — Fix the destructive `_assignHostRoleIfNeeded` overwrite. It is a
  live bug and its fix is a precondition, not a side effect (see R-4).
- **G-7** — Audit trail: for each granted hat, when, why and by whom.

## 4. Non-goals

- **NG-1 — `partner` and `hostTrade` stay out.** Verified:
  `packages/db/src/schemas/partner/partner.dbschema.ts:20-72` and
  `packages/db/src/schemas/host-trade/host_trade.dbschema.ts:14-52` carry only
  audit FKs (`createdById`/`updatedById`/`deletedById`), no ownership FK to
  `users.id`, and no role of their own in `RoleEnum`. Multi-role does not
  enable them — the missing piece is a user↔entity ownership link that does
  not exist. Separate feature, separate issue.
- **NG-2 — `r_user_permission` is not touched.** It stays reserved for
  administrative exceptions. Capabilities are never modelled as grants (see
  §6.1 for why this was rejected).
- **NG-3 — Billing/entitlements are not touched.** `product_domain` already
  separates the accommodation and commerce domains (SPEC-239) and already
  supports N subscriptions per customer.
- **NG-4 — Roles remain a Postgres enum.** Turning roles into DB rows is
  HOS-120's explicit NG-1 and stays out here too. This spec changes the
  *cardinality* of the user↔role relation, not the nature of a role.
- **NG-5 — No new roles.** The 10 values in
  `packages/schemas/src/enums/role.enum.ts:17-29` are unchanged.

## 5. Current baseline

### 5.1 Model

| Thing | Where | Shape |
|---|---|---|
| `RoleEnum` | `packages/schemas/src/enums/role.enum.ts:17-29` | 10 values: `SUPER_ADMIN, ADMIN, CLIENT_MANAGER, EDITOR, HOST, COMMERCE_OWNER, SPONSOR, USER, GUEST, SYSTEM` |
| `role_enum` (PG) | `packages/db/src/schemas/enums.dbschema.ts:161` | `pgEnum` |
| `users.role` | `packages/db/src/schemas/user/user.dbschema.ts:98` | `notNull().default('USER')`, indexed alone and with `deletedAt` |
| `role_permission` | `packages/db/src/schemas/user/r_role_permission.dbschema.ts:7-16` | PK `(role, permission)` — **already supports N roles without any change** |
| `r_user_permission` | `packages/db/src/schemas/user/r_user_permission.dbschema.ts:15-29` | PK `(userId, permission)` + `effect` grant/deny |

### 5.2 Permission resolution — and its two shadow copies

The canonical resolver is `actorMiddleware`
(`apps/api/src/middlewares/actor.ts:125-214`): `userRole = user.role || USER`
(line 131), SUPER_ADMIN short-circuits to all permissions (154-163), otherwise
`getPermissionsForRole(userRole)`
(`apps/api/src/utils/role-permissions-cache.ts:38`, 10-min TTL cache) unioned
with grants and minus denies (174-181).

**There are two other, divergent resolvers** — this is the single biggest
under-estimate in the original issue write-up:

- `apps/web/src/lib/nav-gating.ts:128-137` (`isVisibleByRole`) approximates
  permissions from a **hand-maintained** `PERMISSION_ROLE_MAP` (lines 62-84)
  because Astro SSR only has `Astro.locals.user.role`. It ignores per-user
  grants and denies entirely.
- `apps/mobile/src/lib/auth/roles.ts:31-85` routes the whole mobile app into
  exactly **one** of `'(auth)' | '(host)' | '(tourist)'` via
  `resolveAuthGroup` (79-85), driven by a `HOST_ROLES` set (31-35). A
  mutually-exclusive navigator group is structurally incompatible with
  "host and commerce owner at once".

### 5.3 Role writes — ten sites, not two

| # | Site | Guard | Destructive? |
|---|---|---|---|
| 1 | `apps/api/src/lib/auth.ts:616` (signup hook) | new user | no |
| 2 | `apps/api/src/routes/auth/signup-as-host.ts:117` | fresh user | no |
| 3 | `apps/api/src/lib/commerce-ports.ts:86-89` | **none** | yes (see §5.4) |
| 4 | `accommodation.service.ts:1377-1382` (`createForOnboarding`) | `role === USER` exact | no — but therefore **never grants HOST to a COMMERCE_OWNER** |
| 5 | `accommodation.service.ts:1961-1985` (`_assignHostRoleIfNeeded`) | `PRIVILEGED_ROLES` (`:213-218`), which **excludes `COMMERCE_OWNER`, `SPONSOR` and `EDITOR`** | **YES — live data-loss bug, silently swallowed by a try/catch** |
| 6 | `apps/api/src/cron/jobs/archive-abandoned-drafts.job.ts:237-240` | `role === HOST` exact | demote only |
| 7 | `commerce-owner-provisioning.service.ts:269-275` | none | delegates to #3 |
| 8 | `apps/api/src/routes/user/admin/patch.ts:69` (+ `update.ts`) | `MANAGE_USERS` only, **no transition rule** | **YES, unconditional** |
| 9 | `apps/api/src/routes/user/admin/create.ts:49` | creation | no |
| 10 | `packages/seed/src/test-users/testUsers.seed.ts:545-549` | drift heal | yes, intentional |

The admin UI side is a single-select:
`apps/admin/src/features/users/config/sections/role-permissions.consolidated.ts:18-36`
(`FieldTypeEnum.SELECT`, `required: true`, options `Object.values(RoleEnum)`).

### 5.4 Commerce provisioning

`createCommerceOwnerCreateUserPort` (`apps/api/src/lib/commerce-ports.ts:60-128`)
calls `auth.api.signUpEmail` (65-69) with **no prior lookup of the email**, then
`.update(users).set({ role, emailVerified: true, mustChangePassword })` (86-89).
`CommerceOwnerProvisioningService`
(`packages/service-core/src/services/commerce/commerce-owner-provisioning.service.ts:198-317`)
passes a hard-coded `role: RoleEnum.COMMERCE_OWNER` (273).

When the email already exists, Better Auth's own duplicate check rejects the
signup, the service converts it to `INTERNAL_ERROR` (267-282), and
`CommerceLeadService.approveAndProvision`
(`packages/service-core/src/services/commerce/commerce-lead.service.ts:467-546`)
throws before marking the lead approved — so the lead is left pending, not
double-provisioned. **There is no recovery path**:
`CommerceLeadAdminUpdateInputSchema`
(`packages/schemas/src/entities/commerce-lead/commerce-lead.crud.schema.ts:48-55`)
exposes only `status, handledAt, handledById, adminNote, provisionedUserId` —
`email` is not editable, and no endpoint links a lead to an existing user. The
admin can only reject the lead.

### 5.5 Role reads

`apps/web/src/lib/account-roles.ts` is the chokepoint: it defines `isHostRole`
(39), `isCommerceOwnerRole` (69), `ROLES_WITH_ACCOMMODATIONS_NAV` (23),
`ROLES_WITH_COMMERCE_NAV` (59) and `resolveSubscriptionPlansPath` (90).

- `isHostRole` — **13 occurrences across 6 files** (confirmed): `account-roles.ts`
  (39, 81, 91), `nav-gating.ts` (22), `mi-cuenta/index.astro` (20, 54),
  `mi-cuenta/propiedades/index.astro` (26, 59), `mi-cuenta/host-dashboard.astro`
  (20, 41), `mi-cuenta/suscripcion/index.astro` (12, 55, 58).
- `isCommerceOwnerRole` — 4 hard walls:
  `mi-cuenta/comercio/index.astro:36-38`, `.../comercio/nuevo/[vertical].astro:44`,
  `.../comercio/nuevo/index.astro:27`, `.../comercio/[vertical]/[id]/editar.astro:41`.
- `resolveSubscriptionPlansPath` — 5 more call sites
  (`middleware-helpers.ts:382`, `suscriptores/checkout/{index,failure}.astro`,
  `mi-cuenta/addons/index.astro:136`, `SubscriptionDashboard.client.tsx:189,871`).

The project rule "never check roles directly, always `PermissionEnum`"
(`CLAUDE.md:413`, `CLAUDE.md:518`) is **violated in two live spots**:
`apps/api/src/middlewares/entitlement.ts:354-368,687` and
`apps/api/src/middlewares/owner-entitlement.ts:208-229,247,619-620`, both a
`STAFF_BILLING_BYPASS_ROLES` allow-list gating billing bypass off the raw role.
A third, latent violation lives in `apps/admin/src/hooks/use-auth-context.ts:48-59`
(`useHasRole`/`useHasAnyRole`, currently consumed only by test mocks).

The role travels as a scalar the whole way: Better Auth `additionalFields`
(`apps/api/src/lib/auth.ts:210-244`, `role: { type: 'string' }`) →
`actor.ts:131` → `GET /public/auth/me` (`apps/api/src/routes/auth/me.ts:26,43`)
→ `apps/web/src/lib/middleware-helpers.ts:452`, `apps/web/src/lib/auth-cache.ts:207`,
`apps/admin/src/lib/auth-session.ts:132`.

### 5.6 Avatar shortcut

`apps/web/src/lib/nav-avatar.ts` is shared by `UserMenu.client.tsx` (49, 268)
and `MobileMenu.client.tsx` (54, 236) — **no duplicated logic**.
`pickBusinessShortcut` (79-89) walks
`BUSINESS_SHORTCUT_CANDIDATE_IDS = ['hostDashboard', 'commerce']` (29) and
returns the **first** match only, documented at 68-74.

This was not left open: HOS-131 **OQ-4 is already resolved** — "el avatar
muestra un solo atajo de negocio, elegido por prioridad `[hostDashboard,
commerce]`". Multi-role makes that resolution obsolete, so this spec has to
re-open it deliberately rather than treat it as an unanswered question
(see OQ-1).

## 6. Proposed design

### 6.1 Why multi-role and not per-user grants

Granting the commerce capability as rows in `r_user_permission` was evaluated
and **rejected** (owner decision D2, 2026-07-25):

1. Every new commerce permission would have to be backfilled by hand to every
   affected user, with no guarantee of completeness.
2. It collapses two distinct semantics into one channel: "has this permission
   because they own a commerce" becomes indistinguishable from "an admin
   granted it by hand".

The three axes stay separate:

| Axis | Question | Home |
|---|---|---|
| **Capability** | which hats does the user wear | multi-role — this spec |
| **Exception** | what did an admin grant/revoke by hand | `r_user_permission` (exists, untouched) |
| **Entitlement** | what may they use for what they pay | billing (exists, `product_domain`-aware) |

### 6.2 Model — a `user_role` table, not an array column

```
user_role
  user_id      uuid    FK users.id ON DELETE CASCADE
  role         role_enum
  granted_at   timestamptz  NOT NULL DEFAULT now()
  granted_by   uuid    FK users.id  NULL   -- null = system/automatic
  grant_reason text    NULL               -- e.g. 'accommodation_activated', 'commerce_lead_HOS-nnn'
  PRIMARY KEY (user_id, role)
```

An array column on `users` would carry the set but not the story. The reason a
hat was granted is exactly what is missing today when a role gets silently
overwritten, and it is what makes a revoke reviewable. The PK also gives
idempotent "grant if absent" for free, which is what every write site in §5.3
actually wants.

Migration is trivial: one row per existing user, `role` copied from
`users.role`, `grant_reason = 'migrated_from_users_role'`.

**`users.role` is kept, as a derived "primary role"**, for the duration of the
migration — see §6.6. It is not the source of truth once this ships.

### 6.3 Permission resolution

`getPermissionsForRole({ role })` becomes `getPermissionsForRoles({ roles })`,
returning the union, cached on a stable key (sorted role list). The actor
formula generalises with no change in shape:

```
effectivePermissions = (⋃ perms(role) for role in roles ∪ grants) \ denies
```

SUPER_ADMIN keeps its short-circuit, now on "holds SUPER_ADMIN".

`Actor` (`packages/service-core/src/types/index.ts:66-72`) gains
`roles: readonly RoleEnum[]`. `role: RoleEnum` stays during the transition as
the derived primary (§6.6) so the ~27 test files in §5.9 and the two staff
bypass lists do not all have to change in the same PR.

**The two shadow resolvers must be dealt with explicitly**, not left to drift:

- `nav-gating.ts` — `PERMISSION_ROLE_MAP` is a hand-maintained approximation
  that already diverges from the real mapping. The right move is to stop
  approximating: have the session carry the resolved `permissions` array, and
  gate SSR nav on permissions directly. This is what HOS-131 asked for and the
  code never finished (see §6.5).
- `apps/mobile/src/lib/auth/roles.ts` — `resolveAuthGroup` must stop being a
  1-of-3 choice. Concretely: a user holding both hats needs either a group that
  contains both sections or an in-app switch. **This is a mobile-navigation
  redesign and is the largest single unknown in this spec** (see OQ-2).

### 6.4 Role writes become grants

| Site | Becomes |
|---|---|
| `commerce-ports.ts:86-89` | look up the user by email; if found, `grantRole(userId, COMMERCE_OWNER, reason)`; if not, create then grant. Never `.set({ role })`. |
| `accommodation.service.ts:1377-1382` | `grantRole(ownerId, HOST, 'accommodation_created')`, unconditional and idempotent. The `role === USER` guard disappears — that guard is precisely why a COMMERCE_OWNER never gets the host hat. |
| `accommodation.service.ts:1961-1985` | same grant. `PRIVILEGED_ROLES` stops being a write guard; it becomes irrelevant because granting is additive. **This is the G-6 bug fix.** |
| `archive-abandoned-drafts.job.ts:237-240` | `revokeRole(ownerId, HOST, 'last_accommodation_archived')`, only if held, and only when the user has no other reason to hold it. |
| `user/admin/patch.ts:69` | stops accepting a scalar `role`. Role changes move to dedicated `grant`/`revoke` endpoints so every change is audited. |
| `testUsers.seed.ts:545-549` | seeds the role set, still idempotent. |

Two primitives, in `service-core`, both idempotent, both writing the audit
columns:

```ts
grantRole({ userId, role, grantedBy, reason }): Promise<Result<void>>
revokeRole({ userId, role, revokedBy, reason }): Promise<Result<void>>
```

`revokeRole` must refuse to remove a user's last role (there is always at least
`USER`).

### 6.5 Read gates

`apps/web/src/lib/account-roles.ts` stays the chokepoint. `isHostRole(role)`
becomes `hasRole({ roles, role: HOST })`; the four `isCommerceOwnerRole` walls
become the same shape. Mechanically small, concentrated in one file plus its
callers.

**Decision the implementer must make and record**: HOS-131 asked to unify these
gates on `PermissionEnum` and the code never finished it — §5.5 shows gates
still keyed on role in `apps/web`, and two live `CLAUDE.md` violations in the
API middlewares. This spec's position: **finish the unification for the `apps/web`
nav/page gates** (they are about "can you see this section", which is exactly
what a permission expresses), and **leave the two staff billing-bypass
allow-lists on roles**, but move them behind a named predicate with a comment
explaining why they are a deliberate exception. Doing the nav gates on
permissions also removes the `PERMISSION_ROLE_MAP` shadow resolver (§6.3), so
these two are one job, not two.

### 6.6 Migration strategy — `users.role` as a derived primary

Ripping out `users.role` in one PR would touch all ten write sites, both shadow
resolvers, ~27 test files, the admin UI and the mobile app at once. Instead:

1. **Phase 1** — add `user_role`, backfill, add the grant/revoke primitives,
   dual-write (`users.role` keeps receiving the *primary* role). Nothing reads
   the new table yet. Ships alone, no behaviour change.
2. **Phase 2** — resolution reads `user_role`; `Actor.roles` is populated;
   `Actor.role` becomes derived (highest-privilege held role, by a documented
   precedence order). Write sites become grants. The G-6 bug dies here.
3. **Phase 3** — read gates migrate (web nav to permissions, mobile navigation,
   admin multi-select editor). Commerce provisioning gets its existing-user
   lookup.
4. **Phase 4** — drop the `users.role` column once nothing reads it. Separate
   PR, behind its own verification.

The precedence order used to derive the primary role must be written down in
Phase 2 and is itself a decision (OQ-3).

## 7. Data model / contracts

**Migration (structural carril, `packages/db/src/migrations/`)**: create
`user_role` per §6.2 plus an index on `(role)` for the "who holds this role"
admin query — note this replaces the `users_role_idx` usage pattern and is
what HOS-120's AC-5 impact preview ("N users hold this role") will need once
`GROUP BY users.role` stops being correct.

**Backfill**: a data-migration in `packages/seed/src/data-migrations/`
(`pnpm db:seed:make`) inserting one `user_role` row per existing user. Per the
seed dual-write rule this also needs the baseline updated so a fresh DB is
built correct.

**Schemas** (`@repo/schemas`): `UserRoleSchema` for the new relation;
`Actor` gains `roles`. `UserPatchInputSchema` drops `role`.

**Endpoints**: `POST /api/v1/admin/users/:id/roles` and
`DELETE /api/v1/admin/users/:id/roles/:role`, both gated on
`PermissionEnum.USER_UPDATE_ROLES` (the permission the current single-select is
already gated on), both writing the audit columns.

**Session**: Better Auth `additionalFields` (`apps/api/src/lib/auth.ts:210-244`)
gains the role set. Note the session payload is consumed in three places
(`middleware-helpers.ts:452`, `auth-cache.ts:207`, `auth-session.ts:132`) — all
three must accept the new shape before the API starts sending it.

## 8. UX / UI behavior

- **Account nav**: no mode switcher. HOS-131 (Done, PR #2267) already designed
  the menu so the groups coexist, each visible if the capability applies. A
  user with both hats sees both groups. No navigation redesign needed on web.
- **Avatar shortcut**: `pickBusinessShortcut` currently returns one. See OQ-1.
- **Admin user editor**: the single `SELECT`
  (`role-permissions.consolidated.ts:18-36`) becomes a multi-select showing,
  per held role, when it was granted and by whom.
- **Commerce lead approval**: when the lead email matches an existing account,
  the admin sees that it will grant the hat to that account rather than create
  one, and confirms.

## 9. Acceptance criteria

- **AC-1** — A user who is HOST and then has a commerce lead approved for the
  same email holds both HOST and COMMERCE_OWNER, and both nav groups appear.
- **AC-2** — A COMMERCE_OWNER who owns an accommodation that transitions to
  `ACTIVE` keeps COMMERCE_OWNER and gains HOST. Regression test pinned directly
  on `_assignHostRoleIfNeeded` (G-6).
- **AC-3** — Effective permissions equal `(⋃ perms(roles) ∪ grants) \ denies`;
  a deny still beats a grant from any role.
- **AC-4** — Approving a commerce lead whose email already belongs to a user
  succeeds and links the lead to that user, instead of failing with a
  duplicate-email `INTERNAL_ERROR`.
- **AC-5** — `revokeRole` cannot remove a user's last role.
- **AC-6** — Every grant and revoke records `granted_by` and `grant_reason`.
- **AC-7** — No code path writes `users.role` as a scalar replacement.
  Enforceable as a static guard test, in the style of
  `apps/web/test/static-guards/`.
- **AC-8** — Commerce billing charges reach the MercadoPago account of the same
  email the user signs in with (the original driver of this issue).
- **AC-9** — The mobile app does not strand a dual-hat user in one navigator
  group (shape depends on OQ-2).

## 10. Risks

- **R-1 — Privilege escalation via the union.** A user accumulating hats
  accumulates permissions. `revokeRole` and the audit trail are the mitigation;
  the admin needs to *see* the set to manage it, which is why the multi-select
  editor is in scope rather than deferred.
- **R-2 — The two shadow resolvers drift further.** `nav-gating.ts` and
  `apps/mobile/src/lib/auth/roles.ts` do not use the canonical formula today.
  Migrating only the API resolver would ship a system where the API and the UI
  disagree about who can do what. Both are in scope (§6.3).
- **R-3 — Mobile is a redesign, not a refactor.** `resolveAuthGroup` picks one
  of three navigator groups. This is the item most likely to expand the spec;
  it may deserve its own child issue (OQ-2).
- **R-4 — The G-6 bug is live now.** `_assignHostRoleIfNeeded` is destroying
  `COMMERCE_OWNER` roles in production today, and this spec's Phase 2 is where
  it dies. If the migration slips, that bug must be fixed on its own regardless
  — it should not wait behind a multi-phase migration.
- **R-5 — Session shape change.** The role set has to reach three consumers
  that each parse the session independently. Rolling those out before the API
  sends the new field is the safe order.
- **R-6 — HOS-120 interaction.** Its AC-5 impact preview assumes
  `GROUP BY users.role`. Whichever ships second has to adapt.

## 11. Open questions

- **OQ-1 — Avatar shortcut with several business hats.** HOS-131 OQ-4 resolved
  this to "one shortcut, priority `[hostDashboard, commerce]`"
  (`nav-avatar.ts:79-89`), a decision taken *because* only one hat was possible.
  Multi-role invalidates the premise. Options: keep one by priority (cheapest,
  but a commerce owner who is also a host can never reach commerce from the
  avatar), show one per held capability, or show a neutral "Mis negocios" entry
  that opens a chooser. **Owner decision.**
- **OQ-2 — Mobile navigation.** Does `apps/mobile` get a combined group, an
  in-app switch, or is it explicitly deferred to a child issue with the current
  1-of-3 behaviour preserved (a dual-hat user lands in `(host)`)? **Owner
  decision**, and it materially changes the size of this spec.
- **OQ-3 — Primary-role precedence.** During Phase 2/3, `Actor.role` is derived
  from the set. What is the order? A documented list
  (`SUPER_ADMIN > ADMIN > CLIENT_MANAGER > EDITOR > HOST > COMMERCE_OWNER >
  SPONSOR > USER > GUEST`) is the obvious candidate, but it needs to be
  confirmed before anything depends on it.
- **OQ-4 — Automatic revoke.** `archive-abandoned-drafts` demotes HOST→USER
  when the last accommodation is archived. With several hats, should any
  automatic revoke exist at all, or should hats only ever be removed by an
  admin? Automatic revocation is what makes hats feel unstable.

## 12. Implementation notes

- `role_permission` needs **no schema change**. Its PK `(role, permission)`
  already supports N roles; a new commerce permission is one row inherited by
  everyone holding the hat. Zero backfill. This is the strongest argument for
  the multi-role route over per-user grants.
- Ownership is already multi-role-ready at the entity layer (§2). Do not
  redesign ownership.
- `getPermissionsForRole`'s cache (`role-permissions-cache.ts:38`, 10-min TTL)
  keys on a single role. Keying on a sorted role list keeps the cache useful;
  keying on `userId` would not.
- The ~27 test files asserting single-role behaviour are listed in the
  exploration attached to this spec's Linear issue. `roleAssignment.test.ts`,
  `createForOnboarding.test.ts`, `ownerPromotion.service.test.ts` and
  `commerce-owner-provisioning.service.test.ts` are the ones that encode the
  destructive semantics directly and will need rewriting, not just adapting.
- Do **not** change `role_enum` or add role values in this work.

## 13. Linear

Canonical tracking:
HOS-296
