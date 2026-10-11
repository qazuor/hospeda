import { createAdjustableClock } from '@repo/test-clock';
import { beforeEach, describe, expect, it } from 'vitest';
import { FakePaymentProvider } from '../src/fake/index';
import type { PaymentProviderError } from '../src/index';

const amount = { amountMinor: 12500, currency: 'ARS' } as const;
let fake: FakePaymentProvider;

beforeEach(() => {
    fake = new FakePaymentProvider({
        clock: createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') }),
        idNamespace: crypto.randomUUID()
    });
});

describe('declineCharge test handle', () => {
    it('creates a rejected charge with the requested reason and leaves authorization active', async () => {
        const { authorizationId } = await fake.authorize({
            reference: 'signup-1',
            amount,
            cadence: { everyMonths: 1 },
            reason: 'Plan monthly',
            returnUrl: 'https://hospeda.test/return'
        });
        await fake.approve({ authorizationId });

        const { chargeId } = await fake.declineCharge({
            authorizationId,
            declineReason: 'issuer_declined'
        });

        expect((await fake.readCharge({ chargeId })).snapshot).toMatchObject({
            status: 'rejected',
            declineReason: 'issuer_declined',
            authorizationId,
            reference: 'signup-1',
            amount,
            refundedAmount: { amountMinor: 0, currency: 'ARS' }
        });
        expect((await fake.readAuthorization({ authorizationId })).snapshot.status).toBe('active');
    });

    it('fails with NOT_FOUND for an unknown authorization', async () => {
        await expect(
            fake.declineCharge({ authorizationId: 'missing', declineReason: null })
        ).rejects.toMatchObject({ code: 'NOT_FOUND' } satisfies Partial<PaymentProviderError>);
    });

    it('can record a rejected attempt after the authorization was cancelled', async () => {
        const { authorizationId } = await fake.authorize({
            reference: 'signup-2',
            amount,
            cadence: { everyMonths: 1 },
            reason: 'Plan monthly',
            returnUrl: 'https://hospeda.test/return'
        });
        await fake.approve({ authorizationId });
        await fake.cancel({ authorizationId });

        const { chargeId } = await fake.declineCharge({
            authorizationId,
            declineReason: null
        });

        expect((await fake.readCharge({ chargeId })).snapshot.status).toBe('rejected');
        expect((await fake.readAuthorization({ authorizationId })).snapshot.status).toBe(
            'cancelled'
        );
    });
});
