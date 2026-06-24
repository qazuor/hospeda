/**
 * Tests for SPEC-262 T-011 frontend changes:
 * - SubscriptionPromoEffectPanel: all effectKind branches
 * - getStatusVariant / getStatusLabel: comp status (regression guard for latent bug)
 * - SubscriptionDetailsDialog: mounts promo panel when hook returns data
 *
 * @module test/billing-subscriptions/promo-effect.test
 */

import { SubscriptionPaymentHistoryBlock } from '@/features/billing-subscriptions/SubscriptionPaymentHistoryBlock';
import { SubscriptionPromoEffectPanel } from '@/features/billing-subscriptions/SubscriptionPromoEffectPanel';
import type { PaymentHistory } from '@/features/billing-subscriptions/types';
import { getStatusLabel, getStatusVariant } from '@/features/billing-subscriptions/utils';
import type { SubscriptionPromoEffectResponse } from '@repo/schemas';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal SubscriptionPromoEffectResponse */
function makeEffect(
    overrides: Partial<SubscriptionPromoEffectResponse> = {}
): SubscriptionPromoEffectResponse {
    return {
        hasPromo: true,
        promoCodeId: 'promo-uuid-1',
        code: 'TEST10',
        effectKind: 'discount',
        valueKind: 'percentage',
        value: 10,
        durationCycles: 3,
        remainingCycles: 2,
        extraDays: null,
        exhausted: false,
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// getStatusVariant / getStatusLabel — comp regression (latent-bug guard)
// ---------------------------------------------------------------------------

describe('getStatusVariant / getStatusLabel — comp status (SPEC-262 T-011)', () => {
    const mockT = (key: string) => key;
    const validVariants = ['default', 'secondary', 'destructive', 'outline'] as const;

    it('getStatusVariant returns a defined variant for comp', () => {
        // Arrange + Act
        const variant = getStatusVariant('comp');

        // Assert — must not be undefined (this was the latent bug)
        expect(variant).toBeDefined();
        expect(validVariants).toContain(variant);
    });

    it('getStatusVariant returns secondary for comp', () => {
        expect(getStatusVariant('comp')).toBe('secondary');
    });

    it('getStatusLabel returns a non-empty string for comp', () => {
        // Arrange + Act
        const label = getStatusLabel('comp', mockT);

        // Assert — must not be undefined and must return the i18n key
        expect(label).toBeDefined();
        expect(label.length).toBeGreaterThan(0);
        expect(label).toBe('admin-billing.subscriptions.statuses.comp');
    });

    it('getStatusVariant still returns correct variants for all pre-existing statuses', () => {
        // Regression: ensure we did not break existing entries when adding comp
        expect(getStatusVariant('active')).toBe('default');
        expect(getStatusVariant('trialing')).toBe('secondary');
        expect(getStatusVariant('cancelled')).toBe('destructive');
        expect(getStatusVariant('past_due')).toBe('outline');
        expect(getStatusVariant('expired')).toBe('outline');
        expect(getStatusVariant('paused')).toBe('secondary');
    });
});

// ---------------------------------------------------------------------------
// SubscriptionPromoEffectPanel
// ---------------------------------------------------------------------------

describe('SubscriptionPromoEffectPanel', () => {
    it('renders nothing when hasPromo is false', () => {
        // Arrange
        const effect = makeEffect({ hasPromo: false });

        // Act
        const { container } = render(
            <SubscriptionPromoEffectPanel
                effect={effect}
                isLoading={false}
            />
        );

        // Assert
        expect(container.firstChild).toBeNull();
    });

    it('renders nothing while loading', () => {
        // Act
        const { container } = render(
            <SubscriptionPromoEffectPanel
                effect={null}
                isLoading={true}
            />
        );

        // Assert
        expect(container.firstChild).toBeNull();
    });

    it('renders nothing when effect is null and not loading', () => {
        // Arrange + Act
        const { container } = render(
            <SubscriptionPromoEffectPanel
                effect={null}
                isLoading={false}
            />
        );

        // Assert
        expect(container.firstChild).toBeNull();
    });

    it('renders complimentary message for comp effectKind (AC-2.4)', () => {
        // Arrange — comp is NOT a discount amount; it renders the complimentary key
        const effect = makeEffect({
            effectKind: 'comp',
            valueKind: null,
            value: null,
            durationCycles: null,
            remainingCycles: null
        });

        // Act
        render(
            <SubscriptionPromoEffectPanel
                effect={effect}
                isLoading={false}
            />
        );

        // Assert — complimentary key appears, NOT a discount amount
        expect(
            screen.getByText('admin-billing.subscriptions.promoEffect.complimentary')
        ).toBeInTheDocument();
        // Ensure discount key does NOT appear
        expect(
            screen.queryByText(/admin-billing\.subscriptions\.promoEffect\.discountFor/)
        ).toBeNull();
    });

    it('renders discount-remaining copy when remainingCycles > 0', () => {
        // Arrange
        const effect = makeEffect({
            effectKind: 'discount',
            valueKind: 'percentage',
            value: 20,
            durationCycles: 5,
            remainingCycles: 3
        });

        // Act
        render(
            <SubscriptionPromoEffectPanel
                effect={effect}
                isLoading={false}
            />
        );

        // Assert — the component calls t('...discountForCycles') which returns the key,
        // then does .replace('{value}', '20%').replace('{count}', '3') on it.
        const expectedText = 'admin-billing.subscriptions.promoEffect.discountForCycles'
            .replace('{value}', '20%')
            .replace('{count}', '3');
        expect(screen.getByText(expectedText)).toBeInTheDocument();
    });

    it('renders discount-forever copy when durationCycles is null', () => {
        // Arrange
        const effect = makeEffect({
            effectKind: 'discount',
            valueKind: 'percentage',
            value: 15,
            durationCycles: null,
            remainingCycles: null
        });

        // Act
        render(
            <SubscriptionPromoEffectPanel
                effect={effect}
                isLoading={false}
            />
        );

        // Assert — discountForever key (after .replace, value=15% replaces {value})
        // t() returns the key string, .replace() substitutes 15% into it
        const expectedText = 'admin-billing.subscriptions.promoEffect.discountForever'.replace(
            '{value}',
            '15%'
        );
        expect(screen.getByText(expectedText)).toBeInTheDocument();
    });

    it('renders trial-extended copy for trial_extension effectKind', () => {
        // Arrange
        const effect = makeEffect({
            effectKind: 'trial_extension',
            valueKind: null,
            value: null,
            durationCycles: null,
            remainingCycles: null,
            extraDays: 7
        });

        // Act
        render(
            <SubscriptionPromoEffectPanel
                effect={effect}
                isLoading={false}
                trialEnd="2026-07-15T00:00:00.000Z"
            />
        );

        // Assert — trialExtended key with days replaced
        const expectedText = 'admin-billing.subscriptions.promoEffect.trialExtended'.replace(
            '{days}',
            '7'
        );
        expect(screen.getByText(expectedText)).toBeInTheDocument();
    });

    it('renders exhausted copy (neutral, not error) when exhausted=true', () => {
        // Arrange
        const effect = makeEffect({
            effectKind: 'discount',
            remainingCycles: 0,
            exhausted: true
        });

        // Act
        render(
            <SubscriptionPromoEffectPanel
                effect={effect}
                isLoading={false}
            />
        );

        // Assert — exhausted key is present
        expect(
            screen.getByText('admin-billing.subscriptions.promoEffect.exhausted')
        ).toBeInTheDocument();
        // No error-color class — the element should be muted, not destructive
        const el = screen.getByText('admin-billing.subscriptions.promoEffect.exhausted');
        expect(el.className).toContain('muted');
        expect(el.className).not.toContain('destructive');
    });

    it('shows the promo code in the title when code is present', () => {
        // Arrange
        const effect = makeEffect({
            code: 'SUMMER30',
            effectKind: 'comp',
            valueKind: null,
            value: null,
            durationCycles: null,
            remainingCycles: null
        });

        // Act
        render(
            <SubscriptionPromoEffectPanel
                effect={effect}
                isLoading={false}
            />
        );

        // Assert — code appears near the title
        expect(screen.getByText('(SUMMER30)')).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// SubscriptionPaymentHistoryBlock — extracted block (refactor regression guard)
// ---------------------------------------------------------------------------

describe('SubscriptionPaymentHistoryBlock (SPEC-262 T-011 extraction)', () => {
    it('renders the loading state', () => {
        // Arrange + Act
        render(
            <SubscriptionPaymentHistoryBlock
                paymentHistory={[]}
                isLoading={true}
            />
        );

        // Assert
        expect(
            screen.getByText('admin-billing.subscriptions.paymentHistory.loading')
        ).toBeInTheDocument();
    });

    it('renders the empty state when there are no payments', () => {
        // Arrange + Act
        render(
            <SubscriptionPaymentHistoryBlock
                paymentHistory={[]}
                isLoading={false}
            />
        );

        // Assert
        expect(
            screen.getByText('admin-billing.subscriptions.paymentHistory.empty')
        ).toBeInTheDocument();
    });

    it('renders a payment row with its status label', () => {
        // Arrange
        const payments: PaymentHistory[] = [
            { id: 'pay-1', date: '2026-01-15T00:00:00.000Z', amount: 1500, status: 'paid' }
        ];

        // Act
        render(
            <SubscriptionPaymentHistoryBlock
                paymentHistory={payments}
                isLoading={false}
            />
        );

        // Assert — the paid status label renders (loading/empty states are gone)
        expect(
            screen.getByText('admin-billing.subscriptions.paymentHistory.statusPaid')
        ).toBeInTheDocument();
        expect(
            screen.queryByText('admin-billing.subscriptions.paymentHistory.empty')
        ).not.toBeInTheDocument();
    });
});
