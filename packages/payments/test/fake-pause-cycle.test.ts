import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it } from 'vitest';
import { FakePaymentProvider } from '../src/fake/index';

const start = new Date('2026-10-01T03:00:00.000Z');
const make = (options: { honestM12?: boolean; withoutRP10?: boolean } = {}) => {
    const clock = createAdjustableClock({ start });
    const fake = new FakePaymentProvider({
        clock,
        ...(options.honestM12
            ? { honestAbout: [{ lie: 'M12', why: 'exercise automatic return' }] }
            : {}),
        ...(options.withoutRP10
            ? { withoutBehaviour: [{ behaviour: 'RP10', why: 'exercise unchanged date' }] }
            : {})
    });
    return { clock, fake };
};
const authorized = async (fake: FakePaymentProvider) => {
    const { authorizationId } = await fake.authorize({
        reference: crypto.randomUUID(),
        amount: { amountMinor: 250000, currency: 'ARS' },
        cadence: { everyMonths: 1 },
        reason: 'pause cycle',
        returnUrl: 'https://example.test/return'
    });
    await fake.approve({ authorizationId });
    return authorizationId;
};

describe('AC:B8b:28 M12 and RP10 fake pause cycle', () => {
    it('keeps capability pauses with M12 and returns at the charge date when M12 is off', async () => {
        const lying = make();
        const id = await authorized(lying.fake);
        lying.fake.moveNextCharge({
            authorizationId: id,
            at: new Date('2026-11-01T03:00:00.000Z')
        });
        await lying.fake.pause({ authorizationId: id });
        lying.clock.set({ at: new Date('2026-11-02T03:00:00.000Z') });
        expect((await lying.fake.readAuthorization({ authorizationId: id })).snapshot.status).toBe(
            'paused'
        );
        const honest = make({ honestM12: true });
        const honestId = await authorized(honest.fake);
        honest.fake.moveNextCharge({
            authorizationId: honestId,
            at: new Date('2026-11-01T03:00:00.000Z')
        });
        await honest.fake.pause({ authorizationId: honestId });
        const before = await honest.fake.readAuthorization({ authorizationId: honestId });
        honest.clock.set({ at: new Date('2026-11-02T03:00:00.000Z') });
        const after = await honest.fake.readAuthorization({ authorizationId: honestId });
        expect(after.snapshot.status).toBe('active');
        expect(after.snapshot.lastModifiedAt).toBe('2026-11-01T03:00:00.000Z');
        expect(before.snapshot.lastModifiedAt).toBe('2026-10-01T03:00:00.000Z');
    });

    it('does not automatically return a pause caused by a failed charge cycle', async () => {
        const { clock, fake } = make({ honestM12: true });
        const authorizationId = await authorized(fake);
        await fake.charge({
            authorizationId,
            amount: { amountMinor: 250000, currency: 'ARS' },
            reference: 'opening'
        });
        await fake.failChargeCycle({ authorizationId, declineReason: 'declined' });
        clock.set({ at: new Date('2026-11-05T03:00:00.000Z') });
        expect((await fake.readAuthorization({ authorizationId })).snapshot.status).toBe('paused');
    });

    it('advances overdue RP10 dates without a charge and preserves the date when disabled', async () => {
        for (const withoutRP10 of [false, true]) {
            const { clock, fake } = make({ withoutRP10 });
            const authorizationId = await authorized(fake);
            fake.moveNextCharge({ authorizationId, at: new Date('2026-10-01T03:00:00.000Z') });
            await fake.pause({ authorizationId });
            clock.set({ at: new Date('2026-12-01T03:00:00.000Z') });
            const before = await fake.readAuthorization({ authorizationId });
            const chargesBefore = await fake.listCharges({ authorizationId });
            await fake.resume({ authorizationId });
            const after = await fake.readAuthorization({ authorizationId });
            const chargesAfter = await fake.listCharges({ authorizationId });
            expect(before.snapshot.nextChargeAt).toBe('2026-10-01T03:00:00.000Z');
            expect(after.snapshot.nextChargeAt).toBe(
                withoutRP10 ? '2026-10-01T03:00:00.000Z' : '2027-01-01T03:00:00.000Z'
            );
            expect(chargesBefore.chargeIds).toHaveLength(0);
            expect(chargesAfter.chargeIds).toHaveLength(0);
            expect(after.snapshot.lastChargedAt).toBe(before.snapshot.lastChargedAt);
        }
    });
});
