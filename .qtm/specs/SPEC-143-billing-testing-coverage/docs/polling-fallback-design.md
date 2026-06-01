# MercadoPago preapproval polling fallback — Design

**Status**: Draft — pending review
**Author**: claude + qazuor (pair design session 2026-05-23)
**Related findings**: #17 (subscription_preapproval webhook not arriving), #19 (auto-soft-delete on MP sync failure)
**Estimated effort**: 8-12 hours focused work (excluding review/iteration)

---

## 1. Context

### 1.1 The problem

MercadoPago's webhook system has proven unreliable for the `subscription_preapproval.*` event family in our testing:

- **TEST credentials**: `subscription_preapproval.created` events do not arrive at all (Finding #17), even when the event is subscribed in the MP dashboard. Verified across multiple smoke runs on 2026-05-22 and 2026-05-23.
- **PROD credentials**: same. Confirmed on 2026-05-22 17:50 — `payment.created` arrived and verified, but `subscription_preapproval.created` did not. The subscription consequently never flipped from `incomplete` to `active`.
- **Other webhook types** (`payment.*`, `merchant_order.*`) arrive reliably.

Without `subscription_preapproval.created`, the subscription state machine has no input event to transition the local subscription record to `active`. The user pays at the MP checkout, MP processes the payment, but Hospeda never knows the preapproval was authorized.

### 1.2 Why not just fix the webhook delivery

We have spent ~24 hours (2026-05-22 to 2026-05-23) investigating root cause:

- ✅ Verified MP dashboard event subscription includes "Planes y suscripciones".
- ✅ Verified webhook secret matches between MP dashboard and our env.
- ✅ Verified the URL has `?source_news=webhooks` marker (PR #1230).
- ✅ Verified HMAC signature verification works for all events that *do* arrive (`payment.*`, `merchant_order.*`).
- ❌ MP does not deliver `subscription_preapproval.*` regardless of configuration.

This is an MP-side issue. Options to escalate (MP support ticket) are non-deterministic in timeline and outcome. Building a polling fallback is faster and gives us resilience independent of MP webhook reliability.

### 1.3 Why this fallback is valuable beyond Finding #17

Even if MP fixes the webhook delivery tomorrow, a polling fallback hardens the system against:

- **Network blips** that cause webhook delivery to fail (MP retries but with delays).
- **Webhook URL changes** (deploy cycle) where MP queues events to URLs that briefly 503.
- **DDoS / rate limiting** at our infrastructure layer dropping inbound webhooks.
- **MP outages** where events fire late or out of order.

The fallback should not replace webhooks — it should run alongside them and converge to the same end state via whichever signal arrives first.

---

## 2. Goals and non-goals

### Goals

1. **G1**. After `start-paid` creates a preapproval in MP, the local subscription transitions to `active` (or terminal failure state) without depending on the `subscription_preapproval.*` webhook arriving.
2. **G2**. Coexist safely with webhooks: when both signals arrive, the local subscription transitions exactly once.
3. **G3**. Polling is bounded — does not run forever for subscriptions that will never be authorized.
4. **G4**. Polling load on MP is bounded — does not exceed MP rate limits or hammer the API.
5. **G5**. Test environment with TEST credentials reaches `active` reliably, unblocking SPEC-143 smoke checklist 1.1 and downstream sections.
6. **G6**. Observable — logs and metrics let us see polling activity, success rate, and time-to-active.

### Non-goals

- **N1**. Replacing webhooks. Webhooks remain the primary signal when they arrive in time.
- **N2**. Polling for non-subscription events (payments, refunds, chargebacks). Only `preapproval` status matters here.
- **N3**. Real-time guarantees. A 30-60s delay in transitioning to `active` is acceptable.
- **N4**. Stripe equivalent. Stripe webhooks are reliable and don't need this. The hook should be MP-specific or behind an opt-in adapter config.

---

## 3. Architecture overview

### 3.1 High-level flow

```
                          ┌──────────────────────┐
                          │  User clicks "Pay"   │
                          └─────────┬────────────┘
                                    ↓
                          ┌──────────────────────┐
                          │  /start-paid handler │
                          └─────────┬────────────┘
                                    │ creates preapproval at MP
                                    │ inserts billing_subscription (status=incomplete)
                                    │ enqueues poll job          ← NEW
                                    │ returns init_point
                                    ↓
                          ┌──────────────────────┐
                          │  Browser → MP CO     │
                          └─────────┬────────────┘
                                    │ user pays
                                    ↓
                          ┌──────────────────────┐
                          │  MercadoPago         │
                          └──────┬───────────────┘
                                 │
                  ┌──────────────┼──────────────────┐
                  │              │                  │
                  ↓              ↓                  ↓
        ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐
        │ payment.*   │  │ preapproval  │  │ (no event)      │
        │  webhook    │  │  webhook ?   │  │                 │
        │  (arrives)  │  │  (may NOT    │  │                 │
        │             │  │   arrive)    │  │                 │
        └──────┬──────┘  └──────┬───────┘  └────────┬────────┘
               │                │                   │
               ↓                ↓                   │
        record payment    flip sub to active        │
               │                │                   │
               └────────────────┴───────────────────┘
                                │
                                ↓
                ┌───────────────────────────────────┐
                │  Cron poller (every 30s)          │   ← NEW
                │  scans subscriptions in           │
                │  incomplete state with active     │
                │  poll jobs                        │
                └───────────────┬───────────────────┘
                                │ for each:
                                │   GET /preapproval/{id} from MP
                                │   if authorized → flip sub to active
                                │     (idempotent: webhook may have already flipped it)
                                │   if cancelled/rejected → mark failed
                                │   if pending → keep polling
                                │   if timeout (30 min) → mark failed_to_authorize
                                ↓
                ┌───────────────────────────────────┐
                │  billing_subscription transitions │
                │  to terminal state                │
                └───────────────────────────────────┘
```

### 3.2 Components

| Component | Location | New / Changed |
|---|---|---|
| `subscription_polling_jobs` table | DB schema | NEW |
| `enqueuePollJob()` | `qzpay-core` | NEW interface, MP impl |
| `pollPreapprovalStatus()` | `qzpay-mercadopago` | NEW |
| `subscription-poll.job.ts` cron job | Hospeda `apps/api/src/cron/jobs/` | NEW |
| `start-paid.ts` handler | Hospeda | CHANGED — call enqueuePollJob |
| `webhook subscription_preapproval handler` | Hospeda | CHANGED — cancel poll job on success (cleanup) |

### 3.3 Choice: cron vs queue (BullMQ)

**Recommendation**: **cron-based, table-driven scheduler**. Rationale:

| Factor | Cron + table | BullMQ |
|---|---|---|
| New infra | None (Hospeda has cron registry) | Redis queue, worker process |
| Predictability | Every 30s, scans table | Job runs when worker pulls it |
| Failure recovery | DB is source of truth, scan retries naturally | Need job retry policy + DLQ |
| Observability | SQL query gives state immediately | Need BullMQ dashboard / queries |
| Throughput limit | Limited by single cron iteration (acceptable for tens of in-flight subs) | Higher (parallel workers) |
| Code complexity | Lower | Higher |
| Already in Hospeda | YES — cron infra exists, used by 12 other jobs | NO — Redis is used but no queue infra |

For Hospeda's volume (single-digit to tens of concurrent in-flight subscriptions), cron is sufficient. If we ever hit hundreds of concurrent subs needing polling, we revisit and migrate to BullMQ.

The DB table acts as the job queue. Cron scans it, processes due jobs, updates state.

---

## 4. Detailed design

### 4.1 DB schema

New table `billing_subscription_polling_jobs`:

```sql
CREATE TABLE billing_subscription_polling_jobs (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id      uuid NOT NULL REFERENCES billing_subscriptions(id) ON DELETE CASCADE,
    provider             varchar(50) NOT NULL,        -- 'mercadopago' (future: stripe)
    provider_resource_id varchar(255) NOT NULL,       -- MP preapproval id
    status               varchar(20) NOT NULL DEFAULT 'pending',
                         -- pending | succeeded | failed | timeout | cancelled
    attempts             integer NOT NULL DEFAULT 0,
    max_attempts         integer NOT NULL DEFAULT 60, -- 60 * 30s = 30 min default
    next_poll_at         timestamptz NOT NULL DEFAULT now(),
    last_polled_at       timestamptz,
    last_provider_status varchar(50),                 -- last response status from provider
    last_error           text,                        -- last error message (truncated)
    metadata             jsonb NOT NULL DEFAULT '{}',
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),
    completed_at         timestamptz,                 -- set when status leaves 'pending'
    version              uuid NOT NULL DEFAULT gen_random_uuid()  -- optimistic locking
);

CREATE INDEX idx_polling_jobs_due ON billing_subscription_polling_jobs (next_poll_at)
    WHERE status = 'pending';

CREATE INDEX idx_polling_jobs_subscription ON billing_subscription_polling_jobs (subscription_id);

CREATE UNIQUE INDEX idx_polling_jobs_one_active_per_sub ON billing_subscription_polling_jobs (subscription_id)
    WHERE status = 'pending';
```

**Key design choices**:

- **`UNIQUE WHERE status='pending'`**: prevents duplicate active jobs for the same subscription (race condition guard).
- **`version` for optimistic locking**: when cron picks a job, it does `UPDATE ... WHERE id=X AND version=Y RETURNING ...` to detect concurrent updates.
- **`status='succeeded'` is kept**: for audit / observability. Not deleted on completion.
- **`last_provider_status`**: gives us a quick way to filter "which polls timed out vs which got cancelled" without joining external logs.

### 4.2 qzpay-core interface

New optional hook on the `SubscriptionAdapter`:

```typescript
// qzpay-core/src/types/subscription.types.ts

export interface SubscriptionAdapter {
    // ...existing methods

    /**
     * Optional hook for adapters that need to poll for subscription
     * authorization status (e.g., MercadoPago where the webhook is unreliable).
     *
     * If implemented, qzpay-core will schedule a polling job after
     * subscription.create() succeeds. The adapter is responsible for:
     * - Fetching current status from the provider
     * - Returning a normalized result
     *
     * If not implemented (Stripe, etc.), no polling is scheduled.
     */
    pollSubscriptionStatus?(params: {
        providerSubscriptionId: string;
        previousStatus?: string;
    }): Promise<PollSubscriptionStatusResult>;
}

export interface PollSubscriptionStatusResult {
    /**
     * Provider's current status, normalized.
     */
    status: 'authorized' | 'pending' | 'cancelled' | 'rejected' | 'unknown';

    /**
     * Raw provider status string for logging / debugging.
     */
    rawStatus: string;

    /**
     * Whether the poller should continue polling.
     * False for terminal states (authorized, cancelled, rejected).
     */
    shouldContinuePolling: boolean;

    /**
     * Optional. Suggested next poll interval in ms. If absent, default is used.
     * Adapters can suggest faster polling early (when MP just got the payment)
     * and slower later.
     */
    suggestedNextPollMs?: number;

    /**
     * Metadata to attach to the polling job. Helpful for debugging.
     */
    metadata?: Record<string, unknown>;
}
```

And a method on `billing.subscriptions`:

```typescript
// qzpay-core/src/billing.ts (sketch)

class QZPayBilling {
    subscriptions = {
        // ...existing methods

        /**
         * Enqueues a polling job for the subscription. No-op if the adapter
         * doesn't implement pollSubscriptionStatus.
         *
         * Called from subscription.create() in paid mode automatically.
         * Can also be called manually for testing / recovery.
         */
        async schedulePolling(params: {
            subscriptionId: string;
            providerSubscriptionId: string;
            initialDelayMs?: number;
            maxAttempts?: number;
        }): Promise<PollingJob | null> {
            if (!this.config.paymentAdapter.subscriptions.pollSubscriptionStatus) {
                return null; // Provider doesn't need polling
            }
            return this.storage.pollingJobs.create({...});
        }
    };
}
```

### 4.3 qzpay-mercadopago implementation

```typescript
// qzpay-mercadopago/src/adapters/subscription.adapter.ts

export class QZPayMercadoPagoSubscriptionAdapter implements SubscriptionAdapter {
    // ...existing methods

    async pollSubscriptionStatus(params: {
        providerSubscriptionId: string;
        previousStatus?: string;
    }): Promise<PollSubscriptionStatusResult> {
        try {
            // MP REST: GET /preapproval/{id}
            const response = await this.mpClient.preApproval.get({
                id: params.providerSubscriptionId
            });

            const rawStatus = response.status; // 'authorized' | 'pending' | 'cancelled' | etc.
            const normalized = this.normalizeStatus(rawStatus);

            return {
                status: normalized,
                rawStatus,
                shouldContinuePolling: normalized === 'pending',
                // Faster polling early, slower later — MP usually takes <1 min when it works
                suggestedNextPollMs: this.suggestPollInterval(params.previousStatus, rawStatus),
                metadata: {
                    payerEmail: response.payer_email,
                    autoRecurringStart: response.auto_recurring?.start_date,
                    lastModified: response.last_modified
                }
            };
        } catch (error) {
            // Provider error: log + retry later
            this.logger.warn({
                providerSubscriptionId: params.providerSubscriptionId,
                error: error instanceof Error ? error.message : String(error)
            }, 'Failed to fetch preapproval status, will retry');

            return {
                status: 'unknown',
                rawStatus: 'error',
                shouldContinuePolling: true,
                suggestedNextPollMs: 60000  // Backoff 1 min on error
            };
        }
    }

    private normalizeStatus(rawStatus: string): PollSubscriptionStatusResult['status'] {
        switch (rawStatus) {
            case 'authorized':
                return 'authorized';
            case 'pending':
                return 'pending';
            case 'cancelled':
            case 'paused':  // Treat paused as cancelled for polling purposes
                return 'cancelled';
            case 'rejected':
                return 'rejected';
            default:
                return 'unknown';
        }
    }

    private suggestPollInterval(prev: string | undefined, current: string): number {
        // Aggressive polling for first 5 minutes, then taper off
        if (current === 'pending' && (!prev || prev === 'pending')) {
            return 30000; // 30s
        }
        // Status changed but still pending? Could be transitioning
        if (current === 'pending' && prev !== 'pending') {
            return 15000; // 15s
        }
        return 30000;
    }
}
```

### 4.4 Hospeda cron job

```typescript
// apps/api/src/cron/jobs/subscription-poll.job.ts

import { getDb } from '@repo/db';
import { getQZPayBilling } from '../../middlewares/billing';
import { apiLogger } from '../../utils/logger';
import type { CronJob } from '../types';

const POLL_BATCH_SIZE = 50;

export const subscriptionPollJob: CronJob = {
    name: 'subscription-poll',
    schedule: '*/30 * * * * *',  // Every 30 seconds (6-field cron)
    description: 'Polls MP for preapproval status to flip incomplete subscriptions to active',

    async run() {
        const db = getDb();
        const billing = getQZPayBilling();
        if (!billing) {
            apiLogger.warn('subscription-poll: billing not configured, skipping');
            return;
        }

        // 1. Fetch due jobs with optimistic lock
        const dueJobs = await db
            .select()
            .from(billingSubscriptionPollingJobs)
            .where(
                and(
                    eq(billingSubscriptionPollingJobs.status, 'pending'),
                    lte(billingSubscriptionPollingJobs.nextPollAt, new Date())
                )
            )
            .limit(POLL_BATCH_SIZE);

        if (dueJobs.length === 0) {
            return;
        }

        apiLogger.info({ count: dueJobs.length }, 'subscription-poll: processing due jobs');

        // 2. Process each job
        for (const job of dueJobs) {
            try {
                await processPollJob(job, billing, db);
            } catch (error) {
                apiLogger.error({ jobId: job.id, error }, 'subscription-poll: job failed');
                // Update job with error, increment attempts, schedule retry
                await markJobError(job, error, db);
            }
        }
    }
};

async function processPollJob(job: PollingJob, billing: QZPayBilling, db: Database) {
    // 1. Re-fetch with version check (optimistic lock)
    const locked = await db
        .update(billingSubscriptionPollingJobs)
        .set({
            lastPolledAt: new Date(),
            attempts: sql`${billingSubscriptionPollingJobs.attempts} + 1`,
            version: sql`gen_random_uuid()`
        })
        .where(
            and(
                eq(billingSubscriptionPollingJobs.id, job.id),
                eq(billingSubscriptionPollingJobs.version, job.version),
                eq(billingSubscriptionPollingJobs.status, 'pending')
            )
        )
        .returning();

    if (locked.length === 0) {
        // Concurrently picked by another worker / completed elsewhere → skip
        return;
    }

    // 2. Check timeout
    if (locked[0].attempts > locked[0].maxAttempts) {
        await markTimeout(job, db);
        await markSubscriptionFailed(job.subscriptionId, 'polling_timeout', db);
        return;
    }

    // 3. Call adapter to fetch status
    const result = await billing.subscriptions.pollProviderStatus({
        providerSubscriptionId: job.providerResourceId,
        previousStatus: job.lastProviderStatus
    });

    // 4. Update job state
    await db.update(billingSubscriptionPollingJobs).set({
        lastProviderStatus: result.rawStatus,
        nextPollAt: new Date(Date.now() + (result.suggestedNextPollMs ?? 30000)),
        status: terminalStatusFor(result.status) ?? 'pending',
        completedAt: terminalStatusFor(result.status) ? new Date() : undefined
    }).where(eq(billingSubscriptionPollingJobs.id, job.id));

    // 5. If terminal, transition the subscription
    if (result.status === 'authorized') {
        await transitionSubscriptionToActive(job.subscriptionId, db, {
            source: 'polling',
            providerStatus: result.rawStatus
        });
    } else if (result.status === 'cancelled' || result.status === 'rejected') {
        await transitionSubscriptionToFailed(job.subscriptionId, db, {
            source: 'polling',
            reason: result.rawStatus
        });
    }
    // If 'pending' or 'unknown': nothing to do, next cron tick will re-poll
}
```

### 4.5 `start-paid.ts` integration

Modify `apps/api/src/routes/billing/start-paid.ts` after the preapproval is created:

```typescript
// After billing.subscriptions.create() returns

const subscription = await billing.subscriptions.create({...});

// Schedule polling fallback (no-op if adapter doesn't support polling)
await billing.subscriptions.schedulePolling({
    subscriptionId: subscription.id,
    providerSubscriptionId: subscription.providerSubscriptionId,
    initialDelayMs: 30000,  // First poll 30s after creation
    maxAttempts: 60          // 30 min total window
});

return c.json({...}, 201);
```

### 4.6 Webhook handler integration

When `subscription_preapproval.created` webhook DOES arrive (rare but possible in some envs), the handler should:

1. Transition the subscription (existing behavior).
2. **Mark any active polling job as `succeeded` and `completed_at = now()`** so the cron doesn't keep polling unnecessarily.

```typescript
// apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts

// After successful subscription transition
await db.update(billingSubscriptionPollingJobs).set({
    status: 'succeeded',
    completedAt: new Date(),
    lastError: 'webhook_arrived_first'  // Just for logging clarity
}).where(
    and(
        eq(billingSubscriptionPollingJobs.subscriptionId, subscription.id),
        eq(billingSubscriptionPollingJobs.status, 'pending')
    )
);
```

This is purely cleanup — even if it fails, the next poll will see the subscription is already `active` and complete normally.

---

## 5. Edge cases

### 5.1 Webhook arrives between poll iterations

**Scenario**: Cron at t=30s polls, status still `pending`. At t=45s, webhook arrives, flips sub to `active`. At t=60s, cron polls again.

**Behavior**: At t=60s, MP returns `authorized`. Cron tries to flip sub to active. Idempotency in `transitionSubscriptionToActive` detects sub is already `active` and no-ops. Cron marks polling job `succeeded`.

**Test**: Unit test that calling `transitionSubscriptionToActive` on an already-active sub is no-op.

### 5.2 Both webhook and poll fire concurrently

**Scenario**: At t=60s, webhook handler is mid-transition. Same time, cron worker picks up the polling job and tries to transition.

**Behavior**: Optimistic locking on `billing_subscriptions.version` ensures only one update wins. The losing path detects the version mismatch and treats it as already-transitioned (idempotent).

**Test**: Concurrent test using two parallel calls to `transitionSubscriptionToActive` — assert only one update lands and final state is consistent.

### 5.3 MP REST 401 / wrong credentials

**Scenario**: env has wrong access token, so polling REST calls fail with 401.

**Behavior**: `pollSubscriptionStatus` catches and returns `{status: 'unknown', shouldContinuePolling: true}`. The job keeps retrying with backoff until `max_attempts` is hit, then transitions to `timeout`. Logs warn loudly so devs notice.

**Mitigation**: Health check on billing initialization should verify creds work via a no-op MP call (e.g., listing 0 preapprovals). If it fails, log loud and refuse to enqueue new jobs.

### 5.4 MP REST 5xx / network outage

**Scenario**: MP backend is down. All polls return errors.

**Behavior**: Same as 5.3 — back off, retry, eventually timeout. Cron job error rate spikes, observable.

**Mitigation**: Per-call timeout on the MP fetch (5s recommended). Don't let one bad call block the whole batch — use `Promise.allSettled` if processing batch in parallel (future optimization).

### 5.5 Subscription cancelled by user mid-poll

**Scenario**: User opens MP checkout, then cancels. MP returns `cancelled` status.

**Behavior**: Cron polls, gets `cancelled`. Calls `transitionSubscriptionToFailed`. Marks job `succeeded` (job completed its purpose — final status reached). Sub transitions to terminal failed state, user can retry.

**Test**: E2E test with MP stub returning `cancelled`.

### 5.6 Two start-paid calls for same customer (idempotency)

**Scenario**: User clicks "Pay" twice rapidly, two preapprovals created, two polling jobs enqueued.

**Behavior**: The `UNIQUE WHERE status='pending'` index on `subscription_id` prevents duplicate jobs PER SUBSCRIPTION. But two different subs would each have their own job. Existing idempotency in `start-paid` (via `Idempotency-Key` header) should prevent two subs from being created in the first place. Polling layer trusts that.

### 5.7 Restart of API mid-poll

**Scenario**: Cron worker processing a job, API restarts before job completes.

**Behavior**: The version-checked UPDATE was committed before the MP call. The MP call may have completed or not. Next cron tick re-fetches the job (still status `pending` because nothing wrote terminal). Re-polls MP. Idempotent because terminal state in DB is also idempotent.

**Improvement (future)**: Add `processing_started_at` column with TTL — if a job has been in-progress for > 5 min without completion, mark as orphaned and reset for re-pickup.

### 5.8 Subscription cancelled by user (Hospeda UI) after poll started

**Scenario**: User cancels the subscription from /mi-cuenta before MP authorizes the preapproval.

**Behavior**: Cancel handler should mark the polling job as `cancelled` so cron stops polling. If the poll fires before cancel landing, MP returns whatever status (probably still `pending` or `authorized` depending on timing). Cron tries to transition sub, sees sub is in `cancelled` state, no-ops.

**Test**: E2E test cancelling mid-flight.

---

## 6. Testing strategy

### 6.1 Unit tests

- `pollSubscriptionStatus` against mocked MP responses (all status combinations: authorized, pending, cancelled, rejected, error).
- `normalizeStatus` for each raw status value.
- `suggestPollInterval` returns expected values.

**File**: `qzpay-mercadopago/test/adapters/subscription.adapter.test.ts` (extend existing)

### 6.2 Integration tests

- Cron job processing 10 due jobs in batch, asserting state transitions.
- Concurrent webhook + poll race (use Promise.all and assert exactly one transition).
- Job timeout after maxAttempts.
- Optimistic locking conflict (two workers picking same job).

**File**: `apps/api/test/cron/subscription-poll.job.test.ts` (NEW)

### 6.3 E2E tests

- Full flow: start-paid → checkout → pay → poll → sub becomes active. With MP stub returning `pending` for 2 polls, then `authorized`.
- Webhook arrives first: poll job marked `succeeded` without redundant transition.
- Cancelled by user mid-flight.

**File**: `apps/api/test/e2e/flows/billing/polling-fallback.test.ts` (NEW)

### 6.4 Manual staging smoke

- After deploy, run smoke 1.1 with TEST credentials. Expect sub to flip to active within ~60s of payment without depending on `subscription_preapproval.created` webhook.
- Verify in DB: polling job for the sub transitions from `pending` to `succeeded`.

---

## 7. Migration and rollout

### 7.1 Migration

- DB migration adds `billing_subscription_polling_jobs` table. Pure additive change, no risk to existing records.
- No data backfill needed — only new subscriptions get polling jobs.

### 7.2 Feature flag

Add `HOSPEDA_BILLING_POLLING_ENABLED` env var (default: `true`):

- When `false`: `start-paid` skips `schedulePolling()` call, cron job runs but processes 0 jobs.
- When `true`: full behavior.

This gives us a kill switch if polling causes issues in prod without redeploying.

### 7.3 Rollout sequence

1. Ship migration + code with flag `false` in prod.
2. Enable in staging, verify.
3. Enable in prod after 24-48h soak in staging.

### 7.4 Backfill of in-flight subs (optional)

If we have subscriptions stuck in `incomplete` from before the feature shipped:

```sql
INSERT INTO billing_subscription_polling_jobs (subscription_id, provider, provider_resource_id, next_poll_at)
SELECT id, 'mercadopago', provider_subscription_id, now()
FROM billing_subscriptions
WHERE status = 'incomplete'
  AND created_at > now() - interval '1 day'
  AND provider_subscription_id IS NOT NULL;
```

Run once after deploy. Cron picks them up on next iteration.

---

## 8. Performance and observability

### 8.1 Expected load

- Polling frequency per job: every 30s.
- Average in-flight time per sub: <2 min (MP typically authorizes in seconds when it works).
- Concurrent in-flight subs: estimated < 20 at any time in beta.
- DB scans: 1 per 30s, indexed on `(status, next_poll_at)`. Negligible.
- MP API calls: ~40 calls/min worst case in beta. Well under MP rate limits.

### 8.2 Observability

**Logs** (use existing `apiLogger`):

- INFO when batch starts (`count` of due jobs).
- INFO on each terminal transition (`subscriptionId`, `finalStatus`, `attempts`).
- WARN on MP API errors (`error`, `attempts`, `nextRetryAt`).
- ERROR on unexpected exceptions (job processing crashes).

**Metrics** (if Sentry / OTel are configured):

- `billing.polling.jobs.due` — gauge, count of pending jobs with `next_poll_at` overdue (shouldn't be > batch size at any tick).
- `billing.polling.transitions.success` — counter of subs transitioned to active via polling.
- `billing.polling.transitions.webhook_won` — counter of jobs marked `succeeded` because webhook arrived first.
- `billing.polling.timeouts` — counter of jobs reaching max attempts.
- `billing.polling.errors` — counter of MP API errors.

**Alerts**:

- If `billing.polling.jobs.due` is > 100 (stuck queue), alert.
- If success rate via polling drops below 80% over 1 hour, alert.

### 8.3 Manual debugging queries

```sql
-- All in-flight polling jobs
SELECT j.*, s.status AS sub_status
FROM billing_subscription_polling_jobs j
JOIN billing_subscriptions s ON s.id = j.subscription_id
WHERE j.status = 'pending'
ORDER BY j.next_poll_at;

-- Recent successful polls (last hour)
SELECT * FROM billing_subscription_polling_jobs
WHERE status = 'succeeded'
  AND completed_at > now() - interval '1 hour'
ORDER BY completed_at DESC;

-- Failed / timeout polls (need investigation)
SELECT * FROM billing_subscription_polling_jobs
WHERE status IN ('failed', 'timeout')
  AND completed_at > now() - interval '1 day'
ORDER BY completed_at DESC;
```

---

## 9. Open questions

1. **Should polling run for ALL paid subscriptions, or only those without recent webhook activity?** Default: all. Refinement could skip subs where a `subscription_preapproval.*` webhook arrived in the last 60s (saves MP API calls). Defer to v2.
2. **Cancellation polling**: should we also poll for `subscription_cancelled` events (e.g., user cancels in MP), or trust the webhook? Default: trust webhook for cancel, polling only for the initial authorization. Reduces complexity.
3. **Per-tenant polling limits**: if Hospeda ever multitenants, polling rates need per-tenant caps. Out of scope for v1.
4. **Stripe parity**: when Stripe gets added as secondary adapter, do we also enable polling? Stripe webhooks are reliable, default off. Adapter not implementing `pollSubscriptionStatus` = no-op.

---

## 10. Implementation checklist

Once design is approved, implementation breaks down to:

- [ ] **T-1**: DB migration — add `billing_subscription_polling_jobs` table, indexes.
- [ ] **T-2**: `qzpay-core` — extend `SubscriptionAdapter` type with optional `pollSubscriptionStatus`. Add `schedulePolling` method to `billing.subscriptions`.
- [ ] **T-3**: `qzpay-core` storage adapter interface — add `pollingJobs` CRUD methods.
- [ ] **T-4**: `qzpay-drizzle` — implement `pollingJobs` CRUD against the new table.
- [ ] **T-5**: `qzpay-mercadopago` — implement `pollSubscriptionStatus`, `normalizeStatus`, `suggestPollInterval`. Add unit tests.
- [ ] **T-6**: `qzpay-mercadopago` — publish minor version bump (1.9.0 or 2.1.0).
- [ ] **T-7**: Hospeda — `apps/api/src/cron/jobs/subscription-poll.job.ts` cron job + register in `cron/jobs/index.ts` and `cron/schedules.manifest.ts`.
- [ ] **T-8**: Hospeda — modify `start-paid.ts` to call `schedulePolling()` after sub creation.
- [ ] **T-9**: Hospeda — modify `webhook subscription_preapproval` handler to mark polling job `succeeded`.
- [ ] **T-10**: Hospeda — add `HOSPEDA_BILLING_POLLING_ENABLED` env var to registry + `apps/api/src/utils/env.ts` Zod schema.
- [ ] **T-11**: Tests — unit (qzpay), integration (Hospeda cron), E2E (full flow with MP stub).
- [ ] **T-12**: Documentation — update `apps/api/docs/cron-system.md`, add `docs/billing/polling-fallback.md`.
- [ ] **T-13**: Staging deploy + smoke 1.1 retry with TEST creds + polling enabled.
- [ ] **T-14**: Prod deploy with flag `false` first; flag `true` after staging soak.

Estimated total: 8-12 hours focused work + review/iteration.

---

## 11. Approval gate

Before implementing, this design needs sign-off from qazuor on:

- [ ] Architecture choice: cron-based table queue vs BullMQ
- [ ] Polling interval: 30s default with adapter-suggested overrides
- [ ] Timeout: 30 min (60 attempts × 30s) default
- [ ] Feature flag approach: `HOSPEDA_BILLING_POLLING_ENABLED`
- [ ] Rollout sequence: staging → 24-48h soak → prod

Open the discussion in a PR or sync session.
