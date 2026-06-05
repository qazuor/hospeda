---
specId: SPEC-149
title: Billing provider error propagation + Sentry context + retry policy
type: refactor
status: in-progress
complexity: high
created: 2026-05-20T00:00:00Z
discoveredDuring: SPEC-143 T-143-59 reframe
tags: [billing, errors, sentry, observability, qzpay, refactor, user-facing]
effortEstimateHours: "16-32"
depends_on: [SPEC-143]
blocks: []
priority: medium
firstAllocatedViaEngramProtocol: true
parent: SPEC-193
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

Root cause for the uniform 500 mapping — REVISED at realign (2026-06-05): `apps/api/src/middlewares/billing.ts:95-100` constructs the QZPay billing instance with no explicit `providerSyncErrorStrategy`, and qzpay-core NOW defaults to `livemode ? 'throw' : 'log'` (`livemode = !env.HOSPEDA_MERCADO_PAGO_SANDBOX`, billing.ts:83). Consequences:

- **Production/live**: strategy is already `'throw'` — the MP adapter error propagates as `QZPayProviderSyncError {provider, operation, cause: <original adapter error>}` and hits the generic catch (e.g. `start-paid.ts:264`) → still uniform 500, but via the throw path, NOT the log path the original analysis described.
- **Dev/staging-sandbox**: strategy is `'log'` — the original MISSING_INIT_POINT→500 path applies.
- The environments behave DIFFERENTLY today; part of this spec's job is making them uniform (explicit `'throw'` everywhere).

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

**Decision (realign 2026-06-05)**: Option 2 is DEAD — verified qzpay-core has no `onProviderSyncError` hook anywhere; adding one means a qzpay changeset + npm release cycle for no real gain. Go with **Option 1, explicitly**: set `providerSyncErrorStrategy: 'throw'` in `apps/api/src/middlewares/billing.ts` so dev/staging/prod behave identically (prod is ALREADY throw via the livemode default — the "audit of every caller" risk is therefore largely retired: production has been running on throw, and the SPEC-127/145 e2e suites exercise the checkout catch paths). The thrown error is `QZPayProviderSyncError {provider, operation, cause}` — the original adapter error (with MP status) travels in `cause`; no qzpay changes needed. No feature flag required (prod behavior is unchanged; only dev/sandbox flips to match prod).

### Part B — Error mapping at the route layer

New helper `apps/api/src/lib/billing-provider-error.ts`:

- `isBillingProviderError(err): boolean` — `err instanceof QZPayProviderSyncError` (exported by qzpay-core) plus extraction of the MP status from `err.cause` (duck-type the cause's `.status`/`.statusCode` — verify against the real MP SDK error shape and the mp-stub's error shape).
- Mapping (status semantics unchanged from the original draft):
  - MP 422 → 422 (business rule violation, user-fixable)
  - MP 429 → 503 with `Retry-After` header
  - MP 408 (timeout) / 504 → 504
  - MP 502/503/500 → 502
  - MP 400/401/403/404 → 502 (our integration issue, not user-fixable)
  - Malformed response / unknown → 502

**Mechanism (realign 2026-06-05)**: throw `ServiceError`, NOT `HTTPException`. Verified: the global `createErrorHandler` (response.ts:262) maps HTTPException 502/503/504 to body code `INTERNAL_ERROR` (its explicit map only covers 400/401/403/404/409) — the status would be right but the `code` field wrong. Instead: add `ServiceErrorCode.PROVIDER_ERROR` (→502), `PROVIDER_RATE_LIMITED` (→503), `PROVIDER_TIMEOUT` (→504) to `@repo/schemas` + the `ERROR_CODE_TO_HTTP` map, and have the helper throw `ServiceError` with the right code + safe details ({provider: 'payment provider', operation, retryAfter?}). `Retry-After` header: verify how the global handler can attach headers (or set it in the helper via context); if the handler can't carry headers, set it at the route catch site.

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

Reuse existing `captureBillingError` helper in `apps/api/src/lib/sentry.ts:218` (line drifted). Realign notes: (a) `BillingContext` has NO `operation`/`mpStatus`/`mpCode` fields — extend the interface (or add a `providerError` sub-object) first; (b) current call sites are all in `billing-error-handler.ts` generic wrappers (:101,:286,:347,:405) — zero capture in start-paid / subscription-checkout / addon.checkout, confirming the gap; (c) addon path (SPEC-127): `createAddonCheckout` has NO try/catch around `billing.checkout.create` — provider errors escape raw to the global 500; Part B/C wiring must add the catch there (mirroring start-paid).

### Part D — Retry policy (DESCOPED at realign 2026-06-05)

Verified: the idempotency middleware caches ONLY completed 2xx responses (idempotency-key.ts:209-210) — there is NO in-flight/pending marker. Server-side retries would fire concurrent duplicate requests into qzpay-core. **Server-side automatic retries are therefore OUT OF SCOPE** (in-flight locking is a separate infrastructure feature, not worth its risk for go-live).

Replacement scope:

- 429/503 responses carry `Retry-After` so CLIENTS can back off (Part B).
- Document the no-server-retry decision + the in-flight-cache gap in the helper's JSDoc and in the billing docs (future spec candidate if MP throttling becomes a real problem).
- A pinning test asserting transient provider errors return WITHOUT retrying (single adapter call).

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

## Webhook error-handling ownership (added under SPEC-193)

Under the SPEC-193 master, SPEC-149 is now also the owner of two additional webhook error-handling gaps:

**(a) Handlers that swallow errors and always mark events processed.**

- `handlePaymentUpdated` (`apps/api/src/routes/webhooks/mercadopago/payment-handler.ts:145`): on an internal error the handler currently catches, logs, and returns a success response — the event is marked `processed` even when the operation failed. This must be corrected so that transient errors (DB timeout, lock acquisition failure, etc.) either re-throw or explicitly mark the event `failed` so it reaches the dead-letter queue and can be retried.
- `handleSubscriptionAuthorizedPayment` (`apps/api/src/routes/webhooks/mercadopago/subscription-payment-handler.ts:314`): same pattern — errors are swallowed and the event lands in `processed` state regardless of outcome. Same fix required: re-throw on transient errors OR explicitly set `failed` status.

**(b) `webhook-retry.job.ts:208-247` — dead-letter retry omits two event types (WORSE than drafted).**

The switch statement does not handle `subscription_preapproval.created` and `subscription_authorized_payment.*` — and the `default` case (:241) returns `true`, which marks the dead-letter entry as RESOLVED (`resolvedAt` stamped, permanently closed), not merely skipped (verified at realign 2026-06-05). Both types must be added to the switch with real retry handling; the default for genuinely-unknown types should be considered too (resolve-with-explicit-log vs leave-pending — decide during implementation, document).

### Coordination with SPEC-194 — RESOLVED at realign (2026-06-05)

The two specs left the `mark-processed` fix ORPHANED: SPEC-194's boundary section routed "webhook handlers swallowing errors" to SPEC-149, while this spec expected 194 to ship it first. SPEC-194 closed (PR #1455) WITHOUT touching it (verified: payment-handler.ts:145-157 and subscription-payment-handler.ts:314/:326 still swallow + always mark processed). **SPEC-149 now owns the complete fix**: transient-error paths must re-throw or explicitly mark the event `failed` (joining the existing dead-letter path used by handleWebhookError), THEN the Sentry alerting fires on those failures. Red-first per bug policy.

Cron alerting (realign finding): `bootstrap.ts:145-164` ALREADY captures to Sentry when a job THROWS (tags: module=cron, job_name). The gap is narrower than drafted: jobs returning `{success:false, errors>0}` (the SPEC-194 T-024 pinned contract, e.g. apply-scheduled-plan-changes:484) never reach Sentry — wire a capture on `result.success === false` after `recordCronRun` (bootstrap.ts:~123-131).

## Status

`in-progress` (realigned + design decisions resolved 2026-06-05; SPEC-143/192/127/194/145 all closed).

## Revision History

| Date | Trigger | Changes | Result |
|------|---------|---------|--------|
| 2026-06-05 | spec-realign (post 192/127/194/145; qzpay 1.11 verified) | Root cause REVISED (qzpay defaults livemode?throw:log — prod already throws; envs diverge); Part A decided: Option 2 dead (no hook in qzpay), Option 1 explicit 'throw' (no flag — prod unchanged); Part B mechanism: ServiceError with NEW ServiceErrorCodes (PROVIDER_ERROR/PROVIDER_RATE_LIMITED/PROVIDER_TIMEOUT) instead of HTTPException (global handler degrades 502/503/504 codes to INTERNAL_ERROR); Part C: BillingContext lacks operation/mpStatus/mpCode — extend; addon path needs try/catch around billing.checkout.create (none today); Part D DESCOPED to Retry-After + no-retry pinning (idempotency middleware has no in-flight cache — server retries unsafe); webhook mark-processed fix ABSORBED (orphaned between 194/149 — 194 closed without it); dead-letter default found WORSE than no-op (resolves permanently); cron alerting narrowed (bootstrap already captures throws — wire success:false); line drifts (billing.ts:95-100, sentry.ts:218) | Scope: same intent, sharper edges; effort unchanged 16-32h |
