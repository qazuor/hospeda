import { describe, expect, it } from 'vitest';
import {
    hasActivePartnerSubscription,
    resolveManualInstallmentView
} from '../../../src/lib/billing/manual-installment';
import type { TranslationFn } from '../../../src/lib/i18n';

const t: TranslationFn = (key, _fallback, params) => `${key}:${JSON.stringify(params ?? {})}`;
const item = {
    subscriptionId: '00000000-0000-4000-8000-000000000001',
    manualPaymentId: '00000000-0000-4000-8000-000000000002',
    vertical: 'partner',
    plan: { slug: 'partner-monthly', name: 'Partner' },
    amount: { amountMinor: 10000, currency: 'ARS' as const },
    periodStart: '2026-11-01T00:00:00.000Z',
    dueAt: '2026-11-20T00:00:00.000Z'
};
const input = (installments: unknown) => ({ ok: true, data: { installments } });
const ownSubscriptions = (vertical: string, status: string) => ({
    ok: true,
    data: {
        subscriptions: [
            {
                id: '00000000-0000-4000-8000-000000000003',
                vertical,
                status,
                paymentMethod: 'MANUAL',
                serviceEndsAt: null,
                graceEndsAt: null,
                createdAt: '2026-11-01T00:00:00.000Z',
                paidAfterCancellation: null,
                pause: null,
                promo: null,
                succession: null,
                plan: {
                    slug: 'partner-silver',
                    name: 'Silver',
                    amount: 10000,
                    currency: 'ARS',
                    cycle: 'monthly'
                },
                nextCharge: null
            }
        ],
        deferredCourtesies: [],
        declinedSignups: []
    }
});

describe('resolveManualInstallmentView (HOS-1782)', () => {
    it('recognizes an active Partner subscription but not another vertical or inactive state (HOS-2235)', () => {
        expect(hasActivePartnerSubscription(ownSubscriptions('partner', 'ACTIVE'))).toBe(true);
        expect(hasActivePartnerSubscription(ownSubscriptions('accommodation', 'ACTIVE'))).toBe(
            false
        );
        expect(hasActivePartnerSubscription(ownSubscriptions('partner', 'GRACE_PERIOD'))).toBe(
            false
        );
        expect(hasActivePartnerSubscription({ ok: false })).toBe(false);
    });

    it('builds plan, amount and due lines for the partner installment', () => {
        // Arrange
        // Act
        const result = resolveManualInstallmentView({
            result: input([item]),
            vertical: 'partner',
            locale: 'es',
            t
        });
        // Assert
        expect(result).toMatchObject({
            planLine: expect.stringContaining('account.partner.installment.plan'),
            amountLine: expect.stringContaining('account.partner.installment.amount'),
            dueLine: expect.stringContaining('account.partner.installment.dueOn')
        });
        expect(result?.amountLine).toContain('"amount":"$ 100"');

        const fractional = resolveManualInstallmentView({
            result: input([{ ...item, amount: { amountMinor: 10050, currency: 'ARS' as const } }]),
            vertical: 'partner',
            locale: 'es',
            t
        });
        expect(fractional?.amountLine).toContain('"amount":"$ 100,50"');
    });

    it('says the team confirms the amount when it is unknown', () => {
        // Arrange
        // Act
        const result = resolveManualInstallmentView({
            result: input([{ ...item, amount: null }]),
            vertical: 'partner',
            locale: 'es',
            t
        });
        // Assert
        expect(result?.amountLine).toContain('amountPending');
    });

    it('ignores installments of other verticals', () => {
        // Arrange
        // Act
        const result = resolveManualInstallmentView({
            result: input([{ ...item, vertical: 'accommodation' }]),
            vertical: 'partner',
            locale: 'es',
            t
        });
        // Assert
        expect(result).toBeNull();
    });

    it('returns null for a failed or malformed read', () => {
        // Arrange
        // Act
        const failed = resolveManualInstallmentView({
            result: { ok: false },
            vertical: 'partner',
            locale: 'es',
            t
        });
        const malformed = resolveManualInstallmentView({
            result: input([{ ...item, amount: { amountMinor: 1, currency: 'USD' } }]),
            vertical: 'partner',
            locale: 'es',
            t
        });
        // Assert
        expect(failed).toBeNull();
        expect(malformed).toBeNull();
    });
});
