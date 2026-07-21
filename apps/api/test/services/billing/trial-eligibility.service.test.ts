/**
 * Unit tests for the trial-eligibility resolver (HOS-226).
 *
 * Covers:
 * - `hasAnyPriorSubscription` reflects `billing.subscriptions.getByCustomerId`
 *   length (0 -> false, 1+ -> true), regardless of subscription status.
 * - `resolveTrialEligibility` is the exact negation of `hasAnyPriorSubscription`.
 * - A customer who never checked out (the implicit `tourist-free` default,
 *   which never creates a `billing_subscriptions` row — HOS-217 concern)
 *   stays eligible.
 * - A customer with ANY prior subscription — active, cancelled, comp,
 *   past_due — is disqualified, matching the "one trial per customer, for
 *   life" rule documented on `resolveCheckoutFreeTrialDays`.
 *
 * @module test/services/billing/trial-eligibility.service
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { describe, expect, it, vi } from 'vitest';
import {
    hasAnyPriorSubscription,
    resolveTrialEligibility
} from '../../../src/services/billing/trial-eligibility.service';

const CUSTOMER_ID = '00000000-0000-4000-8000-000000000001';

/**
 * Build a minimal QZPayBilling stub exposing only the
 * `subscriptions.getByCustomerId` method this module calls.
 */
function makeBilling(subscriptions: ReadonlyArray<Record<string, unknown>>): QZPayBilling {
    return {
        subscriptions: {
            getByCustomerId: vi.fn().mockResolvedValue(subscriptions)
        }
    } as unknown as QZPayBilling;
}

describe('hasAnyPriorSubscription', () => {
    it('returns false for a customer with no subscription rows (tourist-free default)', async () => {
        const billing = makeBilling([]);

        const result = await hasAnyPriorSubscription({ billing, customerId: CUSTOMER_ID });

        expect(result).toBe(false);
        expect(billing.subscriptions.getByCustomerId).toHaveBeenCalledWith(CUSTOMER_ID);
    });

    it('returns true for a customer with one active subscription', async () => {
        const billing = makeBilling([{ id: 'sub-1', status: 'active' }]);

        expect(await hasAnyPriorSubscription({ billing, customerId: CUSTOMER_ID })).toBe(true);
    });

    it('returns true when the only prior subscription is cancelled', async () => {
        const billing = makeBilling([{ id: 'sub-1', status: 'cancelled' }]);

        expect(await hasAnyPriorSubscription({ billing, customerId: CUSTOMER_ID })).toBe(true);
    });

    it('returns true when the only prior subscription is a comp grant', async () => {
        const billing = makeBilling([{ id: 'sub-1', status: 'comp' }]);

        expect(await hasAnyPriorSubscription({ billing, customerId: CUSTOMER_ID })).toBe(true);
    });

    it('returns true when the only prior subscription is past_due', async () => {
        const billing = makeBilling([{ id: 'sub-1', status: 'past_due' }]);

        expect(await hasAnyPriorSubscription({ billing, customerId: CUSTOMER_ID })).toBe(true);
    });
});

describe('resolveTrialEligibility', () => {
    it('is eligible for a customer with no prior subscription', async () => {
        const billing = makeBilling([]);

        const result = await resolveTrialEligibility({ billing, customerId: CUSTOMER_ID });

        expect(result).toEqual({ eligible: true });
    });

    it('is NOT eligible for a customer with any prior subscription', async () => {
        const billing = makeBilling([{ id: 'sub-1', status: 'active' }]);

        const result = await resolveTrialEligibility({ billing, customerId: CUSTOMER_ID });

        expect(result).toEqual({ eligible: false });
    });

    it('is NOT eligible when the customer has multiple prior subscriptions', async () => {
        const billing = makeBilling([
            { id: 'sub-1', status: 'cancelled' },
            { id: 'sub-2', status: 'active' }
        ]);

        const result = await resolveTrialEligibility({ billing, customerId: CUSTOMER_ID });

        expect(result).toEqual({ eligible: false });
    });
});
