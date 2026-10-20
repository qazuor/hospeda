/** TEST:B3:44: creation is confirmed field by field, including a future first charge. */
import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it } from 'vitest';
import { FakePaymentProvider } from '../src/fake/index';
import {
    type AuthorizeInput,
    AuthorizeInputSchema,
    confirmAuthorizationCreation
} from '../src/index';

const clock = createAdjustableClock({ start: new Date('2026-10-01T03:00:00.000Z') });
const sent: AuthorizeInput = {
    reference: 'sub-1',
    amount: { amountMinor: 1_800_000, currency: 'ARS' },
    cadence: { everyMonths: 3 },
    firstChargeAt: '2026-10-10T03:00:00.000Z',
    reason: 'Plan trimestral',
    returnUrl: 'https://hospeda.test/return'
};

describe('TEST:B3:44 creation confirmation', () => {
    it('keeps the authorization input strict and requires an ISO first charge instant', () => {
        expect(AuthorizeInputSchema.safeParse(sent).success).toBe(true);
        expect(AuthorizeInputSchema.safeParse({ ...sent, firstChargeAt: 'tomorrow' }).success).toBe(
            false
        );
        expect(AuthorizeInputSchema.safeParse({ ...sent, paymentToken: '' }).success).toBe(false);
        expect(AuthorizeInputSchema.safeParse({ ...sent, unexpected: true }).success).toBe(false);
    });

    it('names cadence and firstChargeAt when the provider accepted but dropped them', async () => {
        const provider = new FakePaymentProvider({ clock });
        const { authorizationId } = await provider.authorize(sent);

        const result = await confirmAuthorizationCreation({ provider, authorizationId, sent });

        expect(result.outcome).toBe('notApplied');
        if (result.outcome === 'notApplied') {
            expect(result.unapplied.map(({ field }) => field)).toEqual([
                'cadence',
                'firstChargeAt'
            ]);
        }
    });

    it('accepts each matching sent field and ignores the provider-added free period', async () => {
        const provider = new FakePaymentProvider({
            clock,
            honestAbout: [{ lie: 'M1', why: 'confirm the healthy creation path' }]
        });
        const { authorizationId } = await provider.authorize(sent);

        const result = await confirmAuthorizationCreation({ provider, authorizationId, sent });

        expect(result.outcome).toBe('applied');
        expect(result.read.snapshot.freePeriodDays).toBeGreaterThan(0);
    });

    it('checks reference and amount independently on the readback', async () => {
        const provider = new FakePaymentProvider({
            clock,
            honestAbout: [
                { lie: 'M1', why: 'isolate mismatches injected in the readback' },
                { lie: 'M9', why: 'isolate mismatches injected in the readback' }
            ]
        });
        const { authorizationId } = await provider.authorize(sent);
        const altered = {
            readAuthorization: async (input: { readonly authorizationId: string }) => {
                const read = await provider.readAuthorization(input);
                return {
                    ...read,
                    snapshot: {
                        ...read.snapshot,
                        reference: 'other',
                        amount: { amountMinor: 1_900_000, currency: 'ARS' }
                    }
                };
            }
        };

        const result = await confirmAuthorizationCreation({
            provider: altered,
            authorizationId,
            sent
        });

        expect(result.outcome).toBe('notApplied');
        if (result.outcome === 'notApplied') {
            expect(result.unapplied.map(({ field }) => field)).toEqual(['reference', 'amount']);
        }
    });
});
