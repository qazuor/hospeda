/**
 * SPEC-262 T-012 P2 — subscription-comp-create.service unit tests.
 *
 * Proves the comp subscription creator:
 *  - inserts a `status='comp'` row with NO mp_subscription_id, far-future period,
 *    product_domain='accommodation', and the chosen interval.
 *  - stamps promo_code_id + records the redemption inside ONE transaction.
 *  - rolls back (throws) when the redemption fails (fail-closed comp grant).
 *  - SPEC-262 M2: throws when the plan belongs to a non-accommodation domain.
 *  - SPEC-262 M2: allows NULL product_domain (legacy plans, treated as accommodation).
 *
 * DB + service-core redemption are fully mocked — no real infra. Typed Drizzle
 * queries as of HOS-75 T-005 (previously raw SQL).
 *
 * @module test/services/subscription-comp-create.service
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const insertValuesMock = vi.fn();
const updateWhereMock = vi.fn();
const updateSetMock = vi.fn(() => ({ where: updateWhereMock }));
const txUpdateMock = vi.fn(() => ({ set: updateSetMock }));

/** A fake tx object passed to the withTransaction callback. */
const txStub = {
    insert: vi.fn(() => ({ values: insertValuesMock })),
    update: txUpdateMock
};

const withTransactionMock = vi.fn(
    async (cb: (tx: typeof txStub) => Promise<unknown>, _existing?: unknown) => cb(txStub)
);

/** The plan domain check SELECT (returns a row with productDomain, or none). */
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

vi.mock('@repo/schemas', () => ({
    ProductDomainEnum: { ACCOMMODATION: 'accommodation', COMMERCE: 'commerce' },
    SubscriptionStatusEnum: { COMP: 'comp' }
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

const redeemAndRecordUsageMock = vi.fn();
vi.mock('@repo/service-core', () => ({
    redeemAndRecordUsage: (...args: unknown[]) => redeemAndRecordUsageMock(...args)
}));

import { createCompSubscription } from '../../src/services/subscription-comp-create.service';

describe('createCompSubscription', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        insertValuesMock.mockResolvedValue(undefined);
        updateWhereMock.mockResolvedValue(undefined);
        redeemAndRecordUsageMock.mockResolvedValue({ success: true, data: {} });
        // Default: plan exists with NULL productDomain (accommodation by historical default).
        selectLimitMock.mockResolvedValue([{ productDomain: null }]);
    });

    it('inserts a comp row (no mp id, far-future period, accommodation domain) + records redemption atomically', async () => {
        // Act
        const result = await createCompSubscription({
            customerId: 'cust-1',
            planId: 'plan-uuid-1',
            promoCodeId: 'pc-1',
            code: 'COMPVIP',
            interval: 'monthly',
            livemode: true
        });

        // Assert — returns the created id.
        expect(result.localSubscriptionId).toMatch(/[0-9a-f-]{36}/);

        // Insert shape: status='comp', no mp_subscription_id, period far-future.
        const inserted = insertValuesMock.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(inserted.status).toBe('comp');
        expect(inserted).not.toHaveProperty('mpSubscriptionId');
        expect(inserted.customerId).toBe('cust-1');
        expect(inserted.planId).toBe('plan-uuid-1');
        expect(inserted.billingInterval).toBe('month');
        expect(inserted.livemode).toBe(true);
        const periodEnd = inserted.currentPeriodEnd as Date;
        const periodStart = inserted.currentPeriodStart as Date;
        // Far future: at least 50 years out.
        expect(periodEnd.getTime() - periodStart.getTime()).toBeGreaterThan(
            50 * 365 * 24 * 60 * 60 * 1000
        );

        // product_domain + promo_code_id stamped via a typed UPDATE (HOS-75 T-005).
        expect(updateSetMock).toHaveBeenCalledWith({
            productDomain: 'accommodation',
            promoCodeId: 'pc-1'
        });
        expect(updateWhereMock).toHaveBeenCalledWith({
            op: 'eq',
            col: 'id',
            val: result.localSubscriptionId
        });

        // Redemption recorded against the NEW sub id, discountAmount 0, inside tx.
        expect(redeemAndRecordUsageMock).toHaveBeenCalledOnce();
        const redeemArg = redeemAndRecordUsageMock.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(redeemArg.promoCodeId).toBe('pc-1');
        expect(redeemArg.subscriptionId).toBe(result.localSubscriptionId);
        expect(redeemArg.discountAmount).toBe(0);
        expect(redeemArg.tx).toBe(txStub);
    });

    it('maps annual interval to billingInterval=year', async () => {
        await createCompSubscription({
            customerId: 'cust-1',
            planId: 'plan-uuid-1',
            promoCodeId: 'pc-1',
            code: 'COMPVIP',
            interval: 'annual',
            livemode: false
        });
        const inserted = insertValuesMock.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(inserted.billingInterval).toBe('year');
    });

    it('throws (rolls back) when the redemption fails — comp not granted', async () => {
        redeemAndRecordUsageMock.mockResolvedValue({
            success: false,
            error: { code: 'PROMO_CODE_MAX_USES', message: 'exhausted' }
        });

        await expect(
            createCompSubscription({
                customerId: 'cust-1',
                planId: 'plan-uuid-1',
                promoCodeId: 'pc-1',
                code: 'COMPVIP',
                interval: 'monthly',
                livemode: false
            })
        ).rejects.toThrow(/Comp redemption failed/);
    });

    it('SPEC-262 M2: allows NULL product_domain plan (historical accommodation plan, no extras column yet)', async () => {
        selectLimitMock.mockResolvedValue([{ productDomain: null }]);

        // Should NOT throw — NULL domain treated as accommodation.
        const result = await createCompSubscription({
            customerId: 'cust-1',
            planId: 'plan-legacy',
            promoCodeId: 'pc-1',
            code: 'COMPVIP',
            interval: 'monthly',
            livemode: false
        });

        expect(result.localSubscriptionId).toMatch(/[0-9a-f-]{36}/);
    });

    it('SPEC-262 M2: throws when plan has product_domain=commerce — cannot comp a commerce plan', async () => {
        selectLimitMock.mockResolvedValue([{ productDomain: 'commerce' }]);

        await expect(
            createCompSubscription({
                customerId: 'cust-1',
                planId: 'plan-commerce-uuid',
                promoCodeId: 'pc-1',
                code: 'COMPVIP',
                interval: 'monthly',
                livemode: false
            })
        ).rejects.toThrow(/only accommodation plans can be comped/);

        // Transaction must NOT have started — rejected before any write.
        expect(withTransactionMock).not.toHaveBeenCalled();
    });

    it('SPEC-262 M2: throws when plan is not found (missing from billing_plans)', async () => {
        selectLimitMock.mockResolvedValue([]); // empty result → plan not found

        await expect(
            createCompSubscription({
                customerId: 'cust-1',
                planId: 'plan-nonexistent',
                promoCodeId: 'pc-1',
                code: 'COMPVIP',
                interval: 'monthly',
                livemode: false
            })
        ).rejects.toThrow(/plan.*not found/i);

        expect(withTransactionMock).not.toHaveBeenCalled();
    });
});
