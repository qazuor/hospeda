/**
 * HOS-1335 — a host (or commerce owner) still inside their Hospeda-owned trial
 * must be able to START PAYING before the trial lapses.
 *
 * ## What was broken
 *
 * Since HOS-1012 the free trial is a LOCAL `billing_subscriptions` row:
 * `status='trialing'`, `mp_subscription_id = NULL`, minted at the first publish.
 * MercadoPago is never told it exists, so nothing charges when it ends.
 *
 * `start-paid.ts`'s already-subscribed guard reads `isLiveSubscriptionStatus`,
 * and `trialing` is a member of `LIVE_SUBSCRIPTION_STATUSES` — correctly so, for
 * entitlements and dunning. The guard therefore answered
 * `409 ALREADY_SUBSCRIBED` ("you already have an active subscription, use the
 * plan-change endpoint") to the one gesture that could turn that trial into
 * revenue, and the endpoint it named could not serve them either (HOS-1236).
 *
 * The predicate was never wrong; what changed is what sits on the other side of
 * it. A trial WITH a preapproval is a live MercadoPago object and must keep
 * blocking — starting a second checkout over it is a double charge. A trial
 * WITHOUT one is Hospeda's alone, and a first paid checkout is an ALTA, not a
 * duplicate.
 *
 * ## Both directions are asserted, always
 *
 * Every "now allowed" case here is paired with the legacy card-first shape
 * (`trialing` + a live `providerSubscriptionIds.mercadopago`) that must STILL be
 * refused. An exemption written without that pair reads identically to having
 * deleted the guard.
 *
 * @module test/routes/billing/start-paid-trial-conversion
 */

import { TEST_DAILY_PLAN } from '@repo/billing';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks — mirrors start-paid-already-subscribed.test.ts exactly, so the
// two files exercise the handler through the same seam.
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

// Passthrough, and load-bearing: without it the handler and this file resolve
// `@repo/service-core` through two different module instances, so the thrown
// error is a `ServiceError` whose `reason` this file reads as `undefined` —
// every "must still block" assertion then goes green against `''` while the
// guard is firing perfectly. Same shape as the sibling suite.
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
    mockHydrationRows: vi.fn().mockResolvedValue([])
}));

// The checkout itself is stubbed so an exempted request has an OBSERVABLE
// success to assert. Without it the only available assertion is "the error was
// not ALREADY_SUBSCRIBED", which any unrelated downstream failure satisfies —
// so a future gate added upstream could reinstate the HOS-1335 bug with every
// test in this file still green. `importOriginal` keeps
// `SubscriptionCheckoutError` real, or the handler's `instanceof` in the catch
// chain would silently never match.
const { mockInitiateMonthly, mockInitiateAnnual } = vi.hoisted(() => ({
    mockInitiateMonthly: vi.fn(),
    mockInitiateAnnual: vi.fn()
}));
vi.mock('../../../src/services/subscription-checkout.service', async (importOriginal) => {
    const actual =
        await importOriginal<
            typeof import('../../../src/services/subscription-checkout.service')
        >();
    return {
        ...actual,
        initiatePaidMonthlySubscription: mockInitiateMonthly,
        initiatePaidAnnualSubscription: mockInitiateAnnual
    };
});

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

const CUSTOMER_ID = 'cust_hos1335';
const PLAN_SLUG = 'owner-basico';

/** A trialing row that MercadoPago knows nothing about — the HOS-1012 shape. */
const LOCAL_TRIAL = { id: 'sub-local-trial', status: 'trialing' } as const;

/**
 * The pre-HOS-1012 card-first shape: a trial whose preapproval is live at
 * MercadoPago and will charge on its own at trial end. Still a duplicate.
 */
const CARD_FIRST_TRIAL = {
    id: 'sub-cardfirst-trial',
    status: 'trialing',
    providerSubscriptionIds: { mercadopago: 'mp-preapproval-live-1' }
} as const;

interface SubFixture {
    readonly id: string;
    readonly status: string;
    readonly cancelAtPeriodEnd?: boolean;
    readonly providerSubscriptionIds?: Record<string, string>;
}

function makeContext() {
    const store = new Map<string, unknown>([
        ['billingEnabled', true],
        ['billingCustomerId', CUSTOMER_ID]
    ]);
    return {
        get: vi.fn((k: string) => store.get(k)),
        var: { user: null }
    };
}

function makeBillingMock(existingSubs: readonly SubFixture[]) {
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
            getByCustomerId: vi.fn().mockResolvedValue([...existingSubs]),
            create: vi.fn()
        },
        plans: { listAll: vi.fn().mockResolvedValue([plan]) }
    };
}

/**
 * Arms the REAL `getByCustomerId()` shape — no `productDomain` on the fixture —
 * plus the hydration SELECT that recovers it, so every case exercises
 * `hydrateSubscriptionProductDomains` rather than assuming an already-hydrated
 * object (the shape HOS-847 documented as masking this whole class of bug).
 */
function armSubs(subs: readonly (SubFixture & { productDomain: string | null })[]) {
    const billing = makeBillingMock(
        subs.map(({ productDomain: _drop, ...rest }) => rest as SubFixture)
    );
    mockHydrationRows.mockResolvedValueOnce(
        subs.map(({ id, productDomain }) => ({ id, productDomain }))
    );
    vi.mocked(getQZPayBilling).mockReturnValue(
        billing as unknown as ReturnType<typeof getQZPayBilling>
    );
    return billing;
}

/** Runs the handler and returns its result, or whatever it threw. */
async function callStartPaid(
    billingInterval: 'monthly' | 'annual' = 'monthly',
    planSlug: string = PLAN_SLUG
): Promise<unknown> {
    const ctx = makeContext();
    return await handleStartPaidSubscription(ctx as never, { planSlug, billingInterval }).catch(
        (e: unknown) => e
    );
}

/** The `reason` a thrown `ServiceError` carries, or `''`. */
const reasonOf = (err: unknown): string =>
    err instanceof ServiceError ? (err.reason ?? '') : ((err as { reason?: string })?.reason ?? '');

/** What the stubbed checkout hands back when the guards let a request through. */
const CHECKOUT_RESULT = {
    checkoutUrl: 'https://mp.test/checkout/abc',
    localSubscriptionId: 'sub-new-paid',
    expiresAt: '2026-09-10T12:00:00.000Z',
    payerEmail: 'test@test.com'
} as const;

/**
 * The POSITIVE assertion, and the one the negative form cannot make.
 *
 * `expect(reason).not.toBe('ALREADY_SUBSCRIBED')` is satisfied by ANY other
 * failure — a gate added upstream tomorrow, a downstream throw, a typo in a
 * fixture. Every one of those would reinstate HOS-1335 (the host still cannot
 * pay) while leaving the suite green. So an exempted request must be shown to
 * reach the checkout and come back with its URL.
 *
 * HOS-1335 + HOS-1322: reaching the checkout is no longer enough on its own —
 * the duplicate guard inside `createPaidSubscription` /
 * `createPendingProviderSubscription` scans again and refuses the conversion
 * unless the route NAMED the exempted trial in `supersedesSubscriptionIds`. A
 * route that forgets to pass them would still satisfy every assertion above,
 * because this suite stubs the checkout service. So the stub's INPUT is
 * asserted too: the exempted row's id must travel. Every caller of this helper
 * arms exactly one accommodation LOCAL_TRIAL, which is what makes the
 * expectation uniform.
 *
 * @param result - Whatever `callStartPaid` returned.
 * @param interval - Which branch was expected to run.
 */
function expectCheckoutProceeded(
    result: unknown,
    interval: 'monthly' | 'annual' = 'monthly'
): void {
    // Surfaces the real error in the failure message instead of a bare
    // "expected undefined to be defined" when a guard does refuse.
    if (result instanceof Error) {
        throw new Error(
            `expected the checkout to proceed, but it threw: ${result.name}: ${result.message}`
        );
    }
    expect(result).toMatchObject({ checkoutUrl: CHECKOUT_RESULT.checkoutUrl });
    const called = interval === 'annual' ? mockInitiateAnnual : mockInitiateMonthly;
    expect(called).toHaveBeenCalledTimes(1);
    expect(called).toHaveBeenCalledWith(
        expect.objectContaining({ supersedesSubscriptionIds: [LOCAL_TRIAL.id] })
    );
    expect(interval === 'annual' ? mockInitiateMonthly : mockInitiateAnnual).not.toHaveBeenCalled();
}

// ---------------------------------------------------------------------------
// The bug — a local trial must not read as a duplicate
// ---------------------------------------------------------------------------

describe('handleStartPaidSubscription — HOS-1335 a local trial can convert to paid', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockHydrationRows.mockResolvedValue([]);
        mockInitiateMonthly.mockResolvedValue(CHECKOUT_RESULT);
        mockInitiateAnnual.mockResolvedValue(CHECKOUT_RESULT);
    });

    it('ACCOMMODATION: a trial with NO preapproval REACHES the checkout', async () => {
        armSubs([{ ...LOCAL_TRIAL, productDomain: 'accommodation' }]);

        expectCheckoutProceeded(await callStartPaid());
    });

    it('ACCOMMODATION: a LEGACY trial that DOES carry a preapproval still blocks', async () => {
        // The pair that keeps the assertion above honest. This row has a live
        // MercadoPago preapproval which will charge at trial end; a second
        // checkout on top of it is the double charge the guard exists to stop.
        const billing = armSubs([{ ...CARD_FIRST_TRIAL, productDomain: 'accommodation' }]);

        const err = await callStartPaid();

        expect(err).toBeInstanceOf(ServiceError);
        expect((err as ServiceError).code).toBe(ServiceErrorCode.ALREADY_EXISTS);
        expect(reasonOf(err)).toBe('ALREADY_SUBSCRIBED');
        expect(billing.subscriptions.create).not.toHaveBeenCalled();
    });

    it('a LEGACY row with a NULL product_domain and a preapproval still blocks (fail-open intact)', async () => {
        // Domain and preapproval are independent axes. Exempting on the trial
        // shape must not also un-guard the pre-column rows that read as
        // accommodation by fail-open.
        armSubs([{ ...CARD_FIRST_TRIAL, productDomain: null }]);

        expect(reasonOf(await callStartPaid())).toBe('ALREADY_SUBSCRIBED');
    });

    it('CROSS-DOMAIN: a TOURIST trial does NOT exempt an accommodation purchase', async () => {
        // The exemption is only sound when the purchase's activation will sweep
        // the trial it exempted, and `supersedeLocalTrialsOnActivation` sweeps
        // the ACTIVATED row's domain with an exact comparison. An accommodation
        // purchase never reaches a tourist-domain trial, so exempting one here
        // would leave two granting rows for the rest of the trial — the precise
        // state that module exists to make impossible.
        //
        // Unreachable in production (`ALL_TRIAL_PLANS` has no tourist entry, so
        // no tourist-domain trial row can be minted), which is why the assertion
        // is about the RULE rather than about a live scenario.
        armSubs([{ ...LOCAL_TRIAL, productDomain: 'tourist' }]);

        expect(reasonOf(await callStartPaid())).toBe('ALREADY_SUBSCRIBED');
        expect(mockInitiateMonthly).not.toHaveBeenCalled();
    });

    it('CROSS-DOMAIN, inverted: an ACCOMMODATION trial does NOT exempt a tourist purchase', async () => {
        // The direction the reviewer found, and the one that was live in the
        // first cut: `isSubscriptionInASellableDomain` is accommodation OR
        // tourist, so an accommodation trial used to be exempted for a
        // `tourist-vip` checkout — whose activation then swept domain `tourist`
        // and left the accommodation trial granting for ~30 days.
        armSubs([{ ...LOCAL_TRIAL, productDomain: 'accommodation' }]);

        expect(reasonOf(await callStartPaid('monthly', 'tourist-vip'))).toBe('ALREADY_SUBSCRIBED');
        expect(mockInitiateMonthly).not.toHaveBeenCalled();
    });

    it('an UNKNOWN plan slug exempts nothing — the guard falls back to pre-HOS-1335 behaviour', async () => {
        // Fail closed: with no declared domain to compare against there is no
        // way to know the activation would sweep this trial, so the safe answer
        // is the refusal that predates the exemption.
        armSubs([{ ...LOCAL_TRIAL, productDomain: 'accommodation' }]);

        expect(reasonOf(await callStartPaid('monthly', 'owner-basicoo'))).toBe(
            'ALREADY_SUBSCRIBED'
        );
    });

    it('TOURIST: a live tourist-vip WITH a preapproval still blocks (HOS-1260 unbroken)', async () => {
        armSubs([{ ...CARD_FIRST_TRIAL, productDomain: 'tourist' }]);

        expect(reasonOf(await callStartPaid())).toBe('ALREADY_SUBSCRIBED');
    });

    it('the ANNUAL branch is exempted too and REACHES the annual checkout', async () => {
        armSubs([{ ...LOCAL_TRIAL, productDomain: 'accommodation' }]);

        expectCheckoutProceeded(await callStartPaid('annual'), 'annual');
    });

    it('the hidden daily QA plan is convertible too (it is outside ALL_PLANS by design)', async () => {
        // `TEST_DAILY_PLAN` is kept out of `ALL_PLANS` to hide it from the public
        // catalogue, so a catalogue-only domain lookup would make it the ONE plan
        // a trialing host could not convert onto — silently, and only in QA.
        armSubs([{ ...LOCAL_TRIAL, productDomain: 'accommodation' }]);

        expectCheckoutProceeded(await callStartPaid('monthly', TEST_DAILY_PLAN.slug));
    });

    it('the exemption is the TRIAL shape, not a blanket unblock: active without a preapproval still blocks', async () => {
        // The narrowest possible over-widening, and the one a status-blind
        // implementation would produce: an `active` row whose preapproval id is
        // missing is a broken paid subscription, NOT a Hospeda-owned trial, and
        // selling a second one over it is exactly the stacking this guard exists
        // to refuse.
        armSubs([{ id: 'sub-active-noid', status: 'active', productDomain: 'accommodation' }]);

        expect(reasonOf(await callStartPaid())).toBe('ALREADY_SUBSCRIBED');
    });

    it('a past_due row without a preapproval still blocks (HOS-1273 unbroken)', async () => {
        armSubs([{ id: 'sub-pastdue', status: 'past_due', productDomain: 'accommodation' }]);

        expect(reasonOf(await callStartPaid())).toBe('ALREADY_SUBSCRIBED');
    });

    it('a comp row without a preapproval still blocks (comp rows never carry one)', async () => {
        // `createCompSubscription` inserts with `mp_subscription_id = NULL` by
        // design, so `comp` is the status where a preapproval-blind exemption
        // would hand a complimentary customer a second, CHARGED subscription —
        // the HOS-702 failure, re-opened.
        armSubs([{ id: 'sub-comp', status: 'comp', productDomain: 'accommodation' }]);

        expect(reasonOf(await callStartPaid())).toBe('ALREADY_SUBSCRIBED');
    });
});

// ---------------------------------------------------------------------------
// The SECOND guard, twenty lines down — the repo's own recurring failure shape
// ---------------------------------------------------------------------------

describe('handleStartPaidSubscription — HOS-1335 the soft-cancel guard is exempted too', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockHydrationRows.mockResolvedValue([]);
        mockInitiateMonthly.mockResolvedValue(CHECKOUT_RESULT);
        mockInitiateAnnual.mockResolvedValue(CHECKOUT_RESULT);
    });

    it('a SOFT-CANCELLED local trial REACHES the checkout', async () => {
        // `SUBSCRIPTION_CANCEL_PENDING` tells the caller to un-cancel instead of
        // starting over, and its stated reason is that a second checkout would
        // mint a duplicate LIVE preapproval. A preapproval-less trial has none,
        // so neither the reason nor the remedy applies: un-cancelling restores a
        // trial that still cannot charge anything.
        armSubs([{ ...LOCAL_TRIAL, cancelAtPeriodEnd: true, productDomain: 'accommodation' }]);

        expectCheckoutProceeded(await callStartPaid());
    });

    it('a SOFT-CANCELLED trial WITH a preapproval still hits SUBSCRIPTION_CANCEL_PENDING', async () => {
        const billing = armSubs([
            { ...CARD_FIRST_TRIAL, cancelAtPeriodEnd: true, productDomain: 'accommodation' }
        ]);

        expect(reasonOf(await callStartPaid())).toBe('SUBSCRIPTION_CANCEL_PENDING');
        expect(billing.subscriptions.create).not.toHaveBeenCalled();
    });

    it('a SOFT-CANCELLED ACTIVE sub still hits SUBSCRIPTION_CANCEL_PENDING (SPEC-147 unbroken)', async () => {
        armSubs([
            {
                id: 'sub-active-soft',
                status: 'active',
                cancelAtPeriodEnd: true,
                providerSubscriptionIds: { mercadopago: 'mp-live-2' },
                productDomain: 'accommodation'
            }
        ]);

        expect(reasonOf(await callStartPaid())).toBe('SUBSCRIPTION_CANCEL_PENDING');
    });
});

// ---------------------------------------------------------------------------
// The three publishing verticals, and the dual-role owner
// ---------------------------------------------------------------------------

describe('handleStartPaidSubscription — HOS-1335 domain isolation survives the exemption', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockHydrationRows.mockResolvedValue([]);
    });

    // `/start-paid` sells ACCOMMODATION and TOURIST only
    // (`assertAccommodationOrTouristPlanDomain`). A gastronomy or experience
    // trial was already invisible to this guard by fail-closed domain matching,
    // and must stay invisible — the exemption must not become the reason it
    // passes, or the two mechanisms can never be told apart when one breaks.
    for (const productDomain of ['gastronomy', 'experience'] as const) {
        it(`a ${productDomain} trial does not block the accommodation checkout`, async () => {
            armSubs([{ ...LOCAL_TRIAL, id: `sub-${productDomain}`, productDomain }]);

            expect(reasonOf(await callStartPaid())).not.toBe('ALREADY_SUBSCRIBED');
        });

        it(`a ${productDomain} trial WITH a preapproval also does not block it`, async () => {
            armSubs([{ ...CARD_FIRST_TRIAL, id: `sub-${productDomain}-mp`, productDomain }]);

            expect(reasonOf(await callStartPaid())).not.toBe('ALREADY_SUBSCRIBED');
        });
    }

    it('dual owner (host-provider@local.test): a gastronomy sub does not hide an accommodation trial WITH a preapproval', async () => {
        // The seeded dual-role shape. The accommodation row is SECOND in the
        // list, so a `.find()` that stops at the first row — or a `WHERE
        // customerId` with no domain predicate — picks the wrong one and lets a
        // genuine duplicate through.
        const billing = armSubs([
            { id: 'sub-gastro', status: 'active', productDomain: 'gastronomy' },
            { ...CARD_FIRST_TRIAL, productDomain: 'accommodation' }
        ]);

        expect(reasonOf(await callStartPaid())).toBe('ALREADY_SUBSCRIBED');
        expect(billing.subscriptions.create).not.toHaveBeenCalled();
    });

    it('dual owner: a gastronomy sub alongside a LOCAL accommodation trial lets the checkout through', async () => {
        armSubs([
            { id: 'sub-gastro', status: 'active', productDomain: 'gastronomy' },
            { ...LOCAL_TRIAL, productDomain: 'accommodation' }
        ]);

        expect(reasonOf(await callStartPaid())).not.toBe('ALREADY_SUBSCRIBED');
    });

    it('a LOCAL accommodation trial next to a live ACCOMMODATION paid sub still blocks', async () => {
        // Order-independence in the other direction: the exempt row must not
        // satisfy `.some()` early and hide the row that should refuse.
        armSubs([
            { ...LOCAL_TRIAL, productDomain: 'accommodation' },
            {
                id: 'sub-owner-paid',
                status: 'active',
                providerSubscriptionIds: { mercadopago: 'mp-live-3' },
                productDomain: 'accommodation'
            }
        ]);

        expect(reasonOf(await callStartPaid())).toBe('ALREADY_SUBSCRIBED');
    });
});
