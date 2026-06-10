/**
 * SPEC-148 e2e — cron-lag defensive grace (Part A) + plan-disable lifecycle (Part B).
 *
 * Part A: cron-lag grace (entitlement.ts, BILLING_CRON_LAG_GRACE_HOURS=6)
 *   - Active sub, currentPeriodEnd PAST but within 6h → request ALLOWED,
 *     X-Cron-Lag-Grace-Hours-Remaining header set, entitlements load.
 *   - Active sub, currentPeriodEnd MORE THAN 6h past → request STILL ALLOWED
 *     (never blocked), captureBillingError called with operation='cron_lag_grace_exceeded',
 *     header absent (hoursRemaining=0).
 *   - Active sub, currentPeriodEnd NOT YET past → no cron-lag header, no alert.
 *
 * Part B: plan-disable lifecycle (plan-disable-lifecycle.service.ts, plans.ts, start-paid.ts)
 *   - Admin PATCH toggle active→inactive → all live subs get cancelAtPeriodEnd=true,
 *     PLAN_DISABLED_MIGRATION event per sub, PLAN_DISABLED_BY_ADMIN audit entry with
 *     affectedSubCount, PLAN_BEING_RETIRED notification queued per sub.
 *   - start-paid onto a disabled plan → HTTP 410, error code PLAN_DISABLED.
 *   - finalize-cancelled-subs cron run after period_end → disabled-plan subs cancelled.
 *
 * Harness: mirrors plan-downgrade-cron.test.ts (vi.hoisted + vi.mock, mp-stub,
 * testDb, seed-helpers, mini-app probe for entitlementMiddleware, makeCronCtx).
 *
 * @module test/e2e/flows/billing/spec-148-grace-and-plan-disable
 */

import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist stub ref (captured before any import) + MP mock
// ---------------------------------------------------------------------------

const stubRef = vi.hoisted(() => ({
    current: null as unknown
}));

vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return {
        ...actual,
        createMercadoPagoAdapter: () => {
            if (stubRef.current === null) {
                throw new Error(
                    'mp-stub adapter not initialized — spec-148-grace-and-plan-disable.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

// ---------------------------------------------------------------------------
// Sentry / captureBillingError intercept — allows Part A to assert alert firing
// ---------------------------------------------------------------------------

const captureBillingErrorSpy = vi.hoisted(() => vi.fn());

vi.mock('../../../../src/lib/sentry.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../../src/lib/sentry.js')>();
    return { ...actual, captureBillingError: captureBillingErrorSpy };
});

// ---------------------------------------------------------------------------
// Notification helper mock (Part B — sendNotification is fire-and-forget)
// ---------------------------------------------------------------------------

const sendNotificationSpy = vi.hoisted(() =>
    vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
);

vi.mock('../../../../src/utils/notification-helper.js', () => ({
    sendNotification: sendNotificationSpy
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { billingAuditLogs, billingSubscriptionEvents, billingSubscriptions, eq } from '@repo/db';
import { BILLING_EVENT_TYPES } from '@repo/service-core';
import { Hono } from 'hono';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { finalizeCancelledSubsJob } from '../../../../src/cron/jobs/finalize-cancelled-subs.js';
import { resetBillingInstance } from '../../../../src/middlewares/billing.js';
import {
    clearEntitlementCache,
    entitlementMiddleware
} from '../../../../src/middlewares/entitlement.js';
import { disablePlanLifecycle } from '../../../../src/services/plan-disable-lifecycle.service.js';
import { PlanService } from '../../../../src/services/plan.service.js';
import { createMockUserActor } from '../../../helpers/auth.js';
import { E2EApiClient } from '../../helpers/api-client.js';
import {
    createTestBillingCustomer,
    createTestSubscription
} from '../../helpers/billing-factories.js';
import { createMpStubAdapter } from '../../helpers/mp-stub.js';
import {
    type TestBillingPlansSeed,
    createTestUser,
    seedBillingTestPlans
} from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

// ---------------------------------------------------------------------------
// Stub wiring (once per file)
// ---------------------------------------------------------------------------

const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** One hour in milliseconds. */
const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Build a minimal CronJobContext — mirrors plan-downgrade-cron.test.ts
 * and subscription-cancel-finalize.test.ts. Captures log messages per-test.
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

/**
 * Build the entitlement probe mini-app for a given billingCustomerId.
 * Mirrors the probe pattern from plan-downgrade-cron.test.ts sub-commit 3.
 */
function buildProbeApp(billingCustomerId: string): Hono {
    const probeApp = new Hono();
    probeApp.use((c, next) => {
        c.set('billingEnabled', true);
        c.set('billingCustomerId', billingCustomerId);
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

// ---------------------------------------------------------------------------
// PART A: cron-lag defensive grace
// ---------------------------------------------------------------------------

describe('SPEC-148 Part A — cron-lag defensive grace', () => {
    let _app: ReturnType<typeof initApp>;
    let seed: TestBillingPlansSeed;
    let customerId: string;
    let subscriptionId: string;

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
        captureBillingErrorSpy.mockClear();

        seed = await seedBillingTestPlans();

        const user = await createTestUser({
            email: `spec148-grace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
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

    it('within-window: currentPeriodEnd 2h past → request ALLOWED, X-Cron-Lag-Grace-Hours-Remaining header set, entitlements load', async () => {
        // ARRANGE — active sub with currentPeriodEnd 2 hours in the past (inside
        // the 6h BILLING_CRON_LAG_GRACE_HOURS window). The entitlementMiddleware
        // must set the header and allow the request through (never block).
        const now = Date.now();
        const periodEnd = new Date(now - 2 * ONE_HOUR_MS); // 2h ago — inside window
        const periodStart = new Date(now - 31 * 24 * 60 * 60 * 1000);

        const sub = await createTestSubscription({
            customerId,
            planId: seed.cheap.planId,
            status: 'active',
            billingInterval: 'month',
            intervalCount: 1,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd
        });
        subscriptionId = sub.subscriptionId;

        // Clear any residual cache so the probe forces a fresh loadEntitlements call.
        clearEntitlementCache(customerId);

        // ACT — hit the probe endpoint which mounts entitlementMiddleware.
        const probeApp = buildProbeApp(customerId);
        const res = await probeApp.request('/probe');

        // ASSERT — request is allowed (not 503/403/blocked).
        expect(res.status).toBe(200);

        // ASSERT — entitlements loaded successfully.
        const body = (await res.json()) as {
            readonly entitlements: readonly string[];
            readonly limits: Readonly<Record<string, number>>;
            readonly billingLoadFailed: boolean;
        };
        expect(body.billingLoadFailed).toBe(false);
        expect(body.entitlements.length).toBeGreaterThan(0);

        // ASSERT — cron-lag header is set. hoursRemaining should be ceil(6-2) = 4.
        // We assert presence and numeric validity rather than exact value to avoid
        // clock-tick races (the middleware uses Math.ceil on float hours).
        const gracHeader = res.headers.get('X-Cron-Lag-Grace-Hours-Remaining');
        expect(gracHeader).not.toBeNull();
        const hoursRemaining = Number(gracHeader);
        expect(Number.isInteger(hoursRemaining)).toBe(true);
        expect(hoursRemaining).toBeGreaterThan(0);
        expect(hoursRemaining).toBeLessThanOrEqual(6);

        // ASSERT — NO Sentry alert fired (within window → warn log only, no alert).
        expect(captureBillingErrorSpy).not.toHaveBeenCalled();

        // Ensure the subscription we seeded is still the one being tested.
        expect(subscriptionId).toBeDefined();
    });

    it('past-window: currentPeriodEnd 8h past → request STILL ALLOWED, captureBillingError fired with operation=cron_lag_grace_exceeded, header absent', async () => {
        // ARRANGE — active sub with currentPeriodEnd 8 hours in the past (outside
        // the 6h grace window). The middleware fires a Sentry alert but NEVER blocks
        // the request (owner decision: always pass-through).
        const now = Date.now();
        const periodEnd = new Date(now - 8 * ONE_HOUR_MS); // 8h ago — past the 6h window
        const periodStart = new Date(now - 31 * 24 * 60 * 60 * 1000);

        const sub = await createTestSubscription({
            customerId,
            planId: seed.cheap.planId,
            status: 'active',
            billingInterval: 'month',
            intervalCount: 1,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd
        });
        subscriptionId = sub.subscriptionId;

        clearEntitlementCache(customerId);

        // ACT
        const probeApp = buildProbeApp(customerId);
        const res = await probeApp.request('/probe');

        // ASSERT — request is still allowed (never blocked even past window).
        expect(res.status).toBe(200);

        const body = (await res.json()) as {
            readonly entitlements: readonly string[];
            readonly limits: Readonly<Record<string, number>>;
            readonly billingLoadFailed: boolean;
        };
        expect(body.billingLoadFailed).toBe(false);
        expect(body.entitlements.length).toBeGreaterThan(0);

        // ASSERT — NO cron-lag header (hoursRemaining=0 past window → header not set).
        const gracHeader = res.headers.get('X-Cron-Lag-Grace-Hours-Remaining');
        expect(gracHeader).toBeNull();

        // ASSERT — captureBillingError was called exactly once with the expected context.
        // The middleware calls captureBillingError(error, { operation: 'cron_lag_grace_exceeded', ... }, 'warning').
        expect(captureBillingErrorSpy).toHaveBeenCalledOnce();
        const [capturedErr, capturedCtx, capturedSeverity] =
            captureBillingErrorSpy.mock.calls[0] ?? [];
        expect(capturedErr).toBeInstanceOf(Error);
        expect((capturedErr as Error).message).toContain('cron_lag_grace_exceeded');
        expect((capturedCtx as Record<string, unknown>)?.operation).toBe('cron_lag_grace_exceeded');
        expect((capturedCtx as Record<string, unknown>)?.subscriptionId).toBe(subscriptionId);
        expect(capturedSeverity).toBe('warning');
    });

    it('sanity: currentPeriodEnd NOT yet past → no cron-lag header, no Sentry alert, entitlements load normally', async () => {
        // ARRANGE — active sub with currentPeriodEnd 3 days in the future.
        // No cron-lag condition detected → no header, no alert.
        const now = Date.now();
        const periodEnd = new Date(now + 3 * 24 * 60 * 60 * 1000); // +3 days
        const periodStart = new Date(now - 27 * 24 * 60 * 60 * 1000);

        const sub = await createTestSubscription({
            customerId,
            planId: seed.cheap.planId,
            status: 'active',
            billingInterval: 'month',
            intervalCount: 1,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd
        });
        subscriptionId = sub.subscriptionId;

        clearEntitlementCache(customerId);

        // ACT
        const probeApp = buildProbeApp(customerId);
        const res = await probeApp.request('/probe');

        // ASSERT — request allowed, entitlements loaded.
        expect(res.status).toBe(200);
        const body = (await res.json()) as {
            readonly entitlements: readonly string[];
            readonly billingLoadFailed: boolean;
        };
        expect(body.billingLoadFailed).toBe(false);
        expect(body.entitlements.length).toBeGreaterThan(0);

        // ASSERT — no header, no Sentry alert (the normal case).
        expect(res.headers.get('X-Cron-Lag-Grace-Hours-Remaining')).toBeNull();
        expect(captureBillingErrorSpy).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// PART B: plan-disable lifecycle
// ---------------------------------------------------------------------------

describe('SPEC-148 Part B — plan-disable lifecycle', () => {
    let app: ReturnType<typeof initApp>;
    let seed: TestBillingPlansSeed;
    let userClient: E2EApiClient;

    // Per-test billing customer + subscription ids (two subscribers on expensive plan)
    let customer1Id: string;
    let customer2Id: string;
    let sub1Id: string;
    let sub2Id: string;
    let adminActorId: string;

    /**
     * Singleton PlanService used to toggle plans inactive in Part B tests.
     * We call the service directly (not the admin HTTP route) to avoid the
     * response-schema validation failure caused by test plans having
     * `category: 'test-baseline'` which is not in ['owner', 'complex', 'tourist'].
     * The route-level wiring (disablePlanLifecycle is called after toggle) is
     * tested by the existing unit suite in test/routes/billing/admin/plans.test.ts.
     * Here we focus on the end-to-end side effects: DB state, events, audit, notifs.
     */
    const planService = new PlanService();

    beforeAll(async () => {
        await testDb.setup();
        resetBillingInstance();
        app = initApp();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    beforeEach(async () => {
        mpStub.config.reset();
        captureBillingErrorSpy.mockClear();
        sendNotificationSpy.mockClear();

        seed = await seedBillingTestPlans();

        // Two subscribers on the expensive plan (fan-out N=2).
        const user1 = await createTestUser({
            email: `spec148-disable-c1-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}@example.com`
        });
        const user2 = await createTestUser({
            email: `spec148-disable-c2-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}@example.com`
        });

        const cust1 = await createTestBillingCustomer({
            externalId: user1.id,
            email: user1.email
        });
        const cust2 = await createTestBillingCustomer({
            externalId: user2.id,
            email: user2.email
        });
        customer1Id = cust1.customerId;
        customer2Id = cust2.customerId;

        const now = Date.now();
        const periodStart = new Date(now - 15 * 24 * 60 * 60 * 1000);
        const periodEnd = new Date(now + 15 * 24 * 60 * 60 * 1000); // still active

        const s1 = await createTestSubscription({
            customerId: customer1Id,
            planId: seed.expensive.planId,
            status: 'active',
            billingInterval: 'month',
            intervalCount: 1,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd
        });
        const s2 = await createTestSubscription({
            customerId: customer2Id,
            planId: seed.expensive.planId,
            status: 'active',
            billingInterval: 'month',
            intervalCount: 1,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd
        });
        sub1Id = s1.subscriptionId;
        sub2Id = s2.subscriptionId;

        // Admin actor ID for the audit log assertions. A real UUID is required
        // because billingAuditLogs.actorId is a UUID column.
        const adminUser = await createTestUser({
            email: `spec148-admin-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}@example.com`
        });
        adminActorId = adminUser.id;

        // Plain user + billing customer for the start-paid 410 test. The
        // billingCustomerMiddleware resolves the customer by external_id=actor.id.
        const plainUser = await createTestUser({
            email: `spec148-user-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}@example.com`
        });
        await createTestBillingCustomer({
            externalId: plainUser.id,
            email: plainUser.email
        });
        userClient = new E2EApiClient(
            app,
            createMockUserActor({
                id: plainUser.id
            })
        );
    });

    afterEach(async () => {
        clearEntitlementCache(customer1Id);
        clearEntitlementCache(customer2Id);
        await testDb.clean();
    });

    it('disablePlanLifecycle fan-out: all live subs get cancelAtPeriodEnd=true, PLAN_DISABLED_MIGRATION event per sub, PLAN_DISABLED_BY_ADMIN audit entry with affectedSubCount=2, PLAN_BEING_RETIRED notif per sub', async () => {
        // ARRANGE — verify pre-state: both subs are active, cancelAtPeriodEnd=false.
        const preSubs = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.planId, seed.expensive.planId));
        expect(preSubs).toHaveLength(2);
        for (const s of preSubs) {
            expect(s.status).toBe('active');
            expect(s.cancelAtPeriodEnd).toBe(false);
        }

        // ACT — toggle the plan inactive via PlanService (the same service the
        // admin PATCH route calls). Then call disablePlanLifecycle directly (the
        // same service the route invokes after commit). We bypass the HTTP route
        // to avoid the test-plan response-schema validation issue (test plans have
        // category='test-baseline', not in ['owner','complex','tourist']). The
        // admin-route → disablePlanLifecycle wiring is unit-tested in
        // test/routes/billing/admin/plans.test.ts.
        await planService.toggleActive(seed.expensive.planId, false, { actorId: adminActorId });

        const fanOutResult = await disablePlanLifecycle({
            planId: seed.expensive.planId,
            actorId: adminActorId,
            planName: seed.expensive.name
        });

        // ASSERT — fan-out returned the correct affected count.
        expect(fanOutResult.affectedSubCount).toBe(2);

        // ASSERT — DB: both subscriptions now have cancelAtPeriodEnd=true. Status stays
        // 'active' — the finalize-cancelled-subs cron transitions to 'cancelled' later.
        const postSubs = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.planId, seed.expensive.planId));
        expect(postSubs).toHaveLength(2);
        for (const s of postSubs) {
            expect(s.status).toBe('active');
            expect(s.cancelAtPeriodEnd).toBe(true);
        }

        // ASSERT — PLAN_DISABLED_MIGRATION event written for each affected subscription.
        const subIds = [sub1Id, sub2Id];
        for (const subId of subIds) {
            const events = await testDb
                .getDb()
                .select()
                .from(billingSubscriptionEvents)
                .where(eq(billingSubscriptionEvents.subscriptionId, subId));

            const migrationEvent = events.find(
                (e) => e.eventType === BILLING_EVENT_TYPES.PLAN_DISABLED_MIGRATION
            );
            expect(
                migrationEvent,
                `Expected PLAN_DISABLED_MIGRATION event for sub ${subId}`
            ).toBeDefined();
            expect(migrationEvent?.triggerSource).toBe('plan-disable');
        }

        // ASSERT — PLAN_DISABLED_BY_ADMIN audit entry in billing_audit_logs.
        // The audit entry carries affectedSubCount=2 in the changes JSONB.
        // We filter by entityId (planId) and by the eventType field in changes JSONB.
        const auditRows = (
            await testDb
                .getDb()
                .select()
                .from(billingAuditLogs)
                .where(eq(billingAuditLogs.entityId, seed.expensive.planId))
        ).filter(
            (row) =>
                (row.changes as Record<string, unknown>)?.eventType ===
                BILLING_EVENT_TYPES.PLAN_DISABLED_BY_ADMIN
        );
        expect(auditRows.length).toBeGreaterThanOrEqual(1);
        const adminAudit = auditRows[0];
        expect(adminAudit).toBeDefined();
        const changes = adminAudit?.changes as Record<string, unknown>;
        expect(changes?.affectedSubCount).toBe(2);
        expect(changes?.active).toBe(false);
        expect(adminAudit?.actorId).toBe(adminActorId);

        // ASSERT — sendNotification called twice (once per sub) with PLAN_BEING_RETIRED type.
        // sendNotification is fire-and-forget (wrapped in Promise.resolve().catch).
        // Wait a tick for the microtask queue to flush.
        await new Promise<void>((resolve) => setTimeout(resolve, 50));
        expect(sendNotificationSpy).toHaveBeenCalledTimes(2);
        for (const call of sendNotificationSpy.mock.calls) {
            const notifArg = call[0] as Record<string, unknown>;
            expect(notifArg?.type).toBe('plan_being_retired');
        }
    });

    it('start-paid onto a disabled plan → HTTP 410, error code PLAN_DISABLED', async () => {
        // ARRANGE — toggle the expensive plan inactive via the service layer.
        // The billing singleton's plan cache will reflect the inactive state when
        // start-paid calls billing.plans.list(). The test plan name is 'owner-pro'
        // (TEST_PLAN_NAMES.expensive), which is the planSlug the route receives.
        await planService.toggleActive(seed.expensive.planId, false, { actorId: adminActorId });

        // ACT — attempt to start a paid subscription on the now-disabled plan.
        // The start-paid guard calls billing.plans.list() and checks active===false
        // on the plan matching the slug → throws ServiceError(PLAN_DISABLED)
        // → global response handler returns 410 with code='PLAN_DISABLED'.
        const startRes = await userClient.post(
            '/api/v1/protected/billing/subscriptions/start-paid',
            {
                planSlug: seed.expensive.name, // 'owner-pro' — the canonical slug in qzpay
                billingInterval: 'monthly'
            }
        );

        // ASSERT — 410 Gone with PLAN_DISABLED error code.
        expect(startRes.status).toBe(410);
        const body = (await startRes.json()) as {
            readonly success: boolean;
            readonly error?: { readonly code: string };
        };
        expect(body.success).toBe(false);
        expect(body.error?.code).toBe('PLAN_DISABLED');
    });

    it('finalize-cancelled-subs cron run after period_end → disabled-plan subs transition to cancelled', async () => {
        // ARRANGE — fan-out cancelAtPeriodEnd=true to both subs.
        await planService.toggleActive(seed.expensive.planId, false, { actorId: adminActorId });
        await disablePlanLifecycle({
            planId: seed.expensive.planId,
            actorId: adminActorId,
            planName: seed.expensive.name
        });

        // Advance currentPeriodEnd to the PAST on both subs so the finalize cron
        // sees them as due. Cron predicate:
        // status='active' AND cancelAtPeriodEnd=true AND currentPeriodEnd<=now AND deletedAt IS NULL.
        const pastPeriodEnd = new Date(Date.now() - 60 * 1000); // 60s ago
        await testDb
            .getDb()
            .update(billingSubscriptions)
            .set({ currentPeriodEnd: pastPeriodEnd, updatedAt: new Date() })
            .where(eq(billingSubscriptions.id, sub1Id));
        await testDb
            .getDb()
            .update(billingSubscriptions)
            .set({ currentPeriodEnd: pastPeriodEnd, updatedAt: new Date() })
            .where(eq(billingSubscriptions.id, sub2Id));

        // Sanity: both subs are active+cancelAtPeriodEnd=true with past period_end.
        const preSubs = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.planId, seed.expensive.planId));
        for (const s of preSubs) {
            expect(s.status).toBe('active');
            expect(s.cancelAtPeriodEnd).toBe(true);
            expect(s.currentPeriodEnd.getTime()).toBeLessThan(Date.now());
        }

        // ACT — invoke the finalize-cancelled-subs cron handler directly.
        // This reuses the SPEC-147 cron; SPEC-148 Part B relies on it for the
        // final cancellation step (per spec: "run finalize-cancelled-subs cron
        // after advancing past period_end → assert subs are actually cancelled").
        const { ctx } = makeCronCtx();
        const result = await finalizeCancelledSubsJob.handler(ctx);

        // ASSERT — cron result: 2 processed, 0 errors.
        expect(result.success).toBe(true);
        expect(result.processed).toBe(2);
        expect(result.errors).toBe(0);

        // ASSERT — DB: both subs now have status='cancelled'.
        const postSubs = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.planId, seed.expensive.planId));
        for (const s of postSubs) {
            expect(s.status).toBe('cancelled');
        }

        // ASSERT — cron idempotency: second run sees no eligible rows (already cancelled).
        const { ctx: ctx2 } = makeCronCtx();
        const result2 = await finalizeCancelledSubsJob.handler(ctx2);
        expect(result2.success).toBe(true);
        expect(result2.processed).toBe(0);
    });
});
