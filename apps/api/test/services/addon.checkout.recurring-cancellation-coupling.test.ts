/**
 * HOS-847 regression — cancelling the PLAN must find the recurring add-on's
 * purchase row.
 *
 * ## What is being coupled, and why a value assertion was not enough
 *
 * `billing_addon_purchases.subscription_id` means "the plan subscription this
 * add-on runs on top of". Four readers depend on that meaning:
 *
 *   apps/api/src/services/addon-lifecycle-cancellation.service.ts:147
 *   apps/api/src/routes/billing/admin/qzpay-admin-hooks.ts:186 and :318
 *   apps/api/src/cron/jobs/addon-expiry.job.ts:847-857 (INNER JOIN)
 *
 * The recurring checkout initially wrote the add-on's OWN preapproval row
 * there. Nothing failed: the sweep simply matched zero rows and logged
 * "skipping cleanup". The limit stays granted forever, and once PR 6 hangs the
 * MercadoPago hard-cancel off that same query, the preapproval is never
 * cancelled and keeps charging — risk R1 / HOS-751, reintroduced by the PR that
 * was supposed to be neutral.
 *
 * A test asserting `row.subscriptionId === HOST_SUBSCRIPTION_ID` pins the value
 * but not the CONTRACT: it would stay green if the sweep's WHERE clause were
 * later re-pointed at another column. So this file runs both halves for real —
 * the checkout writes the row, and `handleSubscriptionCancellationAddons`
 * queries for it — and joins them by EVALUATING the query's bound parameters
 * (rendered through Drizzle's own `PgDialect`) against the row the checkout
 * actually produced. No SQL engine, no fixture retyping the id.
 *
 * The row is presented in `'active'` because that is the status the sweep looks
 * for and the status PR 5's webhook moves a confirmed purchase into; everything
 * else about it is verbatim what the checkout wrote.
 *
 * @module test/services/addon.checkout.recurring-cancellation-coupling
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { ProductDomainEnum } from '@repo/schemas';
import type { PurchaseAddonInput } from '@repo/service-core';
import { PgDialect } from 'drizzle-orm/pg-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    mockAddonCatalogGetBySlug,
    mockPlanServiceGetById,
    mockPlanServiceGetBySlug,
    mockAccommodationFindById,
    mockResolveCheckoutMpAddonPlanId,
    mockCreateOwnPreapprovalSubscription,
    mockPurchaseInsertValues,
    mockPurchaseInsertReturning,
    mockDbExecute,
    mockSelectDispatch,
    mockRevokeAddon,
    mockCloseAddonPreapproval
} = vi.hoisted(() => ({
    mockAddonCatalogGetBySlug: vi.fn(),
    mockPlanServiceGetById: vi.fn(),
    mockPlanServiceGetBySlug: vi.fn(),
    mockAccommodationFindById: vi.fn(),
    mockResolveCheckoutMpAddonPlanId: vi.fn<() => Promise<string>>(),
    mockCreateOwnPreapprovalSubscription: vi.fn<() => Promise<unknown>>(),
    mockPurchaseInsertValues: vi.fn<(values: Record<string, unknown>) => unknown>(),
    mockPurchaseInsertReturning: vi.fn<() => Promise<Array<{ id: string }>>>(),
    mockDbExecute: vi.fn<() => Promise<{ rows: Array<Record<string, unknown>> }>>(),
    mockSelectDispatch: vi.fn<(columns: Record<string, unknown>) => Promise<unknown[]>>(),
    mockRevokeAddon: vi.fn(),
    mockCloseAddonPreapproval: vi.fn()
}));

vi.mock('../../src/utils/env', () => ({
    env: {
        HOSPEDA_SITE_URL: 'https://hospeda.test',
        HOSPEDA_API_URL: 'https://api.hospeda.test',
        HOSPEDA_BILLING_POLLING_ENABLED: true,
        HOSPEDA_BILLING_RECURRING_ADDONS_ENABLED: true,
        // Without this the cancellation sweep short-circuits before querying at
        // all, and the coupling under test would never be exercised.
        HOSPEDA_ADDON_LIFECYCLE_ENABLED: true
    }
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: vi.fn()
}));

vi.mock('../../src/services/billing/orphan-payment-queue.service', () => ({
    recordOrphanPayment: vi.fn()
}));

vi.mock('../../src/services/addon-lifecycle.service', () => ({
    revokeAddonForSubscriptionCancellation: mockRevokeAddon
}));

// HOS-847 PR 6 hung the MercadoPago hard-cancel off this same sweep, which is
// exactly the coupling this file was written to protect. Mocked so the assertion
// below can check WHICH preapproval the sweep asked to close.
vi.mock('../../src/services/addon-preapproval-cancel', () => ({
    closeAddonPreapproval: mockCloseAddonPreapproval
}));

vi.mock('../../src/services/billing/mp-addon-plan-provisioning.service', async (importOriginal) => {
    const actual =
        await importOriginal<
            typeof import('../../src/services/billing/mp-addon-plan-provisioning.service')
        >();
    return { ...actual, resolveCheckoutMpAddonPlanId: mockResolveCheckoutMpAddonPlanId };
});

vi.mock('../../src/services/billing/own-preapproval-subscription-create', () => ({
    createOwnPreapprovalSubscription: mockCreateOwnPreapprovalSubscription
}));

vi.mock('../../src/services/promo-code.service', () => ({
    PromoCodeService: vi.fn().mockImplementation(function () {
        return { validate: vi.fn(), getByCode: vi.fn() };
    })
}));

// `@repo/db/schemas/billing` is deliberately NOT mocked here: the real column
// objects are what `PgDialect` needs to render the sweep's WHERE clause.
vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();

    const db = {
        insert: vi.fn(() => ({ values: mockPurchaseInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
        execute: mockDbExecute,
        select: vi.fn((columns: Record<string, unknown>) => {
            const rows = () => mockSelectDispatch(columns);
            const terminal = {
                limit: async () => await rows(),
                orderBy: () => ({ limit: async () => await rows() })
            };
            return { from: () => ({ where: () => terminal }) };
        })
    };

    return {
        ...actual,
        AccommodationModel: vi.fn().mockImplementation(function () {
            return { findById: mockAccommodationFindById };
        }),
        getDb: vi.fn(() => db),
        withTransaction: vi.fn(
            async (
                callback: (tx: unknown) => Promise<unknown>,
                _client?: unknown
            ): Promise<unknown> =>
                await callback({
                    update: () => ({ set: () => ({ where: async () => undefined }) }),
                    insert: () => ({ values: async () => undefined })
                })
        )
    };
});

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        PlanService: vi.fn().mockImplementation(function () {
            return { getById: mockPlanServiceGetById, getBySlug: mockPlanServiceGetBySlug };
        }),
        AddonCatalogService: vi.fn().mockImplementation(function () {
            return { getBySlug: mockAddonCatalogGetBySlug, list: vi.fn() };
        }),
        hydrateSubscriptionProductDomains: vi.fn(async (subs: readonly Record<string, unknown>[]) =>
            subs.map((sub) => ({
                ...sub,
                productDomain: sub.productDomain === undefined ? 'accommodation' : sub.productDomain
            }))
        )
    };
});

import { createAddonCheckout } from '../../src/services/addon.checkout';
import { handleSubscriptionCancellationAddons } from '../../src/services/addon-lifecycle-cancellation.service';

const CUSTOMER_ID = 'cust_coupling';
const HOST_PLAN_ID = '00000000-0000-4000-8000-00000000plan';
const HOST_SUBSCRIPTION_ID = 'sub_owner_001';
const ADDON_SUBSCRIPTION_ID = 'sub_addon_001';
const ADDON_UUID = '00000000-0000-4000-8000-0000000adds1';
const MP_PREAPPROVAL_ID = 'preapproval_addon_001';
const PURCHASE_ID = '00000000-0000-4000-8000-00000purchase';

const RECURRING_ADDON = {
    id: ADDON_UUID,
    slug: 'extra-photos-20',
    name: 'Extra Photos Pack (+20 photos)',
    description: 'Adds 20 additional photos.',
    billingType: 'recurring' as const,
    priceArs: 500_000,
    annualPriceArs: 4_800_000,
    durationDays: null,
    isActive: true,
    targetCategories: ['owner'] as const,
    productDomain: ProductDomainEnum.ACCOMMODATION,
    sortOrder: 3,
    affectsLimitKey: 'max_photos_per_accommodation',
    limitIncrease: 20,
    grantsEntitlement: null
};

const INPUT: PurchaseAddonInput = {
    customerId: CUSTOMER_ID,
    addonSlug: RECURRING_ADDON.slug,
    userId: 'user_coupling'
};

function createBilling(): QZPayBilling {
    return {
        customers: {
            get: vi.fn().mockResolvedValue({
                id: CUSTOMER_ID,
                email: 'host@hospeda.test',
                metadata: { name: 'Maria Rodriguez' }
            })
        },
        subscriptions: {
            getByCustomerId: vi
                .fn()
                .mockResolvedValue([
                    { id: HOST_SUBSCRIPTION_ID, status: 'active', planId: HOST_PLAN_ID }
                ]),
            cancel: vi.fn()
        },
        plans: {
            getPrices: vi.fn().mockResolvedValue([
                {
                    id: 'price_monthly_owner',
                    active: true,
                    // NOT NULL in `billing_prices`, and required by the
                    // borrowed-price resolver since HOS-847.
                    currency: 'ARS',
                    billingInterval: 'month',
                    intervalCount: 1
                }
            ])
        },
        checkout: { create: vi.fn() },
        getStorage: vi.fn().mockReturnValue({ subscriptionPollingJobs: { create: vi.fn() } })
    } as unknown as QZPayBilling;
}

/**
 * A Drizzle client whose SELECT actually FILTERS: it renders the WHERE clause
 * the service built into `{ sql, params }` with Drizzle's own dialect, and
 * keeps a candidate row only when every scalar column the clause bound matches
 * that row.
 *
 * Coarse on purpose — it does not know which column each parameter belongs to,
 * only that the clause bound a set of values. That is exactly enough for the
 * question at hand: a row whose `subscription_id` is the add-on's own
 * preapproval id is not among the values a sweep keyed on the PLAN subscription
 * binds, so it drops out.
 */
function createFilteringDb(candidateRows: ReadonlyArray<Record<string, unknown>>) {
    const dialect = new PgDialect();
    const selectWhere = vi.fn(async (condition: unknown) => {
        const { params } = dialect.sqlToQuery(condition as never);
        const bound = params.filter(
            (p): p is string | number => typeof p === 'string' || typeof p === 'number'
        );
        return candidateRows.filter(
            (row) =>
                bound.includes(row.subscriptionId as string) && bound.includes(row.status as string)
        );
    });

    return {
        db: {
            select: vi.fn(() => ({ from: vi.fn(() => ({ where: selectWhere })) })),
            update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
            insert: vi.fn(() => ({ values: vi.fn(async () => undefined) }))
        },
        selectWhere
    };
}

describe('HOS-847 — cancelling the plan finds the recurring add-on purchase', () => {
    let billing: QZPayBilling;

    beforeEach(() => {
        vi.clearAllMocks();
        billing = createBilling();

        mockSelectDispatch.mockImplementation(async (columns: Record<string, unknown>) => {
            const keys = Object.keys(columns);
            // `billing_addons.billing_interval`, read by the recurring gate.
            if (keys.length === 1 && keys[0] === 'billingInterval') {
                return [{ billingInterval: 'month' }];
            }
            // Nothing in flight; nothing to reuse or supersede.
            return [];
        });
        mockDbExecute.mockResolvedValue({ rows: [] });

        mockAddonCatalogGetBySlug.mockResolvedValue({ success: true, data: RECURRING_ADDON });
        mockPlanServiceGetById.mockResolvedValue({
            success: true,
            data: { id: HOST_PLAN_ID, slug: 'owner-premium', category: 'owner' }
        });
        mockPlanServiceGetBySlug.mockResolvedValue({
            success: false,
            error: { code: 'NOT_FOUND' }
        });
        mockAccommodationFindById.mockResolvedValue(null);
        mockResolveCheckoutMpAddonPlanId.mockResolvedValue('2c93808491e2fcbf0191ea1c9f1b0000');
        mockCreateOwnPreapprovalSubscription.mockResolvedValue({
            subscription: {
                id: ADDON_SUBSCRIPTION_ID,
                providerSubscriptionIds: { mercadopago: MP_PREAPPROVAL_ID }
            },
            checkoutUrl: 'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=x'
        });
        mockPurchaseInsertReturning.mockResolvedValue([{ id: PURCHASE_ID }]);
        mockPurchaseInsertValues.mockImplementation(() => ({
            returning: mockPurchaseInsertReturning
        }));

        mockRevokeAddon.mockResolvedValue({
            purchaseId: PURCHASE_ID,
            addonSlug: RECURRING_ADDON.slug,
            addonType: 'limit',
            outcome: 'success'
        });
        mockCloseAddonPreapproval.mockResolvedValue({ closed: true, kind: 'cancelled' });
    });

    /** Run the real checkout and return the row it asked the DB to insert. */
    async function checkoutAndReadRow(): Promise<Record<string, unknown>> {
        const result = await createAddonCheckout(billing, INPUT);
        expect(result.success).toBe(true);
        expect(mockPurchaseInsertValues).toHaveBeenCalledTimes(1);
        return mockPurchaseInsertValues.mock.calls[0]?.[0] as Record<string, unknown>;
    }

    it('the row the checkout writes is selected by the plan-cancellation sweep', async () => {
        // Arrange — the real checkout produces the real row.
        const written = await checkoutAndReadRow();
        // PR 5's webhook is what moves a confirmed purchase to 'active'; the
        // sweep only ever looks at that status. Nothing else is altered.
        const activated = { ...written, id: PURCHASE_ID, status: 'active', deletedAt: null };
        const { db, selectWhere } = createFilteringDb([activated]);

        // Act — the real sweep, for the PLAN subscription that was cancelled.
        const result = await handleSubscriptionCancellationAddons({
            subscriptionId: HOST_SUBSCRIPTION_ID,
            customerId: CUSTOMER_ID,
            billing,
            db: db as never
        });

        // Assert
        expect(selectWhere).toHaveBeenCalledTimes(1);
        expect(result.totalProcessed).toBe(1);
        expect(result.succeeded).toHaveLength(1);
        expect(result.succeeded[0]?.purchaseId).toBe(PURCHASE_ID);
        expect(mockRevokeAddon).toHaveBeenCalledTimes(1);

        // HOS-847 PR 6 — the other half of the same coupling: the sweep that
        // found this row must also cancel the preapproval the CHECKOUT created,
        // not the plan's. Read off the row the checkout actually wrote, so a
        // future change that repoints either column fails here.
        expect(mockCloseAddonPreapproval).toHaveBeenCalledWith(
            expect.objectContaining({
                purchase: expect.objectContaining({
                    id: PURCHASE_ID,
                    mpSubscriptionId: written.mpSubscriptionId
                }),
                source: 'plan-cancellation'
            })
        );
        expect(written.mpSubscriptionId).toBe(MP_PREAPPROVAL_ID);
    });

    it('CONTROL: the same row pointing at the add-on preapproval is NOT selected', async () => {
        // Arrange — the pre-fix value, and nothing else changed. This is the
        // production symptom: the sweep finds nothing, logs "skipping cleanup",
        // and the add-on outlives the plan that paid for it.
        const written = await checkoutAndReadRow();
        const misdirected = {
            ...written,
            id: PURCHASE_ID,
            status: 'active',
            deletedAt: null,
            subscriptionId: ADDON_SUBSCRIPTION_ID
        };
        const { db } = createFilteringDb([misdirected]);

        // Act
        const result = await handleSubscriptionCancellationAddons({
            subscriptionId: HOST_SUBSCRIPTION_ID,
            customerId: CUSTOMER_ID,
            billing,
            db: db as never
        });

        // Assert — proves the filter above is real rather than matching anything
        // handed to it.
        expect(result.totalProcessed).toBe(0);
        expect(mockRevokeAddon).not.toHaveBeenCalled();
    });
});
