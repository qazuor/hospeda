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

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks for the HOS-176 divergence resolvers (below). The pure detectors
// (`detectExternalChargeInterference`, `detectPlanPriceDivergence`) need none —
// they are I/O-free. `resolveIntervalScopedPlanPriceCentavos` takes its db as a
// param, so only `sql` / `getDb` need stubbing; the discount-aware resolver
// pulls three sibling functions we control here.
// ---------------------------------------------------------------------------

vi.mock('@repo/db', () => ({
    // Tagged-template stub: capture the interpolated values + literal string parts
    // so a test can assert the query carries the subscription vocabulary DIRECTLY
    // ('month'/'year', never 'monthly'/'annual') and the interval_count = 1 scope,
    // without a real DB.
    sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
        strings,
        values,
        _type: 'sql'
    })),
    getDb: vi.fn()
}));

vi.mock('@repo/logger', () => ({
    createLogger: vi.fn(() => ({
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn()
    }))
}));

vi.mock('../../src/services/billing/subscription/subscription-product-domain.js', () => ({
    loadSubscriptionDiscountState: vi.fn()
}));

vi.mock('../../src/services/billing/promo-code/promo-code.crud.js', () => ({
    getPromoCodeById: vi.fn()
}));

vi.mock('../../src/services/billing/promo-code/effect-reducer.js', () => ({
    calculatePromoCodeEffect: vi.fn()
}));

import { calculatePromoCodeEffect } from '../../src/services/billing/promo-code/effect-reducer.js';
import { getPromoCodeById } from '../../src/services/billing/promo-code/promo-code.crud.js';
import {
    detectExternalChargeInterference,
    detectPlanPriceDivergence,
    resolveDiscountAwareExpectedCentavos,
    resolveIntervalScopedPlanPriceCentavos
} from '../../src/services/billing/subscription/subscription-charge-reconcile.js';
import { loadSubscriptionDiscountState } from '../../src/services/billing/subscription/subscription-product-domain.js';

const mockLoadDiscountState = vi.mocked(loadSubscriptionDiscountState);
const mockGetPromoCodeById = vi.mocked(getPromoCodeById);
const mockCalculatePromoCodeEffect = vi.mocked(calculatePromoCodeEffect);

type ScopedDb = Parameters<typeof resolveIntervalScopedPlanPriceCentavos>[0]['db'];

/** Build a fake db exposing only `.execute`, resolving the given price rows. */
function makeExecuteDb(rows: Array<{ unit_amount: unknown }>) {
    const execute = vi.fn(async (_query: unknown) => ({ rows }));
    return { db: { execute } as unknown as ScopedDb, execute };
}

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

// ═════════════════════════════════════════════════════════════════════════════
// HOS-176 — silent plan-price divergence detector
// ═════════════════════════════════════════════════════════════════════════════

describe('resolveIntervalScopedPlanPriceCentavos', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('queries the "month" interval DIRECTLY (never "monthly") scoped to interval_count = 1', async () => {
        // Arrange
        const { db, execute } = makeExecuteDb([{ unit_amount: 1_500_000 }]);

        // Act
        const result = await resolveIntervalScopedPlanPriceCentavos({
            db,
            planId: 'plan-1',
            billingInterval: 'month'
        });

        // Assert — all three billing tables speak 'month'/'year'; the resolver must
        // pass the subscription vocabulary straight through, NOT remap to 'monthly',
        // and must scope to the productized single-period price (interval_count = 1).
        expect(result).toBe(1_500_000);
        const query = execute.mock.calls[0]?.[0] as { strings: string[]; values: unknown[] };
        expect(query.values).toContain('month');
        expect(query.values).not.toContain('monthly');
        expect(query.strings.join('')).toContain('interval_count = 1');
    });

    it('queries the "year" interval DIRECTLY (never "annual") scoped to interval_count = 1', async () => {
        // Arrange
        const { db, execute } = makeExecuteDb([{ unit_amount: 15_000_000 }]);

        // Act
        const result = await resolveIntervalScopedPlanPriceCentavos({
            db,
            planId: 'plan-1',
            billingInterval: 'year'
        });

        // Assert
        expect(result).toBe(15_000_000);
        const query = execute.mock.calls[0]?.[0] as { strings: string[]; values: unknown[] };
        expect(query.values).toContain('year');
        expect(query.values).not.toContain('annual');
        expect(query.strings.join('')).toContain('interval_count = 1');
    });

    it('returns null when no active price row exists for the interval', async () => {
        // Arrange
        const { db } = makeExecuteDb([]);

        // Act
        const result = await resolveIntervalScopedPlanPriceCentavos({
            db,
            planId: 'plan-1',
            billingInterval: 'month'
        });

        // Assert
        expect(result).toBeNull();
    });

    it('returns null (and never queries) when the plan id is null', async () => {
        // Arrange
        const { db, execute } = makeExecuteDb([{ unit_amount: 999 }]);

        // Act
        const result = await resolveIntervalScopedPlanPriceCentavos({
            db,
            planId: null,
            billingInterval: 'month'
        });

        // Assert
        expect(result).toBeNull();
        expect(execute).not.toHaveBeenCalled();
    });

    it('returns null when unit_amount is not a number', async () => {
        // Arrange — malformed row
        const { db } = makeExecuteDb([{ unit_amount: 'oops' }]);

        // Act
        const result = await resolveIntervalScopedPlanPriceCentavos({
            db,
            planId: 'plan-1',
            billingInterval: 'month'
        });

        // Assert
        expect(result).toBeNull();
    });
});

describe('resolveDiscountAwareExpectedCentavos', () => {
    const FULL = 1_500_000;
    const SUB_ID = 'sub-1';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns the full price when there is no discount state', async () => {
        // Arrange
        mockLoadDiscountState.mockResolvedValue(null);

        // Act
        const result = await resolveDiscountAwareExpectedCentavos({
            subscriptionId: SUB_ID,
            fullCentavos: FULL
        });

        // Assert
        expect(result).toEqual({ amount: FULL });
        expect(mockGetPromoCodeById).not.toHaveBeenCalled();
    });

    it('returns the full price when there is no promo code linked', async () => {
        // Arrange
        mockLoadDiscountState.mockResolvedValue({
            id: SUB_ID,
            status: 'active',
            planId: 'plan-1',
            customerId: 'cust-1',
            mpSubscriptionId: 'pa-1',
            promoCodeId: null,
            promoEffectRemainingCycles: null
        } as never);

        // Act
        const result = await resolveDiscountAwareExpectedCentavos({
            subscriptionId: SUB_ID,
            fullCentavos: FULL
        });

        // Assert
        expect(result).toEqual({ amount: FULL });
    });

    it('returns the full price when the discount is exhausted (remaining <= 0)', async () => {
        // Arrange
        mockLoadDiscountState.mockResolvedValue({
            promoCodeId: 'pc-1',
            promoEffectRemainingCycles: 0
        } as never);

        // Act
        const result = await resolveDiscountAwareExpectedCentavos({
            subscriptionId: SUB_ID,
            fullCentavos: FULL
        });

        // Assert — never looks the promo up: the countdown proved it is spent
        expect(result).toEqual({ amount: FULL });
        expect(mockGetPromoCodeById).not.toHaveBeenCalled();
    });

    it('is INDETERMINATE when an active promo cannot be looked up', async () => {
        // Arrange — transient failure OR deleted promo: cannot determine the amount
        mockLoadDiscountState.mockResolvedValue({
            promoCodeId: 'pc-1',
            promoEffectRemainingCycles: 2
        } as never);
        mockGetPromoCodeById.mockResolvedValue({
            success: false,
            error: { code: 'NOT_FOUND', message: 'gone' }
        } as never);

        // Act
        const result = await resolveDiscountAwareExpectedCentavos({
            subscriptionId: SUB_ID,
            fullCentavos: FULL
        });

        // Assert
        expect(result).toEqual({ indeterminate: true });
    });

    it('returns the full price when the promo has no effect', async () => {
        // Arrange
        mockLoadDiscountState.mockResolvedValue({
            promoCodeId: 'pc-1',
            promoEffectRemainingCycles: 2
        } as never);
        mockGetPromoCodeById.mockResolvedValue({
            success: true,
            data: { effect: null }
        } as never);

        // Act
        const result = await resolveDiscountAwareExpectedCentavos({
            subscriptionId: SUB_ID,
            fullCentavos: FULL
        });

        // Assert
        expect(result).toEqual({ amount: FULL });
    });

    it('returns the DISCOUNTED amount for an apply-discount effect', async () => {
        // Arrange — 30% off
        mockLoadDiscountState.mockResolvedValue({
            promoCodeId: 'pc-1',
            promoEffectRemainingCycles: 2
        } as never);
        mockGetPromoCodeById.mockResolvedValue({
            success: true,
            data: { effect: { kind: 'discount' } }
        } as never);
        mockCalculatePromoCodeEffect.mockReturnValue({
            type: 'apply-discount',
            discountAmount: 450_000,
            finalAmount: 1_050_000,
            remainingCycles: 1
        } as never);

        // Act
        const result = await resolveDiscountAwareExpectedCentavos({
            subscriptionId: SUB_ID,
            fullCentavos: FULL
        });

        // Assert
        expect(result).toEqual({ amount: 1_050_000 });
    });

    it('returns the full price for a non-amount effect (comp / trial-extension)', async () => {
        // Arrange — a comp effect does not reduce the recurring amount
        mockLoadDiscountState.mockResolvedValue({
            promoCodeId: 'pc-1',
            promoEffectRemainingCycles: null
        } as never);
        mockGetPromoCodeById.mockResolvedValue({
            success: true,
            data: { effect: { kind: 'comp' } }
        } as never);
        mockCalculatePromoCodeEffect.mockReturnValue({
            type: 'comp-subscription'
        } as never);

        // Act
        const result = await resolveDiscountAwareExpectedCentavos({
            subscriptionId: SUB_ID,
            fullCentavos: FULL
        });

        // Assert — full price, NEVER indeterminate for a non-amount effect
        expect(result).toEqual({ amount: FULL });
    });

    it('is INDETERMINATE when the discount-state load throws', async () => {
        // Arrange
        mockLoadDiscountState.mockRejectedValue(new Error('db down'));

        // Act
        const result = await resolveDiscountAwareExpectedCentavos({
            subscriptionId: SUB_ID,
            fullCentavos: FULL
        });

        // Assert — a throw is not proof of "no discount": never flag a possibly
        // legitimate discounted charge
        expect(result).toEqual({ indeterminate: true });
    });

    it('is INDETERMINATE when the promo lookup throws', async () => {
        // Arrange
        mockLoadDiscountState.mockResolvedValue({
            promoCodeId: 'pc-1',
            promoEffectRemainingCycles: 2
        } as never);
        mockGetPromoCodeById.mockRejectedValue(new Error('boom'));

        // Act
        const result = await resolveDiscountAwareExpectedCentavos({
            subscriptionId: SUB_ID,
            fullCentavos: FULL
        });

        // Assert
        expect(result).toEqual({ indeterminate: true });
    });
});

describe('detectPlanPriceDivergence', () => {
    it('returns null when charged equals expected', () => {
        // Arrange / Act
        const result = detectPlanPriceDivergence({
            chargedAmountCentavos: 1_500_000,
            expectedAmountCentavos: 1_500_000
        });
        // Assert
        expect(result).toBeNull();
    });

    it('flags an UNDERCHARGE (charged below the plan price)', () => {
        // Arrange — MP charged the OLD lower price after a failed propagation
        const result = detectPlanPriceDivergence({
            chargedAmountCentavos: 1_400_000,
            expectedAmountCentavos: 1_500_000
        });
        // Assert — delta = expected - charged = +100_000
        expect(result).not.toBeNull();
        expect(result?.direction).toBe('undercharge');
        expect(result?.deltaCentavos).toBe(100_000);
        expect(result?.chargedAmountCentavos).toBe(1_400_000);
        expect(result?.expectedAmountCentavos).toBe(1_500_000);
    });

    it('flags an OVERCHARGE (charged above the plan price)', () => {
        // Arrange
        const result = detectPlanPriceDivergence({
            chargedAmountCentavos: 1_600_000,
            expectedAmountCentavos: 1_500_000
        });
        // Assert — delta = expected - charged = -100_000
        expect(result).not.toBeNull();
        expect(result?.direction).toBe('overcharge');
        expect(result?.deltaCentavos).toBe(-100_000);
    });
});
