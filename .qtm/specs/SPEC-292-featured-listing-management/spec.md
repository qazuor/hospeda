---
specId: SPEC-292
title: Featured Listing Management
type: feat
complexity: medium
status: draft
created: 2026-06-26
tags: [owner, featured, admin, entitlements, search]
---

# SPEC-292 — Featured Listing Management

> Wires a feature whose pieces exist but is **not actually settable**. Surfaced
> during the SPEC-282 review (owner-side audit).

## 1. Summary

The `FEATURED_LISTING` entitlement is granted to pro/premium owner & complex plans,
and the plumbing partially exists — `accommodation.isFeatured` column + a search
sort that prepends featured listings + an admin inline toggle
(`InlineFeaturedCell`, gated by `ACCOMMODATION_FEATURED_TOGGLE`). **But there is no
working path to actually set it**: no API route accepts `isFeatured` (the only
"featured" routes set the featured **photo** of a gallery, not the listing boost),
so the admin toggle is **cosmetic**, and the `FEATURED_LISTING` entitlement is
never enforced anywhere.

This spec makes featuring real and connects it to the plan.

## 2. Context

- **Verified 2026-06-26:** DB column + search sort + admin UI toggle exist; **no API
  route sets `accommodation.isFeatured`**; `FEATURED_LISTING` entitlement has zero
  enforcement; owner has no self-serve path.

## 3. Goals

- **G-1** A working endpoint to set/unset `accommodation.isFeatured` (back the admin
  inline toggle).
- **G-2** Decide and implement who features: admin-managed, owner self-serve (gated
  by `FEATURED_LISTING`), or both (OQ-1).
- **G-3** Enforce the `FEATURED_LISTING` entitlement on the owner-facing path; an
  owner without the plan cannot feature.

## 4. Non-Goals

- No paid one-off "boost" purchase here (that is the existing visibility-boost
  addon territory).

## 5. Open Questions

- **OQ-1** Featuring model: admin-curated only, owner self-serve (entitlement-gated),
  or both. Is there a cap on how many of an owner's listings can be featured?
- **OQ-2** Does the admin toggle stay independent of the entitlement (admin can
  feature anyone) while the owner path is gated?

## 6. Relationship to SPEC-282

The "Listing destacado" row stays *Próximamente* until featuring is actually
settable and entitlement-wired.
