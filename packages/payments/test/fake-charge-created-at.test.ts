import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it } from 'vitest';
import { FakePaymentProvider } from '../src/fake/index';

const amount = { amountMinor: 1500, currency: 'ARS' } as const;
const authorizationInput = {
    reference: 'charge-created-at',
    amount,
    cadence: { everyMonths: 1 },
    reason: 'test',
    returnUrl: 'https://example.test/return'
} as const;

async function activeProvider(clock: ReturnType<typeof createAdjustableClock>, extra = {}) {
    const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID(), ...extra });
    const { authorizationId } = await fake.authorize(authorizationInput);
    await fake.approve({ authorizationId });
    return { fake, authorizationId };
}

describe('fake charge createdAt', () => {
    it('records the clock instant when charge is requested', async () => {
        const clock = createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') });
        const { fake, authorizationId } = await activeProvider(clock, {
            honestAbout: [{ lie: 'M8', why: 'verify the immediate record timestamp independently' }]
        });
        const { chargeId } = await fake.charge({ authorizationId, amount, reference: 'cycle' });
        expect((await fake.readCharge({ chargeId })).snapshot.createdAt).toBe(
            '2026-10-01T03:00:00.000Z'
        );
    });

    it('keeps the original instant when M8 approves a late charge', async () => {
        const clock = createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') });
        const { fake, authorizationId } = await activeProvider(clock);
        const { chargeId } = await fake.charge({
            authorizationId,
            amount,
            reference: 'late-cycle'
        });
        const createdAt = (await fake.readCharge({ chargeId })).snapshot.createdAt;
        expect((await fake.readCharge({ chargeId })).snapshot.status).toBe('pending');
        clock.advance({ ms: 2 * 60 * 60 * 1000 });
        const approved = (await fake.readCharge({ chargeId })).snapshot;
        expect(approved.status).toBe('approved');
        expect(approved.createdAt).toBe(createdAt);
    });

    it('records the clock instant for a rejected charge', async () => {
        const clock = createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') });
        const { fake, authorizationId } = await activeProvider(clock);
        const { chargeId } = await fake.declineCharge({
            authorizationId,
            declineReason: 'declined'
        });
        expect((await fake.readCharge({ chargeId })).snapshot.createdAt).toBe(
            '2026-10-01T03:00:00.000Z'
        );
    });
});
