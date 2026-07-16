/**
 * Unit tests for subscription-charge-reconcile.ts (HOS-171 §7.5 — AC-14)
 *
 * The accounting defense against MercadoPago's account-level discount campaigns
 * silently reducing a subscription charge.
 *
 * The central property under test is the ABSENCE of false positives: a charge
 * that merely differs from the plan's headline price is NOT interference (our
 * own promo engine, annual cadence and mid-cycle plan changes all produce that
 * legitimately). Only MP's own `coupon_amount` / `campaign_id` — fields Hospeda
 * never sets on any call path — prove the campaign engine touched the charge.
 */

import { describe, expect, it } from 'vitest';
import { detectExternalChargeInterference } from '../../src/services/billing/subscription/subscription-charge-reconcile.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** ARS 15.000,00 in centavos — a representative monthly plan price. */
const PLAN_PRICE_CENTAVOS = 1_500_000;

// ─── Clean charges — no interference ─────────────────────────────────────────

describe('detectExternalChargeInterference — clean charges', () => {
    it('returns null when the charge matches and no campaign is reported', () => {
        // Arrange
        const input = {
            couponAmount: null,
            campaignId: null,
            chargedAmountCentavos: PLAN_PRICE_CENTAVOS,
            expectedAmountCentavos: PLAN_PRICE_CENTAVOS
        };
        // Act
        const result = detectExternalChargeInterference(input);
        // Assert
        expect(result).toBeNull();
    });

    it('returns null when coupon_amount is present but zero', () => {
        // Arrange — MP can echo an explicit zero; that is not a discount
        const input = {
            couponAmount: 0,
            campaignId: null,
            chargedAmountCentavos: PLAN_PRICE_CENTAVOS,
            expectedAmountCentavos: PLAN_PRICE_CENTAVOS
        };
        // Act
        const result = detectExternalChargeInterference(input);
        // Assert
        expect(result).toBeNull();
    });

    it('returns null when campaign_id is an empty string', () => {
        // Arrange
        const input = {
            couponAmount: null,
            campaignId: '',
            chargedAmountCentavos: PLAN_PRICE_CENTAVOS,
            expectedAmountCentavos: PLAN_PRICE_CENTAVOS
        };
        // Act
        const result = detectExternalChargeInterference(input);
        // Assert
        expect(result).toBeNull();
    });
});

// ─── No false positives — the whole point ────────────────────────────────────

describe('detectExternalChargeInterference — does not cry wolf', () => {
    it('does NOT flag a charge discounted by our own promo engine', () => {
        // Arrange — SPEC-262 lowered the preapproval amount for N cycles, so a
        // charge below the headline plan price is correct and expected here
        const input = {
            couponAmount: null,
            campaignId: null,
            chargedAmountCentavos: 1_050_000, // 30% off, applied by us
            expectedAmountCentavos: PLAN_PRICE_CENTAVOS
        };
        // Act
        const result = detectExternalChargeInterference(input);
        // Assert — an alert here would train the team to ignore the alert
        expect(result).toBeNull();
    });

    it('does NOT flag an annual charge that dwarfs a monthly price row', () => {
        // Arrange — the plan-price lookup resolves a monthly row; an annual
        // subscription legitimately charges ~12x that
        const input = {
            couponAmount: null,
            campaignId: null,
            chargedAmountCentavos: PLAN_PRICE_CENTAVOS * 12,
            expectedAmountCentavos: PLAN_PRICE_CENTAVOS
        };
        // Act
        const result = detectExternalChargeInterference(input);
        // Assert
        expect(result).toBeNull();
    });

    it('does NOT flag a charge when the expected amount is unresolvable', () => {
        // Arrange — no plan price to compare against, and no campaign reported
        const input = {
            couponAmount: null,
            campaignId: null,
            chargedAmountCentavos: PLAN_PRICE_CENTAVOS,
            expectedAmountCentavos: null
        };
        // Act
        const result = detectExternalChargeInterference(input);
        // Assert
        expect(result).toBeNull();
    });
});

// ─── AC-14 — real interference is caught ─────────────────────────────────────

describe('detectExternalChargeInterference — AC-14: external campaign detected', () => {
    it('flags a charge carrying both coupon_amount and campaign_id', () => {
        // Arrange — an account-level campaign took ARS 500 off
        const input = {
            couponAmount: 500,
            campaignId: 'campaign-abc',
            chargedAmountCentavos: 1_450_000,
            expectedAmountCentavos: PLAN_PRICE_CENTAVOS
        };
        // Act
        const result = detectExternalChargeInterference(input);
        // Assert — the report carries expected vs actual and the campaign id
        expect(result).not.toBeNull();
        expect(result?.campaignId).toBe('campaign-abc');
        expect(result?.couponAmountCentavos).toBe(50_000);
        expect(result?.chargedAmountCentavos).toBe(1_450_000);
        expect(result?.expectedAmountCentavos).toBe(PLAN_PRICE_CENTAVOS);
        expect(result?.shortfallCentavos).toBe(50_000);
    });

    it('flags a charge reporting only a campaign_id', () => {
        // Arrange — a campaign matched even though MP echoed no coupon amount
        const input = {
            couponAmount: null,
            campaignId: 'campaign-xyz',
            chargedAmountCentavos: 1_400_000,
            expectedAmountCentavos: PLAN_PRICE_CENTAVOS
        };
        // Act
        const result = detectExternalChargeInterference(input);
        // Assert
        expect(result).not.toBeNull();
        expect(result?.campaignId).toBe('campaign-xyz');
        expect(result?.couponAmountCentavos).toBeNull();
        expect(result?.shortfallCentavos).toBe(100_000);
    });

    it('flags a charge reporting only a coupon_amount', () => {
        // Arrange
        const input = {
            couponAmount: 250.5,
            campaignId: null,
            chargedAmountCentavos: 1_474_950,
            expectedAmountCentavos: PLAN_PRICE_CENTAVOS
        };
        // Act
        const result = detectExternalChargeInterference(input);
        // Assert — major units are converted to centavos for the report
        expect(result).not.toBeNull();
        expect(result?.couponAmountCentavos).toBe(25_050);
        expect(result?.campaignId).toBeNull();
    });

    it('still flags interference when the expected amount is unresolvable', () => {
        // Arrange — we cannot say how much was lost, but we can still say a
        // campaign touched the charge, which is the actionable part
        const input = {
            couponAmount: 500,
            campaignId: 'campaign-abc',
            chargedAmountCentavos: 1_450_000,
            expectedAmountCentavos: null
        };
        // Act
        const result = detectExternalChargeInterference(input);
        // Assert
        expect(result).not.toBeNull();
        expect(result?.shortfallCentavos).toBeNull();
        expect(result?.expectedAmountCentavos).toBeNull();
    });
});
