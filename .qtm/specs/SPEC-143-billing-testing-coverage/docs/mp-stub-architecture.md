# MercadoPago stub adapter — architecture reference

> **Audience**: Anyone touching `apps/api/test/e2e/helpers/mp-stub.ts` or writing a billing flow test that needs to control MP behavior.
> **Scope**: The contract, response modes, wiring pattern, and known limits of the in-memory MercadoPago adapter used by Workstream A (CI e2e flows).
> **Companion doc**: [`e2e-infrastructure-design.md`](./e2e-infrastructure-design.md) covers the surrounding e2e infrastructure (DB, fixtures, factories, vitest configs).
> **Status**: Reflects code as of SPEC-143 part-4 (commit `df2eb9445`, 2026-05-20).

---

## 1. Why a stub exists

The real `QZPayMercadoPagoAdapter` (from `@qazuor/qzpay-mercadopago`) wraps the MP REST API. Using it in CI is not viable:

- CI workers do not (and should not) have production or sandbox MP credentials.
- MP's sandbox is rate-limited and shared across the team — flaky on parallel CI.
- The sandbox is a real distributed system; tests against it are inherently slow and order-dependent.
- The sandbox state machine has its own quirks (preapproval activation latency, webhook fan-out timing) that we want to *isolate* in Workstream B, not absorb into every PR's CI.

The stub replaces the adapter wholesale with a deterministic in-memory implementation. Tests program it to return whatever shape they need, then assert against the calls it received.

**The stub is a model of MP, not MP itself.** Workstream B (real sandbox in `apps/api/test/e2e/sandbox/`) is what catches divergence between the model and reality. Workstream A (this stub) catches divergence between *our code* and the model. Both layers are required to ship billing safely; the CLAUDE.md rule shipped in T-143-54 enforces this.

---

## 2. The contract

The stub satisfies the public method shape of `QZPayMercadoPagoAdapter`. Internally it is six sub-adapters, each exposing the methods qzpay-core or hospeda code actually invokes — nothing more.

```
adapter
├── provider: 'mercadopago'
├── checkout: { create, retrieve, expire }
├── customers: { create, retrieve, update, delete }
├── payments: { create, retrieve, capture, cancel, refund }
├── subscriptions: { create, retrieve, update, cancel, pause, resume }
├── prices: { create, retrieve, archive, createProduct }
└── webhooks: { constructEvent, verifySignature }  // synchronous
```

The set is exactly the operations qzpay-core's `QZPayPaymentAdapter` interface declares. Methods present on the real MP REST client but not exposed via the QZPay contract (raw MP operations) are intentionally absent — they are not part of the adapter surface qzpay-core uses, and a stub that implemented them would create the illusion that hospeda code can call them.

The mapping is enumerated by the `MpStubOperation` union:

```ts
export type MpStubOperation =
    | 'checkout.create' | 'checkout.retrieve' | 'checkout.expire'
    | 'customers.create' | 'customers.retrieve' | 'customers.update' | 'customers.delete'
    | 'payments.create' | 'payments.retrieve' | 'payments.capture' | 'payments.cancel' | 'payments.refund'
    | 'subscriptions.create' | 'subscriptions.retrieve' | 'subscriptions.update'
    | 'subscriptions.cancel' | 'subscriptions.pause' | 'subscriptions.resume'
    | 'prices.create' | 'prices.retrieve' | 'prices.archive' | 'prices.createProduct'
    | 'webhooks.constructEvent' | 'webhooks.verifySignature';
```

Calls to methods listed in this union route through the dispatcher (see §4). Calls to any other adapter method throw at runtime — this is intentional: tests should fail loud if a flow exercises an operation the stub does not know about, rather than silently returning `undefined` and producing a confusing downstream error.

### Webhooks are synchronous

`webhooks.constructEvent` and `webhooks.verifySignature` return synchronously in the real adapter (they parse and HMAC-verify a payload, no I/O). The stub matches via a separate `dispatchSync` path — `timeout` mode is not supported for these two ops and produces an explicit error.

---

## 3. Response modes

Every stubbed operation is programmed with one of four response modes:

### `success`

```ts
mpStub.config.setSuccess('checkout.create', providerResponseFixtures.checkout({ id: 'chk_test_123' }));
```

The dispatcher returns the configured `data` directly. Use `providerResponseFixtures.*` from `helpers/mp-responses.ts` to build well-typed shapes — these mirror the **QZPayProvider\*** types, not the raw MP API.

### `error`

```ts
mpStub.config.setError('payments.create', 402, 'Card declined', 'cc_rejected');
```

Throws an `HttpLikeError` carrying `status`, `message`, and an optional `code`. Hospeda code branches on `err.status` and `err.code`, so the stub mirrors those as own properties (not as a wrapping object). Mirrors what `@qazuor/qzpay-mercadopago` throws on a non-2xx response.

### `timeout`

```ts
mpStub.config.setTimeout('checkout.create', 5_000);
```

The dispatcher waits `delayMs` ms then throws an `HttpLikeError` with `status: 408, code: 'TIMEOUT'`. The caller's own timeout configuration is expected to reject before the stub's timer fires; the stub's throw is the fallback so the test fails clearly if the timeout config is missing or too loose.

`timeout` is async-only. Configuring it on `webhooks.verifySignature` or `webhooks.constructEvent` throws "timeout mode is not supported for synchronous operation" — they short-circuit before any await, so timing them out has no meaning.

### `malformed`

```ts
mpStub.config.setMalformed('checkout.retrieve', { weird: 'shape' });
```

Returns the configured `raw` value as-is. Useful for exercising downstream parsing — e.g. a service that destructures `result.url` should fail predictably when the stub returns `{ weird: 'shape' }`. The stub does NO validation on the value.

### Unconfigured

If a test invokes an operation it never configured:

```ts
throw new MpStubUnconfiguredError('checkout.create');
// "mp-stub: no response configured for "checkout.create".
//  Call config.setSuccess / setError / setTimeout / setMalformed before invoking."
```

This is the "fail loud" path. Recorded as `outcome: 'unconfigured'` in the call log so post-test debugging can see what the flow tried to call.

---

## 4. The dispatcher

Conceptually:

```
on call to adapter.<op>(args):
    1. lookup configured mode for <op>
    2. if no mode → record 'unconfigured', throw MpStubUnconfiguredError
    3. record call with mode-appropriate outcome
    4. dispatch by mode:
       - success   → resolve with data
       - error     → throw HttpLikeError(status, message, code)
       - timeout   → setTimeout(delayMs).unref(), then throw 408
       - malformed → resolve with raw value
```

Two dispatchers: `dispatch<T>` (async, for the 22 async operations) and `dispatchSync<T>` (sync, for the 2 webhook operations). The split is forced by the real adapter's interface — webhook helpers are sync, everything else is async.

The dispatcher records the call **before** waiting on a timeout, so a test that asserts on `config.getCalls('checkout.create')` after the timeout fires sees the call recorded with `outcome: 'timeout'`.

The setTimeout timer is `.unref()`'d — a pending timeout does not keep the test process alive. This matters when a test sets a long timeout but the assertion finishes faster.

---

## 5. Call recording

Every dispatch — success, error, timeout, malformed, unconfigured — pushes an entry into the recorded call log:

```ts
interface MpStubCall {
    operation: MpStubOperation;
    args: readonly unknown[];      // arguments in declaration order
    timestamp: number;             // Date.now() at intercept
    outcome: 'success' | 'error' | 'timeout' | 'malformed' | 'unconfigured';
}
```

Inspect via `config.getCalls(op?)`:

```ts
const calls = mpStub.config.getCalls('subscriptions.create');
expect(calls).toHaveLength(1);
expect(calls[0].args[0]).toMatchObject({ planId: '...', customerId: '...' });
```

Pass no argument to get every call across all operations, in invocation order.

Call recording is intentional: the stub does not implement MP's state machine, so the only way a test can assert "qzpay-core called subscriptions.cancel with cancelAtPeriodEnd=true" is to inspect what the stub received. Asserting against fresh DB reads tells you the side-effect; asserting against the call log tells you the intent.

---

## 6. Resetting between tests

```ts
beforeEach(() => mpStub.config.reset());
```

`reset()` clears both the configured response map and the recorded call log. Without it, a configured response leaks from test N into test N+1, and call counts compound.

A single stub instance per test file is the default. If you need parallel-safe stubs (rare; the e2e suite uses `singleFork: true`), call `createMpStubAdapter()` per test instead of per file — each call returns an isolated instance.

---

## 7. Wiring the stub into a test

The full pattern from `apps/api/test/e2e/flows/billing/monthly-checkout.test.ts`:

```ts
import { vi } from 'vitest';

// (1) vi.hoisted creates a ref BEFORE any import; both the mock factory and
//     the suite's beforeAll can reach it.
const stubRef = vi.hoisted(() => ({ current: null as unknown }));

// (2) vi.mock is hoisted to the top of the file by vitest's transform.
//     The factory closes over stubRef and returns the current adapter on each
//     invocation, so a lazily-initialized middleware sees the real stub instance
//     instead of `undefined`.
vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return {
        ...actual,
        createMercadoPagoAdapter: () => {
            if (stubRef.current === null) {
                throw new Error('mp-stub adapter not initialized — wire stubRef before the first request');
            }
            return stubRef.current;
        }
    };
});

// (3) Regular imports now resolve through the mocked module.
import { initApp } from '../../../../src/app.js';
import { createMpStubAdapter } from '../../helpers/mp-stub.js';
import { providerResponseFixtures } from '../../helpers/billing-fixtures.js';

describe('Monthly checkout flow', () => {
    let mp: ReturnType<typeof createMpStubAdapter>;
    let app: ReturnType<typeof initApp>;

    beforeAll(async () => {
        mp = createMpStubAdapter();
        stubRef.current = mp.adapter;       // (4) populate the ref shared with vi.mock
        app = initApp();
    });

    beforeEach(() => mp.config.reset());     // (5) clean state per test

    it('returns 201 with checkout URL', async () => {
        mp.config.setSuccess(
            'subscriptions.create',
            providerResponseFixtures.subscription({ id: 'sub_test_123' })
        );
        // ... POST the request, assert, then inspect mp.config.getCalls(...)
    });
});
```

Five things have to be right:

1. **`vi.hoisted` for `stubRef`.** A plain `const` would be evaluated *after* the hoisted `vi.mock`.
2. **`vi.mock` with `importOriginal`.** Without `...actual`, every other export of `@repo/billing` becomes `undefined` and the rest of the suite breaks.
3. **Factory function returning the adapter.** Returning the adapter object directly works only if it exists at hoist time — it does not.
4. **`stubRef.current = mp.adapter` in `beforeAll`.** The mock factory's "not initialized" throw is what catches a missed step here.
5. **`reset()` in `beforeEach`.** Without it, prior `setSuccess`/`setError` leaks into the next test.

The dance is annoying. It exists because vitest's mocking model is hoist-based and our code path lazily resolves the adapter through a middleware (`apps/api/src/middlewares/billing.ts`) — there is no single import the test can stub before app init.

### Resetting the billing middleware singleton

`apps/api/src/middlewares/billing.ts` caches the billing instance after the first request. If a test recreates the app or wants a fresh wiring, call `resetBillingInstance()` between tests. Most flows do not need this — the same stub is shared for the whole file, and the lazy init in the middleware factory consults `stubRef.current` on every call (because of step 3 above).

---

## 8. Distinction from `qzpay-test-control`

There are two failure-injection mechanisms in the codebase. Use the right one.

| Mechanism | Lives in | Wraps | Needs network? | Used by |
|---|---|---|---|---|
| `mp-stub` (this doc) | `apps/api/test/e2e/helpers/mp-stub.ts` | Replaces adapter | No | Workstream A (CI flows) |
| `applyTestControl` | `packages/billing/src/adapters/qzpay-test-control.ts` | Wraps the REAL adapter | Yes (sandbox) | Workstream B (sandbox tests) |

`qzpay-test-control` injects failures into specific high-level operations of the **real** adapter. It needs a real MP sandbox to provide success-path responses for the operations it does not fail. Use it in `apps/api/test/e2e/sandbox/` when the test asks "what does our code do when MP returns 503 on this specific call, given everything else is real".

`mp-stub` is the entire adapter. No real MP involved. Use it in CI flows when the test asks "given MP returns *exactly* this, what does our code do".

Confusing them: a Workstream A test trying to use `qzpay-test-control` will hit the network and flake; a Workstream B sandbox test trying to use `mp-stub` will replace the very thing it was supposed to verify.

---

## 9. Provider-shape gotchas

The stub returns what qzpay-core sees, which is the **post-mapStatus** shape produced by the real adapter's internal transformer. That has consequences:

### Status spelling

The qzpay convention is US English: `'canceled'`, `'authorized'`, `'paid'`. The hospeda DB convention for subscription status is UK English: `'cancelled'` (double-l). The real adapter's mapper translates `'canceled'` → `'cancelled'` before the row is written.

Inside a flow test:

- The **stub return** (what `providerResponseFixtures.subscription({ status: ... })` produces and what `mp.config.getCalls(...)` sees in args) uses `'canceled'`.
- The **DB read** (what `db.select().from(billingSubscriptions)...` returns) uses `'cancelled'`.

Assert against the layer the test is actually validating. Asserting `'cancelled'` on the stub return or `'canceled'` on the DB read produces a confusing failure that takes 20 minutes to debug.

### `customers.create` returns a string, not an object

Most operations return `QZPayProvider*` shapes. `customers.create` is the exception: it returns the provider customer id (a string), not the full customer object. `providerResponseFixtures.customer({...})` returns the object — for `customers.create` configure with the bare string:

```ts
mp.config.setSuccess('customers.create', 'mp_cust_xxx');
```

### `payments.create` takes two args

```ts
adapter.payments.create(providerCustomerId, input)
```

The recorded call's `args` is `[providerCustomerId, input]`. Inspect `args[1]` for the payment input shape.

### `payments.refund` takes args in a non-obvious order

```ts
adapter.payments.refund(input, providerPaymentId)
```

Input first, payment id second. Mirrors qzpay-core's call shape. Easy to flip if you're typing from memory.

---

## 10. Limits the stub does NOT model

- **No state.** A `setSuccess('subscriptions.cancel', ...)` followed by `subscriptions.retrieve` does NOT reflect the cancel. Each operation returns whatever its most recent `setResponse` says, independent of order. If a test needs sequenced behavior, configure each operation explicitly between calls.
- **No event fan-out.** Cancelling a subscription in real MP triggers webhook events. The stub does NOT emit webhooks — tests that want to validate webhook handling POST the IPN body themselves using `webhookEventFixtures`.
- **No retries.** The real adapter retries some transient failures internally. The stub does not — a single `setError` produces a single throw.
- **No signature verification.** `webhooks.verifySignature` returns whatever you configure; it does NOT actually verify the HMAC. For tests that exercise the real verification middleware, build the signature with `signWebhookPayload` (from `signature-helpers.ts`) and let the real middleware verify.
- **No rate limiting.** The real MP API enforces rate limits. The stub does not — a flow that calls `payments.create` 1000 times in a tight loop will see 1000 successful responses regardless of how the real API would react.

These are deliberate non-goals. Modeling any of them would make the stub a partial simulator and shift the burden of "is the simulator correct" onto every test author. The Workstream B sandbox path exists precisely so a few targeted tests can verify behavior under real MP rules.

---

## 11. Adding a new operation

If hospeda code or qzpay-core grows a new call to an MP adapter method:

1. Add the operation name to the `MpStubOperation` union.
2. Add the method to the `adapter` object literal in `createMpStubAdapter()` — call `dispatch(opName, [args...])` for async, `dispatchSync` for sync.
3. If the new method takes multiple args, document the order in a comment so call inspectors know `args[0]` vs `args[1]`.
4. If the method needs a new response shape, add a `providerResponseFixtures.<thing>(...)` builder in `mp-responses.ts`.
5. Update §2 of this doc with the new method.

Do NOT add operations the codebase does not actually invoke. The point of the explicit union is to fail loud when a flow strays into territory neither the stub nor the contract documents.

---

## 12. Cross-references

- [`e2e-infrastructure-design.md`](./e2e-infrastructure-design.md) — surrounding infrastructure (vitest configs, DB management, factories, fixtures).
- [`staging-smoke-checklist.md`](./staging-smoke-checklist.md) — Workstream B execution checklist.
- [`prod-smoke-checklist.md`](./prod-smoke-checklist.md) — production smoke + rollback procedures.
- `apps/api/test/e2e/helpers/mp-stub.ts` — the implementation. The JSDoc on `createMpStubAdapter`, `MpStubOperation`, and the response-mode types is intentionally exhaustive — keep it that way.
- `apps/api/test/e2e/helpers/mp-responses.ts` — `providerResponseFixtures` builders.
- `apps/api/test/e2e/flows/billing/monthly-checkout.test.ts` — canonical reference for the `vi.hoisted` + `vi.mock` + `stubRef` pattern.
- `packages/billing/src/adapters/qzpay-test-control.ts` — the sandbox failure-injection wrapper (the OTHER mechanism — do not confuse).
- `/home/qazuor/projects/PACKAGES/qzpay/packages/core/src/adapters/payment.adapter.ts` (external) — the `QZPayPaymentAdapter` contract the stub satisfies. If the contract changes upstream, the stub's union must change with it.
