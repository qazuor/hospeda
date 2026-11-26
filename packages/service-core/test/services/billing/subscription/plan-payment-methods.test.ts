import { describe, expect, it } from 'vitest';
import {
    assertPlanAcceptsPaymentMethod,
    assertSelfServiceCardCheckout
} from '../../../../src/services/billing/subscription/plan-payment-methods.js';

describe('HOS-2196 plan payment method guards', () => {
    it('lets a card-only plan through the public checkout', () => {
        expect(() => assertSelfServiceCardCheckout({ paymentMethods: ['CARD'] })).not.toThrow();
    });

    it('refuses a plan that also accepts manual payment with PLAN_NOT_SELF_SERVICE', () => {
        expect(() => assertSelfServiceCardCheckout({ paymentMethods: ['CARD', 'MANUAL'] })).toThrow(
            expect.objectContaining({ reason: 'PLAN_NOT_SELF_SERVICE', code: 'VALIDATION_ERROR' })
        );
    });

    it('refuses a method the plan does not accept with PAYMENT_METHOD_NOT_ACCEPTED', () => {
        expect(() =>
            assertPlanAcceptsPaymentMethod({ paymentMethods: ['MANUAL'], method: 'CARD' })
        ).toThrow(expect.objectContaining({ reason: 'PAYMENT_METHOD_NOT_ACCEPTED' }));
        expect(() =>
            assertPlanAcceptsPaymentMethod({ paymentMethods: ['CARD', 'MANUAL'], method: 'CARD' })
        ).not.toThrow();
    });
});
