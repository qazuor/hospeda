---
specId: SPEC-291
title: Accommodation Verification Badge
type: feat
complexity: medium
status: in-progress
created: 2026-06-26
tags: [owner, verification, trust, entitlements, web]
---

# SPEC-291 — Accommodation Verification Badge

> Builds a feature that today is **dead code**. Surfaced during the SPEC-282 review
> (owner-side audit).

## 1. Summary

The entitlement `HAS_VERIFICATION_BADGE` is granted to premium owner/complex plans,
but the feature **does not exist**. `apps/api/src/utils/entitlement-filter.ts`
references a `verificationBadge?: boolean` interface field and strips it when the
owner lacks the entitlement — but **no DB column, no schema field, and no service
ever produces it**, and **nothing renders a badge** in the web app. The filter is
dead code guarding a field that is never set.

This spec builds the real verification-badge feature: a trust signal on verified
accommodations, gated by the owner's plan (and presumably an actual verification
step).

## 2. Context

- **Verified 2026-06-26:** dead filter code only; no DB column, no producer, no
  render.

## 3. Goals

- **G-1** Define what "verified" means (manual admin verification? document check?)
  and persist it (DB column + schema).
- **G-2** Gate badge display on `HAS_VERIFICATION_BADGE` **and** an actual verified
  state.
- **G-3** Render the badge on listing cards + detail page.

## 4. Non-Goals

- No automated identity/KYC verification in v1 (manual admin verification — OQ-1).

## 5. Open Questions — RESOLVED (owner, 2026-06-30)

- **OQ-1 → RESOLVED: manual admin toggle.** Verification is a manual admin action.
  New columns on `accommodations`: `is_verified` (bool), `verified_at` (tz),
  `verified_by_id` (uuid FK→users). NO KYC / document flow in v1.
- **OQ-2 → RESOLVED: BOTH.** The badge renders only when the owner has the
  `HAS_VERIFICATION_BADGE` entitlement AND the accommodation is in a verified state.
  A verified owner without the entitlement (e.g. free/low plan) shows NO badge — the
  badge is a paid perk plus a trust signal. Admin verification is independent of the
  owner's plan; the entitlement only gates DISPLAY.

## 6. Decisions

- **D-1 Gate on ALL surfaces (owner, 2026-06-30).** The entitlement gate currently
  runs only on the detail route (`getById`/`getBySlug`). To honour OQ-2 consistently
  on listing cards, the owner-entitlement resolution is extended to the list
  endpoints (`list`, `getByDestination`, `similar`, `getTopRatedByDestination`,
  `getSummary`) via a BATCH resolver (one entitlements query per page over the unique
  owner IDs, not N per-card queries).
- **D-2 Dedicated verify action.** `isVerified` is server-managed and NOT settable via
  the generic accommodation update (PATCH); a dedicated `POST /admin/accommodations/
  :id/verify` endpoint + `verifyAccommodation()` service method also stamp
  `verified_at` / `verified_by_id`. New permission `ACCOMMODATION_VERIFY` (admin-only).
- **D-3 Fix pre-existing actor bug.** The dead `entitlement-filter.ts` checked the
  VIEWER's entitlement; the real implementation checks the OWNER's (same pattern as
  `CAN_USE_RICH_DESCRIPTION` / `richDescription`).

## 7. Relationship to SPEC-282

The "Badge de verificación" row stays *Próximamente* until this ships. Flip the
`PlanComparisonTable` `verificationBadge` row from `upcoming` to `available` on ship.

## 8. Related

- **SPEC-319** — duplicate stub of this spec, generated independently by the
  SPEC-310 roadmap audit (created 2026-06-30, same `HAS_VERIFICATION_BADGE`
  phantom feature). Its open question about revocation-on-downgrade is already
  answered by D-2/D-3 above: `isVerified` is server-managed and independent of
  the owner's plan — the entitlement only gates DISPLAY, so a downgrade hides
  the badge without clearing the underlying verified state. Consolidated into
  this spec on 2026-07-01; marked `obsolete` in the tracking indices.
