/**
 * Handler tests for the `subscription-drift-reconcile` cron (HOS-914).
 *
 * The predicate file next to this one pins WHICH rows are candidates. This file
 * pins what the tick DOES with them, and the three things that matter are the
 * three a reader cannot verify from the predicate alone:
 *
 * 1. **Nobody is cancelled because MercadoPago drew a blank.** The single worst
 *    outcome of this issue is cutting service to someone who paid. The test
 *    below hands the sweep a provider that answers 404 and asserts the adapter's
 *    `cancel`/`update` were never touched, the row was never written, and the
 *    tick reported FAILURE with the id named — escalation, not a verdict.
 * 2. **A transient failure is not the same report.** A 429 or an expired token
 *    makes every row unreadable; if that escalated, one bad token would page a
 *    human about the whole portfolio.
 * 3. **All five verticals, and the dual-owner account.** The sweep selects by
 *    ROW, never by customer, so an account that is both a host and a partner has
 *    both subscriptions reconciled instead of one of them being picked by a
 *    `.find()`.
 *
 * @module test/cron/subscription-drift-reconcile.handler
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types';

/** Rows the simulated candidate SELECT returns. */
let selectedRows: Array<Record<string, unknown>> = [];
/** Whether the advisory lock is granted. */
let lockAcquired = true;
/** What `getQZPayBilling()` hands the sweep (`null` = billing not configured). */
let billingInstance: unknown = { marker: 'billing' };

const processSubscriptionUpdatedMock = vi.fn();
const mpCancelSpy = vi.fn();
const mpUpdateSpy = vi.fn();
const sentryCaptureSpy = vi.fn();

vi.mock('../../src/middlewares/billing.js', () => ({
    getQZPayBilling: () => billingInstance
}));

vi.mock('../../src/lib/qzpay-logger.js', () => ({
    qzpayLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('@repo/billing', () => ({
    createMercadoPagoAdapter: () => ({
        subscriptions: {
            // Neither may ever be called by this job. Spied so the assertion is
            // "no write was attempted", not "no write was observed".
            cancel: mpCancelSpy,
            update: mpUpdateSpy
        }
    })
}));

vi.mock('@repo/service-core', () => ({
    excludeAddonDomainCondition: () => 'exclude-addon'
}));

vi.mock('@sentry/node', () => ({
    captureException: sentryCaptureSpy
}));

vi.mock('../../src/services/billing/preapproval-recovery.service.js', () => ({
    // Real value is 350ms (measured). Zeroed here so the suite does not spend a
    // third of a second per row; the spacing itself is pinned by that module.
    MP_CALL_SPACING_MS: 0
}));

vi.mock('../../src/routes/webhooks/mercadopago/subscription-logic.js', () => ({
    processSubscriptionUpdated: (...args: unknown[]) => processSubscriptionUpdatedMock(...args)
}));

vi.mock('@repo/db', async () => {
    const actual = await vi.importActual<Record<string, unknown>>('@repo/db');
    return {
        ...actual,
        billingSubscriptions: {
            id: 'id',
            customerId: 'customer_id',
            status: 'status',
            mpSubscriptionId: 'mp_subscription_id',
            trialEnd: 'trial_end',
            cancelAtPeriodEnd: 'cancel_at_period_end',
            updatedAt: 'updated_at',
            deletedAt: 'deleted_at'
        },
        and: vi.fn(() => 'and'),
        eq: vi.fn(() => 'eq'),
        inArray: vi.fn(() => 'inArray'),
        isNotNull: vi.fn(() => 'isNotNull'),
        isNull: vi.fn(() => 'isNull'),
        sql: vi.fn(() => 'sql'),
        withTransaction: async (cb: (tx: unknown) => Promise<unknown>) =>
            cb({
                execute: async () => ({ rows: [{ acquired: lockAcquired }] }),
                select: () => ({
                    from: () => ({
                        where: () => ({
                            orderBy: () => ({
                                limit: async () => selectedRows
                            })
                        })
                    })
                })
            })
    };
});

vi.mock('drizzle-orm', async () => {
    const actual = await vi.importActual<Record<string, unknown>>('drizzle-orm');
    return {
        ...actual,
        asc: vi.fn(() => 'asc'),
        gt: vi.fn(() => 'gt'),
        lt: vi.fn(() => 'lt'),
        ne: vi.fn(() => 'ne'),
        or: vi.fn(() => 'or')
    };
});

const { subscriptionDriftReconcileJob } = await import(
    '../../src/cron/jobs/subscription-drift-reconcile.job.js'
);

/** Reference instant; every fed row is made stale relative to it. */
const NOW = new Date('2026-09-09T12:00:00Z');
const STALE = new Date(NOW.getTime() - 2 * 60 * 60 * 1000);

const loggedErrors: Array<{ message: string; data?: Record<string, unknown> }> = [];

function buildContext(overrides: Partial<CronJobContext> = {}): CronJobContext {
    return {
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: (message: string, data?: Record<string, unknown>) => {
                loggedErrors.push({ message, data });
            },
            debug: vi.fn()
        },
        startedAt: NOW,
        dryRun: false,
        ...overrides
    };
}

/** A candidate row. `productDomain` rides along to make the vertical explicit. */
function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: 'sub-1',
        customerId: 'cus-1',
        status: 'active',
        mpSubscriptionId: 'preapproval-1',
        trialEnd: null,
        cancelAtPeriodEnd: false,
        updatedAt: STALE,
        productDomain: 'accommodation',
        ...overrides
    };
}

beforeEach(() => {
    selectedRows = [];
    lockAcquired = true;
    billingInstance = { marker: 'billing' };
    loggedErrors.length = 0;
    processSubscriptionUpdatedMock.mockReset();
    processSubscriptionUpdatedMock.mockResolvedValue({ success: true, statusChanged: false });
    mpCancelSpy.mockReset();
    mpUpdateSpy.mockReset();
    sentryCaptureSpy.mockReset();
});

describe('subscription-drift-reconcile — MercadoPago drawing a blank is never a cancellation', () => {
    it('does not write, does not cancel, and FAILS the tick naming the row', async () => {
        // Arrange — the provider cannot resolve the preapproval. This is the
        // shape a cash-paid partner (HOS-1062) or a mis-recorded id produces.
        selectedRows = [row({ id: 'sub-cash', mpSubscriptionId: 'preapproval-ghost' })];
        processSubscriptionUpdatedMock.mockRejectedValue(
            Object.assign(new Error('Retrieve subscription - Not Found'), { status: 404 })
        );

        // Act
        const result = await subscriptionDriftReconcileJob.handler(buildContext());

        // Assert — no provider mutation was even attempted
        expect(mpCancelSpy).not.toHaveBeenCalled();
        expect(mpUpdateSpy).not.toHaveBeenCalled();
        // …and the tick is not reported as a success
        expect(result.success).toBe(false);
        expect(result.details?.unknownAtProvider).toBe(1);
        expect(result.details?.unknownAtProviderIds).toEqual(['sub-cash']);
        expect(result.details?.transientErrors).toBe(0);
        expect(result.message).toContain('NOT cancelled');
        // …and a human is told which row, loudly
        expect(loggedErrors.some((e) => e.data?.subscriptionId === 'sub-cash')).toBe(true);
        expect(sentryCaptureSpy).toHaveBeenCalledTimes(1);
    });

    it('keeps sweeping the rest of the batch after an unknown row', async () => {
        // Arrange — one ghost between two healthy rows.
        selectedRows = [
            row({ id: 'sub-a', mpSubscriptionId: 'preapproval-a' }),
            row({ id: 'sub-ghost', mpSubscriptionId: 'preapproval-ghost' }),
            row({ id: 'sub-b', mpSubscriptionId: 'preapproval-b' })
        ];
        processSubscriptionUpdatedMock.mockImplementation(
            async ({ event }: { event: { data: { id: string } } }) => {
                if (event.data.id === 'preapproval-ghost') {
                    throw Object.assign(new Error('Not Found'), { code: 'resource_not_found' });
                }
                return { success: true, statusChanged: false };
            }
        );

        // Act
        const result = await subscriptionDriftReconcileJob.handler(buildContext());

        // Assert
        expect(processSubscriptionUpdatedMock).toHaveBeenCalledTimes(3);
        expect(result.details?.inSync).toBe(2);
        expect(result.details?.unknownAtProvider).toBe(1);
    });
});

describe('subscription-drift-reconcile — a transient failure reports differently', () => {
    it('counts a 429 as transient, never as unknown-at-provider', async () => {
        // Arrange
        selectedRows = [row({ id: 'sub-429' })];
        processSubscriptionUpdatedMock.mockRejectedValue(
            Object.assign(new Error('Rate limit exceeded'), { code: 'rate_limit_error' })
        );

        // Act
        const result = await subscriptionDriftReconcileJob.handler(buildContext());

        // Assert
        expect(result.details?.transientErrors).toBe(1);
        expect(result.details?.unknownAtProvider).toBe(0);
        expect(result.details?.unknownAtProviderIds).toEqual([]);
        expect(sentryCaptureSpy).not.toHaveBeenCalled();
        // Still not a success: the row was not reconciled this tick.
        expect(result.success).toBe(false);
    });
});

describe('subscription-drift-reconcile — all five verticals and the dual-owner account', () => {
    it('reconciles one row per subscription regardless of product domain', async () => {
        // Arrange — the five things that charge, plus a SECOND row for the
        // partner's own customer id in the accommodation domain: the account
        // that is a host and a partner at once (`host-provider@local.test`).
        selectedRows = [
            row({ id: 's-acc', mpSubscriptionId: 'pa-acc', productDomain: 'accommodation' }),
            row({ id: 's-gas', mpSubscriptionId: 'pa-gas', productDomain: 'gastronomy' }),
            row({ id: 's-exp', mpSubscriptionId: 'pa-exp', productDomain: 'experience' }),
            row({
                id: 's-tou',
                mpSubscriptionId: 'pa-tou',
                productDomain: 'accommodation',
                customerId: 'cus-tourist'
            }),
            row({
                id: 's-par',
                mpSubscriptionId: 'pa-par',
                productDomain: 'partner',
                customerId: 'cus-dual'
            }),
            row({
                id: 's-dual-host',
                mpSubscriptionId: 'pa-dual-host',
                productDomain: 'accommodation',
                customerId: 'cus-dual'
            })
        ];
        processSubscriptionUpdatedMock.mockResolvedValue({
            success: true,
            statusChanged: true,
            newStatus: 'active'
        });

        // Act
        const result = await subscriptionDriftReconcileJob.handler(buildContext());

        // Assert — every row, not every customer
        expect(processSubscriptionUpdatedMock).toHaveBeenCalledTimes(6);
        const seen = processSubscriptionUpdatedMock.mock.calls.map(
            (call) => (call[0] as { event: { data: { id: string } } }).event.data.id
        );
        expect(seen.sort()).toEqual(
            ['pa-acc', 'pa-dual-host', 'pa-exp', 'pa-gas', 'pa-par', 'pa-tou'].sort()
        );
        // Both of the dual owner's subscriptions were reconciled.
        expect(seen.filter((id) => id.startsWith('pa-dual') || id === 'pa-par')).toHaveLength(2);
        expect(result.details?.corrected).toBe(6);
        expect(result.success).toBe(true);
    });

    it('filters a row the SQL should not have returned, in code', async () => {
        // Arrange — the predicate is the specification; the query is the
        // optimisation. A loosened WHERE must not be able to widen what gets
        // compared, so a preapproval-less row is dropped here too.
        selectedRows = [row({ id: 's-no-preapproval', mpSubscriptionId: null })];

        // Act
        const result = await subscriptionDriftReconcileJob.handler(buildContext());

        // Assert
        expect(processSubscriptionUpdatedMock).not.toHaveBeenCalled();
        expect(result.processed).toBe(0);
    });
});

describe('subscription-drift-reconcile — counting and the two no-op exits', () => {
    it('separates corrected rows from rows already in sync', async () => {
        // Arrange
        selectedRows = [
            row({ id: 's-1', mpSubscriptionId: 'pa-1' }),
            row({ id: 's-2', mpSubscriptionId: 'pa-2' })
        ];
        processSubscriptionUpdatedMock.mockImplementation(
            async ({ event }: { event: { data: { id: string } } }) =>
                event.data.id === 'pa-1'
                    ? { success: true, statusChanged: true, newStatus: 'cancelled' }
                    : { success: true, statusChanged: false }
        );

        // Act
        const result = await subscriptionDriftReconcileJob.handler(buildContext());

        // Assert
        expect(result.details?.corrected).toBe(1);
        expect(result.details?.inSync).toBe(1);
        expect(result.processed).toBe(2);
        expect(result.success).toBe(true);
    });

    it('a dry run compares nothing and says so', async () => {
        // Arrange — `processSubscriptionUpdated` WRITES, so a rehearsal must not
        // reach it at all. Asserted on the call count, not on the message: a
        // report is not evidence of what a run did (HOS-918).
        selectedRows = [row()];

        // Act
        const result = await subscriptionDriftReconcileJob.handler(buildContext({ dryRun: true }));

        // Assert
        expect(processSubscriptionUpdatedMock).not.toHaveBeenCalled();
        expect(result.details?.dryRun).toBe(true);
        expect(result.processed).toBe(1);
    });

    it('does nothing when a sibling replica holds the advisory lock', async () => {
        // Arrange
        lockAcquired = false;
        selectedRows = [row()];

        // Act
        const result = await subscriptionDriftReconcileJob.handler(buildContext());

        // Assert
        expect(processSubscriptionUpdatedMock).not.toHaveBeenCalled();
        expect(result.message).toBe('lock_not_acquired');
        expect(result.details?.acquiredLock).toBe(false);
    });

    it('skips the run when billing is not configured', async () => {
        // Arrange
        billingInstance = null;
        selectedRows = [row()];

        // Act
        const result = await subscriptionDriftReconcileJob.handler(buildContext());

        // Assert
        expect(processSubscriptionUpdatedMock).not.toHaveBeenCalled();
        expect(result.message).toBe('billing_not_configured');
    });
});

describe('subscription-drift-reconcile — the WHERE clause the mocked builder cannot see', () => {
    /*
     * The tests above feed rows straight past a stubbed query builder, so they
     * are structurally blind to the predicates in the SELECT itself. These two
     * claims live only there, and both are load-bearing:
     *
     *   - the preapproval filter is what keeps a cash-paid partner (HOS-1062)
     *     out of the population entirely;
     *   - the ONLY product-domain predicate is the add-on exclusion, which is
     *     what makes the sweep cover all five verticals on identical terms.
     *
     * Source-level, therefore: it proves the predicate is present, not that it
     * ran. That is exactly the gap, and a scan is the only thing that closes it
     * without a live database.
     */
    const source = readFileSync(
        resolve(__dirname, '../../src/cron/jobs/subscription-drift-reconcile.job.ts'),
        'utf-8'
    );
    /** Live code only: the module doc legitimately names domains in prose. */
    const liveCode = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    it('requires a preapproval id — the filter that excludes a cash-paid partner', () => {
        // Arrange & Act & Assert
        expect(liveCode).toContain('isNotNull(billingSubscriptions.mpSubscriptionId)');
    });

    it('excludes the add-on domain', () => {
        // Arrange & Act & Assert
        expect(liveCode).toContain('excludeAddonDomainCondition()');
    });

    it('filters on product domain ONLY to exclude add-ons, so all five verticals are swept', () => {
        // Arrange — a `ProductDomainEnum` comparison, a
        // `subscriptionMatchesDomain` call or a `productDomain` predicate here
        // would silently narrow the sweep to one vertical while every test above
        // kept passing, because those tests never see the WHERE clause.
        // Act & Assert
        expect(liveCode).not.toContain('ProductDomainEnum');
        expect(liveCode).not.toContain('subscriptionMatchesDomain');
        expect(liveCode).not.toContain('billingSubscriptions.productDomain');
    });

    it('never calls either reconciler bridge itself — processSubscriptionUpdated owns both', () => {
        // Arrange — calling them here would double-fire them for every
        // corrected row, and would also owe this file an entry in
        // test/services/subscription-linked-entities-bridge.guard.test.ts.
        // Act & Assert
        expect(liveCode).not.toContain('reconcileSubscriptionLinkedEntities(');
        expect(liveCode).not.toContain('reconcilePartnerForSubscription(');
    });
});
