/** B3 UI (B3.md:1045-1053); rejection cases also cover AC:B3:28 (mitad web). */

import { VerticalEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    buildSignupCheckoutHref,
    formatSignupWindowEnd,
    isDisplayableCheckoutUrl,
    parseSignupOptionId,
    resolveSignupRejection,
    resolveSignupTrialNotice,
    SIGNUP_VERTICAL_LABEL_KEY
} from '@/lib/billing/signup-checkout';

const validId = '123e4567-e89b-42d3-a456-426614174000';

describe('signup checkout helpers — B3 UI (B3.md:1045-1053)', () => {
    it.each([
        ['PLAN_NOT_FOR_SALE', 'billing.checkout.signup.rejection.planNotForSale', false, true],
        [
            'PREVIOUS_ATTEMPT_CLOSING',
            'billing.checkout.signup.rejection.previousAttemptClosing',
            true,
            false
        ],
        ['COMMITMENT_TAKEN', 'billing.checkout.signup.rejection.commitmentTaken', false, false],
        [
            'TOURIST_VIP_INHERITED',
            'billing.checkout.signup.rejection.touristVipInherited',
            false,
            false
        ],
        ['CREATION_NOT_APPLIED', 'billing.checkout.signup.rejection.generic', true, false]
    ] as const)('maps %s to its localized rejection policy', (reason, messageKey, retryable, showPlansLink) => {
        expect(
            resolveSignupRejection({
                error: { status: 409, reason, message: 'API English message' }
            })
        ).toEqual({
            reason,
            messageKey,
            retryable,
            showPlansLink
        });
    });

    it.each([
        { status: 409, reason: 'FUTURE_REASON', message: 'Raw API English' },
        { status: 409, message: 'Raw API English' },
        { reason: 'PLAN_NOT_FOR_SALE', message: 'missing status' },
        { status: 503, reason: 'TOURIST_VIP_INHERITED', message: 'Raw API English' }
    ])('uses a generic translated message for non-contract errors', (error) => {
        const rejection = resolveSignupRejection({ error });
        expect(rejection).toEqual({
            reason: 'UNKNOWN',
            messageKey: 'billing.checkout.signup.rejection.generic',
            retryable: true,
            showPlansLink: false
        });
        expect(rejection.messageKey).not.toContain(error.message ?? 'Raw API English');
    });

    it('parses only UUID option values and builds the localized checkout URL', () => {
        expect(parseSignupOptionId({ search: `?opcion=${validId}` })).toBe(validId);
        expect(parseSignupOptionId({ search: '?opcion=not-a-uuid' })).toBeNull();
        expect(parseSignupOptionId({ search: '' })).toBeNull();
        expect(buildSignupCheckoutHref({ locale: 'es', billingOptionId: validId })).toBe(
            `/es/suscriptores/checkout/?opcion=${validId}`
        );
    });

    it.each([
        ['https://payments.example/continue', true],
        ['http://127.0.0.1:18090/continue', true],
        ['javascript:alert(1)', false],
        ['not a URL', false]
    ])('validates provider checkout URL %s', (checkoutUrl, displayable) => {
        expect(isDisplayableCheckoutUrl({ checkoutUrl })).toBe(displayable);
    });

    it('formats the authorization window using Buenos Aires local date', () => {
        const originalTimezone = process.env.TZ;
        process.env.TZ = 'UTC';
        try {
            const result = formatSignupWindowEnd({ iso: '2026-10-13T02:30:00.000Z', locale: 'es' });
            expect(result).toContain('12 de octubre de 2026');
            expect(result).not.toContain('13 de octubre de 2026');
        } finally {
            if (originalTimezone === undefined) delete process.env.TZ;
            else process.env.TZ = originalTimezone;
        }
    });

    it('maps all five schema verticals to complete translation keys', () => {
        expect(Object.keys(SIGNUP_VERTICAL_LABEL_KEY).sort()).toEqual(
            Object.values(VerticalEnum).sort()
        );
        expect(Object.values(SIGNUP_VERTICAL_LABEL_KEY)).toHaveLength(5);
        expect(SIGNUP_VERTICAL_LABEL_KEY.accommodation).toBe(
            'billing.checkout.signup.vertical.accommodation'
        );
    });
});

describe('TEST:B13a:21c AC:B13a:5 resolveSignupTrialNotice', () => {
    it('preserves a running trial end and day count', () => {
        expect(
            resolveSignupTrialNotice({
                result: {
                    ok: true,
                    data: {
                        vertical: 'accommodation',
                        trial: {
                            status: 'RUNNING',
                            endsAt: '2026-10-20T08:00:00.000Z',
                            daysLeft: 11
                        }
                    }
                }
            })
        ).toEqual({
            kind: 'RUNNING',
            daysLeft: 11,
            endsAt: '2026-10-20T08:00:00.000Z'
        });
    });

    it('omits a notice when the trial is not running', () => {
        expect(
            resolveSignupTrialNotice({
                result: {
                    ok: true,
                    data: { vertical: 'gastronomy', trial: { status: 'NOT_RUNNING' } }
                }
            })
        ).toBeNull();
    });

    it.each([
        ['server failure', { ok: false, error: { status: 503 } }],
        ['missing option', { ok: false, error: { status: 404 } }],
        ['invalid response body', { ok: true, data: { vertical: 'unknown', trial: {} } }]
    ])('shows the conditional notice for %s', (_label, result) => {
        expect(resolveSignupTrialNotice({ result })).toEqual({ kind: 'UNKNOWN' });
    });
});
