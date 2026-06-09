/**
 * Finalize-cancelled-subs cron e2e (SPEC-147 T-013).
 *
 * Tests the `finalizeCancelledSubsJob.handler` end-to-end against a real
 * Postgres DB. Four scenarios:
 *
 *   FINALIZE: seed active+cancelAtPeriodEnd=true sub with period_end in the
 *   PAST and an active addon → run handler → status='cancelled' (UK 2 L's),
 *   addon revoked, entitlements gone, FINALIZE_CANCELLED_SUB event written.
 *
 *   IDEMPOTENT: run the handler a second time on the same sub → already
 *   cancelled, query returns no rows, result is a clean no-op (processed=0),
 *   no second FINALIZE_CANCELLED_SUB event.
 *
 *   D3: seed active+cancelAtPeriodEnd=true sub with period_end ~3 days out →
 *   run handler → SUBSCRIPTION_ACCESS_ENDING_NOTIF dedup event written; run
 *   again → NOT re-sent (second run sees the dedup event and skips).
 *
 *   GRACE PERIOD (regression test): soft-cancelled sub with period_end=now+3d
 *   MUST NOT be finalized — the lte(currentPeriodEnd, now) SQL predicate
 *   (added in the SPEC-147 bug fix) excludes it. Only the D3 reminder is sent.
 *   This scenario was previously misdocumented as "Pass 1 finalizes it" — that
 *   was the bug, not the correct behaviour.
 *
 *   NOT-DUE: already-cancelled sub is never re-touched by Pass 1 (status='active'
 *   predicate excludes it). Seeded as 'cancelled'; processed=0.
 *
 * NOTE on `findDueSoftCancelledSubs`: the fixed implementation applies ALL four
 * predicates in the SQL WHERE: status='active' AND cancelAtPeriodEnd=true AND
 * currentPeriodEnd<=now AND deletedAt IS NULL. This mirrors the compound WHERE
 * already used by the D3 pass. There is no JS post-filter.
 *
 * How D3 send is asserted: `sendNotification` is fire-and-forget and depends
 * on Redis/BREVO which are unavailable in the test environment. The dedup guard
 * writes a `SUBSCRIPTION_ACCESS_ENDING_NOTIF` billing event synchronously
 * BEFORE the fire-and-forget send. Asserting the presence of this event is
 * the canonical D3 "sent" signal — mirrors the TRIAL_PRE_END_NOTIF_D3 pattern
 * from trial-lifecycle tests.
 *
 * @module test/e2e/flows/billing/subscription-cancel-finalize
 */

import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// Step 1: hoist stub ref so the vi.mock factory can close over it.
// ---------------------------------------------------------------------------

const stubRef = vi.hoisted(() => ({
    current: null as unknown
}));

// ---------------------------------------------------------------------------
// Step 2: intercept @repo/billing so the billing middleware never reaches the
// real MP adapter. The finalize cron path does NOT call the payment adapter
// (the preapproval was already paused at soft-cancel time), but the billing
// singleton is still initialised eagerly at app boot — without the stub that
// initialisation tries to reach the MP network.
// ---------------------------------------------------------------------------

vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return {
        ...actual,
        createMercadoPagoAdapter: () => {
            if (stubRef.current === null) {
                throw new Error(
                    'mp-stub adapter not initialized — subscription-cancel-finalize.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

// ---------------------------------------------------------------------------
// Step 3: mock notification-helper so sendNotification no-ops instead of
// trying to reach Brevo/Redis in the test environment. We spy on it so tests
// can assert call count and payload when needed.
// ---------------------------------------------------------------------------

const sendNotificationSpy = vi.hoisted(() =>
    vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
);

vi.mock('../../../../src/utils/notification-helper.js', () => ({
    sendNotification: sendNotificationSpy
}));

import { randomUUID } from 'node:crypto';
import { and, billingSubscriptionEvents, billingSubscriptions, eq, sql } from '@repo/db';
import { Hono } from 'hono';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { finalizeCancelledSubsJob } from '../../../../src/cron/jobs/finalize-cancelled-subs.js';
import { resetBillingInstance } from '../../../../src/middlewares/billing.js';
import {
    clearEntitlementCache,
    entitlementMiddleware
} from '../../../../src/middlewares/entitlement.js';
import {
    createTestBillingCustomer,
    createTestSubscription
} from '../../helpers/billing-factories.js';
import { createMpStubAdapter } from '../../helpers/mp-stub.js';
import { createTestUser, seedBillingTestPlans } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

/** Canonical addon slug with entitlements (mirrors addon-expiration-cron.test.ts). */
const ADDON_SLUG = 'visibility-boost-7d';

/**
 * Insert an active `billing_addon_purchases` row for the given subscription.
 * Uses raw SQL — same workaround as addon-expiration-cron.test.ts because the
 * typed factory doesn't expose billing_addon_purchases yet.
 */
async function seedActiveAddonPurchase(input: {
    readonly customerId: string;
    readonly subscriptionId: string;
}): Promise<string> {
    const purchaseId = randomUUID();
    await testDb.getDb().execute(sql`
        INSERT INTO billing_addon_purchases (
            id, customer_id, subscription_id, addon_slug,
            status, purchased_at,
            limit_adjustments, entitlement_adjustments, metadata
        ) VALUES (
            ${purchaseId}, ${input.customerId}, ${input.subscriptionId}, ${ADDON_SLUG},
            'active', NOW(),
            ${'[]'}::jsonb, ${'[]'}::jsonb, ${'{}'}::jsonb
        )
    `);
    return purchaseId;
}

/**
 * Query the status of a billing_addon_purchases row.
 */
async function fetchAddonPurchaseStatus(purchaseId: string): Promise<string | null> {
    const rows = (
        await testDb.getDb().execute(sql`
            SELECT status FROM billing_addon_purchases WHERE id = ${purchaseId}
        `)
    ).rows as Array<{ status: string }>;
    return rows[0]?.status ?? null;
}

// ---------------------------------------------------------------------------
// Stub setup: construct once per file.
// ---------------------------------------------------------------------------

const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

/** One day in milliseconds. */
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Build a minimal CronJobContext for direct handler invocation. Mirrors the
 * shape from plan-downgrade-cron.test.ts. Logs are captured per test so
 * individual assertions can inspect what the cron emitted.
 */
function makeCronCtx() {
    const logs = {
        info: [] as Array<{ message: string; data?: Record<string, unknown> }>,
        warn: [] as Array<{ message: string; data?: Record<string, unknown> }>,
        error: [] as Array<{ message: string; data?: Record<string, unknown> }>,
        debug: [] as Array<{ message: string; data?: Record<string, unknown> }>
    };
    const ctx = {
        logger: {
            info: (message: string, data?: Record<string, unknown>) => {
                logs.info.push({ message, data });
            },
            warn: (message: string, data?: Record<string, unknown>) => {
                logs.warn.push({ message, data });
            },
            error: (message: string, data?: Record<string, unknown>) => {
                logs.error.push({ message, data });
            },
            debug: (message: string, data?: Record<string, unknown>) => {
                logs.debug.push({ message, data });
            }
        },
        startedAt: new Date(),
        dryRun: false
    };
    return { ctx, logs };
}

describe('SPEC-147 T-013 — finalize-cancelled-subs cron e2e', () => {
    let _app: ReturnType<typeof initApp>;

    // Seeded per-test
    let customerId: string;
    let subscriptionId: string;
    let cheapPlanId: string;

    beforeAll(async () => {
        await testDb.setup();
        resetBillingInstance();
        _app = initApp();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    beforeEach(async () => {
        mpStub.config.reset();
        sendNotificationSpy.mockClear();

        const seed = await seedBillingTestPlans();
        cheapPlanId = seed.cheap.planId;

        const user = await createTestUser({
            email: `spec147-finalize-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
        });

        const customer = await createTestBillingCustomer({
            externalId: user.id,
            email: user.email
        });
        customerId = customer.customerId;
    });

    afterEach(async () => {
        clearEntitlementCache(customerId);
        await testDb.clean();
    });

    // -------------------------------------------------------------------------
    // Probe app helper: minimal Hono app running the real entitlementMiddleware.
    // Mirrors the pattern from subscription-cancel.test.ts and plan-downgrade-cron.test.ts.
    // -------------------------------------------------------------------------

    function buildProbeApp(): Hono {
        const probeApp = new Hono();
        probeApp.use((c, next) => {
            c.set('billingEnabled', true);
            c.set('billingCustomerId', customerId);
            return next();
        });
        probeApp.use(entitlementMiddleware());
        probeApp.get('/probe', (c) =>
            c.json({
                entitlements: Array.from(c.get('userEntitlements') ?? []),
                limits: Object.fromEntries(c.get('userLimits') ?? new Map()),
                billingLoadFailed: c.get('billingLoadFailed') ?? false
            })
        );
        return probeApp;
    }

    // =========================================================================
    // SCENARIO 1: FINALIZE
    // Soft-cancelled sub whose period_end is in the past gets finalized:
    // status flipped to 'cancelled', addon revoked, entitlements gone,
    // FINALIZE_CANCELLED_SUB event written.
    // =========================================================================

    it('FINALIZE — soft-cancelled sub with past period_end: status=cancelled, addon revoked, entitlements gone, FINALIZE_CANCELLED_SUB event', async () => {
        // ARRANGE: seed a sub with cancelAtPeriodEnd=true and currentPeriodEnd
        // 60 seconds in the past so it is considered due for finalization.
        const now = Date.now();
        const periodStart = new Date(now - 31 * ONE_DAY_MS);
        const periodEnd = new Date(now - 60 * 1000); // 60 seconds ago

        const sub = await createTestSubscription({
            customerId,
            planId: cheapPlanId,
            status: 'active',
            billingInterval: 'month',
            intervalCount: 1,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            metadata: { source: 'spec147-finalize-test' }
        });
        subscriptionId = sub.subscriptionId;

        // Mark as soft-cancelled (cancelAtPeriodEnd=true + canceledAt stamped)
        await testDb
            .getDb()
            .update(billingSubscriptions)
            .set({
                cancelAtPeriodEnd: true,
                canceledAt: new Date(now - ONE_DAY_MS),
                updatedAt: new Date()
            })
            .where(eq(billingSubscriptions.id, subscriptionId));

        // Attach an active addon purchase so we can assert addon revocation.
        // Uses the raw SQL helper (same workaround as addon-expiration-cron.test.ts —
        // the typed factory doesn't expose billing_addon_purchases yet).
        const addonPurchaseId = await seedActiveAddonPurchase({
            customerId,
            subscriptionId
        });

        // ASSERT PRE-STATE: sub is active, addon purchase exists with status='active'.
        const preRows = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, subscriptionId));
        expect(preRows[0]?.status).toBe('active');
        expect(preRows[0]?.cancelAtPeriodEnd).toBe(true);

        const preAddonStatus = await fetchAddonPurchaseStatus(addonPurchaseId);
        expect(preAddonStatus).toBe('active');

        clearEntitlementCache(customerId);
        const preProbeRes = await buildProbeApp().request('/probe');
        const preProbeBody = (await preProbeRes.json()) as {
            readonly entitlements: readonly string[];
            readonly billingLoadFailed: boolean;
        };
        // The cheap plan's entitlements still load because the sub is 'active'.
        expect(preProbeBody.entitlements.length).toBeGreaterThan(0);
        expect(preProbeBody.billingLoadFailed).toBe(false);

        // ACT: invoke the cron handler directly.
        const { ctx, logs } = makeCronCtx();
        const result = await finalizeCancelledSubsJob.handler(ctx);

        // ASSERT: cron result. One subscription finalized, no errors.
        expect(result.success).toBe(true);
        expect(result.processed).toBe(1);
        expect(result.errors).toBe(0);
        expect(result.details).toMatchObject({ finalized: 1, errors: 0, due: 1 });
        expect(result.message).toContain('Finalized 1');

        // ASSERT: cron logged the finalized message.
        const finalizeLog = logs.info.find(
            (l) => l.message === 'finalize-cancelled-subs: subscription finalized'
        );
        expect(finalizeLog).toBeDefined();
        expect(finalizeLog?.data).toMatchObject({
            subscriptionId,
            customerId
        });

        // ASSERT: DB — status flipped to 'cancelled' (UK spelling, 2 L's).
        const postRows = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, subscriptionId));
        expect(postRows[0]?.status).toBe('cancelled');

        // ASSERT: FINALIZE_CANCELLED_SUB audit event written.
        const events = await testDb
            .getDb()
            .select()
            .from(billingSubscriptionEvents)
            .where(eq(billingSubscriptionEvents.subscriptionId, subscriptionId));
        const finalizeEvent = events.find((e) => e.eventType === 'FINALIZE_CANCELLED_SUB');
        expect(finalizeEvent).toBeDefined();
        expect(finalizeEvent?.triggerSource).toBe('finalize-cancelled-cron');
        expect(finalizeEvent?.previousStatus).toBe('active');
        expect(finalizeEvent?.newStatus).toBe('cancelled');
        const eventMeta = finalizeEvent?.metadata as Record<string, unknown> | null;
        expect(eventMeta?.finalizedAt).toBeDefined();

        // ASSERT: addon purchase revoked — handleSubscriptionCancellationAddons
        // flips the billing_addon_purchases.status to 'canceled' (US spelling, 1 L).
        const postAddonStatus = await fetchAddonPurchaseStatus(addonPurchaseId);
        expect(postAddonStatus).toBe('canceled');

        // ASSERT: entitlements GONE — cache was cleared by the cron (Step 4),
        // the next entitlement load sees a cancelled subscription and falls back
        // to the tourist-free baseline (no plan entitlements).
        clearEntitlementCache(customerId);
        const postProbeRes = await buildProbeApp().request('/probe');
        const postProbeBody = (await postProbeRes.json()) as {
            readonly entitlements: readonly string[];
            readonly limits: Readonly<Record<string, number>>;
            readonly billingLoadFailed: boolean;
        };
        // After cancellation, the billing middleware should not find an active
        // subscription, so plan entitlements are absent. Tourist-free baseline
        // grants the minimal set. We assert on the ABSENCE of paid-plan features
        // rather than an exact set to avoid brittleness when the free baseline
        // changes (it includes save_favorites, write_reviews, read_reviews,
        // can_view_recommendations, ai_chat, ai_search as of this test run).
        expect(postProbeBody.entitlements).not.toContain('publish_accommodations');
        expect(postProbeBody.entitlements).not.toContain('view_advanced_stats');
        expect(postProbeBody.entitlements).toContain('save_favorites');
        expect(postProbeBody.entitlements).toContain('read_reviews');
        expect(postProbeBody.limits).toMatchObject({ max_favorites: 3 });
        expect(postProbeBody.billingLoadFailed).toBe(false);
    });

    // =========================================================================
    // SCENARIO 2: IDEMPOTENT
    // Running the handler a second time on an already-cancelled subscription
    // produces a clean no-op: the query returns no 'active' rows for that sub,
    // result.processed=0, no duplicate FINALIZE_CANCELLED_SUB event.
    // =========================================================================

    it('IDEMPOTENT — second handler run after finalization is a clean no-op', async () => {
        // ARRANGE: same setup as the FINALIZE scenario.
        const now = Date.now();
        const periodEnd = new Date(now - 60 * 1000);

        const sub = await createTestSubscription({
            customerId,
            planId: cheapPlanId,
            status: 'active',
            billingInterval: 'month',
            intervalCount: 1,
            currentPeriodStart: new Date(now - 31 * ONE_DAY_MS),
            currentPeriodEnd: periodEnd,
            metadata: { source: 'spec147-idempotency-test' }
        });
        subscriptionId = sub.subscriptionId;

        await testDb
            .getDb()
            .update(billingSubscriptions)
            .set({
                cancelAtPeriodEnd: true,
                canceledAt: new Date(now - ONE_DAY_MS),
                updatedAt: new Date()
            })
            .where(eq(billingSubscriptions.id, subscriptionId));

        // First run: finalize the sub.
        const { ctx: firstCtx } = makeCronCtx();
        const firstResult = await finalizeCancelledSubsJob.handler(firstCtx);
        expect(firstResult.success).toBe(true);
        expect(firstResult.processed).toBe(1);
        expect(firstResult.details).toMatchObject({ finalized: 1, errors: 0, due: 1 });

        // Snapshot: sub is now 'cancelled', one FINALIZE_CANCELLED_SUB event.
        const afterFirstRows = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, subscriptionId));
        expect(afterFirstRows[0]?.status).toBe('cancelled');

        const afterFirstEvents = await testDb
            .getDb()
            .select()
            .from(billingSubscriptionEvents)
            .where(
                and(
                    eq(billingSubscriptionEvents.subscriptionId, subscriptionId),
                    eq(billingSubscriptionEvents.eventType, 'FINALIZE_CANCELLED_SUB')
                )
            );
        expect(afterFirstEvents).toHaveLength(1);

        // ACT: second run.
        const { ctx: secondCtx } = makeCronCtx();
        const secondResult = await finalizeCancelledSubsJob.handler(secondCtx);

        // ASSERT: second run is a clean no-op — the sub is now 'cancelled',
        // not in the 'active' query window, so processed=0 with success=true.
        expect(secondResult.success).toBe(true);
        expect(secondResult.processed).toBe(0);
        expect(secondResult.errors).toBe(0);
        expect(secondResult.details).toMatchObject({ finalized: 0, errors: 0, due: 0 });

        // ASSERT: sub status unchanged (still 'cancelled'), no duplicate event.
        const afterSecondRows = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, subscriptionId));
        expect(afterSecondRows[0]?.status).toBe('cancelled');

        const afterSecondEvents = await testDb
            .getDb()
            .select()
            .from(billingSubscriptionEvents)
            .where(
                and(
                    eq(billingSubscriptionEvents.subscriptionId, subscriptionId),
                    eq(billingSubscriptionEvents.eventType, 'FINALIZE_CANCELLED_SUB')
                )
            );
        // CRITICAL: exactly ONE finalize event, not two. The idempotency gate
        // is the status flip — once 'cancelled', the row never re-appears in
        // the 'active' query.
        expect(afterSecondEvents).toHaveLength(1);
        // resolvedAt / metadata on the first event must be unchanged.
        const firstEventMeta = afterFirstEvents[0]?.metadata as Record<string, unknown> | null;
        const secondEventMeta = afterSecondEvents[0]?.metadata as Record<string, unknown> | null;
        expect(secondEventMeta?.finalizedAt).toBe(firstEventMeta?.finalizedAt);
    });

    // =========================================================================
    // SCENARIO 3: GRACE PERIOD PRESERVED — sub with future period_end stays ACTIVE
    //
    // REGRESSION test for the finalize-cancelled-subs bug (SPEC-147):
    // The original findDueSoftCancelledSubs only filtered status='active' in SQL
    // with no cancelAtPeriodEnd or currentPeriodEnd guards. Any active soft-
    // cancelled sub was finalized at the next 4:30 AM run, destroying the grace
    // period regardless of how much time remained.
    //
    // With the fix, ALL four predicates are in the SQL WHERE:
    //   status='active' AND cancelAtPeriodEnd=true AND currentPeriodEnd<=now AND deletedAt IS NULL
    //
    // This test proves: a sub with period_end=now+3d MUST NOT be finalized by
    // Pass 1 (the lte(currentPeriodEnd, now) predicate excludes it). Pass 1
    // returns processed=0 for it. Pass 2 (D3 window) WILL pick it up and write
    // the SUBSCRIPTION_ACCESS_ENDING_NOTIF event.
    // =========================================================================

    it('GRACE PERIOD — soft-cancelled sub with period_end=now+3d is NOT finalized (stays active, only D3 reminder sent)', async () => {
        // ARRANGE: sub with period_end 3 days in the future — grace period active.
        const now = Date.now();
        const periodEnd = new Date(now + 3 * ONE_DAY_MS);

        const sub = await createTestSubscription({
            customerId,
            planId: cheapPlanId,
            status: 'active',
            billingInterval: 'month',
            intervalCount: 1,
            currentPeriodStart: new Date(now - 27 * ONE_DAY_MS),
            currentPeriodEnd: periodEnd,
            metadata: { source: 'spec147-grace-period-test' }
        });
        subscriptionId = sub.subscriptionId;

        // Mark as soft-cancelled (cancelAtPeriodEnd=true).
        await testDb
            .getDb()
            .update(billingSubscriptions)
            .set({
                cancelAtPeriodEnd: true,
                canceledAt: new Date(now - ONE_DAY_MS),
                updatedAt: new Date()
            })
            .where(eq(billingSubscriptions.id, subscriptionId));

        // ASSERT PRE-STATE: sub is active with a future period_end.
        const preRows = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, subscriptionId));
        expect(preRows[0]?.status).toBe('active');
        expect(preRows[0]?.cancelAtPeriodEnd).toBe(true);
        expect(preRows[0]?.currentPeriodEnd?.getTime()).toBeGreaterThan(now);

        // ACT: run the cron handler.
        const { ctx } = makeCronCtx();
        const result = await finalizeCancelledSubsJob.handler(ctx);

        // ASSERT Pass 1: the sub was NOT finalized. The lte(currentPeriodEnd, now)
        // predicate excludes it because period_end=now+3d is in the future.
        // processed=0 means Pass 1 found nothing to finalize.
        expect(result.success).toBe(true);
        expect(result.processed).toBe(0);
        expect(result.errors).toBe(0);
        expect(result.details).toMatchObject({ finalized: 0, errors: 0, due: 0 });

        // ASSERT DB: sub status is still 'active' — grace period was NOT destroyed.
        const postRows = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, subscriptionId));
        expect(postRows[0]?.status).toBe('active');

        // ASSERT: no FINALIZE_CANCELLED_SUB event was written.
        const finalizeEvents = await testDb
            .getDb()
            .select()
            .from(billingSubscriptionEvents)
            .where(
                and(
                    eq(billingSubscriptionEvents.subscriptionId, subscriptionId),
                    eq(billingSubscriptionEvents.eventType, 'FINALIZE_CANCELLED_SUB')
                )
            );
        expect(finalizeEvents).toHaveLength(0);

        // ASSERT Pass 2 (D3): the sub IS in the [+2d, +4d] window, so Pass 2
        // writes the SUBSCRIPTION_ACCESS_ENDING_NOTIF dedup event.
        // We wait a tick so the fire-and-forget promise chain settles.
        await new Promise((resolve) => setTimeout(resolve, 50));

        const d3Events = await testDb
            .getDb()
            .select()
            .from(billingSubscriptionEvents)
            .where(
                and(
                    eq(billingSubscriptionEvents.subscriptionId, subscriptionId),
                    eq(billingSubscriptionEvents.eventType, 'SUBSCRIPTION_ACCESS_ENDING_NOTIF')
                )
            );
        expect(d3Events).toHaveLength(1);
        expect(d3Events[0]?.triggerSource).toBe('finalize-cancelled-cron');
    });

    // =========================================================================
    // SCENARIO 3b: D3 REMINDER via internal helper
    // The sendAccessEndingReminders helper is tested directly to avoid the
    // Pass 1 vs Pass 2 conflict documented in scenario 3 above. This is the
    // canonical D3 assertion scenario.
    // =========================================================================

    it('D3 internal — sendAccessEndingReminders writes SUBSCRIPTION_ACCESS_ENDING_NOTIF and deduplicates on second call', async () => {
        // Import the internal helper exposed for unit-test surface.
        const { _internals } = await import('../../../../src/cron/jobs/finalize-cancelled-subs.js');

        // ARRANGE: sub with period_end 3 days from now, in the [+2d, +4d] D3 window.
        const now = Date.now();
        const periodEnd = new Date(now + 3 * ONE_DAY_MS);

        const sub = await createTestSubscription({
            customerId,
            planId: cheapPlanId,
            status: 'active',
            billingInterval: 'month',
            intervalCount: 1,
            currentPeriodStart: new Date(now - 27 * ONE_DAY_MS),
            currentPeriodEnd: periodEnd,
            metadata: { source: 'spec147-d3-internal-test' }
        });
        subscriptionId = sub.subscriptionId;

        // Mark as soft-cancelled so the D3 query picks it up.
        await testDb
            .getDb()
            .update(billingSubscriptions)
            .set({
                cancelAtPeriodEnd: true,
                canceledAt: new Date(now - ONE_DAY_MS),
                updatedAt: new Date()
            })
            .where(eq(billingSubscriptions.id, subscriptionId));

        // Verify no dedup event exists yet.
        const preDedupEvents = await testDb
            .getDb()
            .select()
            .from(billingSubscriptionEvents)
            .where(
                and(
                    eq(billingSubscriptionEvents.subscriptionId, subscriptionId),
                    eq(billingSubscriptionEvents.eventType, 'SUBSCRIPTION_ACCESS_ENDING_NOTIF')
                )
            );
        expect(preDedupEvents).toHaveLength(0);

        const { logs: firstLogs, ctx: firstCtx } = makeCronCtx();

        // ACT: first call to the D3 helper directly.
        await _internals.sendAccessEndingReminders(firstCtx.logger);

        // ASSERT: SUBSCRIPTION_ACCESS_ENDING_NOTIF dedup event written.
        // This is the canonical "reminder sent" signal — the event is written
        // synchronously before the fire-and-forget sendNotification call.
        const postFirstEvents = await testDb
            .getDb()
            .select()
            .from(billingSubscriptionEvents)
            .where(
                and(
                    eq(billingSubscriptionEvents.subscriptionId, subscriptionId),
                    eq(billingSubscriptionEvents.eventType, 'SUBSCRIPTION_ACCESS_ENDING_NOTIF')
                )
            );
        expect(postFirstEvents).toHaveLength(1);
        expect(postFirstEvents[0]?.triggerSource).toBe('finalize-cancelled-cron');
        const dedupMeta = postFirstEvents[0]?.metadata as Record<string, unknown> | null;
        expect(typeof dedupMeta?.daysRemaining).toBe('number');
        expect(dedupMeta?.sentAt).toBeDefined();

        // ASSERT: logger recorded the reminder-sent info entry.
        const reminderLog = firstLogs.info.find(
            (l) => l.message === 'finalize-cancelled-subs D3: reminder sent'
        );
        expect(reminderLog).toBeDefined();
        expect(reminderLog?.data).toMatchObject({
            subscriptionId,
            customerId
        });

        // ASSERT: sendNotification spy was called for this sub (attempt was made).
        // The mock resolves immediately without actually reaching Brevo/Redis.
        expect(sendNotificationSpy).toHaveBeenCalledTimes(1);
        const notifCall = sendNotificationSpy.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(notifCall?.type).toBe('subscription_access_ending_soon');
        expect(notifCall?.customerId).toBe(customerId);
        expect(notifCall?.idempotencyKey).toBe(`sub-access-ending-d3-${subscriptionId}`);

        // ACT: second call — dedup guard must prevent re-send.
        sendNotificationSpy.mockClear();
        const { ctx: secondCtx } = makeCronCtx();
        await _internals.sendAccessEndingReminders(secondCtx.logger);

        // ASSERT: no new dedup event — still exactly 1 row.
        const postSecondEvents = await testDb
            .getDb()
            .select()
            .from(billingSubscriptionEvents)
            .where(
                and(
                    eq(billingSubscriptionEvents.subscriptionId, subscriptionId),
                    eq(billingSubscriptionEvents.eventType, 'SUBSCRIPTION_ACCESS_ENDING_NOTIF')
                )
            );
        expect(postSecondEvents).toHaveLength(1);

        // ASSERT: sendNotification NOT called again — the dedup guard skipped
        // the sub before reaching the send path.
        expect(sendNotificationSpy).toHaveBeenCalledTimes(0);
    });

    // =========================================================================
    // SCENARIO 4: NOT-DUE (already-cancelled sub is never re-touched)
    // A subscription already in 'cancelled' status is not in the 'active'
    // query window — the cron handler produces a clean no-op for it.
    // =========================================================================

    it('NOT-DUE — already-cancelled sub is skipped; handler returns processed=0', async () => {
        // ARRANGE: seed a sub that is already 'cancelled'.
        const now = Date.now();

        const sub = await createTestSubscription({
            customerId,
            planId: cheapPlanId,
            status: 'cancelled',
            billingInterval: 'month',
            intervalCount: 1,
            currentPeriodStart: new Date(now - 31 * ONE_DAY_MS),
            currentPeriodEnd: new Date(now - ONE_DAY_MS),
            metadata: { source: 'spec147-not-due-test' }
        });
        subscriptionId = sub.subscriptionId;

        // Sanity: sub is 'cancelled', no finalize events.
        const preRows = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, subscriptionId));
        expect(preRows[0]?.status).toBe('cancelled');

        const preEvents = await testDb
            .getDb()
            .select()
            .from(billingSubscriptionEvents)
            .where(
                and(
                    eq(billingSubscriptionEvents.subscriptionId, subscriptionId),
                    eq(billingSubscriptionEvents.eventType, 'FINALIZE_CANCELLED_SUB')
                )
            );
        expect(preEvents).toHaveLength(0);

        // ACT: run the cron handler.
        const { ctx } = makeCronCtx();
        const result = await finalizeCancelledSubsJob.handler(ctx);

        // ASSERT: clean no-op — the 'cancelled' sub is not in the 'active'
        // query window. processed=0, success=true.
        expect(result.success).toBe(true);
        expect(result.processed).toBe(0);
        expect(result.errors).toBe(0);
        expect(result.details).toMatchObject({ finalized: 0, errors: 0, due: 0 });

        // ASSERT: sub status unchanged, no finalize event written.
        const postRows = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, subscriptionId));
        expect(postRows[0]?.status).toBe('cancelled');

        const postEvents = await testDb
            .getDb()
            .select()
            .from(billingSubscriptionEvents)
            .where(
                and(
                    eq(billingSubscriptionEvents.subscriptionId, subscriptionId),
                    eq(billingSubscriptionEvents.eventType, 'FINALIZE_CANCELLED_SUB')
                )
            );
        expect(postEvents).toHaveLength(0);
    });

    // =========================================================================
    // SCENARIO 5: M2 REGRESSION — soft-cancelled past_due sub is finalized
    //
    // A soft-cancelled sub (cancelAtPeriodEnd=true) that went past_due due to
    // a payment failure before period_end was STUCK under the prior 'active'-only
    // query — it was never finalized. This scenario tests the M2 fix: the cron
    // now uses inArray(status, ['active','past_due','trialing']) so a past_due
    // soft-cancelled sub is finalized when its period_end elapses.
    // =========================================================================

    it('M2 REGRESSION — soft-cancelled past_due sub with past period_end is finalized to cancelled', async () => {
        // ARRANGE: seed a sub in 'past_due' with cancelAtPeriodEnd=true and
        // currentPeriodEnd 60 seconds in the past.
        const now = Date.now();
        const periodEnd = new Date(now - 60 * 1000); // 60 seconds ago

        const sub = await createTestSubscription({
            customerId,
            planId: cheapPlanId,
            status: 'past_due',
            billingInterval: 'month',
            intervalCount: 1,
            currentPeriodStart: new Date(now - 31 * ONE_DAY_MS),
            currentPeriodEnd: periodEnd,
            metadata: { source: 'spec147-m2-past-due-test' }
        });
        subscriptionId = sub.subscriptionId;

        // Mark as soft-cancelled (cancelAtPeriodEnd=true).
        await testDb
            .getDb()
            .update(billingSubscriptions)
            .set({
                cancelAtPeriodEnd: true,
                canceledAt: new Date(now - ONE_DAY_MS),
                updatedAt: new Date()
            })
            .where(eq(billingSubscriptions.id, subscriptionId));

        // ASSERT PRE-STATE: sub is past_due, cancelAtPeriodEnd=true.
        const preRows = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, subscriptionId));
        expect(preRows[0]?.status).toBe('past_due');
        expect(preRows[0]?.cancelAtPeriodEnd).toBe(true);

        // ACT: run the cron handler.
        const { ctx, logs } = makeCronCtx();
        const result = await finalizeCancelledSubsJob.handler(ctx);

        // ASSERT: the past_due soft-cancelled sub was finalized.
        expect(result.success).toBe(true);
        expect(result.processed).toBe(1);
        expect(result.errors).toBe(0);
        expect(result.details).toMatchObject({ finalized: 1, errors: 0, due: 1 });

        // ASSERT: DB — status flipped to 'cancelled'.
        const postRows = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, subscriptionId));
        expect(postRows[0]?.status).toBe('cancelled');

        // ASSERT: FINALIZE_CANCELLED_SUB event written with previousStatus='past_due'.
        const events = await testDb
            .getDb()
            .select()
            .from(billingSubscriptionEvents)
            .where(eq(billingSubscriptionEvents.subscriptionId, subscriptionId));
        const finalizeEvent = events.find((e) => e.eventType === 'FINALIZE_CANCELLED_SUB');
        expect(finalizeEvent).toBeDefined();
        expect(finalizeEvent?.previousStatus).toBe('past_due');
        expect(finalizeEvent?.newStatus).toBe('cancelled');
        expect(finalizeEvent?.triggerSource).toBe('finalize-cancelled-cron');

        // ASSERT: cron logged the finalized message.
        const finalizeLog = logs.info.find(
            (l) => l.message === 'finalize-cancelled-subs: subscription finalized'
        );
        expect(finalizeLog).toBeDefined();
        expect(finalizeLog?.data).toMatchObject({ subscriptionId, customerId });
    });
});
