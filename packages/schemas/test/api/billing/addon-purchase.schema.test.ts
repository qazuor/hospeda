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
    it('accepts the request and its optional payer email', () => {
        expect(AddonPurchaseRequestSchema.safeParse(request).success).toBe(true);
        expect(
            AddonPurchaseRequestSchema.safeParse({ ...request, payerEmail: 'payer@example.test' })
                .success
        ).toBe(true);
    });

    it.each([
        ['payment', { token: 'tok', brand: 'visa', kind: 'credit' }],
        ['token', 'tok'],
        ['cardToken', 'tok'],
        ['paymentToken', 'tok']
    ])('rejects card data in the request: %s (HOS-2179 AC-2)', (field, value) => {
        expect(AddonPurchaseRequestSchema.safeParse({ ...request, [field]: value }).success).toBe(
            false
        );
    });

    it('rejects extra fields and malformed identifiers', () => {
        expect(AddonPurchaseRequestSchema.safeParse({ ...request, surprise: true }).success).toBe(
            false
        );
        expect(
            AddonPurchaseRequestSchema.safeParse({ ...request, orderRequestId: '' }).success
        ).toBe(false);
        expect(AddonPurchaseRequestSchema.safeParse({ ...request, targetId: 'bad' }).success).toBe(
            false
        );
    });

    it('answers a one-time purchase like a recurring one, with no order result', () => {
        const created = {
            outcome: 'CREATED',
            instanceId: id,
            chargeKind: 'UNA_VEZ',
            processing: false,
            checkoutUrl: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1'
        };
        expect(AddonPurchaseResponseSchema.safeParse(created).success).toBe(true);
        expect(
            AddonPurchaseResponseSchema.safeParse({
                ...created,
                order: { outcome: 'ACTIVATED' }
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
                processing: false,
                productId: id,
                targetId: null,
                addonVersionId: id
            }).success
        ).toBe(true);
    });

    describe('HOS-2680: the read carries the purchase identity', () => {
        const read = {
            instanceId: id,
            status: 'PENDING_AUTHORIZATION',
            chargeKind: 'PERIODICO',
            processing: true,
            productId: id,
            targetId: id,
            addonVersionId: id
        };

        it('accepts a targeted and an untargeted identity', () => {
            // Arrange / Act / Assert
            expect(AddonPurchaseReadResponseSchema.safeParse(read).success).toBe(true);
            expect(
                AddonPurchaseReadResponseSchema.safeParse({ ...read, targetId: null }).success
            ).toBe(true);
        });

        it.each(['productId', 'targetId', 'addonVersionId'])('requires %s', (field) => {
            // Arrange
            const { [field as keyof typeof read]: _omitted, ...rest } = read;

            // Act
            const parsed = AddonPurchaseReadResponseSchema.safeParse(rest);

            // Assert
            expect(parsed.success).toBe(false);
        });

        it.each(['productId', 'targetId', 'addonVersionId'])('rejects a malformed %s', (field) => {
            expect(
                AddonPurchaseReadResponseSchema.safeParse({ ...read, [field]: 'bad' }).success
            ).toBe(false);
        });

        it('never carries a checkout link', () => {
            expect(
                AddonPurchaseReadResponseSchema.safeParse({
                    ...read,
                    checkoutUrl: 'https://www.mercadopago.com.ar/subscriptions/checkout?x=1'
                }).success
            ).toBe(false);
        });
    });
});
