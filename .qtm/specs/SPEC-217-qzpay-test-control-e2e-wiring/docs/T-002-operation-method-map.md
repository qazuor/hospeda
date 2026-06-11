# T-002 — ControllableOperation → adapter method map (decision note)

Investigation output for T-002. Feeds T-006 (wire `applyTestControl`) and the Group B
specs (T-011/T-012/T-013). **Surfaces two findings that need a call before T-006.**

## Facts gathered (file:line)

- **Operations** (`packages/billing/src/adapters/qzpay-test-control.ts:18-25`): 7 values —
  `startTrial`, `cancelTrial`, `createPaymentPreference`, `capturePayment`,
  `refundPayment`, `cancelSubscription`, `updateSubscription`. `applyTestControl(operation,
  args, realCall)` at lines 111-115. The same 7 strings are duplicated in the e2e fixture
  (`apps/e2e/fixtures/qzpay-test-control.ts:33-40`) and the HTTP route validation
  (`apps/api/src/routes/test/qzpay-control.ts:27-35`), kept in sync by hand.
- **Adapter surface**: `createMercadoPagoAdapter()` (`packages/billing/src/adapters/mercadopago.ts:145-218`)
  returns `QZPayMercadoPagoAdapter` with generic methods: `subscriptions.{create,retrieve,
  update,cancel,pause,resume}`, `payments.{create,retrieve,capture,cancel,refund}`,
  `checkout.{create,...}`, `customers.*`, `prices.*`, `webhooks.*`.
- **Construction chokepoint**: `apps/api/src/middlewares/billing.ts:92`
  (`createMercadoPagoAdapter(...)`) → passed to `createQZPayBilling({ paymentAdapter })` at
  line 102. Singleton via `getBillingInstance()` / `getQZPayBilling()`.
- **`applyTestControl` has zero callers** — wiring gap confirmed.
- **Specs' minimum op set**: host-07c `failNext('startTrial','TIMEOUT')`
  (host-07c:73-77); host-07d `failNext('updateSubscription',...)` + asserts `cancelTrial`
  in recorded calls (host-07d:76-80,100); res-01 `failNext('startTrial','API_DOWN')`
  (res-01:73-76). Minimum set: **startTrial, cancelTrial, updateSubscription**.

## Proposed mapping (semantic op → generic adapter method)

| Operation | Adapter method | Certainty |
|-----------|----------------|-----------|
| startTrial | `subscriptions.create` | HIGH |
| cancelTrial | `subscriptions.cancel` | HIGH (publish-flow compensation) |
| updateSubscription | `subscriptions.update` | HIGH |
| cancelSubscription | `subscriptions.cancel` | HIGH — **collides with cancelTrial** |
| createPaymentPreference | `checkout.create` | MEDIUM |
| capturePayment | `payments.process`/`capture` | LOW |
| refundPayment | `payments.refund` | LOW |

## FINDING 1 (needs a decision before T-006) — interception layer

Semantic operation names (`startTrial`, `cancelTrial`, `cancelSubscription`) collapse onto
**generic** adapter methods. Notably `cancelTrial` and `cancelSubscription` BOTH map to
`subscriptions.cancel`. If we wrap at the adapter-method level, the wrapper cannot tell
which semantic operation a `subscriptions.cancel` call represents.

Two options:

- **A — wrap the adapter methods** (in `createMercadoPagoAdapter`, mercadopago.ts).
  Simplest, single chokepoint, unit-testable in isolation. But it must pick ONE canonical
  operation name per adapter method (e.g. `subscriptions.cancel` → always `'cancelTrial'`).
  Works for the 3 specs (publish-flow cancel IS the trial compensation), but the
  `cancelTrial`/`cancelSubscription` distinction is lost and `capturePayment`/`refundPayment`
  mappings are uncertain.
- **B — call `applyTestControl` at the semantic call sites** (e.g.
  `accommodation-publish-deps.ts` `startTrial`/`cancelTrial`, the subscription-update
  service for `updateSubscription`). Precise — each call knows its own operation name.
  Cost: spreads `applyTestControl` across service code (more files), and those sites call
  `billing.subscriptions.*` (core), not the adapter directly.

Recommendation: **A for the 3 required specs now** (canonical per-method names; covers
startTrial/cancelTrial/updateSubscription deterministically), and document the collision
so future tests needing `cancelSubscription` distinctly switch that one to B. This keeps
T-006 a single-file, low-risk change. **Confirm before T-006.**

## FINDING 2 (affects T-012) — host-07d may test a non-existent flow

The publish flow (`accommodation-publish-deps.ts`) calls only `startTrial`
(`subscriptions.create`) and `cancelTrial` (`subscriptions.cancel`) — it does **NOT** call
`updateSubscription` in the publish path. host-07d's scenario ("startTrial OK +
updateSubscription fails → cancelTrial compensation") assumes an `updateSubscription` step
that the current publish flow does not perform. Either:
- the publish flow must be extended to call `updateSubscription` (scope creep — likely a
  separate decision), or
- host-07d's scenario must be re-expressed against an operation the publish flow actually
  performs (e.g. fail the post-`create` confirmation), or
- host-07d targets a different flow than publish.

T-012 must reconcile this before un-skipping host-07d. Flagged so it is not assumed
trivial.

## Decision for T-006 wiring (pending FINDING 1 confirmation)

Wrap inside `createMercadoPagoAdapter` (mercadopago.ts): return a proxy/wrapper that, when
`isTestControlEnabled()`, routes `subscriptions.create` → `applyTestControl('startTrial',
…)`, `subscriptions.update` → `applyTestControl('updateSubscription', …)`,
`subscriptions.cancel` → `applyTestControl('cancelTrial', …)`; pass-through (unwrapped
adapter) when disabled. Unit-test each mapping + the no-op path.
