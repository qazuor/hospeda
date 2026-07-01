# ADR-026: Collections Limit Strategy

## Status

Accepted (2026-05-02). **Superseded by SPEC-287 (2026-07-01)** — see the
Addendum section at the end of this document.

## Context

SPEC-098 introduces user-created bookmark collections (wishlists). We needed to decide the limit strategy:

1. Plan-based monetization (consistent with `enforceFavoritesLimit` middleware).
2. Hardcoded universal limit.
3. Hardcoded env-configurable limit.

## Decision

Option 3: hardcoded env-configurable limit, default 10 per user. Configurable via `HOSPEDA_MAX_COLLECTIONS_PER_USER` env var. Validation lives in `UserBookmarkCollectionService._canCreate` (NOT a middleware).

## Rationale

- Pre-beta: no point monetizing something most users won't hit.
- Collections are an organizational tool (UX/abuse-protective), not a monetization lever.
- Bookmarks themselves remain plan-based via `enforceFavoritesLimit` (Tourist Free=3, Plus=20, VIP=∞).
- Env configurability allows operations to tune the cap without a code release.
- Service-level guard surfaces a structured `QUOTA_EXCEEDED` error with `{ currentCount, maxAllowed }` so UI can display "X / Y used" counter.

## Future-proof migration path

If a future product decision makes collections a monetization lever:

1. Add `MAX_COLLECTIONS` to `LimitKey` in `@repo/billing`.
2. Define plan quotas in `packages/billing/src/config/plans.config.ts`.
3. Create `enforceCollectionsLimit` middleware (mirror `enforceFavoritesLimit`).
4. Move the guard from service `_canCreate` to the middleware.
5. Remove the env var.

The current implementation isolates the limit check to a single method, making this migration low-risk.

## Consequences

- (+) Simple implementation; minimal billing complexity.
- (+) Allows opt-out / tuning per environment.
- (-) If monetization is later desired, requires refactor (although small in scope).

## Addendum (2026-07-01) — Superseded by SPEC-287

The "future product decision" anticipated above happened: SPEC-287 (Favorites
Collections — Per-Plan Limits) moved collections to the plan-based monetization
strategy this ADR originally rejected (Option 1). `HOSPEDA_MAX_COLLECTIONS_PER_USER`
is removed; the cap is now `LimitKey.MAX_COLLECTIONS` (tourist-plus = 10,
tourist-vip / owner / complex = 25), and tourist-free has **no entitlement at
all** — a stricter cut than any option this ADR considered, since free lost
access entirely rather than keeping a lower shared cap.

The predicted "Future-proof migration path" (steps 1-5 above) got most of the
shape right but not the mechanism for step 3-4. It predicted mirroring
`enforceFavoritesLimit` (a pure numeric-limit middleware, no entitlement check —
correct for favorites, where every tourist tier has *some* access). Collections
needed an **entitlement gate** instead (`gateCollections()`, mirrors
`gateSearchHistory()`), because excluding tourist-free entirely is a boolean
access question, not just a lower quota. The numeric cap is still enforced
service-side (as this ADR specified), but reading the resolved plan limit
turned out to require a mechanism this ADR didn't anticipate: `_canCreate` (the
service hook this ADR pointed the guard at) never receives `ctx` from
`BaseCrudService.create()` (a pre-existing gap, tracked as
[BETA-106](https://linear.app/hospeda-beta/issue/BETA-106)) — so the quota
check moved to `createCollection()`'s own execute callback, which reads the
limit from `ctx.hookState.planLimit` instead.

See `packages/billing/src/config/plans.config.ts` (plan quotas),
`apps/api/src/middlewares/tourist-entitlements.ts` (`gateCollections`),
`packages/service-core/src/services/userBookmarkCollection/userBookmarkCollection.service.ts`
(`createCollection`), and `docs/billing/endpoint-gate-matrix.md` for the
current implementation.
