/**
 * Integration Tests — Addon Lifecycle Cancellation Flow (SPEC-043)
 *
 * Service-level integration tests that wire together:
 * - `handleSubscriptionCancellationAddons` (addon-lifecycle-cancellation.service)
 * - `revokeAddonForSubscriptionCancellation` (addon-lifecycle.service)
 *
 * These tests verify end-to-end orchestration between the cancellation handler,
 * the QZPay billing mock, and the Drizzle DB mock. No HTTP server is spun up.
 *
 * Test cases:
 *   1. Webhook cancellation E2E — happy path (limit addon)
 *   2. Webhook cancellation E2E — happy path (entitlement addon)
 *   3. Admin cancellation E2E — two active addons, Phase 1 + Phase 2 executed
 *   4. Admin cancellation E2E — Phase 1 QZPay failure aborts and throws
 *   5. Idempotent webhook retry — second call finds no active addons, 0 processed
 *   6. Partial failure preserves progress — retry only reprocesses the failed addon
 *   7. Customer with no addons — short-circuits immediately without side-effects
 *   8. Unknown/retired addon — best-effort revocation on both QZPay channels
 *
 * @module test/integration/addon-lifecycle-cancellation
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleSubscriptionCancellationAddons } from '../../src/services/addon-lifecycle-cancellation.service.js';
import type { CancellationResult } from '../../src/services/addon-lifecycle-cancellation.service.js';

// ─── Hoisted mock setup ────────────────────────────────────────────────────────
//
// vi.hoisted runs before vi.mock factory bodies so these stubs can be closed
// over inside mock factory functions.

const {
    mockDbSelectWhere,
    mockDbSelectFrom: _mockDbSelectFrom,
    mockDbSelect,
    mockDbUpdateWhere,
    mockDbUpdateSet,
    mockDbUpdate,
    mockClearEntitlementCache,
    mockSentryCaptureException,
    mockRevokeLimitBySource,
    mockRevokeLimit,
    mockRevokeEntitlementBySource,
    mockRevokeEntitlement
} = vi.hoisted(() => {
    // select() chain: select().from().where()  — returns rows array
    const mockDbSelectWhere = vi.fn().mockResolvedValue([]);
    const mockDbSelectFrom = vi.fn(() => ({ where: mockDbSelectWhere }));
    const mockDbSelect = vi.fn(() => ({ from: mockDbSelectFrom }));

    // update() chain: update().set().where()
    const mockDbUpdateWhere = vi.fn().mockResolvedValue({ rowCount: 1 });
    const mockDbUpdateSet = vi.fn(() => ({ where: mockDbUpdateWhere }));
    const mockDbUpdate = vi.fn(() => ({ set: mockDbUpdateSet }));

    const mockClearEntitlementCache = vi.fn();
    const mockSentryCaptureException = vi.fn();

    // QZPay billing stubs (configured per test)
    const mockRevokeLimitBySource = vi.fn().mockResolvedValue(1);
    const mockRevokeLimit = vi.fn().mockResolvedValue(undefined);
    const mockRevokeEntitlementBySource = vi.fn().mockResolvedValue(1);
    const mockRevokeEntitlement = vi.fn().mockResolvedValue(undefined);

    return {
        mockDbSelectWhere,
        mockDbSelectFrom,
        mockDbSelect,
        mockDbUpdateWhere,
        mockDbUpdateSet,
        mockDbUpdate,
        mockClearEntitlementCache,
        mockSentryCaptureException,
        mockRevokeLimitBySource,
        mockRevokeLimit,
        mockRevokeEntitlementBySource,
        mockRevokeEntitlement
    };
});

// ─── Module mocks ──────────────────────────────────────────────────────────────

// Drizzle schema — dynamic import inside the service resolves this path
vi.mock('@repo/db/schemas/billing', () => ({
    billingAddonPurchases: {
        id: 'id',
        subscriptionId: 'subscriptionId',
        status: 'status',
        canceledAt: 'canceledAt',
        deletedAt: 'deletedAt',
        metadata: 'metadata',
        updatedAt: 'updatedAt'
    }
}));

// drizzle-orm operators used inside the service
vi.mock('drizzle-orm', async (importOriginal) => {
    const actual = await importOriginal<typeof import('drizzle-orm')>();
    return {
        ...actual,
        eq: vi.fn((col: unknown, val: unknown) => ({ col, val, op: 'eq' })),
        and: vi.fn((...args: unknown[]) => ({ args, op: 'and' })),
        isNull: vi.fn((col: unknown) => ({ col, op: 'isNull' }))
    };
});

// @repo/billing — getAddonBySlug resolves addon definitions
vi.mock('@repo/billing', () => ({
    getAddonBySlug: vi.fn((slug: string) => {
        if (slug === 'extra-photos-20') {
            return {
                slug: 'extra-photos-20',
                name: 'Extra Photos 20',
                affectsLimitKey: 'MAX_PHOTOS_PER_ACCOMMODATION',
                limitIncrease: 20,
                grantsEntitlement: null
            };
        }
        if (slug === 'visibility-boost-7d') {
            return {
                slug: 'visibility-boost-7d',
                name: 'Visibility Boost 7d',
                affectsLimitKey: null,
                limitIncrease: null,
                grantsEntitlement: 'FEATURED_LISTING'
            };
        }
        // Any other slug is "retired" — no definition found
        return undefined;
    }),
    ALL_PLANS: [],
    ALL_ADDONS: []
}));

vi.mock('@sentry/node', () => ({
    captureException: mockSentryCaptureException
}));

// Entitlement cache cleared after processing
vi.mock('../../src/middlewares/entitlement.js', () => ({
    clearEntitlementCache: mockClearEntitlementCache
}));

vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

// ─── Shared fixtures ───────────────────────────────────────────────────────────

const SUBSCRIPTION_ID = 'sub-uuid-001';
const CUSTOMER_ID = 'cust-uuid-001';
const PURCHASE_ID_A = 'purchase-uuid-aaa';
const PURCHASE_ID_B = 'purchase-uuid-bbb';

/**
 * Builds a minimal mock DB object proxying through to the hoisted vi.fn() stubs.
 * Tests reconfigure `mockDbSelectWhere.mockResolvedValue(...)` to control query results.
 */
function buildMockDb() {
    return {
        select: mockDbSelect,
        update: mockDbUpdate
    } as unknown as Parameters<typeof handleSubscriptionCancellationAddons>[0]['db'];
}

/**
 * Builds a mock QZPayBilling with only the entitlement and limit service stubs
 * needed by `revokeAddonForSubscriptionCancellation`.
 */
function buildMockBilling(): QZPayBilling {
    return {
        entitlements: {
            revokeBySource: mockRevokeEntitlementBySource,
            revoke: mockRevokeEntitlement,
            grant: vi.fn(),
            getByCustomerId: vi.fn(),
            check: vi.fn()
        },
        limits: {
            removeBySource: mockRevokeLimitBySource,
            remove: mockRevokeLimit,
            set: vi.fn(),
            getByCustomerId: vi.fn(),
            check: vi.fn(),
            increment: vi.fn(),
            recordUsage: vi.fn()
        }
    } as unknown as QZPayBilling;
}

/** Builds a minimal active addon purchase row as returned by a DB select. */
function buildPurchase(overrides?: {
    id?: string;
    addonSlug?: string;
    subscriptionId?: string;
    metadata?: Record<string, unknown>;
}) {
    return {
        id: overrides?.id ?? PURCHASE_ID_A,
        subscriptionId: overrides?.subscriptionId ?? SUBSCRIPTION_ID,
        addonSlug: overrides?.addonSlug ?? 'extra-photos-20',
        status: 'active' as const,
        canceledAt: null,
        deletedAt: null,
        metadata: overrides?.metadata ?? {}
    };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('Addon Lifecycle Cancellation — Service Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Reset all stubs to their success defaults before each test
        mockRevokeLimitBySource.mockResolvedValue(1);
        mockRevokeLimit.mockResolvedValue(undefined);
        mockRevokeEntitlementBySource.mockResolvedValue(1);
        mockRevokeEntitlement.mockResolvedValue(undefined);
        mockDbUpdateWhere.mockResolvedValue({ rowCount: 1 });
        mockDbSelectWhere.mockResolvedValue([]);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // ── Test 1: Webhook cancellation E2E — limit addon ───────────────────────

    describe('Webhook cancellation E2E', () => {
        it('should revoke limit addon via billing.limits.removeBySource, persist canceled status, and clear cache', async () => {
            // Arrange
            const purchase = buildPurchase({ id: PURCHASE_ID_A, addonSlug: 'extra-photos-20' });
            mockDbSelectWhere.mockResolvedValueOnce([purchase]);

            const billing = buildMockBilling();
            const db = buildMockDb();

            // Act
            const result = (await handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing,
                db
            })) as CancellationResult;

            // Assert — QZPay limit revocation called with the correct sourceId
            expect(mockRevokeLimitBySource).toHaveBeenCalledWith('addon', PURCHASE_ID_A);
            expect(mockRevokeEntitlementBySource).not.toHaveBeenCalled();

            // Assert — DB update persisted status='canceled'
            expect(mockDbUpdate).toHaveBeenCalled();
            expect(mockDbUpdateSet).toHaveBeenCalledWith(
                expect.objectContaining({ status: 'canceled' })
            );

            // Assert — entitlement cache cleared unconditionally
            expect(mockClearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);

            // Assert — result shape
            expect(result.subscriptionId).toBe(SUBSCRIPTION_ID);
            expect(result.customerId).toBe(CUSTOMER_ID);
            expect(result.totalProcessed).toBe(1);
            expect(result.succeeded).toHaveLength(1);
            expect(result.failed).toHaveLength(0);
            expect(result.succeeded[0]?.outcome).toBe('success');
            expect(result.succeeded[0]?.addonSlug).toBe('extra-photos-20');
            expect(result.succeeded[0]?.addonType).toBe('limit');
        });

        it('should revoke entitlement addon via billing.entitlements.revokeBySource, persist canceled status, and clear cache', async () => {
            // Arrange
            const purchase = buildPurchase({
                id: PURCHASE_ID_A,
                addonSlug: 'visibility-boost-7d'
            });
            mockDbSelectWhere.mockResolvedValueOnce([purchase]);

            const billing = buildMockBilling();
            const db = buildMockDb();

            // Act
            const result = (await handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing,
                db
            })) as CancellationResult;

            // Assert — entitlement revocation used, not limit
            expect(mockRevokeEntitlementBySource).toHaveBeenCalledWith('addon', PURCHASE_ID_A);
            expect(mockRevokeLimitBySource).not.toHaveBeenCalled();

            // Assert — DB persists canceled
            expect(mockDbUpdateSet).toHaveBeenCalledWith(
                expect.objectContaining({ status: 'canceled' })
            );

            // Assert — result
            expect(result.succeeded[0]?.addonType).toBe('entitlement');
            expect(result.totalProcessed).toBe(1);
        });
    });

    // ── Test 2: Admin cancellation E2E — two-phase flow ─────────────────────

    describe('Admin cancellation E2E — two active addons', () => {
        it('should process both addons sequentially and succeed for all', async () => {
            // Arrange — two active purchases: one limit addon, one entitlement addon
            const purchaseA = buildPurchase({
                id: PURCHASE_ID_A,
                addonSlug: 'extra-photos-20'
            });
            const purchaseB = buildPurchase({
                id: PURCHASE_ID_B,
                addonSlug: 'visibility-boost-7d'
            });
            mockDbSelectWhere.mockResolvedValueOnce([purchaseA, purchaseB]);

            const billing = buildMockBilling();
            const db = buildMockDb();

            // Act
            const result = (await handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing,
                db
            })) as CancellationResult;

            // Assert — both QZPay revocations executed (Phase 1)
            expect(mockRevokeLimitBySource).toHaveBeenCalledWith('addon', PURCHASE_ID_A);
            expect(mockRevokeEntitlementBySource).toHaveBeenCalledWith('addon', PURCHASE_ID_B);

            // Assert — DB update called twice (Phase 2 — once per purchase)
            expect(mockDbUpdate).toHaveBeenCalledTimes(2);

            // Assert — summary
            expect(result.totalProcessed).toBe(2);
            expect(result.succeeded).toHaveLength(2);
            expect(result.failed).toHaveLength(0);
            expect(mockClearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);
        });

        it('should throw and report to Sentry when QZPay revocation fails for an addon', async () => {
            // Arrange — one purchase whose primary AND fallback QZPay calls both fail
            const purchase = buildPurchase({ id: PURCHASE_ID_A, addonSlug: 'extra-photos-20' });
            mockDbSelectWhere.mockResolvedValueOnce([purchase]);

            // Both primary (removeBySource) and fallback (remove) fail
            mockRevokeLimitBySource.mockRejectedValueOnce(new Error('QZPay: rate limited'));
            mockRevokeLimit.mockRejectedValueOnce(new Error('QZPay: rate limited (fallback)'));
            // Metadata update resolves (non-fatal path inside failure handler)
            mockDbUpdateWhere.mockResolvedValue({ rowCount: 1 });

            const billing = buildMockBilling();
            const db = buildMockDb();

            // Act + Assert — service throws so webhook handler returns 500
            await expect(
                handleSubscriptionCancellationAddons({
                    subscriptionId: SUBSCRIPTION_ID,
                    customerId: CUSTOMER_ID,
                    billing,
                    db
                })
            ).rejects.toThrow(`Addon cleanup failed for subscription ${SUBSCRIPTION_ID}`);

            // Assert — Sentry notified of the failure
            expect(mockSentryCaptureException).toHaveBeenCalled();
        });
    });

    // ── Test 3: Idempotent webhook retry ─────────────────────────────────────

    describe('Idempotent webhook retry', () => {
        it('should return success with 0 processed when no active addons remain (second call)', async () => {
            // Arrange — DB returns empty: all addons were already canceled on the first call
            mockDbSelectWhere.mockResolvedValueOnce([]);

            const billing = buildMockBilling();
            const db = buildMockDb();

            // Act
            const result = (await handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing,
                db
            })) as CancellationResult;

            // Assert — no QZPay calls made (nothing to revoke)
            expect(mockRevokeLimitBySource).not.toHaveBeenCalled();
            expect(mockRevokeEntitlementBySource).not.toHaveBeenCalled();
            expect(mockDbUpdate).not.toHaveBeenCalled();

            // Assert — cache NOT cleared on the early-return path
            expect(mockClearEntitlementCache).not.toHaveBeenCalled();

            // Assert — result reports zero processed
            expect(result.subscriptionId).toBe(SUBSCRIPTION_ID);
            expect(result.customerId).toBe(CUSTOMER_ID);
            expect(result.totalProcessed).toBe(0);
            expect(result.succeeded).toHaveLength(0);
            expect(result.failed).toHaveLength(0);
            expect(result.elapsedMs).toBeTypeOf('number');
        });
    });

    // ── Test 4: Partial failure preserves progress ───────────────────────────

    describe('Partial failure preserves progress', () => {
        it('should cancel addon A in DB and increment retry metadata for addon B when B fails', async () => {
            // Arrange — two purchases: A succeeds, B fails
            const purchaseA = buildPurchase({
                id: PURCHASE_ID_A,
                addonSlug: 'extra-photos-20'
            });
            const purchaseB = buildPurchase({
                id: PURCHASE_ID_B,
                addonSlug: 'visibility-boost-7d',
                metadata: { revocationRetryCount: 0 }
            });
            mockDbSelectWhere.mockResolvedValueOnce([purchaseA, purchaseB]);

            // Addon A (limit): succeeds
            mockRevokeLimitBySource.mockResolvedValueOnce(1);

            // Addon B (entitlement): primary AND fallback both fail
            mockRevokeEntitlementBySource.mockRejectedValueOnce(
                new Error('QZPay: entitlement service unavailable')
            );
            mockRevokeEntitlement.mockRejectedValueOnce(
                new Error('QZPay: entitlement fallback also failed')
            );

            // All DB writes resolve
            mockDbUpdateWhere.mockResolvedValue({ rowCount: 1 });

            const billing = buildMockBilling();
            const db = buildMockDb();

            // Act + Assert — throws because B failed
            await expect(
                handleSubscriptionCancellationAddons({
                    subscriptionId: SUBSCRIPTION_ID,
                    customerId: CUSTOMER_ID,
                    billing,
                    db
                })
            ).rejects.toThrow(`Addon cleanup failed for subscription ${SUBSCRIPTION_ID}`);

            // Assert — BOTH addons were attempted (loop continues past A before throwing)
            expect(mockRevokeLimitBySource).toHaveBeenCalledWith('addon', PURCHASE_ID_A);
            expect(mockRevokeEntitlementBySource).toHaveBeenCalledWith('addon', PURCHASE_ID_B);

            // Assert — DB update called for addon A (status='canceled') and for
            // addon B retry metadata increment
            expect(mockDbUpdate).toHaveBeenCalledTimes(2);

            // Assert — addon A's update used status='canceled'
            const setCallArgs = vi.mocked(mockDbUpdateSet).mock.calls as unknown as Array<
                [Record<string, unknown>]
            >;
            const canceledCall = setCallArgs.find((call) => call[0]?.status === 'canceled');
            expect(canceledCall).toBeDefined();

            // Assert — addon B's retry metadata incremented (retryCount becomes 1)
            const metadataCall = setCallArgs.find(
                (call) => typeof call[0] === 'object' && call[0] !== null && 'metadata' in call[0]
            );
            expect(metadataCall).toBeDefined();

            const rawMetadata = metadataCall?.[0]?.metadata;
            expect(rawMetadata).toBeDefined();
            const metadataArg = rawMetadata as Record<string, unknown>;
            expect(metadataArg.revocationRetryCount).toBe(1);
            expect(typeof metadataArg.lastRevocationAttempt).toBe('string');
        });

        it('should process only the remaining active addon on a subsequent retry', async () => {
            // Arrange — DB returns only addon B (addon A was canceled on the previous call)
            const purchaseB = buildPurchase({
                id: PURCHASE_ID_B,
                addonSlug: 'visibility-boost-7d',
                metadata: { revocationRetryCount: 1 }
            });
            mockDbSelectWhere.mockResolvedValueOnce([purchaseB]);

            const billing = buildMockBilling();
            const db = buildMockDb();

            // Act
            const result = (await handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing,
                db
            })) as CancellationResult;

            // Assert — only addon B was processed
            expect(mockRevokeEntitlementBySource).toHaveBeenCalledTimes(1);
            expect(mockRevokeEntitlementBySource).toHaveBeenCalledWith('addon', PURCHASE_ID_B);
            expect(mockRevokeLimitBySource).not.toHaveBeenCalled();

            // Assert — result
            expect(result.totalProcessed).toBe(1);
            expect(result.succeeded).toHaveLength(1);
            expect(result.failed).toHaveLength(0);
        });
    });

    // ── Test 5: Customer with no addons ──────────────────────────────────────

    describe('Customer with no addons', () => {
        it('should return a zero-processed summary without touching QZPay or DB', async () => {
            // Arrange — empty active purchases for this subscription
            mockDbSelectWhere.mockResolvedValueOnce([]);

            const billing = buildMockBilling();
            const db = buildMockDb();

            // Act
            const result = (await handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing,
                db
            })) as CancellationResult;

            // Assert — no side-effects
            expect(mockRevokeLimitBySource).not.toHaveBeenCalled();
            expect(mockRevokeEntitlementBySource).not.toHaveBeenCalled();
            expect(mockDbUpdate).not.toHaveBeenCalled();
            expect(mockClearEntitlementCache).not.toHaveBeenCalled();

            // Assert — well-formed zero result
            expect(result).toMatchObject({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                totalProcessed: 0,
                succeeded: [],
                failed: []
            });
            expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
        });

        it('should not throw even if billing engine is unreachable when there are no addons', async () => {
            // Arrange — billing would fail, but early return means it is never called
            mockRevokeLimitBySource.mockRejectedValue(new Error('billing engine unreachable'));
            mockDbSelectWhere.mockResolvedValueOnce([]);

            const billing = buildMockBilling();
            const db = buildMockDb();

            // Act + Assert — must resolve without throwing
            await expect(
                handleSubscriptionCancellationAddons({
                    subscriptionId: SUBSCRIPTION_ID,
                    customerId: CUSTOMER_ID,
                    billing,
                    db
                })
            ).resolves.not.toThrow();

            expect(mockRevokeLimitBySource).not.toHaveBeenCalled();
        });
    });

    // ── Test 6: Unknown/retired addon definition ─────────────────────────────

    describe('Unknown (retired) addon definition', () => {
        it('should attempt both QZPay channels for an addon with no known definition', async () => {
            // Arrange — slug not present in @repo/billing config
            const purchase = buildPurchase({
                id: PURCHASE_ID_A,
                addonSlug: 'retired-feature-addon'
            });
            mockDbSelectWhere.mockResolvedValueOnce([purchase]);

            const billing = buildMockBilling();
            const db = buildMockDb();

            // Act
            const result = (await handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing,
                db
            })) as CancellationResult;

            // Assert — both entitlement and limit channels attempted (best-effort)
            expect(mockRevokeEntitlementBySource).toHaveBeenCalledWith('addon', PURCHASE_ID_A);
            expect(mockRevokeLimitBySource).toHaveBeenCalledWith('addon', PURCHASE_ID_A);

            // Assert — outcome is 'success' with addonType 'unknown'
            expect(result.succeeded).toHaveLength(1);
            expect(result.succeeded[0]?.addonType).toBe('unknown');
            expect(result.succeeded[0]?.outcome).toBe('success');
            expect(result.failed).toHaveLength(0);
        });

        it('should still succeed for retired addons even when QZPay channel calls fail', async () => {
            // Arrange — both QZPay channels fail, but errors are non-fatal for unknown addons
            const purchase = buildPurchase({
                id: PURCHASE_ID_A,
                addonSlug: 'retired-feature-addon'
            });
            mockDbSelectWhere.mockResolvedValueOnce([purchase]);

            mockRevokeEntitlementBySource.mockRejectedValueOnce(new Error('not found'));
            mockRevokeLimitBySource.mockRejectedValueOnce(new Error('not found'));

            const billing = buildMockBilling();
            const db = buildMockDb();

            // Act — must NOT throw (errors are warnings for retired addons)
            const result = (await handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing,
                db
            })) as CancellationResult;

            // Assert — retired addon treated as successful (best-effort)
            expect(result.totalProcessed).toBe(1);
            expect(result.succeeded).toHaveLength(1);
            expect(result.succeeded[0]?.addonType).toBe('unknown');
            expect(result.failed).toHaveLength(0);
        });
    });
});
