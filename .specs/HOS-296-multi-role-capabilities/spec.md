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
  # no `area-mobile` label exists in Linear, but apps/mobile IS in scope — see §6.7
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

**Done as a single cut, not a phased migration.** `users.role` is dropped in
the same migration that introduces `user_role` — no transitional period, no
derived "primary role", no dual representation. That is only safe because
Hospeda is pre-launch with no real users, which is a time-boxed precondition,
not a permanent property. See §6.2 for what that removes and R-7 for what
happens if it stops being true.

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
- **G-8** — `users.role` stops existing. No compatibility shim, no derived
  scalar — the column and every read of it are gone when this ships.

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
| 11 | `packages/service-core/src/services/user/user.service.ts:382-408` (`UserService.assignRole`) | `canAssignRole(actor)` + same-role no-op | **YES.** Currently **dead code** — no production caller, only `assignRole.test.ts`. It must still be migrated — the compiler will surface it once `Actor.role` is gone. |

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

### 6.2 Why a single cut, and why the window is now

**`users.role` is dropped in the same migration that adds `user_role`.** There
is no transitional period, no derived "primary role", no dual representation.

An earlier draft of this spec proposed a four-phase migration that kept
`users.role` alive and in sync while the read sites moved over. That design was
correct for a live system and wrong for this one. Every piece of it existed to
protect data that does not exist yet:

| Machinery the phased plan needed | What it protected against | Needed here? |
|---|---|---|
| A precedence order to derive `users.role` from the set | legacy readers seeing a stale scalar | **no** — no scalar survives |
| `SELECT ... FOR UPDATE` + recompute on every grant | two concurrent grants racing on the derived value | no |
| A reconciliation pass with `deletedAt` / `ARCHIVED` / staff filters | repairing the damage G-6 already did to real accounts | no — see §6.6 |
| "Phase N must not lose writes" invariants | role changes vanishing at cutover | no |
| Four separately-shipped phases with soak time | blast radius against paying customers | no |

**This is not a hypothetical simplification.** Three of the four adversarial
review rounds this spec went through were spent finding and fixing defects in
that transitional scaffolding — a phase plan that silently dropped writes, a
Phase 1 that depended on an unresolved question, a missing row lock, a staff
exclusion list copied from the wrong set. The hardest and most defect-prone part
of the plan was the part that only existed for backward compatibility with a
column holding no production data.

**The precondition is explicit and time-boxed**: Hospeda is pre-launch and has
no real users. If real users arrive before this ships, the phased design comes
back and all of that machinery comes back with it. That makes this cheap to do
now and expensive to do later — the window is open and closes on its own.

### 6.3 Model

```
user_role                                  -- the set of hats
  user_id      uuid       NOT NULL  FK users.id ON DELETE CASCADE
  role         role_enum  NOT NULL
  granted_at   timestamptz NOT NULL DEFAULT now()
  granted_by   uuid       NULL      FK users.id ON DELETE SET NULL  -- null = system/automatic
  grant_reason text       NULL      -- 'accommodation_activated', 'commerce_lead_HOS-nnn', ...
  PRIMARY KEY (user_id, role)

user_role_audit                            -- append-only history
  id           uuid       PK
  user_id      uuid       NULL      FK users.id ON DELETE SET NULL
  role         role_enum  NOT NULL
  action       role_grant_action_enum NOT NULL  -- 'grant' | 'revoke'; typed enum, like r_user_permission.effect
  at           timestamptz NOT NULL DEFAULT now()
  by           uuid       NULL      FK users.id ON DELETE SET NULL  -- null = system/automatic
  reason       text       NULL
```

`user_role` gives idempotent "grant if absent" from its PK, which is what every
write site in §5.3 actually wants.

`user_role_audit` is no longer load-bearing for a migration — there is no
history to preserve. It stays because it is the right shape going forward and
it is cheap: `revokeRole` deletes the live row, so without it the who/why of a
revoke would vanish with the row it describes. Every actor FK is
`ON DELETE SET NULL` so a hard delete can neither block on the audit nor erase
it (same pattern as `ai_credential_audit.actorId`).

`role_permission` needs **no change at all**: its PK `(role, permission)`
already supports N roles, so a new commerce permission is one row inherited by
everyone holding the hat.

### 6.4 Permission resolution

`getPermissionsForRole({ role })` becomes `getPermissionsForRoles({ roles })`,
returning the union, cached on a sorted-role-list key. The actor formula keeps
its shape:

```
effectivePermissions = (⋃ perms(role) for role in roles ∪ grants) \ denies
```

SUPER_ADMIN keeps its short-circuit, now on "holds SUPER_ADMIN". `Actor.role:
RoleEnum` becomes `Actor.roles: readonly RoleEnum[]` — **there is no
compatibility shim**, so the compiler finds every one of the 27 `actor.role`
reads in `apps/api` + `packages/service-core` for you. That is the point of
doing it in one cut: the type system does the inventory.

The two staff-bypass allow-lists (`entitlement.ts:354-368`,
`owner-entitlement.ts:208-229`) stay keyed on roles — "is this person staff" is
a role question, not a capability one — but become a set intersection:
`roles.some((r) => STAFF_BILLING_BYPASS_ROLES.has(r))`. Keep them behind a named
predicate with a comment saying why they are a deliberate exception to
`CLAUDE.md`'s "always `PermissionEnum`" rule.

`resolveOwnerRole` (`owner-entitlement.ts:219-229`) is one of the 7 raw
`users.role` reads — but `owner-entitlement.ts` has two more inline queries that
do not go through it (`:318`, `:778`). All become queries over `user_role`. Full
corrected list in §7.3.

### 6.5 Read gates

- **`apps/web`** — `account-roles.ts` stays the chokepoint. `isHostRole(role)`
  becomes `hasRole({ roles, role: HOST })`; the four `isCommerceOwnerRole` walls
  take the same shape. Also migrate those page gates onto the `nav-gating.ts`
  predicates so `apps/web` has one gating mechanism instead of two — the
  HOS-131 task that was left as "existing consumers migrate later".
- **`nav-gating.ts`** — `isVisibleByRole(permission, role)` becomes
  `isVisibleByRoles(permission, roles)`: visible if **any** held role appears in
  `PERMISSION_ROLE_MAP[permission]`. One function.
  <br>**Do not** propose carrying a resolved `permissions` array in the session:
  HOS-131 D-4 rejected that on cost grounds and its stated precondition (a
  server-side auth cache, SPEC-111 §4.3) still does not exist. Reversing D-4 is
  its own owner decision. The map's existing drift from the seeded truth (§5.2)
  is likewise its own bug — file it separately.
- **`apps/admin`** — the single-`SELECT` role field
  (`role-permissions.consolidated.ts:18-36`) becomes a multi-select showing, per
  held role, when it was granted and by whom.
- **`apps/mobile`** — see §6.7. Not a redesign, but not skippable either.

### 6.6 Backfill

One row per existing user, `role` copied from `users.role`,
`grant_reason = 'migrated_from_users_role'`. That is the whole thing.

**No reconciliation pass.** The phased draft had one, deriving hats from
`accommodations.owner_id` / `gastronomies.owner_id` / `experiences.owner_id`, to
repair accounts the G-6 bug had already corrupted — plus the `deletedAt` and
`lifecycleState != ARCHIVED` filters and the staff exclusion needed to keep that
query from doing fresh damage. With no real users, the only accounts G-6 could
have corrupted are seeded demo data and internal staff logins. Demo data is
rebuilt by re-seeding; staff accounts come through a straight copy correctly.
Repairing nothing is the right amount of repair.

There is a **third category** that binary misses: accounts created by hand
during staging and prod smoke runs (host and commerce test signups, MercadoPago
sandbox purchasers — see the SMOKE-DD-MM workflow). Those are neither seed rows
nor staff, and one holding `COMMERCE_OWNER`, `SPONSOR` or `EDITOR` could have
been eaten by G-6.

So: before the backfill, run an audit query cross-checking `users.role` against
`accommodations.owner_id` / `gastronomies.owner_id` / `experiences.owner_id`
and print the mismatches. It is one `SELECT` and it turns "probably nobody"
into a number. Fix whatever it finds by hand afterwards — one `UPDATE` each,
not a migration feature.

Per the seed dual-write rule the baseline must also be updated so a fresh DB is
built correct: the normal user-seeding code writes `user_role` rows too.

### 6.7 Mobile is not optional, even though it is not in development

The owner's direction is that `apps/mobile` is not under active development and
should not hold this up. That is fine for the *navigation redesign* — but not
for leaving it alone entirely, because **dropping `users.role` breaks it, it
does not degrade it**.

`apps/mobile/src/lib/auth/roles.ts:42,66` reads `useSession().data.user.role`.
Once Better Auth's `additionalFields` stops carrying a scalar `role`, that value
is `undefined`, `resolveAuthGroup` (`:79-85`) falls through, and **every user
lands in `(tourist)`** — including hosts.

**How much work that is depends entirely on OQ-4**, and this section used to
assume the cheap answer:

- **If OQ-4 resolves to `customSession`** (§7.1 option 2), the native session
  keeps carrying the field and mobile really is three lines: read the array and
  ask `roles.includes(HOST)`.
- **If OQ-4 resolves to actor-only** (§7.1's *preferred* option), mobile has no
  `/auth/me` plumbing at all — it uses the Better Auth client exclusively. Then
  this is new fetching, caching and error handling written from scratch in an
  app nobody is actively working on. Materially more than three lines, and it
  is in scope regardless, because the alternative is shipping a build where
  every host lands in `(tourist)`.

Either way it ships with the rest — but size the mobile work *after* OQ-4 is
answered, not before.

Whether mobile eventually gets real dual-hat navigation is a separate product
question (OQ-2) and it does **not** block this. Note that changing the
1-of-3 mapping means re-opening SPEC-243, which the file header marks locked.

### 6.8 Role writes become grants

Two primitives in `service-core`, both idempotent, both writing the audit row,
both accepting the caller's transaction (`ctx?.tx` — `archive-abandoned-drafts.job.ts:224-251`
already wraps its own):

```ts
grantRole({ userId, role, grantedBy, reason }): Promise<Result<void>>
revokeRole({ userId, role, revokedBy, reason }): Promise<Result<void>>
```

`revokeRole` must refuse to remove a user's last role (there is always at least
`USER`). That is a check-then-act, so it needs `SELECT ... FOR UPDATE` on the
`users` row inside the primitive's transaction.

Note this lock survives the single cut even though its original justification
did not. The phased draft introduced it to serialize the *derived `users.role`
recompute*, which no longer exists — but it was also, incidentally, the thing
serializing concurrent grant/revoke calls on the same user. Without it, two
concurrent `revokeRole` calls on a user holding `{USER, HOST}` can both read
"count > 1, safe" before either commits and leave the user with zero roles.
Low likelihood and recoverable with one `UPDATE`, but it is a numbered
acceptance criterion, so it gets a lock. `.for('update')` is already used in
`promo-code.redemption.ts` and `subscription-cancel.service.ts`.

| Site | Becomes |
|---|---|
| `commerce-ports.ts:86-89` | look up the user by email first; if found, `grantRole(userId, COMMERCE_OWNER, reason)`; if not, create then grant. **This is G-4** and it ships here — there is no phase to defer it to. |
| `accommodation.service.ts:1377-1382` | `grantRole(ownerId, HOST, 'accommodation_created')`, unconditional and idempotent. The `role === USER` guard disappears — that guard is exactly why a COMMERCE_OWNER never gets the host hat. |
| `accommodation.service.ts:1961-1985` | the same grant. `PRIVILEGED_ROLES` stops being a write guard because granting is additive. **This is the G-6 fix.** |
| `archive-abandoned-drafts.job.ts:238-242` | `revokeRole(ownerId, HOST, 'last_accommodation_archived')`, only if held. |
| `user/admin/patch.ts:69` | stops accepting a scalar `role`; role changes move to the new grant/revoke endpoints. The endpoints and the admin multi-select ship together, so the admin never loses the ability. |
| `user.service.ts:382-408` (`assignRole`) | delegates to `grantRole`. Dead code today, but it must not survive as a second write path. |
| `testUsers.seed.ts:545-549` | seeds the role set, still idempotent. |

The remaining four sites are all "brand-new user, assign its first role", and
they do NOT all take the same change:

- `signup-as-host.ts:117` — a literal `db.update(users).set({ role, ... })`.
  Swap for `grantRole(newUserId, HOST, 'signup_as_host')`.
- `user/admin/create.ts:49` — **not an update.** `role` is a field on the
  payload handed to `userService.create()`, which reaches the DB as an INSERT
  via `BaseCrudService.create` (`packages/service-core/src/base/base.crud.write.ts:77-115`).
  Drop it from the payload and `grantRole` once the row exists.
- `auth.ts:616` — **not a swap.** That line is in Better Auth's
  `databaseHooks.user.create.**before**` hook, which mutates the pre-insert
  payload; there is no `user.id` yet. The `user_role` row is written from the
  existing `after` hook (`auth.ts:623-650`), which already has the real id.
- `commerce-owner-provisioning.service.ts:269-275` — **no change of its own.**
  It never writes `users.role`; it passes the role down to the port above.

## 7. Data model / contracts

**Migration (structural carril, `packages/db/src/migrations/`)**, one file:
create `role_grant_action_enum`, create `user_role` and `user_role_audit`, add
an index on `user_role(role)` for the "who holds this role" admin query, and
**drop `users.role`** plus its two indexes (`users_role_idx`,
`users_role_deletedAt_idx`). The admin count query becomes a join to `users` to
exclude soft-deleted accounts — cheap, but it has to be stated. This is also
what HOS-120's AC-5 impact preview
(`.specs/HOS-120-admin-editable-role-permissions/spec.md:224`) will need once
`GROUP BY users.role` stops existing; whichever ships second adapts.

`GUEST` and `SYSTEM` stay in `RoleEnum` and are copied by the backfill like any
other value — `packages/seed/src/required/systemUser.seed.ts` creates a
permanent `role = SYSTEM` account present in every environment. Nothing grants
or revokes either at runtime.

**Backfill**: a data-migration in `packages/seed/src/data-migrations/`
(`pnpm db:seed:make`) doing the straight copy of §6.6, plus the baseline change
so a fresh DB is built correct.

**Schemas** (`@repo/schemas`): `UserRoleSchema`; `Actor.role` → `Actor.roles`;
`UserPatchInputSchema` drops `role`; `UserCreateInputSchema` drops it too.

**Endpoints**: `POST /api/v1/admin/users/:id/roles` and
`DELETE /api/v1/admin/users/:id/roles/:role`, both gated on
`PermissionEnum.USER_UPDATE_ROLES` (what the current single-select already
uses), both writing the audit row.

### 7.1 Session — the hard part, and the one thing the phases used to hide

**`additionalFields` cannot carry the role set.** It is a column mapping:
`apps/api/src/lib/auth.ts:196-204` configures `drizzleAdapter(getDb(), { schema:
{ user: users, ... } })`, and `additionalFields` (`:210-244`) sits alongside
`fields: { name: 'displayName' }`, declaring extra **columns of `users`** to
expose. Drop `users.role` and there is no source for the field. A related table
cannot be flattened through this mechanism, and nothing in the repo does it —
`customSession` appears zero times.

This is the one genuine cost of the single cut, and it has to be designed rather
than asserted. The phased plan never had to solve it, because the column
survived until its final phase.

**The codebase already has the pattern** for a per-request value the
plain-column session cannot express. Billing entitlements are not in
`additionalFields` at all: `entitlementMiddleware` queries the DB per request
and does `c.set('userEntitlements', ...)`, which `actor.ts:194-200` merges into
the `Actor`. Roles take the same route — `actorMiddleware` reads `user_role` and
populates `Actor.roles`, so `GET /api/v1/public/auth/me` carries the set for
free.

**But three of the four consumers never read `/auth/me`.** They read Better
Auth's native `/api/auth/get-session`, which is exactly the response that loses
the field:

| Consumer | Reads today | Consequence |
|---|---|---|
| `apps/web/src/lib/auth-cache.ts:207` | `/api/v1/public/auth/me` (actor) | **right endpoint, wrong assumption — see below** |
| `apps/web/src/lib/middleware-helpers.ts:408,452` | `/api/auth/get-session` | needs repointing; it avoids `/auth/me` deliberately today |
| `apps/admin/src/lib/auth-session.ts:132` | `/api/auth/get-session` | cheapest fix — it **already** calls `/auth/me` too, for `permissions` |
| `apps/mobile` (`app/_layout.tsx:99-100` → `useSession()`) | `/api/auth/get-session` via the Better Auth client | has no `/auth/me` plumbing at all (§6.7) |

**`auth-cache.ts` hitting the right endpoint does NOT make it free.** It does
not import the shared `Actor` type — its only import is `getApiUrl` — and
hand-casts the response to a local `AuthMeResponseBody` declaring
`role?: string` (`:85-93`), exposing `AuthMeSnapshot.role: string | null`
(`:47-48`, set at `:207`). When the payload's `role` becomes `roles`, that field
is `undefined`, nothing fails to compile, and `role` is silently `null` for
every authenticated user forever.

That is not cosmetic. Three consumers hang off it:

- `apps/web/src/components/shared/navigation/MobileMenu.client.tsx:214` —
  `const isHostMode = role === 'HOST' && ...` drives the **host CTA in the
  mobile web menu**. Always `false` → every host loses it.
- `apps/web/src/components/shared/navigation/UserMenu.client.tsx:190` — feeds
  PostHog's `identifyUser` `role` person-property. Role segmentation dies quietly.
- `apps/web/src/hooks/use-account-permissions.ts:132,150`.

This whole path — `auth-cache.ts` → `use-account-permissions.ts` →
`UserMenu`/`MobileMenu` — is **separate from** the `account-roles.ts` /
`nav-gating.ts` SSR chokepoint that §5.5 and §6.5 describe. It needs its own
migration and its own line in the plan.

**Pick the mechanism before writing code.** Two viable shapes:

1. **Actor-only** (preferred): `roles` lives on the actor and every consumer
   that needs it reads `/auth/me`. One source, no Better Auth surgery. Cost: web
   middleware and mobile each gain an `/auth/me` call, and web's is per-request
   on protected routes — the same cost HOS-131 D-4 rejected for a different
   surface, so **measure it, do not assume it is fine**.
2. **Better Auth's `customSession` plugin**: enrich the native session response
   from `user_role` so `get-session` keeps working for all three consumers
   unchanged. Cost: an unproven mechanism here, and it interacts with the
   already-enabled `session.cookieCache` (`auth.ts:245-248`) — a cached cookie
   would serve stale roles after a grant until it expires, which needs an
   explicit answer.

This is the tightest coordination point in the change and the first thing to
settle. See OQ-4.

### 7.2 Things the compiler will NOT find

§12 leans on "rename the type and let the compiler enumerate the work". That is
true for TypeScript call sites and false for two categories that must be swept
by hand:

- **Raw SQL in the e2e fixtures.** `apps/e2e/fixtures/api-helpers.ts:252`
  (`setUserRole`) and `apps/e2e/fixtures/db-helpers.ts:89`
  (`demoteHostToUser`) run `UPDATE users SET role = ...` through a `pg` pool
  wrapper, and `apps/e2e/tests/admin/spec172-amenity-chips-smoke.spec.ts:94`
  does it inline. `createUser` calls `setUserRole` and is used by **40 test
  files**, including the role-isolation suites that exist precisely to catch
  this class of bug. These fail at e2e runtime with `column "role" does not
  exist`, never at typecheck. Sweep `apps/e2e` for `SET role` and `.role` as an
  explicit checklist step.
- **Hand-maintained local mirrors of API responses.** `apps/web` and
  `apps/admin` frequently declare their own interface for a JSON payload instead
  of importing the shared type, then `as`-cast into it. `auth-cache.ts`'s
  `AuthMeResponseBody` (§7.1) is the load-bearing example, and it is the worst
  kind of failure: no compile error, no runtime error, just a field that is
  quietly `undefined` and a host CTA that stops appearing. Grep for `auth/me`
  and for local `interface .*Response` declarations in `apps/web/src/lib` and
  `apps/admin/src/lib`, and check each against the real payload.
- **Prose.** Three of the 27 `actor.role` hits are the comment *"NEVER check
  `actor.role` directly"* (`commerce.permissions.ts:8`,
  `gastronomy.permissions.ts:13`, `experience.permissions.ts:13`). Reword them;
  the compiler will not.

The common thread: "the type system does the inventory" holds only for code that
actually imports the type. Raw SQL, hand-cast local interfaces and comments are
all outside it.

### 7.3 Corrected read-site inventory

The raw `users.role` reads are **7**, not 5 — counting `apps/api`,
`packages/service-core` **and** `packages/db`. Two of them are product surfaces
with no design decision attached yet:

- `apps/api/src/middlewares/owner-entitlement.ts:223, 318, 778` — three separate
  inline queries; §6.4 named only the `resolveOwnerRole` one.
- `apps/api/src/cron/jobs/archive-abandoned-drafts.job.ts:241`.
- `apps/api/src/routes/tag/user-tag/admin/user-moderation.ts:99` — enriches a
  moderation panel with a per-user `role` string. **What does it show for a
  user with two hats?** Undecided.
- `packages/db/src/models/user/user.model.ts:342,347` —
  `getAdminStats().byRole`, a `GROUP BY users.role` dashboard aggregate. With
  multi-role a user contributes to N buckets, so `Σ byRole > totalUsers`
  becomes correct rather than a bug. **Say so in the UI** or the number reads
  as broken.
- `packages/seed/src/required/aiPrompts.seed.ts:45` is an eighth, in
  `packages/seed` — outside the count above but equally in scope.

There is also a **third** staff-like role set nobody has reconciled:
`AccommodationService.BILLING_EXEMPT_ROLES` (`accommodation.service.ts:224-228`
= `{ADMIN, CLIENT_MANAGER, SUPER_ADMIN}`), distinct from both sets §12 names. Two
of its three call sites (`:1544`, `:1763`) read `owner.role` off a
`UserModel.findById()` result — so `UserModel` needs a multi-role read path,
which §7's contracts did not mention.

## 8. UX / UI behavior

- **Account nav**: no mode switcher. HOS-131 (Done, PR #2267) already designed
  the menu so the groups coexist, each visible if the capability applies. A user
  with both hats sees both groups. No navigation redesign on web.
- **Avatar shortcut**: `pickBusinessShortcut` returns one today. See OQ-1.
- **Admin user editor**: multi-select showing per held role when it was granted
  and by whom.
- **Commerce lead approval**: when the lead email matches an existing account,
  the admin sees that approving will grant the hat to that account rather than
  create one, and confirms.

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
- **AC-7** — `users.role` no longer exists. Enforceable trivially: the column is
  gone, so any surviving reference is a compile error or a failing query.
- **AC-8** — Commerce billing charges reach the MercadoPago account of the same
  email the user signs in with (the original driver of this issue).
- **AC-9** — A host on `apps/mobile` still lands in `(host)` after the change —
  i.e. dropping the scalar did not silently route everyone to `(tourist)`.
- **AC-10** — An admin can grant and revoke roles from the admin panel in the
  same release that removes the scalar `role` field from the user form.
- **AC-11** — The `apps/e2e` suite is green. Two distinct causes, do not
  conflate them: `security/sec-01-host-isolation` and `admin/adm-03-user-suspend`
  go through `createUser({ role })` → raw SQL (§7.2), so they break if the
  manual sweep is missed. `commerce/commerce-02-access-control` and
  `commerce/commerce-04-permission-gate` sign in as pre-seeded fixture accounts
  from `packages/seed/src/example/gastronomies.seed.ts`, so they break if the
  seed dual-write of §6.6 is wrong. Sweeping `apps/e2e` will not protect the
  latter two.
- **AC-12** — `revokeRole` cannot strand a user with zero roles under two
  concurrent calls, not just sequential ones (§6.8).

## 10. Risks

- **R-1 — Privilege escalation via the union.** A user accumulating hats
  accumulates permissions. `revokeRole`, the audit trail and the admin
  multi-select are the mitigation — the admin needs to *see* the set to manage
  it, which is why the editor is in scope rather than deferred.
- **R-2 — One large diff touching auth.** A bug here is broken login or wrong
  permissions. This is the real cost of the single cut. It is acceptable
  **only** because there are no real users to harm: it surfaces in local and
  staging, not as an incident. Do not carry this design past that condition.
- **R-3 — The session shape changes for four independent consumers at once**
  (§7). Miss one and that surface sees no roles at all. `apps/mobile` is the
  easiest to forget because it is not in active development — AC-9 exists
  specifically to catch it.
- **R-4 — The G-6 bug is live now.** `_assignHostRoleIfNeeded` is destroying
  `COMMERCE_OWNER`, `SPONSOR` and `EDITOR` roles today. It dies with this
  change. If this work slips, fix it on its own regardless — it is a two-line
  guard change and does not need multi-role.
- **R-5 — `nav-gating.ts`'s `PERMISSION_ROLE_MAP` is already wrong** (§5.2),
  independent of this spec. Do not let that bug ride along on this change; file
  it separately or it will be blamed on multi-role.
- **R-6 — HOS-120 interaction.** Its AC-5 impact preview assumes
  `GROUP BY users.role`. Whichever ships second adapts.
- **R-7 — The window closes.** Every risk-management argument above rests on
  "no real users". If launch happens first, stop and re-plan — the phased
  design in this file's git history is the fallback, not something to
  reconstruct from memory.

## 11. Open questions

**OQ-4 blocks the work.** OQ-1, OQ-2 and OQ-3 do not — each can keep running
today's logic unchanged against a role set. **OQ-5 is different**: it has no
"preserve today's behaviour" option, because today's behaviour is rendering one
scalar and after this change there is no scalar to render. It still does not
block — pick anything and ship — but somebody has to pick.

- **OQ-1 — Avatar shortcut with several business hats.** HOS-131 OQ-4 resolved
  this to "one shortcut, priority `[hostDashboard, commerce]`"
  (`nav-avatar.ts:79-89`), a decision taken *because* only one hat was possible.
  Multi-role invalidates the premise. Options: keep one by priority (cheapest,
  but a host who is also a commerce owner can never reach commerce from the
  avatar), show one per held capability, or a neutral "Mis negocios" entry that
  opens a chooser. **Owner decision.** Until it is answered, keep today's
  behaviour — it still compiles against a role set.
- **OQ-2 — Does mobile get real dual-hat navigation?** The minimal fix (§6.7)
  ships regardless and preserves today's behaviour, so this is not blocking.
  Doing more means re-opening SPEC-243, which
  `apps/mobile/src/lib/auth/roles.ts:9-18` marks locked. **Owner decision, and
  deferrable.**
- **OQ-3 — Automatic revoke.** `archive-abandoned-drafts` demotes HOST→USER when
  the last accommodation is archived. With several hats, should any automatic
  revoke exist at all, or should hats only ever be removed by an admin?
  Automatic revocation is what makes hats feel unstable. Defaulting to "keep
  today's behaviour, but as a grant-aware revoke" is safe.
- **OQ-4 — How does the role set reach the session? BLOCKS THE WORK.** §7.1 lays
  out the two shapes (actor-only via `/auth/me`, or Better Auth's
  `customSession`) with their costs. This is the one part of the change with no
  proven precedent in the codebase, so it is a technical decision to make with
  eyes open rather than discover mid-implementation. Unlike OQ-1..OQ-3, nothing
  can start until it is answered.
- **OQ-5 — What does the admin see for a multi-hat user?** Two surfaces read
  `users.role` purely to display it (§7.3): the moderation panel
  (`user-moderation.ts:99`) and the stats dashboard's `byRole` aggregate
  (`user.model.ts:342,347`). Show all hats, the "highest" one, or a count? For
  the dashboard, note that `Σ byRole > totalUsers` becomes *correct* — the UI
  should say so or the number reads as a bug.

## 12. Implementation notes

- **Do the type change first and let the compiler drive.** Renaming
  `Actor.role` → `Actor.roles` with no shim turns the `actor.role` reads and the
  7 raw `users.role` reads into a compile-time worklist. Fighting the compiler
  with a temporary alias would hide exactly the inventory you want.
  <br>**Then do the manual sweep of §7.2.** Raw SQL in `apps/e2e` is invisible
  to `tsc` and silently takes down 40 test files if missed.
- **Settle §7.1 (how the role set reaches the session) before anything else.**
  It is the only part of this change without a proven mechanism in the
  codebase, and three of the four session consumers depend on the answer.
- Roughly 27 test files assert single-role behaviour, **plus the `apps/e2e`
  fixtures** (§7.2). The ones that encode the
  destructive semantics directly, and so need rewriting rather than adapting:
  `packages/service-core/test/services/accommodation/roleAssignment.test.ts`,
  `.../accommodation/createForOnboarding.test.ts`,
  `.../commerce/commerce-owner-provisioning.service.test.ts`,
  `packages/service-core/test/services/user/assignRole.test.ts`,
  `packages/seed/test/test-users/hostPromotion.test.ts`.
  <br>**Not** `ownerPromotion.service.test.ts` — despite the name,
  `packages/service-core/src/services/owner-promotion/` is the promotional-deals
  feature and has no role logic at all.
- Do **not** change `role_enum` or add role values. The migration does create
  one new enum type, `role_grant_action_enum`, for the audit table.
- Two "staff" sets already disagree in production and are easy to confuse:
  `STAFF_BILLING_BYPASS_ROLES` = `{SUPER_ADMIN, ADMIN, EDITOR, CLIENT_MANAGER}`
  (`entitlement.ts:354-359`, duplicated at `owner-entitlement.ts:208-217`) and
  `AccommodationService.PRIVILEGED_ROLES` = `{HOST, ADMIN, CLIENT_MANAGER,
  SUPER_ADMIN}` (`accommodation.service.ts:213-218`). They swap `EDITOR` for
  `HOST`, and that omission of `EDITOR` **is** half of the G-6 bug. Use the
  former for anything meaning "is this staff".
- **Rollback is not clean, and the spec should not pretend otherwise.** This
  repo's migration tooling is forward-only — `drizzle-kit migrate`, no
  `db:migrate:down` anywhere in `package.json` or `packages/db/package.json`.
  And "there is no data to lose" stops being true minutes after deploy, when
  ordinary traffic starts writing `user_role` rows for every host onboarding
  and commerce approval. Reconstructing a scalar `users.role` for a user who has
  since accumulated two hats needs exactly the precedence logic §6.2 says is
  unnecessary. In practice, at pre-launch row counts, rollback means `git
  revert` plus a hand-written recovery migration — fine, but plan for it as
  work rather than as a switch.
- Ordering within the change: schema + primitives → write sites → resolution →
  read gates (web, admin, mobile) + session. One PR if review can absorb it,
  otherwise split by **reviewability**, not by safety, and land them together.

## 13. Linear

Canonical tracking:
HOS-296
