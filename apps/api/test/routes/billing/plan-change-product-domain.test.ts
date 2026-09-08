/**
 * Regression tests for the product-domain scoping of `handlePlanChange`
 * (HOS-1213).
 *
 * ## The bug these reproduce
 *
 * `POST /protected/billing/subscriptions/change-plan` took the FIRST
 * `active | trialing` subscription `getByCustomerId` returned, in whatever order
 * the storage adapter produced, and never compared any domain. Since the
 * per-vertical split (HOS-688) one billing customer legitimately holds up to
 * three subscriptions at once, so that lookup could reach a commerce
 * subscription this route does not govern.
 *
 * Measured on staging with `commerce-gastronomy@local.test`: the account
 * dashboard offered `tourist-free` ($0) against `Gastronomía Básico` ($30.000).
 * Both plans are cheaper and `compareCategoryRank('owner', 'tourist')` is a
 * rank-DOWN, so the request classified cleanly as a downgrade and would have
 * been SCHEDULED — the `apply-scheduled-plan-changes` cron then commits it at
 * period end, leaving a paid commerce subscription on a tourist plan with the
 * listing it paid for unpublished.
 *
 * The first test below is that exact request. Its assertion that
 * `scheduleSubscriptionDowngrade` was never called is the load-bearing one: a
 * 404 alone would also be produced by a broken mock, whereas "no schedule was
 * written" is the property that actually matters.
 *
 * @module test/routes/billing/plan-change-product-domain
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (must be declared BEFORE importing the route file).
// ---------------------------------------------------------------------------

vi.mock('../../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn(),
    billingMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
    requireBilling: vi.fn(async (_c: unknown, next: () => Promise<void>) => next())
}));

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
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
    createSimpleRoute: vi.fn((config: { handler: unknown }) => config.handler),
    createAdminRoute: vi.fn((config: { handler: unknown }) => config.handler)
}));

vi.mock('../../../src/utils/audit-logger', () => ({
    auditLog: vi.fn(),
    AuditEventType: { BILLING_MUTATION: 'billing.mutation' }
}));

vi.mock('../../../src/utils/env', () => ({
    env: {
        HOSPEDA_SITE_URL: 'https://hospeda.test',
        HOSPEDA_API_URL: 'https://api.hospeda.test',
        HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR: 'HOSPEDA'
    }
}));

vi.mock('../../../src/utils/notification-helper', () => ({
    sendNotification: vi.fn()
}));

vi.mock('../../../src/services/subscription-downgrade.service', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        scheduleSubscriptionDowngrade: vi.fn()
    };
});

vi.mock('../../../src/services/subscription-downgrade-excess.service', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        computeDowngradeExcess: vi.fn(),
        defaultExcessDeps: {}
    };
});

vi.mock('../../../src/services/subscription-checkout.service', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        initiatePaidPlanUpgrade: vi.fn()
    };
});

// ---------------------------------------------------------------------------
// Imports (after mocks).
// ---------------------------------------------------------------------------

import { ServiceErrorCode } from '@repo/schemas';
import { getQZPayBilling } from '../../../src/middlewares/billing';
import { handlePlanChange } from '../../../src/routes/billing/plan-change';
import { scheduleSubscriptionDowngrade } from '../../../src/services/subscription-downgrade.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CUSTOMER_ID = 'cust_dual_domain';
const ACTOR_ID = '00000000-0000-4000-8000-000000000009';

const GASTRONOMY_SUB_ID = 'sub_gastronomy';
const ACCOMMODATION_SUB_ID = 'sub_accommodation';
const APPLY_AT_ISO = '2026-10-01T00:00:00.000Z';

/**
 * Plan slugs, spelled exactly as the catalogue spells them.
 *
 * `productDomainForPlanSlug` resolves against the real `@repo/billing`
 * catalogues (this suite does not mock it), so an invented slug here would make
 * the domain assertion vacuous — it would answer `undefined` for every plan and
 * the guard would pass everything. That is precisely the failure mode being
 * tested, so the slugs have to be real.
 */
const OWNER_BASICO = 'owner-basico';
const OWNER_PRO = 'owner-pro';
const TOURIST_FREE = 'tourist-free';
const GASTRONOMY_BASICO = 'gastronomy-basico';
const GASTRONOMY_PRO = 'gastronomy-pro';
/** A plan created in admin per negotiated agreement (HOS-1062) — in no static catalogue. */
const NEGOTIATED = 'negotiated-acme-2026';

/** Price in ARS centavos, keyed by slug, so upgrade/downgrade direction is explicit. */
const PRICE_BY_SLUG: Readonly<Record<string, number>> = {
    [OWNER_BASICO]: 1_800_000,
    [OWNER_PRO]: 4_500_000,
    [TOURIST_FREE]: 0,
    [GASTRONOMY_BASICO]: 3_000_000,
    [GASTRONOMY_PRO]: 6_500_000,
    [NEGOTIATED]: 900_000
};

function makeContext(newPlanId: string) {
    const store = new Map<string, unknown>([
        ['billingEnabled', true],
        ['billingCustomerId', CUSTOMER_ID],
        ['actor', { id: ACTOR_ID, roles: ['USER'], permissions: [], email: 'owner@test.com' }]
    ]);
    return {
        get: vi.fn((k: string) => store.get(k)),
        req: { json: vi.fn().mockResolvedValue({ newPlanId, billingInterval: 'monthly' }) }
    };
}

/**
 * A subscription carrying an EXPLICIT `productDomain`.
 *
 * `hydrateSubscriptionProductDomains` leaves an explicit value untouched — "an
 * explicit value, even `null`, is a real answer and not a gap to fill" — so
 * these fixtures never reach the database, and the selection under test runs on
 * the value written here rather than on whatever the global `@repo/db` mock
 * would have returned.
 */
function makeSubscription(input: { id: string; planId: string; productDomain: string }) {
    return {
        id: input.id,
        planId: input.planId,
        status: 'active',
        interval: 'month',
        intervalCount: 1,
        productDomain: input.productDomain
    };
}

function makeBilling(subscriptions: readonly ReturnType<typeof makeSubscription>[]) {
    return {
        subscriptions: {
            getByCustomerId: vi.fn().mockResolvedValue([...subscriptions]),
            changePlan: vi.fn(),
            update: vi.fn()
        },
        plans: {
            get: vi.fn().mockImplementation((slug: string) =>
                Promise.resolve({
                    id: slug,
                    // The catalogue slug lives on `name` — what the domain guard reads.
                    name: slug,
                    active: true,
                    prices: [
                        {
                            id: `price_${slug}`,
                            billingInterval: 'month',
                            unitAmount: PRICE_BY_SLUG[slug] ?? 1_000_000,
                            intervalCount: 1
                        }
                    ]
                })
            )
        }
    };
}

function mockBilling(billing: ReturnType<typeof makeBilling>) {
    vi.mocked(getQZPayBilling).mockReturnValue(
        billing as unknown as ReturnType<typeof getQZPayBilling>
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handlePlanChange — product-domain scoping (HOS-1213)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(scheduleSubscriptionDowngrade).mockResolvedValue({
            subscriptionId: ACCOMMODATION_SUB_ID,
            previousPlanId: OWNER_PRO,
            newPlanId: OWNER_BASICO,
            applyAt: APPLY_AT_ISO,
            replacedPriorSchedule: false
        } as unknown as Awaited<ReturnType<typeof scheduleSubscriptionDowngrade>>);
    });

    describe('the reported request', () => {
        it('refuses to touch a gastronomy-only customer asking for a tourist plan', async () => {
            // Arrange — exactly the staging state: one active gastronomy
            // subscription, no accommodation one, and the target the broken
            // dialog offered.
            const billing = makeBilling([
                makeSubscription({
                    id: GASTRONOMY_SUB_ID,
                    planId: GASTRONOMY_BASICO,
                    productDomain: 'gastronomy'
                })
            ]);
            mockBilling(billing);

            // Act + Assert — this route governs accommodation subscriptions, and
            // this customer holds none.
            await expect(
                handlePlanChange(
                    makeContext(TOURIST_FREE) as unknown as Parameters<typeof handlePlanChange>[0]
                )
            ).rejects.toMatchObject({ status: 404 });
        });

        it('writes NO scheduled downgrade for that request', async () => {
            // The assertion that matters. Before HOS-1213 this request reached
            // the downgrade branch and queued a plan change the cron would have
            // committed at period end.
            const billing = makeBilling([
                makeSubscription({
                    id: GASTRONOMY_SUB_ID,
                    planId: GASTRONOMY_BASICO,
                    productDomain: 'gastronomy'
                })
            ]);
            mockBilling(billing);

            await expect(
                handlePlanChange(
                    makeContext(TOURIST_FREE) as unknown as Parameters<typeof handlePlanChange>[0]
                )
            ).rejects.toThrow();

            expect(scheduleSubscriptionDowngrade).not.toHaveBeenCalled();
            expect(billing.subscriptions.changePlan).not.toHaveBeenCalled();
        });
    });

    describe('a customer holding both domains', () => {
        it('operates on the accommodation subscription even when commerce is returned first', async () => {
            // Order matters: the commerce subscription is FIRST, which is what
            // the old unqualified `find` would have picked.
            const billing = makeBilling([
                makeSubscription({
                    id: GASTRONOMY_SUB_ID,
                    planId: GASTRONOMY_BASICO,
                    productDomain: 'gastronomy'
                }),
                makeSubscription({
                    id: ACCOMMODATION_SUB_ID,
                    planId: OWNER_PRO,
                    productDomain: 'accommodation'
                })
            ]);
            mockBilling(billing);

            await handlePlanChange(
                makeContext(OWNER_BASICO) as unknown as Parameters<typeof handlePlanChange>[0]
            );

            expect(scheduleSubscriptionDowngrade).toHaveBeenCalledTimes(1);
            expect(vi.mocked(scheduleSubscriptionDowngrade).mock.calls[0]?.[0]).toMatchObject({
                currentSubscriptionId: ACCOMMODATION_SUB_ID
            });
        });
    });

    describe('a legacy row whose product_domain column is null', () => {
        it('is still treated as accommodation', async () => {
            // SPEC-239 fail-open: the column post-dates most rows, so `null`
            // means "before the split", not "some other vertical".
            const billing = makeBilling([
                {
                    ...makeSubscription({
                        id: ACCOMMODATION_SUB_ID,
                        planId: OWNER_PRO,
                        productDomain: 'accommodation'
                    }),
                    productDomain: null as unknown as string
                }
            ]);
            mockBilling(billing);

            await handlePlanChange(
                makeContext(OWNER_BASICO) as unknown as Parameters<typeof handlePlanChange>[0]
            );

            expect(scheduleSubscriptionDowngrade).toHaveBeenCalledTimes(1);
        });
    });

    describe('the target plan', () => {
        it('rejects a commerce plan offered to an accommodation subscription', async () => {
            const billing = makeBilling([
                makeSubscription({
                    id: ACCOMMODATION_SUB_ID,
                    planId: OWNER_PRO,
                    productDomain: 'accommodation'
                })
            ]);
            mockBilling(billing);

            // Asserted on `code` and the message, NOT on `reason`.
            //
            // `test/setup.ts` mocks `@repo/service-core` wholesale, and the
            // `ServiceError` it substitutes is a TWO-argument stub
            // (`constructor(code, message)`) that silently drops `details` and
            // `reason`. Measured here: the thrown instance's own keys are
            // exactly `code,name` and `reason` reads `undefined`, while the real
            // class assigns all four. So an assertion on `reason` in this app's
            // unit tests describes the stub rather than the code — it would fail
            // against a correct implementation, which is the worst kind of test.
            // The message survives (it goes through `super(message)`) and names
            // the offending domain, so it carries the real content.
            await expect(
                handlePlanChange(
                    makeContext(GASTRONOMY_PRO) as unknown as Parameters<typeof handlePlanChange>[0]
                )
            ).rejects.toMatchObject({ code: ServiceErrorCode.VALIDATION_ERROR });

            await expect(
                handlePlanChange(
                    makeContext(GASTRONOMY_PRO) as unknown as Parameters<typeof handlePlanChange>[0]
                )
            ).rejects.toThrow(/belongs to product domain 'gastronomy'/);

            expect(scheduleSubscriptionDowngrade).not.toHaveBeenCalled();
            expect(billing.subscriptions.changePlan).not.toHaveBeenCalled();
        });

        it('accepts a negotiated plan that is in no static catalogue', async () => {
            // HOS-1062 made the catalogue open — one plan row per negotiated
            // agreement, created in admin. Refusing an unresolvable slug would
            // break a live feature to guard against a domain nobody can name, so
            // the guard rejects only a slug that resolves to ANOTHER domain.
            const billing = makeBilling([
                makeSubscription({
                    id: ACCOMMODATION_SUB_ID,
                    planId: OWNER_PRO,
                    productDomain: 'accommodation'
                })
            ]);
            mockBilling(billing);

            await handlePlanChange(
                makeContext(NEGOTIATED) as unknown as Parameters<typeof handlePlanChange>[0]
            );

            expect(scheduleSubscriptionDowngrade).toHaveBeenCalledTimes(1);
        });
    });
});
