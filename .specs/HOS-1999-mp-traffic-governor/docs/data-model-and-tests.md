# HOS-1999 — Data model and test matrix

Supporting detail for [`../spec.md`](../spec.md) §6.2, §7 and §10.

## `provider_charge_snapshot` (B3)

Structural carril (`pnpm db:generate` + `pnpm db:migrate`). No seed data, so the
seed dual-write rule does not apply. Expand-only. The name keeps it apart from
`payment.provider_fact_id` and the `recordChargeFact` service (the ledger's
fact of a collected charge). One row per `(provider, charge_id)`:

| Column | Type | Notes |
|---|---|---|
| `provider`, `charge_id` | varchar | unique pair |
| `authorization_id` | varchar null | |
| `provider_created_at`, `expires_at` | timestamptz | `expires_at` null when MP gave none |
| `status` | varchar | domain status (`approved` / `rejected` / `pending`) |
| `purpose`, `reference`, `decline_reason` | varchar | |
| `amount_minor`, `refunded_amount_minor` | integer | centavos (money convention: integer, never numeric/float) |
| `currency` | varchar(3) | |
| `charged_back` | boolean | |
| `observed_at` | timestamptz | instant of the live read that wrote the row |

There is no `frozen_at`: whether a snapshot is closed is computed when it is
read, against deadline 18 as currently in force (spec §6.2), so an edit of the
deadline takes effect on the next read.

Upserted on every live `readCharge`, ordered by observation:

```sql
INSERT … ON CONFLICT (provider, charge_id) DO UPDATE SET …
WHERE provider_charge_snapshot.observed_at <= EXCLUDED.observed_at
```

A live read always overwrites an older row, closed or not, so a refund webhook
rewrites the snapshot; a slower read that finishes after a newer one is dropped.

## `creation_sweep_attempt` (creations-sweep memory)

| Column | Type | Notes |
|---|---|---|
| `subscription_id` | uuid PK, FK `subscription.id` | |
| `attempts` | integer | searches done for this pending row |
| `next_search_at` | timestamptz | +5 min, then +15 min, then every 60 min, jittered (OQ-7) |
| `reset_marker` | varchar null | create-key id / `updated_at` seen at the last attempt; a change resets the cadence |

## Sweep cycle columns (OQ-4, OQ-8)

`subscription.last_swept_at` (indexed `last_swept_at ASC NULLS FIRST, id`) and
the `reconciliation_sweep_run` cycle columns: see
[`sweep-slicing.md`](sweep-slicing.md) §2. Expand-only, nullable, no backfill.

## Inventory fingerprint (B4, deferred)

Not in this spec (OQ-6, 2026-11-02): gated by T-B4-GATE. If the gate passes,
the follow-up stores per authorization `charge_record_count`, `last_charged_at`,
`charge_ids text[]` and `fingerprinted_at`.

## Test matrix (spec §10)

Mutation-sensitive by design: each test names the mutation it must kill, and the
implementer records the mutation run on the PR (a survivor blocks merge). Every
"count" assertion reads the **fake HTTP server's** `requests()` log, never
provider method calls.

### Governor (A)

| Test | Level | Kills the mutation |
|---|---|---|
| Governor blocks: fake clock, R=1, B=1, three `acquire` → the third resolves only after `advance(1000)` | unit | `acquire` returns without awaiting the refill |
| Priority: enqueue background, then interactive; refill one token → interactive resolves first | unit | queues served FIFO across classes |
| Reserve: bucket at reserve → background pending, interactive resolves | unit | reserve check removed / off-by-one |
| Cool-down: 429 + `Retry-After: 7` → injected `fetch` called 0 times for 7 s, then resumes | unit (adapter + injected fetch) | `observe` ignores `Retry-After` |
| Back-off without `Retry-After`: 2, 4, 8 … 60 s; a 2xx resets | unit | sequence not reset / not capped |
| Jitter bounds with injected random 0 and 1 | unit | jitter removed or unbounded |
| Fast-fail: interactive `maxWaitMs` < remaining cool-down → `RATE_LIMITED` with `governorRejected`, zero requests | unit | interactive waits the whole cool-down |
| L1 does not retry a governor rejection (AC-27) | unit (adapter + injected fetch) | `governorRejected` treated as a retryable `UNAVAILABLE` |
| L1 post-429 delay is 0 under `enforce`; `Retry-After: 30` on a background read is waited by `acquire`, not abandoned by the 4000 ms budget (AC-27) | unit | L1 still sleeps / still caps by `maxTotalDelayMs` for background |
| Legacy parity under `off` and `observe` (AC-28): same attempts, delays, 2 s cap and `minIntervalMs` as today | unit (recorded legacy sequence) | new retry paths not gated on mode |
| Retry non-multiplication: fake server throttles every request → one sweep `readCharge` yields exactly 3 requests | integration (fake HTTP server) | L2 still retries `RATE_LIMITED` |
| Shared cool-down via Redis: two governor instances, one Redis; a 429 on A blocks B within 250 ms (AC-6) | integration (Redis) | cool-down written only locally; keep-max not atomic |
| Redis slow or down: `acquire` never waits > 50 ms on Redis; one warning per outage | integration | governor awaits the connection or an unbounded command |
| Redis recovers: stop then restart Redis → the shared cool-down is used again without restarting the governor | integration | client gives up reconnecting (the shared helper's `connectionAttempted`) |
| Webhook under cool-down (AC-29): rejected read with 37 s left → `DEFERRED`, `503`, `Retry-After: 37` | integration (route + service) | `RATE_LIMITED` still mapped to `FAILED`; fixed `Retry-After: 60` |
| Class guard (AC-33): every caller of `defaultPaymentProvider` / `new MercadoPagoPaymentProvider` is allowlisted with a class | static guard test | a new unclassified composition point |

### Memoization and snapshots (B)

| Test | Level | Kills the mutation |
|---|---|---|
| Memo count: ACTIVE credited row, 12 records, steady state → `requests().length` ≤ 15 after PR-2, ≤ 4 after PR-6 (baseline 77) | integration (fake HTTP server + DB) | B1 scope or B2 memo bypassed; snapshots not consulted |
| Tenure: 12 vs 36 records → counts differ only by listing pages | integration | snapshots not consulted for historic charges |
| Nested act (AC-26): GRACE row past deadline with an approved charge, B2 on → row leaves grace, no freshness error | integration | B2 memoizes a stamped `ProviderRead` |
| Rejected promise evicted (AC-35) | unit | a failed fetch stays memoized for the scope |
| Webhook not memoized: two notices for one charge → two live reads | integration | read scope leaks outside the sweep |
| Freshness types (AC-13): `expectTypeOf` on every check's port and on `readPeriodCharges`'s input accepts `ProviderRead` only; `closedChargeSnapshots.find` has one allowlisted consumer | type test + static guard | a decision fed from a snapshot |
| Ordered upsert (AC-11): older read finishing after a newer one → newer `observed_at` row kept | integration (DB) | unconditional `DO UPDATE` |
| Refund after close (AC-12): closed approved snapshot + refund webhook → snapshot rewritten, next comparison sees it | integration | write-through skipped for closed rows |
| Closedness at read time (AC-30): deadline 18 lengthened → a previously closed snapshot is read live | integration | closedness persisted at write time |
| Latest re-read live (AC-31): latest listed charge has a closed snapshot → read live; latest chosen by `createdAt` across snapshots and live reads | integration | latest served from the snapshot; latest chosen by list order |
| Creations memory (AC-14): two due rows, one email → one search; a row created at T is searched at ≥ T+5, ≥ T+20, then at most hourly; a new create key restarts | integration (fake clock) | per-email batching or backoff removed; cadence not reset |

### Schedule and cron execution (C)

| Test | Level | Kills the mutation |
|---|---|---|
| Overlap lock (AC-15): two `withCronLock` on one name, first handler outlives its timeout → second skipped with status `success` + `details.skipped = 'overlap'`, lock released when the first settles | integration (DB) | lock released at timeout; new status value |
| Cooperative stop: abort `ctx.signal` mid-run → no new row starts, `complete: false` | unit | signal ignored |
| Manual trigger (AC-32): same `runCronJob` as the tick, `202 { runId }` before the handler ends, `409` on overlap, `?newCycle=true` opens a new cycle after `DONE` | integration (route + DB) | the 30 s route race survives; trigger awaits the handler |
| Manifest stagger: no two MP-calling jobs share a minute, none at minute 0 | unit on `CRON_SCHEDULES` | schedules collide |

### Resumable sweep cycle (OQ-4, OQ-8)

| Test | Level | Kills the mutation |
|---|---|---|
| Cycle covers every row once (AC-19): 300 never-swept rows, budget 120 per slice, three slices → each id read once, all stamped ≥ `cycle_started_at`, `DONE` on slice 2 | integration (DB + fake server) | stamp skipped or compared with `<=`; query not restricted to unswept rows |
| Budget stop (AC-20): budget reached at row 57 → row 57 finishes and is stamped, `TIMED_OUT`, `success: true`, no `captureException`, no `/fail` ping; next slice reads only unstamped rows | integration (Sentry + ping spies) | slice stops by throwing / via the race |
| Crash mid-row (AC-21): act of row K ran, stamp not committed, lease expired → run closed `ABANDONED`, row K read again, no second mark | integration | stamp written before the act (row lost); abandoned run left open |
| Lease held and zombie (AC-36): lock free, lease live → `details.skipped = 'lease_held'`; a run closed under a live slice → its next stamp transaction rolls back and it stops | integration | free lock taken as proof of death; stamp not guarded by the run's lease |
| Passes across slices (AC-22): abort during credited payments → `passes_completed` = the earlier passes; next slice skips them and restarts credited payments | integration | pass marked complete before it returns; completed passes re-run |
| Pass reserve (AC-34): rows would fill the last slot → loop stops at the reserve, `rows_complete = false`, every pass runs | integration | no reserve; passes skipped when rows run long |
| Cycle already done (AC-23): third slot after `DONE` → `SKIPPED_CYCLE_DONE`, zero requests in the fake server log | integration | `DONE` not checked before reading |
| One alert per cycle (AC-24): failures in slices 0 and 2 → one capture with both ids, no ping, slices 0–1 `success: true`, failed rows stamped | integration (logger + ping spies) | alert per slice; ping on failed cycle; failed rows retried within the cycle |
| Incomplete cycle (AC-25): last slot ends with `rows_complete = false` → error captured; next cycle reads the unreached rows before the reached ones | integration | ordering by `id` instead of `last_swept_at` (tail starvation) |
| New row mid-cycle (AC-37): a row with `NULL` stamp appears during the cycle → read before previously swept rows not yet reached | integration | `NULLS LAST` |
| One writer of `last_swept_at`: only the sweep's stamp transaction writes it | static guard test | a second writer (e.g. a generic update helper) |

### Observability

| Test | Level | Kills the mutation |
|---|---|---|
| Window log (AC-18): traffic in both classes → one `mp_traffic_window` per class with the §6.4 counters; `details.providerTraffic` persisted | integration (logger spy + DB) | counters not flushed / not scoped to the run |

43 tests. Integration suites run per file, never the full package suite locally.
