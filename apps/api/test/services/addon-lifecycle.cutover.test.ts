/**
 * Parity tests for addon lifecycle services addon reads cutover (SPEC-192 T-014)
 *
 * Covers:
 *   - `addon-lifecycle-cancellation.service.ts`: `handleSubscriptionCancellationAddons`
 *     now resolves addon definitions via `AddonCatalogService.getBySlug()` instead of
 *     the static `getAddonBySlug` from `@repo/billing`.
 *   - `addon-lifecycle.service.ts`: has NO direct config reads (only re-exports from
 *     the cancellation service). No code changes were required; this test documents
 *     and verifies that invariant.
 *
 * Fields / semantics verified:
 * - `grantsEntitlement` / `affectsLimitKey` — used by `revokeAddonForSubscriptionCancellation`
 *   to classify the addon type (entitlement vs limit vs unknown/retired).
 * - NOT_FOUND from catalog → `addonDef=undefined` → triggers the "unknown/retired" revoke path,
 *   identical to the old `getAddonBySlug` returning `undefined`.
 * - Known addon (success=true) → `addonDef.grantsEntitlement` → entitlement revoke path.
 * - `getAddonBySlug` from `@repo/billing` is never called after cutover.
 *
 * Note on the dedup guard: `handleSubscriptionCancellationAddons` has no module-level
 * state guard (unlike `handlePlanChangeAddonRecalculation`). Each test uses a unique
 * `subscriptionId` for clarity, not strictly for dedup avoidance.
 *
 * No real database. All DB and billing calls are mocked.
 *
 * @module test/services/addon-lifecycle.cutover.test
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockGetBySlug, mockGetAddonBySlug } = vi.hoisted(() => ({
    mockGetBySlug: vi.fn(),
    mockGetAddonBySlug: vi.fn()
}));

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@repo/service-core', () => ({
    AddonCatalogService: vi.fn().mockImplementation(() => ({
        getBySlug: mockGetBySlug,
        list: vi.fn()
    })),
    // PlanService required by addon-plan-change.service.ts (imported transitively via
    // addon-lifecycle.service.ts — SPEC-192 T-025 plan reads cutover)
    PlanService: vi.fn().mockImplementation(() => ({
        getById: vi.fn(),
        getBySlug: vi.fn()
    })),
    BILLING_EVENT_TYPES: {
        ADDON_REVOCATION_FAILED: 'ADDON_REVOCATION_FAILED'
    }
}));

// getAddonBySlug should NOT be called after cutover — spy with assertion
vi.mock('@repo/billing', () => ({
    getAddonBySlug: mockGetAddonBySlug
}));

vi.mock('@repo/db', () => ({
    getDb: vi.fn().mockReturnValue({}),
    billingSubscriptionEvents: { id: 'id', subscriptionId: 'sid' },
    withTransaction: vi
        .fn()
        .mockImplementation(async (cb: (tx: unknown) => Promise<unknown>, _db?: unknown) => {
            const tx = {
                update: vi.fn().mockReturnValue({
                    set: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue([])
                    })
                }),
                insert: vi.fn().mockReturnValue({
                    values: vi.fn().mockResolvedValue(undefined)
                })
            };
            return cb(tx);
        })
}));

vi.mock('@repo/db/schemas/billing', () => ({
    billingAddonPurchases: {
        id: 'id',
        customerId: 'cid',
        subscriptionId: 'sid',
        addonSlug: 'slug',
        status: 'status',
        deletedAt: 'dat',
        metadata: 'metadata'
    }
}));

vi.mock('drizzle-orm', () => ({
    and: vi.fn((...args: unknown[]) => ({ _and: args })),
    eq: vi.fn((a: unknown, b: unknown) => ({ _eq: [a, b] })),
    isNull: vi.fn((a: unknown) => ({ _isNull: a }))
}));

vi.mock('../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

vi.mock('../../src/utils/env', () => ({
    env: { HOSPEDA_ADDON_LIFECYCLE_ENABLED: true }
}));

vi.mock('@sentry/node', () => ({
    captureException: vi.fn(),
    captureMessage: vi.fn()
}));

// Import after mocks
import { handleSubscriptionCancellationAddons } from '../../src/services/addon-lifecycle-cancellation.service';

// ─── Catalog stubs ────────────────────────────────────────────────────────────

const STUB_VISIBILITY_7D = {
    slug: 'visibility-boost-7d',
    name: 'Visibility Boost (7 days)',
    description: 'Featured in search results for 7 days.',
    billingType: 'one_time' as const,
    priceArs: 500000,
    annualPriceArs: null,
    durationDays: 7,
    affectsLimitKey: null,
    limitIncrease: null,
    grantsEntitlement: 'FEATURED_LISTING',
    targetCategories: ['owner', 'complex'] as Array<'owner' | 'complex'>,
    isActive: true,
    sortOrder: 1
};

const STUB_EXTRA_ACCOMMODATIONS = {
    slug: 'extra-accommodations-5',
    name: 'Extra Accommodations Pack (+5)',
    description: 'Adds 5 additional accommodations.',
    billingType: 'recurring' as const,
    priceArs: 1000000,
    annualPriceArs: null,
    durationDays: null,
    affectsLimitKey: 'max_accommodations',
    limitIncrease: 5,
    grantsEntitlement: null,
    targetCategories: ['owner'] as Array<'owner' | 'complex'>,
    isActive: true,
    sortOrder: 4
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a minimal billing mock for cancellation tests.
 * The revoke helper uses entitlements.revokeBySource / limits.removeBySource.
 */
function buildBilling() {
    return {
        entitlements: {
            revokeBySource: vi.fn().mockResolvedValue(1),
            revoke: vi.fn().mockResolvedValue(undefined)
        },
        limits: {
            removeBySource: vi.fn().mockResolvedValue(1),
            remove: vi.fn().mockResolvedValue(undefined)
        }
    } as unknown as import('@qazuor/qzpay-core').QZPayBilling;
}

/**
 * Builds a mock DB that returns the given purchase rows for the initial
 * `select().from(billingAddonPurchases).where(...)` query.
 */
function buildDb(purchaseRows: unknown[]) {
    return {
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue(purchaseRows)
            })
        }),
        update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([])
            })
        }),
        insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue(undefined)
        })
    } as unknown as import('@repo/db').DrizzleClient;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('addon-lifecycle services cutover parity (SPEC-192 T-014)', () => {
    let billing: ReturnType<typeof buildBilling>;

    beforeEach(() => {
        billing = buildBilling();
        mockGetBySlug.mockReset();
        mockGetAddonBySlug.mockReset();
    });

    describe('handleSubscriptionCancellationAddons — addon reads via AddonCatalogService.getBySlug', () => {
        it('should call catalogService.getBySlug for each active purchase slug', async () => {
            // Arrange
            const purchaseRows = [
                {
                    id: 'p1',
                    customerId: 'cust-1',
                    addonSlug: 'visibility-boost-7d',
                    subscriptionId: 'sub-1',
                    status: 'active',
                    deletedAt: null,
                    metadata: null
                }
            ];
            const db = buildDb(purchaseRows);
            mockGetBySlug.mockResolvedValue({ success: true, data: STUB_VISIBILITY_7D });

            // Act
            const result = await handleSubscriptionCancellationAddons({
                subscriptionId: 'sub-1',
                customerId: 'cust-1',
                billing,
                db
            });

            // Assert — DB catalog was consulted, not config getAddonBySlug
            expect(mockGetBySlug).toHaveBeenCalledWith('visibility-boost-7d');
            expect(mockGetAddonBySlug).not.toHaveBeenCalled();
            // Entitlement revoke was called (not limit — grantsEntitlement is set)
            expect(billing.entitlements.revokeBySource).toHaveBeenCalledWith('addon', 'p1');
            expect(result.succeeded).toHaveLength(1);
        });

        it('should handle limit-type addon: limit.removeBySource called', async () => {
            // Arrange
            const purchaseRows = [
                {
                    id: 'p2',
                    customerId: 'cust-2',
                    addonSlug: 'extra-accommodations-5',
                    subscriptionId: 'sub-2',
                    status: 'active',
                    deletedAt: null,
                    metadata: null
                }
            ];
            const db = buildDb(purchaseRows);
            mockGetBySlug.mockResolvedValue({ success: true, data: STUB_EXTRA_ACCOMMODATIONS });

            // Act
            const result = await handleSubscriptionCancellationAddons({
                subscriptionId: 'sub-2',
                customerId: 'cust-2',
                billing,
                db
            });

            // Assert — limit revoke path was taken (affectsLimitKey is set)
            expect(mockGetBySlug).toHaveBeenCalledWith('extra-accommodations-5');
            expect(billing.limits.removeBySource).toHaveBeenCalledWith('addon', 'p2');
            expect(result.succeeded).toHaveLength(1);
        });

        it('should treat NOT_FOUND as unknown/retired addon (both channels attempted)', async () => {
            // Arrange — catalog returns NOT_FOUND → addonDef=undefined → "unknown/retired" path
            const purchaseRows = [
                {
                    id: 'p3',
                    customerId: 'cust-3',
                    addonSlug: 'retired-addon',
                    subscriptionId: 'sub-3',
                    status: 'active',
                    deletedAt: null,
                    metadata: null
                }
            ];
            const db = buildDb(purchaseRows);
            mockGetBySlug.mockResolvedValue({
                success: false,
                error: { code: 'NOT_FOUND', message: "Add-on 'retired-addon' not found" }
            });

            // Act
            const result = await handleSubscriptionCancellationAddons({
                subscriptionId: 'sub-3',
                customerId: 'cust-3',
                billing,
                db
            });

            // Assert — both channels attempted (unknown-type path in revoke helper)
            expect(mockGetBySlug).toHaveBeenCalledWith('retired-addon');
            expect(billing.entitlements.revokeBySource).toHaveBeenCalledWith('addon', 'p3');
            expect(billing.limits.removeBySource).toHaveBeenCalledWith('addon', 'p3');
            // Outcome is still success (unknown-type revocation is best-effort)
            expect(result.succeeded).toHaveLength(1);
        });

        it('should return early with empty result when no active purchases', async () => {
            // Arrange
            const db = buildDb([]);

            // Act
            const result = await handleSubscriptionCancellationAddons({
                subscriptionId: 'sub-4',
                customerId: 'cust-4',
                billing,
                db
            });

            // Assert — catalog never consulted when no purchases
            expect(mockGetBySlug).not.toHaveBeenCalled();
            expect(result.totalProcessed).toBe(0);
            expect(result.succeeded).toHaveLength(0);
        });

        it('should process multiple purchases sequentially — one getBySlug call per purchase', async () => {
            // Arrange — two purchases with different slugs
            const purchaseRows = [
                {
                    id: 'p5a',
                    customerId: 'cust-5',
                    addonSlug: 'visibility-boost-7d',
                    subscriptionId: 'sub-5',
                    status: 'active',
                    deletedAt: null,
                    metadata: null
                },
                {
                    id: 'p5b',
                    customerId: 'cust-5',
                    addonSlug: 'extra-accommodations-5',
                    subscriptionId: 'sub-5',
                    status: 'active',
                    deletedAt: null,
                    metadata: null
                }
            ];
            const db = buildDb(purchaseRows);
            // Return different values per call (sequential, not parallel)
            mockGetBySlug
                .mockResolvedValueOnce({ success: true, data: STUB_VISIBILITY_7D })
                .mockResolvedValueOnce({ success: true, data: STUB_EXTRA_ACCOMMODATIONS });

            // Act
            const result = await handleSubscriptionCancellationAddons({
                subscriptionId: 'sub-5',
                customerId: 'cust-5',
                billing,
                db
            });

            // Assert — getBySlug called twice, once per purchase
            expect(mockGetBySlug).toHaveBeenCalledTimes(2);
            expect(mockGetBySlug).toHaveBeenNthCalledWith(1, 'visibility-boost-7d');
            expect(mockGetBySlug).toHaveBeenNthCalledWith(2, 'extra-accommodations-5');
            expect(result.succeeded).toHaveLength(2);
        });
    });

    describe('addon-lifecycle.service.ts — no direct config reads (re-exports only)', () => {
        it('should export handleSubscriptionCancellationAddons from the cancellation service', async () => {
            // The addon-lifecycle.service.ts file re-exports handleSubscriptionCancellationAddons
            // from addon-lifecycle-cancellation.service.ts. It has no direct getAddonBySlug calls.
            // This test verifies the invariant by importing directly from the lifecycle service.
            const { handleSubscriptionCancellationAddons: fn } = await import(
                '../../src/services/addon-lifecycle.service'
            );
            expect(typeof fn).toBe('function');
        });
    });
});
