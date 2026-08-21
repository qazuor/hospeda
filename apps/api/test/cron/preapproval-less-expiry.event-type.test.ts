/**
 * Tests for the `event_type` write on the audit event inserted by the
 * preapproval-less-expiry cron job (HOS-657).
 *
 * The job's audit-event insert previously wrote only `triggerSource` and
 * `metadata.action`, leaving `event_type` NULL — one of the four writers
 * responsible for `billing_subscription_events.event_type` being NULL on
 * 57% of production rows (21 of 37). This suite pins that the insert now
 * also carries `eventType: BILLING_EVENT_TYPES.SUBSCRIPTION_EXPIRED_WITHOUT_PREAPPROVAL`.
 *
 * The pure selection-rule tests for this job (which fields make a row
 * reapable) live in `preapproval-less-expiry.test.ts` and do not touch the
 * database; this file exercises the DB-writing handler path in isolation.
 *
 * @module test/cron/preapproval-less-expiry.event-type
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — declared before imports (hoisted by vitest)
// ---------------------------------------------------------------------------

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        getDb: vi.fn(),
        billingSubscriptions: {
            id: 'id',
            customerId: 'customer_id',
            status: 'status',
            mpSubscriptionId: 'mp_subscription_id',
            currentPeriodEnd: 'current_period_end',
            cancelAtPeriodEnd: 'cancel_at_period_end',
            deletedAt: 'deleted_at',
            updatedAt: 'updated_at'
        },
        billingSubscriptionEvents: {
            subscriptionId: 'subscription_id',
            eventType: 'event_type',
            previousStatus: 'previous_status',
            newStatus: 'new_status',
            triggerSource: 'trigger_source',
            metadata: 'metadata'
        }
    };
});

// importOriginal spread preserves checkSubscriptionStatusTransition as the
// real state-machine function (active/trialing -> expired must be a
// registered edge for this job to work at all — see the module doc on
// preapproval-less-expiry.job.ts). withServiceTransaction is overridden to
// run the callback against the same db mock's transaction() method, mirroring
// the pattern established in refund-lifecycle.service.test.ts.
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    const { getDb } = await import('@repo/db');
    return {
        ...actual,
        withServiceTransaction: vi.fn(async (cb: (ctx: unknown) => Promise<unknown>) => {
            const db = getDb() as {
                transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
            };
            return db.transaction(async (tx: unknown) => cb({ tx, hookState: {} }));
        })
    };
});

vi.mock('../../src/middlewares/entitlement.js', () => ({
    clearEntitlementCache: vi.fn()
}));

vi.mock('../../src/services/commerce-reconcile.service.js', () => ({
    reconcileCommerceListingForSubscription: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

// ---------------------------------------------------------------------------
// Imports (after all mocks)
// ---------------------------------------------------------------------------

import { getDb } from '@repo/db';
import { BILLING_EVENT_TYPES } from '@repo/service-core';
import { preapprovalLessExpiryJob } from '../../src/cron/jobs/preapproval-less-expiry.job.js';
import { clearEntitlementCache } from '../../src/middlewares/entitlement.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SUBSCRIPTION_ID = 'sub-reap-0001';
const CUSTOMER_ID = 'cus-reap-0001';

/** Reference instant matching the pure-rule fixture in preapproval-less-expiry.test.ts. */
const STARTED_AT = new Date('2026-08-15T12:00:00Z');

/** A row that IS reapable: no preapproval, active, period elapsed well past the 6h grace window. */
const REAPABLE_ROW = {
    id: SUBSCRIPTION_ID,
    customerId: CUSTOMER_ID,
    status: 'active',
    mpSubscriptionId: null,
    currentPeriodEnd: new Date('2026-08-07T00:00:00Z'),
    cancelAtPeriodEnd: false
};

/** Minimal CronJobContext for the handler. */
function buildCronCtx() {
    return {
        logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        startedAt: STARTED_AT,
        dryRun: false
    } as unknown as Parameters<typeof preapprovalLessExpiryJob.handler>[0];
}

/**
 * Build a DB mock for the reap path:
 *   select(...).from(...).where(...).limit(...) -> candidate rows
 *   db.transaction(tx => tx.update(...) + tx.insert(...))
 */
function buildDbMock(candidates: Array<Record<string, unknown>>) {
    const selectLimit = vi.fn().mockResolvedValue(candidates);
    const selectWhere = vi.fn().mockReturnValue({ limit: selectLimit });
    const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
    const select = vi.fn().mockReturnValue({ from: selectFrom });

    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    const update = vi.fn().mockReturnValue({ set: updateSet });

    const insertValues = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values: insertValues });

    const txProxy = { update, insert };
    const transaction = vi
        .fn()
        .mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(txProxy));

    const db = { select, transaction };

    return {
        db,
        spies: {
            select,
            selectFrom,
            selectWhere,
            selectLimit,
            update,
            updateSet,
            updateWhere,
            insert,
            insertValues,
            transaction
        }
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('preapprovalLessExpiryJob — eventType write (HOS-657)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('inserts the audit event with eventType SUBSCRIPTION_EXPIRED_WITHOUT_PREAPPROVAL', async () => {
        const { db, spies } = buildDbMock([REAPABLE_ROW]);
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

        const result = await preapprovalLessExpiryJob.handler(buildCronCtx());

        expect(result.success).toBe(true);
        expect(result.processed).toBe(1);
        expect(spies.insert).toHaveBeenCalledTimes(1);

        const eventArg = vi.mocked(spies.insertValues).mock.calls[0]?.[0] as Record<
            string,
            unknown
        >;
        expect(eventArg).toMatchObject({
            subscriptionId: SUBSCRIPTION_ID,
            eventType: BILLING_EVENT_TYPES.SUBSCRIPTION_EXPIRED_WITHOUT_PREAPPROVAL,
            previousStatus: 'active',
            newStatus: 'expired',
            triggerSource: 'preapproval-less-expiry',
            metadata: expect.objectContaining({
                action: 'subscription.expired_without_preapproval'
            })
        });
        expect(clearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);
    });

    it('updates the subscription status to expired inside the same transaction', async () => {
        const { db, spies } = buildDbMock([REAPABLE_ROW]);
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

        await preapprovalLessExpiryJob.handler(buildCronCtx());

        expect(spies.update).toHaveBeenCalledTimes(1);
        const setArg = vi.mocked(spies.updateSet).mock.calls[0]?.[0] as Record<string, unknown>;
        expect(setArg.status).toBe('expired');
    });

    it('does not write an event for a candidate the pure rule rejects (has a preapproval)', async () => {
        const nonReapable = { ...REAPABLE_ROW, mpSubscriptionId: 'preapproval-123' };
        const { db, spies } = buildDbMock([nonReapable]);
        vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

        const result = await preapprovalLessExpiryJob.handler(buildCronCtx());

        expect(result.processed).toBe(0);
        expect(spies.transaction).not.toHaveBeenCalled();
        expect(spies.insert).not.toHaveBeenCalled();
    });
});
