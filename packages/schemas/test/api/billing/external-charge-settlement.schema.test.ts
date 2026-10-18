import { describe, expect, it } from 'vitest';
import {
    ExternalChargeReceptionSchema,
    ExternalChargeSettlementRequestSchema,
    ExternalChargeSettlementResponseSchema
} from '../../../src/api/billing/external-charge-settlement.schema.js';

const PAYMENT_ID = '7a1f4c2e-3b5d-4e6f-8a9b-0c1d2e3f4a5b';

describe('ExternalChargeSettlementRequestSchema', () => {
    it.each([
        { chargeId: 'charge-1' },
        { chargeId: 'charge-1', note: 'Reviewed' }
    ])('accepts a valid request', (body) =>
        expect(ExternalChargeSettlementRequestSchema.safeParse(body).success).toBe(true));

    it('trims charge id and note', () => {
        expect(
            ExternalChargeSettlementRequestSchema.parse({ chargeId: ' charge-1 ', note: ' hi ' })
        ).toEqual({
            chargeId: 'charge-1',
            note: 'hi'
        });
    });

    it.each(['', '   ', 'x'.repeat(256)])('rejects invalid charge id %j', (chargeId) => {
        expect(ExternalChargeSettlementRequestSchema.safeParse({ chargeId }).success).toBe(false);
    });
});

describe('ExternalChargeSettlementResponseSchema', () => {
    it('accepts the exact successful response shape', () => {
        expect(
            ExternalChargeSettlementResponseSchema.parse({
                paymentId: PAYMENT_ID,
                paymentStatus: 'SUCCEEDED',
                coverage: 'WRITTEN',
                reception: 'P1'
            })
        ).toEqual({
            paymentId: PAYMENT_ID,
            paymentStatus: 'SUCCEEDED',
            coverage: 'WRITTEN',
            reception: 'P1'
        });
    });

    it('exposes the receiver reception values', () => {
        expect(ExternalChargeReceptionSchema.options).toEqual([
            'P1',
            'S5',
            'S7',
            'S19_RETAINED',
            'CONDITION_FAILED',
            'EXTENDED',
            'NOT_EXTENDED',
            'CROSSING_MARKED'
        ]);
    });
});
