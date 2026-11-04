import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it } from 'vitest';
import { FakePaymentProvider } from '../src/fake/index';

const ARS = (amountMinor: number) => ({ amountMinor, currency: 'ARS' }) as const;

async function setup() {
    const fake = new FakePaymentProvider({
        clock: createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') }),
        honestAbout: [
            { lie: 'M6', why: 'the test counts charge notices for each version' },
            { lie: 'M8', why: 'the test reads an approved charge immediately' },
            { lie: 'M13', why: 'the test exercises accepted partial refunds' }
        ],
        withoutBehaviour: [{ behaviour: 'RP12', why: 'the test exercises regular charges' }]
    });
    const { authorizationId } = await fake.authorize({
        reference: 'refund-outcome',
        amount: ARS(1500),
        cadence: { everyMonths: 1 },
        reason: 'Monthly',
        returnUrl: 'https://example.test/return'
    });
    await fake.approve({ authorizationId });
    const { chargeId } = await fake.charge({
        authorizationId,
        amount: ARS(1500),
        reference: 'cycle'
    });
    return { fake, chargeId };
}

describe('AC:B6:5 fake refund outcomes', () => {
    it('reads two accepted partials with the ids returned by refund', async () => {
        // Arrange
        const { fake, chargeId } = await setup();
        // Act
        const first = await fake.refund({ chargeId, amount: ARS(300), reference: 'first' });
        const second = await fake.refund({ chargeId, amount: ARS(400), reference: 'second' });
        const read = await fake.readCharge({ chargeId });
        // Assert
        expect(read.snapshot.refunds).toEqual([
            { refundId: first.refundId, amount: ARS(300), accredited: true },
            { refundId: second.refundId, amount: ARS(400), accredited: true }
        ]);
        expect(read.snapshot.refundedAmount).toEqual(ARS(700));
    });

    it('rejects the second partial, preserves the first, and advances the charge version', async () => {
        // Arrange
        const { fake, chargeId } = await setup();
        const first = await fake.refund({ chargeId, amount: ARS(300), reference: 'first' });
        const second = await fake.refund({ chargeId, amount: ARS(400), reference: 'second' });
        fake.takeDeliveries();
        // Act
        const acknowledgement = await fake.rejectRefund({ chargeId, refundId: second.refundId });
        const read = await fake.readCharge({ chargeId });
        const notices = await Promise.all(
            fake.takeDeliveries().deliveries.map((delivery) => fake.decodeNotice(delivery))
        );
        // Assert
        expect(acknowledgement).toEqual({ accepted: true, resourceId: chargeId });
        expect(read.snapshot.refunds).toEqual([
            { refundId: first.refundId, amount: ARS(300), accredited: true },
            { refundId: second.refundId, amount: ARS(400), accredited: false }
        ]);
        expect(read.snapshot.refundedAmount).toEqual(ARS(300));
        expect(notices).toEqual([{ resourceKind: 'charge', resourceId: chargeId, version: '4' }]);
    });

    it('rejects a foreign or repeated refund id with a typed provider error', async () => {
        // Arrange
        const { fake, chargeId } = await setup();
        const { refundId } = await fake.refund({ chargeId, amount: ARS(300), reference: 'first' });
        // Act + Assert
        await expect(fake.rejectRefund({ chargeId, refundId: 'foreign' })).rejects.toMatchObject({
            code: 'REJECTED'
        });
        await fake.rejectRefund({ chargeId, refundId });
        await expect(fake.rejectRefund({ chargeId, refundId })).rejects.toMatchObject({
            code: 'REJECTED'
        });
    });

    it('reads an unrefunded charge with an empty refund list', async () => {
        // Arrange
        const { fake, chargeId } = await setup();
        // Act
        const read = await fake.readCharge({ chargeId });
        // Assert
        expect(read.snapshot.refunds).toEqual([]);
    });
});
