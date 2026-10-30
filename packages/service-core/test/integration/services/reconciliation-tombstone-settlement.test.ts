import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoverageNotices } from '../../../src/services/billing/payment/payment-ports.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import {
    createChargingFake,
    handleCharge,
    settlementRows,
    tombstoneRows,
    unknownCharge
} from './reconciliation-tombstone-fixtures.js';

beforeAll(() => {
    getServiceTestDb();
});
afterAll(closeServiceTestPool);
beforeEach(() => vi.restoreAllMocks());

async function settledTombstone(coverageNotices?: CoverageNotices) {
    const { fake, provider } = createChargingFake();
    const { authorizationId, chargeId } = await unknownCharge(fake);
    const { result } = await handleCharge(
        { authorizationId, chargeId },
        coverageNotices ? { provider, coverageNotices } : { provider }
    );
    if (result.outcome !== 'MARKED' || !result.paymentId) throw new Error('Expected a tombstone');
    return { result, paymentId: result.paymentId, subscriptionId: result.subscriptionId };
}

describe('TEST:B11:5 el asiento sobre una lápida', () => {
    it('TEST:B11:5 the payment is SUCCEEDED with its receipt and no recipient, no mail, no covered_period and no promo', async () => {
        const { result, paymentId, subscriptionId } = await settledTombstone();
        expect(result).toMatchObject({
            credit: { outcome: 'CREDITED', coverage: 'NOT_APPLICABLE' }
        });
        const rows = await tombstoneRows(subscriptionId);
        expect(rows.payments).toMatchObject([{ id: paymentId, status: 'SUCCEEDED' }]);
        const settled = await settlementRows({ paymentId, subscriptionId });
        expect(settled.receipts).toHaveLength(1);
        expect(settled.receipts[0]).toMatchObject({ payerName: null, payerEmail: null });
        expect(settled.mails).toHaveLength(0);
        expect(settled.coverageByPayment).toHaveLength(0);
        expect(settled.coverageBySubscription).toHaveLength(0);
        expect(settled.promos).toHaveLength(0);
    });

    it('TEST:B11:5 with the coverage consumer down the payment and the mark stay written, and no notice is even asked', async () => {
        const emitCoverageChanged = vi.fn<CoverageNotices['emitCoverageChanged']>(async () => {
            throw new Error('coverage consumer down');
        });
        const { paymentId, subscriptionId } = await settledTombstone({ emitCoverageChanged });
        const rows = await tombstoneRows(subscriptionId);
        expect(rows.payments).toMatchObject([{ id: paymentId, status: 'SUCCEEDED' }]);
        expect(rows.marks.map((mark) => mark.reason)).toEqual(['PAGO_TARDIO_RECHAZADO']);
        expect(rows.hung.map((hung) => hung.paymentId)).toEqual([paymentId]);
        expect(emitCoverageChanged).not.toHaveBeenCalled();
    });
});
