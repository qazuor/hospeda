---
specId: SPEC-309
title: Featured Listing — Addon Source + Hardening
type: feat
complexity: medium
status: draft
created: 2026-06-30
dependsOn: [SPEC-292]
tags: [owner, featured, addons, entitlements, billing, hardening]
---

# SPEC-309 — Featured Listing — Addon Source + Hardening

> Followup to SPEC-292. SPEC-292 wired plan-derived featuring (`featuredByPlan`)
> and was merged to staging (PR #1930). Its adversarial review (SHIP-WITH-FOLLOWUPS)
> surfaced one HIGH gap and several Medium hardening items that were explicitly
> deferred. This spec closes them.

## 1. Summary

SPEC-292 made featuring real for the **plan** entitlement source only. But in
Hospeda billing an entitlement can be granted by a **plan OR a customer-level
addon**, and `loadEntitlements` resolves the **union** of both. The two
`visibility-boost` addons grant `FEATURED_LISTING` but are not wired, so a paid
addon does nothing and a plan downgrade wrongly clears featuring for an owner who
still holds an active addon. This spec wires the addon source and hardens the
remaining robustness gaps from the SPEC-292 review.

## 2. Context — what SPEC-292 left (verified 2026-06-30)

SPEC-292 shipped: `accommodations.featuredByPlan` column (migration 0035), the
`isFeatured OR featuredByPlan` search sort, the owner-leak closure, the
`syncFeaturedByPlan` bulk primitive, 8 billing lifecycle hooks (T-005), and the
`featured-by-plan-reconcile` cron (T-006). All resolve featuring from the **plan
only**.

Deferred review findings (this spec's scope):

- **H-1** — `visibility-boost-7d` / `visibility-boost-30d`
  (`packages/billing/src/config/addons.config.ts`, `isActive: true`) carry
  `grantsEntitlement: FEATURED_LISTING` at the **customer** level. The real
  resolver `apps/api/src/middlewares/entitlement.ts` (≈553-558) resolves
  FEATURED_LISTING as **plan entitlements UNION
  `billing.entitlements.getByCustomerId`** (addon grants). SPEC-292's hooks
  (`getPlanBySlug(...).entitlements.includes(...)`) and cron
  (`plan.entitlements.some(...)`) only read the plan. Consequences: (a) an addon
  bought on a non-featured plan never features (the paid addon silently does
  nothing); (b) a downgrade off a featured plan clears `featuredByPlan` even though
  a live addon still grants it, and the cron keeps it cleared.
- **M-3** — `syncFeaturedByPlan`
  (`packages/service-core/src/services/accommodation/accommodation.sync-featured-by-plan.ts`)
  does NOT trigger ISR revalidation, unlike the sibling
  `subscription-pause.service.ts` which revalidates affected accommodations after an
  owner-wide bulk write. If featured ordering surfaces on cached public/search
  pages, a featuring change is invisible until TTL expiry.
- **M-4** — the 8 T-005 billing call-sites have no direct unit tests (per-transition
  `active` derivation, ownerId resolution, soft-fail isolation are unasserted).
- **M-5** — resolver divergence: the T-005 hooks skip `paused` (and never grant on
  `comp`), while `loadEntitlements` / the T-006 cron treat `paused` as inactive and
  `comp` as active. Self-heals within ≤6h via the cron, but the hooks should align.

(Operational, NOT in this spec — tracked in the SPEC-292 deploy notes / release
ledger: run `pnpm db:migrate` for 0035 and run the reconcile cron once post-deploy
to backfill — review item M-2.)

## 3. Goals

- **G-1** Both the T-005 hooks and the T-006 cron resolve FEATURED_LISTING from the
  **union** of plan + customer-level addon entitlements (mirror `loadEntitlements`),
  so addon-granted featuring works and a plan downgrade never clears featuring while
  a live addon still grants it.
- **G-2** Add an addon purchase / expiry hook (or extend the existing addon
  lifecycle events from SPEC-043) that calls `syncFeaturedByPlan` when a
  FEATURED_LISTING-granting addon is bought or lapses.
- **G-3** (M-3) Trigger ISR revalidation for affected accommodations after
  `syncFeaturedByPlan`, mirroring `subscription-pause.service.ts` — if/once it is
  confirmed the public featured ordering is cached.
- **G-4** (M-4) Add direct unit tests for the T-005 transition→`active` derivation
  and the soft-fail isolation of the sync call.
- **G-5** (M-5) Align the T-005 hook status handling with `loadEntitlements` /
  the cron (`paused` → inactive consistently; grant on `comp`).

## 4. Non-Goals

- No change to the featuring UX (admin manual + owner automatic stays as SPEC-292
  shipped).
- No new boost mechanism — this only wires the EXISTING `visibility-boost` addons.
- No change to the `featuredByPlan` column / migration (already shipped).

## 5. Open Questions

- **OQ-1** Naming: `featuredByPlan` becomes a misnomer once addons also drive it
  (it is really "featured by active entitlement"). Rename the column to
  `featuredByEntitlement` (migration + churn) or keep the name and document that it
  covers plan + addon? Lean: keep the name + document, to avoid a rename migration.
- **OQ-2** Is the public featured ordering actually served from a cached page
  (determines whether G-3/M-3 is required or a no-op)?
- **OQ-3** Should a FEATURED_LISTING addon on a non-featured plan feature ALL the
  owner's accommodations (consistent with the plan behavior, no cap), or is the
  addon scoped to a single listing? (The addon is described per-accommodation;
  the plan model is owner-wide. Resolve before implementing G-1/G-2.)

## 6. Relationship to SPEC-292

SPEC-292 is the base (merged). This spec must NOT regress the plan-only path; it
extends it to the addon source and hardens the wiring. Implementation will need its
own worktree (Phase 2).
