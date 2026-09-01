/**
 * HOS-1012 T-004 — subscription-trial-create.service unit tests.
 *
 * Proves the local trial creator:
 *  - inserts a `status='trialing'` row with NO mp_subscription_id, the requested
 *    product_domain, and a trial window computed from a single clock read.
 *  - enlists in a caller-owned transaction when one is passed, and defers the
 *    entitlement-cache clear to that caller (HOS-1012 G-2 depends on this).
 *  - clears the entitlement cache itself when it owns the transaction (INV-1).
 *  - rejects a plan from a different product domain, and a missing plan.
 *  - treats a NULL plan domain as accommodation (the column post-dates the rows).
 *
 * DB is fully mocked — no real infra. The assertions read the actual values
 * handed to `insert().values()` rather than merely checking the call happened,
 * because "an insert ran" is true for every possible row shape.
 *
 * @module test/services/subscription-trial-create.service
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const insertValuesMock = vi.fn();

/** The client handed to the withTransaction callback. */
const txStub = {
    insert: vi.fn(() => ({ values: insertValuesMock }))
};

/** Records (callback, existingTx) so a test can assert the tx was threaded. */
const withTransactionMock = vi.fn(
    async (cb: (client: typeof txStub) => Promise<unknown>, _existing?: unknown) => cb(txStub)
);

const selectLimitMock = vi.fn();
const selectWhereMock = vi.fn(() => ({ limit: selectLimitMock }));
const selectFromMock = vi.fn(() => ({ where: selectWhereMock }));
const selectMock = vi.fn(() => ({ from: selectFromMock }));

vi.mock('@repo/db', () => ({
    billingSubscriptions: { __table: 'billing_subscriptions', id: 'id' },
    billingPlans: { id: 'id', productDomain: 'product_domain' },
    eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })),
    getDb: vi.fn(() => ({ select: selectMock })),
    withTransaction: (...args: unknown[]) =>
        (withTransactionMock as (...a: unknown[]) => unknown)(...args)
}));

vi.mock('@repo/billing', () => ({
    OWNER_TRIAL_DAYS: 30
}));

vi.mock('@repo/schemas', () => ({
    ProductDomainEnum: {
        ACCOMMODATION: 'accommodation',
        GASTRONOMY: 'gastronomy',
        EXPERIENCE: 'experience',
        PARTNER: 'partner'
    },
    SubscriptionStatusEnum: { TRIALING: 'trialing' }
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

const clearEntitlementCacheMock = vi.fn();
vi.mock('../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: (...args: unknown[]) => clearEntitlementCacheMock(...args)
}));

// Import after mocks.
import { createTrialSubscription } from '../../src/services/subscription-trial-create.service';

/** A fixed clock so trial-window assertions are exact, not approximate. */
const FIXED_NOW = new Date('2026-09-01T10:00:00.000Z');
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * A stand-in for a real Drizzle transaction handle.
 *
 * A transaction is a full client, not an opaque token: the plan lookup runs
 * through it on purpose, so the validation reads the same snapshot the insert
 * will write into. A bare `{}` marker would pass a test the production object
 * cannot, which is the wrong direction for a stub to be wrong in.
 */
function makeCallerTx() {
    return {
        marker: 'caller-tx',
        select: selectMock,
        insert: vi.fn(() => ({ values: insertValuesMock }))
    } as never;
}

/** The row handed to `insert().values()` on the most recent call. */
function insertedRow(): Record<string, unknown> {
    return insertValuesMock.mock.calls[0]?.[0] as Record<string, unknown>;
}

function baseInput() {
    return {
        customerId: 'cust_1',
        planId: 'plan_uuid_1',
        productDomain: 'accommodation' as never,
        livemode: true,
        now: FIXED_NOW
    };
}

describe('createTrialSubscription', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: an accommodation plan exists.
        selectLimitMock.mockResolvedValue([{ productDomain: 'accommodation' }]);
    });

    describe('the inserted row', () => {
        it('carries status trialing and NO mp_subscription_id', async () => {
            await createTrialSubscription(baseInput());

            const row = insertedRow();
            expect(row.status).toBe('trialing');
            // The absence is the point: a NULL provider id is what distinguishes
            // a subscription Hospeda owns from one a provider controls.
            expect(row).not.toHaveProperty('mpSubscriptionId');
            expect(row).not.toHaveProperty('mp_subscription_id');
        });

        it('stamps the requested product domain, not a hardcoded one', async () => {
            selectLimitMock.mockResolvedValue([{ productDomain: 'gastronomy' }]);

            await createTrialSubscription({
                ...baseInput(),
                productDomain: 'gastronomy' as never
            });

            expect(insertedRow().productDomain).toBe('gastronomy');
        });

        it('computes trialEnd as trialStart plus the trial length', async () => {
            await createTrialSubscription({ ...baseInput(), trialDays: 30 });

            const row = insertedRow();
            expect(row.trialStart).toEqual(FIXED_NOW);
            expect(row.trialEnd).toEqual(new Date(FIXED_NOW.getTime() + 30 * MS_PER_DAY));
        });

        it('anchors trialEnd to trialStart and never to a second clock read', async () => {
            await createTrialSubscription({ ...baseInput(), trialDays: 7 });

            const row = insertedRow();
            const start = row.trialStart as Date;
            const end = row.trialEnd as Date;
            // Exact, not approximate: any re-read of the clock between the two
            // would make this difference drift off the day boundary.
            expect(end.getTime() - start.getTime()).toBe(7 * MS_PER_DAY);
        });

        it('defaults the trial length to OWNER_TRIAL_DAYS when none is given', async () => {
            await createTrialSubscription(baseInput());

            const row = insertedRow();
            const start = row.trialStart as Date;
            const end = row.trialEnd as Date;
            expect(end.getTime() - start.getTime()).toBe(30 * MS_PER_DAY);
        });

        it('makes the trial window the current billing period', async () => {
            await createTrialSubscription({ ...baseInput(), trialDays: 30 });

            const row = insertedRow();
            // currentPeriodEnd is NOT NULL in the qzpay schema. Pointing it at
            // trialEnd keeps every `now < currentPeriodEnd` consumer agreeing
            // with the trial window instead of disagreeing with it.
            expect(row.currentPeriodStart).toEqual(row.trialStart);
            expect(row.currentPeriodEnd).toEqual(row.trialEnd);
        });
    });

    describe('transaction enlistment (what G-2 depends on)', () => {
        it('threads a caller-owned transaction through to withTransaction', async () => {
            const callerTx = makeCallerTx();

            await createTrialSubscription({ ...baseInput(), tx: callerTx });

            // The second argument is what makes withTransaction reuse the
            // caller's transaction instead of opening a nested one.
            expect(withTransactionMock.mock.calls[0]?.[1]).toBe(callerTx);
        });

        it('does NOT clear the entitlement cache inside a caller-owned transaction', async () => {
            const result = await createTrialSubscription({
                ...baseInput(),
                tx: makeCallerTx()
            });

            // Clearing before the caller commits would publish entitlements for
            // a row that can still be rolled back.
            expect(clearEntitlementCacheMock).not.toHaveBeenCalled();
            expect(result.entitlementCacheCleared).toBe(false);
        });

        it('clears the entitlement cache itself when it owns the transaction', async () => {
            const result = await createTrialSubscription(baseInput());

            // INV-1: a local trial has no preapproval and therefore no webhook,
            // so nothing else will ever clear this customer's cache.
            expect(clearEntitlementCacheMock).toHaveBeenCalledWith('cust_1');
            expect(result.entitlementCacheCleared).toBe(true);
        });
    });

    describe('plan validation', () => {
        it('rejects a plan that does not exist', async () => {
            selectLimitMock.mockResolvedValue([]);

            await expect(createTrialSubscription(baseInput())).rejects.toThrow(/not found/);
            expect(insertValuesMock).not.toHaveBeenCalled();
        });

        it('rejects a plan from a different product domain', async () => {
            selectLimitMock.mockResolvedValue([{ productDomain: 'gastronomy' }]);

            await expect(
                createTrialSubscription({
                    ...baseInput(),
                    productDomain: 'accommodation' as never
                })
            ).rejects.toThrow(/gastronomy/);
            expect(insertValuesMock).not.toHaveBeenCalled();
        });

        it('treats a NULL plan domain as accommodation', async () => {
            // The column post-dates most rows, so accommodation fails open —
            // the same asymmetry subscriptionMatchesDomain() applies.
            selectLimitMock.mockResolvedValue([{ productDomain: null }]);

            await expect(
                createTrialSubscription({
                    ...baseInput(),
                    productDomain: 'accommodation' as never
                })
            ).resolves.toMatchObject({ entitlementCacheCleared: true });
        });

        it('does NOT let a NULL plan domain back a non-accommodation trial', async () => {
            // Fails closed in the other direction: a legacy plan cannot silently
            // become a gastronomy plan just because its column is empty.
            selectLimitMock.mockResolvedValue([{ productDomain: null }]);

            await expect(
                createTrialSubscription({
                    ...baseInput(),
                    productDomain: 'gastronomy' as never
                })
            ).rejects.toThrow(/accommodation/);
        });
    });

    describe('trial length validation', () => {
        it.each([0, -1, 1.5, Number.NaN])('rejects trialDays = %s', async (trialDays) => {
            await expect(createTrialSubscription({ ...baseInput(), trialDays })).rejects.toThrow(
                /positive integer/
            );
            expect(insertValuesMock).not.toHaveBeenCalled();
        });
    });
});
