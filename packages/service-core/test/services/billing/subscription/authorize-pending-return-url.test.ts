import { FakePaymentProvider } from '@repo/payments/fake';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@repo/db', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/db')>();
    return {
        ...original,
        subscriptionModel: {
            ...original.subscriptionModel,
            recordAuthorizationResult: vi.fn(async () => undefined)
        }
    };
});
vi.mock('../../../../src/services/billing/read-anchored-billing-option.js', () => ({
    readAnchoredBillingOption: vi.fn(async () => ({
        cycle: 'monthly',
        amount: 250_000,
        currency: 'ARS'
    }))
}));

import { authorizePendingSubscription } from '../../../../src/services/billing/subscription/start-subscription.service.js';

const subscriptionId = '123e4567-e89b-42d3-a456-426614174000';

describe('authorizePendingSubscription back_url (HOS-1979)', () => {
    it('hands the provider the result screen of THIS subscription, not the site origin', async () => {
        const clock = { now: () => new Date('2026-11-02T12:00:00.000Z') };
        const provider = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const authorize = vi.spyOn(provider, 'authorize');

        await authorizePendingSubscription({
            pending: {
                subscription: {
                    id: subscriptionId,
                    vertical: 'accommodation',
                    planVersionId: crypto.randomUUID(),
                    billingOptionId: crypto.randomUUID()
                },
                idempotencyKey: { id: crypto.randomUUID() }
            } as never,
            provider,
            clock,
            reason: 'test',
            returnUrl: 'https://hospeda.com.ar'
        }).catch(() => undefined);

        const sent = new URL(authorize.mock.calls[0]?.[0].returnUrl ?? '');
        expect(sent.origin).toBe('https://hospeda.com.ar');
        expect(sent.pathname).toBe('/es/mi-cuenta/suscripcion/');
        expect(sent.searchParams.get('subscription')).toBe(subscriptionId);
    });
});
