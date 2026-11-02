# HOS-1999 — Measured diagnosis (Mercado Pago traffic)

Every reference below was re-read on `origin/staging` at `5839d5e749`
(2026-11-02). Where the Linear issue's diagnosis was imprecise, the correction
is called out as **Correction**.

## 1. One transport, no shared limiter

- All Mercado Pago (MP) HTTP traffic goes through the private
  `MercadoPagoPaymentProvider.send`
  (`packages/payments/src/adapters/mercadopago/mercadopago-payment-provider.ts:145-190`).
  Every capability (`authorize`, `cancel`, `changeAmount`, `pause`/`resume`,
  `refund`, `readAuthorization`, `searchAuthorizations`, `readCharge`,
  `listCharges`, `readOrder`, `searchOrders`) calls it.
- One instance per process: `defaultPaymentProvider`
  (`apps/api/src/utils/payment-provider.ts:12-19`) is built once by the app
  composition root (`apps/api/src/app.ts:46`) and injected
  (`injectPaymentProvider`). Checkout routes, the webhook receiver
  (`apps/api/src/routes/webhooks/mercadopago.ts:51-54`, synchronous), admin
  routes and the five MP-calling crons all share it.
- Nothing in `send` limits rate, orders by priority, or remembers a 429.

## 2. Call inventory per capability

| Capability | HTTP requests | Source |
|---|---|---|
| `readAuthorization` | 1 GET `/preapproval/{id}` | provider.ts:303-364 |
| `listCharges` | P GET `/authorized_payments/search` (page size 10, max 50 pages) + U GET payment searches for unnamed records + up to 2 full re-reads when a record is still being written | `mercadopago-charges.ts:32-86`, `mercadopago-unnamed-charges.ts:32-36` |
| `readCharge` | 1 GET `/v1/payments/{id}` **+ P** GET `/authorized_payments/search` (to compute `expiresAt`) | `mercadopago-charge-read.ts:63-88` → `mercadopago-charge-window.ts:20` |
| `searchAuthorizations` | S GET `/preapproval/search` (page size 20) | `mercadopago-search.ts:41-48` |
| writes (`authorize`, `cancel`, ...) | 1 POST/PUT | provider.ts:216-300 |

`P = ceil(N / 10)` where `N` is the number of authorized-payment records of the
preapproval (one per monthly cycle, so N ≈ months of tenure).

**`readCharge` re-paginates the full record list of its authorization every
time** — the window is derived from the record that names the payment.

## 3. Per-row cost of the daily reconciliation sweep

Composition: `apps/api/src/cron/jobs/billing-reconciliation-sweep.job.ts:63-185`.
Per row (`reconciliation-sweep.service.ts:197-235`): one `readAuthorization`,
then the comparisons, then the row checks, in order.

Charge-inventory readers (each = `listCharges` + `readCharge` for EVERY listed id,
through `Promise.all`):

- `readListedCharges` (`comparisons/listed-charges.ts:26-35`), used by
  `createPeriodChargesComparison` (`comparisons/period-charges-comparison.ts:137`).
- `readPeriodCharges` (`period-charges/read-period-charges.ts:67-75`), used by
  `createLostFirstRejectionCheck` (`sweep/lost-rejection-check.ts:38`),
  `createProviderPauseCheck` → `runArrearsDecisionAfterPeriodRead`
  (`sweep/provider-pause-check.ts:50`, `sweep/grace-expiry-check.ts:193`) and
  `createGraceExpiryCheck` (`sweep/grace-expiry-check.ts:306-321`).

Which readers run on one row (traced from their guards):

| Row state | Inventories read |
|---|---|
| ACTIVE card principal, not paused, has a credited payment | comparison + lost-rejection = **2** |
| ACTIVE, paused at MP | provider-pause + lost-rejection = 2 (comparison skips paused) |
| GRACE_PERIOD, clock running, not paused | comparison = 1 |
| GRACE_PERIOD, clock expired | grace-expiry = 1 (comparison skips expired grace) |

**Correction**: the issue says "up to 3 times per row". The traced maximum is
**2** full inventories per row; the third reader (grace-expiry / provider-pause)
is mutually exclusive with one of the other two. The 77-request figure in the
issue is consistent with 2 inventories (below), not 3.

Formula for the common row (ACTIVE, credited, N records, no unnamed records):

```
R(N) = 1 + 2 × [ P + N × (1 + P) ]        P = ceil(N / 10)
```

| Tenure N | P | R(N) |
|---|---|---|
| 1 | 1 | 1 + 2×(1+2) = **7** |
| 6 | 1 | 1 + 2×(1+12) = **27** |
| 12 | 2 | 1 + 2×(2+36) = **77** |
| 24 | 3 | 1 + 2×(3+96) = **199** |
| 36 | 4 | 1 + 2×(4+180) = **369** |

Growth is **quadratic in tenure** (≈ N²/5), not linear: every charge read pays
the whole paginated record list again.

Additional sweep passes in the same run also call MP:
`runCreditedPaymentsCheck` reads every credited payment inside the deadline-18
window by id (`sweep/credited-payments-check.ts:115`, again 1 + P each),
`runOurCancellationRetry`, `runTerminalReturn` (`readLastCycleRecordIsOpen` →
another full inventory, `sweep/last-cycle-record.ts:44`) and `runPaidOrdersCheck`.

## 4. Retry layers multiply

| Layer | Where | Applies to | Budget | Honors `Retry-After` | Jitter |
|---|---|---|---|---|---|
| L1 adapter read retry | `mercadopago-read-retry.ts:16-21,55-102` | every GET `send`, all callers | 3 attempts, 500→2000 ms, ≤ 4000 ms total | yes, but **capped at 2000 ms** | no |
| L2 sweep decorator | `sweep/sweep-provider-pacing.ts:22-28,84-120` | every read *method call* in the sweep | 5 attempts, 2→16 s, ≤ 240 s per run | **no** (own backoff) | no |
| L3 cancel retry (open PR #4005, HOS-1995) | `cancel-our-authorization.ts` (`SWEEP_CANCEL_RETRY`) | sweep `cancel` writes | 3 attempts, 2→10 s | yes, capped at 10 s | no |

- A 429 surfaces as `code: 'UNAVAILABLE'` with `transient.kind: 'RATE_LIMITED'`
  (`mercadopago-http.ts:79-92,130-136`), so L2 retries it.
- L2 retries the whole method, so a `readCharge` (1 + P sends) under a 429 storm
  can issue `5 × (1 + P) × 3` HTTP requests; a single send up to **15**.
- L2's spacing (`minIntervalMs: 250`) reserves a slot per **method call**, not per
  HTTP request; the `1 + P` requests inside one `readCharge`, and the
  `Promise.all` siblings started 250 ms apart, still overlap on the wire.
- L2 is per run (`createSweepPacedProvider` is built inside the handler), so no
  other caller sees its state.

## 5. Schedule and overlap

MP-calling crons (`rg getPaymentProvider apps/api/src/cron/jobs`):

| Job | Schedule | Timeout | MP calls |
|---|---|---|---|
| `billing-reconciliation-sweep` | `0 6 * * *` | 600 s | §3 |
| `billing-creations-sweep` | `*/5 * * * *` | 120 s | `searchAuthorizations({ payerEmail })` per pending row (`creations-sweep.service.ts:110`), plus reads/cancels of duplicates |
| `subscription-window-expiry` | `*/15 * * * *` | 120 s | re-read before expiry |
| `subscription-service-end` | `*/15 * * * *` | 120 s | S12 provider calls |
| `payment-window-expiry` | `20 * * * *` | 300 s | `readCharge` per pending payment |

- At **06:00** four MP-calling jobs fire in the same second (sweep, creations,
  window-expiry, service-end); at every `:00/:15/:30/:45` three do.
  Six non-MP jobs also fire at 06:00 (`listing-retention-pass`,
  `exchange-rate-fetch`, `calendar-sync-google`, `calendar-sync-ical`,
  `destination-weather-fetch`, `search-index-refresh`) and compete for the
  event loop and DB pool.
  **Correction**: the issue's "6 crons at 06:00" counts all jobs; the MP-calling
  subset is 4.
- **No overlap lock.** `runJobWithTimeout` (`apps/api/src/cron/bootstrap.ts:103-115`)
  races the handler with a timer; on timeout the race rejects but the handler
  keeps running with no signal to stop. `nodeCron.schedule` (`bootstrap.ts:175`)
  passes no `noOverlap`, and even `noOverlap` (node-cron 4.6.0) would see the
  callback finish at the timeout, not when the handler does.
- **No cross-container exclusion.** Each API container runs node-cron when
  `HOSPEDA_CRON_ADAPTER=node-cron`. During a Coolify rollout two containers
  coexist and both serve traffic, so any tick in that window runs twice. Some non-billing jobs already use
  `pg_try_advisory_xact_lock` (`destination-weather-fetch.job.ts:141`,
  `archive-expired-promotions.job.ts:103`); none of the five MP jobs do.
- **Creations sweep has no memory.** Every pending, non-fresh
  (`CREATION_GRACE_MS = 5 min`) row is searched by payer email on every tick for
  its whole authorization window
  (`packages/db/src/models/creation-sweep/creation-sweep.model.ts:102-110`):
  288 searches × S pages per row per day, and two rows sharing an email search
  twice in the same run.

## 6. Interactive paths that share the quota

- Webhook: `receiveProviderDelivery` → `processProviderNotice` →
  `recordChargeFact` → `readCharge` (1 + P) and/or `readAuthorization`
  (`process-provider-notice.service.ts:224,294`). The receiver already answers
  `503 + Retry-After: 60` for a `DEFERRED` outcome
  (`routes/webhooks/mercadopago.ts:58-63`), so MP redelivers.
- Checkout: `authorize` (1 POST) plus confirmation reads.
- Admin: refunds, `settle-external-charge` (`readCharge`).

The webhook's `readCharge` cost also grows with tenure (`1 + P`).

## 7. Test surface available today

- `packages/payments/src/fake-server/fake-provider-server.ts` is an HTTP fake of
  MP that records every request (`requests()`, line 359). It has no throttling
  mode yet (no 429 / `Retry-After` injection).
- `MercadoPagoPaymentProvider` accepts injected `fetch`, `sleep` and `clock`
  (provider.ts:195-213), so a governor can be tested with a fake clock.
