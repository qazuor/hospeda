/**
 * SPEC-262 H2 guard tests: start-paid rejected when the customer already has
 * an active/trialing/comp accommodation subscription.
 *
 * Stacking a new subscription on top of an existing active one creates
 * ambiguous entitlements (two subs for the same customer). The guard must fire
 * BEFORE any provider call.
 *
 * @module test/routes/billing/start-paid-already-subscribed
 */

import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn(),
    requireBilling: vi.fn(async (_c: unknown, next: () => Promise<void>) => next())
}));

vi.mock('../../../src/middlewares/actor', () => ({
    getActorFromContext: vi.fn(() => ({ id: 'user-1', email: 'test@test.com', roles: [] }))
}));

vi.mock('../../../src/lib/sentry', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/lib/sentry')>();
    return { ...actual, captureBillingError: vi.fn() };
});

vi.mock('../../../src/lib/billing-provider-error', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/lib/billing-provider-error')>();
    return { ...actual };
});

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return { ...actual };
});

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('../../../src/utils/create-app', () => ({
    createRouter: vi.fn(() => ({
        use: vi.fn(),
        route: vi.fn(),
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
    }))
}));

vi.mock('../../../src/utils/route-factory', () => ({
    createCRUDRoute: vi.fn((config: { handler: unknown }) => config.handler)
}));

vi.mock('../../../src/utils/env', () => ({
    env: {
        HOSPEDA_SITE_URL: 'https://hospeda.test',
        HOSPEDA_API_URL: 'https://api.hospeda.test',
        HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR: 'HOSPEDA'
    }
}));

const { mockHydrationRows } = vi.hoisted(() => ({
    // HOS-847: hasActiveAccommodationSub/hasSoftCancelledSub now hydrate via
    // hydrateSubscriptionProductDomains (from @repo/service-core, unmocked)
    // before filtering — it issues a real
    // getDb().select({id, productDomain}).from(billingSubscriptions)
    // .where(inArray(...)) for any fixture that lacks an explicit
    // productDomain. Defaults to `[]`: an unmatched id hydrates to
    // `productDomain: null`, the same accommodation fail-open every
    // pre-existing fixture here already relied on. Tests that need a REAL
    // (non-accommodation) domain override via mockResolvedValueOnce.
    mockHydrationRows: vi.fn().mockResolvedValue([])
}));

vi.mock('@repo/db', () => {
    const insertChain = { values: vi.fn().mockResolvedValue(undefined) };
    return {
        getDb: vi.fn(() => ({
            insert: vi.fn(() => insertChain),
            select: vi.fn(() => ({
                from: vi.fn(() => ({
                    where: mockHydrationRows
                }))
            }))
        })),
        billingSubscriptions: { id: 'ID', productDomain: 'PRODUCT_DOMAIN' },
        inArray: (column: unknown, values: unknown[]) => ({ inArray: column, values })
    };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { getQZPayBilling } from '../../../src/middlewares/billing';
import { handleStartPaidSubscription } from '../../../src/routes/billing/start-paid';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CUSTOMER_ID = 'cust_h2_test';
const PLAN_SLUG = 'owner-basico';

function makeContext() {
    const store = new Map<string, unknown>([
        ['billingEnabled', true],
        ['billingCustomerId', CUSTOMER_ID]
    ]);
    return {
        get: vi.fn((k: string) => store.get(k)),
        // Better Auth session user (for resolveReturnUrlLocale)
        var: { user: null }
    };
}

function makeBillingMock(
    existingSubs: {
        id?: string;
        status: string;
        cancelAtPeriodEnd?: boolean;
        productDomain?: string;
        // HOS-1335: a `trialing` row is only a duplicate when something is
        // actually linked at MercadoPago, so the fixtures that mean "a live
        // trial" have to say so.
        providerSubscriptionIds?: Record<string, string>;
    }[]
) {
    const plan = {
        id: 'plan-basico',
        name: PLAN_SLUG,
        active: true,
        prices: [
            { id: 'price-m', billingInterval: 'month', intervalCount: 1, active: true },
            { id: 'price-y', billingInterval: 'year', intervalCount: 1, active: true }
        ],
        metadata: {}
    };
    return {
        subscriptions: {
            getByCustomerId: vi.fn().mockResolvedValue(existingSubs),
            create: vi.fn()
        },
        plans: { listAll: vi.fn().mockResolvedValue([plan]) }
    };
}

function mockBillingWith(billing: ReturnType<typeof makeBillingMock>) {
    vi.mocked(getQZPayBilling).mockReturnValue(
        billing as unknown as ReturnType<typeof getQZPayBilling>
    );
}

// ---------------------------------------------------------------------------
// Tests — SPEC-262 H2 guard
// ---------------------------------------------------------------------------

describe('handleStartPaidSubscription — ALREADY_SUBSCRIBED guard (SPEC-262 H2)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('throws ALREADY_EXISTS when customer has an active accommodation sub', async () => {
        mockBillingWith(makeBillingMock([{ status: 'active' }]));
        const ctx = makeContext();

        const err = await handleStartPaidSubscription(ctx as never, {
            planSlug: PLAN_SLUG,
            billingInterval: 'monthly'
        }).catch((e: unknown) => e);

        expect(err).toBeInstanceOf(ServiceError);
        expect((err as ServiceError).code).toBe(ServiceErrorCode.ALREADY_EXISTS);
        expect((err as ServiceError).reason).toBe('ALREADY_SUBSCRIBED');
    });

    // HOS-1335 narrowed what `trialing` means here. A trial with a LIVE
    // MercadoPago preapproval — the pre-HOS-1012 card-first shape, still present
    // on legacy rows — is a real duplicate and keeps blocking, which is what this
    // test now pins. A trial WITHOUT one is Hospeda's own and is exempt; that
    // half lives in `start-paid-trial-conversion.test.ts`, both directions.
    it('throws ALREADY_EXISTS when customer has a trialing sub with a live preapproval', async () => {
        mockBillingWith(
            makeBillingMock([
                { status: 'trialing', providerSubscriptionIds: { mercadopago: 'mp-live-1' } }
            ])
        );
        const ctx = makeContext();

        const err = await handleStartPaidSubscription(ctx as never, {
            planSlug: PLAN_SLUG,
            billingInterval: 'monthly'
        }).catch((e: unknown) => e);

        expect(err).toBeInstanceOf(ServiceError);
        expect((err as ServiceError).reason).toBe('ALREADY_SUBSCRIBED');
    });

    it('throws ALREADY_EXISTS when customer has a comp sub (SPEC-262 — comp subs are perpetual)', async () => {
        mockBillingWith(makeBillingMock([{ status: 'comp' }]));
        const ctx = makeContext();

        const err = await handleStartPaidSubscription(ctx as never, {
            planSlug: PLAN_SLUG,
            billingInterval: 'annual'
        }).catch((e: unknown) => e);

        expect(err).toBeInstanceOf(ServiceError);
        expect((err as ServiceError).reason).toBe('ALREADY_SUBSCRIBED');
    });

    it('provider.subscriptions.create NOT called when ALREADY_SUBSCRIBED guard fires', async () => {
        const billing = makeBillingMock([{ status: 'active' }]);
        mockBillingWith(billing);
        const ctx = makeContext();

        await handleStartPaidSubscription(ctx as never, {
            planSlug: PLAN_SLUG,
            billingInterval: 'monthly'
        }).catch(() => undefined);

        expect(billing.subscriptions.create).not.toHaveBeenCalled();
    });

    it('allows checkout when no existing subs', async () => {
        const billing = makeBillingMock([]);
        mockBillingWith(billing);
        const ctx = makeContext();

        // Will fail downstream (service throws PLAN_NOT_FOUND / etc) since
        // we have no full mock — but NOT because of the H2 guard.
        const err = await handleStartPaidSubscription(ctx as never, {
            planSlug: PLAN_SLUG,
            billingInterval: 'monthly'
        }).catch((e: unknown) => e);

        // ALREADY_SUBSCRIBED must NOT be the error
        expect((err as ServiceError).reason ?? '').not.toBe('ALREADY_SUBSCRIBED');
    });

    it('allows checkout when existing sub is cancelled (status=cancelled)', async () => {
        const billing = makeBillingMock([{ status: 'cancelled' }]);
        mockBillingWith(billing);
        const ctx = makeContext();

        const err = await handleStartPaidSubscription(ctx as never, {
            planSlug: PLAN_SLUG,
            billingInterval: 'monthly'
        }).catch((e: unknown) => e);

        expect((err as ServiceError).reason ?? '').not.toBe('ALREADY_SUBSCRIBED');
    });

    it('allows checkout when existing sub is paused (status=paused — deliberately NOT live)', async () => {
        // Guards the widening from going too far: `paused` is explicitly OUT of
        // `LIVE_SUBSCRIPTION_STATUSES` (is-live-subscription-status.ts docblock)
        // — a real pause is meant to cut access, unlike past_due mid-dunning.
        const billing = makeBillingMock([{ status: 'paused' }]);
        mockBillingWith(billing);
        const ctx = makeContext();

        const err = await handleStartPaidSubscription(ctx as never, {
            planSlug: PLAN_SLUG,
            billingInterval: 'monthly'
        }).catch((e: unknown) => e);

        expect((err as ServiceError).reason ?? '').not.toBe('ALREADY_SUBSCRIBED');
    });
});

// ---------------------------------------------------------------------------
// Tests — HOS-1273: a past-due accommodation subscription must block a
// second checkout, mirroring the commerce vertical (AC-16, HOS-166 W1).
// ---------------------------------------------------------------------------

describe('handleStartPaidSubscription — HOS-1273 past_due parity with commerce', () => {
    beforeEach(() => vi.clearAllMocks());

    it('throws ALREADY_EXISTS when customer has a past_due accommodation sub (regression for HOS-1273)', async () => {
        // Before the fix, start-paid.ts gated on isEntitlementGrantingStatus
        // (active | trialing | comp | courtesy) alone, so a moroso host could
        // open a SECOND preapproval on top of the one they already owe. The
        // commerce route already refused this via isLiveSubscriptionStatus
        // (active | trialing | comp | courtesy | past_due) — this test pins
        // that the accommodation route now agrees.
        mockBillingWith(makeBillingMock([{ status: 'past_due' }]));
        const ctx = makeContext();

        const err = await handleStartPaidSubscription(ctx as never, {
            planSlug: PLAN_SLUG,
            billingInterval: 'monthly'
        }).catch((e: unknown) => e);

        expect(err).toBeInstanceOf(ServiceError);
        expect((err as ServiceError).code).toBe(ServiceErrorCode.ALREADY_EXISTS);
        expect((err as ServiceError).reason).toBe('ALREADY_SUBSCRIBED');
    });

    it('provider.subscriptions.create NOT called when the past_due guard fires', async () => {
        const billing = makeBillingMock([{ status: 'past_due' }]);
        mockBillingWith(billing);
        const ctx = makeContext();

        await handleStartPaidSubscription(ctx as never, {
            planSlug: PLAN_SLUG,
            billingInterval: 'annual'
        }).catch(() => undefined);

        expect(billing.subscriptions.create).not.toHaveBeenCalled();
    });

    it('also blocks the annual branch on a past_due accommodation sub (both intervals share the guard)', async () => {
        mockBillingWith(makeBillingMock([{ status: 'past_due' }]));
        const ctx = makeContext();

        const err = await handleStartPaidSubscription(ctx as never, {
            planSlug: PLAN_SLUG,
            billingInterval: 'annual'
        }).catch((e: unknown) => e);

        expect((err as ServiceError).reason).toBe('ALREADY_SUBSCRIBED');
    });

    it('dual-owner: a past_due ACCOMMODATION sub still blocks alongside an active COMMERCE sub (domain isolation intact)', async () => {
        // The host-provider case (host-provider@local.test fixture): a
        // customer with an active commerce subscription AND a past-due
        // accommodation subscription must be blocked on the accommodation
        // reason, never silently let through because of the unrelated
        // commerce row.
        const billing = makeBillingMock([
            { status: 'active', productDomain: 'commerce' } as {
                status: string;
                cancelAtPeriodEnd?: boolean;
                productDomain?: string;
            },
            { status: 'past_due' } // no productDomain -> accommodation fail-open
        ]);
        mockBillingWith(billing);
        const ctx = makeContext();

        const err = await handleStartPaidSubscription(ctx as never, {
            planSlug: PLAN_SLUG,
            billingInterval: 'monthly'
        }).catch((e: unknown) => e);

        expect(err).toBeInstanceOf(ServiceError);
        expect((err as ServiceError).reason).toBe('ALREADY_SUBSCRIBED');
    });

    it('does NOT block on a past_due COMMERCE sub (SPEC-239 isolation — this route is accommodation-only)', async () => {
        const billing = makeBillingMock([
            { status: 'past_due', productDomain: 'gastronomy' } as {
                status: string;
                cancelAtPeriodEnd?: boolean;
                productDomain?: string;
            }
        ]);
        mockBillingWith(billing);
        const ctx = makeContext();

        const err = await handleStartPaidSubscription(ctx as never, {
            planSlug: PLAN_SLUG,
            billingInterval: 'monthly'
        }).catch((e: unknown) => e);

        expect((err as ServiceError).reason ?? '').not.toBe('ALREADY_SUBSCRIBED');
    });
});

// ---------------------------------------------------------------------------
// Tests — SPEC-239 commerce isolation: H2 guard must NOT block on commerce subs
// ---------------------------------------------------------------------------

describe('handleStartPaidSubscription — SPEC-239 commerce isolation in H2 guard', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockHydrationRows.mockResolvedValue([]);
    });

    // HOS-847 — this is a LIVE bug today, not a future add-on concern:
    // getByCustomerId() never returns a `productDomain` field (HOS-934), so
    // every fixture in the rest of this file that sets `productDomain`
    // explicitly was simulating an ALREADY-hydrated object — masking that the
    // real, un-hydrated shape hit the accommodation fail-open unconditionally.
    // This test uses the REAL shape (no productDomain on the fixture) and
    // arms the hydration recovery SELECT instead, proving a customer whose
    // only subscription is gastronomy/experience/partner can start their
    // accommodation plan TODAY.
    it('does NOT block when the customer has ONLY an active gastronomy subscription (real getByCustomerId() shape, HOS-847)', async () => {
        const billing = makeBillingMock([{ id: 'sub-gastro-1', status: 'active' }]);
        mockHydrationRows.mockResolvedValueOnce([
            { id: 'sub-gastro-1', productDomain: 'gastronomy' }
        ]);
        mockBillingWith(billing);
        const ctx = makeContext();

        const err = await handleStartPaidSubscription(ctx as never, {
            planSlug: PLAN_SLUG,
            billingInterval: 'monthly'
        }).catch((e: unknown) => e);

        expect((err as ServiceError).reason ?? '').not.toBe('ALREADY_SUBSCRIBED');
    });

    // HOS-1233 T-041 / AC-15c — §4b filed this read as FIXED: "Tourist counted →
    // host checkout refused ALREADY_SUBSCRIBED" becomes "a tourist can become a
    // host".
    //
    // The pair is required rather than decorative: nothing in this file's CODE
    // changes to achieve the fix — the fix is the T-038 data migration — so a
    // fixture built with the corrected domain would have passed before it too,
    // which §9 names as the way this suite could go green while the bug
    // survived. The first test reproduces the MISFILED shape and asserts the
    // refusal it caused.
    it('MISFILED: a tourist row stored as accommodation blocks the host checkout', async () => {
        const billing = makeBillingMock([{ id: 'sub-tourist-vip', status: 'active' }]);
        // The shape measured in prod and staging before T-038 (spec F-4b).
        mockHydrationRows.mockResolvedValueOnce([
            { id: 'sub-tourist-vip', productDomain: 'accommodation' }
        ]);
        mockBillingWith(billing);
        const ctx = makeContext();

        const err = await handleStartPaidSubscription(ctx as never, {
            planSlug: PLAN_SLUG,
            billingInterval: 'monthly'
        }).catch((e: unknown) => e);

        // A paying tourist is told they already have a host subscription.
        expect((err as ServiceError).reason ?? '').toBe('ALREADY_SUBSCRIBED');
    });

    // HOS-1260 REVERSES the assertion this test used to make.
    //
    // HOS-1233 read the correctly-filed tourist row as "a tourist can become a
    // host" and asserted the checkout goes through. The owner ruled otherwise on
    // 2026-09-09: the second subscription REPLACES the first, because every
    // `owner-*` and `complex-*` plan spreads `TOURIST_VIP_ENTITLEMENTS` and
    // `TOURIST_VIP_LIMITS` whole — so letting the checkout through charges one
    // customer twice for ONE set of 15 entitlements.
    //
    // The outcome HOS-1233 wanted survives, through a different door: a tourist
    // still becomes a host, via `POST /billing/subscriptions/change-plan`, which
    // `selectAccommodationSubscription` (HOS-1233 itself) taught to reach a
    // `tourist-vip` row as its tourist fallback. That route MUTATES the one
    // subscription rather than minting a second, so there is no cancel/charge
    // ordering to get wrong and no window holding two live preapprovals — or
    // none. What this test pins now is that the STACKING door is shut, not that
    // the journey is.
    it('HOS-1260: a correctly-filed tourist row BLOCKS the host checkout and is sent to plan-change', async () => {
        const billing = makeBillingMock([{ id: 'sub-tourist-vip', status: 'active' }]);
        mockHydrationRows.mockResolvedValueOnce([
            { id: 'sub-tourist-vip', productDomain: 'tourist' }
        ]);
        mockBillingWith(billing);
        const ctx = makeContext();

        const err = await handleStartPaidSubscription(ctx as never, {
            planSlug: PLAN_SLUG,
            billingInterval: 'monthly'
        }).catch((e: unknown) => e);

        expect(err).toBeInstanceOf(ServiceError);
        expect((err as ServiceError).code).toBe(ServiceErrorCode.ALREADY_EXISTS);
        expect((err as ServiceError).reason).toBe('ALREADY_SUBSCRIBED');
        // The message must name the remedy that actually exists for this pair.
        expect((err as ServiceError).message).toContain('plan-change');
        expect(billing.subscriptions.create).not.toHaveBeenCalled();
    });

    it('and a REAL accommodation sub still blocks (the fix is not a blanket unblock)', async () => {
        // The sibling that keeps the assertion above honest: widening the gate
        // by accident — or deleting it — would satisfy "not ALREADY_SUBSCRIBED"
        // for every input, including the one it exists to refuse.
        const billing = makeBillingMock([{ id: 'sub-owner-pro', status: 'active' }]);
        mockHydrationRows.mockResolvedValueOnce([
            { id: 'sub-owner-pro', productDomain: 'accommodation' }
        ]);
        mockBillingWith(billing);
        const ctx = makeContext();

        const err = await handleStartPaidSubscription(ctx as never, {
            planSlug: PLAN_SLUG,
            billingInterval: 'monthly'
        }).catch((e: unknown) => e);

        expect((err as ServiceError).reason ?? '').toBe('ALREADY_SUBSCRIBED');
    });

    it('does NOT block when customer has an active COMMERCE sub (product_domain=commerce)', async () => {
        // A customer with an active commerce subscription should be allowed to
        // start a paid ACCOMMODATION subscription. The H2 guard must only look at
        // accommodation-domain subs (isAccommodationSubscription filter).
        const billing = makeBillingMock([
            { status: 'active', productDomain: 'commerce' } as {
                status: string;
                cancelAtPeriodEnd?: boolean;
                productDomain?: string;
            }
        ]);
        mockBillingWith(billing);
        const ctx = makeContext();

        const err = await handleStartPaidSubscription(ctx as never, {
            planSlug: PLAN_SLUG,
            billingInterval: 'monthly'
        }).catch((e: unknown) => e);

        // Must NOT be blocked by H2 — ALREADY_SUBSCRIBED is wrong here
        expect((err as ServiceError).reason ?? '').not.toBe('ALREADY_SUBSCRIBED');
    });

    it('does NOT block when customer has a trialing COMMERCE sub (product_domain=commerce)', async () => {
        const billing = makeBillingMock([
            { status: 'trialing', productDomain: 'commerce' } as {
                status: string;
                cancelAtPeriodEnd?: boolean;
                productDomain?: string;
            }
        ]);
        mockBillingWith(billing);
        const ctx = makeContext();

        const err = await handleStartPaidSubscription(ctx as never, {
            planSlug: PLAN_SLUG,
            billingInterval: 'monthly'
        }).catch((e: unknown) => e);

        expect((err as ServiceError).reason ?? '').not.toBe('ALREADY_SUBSCRIBED');
    });

    it('DOES block when customer has an active ACCOMMODATION sub alongside a commerce sub', async () => {
        // Mixed: one commerce active sub + one accommodation active sub →
        // the accommodation one triggers ALREADY_SUBSCRIBED.
        const billing = makeBillingMock([
            { status: 'active', productDomain: 'commerce' } as {
                status: string;
                cancelAtPeriodEnd?: boolean;
                productDomain?: string;
            },
            { status: 'active' } // no productDomain → treated as accommodation (fail-open)
        ]);
        mockBillingWith(billing);
        const ctx = makeContext();

        const err = await handleStartPaidSubscription(ctx as never, {
            planSlug: PLAN_SLUG,
            billingInterval: 'monthly'
        }).catch((e: unknown) => e);

        expect(err).toBeInstanceOf(ServiceError);
        expect((err as ServiceError).reason).toBe('ALREADY_SUBSCRIBED');
    });

    it('does NOT block soft-cancel guard when only COMMERCE sub has cancelAtPeriodEnd=true', async () => {
        // A commerce sub with cancelAtPeriodEnd=true must not trigger the
        // SUBSCRIPTION_CANCEL_PENDING guard (SPEC-147 T-008 / Q7).
        const billing = makeBillingMock([
            { status: 'active', cancelAtPeriodEnd: true, productDomain: 'commerce' } as {
                status: string;
                cancelAtPeriodEnd?: boolean;
                productDomain?: string;
            }
        ]);
        mockBillingWith(billing);
        const ctx = makeContext();

        const err = await handleStartPaidSubscription(ctx as never, {
            planSlug: PLAN_SLUG,
            billingInterval: 'monthly'
        }).catch((e: unknown) => e);

        expect((err as ServiceError).reason ?? '').not.toBe('SUBSCRIPTION_CANCEL_PENDING');
        expect((err as ServiceError).reason ?? '').not.toBe('ALREADY_SUBSCRIBED');
    });
});

// ---------------------------------------------------------------------------
// Tests — HOS-1260: a live tourist-vip is REPLACED, never stacked.
//
// The owner ruled on 2026-09-09 that a customer already paying `tourist-vip`
// who then buys a host plan must be offered a PLAN CHANGE, not sold a second
// subscription — every `owner-*`/`complex-*` plan and all six commerce tiers
// spread `TOURIST_VIP_ENTITLEMENTS` whole (`plans.config.ts`), so two live rows
// charge one customer twice for one set of 15 entitlements.
//
// Nothing in `start-paid.ts` had regressed in CODE. HOS-1233 gave the tourist
// plans a real `ProductDomainEnum.TOURIST`, which `subscriptionMatchesDomain`
// fails CLOSED on — so `isAccommodationSubscription` stopped seeing a live
// `tourist-vip` and BOTH guards in that handler went blind at once, without a
// line of their own changing. A `grep` for `tourist` over the handler returned
// nothing, which is exactly why it was invisible.
//
// Two directions are exercised throughout, because only the pair is meaningful:
// toward the bug (a live tourist sub must now block) and toward an over-wide fix
// (every OTHER domain, and every non-live status, must still pass).
// ---------------------------------------------------------------------------

describe('handleStartPaidSubscription — HOS-1260 tourist-vip is replaced, not stacked', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockHydrationRows.mockResolvedValue([]);
    });

    /**
     * Builds the REAL `getByCustomerId()` shape — no `productDomain` on the
     * fixture — and arms the hydration SELECT that recovers it, so each test
     * exercises `hydrateSubscriptionProductDomains` rather than assuming it. A
     * fixture carrying `productDomain` inline would be an already-hydrated
     * object, the shape HOS-847 documented as masking this class of bug.
     */
    function armHydratedSubs(
        subs: {
            id: string;
            status: string;
            productDomain: string | null;
            cancelAtPeriodEnd?: boolean;
            providerSubscriptionIds?: Record<string, string>;
        }[]
    ) {
        const billing = makeBillingMock(
            subs.map(({ id, status, cancelAtPeriodEnd, providerSubscriptionIds }) => ({
                id,
                status,
                cancelAtPeriodEnd,
                providerSubscriptionIds
            }))
        );
        mockHydrationRows.mockResolvedValueOnce(
            subs.map(({ id, productDomain }) => ({ id, productDomain }))
        );
        mockBillingWith(billing);
        return billing;
    }

    // ── Toward the bug: every live status on a tourist sub must block ────────
    //
    // The list is the whole of `LIVE_SUBSCRIPTION_STATUSES`
    // (`packages/billing/src/predicates/is-live-subscription-status.ts:58` —
    // `ENTITLEMENT_GRANTING_STATUSES` plus `past_due`), not a sample of it. A
    // subset would leave whichever member it omitted as the one status through
    // which the stacking hole survives.

    // HOS-1335: `trialing` carries a preapproval here on purpose. A tourist-vip
    // trial WITH a live MercadoPago preapproval is the duplicate this guard
    // exists to refuse; a preapproval-less one is a Hospeda trial and is exempt
    // (covered, both directions, in `start-paid-trial-conversion.test.ts`).
    // Every other status in the set blocks regardless of a preapproval — `comp`
    // in particular never has one.
    for (const status of ['active', 'trialing', 'comp', 'courtesy', 'past_due'] as const) {
        it(`blocks the host checkout on a ${status} tourist-vip subscription`, async () => {
            const billing = armHydratedSubs([
                {
                    id: 'sub-vip',
                    status,
                    productDomain: 'tourist',
                    ...(status === 'trialing'
                        ? { providerSubscriptionIds: { mercadopago: 'mp-live-vip' } }
                        : {})
                }
            ]);
            const ctx = makeContext();

            const err = await handleStartPaidSubscription(ctx as never, {
                planSlug: PLAN_SLUG,
                billingInterval: 'monthly'
            }).catch((e: unknown) => e);

            expect(err).toBeInstanceOf(ServiceError);
            expect((err as ServiceError).code).toBe(ServiceErrorCode.ALREADY_EXISTS);
            expect((err as ServiceError).reason).toBe('ALREADY_SUBSCRIBED');
            // The money assertion: no preapproval is ever opened. A guard that
            // threw only AFTER calling the provider would leave the second
            // charge live and still satisfy the assertions above.
            expect(billing.subscriptions.create).not.toHaveBeenCalled();
        });
    }

    it('blocks the ANNUAL branch too — both intervals share the guard', async () => {
        const billing = armHydratedSubs([
            { id: 'sub-vip', status: 'active', productDomain: 'tourist' }
        ]);
        const ctx = makeContext();

        const err = await handleStartPaidSubscription(ctx as never, {
            planSlug: PLAN_SLUG,
            billingInterval: 'annual'
        }).catch((e: unknown) => e);

        expect((err as ServiceError).reason).toBe('ALREADY_SUBSCRIBED');
        expect(billing.subscriptions.create).not.toHaveBeenCalled();
    });

    it('blocks re-buying tourist-vip ON TOP of a live tourist-vip (same-domain stacking)', async () => {
        // The other half of what HOS-1233 opened, and the half the issue does not
        // mention: with the guard accommodation-only, a tourist-vip holder could
        // stack a SECOND tourist-vip preapproval on themselves. The guard runs
        // before the plan is ever resolved, so it covers this by construction —
        // asserted rather than assumed.
        const billing = armHydratedSubs([
            { id: 'sub-vip', status: 'active', productDomain: 'tourist' }
        ]);
        const ctx = makeContext();

        const err = await handleStartPaidSubscription(ctx as never, {
            planSlug: 'tourist-vip',
            billingInterval: 'monthly'
        }).catch((e: unknown) => e);

        expect((err as ServiceError).reason).toBe('ALREADY_SUBSCRIBED');
        expect(billing.subscriptions.create).not.toHaveBeenCalled();
    });

    it('a SOFT-CANCELLED tourist-vip hits the cancel-pending guard, not a second preapproval', async () => {
        // The second guard, widened for the same reason as the first. A
        // soft-cancelled `tourist-vip` is a LIVE preapproval until
        // `currentPeriodEnd`: fixing only the guard above would have left this
        // one minting the duplicate it refuses twenty lines higher — the repo's
        // own recurring shape of a correct gate beside a still-broken twin.
        const billing = armHydratedSubs([
            {
                id: 'sub-vip',
                status: 'active',
                cancelAtPeriodEnd: true,
                productDomain: 'tourist'
            }
        ]);
        const ctx = makeContext();

        const err = await handleStartPaidSubscription(ctx as never, {
            planSlug: PLAN_SLUG,
            billingInterval: 'monthly'
        }).catch((e: unknown) => e);

        expect((err as ServiceError).reason).toBe('SUBSCRIPTION_CANCEL_PENDING');
        expect(billing.subscriptions.create).not.toHaveBeenCalled();
    });

    // ── Toward an over-wide fix: the other four domains must still pass ──────
    //
    // `start-paid` sells ACCOMMODATION and TOURIST only
    // (`assertAccommodationOrTouristPlanDomain`, HOS-1271). Every other domain a
    // customer can legitimately hold at the same time must stay invisible to
    // this guard, or a restaurant owner loses the ability to buy a host plan.

    for (const productDomain of ['gastronomy', 'experience', 'partner', 'addon'] as const) {
        it(`does NOT block when the customer's only live sub is ${productDomain}`, async () => {
            armHydratedSubs([{ id: `sub-${productDomain}`, status: 'active', productDomain }]);
            const ctx = makeContext();

            const err = await handleStartPaidSubscription(ctx as never, {
                planSlug: PLAN_SLUG,
                billingInterval: 'monthly'
            }).catch((e: unknown) => e);

            expect((err as ServiceError).reason ?? '').not.toBe('ALREADY_SUBSCRIBED');
            expect((err as ServiceError).reason ?? '').not.toBe('SUBSCRIPTION_CANCEL_PENDING');
        });
    }

    it('does NOT block a gastronomy owner whose tourist sub is CANCELLED', async () => {
        // Status and domain are independent axes: widening the domain set must
        // not widen the status set. `cancelled` was never live and still is not.
        armHydratedSubs([
            { id: 'sub-gastro', status: 'active', productDomain: 'gastronomy' },
            { id: 'sub-vip', status: 'cancelled', productDomain: 'tourist' }
        ]);
        const ctx = makeContext();

        const err = await handleStartPaidSubscription(ctx as never, {
            planSlug: PLAN_SLUG,
            billingInterval: 'monthly'
        }).catch((e: unknown) => e);

        expect((err as ServiceError).reason ?? '').not.toBe('ALREADY_SUBSCRIBED');
    });

    it('does NOT block on a PAUSED tourist sub — a pause already cuts access', async () => {
        armHydratedSubs([{ id: 'sub-vip', status: 'paused', productDomain: 'tourist' }]);
        const ctx = makeContext();

        const err = await handleStartPaidSubscription(ctx as never, {
            planSlug: PLAN_SLUG,
            billingInterval: 'monthly'
        }).catch((e: unknown) => e);

        expect((err as ServiceError).reason ?? '').not.toBe('ALREADY_SUBSCRIBED');
    });

    // ── The dual-role owner, and the symmetry that already worked ────────────

    it('dual owner (host-provider@local.test): a live gastronomy sub does not hide the tourist one', async () => {
        // The fixture the repo seeds for exactly this shape. The gastronomy row
        // must not block, the tourist row must — and the tourist row must be
        // found even though it is SECOND in the list, so the guard cannot be
        // satisfied by whichever row the storage adapter happens to return first.
        const billing = armHydratedSubs([
            { id: 'sub-gastro', status: 'active', productDomain: 'gastronomy' },
            { id: 'sub-vip', status: 'active', productDomain: 'tourist' }
        ]);
        const ctx = makeContext();

        const err = await handleStartPaidSubscription(ctx as never, {
            planSlug: PLAN_SLUG,
            billingInterval: 'monthly'
        }).catch((e: unknown) => e);

        expect((err as ServiceError).reason).toBe('ALREADY_SUBSCRIBED');
        expect(billing.subscriptions.create).not.toHaveBeenCalled();
    });

    it('SYMMETRY PRESERVED: a host buying tourist-vip still gets ALREADY_SUBSCRIBED', async () => {
        // The direction that has always worked, and the one HOS-1260 exists to
        // mirror. If widening the guard broke this, the fix destroyed something
        // that was already correct.
        const billing = armHydratedSubs([
            { id: 'sub-owner', status: 'active', productDomain: 'accommodation' }
        ]);
        const ctx = makeContext();

        const err = await handleStartPaidSubscription(ctx as never, {
            planSlug: 'tourist-vip',
            billingInterval: 'monthly'
        }).catch((e: unknown) => e);

        expect((err as ServiceError).reason).toBe('ALREADY_SUBSCRIBED');
        expect(billing.subscriptions.create).not.toHaveBeenCalled();
    });

    it('a LEGACY row with a NULL product_domain still blocks (accommodation fails OPEN)', async () => {
        // The asymmetry `subscriptionMatchesDomain` documents must survive the
        // widening: a row predating the column counts as accommodation, so it
        // keeps blocking. Reading it as "unknown, therefore let through" would
        // un-guard every pre-column subscription in production.
        armHydratedSubs([{ id: 'sub-legacy', status: 'active', productDomain: null }]);
        const ctx = makeContext();

        const err = await handleStartPaidSubscription(ctx as never, {
            planSlug: PLAN_SLUG,
            billingInterval: 'monthly'
        }).catch((e: unknown) => e);

        expect((err as ServiceError).reason).toBe('ALREADY_SUBSCRIBED');
    });
});
