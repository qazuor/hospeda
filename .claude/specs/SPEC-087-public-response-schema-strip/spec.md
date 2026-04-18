# SPEC-087: Public Endpoint Response Schema Strip

> **Status**: draft
> **Priority**: P2
> **Complexity**: 4
> **Origin**: SPEC-063 T-022 (AC-005-01 discovery)
> **Depends on**: SPEC-063 (in-progress — establishes per-route strip precedent)
> **Related**: SPEC-062 (runtime response validation)

---

## Problem Statement

`createPublicListRoute`, `createPublicRoute`, and `createProtectedListRoute` in `apps/api/src/utils/route-factory.ts` currently use the `responseSchema` option **only to generate OpenAPI documentation**. They do NOT apply `responseSchema.parse()` to the actual runtime response before serialization.

### Impact

If a handler returns an object that contains fields beyond what the declared `responseSchema` picks, those fields leak into the JSON response sent to unauthenticated or lower-privilege callers. Any admin-only field a service happens to include (lifecycle state, audit columns, ownership IDs, moderation status, etc.) is exposed by default unless the handler manually strips it.

This was discovered during SPEC-063 T-022 (2026-04-18) while writing the public OwnerPromotion integration test that asserts `lifecycleState` is absent from the response body. The test failed because the service mock returned the field and the route echoed it verbatim.

### Scope of the gap

Grep of `apps/api/src/routes` for any form of `*PublicSchema.parse|.safeParse|items.map(...parse)` returns **zero matches**. No public or protected route in the repository currently performs runtime strip. Every entity with an admin-only field in its base schema is affected in principle:

- accommodation, destination, event, post — moderation fields, audit columns
- owner-promotion, sponsorship, destination-review — lifecycle state (SPEC-063)
- user — email/role in public contexts
- tag, feature, amenity — usage counters, admin flags

The fact that nothing has obviously broken to date likely reflects that most services already return pre-shaped DTOs (not full DB rows). The leak is a latent footgun that only manifests when a service is modified to include an admin-only field — exactly what happened in SPEC-063 T-022.

### Why this is not already SPEC-062

SPEC-062 covers runtime **response validation** (asserting the shape is correct). This SPEC covers runtime **response filtering** (actively dropping fields not in the schema). They are complementary:

- Validation catches "we promised X shape and returned Y shape" (contract violation)
- Strip catches "we returned more than the schema advertises" (information disclosure)

Zod handles both in one call when `.parse()` is invoked, but the design intent is distinct and the review surface is different.

### Current workaround

SPEC-063 T-022 introduced per-handler `ResponseSchema.parse(item)` in `apps/api/src/routes/owner-promotion/public/list.ts` as a contained fix. The same pattern will be needed for every other entity as SPEC-063 phases 3/4 land (DestinationReview, Sponsorship).

---

## Proposed Solutions

### Option A: Enforce strip in the route factory (recommended)

Modify `createPublicListRoute`, `createPublicRoute`, `createProtectedListRoute`, and `createProtectedRoute` in `apps/api/src/utils/route-factory.ts` to apply `responseSchema.parse()` (or `.safeParse()` + error branch) to the handler return value before serialization.

For list routes, apply to each item in `items`. For single-resource routes, apply to the whole response (or the `data` envelope, depending on `ResponseFactory` shape).

**Pros**:
- Single-point-of-control fix: touch the factory, all consumers benefit
- Removes the per-handler strip obligation (drops SPEC-063 per-entity boilerplate)
- Forces schema authors to keep `responseSchema` honest — a handler that tries to return "extra" fields will throw at parse time, surfacing the mismatch during tests
- OpenAPI docs and runtime behavior converge: the declared schema IS the contract

**Cons**:
- Every existing public/protected route is now runtime-validated. Any pre-existing shape mismatch (a handler returning data whose types diverge from its declared schema) becomes a runtime error on the next request. Migration requires auditing every route and either fixing the schema or fixing the handler.
- Added parse cost per response item (negligible per item, measurable at high cardinality — benchmark before full rollout).
- `safeParse` error path needs a consistent failure mode (throw → 500? strip silently with warn log? feature-flag gate?).

### Option B: Opt-in strip flag per route

Add `options: { stripResponse: true }` to the factory route definition. Routes explicitly opt in.

**Pros**:
- Gradual migration; no big-bang risk
- Clear audit trail (can grep for routes that opted in vs. not)

**Cons**:
- Defeats the purpose — a forgotten flag is the same as no flag. The gap is back
- Adds per-route cognitive overhead ("did I remember to strip?")

### Option C: Strip utility + per-handler adoption

Ship a `stripResponse(schema, payload)` helper and require its use in every handler. Style-guide enforcement via lint rule (e.g., biome custom rule or eslint plugin) that flags public handlers missing the call.

**Pros**:
- Zero risk to the factory
- Lint rule makes the requirement visible

**Cons**:
- Biome has limited custom-rule support (Rust plugin territory). Likely requires a separate lint tool or pre-commit script
- Humans forget; rules miss edge cases (helper call wrapped in a branch, helper missing on error paths)
- Same per-handler boilerplate problem SPEC-087 is trying to eliminate

### Option D: Status quo, document the rule

Add a section to `apps/api/CLAUDE.md` and route-factory JSDoc stating "public handlers must strip via schema." Rely on code review.

**Pros**:
- Zero code changes

**Cons**:
- Relies on human discipline forever. T-022 proves this doesn't hold — the first time an admin-only field was added to a service retain set, the public route leaked it undetected in production code paths until a dedicated test caught it.

---

## Acceptance Criteria

### AC-087-01: strip enforcement at factory level
- `createPublicListRoute` applies `responseSchema.parse()` to each item in the response `items` array
- `createPublicRoute` applies `responseSchema.parse()` to the response payload
- `createProtectedListRoute` and `createProtectedRoute` apply the same behavior
- Admin factories (`createAdminRoute`, `createAdminListRoute`) do NOT need strip (admin schemas are permissive by design, but parse is still recommended for shape consistency — scope decision in tech analysis)

### AC-087-02: parse failure semantics
- Define exact behavior when `responseSchema.parse()` throws:
  1. Always throw 500 (strict, loud, breaks on latent bugs)
  2. Log warning + return raw payload (permissive, preserves current behavior, surfaces in logs)
  3. Feature-flag gated (env var `HOSPEDA_API_STRICT_RESPONSE_VALIDATION` = true → throw; false → warn)
- Default recommendation: option 3 (feature flag, default true in dev, default false in prod for first release cycle, promote to default true after 2 weeks of clean logs)

### AC-087-03: integration tests for strip behavior
- New test file `apps/api/test/integration/route-factory/response-strip.test.ts`
- Covers: list route strips extra fields, single route strips extra fields, nested relation objects validate correctly, unknown-field injection in handler payload is dropped

### AC-087-04: per-route legacy strip removal
- After factory-level strip lands, remove the per-handler `OwnerPromotionPublicSchema.parse(item)` in `apps/api/src/routes/owner-promotion/public/list.ts` (and equivalent in any SPEC-063 phase 3/4 routes that adopted the pattern). Retain the comment explaining why strip happens.

### AC-087-05: migration verification
- Run full `apps/api` test suite with strict mode on. Every failing response validation either:
  - Fix the handler to match the declared schema, OR
  - Fix the schema to accept what the handler legitimately returns
- Zero failing routes before merging Option A

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Big-bang migration breaks routes silently | Feature flag (AC-087-02) + 2-week soak in warn-only mode before switching to throw-mode in prod |
| Performance regression at high cardinality list endpoints | Benchmark `_items_ x _handler throughput_` pre/post fix. If parse cost > 3% of p95, consider `safeParse` with prebuilt schema instance, or selective strip on known-sensitive fields only |
| Handler retains pre-existing shape drift relative to responseSchema | AC-087-05 surfaces these during test run; each fix is local and reviewable |
| Relation schemas (nested `owner`, `accommodation`) cause parse loops | Relation schemas in access files are already defined with `.optional()` — parse handles absent relations. Audit nested depth during tech analysis |

---

## Out of Scope

- Admin route strip (admin schemas are intentionally permissive; not the same tradeoff)
- Request validation (covered by zValidator and existing schema infra)
- Response shape drift detection tooling beyond what AC-087-03 integration tests provide
- Retroactive changes to `@repo/service-core` — services can continue returning full shapes; strip is the responsibility of the HTTP boundary

---

## Non-Goals

- Do NOT alter the semantics of `responseSchema` in OpenAPI generation — it stays as the contract source-of-truth for both docs and runtime
- Do NOT introduce custom strip logic outside of Zod — the schema is the strip rule, period

---

## Success Metrics

- 100% of public/protected routes use factory-level strip (zero per-handler parse calls remaining)
- Zero admin-only field leaks detectable via integration test coverage expanding AC-087-03 across entities
- No production incident attributable to field disclosure after 30 days post-merge
