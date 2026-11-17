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
    it('accepts the provider truncating a sent first charge to its whole second (RP17, EX-60)', async () => {
        const provider = new FakePaymentProvider({
            clock,
            honestAbout: [
                { lie: 'M1', why: 'isolate the provider first-charge precision rule' },
                { lie: 'M9', why: 'isolate the provider first-charge precision rule' }
            ]
        });
        const preciseSent = { ...sent, firstChargeAt: '2026-11-21T01:05:59.318Z' };
        const { authorizationId } = await provider.authorize(preciseSent);
        const truncatedProvider = {
            readAuthorization: async (input: { readonly authorizationId: string }) => {
                const read = await provider.readAuthorization(input);
                return {
                    ...read,
                    snapshot: {
                        ...read.snapshot,
                        firstChargeAt: '2026-11-20T21:05:59.000-04:00'
                    }
                };
            }
        };

        const result = await confirmAuthorizationCreation({
            provider: truncatedProvider,
            authorizationId,
            sent: preciseSent
        });

        expect(result.outcome).toBe('applied');
    });

    it.each([
        '2026-11-21T01:06:00.000Z',
        '2026-11-21T01:05:58.000Z'
    ])('rejects a first charge readback outside the exact sent second: %s', async (firstChargeAt) => {
        const provider = new FakePaymentProvider({ clock });
        const preciseSent = { ...sent, firstChargeAt: '2026-11-21T01:05:59.318Z' };
        const { authorizationId } = await provider.authorize(preciseSent);
        const alteredProvider = {
            readAuthorization: async (input: { readonly authorizationId: string }) => {
                const read = await provider.readAuthorization(input);
                return { ...read, snapshot: { ...read.snapshot, firstChargeAt } };
            }
        };

        const result = await confirmAuthorizationCreation({
            provider: alteredProvider,
            authorizationId,
            sent: preciseSent
        });

        expect(result.outcome).toBe('notApplied');
    });

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
