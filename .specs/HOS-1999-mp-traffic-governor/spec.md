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
  adapter read scope, persist closed charges, and skip unchanged inventories,
  so a subscription's daily cost no longer grows with tenure.
- **C. Schedule** — stagger the MP-calling crons, add a real no-overlap lock
  (in-process and across containers), make the cron timeout cancel
  cooperatively, and give the creations sweep a per-row backoff.

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
- **G-2** After any 429, every caller in the process (and, per OQ-1, in the
  fleet) pauses for the provider's `Retry-After`; no layer retries into it.
- **G-3** The worst-case HTTP requests caused by one logical read is bounded and
  documented, and retries do not multiply across layers.
- **G-4** The daily sweep cost per subscription is roughly constant in tenure.
  Steady state (no new charge since the last run): ≤ `2 + ceil(N/10)` requests
  per row with B1–B3 (4 at 12 months, 6 at 36, versus 77 and 369 today), and
  ≤ 2 independent of N with B4 (OQ-6).
- **G-5** No two runs of the same MP-calling cron overlap, in one container or
  across two.
- **G-6** We can tell from logs whether 429s persist after A + B + C, which
  decides whether D (§4) is needed.

## 4. Non-goals

- **NG-1 (D) Suspicion-based sweep.** Reading only rows with a reason to be read
  (next charge due, open mark, recent notice). Revisit if G-6 shows 429s after
  this spec ships.
- **NG-2 (E) Asking MP for the account's real limits.** Owner action, together
  with HOS-1991's integrator ID. This spec ships with conservative defaults and
  tunable values (OQ-3); E's answer only retunes them.
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

**Token bucket.** Rate `R` tokens/s, capacity `B`. Defaults are conservative
until E answers (OQ-3): `R = 5/s`, `B = 10`, interactive reserve `20%` of `B`.

**Priorities.** Two FIFO wait queues. A token goes to the interactive queue
first; background is served only when the interactive queue is empty **and**
the bucket holds more than the interactive reserve. Background can never take
the last `reserve` tokens, so an interactive request arriving mid-burst finds a
token immediately.

**Class propagation.** An `AsyncLocalStorage<TrafficClass>` exported by
`packages/payments` (`runWithTrafficClass`). Set once at two composition points,
not per call site:

- the API app middleware sets `interactive` for every HTTP request (covers
  checkout, webhook, user routes, admin);
- `cron/bootstrap.ts` wraps every job handler in `background` (also the manual
  `/admin/cron` trigger path).

A request with no class is treated as `interactive` (fail toward serving a
customer) and counted as `unclassified` (§6.4); a static guard test asserts both
composition points wrap.

**Shared cool-down.** On a 429, `observe` sets `coolDownUntil = now + d`, where
`d = Retry-After + random[0, 1 s]` when present (never shorter than the
provider asked, max 120 s), else `2 s × 2^k × random[0.5, 1.0]` for the k-th
consecutive 429 (max 60 s); random is injectable. While cooling down:

- background waits (its `maxWaitMs` is the job's remaining budget);
- interactive waits only if the cool-down ends within its `maxWaitMs`
  (default 2 s); otherwise it fails fast with the existing transient
  `RATE_LIMITED` error (OQ-5). The webhook turns that into `DEFERRED` →
  `503 + Retry-After` and MP redelivers, so no notice is lost; checkout maps it
  to the existing retryable error (HOS-1968), not a 500. Neither runs inside a
  read scope (§6.2): they always read live and only write facts.

A 2xx resets k. 5xx does not open a cool-down (it is not a quota signal).

**Retry ownership (G-3).**

| Layer | After this spec |
|---|---|
| L1 adapter GET retry (`mercadopago-read-retry.ts`) | Stays the **only** HTTP-level retry. Each attempt acquires a token, so a retry after a 429 waits the shared cool-down instead of its own capped 2 s. Its `Retry-After` cap is removed (the governor owns the wait). The time spent waiting for a token counts against `maxTotalDelayMs` for interactive callers. Jitter added to its backoff. |
| L2 sweep decorator (`sweep-provider-pacing.ts`) | **Stops retrying `RATE_LIMITED`** (L1 + governor already did). Keeps retrying 5xx / network errors, reduced to 2 attempts, honoring `transient.retryAfterSeconds`, with jitter. `minIntervalMs` spacing is removed (the bucket replaces it). |
| L3 cancel retry (HOS-1995, `SWEEP_CANCEL_RETRY`) | Kept: it is the only write retry. Each attempt now acquires a background token, so its 2→10 s backoff can no longer fire inside a cool-down. If #4005 merges first this spec only adjusts its tests; if not, the spec's PR rebases on it. |

Resulting bound: one logical GET causes at most `L1.maxAttempts (3) × L2 attempts
on 5xx only (2) = 6` HTTP requests, and **3** under 429s (down from 15), all
spaced by the shared cool-down.

**Cross-container scope.** OQ-1 decides. Recommended design (OQ-1 option 2):
the bucket stays in-process; the **cool-down is shared through Redis** — a 429
in any container writes `mp:cooldown-until` (`SET … PX`, keep the max), and
`acquire` reads it (cached ≤ 250 ms). If Redis is unreachable the governor
falls back to the in-process cool-down and logs once; it never blocks on Redis.
Duplicate cron runs during a rollout are removed by C's lock, not by the bucket.

**Kill switch.** `HOSPEDA_MERCADO_PAGO_GOVERNOR_MODE = off | observe | enforce`
(new env var, full workflow in §7). `observe` measures and logs as if enforcing
but never waits; it is the first rollout step (§11).

### 6.2 B — Stop re-reading immutable data

Four layers, cheapest first. None changes what a check decides (NG-3).

**B1. Adapter read scope (single-flight records).** Inside one *read scope*,
`readMercadoPagoChargeRecords(authorizationId)` is fetched once and shared by
`listCharges` and every `readCharge` of that authorization (including concurrent
`Promise.all` siblings: in-flight dedupe). The scope is an
`AsyncLocalStorage` opened by `runWithProviderReadScope(fn)`; **outside a scope
nothing is memoized**, so the webhook and checkout keep reading live.
`readCharge` inside a scope costs 1 request instead of `1 + P`.

**B2. Row-scoped memo in the sweep.** `runReconciliationSweep` opens one read
scope per row and wraps the provider in a row memo for `listCharges` and
`readCharge`, reset when the row ends. The second inventory reader on the same
row (comparison then lost-rejection) is free. The memoized values are the same
`ProviderRead`s stamped after this row's act started, so `assertFreshForAct`
still holds (INV:D17 intact).

After B1 + B2 the common row costs `1 + P + N` (12 months: 15, down from 77). Still
linear in N, so:

**B3. Persisted closed charges.** New table `provider_charge_fact`
(structural carril: `pnpm db:generate` + `pnpm db:migrate`; no seed data, so no
dual-write). One row per `(provider, charge_id)` holding the charge snapshot
(amounts as integer centavos), `observed_at` and `frozen_at`; columns in
[`docs/data-model-and-tests.md`](docs/data-model-and-tests.md).

Written through on **every** live `readCharge` (webhook, sweep, admin) by a
service-core decorator at the composition root (`createChargeFactRecordingProvider`),
never by the adapter (`packages/payments` stays DB-free).

A fact is **closed** (`frozen_at` set) when:

- `rejected` and `expires_at` has passed (no more retries can land on that record), or
- `approved` and older than the freeze horizon of OQ-2 (refunds and chargebacks
  arrive by webhook, which re-reads live and rewrites the row).

Closed facts are exposed as a distinct type `ClosedChargeFact` — **not** a
`ProviderRead` — through a new port `closedChargeFacts.find({ chargeIds })`. The
inventory readers use it only for charges that are not the current period's:

- `readListedCharges` / period-charges comparison: closed facts for historical
  charges (amount comparison and ledger presence only need immutable fields);
  live `readCharge` for open ones.
- `readPeriodCharges`: decides from the **latest** charge only, which is always
  read live (it is open by definition until its window passes).

The type split keeps INV:D17 honest: a decision that needs live state cannot
receive a `ClosedChargeFact` without a type change visible in review. OQ-2 is
the owner's call on the approved-charge horizon.

**B4. Unchanged-inventory skip.** Per authorization, store the inventory
fingerprint `(chargeRecordCount, lastChargedAt, chargeIds)` after a complete
live listing. When the row's fresh `readAuthorization` reports the same
`chargeRecordCount` and `lastChargedAt`, and every stored id is closed, the
listing is skipped and the inventory is served from facts. Any null, mismatch or
open charge → full live listing (fail toward reading). OQ-6 decides whether B4
ships in this spec.

Steady-state cost per common row: with B1–B3, `1` (`readAuthorization`) + `P`
(listing) + `1` (latest charge, live); with B4 the listing is skipped, so ≤ 2.
A day with a new charge costs `1 + P + 1` either way. That is G-4.

**Creations sweep memory.** New table `creation_sweep_attempt` (docs). A
pending row is searched at +5, +10, +20, +40 min, then every 60 min until its
window closes (jittered); a new create key resets the cadence. A run memoizes
`searchAuthorizations({ payerEmail })` by email, so rows sharing one email cost
one search.

### 6.3 C — Schedule

**Stagger.** Move MP-calling crons off shared minutes (manifest +
`*.job.ts` together; the manifest-sync test enforces it):

| Job | Today | Proposed |
|---|---|---|
| `billing-reconciliation-sweep` | `0 6 * * *` | `10 3 * * *` (lowest checkout traffic, see OQ-4) |
| `billing-creations-sweep` | `*/5` | `1-59/5` |
| `subscription-window-expiry` | `*/15` | `7-59/15` |
| `subscription-service-end` | `*/15` | `12-59/15` |
| `payment-window-expiry` | `20 * * * *` | `23 * * * *` |

No two MP-calling jobs then share a minute, and none starts at :00.

**No-overlap lock (G-5).** `bootstrap.ts` wraps every MP-calling job (flag
`exclusive: true` on `CronJobDefinition`) in `withCronLock`: a Postgres
**session** advisory lock (`pg_try_advisory_lock(hashtext('cron:' || name))`) on a
dedicated pooled connection, released when the **handler promise settles** — not
when the timeout fires. A tick that cannot take the lock is recorded as
`skipped: overlap` in `cron_runs` and does not run. This also removes duplicate
runs across two containers during a rollout. `noOverlap: true` is added to the
node-cron options as the in-process first line.

**Cooperative timeout.** `CronJobContext` gains `signal: AbortSignal`. The
timeout aborts it instead of only racing; the reconciliation and creations
sweeps check `signal.aborted` between rows and stop cleanly (recording
`complete: false`), and the governor's `acquire` rejects on abort. The race is
kept as the reporting deadline; the lock stays held until the handler actually
returns.

**Slicing the daily sweep.** OQ-4. Recommended: not now. Instead, record the
projected duration (`rows × requests/row ÷ background rate`) in the run summary
and alert when it exceeds 50% of `timeoutMs`; that metric is the trigger to
slice.

### 6.4 Observability (G-6)

In-process counters per `trafficClass` × `capability`, flushed every 60 s as one
structured log `mp_traffic_window` via `@repo/logger`:

- `requests`, `status2xx`, `status429`, `status5xx`, `networkErrors`;
- `waitMs` p50 / p95 / max, `fastFailures` (interactive rejected by cool-down);
- `coolDowns` opened, `coolDownMs` total, `unclassified` requests;
- `memoHits` (B1/B2) and `factHits` (B3/B4).

Every cron run's `details` gains `providerTraffic` (the same counters scoped to
the run), persisted by `recordCronRun`, so per-run cost is queryable in
`cron_runs`. A 429 in the **interactive** class logs at `warn` with
`capture: true` (Sentry); background 429s only count.

**Decision rule for D:** if over 7 days after full rollout `status429 > 0` in
the interactive class, or background 429s exceed 1% of background requests, open
D.

## 7. Data model / contracts

- **Migrations (carril 1):** `provider_charge_fact`, `creation_sweep_attempt`,
  plus the B4 fingerprint (column set on `provider_link` or a small
  `provider_charge_inventory` table — decided in implementation, recorded on the
  Linear issue). Expand-only, nothing dropped.
- **Env vars:** `HOSPEDA_MERCADO_PAGO_GOVERNOR_MODE` (`off|observe|enforce`,
  default `observe`). Rate / burst / reserve per OQ-3. Full workflow: registry in
  `packages/config`, Zod in `apps/api/src/utils/env.ts`, `.env.example`, set in
  Coolify for staging and prod.
- **Contracts:** `MercadoPagoPaymentProvider` options gain `governor`.
  `PaymentProvider` is **unchanged** (the fake needs no change for A). New ports:
  `ClosedChargeFacts`, `ChargeFactRecorder`. `CronJobContext` gains `signal`;
  `CronJobDefinition` gains `exclusive`.
- **Fake server:** `startFakeProviderServer` gains a `throttle` option
  (`{ afterRequests | everyNth | paths, status: 429, retryAfter }`) so tests can
  drive 429s over real HTTP.

## 8. UX / UI behavior

None when MP is healthy; under a long cool-down, checkout shows the existing
retryable error (HOS-1968).

## 9. Acceptance criteria

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
  does not send to MP until the shared cool-down ends; given Redis is down, then
  both keep working with in-process cool-downs and one warning is logged.
- **AC-7** Given mode `observe`, then no request ever waits and the window log
  reports the waits it would have imposed. Given `off`, the governor is not
  consulted.
- **AC-8** Given a request with no traffic class, then it is served as
  interactive and counted as `unclassified`.

### Memoization and facts (B)

- **AC-9** Given an ACTIVE credited row with 12 monthly records and no new charge
  since the previous run, when the sweep processes it, then it issues at most 4
  HTTP requests to MP (measured against the fake server's request log).
- **AC-10** Given the same row with 36 records, then the request count exceeds
  the 12-record count only by the extra listing pages (2), and equals it when B4
  ships.
- **AC-11** Given a webhook for a charge, then `readCharge` reads live (no memo)
  and upserts its `provider_charge_fact` row.
- **AC-12** Given a closed approved fact and a later refund webhook, then the fact
  is rewritten from the live read and the next sweep's comparison sees the refund.
- **AC-13** Given any check that decides from the current period, then it
  receives a `ProviderRead` stamped after its act started (INV:D17), never a
  `ClosedChargeFact` (enforced by types plus a guard test).
- **AC-14** Given two pending creations sharing a payer email, then one run issues
  one search; given a pending row searched at T, then it is not searched again
  before its `next_search_at`.

### Schedule (C)

- **AC-15** Given a sweep run still in progress after its timeout, when the next
  tick fires (same or other container), then the tick is skipped and recorded as
  `overlap`, and the lock is released only when the first handler returns.
- **AC-16** Given the timeout fires, then `ctx.signal` is aborted and the sweep
  stops before starting another row, reporting `complete: false`.
- **AC-17** Given the manifest, then no two MP-calling jobs share a minute and
  none runs at minute 0.

### Observability

- **AC-18** Every 60 s with traffic, one `mp_traffic_window` log per class carries
  the counters of §6.4; every MP-calling cron run's `details.providerTraffic` is
  persisted in `cron_runs`.

## 10. Test strategy

Mutation-sensitive by design: every test names the mutation it must kill, and
the implementer records the mutation run on the PR (a survivor blocks merge).
Full matrix (19 tests) in [`docs/data-model-and-tests.md`](docs/data-model-and-tests.md).
The three load-bearing ones:

- **The governor actually blocks** — fake clock, R=1, B=1: a third `acquire`
  resolves only after the clock advances; kills "`acquire` returns without
  awaiting the refill".
- **Priorities are honoured** — background enqueued first, interactive second,
  one token refilled: interactive resolves first; kills "FIFO across classes".
- **Memoization reduces the call count** — ACTIVE credited row with 12 records
  against the fake HTTP server: `requests().length` goes from the measured
  baseline (77) to ≤ 4 in steady state; kills "B1 scope or B2 memo bypassed".

The fake server gains a throttle mode (§7) so 429 paths run over real HTTP.
Assertions count **HTTP requests seen by the fake server**, never provider method
calls (the point of A is the wire). Integration suites run per file, never the
full package suite locally.

## 11. Rollout plan

PRs to `staging`, in order; each independently revertible.

1. **PR-1 Observability + governor in `observe`** (A without blocking) and the
   fake-server throttle. Ship, collect a week of `mp_traffic_window` baseline
   (this is the "before" for G-4 and the evidence for OQ-3's numbers).
2. **PR-2 B1 + B2** (no schema). Expected: sweep request volume drops ~5× at 12
   months of tenure.
3. **PR-3 Governor `enforce` + retry rework** (L1/L2/L3 changes), after OQ-1 and
   OQ-3. Staging smoke under induced 429s (fake throttle in local; real sandbox
   in staging).
4. **PR-4 C** (stagger, lock, signal, creations backoff + table).
5. **PR-5 B3 (+ B4 per OQ-6)** — migration, write-through, readers.

Each env var change is set in Coolify per environment before the PR that reads it
deploys. Rollback: `GOVERNOR_MODE=off` (A), revert PR (B/C; migrations are
expand-only so a revert leaves harmless tables).

## 12. Risks

- **R-1 Webhook latency budget.** A webhook that waits for tokens can exceed MP's
  delivery timeout and be retried anyway. Mitigation: interactive `maxWaitMs`
  2 s and fail-fast to `DEFERRED` (§6.1); B1 does not apply to it, but its
  `readCharge` still costs `1 + P` — acceptable, and measured by §6.4.
- **R-2 Checkout latency.** A burst of background traffic must not delay an
  `authorize`. Mitigation: priority + reserve (AC-1, AC-2); the reserve is sized
  so a checkout never waits for a background refill.
- **R-3 Stale cached charge.** A closed fact may miss a later refund or
  chargeback. Mitigation: facts close only past OQ-2's horizon; every webhook
  rewrites them; the credited-payments check keeps reading live inside its window;
  decisions never consume facts (AC-13).
- **R-4 Background starvation.** Sustained interactive load could starve the
  sweep past its timeout. Mitigation: cooperative stop + `complete: false` +
  projected-duration alert (§6.3); next run resumes.
- **R-5 Wrong default limits.** Without E we guess `R`. Too low slows the sweep;
  too high keeps 429s. Mitigation: observe week first, tunable values (OQ-3).
- **R-6 Advisory lock on a dropped connection.** The lock is released if the
  dedicated connection drops, allowing a second run. The lock is a cost control;
  PR-4 verifies, job by job, that a concurrent second run is safe (today nothing
  prevents it, so this is no worse than the baseline).
- **R-7 Redis as a new dependency of the MP path.** Mitigation: one write per
  429 and a cached read (≤ 250 ms) otherwise; fail-open to in-process; never
  awaited past 50 ms.
- **R-8 B4 fingerprint false "unchanged".** If MP changed a record without moving
  `chargeRecordCount`/`lastChargedAt`, the skip would miss it. Mitigation: any
  open charge forces a listing; OQ-6 lets the owner defer B4.

## 13. Implementation notes

- Billing CORE: staging smoke (checkout, webhook, sweep sections of the SPEC-143
  checklist) for PR-3/4/5 and prod smoke after promotion (`smokeGates` above).
- Run `pnpm check:guards` before each PR. Out of scope, named: **D** (NG-1),
  **E** (NG-2).

## 14. Owner questions

**OQ-1 · Cross-container coordination scope.** During a rollout two containers
call MP at once; Redis is available.

1. *In-process only.* Pros: no new dependency on the MP path, simplest. Cons: a
   429 in one container does not pause the other; two buckets double the rate
   during rollouts. Impact: none beyond A.
2. *In-process bucket + Redis-shared cool-down.* Pros: the signal that matters
   (MP said stop) reaches every container; one Redis write per 429, fail-open; duplicate
   cron runs are removed by C's lock anyway. Cons: bucket rate doubles during the
   minutes of a rollout. Impact: small Redis helper in `apps/api`.
3. *Fully Redis-backed bucket (Lua) + cool-down.* Pros: exact global rate. Cons:
   a Redis round-trip on every MP request, including checkout; more code; must
   fail open anyway. Impact: Redis on the hot path.

**Recommended: 2.** It covers the real failure (a 429 ignored by the sibling
container) at near-zero cost; move to 3 only if E reveals a tight per-second limit.

**OQ-2 · Approved charge freeze horizon.** How long an approved charge is
re-read live before its fact is treated as closed.

1. *Never freeze approved; only rejected-and-expired.* Pros: zero staleness risk.
   Cons: cost stays linear in tenure (one live read per approved charge per day);
   G-4 is not met. Impact: B3 helps rejected history only.
2. *Freeze after the credited-payments window (deadline 18).* Pros: G-4 met; the
   credited-payments check already re-reads live inside that window, and every
   refund/chargeback webhook rewrites the fact. Cons: a refund or chargeback whose
   webhook is lost after the window is only seen if MP re-sends it. Impact: as
   designed.
3. *Freeze after a fixed 180 days (chargeback horizon).* Pros: covers late
   chargebacks without trusting webhooks. Cons: six months of linear cost per
   subscription; G-4 met only for older history. Impact: same code, other constant.

**Recommended: 2.** The webhook is the primary channel for refunds and chargebacks;
the sweep is the backstop, and the backstop already re-reads live inside the
window where our own flows act.

**OQ-3 · Governor limit values.** MP has not published our limits (E is pending).

1. *Code constants* (`R=5/s`, `B=10`, reserve 20%). Pros: no env vars, reviewed in
   PRs. Cons: retuning needs a deploy. Impact: none.
2. *Env vars with those defaults* (`…_RATE_PER_SECOND`, `…_BURST`,
   `…_INTERACTIVE_RESERVE`). Pros: retune from Coolify in minutes after E answers
   or during an incident. Cons: three more registry entries; a redeploy is still
   needed to apply them. Impact: env workflow ×3.

**Recommended: 1.** A redeploy is required either way, and constants keep the
values reviewed; revisit after E. The mode kill switch stays an env var.

**OQ-4 · Daily sweep time and slicing.**

1. *One run at 03:10, no slicing; alert when projected duration > 50% of timeout.*
   Pros: simplest; lowest checkout traffic. Cons: slicing is built later, under
   pressure, if volume jumps. Impact: §6.3 as written.
2. *Resumable cursor: several short runs across the night (e.g. 02:10, 03:10,
   04:10) continuing from the last processed id.* Pros: bounded run length at any
   volume. Cons: a row may be read at different hours; more state in
   `reconciliation_sweep_run`. Impact: sweep service + run model.
3. *Keep 06:00.* Pros: no change in when marks appear. Cons: overlaps morning
   traffic. Impact: none.

**Recommended: 1.** With B the per-row cost is ~2–6 requests; at R=5/s background
reaches thousands of rows inside the timeout, and the alert gives lead time.

**OQ-5 · Interactive behaviour under a cool-down.**

1. *Fail fast after 2 s* (webhook defers with 503, checkout shows retry). Pros:
   predictable latency; MP redelivers webhooks. Cons: a customer may retry
   checkout by hand. Impact: as designed.
2. *Wait the whole cool-down (up to 120 s).* Pros: fewer visible errors. Cons:
   webhook deliveries time out at MP anyway; checkout hangs. Impact: larger
   timeouts.

**Recommended: 1.**

**OQ-6 · Ship the unchanged-inventory skip (B4) now.**

1. *Yes, in PR-5.* Pros: meets G-4 fully (≤ 2 requests per steady row). Cons: relies
   on `charged_quantity`/`last_charged_date` moving with every record change (R-8);
   that has not been measured against MP. Impact: one more table/columns.
2. *No; ship B1–B3, measure with §6.4, add B4 if needed.* Pros: no unmeasured
   assumption. Cons: steady rows cost `2 + P` (3–6 requests), still slightly
   tenure-dependent. Impact: smaller PR-5.

**Recommended: 2**, plus a sandbox measurement task (does `summarized` move on a
retried record?) whose result unlocks B4.

## 15. Linear

Canonical tracking: HOS-1999. Related: HOS-1354 (billing epic), HOS-1968,
HOS-1976, HOS-1991 (E), HOS-1995 (PR #4005).
