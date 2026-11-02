# HOS-1999 — Data model and test matrix

Supporting detail for [`../spec.md`](../spec.md) §6.2, §7 and §10.

## `provider_charge_fact` (B3)

Structural carril (`pnpm db:generate` + `pnpm db:migrate`). No seed data, so the
seed dual-write rule does not apply. Expand-only. One row per
`(provider, charge_id)`:

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
| `observed_at` | timestamptz | last live read |
| `frozen_at` | timestamptz null | set when the fact became closed (spec §6.2) |

Upserted on every live `readCharge`. A live read always overwrites, including a
frozen row: a refund webhook rewrites the facts and keeps `frozen_at` only if the
new state is still closed.

## `creation_sweep_attempt` (creations-sweep memory)

| Column | Type | Notes |
|---|---|---|
| `subscription_id` | uuid PK, FK `subscription.id` | |
| `attempts` | integer | searches done for this pending row |
| `next_search_at` | timestamptz | +5, +10, +20, +40 min, then every 60 min, jittered |
| `last_result_hash` | varchar null | hash of the classified search result |
| `reset_marker` | varchar null | create-key id / `updated_at` seen at the last attempt; a change resets the cadence |

## `reconciliation_sweep_run` cycle columns (OQ-4)

See [`sweep-slicing.md`](sweep-slicing.md) §2. Expand-only, nullable, so legacy
single-run rows stay valid.

## Inventory fingerprint (B4, deferred)

Not in this spec (OQ-6, 2026-11-02): gated by T-B4-GATE. If the gate passes,
the follow-up stores per authorization `charge_record_count`, `last_charged_at`,
`charge_ids text[]` and `fingerprinted_at`.

## Test matrix (spec §10)

Mutation-sensitive by design: each test names the mutation it must kill, and the
implementer records the mutation run on the PR (a survivor blocks merge). Every
"count" assertion reads the **fake HTTP server's** `requests()` log, never
provider method calls.

| Test | Level | Kills the mutation |
|---|---|---|
| Governor blocks: fake clock, R=1, B=1, three `acquire` → the third resolves only after `advance(1000)` | unit | `acquire` returns without awaiting the refill |
| Priority: enqueue background, then interactive; refill one token → interactive resolves first | unit | queues served FIFO across classes |
| Reserve: bucket at reserve → background pending, interactive resolves | unit | reserve check removed / off-by-one |
| Cool-down: 429 + `Retry-After: 7` → injected `fetch` called 0 times for 7 s, then resumes | unit (adapter + injected fetch) | `observe` ignores `Retry-After` |
| Back-off without `Retry-After`: 2, 4, 8 … 60 s; a 2xx resets | unit | sequence not reset / not capped |
| Jitter bounds with injected random 0 and 1 | unit | jitter removed or unbounded |
| Fast-fail: interactive `maxWaitMs` < remaining cool-down → `RATE_LIMITED`, zero requests | unit | interactive waits the whole cool-down |
| Retry non-multiplication: fake server throttles every request → one sweep `readCharge` yields exactly 3 requests | integration (fake HTTP server) | L2 still retries `RATE_LIMITED` |
| Shared cool-down via Redis: two governor instances, one Redis; a 429 on A blocks B | integration (Redis) | cool-down written only locally |
| Redis down: both instances keep serving, one warning | integration | governor awaits Redis |
| Memo count: ACTIVE credited row, 12 records, steady state → `requests().length` ≤ 4 (baseline before the change: 77) | integration (fake HTTP server + DB) | B1 scope or B2 memo bypassed |
| Tenure: 12 vs 36 records → counts differ only by listing pages | integration | facts not consulted for historic charges |
| Webhook not memoized: two notices for one charge → two live reads | integration | read scope leaks outside the sweep |
| Freshness guard: decision paths (`readPeriodCharges`, row checks) accept `ProviderRead`, never `ClosedChargeFact` | static guard test | a decision fed from the cache |
| Refund after freeze: closed approved fact + refund webhook → fact rewritten, next comparison sees it | integration | write-through skipped for frozen rows |
| Creations memory: two rows, one email → one search; a row is not searched before `next_search_at` | integration | per-email memo or backoff removed |
| Overlap lock: two `withCronLock` on one name, first handler outlives its timeout → second skipped, lock released when the first settles | integration (DB) | lock released at timeout |
| Cooperative stop: abort `ctx.signal` mid-run → no new row starts, `complete: false` | unit | signal ignored |
| Manifest stagger: no two MP-calling jobs share a minute, none at minute 0 | unit on `CRON_SCHEDULES` | schedules collide |
| Cycle covers every row once (AC-19): 300 rows, budget 120 per slice, three slices → each id read once, in order, `DONE` on slice 2 | integration (DB + fake server) | cursor written before the row instead of after; off-by-one on `>` vs `>=` |
| Abort mid-loop (AC-20): signal at row 57 → row 57 finishes, cursor = 57, `TIMED_OUT`, next slice starts at 58 | integration | signal checked after starting the row; cursor not persisted on abort |
| Dead slice (AC-21): open run with cursor 40 and no lock holder → closed `ABANDONED`, resume at 41; replaying row 41 opens no second mark | integration | resume from slice start instead of cursor; abandoned run left open |
| Passes across slices (AC-22): abort during credited payments → `passes_completed` = the earlier passes; next slice skips them and restarts credited payments | integration | pass marked complete before it returns; completed passes re-run |
| Cycle already done (AC-23): third slot after `DONE` → `SKIPPED_CYCLE_DONE`, zero requests in the fake server log | integration | `DONE` not checked before reading |
| One alert per cycle (AC-24): failures in slices 0 and 2 → one capture with both ids, no ping, slices 0–1 `success: true` | integration (logger + ping spies) | alert per slice; ping on failed cycle |
| Incomplete cycle and wrap (AC-25): last slot ends in `ROWS` at cursor K → error captured; next cycle reads K+1…end, then start…K | integration | next cycle restarts from the beginning (tail starvation) |

Integration suites run per file, never the full package suite locally.
