---
title: Per-vertical commerce permissions and owner roles
linear: HOS-1077
statusSource: linear
created: 2026-09-02
type: refactor
areas:
  - auth
  - db
  - api
  - admin
  - web
---

# Per-vertical commerce permissions and owner roles

> Parent epic: HOS-1071. This spec covers **release 1 (expand) only**. Release 2
> (contract) is scoped in §7 and belongs to its own issue.

## 1. The problem

`PermissionEnum` has seven `commerce.*` values naming **two** product verticals at
once:

```
commerce.editOwn  commerce.create  commerce.viewAll  commerce.editAll
commerce.delete   commerce.moderateReview  commerce.moderationChange
```

Accommodation, the other listing vertical, has 64 permissions across four
categories. The asymmetry is not cosmetic: **it is impossible to grant edit or
moderation rights over gastronomy without also granting them over experiences.**
A restaurant moderator moderates excursions, by construction. There is no way to
express "this account administers gastronomy" — the permission model lacks the
vocabulary.

`RoleEnum` repeats the shape: `HOST` is one role for one vertical, while
`COMMERCE_OWNER` is one role for two. It also names a bucket `ProductDomainEnum`
already retired — `'commerce'` is not a product domain any more; `'gastronomy'`
and `'experience'` are.

The cause is inheritance from SPEC-239, when "commerce" was ONE vertical with two
internal sub-types. Everything else in the codebase has since moved on:
`ProductDomainEnum`, `CommerceEntityTypeEnum`, the billing plans, the seeds. The
permission model is the last place still asserting the old shape — and it asserts
it in production database rows, not in code.

## 2. Decisions taken by the owner (2026-09-02)

Two questions the issue left open were resolved before implementation. They are
recorded here because both are load-bearing and neither should be relitigated.

### D-1 — Two new roles, not one role with per-vertical permissions

`GASTRONOMY_OWNER` and `EXPERIENCE_OWNER`, in parity with `HOST`.

There is nothing to resolve between them because **HOS-296 dropped
`users.role`**: roles live in `user_role`, a many-to-many table with a composite
`(userId, role)` primary key, and effective permissions are
`(⋃ perms(roleᵢ) ∪ grants) \ denies`. An account that owns a restaurant AND an
excursion simply holds two rows.

### D-2 — Split the seven into fourteen; do NOT align with accommodation's 64

This is a split, not an alignment. Two measured reasons:

- **~14 of accommodation's 64 are per-SECTION listing permissions**
  (`amenities.edit`, `basicInfo.edit`, `faqs.edit`, `gallery.manage`,
  `price.edit`, `seo.edit`, …). Commerce collapsed those deliberately: the
  comment on `COMMERCE_EDIT_OWN` reads *"Replaces the 10 per-section
  COMMERCE_*_EDIT_OWN permissions (removed in SPEC-253 D2=b)"*. Re-creating them
  would revert that decision.
- **Several others name functionality commerce does not have**
  (`occupancy.manage`, `iaContent.approve`, `location.exact.view`). A permission
  no route ever demands is dead letter — the exact defect the HOS-974 audit found
  with three entitlements granted and never enforced.

## 3. Scope of THIS release (expand)

Release 1 adds, and removes nothing. Every gate reads BOTH families, so no
account can lose access at any point in the rollout.

| # | Change | Where |
|---|---|---|
| 1 | 14 new `PermissionEnum` values, 2 new `PermissionCategoryEnum` values | `packages/schemas/src/enums/permission.enum.ts` |
| 2 | 2 new `RoleEnum` values | `packages/schemas/src/enums/role.enum.ts` |
| 3 | Baseline seed grants for staff and the two owner roles | `packages/seed/src/required/rolePermissions.seed.ts` |
| 4 | Data-migration `0079` — the live-environment delta | `packages/seed/src/data-migrations/0079-hos-1077-vertical-commerce-permissions.ts` |
| 5 | `anyOfPermissions` OR-groups at the route gate | `apps/api/src/{types/authorization.ts, middlewares/authorization.ts, utils/route-factory-tiered.ts}` |
| 6 | 50 gastronomy/experience route files converted to the OR-group gate | `apps/api/src/routes/{gastronomy,experience}/**` |
| 7 | Service-layer dual-read | `packages/service-core/src/services/commerce/commerce.permissions.ts` + the two vertical wrappers |
| 8 | Owner self-service create grants BOTH hats | `packages/service-core/src/services/commerce/base-commerce-listing.service.ts` |
| 9 | Navigation dual-read (admin sidebar, admin entity pages, web account nav, analytics) | `apps/admin/**`, `apps/web/**` |
| 10 | Role catalog labels in es/en/pt | `packages/i18n/src/locales/*/admin-pages.json` |

### 3.1 The naming

`gastronomy.editOwn`, `gastronomy.create`, `gastronomy.viewAll`,
`gastronomy.editAll`, `gastronomy.delete`, `gastronomy.moderateReview`,
`gastronomy.moderationChange` — and the `experience.*` twins.

Two segments, camelCase second segment, mirroring `commerce.*` exactly. A dotted
third segment (`gastronomy.moderation.change`) would add a fourteenth
dual-spelled family to the baseline frozen by
`permission-naming-convention.guard.test.ts` — the HOS-555 defect where
`where permission::text like '%organizer%'` returns 1 row of 8 because Postgres
`LIKE` is case-sensitive.

### 3.2 How the dual-read is implemented

Three different mechanisms, because the three layers gate differently:

- **Service layer** — one function, `hasCommercePermission(actor, slot, vertical?)`,
  in `commerce.permissions.ts`. Every check routes through it. It returns true on
  the vertical's own permission OR on the legacy `commerce.*` one. `vertical` is
  optional so the genuinely vertical-agnostic callers keep today's behaviour;
  release 2 deletes the legacy branch, at which point omitting it fails closed.
- **API route gate** — `requiredPermissions` is `hasAllPermissions`, strictly AND,
  and cannot express an OR at all. The existing workaround in the codebase is to
  drop the route gate and re-implement the OR inside the handler, which moves the
  declaration off the route and off the OpenAPI description. So a new
  `anyOfPermissions` field was added: an array of OR-groups, ANDed with each other
  and with `requiredPermissions`. `reviews/admin/update.ts` needed exactly that —
  it was an AND of two permissions and is now an AND of two OR-groups.
- **Navigation** — the admin sidebar gate (`isPermissionGateGranted`) and the
  admin entity-page gates already evaluate their arrays with `.some(...)`, so
  listing both families IS the dual-read; no new mechanism. The web account nav
  approximates permission→roles server-side, so the two new roles were added to
  `PERMISSION_ROLE_MAP[COMMERCE_EDIT_OWN]` and `ROLES_WITH_COMMERCE_NAV`.

### 3.3 Why `0079` derives owner grants from listings, not from `COMMERCE_OWNER`

Copying `COMMERCE_OWNER` into both new roles is the one-line version and it
**re-creates the exact coupling this issue removes**: an account that only ever
ran a restaurant would come out of the migration holding authority over
experiences. So the `user_role` grant is derived from what each account actually
owns — `gastronomies.owner_id` and `experiences.owner_id`, soft-deleted rows
excluded. An owner of both gets both roles because they genuinely are both.

Nobody is stranded by the narrower rule: `COMMERCE_OWNER` is untouched and still
carries the legacy permissions every gate accepts.

## 4. Out of scope, deliberately

- **The three surfaces (HOS-1071 rule)** — none apply, and the issue says so
  explicitly. A permission is not an entitlement and not announced functionality:
  the permission says "I am a moderator" (by role, static); the entitlement says
  "I am paid up" (by user, changes with payments). No `presentacion/`, no plan
  comparison, no pricing page was touched.
- **Aligning commerce with accommodation's 64 permissions** — see D-2.
- **Removing anything** — see §7.

## 5. Verification

The real risk of this change is leaving somebody without access, so the
assertions run against the real checks and the real route declarations, not a
hand-built context. Each was verified by mutation (break it, watch the specific
tests go red, revert, confirm with `git diff` that nothing stayed applied).

| Property | Where asserted | Mutation that killed it |
|---|---|---|
| An actor with only the LEGACY permission still passes | `commerce.permissions.test.ts`, `authorization.test.ts` | removing the legacy branch → 16 red / 4 red |
| An actor with only the NEW permission passes | same | removing the vertical branch → 5 red / 4 red |
| A gastronomy permission does NOT pass an experience check, and vice versa | same, plus `admin-moderate-listing.test.ts` on the route declaration | making one grant cover both verticals → 7 red |
| The OR-group is actually evaluated at the HTTP gate | `authorization.test.ts` | ignoring `anyOfPermissions` → 4 red |
| Both new roles reach the commerce nav; a tourist still does not | `account-roles.test.ts` | — (instrument check inside the block) |
| The migration's literals equal the seed exactly | `0079-*.test.ts` | — (compares against `ROLE_PERMISSIONS` directly) |

Guards updated rather than deleted:

- `permission-commerce.test.ts` — the frozen "exactly 7 commerce" count still
  passes, because the new values are `gastronomy.*`/`experience.*`. Extended with
  a per-vertical block that asserts the same shape for each.
- `role.enum.test.ts` — role count 10 → 12.
- `role-label-catalog-coverage.test.ts` — passes once the es/en/pt catalog
  entries exist (it generates one test per role per locale).
- `navigation.test.ts` — `PERMISSION_ROLE_MAP[BILLING_ADDON_PURCHASE]` now names
  the two new roles, which the seed grants them.

## 6. ⚠️ Blocking follow-up: the structural drizzle migration

**This PR does NOT include the `ALTER TYPE … ADD VALUE` migration**, and cannot
be deployed without it.

`PermissionEnum`, `PermissionCategoryEnum` and `RoleEnum` are all native Postgres
enums (`permission_enum`, `permission_category_enum`, `role_enum` in
`packages/db/src/schemas/enums.dbschema.ts`, derived 1:1 via `enumToTuple`). The
14 permissions, 2 categories and 2 roles therefore need a generated migration
adding each value, in the shape precedents `0017_acoustic_dust.sql` and
`0031_nice_venus.sql` use (drizzle-kit emits them all in ONE `.sql`, separated by
`--> statement-breakpoint`).

It was not generated here because **another unmerged PR holds the `0103` slot**
(HOS-898). Generating a second `0103` would collide in the drizzle journal. The
migration must be generated AFTER that one lands:

```bash
git fetch origin staging
git rebase origin/staging      # take whatever number 0103 became
pnpm db:generate               # this branch's changes become 0104
```

Until then, `pnpm db:migrate` + `pnpm db:seed:migrate` will fail on any
environment — `0079` inserts enum values Postgres does not know.

## 7. Release 2 — contract (separate issue, do NOT do it here)

Only once release 1 has run in every environment:

1. Delete the seven `commerce.*` values from `PermissionEnum` and the `COMMERCE`
   category.
2. Delete `COMMERCE_OWNER` from `RoleEnum`.
3. Delete the legacy branch of `hasCommercePermission` and the
   `LEGACY_COMMERCE_PERMISSIONS` table; the `vertical` parameter becomes
   required, which turns every remaining vertical-agnostic caller into a compile
   error rather than a silent fail-open.
4. Delete the `COMMERCE_*` entries from every `anyOfPermissions` group, collapsing
   the single-member groups back to plain `requiredPermissions`.
5. A data-migration deleting the legacy `role_permission` and `user_role` rows.
   This one IS `destructive: true`.
6. Structural migration removing the enum values (Postgres cannot `DROP VALUE`;
   this needs the type-recreate dance, which is why it is its own release).

Known call sites that release 2 must convert, deliberately left on the legacy
permission by this PR because they cannot name a vertical statically:

- `apps/api/src/routes/commerce/admin/start-subscription.ts` — one route serving
  both verticals; the entity type is only known at runtime.
- `BaseCommerceListingService._viewAllPermission` / `_viewOwnPermission` — both
  return `COMMERCE_VIEW_ALL`, and the predicate that reads them
  (`!viewAll && viewOwn`) is a no-op today because the two are the same value.
- `CommerceListingModerationCard` → `InlineStateSelectCell`, whose `permission`
  prop takes a single value. Widening it to an array is a shared-component change
  with its own blast radius; staff hold both families after `0079`, so the card
  is correct throughout the expand window.
