---
specId: SPEC-287
title: Favorites Collections — Per-Plan Limits
type: feat
complexity: medium
status: draft
created: 2026-06-26
tags: [tourist, favorites, collections, billing, entitlements, limits]
---

# SPEC-287 — Favorites Collections — Per-Plan Limits

> Moves an already-built feature under the billing plan system. Surfaced during the
> SPEC-282 review.

## 1. Summary

Favorites collections (organizing saved favorites into named collections) is
**fully implemented**: `user_bookmark_collections` table, a substantial
`UserBookmarkCollectionService`, registered routes
(`/api/v1/protected/user-bookmark-collections`), and a rich web UI under
`/mi-cuenta/favoritos`.

But it does **not** pass through billing: the cap (default 10) is enforced at the
service layer via the env var `HOSPEDA_MAX_COLLECTIONS_PER_USER` — the same for
everyone, with no per-plan differentiation and no entitlement gate.

The owner decided to make collections a **plan-differentiated** feature:
**not available to tourist-free**, available to all paid plans, with a **per-plan
limit**.

## 2. Context

- **Verified 2026-06-26:** feature built; capped by env var, not a billing
  `LimitKey`. Free tourists currently get it (10) — this spec removes that.

## 3. Goals

- **G-1** Introduce a billing `EntitlementKey` (e.g. `CAN_USE_COLLECTIONS`) +
  `LimitKey` (e.g. `MAX_COLLECTIONS`) for collections.
- **G-2** Add to `plans.config.ts`: tourist-free = no entitlement; paid plans =
  granted with per-plan limit values (OQ-2). Add `LIMIT_METADATA` +
  `RESOURCE_NAMES` + `MODEL_C_FIELD_SPLIT` entries (compile-time required).
- **G-3** Switch the service cap from the env var to the resolved plan limit;
  mount the entitlement gate on the collection routes.
- **G-4** Model C extras migration to propagate the new keys to live plan rows.

## 4. Non-Goals

- No change to the collections UI/UX (already built) beyond the gate + limit
  enforcement.
- No data migration of existing collections (forward-only; existing collections
  over a new lower cap are read-only — OQ-3).

## 5. Open Questions

- **OQ-1** Entitlement + limit key names.
- **OQ-2** Per-plan limit values (confirm at implementation — values are
  commercial-layer / DB-editable per Model C).
- **OQ-3** Behavior for free tourists who already have collections, and for users
  above a newly-lowered cap (grandfather read-only vs block creation only).

## 6. Relationship to SPEC-282

The "Colecciones de favoritos" row currently maps to no plan data. SPEC-282 should
show it as the **target** (free ✗, paid ✓ with per-plan limits) but badged
*Próximamente* until SPEC-287 enforces the gating — advertising an unenforced
per-plan limit is a correctness/honesty bug (same rule as SPEC-283).
