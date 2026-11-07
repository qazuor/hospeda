import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
    status: 'CANCEL_SCHEDULED',
    alreadyHung: false,
    mark: vi.fn(),
    read: vi.fn()
}));
vi.mock('@repo/db', async (importOriginal) => {
    const real = await importOriginal<typeof import('@repo/db')>();
    const query = {
        from: () => query,
        where: () => query,
        limit: async () => [{ status: mock.status }]
    };
    return {
        ...real,
        getDb: () => ({ select: () => query }),
        reconciliationMarkModel: {
            ...real.reconciliationMarkModel,
            hasPaymentHungOnReason: async () => mock.alreadyHung
        }
    };
});
vi.mock('../../../../src/services/billing/reconciliation/open-reconciliation-mark.service', () => ({
    openReconciliationMark: async () => {
        mock.mark();
        return { mark: { id: 'mark-id' } };
    }
}));

import { createChargebackDetection } from '../../../../src/services/billing/reconciliation/chargeback/chargeback-detection';

const subscriptionId = '9a27d711-068a-4df0-81a8-03a469b0b6b1';
const paymentId = '67f922d4-56d9-48d8-94a7-f651c5e2c4fb';
const now = new Date('2026-10-01T12:00:00.000Z');
const payment = { id: paymentId, subscriptionId, status: 'SUCCEEDED' };
const input = { payment, actor: 'job' as const, correlationId: 'correlation' };
const result = {
    outcome: 'CANCELLED' as const,
    subscriptionId,
    successorCut: 'NO_LIVE_SUCCESSOR' as const,
    cancelledAddons: 0,
    mailEnqueued: true
};

beforeEach(() => {
    mock.status = 'CANCEL_SCHEDULED';
    mock.alreadyHung = false;
    mock.mark.mockClear();
    mock.read.mockClear();
    mock.read.mockResolvedValue(result);
});

describe('TEST:B8a:7 chargeback detection S12 dispatch', () => {
    it('calls the S12 port after MARKED', async () => {
        const detection = createChargebackDetection({
            clock: { now: () => now },
            serviceEnd: { run: mock.read }
        });
        expect(await detection.detect(input)).toMatchObject({
            outcome: 'MARKED',
            serviceEnd: result
        });
        expect(mock.read).toHaveBeenCalledExactlyOnceWith({ subscriptionId, paymentId, now });
    });

    it('calls the S12 port after ALREADY_MARKED', async () => {
        mock.alreadyHung = true;
        const detection = createChargebackDetection({
            clock: { now: () => now },
            serviceEnd: { run: mock.read }
        });
        expect(await detection.detect(input)).toMatchObject({
            outcome: 'ALREADY_MARKED',
            serviceEnd: result
        });
        expect(mock.read).toHaveBeenCalledExactlyOnceWith({ subscriptionId, paymentId, now });
    });

    it.each([
        'ACTIVE',
        'GRACE_PERIOD',
        'PAUSED',
        'SUSPENDED'
    ])('does not call S12 from %s', async (status) => {
        mock.status = status;
        const detection = createChargebackDetection({ serviceEnd: { run: mock.read } });
        expect((await detection.detect(input)).outcome).toBe('MARKED');
        expect(mock.read).toHaveBeenCalledTimes(0);
    });
});
