# ADR-026: Collections Limit Strategy

## Status

Accepted (2026-05-02)

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
