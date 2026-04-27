# SPEC-088: BaseCrudRead — Strip Pagination & Sort Keys Before Service Hooks

> **Status**: completed (2026-04-26)
> **Priority**: P2
> **Complexity**: 5
> **Origin**: 2026-04-18 incident — home page loaded against dev API returned HTTP 500 on `/api/v1/public/destinations`, `/api/v1/public/stats`, `/api/v1/public/posts`. Warnings across review services.
> **Depends on**: none
> **Related**: SPEC-060 (BaseCrudService transaction infrastructure), SPEC-066 (getById relation loading consistency)
> **Closing commit**: `2107ab95` — `fix(service-core): strip pagination keys from filters in BaseCrudRead`

---

## Problem Statement

Concrete `_executeSearch` and `_executeCount` hooks in every `BaseCrudService` subclass are individually responsible for stripping pagination (`page`, `pageSize`) and sort (`sortBy`, `sortOrder`) keys from their `params` before forwarding `filterParams` to `model.findAll()` / `model.count()`. The base class does not strip them, so any service that forgets to destructure leaks those keys into `buildWhereClause`, which treats unknown keys as either:

1. A warning + silent skip when at least ONE valid column is also present, or
2. A hard `DbError` ("All N key(s) in where clause were unknown columns — likely a programming error") when every key is foreign to the table.

### Concrete incident (2026-04-18)

A fresh home page load against the dev API produced the following HTTP 500s:

- `GET /api/v1/public/posts?sortBy=publishedAt&sortOrder=desc&pageSize=4` — `PostService._executeSearch` forwarded `sortBy`, `sortOrder` to the WHERE.
- `GET /api/v1/public/stats` — `PostService._executeCount` and `EventService._executeCount` forwarded `page`, `pageSize`, `sortOrder` to the WHERE.
- `GET /api/v1/public/destinations?destinationType=CITY&pageSize=50` — `DestinationService._executeSearch` forwarded unimplemented filter keys (`q`, `latitude`, `longitude`, `radius`, `minAccommodations`, `maxAccommodations`, `minRating`, `tags`) — this sub-case belongs to a separate decision, tracked outside this SPEC.

Silent warnings were also emitted by `accommodation_reviews` and `destination_reviews` for the same root cause (didn't throw only because `deletedAt: null` kept at least one valid column in the WHERE).

A point fix landed 2026-04-18 against the four obvious offenders (`PostService`, `EventService`, `AccommodationReviewService`, `DestinationReviewService`), plus a regression test at `packages/service-core/test/services/where-leak.regression.test.ts`. That fix is tactical; the systemic risk remains in every other service.

### Scope of the latent gap

22 service files implement `_executeSearch` / `_executeCount`:

```
accommodation, accommodationReview, amenity, attraction, destination, destinationReview,
event, eventLocation, eventOrganizer, exchange-rate, feature, owner-promotion, post,
postSponsor, postSponsorship, sponsorship, sponsorshipLevel, sponsorshipPackage, tag,
user, userBookmark
```

Every single one is a potential re-occurrence: a maintainer adds `sortBy` to the base search schema, or a consumer starts sending `sortOrder` for the first time, and a previously "fine" service now throws 500s in production because it never destructured those keys.

### Why this is systemic, not incidental

- The contract that every subclass **MUST** destructure pagination/sort keys is **nowhere enforced**: no type constraint, no lint rule, no base-class guarantee. It's a convention held together by vigilance.
- The keys are declared on shared base schemas (`BasePaginationSchema`, `BaseSortSchema`), so they're guaranteed to appear in every `_executeSearch` input — yet each service has to re-destructure them defensively.
- `buildWhereClause` correctly refuses unknown columns (this is a feature — it catches real typos), so we cannot "just be lenient" at that layer.

---

## Proposed Solutions

### Option A: Strip in `BaseCrudRead` before invoking hooks (recommended)

Modify `BaseCrudRead.search` and `BaseCrudRead.count` (in `packages/service-core/src/base/base.crud.read.ts`) so that the `params` passed to `_executeSearch` and `_executeCount` has `page`, `pageSize`, `sortBy`, `sortOrder` REMOVED (not just destructured — actively removed before the hook call). Pagination is passed separately as a structured second argument (or via `ctx`), sort is applied by the base via `buildOrderByClause`.

**Pros**:
- One-point-of-control fix: the base class guarantees that subclasses never see those keys. Impossible to forget.
- Removes 22 copies of the same defensive destructure pattern — net LOC reduction and less boilerplate.
- Surfaces the intent: subclasses deal with **filters**, the base deals with **pagination/sort**.
- Aligns with SPEC-087's spirit (fix at the factory, not at each handler).

**Cons**:
- Every `_executeSearch` / `_executeCount` signature implicitly changes (params no longer contains pagination/sort). Every override must be audited — any subclass that relies on `params.page` (e.g., for logging, conditional logic, or manual pagination like `DestinationService` ancestor branch at line 257) needs to receive pagination explicitly.
- The sort handling currently embedded in some services (e.g., passing `sortBy`/`sortOrder` to `buildOrderByClause` inside the service) needs to move to the base or be threaded via a new hook argument.
- Breaking change for external consumers of `BaseCrudService` (if any) — realistically none, all consumers are in this monorepo.

### Option B: New hook signature with explicit pagination/sort args

Introduce `_executeSearch(filters, pagination, sort, actor, ctx)` and `_executeCount(filters, actor, ctx)` with a deprecation shim for the current signature.

**Pros**:
- Most explicit; compiler catches forgetting to handle pagination.
- Gradual migration path.

**Cons**:
- Bigger refactor (22 services).
- Deprecation shim means two code paths for months; adds complexity before reducing it.

### Option C: Keep current signature, add lint rule

Write a custom Biome or TypeScript rule that flags any `_executeSearch` / `_executeCount` body that does not destructure all 4 keys.

**Pros**:
- Zero runtime change.
- Low blast radius.

**Cons**:
- Custom lint rule is its own maintenance burden.
- Doesn't address the ergonomic problem — subclasses still do defensive boilerplate.
- Doesn't cover the `DestinationService` unimplemented-filter variant (`q`, `latitude`, etc.).

### Option D: Allow-list of "reserved" keys inside `buildWhereClause`

Teach `buildWhereClause` to silently ignore `['page', 'pageSize', 'sortBy', 'sortOrder']` without warning or error.

**Pros**:
- Zero refactor.
- Unlocks the current home page immediately.

**Cons**:
- Masks real service-layer bugs (a forgotten destructure goes undetected).
- `buildWhereClause`'s current error is a FEATURE (it catches typos like `feauted: true`). Making it lenient on pagination keys is a slippery slope.
- Does not fix the semantic mismatch — pagination keys still threaded through layers they don't belong in.

### Recommendation

**Option A**, staged:

1. Phase 1 (this SPEC): refactor `BaseCrudRead.search` and `BaseCrudRead.count` to strip `page`, `pageSize`, `sortBy`, `sortOrder` from `params` before invoking the hooks. Thread pagination via a second hook argument, pass the already-validated sort via `orderBy` (either as SQL fragment or as `{ column, direction }`).
2. Phase 2 (each service): remove the now-redundant destructure from each `_executeSearch` / `_executeCount`. Update any service that reads `params.page` from the manual pagination path (audit required for `DestinationService.ancestorId` branch specifically).
3. Phase 3: delete `where-leak.regression.test.ts` OR repurpose it to assert the base-class contract (that subclasses never see reserved keys) — decide during apply.

---

## Acceptance Criteria

**AC-088-01**: `BaseCrudRead.search` strips `page`, `pageSize`, `sortBy`, `sortOrder` from `params` before calling `_executeSearch`.

**AC-088-02**: `BaseCrudRead.count` strips the same keys before calling `_executeCount`.

**AC-088-03**: Pagination reaches `_executeSearch` via an explicit second argument (or `ctx.pagination`), not via `params`.

**AC-088-04**: A regression test exists that, for at least 4 representative services (post, event, accommodationReview, destinationReview), verifies no reserved key appears in the first argument of `model.findAll` / `model.count`.

**AC-088-05**: The existing `packages/service-core/test/services/where-leak.regression.test.ts` passes unchanged after the refactor (or is explicitly updated + documented as part of the SPEC).

**AC-088-06**: No public/protected/admin endpoint regresses. Manual smoke: home page load (`GET /api/v1/public/posts`, `/public/stats`, `/public/destinations`, `/public/accommodations`, `/public/events/upcoming`, `/public/testimonials`) returns 200.

**AC-088-07**: Admin list endpoints (e.g., `GET /api/v1/admin/posts`) still paginate and sort correctly — parity verified via existing admin tests.

**AC-088-08**: Lint + typecheck + full `@repo/service-core` test suite pass.

---

## Out of Scope

- **`DestinationSearchInput` unimplemented filters** (`q`, `latitude`, `longitude`, `radius`, `minAccommodations`, `maxAccommodations`, `minRating`, `tags`): separate decision required — implement the filters, remove from schema, or silently drop. Tracked outside this SPEC.
- **`adminList` flow**: `BaseCrudRead.adminList` already has its own stripping path (destructures `page`, `pageSize`, `search`, `sort`, `status`, `includeDeleted`, `createdAfter`, `createdBefore` at line 387-397). Re-use or refactor is a design decision for the apply phase.
- **`list` flow**: already consistent, no leak observed.
- **Write hooks** (`_beforeCreate`, `_afterUpdate`, etc.): out of scope; they don't touch WHERE-clause construction.

---

## Risks

- **Subclass signature change**: if a third-party or generated service extends `BaseCrudService` outside this monorepo, the refactor breaks their override. Mitigation: grep proves there are none; the package is internal.
- **Manual pagination branches**: `DestinationService._executeSearch` has a manual pagination path (ancestor-id branch, line 257) that uses `page`/`pageSize` directly. Needs to receive them via the new explicit argument.
- **Sort field validation timing**: currently each service validates `sortBy` against its table's columns inside the hook. Moving that to the base means the base needs access to the service's table — manageable via a `sortableColumns` getter or a metadata hook.

---

## References

- Incident log (2026-04-18): home page HTTP 500 errors, reported by user.
- Point fix commit: TBD (4 services + regression test landed this session).
- Related code:
  - `packages/service-core/src/base/base.crud.read.ts:305-332` (`search`)
  - `packages/service-core/src/base/base.crud.read.ts` (`count` — line TBD)
  - `packages/db/src/utils/drizzle-helpers.ts:140-188` (`buildWhereClause`)
  - `packages/service-core/test/services/where-leak.regression.test.ts` (regression lock)
