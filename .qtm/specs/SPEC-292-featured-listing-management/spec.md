---
specId: SPEC-292
title: Featured Listing Management
type: feat
complexity: medium
status: in-progress
created: 2026-06-26
updated: 2026-06-30
tags: [owner, featured, admin, entitlements, search, billing]
---

# SPEC-292 — Featured Listing Management

> Makes the `FEATURED_LISTING` feature real and entitlement-wired. Surfaced during
> the SPEC-282 review (owner-side audit). Design locked 2026-06-30 after a codebase
> re-audit that corrected the original premise (see §2).

## 1. Summary

`FEATURED_LISTING` is granted to pro/premium owner & complex plans, and the
plumbing partially exists — `accommodation.isFeatured` column + a public search
sort that always prepends featured listings + an admin inline toggle
(`InlineFeaturedCell`, gated by `ACCOMMODATION_FEATURED_TOGGLE`).

Two real gaps remain:

1. **The plan does nothing.** `FEATURED_LISTING` has zero enforcement — paying for
   it never makes any listing featured.
2. **The owner-facing PATCH leaks `isFeatured`.** Any owner on any host plan can
   currently send `{ isFeatured: true }` to `PATCH /protected/accommodations/:id`
   and have it persisted — featuring without paying, ungated.

This spec connects featuring to the plan and closes the leak. The featuring model
was decided by the owner (see §5).

## 2. Context — corrected premise (verified 2026-06-30)

The original spec assumed "no API route sets `isFeatured`" and "the admin toggle is
cosmetic". A fresh codebase audit found that is **not** the case:

- **Admin path already works.** `InlineFeaturedCell` → `PATCH /api/v1/admin/accommodations/:id`
  → `accommodationService.update()` persists `isFeatured`. The admin route accepts
  `isFeatured` (not in the schema omit-list) and has no billing gate by design
  (admins bypass entitlement gates, SPEC-145 INV-6). **G-1 is therefore already met
  for the admin.**
- **Owner path leaks.** `PATCH /api/v1/protected/accommodations/:id` uses
  `AccommodationUpdateHttpSchema.partial()`, which includes
  `isFeatured: z.coerce.boolean()`, mapped through `httpToDomainAccommodationUpdate`
  to the service update. There is **no `FEATURED_LISTING` gate** on the protected
  PATCH chain. An owner can set it today, ungated.
- **Entitlement is not SQL-joinable.** `FEATURED_LISTING` resolves through the QZPay
  subscription API (`loadEntitlements` → `hasEntitlement`), cached 5 min in-memory
  per billing customer. It is **not** a Postgres table joinable from
  `accommodations` in a single query. The public search sort, by contrast, reads the
  `accommodations.isFeatured` column directly (`buildAccommodationOrderBy`,
  `featuredFirst: true` hardcoded in `list.ts`).
- **Denormalization precedent exists.** `accommodations.ownerSuspended` and
  `accommodations.planRestricted` already denormalize billing/owner state onto the
  accommodations table — the established pattern for "billing state the public query
  must read cheaply".

Key files (2026-06-30):

- Search sort: `packages/db/src/models/accommodation/accommodation.model.ts:166-196`
  (`buildAccommodationOrderBy`, `desc(accommodations.isFeatured)` at 183-184).
- Forced featuredFirst: `apps/api/src/routes/accommodation/public/list.ts:175`.
- Column: `packages/db/src/schemas/accommodation/accommodation.dbschema.ts:71`
  (`isFeatured: boolean('is_featured').notNull().default(false)`), indexes at 122 /
  133-135 / 142-144.
- Entitlement key: `packages/billing/src/types/entitlement.types.ts:13`; granted by
  `owner-basico`, `owner-premium`, `complex-pro`, `complex-premium`
  (`packages/billing/src/config/plans.config.ts`); NOT `complex-basico`.
- Runtime gate: `apps/api/src/middlewares/entitlement.ts` (`loadEntitlements:411`,
  `hasEntitlement:1014`).
- Admin route: `apps/api/src/routes/accommodation/admin/patch.ts`; schema
  `AccommodationPatchInputSchema` (`accommodation.crud.schema.ts:203`).
- Owner route: `apps/api/src/routes/accommodation/protected/patch.ts`; schema
  `AccommodationUpdateHttpSchema` (`accommodation.http.schema.ts:362`, `isFeatured`
  at 228).
- Owner FK: `accommodation.dbschema.ts:92` (`ownerId → users.id`).

## 3. Decided model (owner sign-off 2026-06-30)

- **Admin** features via the existing manual `isFeatured` toggle, **independent of the
  entitlement** (editorial curation — admin can feature anyone). Resolves OQ-2.
- **Owner** has **no self-serve toggle**. If the owner has `FEATURED_LISTING` active
  (i.e. they paid), **all** their accommodations become featured **automatically**.
  **No cap.** Resolves OQ-1.
- The owner-facing path must therefore **reject `isFeatured`** entirely — the owner
  never toggles featuring by hand.

### Architecture — `featuredByPlan` denormalized column (decided)

Because the entitlement is not SQL-joinable but the search sort must read a column,
we denormalize plan-derived featuring onto the accommodations table, following the
`ownerSuspended` / `planRestricted` precedent:

- New column **`accommodations.featuredByPlan boolean NOT NULL DEFAULT false`**,
  kept **separate** from `isFeatured` so admin curation and plan-derived featuring
  never overwrite each other.
- **Effective featured = `isFeatured OR featuredByPlan`.** The public search sort
  (`buildAccommodationOrderBy`) orders by that disjunction; indexes updated to match.
- A **billing-driven sync service** sets `featuredByPlan = true` on **all** of an
  owner's accommodations when their `FEATURED_LISTING` becomes active, and back to
  `false` when it lapses. Sync is triggered by billing lifecycle events (subscription
  activation / cancellation / expiry / past-due that loses the entitlement) **plus a
  reconciliation cron** for robustness — same shape as the other billing crons.
- **Validity window (derived decision, not separately asked):** `featuredByPlan`
  tracks the **entitlement's active validity**, including the paid period during a
  soft-cancel (until `currentPeriodEnd`). When the entitlement is no longer active,
  `featuredByPlan` is cleared. Consistent with the project's grace/soft-cancel rules.

## 4. Goals

- **G-1** ✅ already met for admin (manual `isFeatured` via admin PATCH persists).
  This spec only adds **tests/confirmation** that it stays working.
- **G-2** Implement the decided model: admin manual (ungated) + owner automatic
  (entitlement-derived via `featuredByPlan`).
- **G-3** Enforce `FEATURED_LISTING` on the owner-facing path by **removing
  `isFeatured` from the owner schema/route** (owner cannot feature by hand at all),
  and deriving owner featuring solely from the active entitlement.

## 5. Resolved Questions

- **OQ-1** → Owner featuring is **automatic on payment** (not a self-serve toggle),
  applied to **all** the owner's accommodations, with **no cap**.
- **OQ-2** → Admin toggle stays **independent of the entitlement** (admin features
  anyone); the owner path is plan-derived only.

## 6. Non-Goals

- No paid one-off "boost" purchase (that is the existing visibility-boost addon
  territory).
- No change to which plans grant `FEATURED_LISTING` (e.g. `complex-basico` staying
  without it is out of scope).
- No per-owner cap (explicitly decided: none).

## 7. High-level work breakdown

1. **DB**: add `featuredByPlan` column + migration; update the composite featured
   indexes to cover `featuredByPlan` (or the effective disjunction). Two-carril rules
   apply (`db:generate` + `db:migrate`).
2. **Search sort**: `buildAccommodationOrderBy` orders by `isFeatured OR
   featuredByPlan`; keep the forced `featuredFirst` behavior.
3. **Close the leak**: remove `isFeatured` from `AccommodationUpdateHttpSchema` /
   `httpToDomainAccommodationUpdate` (owner path); regression test that the owner
   PATCH no longer accepts it.
4. **Billing sync service** (`packages/service-core` + `apps/api`): set/clear
   `featuredByPlan` for all of an owner's accommodations on entitlement
   activation/lapse; wire to billing lifecycle events.
5. **Reconciliation cron** (`apps/api/src/cron/jobs/`): periodically reconcile
   `featuredByPlan` against the source-of-truth entitlement for drift.
6. **Tests**: admin toggle still persists; owner cannot set `isFeatured`; sync sets
   and clears `featuredByPlan`; search prepends both manual and plan-featured.
7. **SPEC-282 follow-up**: flip the "Listing destacado" row from *Próximamente* once
   this ships (tracked there, not built here).

## 8. Relationship to SPEC-282

The "Listing destacado" row stays *Próximamente* until this spec ships, at which
point featuring is settable (admin) and plan-derived (owner) and the entitlement is
real.

## 9. Revision History

- **2026-06-30** — Re-audited the codebase; corrected the premise (admin path
  already persists; owner path leaks `isFeatured`; entitlement not SQL-joinable).
  Owner resolved OQ-1/OQ-2 and reshaped the owner model to "automatic on payment, no
  cap, no self-serve toggle". Locked the `featuredByPlan` denormalized-column
  architecture. Status `draft` → `in-progress`.
