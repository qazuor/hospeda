/** TEST:B1:14: RP7, RP8 and RP11 measured charge-record behaviour. */
import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it } from 'vitest';
import { FakePaymentProvider } from '../src/fake/index';

const ARS = { amountMinor: 1800000, currency: 'ARS' } as const;
const input = {
    reference: 'sub',
    amount: ARS,
    cadence: { everyMonths: 1 },
    reason: 'plan',
    returnUrl: 'https://example.test'
} as const;
const make = () => {
    const clock = createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') });
    return {
        clock,
        fake: new FakePaymentProvider({
            clock,
            honestAbout: [{ lie: 'M8', why: 'immediate test charge' }]
        })
    };
};
const active = async (fake: FakePaymentProvider) => {
    const auth = await fake.authorize(input);
    await fake.approve({ authorizationId: auth.authorizationId });
    return auth.authorizationId;
};

describe('TEST:B1:14 RP7, RP8, RP11', () => {
    it('RP7: first expiry is null and next is one UTC cadence later; switching RP7 removes it', async () => {
        const { fake } = make();
        const authorizationId = await active(fake);
        const first = await fake.charge({ authorizationId, amount: ARS, reference: '1' });
        const next = await fake.charge({ authorizationId, amount: ARS, reference: '2' });
        expect((await fake.readCharge(first)).snapshot.expiresAt).toBeNull();
        expect((await fake.readCharge(next)).snapshot.expiresAt).toBe('2026-11-01T03:00:00.000Z');
        const honestClock = createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') });
        const honest = new FakePaymentProvider({
            clock: honestClock,
            withoutBehaviour: [{ behaviour: 'RP7', why: 'exercise no expiry' }]
        });
        const id = await active(honest);
        await honest.charge({ authorizationId: id, amount: ARS, reference: '1' });
        const second = await honest.charge({ authorizationId: id, amount: ARS, reference: '2' });
        expect((await honest.readCharge(second)).snapshot.expiresAt).toBeNull();

        const annualClock = createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') });
        const annualFake = new FakePaymentProvider({
            clock: annualClock,
            honestAbout: [
                { lie: 'M8', why: 'immediate annual charges' },
                { lie: 'M1', why: 'retain the annual cadence' }
            ]
        });
        const annual = await annualFake.authorize({
            ...input,
            reference: 'annual',
            cadence: { everyMonths: 12 }
        });
        await annualFake.approve({ authorizationId: annual.authorizationId });
        await annualFake.charge({
            authorizationId: annual.authorizationId,
            amount: ARS,
            reference: '1'
        });
        const nextAnnual = await annualFake.charge({
            authorizationId: annual.authorizationId,
            amount: ARS,
            reference: '2'
        });
        expect((await annualFake.readCharge(nextAnnual)).snapshot.expiresAt).toBe(
            '2027-10-01T03:00:00.000Z'
        );
    });

    it('RP8: three retries bump one record and pause the authorization; switching RP8 prevents both', async () => {
        const { fake, clock } = make();
        const authorizationId = await active(fake);
        const opening = await fake.charge({ authorizationId, amount: ARS, reference: 'opening' });
        const cycle = await fake.failChargeCycle({ authorizationId, declineReason: 'declined' });
        expect((await fake.listCharges({ authorizationId })).chargeIds).toEqual([
            opening.chargeId,
            cycle.chargeId
        ]);
        const expiry = Date.parse((await fake.readCharge(cycle)).snapshot.expiresAt!);
        const start = clock.now().getTime();
        for (const quarter of [1, 2, 3]) {
            clock.set({ at: new Date(start + ((expiry - start) * quarter) / 4) });
            expect((await fake.readCharge(cycle)).snapshot.status).toBe('rejected');
        }
        expect((await fake.listCharges({ authorizationId })).chargeIds).toEqual([
            opening.chargeId,
            cycle.chargeId
        ]);
        clock.set({ at: new Date(expiry - 90_000) });
        expect((await fake.readAuthorization({ authorizationId })).snapshot.status).toBe('paused');
        expect((await fake.readCharge(cycle)).snapshot.status).toBe('rejected');
        const lastAttempt = (await fake.readAuthorization({ authorizationId })).snapshot
            .lastChargedAt;
        expect(lastAttempt).toBe(new Date(start + ((expiry - start) * 3) / 4).toISOString());
        expect(lastAttempt).not.toBe((await fake.readCharge(opening)).snapshot.createdAt);
        const honestClock = createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') });
        const honest = new FakePaymentProvider({
            clock: honestClock,
            withoutBehaviour: [{ behaviour: 'RP8', why: 'exercise no retry window' }]
        });
        const id = await active(honest);
        await honest.charge({ authorizationId: id, amount: ARS, reference: 'opening' });
        const failed = await honest.failChargeCycle({
            authorizationId: id,
            declineReason: 'declined'
        });
        honestClock.advance({ ms: 40 * 86400000 });
        expect((await honest.readCharge(failed)).snapshot.status).toBe('rejected');
        expect((await honest.readAuthorization({ authorizationId: id })).snapshot.status).toBe(
            'active'
        );
    });

    it('RP11 and M7: a failed attempt moves lastChargedAt while the list/count retains the record', async () => {
        const { fake, clock } = make();
        const authorizationId = await active(fake);
        const paid = await fake.charge({ authorizationId, amount: ARS, reference: 'paid' });
        clock.advance({ ms: 1_000 });
        const rejected = await fake.failChargeCycle({ authorizationId, declineReason: 'declined' });
        const snapshot = (await fake.readAuthorization({ authorizationId })).snapshot;
        expect(snapshot.chargeRecordCount).toBe(2);
        expect(snapshot.lastChargedAt).not.toBe((await fake.readCharge(paid)).snapshot.createdAt);
        expect((await fake.listCharges({ authorizationId })).chargeIds).toEqual([
            paid.chargeId,
            rejected.chargeId
        ]);
    });

    it('RP8 approval on attempt three ends retries; disabling RP11 keeps the approved instant', async () => {
        const { fake, clock } = make();
        const authorizationId = await active(fake);
        await fake.charge({ authorizationId, amount: ARS, reference: 'opening' });
        const cycle = await fake.failChargeCycle({
            authorizationId,
            declineReason: 'declined',
            approveOnAttempt: 3
        });
        const expiry = Date.parse((await fake.readCharge(cycle)).snapshot.expiresAt!);
        clock.advance({ ms: (expiry - clock.now().getTime()) / 2 });
        expect((await fake.readCharge(cycle)).snapshot.status).toBe('approved');
        expect((await fake.readAuthorization({ authorizationId })).snapshot.status).toBe('active');

        const honestClock = createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') });
        const honest = new FakePaymentProvider({
            clock: honestClock,
            honestAbout: [{ lie: 'M8', why: 'approved charges are immediate' }],
            withoutBehaviour: [{ behaviour: 'RP11', why: 'exercise approved-only date' }]
        });
        const id = await active(honest);
        await honest.charge({ authorizationId: id, amount: ARS, reference: 'paid' });
        const paidAt = (await honest.readAuthorization({ authorizationId: id })).snapshot
            .lastChargedAt;
        honestClock.advance({ ms: 1_000 });
        await honest.failChargeCycle({ authorizationId: id, declineReason: 'declined' });
        expect(
            (await honest.readAuthorization({ authorizationId: id })).snapshot.lastChargedAt
        ).toBe(paidAt);
    });
});
