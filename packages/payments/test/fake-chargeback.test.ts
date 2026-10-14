/**
 * TEST:B11:27 (support): the fake's test-side handle that marks an approved
 * charge as charged back. The charge stays approved, keeps what was refunded,
 * moves its version and sends its charge notice (RC-8, documented, not measured).
 */
import { createAdjustableClock } from '@repo/test-clock';
import { beforeEach, describe, expect, it } from 'vitest';
import { FakePaymentProvider } from '../src/fake/index';
import { PaymentProviderError, type PaymentProviderErrorCode } from '../src/index';

const ARS = (amountMinor: number) => ({ amountMinor, currency: 'ARS' }) as const;

const AUTHORIZE = {
    reference: 'sub-chargeback',
    amount: ARS(1_000_000),
    cadence: { everyMonths: 1 },
    reason: 'Plan mensual',
    returnUrl: 'https://hospeda.test/return'
} as const;

let fake: FakePaymentProvider;

beforeEach(() => {
    fake = new FakePaymentProvider({
        clock: createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') }),
        honestAbout: [
            { lie: 'M6', why: 'these cases count one notice per change, delivered at once' },
            { lie: 'M8', why: 'these cases read a charge approved the moment it is asked' },
            { lie: 'M13', why: 'these cases refund partially from the first refund' }
        ],
        withoutBehaviour: [
            { behaviour: 'RP12', why: 'these cases exercise regular charge behaviour' }
        ]
    });
});

async function codeOf({
    promise
}: {
    readonly promise: Promise<unknown>;
}): Promise<PaymentProviderErrorCode> {
    try {
        await promise;
    } catch (error) {
        if (error instanceof PaymentProviderError) return error.code;
        throw error;
    }
    throw new Error('expected a rejection');
}

async function activeAuthorization(): Promise<string> {
    const { authorizationId } = await fake.authorize(AUTHORIZE);
    await fake.approve({ authorizationId });
    return authorizationId;
}

async function approvedCharge(): Promise<string> {
    const authorizationId = await activeAuthorization();
    const { chargeId } = await fake.charge({
        authorizationId,
        amount: ARS(1_000_000),
        reference: 'cycle-1'
    });
    return chargeId;
}

describe('TEST:B11:27 (support) the fake marks an approved charge as charged back', () => {
    it('(a) reads chargedBack, stays approved with the same refund, and notifies a new version', async () => {
        // Arrange
        const chargeId = await approvedCharge();
        await fake.refund({ chargeId, amount: ARS(300_000), reference: 'refund-1' });
        const before = (await fake.readCharge({ chargeId })).snapshot;
        fake.takeDeliveries();

        // Act
        await fake.chargeBack({ chargeId });

        // Assert
        const after = (await fake.readCharge({ chargeId })).snapshot;
        expect(before.chargedBack).toBe(false);
        expect(after).toEqual({ ...before, chargedBack: true });
        expect(after.status).toBe('approved');
        expect(after.refundedAmount).toEqual(ARS(300_000));
        const notices = await Promise.all(
            fake.takeDeliveries().deliveries.map((delivery) => fake.decodeNotice(delivery))
        );
        expect(notices).toEqual([{ resourceKind: 'charge', resourceId: chargeId, version: '3' }]);
    });

    it('(b) refuses a pending or a rejected charge', async () => {
        // Arrange
        const pending = new FakePaymentProvider({
            clock: createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') }),
            withoutBehaviour: [{ behaviour: 'RP12', why: 'regular charge behaviour only' }]
        });
        const { authorizationId } = await pending.authorize(AUTHORIZE);
        await pending.approve({ authorizationId });
        const late = await pending.charge({
            authorizationId,
            amount: ARS(1_000_000),
            reference: 'late'
        });
        const rejectedAuthorization = await activeAuthorization();
        const declined = await fake.declineCharge({
            authorizationId: rejectedAuthorization,
            declineReason: 'declined'
        });

        // Act + Assert
        expect((await pending.readCharge({ chargeId: late.chargeId })).snapshot.status).toBe(
            'pending'
        );
        expect(await codeOf({ promise: pending.chargeBack({ chargeId: late.chargeId }) })).toBe(
            'REJECTED'
        );
        expect(await codeOf({ promise: fake.chargeBack({ chargeId: declined.chargeId }) })).toBe(
            'REJECTED'
        );
        expect((await fake.readCharge({ chargeId: declined.chargeId })).snapshot.chargedBack).toBe(
            false
        );
    });

    it('(c) refuses the second chargeback of the same charge', async () => {
        // Arrange
        const chargeId = await approvedCharge();
        await fake.chargeBack({ chargeId });

        // Act + Assert
        expect(await codeOf({ promise: fake.chargeBack({ chargeId }) })).toBe('REJECTED');
        expect((await fake.readCharge({ chargeId })).snapshot.chargedBack).toBe(true);
    });

    it('(d) a charge nobody disputed reads chargedBack false', async () => {
        const chargeId = await approvedCharge();
        expect((await fake.readCharge({ chargeId })).snapshot.chargedBack).toBe(false);
    });
});
