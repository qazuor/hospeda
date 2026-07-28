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
   swallows (1980-1985), so it fails silently in both directions. This is a
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

### 5.2 Permission resolution — and its two alternate implementations

The canonical resolver lives in `actorMiddleware`
(`apps/api/src/middlewares/actor.ts`, function starts at :62; the
authenticated-user branch described here is :125-214): `userRole =
user.role || USER` (line 131), SUPER_ADMIN short-circuits to all permissions
(154-163), otherwise `getPermissionsForRole(userRole)`
(`apps/api/src/utils/role-permissions-cache.ts:38`, 10-min TTL cache) unioned
with grants and minus denies (174-181).

**There are two other resolvers** — the single biggest under-estimate in the
original issue write-up. Neither is accidental drift; each is a recorded
decision, and this spec has to treat them as such:

- `apps/web/src/lib/nav-gating.ts:128-137` (`isVisibleByRole`) approximates
  permissions from a **hand-maintained** `PERMISSION_ROLE_MAP` (62-84),
  ignoring per-user grants and denies. **This is HOS-131 decision D-4, and it
  was deliberate**: `.specs/HOS-131-account-menu-ia/spec.md:194-213` states
  that resolving effective permissions server-side needs an uncached
  `/auth/me` round-trip per `/mi-cuenta` render and marks it *"Descartado por
  costo"*, naming a future server-side auth cache (SPEC-111 §4.3) as the
  precondition for exact SSR evaluation. The file's own header repeats it
  (`nav-gating.ts:1-24`). It is finished work under a closed decision, not an
  unfinished migration.
  <br>Separately — and this IS a real bug, worth its own issue: the map has
  already drifted from the seeded truth. `nav-gating.ts:63-69` grants
  `ACCOMMODATION_CREATE` to `[HOST, ADMIN, SUPER_ADMIN, CLIENT_MANAGER,
  EDITOR]`, while `packages/seed/src/required/rolePermissions.seed.ts` seeds it
  only for `SUPER_ADMIN`/`ADMIN`/`HOST`; `COMMERCE_EDIT_OWN` is mapped to three
  roles but seeded for `COMMERCE_OWNER` alone.
- `apps/mobile/src/lib/auth/roles.ts:31-85` routes the whole mobile app into
  exactly **one** of `'(auth)' | '(host)' | '(tourist)'` via `resolveAuthGroup`
  (79-85), driven by a `HOST_ROLES` set (31-35). A mutually-exclusive navigator
  group is structurally incompatible with "host and commerce owner at once".
  **This too is a locked owner decision**: the file header (`:9-18`) reads
  *"Owner decision (SPEC-243, locked) … DIVERGENCE from
  `apps/web/src/lib/account-roles.ts` … Do NOT 'fix' this to match web without
  an explicit owner decision."* Changing it means re-opening SPEC-243.

### 5.3 Role writes — eleven sites, not two

| # | Site | Guard | Destructive? |
|---|---|---|---|
| 1 | `apps/api/src/lib/auth.ts:616` (signup hook) | new user | no |
| 2 | `apps/api/src/routes/auth/signup-as-host.ts:117` | fresh user | no |
| 3 | `apps/api/src/lib/commerce-ports.ts:86-89` | **none** | yes (see §5.4) |
| 4 | `accommodation.service.ts:1377-1382` (`createForOnboarding`) | `role === USER` exact | no — but therefore **never grants HOST to a COMMERCE_OWNER** |
| 5 | `accommodation.service.ts:1961-1985` (`_assignHostRoleIfNeeded`) | `PRIVILEGED_ROLES` (`:213-218`), which **excludes `COMMERCE_OWNER`, `SPONSOR` and `EDITOR`** | **YES — live data-loss bug, silently swallowed by a try/catch** |
| 6 | `apps/api/src/cron/jobs/archive-abandoned-drafts.job.ts:238-242` | `role === HOST` exact | demote only |
| 7 | `commerce-owner-provisioning.service.ts:269-275` | none | delegates to #3 |
| 8 | `apps/api/src/routes/user/admin/patch.ts:69` (+ `update.ts`) | `MANAGE_USERS` only, **no transition rule** | **YES, unconditional** |
| 9 | `apps/api/src/routes/user/admin/create.ts:49` | creation | no |
| 10 | `packages/seed/src/test-users/testUsers.seed.ts:545-549` | drift heal | yes, intentional |
| 11 | `packages/service-core/src/services/user/user.service.ts:382-408` (`UserService.assignRole`) | `canAssignRole(actor)` + same-role no-op | **YES.** Currently **dead code** — no production caller, only `assignRole.test.ts`. It must still be migrated, or AC-7's static guard will miss it the day someone wires a route to it. |

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
  `mi-cuenta/comercio/index.astro:37`, `.../comercio/nuevo/[vertical].astro:44`,
  `.../comercio/nuevo/index.astro:27`, `.../comercio/[vertical]/[id]/editar.astro:41`.
- `resolveSubscriptionPlansPath` — 5 call sites:
  `suscriptores/checkout/index.astro:31`, `suscriptores/checkout/failure.astro:61`,
  `mi-cuenta/addons/index.astro:136`, `SubscriptionDashboard.client.tsx:189` and
  `:871`. (`middleware-helpers.ts:382` mentions it in a comment only — not a
  call site.)

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

### 6.2 Model — a `user_role` table plus an append-only audit

```
user_role                                  -- the LIVE set of hats
  user_id      uuid    FK users.id ON DELETE CASCADE
  role         role_enum
  granted_at   timestamptz  NOT NULL DEFAULT now()
  granted_by   uuid    FK users.id  NULL   -- null = system/automatic
  grant_reason text     NULL               -- 'accommodation_activated', 'commerce_lead_HOS-nnn', ...
  PRIMARY KEY (user_id, role)

user_role_audit                            -- append-only history
  id           uuid    PK
  user_id      uuid    FK users.id ON DELETE SET NULL   -- survives a hard delete
  role         role_enum
  action       role_grant_action_enum NOT NULL   -- 'grant' | 'revoke' (typed enum, like r_user_permission.effect)
  at           timestamptz NOT NULL DEFAULT now()
  by           uuid    FK users.id NULL     -- null = system/automatic
  reason       text    NULL
```

`user_role.user_id` cascades on delete because the live set is meaningless
without its user. `user_role_audit.user_id` deliberately does NOT: the audit
exists to outlive the rows it describes, and a hard delete (rare here — the
project soft-deletes by default — but reachable via an erasure request) must
not be able to either block on it or silently erase the history.

An array column on `users` would carry the set but not the story. The reason a
hat was granted is exactly what is missing today when a role gets silently
overwritten. The PK on `user_role` also gives idempotent "grant if absent" for
free, which is what every write site in §5.3 actually wants.

**The audit table is not optional.** `revokeRole` removes the `user_role` row,
so with only that table the who/why of a revoke would vanish with the row it
describes — G-7 and AC-6 would be unsatisfiable for exactly the direction that
matters most. Both primitives write to `user_role_audit` on every call.

The alternative — soft-revoke with `revoked_at IS NULL` meaning "held" — was
considered and rejected: it forces a partial unique index instead of a plain
PK, and it makes every read of the live set carry a predicate that is easy to
forget. A small live table plus an append-only log is the cheaper shape.

#### Backfill is NOT a straight copy

One row per existing user copied from `users.role`
(`grant_reason = 'migrated_from_users_role'`) is the starting point, but it is
not sufficient: §2 documents that `_assignHostRoleIfNeeded` **has already been
destroying `COMMERCE_OWNER`/`SPONSOR`/`EDITOR` roles in production**. Copying
the current scalar copies that damage forward into the new model and makes it
permanent.

The backfill therefore needs a second, reconciliation pass that re-derives hats
from ownership rows: a user id appearing in `gastronomies.owner_id` or
`experiences.owner_id` gets `COMMERCE_OWNER`; one appearing in
`accommodations.owner_id` gets `HOST`
(`grant_reason = 'reconciled_from_ownership'`).

**The ownership query must be filtered, or it does fresh damage of its own.**
Two filters, both mandatory:

- `deletedAt IS NULL`. All three tables soft-delete and all three carry an
  `(ownerId, deletedAt)` composite index precisely for this
  (`accommodation.dbschema.ts:127,179`, `gastronomy.dbschema.ts:97,116`,
  `experiences.dbschema.ts:119,139`). Without it, a user whose only listing was
  deleted years ago is handed a hat they should not have.
- `lifecycleState != ARCHIVED` on accommodations. This one is the subtle one:
  `archive-abandoned-drafts.job.ts:225-242` demotes an owner HOST→USER when
  their last accommodation is archived, and **archiving does not soft-delete
  the row** — `owner_id` and `deletedAt IS NULL` both survive. An unfiltered
  reconciliation would therefore re-grant HOST to every host that cron has
  legitimately demoted, reversing an intentional revoke. Mirror the cron's own
  predicate (`:228-232`).

Staff accounts (`ADMIN`, `SUPER_ADMIN`, `CLIENT_MANAGER`) that own a listing —
QA and demo accounts do — will be granted `HOST` by this pass. That is
harmless (their existing permissions are a superset) but it adds noise to the
"who holds this role" admin view, so the pass should exclude them explicitly
rather than leave it to be discovered.

Users whose reconciled set differs from their stored `users.role` are the
population the G-6 bug already hit — that count belongs in the migration's
output (as a structured log field, so AC-10 is checkable mechanically rather
than eyeballed) so the damage is measured, not assumed.

Roles with no ownership signal (`SPONSOR`, `EDITOR`) cannot be reconstructed
this way. If any user lost one, it is unrecoverable from data alone and needs a
manual admin pass; the migration should list the candidates rather than
pretending they are fine.

**`users.role` is kept and kept CURRENT** — see §6.6. It stops being the source
of truth, but it does not stop being accurate.

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
the derived primary (§6.6) so the ~27 test files in §12 and the two staff
bypass lists do not all have to change in the same PR.

**The two other resolvers must be dealt with explicitly.** Both sit on closed
decisions (§5.2), so the move here is the smallest one that makes them
multi-role-correct — not a re-architecture:

- `nav-gating.ts` — `isVisibleByRole(permission, role)` becomes
  `isVisibleByRoles(permission, roles)`: visible if **any** held role appears in
  `PERMISSION_ROLE_MAP[permission]`. Mechanical, one function.
  **Do NOT propose carrying a resolved `permissions` array in the session as
  part of this spec.** HOS-131 D-4 rejected exactly that on cost grounds
  (`.specs/HOS-131-account-menu-ia/spec.md:194-213`), and its own stated
  precondition — a server-side auth cache in web, SPEC-111 §4.3 — still does
  not exist. Reversing D-4 is a separate owner decision with its own cost
  argument, not a side effect of multi-role. The drift bug in the map (§5.2) is
  likewise its own issue and should be filed separately; it is wrong today,
  independent of how many roles a user has.
- `apps/mobile/src/lib/auth/roles.ts` — `resolveAuthGroup` returns one of three
  navigator groups, which cannot express two hats. There is no small change
  here: a dual-hat user needs either a group containing both sections or an
  in-app switch. **This is a mobile-navigation redesign, it reverses the locked
  SPEC-243 decision, and it is the largest single unknown in this spec**
  (see OQ-2 and R-3).

### 6.4 Role writes become grants

| Site | Becomes |
|---|---|
| `commerce-ports.ts:86-89` | `grantRole(userId, COMMERCE_OWNER, reason)` instead of `.set({ role })` — Phase 1. The **existing-user lookup by email** is a separate change that ships in Phase 3 with its admin confirmation UI (§6.6); Phase 1 only stops the write from being destructive. |
| `accommodation.service.ts:1377-1382` | `grantRole(ownerId, HOST, 'accommodation_created')`, unconditional and idempotent. The `role === USER` guard disappears — that guard is precisely why a COMMERCE_OWNER never gets the host hat. |
| `accommodation.service.ts:1961-1985` | same grant. `PRIVILEGED_ROLES` stops being a write guard; it becomes irrelevant because granting is additive. **This is the G-6 bug fix.** |
| `archive-abandoned-drafts.job.ts:238-242` | `revokeRole(ownerId, HOST, 'last_accommodation_archived')`, only if held, and only when the user has no other reason to hold it. |
| `user/admin/patch.ts:69` | stops accepting a scalar `role`. Role changes move to dedicated `grant`/`revoke` endpoints so every change is audited. The new endpoints must ship **before** the field is removed, or admins lose the ability entirely for a release. |
| `user.service.ts:382-408` (`assignRole`) | delegates to `grantRole`. Dead code today, but it must not survive as a second write path. |
| `testUsers.seed.ts:545-549` | seeds the role set, still idempotent. |

The four sites not listed above (`auth.ts:616`, `signup-as-host.ts:117`,
`commerce-owner-provisioning.service.ts:269-275`, `user/admin/create.ts:49`)
are all "brand-new user, assign its first role" and become a plain
`grantRole(newUserId, initialRole, 'signup' | 'admin_create')`. They are
non-destructive today and stay non-destructive; they are listed in §5.3 so the
AC-7 static guard covers all eleven, not so that each needs a design.

Two primitives, in `service-core`, both idempotent:

```ts
grantRole({ userId, role, grantedBy, reason }): Promise<Result<void>>
revokeRole({ userId, role, revokedBy, reason }): Promise<Result<void>>
```

Each call, in one transaction, does four things:

0. `SELECT ... FOR UPDATE` the `users` row,
1. upsert / delete the `user_role` row,
2. append a `user_role_audit` row,
3. **recompute and write `users.role`** to the derived primary (§6.6).

Step 0 is not optional. The `user_role` PK is `(user_id, role)`, so two
concurrent grants of *different* roles to the *same* user — the accommodation
activation hook granting `HOST` while a commerce-lead approval grants
`COMMERCE_OWNER` to the same owner — touch different rows and are **not**
serialized by Postgres. Each would read the role set before the other commits
and recompute a `users.role` from a stale view, which is exactly the invariant
AC-11 promises. Locking the `users` row serializes the read-recompute-write.

Step 3 is what keeps the scalar column honest while anything still reads it,
and it is the ONLY code path allowed to write `users.role` — see AC-7.

**Step 3 needs the precedence order of OQ-3 from the very first call**, so
OQ-3 is a **blocking precondition of Phase 1**, not a Phase-2 question. It is
listed under Open questions because it needs an owner's confirmation, not
because it can wait.

`revokeRole` must refuse to remove a user's last role (there is always at least
`USER`). This invariant lives in the service layer; a DB-level backstop would
belong in the extras carril, and is deliberately deferred (see R-7).

### 6.5 Read gates

`apps/web/src/lib/account-roles.ts` stays the chokepoint. `isHostRole(role)`
becomes `hasRole({ roles, role: HOST })`; the four `isCommerceOwnerRole` walls
become the same shape. Mechanically small, concentrated in one file plus its
callers.

**On the `PermissionEnum` unification HOS-131 started**: `nav-gating.ts` already
declares every nav item's `requiredPermission` and is the finished D-4 design;
what remains is that `account-roles.ts`'s predicates and the four
`isCommerceOwnerRole` page walls never migrated onto it (the file header calls
them "kept for now; existing consumers migrate in a later HOS-131 task").

This spec's position: **migrate those page gates onto the nav-gating predicates**,
so `apps/web` has one gating mechanism instead of two, and **leave the two staff
billing-bypass allow-lists on roles** (`entitlement.ts:354-368`,
`owner-entitlement.ts:208-229`) — but behind a named predicate with a comment
saying why they are a deliberate exception to `CLAUDE.md`'s rule. Those two are
"is this person staff", which is a role question, not a capability question.

This does NOT mean SSR starts evaluating exact permissions — see §6.3 on why
D-4 stands.

### 6.6 Migration strategy — writes move first, reads follow

Ripping out `users.role` in one PR would touch all eleven write sites, both
alternate resolvers, ~27 test files, the admin UI and the mobile app at once.
The phases below are ordered by one rule: **`user_role` must never be able to
fall behind `users.role`, not even for one release window.** That means the
write sites migrate in Phase 1, not Phase 2.

1. **Phase 1 — writes.** Add `user_role` + `user_role_audit`, run the backfill
   and reconciliation (§6.2), add `grantRole`/`revokeRole`, and **point all
   eleven write sites at them**. The primitives write both tables *and*
   recompute `users.role`, so the two representations are consistent from the
   first grant onward. Nothing reads `user_role` yet. No behaviour change
   except the G-6 fix, which lands here because it is a write-site change
   (`_assignHostRoleIfNeeded` becomes an additive grant).
2. **Phase 2 — resolution.** `getPermissionsForRoles` and `Actor.roles`.
   `Actor.role` becomes derived from the set, by the precedence order of OQ-3.
   `users.role` stays current (Phase 1 guarantees it), which is what keeps the
   still-unmigrated raw readers correct — notably `resolveOwnerRole`
   (`apps/api/src/middlewares/owner-entitlement.ts:219-229`), which selects the
   column directly from the DB rather than going through `Actor`.
3. **Phase 3 — read gates.** `apps/web` nav gates, the admin multi-select
   editor, and the commerce provisioning existing-user lookup (G-4 ships here,
   because it needs `grantRole` from Phase 1 *and* the admin confirmation UI).
   Mobile navigation is here only if OQ-2 is answered in scope.
4. **Phase 4 — retire the column.** Migrate the last raw readers of
   `users.role` (the two staff bypass lists, `resolveOwnerRole`) onto
   `Actor.roles`, then drop the column. Separate PR, its own verification.

An earlier draft of this spec put the write sites in Phase 2 and called Phase 1
"dual-write". That was wrong: with the writes still going only to `users.role`,
every role change between the two releases would have been invisible to
`user_role` and silently lost at cutover — reproducing the exact class of
silent role loss (G-6) this spec exists to end. The ordering above is the fix.

The precedence order used to derive the primary role must be written down
before anything depends on it, and is itself a decision (OQ-3).

## 7. Data model / contracts

**Migration (structural carril, `packages/db/src/migrations/`)**: create
`user_role` and `user_role_audit` per §6.2, plus an index on `user_role(role)`
for the "who holds this role" admin query. That query replaces the
`users_role_idx` usage pattern and is what HOS-120's AC-5 impact preview
("N users hold this role",
`.specs/HOS-120-admin-editable-role-permissions/spec.md:224`) will need
once `GROUP BY users.role` stops being correct. Note the existing composite
`users_role_deletedAt_idx` is soft-delete-aware; the `user_role` equivalent
needs a join to `users` to exclude soft-deleted accounts — cheap, but it has to
be stated or the admin count will silently include deleted users.

`GUEST` and `SYSTEM` are part of `RoleEnum` but are not capabilities a person
accumulates. The backfill copies them like any other value; nothing grants or
revokes them at runtime.

**Backfill**: a data-migration in `packages/seed/src/data-migrations/`
(`pnpm db:seed:make`) doing the copy + reconciliation of §6.2. Per the seed
dual-write rule the baseline must also be updated so a fresh DB is built
correct — concretely that means the normal user-seeding code writes `user_role`
rows too, not that a JSON fixture changes (this is a computed backfill over
live data, not a curated catalog row, which is the case that rule usually
addresses).

**Schemas** (`@repo/schemas`): `UserRoleSchema` for the new relation;
`Actor` gains `roles`. `UserPatchInputSchema` drops `role`.

**Endpoints**: `POST /api/v1/admin/users/:id/roles` and
`DELETE /api/v1/admin/users/:id/roles/:role`, both gated on
`PermissionEnum.USER_UPDATE_ROLES` (the permission the current single-select is
already gated on), both writing the audit row. **These ship in Phase 1**, in
the same release that drops the scalar `role` from the admin PATCH — see R-8.

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
- **AC-6** — Every grant AND every revoke leaves a `user_role_audit` row
  carrying `action`, `by` and `reason`. Revoking then re-granting a hat leaves
  three rows, in order.
- **AC-7** — `grantRole`/`revokeRole` are the ONLY code paths that write
  `users.role`. Enforceable as a static guard test, in the style of
  `apps/web/test/static-guards/`, allow-listing exactly that one module.
- **AC-10** — After the backfill, a user who owns a gastronomy or experience
  holds `COMMERCE_OWNER` even if their stored `users.role` said `HOST` — i.e.
  the reconciliation pass repaired the damage the G-6 bug already did, and the
  migration reports how many users it touched.
- **AC-11** — Between Phase 1 and Phase 2, `users.role` and the `user_role` set
  never disagree about the primary role. Testable by exercising each of the
  eleven write sites and asserting both representations afterwards.
- **AC-8** — Commerce billing charges reach the MercadoPago account of the same
  email the user signs in with (the original driver of this issue).
- **AC-9** — The mobile app does not strand a dual-hat user in one navigator
  group (shape depends on OQ-2).

## 10. Risks

- **R-1 — Privilege escalation via the union.** A user accumulating hats
  accumulates permissions. `revokeRole` and the audit trail are the mitigation;
  the admin needs to *see* the set to manage it, which is why the multi-select
  editor is in scope rather than deferred.
- **R-2 — The two alternate resolvers drift further.** `nav-gating.ts` and
  `apps/mobile/src/lib/auth/roles.ts` do not use the canonical formula.
  Migrating only the API resolver would ship a system where the API and the UI
  disagree about who can do what. Both are in scope (§6.3). Note the web one is
  *already* wrong today, independent of this spec (§5.2) — file that separately
  so it does not ride on a multi-phase migration.
- **R-3 — Mobile is a redesign that reverses a locked decision.**
  `resolveAuthGroup` picks one of three navigator groups, and that mapping is
  SPEC-243, explicitly marked locked in the source. This is the item most
  likely to expand the spec; it probably deserves its own child issue (OQ-2).
- **R-7 — The "last role" invariant is app-layer only.** §6.4 enforces it in
  the service. A DB-level backstop (extras carril CHECK/trigger) is deferred:
  the primitives are the single write path per AC-7, so the invariant has one
  place to fail. If AC-7's static guard is ever relaxed, this needs revisiting.
- **R-8 — The admin loses the role editor between Phase 1 and Phase 3.**
  Phase 1 drops the scalar `role` from `PATCH /admin/users/:id`, but the
  multi-select editor that replaces it is Phase 3. So the grant/revoke
  **endpoints must ship in Phase 1**, and the existing single-select UI must be
  re-pointed at them in the same phase — otherwise changing a role means a raw
  API call for two whole phases. Either accept that explicitly, or move the
  minimal UI change into Phase 1. This is ordering, not design, and it is
  exactly the kind of thing discovered in production.
- **R-4 — The G-6 bug is live now.** `_assignHostRoleIfNeeded` is destroying
  `COMMERCE_OWNER`, `SPONSOR` and `EDITOR` roles in production today. It dies
  in **Phase 1**, because turning that write into a grant is a write-site
  change. If even Phase 1 slips, the bug must be fixed on its own regardless —
  it should not wait behind a multi-phase migration.
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
- **OQ-2 — Mobile navigation, which means re-opening SPEC-243.** Does
  `apps/mobile` get a combined group, an in-app switch, or is it explicitly
  deferred to a child issue with the current 1-of-3 behaviour preserved (a
  dual-hat user lands in `(host)`)? Note this is not a fresh question: the
  current mapping is a **locked** owner decision (SPEC-243), stated as such in
  `apps/mobile/src/lib/auth/roles.ts:9-18` with an explicit "do not fix this
  without an owner decision". **Owner decision**, and it materially changes the
  size of this spec.
- **OQ-3 — Primary-role precedence. BLOCKS PHASE 1.** `users.role` is
  recomputed from the role set on every `grantRole`/`revokeRole` call (§6.4
  step 3), so this order is needed from the first call of the first phase, not
  from Phase 2. Proposed, and needing only confirmation:
  `SUPER_ADMIN > ADMIN > CLIENT_MANAGER > EDITOR > HOST > COMMERCE_OWNER >
  SPONSOR > USER > GUEST`. `SYSTEM` is deliberately absent — it is not a
  capability a person accumulates (§7) and no runtime path grants it. If the
  owner wants a different order, say so before Phase 1 starts; changing it
  afterwards rewrites every `users.role` in the table.
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
- Roughly 27 test files assert single-role behaviour. The ones that encode the
  destructive semantics directly, and so need rewriting rather than adapting:
  `packages/service-core/test/services/accommodation/roleAssignment.test.ts`,
  `.../accommodation/createForOnboarding.test.ts`,
  `.../commerce/commerce-owner-provisioning.service.test.ts`,
  `packages/service-core/test/services/user/assignRole.test.ts` and
  `packages/seed/test/test-users/hostPromotion.test.ts`.
  <br>**Not** `ownerPromotion.service.test.ts` — despite the name,
  `packages/service-core/src/services/owner-promotion/` is the promotional-deals
  feature (marketing offers on accommodations) and contains no role logic at
  all. `owner-promotion` ≠ "promote a user to HOST"; an earlier draft of this
  spec got that wrong.
- Do **not** change `role_enum` or add role values in this work.
- Rollback: Phases 1-3 are additive at the schema level, so rolling back means
  reverting code — the `user_role` tables can stay. Only Phase 4 (dropping
  `users.role`) is one-way, which is why it is a separate PR with its own
  verification.

## 13. Linear

Canonical tracking:
HOS-296
