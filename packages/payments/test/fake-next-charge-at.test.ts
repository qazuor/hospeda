import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it } from 'vitest';
import { FakePaymentProvider } from '../src/fake/fake-payment-provider';

const start = new Date('2026-10-01T03:00:00.000Z');
const input = (everyMonths = 1, firstChargeAt?: string) => ({
    reference: `next-${everyMonths}-${firstChargeAt ?? 'now'}`,
    amount: { amountMinor: 1800, currency: 'ARS' },
    cadence: { everyMonths },
    reason: 'test',
    returnUrl: 'https://example.test',
    ...(firstChargeAt === undefined ? {} : { firstChargeAt })
});

describe('TEST:1685:1 the fake models the provider calendar', () => {
    it('starts pending at null and sets the calendar on approval', async () => {
        const clock = createAdjustableClock({ start });
        const fake = new FakePaymentProvider({
            clock,
            honestAbout: [{ lie: 'M1', why: 'this case models the submitted provider calendar' }]
        });
        const { authorizationId } = await fake.authorize(input());
        expect(
            (await fake.readAuthorization({ authorizationId })).snapshot.nextChargeAt
        ).toBeNull();
        await fake.approve({ authorizationId });
        expect((await fake.readAuthorization({ authorizationId })).snapshot.nextChargeAt).toBe(
            start.toISOString()
        );
    });

    it('uses a future first charge date on approval', async () => {
        const fake = new FakePaymentProvider({
            clock: createAdjustableClock({ start }),
            honestAbout: [{ lie: 'M1', why: 'this case models the submitted provider calendar' }]
        });
        const firstChargeAt = '2026-11-01T03:00:00.000Z';
        const { authorizationId } = await fake.authorize(input(1, firstChargeAt));
        await fake.approve({ authorizationId });
        expect((await fake.readAuthorization({ authorizationId })).snapshot.nextChargeAt).toBe(
            firstChargeAt
        );
    });

    it.each([
        [1, '2026-11-01T03:00:00.000Z'],
        [12, '2027-10-01T03:00:00.000Z']
    ] as const)('advances a created charge by %i month(s)', async (months, expected) => {
        const fake = new FakePaymentProvider({
            clock: createAdjustableClock({ start }),
            honestAbout: [{ lie: 'M1', why: 'this case models the submitted provider calendar' }]
        });
        const { authorizationId } = await fake.authorize(input(months));
        await fake.approve({ authorizationId });
        await fake.charge({ authorizationId, amount: input().amount, reference: 'charge' });
        expect((await fake.readAuthorization({ authorizationId })).snapshot.nextChargeAt).toBe(
            expected
        );
    });

    it('advances declined cycles once, leaves resume and lastModifiedAt alone, and supports moving the date', async () => {
        const clock = createAdjustableClock({ start });
        const fake = new FakePaymentProvider({
            clock,
            honestAbout: [{ lie: 'M1', why: 'this case models the submitted provider calendar' }]
        });
        const { authorizationId } = await fake.authorize(input());
        await fake.approve({ authorizationId });
        const modified = (await fake.readAuthorization({ authorizationId })).snapshot
            .lastModifiedAt;
        await fake.declineCharge({ authorizationId, declineReason: 'declined' });
        const afterDecline = (await fake.readAuthorization({ authorizationId })).snapshot;
        expect(afterDecline.nextChargeAt).toBe('2026-11-01T03:00:00.000Z');
        expect(afterDecline.lastModifiedAt).toBe(modified);
        await fake.pause({ authorizationId });
        const pausedDate = (await fake.readAuthorization({ authorizationId })).snapshot
            .nextChargeAt;
        await fake.resume({ authorizationId });
        expect((await fake.readAuthorization({ authorizationId })).snapshot.nextChargeAt).toBe(
            pausedDate
        );
        const moved = new Date('2027-01-01T03:00:00.000Z');
        fake.moveNextCharge({ authorizationId, at: moved });
        expect((await fake.readAuthorization({ authorizationId })).snapshot.nextChargeAt).toBe(
            moved.toISOString()
        );
    });

    it('advances failChargeCycle once across retries and still rejects pending charges', async () => {
        const clock = createAdjustableClock({ start });
        const fake = new FakePaymentProvider({
            clock,
            honestAbout: [{ lie: 'M1', why: 'this case models the submitted provider calendar' }]
        });
        const { authorizationId } = await fake.authorize(input());
        await fake.approve({ authorizationId });
        await fake.charge({ authorizationId, amount: input().amount, reference: 'first' });
        await fake.failChargeCycle({ authorizationId, declineReason: 'declined' });
        const expected = '2026-12-01T03:00:00.000Z';
        clock.advance({ ms: 30 * 24 * 60 * 60 * 1000 });
        await fake.readAuthorization({ authorizationId });
        expect((await fake.readAuthorization({ authorizationId })).snapshot.nextChargeAt).toBe(
            expected
        );
        const pending = await fake.authorize({ ...input(), reference: 'pending' });
        await expect(
            fake.charge({
                authorizationId: pending.authorizationId,
                amount: input().amount,
                reference: 'no'
            })
        ).rejects.toThrow();
    });
});
