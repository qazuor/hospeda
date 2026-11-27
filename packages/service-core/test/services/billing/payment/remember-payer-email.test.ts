import { describe, expect, it } from 'vitest';
import { resolvePayerEmailToRemember } from '../../../../src/services/billing/payment/remember-payer-email';

const base = {
    class: 'PRINCIPAL',
    userId: 'user-1',
    declaredPayerEmail: 'payer@example.test'
} as const;

describe('HOS-2616 resolvePayerEmailToRemember', () => {
    it('remembers the declared email of an approved principal subscription charge', () => {
        expect(resolvePayerEmailToRemember({ subscription: base })).toEqual({
            userId: 'user-1',
            email: 'payer@example.test'
        });
    });

    it('remembers the declared email of an approved complement charge', () => {
        expect(
            resolvePayerEmailToRemember({ subscription: { ...base, class: 'COMPLEMENTO' } })
        ).toEqual({
            userId: 'user-1',
            email: 'payer@example.test'
        });
    });

    it('trims the declared email', () => {
        expect(
            resolvePayerEmailToRemember({
                subscription: { ...base, declaredPayerEmail: '  a@b.test ' }
            })
        ).toEqual({ userId: 'user-1', email: 'a@b.test' });
    });

    it.each([
        ['a payment without subscription (one-time add-on page)', undefined],
        ['a LAPIDA subscription', { ...base, class: 'LAPIDA' }],
        ['a subscription that declared no email', { ...base, declaredPayerEmail: null }],
        ['a subscription whose declared email is blank', { ...base, declaredPayerEmail: '   ' }],
        ['a subscription without an account', { ...base, userId: null }]
    ])('learns nothing from %s', (_label, subscription) => {
        expect(resolvePayerEmailToRemember({ subscription })).toBeNull();
    });
});
