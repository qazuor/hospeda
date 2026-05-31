---
specId: SPEC-149
title: Billing provider error propagation + Sentry context + retry policy
type: refactor
status: draft
complexity: high
created: 2026-05-20T00:00:00Z
discoveredDuring: SPEC-143 T-143-59 reframe
tags: [billing, errors, sentry, observability, qzpay, refactor, user-facing]
effortEstimateHours: "16-32"
depends_on: [SPEC-143]
blocks: []
priority: medium
firstAllocatedViaEngramProtocol: true
---

# SPEC-149: Billing provider error propagation + Sentry context + retry policy

## Context

SPEC-143 T-143-59 was scoped as "E2E: MercadoPago API error handling (stubbed 4xx / 5xx / timeout / malformed)". The original task description listed four assertions per error mode:

1. No partial DB write.
2. User gets actionable error.
3. Sentry captures correct context.
4. Retry policy (if any) is followed.

During reframe (2026-05-20), grep against `apps/api/src/middlewares/billing.ts`, `apps/api/src/services/subscription-checkout.service.ts`, and `apps/api/src/routes/billing/start-paid.ts` showed that **three of the four assertions are not achievable today**:

- **Uniform 500 mapping**. ALL MercadoPago provider errors (4xx, 5xx, timeout, malformed) surface as `HTTP 500 "Failed to start paid subscription. Please try again."` regardless of the underlying status. There is no error-mode differentiation.
- **No Sentry capture in the start-paid path**. The route handler logs to apiLogger but does not call `captureBillingError`. Existing Sentry hooks live in admin-cancel, addon-lifecycle-cancellation, plan-change services — but not in the user-facing start-paid + monthly/annual checkout services.
- **No retry policy**. The user is told "Please try again" but there is no backoff strategy, retry budget, or retry-after header (relevant for MP 429).

Root cause for the uniform 500 mapping: `apps/api/src/middlewares/billing.ts:91-96` constructs the QZPay billing instance with no explicit `providerSyncErrorStrategy`, so qzpay-core uses the default `'log'` strategy. When the MP adapter throws, qzpay-core LOGS a warning and RETURNS the un-enriched local session (no `providerInitPoint`). The hospeda handler then surfaces `MISSING_INIT_POINT` as 500. The underlying MP error (status code, message, body) is lost before it reaches our error handler.

T-143-59 has been reframed to a regression-guard test that documents the current 500-uniform behavior. The real work — propagating MP errors with full context, mapping them to user-meaningful HTTP statuses, capturing in Sentry, and gating retries — is captured by this spec.

## Goals

1. Propagate MercadoPago provider errors (status code + message + provider error code) from the qzpay-core adapter back to the route layer without loss of context.
2. Map provider errors to user-meaningful HTTP responses (4xx vs 5xx with appropriate semantics).
3. Capture every provider error in Sentry with billing-tagged context (customer id, plan, operation, MP status code).
4. Add a retry policy for transient errors (timeout, 429, 502/503/504) where it is safe to do so (idempotent operations).

## Non-goals

- Re-architecting qzpay-core itself. Changes are at the integration boundary (hospeda config + service layer) and at the route mapping.
- Building a generic billing-resilience framework. The scope is the start-paid + addon-purchase + plan-change paths.
- Webhook-side error propagation (handled separately by `event-handler.ts` → `handleWebhookError` → Sentry).

## Scope

### Part A — qzpay-core integration boundary

**Option 1** — switch `providerSyncErrorStrategy` to `'throw'`:

```ts
billingInstance = createQZPayBilling({
    ...,
    providerSyncErrorStrategy: 'throw'
});
```

**Pros**: minimal config change, errors propagate naturally.
**Cons**: requires audit of EVERY caller that today depends on log-and-continue. Existing callers (annual-checkout, monthly-checkout, addon-purchase, plan-change) assume MP errors are absorbed; flipping to throw might break flows where a missing init point is recoverable.

**Option 2** — add a callback hook (if qzpay-core supports it):

```ts
billingInstance = createQZPayBilling({
    ...,
    onProviderSyncError: (error, operation, context) => {
        // hospeda-side: capture in Sentry, log, optionally re-throw
    }
});
```

**Pros**: localised, opt-in propagation; no behavioral break for existing callers.
**Cons**: depends on qzpay-core exposing the hook (may need a qzpay-core feature request).

**Decision**: prefer Option 2 if available; fall back to Option 1 with comprehensive audit + rollout via a feature flag.

### Part B — Error mapping at the route layer

New helper `apps/api/src/lib/billing-provider-error.ts`:

- `isBillingProviderError(err): boolean` — duck-typing check based on `.status` field.
- `mapBillingProviderErrorToHttp(err, context): HTTPException`:
  - MP 422 → 422 (business rule violation, user-fixable)
  - MP 429 → 503 with `Retry-After` header
  - MP 408 (timeout) / 504 → 504
  - MP 502/503/500 → 502
  - MP 400/401/403/404 → 502 (our integration issue, not user-fixable)
  - Malformed response → 502

User-facing messages mention "payment provider" instead of "MercadoPago" to keep the integration leak-free.

### Part C — Sentry capture

Every provider error in start-paid, addon-purchase, and plan-change flows:

```ts
captureBillingError(err, {
    operation: 'start-paid-monthly',
    customerId,
    planId,
    mpStatus: err.status,
    mpCode: err.code
}, 'error');
```

Reuse existing `captureBillingError` helper in `apps/api/src/lib/sentry.ts:198`.

### Part D — Retry policy

For idempotent operations (which start-paid is NOT, but read-only refresh paths might be):

- Transient errors (429, 502, 503, 504, timeout) → retry up to N times with exponential backoff
- 4xx errors → no retry (terminal)
- Malformed → no retry (terminal)

`X-Idempotency-Key` middleware (SPEC-143 T-143-60) already guarantees per-key idempotency at the request level, so server-side retries are safe for start-paid IF the idempotency middleware caches the in-flight state. Verify this before enabling.

## Acceptance criteria

1. MP 422 returns 422 to user with message indicating provider rejection.
2. MP 429 returns 503 with `Retry-After` header.
3. MP 408 / 504 returns 504.
4. MP 5xx returns 502.
5. MP 4xx (other than 422) returns 502.
6. Malformed JSON returns 502.
7. Every provider error path calls `captureBillingError` with operation + customer + plan tags.
8. SPEC-143 `mp-error-handling.test.ts` (regression-guard) is updated to assert the new mappings.
9. `monthly-checkout.test.ts:326-351` 429 → 500 expectation is updated to 429 → 503.
10. `annual-checkout.test.ts:285-318` 429 → 500 expectation is updated to 429 → 503.

## Implementation strategy (draft)

Defer to design phase. High-level sequencing:

1. Design phase: pick Option 1 vs Option 2 for qzpay integration. Document the audit results.
2. Implement helper `billing-provider-error.ts` with mapping + Sentry capture.
3. Wire qzpay strategy change (Option 1 or 2) behind a feature flag.
4. Apply mapping in start-paid + addon-purchase + plan-change handlers.
5. Update existing 429/timeout tests to expect new mappings.
6. Add retry policy for safe paths (separate sub-task — verify idempotency cache first).
7. Smoke test on staging with real MP sandbox throttling.

## Risks

- **Audit gap**: flipping qzpay strategy from `'log'` to `'throw'` could surface unhandled error paths in flows that today silently log. The reaper cron may rely on partial-state subs being persisted — careful regression coverage required.
- **User-facing message leaking integration detail**: error messages must say "payment provider", not "MercadoPago", to avoid coupling the customer experience to the upstream brand.
- **Sentry noise**: tagged billing errors may flood the Sentry dashboard. Coordinate with SPEC-143 T-143-47/49/50 (Sentry alert tuning) to ensure rules cover the new tags.
- **Retry policy hidden side effects**: retries on mutating endpoints require the idempotency cache to be coherent. SPEC-143 T-143-60 idempotency middleware is the prerequisite.

## Cross-references

- `[[spec/spec-149/scope-deferred-from-spec-143]]` — engram deferral note.
- SPEC-143 T-143-59 — reframed to regression-guard for the current 500-uniform behavior.
- `[[bug/qzpay-provider-sync-error-log-strategy]]` — engram bug pin (root cause).
- `[[bug/no-sentry-on-start-paid-mp-errors]]` — engram bug pin (Sentry gap).
- `[[bug/no-retry-policy-on-mp-errors]]` — engram bug pin (resilience gap).
- SPEC-143 T-143-60 — idempotency middleware (retry prerequisite).
- SPEC-143 T-143-47/49/50 — Sentry alert tuning (coordination).

## Status

`draft`. Design phase not started. To be picked up after SPEC-143 closes.
