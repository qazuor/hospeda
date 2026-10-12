import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it } from 'vitest';
import { FakePaymentProvider } from '../src/fake';

const AUTHORIZATION = {
    amount: { amountMinor: 180_000, currency: 'ARS' },
    cadence: { everyMonths: 1 },
    reference: 'subscription-card-validation',
    reason: 'Plan mensual',
    returnUrl: 'https://hospeda.test/return'
};

const testClock = () => createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') });

describe('TEST:B5:24 RP12 fake card validation', () => {
    it('approve records one zero amount validation and sends both charge deliveries for the same id', async () => {
        const clock = testClock();
        const fake = new FakePaymentProvider({ clock });
        const { authorizationId } = await fake.authorize(AUTHORIZATION);
        await fake.approve({ authorizationId });

        const deliveries = fake.takeDeliveries().deliveries;
        const decoded = await Promise.all(
            deliveries.map((delivery) => fake.decodeNotice(delivery))
        );
        const chargeNotices = decoded.filter((notice) => notice.resourceKind === 'charge');
        expect(chargeNotices).toHaveLength(2);
        expect(chargeNotices[0]?.resourceId).toBe(chargeNotices[1]?.resourceId);
        const snapshot = (await fake.readCharge({ chargeId: chargeNotices[0]!.resourceId }))
            .snapshot;
        expect(snapshot).toMatchObject({
            purpose: 'cardValidation',
            authorizationId: null,
            reference: null,
            status: 'approved',
            amount: { amountMinor: 0, currency: 'ARS' }
        });
        expect(snapshot.createdAt).toBe(clock.now().toISOString());
        expect(snapshot.refundedAmount).toEqual({ amountMinor: 0, currency: 'ARS' });
    });

    it('changeCard records rejection or approval according to the card', async () => {
        const fake = new FakePaymentProvider({ clock: testClock() });
        const { authorizationId } = await fake.authorize(AUTHORIZATION);
        const rejected = await fake.changeCard({ authorizationId, passes: false });
        const approved = await fake.changeCard({ authorizationId, passes: true });
        expect((await fake.readCharge({ chargeId: rejected!.chargeId })).snapshot.status).toBe(
            'rejected'
        );
        expect((await fake.readCharge({ chargeId: approved!.chargeId })).snapshot.status).toBe(
            'approved'
        );
    });

    it('turns RP12 off by name for approve and changeCard', async () => {
        const fake = new FakePaymentProvider({
            clock: testClock(),
            withoutBehaviour: [
                { behaviour: 'RP12', why: 'exercise the healthy authorization path' }
            ]
        });
        const { authorizationId } = await fake.authorize(AUTHORIZATION);
        await fake.approve({ authorizationId });
        expect(await fake.changeCard({ authorizationId, passes: true })).toBeNull();
        const deliveries = fake.takeDeliveries().deliveries;
        const notices = await Promise.all(
            deliveries.map((delivery) => fake.decodeNotice(delivery))
        );
        expect(notices.some((notice) => notice.resourceKind === 'charge')).toBe(false);
    });

    it('marks requested and rejected charge records as charge purpose', async () => {
        const fake = new FakePaymentProvider({ clock: testClock() });
        const { authorizationId } = await fake.authorize(AUTHORIZATION);
        const declined = await fake.declineCharge({ authorizationId, declineReason: 'declined' });
        expect((await fake.readCharge(declined)).snapshot.purpose).toBe('charge');
        await fake.approve({ authorizationId });
        const charged = await fake.charge({
            authorizationId,
            amount: AUTHORIZATION.amount,
            reference: 'cycle'
        });
        expect((await fake.readCharge(charged)).snapshot.purpose).toBe('charge');
    });
});
