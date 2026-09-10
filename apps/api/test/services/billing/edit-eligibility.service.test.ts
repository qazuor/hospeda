/**
 * `resolveEditEligibility` — the content-editing subscription gate's predicate
 * (HOS-1275).
 *
 * ## What this file has to prove, and why the emphasis is where it is
 *
 * The defect this issue exists to close was a gate that PASSED its tests and
 * refused nobody. `requireEntitlement(EDIT_*)` had allow-side coverage in
 * `hos-1275-content-gates-entitlement-allow.e2e.test.ts` and it was all green,
 * because every one of those keys is a FLOOR key. So the load-bearing tests
 * here are the REFUSALS: `'lapsed'` for a cancelled/expired owner, per vertical.
 * A file that only asserted the happy path would reproduce the original bug
 * exactly.
 *
 * The second thing it has to prove is the opposite direction: that the gate
 * does NOT refuse the four grace states, the two extra statuses nobody lists
 * (`courtesy`, `pending_provider`), and — most important of all — the owner
 * with NO subscription rows at all, who is every host between signup and their
 * first publish.
 *
 * ## The fixtures never inject `productDomain`
 *
 * `getByCustomerId()` never populates it (HOS-934), and the real call site
 * hands `resolveEditEligibility` exactly those objects. A fixture that set the
 * column by hand would test a shape production never produces — the precise
 * mistake that kept `addon-limit-recalculation.service.ts` broken for 13 days
 * with a green suite. Here the column is recovered through a mocked
 * `hydrateSubscriptionProductDomains`, which is what the function really calls.
 *
 * `subscriptionMatchesDomain`, `isLiveSubscriptionStatus` and `isSubscriptionLive`
 * are deliberately NOT mocked: they are the predicates under test.
 *
 * ## Every `cancelled` fixture carries a `currentPeriodEnd`
 *
 * Not decoration. `cancelled` is the ONE status whose verdict a date
 * decides — future period end means the host paid through it and keeps
 * editing; past means they are out. A dateless fixture tests a row shape
 * production does not produce, and would have hidden the very regression
 * this file now pins (see the SOFT-CANCEL block at the bottom). Mocking them would leave
 * assertions that can only ever confirm the mock.
 *
 * @module test/services/billing/edit-eligibility.service
 */
import { ProductDomainEnum, SubscriptionStatusEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockHydrate, mockGetByCustomerId, mockGetBilling } = vi.hoisted(() => ({
    mockHydrate: vi.fn(),
    mockGetByCustomerId: vi.fn(),
    mockGetBilling: vi.fn()
}));

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return { ...actual, hydrateSubscriptionProductDomains: mockHydrate };
});

vi.mock('../../../src/middlewares/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/middlewares/billing')>();
    return { ...actual, getQZPayBilling: mockGetBilling };
});

import { resolveEditEligibility } from '../../../src/services/billing/edit-eligibility.service';

const CUSTOMER_ID = 'cus-1';

/**
 * A `getByCustomerId()`-shaped row: no `productDomain` key at all (HOS-934).
 *
 * `currentPeriodEnd` is optional and real rows carry it. It matters for exactly
 * one status — `cancelled`, where it separates a soft-cancel still inside its
 * paid period from a subscription that has actually run out.
 */
function row(id: string, status: string, currentPeriodEnd?: Date, cancelAtPeriodEnd?: boolean) {
    return {
        id,
        status,
        ...(currentPeriodEnd === undefined ? {} : { currentPeriodEnd }),
        ...(cancelAtPeriodEnd === undefined ? {} : { cancelAtPeriodEnd })
    };
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
/** A period end still in the future: the host has paid through it. */
const future = () => new Date(Date.now() + THIRTY_DAYS_MS);
/** A period end well in the past, beyond any grace window. */
const past = () => new Date(Date.now() - THIRTY_DAYS_MS);

/**
 * Wires the provider read and the hydration together.
 *
 * @param rows - The rows `getByCustomerId` returns (no `productDomain`).
 * @param domains - What the column really holds, keyed by row id — mirroring
 *   the batched recovery SELECT `hydrateSubscriptionProductDomains` performs.
 */
function given(
    rows: ReadonlyArray<{ id: string; status: string }>,
    domains: Record<string, string | null>
): void {
    mockGetByCustomerId.mockResolvedValue([...rows]);
    mockGetBilling.mockReturnValue({ subscriptions: { getByCustomerId: mockGetByCustomerId } });
    mockHydrate.mockImplementation(async (subs: readonly { id: string }[]) =>
        subs.map((sub) => ({ ...sub, productDomain: domains[sub.id] ?? null }))
    );
}

/** The three verticals this gate covers, with the domain each one resolves to. */
const VERTICALS = [
    { label: 'accommodation', domain: ProductDomainEnum.ACCOMMODATION },
    { label: 'gastronomy', domain: ProductDomainEnum.GASTRONOMY },
    { label: 'experience', domain: ProductDomainEnum.EXPERIENCE }
] as const;

describe('resolveEditEligibility — REFUSES a lapsed owner (the load-bearing case)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    for (const { label, domain } of VERTICALS) {
        it(`answers 'lapsed' in ${label} when the only subscription is cancelled`, async () => {
            given([row('s1', SubscriptionStatusEnum.CANCELLED, past())], { s1: domain });

            expect(await resolveEditEligibility({ customerId: CUSTOMER_ID, domain })).toBe(
                'lapsed'
            );
        });

        it(`answers 'lapsed' in ${label} when the only subscription is expired`, async () => {
            given([row('s1', SubscriptionStatusEnum.EXPIRED)], { s1: domain });

            expect(await resolveEditEligibility({ customerId: CUSTOMER_ID, domain })).toBe(
                'lapsed'
            );
        });

        it(`answers 'lapsed' in ${label} when the only subscription is paused`, async () => {
            // `paused` is deliberately not live: a real pause is meant to cut
            // access, which is the single line separating it from `courtesy`
            // sitting on top of one.
            given([row('s1', SubscriptionStatusEnum.PAUSED)], { s1: domain });

            expect(await resolveEditEligibility({ customerId: CUSTOMER_ID, domain })).toBe(
                'lapsed'
            );
        });
    }
});

describe('resolveEditEligibility — the grace states must NOT be cut', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // The four the owner named, plus the two nobody lists. `active` covers
    // soft-cancel on purpose: a subscription the owner cancelled but has paid
    // through keeps `status = 'active'` until `finalize-cancelled-subs` flips
    // it after `currentPeriodEnd`, so there is no separate status to assert.
    const LIVE_STATUSES = [
        { status: SubscriptionStatusEnum.ACTIVE, why: 'paid and current (also: soft-cancel)' },
        { status: SubscriptionStatusEnum.TRIALING, why: 'every new host starts here' },
        { status: SubscriptionStatusEnum.COMP, why: 'permanently complimentary (SPEC-262)' },
        { status: SubscriptionStatusEnum.COURTESY, why: 'gifted cycles (HOS-180)' },
        {
            status: SubscriptionStatusEnum.PAST_DUE,
            why: 'owned by pastDueGraceMiddleware, which 402s past the 7-day window'
        },
        {
            status: SubscriptionStatusEnum.PENDING_PROVIDER,
            why: 'a checkout in flight — they are paying right now'
        }
    ] as const;

    for (const { label, domain } of VERTICALS) {
        for (const { status, why } of LIVE_STATUSES) {
            it(`answers 'live' in ${label} for '${status}' — ${why}`, async () => {
                given([row('s1', status)], { s1: domain });

                expect(await resolveEditEligibility({ customerId: CUSTOMER_ID, domain })).toBe(
                    'live'
                );
            });
        }
    }

    it("a lapsed row alongside a live one still answers 'live'", async () => {
        // A renewing host legitimately carries a superseded `cancelled` row next
        // to the `active` one that replaced it.
        given(
            [
                row('old', SubscriptionStatusEnum.CANCELLED, past()),
                row('new', SubscriptionStatusEnum.ACTIVE)
            ],
            { old: ProductDomainEnum.ACCOMMODATION, new: ProductDomainEnum.ACCOMMODATION }
        );

        expect(
            await resolveEditEligibility({
                customerId: CUSTOMER_ID,
                domain: ProductDomainEnum.ACCOMMODATION
            })
        ).toBe('live');
    });
});

describe("resolveEditEligibility — the draft phase ('pre_trial') must pass", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    for (const { label, domain } of VERTICALS) {
        it(`answers 'pre_trial' in ${label} for an owner with ZERO subscription rows`, async () => {
            // THE test this gate exists to not break. Since HOS-1012 the trial
            // is granted at the first publish, so a brand-new host has no rows
            // at all while they fill in their draft. `if (!subscription) deny`
            // cuts every host between signup and first publish.
            given([], {});

            expect(await resolveEditEligibility({ customerId: CUSTOMER_ID, domain })).toBe(
                'pre_trial'
            );
        });
    }

    it("answers 'pre_trial' when the owner's only rows belong to another domain", async () => {
        // A host who pays for accommodation and has never sold a menu is in the
        // draft phase for gastronomy, not lapsed in it.
        given([row('s1', SubscriptionStatusEnum.ACTIVE)], {
            s1: ProductDomainEnum.ACCOMMODATION
        });

        expect(
            await resolveEditEligibility({
                customerId: CUSTOMER_ID,
                domain: ProductDomainEnum.GASTRONOMY
            })
        ).toBe('pre_trial');
    });
});

describe('resolveEditEligibility — the dual owner is answered per domain', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('a live accommodation sub does NOT rescue a lapsed gastronomy one', async () => {
        // The hole the globally-mounted, domain-BLIND trialMiddleware leaves
        // open (`trial.service.ts`: "a live commerce sub can mask an elapsed
        // accommodation trial"). Scoping per domain is what closes it.
        given(
            [
                row('acc', SubscriptionStatusEnum.ACTIVE),
                row('gas', SubscriptionStatusEnum.CANCELLED, past())
            ],
            { acc: ProductDomainEnum.ACCOMMODATION, gas: ProductDomainEnum.GASTRONOMY }
        );

        expect(
            await resolveEditEligibility({
                customerId: CUSTOMER_ID,
                domain: ProductDomainEnum.GASTRONOMY
            })
        ).toBe('lapsed');
    });

    it('and does not cut the accommodation side either', async () => {
        given(
            [
                row('acc', SubscriptionStatusEnum.ACTIVE),
                row('gas', SubscriptionStatusEnum.CANCELLED, past())
            ],
            { acc: ProductDomainEnum.ACCOMMODATION, gas: ProductDomainEnum.GASTRONOMY }
        );

        expect(
            await resolveEditEligibility({
                customerId: CUSTOMER_ID,
                domain: ProductDomainEnum.ACCOMMODATION
            })
        ).toBe('live');
    });

    it('the mirror image: lapsed accommodation, live gastronomy', async () => {
        given(
            [row('acc', SubscriptionStatusEnum.EXPIRED), row('gas', SubscriptionStatusEnum.ACTIVE)],
            { acc: ProductDomainEnum.ACCOMMODATION, gas: ProductDomainEnum.GASTRONOMY }
        );

        expect(
            await resolveEditEligibility({
                customerId: CUSTOMER_ID,
                domain: ProductDomainEnum.ACCOMMODATION
            })
        ).toBe('lapsed');
        expect(
            await resolveEditEligibility({
                customerId: CUSTOMER_ID,
                domain: ProductDomainEnum.GASTRONOMY
            })
        ).toBe('live');
    });

    it('a TOURIST subscription does not count as an accommodation one', async () => {
        // HOS-1233 reclassified tourist plans out of `accommodation`. A tourist
        // VIP who was auto-promoted to host and let their host plan lapse must
        // be refused, not rescued by the consumer plan they still pay for.
        given(
            [
                row('tou', SubscriptionStatusEnum.ACTIVE),
                row('acc', SubscriptionStatusEnum.CANCELLED, past())
            ],
            { tou: ProductDomainEnum.TOURIST, acc: ProductDomainEnum.ACCOMMODATION }
        );

        expect(
            await resolveEditEligibility({
                customerId: CUSTOMER_ID,
                domain: ProductDomainEnum.ACCOMMODATION
            })
        ).toBe('lapsed');
    });
});

describe('resolveEditEligibility — hydration is what makes the domain scoping real', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('refuses a lapsed gastronomy owner whose rows arrive WITHOUT productDomain', async () => {
        // The regression test for HOS-934/HOS-1176 as it applies to THIS gate.
        // `given()` reproduces the real shape: the rows `getByCustomerId`
        // returns carry no `productDomain` key, and only the hydration call
        // recovers it. Drop that call from the service and these rows reach
        // `subscriptionMatchesDomain` as `undefined`, which fails closed for
        // gastronomy — the domain filter empties, and the verdict flips from
        // 'lapsed' to 'pre_trial'. The gate would then refuse nobody in
        // gastronomy or experience, with no thrown error and no log line.
        given([row('gas', SubscriptionStatusEnum.CANCELLED, past())], {
            gas: ProductDomainEnum.GASTRONOMY
        });

        expect(
            await resolveEditEligibility({
                customerId: CUSTOMER_ID,
                domain: ProductDomainEnum.GASTRONOMY
            })
        ).toBe('lapsed');
        expect(mockHydrate).toHaveBeenCalledTimes(1);
    });

    it('and the same for experience', async () => {
        given([row('exp', SubscriptionStatusEnum.CANCELLED, past())], {
            exp: ProductDomainEnum.EXPERIENCE
        });

        expect(
            await resolveEditEligibility({
                customerId: CUSTOMER_ID,
                domain: ProductDomainEnum.EXPERIENCE
            })
        ).toBe('lapsed');
    });

    it('a NULL productDomain still counts as accommodation (legacy rows fail open)', async () => {
        // `subscriptionMatchesDomain`'s deliberate asymmetry: the column
        // post-dates most accommodation rows, so a null reads as accommodation.
        given([row('legacy', SubscriptionStatusEnum.ACTIVE)], { legacy: null });

        expect(
            await resolveEditEligibility({
                customerId: CUSTOMER_ID,
                domain: ProductDomainEnum.ACCOMMODATION
            })
        ).toBe('live');
    });
});

describe('resolveEditEligibility — fails OPEN on everything it cannot evaluate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("answers 'live' with no billing customer", async () => {
        mockGetBilling.mockReturnValue({
            subscriptions: { getByCustomerId: mockGetByCustomerId }
        });

        expect(
            await resolveEditEligibility({
                customerId: null,
                domain: ProductDomainEnum.ACCOMMODATION
            })
        ).toBe('live');
        expect(mockGetByCustomerId).not.toHaveBeenCalled();
    });

    it("answers 'live' when billing is disabled", async () => {
        mockGetBilling.mockReturnValue(null);

        expect(
            await resolveEditEligibility({
                customerId: CUSTOMER_ID,
                domain: ProductDomainEnum.ACCOMMODATION
            })
        ).toBe('live');
    });

    it("answers 'live' when the provider read throws", async () => {
        // A billing outage must never lock owners out of their own content.
        mockGetByCustomerId.mockRejectedValue(new Error('provider down'));
        mockGetBilling.mockReturnValue({
            subscriptions: { getByCustomerId: mockGetByCustomerId }
        });

        expect(
            await resolveEditEligibility({
                customerId: CUSTOMER_ID,
                domain: ProductDomainEnum.ACCOMMODATION
            })
        ).toBe('live');
    });
});

describe('resolveEditEligibility — SOFT-CANCEL keeps editing until the period ends', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // REGRESSION (HOS-1275). The first cut of this gate was status-only and
    // refused a `cancelled` row whose `current_period_end` was still in the
    // future — a 402 to somebody who had paid through the period, the exact
    // incident this gate must not cause.
    //
    // CORRECTED 2026-09-10 (HOS-1310): this comment used to say cancelling writes
    // `status = 'cancelled'` IMMEDIATELY, citing the E2E
    // `host-04-cancellation-grace.spec.ts`. That E2E performs the UPDATE itself,
    // as a fixture, and the real write path does the opposite — an in-app soft
    // cancel sets only `cancel_at_period_end` and leaves the status alone. The
    // rows that DO reach this branch mid-period come from the MercadoPago webhook
    // and from qzpay's hard cancel. The other half of the old claim turned out to
    // be the load-bearing one: `cancel_at_period_end = true` is what a genuine
    // soft-cancel carries, and it is now REQUIRED by `isSubscriptionLive` —
    // `current_period_end` alone is a placeholder qzpay stamps at INSERT before
    // any payment, so on its own it cannot tell a paying owner from a checkout
    // nobody ever completed.
    //
    // So every fixture below carries the flag explicitly, and the phantom
    // counterpart (same date, flag false) is asserted right after each one.
    for (const { label, domain } of VERTICALS) {
        it(`answers 'live' in ${label} for a cancelled sub still inside its paid period`, async () => {
            given([row('s1', SubscriptionStatusEnum.CANCELLED, future(), true)], { s1: domain });

            expect(await resolveEditEligibility({ customerId: CUSTOMER_ID, domain })).toBe('live');
        });

        it(`answers 'lapsed' in ${label} for a NEVER-PAID row with the same future date (HOS-1310)`, async () => {
            // The pair that matters. Identical status, identical date; the only
            // difference is the payment evidence. A predicate that refused every
            // cancelled row would pass this case and fail the one above — which
            // is why both are here.
            given([row('s1', SubscriptionStatusEnum.CANCELLED, future(), false)], { s1: domain });

            expect(await resolveEditEligibility({ customerId: CUSTOMER_ID, domain })).toBe(
                'lapsed'
            );
        });

        it(`answers 'lapsed' in ${label} once that period has passed`, async () => {
            given([row('s1', SubscriptionStatusEnum.CANCELLED, past())], { s1: domain });

            expect(await resolveEditEligibility({ customerId: CUSTOMER_ID, domain })).toBe(
                'lapsed'
            );
        });
    }

    it('a cancelled sub with NO period end fails OPEN — inherited, and deliberate', async () => {
        // `isSubscriptionLive` treats an absent/unparseable date as live, and
        // this gate inherits that rather than second-guessing it: the same
        // policy already governs the accommodation publish gate, and a row that
        // is cancelled with no period at all is a data anomaly, not a signal to
        // withhold someone's own content. Asserted so the inheritance is a
        // decision on record instead of an accident.
        given([row('s1', SubscriptionStatusEnum.CANCELLED, undefined, true)], {
            s1: ProductDomainEnum.ACCOMMODATION
        });

        expect(
            await resolveEditEligibility({
                customerId: CUSTOMER_ID,
                domain: ProductDomainEnum.ACCOMMODATION
            })
        ).toBe('live');
    });

    it("'expired' is NOT rescued by a future period end", async () => {
        // The distinction that keeps the composition honest: `isSubscriptionLive`
        // returns false for `expired` whatever the dates say, so a locally
        // expired trial cannot buy itself more time through this branch.
        given([row('s1', SubscriptionStatusEnum.EXPIRED, future())], {
            s1: ProductDomainEnum.ACCOMMODATION
        });

        expect(
            await resolveEditEligibility({
                customerId: CUSTOMER_ID,
                domain: ProductDomainEnum.ACCOMMODATION
            })
        ).toBe('lapsed');
    });

    it("'paused' is NOT rescued by a future period end either", async () => {
        given([row('s1', SubscriptionStatusEnum.PAUSED, future())], {
            s1: ProductDomainEnum.ACCOMMODATION
        });

        expect(
            await resolveEditEligibility({
                customerId: CUSTOMER_ID,
                domain: ProductDomainEnum.ACCOMMODATION
            })
        ).toBe('lapsed');
    });
});
