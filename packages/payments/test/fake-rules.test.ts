/**
 * TEST:B1:14 (AC:B1:14): the fake keeps the provider's own rules, always (no
 * test turns a rule off: they are not lies).
 *
 * SCOPE (B1.4a, HOS-1510): the rules whose surface the payment interface
 * carries today: RP1, RP2, RP3, RP4, RP5, RP6 and RP9. RP7, RP8, RP10, RP11 and
 * RP12 keep their row in the list and arrive with the units that add their
 * surface.
 */
import { createAdjustableClock } from '@repo/test-clock';
import { beforeEach, describe, expect, it } from 'vitest';
import {
    AMOUNT_ABOVE_CEILING_MESSAGE,
    AMOUNT_BELOW_FLOOR_MESSAGE,
    FAKE_RULES,
    FakePaymentProvider
} from '../src/fake/index';
import { PaymentProviderError } from '../src/index';

const ARS = (amountMinor: number) => ({ amountMinor, currency: 'ARS' }) as const;

const AUTHORIZE = {
    reference: 'sub-1',
    amount: ARS(1_800_000),
    cadence: { everyMonths: 1 },
    reason: 'Plan Anfitrión mensual',
    returnUrl: 'https://hospeda.test/return'
} as const;

/** The rejection a promise ends in, or a failure. */
async function rejectionOf({
    promise
}: {
    readonly promise: Promise<unknown>;
}): Promise<PaymentProviderError> {
    try {
        await promise;
    } catch (error) {
        if (error instanceof PaymentProviderError) return error;
        throw error;
    }
    throw new Error('expected a rejection');
}

let fake: FakePaymentProvider;

beforeEach(() => {
    fake = new FakePaymentProvider({
        clock: createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') }),
        honestAbout: [
            { lie: 'M8', why: 'these rules read a charge approved the moment it is asked' },
            { lie: 'M13', why: 'the refund rules are read apart from the not-refundable lie' }
        ]
    });
});

/** An authorization the customer already approved. */
async function activeAuthorization(): Promise<string> {
    const { authorizationId } = await fake.authorize(AUTHORIZE);
    await fake.approve({ authorizationId });
    return authorizationId;
}

/** An approved charge of ARS 18.000. */
async function approvedCharge(): Promise<string> {
    const authorizationId = await activeAuthorization();
    const { chargeId } = await fake.charge({
        authorizationId,
        amount: ARS(1_800_000),
        reference: 'cycle-1'
    });
    return chargeId;
}

describe('TEST:B1:14 the list of rules and measured behaviour', () => {
    it('holds twelve rows, RP1 to RP12: six rules and six measured behaviours', () => {
        expect(FAKE_RULES.map((row) => row.id)).toEqual(
            Array.from({ length: 12 }, (_, i) => `RP${i + 1}`)
        );
        expect(FAKE_RULES.filter((row) => row.kind === 'rule').map((row) => row.id)).toEqual([
            'RP1',
            'RP2',
            'RP3',
            'RP4',
            'RP5',
            'RP6'
        ]);
    });
});

describe('TEST:B3:44 RP1: a card token is single use', () => {
    it('rejects a second authorize with the same token and accepts a new token', async () => {
        const first = await fake.authorize({ ...AUTHORIZE, paymentToken: 'token-one' });
        const refused = await rejectionOf({
            promise: fake.authorize({ ...AUTHORIZE, reference: 'sub-2', paymentToken: 'token-one' })
        });
        const fresh = await fake.authorize({
            ...AUTHORIZE,
            reference: 'sub-3',
            paymentToken: 'token-two'
        });

        expect(refused.code).toBe('REJECTED');
        expect(refused.message).toBe('Card token was used, please generate new');
        expect(fresh.authorizationId).not.toBe(first.authorizationId);
        expect(
            (await fake.readAuthorization({ authorizationId: fresh.authorizationId })).snapshot
                .reference
        ).toBe('sub-3');
    });
});

describe('TEST:B1:14 RP2: a refund without its key fails before any business validation', () => {
    it('refuses a refund without a key as invalid input, even on a charge that does not exist', async () => {
        // Act
        const refused = await rejectionOf({
            promise: fake.refund({ chargeId: 'nope', amount: ARS(100) } as never)
        });

        // Assert
        expect(refused.code).toBe('INVALID_INPUT');
    });
});

describe('TEST:B1:14 RP3: the amount range, with the exact messages', () => {
    it('refuses ARS 14,99 and accepts ARS 15', async () => {
        const below = await rejectionOf({
            promise: fake.authorize({ ...AUTHORIZE, amount: ARS(1_499) })
        });
        const { authorizationId } = await fake.authorize({
            ...AUTHORIZE,
            reference: 'floor',
            amount: ARS(1_500)
        });
        expect(below.message).toBe(AMOUNT_BELOW_FLOOR_MESSAGE);
        expect((await fake.readAuthorization({ authorizationId })).snapshot.amount).toEqual(
            ARS(1_500)
        );
    });

    it('refuses more than ARS 2.000.000 and accepts exactly that', async () => {
        const above = await rejectionOf({
            promise: fake.authorize({ ...AUTHORIZE, amount: ARS(200_000_001) })
        });
        const { authorizationId } = await fake.authorize({
            ...AUTHORIZE,
            reference: 'ceiling',
            amount: ARS(200_000_000)
        });
        expect(above.message).toBe(AMOUNT_ABOVE_CEILING_MESSAGE);
        expect((await fake.readAuthorization({ authorizationId })).snapshot.amount).toEqual(
            ARS(200_000_000)
        );
    });

    it('keeps the range on an amount change, leaving the amount as it was', async () => {
        const authorizationId = await activeAuthorization();
        const refused = await rejectionOf({
            promise: fake.changeAmount({ authorizationId, amount: ARS(1_400) })
        });
        expect(refused.message).toBe(AMOUNT_BELOW_FLOOR_MESSAGE);
        expect((await fake.readAuthorization({ authorizationId })).snapshot.amount).toEqual(
            ARS(1_800_000)
        );
    });
});

describe('TEST:B1:14 RP4: another currency is refused', () => {
    it('refuses an authorization in USD and creates nothing', async () => {
        const refused = await rejectionOf({
            promise: fake.authorize({
                ...AUTHORIZE,
                amount: { amountMinor: 100_000, currency: 'USD' }
            })
        });
        expect(refused.code).toBe('REJECTED');
        expect(refused.message).toMatch(/USD/);
        // The next id is the first one: nothing was created by the refused request.
        const { authorizationId } = await fake.authorize(AUTHORIZE);
        expect(authorizationId).toBe('fake-auth-1');
    });
});

describe('TEST:B1:14 RP5: a repeated refund moves no money and answers an empty body', () => {
    it('the same key and amount twice refunds once, and the repeat carries no refund id', async () => {
        // Arrange
        const chargeId = await approvedCharge();

        // Act
        const first = await fake.refund({ chargeId, amount: ARS(1_000), reference: 'r-1' });
        const repeat = await fake.refund({ chargeId, amount: ARS(1_000), reference: 'r-1' });

        // Assert
        expect(first.refundId).not.toBe('');
        expect(repeat.refundId).toBe('');
        expect((await fake.readCharge({ chargeId })).snapshot.refundedAmount).toEqual(ARS(1_000));
    });
});

describe('TEST:B1:14 RP6: a paused authorization refuses every change, and can be cancelled', () => {
    it('refuses an amount change while paused, and cancels', async () => {
        // Arrange
        const authorizationId = await activeAuthorization();
        await fake.pause({ authorizationId });

        // Act
        const refused = await rejectionOf({
            promise: fake.changeAmount({ authorizationId, amount: ARS(2_000_000) })
        });
        const amountAfterRefusal = (await fake.readAuthorization({ authorizationId })).snapshot
            .amount;
        await fake.cancel({ authorizationId });

        // Assert
        expect(refused.code).toBe('REJECTED');
        expect(amountAfterRefusal).toEqual(ARS(1_800_000));
        expect((await fake.readAuthorization({ authorizationId })).snapshot.status).toBe(
            'cancelled'
        );
    });
});

describe('TEST:B1:14 RP9: a paused authorization is not charged', () => {
    it('refuses to charge it, and charges again once resumed', async () => {
        // Arrange
        const authorizationId = await activeAuthorization();
        await fake.pause({ authorizationId });

        // Act
        const refused = await rejectionOf({
            promise: fake.charge({ authorizationId, amount: ARS(1_800_000), reference: 'c-1' })
        });
        await fake.resume({ authorizationId });
        const { chargeId } = await fake.charge({
            authorizationId,
            amount: ARS(1_800_000),
            reference: 'c-2'
        });

        // Assert
        expect(refused.message).toBe('a paused authorization is not charged');
        expect((await fake.readCharge({ chargeId })).snapshot.reference).toBe('c-2');
    });
});
