/**
 * Unit tests for resolveCheckoutFreeTrialDays (HOS-171 §7.4)
 *
 * The single decision point for how many free days a checkout grants. Covers:
 *
 * - AC-8  — base + extension resolve to ONE number (the 74-day leak closes).
 * - AC-9  — the HOSPEDA_TRIAL_DAYS_OVERRIDE=0 kill-switch beats any extension.
 * - AC-10 — one trial per customer, for life.
 */

import { describe, expect, it } from 'vitest';
import { resolveCheckoutFreeTrialDays } from '../../src/services/billing/addon/trial.types.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** A trial-eligible customer on a 14-day plan, no promo, no override. */
const ELIGIBLE_BASELINE = {
    planHasTrial: true,
    planTrialDays: 14,
    trialDaysOverride: undefined,
    extraTrialDays: undefined,
    hasPriorSubscription: false
} as const;

// ─── AC-8 — the leak closes ──────────────────────────────────────────────────

describe('resolveCheckoutFreeTrialDays — AC-8: base + promo is ONE number', () => {
    it('sums a 14-day base and a 60-day extension into a single 74-day trial', () => {
        // Arrange
        const input = { ...ELIGIBLE_BASELINE, extraTrialDays: 60 };
        // Act
        const result = resolveCheckoutFreeTrialDays(input);
        // Assert — 74 total, granted once, not 14 now and 60 again later
        expect(result.freeTrialDays).toBe(74);
        expect(result.promoExtensionIgnored).toBe(false);
    });

    it('grants the plain base length when no extension is supplied', () => {
        // Arrange & Act
        const result = resolveCheckoutFreeTrialDays(ELIGIBLE_BASELINE);
        // Assert
        expect(result.freeTrialDays).toBe(14);
        expect(result.promoExtensionIgnored).toBe(false);
    });

    it('adds the extension on top of an overridden base, not the plan base', () => {
        // Arrange — QA shortens the base to 1 day; the promo is still additive
        const input = { ...ELIGIBLE_BASELINE, trialDaysOverride: 1, extraTrialDays: 60 };
        // Act
        const result = resolveCheckoutFreeTrialDays(input);
        // Assert
        expect(result.freeTrialDays).toBe(61);
    });
});

// ─── AC-9 — the kill-switch is absolute ──────────────────────────────────────

describe('resolveCheckoutFreeTrialDays — AC-9: the ops kill-switch wins', () => {
    it('grants no trial when the override is 0, even with a 60-day extension promo', () => {
        // Arrange — the guard runs against the BASE length, before the extension
        const input = { ...ELIGIBLE_BASELINE, trialDaysOverride: 0, extraTrialDays: 60 };
        // Act
        const result = resolveCheckoutFreeTrialDays(input);
        // Assert — an extension must never resurrect a disabled trial
        expect(result.freeTrialDays).toBeUndefined();
        expect(result.promoExtensionIgnored).toBe(true);
    });

    it('grants no trial when the override is 0 and no promo is supplied', () => {
        // Arrange
        const input = { ...ELIGIBLE_BASELINE, trialDaysOverride: 0 };
        // Act
        const result = resolveCheckoutFreeTrialDays(input);
        // Assert
        expect(result.freeTrialDays).toBeUndefined();
        expect(result.promoExtensionIgnored).toBe(false);
    });
});

// ─── AC-10 — one trial per customer, for life ────────────────────────────────

describe('resolveCheckoutFreeTrialDays — AC-10: one trial per customer, for life', () => {
    it('grants no trial to a customer with any prior subscription', () => {
        // Arrange
        const input = { ...ELIGIBLE_BASELINE, hasPriorSubscription: true };
        // Act
        const result = resolveCheckoutFreeTrialDays(input);
        // Assert — they go to the normal paid preapproval
        expect(result.freeTrialDays).toBeUndefined();
    });

    it('grants no trial to a returning customer even with an extension promo', () => {
        // Arrange — a trial_extension LENGTHENS a trial; there is none to lengthen
        const input = { ...ELIGIBLE_BASELINE, hasPriorSubscription: true, extraTrialDays: 60 };
        // Act
        const result = resolveCheckoutFreeTrialDays(input);
        // Assert — and the customer is told their code did nothing
        expect(result.freeTrialDays).toBeUndefined();
        expect(result.promoExtensionIgnored).toBe(true);
    });
});

// ─── Plans that declare no trial ─────────────────────────────────────────────

describe('resolveCheckoutFreeTrialDays — plans without a trial', () => {
    it('grants no trial when the plan does not declare one', () => {
        // Arrange — e.g. commerce-listing / partner-listing (hasTrial: false)
        const input = { ...ELIGIBLE_BASELINE, planHasTrial: false, planTrialDays: 0 };
        // Act
        const result = resolveCheckoutFreeTrialDays(input);
        // Assert
        expect(result.freeTrialDays).toBeUndefined();
    });

    it('does not let an override force a trial onto a plan that declares none', () => {
        // Arrange — the override sizes an existing trial; it never creates one
        const input = { ...ELIGIBLE_BASELINE, planHasTrial: false, trialDaysOverride: 30 };
        // Act
        const result = resolveCheckoutFreeTrialDays(input);
        // Assert
        expect(result.freeTrialDays).toBeUndefined();
    });

    it('does not let an extension promo force a trial onto a plan that declares none', () => {
        // Arrange
        const input = { ...ELIGIBLE_BASELINE, planHasTrial: false, extraTrialDays: 60 };
        // Act
        const result = resolveCheckoutFreeTrialDays(input);
        // Assert
        expect(result.freeTrialDays).toBeUndefined();
        expect(result.promoExtensionIgnored).toBe(true);
    });

    it('grants no trial when the plan declares one but with zero days', () => {
        // Arrange — malformed/degenerate plan config
        const input = { ...ELIGIBLE_BASELINE, planTrialDays: 0 };
        // Act
        const result = resolveCheckoutFreeTrialDays(input);
        // Assert
        expect(result.freeTrialDays).toBeUndefined();
    });
});
