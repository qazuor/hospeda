import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it } from 'vitest';
import { FakePaymentProvider, type FakePaymentProviderOptions } from '../src/fake';

const clock = createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') });
const input = {
    reference: 'subscription-1',
    amount: { amountMinor: 1_800_000, currency: 'ARS' },
    cadence: { everyMonths: 1 },
    reason: 'Plan mensual',
    returnUrl: 'https://hospeda.test/return'
} as const;

describe('fake id namespaces', () => {
    it('keeps ids distinct across provider instances with different namespaces', async () => {
        const first = new FakePaymentProvider({ clock, idNamespace: 'first' });
        const second = new FakePaymentProvider({ clock, idNamespace: 'second' });

        const firstId = (await first.authorize(input)).authorizationId;
        const secondId = (await second.authorize(input)).authorizationId;

        expect(firstId).toBe('fake-auth-first-1');
        expect(secondId).toBe('fake-auth-second-1');
        expect(secondId).not.toBe(firstId);
    });

    it('preserves the legacy id format without a namespace', async () => {
        const fake = new FakePaymentProvider({ clock });

        expect((await fake.authorize(input)).authorizationId).toBe('fake-auth-1');
    });

    it('rejects an empty namespace', () => {
        expect(
            () => new FakePaymentProvider({ clock, idNamespace: '' } as FakePaymentProviderOptions)
        ).toThrow();
    });
});
