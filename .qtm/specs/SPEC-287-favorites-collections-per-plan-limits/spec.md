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

## 5. Open Questions (resolved 2026-07-01)

- **OQ-1 (resolved):** `EntitlementKey.CAN_USE_COLLECTIONS` / `LimitKey.MAX_COLLECTIONS`,
  following the existing `CAN_USE_*` / `MAX_*` naming convention.
- **OQ-2 (resolved):** tourist-plus = 10, tourist-vip = 25. Tourist-free has no
  entitlement (no access at all).
- **OQ-3 (resolved):** no grandfather handling needed. No real users exist yet
  (not even in beta), so there is no pre-existing data to reconcile — the limit
  and entitlement gate are simply enforced going forward at creation time. No
  read-only mode, no retroactive access removal logic required.

## 6. Relationship to SPEC-282

The "Colecciones de favoritos" row currently maps to no plan data. SPEC-282 should
show it as the **target** (free ✗, paid ✓ with per-plan limits) but badged
*Próximamente* until SPEC-287 enforces the gating — advertising an unenforced
per-plan limit is a correctness/honesty bug (same rule as SPEC-283).
