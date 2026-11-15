import { describe, expect, it } from 'vitest';
import {
    AddonPurchaseReadResponseSchema,
    AddonPurchaseRequestSchema,
    AddonPurchaseResponseSchema
} from '../../../src/api/billing/addon-purchase.schema';

const id = 'a7599237-05d1-43e7-bf78-37cb26f6c819';
const request = {
    productId: id,
    targetId: null,
    orderRequestId: 'purchase-1',
    addonVersionId: id
};

describe('Addon purchase API schemas', () => {
    it('accepts the payment shape and its optional payer email', () => {
        expect(AddonPurchaseRequestSchema.safeParse(request).success).toBe(true);
        expect(
            AddonPurchaseRequestSchema.safeParse({
                ...request,
                payerEmail: 'payer@example.test',
                payment: { token: 'tok', brand: 'visa', kind: 'credit' }
            }).success
        ).toBe(true);
    });

    it('rejects extra fields and malformed identifiers or payment details', () => {
        expect(AddonPurchaseRequestSchema.safeParse({ ...request, surprise: true }).success).toBe(
            false
        );
        expect(
            AddonPurchaseRequestSchema.safeParse({ ...request, orderRequestId: '' }).success
        ).toBe(false);
        expect(AddonPurchaseRequestSchema.safeParse({ ...request, targetId: 'bad' }).success).toBe(
            false
        );
        expect(
            AddonPurchaseRequestSchema.safeParse({
                ...request,
                payment: { token: 'tok', brand: 'visa', kind: 'cash' }
            }).success
        ).toBe(false);
    });

    it('accepts pending and active response shapes', () => {
        expect(
            AddonPurchaseResponseSchema.safeParse({
                outcome: 'PENDING_ELSEWHERE',
                instanceId: id,
                chargeKind: 'PERIODICO',
                processing: true
            }).success
        ).toBe(true);
        expect(
            AddonPurchaseReadResponseSchema.safeParse({
                instanceId: id,
                status: 'ACTIVE',
                chargeKind: 'UNA_VEZ',
                processing: false
            }).success
        ).toBe(true);
    });
});
