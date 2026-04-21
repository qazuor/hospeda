# SPEC-063 Gaps Audit — Lifecycle State Standardization

> **Spec status claim**: `completed` (56/63 tasks + 7 deferred under push-only policy)
> **Audit scope**: contrast spec vs. real code for AccommodationReview, OwnerPromotion, Sponsorship, DestinationReview
> **Method**: parallel Explore sub-agents + orchestrator verification (file reads + line-by-line inspection + live `pnpm typecheck` + `pnpm vitest run`)
> **Passes performed so far**: **5** (see "Audit passes performed" table at the end)

---

## Audit Pass 1 — 2026-04-20

**Auditor**: Claude Opus 4.7 (tech-lead orchestrator + 3 Explore sub-agents)
**Verification tools**: Read + Grep + Bash (typecheck + vitest)
**Total files inspected (first-hand by orchestrator)**: 11 critical files confirmed
**Pre-conditions verified**:
- `packages/db/docs/advisory-locks.md` exists · lock 43010 registered correctly for SPEC-063
- `packages/schemas` tests: **2900/2900 pass** (TODOs.md claim of 3 pre-existing failures is STALE — tests are green)
- `packages/service-core` typecheck: 1 residual error in `test/base/crud/getById.test.ts:379` (SPEC-066 preexisting, NOT SPEC-063; TODOs.md claim of "5 typecheck errors in destinationReview" is STALE)
- T-029 artifacts (`0005_awesome_wild_child.sql`, its `_down.sql`) already deleted · push-only cleanup done
- `SPEC-087-public-response-schema-strip` exists as draft spec — absorbs the per-handler strip workaround

### Summary of findings (12 gaps)

| # | ID | Severity | Priority | Complexity | Area | Decision |
|---|----|----------|----------|------------|------|----------|
| 1 | GAP-063-001 | **CRITICAL** | P0 | 2 | Service (AccommodationReviewService.listByAccommodation) | Fix directly |
| 2 | GAP-063-002 | **CRITICAL** | P0 | 2 | Service + Route (DestinationReview public list) | Fix directly |
| 3 | GAP-063-003 | **CRITICAL** | P0 | 2 | Service (DestinationReviewService._executeSearch/_executeCount) | Fix directly |
| 4 | GAP-063-004 | **HIGH** | P1 | 2 | Service (AccommodationReviewService._executeSearch/_executeCount) | Fix directly |
| 5 | GAP-063-005 | **HIGH** | P1 | 2 | Route (OwnerPromotion public getById) | Fix directly |
| 6 | GAP-063-006 | MEDIUM | P2 | 1 | Admin frontend (sponsor-dashboard hooks query param) | Fix directly |
| 7 | GAP-063-007 | LOW | P3 | 1 | Admin frontend (sponsor-dashboard types) | Fix directly |
| 8 | GAP-063-008 | LOW | P3 | 1 | Docs (TODOs.md follow-ups are stale) | Fix directly |
| 9 | GAP-063-009 | LOW | P3 | 1 | Docs (spec says `pg_try_advisory_lock` but code uses `pg_try_advisory_xact_lock`) | Fix directly |
| 10 | GAP-063-010 | INFO | — | — | SPEC-087 systemic dependency | Tracked in SPEC-087 |
| 11 | GAP-063-011 | MEDIUM | P2 | 2 | Service (AccommodationReviewService.listByAccommodation missing test for ACTIVE filter) | Fix directly after GAP-063-001 |
| 12 | GAP-063-012 | LOW | P3 | 2 | Missing observability (no audit log when cron archives) | Defer/evaluate |

---

## GAP-063-001 — AccommodationReviewService.listByAccommodation leaks DRAFT/ARCHIVED reviews on public tier

> **Discovered in**: Audit Pass 1 (2026-04-20)
> **Re-verified in Pass 2 (2026-04-20)**: **STILL PRESENT** — lines 513-518 unchanged; filter is `{ accommodationId, deletedAt: null }` without `lifecycleState`.
> **Severity**: **CRITICAL** (security + AC-005-01 violation)
> **Priority**: P0
> **Complexity**: 2 (1-line filter + regression test)

### File / line

`packages/service-core/src/services/accommodationReview/accommodationReview.service.ts:501-526`

### Evidence

```ts
// lines 513-518
const result = await this.model.findAll(
    { accommodationId, deletedAt: null },  // ← NO lifecycleState filter
    { page, pageSize },
    undefined,
    ctx?.tx
);
```

This method is the only one called by the public endpoint `GET /api/v1/public/accommodations/{accommodationId}/reviews` (see `apps/api/src/routes/accommodation/reviews/public/list.ts:45`). The per-handler strip at `list.ts:102-110` removes the `lifecycleState` field from the response — but the review records themselves (author, rating, content, createdAt, …) of DRAFT and ARCHIVED reviews are still returned to anonymous callers.

### What the spec required

Per **AC-005-01** and **Phase 1 verification** + the implementation note at `spec.md:234`:

> "Public listing endpoints filter by lifecycleState = ACTIVE implicitly. The filtering is enforced at the service layer… Public search normalizers must inject `lifecycleState = ACTIVE` into the filter criteria before query execution."

The spec assumed the filtering happened via `_executeSearch`. But the public endpoint bypasses `_executeSearch` by calling the entity-specific `listByAccommodation()` method, which was never audited for this invariant.

### Proposed fix

Add `lifecycleState: LifecycleStatusEnum.ACTIVE` to the filter in `listByAccommodation`:

```ts
import { LifecycleStatusEnum } from '@repo/schemas'; // or wherever it's imported from

// line ~513
const result = await this.model.findAll(
    {
        accommodationId,
        deletedAt: null,
        lifecycleState: LifecycleStatusEnum.ACTIVE  // ← force-filter for public tier
    },
    { page, pageSize },
    undefined,
    ctx?.tx
);
```

**Caveat**: `listByAccommodation` is ALSO called from `apps/api/src/routes/user/protected/reviews.ts` for authenticated users retrieving their OWN reviews — they legitimately need to see their drafts. Two approaches:
1. **Preferred**: add an optional `includeAllStates?: boolean` param on the method, default `false`. Public endpoint uses default; protected `/me/reviews` passes `true`.
2. **Alternative**: keep `listByAccommodation` strict and add a separate `listByAccommodationForAuthor()` method for `/me/reviews`. More verbose.

### Decision

**Fix directly.** Security-critical, trivially small. Add a regression test hitting the public endpoint with a DRAFT review and asserting it is not returned. Decision required from user: approach 1 or 2.

---

## GAP-063-002 — DestinationReview public list route returns reviews for ALL destinations + leaks non-ACTIVE

> **Discovered in**: Audit Pass 1 (2026-04-20)
> **Re-verified in Pass 2 (2026-04-20)**: **STILL PRESENT** — handler still calls `service.list(actor, { page, pageSize })` and ignores `destinationId` path param. The "resolved via schema tier" interpretation from one Pass 2 sub-agent was incorrect: the functional bug (returning reviews for all destinations globally) is independent of the schema-tier strip. Pass 1 assessment is correct.
> **Severity**: **CRITICAL** (functional bug + security + AC-005-01 violation)
> **Priority**: P0
> **Complexity**: 2 (new service method + route wiring + test)

### File / line

`apps/api/src/routes/destination/reviews/public/list.ts:32-36`

### Evidence

```ts
handler: async (ctx: Context, _params, _body, query) => {
    //                         ^^^^^^^ ← underscore-prefixed = unused on purpose
    const actor = getActorFromContext(ctx);
    const { page, pageSize } = extractPaginationParams(query || {});
    const service = new DestinationReviewService({ logger: apiLogger });
    const result = await service.list(actor, { page, pageSize });  // ← destinationId NOT passed
```

The route is declared at `/{destinationId}/reviews` (line 23) but the handler ignores the `destinationId` path param entirely. `service.list()` goes through the base class `adminList()` → `_executeSearch()` → `model.findAll({ deletedAt: null })` with no destination filter.

### Impact

Compound bug:
1. **Functional**: `GET /api/v1/public/destinations/dest-A/reviews` returns the **same list** as `GET /api/v1/public/destinations/dest-B/reviews` — all reviews of all destinations, globally paginated.
2. **Security**: Combined with GAP-063-003, it also includes DRAFT/ARCHIVED reviews.

The AccommodationReview equivalent (`listByAccommodation`) exists and is used correctly for that entity — but DestinationReview has no `listByDestination` method to mirror it.

### Proposed fix

1. Add `listByDestination()` method in `DestinationReviewService` mirroring `AccommodationReviewService.listByAccommodation()`, with:
   - `destinationId` required
   - `deletedAt: null` filter
   - `lifecycleState: LifecycleStatusEnum.ACTIVE` force-filter
2. Create a `DestinationReviewListByDestinationParamsSchema` Zod schema for input validation.
3. Update `apps/api/src/routes/destination/reviews/public/list.ts:32-36` to:

```ts
handler: async (ctx: Context, params, _body, query) => {
    const actor = getActorFromContext(ctx);
    const { page, pageSize } = extractPaginationParams(query || {});
    const service = new DestinationReviewService({ logger: apiLogger });
    const result = await service.listByDestination(actor, {
        destinationId: params.destinationId as string,
        page,
        pageSize
    });
    // …
```

4. Add 2 integration tests:
   - Different destinationIds return disjoint result sets.
   - A DRAFT review for the target destination is NOT returned to the anonymous actor.

### Decision

**Fix directly.** Same scope as GAP-063-001 so bundle them. Severity: CRITICAL.

---

## GAP-063-003 — DestinationReviewService._executeSearch + _executeCount do NOT force-override lifecycleState=ACTIVE

> **Discovered in**: Audit Pass 1 (2026-04-20)
> **Re-verified in Pass 2 (2026-04-20)**: **STILL PRESENT**. A Pass 2 sub-agent argued "admin-only, no force-override needed". Rejected: the service method `search()` is exposed at the CrudService public API and any future public route (e.g. featured-destination-reviews widget) that wires through it would silently leak. Defense-in-depth applies. Pass 1 is the correct call.
> **Severity**: **CRITICAL** (security; AC-005-01 defense-in-depth missing)
> **Priority**: P0
> **Complexity**: 2

### File / line

`packages/service-core/src/services/destinationReview/destinationReview.service.ts:160-177`

### Evidence

```ts
protected async _executeSearch(
    params: DestinationReviewSearchInput,
    _actor: Actor,
    _ctx: ServiceContext
): Promise<PaginatedListOutput<DestinationReview>> {
    const { page, pageSize, ...filters } = params;
    return this.model.findAll({ ...filters, deletedAt: null }, { page, pageSize });
    //                        ^^^ no lifecycleState force-override
}

protected async _executeCount(
    params: DestinationReviewSearchInput,
    _actor: Actor,
    _ctx: ServiceContext
): Promise<{ count: number }> {
    const { page: _p, pageSize: _ps, ...filters } = params;
    const count = await this.model.count({ ...filters, deletedAt: null });
    //                                   ^^^ same gap
    return { count };
}
```

Compare with `packages/service-core/src/services/sponsorship/sponsorship.service.ts:172-196` (T-049 correctly force-overrides) and `packages/service-core/src/services/owner-promotion/ownerPromotion.service.ts:123-146` (T-022 correctly force-overrides).

### What the spec required

`spec.md:397` (Phase 2 step 11 expanded in R5) established the pattern:
> "`_executeSearch()` MUST inject `lifecycleState = 'ACTIVE'` into `filterParams` when the caller does not already specify a `lifecycleState` value."

T-022 escalated this to **force-override** (not just default-inject) for security. The task TODOs.md note at T-022 says: "service-level force-override (not just default) + service unit tests + integration pipeline mock + per-handler response strip".

T-049 applied the same pattern to SponsorshipService. But the equivalent task for DestinationReview was NOT explicitly in the task list — it relied on "adminList() works directly via base class" wording from T-034/T-035. The side-effect of this was: base class `_executeSearch` was never overridden on DestinationReviewService, leaving it non-secure.

### Proposed fix

Mirror the SponsorshipService pattern:

```ts
import { LifecycleStatusEnum } from '@repo/schemas';

protected async _executeSearch(
    params: DestinationReviewSearchInput,
    _actor: Actor,
    _ctx: ServiceContext
): Promise<PaginatedListOutput<DestinationReview>> {
    const { page, pageSize, ...filterParams } = params;
    // Force-override: never trust caller-supplied lifecycleState on public path.
    (filterParams as Record<string, unknown>).lifecycleState = LifecycleStatusEnum.ACTIVE;
    return this.model.findAll({ ...filterParams, deletedAt: null }, { page, pageSize });
}

protected async _executeCount(
    params: DestinationReviewSearchInput,
    _actor: Actor,
    _ctx: ServiceContext
): Promise<{ count: number }> {
    const { page: _p, pageSize: _ps, ...filterParams } = params;
    (filterParams as Record<string, unknown>).lifecycleState = LifecycleStatusEnum.ACTIVE;
    const count = await this.model.count({ ...filterParams, deletedAt: null });
    return { count };
}
```

Add service unit tests verifying the override is applied even when the caller passes `lifecycleState: DRAFT`.

### Decision

**Fix directly.** Bundled with GAP-063-002 (same PR makes sense).

---

## GAP-063-004 — AccommodationReviewService._executeSearch + _executeCount do NOT force-override lifecycleState=ACTIVE

> **Discovered in**: Audit Pass 1 (2026-04-20)
> **Re-verified in Pass 2 (2026-04-20)**: **STILL PRESENT**. Same rationale as GAP-063-003: defense-in-depth applies.
> **Severity**: **HIGH** (latent security hole; no public endpoint currently uses `.list()`/`.search()` — only `listByAccommodation`)
> **Priority**: P1
> **Complexity**: 2

### File / line

`packages/service-core/src/services/accommodationReview/accommodationReview.service.ts:170-187`

### Evidence

Identical pattern to GAP-063-003 but on AccommodationReview. The spec declared Phase 1 as "verification only" and skipped hardening the base-class filter path.

The reason this is HIGH (not CRITICAL): the only public entry point for AccommodationReview is `listByAccommodation` (GAP-063-001), which uses a different code path. `search()` is called only from admin and protected contexts today. But any future public route calling `service.search()` (e.g. featured reviews widget, homepage aggregation) would silently leak.

### Proposed fix

Mirror the SponsorshipService force-override pattern (same snippet as GAP-063-003, adapted to `AccommodationReviewSearchParams`).

### Decision

**Fix directly.** Defense-in-depth. Bundle with GAP-063-001/002/003 in one security-hardening PR.

---

## GAP-063-005 — OwnerPromotion public getById leaks DRAFT/ARCHIVED + lifecycleState field

> **Discovered in**: Audit Pass 1 (2026-04-20)
> **Re-verified in Pass 2 (2026-04-20)**: **STILL PRESENT**. A Pass 2 sub-agent claimed "schema tier via route-factory responseSchema handles it". Rejected: the route-factory declares `responseSchema: OwnerPromotionPublicSchema.nullable()` but does NOT runtime-parse the response (that's exactly SPEC-087). The handler returns `result.data` raw. Both issues (status leak + field leak) remain.
> **Severity**: **HIGH**
> **Priority**: P1
> **Complexity**: 2

### File / line

`apps/api/src/routes/owner-promotion/public/getById.ts:27-34`

### Evidence

```ts
handler: async (ctx: Context, params: Record<string, unknown>) => {
    const actor = getActorFromContext(ctx);
    const result = await ownerPromotionService.getById(actor, params.id as string);
    if (result.error) throw new ServiceError(result.error.code, result.error.message);
    return result.data;   // ← no lifecycleState strip, no ACTIVE check
},
```

Two problems:
1. **Status leak**: a caller with a known OwnerPromotion UUID can fetch DRAFT or ARCHIVED records through the public endpoint. `getById()` in `BaseCrudRead` does not enforce lifecycle filtering by default.
2. **Field leak**: the response is returned raw without `OwnerPromotionPublicSchema.parse(...)`, so admin-only fields (`lifecycleState`, `ownerId`, `currentRedemptions`, audit fields) leak in the JSON body. This is the SPEC-087 systemic issue, but this file was skipped by T-022 which only hardened `public/list.ts`.

For comparison, `public/list.ts:51` DOES call `OwnerPromotionPublicSchema.parse(item)` per-handler.

### Proposed fix

```ts
import { OwnerPromotionPublicSchema } from '@repo/schemas';

handler: async (ctx: Context, params: Record<string, unknown>) => {
    const actor = getActorFromContext(ctx);
    const result = await ownerPromotionService.getById(actor, params.id as string);
    if (result.error) throw new ServiceError(result.error.code, result.error.message);

    // Hide non-ACTIVE records from the public tier.
    if (!result.data || result.data.lifecycleState !== 'ACTIVE') return null;

    // AC-005-01: strip admin-only fields (tracked systemically in SPEC-087).
    return OwnerPromotionPublicSchema.parse(result.data);
}
```

### Decision

**Fix directly.** Trivial. Bundle with GAP-063-001..004.

---

## GAP-063-006 — sponsor-dashboard/hooks.ts still sends `status=active` (should be `sponsorshipStatus=active`)

> **Discovered in**: Audit Pass 1 (2026-04-20)
> **Re-verified in Pass 2 (2026-04-20)**: **STILL PRESENT**. `grep -n "status=" apps/admin/src/features/sponsor-dashboard/hooks.ts` → line 30 still uses `status=active`.
> **Severity**: MEDIUM (silent broken dashboard)
> **Priority**: P2
> **Complexity**: 1

### File / line

`apps/admin/src/features/sponsor-dashboard/hooks.ts:30`

### Evidence

```ts
path: '/api/v1/admin/sponsorships?status=active'
```

After T-043/T-046 the admin sponsorship schema renamed `status` → `sponsorshipStatus`. The `AdminSearchBaseSchema.status` accepts lifecycle enum values (DRAFT/ACTIVE/ARCHIVED) with a default `'all'`, but the `status=active` query param:
- passes `.safeParse()` because the base `status` is `z.union([z.literal('all'), LifecycleStatusEnumSchema]).default('all')` — BUT `'active'` (lowercase) is NOT a valid `LifecycleStatusEnum` (which is `DRAFT | ACTIVE | ARCHIVED`), so this likely returns **400 VALIDATION_ERROR**.
- even if it slipped through, it would NOT filter by `sponsorshipStatus='active'` — it would filter by `lifecycleState` (the base `status` mapping), which is orthogonal.

Net effect: the sponsor dashboard "Active Sponsorships" card is likely broken silently (empty state or 400 — need to test via UI).

T-052 absorbed several sponsor-dashboard paths but missed `hooks.ts:30`. The TODOs.md for T-052 specifically says "Scope absorbed: SponsorSponsorship.status (sponsor-dashboard/types.ts), posts/$id_.sponsorship.tsx (3 refs), SponsorshipsTab.tsx (4 refs)." — the `hooks.ts` file was overlooked.

### Proposed fix

```ts
path: '/api/v1/admin/sponsorships?sponsorshipStatus=active'
```

### Decision

**Fix directly.** Single line. Add an integration test that verifies the dashboard card receives non-empty data in a seeded environment.

### Decisión del usuario (triage 2026-04-20)

**HACER** — bundle Q1 (Admin Dashboard: 006 + 007 + 026). Rename `status=active` → `sponsorshipStatus=active` en `hooks.ts:30`.

---

## GAP-063-007 — sponsor-dashboard/types.ts `SponsorshipFilters.status?: string` is stale

> **Discovered in**: Audit Pass 1 (2026-04-20)
> **Re-verified in Pass 2 (2026-04-20)**: **STILL PRESENT**. It is NOT dead — the interface is consumed by sponsor-dashboard/hooks.ts (same feature), which GAP-063-006 flagged as broken. Fix both together.
> **Severity**: LOW (dead code; type drift)
> **Priority**: P3
> **Complexity**: 1

### File / line

`apps/admin/src/features/sponsor-dashboard/types.ts:49-54`

### Evidence

```ts
export interface SponsorshipFilters {
    status?: string;       // ← stale — entity field was renamed to sponsorshipStatus
    targetType?: string;
    page?: number;
    limit?: number;
}
```

Comparison with the main `apps/admin/src/features/sponsorships/types.ts:32-36` (migrated correctly by T-052):

```ts
export interface SponsorshipFilters {
    sponsorshipStatus?: SponsorshipStatus;
    lifecycleState?: LifecycleStatusEnum;
    // …
}
```

Line 45 of `sponsor-dashboard/types.ts` (`SponsorInvoice.status: 'draft' | 'open' | 'paid' | 'void'`) is legitimate (invoice domain, not sponsorship) and is NOT affected by SPEC-063.

### Proposed fix

Rename `status?: string` → `sponsorshipStatus?: SponsorshipStatus` (or remove if unused) and update any consumer. Grep for usage first.

### Decision

**Fix directly.** Bundle with GAP-063-006 since they touch the same feature.

### Decisión del usuario (triage 2026-04-20)

**HACER** — bundle Q1 (Admin Dashboard: 006 + 007 + 026). Renombrar `SponsorshipFilters.status?: string` → `sponsorshipStatus?: SponsorshipStatus`; actualizar consumidores.

---

## GAP-063-008 — TODOs.md follow-ups flagged as open are actually resolved (stale state)

> **Discovered in**: Audit Pass 1 (2026-04-20)
> **Re-verified in Pass 2 (2026-04-20)**: **STILL PRESENT** — TODOs.md was not updated between passes.
> **Severity**: LOW (documentation drift; misleading for future auditors)
> **Priority**: P3
> **Complexity**: 1

### File / line

`.claude/tasks/SPEC-063-lifecycle-state-standardization/TODOs.md:17-24` — the "Follow-ups (not SPEC-063 scope)" list.

### Evidence

1. TODOs.md claims **"3 pre-existing schema test failures"** (group-d, sponsorship.crud, …). Live run: `cd packages/schemas && pnpm vitest run` → **2900/2900 pass** (107 test files). Zero failures. The issues were presumably fixed during T-055 cascade renames but the TODOs never updated.

2. TODOs.md claims **"5 typecheck errors in `packages/service-core/test/services/destinationReview/*` (Property 'lifecycleState' missing)"**. Live run: `cd packages/service-core && pnpm typecheck` → **1 error total, and it's in `test/base/crud/getById.test.ts:379` (unrelated SPEC-066 preexisting bug)**. The 5 destinationReview errors are gone.

3. TODOs.md claims **"delete the two T-029 output SQL files"** (`0005_awesome_wild_child.sql` + `_down.sql`). Live check: both files are already absent from `packages/db/src/migrations/` and `packages/db/src/migrations/manual/`. Cleanup was done but the flag wasn't struck.

### Proposed fix

Update `TODOs.md` header block:
- Strike items 2 (schema test failures) and 4 (destinationReview cascade) as "resolved".
- Strike item 3 (push-only follow-up) as "done".
- Leave item 1 (SPEC-087 systemic route-factory parse) as open — it is a real open item.

### Decision

**Fix directly.** Stale documentation should not mislead future gap audits.

---

## GAP-063-009 — Spec says `pg_try_advisory_lock(43010)` but cron uses `pg_try_advisory_xact_lock(43010)`

> **Discovered in**: Audit Pass 1 (2026-04-20)
> **Re-verified in Pass 2 (2026-04-20)**: **STILL PRESENT** — spec.md:318 text unchanged.
> **Severity**: LOW (doc mismatch; code is actually CORRECT per project rule)
> **Priority**: P3
> **Complexity**: 1

### File / line

- `.claude/specs/SPEC-063-lifecycle-state-standardization/spec.md:318` says:
  > "Advisory lock: Use `pg_try_advisory_lock(43010)` to prevent overlapping runs (follow addon-expiry pattern with lock ID `43010`, next available after `43001`)."

- `apps/api/src/cron/jobs/archive-expired-promotions.job.ts` uses `pg_try_advisory_xact_lock(43010)` (transaction-level) — which matches **Rule 1 in `packages/db/docs/advisory-locks.md`**: "All advisory locks MUST be transaction-level (`_xact_` variants). Session-level locks are forbidden due to Neon connection pooling."

The TODOs.md T-025 notes: "spec-deviation flagged in state.json `_specDeviation`". The DEVIATION IS CORRECT (xact is what the project requires) but the SPEC was never updated to reflect this.

### Proposed fix

Update `spec.md:318` to say `pg_try_advisory_xact_lock` (transaction-level) and add a parenthetical: "transaction-level per `packages/db/docs/advisory-locks.md` rule 1".

### Decision

**Fix directly.** Doc hygiene. Do not change the code.

---

## GAP-063-010 — SPEC-087 systemic route-factory runtime response parsing (tracked elsewhere)

> **Discovered in**: Audit Pass 1 (2026-04-20)
> **Re-verified in Pass 2 (2026-04-20)**: SPEC-087 draft still exists; route-factory `createPublicRoute`/`createPublicListRoute` still do NOT runtime-parse responseSchema. No action in this audit.
> **Severity**: INFO (already tracked as draft spec)
> **Priority**: — (belongs to SPEC-087)
> **Complexity**: —

### Context

Routes for OwnerPromotion, AccommodationReview, and DestinationReview public list handlers apply a **per-handler `Schema.parse(item)` call** to strip admin-only fields (`lifecycleState`, audit fields). This is documented in each handler with: "Tracked systemically in SPEC-087."

`.claude/specs/SPEC-087-public-response-schema-strip/spec.md` exists. Once SPEC-087 lands:
- All `.parse(item)` lines in public handlers can be removed.
- `route-factory.ts` `createPublicListRoute` and `createPublicRoute` must runtime-parse `responseSchema`.

### Fix needed in SPEC-063 scope? NO.

This is a systemic issue, not a SPEC-063 gap. Noting it here only for traceability with GAP-063-005 (which adds a new per-handler parse call that will also be removed when SPEC-087 lands).

### Decision

**Tracked in SPEC-087.** No action in this audit.

---

## GAP-063-011 — Missing regression tests for AC-005-01 on review entities

> **Discovered in**: Audit Pass 1 (2026-04-20)
> **Re-verified in Pass 2 (2026-04-20)**: **STILL PRESENT** — `apps/api/test/integration/cross-cutting/lifecycle-public-endpoints.test.ts` unchanged since Pass 1; still only tests field strip, not record exclusion.
> **Severity**: MEDIUM (coverage gap that ALLOWED GAP-063-001..004 to slip through)
> **Priority**: P2
> **Complexity**: 2

### Context

T-058 created `apps/api/test/integration/cross-cutting/lifecycle-public-endpoints.test.ts` with 6 tests: "AccommodationReview strip (2) + DestinationReview strip (2) + Sponsorship no-public-tier (1) + OwnerPromotion reference (1)".

But the "strip" tests only verify the **field** `lifecycleState` is not in the response body. They do NOT verify that **non-ACTIVE records are excluded from the result set**. That is why GAP-063-001 (DRAFT reviews leaked but lifecycleState field stripped) went undetected.

### Proposed fix

After fixing GAP-063-001..005, extend the cross-cutting test file with 4-5 new tests:
- Create an AccommodationReview with `lifecycleState=DRAFT` for accommodation X; hit `GET /api/v1/public/accommodations/X/reviews`; assert the DRAFT review is NOT in `items`.
- Same for ARCHIVED.
- Same for DestinationReview + destination Y.
- For OwnerPromotion: create DRAFT promotion P; hit `GET /api/v1/public/owner-promotions/:P.id`; assert response is `null` (or 404).

### Decision

**Fix directly.** Without these tests, the same class of bug can reappear trivially. Effort is proportional to the code fixes.

---

## GAP-063-012 — Cron archive job has no audit trail / observability for archived records

> **Discovered in**: Audit Pass 1 (2026-04-20)
> **Re-verified in Pass 2 (2026-04-20)**: **STILL PRESENT / DEFERRED** — no changes; keep deferred.
> **Severity**: LOW (nice-to-have; spec did NOT require persistent audit)
> **Priority**: P3
> **Complexity**: 2

### File / line

`apps/api/src/cron/jobs/archive-expired-promotions.job.ts`

### Evidence

The spec AC-007-02 says "Admin can reactivate an auto-archived promotion" and the UI note says "Admin UI distinction: the admin UI should display 'Auto-archived (expired)' for archived promotions where `validUntil < now`. This is inferred client-side, not stored in DB."

However:
- No DB audit log is written when the cron flips a promotion to ARCHIVED. The only trace is the logger line `cron:archive-expired-promotions count=N`.
- `updated_by_id` is set to `NULL` (per spec), so there is no way to distinguish "admin archived" from "cron archived" in the DB aside from heuristics.
- If the admin reactivates and `validUntil` is not extended, the cron will re-archive on next run with no visibility to the admin who performed the reactivation.

### Proposed fix

Two options:
1. **Small**: add a "last auto-archive" timestamp column or `auto_archived_at` to the owner-promotions table. Cron sets it on archive; manual edits preserve it. UI uses it to show the "Auto-archived (expired)" badge.
2. **Big**: introduce a general audit-log table for lifecycle transitions. Out of scope; would be a separate SPEC.

### Decision

**Defer.** Spec explicitly marked this as client-side inference. Revisit if the admin UX complaint surfaces. Open as a follow-up SPEC only if Option 1 is prioritized by product.

---

## Summary by area

| Area | Count | Highest severity |
|------|-------|------------------|
| Service layer (`packages/service-core`) | 4 (GAP-001/003/004/005 partial) | CRITICAL |
| API routes (`apps/api/src/routes`) | 2 (GAP-002/005) | CRITICAL |
| Admin frontend (`apps/admin`) | 2 (GAP-006/007) | MEDIUM |
| Tests (coverage gap) | 1 (GAP-011) | MEDIUM |
| Documentation (spec + TODOs) | 2 (GAP-008/009) | LOW |
| Cron observability | 1 (GAP-012) | LOW |
| Systemic (tracked elsewhere) | 1 (GAP-010 → SPEC-087) | INFO |

## Recommended fix order

1. **Security-hardening PR** (bundle): GAP-063-001, 002, 003, 004, 005 + GAP-063-011 tests. Single PR, single `security(spec-063-gaps): enforce lifecycleState=ACTIVE on public review + promotion endpoints`. This is the only P0 block.
2. **Admin cleanup PR**: GAP-063-006 + 007. Single commit.
3. **Docs cleanup**: GAP-063-008 + 009. Single commit.
4. **Optional**: GAP-063-012 deferred pending product input.

---

## Audit Pass 2 — 2026-04-20

**Auditor**: Claude Opus 4.7 (tech-lead orchestrator + 3 Explore sub-agents)
**Verification tools**: Read + Grep + manual line-by-line checks of critical findings
**Scope split across sub-agents**:
- Agent 1: service/route/frontend layer + Pass 1 gap verification
- Agent 2: schemas + DB + tests + fixtures layer
- Agent 3: i18n, cron, permissions, route-factory, seed, admin UI, docs drift, SPEC-062 interaction

**Headline result**:
- **0 Pass 1 gaps remediated** between passes. All 12 still present (or deferred/INFO as intended).
- **3 NEW gaps discovered**. Total gap count: **15**.
- **2 Pass 2 sub-agent false resolutions caught** and reverted (see Disagreements below).

### Re-verification table (Pass 1 gaps)

| Gap | Status in Pass 2 | Evidence |
|-----|------------------|----------|
| GAP-063-001 | STILL PRESENT | `accommodationReview.service.ts:513-518` unchanged |
| GAP-063-002 | STILL PRESENT | `destination/reviews/public/list.ts:32-36` unchanged; `destinationId` still ignored |
| GAP-063-003 | STILL PRESENT | `destinationReview.service.ts:160-177` no force-override |
| GAP-063-004 | STILL PRESENT | `accommodationReview.service.ts:170-187` no force-override |
| GAP-063-005 | STILL PRESENT | `owner-promotion/public/getById.ts:27-34` returns `result.data` raw |
| GAP-063-006 | STILL PRESENT | `sponsor-dashboard/hooks.ts:30` still `status=active` |
| GAP-063-007 | STILL PRESENT | `sponsor-dashboard/types.ts:49-54` stale; consumed by GAP-006's hook |
| GAP-063-008 | STILL PRESENT | TODOs.md unchanged |
| GAP-063-009 | STILL PRESENT | spec.md:318 unchanged |
| GAP-063-010 | INFO (SPEC-087) | No action expected here |
| GAP-063-011 | STILL PRESENT | `lifecycle-public-endpoints.test.ts` unchanged |
| GAP-063-012 | STILL PRESENT / DEFERRED | Keep deferred |

### Disagreements between Pass 1 and Pass 2 (adjudication log)

Three sub-agents in Pass 2 reported gaps as "resolved" but orchestrator-level verification found the claims were mistaken. All three are KEPT as open per Pass 1 assessment:

- **GAP-063-003/004**: Agent argued `_executeSearch/_executeCount` are "admin-only" so no force-override needed. **Rejected** — these are service-public methods reachable by any future route wiring `service.search()`. Defense-in-depth is the spec intent (R5 of `spec.md`).
- **GAP-063-005**: Agent claimed route-factory `responseSchema: OwnerPromotionPublicSchema.nullable()` strips admin fields at runtime. **Rejected** — `createPublicRoute` does not runtime-parse `responseSchema` today (that is exactly SPEC-087). Handler returns `result.data` raw.

---

## GAP-063-013 — AccommodationReview query schema is missing the `lifecycleState` filter

> **Discovered in**: Audit Pass 2 (2026-04-20)
> **Severity**: MEDIUM
> **Priority**: P2
> **Complexity**: 1 (2-line addition + 1 test)

### File / line

`packages/schemas/src/entities/accommodationReview/accommodationReview.query.schema.ts:28-71` (`AccommodationReviewFiltersSchema`) and `:87-130` (`AccommodationReviewSearchSchema`).

### Evidence

The filters schema includes `isVerified`, `isPublished`, `isFlagged`, `hasContent`, `minRating`, etc. but does NOT include `lifecycleState`. Peer entities all include it:

- `packages/schemas/src/entities/ownerPromotion/owner-promotion.query.schema.ts:32`: `lifecycleState: LifecycleStatusEnumSchema.optional()`
- `packages/schemas/src/entities/sponsorship/sponsorship.query.schema.ts:41`: same
- `packages/schemas/src/entities/destinationReview/destinationReview.query.schema.ts:50`: `lifecycleState: z.nativeEnum(LifecycleStatusEnum).optional()`

### What the spec required

SPEC-063 Phase 1 (AccommodationReview) was marked verification-only because "admin `status` filter works via base `adminList()` hardcoded `where.lifecycleState = status`". That covers the BASE admin filter but not entity-specific structured filters that the query schema defines. The expected contract (parity across entities) is that every entity with `lifecycleState` should accept it as a first-class query filter.

### Proposed fix

Add to `AccommodationReviewFiltersSchema`:

```ts
import { LifecycleStatusEnumSchema } from '../../enums/lifecycle-state.schema.js';

// Inside AccommodationReviewFiltersSchema:
lifecycleState: LifecycleStatusEnumSchema.optional(),
```

Mirror the same field in `AccommodationReviewSearchSchema` (flat structure). Add 1 schema test asserting the filter is accepted.

### Decision

**Fix directly.** Single line in two places plus a test. Bundle with the Pass 1 security-hardening PR since the touched file is adjacent to the security work on the same entity.

### Decisión del usuario (triage 2026-04-20)

**HACER** — bundle Q2 (Schema Parity AccRev: 013 + 019). Agregar `lifecycleState: LifecycleStatusEnumSchema.optional()` a `AccommodationReviewFiltersSchema` + `AccommodationReviewSearchSchema`.

---

## GAP-063-014 — Portuguese validation locale is untranslated (literal `[PT] ...` placeholders in Spanish)

> **Discovered in**: Audit Pass 2 (2026-04-20)
> **Severity**: LOW (visible only on Zod validation errors)
> **Priority**: P3
> **Complexity**: 1 (translation task, no code)

### File / line

`packages/i18n/src/locales/pt/validation.json` — entire `validation.*` section.

### Evidence

```json
"tooSmall": "[PT] El valor es demasiado corto",
"required": "[PT] Este campo es requerido",
"invalidEnum": "[PT] Valor no permitido",
```

All values are Spanish prefixed with `[PT]`. Includes the keys for `lifecycleState` / `sponsorshipStatus` validation messages that SPEC-063 added.

### What the spec required

Indirectly: the project supports es/en/pt parity per `packages/i18n/`. SPEC-063 added new enum validation keys (T-027, T-054) to es/en/pt for lifecycle and sponsorshipStatus filters and assumed parity. The PT locale was never actually translated; it has been in "placeholder state" for this file since long before SPEC-063 (not a regression introduced by this spec).

### Proposed fix

Translate all entries in `pt/validation.json` to Portuguese (pt-BR or pt-PT per project convention). Verify parity against `es/validation.json` and `en/validation.json`. This is scope that extends beyond SPEC-063 to the project-wide i18n layer.

### Decision

**Promote to a dedicated i18n SPEC (or issue).** Not SPEC-063's job. Noted here because Pass 2 surfaced it while auditing the spec. Recommended action: open a tracking issue/SPEC for PT translation audit across all locale files.

---

## GAP-063-015 — Sponsorship update path does not enforce `SPONSORSHIP_STATUS_MANAGE` for `sponsorshipStatus` changes

> **Discovered in**: Audit Pass 2 (2026-04-20)
> **Severity**: MEDIUM (security/authorization design drift)
> **Priority**: P2
> **Complexity**: 2 (permission design + hook override + tests)

### File / line

- `packages/service-core/src/services/sponsorship/sponsorship.service.ts` — `_canUpdate` uses generic `checkCanUpdate` (= `SPONSORSHIP_UPDATE`).
- `packages/schemas/src/enums/permission.enum.ts` — `SPONSORSHIP_STATUS_MANAGE = 'sponsorship.status.manage'` exists but is unused.

### Evidence

The permission enum defines `SPONSORSHIP_STATUS_MANAGE` explicitly. The update payload accepts both `lifecycleState` and `sponsorshipStatus`. The service's `_canUpdate` hook performs a single generic permission check (`SPONSORSHIP_UPDATE`) without distinguishing which field is being modified. Result: any actor with plain `SPONSORSHIP_UPDATE` can transition the domain status (PENDING → ACTIVE → EXPIRED → CANCELLED) without ever needing `SPONSORSHIP_STATUS_MANAGE`.

### What the spec required

spec.md Phase 3 step 15 (R6):

> "The existing `SPONSORSHIP_STATUS_MANAGE` permission (`sponsorship.status.manage`) continues to govern `sponsorshipStatus` changes (domain workflow transitions). Standard `lifecycleState` changes (DRAFT/ACTIVE/ARCHIVED) fall under the entity's general `SPONSORSHIP_UPDATE` permission, consistent with how other entities handle lifecycle state. No permission enum changes are required."

The spec required the SEMANTIC split between the two permissions. Only the enum existed; the enforcement was never wired.

### Proposed fix

Two options:

1. **Field-level permission check inside `_canUpdate`**: inspect the patch payload; if `sponsorshipStatus` is being changed, require `SPONSORSHIP_STATUS_MANAGE` (not just `SPONSORSHIP_UPDATE`). Straightforward if the hook has access to `input.data` at check time.
2. **Separate endpoint/method `updateSponsorshipStatus`** (analogous to existing domain pattern) guarded by `SPONSORSHIP_STATUS_MANAGE`; strip `sponsorshipStatus` from the general update payload.

Option 1 is less intrusive. Option 2 is cleaner and mirrors how e.g. `setAdminInfo` is modeled in other services.

Pick one with user approval; then add:
- `checkCanManageStatus(actor, data)` in `sponsorship.permissions.ts`
- Hook wiring in `sponsorship.service.ts`
- Unit tests covering both "has SPONSORSHIP_UPDATE only" (→ FORBIDDEN on status change) and "has both permissions" (→ allowed) paths.

### Decision

**Promote to a formal follow-up SPEC OR extend SPEC-063 with an R7 revision.** This requires user decision on Option 1 vs 2 (design tradeoff: minimal intrusion vs API cleanliness). Not a "fix directly" candidate because there is a design choice to make. Propose: open `SPEC-063-R7` or dedicated `SPEC-09X-sponsorship-status-permission-split` with implementation plan.

### Decisión del usuario (triage 2026-04-20)

**HACER — Option 1** (field-level check en `_canUpdate`). El hook inspecciona el payload; si `sponsorshipStatus` está presente exige `SPONSORSHIP_STATUS_MANAGE` además de `SPONSORSHIP_UPDATE`. Resto del payload sigue con `SPONSORSHIP_UPDATE`. Sin cambios de API, sin migracion de admin frontend. Agregar `checkCanManageSponsorshipStatus(actor, data)` en `sponsorship.permissions.ts` + wiring en `sponsorship.service.ts` + 2 tests unitarios (has UPDATE only → FORBIDDEN on status change; has both → allowed).

---

## Updated summary by area (after Pass 2)

| Area | Count | Highest severity |
|------|-------|------------------|
| Service layer (`packages/service-core`) | 5 (GAP-001/003/004/005 partial + 015) | CRITICAL |
| API routes (`apps/api/src/routes`) | 2 (GAP-002/005) | CRITICAL |
| Admin frontend (`apps/admin`) | 2 (GAP-006/007) | MEDIUM |
| Schema layer (`packages/schemas`) | 1 (GAP-013 NEW) | MEDIUM |
| Tests (coverage gap) | 1 (GAP-011) | MEDIUM |
| Documentation (spec + TODOs) | 2 (GAP-008/009) | LOW |
| i18n (`packages/i18n`) | 1 (GAP-014 NEW) | LOW |
| Cron observability | 1 (GAP-012) | LOW |
| Systemic (tracked elsewhere) | 1 (GAP-010 → SPEC-087) | INFO |

## Recommended fix order (after Pass 2)

1. **Security-hardening PR** (bundle): GAP-063-001, 002, 003, 004, 005 + GAP-063-011 tests + GAP-063-013 (schema parity, trivial). Single PR titled `security(spec-063-gaps): enforce lifecycleState=ACTIVE on public review + promotion endpoints`. Still the only P0 block.
2. **Admin cleanup PR**: GAP-063-006 + 007. Single commit.
3. **Docs cleanup**: GAP-063-008 + 009. Single commit.
4. **Design decision needed**: GAP-063-015 (promote to SPEC; Option 1 vs 2).
5. **Cross-project**: GAP-063-014 (promote to dedicated i18n SPEC/issue).
6. **Optional**: GAP-063-012 deferred pending product input.

## Audit passes performed

| Pass | Date | Auditor | Gaps found | Gaps closed since previous |
|------|------|---------|------------|----------------------------|
| 1 | 2026-04-20 | Claude Opus 4.7 + 3 Explore sub-agents + orchestrator verification | 12 (5 CRITICAL/HIGH, 2 MEDIUM, 4 LOW, 1 INFO) | — (baseline) |
| 2 | 2026-04-20 | Claude Opus 4.7 + 3 Explore sub-agents + orchestrator verification | 3 NEW (GAP-013 MEDIUM, GAP-014 LOW, GAP-015 MEDIUM) + re-verified 12 from Pass 1 | **0 closed** since Pass 1 |
| 3 | 2026-04-20 | Claude Opus 4.7 + 4 Explore sub-agents (service / routes+UI / schemas+DB / tests+permissions) + orchestrator spot-verification | 6 NEW (GAP-016..021) + re-verified 15 from Passes 1-2 | **0 closed** since Pass 2 |
| 4 | 2026-04-20 | Claude Opus 4.7 + 4 Explore sub-agents (service+model+cron / routes+frontend / schemas+DB+i18n / tests+permissions+docs) + orchestrator spot-verification of restore hooks, composite indexes, cron Sentry path, Sponsorship admin grid | 11 NEW (GAP-022..032) + re-verified 21 from Passes 1-3 | **0 closed** since Pass 3 |
| 5 | 2026-04-20 | Claude Opus 4.7 + 3 Explore sub-agents (DB/concurrency/migrations + routes/contracts/frontend + permissions/security/tests) + 1 code-reviewer agent (code quality) + orchestrator verification of admin UI presence, update-route permissions, cron enum literals, and hook-state naming | 15 NEW (GAP-033..047) + 7 dupes merged into existing gaps + sample re-verification of GAP-001/006/018/022/028 | **0 closed** since Pass 4 |
| Triage | 2026-04-20 | Claude Opus 4.7 (tech-lead) + usuario (qazuor) | Triage decisions per gap — see "Triage 2026-04-20" section at end of doc | — (decision pass, no code changes) |

---

## Audit Pass 3 — 2026-04-20

**Auditor**: Claude Opus 4.7 (tech-lead orchestrator) + 4 parallel Explore sub-agents
**Agents scope split** (intentionally non-overlapping):
- **Agent A** — Service layer + model layer + transactions + cron infrastructure
- **Agent B** — API routes (public/protected/admin) + admin frontend + web frontend + response handling
- **Agent C** — Zod schemas + Drizzle DB schemas + migrations + seed/fixtures + types + i18n keys
- **Agent D** — Tests (unit/integration/E2E) + permissions + edge cases + security hardening

**Orchestrator spot-verification** (against actual files):
- `.strict()` usage across `ownerPromotion/`, `sponsorship/`, `accommodationReview/`, `destinationReview/` crud schemas: **only DestinationReview applies `.strict()`**. OwnerPromotion/Sponsorship/AccommodationReview Update schemas do NOT — which means route-level `zValidator(...)` will silently strip unknown fields like `isActive` or legacy `status` instead of returning 400. The schema unit test at `owner-promotion.crud.schema.test.ts:218` (AC-002-02) applies `.strict()` manually in the TEST, so it's green — but the runtime API does not share this guarantee.
- `accommodationReviews_lifecycleState_idx`: **does NOT exist** in `packages/db/src/schemas/accommodation/accommodation_review.dbschema.ts`. Peer entities (OwnerPromotion, Sponsorship, DestinationReview, Users, EventOrganizer, EventLocation, Attraction) all have one.
- `SponsorshipLevel` + `SponsorshipPackage` (adjacent entities in the same folder as `Sponsorship`) still use `isActive: boolean('is_active')` + `*_isActive_idx` indexes. They were out-of-scope per SPEC-063 (which targets 6 specific entities) but are candidates for a future lifecycle-standardization follow-up.

### Headline result for Pass 3

- **0 of the 15 Pass 1-2 gaps remediated.** All still present in exactly the state the prior passes described.
- **6 NEW gaps discovered** — GAP-063-016 through GAP-063-021. Total gap count: **21**.
- **Several Pass 3 sub-agent "duplicate discoveries" adjudicated**: Agent D reported 13 potential new issues, 7 were actually duplicates/expansions of Pass 1-2 gaps (GAP-010/011/015) and are NOT re-numbered.

### Re-verification table (Pass 1-2 gaps)

| Gap | Status in Pass 3 | Evidence |
|-----|------------------|----------|
| GAP-063-001 | STILL PRESENT | `accommodationReview.service.ts:513-518` unchanged (no `lifecycleState` in `listByAccommodation` filter) |
| GAP-063-002 | STILL PRESENT | `destination/reviews/public/list.ts:32-36` unchanged (ignores `destinationId`) |
| GAP-063-003 | STILL PRESENT | `destinationReview.service.ts:160-177` no force-override; compare to Sponsorship/OwnerPromotion which DO correctly force-override |
| GAP-063-004 | STILL PRESENT | `accommodationReview.service.ts:170-187` no force-override |
| GAP-063-005 | STILL PRESENT | `owner-promotion/public/getById.ts:27-34` returns `result.data` raw |
| GAP-063-006 | STILL PRESENT | `sponsor-dashboard/hooks.ts:30` still `status=active` |
| GAP-063-007 | STILL PRESENT | `sponsor-dashboard/types.ts:49-54` stale |
| GAP-063-008 | STILL PRESENT | TODOs.md still contains resolved-but-unmarked items |
| GAP-063-009 | STILL PRESENT | `spec.md:318` still says `pg_try_advisory_lock` (code correct, doc wrong) |
| GAP-063-010 | INFO (SPEC-087) | Unchanged — belongs to systemic route-factory runtime response parse |
| GAP-063-011 | STILL PRESENT | Cross-cutting test only checks field strip, not record exclusion |
| GAP-063-012 | DEFERRED | Unchanged — product call |
| GAP-063-013 | STILL PRESENT | `accommodationReview.query.schema.ts:28-71` still no `lifecycleState` filter |
| GAP-063-014 | STILL PRESENT (promoted) | `pt/validation.json` still `[PT]`-placeholder Spanish |
| GAP-063-015 | STILL PRESENT | `sponsorship.service.ts:77-79` + `sponsorship.permissions.ts:45-53` — `SPONSORSHIP_STATUS_MANAGE` enum exists, never checked |

### What Pass 3 VERIFIED AS CORRECT (no gap)

To save future auditors time, these areas are confirmed compliant:

- `SponsorshipService._executeSearch/_executeCount` force-override pattern (`sponsorship.service.ts:172-196`)
- `OwnerPromotionService._executeSearch/_executeCount` force-override pattern (`ownerPromotion.service.ts:123-148`)
- `OwnerPromotionModel.findActiveByAccommodationId` + `findActiveByOwnerId` both use `eq(ownerPromotions.lifecycleState, 'ACTIVE')` (no `isActive` leftovers)
- `SponsorshipModel.findActiveByTarget` uses BOTH `sponsorshipStatus='active'` AND `lifecycleState='ACTIVE'` (AC-003-02 compliant)
- `apps/api/src/cron/jobs/archive-expired-promotions.job.ts` uses `pg_try_advisory_xact_lock(43010)`, filters `isNotNull(validUntil)`, batch=100, dry-run supported, wraps in `withTransaction`, reports to Sentry, returns `CronJobResult.processed`
- `usage-tracking.service.ts:406` + `limit-enforcement.ts:318` correctly use `lifecycleState: LifecycleStatusEnum.ACTIVE` (not the old `isActive: true`)
- `advisory-locks.md` registry entry for `43010` present and correctly attributes SPEC-063
- Admin frontend `owner-promotions/types.ts`, `hooks.ts`, `sponsorships/types.ts`, `useSponsorshipQueries.ts` all migrated correctly to the new field names
- All AccessSchemas (Public/Protected/Admin) for the 4 affected entities have correct field inclusions/exclusions (Public + Protected exclude `lifecycleState`, Admin includes it)
- Drizzle DB columns + PgEnum types (`LifecycleStatusPgEnum`, `SponsorshipStatusPgEnum`) correct and shared
- Seed/fixtures files use the new field names (no `isActive` / `status` leftover)

---

## GAP-063-016 — OwnerPromotion/Sponsorship/AccommodationReview Update schemas lack `.strict()`, so route validators silently drop old field names instead of returning 400

> **Discovered in**: Audit Pass 3 (2026-04-20), orchestrator-verified via `rg -n "strict\(\)"` sweep
> **Severity**: **HIGH** (AC-002-02 / AC-003-03 violated at runtime despite passing unit tests)
> **Priority**: P1
> **Complexity**: 2 (two-line change per file + 3 integration tests)

### File / line

- `packages/schemas/src/entities/ownerPromotion/owner-promotion.schema.ts` — `OwnerPromotionUpdateInputSchema` definition
- `packages/schemas/src/entities/sponsorship/sponsorship.schema.ts` — `SponsorshipUpdateInputSchema` definition
- `packages/schemas/src/entities/accommodationReview/accommodationReview.crud.schema.ts:49` — `AccommodationReviewUpdateInputSchema` (uses `.omit()` but no `.strict()`)

### Evidence

```bash
$ rg -n "\.strict\(\)" packages/schemas/src/entities/{ownerPromotion,sponsorship,destinationReview,accommodationReview}/
packages/schemas/src/entities/destinationReview/destinationReview.crud.schema.ts:33:}).strict();
packages/schemas/src/entities/destinationReview/destinationReview.crud.schema.ts:62:    .strict();
```

Only DestinationReview's CRUD schemas apply `.strict()`. The peer entities rely on the test files applying `.strict()` manually in assertions:

```ts
// packages/schemas/test/entities/ownerPromotion/owner-promotion.crud.schema.test.ts:218
it('should reject legacy isActive field in update (strict mode, AC-002-02)', () => {
    const result = OwnerPromotionUpdateInputSchema.strict().safeParse({ isActive: false });
    //                                                   ^^^^^^^^ applied IN the test — not in production
    expect(result.success).toBe(false);
});
```

At runtime the API route uses `zValidator('json', OwnerPromotionUpdateInputSchema)` (Hono middleware). Without `.strict()`, Zod's default behavior is to **strip** unknown keys, not reject. So `PATCH /api/v1/admin/owner-promotions/:id` with `{ isActive: false }` will return 200 OK (key silently dropped) instead of the 400 VALIDATION_ERROR that AC-002-02 requires.

### What the spec required

- **AC-002-02** (spec.md:134-139): "Given any OwnerPromotion update request, When the request body includes `isActive: false`, Then the API returns a validation error, And the response explains that `isActive` is no longer a valid field."
- **AC-003-03** (spec.md:170-175): same contract for Sponsorship with the old `status` field.

### Proposed fix

In `owner-promotion.schema.ts`, add `.strict()` to the Update schema definition:

```ts
export const OwnerPromotionUpdateInputSchema = OwnerPromotionSchema
    .omit({ id: true, createdAt: true, updatedAt: true, createdById: true, updatedById: true, deletedAt: true })
    .partial()
    .strict();  // ← AC-002-02 enforcement
```

Same treatment for `SponsorshipUpdateInputSchema` (AC-003-03) and `AccommodationReviewUpdateInputSchema` (defense-in-depth).

Add integration tests at `apps/api/test/integration/` verifying that PATCH returns 400 when the old field is sent.

### Decision

**Fix directly.** Bundle with GAP-063-017 (the integration-test counterpart). High severity because the acceptance criterion is violated silently — tests are green but production is non-compliant.

### Decisión del usuario (triage 2026-04-20)

**HACER** — bundle Q4 (Strict Mode + AC Rejection Tests: 016 + 017). Agregar `.strict()` a `OwnerPromotionUpdateInputSchema`, `SponsorshipUpdateInputSchema`, `AccommodationReviewUpdateInputSchema`.

---

## GAP-063-017 — No route-level integration tests enforce AC-002-02 / AC-003-03 rejection (schema unit tests only)

> **Discovered in**: Audit Pass 3 (2026-04-20), Agent D
> **Severity**: MEDIUM (companion to GAP-063-016: even when `.strict()` is added, we need runtime regression coverage)
> **Priority**: P2
> **Complexity**: 2

### File / line

Non-existent: `apps/api/test/integration/**` has no test that PATCHes old field names against the admin route and asserts 400.

### Evidence

```bash
$ rg -n "AC-002-02|AC-003-03|isActive.*400|status.*400" apps/api/test/ -l
# nothing at apps/api/test/integration/ — only schema unit tests in packages/schemas/test/
```

The schema-level tests (`owner-promotion.crud.schema.test.ts:218` + `sponsorship.schema.test.ts:418`) are correct but operate on the isolated schema. They do NOT exercise the Hono route → `zValidator` → service → response pipeline. If the route handler omits `.strict()` wiring (GAP-063-016), the schema test still passes.

### Proposed fix

Add to `apps/api/test/integration/admin/` (or extend the existing lifecycle cross-cutting test):

```ts
describe('AC-002-02 — PATCH /admin/owner-promotions/:id rejects isActive', () => {
    it('returns 400 when body includes legacy isActive field', async () => {
        const res = await adminApp.request(`/admin/owner-promotions/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ isActive: false }),
            headers: authHeaders
        });
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error.code).toBe('VALIDATION_ERROR');
    });
});

describe('AC-003-03 — PATCH /admin/sponsorships/:id rejects legacy status', () => {
    it('returns 400 when body includes legacy status field', async () => {
        const res = await adminApp.request(`/admin/sponsorships/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'active' }),
            headers: authHeaders
        });
        expect(res.status).toBe(400);
    });
});
```

### Decision

**Fix directly.** Bundle with GAP-063-016 in the same PR — they are meaningless without each other.

### Decisión del usuario (triage 2026-04-20)

**HACER** — bundle Q4 (Strict Mode + AC Rejection Tests: 016 + 017). Agregar integration tests en `apps/api/test/integration/admin/` para AC-002-02 (OwnerPromotion isActive → 400) y AC-003-03 (Sponsorship status → 400), más el equivalente para AccommodationReview como defense-in-depth.

---

## GAP-063-018 — AccommodationReview DB table missing `lifecycle_state` index (parity gap)

> **Discovered in**: Audit Pass 3 (2026-04-20), Agent C + orchestrator-verified
> **Severity**: LOW (functional correctness unaffected; performance gap at scale)
> **Priority**: P3
> **Complexity**: 1 (one-line addition + push)

### File / line

`packages/db/src/schemas/accommodation/accommodation_review.dbschema.ts` — indexes table at the bottom of the `pgTable` definition.

### Evidence

```bash
$ rg -n "accommodationReviews_lifecycleState_idx" packages/db/src/schemas/
# no results — index DOES NOT exist

$ rg -n "_lifecycleState_idx" packages/db/src/schemas/ | wc -l
8   # users, eventOrganizers, destinationReviews, eventLocations, attractions, sponsorships,
    # ownerPromotions (both plain + composite). AccommodationReview is the only entity with
    # a lifecycle_state column but NO lifecycle_state index.
```

The column exists (`accommodation_review.dbschema.ts:34`, added pre-SPEC-063 per the spec's Phase 1 verification) but the index was never added. Peer entities added under SPEC-063 (Phases 2-4) all got their indexes. This is a pure parity oversight.

### What the spec required

Spec Phase 1 was declared "verification only" because AccommodationReview was already compliant. But spec lines 387, 406, 429 all require `_lifecycleState_idx` on the new tables. The analogous index on the existing AccommodationReview table was not part of Phase 1 verification, so it was silently skipped.

Any admin query that filters by `lifecycleState` (e.g., `GET /admin/accommodation-reviews?status=DRAFT`) currently does a sequential scan on the whole `accommodation_reviews` table. With low row counts this is invisible; at scale it becomes a slow query.

### Proposed fix

Add to `accommodation_review.dbschema.ts` indexes object:

```ts
accommodationReviews_lifecycleState_idx: index('accommodationReviews_lifecycleState_idx').on(table.lifecycleState),
```

Since the project is push-only (no production DB), `pnpm db:fresh-dev` re-applies the schema. Per project rule (see project_push_only_migrations memory), no migration SQL file needed; just update the Drizzle schema and push.

### Decision

**Fix directly.** Trivial, improves parity with peers. Bundle with GAP-063-013 (also schema-parity for AccommodationReview).

---

## GAP-063-019 — AccommodationReview schema tests missing parity coverage for `lifecycleState` defaults + enum rejection

> **Discovered in**: Audit Pass 3 (2026-04-20), Agent D
> **Severity**: MEDIUM (coverage gap; Pass 1 already noted Phase 1 "verification only" shipped without test coverage)
> **Priority**: P2
> **Complexity**: 2

### File / line

`packages/schemas/test/entities/accommodationReview/` — the schema and CRUD schema test files.

### Evidence

Peer entities have explicit lifecycleState tests:
- `packages/schemas/test/entities/sponsorship/sponsorship.schema.test.ts:418` — `describe('SponsorshipSchema — lifecycleState (AC-003-03)', ...)`
- `packages/schemas/test/entities/ownerPromotion/owner-promotion.crud.schema.test.ts:218` — AC-002-02 rejection test

AccommodationReview was declared "verification only" in SPEC-063 Phase 1 (spec.md:364-382). Per spec lines 664-667, Phase 1 test plan required:
> "Schema tests: Verify `lifecycleState` field exists in `AccommodationReviewSchema` via `BaseLifecycleFields`, accepts DRAFT/ACTIVE/ARCHIVED, defaults to ACTIVE"

These tests don't exist. The lifecycleState field inherits its behavior from `BaseLifecycleFields`, but there is no AccommodationReview-specific assertion that the inheritance is wired correctly in the final schema. A future refactor that accidentally strips `...BaseLifecycleFields` from `AccommodationReviewSchema` would not be caught.

### Proposed fix

Add to an appropriate test file:

```ts
describe('AccommodationReviewSchema — lifecycleState', () => {
    it('defaults to ACTIVE on create', () => {
        const result = AccommodationReviewCreateInputSchema.parse(validInput);
        expect(result.lifecycleState).toBe('ACTIVE');
    });
    it('accepts DRAFT and ARCHIVED', () => {
        for (const state of ['DRAFT', 'ACTIVE', 'ARCHIVED']) {
            expect(AccommodationReviewSchema.safeParse({ ...valid, lifecycleState: state }).success).toBe(true);
        }
    });
    it('rejects invalid enum values', () => {
        const r = AccommodationReviewSchema.safeParse({ ...valid, lifecycleState: 'FOO' });
        expect(r.success).toBe(false);
    });
    it('Public schema excludes lifecycleState', () => {
        const r = AccommodationReviewPublicSchema.safeParse({ ...valid, lifecycleState: 'ACTIVE' });
        // field should not be in the parsed shape
        expect((r as { data?: Record<string, unknown> }).data?.lifecycleState).toBeUndefined();
    });
});
```

### Decision

**Fix directly.** Bundle with GAP-063-013 (same entity, same file family). Low effort, closes the Phase 1 verification-coverage hole that SPEC-063 explicitly listed but never delivered.

### Decisión del usuario (triage 2026-04-20)

**HACER** — bundle Q2 (Schema Parity AccRev: 013 + 019). Agregar 4 tests de `lifecycleState` (default ACTIVE en create, acepta DRAFT/ACTIVE/ARCHIVED, rechaza enum inválido, Public excluye el campo).

---

## GAP-063-020 — No security test ensures soft-delete filter ordering vs. lifecycleState filter on public tier

> **Discovered in**: Audit Pass 3 (2026-04-20), Agent D
> **Severity**: MEDIUM (latent; depends on whether any soft-deleted record has `lifecycleState = ACTIVE` by production accident)
> **Priority**: P2
> **Complexity**: 2

### File / line

Cross-cutting concern. Service methods that layer both filters:
- `accommodationReview.service.ts:513-518` (listByAccommodation — filter is `{ accommodationId, deletedAt: null }`; GAP-001 adds lifecycleState)
- `destinationReview.service.ts:160-177` (_executeSearch — filter is `{ ...filters, deletedAt: null }`; GAP-003 adds lifecycleState)
- `ownerPromotion.service.ts:_executeSearch` (correct force-override)
- `sponsorship.service.ts:_executeSearch` (correct force-override)

### Evidence

Every service currently combines `deletedAt: null` + (some form of) `lifecycleState: ACTIVE` in the public path. These are two independent invariants:
1. Soft-deleted records must never leak.
2. Non-ACTIVE records must never leak on public tier.

There is no regression test that creates a record with `lifecycleState = ACTIVE` + `deletedAt = NOW()` and verifies it is excluded from public endpoints. The model's `findAll` applies both as AND conditions today, but if a future refactor of `_executeSearch` moves `deletedAt` handling out of the base model (e.g., SPEC-082 "soft-deleted related entities"), a record that is ACTIVE + soft-deleted could silently leak.

### Proposed fix

Add to `apps/api/test/integration/cross-cutting/lifecycle-public-endpoints.test.ts` (or a sibling security test):

```ts
describe('soft-delete + lifecycleState invariants', () => {
    it.each([
        ['AccommodationReview', 'GET /api/v1/public/accommodations/:id/reviews'],
        ['DestinationReview',   'GET /api/v1/public/destinations/:id/reviews'],
        ['OwnerPromotion',      'GET /api/v1/public/owner-promotions/:id'],
    ])('%s: record with lifecycleState=ACTIVE AND deletedAt=now is excluded from %s', async (_name, path) => {
        // seed the record: ACTIVE + soft-deleted
        // hit the public endpoint
        // assert record is NOT in the response
    });
});
```

### Decision

**Fix directly.** Small effort, guards against a plausible future regression. Bundle with GAP-063-011 since both live in the same cross-cutting test file.

---

## GAP-063-021 — `SponsorshipLevel` and `SponsorshipPackage` still use `isActive` boolean (out-of-spec but adjacent — candidate for follow-up SPEC)

> **Discovered in**: Audit Pass 3 (2026-04-20), orchestrator spot-check
> **Severity**: INFO (explicitly out of SPEC-063 scope per spec.md:549-551)
> **Priority**: — (tracked as follow-up, not SPEC-063 gap)
> **Complexity**: —

### File / line

- `packages/db/src/schemas/sponsorship/sponsorship_level.dbschema.ts:32,50` — `isActive: boolean('is_active')` column + `sponsorshipLevels_isActive_idx`
- `packages/db/src/schemas/sponsorship/sponsorship_package.dbschema.ts:21,36,42-44` — `isActive` column + 2 indexes

### Evidence

SPEC-063's "In Scope" list (spec.md line 532-537) is 4 entities: OwnerPromotion, Sponsorship, AccommodationReview, DestinationReview. The "Out of Scope" list (line 549-550) is "any entity outside the 6 SPEC-057 entities". SponsorshipLevel and SponsorshipPackage are NOT in the 6; they are price/package definition entities adjacent to Sponsorship. They legitimately use `isActive` today.

However: once SPEC-063's goal ("every entity has `lifecycleState: LifecycleStatusEnum` as the base lifecycle contract", spec.md line 42) is accepted as the project's architectural direction, these two entities are the most visible deviations remaining. A future sweep (equivalent to SPEC-057's audit) would likely include them.

### Fix needed in SPEC-063 scope? NO.

This is explicitly out of scope. Recording it here only so the future author of the follow-up spec has a pre-identified starting point.

### Decision

**New SPEC.** Propose a follow-up (e.g., `SPEC-09X-lifecycle-state-phase-2-sponsorship-catalog`) that sweeps SponsorshipLevel, SponsorshipPackage, and any other entity audit surfaces post-SPEC-063.

---

## Updated summary by area (after Pass 3)

| Area | Count | Highest severity |
|------|-------|------------------|
| Service layer (`packages/service-core`) | 5 (GAP-001/003/004 + 015 + partial 005) | CRITICAL |
| API routes (`apps/api/src/routes`) | 2 (GAP-002/005) | CRITICAL |
| Schema runtime enforcement | 1 NEW (GAP-016 — `.strict()` missing) | HIGH |
| Admin frontend (`apps/admin`) | 2 (GAP-006/007) | MEDIUM |
| Schema coverage | 1 (GAP-013) + 1 NEW (GAP-019) | MEDIUM |
| Integration tests (AC rejection + record exclusion) | 1 (GAP-011) + 2 NEW (GAP-017/020) | HIGH |
| DB schema parity | 1 NEW (GAP-018 — missing idx) | LOW |
| Documentation (spec + TODOs) | 2 (GAP-008/009) | LOW |
| i18n (`packages/i18n`) | 1 (GAP-014 — promoted) | LOW |
| Cron observability | 1 (GAP-012 — deferred) | LOW |
| Systemic (tracked elsewhere) | 1 (GAP-010 → SPEC-087) | INFO |
| Out-of-spec follow-up | 1 NEW (GAP-021 — new SPEC) | INFO |

## Recommended fix order (after Pass 3)

1. **Security-hardening PR** (bundle, P0+P1): GAP-063-001, 002, 003, 004, 005 + GAP-063-011 tests + GAP-063-013 (schema parity) + GAP-063-019 (schema test parity) + GAP-063-020 (soft-delete + lifecycle test). Single PR titled `security(spec-063-gaps): enforce lifecycleState=ACTIVE on public review + promotion endpoints + test coverage`. Still the top block.
2. **Strict-mode enforcement PR** (P1): GAP-063-016 + GAP-063-017 together — add `.strict()` to Update schemas + route integration tests for AC-002-02/AC-003-03 rejection. Cannot land without the matching integration tests or we regress silently.
3. **Admin cleanup PR** (P2): GAP-063-006 + 007. Single commit.
4. **DB + docs cleanup** (P3): GAP-063-008 + 009 + 018. Single commit (Drizzle push + spec doc fix + TODOs.md update).
5. **Design decision needed** (P2 → new SPEC): GAP-063-015 (promote to `SPEC-09X-sponsorship-status-permission-split` with Option 1 vs 2 decision).
6. **Cross-project** (LOW → dedicated SPEC): GAP-063-014 (i18n PT translation audit across all locale files).
7. **Follow-up SPEC** (INFO): GAP-063-021 (SponsorshipLevel/SponsorshipPackage lifecycle sweep — out of SPEC-063 scope).

---

## Audit Pass 4 — 2026-04-20

**Auditor**: Claude Opus 4.7 (tech-lead orchestrator) + 4 parallel Explore sub-agents
**Agents scope split** (intentionally non-overlapping with Pass 3):
- **Agent A** — Service hooks (especially restore/archive hooks) + model layer + cron internals (Sentry, advisory lock failure modes, batch boundaries) + cross-service consumers
- **Agent B** — All API route tiers (public/protected/admin/custom) + admin frontend column/filter/mutation wiring + web app consumers + OpenAPI route declarations
- **Agent C** — Composite-index audit + DB schema parity + i18n key parity (ES/EN/PT new keys) + seed/fixtures sweep + manual postgres extras
- **Agent D** — Test plan vs. reality cross-check + permission boundary tests + observability (logging/Sentry tags) + ADR/docs drift + state-machine semantics for lifecycle transitions

**Orchestrator spot-verification** (against actual files):
- `restore()` in `packages/db/src/base/base.model.ts:461-498` only updates `{ deletedAt: null, updatedAt: new Date() }` — **does NOT reset `lifecycleState`**.
- `_beforeRestore` + `_afterRestore` in `accommodationReview.service.ts:455-490` and `destinationReview.service.ts:467-498` only do stats recalc + revalidation — **NEITHER resets `lifecycleState`**.
- `OwnerPromotionService` and `SponsorshipService` have **no `_beforeRestore` / `_afterRestore` hooks at all** → restored records keep their pre-deletion `lifecycleState` (often ARCHIVED) and remain hidden from the public tier silently.
- `accommodation_reviews_lifecycleState_idx`: **does not exist** (already GAP-018) AND no composite `(accommodationId, lifecycleState)` index exists.
- `destination_reviews_destinationId_lifecycleState_idx`: **does not exist** (only single-field indexes on each).
- `sponsorships_sponsorshipStatus_lifecycleState_idx`: **does not exist** — `findActiveByTarget()` filters by both fields and currently does index-merge instead of single composite lookup.
- `apps/admin/src/features/sponsorships/components/SponsorshipsTab.tsx` line 245 has a `lifecycleState` filter dropdown but the columns array (lines 41-168) has **no display column** for `lifecycleState` → admin filters and sees no visual confirmation of the filter.
- `apps/api/src/cron/jobs/archive-expired-promotions.job.ts:184-186` calls `Sentry.captureException` from inside the outer catch block without secondary protection. If the Sentry client throws (transport failure, OOM), the cron handler crashes and the operator gets no error.
- `Cron job lockResult.rows?.[0]?.acquired` at lines 84-87 silently skips the run on EITHER "lock held" OR "DB error returned malformed result" — same code path, no telemetry distinction.

### Headline result for Pass 4

- **0 of the 21 Pass 1-3 gaps remediated.** All still present in exactly the state prior passes described.
- **11 NEW gaps discovered** — GAP-063-022 through GAP-063-032. Total gap count: **32**.
- **Several Pass 4 sub-agent claims rejected on verification**:
  - Agent A claimed "OwnerPromotionService missing `_beforeCreate` lifecycle hook (MEDIUM)". **Rejected** — schema-level default `lifecycleState = ACTIVE` already enforces this; adding a hook would be redundant per SDD's KISS principle. Spec explicitly does NOT require state-machine validation (line 32 mentions free transitions). No gap.
  - Agent A claimed "Cron batch boundary not validated against statement_timeout (MEDIUM)". **Downgraded to INFO** — UPDATE of 100 indexed rows in <5s is empirically safe; this is documentation/load-test polish, not a SPEC-063 gap. Skipped from main list.
  - Agent D claimed "SPONSORSHIP_STATUS_MANAGE unused (LOW)". **Rejected** — exact duplicate of GAP-063-015 from Pass 2 (already open).
  - Agent D claimed "Concurrent updatedAt edge case test (LOW)". **Rejected** — speculative; `updatedAt` is set in service code via `new Date()` and is universally tested in BaseCrudService unit tests already.

### Re-verification table (Pass 1-3 gaps)

| Gap | Status in Pass 4 | Evidence |
|-----|------------------|----------|
| GAP-063-001..005 | STILL PRESENT | All 5 service/route security gaps unchanged across files re-read this pass. |
| GAP-063-006 | STILL PRESENT | `sponsor-dashboard/hooks.ts:30` still `status=active`. |
| GAP-063-007 | STILL PRESENT | `sponsor-dashboard/types.ts:49-54` still uses bare `status?: string`. |
| GAP-063-008 | STILL PRESENT | TODOs.md unchanged from Pass 3. |
| GAP-063-009 | STILL PRESENT | `spec.md:318` still says `pg_try_advisory_lock`. |
| GAP-063-010 | INFO (SPEC-087) | Unchanged. |
| GAP-063-011 | STILL PRESENT | Cross-cutting test still only covers field-strip, not record exclusion. |
| GAP-063-012 | DEFERRED | Unchanged — product call. |
| GAP-063-013 | STILL PRESENT | `accommodationReview.query.schema.ts` still no `lifecycleState` filter. |
| GAP-063-014 | STILL PRESENT | `pt/validation.json` still placeholder Spanish. |
| GAP-063-015 | STILL PRESENT | `SPONSORSHIP_STATUS_MANAGE` still unused. |
| GAP-063-016 | STILL PRESENT | OwnerPromotion/Sponsorship/AccommodationReview Update schemas still lack `.strict()`. |
| GAP-063-017 | STILL PRESENT | No route-level integration tests for AC-002-02 / AC-003-03. |
| GAP-063-018 | STILL PRESENT | `accommodationReviews_lifecycleState_idx` still missing. |
| GAP-063-019 | STILL PRESENT | AccommodationReview parity coverage still missing. |
| GAP-063-020 | STILL PRESENT | No soft-delete + lifecycle invariant test. |
| GAP-063-021 | STILL PRESENT (out of scope) | SponsorshipLevel/SponsorshipPackage still use `isActive`. |

### What Pass 4 ADDITIONALLY VERIFIED AS CORRECT (no gap)

- `OwnerPromotion` index parity is correct: has both single (`ownerPromotions_lifecycleState_idx`) and composite (`ownerPromotions_ownerId_lifecycleState_idx`).
- `apps/admin/src/features/sponsorships/components/SponsorshipsTab.tsx` filter dropdown for `lifecycleState` (lines 245-268) is functionally correct and i18n-wired.
- Cron job `withTransaction` wrapping is correct; advisory lock is `_xact_` (transaction-level) per project rule.
- Cron `dryRun` branching is implemented per spec.
- `recalculate*Stats` flows in review services correctly use the model's aggregation helpers (no double-counting of soft-deleted reviews observed).

---

## GAP-063-022 — `restore()` does not reset `lifecycleState` → soft-deleted ARCHIVED records remain hidden after restore

> **Discovered in**: Audit Pass 4 (2026-04-20), Agents A + D (cross-confirmed)
> **Severity**: **CRITICAL** (silent data hiding; restore appears successful but record stays invisible to public/protected tiers)
> **Priority**: P0
> **Complexity**: 3 (touches base infra OR requires per-entity hook overrides + tests)

### File / line

- `packages/db/src/base/base.model.ts:461-498` — `restore()` only sets `{ deletedAt: null, updatedAt: new Date() }`.
- `packages/service-core/src/services/accommodationReview/accommodationReview.service.ts:455-490` — `_beforeRestore` / `_afterRestore` hooks do stats + revalidation, **never touch `lifecycleState`**.
- `packages/service-core/src/services/destinationReview/destinationReview.service.ts:467-498` — same pattern, no `lifecycleState` reset.
- `packages/service-core/src/services/owner-promotion/ownerPromotion.service.ts` — **no restore hooks defined at all**.
- `packages/service-core/src/services/sponsorship/sponsorship.service.ts` — **no restore hooks defined at all**.

### Evidence

```ts
// base.model.ts:485-490
const result = await db
    .update(this.table)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(whereClause)
    .returning();
```

Scenario that breaks:
1. Admin sets a Sponsorship to `lifecycleState = ARCHIVED` (legitimate, AC-003-02).
2. Later, the same admin (or cleanup process) soft-deletes it (`deletedAt = NOW`).
3. Days later, admin restores via `restore()`. Result: `deletedAt = NULL`, **`lifecycleState = ARCHIVED` preserved** → record is back in the table but invisible to public listings (which require `lifecycleState = ACTIVE`).
4. Admin sees "restored successfully" feedback in the UI but the record never reappears on the public tier. This is a silent class of bug.

The same applies to OwnerPromotion (auto-archive cron may have flipped to ARCHIVED before soft-delete happened in another flow), DestinationReview, and AccommodationReview.

### What spec required

Spec is silent on restore semantics for `lifecycleState`. The implicit invariant per AC-005-01 ("public listing endpoints filter by lifecycleState = ACTIVE") combined with the user expectation that "restore makes a record usable again" implies that restore must either (a) reset to ACTIVE or (b) require explicit lifecycle re-activation as a separate step.

### Proposed fix

Two design options (user decision required):

1. **Auto-reset on restore** (less surprise, mirrors soft-delete intent): in each entity service, override `_afterRestore` to flip `lifecycleState = ACTIVE` via a follow-up update. Could also be implemented in the base `restore()` if the table has a `lifecycle_state` column — gated by introspection, similar to existing `deletedAt` check.
2. **Two-step restore** (explicit, audit-friendly): keep `lifecycleState` as-is on restore. Document UI/API contract: restore is followed by an explicit "Activate" call. UI must surface restored records as "needs activation".

Recommended: **Option 1**, gated in the base model when the table has a `lifecycle_state` column. Low complexity, matches the principle of least surprise, fixes all 4 entities + any future entity simultaneously. Add 4 regression tests (one per entity) verifying `restore(softDeletedArchivedRecord)` returns `lifecycleState = 'ACTIVE'`.

### Decision

**Fix directly** with user-approved option choice. CRITICAL because the bug is silent (no error, no warning) and corrupts the data-visibility contract across all 4 SPEC-063 entities. Bundle into a small dedicated PR `fix(spec-063-gaps): reset lifecycleState=ACTIVE on restore`.

### Decisión del usuario (triage 2026-04-20)

**HACER — Option 1A** (auto-reset en `BaseModel.restore()`, gateado por introspección de columna `lifecycle_state`). Arregla las 4 entidades + cualquier futura de un saque. Agregar 4 regression tests (uno por entidad) verificando `restore(softDeletedArchivedRecord).lifecycleState === 'ACTIVE'`.

---

## GAP-063-023 — AccommodationReview missing composite index `(accommodationId, lifecycleState)` for the dominant public-list query

> **Discovered in**: Audit Pass 4 (2026-04-20), Agent C + orchestrator-verified
> **Severity**: **HIGH** (performance; current state forces sequential scan after GAP-001 is fixed)
> **Priority**: P1
> **Complexity**: 1 (one-line addition; push)

### File / line

`packages/db/src/schemas/accommodation/accommodation_review.dbschema.ts:43-53` — indexes block has only `accommodationId` and `userId` single indexes.

### Evidence

```bash
$ rg -n "index\(" packages/db/src/schemas/accommodation/accommodation_review.dbschema.ts
44: accommodation_reviews_accommodationId_idx
47: accommodation_reviews_userId_idx
```

Compare with OwnerPromotion which has `ownerPromotions_ownerId_lifecycleState_idx` (composite) precisely because the dominant query is "list ACTIVE promotions for a given owner". The AccommodationReview equivalent — "list ACTIVE reviews for a given accommodation" — is `listByAccommodation`, the most-called public endpoint for this entity. Once GAP-063-001 fixes the missing `lifecycleState = ACTIVE` filter, the query will need a composite index, otherwise PostgreSQL will pick the `accommodationId` single index and filter `lifecycleState` post-fetch.

### What spec required

Spec line 387 documents the composite index pattern for OwnerPromotion. Phase 1 (AccommodationReview) was declared "verification only" because the entity was already compliant — but the index optimization for the new public filter contract was implicitly skipped.

### Proposed fix

Add to `accommodation_review.dbschema.ts`:

```ts
accommodation_reviews_lifecycleState_idx: index('accommodation_reviews_lifecycleState_idx').on(table.lifecycleState),
accommodation_reviews_accommodationId_lifecycleState_idx: index('accommodation_reviews_accommodationId_lifecycleState_idx').on(table.accommodationId, table.lifecycleState),
```

The first one closes GAP-063-018 (parity). The second is the new composite for `listByAccommodation`. Run `pnpm db:fresh-dev` per push-only policy.

### Decision

**Fix directly.** Bundle with GAP-063-018 (single index gap) and GAP-063-013 (schema parity) — same file family, single PR.

---

## GAP-063-024 — DestinationReview missing composite index `(destinationId, lifecycleState)`

> **Discovered in**: Audit Pass 4 (2026-04-20), Agent C
> **Severity**: MEDIUM (performance gap analogous to GAP-063-023, surfaces only after GAP-063-002 introduces `listByDestination`)
> **Priority**: P2
> **Complexity**: 1

### File / line

`packages/db/src/schemas/destination/destination_review.dbschema.ts:33-42` — has single `destinationId`, single `userId`, single `lifecycleState`, no composite.

### Evidence

Same as GAP-063-023 but for the destination-side equivalent. Once GAP-063-002 lands and `listByDestination` filters by `(destinationId, lifecycleState=ACTIVE, deletedAt=null)`, PostgreSQL will need a composite index on `(destinationId, lifecycleState)` to avoid index-merge or sequential scans on the destination subset.

### Proposed fix

```ts
destination_reviews_destinationId_lifecycleState_idx: index('destination_reviews_destinationId_lifecycleState_idx').on(table.destinationId, table.lifecycleState),
```

### Decision

**Fix directly.** Bundle with GAP-063-023 in the same DB-schema PR.

---

## GAP-063-025 — Sponsorship missing composite index `(sponsorshipStatus, lifecycleState)` for `findActiveByTarget`

> **Discovered in**: Audit Pass 4 (2026-04-20), Agent C
> **Severity**: LOW (performance; only material at scale)
> **Priority**: P3
> **Complexity**: 1

### File / line

`packages/db/src/schemas/sponsorship/sponsorship.dbschema.ts:57-76` — has single `sponsorshipStatus_idx` AND single `lifecycleState_idx` but no composite.

### Evidence

`SponsorshipModel.findActiveByTarget()` (per Pass 3 verification at `sponsorship.model.ts`) filters by **both** `sponsorshipStatus = 'active'` AND `lifecycleState = 'ACTIVE'`. With two single-field indexes, PostgreSQL chooses one and post-filters, or does an index-merge — both worse than a true composite for this exact query.

### Proposed fix

```ts
sponsorships_sponsorshipStatus_lifecycleState_idx: index('sponsorships_sponsorshipStatus_lifecycleState_idx').on(table.sponsorshipStatus, table.lifecycleState),
```

Optional further improvement: include `targetType, targetId` in the composite if the query uses them as primary lookup keys (verify EXPLAIN before adding).

### Decision

**Fix directly.** LOW priority but trivial. Bundle with GAP-063-023/024.

---

## GAP-063-026 — SponsorshipsTab admin grid has lifecycleState FILTER but no display COLUMN (UX inconsistency)

> **Discovered in**: Audit Pass 4 (2026-04-20), Agent B
> **Severity**: MEDIUM (admin UX; admin filters and gets results but cannot see WHICH lifecycleState each row has)
> **Priority**: P2
> **Complexity**: 1

### File / line

`apps/admin/src/features/sponsorships/components/SponsorshipsTab.tsx` — columns array at ~lines 41-168 (no `lifecycleState` column), filter dropdown at lines 245-268.

### Evidence

The filter exists and works (line 245: `value={filters.lifecycleState || 'all'}`), but no column in the DataTable definition renders the `lifecycleState` value per row. Admins applying the filter cannot visually confirm the filter is correct or compare lifecycleState across visible rows.

Compare with `sponsorshipStatus` which has BOTH a filter (line 195) AND a display column (line 83-85, badge-rendered).

### Proposed fix

Add a `lifecycleState` column to the columns array, mirroring the `sponsorshipStatus` column shape:

```tsx
{
    id: 'lifecycleState',
    header: t('admin-billing.sponsorships.columns.lifecycleState'),
    accessorKey: 'lifecycleState',
    enableSorting: true,
    columnType: ColumnType.BADGE,
    badgeOptions: [
        { value: LifecycleStatusEnum.DRAFT,    label: t('common.lifecycle.draft'),    color: BadgeColor.GRAY },
        { value: LifecycleStatusEnum.ACTIVE,   label: t('common.lifecycle.active'),   color: BadgeColor.GREEN },
        { value: LifecycleStatusEnum.ARCHIVED, label: t('common.lifecycle.archived'), color: BadgeColor.AMBER }
    ]
}
```

Verify i18n keys `common.lifecycle.{draft,active,archived}` exist or use the project's existing lifecycle badge component if one was introduced (see `apps/admin/src/components/LifecycleBadge.tsx` — to verify).

### Decision

**Fix directly.** Bundle with GAP-063-006 + GAP-063-007 in the admin cleanup PR — same domain (sponsor/sponsorship UI).

### Decisión del usuario (triage 2026-04-20)

**HACER** — bundle Q1 (Admin Dashboard: 006 + 007 + 026). Agregar columna `lifecycleState` al `SponsorshipsTab` DataTable con badge (DRAFT/ACTIVE/ARCHIVED); reusar `LifecycleBadge` existente o `ColumnType.BADGE` pattern.

---

## GAP-063-027 — Cron `Sentry.captureException` is not error-isolated; a Sentry transport failure crashes the cron handler

> **Discovered in**: Audit Pass 4 (2026-04-20), Agent A
> **Severity**: LOW (defensive coding; Sentry SDK typically swallows internal errors but the contract is not guaranteed)
> **Priority**: P3
> **Complexity**: 1

### File / line

`apps/api/src/cron/jobs/archive-expired-promotions.job.ts:184-186`

### Evidence

```ts
} catch (error) {
    // ...
    Sentry.captureException(error, {
        tags: { cronJob: 'archive-expired-promotions', phase: 'top-level' }
    });
    logger.error('archive-expired-promotions job failed', { ... });
    // ...
}
```

`Sentry.captureException` is invoked outside any inner try-catch. If the Sentry SDK throws synchronously (e.g., misconfigured DSN, OOM during serialization), the catch handler crashes before logging or returning the structured `CronJobResult`. The cron dispatcher then sees an uncaught exception instead of `{ success: false, ... }`.

In practice the Sentry Node SDK logs and silently returns on internal errors, so this is **defensive only**. Worth flagging because the cron contract requires a structured result to be returned even on failure.

### What spec required

Spec line 324 says: "If the batch update fails, log the error via `ctx.logger.error()` and report to Sentry (follow existing pattern). Do NOT retry in the same run." Implicit contract: the handler must always return a `CronJobResult`.

### Proposed fix

Wrap the Sentry call:

```ts
try {
    Sentry.captureException(error, {
        tags: { cronJob: 'archive-expired-promotions', phase: 'top-level' }
    });
} catch (sentryErr) {
    logger.warn('Failed to report cron error to Sentry', {
        source: LOG_SOURCE,
        sentryError: sentryErr instanceof Error ? sentryErr.message : String(sentryErr)
    });
}
```

### Decision

**Fix directly.** Trivial. Optionally extract a `safeReportToSentry()` helper if the same pattern is reused across cron jobs (cross-cutting cleanup).

### Decisión del usuario (triage 2026-04-20)

**HACER** — bundle Q6 (Cron Hygiene: 027 + 028, junto con autónomos 038 + 045). Wrap `Sentry.captureException` en try-catch con `logger.warn` fallback; considerar `safeReportToSentry()` helper reutilizable.

---

## GAP-063-028 — Cron advisory-lock check cannot distinguish "lock held" from "DB returned malformed result" → silent skip on infra error

> **Discovered in**: Audit Pass 4 (2026-04-20), Agent A
> **Severity**: MEDIUM (observability; transient DB issues become invisible silent skips)
> **Priority**: P2
> **Complexity**: 2

### File / line

`apps/api/src/cron/jobs/archive-expired-promotions.job.ts:82-89`

### Evidence

```ts
const lockResult = await tx.execute(
    sql`SELECT pg_try_advisory_xact_lock(${ADVISORY_LOCK_ID}) as acquired`
);
const acquired = (lockResult.rows?.[0] as Record<string, unknown> | undefined)
    ?.acquired;

if (!acquired) {
    return { skipped: true };
}
```

Both of these conditions return `{ skipped: true }`:
- (Expected) Another instance holds the lock (`acquired = false`).
- (Unexpected) `lockResult.rows` is empty/null/undefined or `acquired` is missing/wrong type → defaults to `undefined`/`false`.

Operator runbook treats "skipped" as a benign overlap. A real DB error that breaks the lock acquisition path becomes invisible. No log line, no Sentry breadcrumb, no metric.

### Proposed fix

Validate the result shape and distinguish:

```ts
const lockRow = lockResult.rows?.[0] as Record<string, unknown> | undefined;
if (!lockRow || typeof lockRow.acquired !== 'boolean') {
    logger.error('advisory-lock query returned malformed result', {
        source: LOG_SOURCE,
        rowCount: lockResult.rows?.length ?? 0,
        rowSample: lockRow
    });
    Sentry.captureMessage('cron lock query malformed', {
        level: 'error',
        tags: { cronJob: 'archive-expired-promotions', phase: 'lock-check' }
    });
    throw new Error('Advisory lock acquisition mechanism returned unexpected response');
}
if (!lockRow.acquired) {
    logger.info('skipped: another instance holds the lock', { source: LOG_SOURCE });
    return { skipped: true };
}
```

### Decision

**Fix directly.** Bundle with GAP-063-027 in a cron-resilience commit.

### Decisión del usuario (triage 2026-04-20)

**HACER** — bundle Q6 (Cron Hygiene: 027 + 028, junto con autónomos 038 + 045). Validar shape de `lockResult.rows?.[0]`; distinguir lock-held (log INFO, skipped) de row malformada (log ERROR + Sentry + throw).

---

## GAP-063-029 — Sponsorship admin-list integration test for `lifecycleState` filter is missing (AC-003-02 only covered at schema layer)

> **Discovered in**: Audit Pass 4 (2026-04-20), Agent D
> **Severity**: MEDIUM (coverage gap; AC-003-02 cannot be regression-tested without route-level test)
> **Priority**: P2
> **Complexity**: 2

### File / line

`apps/api/test/integration/sponsorship/admin-search-filters.test.ts` — exists, covers `targetType` and `sponsorshipStatus` filters, but has **no test case** asserting that the base `?status=ARCHIVED` (mapped via `AdminSearchBaseSchema.status` → `lifecycleState`) actually returns only ARCHIVED sponsorships at the route level.

### Evidence

Schema-level tests exist (`packages/schemas/test/entities/sponsorship/sponsorship.admin-search.schema.test.ts`). They prove the schema accepts the filter. They do NOT prove the Hono route → service → model → DB chain returns the right data subset.

This is the Sponsorship analog of the missing route test family that GAP-063-017 already flagged for AC-002-02 / AC-003-03 (Update rejection). Together they reveal a systemic gap: SPEC-063's route-level assertions for AC-001 / AC-003 family are absent.

### Proposed fix

Add to `apps/api/test/integration/sponsorship/admin-search-filters.test.ts`:

```ts
describe('AC-003-02 — lifecycleState filter independent of sponsorshipStatus', () => {
    beforeAll(async () => {
        await seedSponsorship({ lifecycleState: 'ACTIVE',   sponsorshipStatus: 'pending' });
        await seedSponsorship({ lifecycleState: 'DRAFT',    sponsorshipStatus: 'active' });
        await seedSponsorship({ lifecycleState: 'ARCHIVED', sponsorshipStatus: 'expired' });
    });

    it('filters by lifecycleState=ARCHIVED', async () => {
        const res = await adminApp.request('/admin/sponsorships?status=ARCHIVED', { headers: authHeaders });
        const json = await res.json();
        expect(json.data.items).toHaveLength(1);
        expect(json.data.items[0].lifecycleState).toBe('ARCHIVED');
    });

    it('filters independently: lifecycleState + sponsorshipStatus combined', async () => {
        const res = await adminApp.request('/admin/sponsorships?status=ACTIVE&sponsorshipStatus=pending', { headers: authHeaders });
        const json = await res.json();
        expect(json.data.items).toHaveLength(1);
    });
});
```

Add analogous tests for OwnerPromotion (AC-001-01), AccommodationReview (AC-001-03), DestinationReview (AC-001-04).

### Decision

**Fix directly.** Bundle with GAP-063-017 in the integration-test PR — same gap shape, same test directory.

### Decisión del usuario (triage 2026-04-20)

**HACER** — bundle Q7 (Integration + Boundary Tests: 029 + 030 + 044). Extender `admin-search-filters.test.ts` de las 4 entidades con AC-001/003-02 filter tests (seed DRAFT+ACTIVE+ARCHIVED, hit admin endpoint, assert subset correcto).

---

## GAP-063-030 — Permission boundary tests missing: non-admin actor must not be able to use admin `lifecycleState` filter on adminList endpoints

> **Discovered in**: Audit Pass 4 (2026-04-20), Agent D
> **Severity**: LOW (latent; existing `_canAdminList` already gates the route; missing test means a future regression in permission code goes undetected)
> **Priority**: P3
> **Complexity**: 2

### File / line

Permission test files for the 4 entities under `packages/service-core/test/services/{owner-promotion,sponsorship,accommodationReview,destinationReview}/permissions.test.ts`.

### Evidence

`grep -n "checkCanAdminList" packages/service-core/test/services/sponsorship/permissions.test.ts` etc. Existing tests cover `_canUpdate`, `_canList`, `_canSearch`, `_canCount` but no explicit assertion for the boundary "non-admin actor calling adminList rejects with FORBIDDEN" coupled with the `lifecycleState` filter visibility contract.

### Proposed fix

Add 1 small test per entity:

```ts
describe('lifecycleState boundary (AC-005-01)', () => {
    it('rejects non-admin actor on adminList', () => {
        const actor = createTestActor({ permissions: [SPONSORSHIP_VIEW_OWN] });
        expect(() => checkCanAdminList(actor)).toThrow();
    });
});
```

### Decision

**Fix directly.** Bundle with GAP-063-029 in the test-coverage PR.

### Decisión del usuario (triage 2026-04-20)

**HACER** — bundle Q7 (Integration + Boundary Tests: 029 + 030 + 044). Agregar en cada `packages/service-core/test/services/*/permissions.test.ts` 1 test de boundary para `checkCanAdminList` (non-admin → FORBIDDEN).

---

## GAP-063-031 — Admin UI does not surface "Auto-archived (expired)" distinction per spec UX note

> **Discovered in**: Audit Pass 4 (2026-04-20), Agent B
> **Severity**: LOW (UX polish; spec explicitly marks this as client-side inferred)
> **Priority**: P3
> **Complexity**: 2

### File / line

`apps/admin/src/features/owner-promotions/components/PromotionDetailDialog.tsx` (or equivalent detail view) and the column config for the OwnerPromotion list page.

### Evidence

Spec line 326 says: "Admin UI distinction: the admin UI should display 'Auto-archived (expired)' for archived promotions where `validUntil < now`. This is inferred client-side, not stored in DB."

Search confirms the detail view renders the `lifecycleState` badge with no "Auto-archived" branch. The list/grid likewise shows a generic badge.

### Proposed fix

In the badge render, check `lifecycleState === 'ARCHIVED' && validUntil && new Date(validUntil) < new Date()` and render the auto-archived label + tooltip explaining why. Use existing i18n key family or add `admin-billing.ownerPromotions.statuses.autoArchivedExpired` (es/en/pt).

### Decision

**Defer / new SPEC.** Spec marked this as a SHOULD-have UX hint for a later UX pass. Worth a tracking issue but not blocking SPEC-063 closure. Open as `SPEC-09X-owner-promotion-auto-archive-ui` with this gap as the seed.

---

## GAP-063-032 — Cron HTTP scheduler (`apps/api/src/cron/bootstrap.ts`) has no retry/backoff on transient failures (cross-cutting infra)

> **Discovered in**: Audit Pass 4 (2026-04-20), Agent A
> **Severity**: INFO (cross-cutting cron infrastructure, not SPEC-063 specific but surfaces here because SPEC-063 introduced `archive-expired-promotions` job)
> **Priority**: — (belongs to a cron infrastructure SPEC)
> **Complexity**: 3

### File / line

`apps/api/src/cron/bootstrap.ts:72-109` (node-cron HTTP dispatcher path).

### Evidence

The dispatcher fetches the local `/api/v1/cron/<name>` endpoint with no retry. A transient API failure (e.g., process restart during the cron tick) silently loses that hour's archive run. The next tick happens an hour later. The OwnerPromotion archive job is hourly per spec, so a single missed tick means up to 60 minutes of stale ACTIVE records — usually fine for this use case, but the same pattern affects every cron job using this dispatcher (addon-expiry, etc.).

### Fix needed in SPEC-063 scope?

No. This is cross-cutting cron infrastructure, not specific to lifecycle state. Recording it here for traceability because SPEC-063 introduced one cron job that uses this dispatcher.

### Decision

**New SPEC.** Open `SPEC-09X-cron-dispatcher-resilience` covering retry policy, dead-letter handling, observability metrics. Out of SPEC-063 scope.

---

## Updated summary by area (after Pass 4)

| Area | Count | Highest severity |
|------|-------|------------------|
| Service layer (`packages/service-core`) | 5 (GAP-001/003/004/015 + partial 005) + 1 NEW (GAP-022 restore) | **CRITICAL** |
| API routes (`apps/api/src/routes`) | 2 (GAP-002/005) | CRITICAL |
| Schema runtime enforcement | 1 (GAP-016 — `.strict()` missing) | HIGH |
| Admin frontend (`apps/admin`) | 2 (GAP-006/007) + 1 NEW (GAP-026 grid column) + 1 NEW (GAP-031 auto-archive UX, deferred) | MEDIUM |
| Schema coverage | 1 (GAP-013) + 1 (GAP-019) | MEDIUM |
| Integration tests (AC rejection + record exclusion) | 1 (GAP-011) + 2 (GAP-017/020) + 2 NEW (GAP-029 sponsorship adminList + GAP-030 permission boundary) | HIGH |
| DB schema parity | 1 (GAP-018 single idx) + 3 NEW (GAP-023/024/025 composites) | HIGH |
| Cron infrastructure | 1 (GAP-012, deferred) + 2 NEW (GAP-027 Sentry, GAP-028 lock-check) + 1 NEW (GAP-032 dispatcher, INFO/new SPEC) | MEDIUM |
| Documentation (spec + TODOs) | 2 (GAP-008/009) | LOW |
| i18n (`packages/i18n`) | 1 (GAP-014) | LOW |
| Systemic (tracked elsewhere) | 1 (GAP-010 → SPEC-087) | INFO |
| Out-of-spec follow-up | 1 (GAP-021 SponsorshipLevel/Package) | INFO |

## Recommended fix order (after Pass 4)

1. **Restore-semantics PR** (NEW — promote to top of queue): GAP-063-022. Single PR `fix(spec-063-gaps): reset lifecycleState=ACTIVE on restore`. CRITICAL because silent data hiding.
2. **Security-hardening PR** (bundle, P0+P1): GAP-063-001, 002, 003, 004, 005 + GAP-063-011 + GAP-063-013 + GAP-063-019 + GAP-063-020. Single PR `security(spec-063-gaps): enforce lifecycleState=ACTIVE on public review + promotion endpoints + test coverage`.
3. **DB schema-parity PR** (P1+P2+P3): GAP-063-018 + 023 + 024 + 025 (single + 3 composite indexes). Push-only, single commit.
4. **Strict-mode + integration test PR** (P1+P2): GAP-063-016 + 017 + 029 + 030. `.strict()` on Update schemas + route-level integration tests for AC-002-02/AC-003-03 (rejection) and AC-001/AC-003-02 (filter visibility) + permission-boundary tests for adminList. One PR.
5. **Cron-resilience PR** (P2+P3): GAP-063-027 + 028. Sentry isolation + lock-check observability. Small PR.
6. **Admin cleanup PR** (P2): GAP-063-006 + 007 + 026 (sponsor-dashboard hooks/types + Sponsorship grid column). One commit.
7. **Docs cleanup** (P3): GAP-063-008 + 009. Single commit.
8. **Design-decision** (new SPEC): GAP-063-015 (sponsorship status permission split — Option 1 vs 2 decision).
9. **Cross-project / new SPECs**:
   - GAP-063-014 → dedicated i18n PT translation SPEC.
   - GAP-063-021 → SponsorshipLevel/SponsorshipPackage lifecycle sweep SPEC.
   - GAP-063-031 → owner-promotion auto-archive UI SPEC.
   - GAP-063-032 → cron dispatcher resilience SPEC.
10. **Defer**: GAP-063-012 (cron audit trail — product input).
8. **Deferred**: GAP-063-012 (cron audit trail — pending product feedback).

---

## Audit Pass 5 — 2026-04-20

**Auditor**: Claude Opus 4.7 (tech-lead orchestrator) + 3 parallel Explore sub-agents + 1 code-reviewer agent
**Agents scope split** (intentionally non-overlapping, chosen to cover angles the first 4 passes under-audited):
- **Agent E** — Database schema parity, migrations, concurrency, cron edge cases, regression surface on already-compliant entities (PostSponsor, Tag), seeds
- **Agent F** — OpenAPI/runtime response contract drift, Astro web tier leaks, admin TanStack Start UI completeness, HTTP coercion edge cases
- **Agent G** — Permissions for write paths on lifecycleState, test coverage quality (not quantity), observability/audit-log granularity, docs drift
- **Agent H** — Code quality (code-reviewer): type-safety casts, shotgun-surgery duplication, dead code, backward-compat shims

**Orchestrator spot-verification against actual files**:
- `apps/admin/src/features/destination-reviews/`: **directory does not exist** (confirmed via `ls`)
- `apps/api/src/routes/accommodation/reviews/admin/update.ts:31`: `requiredPermissions: [PermissionEnum.ACCOMMODATION_REVIEW_UPDATE]`
- `apps/api/src/routes/destination/reviews/admin/update.ts:30`: `requiredPermissions: [PermissionEnum.DESTINATION_REVIEW_UPDATE]`
- `packages/service-core/.../destinationReview.permissions.ts:36`: service-layer throws unless actor has `DESTINATION_REVIEW_MODERATE` — **mismatch with route declaration**
- `packages/service-core/.../accommodationReview.permissions.ts:24`: same mismatch (route says UPDATE, service requires MODERATE)
- `apps/api/src/cron/jobs/archive-expired-promotions.job.ts:98` / `:130`: uses bare `'ACTIVE'` / `'ARCHIVED'` string literals, not `LifecycleStatusEnum.*`
- `packages/schemas/src/entities/sponsorship/sponsorship.schema.ts:137`: uses `limit: z.coerce.number()...` — monorepo standard is `pageSize` per CLAUDE.md
- `packages/service-core/.../accommodationReview.service.ts:305`: `const rating = entity.rating as Record<string, number>` — dishonest cast (JSONB is `unknown`; DestinationReview sibling uses `Record<string, unknown>` correctly)

### Headline result for Pass 5

- **0 of the 32 prior gaps remediated.** Sample re-verification: GAP-001, GAP-006, GAP-018, GAP-022, GAP-028 all STILL PRESENT in exactly the state prior passes described.
- **15 NEW gaps discovered** — GAP-063-033 through GAP-063-047. Total gap count: **47**.
- **7 duplicate findings from sub-agents merged into existing gaps** (not renumbered): Agent E's "missing single-column `lifecycleState` idx on accommodation_reviews" = GAP-018; Agent E's "restore() does not reset lifecycleState" = GAP-022; Agent E's "cron advisory-lock ambiguity" = GAP-028; Agent F's "route factory doesn't parse responseSchema" = GAP-010 (SPEC-087); Agent F's "SponsorshipLevel/Package use isActive" = GAP-021; Agent F's "listByDestination test coverage" subsumed by GAP-002/011; Agent G's "AccommodationReview UpdateInputSchema missing .strict()" = GAP-016 (the gap explicitly enumerated this file).
- **Biggest miss from Passes 1–4**: Pass 1–4 all focused on `lifecycleState` being READ correctly on public/protected tiers (filter enforcement). Pass 5 shifted focus to the WRITE path permissions (who can SET `lifecycleState`) and found that the admin update routes are under-gated at the route layer, relying on service-layer throws for defense (GAP-063-036). Pass 5 also exposed the gap that `US-001-04` (DestinationReview admin lifecycle filter) is unimplementable today because there is NO admin UI for DestinationReview at all (GAP-063-037).

### Re-verification sample (Pass 1–4 gaps)

| Gap | Status in Pass 5 | Evidence |
|-----|------------------|----------|
| GAP-063-001 | STILL PRESENT | `accommodationReview.service.ts:513-518` still has `{ accommodationId, deletedAt: null }` with no `lifecycleState` filter |
| GAP-063-006 | STILL PRESENT | `sponsor-dashboard/hooks.ts:30` still sends `status=active` |
| GAP-063-018 | STILL PRESENT (independently re-discovered by Agent E) | `accommodation_review.dbschema.ts:43-53` has NO single-column `lifecycleState` index — peer entities all have one |
| GAP-063-022 | STILL PRESENT (independently re-discovered by Agent E) | `base.model.ts` restore() only resets `deletedAt`, does not reset `lifecycleState` |
| GAP-063-028 | STILL PRESENT (independently re-discovered by Agent E) | `archive-expired-promotions.job.ts:81-89` — a malformed `lockResult.rows` row returns `undefined` which is silently treated as "lock not acquired" |

---

## GAP-063-033 — owner_promotions missing composite index `(lifecycleState, validUntil)` required by the hourly archive cron query

> **Discovered in**: Audit Pass 5 (2026-04-20) by Agent E
> **Severity**: **HIGH** (latent perf hazard at scale — 100k+ promotions)
> **Priority**: P1
> **Complexity**: 1 (add one index in Drizzle schema, push)

### File / line

`packages/db/src/schemas/owner-promotion/owner_promotion.dbschema.ts:36-49`

### Evidence

The cron at `apps/api/src/cron/jobs/archive-expired-promotions.job.ts:93-104` runs this query every hour:

```ts
.where(and(
    eq(ownerPromotions.lifecycleState, 'ACTIVE'),
    isNotNull(ownerPromotions.validUntil),
    lt(ownerPromotions.validUntil, sql`NOW()`),
    isNull(ownerPromotions.deletedAt)
))
.limit(100)
```

Current indexes: single-column `ownerPromotions_lifecycleState_idx`, single-column `ownerPromotions_validFrom_idx`, composite `ownerPromotions_ownerId_lifecycleState_idx`. **No composite on `(lifecycleState, validUntil)`**. Planner will likely choose the `lifecycleState` single-column index then filter-scan by `validUntil` — fine at 1k rows, painful past 50k.

### What the spec required

Spec.md line 320 prescribes the exact query. Implicit perf contract: the query must complete within the cron `timeout: 60_000` on production-scale data. No explicit index was mandated, but ADR-style schema parity demands composites for multi-column hot queries.

### Proposed fix

Add to `owner_promotion.dbschema.ts`:

```ts
ownerPromotions_lifecycleState_validUntil_idx: index(
    'ownerPromotions_lifecycleState_validUntil_idx'
).on(table.lifecycleState, table.validUntil)
```

Push-only (no generated migration needed per Hospeda policy).

### Decision

**Fix directly.** Bundle with GAP-023/024/025 composite-index PR.

---

## GAP-063-034 — sponsorships missing composite index `(lifecycleState, endsAt)` for future sponsorship-expiry cron

> **Discovered in**: Audit Pass 5 (2026-04-20) by Agent E
> **Severity**: MEDIUM (anticipatory parity — no current cron uses it, but `findActiveByTarget` + forthcoming expiry cron both benefit)
> **Priority**: P2
> **Complexity**: 1

### File / line

`packages/db/src/schemas/sponsorship/sponsorship.dbschema.ts:57-76`

### Evidence

Sponsorship has `endsAt` and `lifecycleState` but only has single-column indexes on each. If a symmetric expiry job is added (mirroring `archive-expired-promotions`), it will need `(lifecycleState, endsAt)`.

### What the spec required

Not required by SPEC-063 literally, but spec.md Phase 3 implies parity with OwnerPromotion. Composite index needed for scale.

### Proposed fix

```ts
sponsorships_lifecycleState_endsAt_idx: index(
    'sponsorships_lifecycleState_endsAt_idx'
).on(table.lifecycleState, table.endsAt)
```

### Decision

**Defer** if no sponsorship-expiry cron is planned in the next 2 sprints; **fix directly** if one is. Track as anticipatory.

---

## GAP-063-035 — tags missing composite index `(lifecycleState, deletedAt)` — already-compliant entity regression check

> **Discovered in**: Audit Pass 5 (2026-04-20) by Agent E
> **Severity**: LOW
> **Priority**: P3
> **Complexity**: 1

### File / line

`packages/db/src/schemas/tag/tag.dbschema.ts:24-26`

### Evidence

Tag already had `lifecycleState` before SPEC-063 — marked as "compliant" in the spec's entity table. But it has only a single-column `tags_lifecycle_idx`. Admin list endpoints typically filter `WHERE lifecycleState = ? AND deletedAt IS NULL`, which on large tag tables will re-filter sequentially.

### What the spec required

Non-goal per spec: Tag was out of scope. BUT the spec's success metric #2 says "the admin `adminList()` filter works identically for all 6 entities" — implying perf parity too.

### Proposed fix

```ts
tags_lifecycleState_deletedAt_idx: index(
    'tags_lifecycleState_deletedAt_idx'
).on(table.lifecycleState, table.deletedAt)
```

### Decision

**Defer** — low-priority perf hygiene on an out-of-SPEC-063 entity; add to a general DB schema-parity SPEC if one exists, otherwise leave.

---

## GAP-063-036 — Review admin UPDATE routes require generic `*_UPDATE` permission but service layer requires `*_MODERATE` (route-layer under-gating)

> **Discovered in**: Audit Pass 5 (2026-04-20) by Agent G, orchestrator-verified against 4 files
> **Severity**: **HIGH** (defense-in-depth; correctness is currently saved by the service-layer throw, but route-layer auth is misleading and leaks 500 vs 403 semantics)
> **Priority**: P1
> **Complexity**: 2 (two-line change per route + two integration tests)

### File / line

- `apps/api/src/routes/accommodation/reviews/admin/update.ts:31` — declares `[PermissionEnum.ACCOMMODATION_REVIEW_UPDATE]`
- `apps/api/src/routes/destination/reviews/admin/update.ts:30` — declares `[PermissionEnum.DESTINATION_REVIEW_UPDATE]`
- `packages/service-core/.../accommodationReview.permissions.ts:24` — service throws unless actor has `ACCOMMODATION_REVIEW_MODERATE`
- `packages/service-core/.../destinationReview.permissions.ts:36` — service throws unless actor has `DESTINATION_REVIEW_MODERATE`

### Evidence

```ts
// apps/api/src/routes/accommodation/reviews/admin/update.ts:31
requiredPermissions: [PermissionEnum.ACCOMMODATION_REVIEW_UPDATE],
```

```ts
// packages/service-core/.../accommodationReview.permissions.ts:22-26
export function checkCanUpdateAccommodationReview(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    if (!actor.permissions?.includes(PermissionEnum.ACCOMMODATION_REVIEW_MODERATE)) {
        throw new ServiceError(ServiceErrorCode.FORBIDDEN, ...);
    }
}
```

**Impact**: an admin with `ACCOMMODATION_REVIEW_UPDATE` but not `ACCOMMODATION_REVIEW_MODERATE` passes the route middleware (which OKs the request), reaches the handler, instantiates the service, calls `update()`, and the service throws a 403. Today that 403 maps correctly — but the route is declaring a contract it does not honor. A permission refactor that tightens route checks on `MODERATE` would silently widen the attack surface because no route-level assertion exists.

### What the spec required

Spec.md line 420: "Standard `lifecycleState` changes fall under the entity's general `*_UPDATE` permission." This was written for **Sponsorship**. For reviews, the service was authored (pre-SPEC-063 or by SPEC-063) to require `MODERATE` — a stricter gate for moderation-of-content entities. Either the service is correct (reviews need MODERATE) and the routes are wrong, or the routes are correct (UPDATE is sufficient) and the services are wrong. The inconsistency itself is the gap.

### Proposed fix

**Option A (preferred)**: Align routes to service. Add `MODERATE` to route `requiredPermissions`:

```ts
// accommodation/reviews/admin/update.ts:31
requiredPermissions: [
    PermissionEnum.ACCOMMODATION_REVIEW_UPDATE,
    PermissionEnum.ACCOMMODATION_REVIEW_MODERATE
],
```

**Option B**: Relax service to `UPDATE` (only if product actually wants that).

### Decision

**User decision required** — Option A vs B. Default recommendation: Option A (stricter). Add regression tests: actor with UPDATE only gets 403 at route layer (not 500, not 200). Bundle with GAP-030 permission-boundary PR.

### Decisión del usuario (triage 2026-04-20)

**HACER — Option A** (stricter: route alineado al service). Agregar `*_REVIEW_MODERATE` a `requiredPermissions` de `apps/api/src/routes/{accommodation,destination}/reviews/admin/update.ts`. Mantiene reviews como contenido moderado. Los tests de regresión (actor con UPDATE only recibe 403 al nivel route) se cubren en Q7/GAP-044.

---

## GAP-063-037 — No admin UI for DestinationReview → AC-001-04 is unimplementable as a user-facing feature

> **Discovered in**: Audit Pass 5 (2026-04-20) by Agent F, orchestrator-verified via `ls apps/admin/src/features/destination-reviews/ apps/admin/src/routes/_authed/content/destination-reviews/` (both: "No such file or directory")
> **Severity**: **HIGH** (spec AC literally cannot be demonstrated)
> **Priority**: P1
> **Complexity**: 4 (new admin feature folder + routes + columns + hooks + filter wiring + tests)

### File / line

Missing directories:
- `apps/admin/src/features/destination-reviews/` (compare to `apps/admin/src/features/accommodation-reviews/`)
- `apps/admin/src/routes/_authed/content/destination-reviews/`

### Evidence

```bash
$ ls apps/admin/src/features/destination-reviews/ apps/admin/src/routes/_authed/content/destination-reviews/
ls: cannot access 'apps/admin/src/features/destination-reviews/': No such file or directory
ls: cannot access 'apps/admin/src/routes/_authed/content/destination-reviews/': No such file or directory
```

The API layer is fully wired (admin routes exist, service is complete), but there is no admin UI. Admin users literally cannot filter destination reviews by lifecycle state in the dashboard.

### What the spec required

**AC-001-04**: "Given the admin is on the DestinationReview list page, when they select ARCHIVED from the status filter, then the list returns only destination reviews with lifecycleState = ARCHIVED." The acceptance criterion presupposes an admin list page exists.

Spec.md "Phase 4: DestinationReview" line 438 says "Update admin frontend: add lifecycle status filter to DestinationReview list" — this task appears to have been interpreted as a no-op because the page did not exist to update.

### Proposed fix

Mirror the `accommodation-reviews` admin feature structure:
1. `apps/admin/src/features/destination-reviews/config/columns.ts` — include `lifecycleState` column with badge renderer
2. `apps/admin/src/features/destination-reviews/config/filters.ts` — include `LifecycleStatusFilter` + `isPublished` + `isVerified` flags
3. `apps/admin/src/features/destination-reviews/hooks/useDestinationReviewQueries.ts`
4. `apps/admin/src/routes/_authed/content/destination-reviews/index.tsx` (list), `$id.tsx` (detail), etc.
5. Navigation menu entry

### Decision

**New SPEC.** This is a multi-file admin feature addition (~800 lines), not a SPEC-063 remediation. Open `SPEC-09X-destination-reviews-admin-ui`. Flag SPEC-063 as having an unfulfilled AC until then.

---

## GAP-063-038 — archive-expired-promotions cron uses bare string literals `'ACTIVE'` / `'ARCHIVED'` instead of `LifecycleStatusEnum`

> **Discovered in**: Audit Pass 5 (2026-04-20) by Agent H (code-reviewer), orchestrator-verified at lines 98 + 130
> **Severity**: MEDIUM (enum rename would silently break the cron; TS type inference on Drizzle column may accept `string`)
> **Priority**: P2
> **Complexity**: 1 (one import, two value replacements)

### File / line

`apps/api/src/cron/jobs/archive-expired-promotions.job.ts:98, 130`

### Evidence

```ts
// line 98
eq(ownerPromotions.lifecycleState, 'ACTIVE'),
// line 130
.set({ lifecycleState: 'ARCHIVED', ... })
```

### What the spec required

CLAUDE.md "Single Source of Truth" rule: enum values come from `@repo/schemas`. The rest of the codebase uses `LifecycleStatusEnum.ACTIVE` / `.ARCHIVED`. The cron is the single outlier.

### Proposed fix

```ts
import { LifecycleStatusEnum } from '@repo/schemas';

// ...
eq(ownerPromotions.lifecycleState, LifecycleStatusEnum.ACTIVE),
// ...
.set({ lifecycleState: LifecycleStatusEnum.ARCHIVED, ... })
```

### Decision

**Fix directly.** Trivial. Bundle with any cron-hygiene PR.

### Decisión del usuario (triage 2026-04-20)

**HACER** — autónomo (trivial). Reemplazar `'ACTIVE'` / `'ARCHIVED'` string literals por `LifecycleStatusEnum.ACTIVE` / `LifecycleStatusEnum.ARCHIVED` en `archive-expired-promotions.job.ts:98,130`. Bundlear con el PR de cron hygiene (Q6).

---

## GAP-063-039 — AccommodationReviewService bypasses shared review-average helper with a dishonest `as Record<string, number>` cast

> **Discovered in**: Audit Pass 5 (2026-04-20) by Agent H (code-reviewer)
> **Severity**: MEDIUM (latent bug if bad data ever gets into JSONB; also an inconsistency with the sibling service)
> **Priority**: P2
> **Complexity**: 2

### File / line

`packages/service-core/src/services/accommodationReview/accommodationReview.service.ts:305`

### Evidence

```ts
// AccommodationReviewService (line 305):
const rating = entity.rating as Record<string, number>;
const values = Object.values(rating).filter((v) => typeof v === 'number');

// DestinationReviewService (sibling): correctly does
computeReviewAverageRating(entity.rating as Record<string, unknown>)
```

The cast to `Record<string, number>` is dishonest: the subsequent `typeof v === 'number'` filter proves the author knows the values may NOT be numbers. If a stringified number `"5"` ever lands in the JSONB column (from a migration, a manual DB edit, or bad seed data), the cast fools the type system and the filter silently excludes it instead of throwing — undercounting.

### What the spec required

Not a SPEC-063 AC but within scope: SPEC-063 touched this service for lifecycleState changes; any adjacent type-safety debt discovered should be fixed.

### Proposed fix

Extract `computeAccommodationReviewAverage` into `accommodationReview.helpers.ts` mirroring the sibling pattern:

```ts
export const computeAccommodationReviewAverage = (rating: unknown): number => {
    if (!rating || typeof rating !== 'object') return 0;
    const values = Object.values(rating as Record<string, unknown>)
        .filter((v): v is number => typeof v === 'number');
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
};
```

Call from `computeAndStoreReviewAverage`. Remove the inline cast.

### Decision

**Fix directly.** One-file change, parity win.

### Decisión del usuario (triage 2026-04-20)

**HACER** — bundle Q9 (Code Quality Refactor: 039 + 040 + 042 + 043). Extraer `computeAccommodationReviewAverage` a `accommodationReview.helpers.ts` con type `unknown` honesto (mirror del sibling DestinationReview).

---

## GAP-063-040 — 6-copy duplicate revalidation-scheduling block in both review services (shotgun surgery risk)

> **Discovered in**: Audit Pass 5 (2026-04-20) by Agent H (code-reviewer)
> **Severity**: LOW
> **Priority**: P3
> **Complexity**: 2 (extract + 12 call-site updates)

### Files / lines

- `packages/service-core/.../accommodationReview.service.ts`: lines 320-333, 341-354, 362-374, 400-413, 431-445, 479-490 (6 copies)
- `packages/service-core/.../destinationReview.service.ts`: same 6-block pattern

### Evidence

Each of the 12 blocks is:

```ts
try {
    const svc = getRevalidationService();
    if (svc) {
        await svc.scheduleRevalidation({ entityType: 'accommodationReview', slug: accommodationSlug });
    }
} catch (error) {
    logger.warn('Failed to schedule revalidation', { error });
}
```

### What the spec required

Not a SPEC-063 AC; but `accommodationReview.service.ts` is now 606 lines, past the 500-line file limit in CLAUDE.md.

### Proposed fix

Extract a private method per service (or a shared helper in `BaseCrudService`):

```ts
private async _scheduleRevalidation(slug: string | undefined): Promise<void> {
    if (!slug) return;
    try {
        const svc = getRevalidationService();
        await svc?.scheduleRevalidation({ entityType: this.entityType, slug });
    } catch (error) {
        this.logger.warn('Failed to schedule revalidation', { error });
    }
}
```

### Decision

**Fix directly.** Zero semantic change. Enables the 500-line invariant to hold.

### Decisión del usuario (triage 2026-04-20)

**HACER** — bundle Q9 (Code Quality Refactor: 039 + 040 + 042 + 043). Extraer método privado `_scheduleRevalidation(slug)` en cada review service; colapsar las 12 copias a 2 definiciones.

---

## GAP-063-041 — SponsorshipSearchSchema and OwnerPromotionSearchSchema use `limit` field instead of monorepo-standard `pageSize`

> **Discovered in**: Audit Pass 5 (2026-04-20) by Agent H (code-reviewer), orchestrator-verified at `sponsorship.schema.ts:137`
> **Severity**: MEDIUM (inconsistency forces type-cast escapes in service; consumers of the schemas must remember the non-standard name)
> **Priority**: P2
> **Complexity**: 3 (schema rename + callers + tests)

### File / line

- `packages/schemas/src/entities/sponsorship/sponsorship.schema.ts:136-137`
- `packages/schemas/src/entities/sponsorship/sponsorship-level.schema.ts:105-106`
- `packages/schemas/src/entities/sponsorship/sponsorship-package.schema.ts:98-99`
- OwnerPromotion search schema (same pattern)

### Evidence

```ts
// sponsorship.schema.ts:136-137
page: z.coerce.number().int().min(1).default(1),
limit: z.coerce.number().int().min(1).max(100).default(20)
```

The project `CLAUDE.md` says: "Pagination: Admin routes use `page`+`pageSize` (NOT `limit`). `createAdminListRoute` rejects unknown params". Yet the Sponsorship domain-schema sticks with `limit`. This forces services to destructure `{ limit, ...rest }` and re-key to `pageSize` at the `model.findAll({ page, pageSize: limit })` call site (see `sponsorship.service.ts:177,179` which additionally needed `as Record<string, unknown>` because `lifecycleState` had to be injected into a typed params object that spread `filterParams`).

### What the spec required

Implicit monorepo convention per CLAUDE.md. SPEC-063 did not mandate this but the new service code writes awkward casts because of it.

### Proposed fix

Rename `limit` → `pageSize` across the 3 schemas; update services (`sponsorship.service.ts`, `ownerPromotion.service.ts`, their admin-search variants); update any admin-frontend hook that posts these filters.

### Decision

**Defer / new SPEC candidate** — touches Sponsorship/OwnerPromotion API contract. If no external consumer depends on `?limit=`, fix directly in a rename PR. If any, open `SPEC-09X-sponsorship-pagination-alignment`.

### Decisión del usuario (triage 2026-04-20)

**HACER** — rename directo Q10 (GAP-041). Rename `limit` → `pageSize` en `sponsorship.schema.ts`, `sponsorship-level.schema.ts`, `sponsorship-package.schema.ts`, y en los search schemas de OwnerPromotion. Update services + admin frontend hooks. Sin backward-compat shim. Se asume no hay consumidores externos (o se aceptan como breaking para alinear con convención monorepo).

---

## GAP-063-042 — Dead `if (!actor) throw` guards in `checkCanViewAccommodationReview` / `checkCanViewDestinationReview`

> **Discovered in**: Audit Pass 5 (2026-04-20) by Agent H (code-reviewer)
> **Severity**: LOW
> **Priority**: P3
> **Complexity**: 1

### File / line

- `packages/service-core/.../accommodationReview.permissions.ts:49-53`
- `packages/service-core/.../destinationReview.permissions.ts:45-49`

### Evidence

```ts
export function checkCanViewAccommodationReview(actor: Actor): void {
    if (!actor) throw new ServiceError(ServiceErrorCode.FORBIDDEN, 'Forbidden: no actor');
    return; // Public — anyone can view
}
```

The parameter type `Actor` is non-nullable. The runtime type system enforces `actor` is always truthy. The guard is reachable only via an `as any` cast — and the function is effectively a no-op, but reads like it enforces something. This is called from `_canList`, `_canSearch`, `_canCount`, `_canUpdateVisibility` on each service (≥ 5 call-sites per entity).

### Proposed fix

Either (a) remove the dead guard and replace the body with a clear `// eslint-disable no-empty-function  -- public, any actor` + empty body, OR (b) delete the function entirely and omit the `_canView` override (let BaseCrudService default handle it if it permits-by-default).

### Decision

**Fix directly.** Trivial readability win.

### Decisión del usuario (triage 2026-04-20)

**HACER** — bundle Q9 (Code Quality Refactor: 039 + 040 + 042 + 043). Eliminar los dead `if (!actor) throw` guards en `checkCanViewAccommodationReview` y `checkCanViewDestinationReview`; reemplazar por body vacío + comentario explicativo (`// Public — cualquier actor puede ver`).

---

## GAP-063-043 — Passthrough normalizer files add indirection with zero semantic value

> **Discovered in**: Audit Pass 5 (2026-04-20) by Agent H (code-reviewer)
> **Severity**: LOW
> **Priority**: P3
> **Complexity**: 1

### Files

- `packages/service-core/.../accommodationReview.normalizers.ts`
- `packages/service-core/.../destinationReview.normalizers.ts`

### Evidence

```ts
export const normalizeCreateInput = (data: AccommodationReviewCreateInput, _actor: Actor) => data;
export const normalizeUpdateInput = (data: AccommodationReviewUpdateInput, _actor: Actor) => data;
```

Both functions are pure identity passthroughs. They are wired into the service's `normalizers` map. No comment explaining why these exist.

### Proposed fix

Either (a) delete the files and remove the `normalizers` wiring from both services, OR (b) add a JSDoc stub comment documenting that they are intentional placeholders for future normalization (e.g. trim strings, coerce rating keys) — with a tracking ticket.

### Decision

**Defer** — depends on roadmap intent. If no normalization is coming in the next 2 sprints, prefer (a).

### Decisión del usuario (triage 2026-04-20)

**HACER** — bundle Q9 (Code Quality Refactor: 039 + 040 + 042 + 043). Borrar archivos `*.normalizers.ts` passthrough de AccommodationReview y DestinationReview; desconectar el wiring en los services. YAGNI: si aparece normalization real, se agrega entonces.

---

## GAP-063-044 — Missing permission-boundary test: non-moderator actor attempting to set `lifecycleState` on a review via any write path

> **Discovered in**: Audit Pass 5 (2026-04-20) by Agent G
> **Severity**: **HIGH** (compounds GAP-036 — if route-layer permissions are tightened to MODERATE, no test would catch a regression to UPDATE-only)
> **Priority**: P1
> **Complexity**: 2 (3 tests per entity)

### File / line

Missing file: `apps/api/test/integration/accommodation-reviews/permission-boundaries.test.ts` (and peer for destination reviews)

### Evidence

Current tests at `packages/service-core/test/services/accommodationReview/*.test.ts` test happy-path lifecycle updates with a mocked admin actor. No test covers:
1. Actor has `ACCOMMODATION_REVIEW_UPDATE` but NOT `ACCOMMODATION_REVIEW_MODERATE` → should get 403 when trying to change `lifecycleState`
2. Author user calls protected update route with `lifecycleState` in body → should be ignored or rejected (clarify which)
3. Anonymous actor calls any lifecycle-related endpoint → should get 401/403 uniformly

GAP-063-030 (Pass 4) covered the READ path boundary (admin search with `?lifecycleState=`); this is the WRITE-path mirror.

### What the spec required

AC-004-01 / AC-004-02 imply only admins-with-moderation can change lifecycleState. The spec did not mandate tests, but project policy does (CLAUDE.md: "No tests = not done").

### Proposed fix

Create `permission-boundaries.test.ts` files and cover the 3 cases above per entity.

### Decision

**Fix directly.** Bundle with GAP-036 alignment PR.

### Decisión del usuario (triage 2026-04-20)

**HACER** — bundle Q7 (Integration + Boundary Tests: 029 + 030 + 044). Crear `apps/api/test/integration/{accommodation,destination}-reviews/permission-boundaries.test.ts` cubriendo: (a) actor con `*_REVIEW_UPDATE` sin `*_REVIEW_MODERATE` → 403 al cambiar lifecycleState; (b) author user no puede setear lifecycleState vía protected update; (c) anonymous → 401/403.

---

## GAP-063-045 — archive cron logs batch count only, missing per-record IDs in structured log (partial remediation of GAP-012)

> **Discovered in**: Audit Pass 5 (2026-04-20) by Agent G
> **Severity**: LOW
> **Priority**: P3
> **Complexity**: 1 (one-line context addition)

### File / line

`apps/api/src/cron/jobs/archive-expired-promotions.job.ts:136-139`

### Evidence

```ts
logger.info('Archived expired promotions', {
    source: LOG_SOURCE,
    count: expiredIds.length
    // ← `expiredIds` is in scope but not logged
});
```

For a compliance audit ("which promotions were archived on 2026-04-20 03:00 UTC?"), only the count is retrievable. Individual IDs are discarded.

### What the spec required

Spec.md line 323 prescribes `{ source: '...', count: N }` — matches exactly. But AC-007-01 says "the change is logged with an audit trail indicating automatic archival" — an audit trail arguably needs per-record visibility. This is a **partial remediation** for the DEFERRED GAP-012 (full cron audit trail): adding `ids` to the log closes part of the gap without needing a separate audit table.

### Proposed fix

```ts
logger.info('Archived expired promotions', {
    source: LOG_SOURCE,
    count: expiredIds.length,
    ids: expiredIds  // NEW: trivial audit trail
});
```

### Decision

**Fix directly.** One-line change. Partial close of GAP-012.

### Decisión del usuario (triage 2026-04-20)

**HACER** — autónomo (one-line). Agregar `ids: expiredIds` al `logger.info('Archived expired promotions', {...})`. Bundlear con el PR de cron hygiene (Q6). Cierra parcialmente GAP-063-012 (postergado).

---

## GAP-063-046 — OwnerPromotionService and SponsorshipService do NOT override `_canPatch` — potential ownership-bypass via patch endpoint

> **Discovered in**: Audit Pass 5 (2026-04-20) by Agent H (code-reviewer) — **INVESTIGATION REQUIRED** before committing a fix
> **Severity**: MEDIUM (pending confirmation — could be HIGH if base default is unsafe)
> **Priority**: P2
> **Complexity**: 3 (investigation + potential override)

### File / line

- `packages/service-core/.../ownerPromotion.service.ts` (no `_canPatch`)
- `packages/service-core/.../sponsorship.service.ts` (no `_canPatch`)

### Evidence

Both services extend `BaseCrudService`. Grep for `_canPatch` in `packages/service-core/src/base` yielded zero matches — meaning either:
1. `BaseCrudService` has no `_canPatch` hook (the factory's `patch()` method doesn't gate on it), OR
2. The default `_canPatch` delegates to `_canUpdate` without receiving the `entity` argument — which means an actor with `UPDATE_OWN` permission cannot have their ownership verified in the hook.

Either case is a **latent correctness gap**. For OwnerPromotion, the permission model distinguishes `UPDATE_ANY` vs `UPDATE_OWN`; without ownership verification on patch, an owner could potentially patch another owner's promotion.

### What the spec required

AC-002-01 says "the admin sends an update request with `lifecycleState = ARCHIVED`" — this is covered by the admin UPDATE_ANY path. But `PATCH` is a distinct HTTP verb and may have a separate permission path. The spec did not explicitly call this out.

### Proposed fix

**Step 1 (investigation)**: Read `packages/service-core/src/base/crud/*.ts` to determine whether `patch()` has a `_canPatch` hook. If not, file a separate gap against `BaseCrudService` itself.

**Step 2 (if needed)**: Add explicit `_canPatch` overrides in both services that run the ownership check:

```ts
protected _canPatch(actor: Actor, entity: Sponsorship): void {
    checkCanUpdateSponsorship(actor, entity);
}
```

### Decision

**INVESTIGATE FIRST** — do not patch (pun intended) blindly. If `BaseCrudService.patch()` routes to `_canUpdate(actor, entity)` correctly, no action. Document the audit result in a follow-up note on this gap.

### Decisión del usuario (triage 2026-04-20)

**FALSO POSITIVO / DESCARTAR como gap de seguridad — limpieza documental menor**

Investigación ejecutada (2026-04-20):

1. `packages/service-core/src/base/**` no tiene método `patch()` ni hook `_canPatch` (grep: 0 matches).
2. PATCH HTTP routes (ej. `apps/api/src/routes/owner-promotion/protected/patch.ts:41`) llaman a `service.update(actor, id, body)`. Es el mismo código path del PUT/update.
3. `base.crud.write.ts:144-163` — `update()` fetchea la entity completa y pasa a `_canUpdate(actor, entity)`.
4. `ownerPromotion.permissions.ts:43-51` (`checkCanUpdate`) usa `checkGenericPermission` con `OWNER_PROMOTION_UPDATE_ANY` vs `_OWN + isOwner(actor, entity)`. El ownership check SÍ se ejecuta en el PATCH path.
5. `sponsorship.permissions.ts` presenta el mismo patrón.

**Conclusión**: No hay gap de seguridad actual. Un actor con `*_UPDATE_OWN` no puede patchear un record que no le pertenece.

**Deuda arquitectónica menor** (agendar para cleanup docs, no es SPEC-063 gap):
- `packages/service-core/CLAUDE.md` tabula `_canPatch` como hook estándar (mismo permission que `_canUpdate`). La tabla es aspiracional: no existe método `patch()` en base ni override `_canPatch` en ningún service. Tracking sugerido: eliminar la fila `_canPatch` del CLAUDE.md de service-core o implementar el hook real si en algún momento se separa `patch` de `update` en la base.

Acción inmediata: ninguna. Se agrega nota en `.claude/gaps-descartados.md`.

---

## GAP-063-047 — `LifecycleStatusEnumSchema` does not normalize case on HTTP query input → `?lifecycleState=active` fails with a generic Zod error

> **Discovered in**: Audit Pass 5 (2026-04-20) by Agent F
> **Severity**: LOW (developer experience + API ergonomics)
> **Priority**: P3
> **Complexity**: 2

### File / line

- `packages/schemas/src/enums/lifecycle-state.schema.ts:4-6`
- `packages/schemas/src/entities/sponsorship/sponsorship.http.schema.ts:35` (and peers)

### Evidence

```ts
// lifecycle-state.schema.ts
export const LifecycleStatusEnumSchema = z.nativeEnum(LifecycleStatusEnum, {
    error: () => ({ message: 'zodError.enums.lifecycleStatus.invalid' })
});
```

Valid values: `DRAFT`, `ACTIVE`, `ARCHIVED` (uppercase). A client sending `?lifecycleState=active` gets `zodError.enums.lifecycleStatus.invalid` — opaque, and requires the client to know the enum is case-sensitive.

`SponsorshipStatusEnum` by contrast uses lowercase (`pending`, `active`, `expired`, `cancelled`), compounding the confusion — two enums in the same domain, different casings.

### What the spec required

Not an AC. But **AC-002-02** and **AC-003-03** say the error response should "explain" the problem. A raw translation key is not an explanation.

### Proposed fix

Either (a) `.transform(v => v?.toUpperCase())` in the HTTP-layer schemas so lowercase inputs are coerced, OR (b) replace the error key with a message listing valid values: `'lifecycleState must be one of: DRAFT, ACTIVE, ARCHIVED'`.

### Decision

**Defer** or bundle with a general HTTP-UX polish PR. Not urgent.

---

## Updated summary by area (after Pass 5)

| Area | Count | Highest severity |
|------|-------|------------------|
| Service layer (`packages/service-core`) | 6 prior + 1 NEW (GAP-039) + 1 NEW (GAP-040) = 8 | **CRITICAL** |
| API routes (`apps/api/src/routes`) | 2 prior + 1 NEW (GAP-036) = 3 | CRITICAL |
| Schema runtime enforcement | 1 (GAP-016) | HIGH |
| Admin frontend (`apps/admin`) | 4 prior + 1 NEW (GAP-037 missing feature) = 5 | HIGH |
| Schema coverage | 2 prior | MEDIUM |
| Integration tests | 5 prior + 1 NEW (GAP-044) = 6 | HIGH |
| DB schema parity | 4 prior + 3 NEW (GAP-033/034/035 composites) = 7 | HIGH |
| Cron infrastructure | 3 prior + 1 NEW (GAP-038 enum literal) + 1 NEW (GAP-045 audit IDs) = 5 | MEDIUM |
| Documentation (spec + TODOs) | 2 prior | LOW |
| i18n | 1 prior | LOW |
| Systemic (tracked elsewhere) | 1 prior (GAP-010 → SPEC-087) | INFO |
| Out-of-spec follow-up | 1 prior (GAP-021 SponsorshipLevel/Package) + 1 NEW (GAP-041 limit vs pageSize) | INFO |
| Code quality / type-safety | 0 prior + 2 NEW (GAP-042 dead guards, GAP-043 passthrough normalizers) = 2 | LOW |
| Investigation-required | 0 prior + 1 NEW (GAP-046 _canPatch) = 1 | MEDIUM |
| API ergonomics | 0 prior + 1 NEW (GAP-047 enum case) = 1 | LOW |
| **Total gaps** | **47** | |

## Recommended fix order (after Pass 5)

Pass 4's order still holds — Pass 5 additions merge in cleanly:

1. **Restore-semantics PR**: GAP-063-022 (unchanged priority).
2. **Security-hardening PR** (bundle P0+P1): prior gaps 001/002/003/004/005/011/013/019/020 **+ NEW GAP-036 (route perm alignment) + NEW GAP-044 (perm-boundary tests)**. Single PR.
3. **DB schema-parity PR** (P1+P2+P3): prior 018/023/024/025 **+ NEW GAP-033 (owner_promotions composite) + NEW GAP-034 (sponsorships composite)**. Single push-only commit.
4. **Strict-mode + integration tests PR** (P1+P2): 016 + 017 + 029 + 030 (unchanged).
5. **Cron-hygiene PR** (P2+P3): 027 + 028 **+ NEW GAP-038 (enum literals) + NEW GAP-045 (log IDs)**. Small PR.
6. **Admin cleanup PR** (P2): 006 + 007 + 026 (unchanged).
7. **Service code quality PR** (P2+P3, NEW): **NEW GAP-039 (JSONB cast) + GAP-040 (revalidation duplication) + GAP-042 (dead guards) + GAP-043 (passthrough normalizers)**. Single refactor PR; zero semantic change.
8. **Docs cleanup** (P3): 008 + 009 (unchanged).
9. **Investigation → follow-up** (P2): **NEW GAP-046 (_canPatch base hook audit)**. Inspect `BaseCrudService.patch()`; if gap confirmed, add to security PR.
10. **Design-decision**: GAP-015 (Option 1 vs 2).
11. **Cross-project / new SPECs**:
    - GAP-014 → i18n PT SPEC
    - GAP-021 → SponsorshipLevel/Package lifecycle SPEC
    - GAP-031 → owner-promotion auto-archive UI SPEC
    - GAP-032 → cron dispatcher resilience SPEC
    - **NEW GAP-037 → SPEC-09X-destination-reviews-admin-ui**
    - **NEW GAP-041 → if external consumers depend on `?limit=`, open a pagination-alignment SPEC**
12. **Defer**: 012 (unchanged) + **NEW GAP-035 (Tag composite index)** + **NEW GAP-047 (enum case normalization)**.

---

## Triage 2026-04-20 — Decisiones

**Triador**: Claude Opus 4.7 (tech-lead orchestrator) + usuario (qazuor)
**Método**: análisis de 47 gaps, detección de duplicados/false-positives, agrupamiento por PR lógico, decisiones autónomas sobre gaps triviales / CRITICAL / out-of-scope, y preguntas agrupadas al usuario para los demás.

### Decisiones autónomas (sin consulta)

| Gap(s) | Decisión | Justificación |
|---|---|---|
| **001, 002, 003, 004, 005, 011, 020** (Security Bundle) | **HACER** — bundle en 1 PR. Approach 1 en GAP-001 (param opcional `includeAllStates`) | CRITICAL security holes (leak DRAFT/ARCHIVED en endpoints públicos). Approach 1 es el menos intrusivo y se alinea con el patrón de `listByAccommodation` original. GAP-011+020 son los tests que validan el fix. |
| **008** (TODOs.md stale) | **HACER** | Doc drift trivial. |
| **009** (spec `pg_try_advisory_lock` vs xact) | **HACER** | Doc mismatch; el código es correcto por rule 1 de advisory-locks.md. |
| **010** (SPEC-087 systemic) | **NO APLICA** — tracked externally in SPEC-087 | No es gap de SPEC-063. |
| **012** (cron audit trail) | **POSTERGAR** | Spec explícitamente marca esto como "client-side inference, product call". Sin feedback de producto, no hay driver. |
| **014** (PT i18n translations) | **NUEVA SPEC** (i18n PT audit) | Scope cross-project explícito; el mismo gap dice "not SPEC-063's job". |
| **018, 023, 024, 025, 033, 034** (DB single/composite indexes) | **HACER** — bundle push-only | Todos son one-liners en Drizzle schema; push-only policy del proyecto (no migrations SQL). Parity con peers ya establecida. |
| **021** (SponsorshipLevel/Package `isActive`) | **NUEVA SPEC** (Phase-2 lifecycle sweep) | Explícitamente out of scope por spec.md:549-551. |
| **031** (auto-archived UI badge) | **POSTERGAR** — opcional NUEVA SPEC de UX | Spec lo marca como SHOULD-have UX, no blocker. |
| **032** (cron dispatcher resilience) | **NUEVA SPEC** (cron infra) | Cross-cutting, no SPEC-063. |
| **035** (Tag composite index) | **POSTERGAR** | Out-of-scope entity, LOW priority. |
| **037** (DestinationReview admin UI missing) | **NUEVA SPEC** (~800 LOC feature faltante) | Es un feature entero, no un gap fix. |
| **038, 045** (cron enum literals + log IDs) | **HACER** — bundle con cron hygiene | Enum literal trivial; `ids: expiredIds` es one-liner que cierra parcialmente GAP-012. |
| **047** (enum case normalization) | **POSTERGAR** | DX polish; no bloquea MVP ni security. |

### Preguntas agrupadas al usuario (11 items)

El usuario responde de a 1. Cada respuesta queda anotada en su propio gap con bloque `### Decisión del usuario (2026-04-20)`.

1. Q1 — Admin Dashboard Bundle (GAP-006 + 007 + 026)
2. Q2 — Schema Parity AccRev (GAP-013 + 019)
3. Q3 — GAP-015 Sponsorship Permission Split (Option 1 vs 2)
4. Q4 — Strict Mode + AC Rejection Tests (GAP-016 + 017)
5. Q5 — GAP-022 Restore Semantics (Option 1 vs 2)
6. Q6 — Cron Hygiene Bundle (GAP-027 + 028) — nota: GAP-038+045 ya están autónomos HACER
7. Q7 — Integration + Boundary Tests Bundle (GAP-029 + 030 + 044)
8. Q8 — GAP-036 Review Admin UPDATE Permission Alignment (Option A vs B)
9. Q9 — Code Quality Refactor Bundle (GAP-039 + 040 + 042 + 043)
10. Q10 — GAP-041 `limit` → `pageSize` rename
11. Q11 — GAP-046 `_canPatch` investigation


