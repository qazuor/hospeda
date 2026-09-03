/**
 * Unit tests for the trial-eligibility resolver (HOS-226, HOS-230, HOS-1104).
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
 * - HOS-1104: `getByCustomerId()` never populates `productDomain` on its own
 *   (qzpay-core's mapper builds objects field-by-field from the fields
 *   `QZPaySubscription` declares — see `hydrateSubscriptionProductDomains`'s
 *   doc in `@repo/service-core`). The domain-scoping fixtures below never set
 *   `productDomain` directly on the billing-SDK stub (that shape never occurs
 *   in production and would mask the exact bug this hydration exists to fix)
 *   — instead `mockDb({ storedDomains })` simulates the batched recovery
 *   SELECT `hydrateSubscriptionProductDomains` issues against `getDb()`.
 *
 * @module test/services/billing/trial-eligibility.service
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { ProductDomainEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (must be declared BEFORE importing the service).
// The resolver reads `billing_subscription_events` via `getDb()` to
// disambiguate `cancelled` rows, and (HOS-1104) `hydrateSubscriptionProductDomains`
// (a real, unmocked `@repo/service-core` function here) reads `billingSubscriptions`
// via the SAME `getDb()` to recover `productDomain`. `mockDb()` below routes
// each call by the table passed to `.from()`.
// `drizzle-orm`'s `inArray` is stubbed to a plain marker for the events query
// (the mocked `.where` ignores it); `@repo/db`'s own `inArray` re-export is
// stubbed the same way for the hydration recovery query.
// `normalizeStoredSubscriptionStatus` / `SubscriptionStatusEnum` are the REAL
// implementations — the classification logic under test depends on their true
// behavior.
// ---------------------------------------------------------------------------

vi.mock('@repo/db', () => ({
    getDb: vi.fn(),
    billingSubscriptionEvents: {
        subscriptionId: 'subscription_id',
        previousStatus: 'previous_status',
        newStatus: 'new_status'
    },
    // HOS-1104: `hydrateSubscriptionProductDomains` (real implementation, from
    // `@repo/service-core`) selects `{ id, productDomain }` from this table.
    billingSubscriptions: {
        id: 'id',
        productDomain: 'product_domain'
    },
    inArray: vi.fn((column: unknown, values: unknown) => ({ column, values }))
}));

vi.mock('drizzle-orm', () => ({
    inArray: vi.fn((column: unknown, values: unknown) => ({ column, values }))
}));

import { billingSubscriptions, getDb } from '@repo/db';
import {
    hasAnyPriorSubscription,
    resolveTrialEligibility
} from '../../../src/services/billing/trial-eligibility.service';

const CUSTOMER_ID = '00000000-0000-4000-8000-000000000001';

/** A subscription lifecycle event row as read by the resolver. */
interface EventRow {
    readonly previousStatus: string | null;
    readonly newStatus: string | null;
    /**
     * Which subscription the event belongs to. The real select reads this
     * column, because an absent audit trail now fails closed PER SUBSCRIPTION.
     * Defaulted by {@link mockDb} so the single-row tests below stay readable.
     */
    readonly subscriptionId?: string;
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

/** Spies for the two independent `getDb()` consumers, set by the last {@link mockDb} call. */
let dbSpies: {
    eventsWhere: ReturnType<typeof vi.fn>;
    hydrationWhere: ReturnType<typeof vi.fn>;
};

/**
 * Points the mocked `getDb()` at a fake query chain that routes by target
 * table: the `billing_subscription_events` audit-trail select (`events`) and
 * the HOS-1104 `hydrateSubscriptionProductDomains` recovery select
 * (`storedDomains`, keyed by subscription id — a missing key resolves like a
 * real legacy row with no `product_domain` value, i.e. no row returned).
 */
function mockDb(
    {
        events = [] as ReadonlyArray<EventRow>,
        storedDomains = {} as Record<string, string | null>,
        defaultSubscriptionId = 'sub-1'
    }: {
        events?: ReadonlyArray<EventRow>;
        storedDomains?: Record<string, string | null>;
        defaultSubscriptionId?: string;
    } = {} as never
): void {
    const eventRows = events.map((event) => ({
        subscriptionId: event.subscriptionId ?? defaultSubscriptionId,
        previousStatus: event.previousStatus,
        newStatus: event.newStatus
    }));
    const eventsWhere = vi.fn(() => Promise.resolve(eventRows));
    const hydrationWhere = vi.fn((clause: { values?: readonly string[] }) => {
        const ids = clause?.values ?? [];
        const rows = ids
            .filter((id) => id in storedDomains)
            .map((id) => ({ id, productDomain: storedDomains[id] ?? null }));
        return Promise.resolve(rows);
    });
    dbSpies = { eventsWhere, hydrationWhere };
    vi.mocked(getDb).mockReturnValue({
        select: vi.fn(() => ({
            from: vi.fn((table: unknown) => ({
                where: table === billingSubscriptions ? hydrationWhere : eventsWhere
            }))
        }))
    } as never);
}

beforeEach(() => {
    vi.clearAllMocks();
    // Default: no events, no stored domains. Any test exercising a `cancelled`
    // row or a real product-domain vertical overrides this.
    mockDb();
});

describe('hasAnyPriorSubscription', () => {
    it('returns false for a customer with no subscription rows (tourist-free default)', async () => {
        const billing = makeBilling([]);

        const result = await hasAnyPriorSubscription({
            billing,
            customerId: CUSTOMER_ID,
            productDomain: ProductDomainEnum.ACCOMMODATION
        });

        expect(result).toBe(false);
        expect(billing.subscriptions.getByCustomerId).toHaveBeenCalledWith(CUSTOMER_ID);
        // No subscriptions at all -> neither the hydration recovery nor the
        // event-history query has anything to run against.
        expect(getDb).not.toHaveBeenCalled();
    });

    it('returns true for a customer with one active subscription', async () => {
        const billing = makeBilling([{ id: 'sub-1', status: 'active' }]);

        expect(
            await hasAnyPriorSubscription({
                billing,
                customerId: CUSTOMER_ID,
                productDomain: ProductDomainEnum.ACCOMMODATION
            })
        ).toBe(true);
        // An unambiguously-authorized row short-circuits the event query (the
        // HOS-1104 hydration recovery query still runs — every fixture here
        // omits `productDomain`, matching the real SDK shape).
        expect(dbSpies.eventsWhere).not.toHaveBeenCalled();
    });

    it('returns true when the only prior subscription is a comp grant', async () => {
        const billing = makeBilling([{ id: 'sub-1', status: 'comp' }]);

        expect(
            await hasAnyPriorSubscription({
                billing,
                customerId: CUSTOMER_ID,
                productDomain: ProductDomainEnum.ACCOMMODATION
            })
        ).toBe(true);
        expect(dbSpies.eventsWhere).not.toHaveBeenCalled();
    });

    it('returns true when the only prior subscription is past_due', async () => {
        const billing = makeBilling([{ id: 'sub-1', status: 'past_due' }]);

        expect(
            await hasAnyPriorSubscription({
                billing,
                customerId: CUSTOMER_ID,
                productDomain: ProductDomainEnum.ACCOMMODATION
            })
        ).toBe(true);
    });

    // HOS-230: a checkout that was started but never authorized (the user opened
    // the MercadoPago screen and backed out) must NOT consume trial eligibility.
    // `abandoned` is Hospeda's vocabulary (share-link/cron path).
    it('returns false when the only prior subscription is abandoned (backed out of MP)', async () => {
        const billing = makeBilling([
            { id: 'sub-1', status: 'abandoned', providerSubscriptionIds: {} }
        ]);

        expect(
            await hasAnyPriorSubscription({
                billing,
                customerId: CUSTOMER_ID,
                productDomain: ProductDomainEnum.ACCOMMODATION
            })
        ).toBe(false);
    });

    it('returns false when the only prior subscription is a never-authorized pending_provider', async () => {
        const billing = makeBilling([
            { id: 'sub-1', status: 'pending_provider', providerSubscriptionIds: {} }
        ]);

        expect(
            await hasAnyPriorSubscription({
                billing,
                customerId: CUSTOMER_ID,
                productDomain: ProductDomainEnum.ACCOMMODATION
            })
        ).toBe(false);
    });

    // HOS-230 C2: `getByCustomerId` returns the RAW stored status, and the
    // `mode:'paid'` inline-preapproval flow writes qzpay's own vocabulary
    // (`incomplete` -> pending_provider, `incomplete_expired` -> abandoned).
    // These must be normalized and excluded too, or the bug recurs for that path.
    it('returns false for a raw qzpay `incomplete` row (mode:paid, not yet authorized)', async () => {
        const billing = makeBilling([
            { id: 'sub-1', status: 'incomplete', providerSubscriptionIds: {} }
        ]);

        expect(
            await hasAnyPriorSubscription({
                billing,
                customerId: CUSTOMER_ID,
                productDomain: ProductDomainEnum.ACCOMMODATION
            })
        ).toBe(false);
    });

    it('returns false for a raw qzpay `incomplete_expired` row (mode:paid, abandoned)', async () => {
        const billing = makeBilling([
            { id: 'sub-1', status: 'incomplete_expired', providerSubscriptionIds: {} }
        ]);

        expect(
            await hasAnyPriorSubscription({
                billing,
                customerId: CUSTOMER_ID,
                productDomain: ProductDomainEnum.ACCOMMODATION
            })
        ).toBe(false);
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

        expect(
            await hasAnyPriorSubscription({
                billing,
                customerId: CUSTOMER_ID,
                productDomain: ProductDomainEnum.ACCOMMODATION
            })
        ).toBe(false);
    });

    // ---- `cancelled` disambiguation (HOS-230 round-3 finding) ----------------

    // A subscription cancelled AFTER being authorized (active -> cancelled) DID
    // consume the trial. The event history carries an authorized status.
    it('returns true for a cancelled row that was previously active (real cancellation)', async () => {
        mockDb({
            events: [
                { previousStatus: 'pending_provider', newStatus: 'active' },
                { previousStatus: 'active', newStatus: 'cancelled' }
            ]
        });
        const billing = makeBilling([{ id: 'sub-1', status: 'cancelled' }]);

        expect(
            await hasAnyPriorSubscription({
                billing,
                customerId: CUSTOMER_ID,
                productDomain: ProductDomainEnum.ACCOMMODATION
            })
        ).toBe(true);
        expect(dbSpies.eventsWhere).toHaveBeenCalledOnce();
    });

    it('returns true for a cancelled row whose history shows it was trialing', async () => {
        mockDb({ events: [{ previousStatus: 'trialing', newStatus: 'cancelled' }] });
        const billing = makeBilling([{ id: 'sub-1', status: 'cancelled' }]);

        expect(
            await hasAnyPriorSubscription({
                billing,
                customerId: CUSTOMER_ID,
                productDomain: ProductDomainEnum.ACCOMMODATION
            })
        ).toBe(true);
    });

    // HOS-191 backout: MercadoPago reports the pending preapproval rejected before
    // it ever activated -> pending_provider -> cancelled, never authorized. This
    // must NOT consume the trial (the round-3 finding — the HOS-230 bug via the
    // reject-at-checkout trigger).
    it('returns false for a cancelled row reached directly from pending_provider (never authorized)', async () => {
        mockDb({ events: [{ previousStatus: 'pending_provider', newStatus: 'cancelled' }] });
        const billing = makeBilling([{ id: 'sub-1', status: 'cancelled' }]);

        expect(
            await hasAnyPriorSubscription({
                billing,
                customerId: CUSTOMER_ID,
                productDomain: ProductDomainEnum.ACCOMMODATION
            })
        ).toBe(false);
        expect(dbSpies.eventsWhere).toHaveBeenCalledOnce();
    });

    // HOS-1012: INVERTED. An empty audit trail is not evidence of a backout, it
    // is the absence of evidence, and the two possible mistakes do not cost the
    // same: reading it as never-authorized hands a second free trial to someone
    // who already paid and cancelled. The HOS-230 backout is unaffected — it
    // writes its `pending_provider` -> `cancelled` event (the test above).
    it('returns true for a cancelled row with no event history at all (fails closed)', async () => {
        mockDb({ events: [] });
        const billing = makeBilling([{ id: 'sub-1', status: 'cancelled' }]);

        expect(
            await hasAnyPriorSubscription({
                billing,
                customerId: CUSTOMER_ID,
                productDomain: ProductDomainEnum.ACCOMMODATION
            })
        ).toBe(true);
    });

    // The fail-closed decision is per subscription. A well-audited backout must
    // not vouch for a second, history-less row: collapsing the two would let one
    // documented cancellation re-open the trial for a row nothing is known
    // about, which is the hole this whole branch exists to close.
    it('fails closed on the history-less row even when a sibling row has a full trail', async () => {
        mockDb({
            events: [
                {
                    subscriptionId: 'sub-1',
                    previousStatus: 'pending_provider',
                    newStatus: 'cancelled'
                }
            ]
        });
        const billing = makeBilling([
            { id: 'sub-1', status: 'cancelled' },
            { id: 'sub-2', status: 'cancelled' }
        ]);

        expect(
            await hasAnyPriorSubscription({
                billing,
                customerId: CUSTOMER_ID,
                productDomain: ProductDomainEnum.ACCOMMODATION
            })
        ).toBe(true);
    });

    // A comp (free-forever) grant later revoked (comp -> cancelled, SPEC-262
    // admin revoke) is trial-consuming even though it was never provider-
    // authorized. Its only event carries previousStatus 'comp'; it must count.
    it('returns true for a cancelled row whose history shows it was a comp grant (revoked comp)', async () => {
        mockDb({ events: [{ previousStatus: 'comp', newStatus: 'cancelled' }] });
        const billing = makeBilling([{ id: 'sub-1', status: 'cancelled' }]);

        expect(
            await hasAnyPriorSubscription({
                billing,
                customerId: CUSTOMER_ID,
                productDomain: ProductDomainEnum.ACCOMMODATION
            })
        ).toBe(true);
    });

    // The event query must batch ALL cancelled rows; one authorized among them
    // disqualifies.
    it('returns true when one of several cancelled rows was authorized', async () => {
        mockDb({
            events: [
                { previousStatus: 'pending_provider', newStatus: 'cancelled' }, // sub-1 backout
                { previousStatus: 'active', newStatus: 'cancelled' } // sub-2 real cancel
            ]
        });
        const billing = makeBilling([
            { id: 'sub-1', status: 'cancelled' },
            { id: 'sub-2', status: 'cancelled' }
        ]);

        expect(
            await hasAnyPriorSubscription({
                billing,
                customerId: CUSTOMER_ID,
                productDomain: ProductDomainEnum.ACCOMMODATION
            })
        ).toBe(true);
    });

    // An authorized subscription short-circuits BEFORE the event query, even when
    // accompanied by a cancelled row.
    it('returns true when an authorized sub coexists with a cancelled one (no event query)', async () => {
        const billing = makeBilling([
            { id: 'sub-1', status: 'cancelled' },
            { id: 'sub-2', status: 'active' }
        ]);

        expect(
            await hasAnyPriorSubscription({
                billing,
                customerId: CUSTOMER_ID,
                productDomain: ProductDomainEnum.ACCOMMODATION
            })
        ).toBe(true);
        expect(dbSpies.eventsWhere).not.toHaveBeenCalled();
    });
});

describe('resolveTrialEligibility', () => {
    it('is eligible for a customer with no prior subscription', async () => {
        const billing = makeBilling([]);

        const result = await resolveTrialEligibility({
            billing,
            customerId: CUSTOMER_ID,
            productDomain: ProductDomainEnum.ACCOMMODATION
        });

        expect(result).toEqual({ eligible: true });
    });

    it('is NOT eligible for a customer with an authorized prior subscription', async () => {
        const billing = makeBilling([{ id: 'sub-1', status: 'active' }]);

        const result = await resolveTrialEligibility({
            billing,
            customerId: CUSTOMER_ID,
            productDomain: ProductDomainEnum.ACCOMMODATION
        });

        expect(result).toEqual({ eligible: false });
    });

    // Regression for the exact SMOKE-19-07 repro: fresh customer starts a
    // checkout, abandons it, and must remain eligible on the next attempt.
    it('stays eligible after fresh -> start checkout -> abandon', async () => {
        const billing = makeBilling([
            { id: 'sub-1', status: 'abandoned', providerSubscriptionIds: {} }
        ]);

        const result = await resolveTrialEligibility({
            billing,
            customerId: CUSTOMER_ID,
            productDomain: ProductDomainEnum.ACCOMMODATION
        });

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

        const result = await resolveTrialEligibility({
            billing,
            customerId: CUSTOMER_ID,
            productDomain: ProductDomainEnum.ACCOMMODATION
        });

        expect(result).toEqual({ eligible: true });
    });

    // Round-3 regression: a rejected-at-MP cancelled checkout keeps the customer
    // eligible for their trial.
    it('stays eligible when the only prior row is a pending -> cancelled backout', async () => {
        mockDb({ events: [{ previousStatus: 'pending_provider', newStatus: 'cancelled' }] });
        const billing = makeBilling([{ id: 'sub-1', status: 'cancelled' }]);

        const result = await resolveTrialEligibility({
            billing,
            customerId: CUSTOMER_ID,
            productDomain: ProductDomainEnum.ACCOMMODATION
        });

        expect(result).toEqual({ eligible: true });
    });
});

// ---------------------------------------------------------------------------
// HOS-1012 D-2 / HOS-931 — eligibility is per product domain.
//
// The rule used to be "one trial per customer, for life, in ANY domain". In a
// market of 22 destinations the same people own the cabin AND the restaurant,
// so that denied a trial the owner had never actually had in that vertical.
//
// The asymmetry below is the part that breaks silently and is therefore tested
// in BOTH directions: accommodation fails OPEN on a missing domain (the column
// post-dates most rows) while every other domain fails CLOSED.
//
// HOS-1104: every fixture's billing-SDK object below omits `productDomain`
// (the real `getByCustomerId()` shape); a subscription's REAL domain is
// supplied via `mockDb({ storedDomains })`, simulating the recovery SELECT
// `hydrateSubscriptionProductDomains` runs against `getDb()`. Setting
// `productDomain` directly on the billing-SDK fixture would fabricate a field
// the SDK never populates and mask this exact bug (see HOS-934's identical
// fix for `entitlements-product-domain.test.ts`).
// ---------------------------------------------------------------------------

describe('hasAnyPriorSubscription — per product domain (HOS-1012 D-2)', () => {
    it('a spent gastronomy trial leaves the accommodation trial available', async () => {
        mockDb({ storedDomains: { 'sub-gastro': 'gastronomy' } });
        const billing = makeBilling([{ id: 'sub-gastro', status: 'active' }]);

        const result = await hasAnyPriorSubscription({
            billing,
            customerId: CUSTOMER_ID,
            productDomain: ProductDomainEnum.ACCOMMODATION
        });

        expect(result).toBe(false);
    });

    it('a spent accommodation trial leaves the gastronomy trial available', async () => {
        mockDb({ storedDomains: { 'sub-accom': 'accommodation' } });
        const billing = makeBilling([{ id: 'sub-accom', status: 'active' }]);

        const result = await hasAnyPriorSubscription({
            billing,
            customerId: CUSTOMER_ID,
            productDomain: ProductDomainEnum.GASTRONOMY
        });

        expect(result).toBe(false);
    });

    it('a prior subscription in the SAME domain still consumes the trial', async () => {
        mockDb({ storedDomains: { 'sub-gastro': 'gastronomy' } });
        const billing = makeBilling([{ id: 'sub-gastro', status: 'active' }]);

        const result = await hasAnyPriorSubscription({
            billing,
            customerId: CUSTOMER_ID,
            productDomain: ProductDomainEnum.GASTRONOMY
        });

        expect(result).toBe(true);
    });

    it('gastronomy and experience are separate verticals, not one commerce bucket', async () => {
        mockDb({ storedDomains: { 'sub-gastro': 'gastronomy' } });
        const billing = makeBilling([{ id: 'sub-gastro', status: 'active' }]);

        const result = await hasAnyPriorSubscription({
            billing,
            customerId: CUSTOMER_ID,
            productDomain: ProductDomainEnum.EXPERIENCE
        });

        expect(result).toBe(false);
    });

    describe('the fail-open / fail-closed asymmetry', () => {
        it('a legacy row with NO domain consumes the ACCOMMODATION trial (fails open)', async () => {
            // The column post-dates most rows, so an absent value must read as
            // accommodation — otherwise every pre-column subscriber silently
            // regains a trial they already spent. No `storedDomains` entry for
            // 'sub-legacy' -> the recovery SELECT finds no row -> `null`, the
            // same as a genuinely-absent column.
            const billing = makeBilling([{ id: 'sub-legacy', status: 'active' }]);

            const result = await hasAnyPriorSubscription({
                billing,
                customerId: CUSTOMER_ID,
                productDomain: ProductDomainEnum.ACCOMMODATION
            });

            expect(result).toBe(true);
        });

        it('a legacy row with NO domain does NOT consume a gastronomy trial (fails closed)', async () => {
            const billing = makeBilling([{ id: 'sub-legacy', status: 'active' }]);

            const result = await hasAnyPriorSubscription({
                billing,
                customerId: CUSTOMER_ID,
                productDomain: ProductDomainEnum.GASTRONOMY
            });

            expect(result).toBe(false);
        });

        // Unlike the two cases above, an EXPLICIT `null` already on the
        // billing-SDK object is a real, documented input shape for
        // `hydrateSubscriptionProductDomains` (a value already present, even
        // `null`, is left untouched) — not a fabrication of a field the SDK
        // never sets, so this fixture legitimately sets it directly.
        it('an explicit null domain behaves the same as an absent one', async () => {
            const billing = makeBilling([
                { id: 'sub-legacy', status: 'active', productDomain: null }
            ]);

            expect(
                await hasAnyPriorSubscription({
                    billing,
                    customerId: CUSTOMER_ID,
                    productDomain: ProductDomainEnum.ACCOMMODATION
                })
            ).toBe(true);
        });
    });

    it('a row still carrying the retired "commerce" value matches NO vertical (HOS-695)', async () => {
        // Deliberate: a leftover 'commerce' row goes dark rather than silently
        // matching a vertical it was never resolved to. Per CLAUDE.md that is
        // the intended failure mode, not a bug to widen the comparison for.
        mockDb({ storedDomains: { 'sub-legacy-commerce': 'commerce' } });
        const billing = makeBilling([{ id: 'sub-legacy-commerce', status: 'active' }]);

        for (const domain of [
            ProductDomainEnum.GASTRONOMY,
            ProductDomainEnum.EXPERIENCE,
            ProductDomainEnum.ACCOMMODATION
        ]) {
            expect(
                await hasAnyPriorSubscription({
                    billing,
                    customerId: CUSTOMER_ID,
                    productDomain: domain
                })
            ).toBe(false);
        }
    });

    it('keeps excluding never-authorized checkouts WITHIN the matching domain (HOS-230)', async () => {
        // The domain filter must narrow the candidate set, not replace the
        // authorization rule that runs over it.
        mockDb({ storedDomains: { 'sub-gastro': 'gastronomy' } });
        const billing = makeBilling([{ id: 'sub-gastro', status: 'pending_provider' }]);

        const result = await hasAnyPriorSubscription({
            billing,
            customerId: CUSTOMER_ID,
            productDomain: ProductDomainEnum.GASTRONOMY
        });

        expect(result).toBe(false);
    });

    it('only inspects event history for cancelled rows IN the requested domain', async () => {
        // A cancelled accommodation row is ambiguous and would trigger the
        // event-history lookup — but when asking about gastronomy it is not a
        // candidate at all, so the lookup must never run.
        mockDb({
            events: [{ previousStatus: 'active', newStatus: 'cancelled' }],
            storedDomains: { 'sub-accom': 'accommodation' }
        });
        const billing = makeBilling([{ id: 'sub-accom', status: 'cancelled' }]);

        const result = await hasAnyPriorSubscription({
            billing,
            customerId: CUSTOMER_ID,
            productDomain: ProductDomainEnum.GASTRONOMY
        });

        expect(result).toBe(false);
        expect(dbSpies.eventsWhere).not.toHaveBeenCalled();
    });
});
