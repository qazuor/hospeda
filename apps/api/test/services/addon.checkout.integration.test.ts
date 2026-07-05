/**
 * Integration test: full addon-checkout → accommodation-scoped featuring chain
 * (SPEC-309 T-025).
 *
 * Every other test in this suite (`addon.checkout.test.ts`,
 * `addon-entitlement.service.test.ts`) mocks ACROSS the service boundary —
 * `createMockEntitlementService()` stubs `applyAddonEntitlements()` entirely,
 * and `addon-entitlement.service.test.ts` never lets the FEATURED_LISTING
 * sync branch actually run (its `@repo/db` mock resolves an empty array, so
 * `grantLink` is falsy and the sync call is skipped). This file is the first
 * to exercise the REAL chain end to end:
 *
 *   createAddonCheckout → confirmAddonPurchase → AddonEntitlementService
 *   .applyAddonEntitlements → syncFeaturedByEntitlementForAccommodation
 *
 * against a SINGLE shared, stateful in-memory fake DB (not per-layer mocks),
 * so a value written by one layer (the `featured_listing_addon_grants` row)
 * is read back by the next layer for real. This is what proves the
 * addon-driven `featuredByEntitlement` flip is scoped to the single
 * purchased accommodation, not owner-wide (SPEC-309 OQ-3 / H-1).
 *
 * `syncFeaturedByEntitlementForAccommodation` and `resolveOwnerPlanGrantsFeatured`
 * (both from `@repo/service-core`) run for REAL against the fake DB — they
 * are never mocked.
 *
 * @module test/services/addon.checkout.integration.test
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { EntitlementKey, LimitKey } from '@repo/billing';
import type { PurchaseAddonInput } from '@repo/service-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Shared stateful fake DB (hoisted so every vi.mock() factory below can see
// it). A SINGLE in-memory store backs every `getDb()` call regardless of
// which layer (checkout / entitlement service / sync primitive) or which
// specifier (@repo/db, @repo/db/schemas, @repo/db/schemas/billing) resolves
// it — this is what makes the three layers genuinely integrated instead of
// three independently-mocked islands.
// ---------------------------------------------------------------------------

interface FakeAccommodationRow {
    id: string;
    ownerId: string;
    featuredByEntitlement: boolean;
    deletedAt: Date | null;
    slug: string;
}

interface FakeGrantRow {
    id: string;
    purchaseId: string;
    accommodationId: string;
}

type FakeCondition =
    | { readonly op: 'eq'; readonly col: string; readonly val: unknown }
    | { readonly op: 'isNull'; readonly col: string }
    | { readonly op: 'and'; readonly args: readonly FakeCondition[] };

type ProjectionMap = Record<string, string>;

const {
    ACCOMMODATIONS_TABLE,
    FEATURED_GRANTS_TABLE,
    BILLING_ADDON_PURCHASES_TABLE,
    accommodationsStore,
    grantsStore,
    resetFakeStore,
    mockGetDb,
    mockEq,
    mockAnd,
    mockIsNull,
    mockAccommodationFindById,
    mockWithTransaction,
    mockDbInsertReturning
} = vi.hoisted(() => {
    const ACCOMMODATIONS_TABLE = {
        id: 'id',
        ownerId: 'ownerId',
        deletedAt: 'deletedAt',
        slug: 'slug',
        featuredByEntitlement: 'featuredByEntitlement'
    } as const;

    const FEATURED_GRANTS_TABLE = {
        id: 'id',
        purchaseId: 'purchaseId',
        accommodationId: 'accommodationId'
    } as const;

    const BILLING_ADDON_PURCHASES_TABLE = {
        id: 'id',
        customerId: 'customerId',
        addonSlug: 'addonSlug',
        status: 'status',
        deletedAt: 'deletedAt',
        subscriptionId: 'subscriptionId',
        purchasedAt: 'purchasedAt',
        expiresAt: 'expiresAt',
        paymentId: 'paymentId',
        limitAdjustments: 'limitAdjustments',
        entitlementAdjustments: 'entitlementAdjustments',
        metadata: 'metadata'
    } as const;

    const accommodationsStore = new Map<string, FakeAccommodationRow>();
    const grantsStore: FakeGrantRow[] = [];

    function resetFakeStore(seed: FakeAccommodationRow[]): void {
        accommodationsStore.clear();
        for (const row of seed) {
            accommodationsStore.set(row.id, { ...row });
        }
        grantsStore.length = 0;
    }

    function matchesCondition(row: Record<string, unknown>, cond: FakeCondition): boolean {
        if (cond.op === 'eq') return row[cond.col] === cond.val;
        if (cond.op === 'isNull') return row[cond.col] === null || row[cond.col] === undefined;
        return cond.args.every((c) => matchesCondition(row, c));
    }

    function project(row: Record<string, unknown>, proj?: ProjectionMap): Record<string, unknown> {
        if (!proj) return { ...row };
        const out: Record<string, unknown> = {};
        for (const [outKey, colMarker] of Object.entries(proj)) {
            out[outKey] = row[colMarker];
        }
        return out;
    }

    function isAccommodationsTable(table: Record<string, string>): boolean {
        return table === ACCOMMODATIONS_TABLE;
    }

    function isGrantsTable(table: Record<string, string>): boolean {
        return table === FEATURED_GRANTS_TABLE;
    }

    function buildFakeDb() {
        return {
            select(proj?: ProjectionMap) {
                return {
                    from(table: Record<string, string>) {
                        return {
                            where(cond: FakeCondition): Promise<Record<string, unknown>[]> {
                                if (isAccommodationsTable(table)) {
                                    const rows = [...accommodationsStore.values()].filter((r) =>
                                        matchesCondition(
                                            r as unknown as Record<string, unknown>,
                                            cond
                                        )
                                    );
                                    return Promise.resolve(
                                        rows.map((r) =>
                                            project(r as unknown as Record<string, unknown>, proj)
                                        )
                                    );
                                }
                                if (isGrantsTable(table)) {
                                    const rows = grantsStore.filter((r) =>
                                        matchesCondition(
                                            r as unknown as Record<string, unknown>,
                                            cond
                                        )
                                    );
                                    return Promise.resolve(
                                        rows.map((r) =>
                                            project(r as unknown as Record<string, unknown>, proj)
                                        )
                                    );
                                }
                                // billing_addon_purchases (or anything else): this fake never
                                // tracks purchase rows read via getDb() — the transaction-based
                                // insert (@repo/db/client mock) owns that table. An empty array
                                // keeps the limit-aggregation loop a safe, assertion-irrelevant no-op.
                                return Promise.resolve([]);
                            }
                        };
                    }
                };
            },
            update(table: Record<string, string>) {
                return {
                    set(values: Record<string, unknown>) {
                        return {
                            where(cond: FakeCondition) {
                                if (isAccommodationsTable(table)) {
                                    const matched: FakeAccommodationRow[] = [];
                                    for (const row of accommodationsStore.values()) {
                                        if (
                                            matchesCondition(
                                                row as unknown as Record<string, unknown>,
                                                cond
                                            )
                                        ) {
                                            Object.assign(row, values);
                                            matched.push(row);
                                        }
                                    }
                                    return Object.assign(Promise.resolve(matched), {
                                        returning(proj2?: ProjectionMap) {
                                            return Promise.resolve(
                                                matched.map((r) =>
                                                    project(
                                                        r as unknown as Record<string, unknown>,
                                                        proj2
                                                    )
                                                )
                                            );
                                        }
                                    });
                                }
                                // Generic no-op update (e.g. the needsEntitlementSync flag write
                                // on billing_addon_purchases) — never asserted on in this suite.
                                return Object.assign(Promise.resolve(undefined), {
                                    returning() {
                                        return Promise.resolve([]);
                                    }
                                });
                            }
                        };
                    }
                };
            },
            insert(table: Record<string, string>) {
                return {
                    values(values: Record<string, unknown>) {
                        if (isGrantsTable(table)) {
                            grantsStore.push({
                                id: `grant_${grantsStore.length + 1}`,
                                purchaseId: values.purchaseId as string,
                                accommodationId: values.accommodationId as string
                            });
                        }
                        return Promise.resolve(undefined);
                    }
                };
            }
        };
    }

    // ── billing_addon_purchases INSERT (via withTransaction, SPEC-064 pattern) ──
    // Mirrors addon.checkout.test.ts's mockWithTransaction/mockDbInsertReturning
    // convention. This is a SEPARATE path from the fake DB above — the purchase
    // row insert never lands in `accommodationsStore`/`grantsStore`, only the
    // returned `purchaseId` matters for the rest of the chain.
    const mockDbInsertReturning = vi.fn();
    const mockDbInsertValues = vi.fn(() => ({ returning: mockDbInsertReturning }));
    const mockDbInsert = vi.fn(() => ({ values: mockDbInsertValues }));
    const mockTxExecute = vi.fn().mockResolvedValue({ rows: [] });

    const mockWithTransaction = vi.fn(
        async (
            callback: (tx: {
                insert: typeof mockDbInsert;
                execute: typeof mockTxExecute;
            }) => Promise<unknown>
        ) => callback({ insert: mockDbInsert, execute: mockTxExecute })
    );

    return {
        ACCOMMODATIONS_TABLE,
        FEATURED_GRANTS_TABLE,
        BILLING_ADDON_PURCHASES_TABLE,
        accommodationsStore,
        grantsStore,
        resetFakeStore,
        mockGetDb: vi.fn(() => buildFakeDb()),
        mockEq: vi.fn(
            (col: unknown, val: unknown): FakeCondition => ({ op: 'eq', col: col as string, val })
        ),
        mockAnd: vi.fn((...args: FakeCondition[]): FakeCondition => ({ op: 'and', args })),
        mockIsNull: vi.fn((col: unknown): FakeCondition => ({ op: 'isNull', col: col as string })),
        mockAccommodationFindById: vi.fn(async (id: string) => accommodationsStore.get(id) ?? null),
        mockWithTransaction,
        mockDbInsertReturning
    };
});

// ---------------------------------------------------------------------------
// @repo/db — real module spread, overriding only the pieces this test needs
// to route through the shared fake store. Everything else (billingCustomers,
// billingPlans, gt, or, sql, notInArray, ...) stays real so the transitively
// imported `featured-entitlement.resolver.ts` module loads without crashing,
// even though its functions are never invoked by the active:true path used here.
// ---------------------------------------------------------------------------
vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        accommodations: ACCOMMODATIONS_TABLE,
        eq: mockEq,
        and: mockAnd,
        isNull: mockIsNull,
        getDb: mockGetDb,
        AccommodationModel: vi.fn().mockImplementation(function () {
            return { findById: mockAccommodationFindById };
        })
    };
});

// drizzle-orm's own eq/and/isNull (imported directly by addon-entitlement.service.ts)
// must produce the SAME condition shape as the @repo/db overrides above, or the
// fake DB's `.where()` evaluator would see two incompatible predicate shapes for
// the same logical query. `sql` / `notInArray` / everything else stays real.
vi.mock('drizzle-orm', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        eq: mockEq,
        and: mockAnd,
        isNull: mockIsNull
    };
});

// @repo/db/schemas — statically imported by addon-entitlement.service.ts.
// Table objects are the SAME shared references as @repo/db's `accommodations`
// override above (identity-compared by the fake DB's `.from(table)` routing).
vi.mock('@repo/db/schemas', () => ({
    accommodations: ACCOMMODATIONS_TABLE,
    billingAddonPurchases: BILLING_ADDON_PURCHASES_TABLE,
    featuredListingAddonGrants: FEATURED_GRANTS_TABLE
}));

// @repo/db/schemas/billing — dynamically imported inside addon.checkout.ts's
// confirmAddonPurchase (both for the billing_addon_purchases insert values and
// the featured_listing_addon_grants link-row insert).
vi.mock('@repo/db/schemas/billing', () => ({
    billingAddonPurchases: BILLING_ADDON_PURCHASES_TABLE,
    featuredListingAddonGrants: FEATURED_GRANTS_TABLE
}));

// @repo/db/client — dynamically imported inside confirmAddonPurchase for the
// billing_addon_purchases transactional insert. Each test controls the
// returned purchaseId via mockDbInsertReturning.mockResolvedValueOnce(...).
vi.mock('@repo/db/client', () => ({
    getDb: vi.fn(() => ({ transaction: vi.fn() })),
    withTransaction: mockWithTransaction
}));

// @repo/service-core — real module spread. syncFeaturedByEntitlementForAccommodation
// and resolveOwnerPlanGrantsFeatured run for REAL against the fake DB above;
// only the addon/plan catalog lookups and the commerce-subscription filter are
// stubbed (matching addon-entitlement.service.test.ts's convention).
const { mockAddonCatalogGetBySlug, mockPlanGetById, mockPlanGetBySlug } = vi.hoisted(() => ({
    mockAddonCatalogGetBySlug: vi.fn(),
    mockPlanGetById: vi.fn(),
    mockPlanGetBySlug: vi.fn()
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        AddonCatalogService: vi.fn().mockImplementation(function () {
            return { getBySlug: mockAddonCatalogGetBySlug };
        }),
        PlanService: vi.fn().mockImplementation(function () {
            return {
                getById: mockPlanGetById,
                getBySlug: mockPlanGetBySlug
            };
        }),
        isAccommodationSubscription: () => true
    };
});

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

vi.mock('../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: vi.fn()
}));

vi.mock('../../src/lib/sentry', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../src/lib/sentry')>();
    return { ...actual, captureBillingError: vi.fn() };
});

// HOSPEDA_BILLING_POLLING_ENABLED: false skips the polling-fallback branch
// entirely (irrelevant to this test), so billing.getStorage() never needs a mock.
vi.mock('../../src/utils/env', () => ({
    env: {
        HOSPEDA_SITE_URL: 'https://hospeda.test',
        HOSPEDA_API_URL: 'https://api.hospeda.test',
        HOSPEDA_BILLING_POLLING_ENABLED: false
    }
}));

// ---------------------------------------------------------------------------
// Imports AFTER mocks are in place
// ---------------------------------------------------------------------------
import { AddonEntitlementService } from '../../src/services/addon-entitlement.service';
import { confirmAddonPurchase, createAddonCheckout } from '../../src/services/addon.checkout';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CUSTOMER_ID = 'cust_owner_integration';
const OWNER_USER_ID = 'user_owner_integration';
const TARGET_ACCOMMODATION_ID = 'accom-target-1';
const SIBLING_ACCOMMODATION_ID = 'accom-sibling-1';

/**
 * Builds a QZPayBilling stub covering exactly the surface exercised by
 * createAddonCheckout, confirmAddonPurchase, and the REAL AddonEntitlementService.
 */
function createIntegrationBilling(): QZPayBilling {
    return {
        customers: {
            get: vi.fn().mockResolvedValue({
                id: CUSTOMER_ID,
                email: 'owner@example.com',
                metadata: { name: 'Owner Integration Test', userId: OWNER_USER_ID }
            })
        },
        subscriptions: {
            getByCustomerId: vi
                .fn()
                .mockResolvedValue([{ id: 'sub_001', status: 'active', planId: 'plan_basico' }])
        },
        checkout: {
            create: vi.fn().mockResolvedValue({
                id: 'session_integration_test',
                providerInitPoint: 'https://www.mercadopago.com.ar/checkout/test',
                expiresAt: new Date('2030-01-01T00:30:00Z')
            })
        },
        entitlements: {
            grant: vi.fn().mockResolvedValue(undefined)
        },
        limits: {
            set: vi.fn().mockResolvedValue(undefined)
        },
        getStorage: vi.fn().mockReturnValue({ subscriptionPollingJobs: undefined })
    } as unknown as QZPayBilling;
}

describe('addon checkout → accommodation-scoped featuring (SPEC-309 T-025 integration)', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        resetFakeStore([
            {
                id: TARGET_ACCOMMODATION_ID,
                ownerId: OWNER_USER_ID,
                featuredByEntitlement: false,
                deletedAt: null,
                slug: 'target-accommodation'
            },
            {
                id: SIBLING_ACCOMMODATION_ID,
                ownerId: OWNER_USER_ID,
                featuredByEntitlement: false,
                deletedAt: null,
                slug: 'sibling-accommodation'
            }
        ]);

        mockAddonCatalogGetBySlug.mockImplementation(async function (slug: string) {
            if (slug === 'visibility-boost-7d') {
                return {
                    success: true,
                    data: {
                        slug: 'visibility-boost-7d',
                        name: 'Visibility Boost 7d',
                        description: 'Boost visibility for 7 days',
                        billingType: 'one_time' as const,
                        priceArs: 300000,
                        durationDays: 7,
                        isActive: true,
                        targetCategories: ['owner', 'complex'] as const,
                        sortOrder: 2,
                        affectsLimitKey: null,
                        limitIncrease: null,
                        grantsEntitlement: EntitlementKey.FEATURED_LISTING,
                        requiresAccommodationTarget: true
                    }
                };
            }
            if (slug === 'extra-photos-20') {
                return {
                    success: true,
                    data: {
                        slug: 'extra-photos-20',
                        name: 'Extra Photos 20',
                        description: 'Add 20 extra photos',
                        billingType: 'recurring' as const,
                        priceArs: 500000,
                        durationDays: null,
                        isActive: true,
                        targetCategories: ['owner'] as const,
                        sortOrder: 1,
                        affectsLimitKey: LimitKey.MAX_PHOTOS_PER_ACCOMMODATION,
                        limitIncrease: 20,
                        grantsEntitlement: null,
                        requiresAccommodationTarget: false
                    }
                };
            }
            return {
                success: false,
                error: { code: 'NOT_FOUND', message: `Add-on '${slug}' not found` }
            };
        });

        mockPlanGetById.mockResolvedValue({ success: false, error: { code: 'NOT_FOUND' } });
        mockPlanGetBySlug.mockResolvedValue({ success: false, error: { code: 'NOT_FOUND' } });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('carries accommodationId through checkout metadata, then confirms and flips featuredByEntitlement on ONLY the target accommodation', async () => {
        const billing = createIntegrationBilling();

        // Step 1 (T-006): checkout validates ownership and carries the target
        // accommodation forward via checkout.create's metadata.
        const checkoutInput: PurchaseAddonInput = {
            customerId: CUSTOMER_ID,
            addonSlug: 'visibility-boost-7d',
            userId: OWNER_USER_ID,
            accommodationId: TARGET_ACCOMMODATION_ID
        };
        const checkoutResult = await createAddonCheckout(billing, checkoutInput);

        expect(checkoutResult.success).toBe(true);
        expect(mockAccommodationFindById).toHaveBeenCalledWith(TARGET_ACCOMMODATION_ID);
        expect(vi.mocked(billing.checkout.create)).toHaveBeenCalledOnce();
        const checkoutCreateArg = vi.mocked(billing.checkout.create).mock.calls[0]?.[0] as {
            metadata?: Record<string, unknown>;
        };
        expect(checkoutCreateArg.metadata).toMatchObject({
            accommodation_id: TARGET_ACCOMMODATION_ID,
            accommodationId: TARGET_ACCOMMODATION_ID
        });

        // Step 2 (T-007 + T-015 + T-005/T-022, real chain): the MercadoPago webhook
        // handler would extract metadata.accommodationId from the payment payload
        // and forward it here — simulated directly since the webhook itself is out
        // of scope for this integration test.
        mockDbInsertReturning.mockResolvedValueOnce([{ id: 'purchase-target-boost' }]);
        const entitlementService = new AddonEntitlementService(billing);

        const confirmResult = await confirmAddonPurchase(billing, entitlementService, {
            customerId: CUSTOMER_ID,
            addonSlug: 'visibility-boost-7d',
            paymentId: 'pay_boost_1',
            metadata: { accommodationId: TARGET_ACCOMMODATION_ID }
        });

        expect(confirmResult.success).toBe(true);

        // Step 3: exactly one grant row links the purchase to the target accommodation.
        expect(grantsStore).toHaveLength(1);
        expect(grantsStore[0]).toMatchObject({
            purchaseId: 'purchase-target-boost',
            accommodationId: TARGET_ACCOMMODATION_ID
        });

        // Step 4: the target accommodation is now featured...
        expect(accommodationsStore.get(TARGET_ACCOMMODATION_ID)?.featuredByEntitlement).toBe(true);

        // Step 5: ...but the sibling (same owner, no addon grant) is NOT — addon-driven
        // featuring is accommodation-scoped, not owner-wide (SPEC-309 OQ-3 / H-1). An
        // owner-wide plan grant would have flipped both; this proves it flips exactly one.
        expect(accommodationsStore.get(SIBLING_ACCOMMODATION_ID)?.featuredByEntitlement).toBe(
            false
        );
    });

    it('does NOT write a featured_listing_addon_grants row or touch any accommodation for a non-target-required addon', async () => {
        const billing = createIntegrationBilling();
        const entitlementService = new AddonEntitlementService(billing);

        mockDbInsertReturning.mockResolvedValueOnce([{ id: 'purchase-extra-photos' }]);

        const confirmResult = await confirmAddonPurchase(billing, entitlementService, {
            customerId: CUSTOMER_ID,
            addonSlug: 'extra-photos-20',
            paymentId: 'pay_photos_1'
        });

        expect(confirmResult.success).toBe(true);
        expect(grantsStore).toHaveLength(0);
        expect(accommodationsStore.get(TARGET_ACCOMMODATION_ID)?.featuredByEntitlement).toBe(false);
        expect(accommodationsStore.get(SIBLING_ACCOMMODATION_ID)?.featuredByEntitlement).toBe(
            false
        );
    });
});
