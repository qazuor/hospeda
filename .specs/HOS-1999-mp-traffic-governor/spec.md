---
title: Mercado Pago traffic governor
linear: HOS-1999
statusSource: linear
created: 2026-11-02
type: feature
areas:
  - api
  - billing
  - db
smokeGates:
  # Billing CORE: the governor sits on the transport every checkout, webhook and
  # billing cron uses. Real MP rate limits and Coolify rollouts with two
  # containers are only observable against the VPS.
  - status-needs-smoke-staging
  - status-needs-smoke-prod
---

# Mercado Pago traffic governor

## 1. Summary

Stop hitting Mercado Pago (MP) 429s at the root, before subscriber volume grows.
Three changes, shipped as independent PRs:

- **A. Governor** — one token bucket in front of every MP HTTP request, with
  priority classes (interactive before background), a shared cool-down on
  429 / `Retry-After`, jitter, and a single owner for retries.
- **B. Stop re-reading immutable data** — memoize within a sweep row and an
  adapter read scope and persist closed charges, so a subscription's daily cost
  stays nearly flat as tenure grows (the unchanged-inventory skip waits on a
  sandbox measurement).
- **C. Schedule** — stagger the MP-calling crons, add a real no-overlap lock
  (in-process and across containers), make the cron timeout cancel
  cooperatively, run the daily sweep as a **resumable nightly cycle** of short
  slices, and give the creations sweep a per-row backoff.

The owner answered OQ-1…OQ-6 on 2026-11-02 (§14). A design review the same day
(findings H1–H19) hardened the design; the owner then decided the two questions
it raised, OQ-7 and OQ-8, the same day.

Measured diagnosis, with file:line on `origin/staging@5839d5e749`:
[`docs/diagnosis.md`](docs/diagnosis.md).

## 2. Problem

With about 13 subscriptions MP already answers 429. The customer checkout and the
webhook share one MP quota with five crons, and nothing coordinates them:

1. **No shared limiter.** Every request goes through
   `MercadoPagoPaymentProvider.send` (`mercadopago-payment-provider.ts:145`), one
   instance per process (`app.ts:46`), with no rate limit, priority or 429 memory.
2. **Cost grows quadratically with tenure.** `readCharge` costs `1 + P` requests
   because it re-paginates `/authorized_payments/search` to compute `expiresAt`.
   The sweep reads the full charge inventory twice per common row, so an ACTIVE
   subscription with N monthly records costs `R(N) = 1 + 2 × [P + N(1+P)]`,
   `P = ceil(N/10)`: 7 requests at month 1, 77 at month 12, 369 at month 36.
3. **Retries multiply.** The adapter retries a GET 3 times; the sweep decorator
   retries the whole method 5 times and ignores `Retry-After`. One send can
   become 15 HTTP requests, with no jitter, in the middle of a 429 storm.
4. **Schedule collides.** At 06:00 four MP-calling jobs start in the same second.
   The cron timeout (`bootstrap.ts:103-115`) does not stop the handler, there is
   no overlap lock, and during a Coolify rollout both containers run the crons.
   The creations sweep searches every pending row by email every 5 minutes.

A cron burst can therefore fail a real payment confirmation or a checkout.

## 3. Goals

- **G-1** Interactive MP traffic (checkout, webhook, user and admin routes) is
  never queued behind background traffic, and is never failed by a 429 that
  background traffic caused while a token was available for it.
- **G-2** After any 429, every caller in the fleet (OQ-1: through a
  Redis-shared cool-down) pauses for the provider's `Retry-After`; no layer
  retries into it.
- **G-3** The worst-case HTTP requests caused by one logical read is bounded and
  documented, and retries do not multiply across layers.
- **G-4** The daily sweep cost per subscription is roughly constant in tenure.
  Steady state (no new charge since the last run): ≤ `2 + ceil(N/10)` requests
  per row with B1–B3 (4 at 12 months, 6 at 36, versus 77 and 369 today), and
  ≤ 2 independent of N if B4 is unlocked later (OQ-6).
- **G-5** No two runs of the same MP-calling cron overlap, in one container or
  across two.
- **G-6** We can tell from logs whether 429s persist after A + B + C, which
  decides whether D (§4) is needed.
- **G-7** Every sweep-inventory row is read once per nightly cycle, no slice runs
  longer than 50 min at any volume, and a cycle that cannot finish is visible
  and does not starve the same rows the next night.

## 4. Non-goals

- **NG-1 (D) Suspicion-based sweep.** Reading only rows with a reason to be read
  (next charge due, open mark, recent notice). Revisit if G-6 shows 429s after
  this spec ships.
- **NG-2 (E) Asking MP for the account's real limits.** Owner action, together
  with HOS-1991's integrator ID. This spec ships conservative code constants
  (OQ-3); E's answer only retunes them.
- **NG-3** Changing any reconciliation decision, verdict or mark. B changes where
  data comes from, never what a check decides from it.
- **NG-4** A queue / outbox for MP writes. Writes stay synchronous.
- **NG-5** Retrying MP writes in the adapter. Writes stay single-attempt there
  (they are not idempotent by contract); HOS-1995's service-level cancel retry
  stays the only write retry.

## 5. Current baseline

See [`docs/diagnosis.md`](docs/diagnosis.md). Key facts the design depends on:

- `ProviderRead<T>` + `assertFreshForAct` (`packages/payments/src/provider/provider-read.ts`)
  enforce INV:D17 / AC:B1:4: a decision only uses a read stamped at or after its
  act started. Any cache that returns a `ProviderRead` built earlier would break
  this invariant. B is designed around it (§6.2).
- 429 maps to `code: 'UNAVAILABLE'` + `transient: { kind: 'RATE_LIMITED', retryAfterSeconds }`
  (`mercadopago-http.ts:79-92`, HOS-1968).
- The webhook answers `503 + Retry-After: 60` on a `DEFERRED` outcome, and MP
  redelivers (`routes/webhooks/mercadopago.ts:58-63`).
- Redis is available and required in production (`HOSPEDA_REDIS_URL`,
  `apps/api/src/utils/redis.ts`); Postgres advisory locks are the repo's cron-lock
  pattern (`destination-weather-fetch.job.ts:141`).
- node-cron is 4.6.0 (`noOverlap` supported, in-process only).
- Open PR #4005 (HOS-1995) adds `SWEEP_CANCEL_RETRY` (3 attempts, honors
  `Retry-After` up to 10 s) around the sweep's `cancel`.

## 6. Proposed design

### 6.1 A — Governor

**Placement.** A new `ProviderTrafficGovernor` in `packages/payments`
(`src/provider/traffic-governor.ts`, provider-agnostic), injected into
`MercadoPagoPaymentProvider` as an optional `governor` option and built once in
`defaultPaymentProvider`. It wraps **each HTTP attempt** inside `send`'s
`attempt` callback, so retries pay for tokens too: the governor counts HTTP
requests, not logical calls.

Two methods (RO-RO): `acquire({ trafficClass, maxWaitMs, signal })` waits for a
token and rejects with a transient `RATE_LIMITED` error when the wait would
exceed `maxWaitMs` or `signal` aborts; `observe({ trafficClass, status,
retryAfterMs })` reports what the paid-for request got back.
`TrafficClass = 'interactive' | 'background'`.

**Token bucket.** Rate `R` tokens/s, capacity `B`, as code constants
(OQ-3 decided) until E answers: `R = 5/s`, `B = 10`, interactive reserve `20%`
of `B`.

**Priorities.** Two FIFO wait queues. A token goes to the interactive queue
first; background is served only when the interactive queue is empty **and**
the bucket holds more than the interactive reserve. Background can never take
the last `reserve` tokens, so an interactive request arriving mid-burst finds a
token immediately.

**Class propagation.** An `AsyncLocalStorage<TrafficClass>` exported by
`packages/payments` (`runWithTrafficClass`). Set once per composition point, not
per call site. There are three:

- the API app middleware sets `interactive` for every HTTP request (covers
  checkout, webhook, user routes, admin);
- the shared `runCronJob` (§6.3) wraps every job handler in `background`, for
  both the scheduled tick and the manual trigger;
- the operator script `apps/api/scripts/cutover-b9a-step-3b.ts`, which composes
  its own provider through `composeStep3bProcess`
  (`apps/api/src/services/cutover-b9a/step-3b.compose.ts:36`,
  `defaultPaymentProvider({ clock })`), runs in `background`.

A request with no class is treated as `interactive` (fail toward serving a
customer) and counted as `unclassified` (§6.4). A static guard test enumerates
**every** caller of `defaultPaymentProvider` and of `new
MercadoPagoPaymentProvider` in production code and fails on one that is not on
its allowlist with a declared class, so a fourth composition point cannot be
born unclassified.

**Shared cool-down.** On a 429, `observe` sets `coolDownUntil = now + d`, where
`d = Retry-After + random[0, 1 s]` when present (never shorter than the
provider asked, max 120 s), else `2 s × 2^k × random[0.5, 1.0]` for the k-th
consecutive 429 (max 60 s); random is injectable. While cooling down:

- background waits (its `maxWaitMs` is the job's remaining budget);
- interactive waits only if the cool-down ends within its `maxWaitMs`
  (default 2 s); otherwise it fails fast with the existing transient
  `RATE_LIMITED` error (OQ-5), flagged `governorRejected: true` (no HTTP request
  was sent). Checkout maps it to the existing retryable error (HOS-1968), not a
  500. Neither checkout nor the webhook runs inside a read scope (§6.2): they
  always read live and only write snapshots.

**Webhook under a cool-down.** Today only an incomplete read becomes `DEFERRED`
(`process-provider-notice.service.ts:483-485`); every other error, including a
`RATE_LIMITED` one, becomes `FAILED`, and the route answers a fixed
`Retry-After: 60` (`routes/webhooks/mercadopago.ts:58-63`). This spec maps a
`RATE_LIMITED` error (governor-rejected or a real 429) to `DEFERRED` as well, and
carries `retryAfterSeconds` = the remaining shared cool-down (rounded up, min 1,
max 120) into the outcome, so the route answers `503` with that `Retry-After`
instead of 60. MP redelivers; no notice is lost.

A 2xx resets k. 5xx does not open a cool-down (it is not a quota signal).

**Retry ownership (G-3).** Under `enforce` only; under `off` and `observe` every
layer keeps today's behaviour byte for byte (see Kill switch).

| Layer | Under `enforce` |
|---|---|
| L1 adapter GET retry (`mercadopago-read-retry.ts`) | Stays the **only** HTTP-level retry. Each attempt acquires a token. Two changes keep it from undoing the governor's wait: (a) an error with `governorRejected: true` is rethrown at once, never retried (today the loop retries every `UNAVAILABLE`, `mercadopago-read-retry.ts:75-77`, which would turn one fast-fail into three); (b) after a 429, L1's own delay is **0**: the next attempt's `acquire` owns the wait, so a long `Retry-After` can no longer exhaust L1's 4000 ms budget before the next acquire is reached. L1's budget becomes class-dependent: **interactive** keeps a 4000 ms total including token waits (each `acquire` gets `maxWaitMs = min(2000, remaining)`); **background** has no L1 time cap and is bounded by the job's `ctx.signal`. Jitter on the 5xx/network backoff. |
| L2 sweep decorator (`sweep-provider-pacing.ts`) | **Stops retrying `RATE_LIMITED`** (L1 + governor already did). Keeps retrying 5xx / network errors, reduced to 2 attempts, honoring `transient.retryAfterSeconds`, with jitter. `minIntervalMs` spacing is removed (the bucket replaces it). |
| L3 cancel retry (HOS-1995, `SWEEP_CANCEL_RETRY`) | Kept: it is the only write retry. Each attempt now acquires a background token, so its 2→10 s backoff can no longer fire inside a cool-down. If #4005 merges first this spec only adjusts its tests; if not, the spec's PR rebases on it. |

Resulting bound under `enforce`: one logical GET causes at most `L1.maxAttempts
(3) × L2 attempts on 5xx only (2) = 6` HTTP requests, and **3** under 429s (down
from 15), all spaced by the shared cool-down.

**Cross-container scope** (decided, OQ-1 option 2): the bucket stays
in-process; the **cool-down is shared through Redis** — a 429 in any container
writes `mp:cooldown-until`, keeping the max atomically (a short Lua script:
write only if the new instant is later, with `PX` = the remaining duration), and
`acquire` reads it (cached ≤ 250 ms). Duplicate cron runs during a rollout are
removed by C's lock, not by the bucket.

The governor uses a **dedicated** ioredis client, not the shared
`getRedisClient()`: that helper awaits `client.connect()` with a 5 s
`connectTimeout` on first use (`apps/api/src/utils/redis.ts:32-52`) and, once a
first attempt fails, returns `undefined` forever because `connectionAttempted`
is never reset (`redis.ts:18-19`). Changing the shared helper is out of scope
(other consumers depend on its behaviour). The dedicated client:

- connects in the background at composition (`lazyConnect` + a non-awaited
  `connect()`); `acquire` **never awaits the connection** — while
  `status !== 'ready'` it uses the in-process cool-down;
- runs with `enableOfflineQueue: false`, `commandTimeout: 50` and a
  `retryStrategy` that never gives up (capped backoff), so it recovers by itself
  after Redis comes back;
- bounds every read at **50 ms**; a timeout or error falls back to the
  in-process cool-down and logs once per outage (not per request).

**Kill switch.** `HOSPEDA_MERCADO_PAGO_GOVERNOR_MODE = off | observe | enforce`
(new env var, full workflow in §7). The mode gates **all** of A, including the
L1/L2 changes of PR-3: under `off` the governor is not consulted and L1/L2 run
their legacy code paths (today's attempts, delays, `Retry-After` cap and
`minIntervalMs`); under `observe` the same legacy paths run and the governor only
measures and logs the waits it would have imposed; only `enforce` turns on the
new retry ownership. So setting `off` reverts PR-3's behaviour without a revert
PR, and a parity test pins it (AC-28). `observe` is the first rollout step (§11).

### 6.2 B — Stop re-reading immutable data

Four layers, cheapest first. None changes what a check decides (NG-3).

**B1. Adapter read scope (single-flight records).** Inside one *read scope*,
`readMercadoPagoChargeRecords(authorizationId)` is fetched once and shared by
`listCharges` and every `readCharge` of that authorization (including concurrent
`Promise.all` siblings: in-flight dedupe). The scope is an
`AsyncLocalStorage` opened by `runWithProviderReadScope(fn)`; **outside a scope
nothing is memoized**, so the webhook and checkout keep reading live.
`readCharge` inside a scope costs 1 request instead of `1 + P`. The in-flight
memo stores the promise and **evicts it when it rejects**, so one failed fetch
(a 5xx, a governor fast-fail, an abort) is never served to the next caller in
the scope; only a resolved value stays memoized.

**B2. Row-scoped memo in the sweep.** `runReconciliationSweep` opens one read
scope per row, reset when the row ends. B2 memoizes **only the raw inputs B1
already shares** — the `listCharges` result and the per-authorization charge
records — never a stamped `ProviderRead`. Every `readCharge` / `readAuthorization`
still builds and stamps a fresh `ProviderRead` at call time from those inputs
(costing 1 request for the charge itself, 0 for the records).

Memoizing a `ProviderRead` would break INV:D17 under **nested acts**: inside a
row, the grace check reads the period at `grace-expiry-check.ts:193` and, on
`CHARGED`, calls `settleChargedPeriod` (`:218`), which calls `recordChargeFact`
(`:166`); that service opens its **own** act at its own `clock.now()` and runs
`assertFreshForAct` on a `readCharge` made inside it
(`record-charge-fact.service.ts:131-134`). A read memoized earlier in the row is
stamped before that inner act started, so `assertFreshForAct` would throw and a
GRACE row past its deadline with an approved charge would never leave grace.
AC-26 pins this. The second inventory reader on the same row (comparison then
lost-rejection) still reuses the listing and the records, which is where the
cost was.

After B1 + B2 the common row costs `1 + P + N` (12 months: 15, down from 77). Still
linear in N, so:

**B3. Persisted charge snapshots.** New table `provider_charge_snapshot`
(structural carril: `pnpm db:generate` + `pnpm db:migrate`; no seed data, so no
dual-write). The name avoids `payment.provider_fact_id` and the existing
`recordChargeFact` service, which are a different thing (the ledger's fact of a
collected charge). One row per `(provider, charge_id)` holding the charge's
fields (amounts as integer centavos) and `observed_at`; columns in
[`docs/data-model-and-tests.md`](docs/data-model-and-tests.md).

Written through on **every** live `readCharge` (webhook, sweep, admin) by a
service-core decorator at the composition root
(`createChargeSnapshotRecordingProvider`), never by the adapter
(`packages/payments` stays DB-free). The upsert is ordered:
`ON CONFLICT (provider, charge_id) DO UPDATE … WHERE
provider_charge_snapshot.observed_at <= EXCLUDED.observed_at`, so a slow read
that finishes after a newer one cannot overwrite it.

Whether a snapshot is **closed** is evaluated **at read time**, never persisted:
no `frozen_at` column. Closed means:

- `rejected` and `expires_at` has passed (no more retries can land on that record), or
- `approved` and its `provider_created_at` is older than deadline 18 **as in
  force when the snapshot is read** (`reconciliationWindowSince`,
  `payment-window.ts:20-30`, reads the current deadline values). Persisting the
  verdict would keep an old horizon alive after an owner edits deadline 18.

Closed snapshots are exposed as a distinct type `ClosedChargeSnapshot` — **not**
a `ProviderRead` — through a new port `closedChargeSnapshots.find({ chargeIds })`.
It exposes only immutable fields (`chargeId`, `providerCreatedAt`, `status`,
`amountMinor`, `currency`, `reference`, `authorizationId`). Its **only** consumer
is the period-charges comparison (`period-charges-comparison.ts`, through
`readListedCharges`): amount comparison and ledger presence over historical
charges need nothing else. Every other reader and every check keeps receiving
`ProviderRead`s.

`readPeriodCharges` decides from the **latest** charge. Today it reads every
listed charge live and sorts the reads by `createdAt`
(`read-period-charges.ts:76-78`). With B3 the latest is defined by
`createdAt` across the closed snapshots and the live reads of the charges
without one; that latest charge is then **re-read live even if its snapshot is
closed**, and only that live `ProviderRead` reaches the decision.

The type split keeps INV:D17 honest, and the plan updates the docblock that
states it (`provider-read.ts:5-7`, "`ProviderRead<T>` is the ONLY way a decision
receives the provider's state") to name `ClosedChargeSnapshot` as the one
non-decision exception and its single consumer. AC-13's guard is type-based
(§9).

**B4. Unchanged-inventory skip.** Per authorization, store the inventory
fingerprint `(chargeRecordCount, lastChargedAt, chargeIds)` after a complete
live listing. When the row's fresh `readAuthorization` reports the same
`chargeRecordCount` and `lastChargedAt`, and every stored id is closed, the
listing is skipped and the inventory is served from snapshots. Any null, mismatch or
open charge → full live listing (fail toward reading). **Deferred** (OQ-6
decided): this spec ships B1–B3 only. A sandbox measurement task (T-B4-GATE,
§11) checks whether `summarized.charged_quantity` / `last_charged_date` move on
every record change, including a retried rejected record; B4 is built in a
follow-up only if they do.

Steady-state cost per common row with B1–B3: `1` (`readAuthorization`) + `P`
(listing) + `1` (latest charge, live). A day with a new charge costs the same.
That is G-4; B4 would take it to ≤ 2. The bound holds only while **deadline 18
is shorter than the charge cadence** (monthly today): then at most the latest
charge is younger than the horizon. A deadline 18 longer than a month leaves
more than one approved charge open and adds one live read per extra open charge.

**Creations sweep memory.** New table `creation_sweep_attempt` (docs). A
pending row gets a `next_search_at` and is not searched before it: +5 min, then
+15 min, then every 60 min until its window closes, jittered (OQ-7 decided); a
new create key resets the cadence. Searches are batched by payer email: a run
groups its due rows by email and issues one `searchAuthorizations({ payerEmail })`
per email.

### 6.3 C — Schedule

**Stagger.** Move MP-calling crons off shared minutes (manifest +
`*.job.ts` together; the manifest-sync test enforces it):

| Job | Today | Proposed |
|---|---|---|
| `billing-reconciliation-sweep` | `0 6 * * *` | `10 2,3,4 * * *` (three slices, §6.5) |
| `billing-creations-sweep` | `*/5` | `1-59/5` |
| `subscription-window-expiry` | `*/15` | `7-59/15` |
| `subscription-service-end` | `*/15` | `12-59/15` |
| `payment-window-expiry` | `20 * * * *` | `23 * * * *` |

No two MP-calling jobs then share a minute, and none starts at :00.

**One execution path: `runCronJob`.** Today the scheduled tick
(`cron/bootstrap.ts`) and the manual trigger (`routes/cron-admin/index.ts`) run a
handler through two separate code paths. The manual one has its own race with a
30 s default (`job.timeoutMs ?? 30000`, `cron-admin/index.ts:216-225`), no
signal, no traffic class and no lock. This spec extracts a shared
`runCronJob({ job, executionMode, dryRun, … })` that both call: traffic class
`background`, `withCronLock`, `ctx.signal` with the job's budget, the safety-net
race, `recordCronRun`, Sentry and Healthchecks signalling. The manual trigger
becomes **asynchronous** for jobs flagged `exclusive`: it answers `202` with the
`runId` once the lock is taken (or `409` with the holder's `runId` on overlap),
and the run is followed through `cron_runs`. For the reconciliation sweep it
accepts `?newCycle=true` (§6.5), which opens a fresh cycle instead of resuming or
skipping today's — the staging smoke needs this, because step 1 of the sweep
section of `docs/billing/smoke-checklist.md` (line 84, "Run the
`billing-reconciliation-sweep` cron on `staging`") would otherwise hit
`SKIPPED_CYCLE_DONE` after the night's cycle. PR-5 updates that step to name the
flag and to read the result from `cron_runs` instead of the HTTP response.

**No-overlap lock (G-5).** `runCronJob` wraps every MP-calling job (flag
`exclusive: true` on `CronJobDefinition`) in `withCronLock`: a Postgres
**session** advisory lock (`pg_try_advisory_lock(hashtext('cron:' || name))`) on a
dedicated pooled connection, released when the **handler promise settles** — not
when the timeout fires. A tick that cannot take the lock does not run and is
recorded in `cron_runs` with the existing `success` status and
`details.skipped = 'overlap'` — **not** a new status value: `recordCronRun`
derives the status from five fixed cases (`record-run.ts:28-33`) and the cron
models filter on the existing values (`cronRun.model.ts:41,127,155-159`), so a
sixth value would trip frozen guards and silently drop out of those queries.
This also removes duplicate runs across two containers during a rollout.
`noOverlap: true` is added to the node-cron options as the in-process first line.
The lock is a cost control, not a correctness boundary (R-6); the sweep adds its
own lease (§6.5).

**Cooperative timeout.** `CronJobContext` gains `signal: AbortSignal` and
`deadlineAt`. A job flagged `exclusive` stops **on its own budget**, set below
`timeoutMs` (the sweep: 45 of 50 min), checking `signal.aborted` between rows,
and returns `success: true` with `details.stoppedOnBudget = true` (the sweep
records `TIMED_OUT` on its run row). Stopping on budget is the normal path, not a
fault: today a timeout throws into the bootstrap's catch, which captures a
`cron_failure` in Sentry, records a failed run and pings Healthchecks `/fail`
(`bootstrap.ts:258-288`); a nightly slice that legitimately runs out of budget
must page nobody. The `timeoutMs` race stays only as a **safety net** for a
handler that ignores its signal, and the governor's `acquire` rejects on abort.
The lock stays held until the handler actually returns. The creations sweep
gets the same treatment.

**Slicing the daily sweep.** Decided (OQ-4 option 2): a resumable nightly
cycle, §6.5.

### 6.4 Observability (G-6)

In-process counters per `trafficClass` × `capability`, flushed every 60 s as one
structured log `mp_traffic_window` via `@repo/logger`:

- `requests`, `status2xx`, `status429`, `status5xx`, `networkErrors`;
- `waitMs` p50 / p95 / max, `fastFailures` (interactive rejected by cool-down);
- `coolDowns` opened, `coolDownMs` total, `unclassified` requests;
- `memoHits` (B1/B2) and `snapshotHits` (B3/B4);
- `redisFallbacks` (reads served by the in-process cool-down).

Every cron run's `details` gains `providerTraffic` (the same counters scoped to
the run), persisted by `recordCronRun`, so per-run cost is queryable in
`cron_runs`. A 429 in the **interactive** class logs at `warn` with
`capture: true` (Sentry); background 429s only count.

**Decision rule for D:** if over 7 days after full rollout `status429 > 0` in
the interactive class, or background 429s exceed 1% of background requests, open
D.

### 6.5 Resumable nightly sweep cycle (OQ-4, OQ-8, G-7)

Owner decisions 2026-11-02 (OQ-4: several short slices across the night; OQ-8:
progress is a per-row `last_swept_at`, not a cursor). Algorithm, columns and
failure cases: [`docs/sweep-slicing.md`](docs/sweep-slicing.md).

**Shape.** `billing-reconciliation-sweep` fires at `02:10`, `03:10` and `04:10`
(market time zone), 50-min timeout and a 45-min own budget each (§6.3). Each
firing is a **slice** of one **cycle**; a cycle is identified by `cycle_id` and
starts at `cycle_started_at` (slice 0's start). The manual trigger with
`?newCycle=true` opens a fresh cycle.

**Progress lives on the row.** New nullable column
`subscription.last_swept_at`. Every page of the main loop takes the inventory
(today's filter, `reconciliation-inventory.model.ts:116-125`) restricted to
`last_swept_at IS NULL OR last_swept_at < cycle_started_at`, ordered
`last_swept_at ASC NULLS FIRST, id`. When a row finishes — success or row
failure — it is stamped `last_swept_at = now()` and leaves the cycle's set. So:

- a row is read once per cycle; a row interrupted mid-flight is unstamped and is
  simply read again (replay is safe, below);
- rows created during the cycle (`NULL`) are read in the same cycle, first;
- rows an incomplete cycle did not reach carry the oldest stamps, so the next
  cycle reads them first — fairness needs no wrap logic;
- the rows phase is complete exactly when the query returns nothing
  (`rows_complete`), so coverage holds by construction.

The stamp writes only `last_swept_at` (never `updated_at`, which means "last
business change") in a short transaction of its own, after the row's act.

**Lease.** A free advisory lock does not prove its holder is dead (it dies with
its connection, R-6). Each slice's run row carries `lease_until`, extended to
`now + 5 min` in the same transaction as every stamp: `UPDATE
reconciliation_sweep_run SET lease_until = …, <counters> WHERE id = :runId AND
outcome IS NULL`; zero rows updated → the stamp is rolled back and the slice
stops. A new slice that finds an open run with a live lease exits with
`details.skipped = 'lease_held'`; with an expired lease it closes that run as
`ABANDONED` (bookkeeping only — there is no position to resume) and proceeds.

**Run row.** `reconciliation_sweep_run` keeps one row per slice and gains the
cycle columns (`cycle_id`, `phase`, `rows_complete`, `passes_completed`,
`lease_until`, `outcome`, …), listed in `docs/sweep-slicing.md` §2.

**Rows read at different hours.** Freshness and deadlines are per row: each row
opens its own act and decides on reads stamped inside it (INV:D17); no check
reads the run's start or counts runs. A row is reached up to ~2 h later than
with one run, and two reads of it are ~22–26 h apart. A replayed row is safe:
marks are find-or-insert under the open-mark unique index
(`open-reconciliation-mark.service.ts:105-147`), collected charges are keyed by
`uq_payment_provider_fact`, undercharge events dedupe by payment id.

**Slice budget or failure.** On its 45-min budget the slice finishes the current
row, records `TIMED_OUT` and returns `success: true` (§6.3): no Sentry capture,
no Healthchecks `/fail`, no failed `cron_runs` entry. A thrown fault closes the
run as `FAILED` in a `finally`. Row failures never stop the cycle.

**Post-loop passes.** After the rows (`phase = PASSES`), in today's order:
our-cancellation retry (unconfirmed), terminal return, credited payments, paid
orders, mark escalation, pause gifts, zero-call checks. Each finished pass is
appended to `passes_completed`; an interrupted one restarts from its beginning
in the next slice (each is idempotent over state). In the **last slot**, the row
loop stops when the remaining budget falls below a **pass reserve** (15 min, a
code constant sized in PR-5), with `rows_complete = false`, so every pass runs
every night. The per-row cancellation retry of live `CANCEL_SCHEDULED` rows
stays inside the row loop.

**End-of-cycle summary.** The slice that reaches `DONE` sums the cycle's slices,
emits the HOS-1885 failure alert once per cycle, sends the liveness ping only
when the cycle had zero failed rows and `rows_complete`, and returns
`details.cycle`. Earlier slices return `success: true` unless they faulted.
If the last slot ends without `DONE`, or with `rows_complete = false`, it logs
"reconciliation cycle incomplete" at error level with `capture: true` and
returns `success: false` — the one deliberate page of the night; the next cycle
picks the unread rows first. A cycle that needs the last slot logs `warn` "near
capacity", the trigger to add slots or revisit D.

**Monitors.** The Sentry monitor (`apps/api/src/utils/cron-monitor-ping.ts:10`,
today an interval of 1 day with a 120-min margin) becomes a crontab monitor
`10 2 * * *`, timezone `America/Argentina/Buenos_Aires` (the jobs' zone,
`cron/bootstrap.ts:41`), 170-min margin. The Healthchecks check
`<env>-billing-reconciliation-sweep` is pinged on every tick
(`bootstrap.ts:181,206-211`), so its schedule becomes `10 2,3,4 * * *` in the
same zone with a 1-hour grace, set by hand in the Healthchecks UI.

**Docs updated with PR-5:** `apps/api/docs/cron-system.md` (lines 268 and 907),
`docs/guides/sentry-alerts.md:161`, `scripts/cutover/README.md:632-638` and
`docs/billing/smoke-checklist.md:84`.

## 7. Data model / contracts

- **Migrations (carril 1, expand-only):** `provider_charge_snapshot`,
  `creation_sweep_attempt`, and the cycle columns on `reconciliation_sweep_run`
  (§6.5), and `subscription.last_swept_at timestamptz NULL` with the index
  `idx_subscription_last_swept_at (last_swept_at ASC NULLS FIRST, id)`, which
  matches the slice query's order so a page is an index-ordered scan filtered by
  the inventory predicate. All additions are nullable with no default and no
  backfill: `NULL` already means "never swept", so the first cycle reads every
  row. `subscription` is small (about 13 live subscriptions today), so a plain
  `CREATE INDEX` from `pnpm db:generate` takes its lock for milliseconds; if the
  table has grown past ~100k rows when PR-5 ships, the migration uses
  `CREATE INDEX CONCURRENTLY` instead. The B4 fingerprint is not part of this
  spec (OQ-6).
- **Env vars:** `HOSPEDA_MERCADO_PAGO_GOVERNOR_MODE` (`off|observe|enforce`,
  default `observe`). Rate / burst / reserve are code constants (OQ-3). Full
  workflow for the one env var: registry in
  `packages/config`, Zod in `apps/api/src/utils/env.ts`, `.env.example`, set in
  Coolify for staging and prod.
- **Contracts:** `MercadoPagoPaymentProvider` options gain `governor`.
  `PaymentProvider` is **unchanged** (the fake needs no change for A).
  `PaymentProviderError` gains `governorRejected?: true`. New ports:
  `ClosedChargeSnapshots`, `ChargeSnapshotRecorder`. `CronJobContext` gains
  `signal` and `deadlineAt`; `CronJobDefinition` gains `exclusive`. New shared
  `runCronJob` (§6.3). The manual trigger answers `202 { runId }` / `409 {
  runId }` for `exclusive` jobs and accepts `?newCycle=true` for the sweep.
  `processProviderNotice`'s result (`{ ack, outcome }`) gains an optional `retryAfterSeconds`, set with `DEFERRED`.
- **Fake server:** `startFakeProviderServer` gains a `throttle` option
  (`{ afterRequests | everyNth | paths, status: 429, retryAfter }`) so tests can
  drive 429s over real HTTP.

## 8. UX / UI behavior

None when MP is healthy; under a long cool-down, checkout shows the existing
retryable error (HOS-1968).

## 9. Acceptance criteria

IDs are stable. AC-26 onwards came from the 2026-11-02 design review and sit
under their topic, so numbers are not consecutive within a section.

### Governor (A)

- **AC-1** Given the bucket is empty and a background request is waiting, when an
  interactive request arrives and one token refills, then the interactive request
  gets it first.
- **AC-2** Given the bucket holds exactly the interactive reserve, when a
  background request asks for a token, then it waits; when an interactive request
  asks, then it proceeds immediately.
- **AC-3** Given one request receives 429 with `Retry-After: 7`, when any other
  request of either class asks within 7 s, then no HTTP request leaves the
  process before the cool-down ends (background waits; interactive with
  `maxWaitMs < remaining` fails fast with `transient.kind = 'RATE_LIMITED'`).
- **AC-4** Given a 429 without `Retry-After`, then consecutive cool-downs grow
  2 s, 4 s, 8 s … capped at 60 s, each jittered within [50%, 100%], and a 2xx
  resets the sequence.
- **AC-5** Given the sweep reads a charge while MP answers 429 to every request,
  then at most 3 HTTP requests are issued for that read (L1 only), and L2 does not
  retry it.
- **AC-6** Given OQ-1 option 2, when container A receives a 429, then container B
  sends no request to MP later than 250 ms after A's 429 (the read-cache
  tolerance) until the shared cool-down ends. Given Redis is unreachable or
  answers slower than 50 ms, then both keep working with in-process cool-downs,
  no `acquire` waits more than 50 ms on Redis, one warning is logged per outage,
  and when Redis comes back the shared cool-down is used again without a
  restart.
- **AC-7** Given mode `observe`, then no request ever waits and the window log
  reports the waits it would have imposed. Given `off`, the governor is not
  consulted.
- **AC-8** Given a request with no traffic class, then it is served as
  interactive and counted as `unclassified`.
- **AC-27** Given `enforce` and an interactive read rejected by the governor
  (`governorRejected`), then L1 rethrows it at once: zero HTTP requests and no
  retry. Given `enforce` and a 429 with `Retry-After: 30` on a background read,
  then L1 does not sleep before its next attempt, that attempt's `acquire` waits
  the cool-down, and the read is not abandoned by L1's 4000 ms budget.
- **AC-28** Given mode `off` or `observe`, then L1 and L2 issue exactly the
  requests, delays and retries they issue today (attempt counts, 2 s
  `Retry-After` cap, `minIntervalMs`), pinned by a parity test against the
  legacy behaviour.
- **AC-29** Given a webhook whose read is rejected with `RATE_LIMITED` (governor
  fast-fail or real 429) while the shared cool-down has 37 s left, then the
  outcome is `DEFERRED` with `retryAfterSeconds = 37` and the route answers `503`
  with `Retry-After: 37`. An incomplete read keeps today's `DEFERRED`.
- **AC-33** Given the production source, then every caller of
  `defaultPaymentProvider` / `new MercadoPagoPaymentProvider` is on the guard's
  allowlist with its declared class (`app.ts` → per-request middleware,
  `step-3b.compose.ts` → `background`); a new unlisted caller fails the guard.

### Memoization and snapshots (B)

Request-count targets per PR, for an ACTIVE credited row with 12 monthly
records and no new charge since the previous run, counted in the fake server's
request log: **77** before any PR (baseline, unchanged by PR-1 and by PR-3/4/5);
**≤ 15** after PR-2 (B1 + B2: `1 + P + N`); **≤ 4** after PR-6 (B3: `2 + P`).

- **AC-9** (PR-6) Given deadline 18 shorter than the charge cadence (so only the
  latest charge is younger than the horizon) and the row above, when the sweep
  processes it, then it issues at most 4 HTTP requests to MP. Given deadline 18
  longer than the cadence, then each extra open approved charge adds exactly one
  request.
- **AC-10** (PR-6) Given the same row with 36 records, then the request count
  exceeds the 12-record count only by the extra listing pages (2).
- **AC-11** Given a webhook for a charge, then `readCharge` reads live (no memo)
  and upserts its `provider_charge_snapshot` row; given an older read finishing
  after a newer one, then the newer `observed_at` row is kept.
- **AC-12** Given a closed approved snapshot and a later refund webhook, then
  the snapshot is rewritten from the live read and the next sweep's comparison
  sees the refund.
- **AC-13** Given any check, then it receives provider state only as a
  `ProviderRead` stamped after its act started (INV:D17). `ClosedChargeSnapshot`
  reaches only the period-charges comparison, enforced by type tests
  (`expectTypeOf` on every check's port and on `readPeriodCharges`'s input) plus a
  guard with a single-consumer allowlist for `closedChargeSnapshots.find` — not a
  text grep.
- **AC-26** Given B2 on, a GRACE row past its deadline and an approved charge for
  the period, when the sweep processes it, then the grace check settles the
  period through `recordChargeFact`, the row leaves grace, and no
  `assertFreshForAct` error is raised (nested act, §6.2).
- **AC-30** Given deadline 18 edited to a longer value, when a snapshot that was
  closed under the old value is read, then it is treated as open and read live
  (closedness is evaluated at read time).
- **AC-31** Given the latest listed charge has a closed snapshot, then
  `readPeriodCharges` still reads it live and decides from that live read; the
  latest is chosen by `createdAt` across snapshots and live reads.
- **AC-35** Given a fetch in one read scope that rejects, then the callers
  already awaiting it receive the rejection, the promise is evicted, and the next
  caller in the scope issues a new request.
- **AC-14** Given two due pending creations sharing a payer email, then one run
  issues one search; given a pending row created at T, then it is searched no
  earlier than T+5 min, then T+20 min, then at most every 60 min (each slot
  jittered), and a new create key restarts that sequence.

### Schedule (C)

- **AC-15** Given a sweep run still in progress after its timeout, when the next
  tick fires (same or other container), then the tick does not run, its
  `cron_runs` row has the existing status `success` with `details.skipped =
  'overlap'` (no new status value), and the lock is released only when the first
  handler returns.
- **AC-16** Given the timeout fires, then `ctx.signal` is aborted and the sweep
  stops before starting another row, reporting `complete: false`.
- **AC-17** Given the manifest, then no two MP-calling jobs share a minute and
  none runs at minute 0.
- **AC-32** Given a manual trigger of an `exclusive` job, then it runs through
  the same `runCronJob` as the scheduled tick (class `background`, lock, signal,
  the job's own budget, no 30 s race), answers `202 { runId }` without waiting
  for the handler, answers `409 { runId }` when the lock is held, and for the
  sweep with `?newCycle=true` opens a new cycle even when today's is `DONE`.

### Observability

- **AC-18** Every 60 s with traffic, one `mp_traffic_window` log per class carries
  the counters of §6.4; every MP-calling cron run's `details.providerTraffic` is
  persisted in `cron_runs`.

### Resumable sweep cycle (C, OQ-4, OQ-8)

- **AC-19** Given an inventory of 300 never-swept rows and a slice budget that
  covers 120, when the three slots run, then every row is read exactly once in
  the cycle, every row ends with `last_swept_at ≥ cycle_started_at`, and the
  third slice reaches `DONE`.
- **AC-20** Given a slice that reaches its own 45-min budget mid-loop, then the
  row in progress finishes and is stamped, the run is `TIMED_OUT`, the job
  returns `success: true`, there is **no** `Sentry.captureException`, **no**
  Healthchecks `/fail` ping and no failed `cron_runs` entry, and the next slice
  reads only rows not yet stamped in this cycle.
- **AC-21** Given a slice whose process dies after row K started, when the next
  slot fires after its `lease_until` has passed, then that slice closes the open
  run as `ABANDONED`, reads row K again (it was never stamped), and re-reading
  row K opens no second mark.
- **AC-36** Given an open run whose lock is free but whose `lease_until` is still
  in the future, then the new slice does not close it and exits with
  `details.skipped = 'lease_held'`. Given a run closed as `ABANDONED` whose
  original slice is still alive, then that slice's next stamp transaction updates
  zero run rows, rolls back the stamp, and the slice stops.
- **AC-22** Given the rows are exhausted mid-slice, then the passes run in the
  fixed order; given the signal aborts during the credited-payments pass, then
  `passes_completed` lists only the earlier passes and the next slice starts the
  credited-payments pass from its beginning.
- **AC-34** Given rows that would consume the whole last slot, then the row loop
  stops when the remaining budget falls below the pass reserve, `rows_complete`
  is `false`, every pass runs and is listed in `passes_completed`, and the cycle
  is reported incomplete (AC-25) rather than skipping the passes.
- **AC-23** Given a cycle already `DONE`, when another slot or a manual trigger
  without `newCycle` fires the same day, then the slice records
  `SKIPPED_CYCLE_DONE` and makes no provider call.
- **AC-24** Given a cycle with failed rows in slices 0 and 2, then exactly one
  failure alert carries the failed ids of both, no liveness ping is sent, and
  earlier slices reported `success: true`; the failed rows are stamped and not
  retried within the cycle.
- **AC-25** Given the last slot ends with `rows_complete = false`, then an
  "incomplete" error is captured, and the next night's cycle reads the rows that
  were not reached (oldest `last_swept_at`) before the rows that were.
- **AC-37** Given a row that enters the inventory during a cycle (`last_swept_at`
  `NULL`), then the same cycle reads it before any previously swept row it has
  not reached yet.

## 10. Test strategy

Mutation-sensitive by design: every test names the mutation it must kill, and
the implementer records the mutation run on the PR (a survivor blocks merge).
Full matrix (43 tests, 11 of them for the resumable cycle) in
[`docs/data-model-and-tests.md`](docs/data-model-and-tests.md). The cycle tests
drive slices with an injected clock and signal against a real DB, and assert on
`reconciliation_sweep_run` rows plus the fake server's request log. The
load-bearing ones for A and B:

- **The governor actually blocks** — fake clock, R=1, B=1: a third `acquire`
  resolves only after the clock advances; kills "`acquire` returns without
  awaiting the refill".
- **Priorities are honoured** — background enqueued first, interactive second,
  one token refilled: interactive resolves first; kills "FIFO across classes".
- **Memoization reduces the call count** — ACTIVE credited row with 12 records
  against the fake HTTP server: `requests().length` goes from the measured
  baseline (77) to ≤ 15 after PR-2 and ≤ 4 after PR-6 in steady state; kills
  "B1 scope or B2 memo bypassed" and "snapshots not consulted".
- **The memo does not break nested acts** (AC-26) — GRACE row past its deadline
  with an approved charge, B2 on: the row leaves grace; kills "B2 memoizes a
  stamped `ProviderRead`".

The fake server gains a throttle mode (§7) so 429 paths run over real HTTP.
Assertions count **HTTP requests seen by the fake server**, never provider method
calls (the point of A is the wire). Integration suites run per file, never the
full package suite locally.

## 11. Rollout plan

PRs to `staging`, in order; each independently revertible.

Each PR states its request-count target for the 12-record row of §9 and proves
it against the fake server's log.

1. **PR-1 Observability + governor in `observe`** (A without blocking) and the
   fake-server throttle, plus the class-propagation guard (AC-33). Ship, collect
   a week of `mp_traffic_window` baseline (this is the "before" for G-4 and the
   evidence to retune OQ-3's constants). Target: **77, unchanged**.
2. **PR-2 B1 + B2** (no schema), including the nested-act test (AC-26) and the
   rejected-promise eviction (AC-35). Target: **≤ 15**.
3. **PR-3 Governor `enforce` + retry rework** (L1/L2/L3 changes, gated by mode,
   with the legacy parity test, AC-28), the dedicated Redis client for the
   shared cool-down (OQ-1) and the webhook `DEFERRED` mapping (AC-29). Staging
   smoke under induced 429s (fake throttle in local; real sandbox in staging).
   Target: **≤ 15** steady; **≤ 3 per read** under 429s.
4. **PR-4 C, scheduling**: shared `runCronJob` (async manual trigger), stagger
   of the other four jobs, `withCronLock`, `ctx.signal` + own budget, creations
   backoff + table (OQ-7: 5 → 15 → 60 min, batched by email). The sweep keeps
   its single run, moved to
   `10 2 * * *`, so PR-5 starts from a locked, cancellable job; the Sentry
   monitor, the Healthchecks check and the docs of §6.5 move to `10 2 * * *`
   here. Target: **≤ 15**, unchanged.
5. **PR-5 Resumable sweep cycle** (§6.5): `subscription.last_swept_at` and its
   index, run columns, lease, slice algorithm, pass reserve and bookkeeping, cycle summary, monitors
   and docs moved to `10 2,3,4`, `?newCycle=true` and the smoke-checklist step.
   Staging smoke: force a small slice budget so one cycle spans the three slots,
   kill one slice mid-run, and check the cycle summary. Target: **≤ 15**,
   unchanged.
6. **PR-6 B3** — `provider_charge_snapshot`, ordered write-through, readers,
   read-time closedness (OQ-2), the `provider-read.ts` docblock and the type
   guard (AC-13). Target: **≤ 4** (AC-9, given deadline 18 < cadence).

**T-B4-GATE** (no code, runs in parallel with PR-1): on the MP sandbox, retry a
rejected cycle on one record and record whether `summarized.charged_quantity`
and `last_charged_date` move. The result is posted on HOS-1999; B4 is opened as a
follow-up only if both move on every record change.

Each env var change is set in Coolify per environment before the PR that reads it
deploys. Rollback: `GOVERNOR_MODE=off` (A), revert PR (B/C; migrations are
expand-only so a revert leaves harmless tables).

## 12. Risks

- **R-1 Webhook latency budget.** A webhook that waits for tokens can exceed MP's
  delivery timeout and be retried anyway. Mitigation: interactive `maxWaitMs`
  2 s and fail-fast to `DEFERRED` with the remaining cool-down as `Retry-After`
  (§6.1, AC-29); B1 does not apply to it, but its `readCharge` still costs
  `1 + P` — acceptable, and measured by §6.4.
- **R-2 Checkout latency.** A burst of background traffic must not delay an
  `authorize`. Mitigation: priority + reserve (AC-1, AC-2); the reserve is sized
  so a checkout never waits for a background refill.
- **R-3 Stale snapshot.** A closed snapshot may miss a later refund or
  chargeback. Mitigation: snapshots close only past deadline 18 as in force at
  read time; every webhook rewrites them (ordered upsert); the credited-payments
  check keeps reading live inside its window; the latest charge is always read
  live; only the period-charges comparison consumes snapshots (AC-13).
- **R-4 Background starvation.** Sustained interactive load could starve a
  slice. Mitigation: the slice stops on its budget and the next slot continues
  with the unstamped rows; the passes keep a reserve in the last slot (AC-34);
  an unfinished cycle is captured and the next one reads the unreached rows
  first (§6.5).
- **R-5 Wrong default limits.** Without E we guess `R`. Too low slows the sweep;
  too high keeps 429s. Mitigation: a week in `observe` first; the constants
  (OQ-3) are retuned in a PR once that baseline or E is in.
- **R-6 Advisory lock on a dropped connection.** The lock is released if the
  dedicated connection drops, allowing a second run. The lock is a cost control;
  the sweep does not trust it to decide that a holder is dead and uses its lease
  instead (§6.5, AC-36). PR-4 verifies, job by job, that a concurrent second run
  of the other jobs is safe (today nothing prevents it, so this is no worse than
  the baseline).
- **R-7 Redis as a new dependency of the MP path.** Mitigation: a dedicated
  client that never blocks `acquire` on its connection, a 50 ms bound on every
  read, one write per 429, a cached read (≤ 250 ms) otherwise, fail-open to
  in-process, and self-recovery after an outage (AC-6).
- **R-8 B4 fingerprint false "unchanged".** If MP changed a record without moving
  `chargeRecordCount`/`lastChargedAt`, the skip would miss it. Mitigation: any
  open charge forces a listing; B4 is deferred (OQ-6) until T-B4-GATE measures
  exactly this.
- **R-9 Cycle bookkeeping bugs.** A stamp written before the row finishes would
  skip a row on a crash; a stamp never written would re-read rows every slice.
  Mitigation: the stamp is written only after the row's act, in the lease
  transaction; `rows_complete` is "the query returned nothing", so coverage needs
  no counter; AC-19 to AC-25, AC-34, AC-36 and AC-37. A stray write of
  `last_swept_at` outside the sweep is caught by a static guard (one writer).
- **R-10 A row reached later in the night.** Up to ~2 h later than slice 0, so a
  grace that expired overnight is taken a little later than with one run.
  Accepted by the owner's decision; all deadlines are day-granular. Ordering by
  the previous stamp keeps a row's position roughly stable night to night, so
  its read hour does not drift.
- **R-11 The kill switch must revert behaviour, not just the bucket.** If PR-3's
  retry changes ran regardless of mode, `off` would leave L1 without its delay
  and L2 without `RATE_LIMITED` retries and no governor wait to replace them.
  Mitigation: every new L1/L2 path is gated on `enforce`, pinned by AC-28.

## 13. Implementation notes

- Billing CORE: staging smoke (checkout, webhook, sweep sections of the SPEC-143
  checklist) for PR-3/4/5/6 and prod smoke after promotion (`smokeGates` above).
- Run `pnpm check:guards` before each PR. Out of scope, named: **D** (NG-1),
  **E** (NG-2).

## 14. Decisions

The owner answered every open question on **2026-11-02**: OQ-1…OQ-6 first,
then OQ-7 and OQ-8, which came out of the design review the same day. The
options are kept as the record of what was weighed; **✅ Chosen** marks the
decision.

**OQ-1 · Cross-container coordination scope.** During a rollout two containers
call MP at once; Redis is available.

1. *In-process only.* Pros: no new dependency on the MP path, simplest. Cons: a
   429 in one container does not pause the other; two buckets double the rate
   during rollouts. Impact: none beyond A.
2. **✅ Chosen (2026-11-02).** *In-process bucket + Redis-shared cool-down.*
   Pros: the signal that matters (MP said stop) reaches every container; one
   Redis write per 429, fail-open; duplicate cron runs are removed by C's lock
   anyway. Cons: bucket rate doubles during the minutes of a rollout. Impact:
   small Redis helper in `apps/api`.
3. *Fully Redis-backed bucket (Lua) + cool-down.* Pros: exact global rate. Cons:
   a Redis round-trip on every MP request, including checkout; more code; must
   fail open anyway. Impact: Redis on the hot path.

It was the recommended option. Move to 3 only if E reveals a tight per-second
limit.

**OQ-2 · Approved charge freeze horizon.** How long an approved charge is
re-read live before its fact is treated as closed.

1. *Never freeze approved; only rejected-and-expired.* Pros: zero staleness risk.
   Cons: cost stays linear in tenure (one live read per approved charge per day);
   G-4 is not met. Impact: B3 helps rejected history only.
2. **✅ Chosen (2026-11-02).** *Freeze after the credited-payments window
   (deadline 18).* Pros: G-4 met; the credited-payments check already re-reads
   live inside that window, and every refund/chargeback webhook rewrites the
   fact. Cons: a refund or chargeback whose webhook is lost after the window is
   only seen if MP re-sends it. Impact: as designed (§6.2).
3. *Freeze after a fixed 180 days (chargeback horizon).* Pros: covers late
   chargebacks without trusting webhooks. Cons: six months of linear cost per
   subscription; G-4 met only for older history. Impact: same code, other constant.

It was the recommended option. Review note (2026-11-02): the "fact" is now a
*snapshot* (`provider_charge_snapshot`), and "frozen" is evaluated at read time
against deadline 18 as currently in force, never persisted (§6.2).

**OQ-3 · Governor limit values.** MP has not published our limits (E is pending).

1. **✅ Chosen (2026-11-02).** *Code constants* (`R=5/s`, `B=10`, reserve 20%).
   Pros: no env vars, reviewed in PRs. Cons: retuning needs a deploy. Impact:
   none. The mode kill switch stays an env var.
2. *Env vars with those defaults* (`…_RATE_PER_SECOND`, `…_BURST`,
   `…_INTERACTIVE_RESERVE`). Pros: retune from Coolify in minutes after E answers
   or during an incident. Cons: three more registry entries; a redeploy is still
   needed to apply them. Impact: env workflow ×3.

It was the recommended option; the owner did not object. Revisit after E.

**OQ-4 · Daily sweep time and slicing.**

1. *One run at 03:10, no slicing; alert when projected duration > 50% of
   timeout.* Pros: simplest; lowest checkout traffic. Cons: slicing is built
   later, under pressure, if volume jumps. Impact: one schedule change.
2. **✅ Chosen (2026-11-02).** *Resumable cursor: several short runs across the
   night (02:10, 03:10, 04:10) continuing from the last processed id.* Pros:
   bounded run length at any volume. Cons: a row may be read at different hours;
   more state in `reconciliation_sweep_run`. Impact: sweep service + run model,
   designed in §6.5 and [`docs/sweep-slicing.md`](docs/sweep-slicing.md),
   shipped as PR-5.
3. *Keep 06:00.* Pros: no change in when marks appear. Cons: overlaps morning
   traffic. Impact: none.

Option 1 was recommended; the owner chose 2, trading more state for a run
length that stays bounded as volume grows. How progress is tracked (cursor vs
per-row stamp) was settled later by OQ-8.

**OQ-5 · Interactive behaviour under a cool-down.**

1. **✅ Chosen (2026-11-02).** *Fail fast after 2 s* (webhook defers with 503,
   checkout shows retry). Pros: predictable latency; MP redelivers webhooks.
   Cons: a customer may retry checkout by hand. Impact: as designed (§6.1).
2. *Wait the whole cool-down (up to 120 s).* Pros: fewer visible errors. Cons:
   webhook deliveries time out at MP anyway; checkout hangs. Impact: larger
   timeouts.

It was the recommended option; the owner did not object.

**OQ-6 · Ship the unchanged-inventory skip (B4) now.**

1. *Yes.* Pros: meets G-4 fully (≤ 2 requests per steady row). Cons: relies on
   `charged_quantity`/`last_charged_date` moving with every record change (R-8);
   that has not been measured against MP. Impact: one more table/columns.
2. **✅ Chosen (2026-11-02).** *No; ship B1–B3, measure with §6.4, and gate B4
   on a sandbox measurement task* (T-B4-GATE, §11). Pros: no unmeasured
   assumption. Cons: steady rows cost `2 + P` (3–6 requests), still slightly
   tenure-dependent. Impact: B4 becomes a follow-up issue if the gate passes.

It was the recommended option.

**OQ-7 · Creations-sweep search cadence.** How often a pending creation is
searched by payer email once the per-row memory exists (§6.2). Today every
pending row is searched every 5 minutes.

1. **✅ Chosen (2026-11-02).** *Back-off, batched by email.* The owner set the
   cadence to **+5 min → +15 min → every 60 min** until the window closes
   (jittered), with one search per payer email per run. Pros: most searches fall
   early, when a checkout usually lands; cost per row drops from ~12/h to ~1/h
   after the first 20 min. Cons: a creation that lands late is seen up to an hour
   later (the webhook normally reports it first). Impact: as in §6.2.
2. *Fixed 15 min.* Pros: simple; 3× fewer searches than today. Cons: still ~4/h
   per row for the whole window. Impact: one constant.
3. *Keep 5 min, add only the per-email memo.* Pros: no change in detection
   latency. Cons: cost stays proportional to pending rows × window length.
   Impact: the `creation_sweep_attempt` table is not needed.

It was the recommended option; the owner shortened its ramp (the review draft
had +5, +10, +20, +40 min).

**OQ-8 · Cycle bookkeeping: cursor or per-row `last_swept_at`.**

1. *Cursor on the run row*: `cursor_after_id`, wrap-around via an origin id,
   `ABANDONED` resume, a monotonic guard on the cursor `UPDATE`. Pros: no write
   on `subscription`. Cons: the most moving parts in the spec; rows created
   behind the cursor wait for the next cycle. Impact: larger PR-5.
2. **✅ Chosen (2026-11-02).** *Per-row `last_swept_at`.* Slices take
   `last_swept_at < cycle_start ORDER BY last_swept_at NULLS FIRST`, and stamp
   each row when it finishes. Pros: removes the cursor, the wrap and the resume
   logic; fair to new rows (`NULLS FIRST`) and to rows an incomplete cycle missed
   (oldest first); coverage holds by construction. Cons: one indexed write per
   row per night on `subscription`. Impact: §6.5 as written; the lease stays,
   to stop a zombie slice.

It was the recommended option. Placement: the column goes on `subscription`
(not a side table) so one index serves the slice query's order; the stamp writes
only that column, never `updated_at`.

## 15. Linear

Canonical tracking: HOS-1999. Related: HOS-1354 (billing epic), HOS-1968,
HOS-1976, HOS-1991 (E), HOS-1995 (PR #4005).
