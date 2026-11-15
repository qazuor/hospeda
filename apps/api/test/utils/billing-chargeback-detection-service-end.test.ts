/** TEST:B8a:7 exercises the production builder's S12 dispatch on a scheduled row. */
import { describe, expect, it, vi } from 'vitest';

const { applyS12 } = vi.hoisted(() => ({
    applyS12: vi.fn().mockResolvedValue({
        outcome: 'CANCELLED',
        subscriptionId: '10000000-0000-4000-8000-000000000001',
        successorCut: 'NO_LIVE_SUCCESSOR',
        cancelledAddons: 0,
        mailEnqueued: true
    })
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...original,
        applyS12ByChargeback: applyS12,
        createChargebackSuspension: () => ({
            suspend: vi.fn().mockResolvedValue({ outcome: 'NOT_APPLICABLE' })
        })
    };
});
vi.mock('@repo/db', async () => {
    const { createDbMock } = await import('../helpers/mocks/db-mock');
    return {
        ...createDbMock(),
        planCatalogModel: {},
        reconciliationMarkModel: {
            hasPaymentHungOnReason: vi.fn().mockResolvedValue(true)
        },
        getDb: () => ({
            select: () => ({
                from: () => ({
                    where: () => ({ limit: async () => [{ status: 'CANCEL_SCHEDULED' }] })
                })
            })
        })
    };
});
vi.mock('../../src/utils/payment-provider', () => ({
    getPaymentProvider: () => ({ readAuthorization: vi.fn() })
}));
vi.mock('../../src/utils/clock', () => ({
    getClock: () => ({ clock: { now: () => new Date('2026-10-12T12:00:00.000Z') } })
}));

import { buildChargebackDetection } from '../../src/utils/billing-chargeback-detection';

describe('TEST:B8a:7 the API builder dispatches S12 for a charged-back scheduled row', () => {
    it('executes serviceEnd with the payment reread by the caller', async () => {
        const subscriptionId = '10000000-0000-4000-8000-000000000001';
        const paymentId = '20000000-0000-4000-8000-000000000002';
        applyS12.mockClear();
        const detection = buildChargebackDetection({
            markPayments: { hang: vi.fn(), countUnresolved: vi.fn() }
        });

        const result = await detection.detect({
            payment: { id: paymentId, subscriptionId, status: 'SUCCEEDED' },
            actor: 'provider',
            correlationId: crypto.randomUUID()
        });

        expect(applyS12).toHaveBeenCalledWith(
            { subscriptionId, paymentId, now: new Date('2026-10-12T12:00:00.000Z') },
            expect.objectContaining({
                successorCutter: expect.objectContaining({ cutSuccessor: expect.any(Function) }),
                orphanhood: expect.objectContaining({ addonPolicy: expect.any(Function) }),
                complements: expect.objectContaining({ addonPolicy: expect.any(Function) })
            })
        );
        expect(result.serviceEnd).toMatchObject({ outcome: 'CANCELLED', subscriptionId });
    });
});
