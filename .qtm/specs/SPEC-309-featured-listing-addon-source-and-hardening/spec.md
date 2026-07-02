---
specId: SPEC-309
title: Featured Listing — Addon Source + Hardening
type: feat
complexity: medium
status: in-progress
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
  a live addon still grants it. Plan-derived featuring stays **owner-wide** (all of
  the owner's accommodations); addon-derived featuring is **scoped to the single
  accommodation the addon was purchased for** (see OQ-3 resolution) — the union
  happens at the per-accommodation `featuredByEntitlement` flag, not by broadening
  the addon to the whole owner.
- **G-2** Add an addon purchase / expiry hook that calls `syncFeaturedByPlan` (or
  its per-accommodation equivalent) when a FEATURED_LISTING-granting addon is
  bought or expires. Reuses the EXISTING expiry infrastructure — `durationDays` →
  `expiresAt` (`addon-entitlement.service.ts`, `addon.checkout.ts`) and the
  existing `addon-expiry.job.ts` cron — no new cron needed (see OQ-5 resolution).
- **G-3** (M-3) Trigger ISR/CDN revalidation for affected accommodations after
  `syncFeaturedByPlan`. **Confirmed required** (see OQ-2 resolution): the search
  listing page is SSR+ISR with a Cloudflare edge cache up to 24h, and the home page
  is SSG (needs a redeploy to update). The actual gap is that all 7 call-sites that
  write `featuredByPlan`/`featuredByEntitlement` (`apply-scheduled-plan-changes.ts`,
  `dunning.job.ts`, `finalize-cancelled-subs.ts`, `qzpay-admin-hooks.ts` ×2,
  `payment-logic.ts` ×2, `subscription-logic.ts`, `featured-by-plan-reconcile.job.ts`)
  currently skip revalidation — wire a selective purge (not zone-wide, given the
  volume of these jobs) into `syncFeaturedByPlan` itself so every call-site gets it
  for free.
- **G-4** (M-4) Add direct unit tests for the T-005 transition→`active` derivation
  and the soft-fail isolation of the sync call.
- **G-5** (M-5) Align the T-005 hook status handling with `loadEntitlements` /
  the cron (`paused` → inactive consistently; grant on `comp`).
- **G-6** (folded from SPEC-320) Optional owner self-service toggle for
  `isFeatured` in the web owner editor, guarded so it only applies within the
  owner's active FEATURED_LISTING entitlement (plan or addon). No slot cap (see
  OQ-4 resolution) — the toggle is a pure visibility switch within an entitlement
  the owner already holds, no rotation/queue logic needed.

## 4. Non-Goals

- No change to the featuring UX beyond G-6 (admin manual + owner automatic
  stays as SPEC-292 shipped; G-6 only adds an owner-facing toggle gated by an
  existing entitlement).
- No new boost mechanism — this only wires the EXISTING `visibility-boost` addons.
- No featured-slot cap / rotation / queue system (OQ-4 resolved: uncapped).
- No new expiry cron (OQ-5 resolved: reuse `addon-expiry.job.ts`).

## 5. Open Questions (resolved 2026-07-01)

- **OQ-1 — RESOLVED: rename.** `featuredByPlan` → `featuredByEntitlement`
  (new migration + update all call-sites: search sort, T-005 hooks, T-006 cron,
  G-2's addon hook). Chosen over keep-name-and-document for long-term clarity now
  that the column reflects plan+addon, not plan only.
- **OQ-2 — RESOLVED: yes, revalidation is required.** Verified: the search listing
  page (`apps/web/src/pages/[lang]/alojamientos/index.astro`) is documented
  `SSR + ISR 24h` with Cloudflare edge caching; the home page
  (`apps/web/src/pages/[lang]/index.astro`) is `prerender = true` (SSG, needs a
  redeploy to refresh). Without revalidation a featuring change can take up to 24h
  (search) or require a redeploy (home) to appear. G-3 is in scope, not conditional.
- **OQ-3 — RESOLVED: scoped to a single accommodation.** An addon-derived
  FEATURED_LISTING grant features only the accommodation the addon was purchased
  for, not the owner's whole portfolio — matches how the addon is sold
  (per-accommodation pricing/copy) even though it costs more implementation work
  than mirroring the owner-wide plan behavior (need to track which accommodation
  an addon purchase applies to, likely via a link table analogous to
  `commerce_listing_subscriptions`, and split the resolution logic: plan =
  owner-wide, addon = scoped).
- **OQ-4 — RESOLVED: no cap.** Featured listing stays uncapped — every owner who
  qualifies (by plan or addon) is shown as featured, no rotation or queue. Keeps
  G-6's self-service toggle simple (pure gate on an existing entitlement, no slot
  allocation). Revisit as a separate spec if an uncapped model dilutes the
  "featured" signal in practice.
- **OQ-5 — RESOLVED: reuse existing expiry infra, no new cron.** The addon's
  featuring window is already time-bounded by `durationDays` (7 / 30 days,
  `packages/billing/src/config/addons.config.ts`), which the existing
  `addon-entitlement.service.ts` / `addon.checkout.ts` already turn into an
  `expiresAt`, and `apps/api/src/cron/jobs/addon-expiry.job.ts` already runs on
  that schedule. G-2 hooks into that existing flow instead of building new cron
  logic.

## 6. Relationship to SPEC-292

SPEC-292 is the base (merged). This spec must NOT regress the plan-only path; it
extends it to the addon source and hardens the wiring. Implementation will need its
own worktree (Phase 2).

## 7. Related

- **SPEC-320** (Featured Listing Automation) — duplicate/overlapping stub
  generated independently by the SPEC-310 roadmap audit (created 2026-06-30).
  Its premise ("no auto-activation exists") was stale — SPEC-292 (merged PR
  #1930, same day) already shipped plan-based auto-activation; what remained
  was exactly this spec's addon-source gap (G-1/G-2). Consolidated into this
  spec on 2026-07-01 (folded in G-6 self-service toggle, OQ-4 slots/rotation,
  OQ-5 addon duration); marked `obsolete` in the tracking indices.
