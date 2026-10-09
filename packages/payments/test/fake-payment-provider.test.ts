/**
 * The fake's core behaviour (AC:B1:1): a coherent provider over all eight
 * capabilities. Every assertion reads the state back by id, never a status code
 * or an acknowledgement (INV:D5, "ninguna aserción se escribe sobre un código
 * de estado"). The three lies these cases would otherwise meet are turned off
 * by name; each lie is exercised on its own in `fake-lies.test.ts`.
 */
import { type AdjustableClock, createAdjustableClock } from '@repo/test-clock';
import { beforeEach, describe, expect, it } from 'vitest';
import { FakePaymentProvider } from '../src/fake/index';
import { PaymentProviderError, type PaymentProviderErrorCode } from '../src/index';

const ARS = (amountMinor: number) => ({ amountMinor, currency: 'ARS' }) as const;

const AUTHORIZE = {
    reference: 'sub-1',
    amount: ARS(1_800_000),
    cadence: { everyMonths: 1 },
    reason: 'Plan Anfitrión mensual',
    returnUrl: 'https://hospeda.test/return'
} as const;

/** Resolves the error code a promise rejects with, or fails. */
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

let fake: FakePaymentProvider;
let clock: AdjustableClock;

beforeEach(() => {
    clock = createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') });
    fake = new FakePaymentProvider({
        clock,
        honestAbout: [
            { lie: 'M6', why: 'these cases count one notice per change, delivered at once' },
            { lie: 'M8', why: 'these cases read a charge approved the moment it is asked' },
            { lie: 'M13', why: 'these cases accumulate partial refunds from the first one' }
        ]
    });
});

/** An authorization the customer already approved. */
async function activeAuthorization(): Promise<string> {
    const { authorizationId } = await fake.authorize(AUTHORIZE);
    await fake.approve({ authorizationId });
    return authorizationId;
}

describe('authorize and approve', () => {
    it('creates a pending authorization with an approval link, active once approved', async () => {
        // Act
        const { authorizationId, approvalUrl } = await fake.authorize(AUTHORIZE);
        const before = (await fake.readAuthorization({ authorizationId })).snapshot;
        await fake.approve({ authorizationId });
        const after = (await fake.readAuthorization({ authorizationId })).snapshot;

        // Assert
        expect(new URL(approvalUrl).pathname).toContain(authorizationId);
        expect(before).toEqual({
            authorizationId,
            reference: 'sub-1',
            status: 'pending',
            amount: ARS(1_800_000),
            cadence: { everyMonths: 1 },
            firstChargeAt: null,
            freePeriodDays: null
        });
        expect(after.status).toBe('active');
    });

    it('refuses a float amount before doing anything', async () => {
        expect(await codeOf({ promise: fake.authorize({ ...AUTHORIZE, amount: ARS(10.5) }) })).toBe(
            'INVALID_INPUT'
        );
    });
});

describe('charge', () => {
    it('charges an active authorization and reads the charge back', async () => {
        // Arrange
        const authorizationId = await activeAuthorization();

        // Act
        const { chargeId } = await fake.charge({
            authorizationId,
            amount: ARS(1_800_000),
            reference: 'cycle-1'
        });

        // Assert
        expect((await fake.readCharge({ chargeId })).snapshot).toEqual({
            chargeId,
            authorizationId,
            reference: 'cycle-1',
            status: 'approved',
            amount: ARS(1_800_000),
            refundedAmount: ARS(0)
        });
    });

    it('refuses to charge a pending authorization', async () => {
        const { authorizationId } = await fake.authorize(AUTHORIZE);
        expect(
            await codeOf({
                promise: fake.charge({ authorizationId, amount: ARS(1), reference: 'c' })
            })
        ).toBe('REJECTED');
    });
});

describe('change the amount, pause, resume, cancel', () => {
    it('applies an amount change, visible on re-read', async () => {
        const authorizationId = await activeAuthorization();
        await fake.changeAmount({ authorizationId, amount: ARS(2_000_000) });
        expect((await fake.readAuthorization({ authorizationId })).snapshot.amount).toEqual(
            ARS(2_000_000)
        );
    });

    it('refuses an amount change in another currency', async () => {
        const authorizationId = await activeAuthorization();
        expect(
            await codeOf({
                promise: fake.changeAmount({
                    authorizationId,
                    amount: { amountMinor: 1, currency: 'USD' }
                })
            })
        ).toBe('REJECTED');
    });

    it('pauses and resumes, visible on re-read', async () => {
        const authorizationId = await activeAuthorization();
        await fake.pause({ authorizationId });
        expect((await fake.readAuthorization({ authorizationId })).snapshot.status).toBe('paused');
        await fake.resume({ authorizationId });
        expect((await fake.readAuthorization({ authorizationId })).snapshot.status).toBe('active');
    });

    it('cancels irreversibly', async () => {
        const authorizationId = await activeAuthorization();
        await fake.cancel({ authorizationId });
        expect((await fake.readAuthorization({ authorizationId })).snapshot.status).toBe(
            'cancelled'
        );
        expect(await codeOf({ promise: fake.resume({ authorizationId }) })).toBe('REJECTED');
        expect(await codeOf({ promise: fake.cancel({ authorizationId }) })).toBe('REJECTED');
    });
});

describe('refund', () => {
    it('accumulates partial refunds against the charge and refuses past its amount', async () => {
        // Arrange
        const authorizationId = await activeAuthorization();
        const { chargeId } = await fake.charge({
            authorizationId,
            amount: ARS(100_000),
            reference: 'cycle-1'
        });

        // Act
        await fake.refund({ chargeId, amount: ARS(40_000), reference: 'r-1' });
        await fake.refund({ chargeId, amount: ARS(60_000), reference: 'r-2' });
        const over = await codeOf({
            promise: fake.refund({ chargeId, amount: ARS(1), reference: 'r-3' })
        });

        // Assert
        expect((await fake.readCharge({ chargeId })).snapshot.refundedAmount).toEqual(ARS(100_000));
        expect(over).toBe('REJECTED');
    });
});

describe('read', () => {
    it('answers NOT_FOUND for an unknown id', async () => {
        expect(await codeOf({ promise: fake.readAuthorization({ authorizationId: 'nope' }) })).toBe(
            'NOT_FOUND'
        );
        expect(await codeOf({ promise: fake.readCharge({ chargeId: 'nope' }) })).toBe('NOT_FOUND');
    });

    it('stamps every read by id with the injected clock, never the system time', async () => {
        // Arrange
        const authorizationId = await activeAuthorization();
        const first = await fake.readAuthorization({ authorizationId });

        // Act
        clock.advance({ ms: 40 * 60_000 });
        const second = await fake.readAuthorization({ authorizationId });

        // Assert
        expect(first.readAt).toEqual(new Date('2026-10-01T03:00:00.000Z'));
        expect(second.readAt).toEqual(new Date('2026-10-01T03:40:00.000Z'));
    });

    it('hands out the read instant as a copy: mutating it does not move the read', async () => {
        const authorizationId = await activeAuthorization();
        const read = await fake.readAuthorization({ authorizationId });
        read.readAt.setTime(0);
        expect(read.readAt).toEqual(new Date('2026-10-01T03:00:00.000Z'));
    });

    it('hands out a copy: mutating a snapshot does not change the provider', async () => {
        const authorizationId = await activeAuthorization();
        const { snapshot } = await fake.readAuthorization({ authorizationId });
        (snapshot.amount as { amountMinor: number }).amountMinor = 1;
        expect((await fake.readAuthorization({ authorizationId })).snapshot.amount).toEqual(
            ARS(1_800_000)
        );
    });
});

describe('notify', () => {
    it('sends one notice per change, decodable to kind, id and version only', async () => {
        // Arrange
        const authorizationId = await activeAuthorization();
        await fake.pause({ authorizationId });

        // Act
        const { deliveries } = fake.takeDeliveries();
        const notices = await Promise.all(
            deliveries.map((delivery) => fake.decodeNotice(delivery))
        );

        // Assert
        expect(notices).toEqual([
            { resourceKind: 'authorization', resourceId: authorizationId, version: '1' },
            { resourceKind: 'authorization', resourceId: authorizationId, version: '2' },
            { resourceKind: 'authorization', resourceId: authorizationId, version: '3' }
        ]);
        expect(fake.takeDeliveries().deliveries).toEqual([]);
    });

    it('refuses a delivery that carries state in its body', async () => {
        const body = JSON.stringify({
            resourceKind: 'authorization',
            resourceId: 'x',
            version: '1',
            status: 'active'
        });
        expect(await codeOf({ promise: fake.decodeNotice({ headers: {}, body }) })).toBe(
            'INVALID_NOTICE'
        );
    });

    it('refuses a body that is not JSON', async () => {
        expect(await codeOf({ promise: fake.decodeNotice({ headers: {}, body: 'nope' }) })).toBe(
            'INVALID_NOTICE'
        );
    });
});
