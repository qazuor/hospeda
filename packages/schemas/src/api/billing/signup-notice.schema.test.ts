import { describe, expect, it } from 'vitest';
import { SignupNoticeResponseSchema } from './signup-notice.schema';

describe('TEST:1735:8 pending signup attempt contract', () => {
    const response = {
        plan: { name: 'Annual', amount: 1200000, currency: 'ARS', cycle: 'annual' },
        vertical: 'accommodation',
        touristVip: { status: 'NOT_AFFECTED' },
        trial: { status: 'NOT_RUNNING' }
    };

    it('requires a nullable pending attempt and validates both checkout URL forms', () => {
        expect(
            SignupNoticeResponseSchema.parse({ ...response, pendingAttempt: null }).pendingAttempt
        ).toBeNull();
        const attempt = {
            subscriptionId: crypto.randomUUID(),
            plan: { name: 'Monthly', amount: 100000, currency: 'ARS', cycle: 'monthly' },
            checkoutUrl: 'https://example.test/checkout',
            authorizationWindowEndsAt: '2026-10-24T12:00:00.000Z'
        };
        expect(
            SignupNoticeResponseSchema.parse({ ...response, pendingAttempt: attempt })
                .pendingAttempt
        ).toEqual(attempt);
        expect(
            SignupNoticeResponseSchema.parse({
                ...response,
                pendingAttempt: { ...attempt, checkoutUrl: null }
            }).pendingAttempt
        ).toMatchObject({ checkoutUrl: null });
        expect(
            SignupNoticeResponseSchema.safeParse({
                ...response,
                pendingAttempt: { ...attempt, checkoutUrl: 'not a URL' }
            }).success
        ).toBe(false);
        expect(SignupNoticeResponseSchema.safeParse(response).success).toBe(false);
    });

    it('parses the activation cancellation date and its unknown-date form', () => {
        const paidUntil = '2026-11-01T12:00:00.000Z';
        for (const date of [paidUntil, null]) {
            const value = SignupNoticeResponseSchema.parse({
                ...response,
                touristVip: { status: 'CANCELLED_ON_ACTIVATION', paidUntil: date },
                pendingAttempt: null
            });
            expect(value.touristVip).toEqual({
                status: 'CANCELLED_ON_ACTIVATION',
                paidUntil: date
            });
        }
    });
});

describe('HOS-2382 promo applied to the pending signup plan', () => {
    const base = {
        pendingAttempt: null,
        vertical: 'accommodation',
        touristVip: { status: 'NOT_AFFECTED' },
        trial: { status: 'NOT_RUNNING' }
    };
    const plan = { name: 'Basico', amount: 1800000, currency: 'ARS', cycle: 'monthly' };

    it('accepts a plan without promo and keeps it absent', () => {
        const parsed = SignupNoticeResponseSchema.parse({ ...base, plan });
        expect(parsed.plan.promo).toBeUndefined();
    });

    it('accepts a promo with a finite or unlimited duration', () => {
        const finite = SignupNoticeResponseSchema.parse({
            ...base,
            plan: { ...plan, promo: { codes: ['SMOKES23'], amount: 1440000, chargesLeft: 3 } }
        });
        const forever = SignupNoticeResponseSchema.parse({
            ...base,
            plan: { ...plan, promo: { codes: ['SMOKES23'], amount: 1440000, chargesLeft: null } }
        });
        expect(finite.plan.promo?.chargesLeft).toBe(3);
        expect(forever.plan.promo?.chargesLeft).toBeNull();
    });

    it('rejects a promo without codes or with a fractional amount', () => {
        expect(
            SignupNoticeResponseSchema.safeParse({
                ...base,
                plan: { ...plan, promo: { codes: [], amount: 1, chargesLeft: null } }
            }).success
        ).toBe(false);
        expect(
            SignupNoticeResponseSchema.safeParse({
                ...base,
                plan: { ...plan, promo: { codes: ['A'], amount: 1.5, chargesLeft: null } }
            }).success
        ).toBe(false);
    });
});
