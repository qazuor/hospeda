/**
 * Migration Tests: Addon Purchases Data Migration
 *
 * Covers:
 * - T-014a: Entitlement/limit backfill and idempotency
 * - T-014b: Plan restoration, dry-run mode, and error handling
 *
 * @module test/billing/migrate-addon-purchases
 */

import { createQZPayBilling } from '@qazuor/qzpay-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';

// ─── Mocks ──────────────────────────────────────────────────────────────────

// Mock @repo/logger
vi.mock('@repo/logger', () => ({
    createLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    })
}));

// Mock QZPay billing
const mockGrant = vi.fn();
const mockLimitsSet = vi.fn();
const mockGetStorage = vi.fn();
const mockBilling = {
    entitlements: { grant: mockGrant },
    limits: { set: mockLimitsSet },
    getStorage: mockGetStorage
};

vi.mock('@qazuor/qzpay-core', () => ({
    createQZPayBilling: vi.fn(() => mockBilling)
}));

// Mock drizzle-adapter
vi.mock('../../src/billing/drizzle-adapter.ts', () => ({
    createBillingAdapter: vi.fn(() => ({}))
}));

// Mock database
const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbReturning = vi.fn();
const mockDbValues = vi.fn();

const mockDb = {
    select: mockDbSelect,
    insert: mockDbInsert
};

// getDb is spied on in beforeEach to return mockDb

// Mock schemas
vi.mock('../../src/schemas/index.ts', () => ({
    billingAddonPurchases: {
        id: 'id',
        customerId: 'customer_id',
        subscriptionId: 'subscription_id',
        addonSlug: 'addon_slug',
        purchasedAt: 'purchased_at',
        status: 'status'
    }
}));

vi.mock('../../src/billing/schemas.ts', () => ({
    billingSubscriptions: {
        id: 'id',
        customerId: 'customer_id',
        planId: 'plan_id',
        metadata: 'metadata'
    }
}));

vi.mock('drizzle-orm', () => ({
    sql: vi.fn((_strings: TemplateStringsArray, ..._values: unknown[]) => ({
        type: 'sql'
    }))
}));

// Import after mocks
import { ALL_PLANS } from '@repo/billing';
import { migrateAddonPurchases } from '../../src/billing/migrate-addon-purchases';

// ─── Helpers ────────────────────────────────────────────────────────────────

function setupDbChain() {
    // Only set up the insert chain as default — select chains are always
    // configured per-test with mockReturnValueOnce since each test requires
    // different resolution values at different call sites.
    mockDbInsert.mockReturnValue({ values: mockDbValues });
    mockDbValues.mockReturnValue({ returning: mockDbReturning });
}

function createSubscription(overrides: Record<string, unknown> = {}) {
    return {
        id: 'sub_123',
        customerId: 'cust_123',
        metadata: {
            addonAdjustments: JSON.stringify([
                {
                    addonSlug: 'visibility-boost-7d',
                    entitlement: 'featured_listing',
                    appliedAt: '2026-01-15T10:00:00.000Z'
                }
            ])
        },
        ...overrides
    };
}

function createLimitSubscription(overrides: Record<string, unknown> = {}) {
    return {
        id: 'sub_456',
        customerId: 'cust_456',
        metadata: {
            addonAdjustments: JSON.stringify([
                {
                    addonSlug: 'extra-photos-20',
                    limitKey: 'max_photos_per_accommodation',
                    limitIncrease: 20,
                    appliedAt: '2026-01-20T10:00:00.000Z'
                }
            ])
        },
        ...overrides
    };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('migrateAddonPurchases', () => {
    beforeEach(() => {
        vi.spyOn(dbUtils, 'getDb').mockReturnValue(mockDb as any);
        vi.clearAllMocks();
        setupDbChain();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
    });

    // =========================================================================
    // T-014a: Backfill and idempotency
    // =========================================================================
    describe('entitlement/limit backfill and idempotency (T-014a)', () => {
        it('should insert addon purchase and grant entitlement for entitlement addons', async () => {
            // Subscriptions query returns one with entitlement addon
            const sub = createSubscription();

            // First call: fetch subscriptions
            mockDbSelect.mockReturnValueOnce({
                from: vi.fn().mockResolvedValue([sub])
            });

            // Second call: idempotency check (customerId + addonSlug + status='active')
            // No .limit() in the new implementation — chain ends at .where()
            mockDbSelect.mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([])
                })
            });

            // Insert returns generated ID
            mockDbReturning.mockResolvedValue([{ id: 'purchase_gen_1' }]);

            // Plan restoration: getStorage().plans.list returns empty
            mockGetStorage.mockReturnValue({
                plans: { list: vi.fn().mockResolvedValue({ data: [] }), update: vi.fn() }
            });

            const stats = await migrateAddonPurchases({ dryRun: false, verbose: true });

            expect(stats.addonsMigrated).toBe(1);
            expect(stats.entitlementsBackfilled).toBe(1);
            expect(mockGrant).toHaveBeenCalledWith(
                expect.objectContaining({
                    customerId: 'cust_123',
                    entitlementKey: 'featured_listing',
                    source: 'addon',
                    sourceId: 'purchase_gen_1'
                })
            );
        });

        it('should skip already existing addon purchases (idempotency)', async () => {
            const sub = createSubscription();

            // First call: fetch subscriptions
            mockDbSelect.mockReturnValueOnce({
                from: vi.fn().mockResolvedValue([sub])
            });

            // Second call: idempotency check - FOUND (already migrated).
            // The new implementation uses customerId + addonSlug + status only (no subscriptionId).
            // The chain ends at .where() — no .limit() call.
            // purchasedAt must match the appliedAt epoch so alreadyMigrated resolves to true.
            mockDbSelect.mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi
                        .fn()
                        .mockResolvedValue([
                            { id: 'existing_purchase', purchasedAt: '2026-01-15T10:00:00.000Z' }
                        ])
                })
            });

            // Plan restoration
            mockGetStorage.mockReturnValue({
                plans: { list: vi.fn().mockResolvedValue({ data: [] }), update: vi.fn() }
            });

            const stats = await migrateAddonPurchases({ dryRun: false, verbose: true });

            expect(stats.addonsSkipped).toBe(1);
            expect(stats.addonsMigrated).toBe(0);
            // Should NOT insert or grant
            expect(mockDbInsert).not.toHaveBeenCalled();
            expect(mockGrant).not.toHaveBeenCalled();
        });

        it('should handle entitlement grant failure non-fatally', async () => {
            const sub = createSubscription();

            // Fetch subscriptions
            mockDbSelect.mockReturnValueOnce({
                from: vi.fn().mockResolvedValue([sub])
            });

            // Idempotency check - not found (chain ends at .where(), no .limit())
            mockDbSelect.mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([])
                })
            });

            // Insert succeeds
            mockDbReturning.mockResolvedValue([{ id: 'purchase_gen_2' }]);

            // Grant FAILS
            mockGrant.mockRejectedValue(new Error('QZPay unavailable'));

            // Plan restoration
            mockGetStorage.mockReturnValue({
                plans: { list: vi.fn().mockResolvedValue({ data: [] }), update: vi.fn() }
            });

            const stats = await migrateAddonPurchases({ dryRun: false });

            // Addon was still migrated (insert succeeded)
            expect(stats.addonsMigrated).toBe(1);
            expect(stats.entitlementsBackfilled).toBe(0);
            // Error was recorded
            expect(stats.errors.length).toBe(1);
            expect(stats.errors[0]!.error).toContain('Entitlement grant failed');
        });

        it('should backfill limits for limit-type addons', async () => {
            const sub = createLimitSubscription();

            // Fetch subscriptions
            mockDbSelect.mockReturnValueOnce({
                from: vi.fn().mockResolvedValue([sub])
            });

            // Idempotency check - not found (chain ends at .where(), no .limit())
            mockDbSelect.mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([])
                })
            });

            // Insert succeeds
            mockDbReturning.mockResolvedValue([{ id: 'purchase_limit_1' }]);

            // getBasePlanLimit — now a TWO-query sequence (SPEC-168 T-021 fix):
            //
            // Query 1: billing_subscriptions — returns plan_id as UUID (per D1).
            //   chain: select -> from -> where -> limit
            mockDbSelect.mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi
                            .fn()
                            .mockResolvedValue([{ planId: 'aaaaaaaa-0000-0000-0000-000000000001' }])
                    })
                })
            });

            // Query 2: billing_plans — resolves UUID to slug so ALL_PLANS lookup works.
            //   chain: select -> from -> where -> limit
            // name='owner-basico' maps to the canonical ALL_PLANS entry with
            // max_photos_per_accommodation = 5 (basePlanLimit for owner-basico).
            mockDbSelect.mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi
                            .fn()
                            .mockResolvedValue([
                                { slug: 'owner-basico', metadata: { slug: 'owner-basico' } }
                            ])
                    })
                })
            });

            // Plan restoration
            mockGetStorage.mockReturnValue({
                plans: { list: vi.fn().mockResolvedValue({ data: [] }), update: vi.fn() }
            });

            const stats = await migrateAddonPurchases({ dryRun: false, verbose: true });

            expect(stats.addonsMigrated).toBe(1);
            expect(stats.limitsBackfilled).toBe(1);
            expect(mockLimitsSet).toHaveBeenCalledWith(
                expect.objectContaining({
                    customerId: 'cust_456',
                    limitKey: 'max_photos_per_accommodation',
                    maxValue: 25, // basePlanLimit(5) + limitIncrease(20)
                    source: 'addon',
                    sourceId: 'purchase_limit_1'
                })
            );
        });

        // ─── SPEC-168 T-021 regression test ─────────────────────────────────────
        it('T-021 regression: resolves plan by UUID (not slug), returning correct base limit', async () => {
            // Before the T-021 fix, getBasePlanLimit did:
            //   ALL_PLANS.find(p => p.slug === row.planId)
            // where row.planId was a UUID (e.g. 'aaaaaaaa-...'). No plan has a
            // slug that is a UUID, so the find always returned undefined, making
            // basePlanLimit always null and limitsBackfilled always 0.
            //
            // After the fix, getBasePlanLimit does two queries:
            //   1. billing_subscriptions: fetch plan_id UUID
            //   2. billing_plans: fetch name (slug) from that UUID
            // Then: ALL_PLANS.find(p => p.slug === resolvedSlug)

            const sub = createLimitSubscription();

            // Fetch subscriptions
            mockDbSelect.mockReturnValueOnce({
                from: vi.fn().mockResolvedValue([sub])
            });

            // Idempotency check — not found
            mockDbSelect.mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([])
                })
            });

            // Insert succeeds
            mockDbReturning.mockResolvedValue([{ id: 'purchase_regression_1' }]);

            // Query 1: billing_subscriptions returns a UUID plan_id (per D1).
            // A slug lookup on this UUID would return undefined in ALL_PLANS.
            const PLAN_UUID = 'deadbeef-0000-0000-0000-000000000001';
            mockDbSelect.mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([{ planId: PLAN_UUID }])
                    })
                })
            });

            // Query 2: billing_plans resolves the UUID → slug 'owner-basico'.
            // This is the fix: we look up billing_plans by UUID to get the slug.
            mockDbSelect.mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([{ slug: 'owner-basico', metadata: {} }])
                    })
                })
            });

            // Plan restoration
            mockGetStorage.mockReturnValue({
                plans: { list: vi.fn().mockResolvedValue({ data: [] }), update: vi.fn() }
            });

            const stats = await migrateAddonPurchases({ dryRun: false, verbose: true });

            // With the fix: limit is correctly resolved and backfilled.
            // Without the fix: limitsBackfilled would be 0 and errors would have
            // an entry about "Could not determine base plan limit".
            expect(stats.addonsMigrated).toBe(1);
            expect(stats.limitsBackfilled).toBe(1);
            expect(stats.errors).toHaveLength(0);
            expect(mockLimitsSet).toHaveBeenCalledWith(
                expect.objectContaining({
                    limitKey: 'max_photos_per_accommodation',
                    maxValue: 25, // owner-basico basePlanLimit(5) + limitIncrease(20)
                    source: 'addon',
                    sourceId: 'purchase_regression_1'
                })
            );
        });

        it('should handle subscriptions with no addonAdjustments', async () => {
            const sub = { id: 'sub_empty', customerId: 'cust_empty', metadata: {} };

            mockDbSelect.mockReturnValueOnce({
                from: vi.fn().mockResolvedValue([sub])
            });

            mockGetStorage.mockReturnValue({
                plans: { list: vi.fn().mockResolvedValue({ data: [] }), update: vi.fn() }
            });

            const stats = await migrateAddonPurchases({ dryRun: false });

            expect(stats.subscriptionsProcessed).toBe(1);
            expect(stats.addonsFound).toBe(0);
            expect(stats.addonsMigrated).toBe(0);
        });

        it('should handle malformed JSON in addonAdjustments', async () => {
            const sub = {
                id: 'sub_bad',
                customerId: 'cust_bad',
                metadata: { addonAdjustments: 'not valid json{' }
            };

            mockDbSelect.mockReturnValueOnce({
                from: vi.fn().mockResolvedValue([sub])
            });

            mockGetStorage.mockReturnValue({
                plans: { list: vi.fn().mockResolvedValue({ data: [] }), update: vi.fn() }
            });

            const stats = await migrateAddonPurchases({ dryRun: false });

            expect(stats.errors.length).toBe(1);
            expect(stats.errors[0]!.error).toContain('Failed to parse addonAdjustments');
        });
    });

    // =========================================================================
    // T-014b: Plan restoration, dry-run, and error handling
    // =========================================================================
    describe('plan restoration, dry-run, and error handling (T-014b)', () => {
        it('should restore plans to canonical config after migration', async () => {
            // No subscriptions with addons
            mockDbSelect.mockReturnValueOnce({
                from: vi.fn().mockResolvedValue([])
            });

            const mockPlanUpdate = vi.fn();
            mockGetStorage.mockReturnValue({
                plans: {
                    list: vi.fn().mockResolvedValue({
                        data: [
                            {
                                id: 'qzplan_1',
                                name: 'Basic',
                                metadata: { slug: 'owner-basico' },
                                entitlements: ['featured_listing'], // Mutated!
                                limits: { max_accommodations: 99 } // Mutated!
                            }
                        ]
                    }),
                    update: mockPlanUpdate
                }
            });

            const stats = await migrateAddonPurchases({ dryRun: false });

            expect(stats.plansRestored).toBe(1);
            expect(mockPlanUpdate).toHaveBeenCalledWith(
                'qzplan_1',
                expect.objectContaining({
                    entitlements: expect.arrayContaining(['publish_accommodations']),
                    limits: expect.objectContaining({
                        max_accommodations: 1,
                        max_photos_per_accommodation: 5
                    })
                })
            );
        });

        it('should handle plan restoration failure non-fatally', async () => {
            mockDbSelect.mockReturnValueOnce({
                from: vi.fn().mockResolvedValue([])
            });

            const mockPlanUpdate = vi.fn().mockRejectedValue(new Error('Update failed'));
            mockGetStorage.mockReturnValue({
                plans: {
                    list: vi.fn().mockResolvedValue({
                        data: [
                            {
                                id: 'qzplan_fail',
                                name: 'Basic',
                                metadata: { slug: 'owner-basico' },
                                entitlements: [],
                                limits: {}
                            }
                        ]
                    }),
                    update: mockPlanUpdate
                }
            });

            const stats = await migrateAddonPurchases({ dryRun: false });

            // Should NOT throw, but record error
            expect(stats.errors.length).toBe(1);
            expect(stats.errors[0]!.error).toContain('Plan restoration failed');
            expect(stats.plansRestored).toBe(0);
        });

        it('should skip plans with no canonical match', async () => {
            mockDbSelect.mockReturnValueOnce({
                from: vi.fn().mockResolvedValue([])
            });

            mockGetStorage.mockReturnValue({
                plans: {
                    list: vi.fn().mockResolvedValue({
                        data: [
                            {
                                id: 'qzplan_unknown',
                                name: 'Unknown Plan',
                                metadata: {},
                                entitlements: [],
                                limits: {}
                            }
                        ]
                    }),
                    update: vi.fn()
                }
            });

            const stats = await migrateAddonPurchases({ dryRun: false, verbose: true });

            expect(stats.plansRestored).toBe(0);
        });

        it('should not write to database in dry-run mode', async () => {
            const sub = createSubscription();

            mockDbSelect.mockReturnValueOnce({
                from: vi.fn().mockResolvedValue([sub])
            });

            const stats = await migrateAddonPurchases({ dryRun: true, verbose: true });

            expect(stats.addonsMigrated).toBe(1);
            // DB insert should NOT be called in dry-run
            expect(mockDbInsert).not.toHaveBeenCalled();
            // Billing grant should NOT be called in dry-run
            expect(mockGrant).not.toHaveBeenCalled();
            // Plan restoration should count but not call storage
            expect(stats.plansRestored).toBeGreaterThan(0);
            expect(mockGetStorage).not.toHaveBeenCalled();
        });

        it('should count all canonical plans for dry-run plan restoration', async () => {
            mockDbSelect.mockReturnValueOnce({
                from: vi.fn().mockResolvedValue([])
            });

            const stats = await migrateAddonPurchases({ dryRun: true, verbose: true });

            // Should count all canonical plans (dynamic — driven by ALL_PLANS config)
            expect(stats.plansRestored).toBeGreaterThan(0);
            expect(stats.plansRestored).toBe(ALL_PLANS.length);
        });

        it('should throw and record error when INSERT returns empty (GAP-038-17)', async () => {
            const sub = createSubscription();

            // Fetch subscriptions
            mockDbSelect.mockReturnValueOnce({
                from: vi.fn().mockResolvedValue([sub])
            });

            // Idempotency check - not found
            mockDbSelect.mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([])
                })
            });

            // INSERT returns empty array (no rows)
            mockDbReturning.mockResolvedValue([]);

            // Plan restoration
            mockGetStorage.mockReturnValue({
                plans: { list: vi.fn().mockResolvedValue({ data: [] }), update: vi.fn() }
            });

            const stats = await migrateAddonPurchases({ dryRun: false });

            // The thrown error should be caught by the outer try/catch and recorded
            expect(stats.addonsMigrated).toBe(0);
            expect(stats.errors.length).toBe(1);
            expect(stats.errors[0]!.error).toContain('INSERT returned empty');
            expect(stats.errors[0]!.error).toContain('possible constraint violation');
            // Entitlement grant should NOT have been attempted
            expect(mockGrant).not.toHaveBeenCalled();
        });

        it('should throw when billing initialization fails', async () => {
            // Force billing init failure by making createQZPayBilling throw

            vi.mocked(createQZPayBilling).mockImplementationOnce(() => {
                throw new Error('Missing storage adapter');
            });

            await expect(migrateAddonPurchases({ dryRun: false })).rejects.toThrow(
                'Billing initialization failed'
            );
        });

        it('should return complete statistics even with errors', async () => {
            const sub1 = createSubscription({ id: 'sub_a', customerId: 'cust_a' });
            const sub2 = {
                id: 'sub_b',
                customerId: 'cust_b',
                metadata: { addonAdjustments: 'broken json' }
            };

            mockDbSelect.mockReturnValueOnce({
                from: vi.fn().mockResolvedValue([sub1, sub2])
            });

            // sub_a: idempotency check - not found (chain ends at .where(), no .limit())
            mockDbSelect.mockReturnValueOnce({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue([])
                })
            });

            mockDbReturning.mockResolvedValue([{ id: 'purchase_a' }]);

            // Grant succeeds for sub_a
            mockGrant.mockResolvedValue(undefined);

            mockGetStorage.mockReturnValue({
                plans: { list: vi.fn().mockResolvedValue({ data: [] }), update: vi.fn() }
            });

            const stats = await migrateAddonPurchases({ dryRun: false });

            expect(stats.subscriptionsProcessed).toBe(2);
            expect(stats.addonsMigrated).toBe(1);
            expect(stats.errors.length).toBe(1);
            expect(stats.entitlementsBackfilled).toBe(1);
        });
    });
});
