/**
 * The content-editing subscription gate, END TO END, in all three verticals
 * (HOS-1275).
 *
 * ---
 * ## Why this file exists next to a unit test that already covers the predicate
 *
 * `test/services/billing/edit-eligibility.service.test.ts` proves
 * `resolveEditEligibility` returns the right verdict. It cannot prove the
 * verdict reaches the wire — and that is precisely the failure this issue was
 * opened for: PR #3299 mounted `requireEntitlement(EDIT_*)` on sixteen routes,
 * its tests were green, and the gate refused nobody because the key it demanded
 * was a floor key. A predicate that is never consulted looks identical to one
 * that always says yes.
 *
 * So everything below goes through `app.request()`, exactly as a browser would:
 * the route factory, auth, `billingCustomerMiddleware`, `entitlementMiddleware`,
 * `commerceVerticalEntitlementMiddleware`, `requireEntitlement`, and only then
 * `requireLiveSubscription`.
 *
 * ## The witness
 *
 * `expect(res.status).toBe(402)` alone is not enough — a request that dies
 * anywhere earlier also fails to reach the handler. Every refusal here asserts
 * three things: the status, the `NO_ACTIVE_SUBSCRIPTION` reason (which
 * distinguishes this gate from `trialMiddleware`'s `TRIAL_EXPIRED` and
 * `pastDueGraceMiddleware`'s `GRACE_PERIOD_EXPIRED`, both of which also answer
 * 402 on this path), and that the route's own service call — strictly after the
 * gate — never happened.
 *
 * ## What is stubbed and what stays real
 *
 * Only the provider seam (`getQZPayBilling`) and the two DB-backed lookups this
 * suite's global `@repo/db` mock cannot serve: the host-draft plan and the
 * `productDomain` hydration. `subscriptionMatchesDomain` and
 * `isLiveSubscriptionStatus` stay real — they are the predicates under test.
 *
 * @module test/commerce/hos-1275-live-subscription-gate.e2e
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    addGastronomyFaq: vi.fn(),
    removeGastronomyFaq: vi.fn(),
    addExperienceFaq: vi.fn(),
    hydrate: vi.fn()
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        addGastronomyFaq: mocks.addGastronomyFaq,
        removeGastronomyFaq: mocks.removeGastronomyFaq,
        addExperienceFaq: mocks.addExperienceFaq,
        hydrateSubscriptionProductDomains: mocks.hydrate
    };
});

/**
 * The customer's subscription rows for the request under test, in the
 * `getByCustomerId()` shape — i.e. WITHOUT `productDomain`, which that call
 * never populates (HOS-934). `mocks.hydrate` stamps the real column value on
 * afterwards, keyed by id, mirroring the batched recovery SELECT.
 */
let fakeSubscriptions: Array<{
    id: string;
    status: string;
    planId: string;
    currentPeriodEnd?: Date;
}> = [];
let fakeDomains: Record<string, string | null> = {};

vi.mock('../../src/middlewares/billing.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../src/middlewares/billing.js')>();
    // Defined INLINE: `vi.mock` factories hoist above every top-level
    // declaration, so referencing a module-scope const here would hit the
    // temporal dead zone. The `fake*` reads are safe because they happen inside
    // nested closures that run only once a request reaches the route.
    const fakeBillingMiddleware: import('hono').MiddlewareHandler = async (c, next) => {
        c.set('billingEnabled', true);
        await next();
    };
    return {
        ...actual,
        billingMiddleware: fakeBillingMiddleware,
        getQZPayBilling: () => ({
            customers: { getByExternalId: async () => ({ id: CUSTOMER_ID }) },
            subscriptions: { getByCustomerId: async () => fakeSubscriptions },
            // Any plan row resolves to one granting every EDIT_* key, so
            // `requireEntitlement` is never what refuses in this file — a 403
            // here would mean the test stopped exercising the gate it names.
            plans: {
                get: async () => ({
                    id: 'plan-1',
                    entitlements: [
                        'edit_accommodation_info',
                        'edit_gastronomy_info',
                        'edit_experience_info'
                    ],
                    limits: {}
                })
            },
            limits: { getByCustomerId: async () => [] }
        })
    };
});

const { initApp } = await import('../../src/app.js');
const { _resetCommerceBaseLimitCache } = await import(
    '../../src/middlewares/commerce-entitlement.js'
);
const { clearEntitlementCache, clearHostDraftDefaultsCache } = await import(
    '../../src/middlewares/entitlement.js'
);
const { PlanService } = await import('../../src/services/plan.service.js');
const { AccommodationService } = await import('@repo/service-core');
const { OWNER_BASICO_PLAN } = await import('@repo/billing');
const { ProductDomainEnum, SubscriptionStatusEnum } = await import('@repo/schemas');
type AppOpenAPI = import('../../src/types.js').AppOpenAPI;

const CUSTOMER_ID = 'cus-hos-1275';
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const STAFF_ID = '44444444-4444-4444-8444-444444444444';
const LISTING_ID = '22222222-2222-4222-8222-222222222222';
const FAQ_ID = '33333333-3333-4333-8333-333333333333';

const USER_AGENT = { 'user-agent': 'vitest', 'content-type': 'application/json' };

/** A host / commerce owner: no staff role, so no bypass. */
const ownerHeaders = {
    ...USER_AGENT,
    'x-mock-actor-id': OWNER_ID,
    'x-mock-actor-role': 'HOST',
    'x-mock-actor-permissions': JSON.stringify([
        'accommodation.update.own',
        'commerce.create',
        'commerce.editOwn'
    ])
};

/** Platform staff, who must pass even on a lapsed customer. */
const staffHeaders = {
    ...USER_AGENT,
    'x-mock-actor-id': STAFF_ID,
    'x-mock-actor-role': 'ADMIN',
    'x-mock-actor-permissions': JSON.stringify(['accommodation.update.any', 'commerce.editAll'])
};

const FAQ_BODY = JSON.stringify({
    question: 'A valid FAQ question?',
    answer: 'A valid FAQ answer text.'
});

const SUCCESS_RESULT = { data: {}, error: undefined } as never;

/**
 * Sets the customer's subscription state for the next request.
 *
 * @param rows - `[id, status, real productDomain, currentPeriodEnd?,
 *   cancelAtPeriodEnd?]` tuples. The domain is applied by the hydration mock,
 *   never injected into the row itself.
 *
 *   `cancelAtPeriodEnd` matters only for `cancelled` rows, and there it decides
 *   the answer (HOS-1310): `isSubscriptionLive` requires it, because
 *   `currentPeriodEnd` is stamped by qzpay at INSERT before any payment and so
 *   cannot tell a paid-through owner from a checkout nobody completed.
 */
function given(
    rows: ReadonlyArray<
        readonly [string, string, string | null, (Date | undefined)?, (boolean | undefined)?]
    >
): void {
    fakeSubscriptions = rows.map(([id, status, , currentPeriodEnd, cancelAtPeriodEnd]) => ({
        id,
        status,
        planId: 'plan-1',
        ...(currentPeriodEnd === undefined ? {} : { currentPeriodEnd }),
        ...(cancelAtPeriodEnd === undefined ? {} : { cancelAtPeriodEnd })
    }));
    fakeDomains = Object.fromEntries(rows.map(([id, , domain]) => [id, domain]));
    clearEntitlementCache(CUSTOMER_ID);
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
/** A period end still in the future: the owner has paid through it. */
const future = () => new Date(Date.now() + THIRTY_DAYS_MS);
/** A period end well in the past, beyond any grace window. */
const past = () => new Date(Date.now() - THIRTY_DAYS_MS);

interface RefusalCase {
    readonly label: string;
    readonly method: 'POST' | 'DELETE';
    readonly path: string;
    readonly body?: string;
    /** Asserts the route's own service call never happened. */
    readonly assertNotCalled: () => void;
    /** The domain whose subscription must be lapsed for this route to refuse. */
    readonly domain: string;
}

describe('the content-editing subscription gate — REFUSES a lapsed owner (HOS-1275)', () => {
    let app: AppOpenAPI;
    let accommodationAddFaq: ReturnType<typeof vi.spyOn>;
    let accommodationRemoveFaq: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        _resetCommerceBaseLimitCache();
        clearHostDraftDefaultsCache();

        mocks.hydrate.mockImplementation(async (subs: readonly { id: string }[]) =>
            subs.map((sub) => ({ ...sub, productDomain: fakeDomains[sub.id] ?? null }))
        );
        // The DB-backed host-draft fallback. Without it a lapsed HOST resolves
        // tourist-free defaults and `requireEntitlement` answers 403 BEFORE this
        // gate runs — the test would then pass for the wrong reason on a 402
        // assertion, or fail confusingly. Feeding the real OWNER_BASICO_PLAN is
        // what production actually does here.
        vi.spyOn(PlanService.prototype, 'getBySlug').mockResolvedValue({
            success: true,
            data: {
                entitlements: OWNER_BASICO_PLAN.entitlements as unknown as string[],
                limits: Object.fromEntries(OWNER_BASICO_PLAN.limits.map((l) => [l.key, l.value]))
            }
        } as never);
        accommodationAddFaq = vi
            .spyOn(AccommodationService.prototype, 'addFaq')
            .mockResolvedValue(SUCCESS_RESULT);
        accommodationRemoveFaq = vi
            .spyOn(AccommodationService.prototype, 'removeFaq')
            .mockResolvedValue(SUCCESS_RESULT);
        mocks.addGastronomyFaq.mockResolvedValue(SUCCESS_RESULT);
        mocks.removeGastronomyFaq.mockResolvedValue(SUCCESS_RESULT);
        mocks.addExperienceFaq.mockResolvedValue(SUCCESS_RESULT);

        app = initApp();
    });

    function cases(): readonly RefusalCase[] {
        return [
            {
                label: 'accommodation addFaq',
                method: 'POST',
                path: `/api/v1/protected/accommodations/${LISTING_ID}/faqs`,
                body: FAQ_BODY,
                assertNotCalled: () => expect(accommodationAddFaq).not.toHaveBeenCalled(),
                domain: ProductDomainEnum.ACCOMMODATION
            },
            {
                // Newly wired by this issue: it carried NO entitlement gate at
                // all before, in accommodation as well as in commerce.
                label: 'accommodation removeFaq',
                method: 'DELETE',
                path: `/api/v1/protected/accommodations/${LISTING_ID}/faqs/${FAQ_ID}`,
                assertNotCalled: () => expect(accommodationRemoveFaq).not.toHaveBeenCalled(),
                domain: ProductDomainEnum.ACCOMMODATION
            },
            {
                label: 'gastronomy addFaq',
                method: 'POST',
                path: `/api/v1/protected/gastronomies/${LISTING_ID}/faqs`,
                body: FAQ_BODY,
                assertNotCalled: () => expect(mocks.addGastronomyFaq).not.toHaveBeenCalled(),
                domain: ProductDomainEnum.GASTRONOMY
            },
            {
                label: 'gastronomy removeFaq',
                method: 'DELETE',
                path: `/api/v1/protected/gastronomies/${LISTING_ID}/faqs/${FAQ_ID}`,
                assertNotCalled: () => expect(mocks.removeGastronomyFaq).not.toHaveBeenCalled(),
                domain: ProductDomainEnum.GASTRONOMY
            },
            {
                label: 'experience addFaq',
                method: 'POST',
                path: `/api/v1/protected/experiences/${LISTING_ID}/faqs`,
                body: FAQ_BODY,
                assertNotCalled: () => expect(mocks.addExperienceFaq).not.toHaveBeenCalled(),
                domain: ProductDomainEnum.EXPERIENCE
            }
        ];
    }

    it.each(
        cases().map((c) => [c.label, c] as const)
    )('refuses %s with 402 NO_ACTIVE_SUBSCRIPTION', async (_label, testCase) => {
        given([['sub-lapsed', SubscriptionStatusEnum.CANCELLED, testCase.domain, past()]]);

        const res = await app.request(testCase.path, {
            method: testCase.method,
            headers: ownerHeaders,
            body: testCase.body
        });
        const body = (await res.json().catch(() => ({}))) as {
            error?: { code?: string; reason?: string };
        };

        expect(res.status).toBe(402);
        expect(body.error?.reason).toBe('NO_ACTIVE_SUBSCRIPTION');
        testCase.assertNotCalled();
    });

    it('lets the DRAFT PHASE through — an owner with zero subscription rows', async () => {
        // The state of every host between signup and their first publish, since
        // HOS-1012 moved trial creation to the publish. If this ever goes red,
        // the gate has become `if (!subscription) deny` and the platform's
        // largest vertical has lost its entry door.
        given([]);

        const res = await app.request(`/api/v1/protected/accommodations/${LISTING_ID}/faqs`, {
            method: 'POST',
            headers: ownerHeaders,
            body: FAQ_BODY
        });

        expect(res.status).not.toBe(402);
        expect(accommodationAddFaq).toHaveBeenCalled();
    });

    it('lets a PAST_DUE owner through — pastDueGraceMiddleware owns that call', async () => {
        given([['sub-late', SubscriptionStatusEnum.PAST_DUE, ProductDomainEnum.GASTRONOMY]]);

        const res = await app.request(`/api/v1/protected/gastronomies/${LISTING_ID}/faqs`, {
            method: 'POST',
            headers: ownerHeaders,
            body: FAQ_BODY
        });

        expect(res.status).not.toBe(402);
        expect(mocks.addGastronomyFaq).toHaveBeenCalled();
    });

    it('lets a COMP owner through', async () => {
        given([['sub-comp', SubscriptionStatusEnum.COMP, ProductDomainEnum.ACCOMMODATION]]);

        const res = await app.request(`/api/v1/protected/accommodations/${LISTING_ID}/faqs`, {
            method: 'POST',
            headers: ownerHeaders,
            body: FAQ_BODY
        });

        expect(res.status).not.toBe(402);
        expect(accommodationAddFaq).toHaveBeenCalled();
    });

    it('the DUAL OWNER is answered per domain, not per customer', async () => {
        // A live accommodation subscription must not rescue a lapsed gastronomy
        // one. This is the hole the globally-mounted, domain-BLIND
        // `trialMiddleware` leaves open, closed here by scoping.
        given([
            ['acc', SubscriptionStatusEnum.ACTIVE, ProductDomainEnum.ACCOMMODATION],
            ['gas', SubscriptionStatusEnum.CANCELLED, ProductDomainEnum.GASTRONOMY, past()]
        ]);

        const gastronomy = await app.request(`/api/v1/protected/gastronomies/${LISTING_ID}/faqs`, {
            method: 'POST',
            headers: ownerHeaders,
            body: FAQ_BODY
        });
        expect(gastronomy.status).toBe(402);
        expect(mocks.addGastronomyFaq).not.toHaveBeenCalled();

        const accommodation = await app.request(
            `/api/v1/protected/accommodations/${LISTING_ID}/faqs`,
            { method: 'POST', headers: ownerHeaders, body: FAQ_BODY }
        );
        expect(accommodation.status).not.toBe(402);
        expect(accommodationAddFaq).toHaveBeenCalled();
    });

    it.each([
        [
            'accommodation',
            ProductDomainEnum.ACCOMMODATION,
            `/api/v1/protected/accommodations/${LISTING_ID}/faqs`
        ],
        [
            'gastronomy',
            ProductDomainEnum.GASTRONOMY,
            `/api/v1/protected/gastronomies/${LISTING_ID}/faqs`
        ],
        [
            'experience',
            ProductDomainEnum.EXPERIENCE,
            `/api/v1/protected/experiences/${LISTING_ID}/faqs`
        ]
    ] as const)('SOFT-CANCEL: %s keeps editing while the paid period runs', async (_label, domain, path) => {
        // REGRESSION (HOS-1275). The first cut of this gate was status-only
        // and 402'd here, on the wire, in all three verticals rather than only
        // the one `apps/e2e/tests/host/host-04-cancellation-grace.spec.ts`
        // exercises.
        //
        // CORRECTED (HOS-1310): this comment used to say cancelling writes
        // `status = 'cancelled'` IMMEDIATELY, citing that E2E. The E2E performs
        // the UPDATE itself as a fixture; the in-app soft cancel sets only
        // `cancel_at_period_end` and leaves the status alone. But that flag is
        // exactly what makes this row a real soft-cancel, and `isSubscriptionLive`
        // now requires it — so the fixture states it instead of leaning on a date
        // qzpay stamps before anybody pays.
        given([['sub-soft', SubscriptionStatusEnum.CANCELLED, domain, future(), true]]);

        const res = await app.request(path, {
            method: 'POST',
            headers: ownerHeaders,
            body: FAQ_BODY
        });

        expect(res.status).not.toBe(402);
    });

    it.each([
        [
            'accommodation',
            ProductDomainEnum.ACCOMMODATION,
            `/api/v1/protected/accommodations/${LISTING_ID}/faqs`
        ],
        [
            'gastronomy',
            ProductDomainEnum.GASTRONOMY,
            `/api/v1/protected/gastronomies/${LISTING_ID}/faqs`
        ],
        [
            'experience',
            ProductDomainEnum.EXPERIENCE,
            `/api/v1/protected/experiences/${LISTING_ID}/faqs`
        ]
    ] as const)('SOFT-CANCEL: %s IS refused once that period has passed', async (_label, domain, path) => {
        // The other half of the rule the e2e's own name states:
        // "cancel keeps grace -> period_end past blocks writes". Without
        // this case the fix above could be widened to "cancelled always
        // passes" with everything still green.
        given([['sub-spent', SubscriptionStatusEnum.CANCELLED, domain, past(), true]]);

        const res = await app.request(path, {
            method: 'POST',
            headers: ownerHeaders,
            body: FAQ_BODY
        });

        expect(res.status).toBe(402);
    });

    it.each([
        [
            'accommodation',
            ProductDomainEnum.ACCOMMODATION,
            `/api/v1/protected/accommodations/${LISTING_ID}/faqs`
        ],
        [
            'gastronomy',
            ProductDomainEnum.GASTRONOMY,
            `/api/v1/protected/gastronomies/${LISTING_ID}/faqs`
        ],
        [
            'experience',
            ProductDomainEnum.EXPERIENCE,
            `/api/v1/protected/experiences/${LISTING_ID}/faqs`
        ]
    ] as const)('NEVER-PAID: %s is refused despite a future period end (HOS-1310)', async (_label, domain, path) => {
        // The phantom row, on the wire, in all three verticals. Identical
        // status and identical future date to the passing case above; the
        // only difference is `cancelAtPeriodEnd`.
        //
        // Produced by the MercadoPago webhook when a checkout is abandoned or
        // a card refused: qzpay had already stamped `current_period_end =
        // now + 30 days` at INSERT, and the webhook rewrites rather than
        // clears it. Nothing reaps the row, so on the date alone it bought a
        // month of editing nobody paid for.
        given([['sub-phantom', SubscriptionStatusEnum.CANCELLED, domain, future(), false]]);

        const res = await app.request(path, {
            method: 'POST',
            headers: ownerHeaders,
            body: FAQ_BODY
        });

        expect(res.status).toBe(402);
    });

    it('platform staff bypass the gate on a lapsed customer', async () => {
        // A platform editor fixing somebody else's listing operates without a
        // billing customer of their own. Refusing them would be a regression,
        // not enforcement.
        given([
            ['sub-lapsed', SubscriptionStatusEnum.CANCELLED, ProductDomainEnum.GASTRONOMY, past()]
        ]);

        const res = await app.request(`/api/v1/protected/gastronomies/${LISTING_ID}/faqs`, {
            method: 'POST',
            headers: staffHeaders,
            body: FAQ_BODY
        });

        expect(res.status).not.toBe(402);
        expect(mocks.addGastronomyFaq).toHaveBeenCalled();
    });
});
