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
});
