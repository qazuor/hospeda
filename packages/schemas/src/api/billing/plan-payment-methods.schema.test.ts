import { describe, expect, it } from 'vitest';
import {
    acceptsPaymentMethod,
    isSelfServiceCardCheckout,
    PLAN_PAYMENT_METHODS,
    PlanPaymentMethodsSchema
} from './plan-payment-methods.schema';

describe('HOS-2196 plan payment methods', () => {
    it('keeps the closed set of subscription payment methods', () => {
        expect(PLAN_PAYMENT_METHODS).toEqual(['CARD', 'MANUAL']);
    });

    it('accepts a non-empty list without repeats and rejects the rest', () => {
        expect(PlanPaymentMethodsSchema.safeParse(['CARD']).success).toBe(true);
        expect(PlanPaymentMethodsSchema.safeParse(['CARD', 'MANUAL']).success).toBe(true);
        expect(PlanPaymentMethodsSchema.safeParse([]).success).toBe(false);
        expect(PlanPaymentMethodsSchema.safeParse(['CARD', 'CARD']).success).toBe(false);
        expect(PlanPaymentMethodsSchema.safeParse(['CASH']).success).toBe(false);
    });

    it('reads acceptance from the list and nothing else', () => {
        expect(acceptsPaymentMethod({ paymentMethods: ['MANUAL'], method: 'CARD' })).toBe(false);
        expect(acceptsPaymentMethod({ paymentMethods: ['CARD', 'MANUAL'], method: 'MANUAL' })).toBe(
            true
        );
    });

    it('sells self-service only a card-only plan', () => {
        expect(isSelfServiceCardCheckout({ paymentMethods: ['CARD'] })).toBe(true);
        expect(isSelfServiceCardCheckout({ paymentMethods: ['CARD', 'MANUAL'] })).toBe(false);
        expect(isSelfServiceCardCheckout({ paymentMethods: ['MANUAL'] })).toBe(false);
    });
});
