/**
 * Admin billing VIEW — status vocabulary regression suite
 *
 * ## The bug this suite locks down
 *
 * `billing_subscriptions.status` physically holds TWO spellings of the same
 * state. Production (measured 2026-08-15) has 6 rows spelled `canceled` (qzpay's
 * American spelling, written by the admin cancel path which goes straight through
 * qzpay) and 2 rows spelled `cancelled` (Hospeda's spelling, written by the
 * webhook path via `QZPAY_TO_HOSPEDA_STATUS`). The admin screen filtered with a
 * single exact match, so "Cancelada" returned 2 of 8 rows.
 *
 * The counterpart defect on the payments side: the UI derived its refund button
 * from `status === 'completed'`, a value the column has never held — it holds
 * `succeeded` and `refunded`. The button was dead for every payment ever made.
 *
 * Both defects are the same class of failure: a vocabulary assumed rather than
 * measured. These tests assert the mapping against the vocabulary that actually
 * travels.
 *
 * @module test/services/admin-billing-view.status.test
 */

import {
    AdminPaymentViewStatusSchema,
    AdminSubscriptionViewStatusSchema,
    SubscriptionStatusEnum
} from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    isPaymentRefundable,
    normalizePaymentStatusForView,
    normalizeSubscriptionStatusForView,
    resolveRecurringAmountInCents,
    STORED_SUBSCRIPTION_STATUS_SPELLINGS,
    widenPaymentStatusFilter,
    widenSubscriptionStatusFilter
} from '../../src/services/admin-billing-view.status';

describe('widenSubscriptionStatusFilter (the "2 of 8 cancelled" bug)', () => {
    it('matches BOTH physical spellings when filtering by cancelled', () => {
        // Arrange — the normalised vocabulary value the admin UI sends.
        const status = SubscriptionStatusEnum.CANCELLED;

        // Act
        const spellings = widenSubscriptionStatusFilter({ status });

        // Assert — a filter that only emits `cancelled` misses the 6 production
        // rows stored as `canceled`, which is exactly the reported defect.
        expect(spellings).toContain('cancelled');
        expect(spellings).toContain('canceled');
    });

    it('widens pending_provider to qzpay incomplete', () => {
        const spellings = widenSubscriptionStatusFilter({
            status: SubscriptionStatusEnum.PENDING_PROVIDER
        });

        expect(spellings).toContain('pending_provider');
        expect(spellings).toContain('incomplete');
    });

    it('widens abandoned to qzpay incomplete_expired', () => {
        const spellings = widenSubscriptionStatusFilter({
            status: SubscriptionStatusEnum.ABANDONED
        });

        expect(spellings).toContain('abandoned');
        expect(spellings).toContain('incomplete_expired');
    });

    it('widens past_due to qzpay unpaid', () => {
        const spellings = widenSubscriptionStatusFilter({
            status: SubscriptionStatusEnum.PAST_DUE
        });

        expect(spellings).toContain('past_due');
        expect(spellings).toContain('unpaid');
    });

    it('never returns a spelling that normalises to a different status', () => {
        // Guard: the widening is DERIVED from the canonical normaliser, so any
        // spelling it emits must round-trip back to the requested status.
        for (const status of AdminSubscriptionViewStatusSchema.options) {
            for (const spelling of widenSubscriptionStatusFilter({ status })) {
                expect(normalizeSubscriptionStatusForView({ rawStatus: spelling })).toBe(status);
            }
        }
    });

    it('emits a non-empty spelling set for every status in the contract', () => {
        for (const status of AdminSubscriptionViewStatusSchema.options) {
            expect(widenSubscriptionStatusFilter({ status }).length).toBeGreaterThan(0);
        }
    });

    it('covers every spelling the column can physically hold', () => {
        // Every declared physical spelling must be reachable through some
        // normalised filter value — otherwise a row exists that no filter finds.
        const reachable = new Set(
            AdminSubscriptionViewStatusSchema.options.flatMap((status) => [
                ...widenSubscriptionStatusFilter({ status })
            ])
        );

        for (const spelling of STORED_SUBSCRIPTION_STATUS_SPELLINGS) {
            expect(reachable.has(spelling)).toBe(true);
        }
    });
});

describe('normalizeSubscriptionStatusForView', () => {
    it('maps qzpay canceled (1 L) to Hospeda cancelled (2 Ls)', () => {
        expect(normalizeSubscriptionStatusForView({ rawStatus: 'canceled' })).toBe('cancelled');
    });

    it('passes an already-Hospeda spelling through unchanged', () => {
        expect(normalizeSubscriptionStatusForView({ rawStatus: 'cancelled' })).toBe('cancelled');
        expect(normalizeSubscriptionStatusForView({ rawStatus: 'abandoned' })).toBe('abandoned');
        expect(normalizeSubscriptionStatusForView({ rawStatus: 'comp' })).toBe('comp');
    });

    it('maps the qzpay creation-time vocabulary onto Hospeda states', () => {
        expect(normalizeSubscriptionStatusForView({ rawStatus: 'incomplete' })).toBe(
            'pending_provider'
        );
        expect(normalizeSubscriptionStatusForView({ rawStatus: 'incomplete_expired' })).toBe(
            'abandoned'
        );
        expect(normalizeSubscriptionStatusForView({ rawStatus: 'unpaid' })).toBe('past_due');
    });

    it('returns null for an unknown status rather than coercing it', () => {
        expect(normalizeSubscriptionStatusForView({ rawStatus: 'bogus' })).toBeNull();
        expect(normalizeSubscriptionStatusForView({ rawStatus: '' })).toBeNull();
    });

    it('only ever emits values the contract declares', () => {
        for (const spelling of STORED_SUBSCRIPTION_STATUS_SPELLINGS) {
            const normalised = normalizeSubscriptionStatusForView({ rawStatus: spelling });
            expect(AdminSubscriptionViewStatusSchema.safeParse(normalised).success).toBe(true);
        }
    });
});

describe('normalizePaymentStatusForView', () => {
    it('accepts the two statuses production actually holds', () => {
        // Measured in the production DB: only `succeeded` and `refunded` exist.
        expect(normalizePaymentStatusForView({ rawStatus: 'succeeded' })).toBe('succeeded');
        expect(normalizePaymentStatusForView({ rawStatus: 'refunded' })).toBe('refunded');
    });

    it('rejects `completed` — the value the old UI invented', () => {
        expect(normalizePaymentStatusForView({ rawStatus: 'completed' })).toBeNull();
        expect(AdminPaymentViewStatusSchema.safeParse('completed').success).toBe(false);
    });

    it('normalises the British cancelled spelling onto the contract value', () => {
        expect(normalizePaymentStatusForView({ rawStatus: 'cancelled' })).toBe('canceled');
        expect(normalizePaymentStatusForView({ rawStatus: 'canceled' })).toBe('canceled');
    });

    it('widens a canceled filter to both spellings', () => {
        const spellings = widenPaymentStatusFilter({ status: 'canceled' });
        expect(spellings).toContain('canceled');
        expect(spellings).toContain('cancelled');
    });

    it('emits a non-empty spelling set for every status in the contract', () => {
        for (const status of AdminPaymentViewStatusSchema.options) {
            expect(widenPaymentStatusFilter({ status }).length).toBeGreaterThan(0);
        }
    });
});

describe('isPaymentRefundable (the dead refund button)', () => {
    it('is true for a succeeded payment with nothing refunded', () => {
        expect(
            isPaymentRefundable({
                status: 'succeeded',
                amountInCents: 1_500_000,
                refundedAmountInCents: 0
            })
        ).toBe(true);
    });

    it('is true for a partially refunded payment with money outstanding', () => {
        expect(
            isPaymentRefundable({
                status: 'partially_refunded',
                amountInCents: 500_000,
                refundedAmountInCents: 200_000
            })
        ).toBe(true);
    });

    it('is false once the whole amount has been refunded', () => {
        expect(
            isPaymentRefundable({
                status: 'partially_refunded',
                amountInCents: 500_000,
                refundedAmountInCents: 500_000
            })
        ).toBe(false);
        expect(
            isPaymentRefundable({
                status: 'refunded',
                amountInCents: 3_500_000,
                refundedAmountInCents: 3_500_000
            })
        ).toBe(false);
    });

    it('is false for statuses that never moved money', () => {
        for (const status of ['pending', 'processing', 'failed', 'canceled'] as const) {
            expect(
                isPaymentRefundable({ status, amountInCents: 1000, refundedAmountInCents: 0 })
            ).toBe(false);
        }
    });

    it('is false for a succeeded payment already fully refunded by amount', () => {
        // Defensive: a row can carry `succeeded` with refundedAmount == amount if
        // the refund webhook updated the amount before the status.
        expect(
            isPaymentRefundable({
                status: 'succeeded',
                amountInCents: 1000,
                refundedAmountInCents: 1000
            })
        ).toBe(false);
    });
});

describe('resolveRecurringAmountInCents', () => {
    it('uses the monthly price for a monthly subscription', () => {
        expect(
            resolveRecurringAmountInCents({
                billingInterval: 'month',
                monthlyPriceInCents: 1_500_000,
                annualPriceInCents: 15_000_000
            })
        ).toBe(1_500_000);
    });

    it('uses the annual price for a yearly subscription', () => {
        expect(
            resolveRecurringAmountInCents({
                billingInterval: 'year',
                monthlyPriceInCents: 1_500_000,
                annualPriceInCents: 15_000_000
            })
        ).toBe(15_000_000);
    });

    it('returns null — never a fabricated 0 — when no price is on record', () => {
        expect(
            resolveRecurringAmountInCents({
                billingInterval: 'year',
                monthlyPriceInCents: 1_500_000,
                annualPriceInCents: null
            })
        ).toBeNull();
        expect(
            resolveRecurringAmountInCents({
                billingInterval: null,
                monthlyPriceInCents: 1_500_000,
                annualPriceInCents: 15_000_000
            })
        ).toBeNull();
    });

    it('preserves a genuine zero price (the free tier is not "unknown")', () => {
        expect(
            resolveRecurringAmountInCents({
                billingInterval: 'month',
                monthlyPriceInCents: 0,
                annualPriceInCents: null
            })
        ).toBe(0);
    });
});
