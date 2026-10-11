import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it } from 'vitest';
import { FakePaymentProvider } from '../src/fake/index';

describe('authorization lastModifiedAt', () => {
    it('TEST:B3:18 updates only when the fake changes the authorization', async () => {
        const clock = createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') });
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        const { authorizationId } = await fake.authorize({
            reference: 'lm',
            amount: { amountMinor: 1500, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'test',
            returnUrl: 'https://example.test'
        });
        const created = (await fake.readAuthorization({ authorizationId })).snapshot.lastModifiedAt;
        clock.advance({ ms: 1000 });
        expect((await fake.readAuthorization({ authorizationId })).snapshot.lastModifiedAt).toBe(
            created
        );
        await fake.approve({ authorizationId });
        expect((await fake.readAuthorization({ authorizationId })).snapshot.lastModifiedAt).toBe(
            '2026-10-01T03:00:01.000Z'
        );
        clock.advance({ ms: 1000 });
        await fake.changeAmount({
            authorizationId,
            amount: { amountMinor: 2000, currency: 'ARS' }
        });
        expect((await fake.readAuthorization({ authorizationId })).snapshot.lastModifiedAt).toBe(
            '2026-10-01T03:00:02.000Z'
        );
    });
});
