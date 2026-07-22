/**
 * Unit tests for the trial-eligibility resolver (HOS-226, HOS-230).
 *
 * Covers:
 * - `hasAnyPriorSubscription` counts only subscriptions the provider actually
 *   authorized (active/trialing/past_due/paused/expired/comp), NOT
 *   never-authorized `abandoned` / `pending_provider` checkouts (HOS-230).
 * - The `cancelled` status is ambiguous and disambiguated via the
 *   `billing_subscription_events` history: `active`/`trialing` → `cancelled`
 *   consumed the trial; `pending_provider` → `cancelled` (a HOS-191 backout /
 *   rejected card on MP's hosted checkout) did NOT.
 * - `resolveTrialEligibility` is the exact negation of `hasAnyPriorSubscription`.
 * - A customer who never checked out (the implicit `tourist-free` default,
 *   which never creates a `billing_subscriptions` row — HOS-217 concern)
 *   stays eligible.
 * - The event-history query runs ONLY when every prior row is `cancelled`; an
 *   unambiguously-authorized subscription short-circuits it.
 *
 * @module test/services/billing/trial-eligibility.service
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (must be declared BEFORE importing the service).
// The resolver reads `billing_subscription_events` via `getDb()` to
// disambiguate `cancelled` rows; mock the DB layer so these stay unit tests.
// `drizzle-orm`'s `inArray` is stubbed to a plain marker (the mocked `.where`
// ignores it anyway). `normalizeStoredSubscriptionStatus` / `SubscriptionStatusEnum`
// are the REAL implementations — the classification logic under test depends on
// their true behavior.
// ---------------------------------------------------------------------------

vi.mock('@repo/db', () => ({
    getDb: vi.fn(),
    billingSubscriptionEvents: {
        subscriptionId: 'subscription_id',
        previousStatus: 'previous_status',
        newStatus: 'new_status'
    }
}));

vi.mock('drizzle-orm', () => ({
    inArray: vi.fn((column: unknown, values: unknown) => ({ column, values }))
}));

import { getDb } from '@repo/db';
import {
    hasAnyPriorSubscription,
    resolveTrialEligibility
} from '../../../src/services/billing/trial-eligibility.service';

const CUSTOMER_ID = '00000000-0000-4000-8000-000000000001';

/** A subscription lifecycle event row as read by the resolver. */
interface EventRow {
    readonly previousStatus: string | null;
    readonly newStatus: string | null;
}

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

/**
 * Point the mocked `getDb()` at a fake query chain that resolves the
 * `billing_subscription_events` select to the given rows.
 */
function mockSubscriptionEvents(events: ReadonlyArray<EventRow>): void {
    const chain = {
        select: vi.fn(() => chain),
        from: vi.fn(() => chain),
        where: vi.fn(() => Promise.resolve(events))
    };
    vi.mocked(getDb).mockReturnValue(chain as never);
}

beforeEach(() => {
    vi.clearAllMocks();
    // Default: no events. Any test exercising a `cancelled` row overrides this.
    mockSubscriptionEvents([]);
});

describe('hasAnyPriorSubscription', () => {
    it('returns false for a customer with no subscription rows (tourist-free default)', async () => {
        const billing = makeBilling([]);

        const result = await hasAnyPriorSubscription({ billing, customerId: CUSTOMER_ID });

        expect(result).toBe(false);
        expect(billing.subscriptions.getByCustomerId).toHaveBeenCalledWith(CUSTOMER_ID);
        // No cancelled rows -> the event-history query must not run.
        expect(getDb).not.toHaveBeenCalled();
    });

    it('returns true for a customer with one active subscription', async () => {
        const billing = makeBilling([{ id: 'sub-1', status: 'active' }]);

        expect(await hasAnyPriorSubscription({ billing, customerId: CUSTOMER_ID })).toBe(true);
        // An unambiguously-authorized row short-circuits the event query.
        expect(getDb).not.toHaveBeenCalled();
    });

    it('returns true when the only prior subscription is a comp grant', async () => {
        const billing = makeBilling([{ id: 'sub-1', status: 'comp' }]);

        expect(await hasAnyPriorSubscription({ billing, customerId: CUSTOMER_ID })).toBe(true);
        expect(getDb).not.toHaveBeenCalled();
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

    // HOS-230 (round-2 finding): a provider id being PRESENT does NOT imply the
    // preapproval was authorized. The mode:'paid' inline flow persists the id at
    // creation (HOS-151 Bug C) and the abandoned-pending-subs cron flips a reaped
    // row to abandoned WITHOUT clearing the id. So an abandoned/pending row with a
    // stray `providerSubscriptionIds.mercadopago` must STILL NOT consume the trial.
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

    // ---- `cancelled` disambiguation (HOS-230 round-3 finding) ----------------

    // A subscription cancelled AFTER being authorized (active -> cancelled) DID
    // consume the trial. The event history carries an authorized status.
    it('returns true for a cancelled row that was previously active (real cancellation)', async () => {
        mockSubscriptionEvents([
            { previousStatus: 'pending_provider', newStatus: 'active' },
            { previousStatus: 'active', newStatus: 'cancelled' }
        ]);
        const billing = makeBilling([{ id: 'sub-1', status: 'cancelled' }]);

        expect(await hasAnyPriorSubscription({ billing, customerId: CUSTOMER_ID })).toBe(true);
        expect(getDb).toHaveBeenCalledOnce();
    });

    it('returns true for a cancelled row whose history shows it was trialing', async () => {
        mockSubscriptionEvents([{ previousStatus: 'trialing', newStatus: 'cancelled' }]);
        const billing = makeBilling([{ id: 'sub-1', status: 'cancelled' }]);

        expect(await hasAnyPriorSubscription({ billing, customerId: CUSTOMER_ID })).toBe(true);
    });

    // HOS-191 backout: MercadoPago reports the pending preapproval rejected before
    // it ever activated -> pending_provider -> cancelled, never authorized. This
    // must NOT consume the trial (the round-3 finding — the HOS-230 bug via the
    // reject-at-checkout trigger).
    it('returns false for a cancelled row reached directly from pending_provider (never authorized)', async () => {
        mockSubscriptionEvents([{ previousStatus: 'pending_provider', newStatus: 'cancelled' }]);
        const billing = makeBilling([{ id: 'sub-1', status: 'cancelled' }]);

        expect(await hasAnyPriorSubscription({ billing, customerId: CUSTOMER_ID })).toBe(false);
        expect(getDb).toHaveBeenCalledOnce();
    });

    it('returns false for a cancelled row with no event history at all (never authorized)', async () => {
        mockSubscriptionEvents([]);
        const billing = makeBilling([{ id: 'sub-1', status: 'cancelled' }]);

        expect(await hasAnyPriorSubscription({ billing, customerId: CUSTOMER_ID })).toBe(false);
    });

    // A comp (free-forever) grant later revoked (comp -> cancelled, SPEC-262
    // admin revoke) is trial-consuming even though it was never provider-
    // authorized. Its only event carries previousStatus 'comp'; it must count.
    it('returns true for a cancelled row whose history shows it was a comp grant (revoked comp)', async () => {
        mockSubscriptionEvents([{ previousStatus: 'comp', newStatus: 'cancelled' }]);
        const billing = makeBilling([{ id: 'sub-1', status: 'cancelled' }]);

        expect(await hasAnyPriorSubscription({ billing, customerId: CUSTOMER_ID })).toBe(true);
    });

    // The event query must batch ALL cancelled rows; one authorized among them
    // disqualifies.
    it('returns true when one of several cancelled rows was authorized', async () => {
        mockSubscriptionEvents([
            { previousStatus: 'pending_provider', newStatus: 'cancelled' }, // sub-1 backout
            { previousStatus: 'active', newStatus: 'cancelled' } // sub-2 real cancel
        ]);
        const billing = makeBilling([
            { id: 'sub-1', status: 'cancelled' },
            { id: 'sub-2', status: 'cancelled' }
        ]);

        expect(await hasAnyPriorSubscription({ billing, customerId: CUSTOMER_ID })).toBe(true);
    });

    // An authorized subscription short-circuits BEFORE the event query, even when
    // accompanied by a cancelled row.
    it('returns true when an authorized sub coexists with a cancelled one (no event query)', async () => {
        const billing = makeBilling([
            { id: 'sub-1', status: 'cancelled' },
            { id: 'sub-2', status: 'active' }
        ]);

        expect(await hasAnyPriorSubscription({ billing, customerId: CUSTOMER_ID })).toBe(true);
        expect(getDb).not.toHaveBeenCalled();
    });
});

describe('resolveTrialEligibility', () => {
    it('is eligible for a customer with no prior subscription', async () => {
        const billing = makeBilling([]);

        const result = await resolveTrialEligibility({ billing, customerId: CUSTOMER_ID });

        expect(result).toEqual({ eligible: true });
    });

    it('is NOT eligible for a customer with an authorized prior subscription', async () => {
        const billing = makeBilling([{ id: 'sub-1', status: 'active' }]);

        const result = await resolveTrialEligibility({ billing, customerId: CUSTOMER_ID });

        expect(result).toEqual({ eligible: false });
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

    // Round-3 regression: a rejected-at-MP cancelled checkout keeps the customer
    // eligible for their trial.
    it('stays eligible when the only prior row is a pending -> cancelled backout', async () => {
        mockSubscriptionEvents([{ previousStatus: 'pending_provider', newStatus: 'cancelled' }]);
        const billing = makeBilling([{ id: 'sub-1', status: 'cancelled' }]);

        const result = await resolveTrialEligibility({ billing, customerId: CUSTOMER_ID });

        expect(result).toEqual({ eligible: true });
    });
});
