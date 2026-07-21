/**
 * Unit tests for the trial-eligibility resolver (HOS-226, HOS-230).
 *
 * Covers:
 * - `hasAnyPriorSubscription` counts only subscriptions the provider actually
 *   authorized (active/trialing/cancelled/comp/past_due/paused/expired), NOT
 *   never-authorized `abandoned` / `pending_provider` checkouts (HOS-230).
 * - `resolveTrialEligibility` is the exact negation of `hasAnyPriorSubscription`.
 * - A customer who never checked out (the implicit `tourist-free` default,
 *   which never creates a `billing_subscriptions` row — HOS-217 concern)
 *   stays eligible.
 * - A customer whose ONLY row is an `abandoned` checkout (opened the MercadoPago
 *   screen and backed out) stays eligible — the HOS-230 regression.
 * - A customer with any authorized prior subscription is disqualified, matching
 *   the "one trial per customer, for life" rule.
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

    // HOS-230: a checkout that was started but never authorized (the user opened
    // the MercadoPago screen and backed out) must NOT consume trial eligibility.
    // `abandoned` is Hospeda's vocabulary (share-link/cron path).
    it('returns false when the only prior subscription is abandoned (backed out of MP)', async () => {
        const billing = makeBilling([
            { id: 'sub-1', status: 'abandoned', providerSubscriptionIds: {} }
        ]);

        expect(await hasAnyPriorSubscription({ billing, customerId: CUSTOMER_ID })).toBe(false);
    });

    it('returns false when the only prior subscription is a never-authorized pending_provider', async () => {
        const billing = makeBilling([
            { id: 'sub-1', status: 'pending_provider', providerSubscriptionIds: {} }
        ]);

        expect(await hasAnyPriorSubscription({ billing, customerId: CUSTOMER_ID })).toBe(false);
    });

    // HOS-230 C2: `getByCustomerId` returns the RAW stored status, and the
    // `mode:'paid'` inline-preapproval flow writes qzpay's own vocabulary
    // (`incomplete` -> pending_provider, `incomplete_expired` -> abandoned).
    // These must be normalized and excluded too, or the bug recurs for that path.
    it('returns false for a raw qzpay `incomplete` row (mode:paid, not yet authorized)', async () => {
        const billing = makeBilling([
            { id: 'sub-1', status: 'incomplete', providerSubscriptionIds: {} }
        ]);

        expect(await hasAnyPriorSubscription({ billing, customerId: CUSTOMER_ID })).toBe(false);
    });

    it('returns false for a raw qzpay `incomplete_expired` row (mode:paid, abandoned)', async () => {
        const billing = makeBilling([
            { id: 'sub-1', status: 'incomplete_expired', providerSubscriptionIds: {} }
        ]);

        expect(await hasAnyPriorSubscription({ billing, customerId: CUSTOMER_ID })).toBe(false);
    });

    // Regression for the exact SMOKE-19-07 repro: fresh customer starts a
    // checkout, abandons it, and must remain eligible on the next attempt.
    it('stays eligible after fresh -> start checkout -> abandon', async () => {
        const billing = makeBilling([
            { id: 'sub-1', status: 'abandoned', providerSubscriptionIds: {} }
        ]);

        const result = await resolveTrialEligibility({ billing, customerId: CUSTOMER_ID });

        expect(result).toEqual({ eligible: true });
    });

    // HOS-230 (round-2 finding): a provider id being PRESENT does NOT imply the
    // preapproval was authorized. The mode:'paid' inline flow persists the id at
    // creation (HOS-151 Bug C) and the abandoned-pending-subs cron flips a reaped
    // row to abandoned WITHOUT clearing the id. So an abandoned/pending row with a
    // stray `providerSubscriptionIds.mercadopago` must STILL NOT consume the trial,
    // otherwise the false-disqualification bug recurs (even cross-domain).
    it('returns false for an abandoned row that still carries a stray MP provider id', async () => {
        const billing = makeBilling([
            {
                id: 'sub-1',
                status: 'abandoned',
                providerSubscriptionIds: { mercadopago: 'mp-preapproval-123' }
            }
        ]);

        expect(await hasAnyPriorSubscription({ billing, customerId: CUSTOMER_ID })).toBe(false);
    });

    it('returns false for a raw qzpay `incomplete` row that carries a provider id (mode:paid, backed out)', async () => {
        const billing = makeBilling([
            {
                id: 'sub-1',
                status: 'incomplete',
                providerSubscriptionIds: { mercadopago: 'mp-preapproval-456' }
            }
        ]);

        expect(await hasAnyPriorSubscription({ billing, customerId: CUSTOMER_ID })).toBe(false);
    });

    // The cross-domain regression from the round-2 finding: a commerce mode:'paid'
    // checkout that was abandoned (with a stray provider id) must not poison the
    // same customer's FIRST accommodation-host trial eligibility.
    it('stays eligible when the only prior row is an abandoned mode:paid checkout with a provider id', async () => {
        const billing = makeBilling([
            {
                id: 'sub-commerce',
                status: 'incomplete_expired',
                providerSubscriptionIds: { mercadopago: 'mp-preapproval-789' }
            }
        ]);

        const result = await resolveTrialEligibility({ billing, customerId: CUSTOMER_ID });

        expect(result).toEqual({ eligible: true });
    });

    // An authorized subscription still disqualifies even when accompanied by an
    // abandoned row from an earlier backed-out attempt.
    it('returns true when an authorized sub coexists with an abandoned one', async () => {
        const billing = makeBilling([
            { id: 'sub-1', status: 'abandoned', providerSubscriptionIds: {} },
            {
                id: 'sub-2',
                status: 'active',
                providerSubscriptionIds: { mercadopago: 'mp-preapproval-1' }
            }
        ]);

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
