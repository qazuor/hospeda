import type { OwnSubscriptionsResponseSchema } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
    MY_SUBSCRIPTION_PRICE_SHOWN,
    resolveMySubscriptionSummary,
    resolveMySubscriptionVerticalLabelKey
} from '../../../src/lib/billing/my-subscription-summary';
import { formatSelfCancelDate } from '../../../src/lib/billing/self-cancel';
import { formatPrice } from '../../../src/lib/format-utils';
import type { TranslationFn } from '../../../src/lib/i18n';

const fallbackT: TranslationFn = (key, fallback, params) =>
    `${fallback ?? key}${params ? ` ${JSON.stringify(params)}` : ''}`;
const translatedT: TranslationFn = (key, fallback) =>
    key === 'billing.plan.owner-basico.name' ? 'Básico' : (fallback ?? key);
type Row = z.infer<typeof OwnSubscriptionsResponseSchema>['subscriptions'][number];
const row = (overrides: Partial<Row> = {}): Row => ({
    id: '00000000-0000-4000-8000-000000000001',
    vertical: 'accommodation',
    status: 'ACTIVE',
    paymentMethod: 'CARD',
    serviceEndsAt: null,
    graceEndsAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    paidAfterCancellation: null,
    plan: { slug: 'owner-basico', name: 'Basic', amount: 18000, currency: 'ARS', cycle: 'monthly' },
    nextCharge: null,
    ...overrides
});

describe('resolveMySubscriptionSummary — TEST:1755:5', () => {
    it('resolves the plan slug translation and falls back to the anchored plan name', () => {
        expect(
            resolveMySubscriptionSummary({ row: row(), locale: 'es', t: translatedT }).title
        ).toBe('Básico');
        expect(
            resolveMySubscriptionSummary({
                row: row({ plan: { ...row().plan, slug: 'missing' } }),
                locale: 'es',
                t: fallbackT
            }).title
        ).toBe('Basic');
    });
});

describe('resolveMySubscriptionVerticalLabelKey — TEST:1755:6', () => {
    it.each([
        ['accommodation', 'accommodation'],
        ['gastronomy', 'gastronomy'],
        ['experience', 'experience'],
        ['tourist', 'tourist'],
        ['partner', 'partner']
    ])('maps %s to the account label key', (vertical, key) => {
        expect(resolveMySubscriptionVerticalLabelKey({ vertical })).toBe(
            `account.subscription.mine.vertical.${key}`
        );
    });
    it('maps an unknown vertical to the unknown key', () => {
        expect(resolveMySubscriptionVerticalLabelKey({ vertical: 'otra' })).toBe(
            'account.subscription.mine.vertical.unknown'
        );
    });
});

describe('resolveMySubscriptionSummary — TEST:1755:7', () => {
    it('shows list price and cycle only in active and grace states', () => {
        expect(MY_SUBSCRIPTION_PRICE_SHOWN).toEqual({
            ACTIVE: true,
            GRACE_PERIOD: true,
            SUSPENDED: false,
            CANCEL_SCHEDULED: false
        });
        const expected = `account.subscription.mine.price ${JSON.stringify({
            amount: formatPrice({
                amount: 180,
                currency: 'ARS',
                locale: 'es',
                showDecimals: false
            }),
            cycle: 'billing.checkout.signup.cycle.monthly'
        })}`;
        expect(
            resolveMySubscriptionSummary({ row: row(), locale: 'es', t: fallbackT }).priceLine
        ).toBe(expected);
        expect(
            resolveMySubscriptionSummary({
                row: row({ status: 'GRACE_PERIOD' }),
                locale: 'es',
                t: fallbackT
            }).priceLine
        ).toBe(expected);
        expect(
            resolveMySubscriptionSummary({
                row: row({ plan: { ...row().plan, amount: 18050 } }),
                locale: 'es',
                t: fallbackT
            }).priceLine
        ).toBe(
            `account.subscription.mine.price ${JSON.stringify({
                amount: formatPrice({
                    amount: 180.5,
                    currency: 'ARS',
                    locale: 'es',
                    showDecimals: true
                }),
                cycle: 'billing.checkout.signup.cycle.monthly'
            })}`
        );
        for (const status of ['SUSPENDED', 'CANCEL_SCHEDULED'] as const)
            expect(
                resolveMySubscriptionSummary({ row: row({ status }), locale: 'es', t: fallbackT })
                    .priceLine
            ).toBeNull();
    });
});

describe('resolveMySubscriptionSummary — TEST:1755:8', () => {
    it('formats the API-provided next charge date and amount, or returns null', () => {
        const nextCharge = { at: '2026-11-12T12:00:00.000Z', amount: 14400, currency: 'ARS' };
        expect(
            resolveMySubscriptionSummary({ row: row({ nextCharge }), locale: 'es', t: fallbackT })
                .nextChargeLine
        ).toBe(
            `account.subscription.mine.nextCharge ${JSON.stringify({ date: formatSelfCancelDate({ iso: nextCharge.at, locale: 'es' }), amount: formatPrice({ amount: 144, currency: 'ARS', locale: 'es', showDecimals: false }) })}`
        );
        expect(
            resolveMySubscriptionSummary({ row: row(), locale: 'es', t: fallbackT }).nextChargeLine
        ).toBeNull();
    });
});
