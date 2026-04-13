/**
 * Tests for handleSubscriptionCancellationAddons
 *
 * Covers SPEC-043 AC-1.1 through AC-1.10:
 *
 * - AC-1.1  Happy path: 2 active addons (1 entitlement, 1 limit) -> both revoked and canceled
 * - AC-1.2  Idempotency: no active addons found -> no QZPay calls, returns success with 0 processed
 * - AC-1.3  Partial failure: 3 addons, addon 2 fails -> addon 1 canceled, addon 2 stays active
 *           with metadata update, addon 3 still processed, error thrown at end
 * - AC-1.4  No active addons: all existing purchases are pending/expired/canceled -> no processing
 * - AC-1.5  No purchases at all: no rows for subscriptionId -> debug log, success
 * - AC-1.6  Partial progress preserved: retry with addon 1 already canceled -> only addon 2 processed
 * - AC-1.7  Retired addon: getAddonBySlug returns undefined -> both revocation channels called, still canceled
 * - AC-1.8  Pending ignored: mix of active and pending -> only active processed
 * - AC-1.10 Timing warning: slow processing (>15s elapsed) -> warning logged
 * - Metadata update on failure: revocationRetryCount incremented, lastRevocationAttempt set
 * - Sentry reporting on failure: Sentry.captureException called with correct tags
 * - Cache invalidation: clearEntitlementCache called even with partial failures
 *
 * @module test/services/addon-lifecycle-cancellation.service.test
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Module mocks — must be declared before any imports ────────────────────

vi.mock('@repo/billing', () => ({
    getAddonBySlug: vi.fn()
}));

vi.mock('@repo/db', () => ({
    withTransaction: vi.fn(
        async (callback: (tx: unknown) => Promise<unknown>, existingTx?: unknown) =>
            callback(existingTx)
    )
}));

vi.mock('@repo/db/schemas/billing', () => ({
    billingAddonPurchases: {
        id: 'id',
        customerId: 'customer_id',
        subscriptionId: 'subscription_id',
        addonSlug: 'addon_slug',
        status: 'status',
        canceledAt: 'canceled_at',
        deletedAt: 'deleted_at',
        metadata: 'metadata',
        updatedAt: 'updated_at'
    }
}));

vi.mock('drizzle-orm', async (importOriginal) => {
    const actual = await importOriginal<typeof import('drizzle-orm')>();
    return {
        ...actual,
        and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
        eq: vi.fn((col: unknown, val: unknown) => ({ type: 'eq', col, val })),
        isNull: vi.fn((col: unknown) => ({ type: 'isNull', col }))
    };
});

vi.mock('../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

vi.mock('../../src/services/addon-lifecycle.service', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('../../src/services/addon-lifecycle.service')>();
    return {
        ...actual,
        revokeAddonForSubscriptionCancellation: vi.fn()
    };
});

vi.mock('@sentry/node', () => ({
    captureException: vi.fn()
}));

// ─── Imports — after mocks ──────────────────────────────────────────────────

import { getAddonBySlug } from '@repo/billing';
import * as Sentry from '@sentry/node';
import * as entitlementMiddleware from '../../src/middlewares/entitlement';
import { handleSubscriptionCancellationAddons } from '../../src/services/addon-lifecycle-cancellation.service';
import { revokeAddonForSubscriptionCancellation } from '../../src/services/addon-lifecycle.service';
import { apiLogger } from '../../src/utils/logger';
import { createMockBilling } from '../helpers/mock-factories';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const SUBSCRIPTION_ID = 'sub_test_cancellation_001';
const CUSTOMER_ID = 'cus_test_lifecycle_001';

const PURCHASE_ENT = {
    id: 'purch_ent_0001-0002-0003-0004-000000000001',
    addonSlug: 'visibility-boost-7d',
    subscriptionId: SUBSCRIPTION_ID,
    customerId: CUSTOMER_ID,
    status: 'active' as const,
    metadata: {},
    deletedAt: null
};

const PURCHASE_LIMIT = {
    id: 'purch_lmt_0001-0002-0003-0004-000000000002',
    addonSlug: 'extra-photos-20',
    subscriptionId: SUBSCRIPTION_ID,
    customerId: CUSTOMER_ID,
    status: 'active' as const,
    metadata: {},
    deletedAt: null
};

const PURCHASE_THREE = {
    id: 'purch_thr_0001-0002-0003-0004-000000000003',
    addonSlug: 'priority-support-30d',
    subscriptionId: SUBSCRIPTION_ID,
    customerId: CUSTOMER_ID,
    status: 'active' as const,
    metadata: {},
    deletedAt: null
};

/** Minimal addon definitions matching the mock purchases above. */
const ENT_ADDON_DEF = {
    slug: 'visibility-boost-7d',
    grantsEntitlement: 'featured_listing',
    affectsLimitKey: null
};

const LIMIT_ADDON_DEF = {
    slug: 'extra-photos-20',
    grantsEntitlement: null,
    affectsLimitKey: 'max_photos_per_accommodation'
};

/** Success RevocationResult for entitlement addon. */
const ENT_REVOCATION_OK = {
    purchaseId: PURCHASE_ENT.id,
    addonSlug: PURCHASE_ENT.addonSlug,
    addonType: 'entitlement' as const,
    outcome: 'success' as const
};

/** Success RevocationResult for limit addon. */
const LIMIT_REVOCATION_OK = {
    purchaseId: PURCHASE_LIMIT.id,
    addonSlug: PURCHASE_LIMIT.addonSlug,
    addonType: 'limit' as const,
    outcome: 'success' as const
};

/** Success RevocationResult for third addon. */
const THREE_REVOCATION_OK = {
    purchaseId: PURCHASE_THREE.id,
    addonSlug: PURCHASE_THREE.addonSlug,
    addonType: 'unknown' as const,
    outcome: 'success' as const
};

// ─── DB mock builder ─────────────────────────────────────────────────────────

/**
 * Creates a minimal mock DB that simulates Drizzle's fluent query builder for
 * SELECT and UPDATE chains.
 *
 * @param activePurchases - Rows returned by the SELECT WHERE clause.
 */
function createMockDb(activePurchases: unknown[]) {
    const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
    const mockUpdateSet = vi.fn<
        (payload: Record<string, unknown>) => { where: typeof mockUpdateWhere }
    >(() => ({ where: mockUpdateWhere }));
    const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));

    const mockSelectWhere = vi.fn().mockResolvedValue(activePurchases);
    const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere }));
    const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));

    return {
        select: mockSelect,
        update: mockUpdate,
        // Expose internals for assertion
        _mockUpdateWhere: mockUpdateWhere,
        _mockUpdateSet: mockUpdateSet,
        _mockSelectWhere: mockSelectWhere
    };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('handleSubscriptionCancellationAddons', () => {
    let mockBilling: QZPayBilling;

    beforeEach(() => {
        mockBilling = createMockBilling();
        // Default: getAddonBySlug returns undefined (retired addon)
        vi.mocked(getAddonBySlug).mockReturnValue(undefined);
        // Default: revokeAddonForSubscriptionCancellation succeeds
        vi.mocked(revokeAddonForSubscriptionCancellation).mockResolvedValue(ENT_REVOCATION_OK);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // =========================================================================
    // AC-1.1: Happy path — 2 active addons both revoked and canceled
    // =========================================================================
    describe('AC-1.1: happy path with 2 active addons', () => {
        it('should revoke and cancel both addons, returning succeeded list', async () => {
            // Arrange
            vi.mocked(getAddonBySlug).mockImplementation((slug: string) => {
                if (slug === PURCHASE_ENT.addonSlug)
                    return ENT_ADDON_DEF as ReturnType<typeof getAddonBySlug>;
                if (slug === PURCHASE_LIMIT.addonSlug)
                    return LIMIT_ADDON_DEF as ReturnType<typeof getAddonBySlug>;
                return undefined;
            });

            vi.mocked(revokeAddonForSubscriptionCancellation)
                .mockResolvedValueOnce(ENT_REVOCATION_OK)
                .mockResolvedValueOnce(LIMIT_REVOCATION_OK);

            const db = createMockDb([PURCHASE_ENT, PURCHASE_LIMIT]);

            // Act
            const result = await handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing: mockBilling,
                db: db as unknown as Parameters<
                    typeof handleSubscriptionCancellationAddons
                >[0]['db']
            });

            // Assert
            expect(result.totalProcessed).toBe(2);
            expect(result.succeeded).toHaveLength(2);
            expect(result.failed).toHaveLength(0);
            expect(result.subscriptionId).toBe(SUBSCRIPTION_ID);
            expect(result.customerId).toBe(CUSTOMER_ID);
        });

        it('should call revokeAddonForSubscriptionCancellation for each active purchase', async () => {
            // Arrange
            vi.mocked(revokeAddonForSubscriptionCancellation)
                .mockResolvedValueOnce(ENT_REVOCATION_OK)
                .mockResolvedValueOnce(LIMIT_REVOCATION_OK);

            const db = createMockDb([PURCHASE_ENT, PURCHASE_LIMIT]);

            // Act
            await handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing: mockBilling,
                db: db as unknown as Parameters<
                    typeof handleSubscriptionCancellationAddons
                >[0]['db']
            });

            // Assert — called once per active purchase
            expect(revokeAddonForSubscriptionCancellation).toHaveBeenCalledTimes(2);
        });

        it('should update each purchase to status=canceled in the DB on success', async () => {
            // Arrange
            vi.mocked(revokeAddonForSubscriptionCancellation)
                .mockResolvedValueOnce(ENT_REVOCATION_OK)
                .mockResolvedValueOnce(LIMIT_REVOCATION_OK);

            const db = createMockDb([PURCHASE_ENT, PURCHASE_LIMIT]);

            // Act
            await handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing: mockBilling,
                db: db as unknown as Parameters<
                    typeof handleSubscriptionCancellationAddons
                >[0]['db']
            });

            // Assert — update was called once per successful purchase
            expect(db.update).toHaveBeenCalledTimes(2);
            // The set payload must include status: 'canceled' and canceledAt
            const firstSetCall = db._mockUpdateSet.mock.calls[0]?.[0] as
                | Record<string, unknown>
                | undefined;
            expect(firstSetCall?.status).toBe('canceled');
            expect(firstSetCall?.canceledAt).toBeInstanceOf(Date);
        });
    });

    // =========================================================================
    // AC-1.2 & AC-1.5: No active addons / no purchases at all — idempotency
    // =========================================================================
    describe('AC-1.2 / AC-1.5: no active addons found', () => {
        it('should return success with totalProcessed=0 when no active purchases exist', async () => {
            // Arrange
            const db = createMockDb([]);

            // Act
            const result = await handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing: mockBilling,
                db: db as unknown as Parameters<
                    typeof handleSubscriptionCancellationAddons
                >[0]['db']
            });

            // Assert
            expect(result.totalProcessed).toBe(0);
            expect(result.succeeded).toHaveLength(0);
            expect(result.failed).toHaveLength(0);
        });

        it('should NOT call revokeAddonForSubscriptionCancellation when no active purchases exist', async () => {
            // Arrange
            const db = createMockDb([]);

            // Act
            await handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing: mockBilling,
                db: db as unknown as Parameters<
                    typeof handleSubscriptionCancellationAddons
                >[0]['db']
            });

            // Assert
            expect(revokeAddonForSubscriptionCancellation).not.toHaveBeenCalled();
        });

        it('should log a debug message when no active purchases are found', async () => {
            // Arrange
            const db = createMockDb([]);

            // Act
            await handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing: mockBilling,
                db: db as unknown as Parameters<
                    typeof handleSubscriptionCancellationAddons
                >[0]['db']
            });

            // Assert
            expect(vi.mocked(apiLogger.debug)).toHaveBeenCalledWith(
                expect.objectContaining({ subscriptionId: SUBSCRIPTION_ID }),
                expect.stringContaining(SUBSCRIPTION_ID)
            );
        });

        it('should NOT call clearEntitlementCache when there is nothing to process', async () => {
            // Arrange
            const db = createMockDb([]);

            // Act
            await handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing: mockBilling,
                db: db as unknown as Parameters<
                    typeof handleSubscriptionCancellationAddons
                >[0]['db']
            });

            // Assert — cache is only cleared when at least one purchase is processed
            expect(entitlementMiddleware.clearEntitlementCache).not.toHaveBeenCalled();
        });
    });

    // =========================================================================
    // AC-1.3: Partial failure — continues processing, throws at end
    // =========================================================================
    describe('AC-1.3: partial failure across 3 addons', () => {
        it('should process all 3 addons even when addon 2 fails', async () => {
            // Arrange
            vi.mocked(revokeAddonForSubscriptionCancellation)
                .mockResolvedValueOnce(ENT_REVOCATION_OK) // addon 1 succeeds
                .mockRejectedValueOnce(new Error('QZPay timeout')) // addon 2 fails
                .mockResolvedValueOnce(THREE_REVOCATION_OK); // addon 3 succeeds

            const db = createMockDb([PURCHASE_ENT, PURCHASE_LIMIT, PURCHASE_THREE]);

            // Act & Assert — function throws because failed.length > 0
            await expect(
                handleSubscriptionCancellationAddons({
                    subscriptionId: SUBSCRIPTION_ID,
                    customerId: CUSTOMER_ID,
                    billing: mockBilling,
                    db: db as unknown as Parameters<
                        typeof handleSubscriptionCancellationAddons
                    >[0]['db']
                })
            ).rejects.toThrow();

            // All 3 were attempted
            expect(revokeAddonForSubscriptionCancellation).toHaveBeenCalledTimes(3);
        });

        it('should have 2 succeeded and 1 failed in the error context', async () => {
            // Arrange
            vi.mocked(revokeAddonForSubscriptionCancellation)
                .mockResolvedValueOnce(ENT_REVOCATION_OK)
                .mockRejectedValueOnce(new Error('QZPay timeout'))
                .mockResolvedValueOnce(THREE_REVOCATION_OK);

            const db = createMockDb([PURCHASE_ENT, PURCHASE_LIMIT, PURCHASE_THREE]);

            // Act — capture thrown error for inspection
            let caughtError: Error | undefined;
            try {
                await handleSubscriptionCancellationAddons({
                    subscriptionId: SUBSCRIPTION_ID,
                    customerId: CUSTOMER_ID,
                    billing: mockBilling,
                    db: db as unknown as Parameters<
                        typeof handleSubscriptionCancellationAddons
                    >[0]['db']
                });
            } catch (err) {
                caughtError = err instanceof Error ? err : new Error(String(err));
            }

            // Assert
            expect(caughtError).toBeDefined();
            expect(caughtError?.message).toContain('1 of 3');
        });

        it('should throw an error containing the failed purchase ID', async () => {
            // Arrange
            vi.mocked(revokeAddonForSubscriptionCancellation)
                .mockResolvedValueOnce(ENT_REVOCATION_OK)
                .mockRejectedValueOnce(new Error('network error'))
                .mockResolvedValueOnce(THREE_REVOCATION_OK);

            const db = createMockDb([PURCHASE_ENT, PURCHASE_LIMIT, PURCHASE_THREE]);

            // Act
            let caughtError: Error | undefined;
            try {
                await handleSubscriptionCancellationAddons({
                    subscriptionId: SUBSCRIPTION_ID,
                    customerId: CUSTOMER_ID,
                    billing: mockBilling,
                    db: db as unknown as Parameters<
                        typeof handleSubscriptionCancellationAddons
                    >[0]['db']
                });
            } catch (err) {
                caughtError = err instanceof Error ? err : new Error(String(err));
            }

            // Assert — error message includes the failed purchase ID
            expect(caughtError?.message).toContain(PURCHASE_LIMIT.id);
        });
    });

    // =========================================================================
    // AC-1.4: Non-active purchases (pending/expired/canceled) are not processed
    // =========================================================================
    describe('AC-1.4: non-active purchases are not processed', () => {
        it('should return totalProcessed=0 when DB returns empty (query filters non-active server-side)', async () => {
            // The WHERE clause in the implementation already filters status='active'.
            // Simulating this: DB mock returns empty array (the query excluded non-active rows).
            const db = createMockDb([]);

            // Act
            const result = await handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing: mockBilling,
                db: db as unknown as Parameters<
                    typeof handleSubscriptionCancellationAddons
                >[0]['db']
            });

            // Assert
            expect(result.totalProcessed).toBe(0);
            expect(revokeAddonForSubscriptionCancellation).not.toHaveBeenCalled();
        });
    });

    // =========================================================================
    // AC-1.6: Partial progress preserved — already-canceled addon not retried
    // =========================================================================
    describe('AC-1.6: partial progress preserved on retry', () => {
        it('should process only the remaining active addon on second attempt', async () => {
            // Arrange: addon 1 was already canceled (not returned by DB query).
            // DB returns only PURCHASE_LIMIT as still active.
            vi.mocked(revokeAddonForSubscriptionCancellation).mockResolvedValueOnce(
                LIMIT_REVOCATION_OK
            );

            const db = createMockDb([PURCHASE_LIMIT]); // only 1 still active

            // Act
            const result = await handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing: mockBilling,
                db: db as unknown as Parameters<
                    typeof handleSubscriptionCancellationAddons
                >[0]['db']
            });

            // Assert — only 1 processed
            expect(result.totalProcessed).toBe(1);
            expect(result.succeeded).toHaveLength(1);
            expect(revokeAddonForSubscriptionCancellation).toHaveBeenCalledTimes(1);
        });
    });

    // =========================================================================
    // AC-1.7: Retired addon — getAddonBySlug returns undefined
    // =========================================================================
    describe('AC-1.7: retired addon with undefined definition', () => {
        it('should pass undefined addonDef to revokeAddonForSubscriptionCancellation', async () => {
            // Arrange
            vi.mocked(getAddonBySlug).mockReturnValue(undefined);
            vi.mocked(revokeAddonForSubscriptionCancellation).mockResolvedValueOnce({
                purchaseId: PURCHASE_ENT.id,
                addonSlug: PURCHASE_ENT.addonSlug,
                addonType: 'unknown',
                outcome: 'success'
            });

            const db = createMockDb([PURCHASE_ENT]);

            // Act
            const result = await handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing: mockBilling,
                db: db as unknown as Parameters<
                    typeof handleSubscriptionCancellationAddons
                >[0]['db']
            });

            // Assert — revoke was still called even with undefined addonDef
            expect(revokeAddonForSubscriptionCancellation).toHaveBeenCalledWith(
                expect.objectContaining({
                    addonDef: undefined,
                    customerId: CUSTOMER_ID,
                    purchase: { id: PURCHASE_ENT.id, addonSlug: PURCHASE_ENT.addonSlug }
                })
            );
            expect(result.succeeded).toHaveLength(1);
            expect(result.failed).toHaveLength(0);
        });

        it('should mark purchase as canceled in DB even for retired addons', async () => {
            // Arrange
            vi.mocked(getAddonBySlug).mockReturnValue(undefined);
            vi.mocked(revokeAddonForSubscriptionCancellation).mockResolvedValueOnce({
                purchaseId: PURCHASE_ENT.id,
                addonSlug: PURCHASE_ENT.addonSlug,
                addonType: 'unknown',
                outcome: 'success'
            });

            const db = createMockDb([PURCHASE_ENT]);

            // Act
            await handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing: mockBilling,
                db: db as unknown as Parameters<
                    typeof handleSubscriptionCancellationAddons
                >[0]['db']
            });

            // Assert — DB update still called to persist canceled status
            expect(db.update).toHaveBeenCalledOnce();
            const setPayload = db._mockUpdateSet.mock.calls[0]?.[0] as
                | Record<string, unknown>
                | undefined;
            expect(setPayload?.status).toBe('canceled');
        });
    });

    // =========================================================================
    // AC-1.8: Mix of active and non-active — only active processed
    // =========================================================================
    describe('AC-1.8: only active purchases are processed', () => {
        it('should only process the subset of active purchases returned by the DB query', async () => {
            // Arrange: DB WHERE clause already excludes non-active; mock returns 1 active purchase.
            vi.mocked(revokeAddonForSubscriptionCancellation).mockResolvedValueOnce(
                ENT_REVOCATION_OK
            );

            const db = createMockDb([PURCHASE_ENT]); // pending/expired filtered by DB

            // Act
            const result = await handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing: mockBilling,
                db: db as unknown as Parameters<
                    typeof handleSubscriptionCancellationAddons
                >[0]['db']
            });

            // Assert
            expect(result.totalProcessed).toBe(1);
            expect(revokeAddonForSubscriptionCancellation).toHaveBeenCalledTimes(1);
        });
    });

    // =========================================================================
    // AC-1.10: Timing warning logged when elapsed > 15 seconds
    // =========================================================================
    describe('AC-1.10: timing warning when processing exceeds 15s', () => {
        it('should log a warning when elapsed time exceeds 15 000 ms', async () => {
            // Arrange: fake Date.now() to simulate slow processing
            let callCount = 0;
            const realDateNow = Date.now;
            vi.spyOn(Date, 'now').mockImplementation(() => {
                // First call (startMs) = 0, all subsequent calls return 16 000
                return callCount++ === 0 ? 0 : 16_000;
            });

            vi.mocked(revokeAddonForSubscriptionCancellation).mockResolvedValueOnce(
                ENT_REVOCATION_OK
            );

            const db = createMockDb([PURCHASE_ENT]);

            // Act
            await handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing: mockBilling,
                db: db as unknown as Parameters<
                    typeof handleSubscriptionCancellationAddons
                >[0]['db']
            });

            // Assert
            expect(vi.mocked(apiLogger.warn)).toHaveBeenCalledWith(
                expect.objectContaining({ subscriptionId: SUBSCRIPTION_ID }),
                expect.stringContaining('15s')
            );

            // Restore
            vi.spyOn(Date, 'now').mockRestore();
            Date.now = realDateNow;
        });

        it('should NOT log a timing warning when processing completes under 15s', async () => {
            // Arrange: Date.now always returns the same value (0ms elapsed)
            vi.spyOn(Date, 'now').mockReturnValue(0);

            vi.mocked(revokeAddonForSubscriptionCancellation).mockResolvedValueOnce(
                ENT_REVOCATION_OK
            );

            const db = createMockDb([PURCHASE_ENT]);

            // Act
            await handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing: mockBilling,
                db: db as unknown as Parameters<
                    typeof handleSubscriptionCancellationAddons
                >[0]['db']
            });

            // Assert — no timing warning
            const warnCalls = vi.mocked(apiLogger.warn).mock.calls;
            const timingWarning = warnCalls.find(
                (call) => typeof call[1] === 'string' && call[1].includes('15s')
            );
            expect(timingWarning).toBeUndefined();

            vi.spyOn(Date, 'now').mockRestore();
        });
    });

    // =========================================================================
    // Metadata update on failure
    // =========================================================================
    describe('metadata update on failure', () => {
        it('should increment revocationRetryCount in purchase metadata when revocation fails', async () => {
            // Arrange
            vi.mocked(revokeAddonForSubscriptionCancellation).mockRejectedValueOnce(
                new Error('QZPay unavailable')
            );

            const purchaseWithExistingRetry = {
                ...PURCHASE_ENT,
                metadata: {
                    revocationRetryCount: 2,
                    lastRevocationAttempt: '2025-01-01T00:00:00.000Z'
                }
            };

            const db = createMockDb([purchaseWithExistingRetry]);

            // Act
            try {
                await handleSubscriptionCancellationAddons({
                    subscriptionId: SUBSCRIPTION_ID,
                    customerId: CUSTOMER_ID,
                    billing: mockBilling,
                    db: db as unknown as Parameters<
                        typeof handleSubscriptionCancellationAddons
                    >[0]['db']
                });
            } catch {
                // expected throw
            }

            // Assert — DB update called with incremented retry count
            expect(db.update).toHaveBeenCalledOnce();
            const setPayload = db._mockUpdateSet.mock.calls[0]?.[0] as
                | Record<string, unknown>
                | undefined;
            const meta = setPayload?.metadata as Record<string, unknown> | undefined;
            expect(meta?.revocationRetryCount).toBe(3); // was 2, incremented to 3
        });

        it('should initialise revocationRetryCount to 1 when metadata has no prior retry count', async () => {
            // Arrange
            vi.mocked(revokeAddonForSubscriptionCancellation).mockRejectedValueOnce(
                new Error('network error')
            );

            const purchaseNoMeta = { ...PURCHASE_ENT, metadata: {} };
            const db = createMockDb([purchaseNoMeta]);

            // Act
            try {
                await handleSubscriptionCancellationAddons({
                    subscriptionId: SUBSCRIPTION_ID,
                    customerId: CUSTOMER_ID,
                    billing: mockBilling,
                    db: db as unknown as Parameters<
                        typeof handleSubscriptionCancellationAddons
                    >[0]['db']
                });
            } catch {
                // expected throw
            }

            // Assert
            const setPayload = db._mockUpdateSet.mock.calls[0]?.[0] as
                | Record<string, unknown>
                | undefined;
            const meta = setPayload?.metadata as Record<string, unknown> | undefined;
            expect(meta?.revocationRetryCount).toBe(1);
        });

        it('should set lastRevocationAttempt to an ISO timestamp on failure', async () => {
            // Arrange
            vi.mocked(revokeAddonForSubscriptionCancellation).mockRejectedValueOnce(
                new Error('timeout')
            );

            const db = createMockDb([PURCHASE_ENT]);

            // Act
            try {
                await handleSubscriptionCancellationAddons({
                    subscriptionId: SUBSCRIPTION_ID,
                    customerId: CUSTOMER_ID,
                    billing: mockBilling,
                    db: db as unknown as Parameters<
                        typeof handleSubscriptionCancellationAddons
                    >[0]['db']
                });
            } catch {
                // expected throw
            }

            // Assert — lastRevocationAttempt is an ISO string
            const setPayload = db._mockUpdateSet.mock.calls[0]?.[0] as
                | Record<string, unknown>
                | undefined;
            const meta = setPayload?.metadata as Record<string, unknown> | undefined;
            expect(typeof meta?.lastRevocationAttempt).toBe('string');
            expect(() => new Date(meta?.lastRevocationAttempt as string)).not.toThrow();
        });

        it('should NOT update status to canceled when revocation fails', async () => {
            // Arrange
            vi.mocked(revokeAddonForSubscriptionCancellation).mockRejectedValueOnce(
                new Error('fatal revocation error')
            );

            const db = createMockDb([PURCHASE_ENT]);

            // Act
            try {
                await handleSubscriptionCancellationAddons({
                    subscriptionId: SUBSCRIPTION_ID,
                    customerId: CUSTOMER_ID,
                    billing: mockBilling,
                    db: db as unknown as Parameters<
                        typeof handleSubscriptionCancellationAddons
                    >[0]['db']
                });
            } catch {
                // expected throw
            }

            // Assert — metadata update was called (not the status='canceled' update)
            const setPayload = db._mockUpdateSet.mock.calls[0]?.[0] as
                | Record<string, unknown>
                | undefined;
            expect(setPayload?.status).toBeUndefined(); // no status in metadata update
            expect(setPayload?.metadata).toBeDefined();
        });
    });

    // =========================================================================
    // Sentry reporting on failure
    // =========================================================================
    describe('Sentry reporting on failure', () => {
        it('should call Sentry.captureException when one or more purchases fail', async () => {
            // Arrange
            vi.mocked(revokeAddonForSubscriptionCancellation).mockRejectedValueOnce(
                new Error('QZPay error')
            );

            const db = createMockDb([PURCHASE_ENT]);

            // Act
            try {
                await handleSubscriptionCancellationAddons({
                    subscriptionId: SUBSCRIPTION_ID,
                    customerId: CUSTOMER_ID,
                    billing: mockBilling,
                    db: db as unknown as Parameters<
                        typeof handleSubscriptionCancellationAddons
                    >[0]['db']
                });
            } catch {
                // expected throw
            }

            // Assert
            expect(Sentry.captureException).toHaveBeenCalledOnce();
        });

        it('should call Sentry.captureException with correct subsystem and action tags', async () => {
            // Arrange
            vi.mocked(revokeAddonForSubscriptionCancellation).mockRejectedValueOnce(
                new Error('QZPay error')
            );

            const db = createMockDb([PURCHASE_ENT]);

            // Act
            try {
                await handleSubscriptionCancellationAddons({
                    subscriptionId: SUBSCRIPTION_ID,
                    customerId: CUSTOMER_ID,
                    billing: mockBilling,
                    db: db as unknown as Parameters<
                        typeof handleSubscriptionCancellationAddons
                    >[0]['db']
                });
            } catch {
                // expected throw
            }

            // Assert — tags match what the implementation passes to Sentry
            const sentryCall = vi.mocked(Sentry.captureException).mock.calls[0];
            expect(sentryCall?.[1]).toMatchObject({
                tags: {
                    subsystem: 'billing-addon-lifecycle',
                    action: 'subscription_cancelled'
                }
            });
        });

        it('should include customerId and subscriptionId in Sentry extra context', async () => {
            // Arrange
            vi.mocked(revokeAddonForSubscriptionCancellation).mockRejectedValueOnce(
                new Error('revocation error')
            );

            const db = createMockDb([PURCHASE_ENT]);

            // Act
            try {
                await handleSubscriptionCancellationAddons({
                    subscriptionId: SUBSCRIPTION_ID,
                    customerId: CUSTOMER_ID,
                    billing: mockBilling,
                    db: db as unknown as Parameters<
                        typeof handleSubscriptionCancellationAddons
                    >[0]['db']
                });
            } catch {
                // expected throw
            }

            // Assert
            const sentryCall = vi.mocked(Sentry.captureException).mock.calls[0];
            expect(sentryCall?.[1]).toMatchObject({
                extra: expect.objectContaining({
                    customerId: CUSTOMER_ID,
                    subscriptionId: SUBSCRIPTION_ID
                })
            });
        });

        it('should NOT call Sentry when all purchases succeed', async () => {
            // Arrange
            vi.mocked(revokeAddonForSubscriptionCancellation).mockResolvedValueOnce(
                ENT_REVOCATION_OK
            );

            const db = createMockDb([PURCHASE_ENT]);

            // Act
            await handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing: mockBilling,
                db: db as unknown as Parameters<
                    typeof handleSubscriptionCancellationAddons
                >[0]['db']
            });

            // Assert
            expect(Sentry.captureException).not.toHaveBeenCalled();
        });
    });

    // =========================================================================
    // Cache invalidation
    // =========================================================================
    describe('cache invalidation', () => {
        it('should call clearEntitlementCache with customerId after all purchases succeed', async () => {
            // Arrange
            vi.mocked(revokeAddonForSubscriptionCancellation)
                .mockResolvedValueOnce(ENT_REVOCATION_OK)
                .mockResolvedValueOnce(LIMIT_REVOCATION_OK);

            const db = createMockDb([PURCHASE_ENT, PURCHASE_LIMIT]);

            // Act
            await handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing: mockBilling,
                db: db as unknown as Parameters<
                    typeof handleSubscriptionCancellationAddons
                >[0]['db']
            });

            // Assert
            expect(entitlementMiddleware.clearEntitlementCache).toHaveBeenCalledOnce();
            expect(entitlementMiddleware.clearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);
        });

        it('should call clearEntitlementCache even when some purchases fail (partial failure)', async () => {
            // Arrange
            vi.mocked(revokeAddonForSubscriptionCancellation)
                .mockResolvedValueOnce(ENT_REVOCATION_OK) // addon 1 succeeds
                .mockRejectedValueOnce(new Error('fail')); // addon 2 fails

            const db = createMockDb([PURCHASE_ENT, PURCHASE_LIMIT]);

            // Act
            try {
                await handleSubscriptionCancellationAddons({
                    subscriptionId: SUBSCRIPTION_ID,
                    customerId: CUSTOMER_ID,
                    billing: mockBilling,
                    db: db as unknown as Parameters<
                        typeof handleSubscriptionCancellationAddons
                    >[0]['db']
                });
            } catch {
                // expected throw
            }

            // Assert — cache is cleared unconditionally even on partial failure
            expect(entitlementMiddleware.clearEntitlementCache).toHaveBeenCalledOnce();
            expect(entitlementMiddleware.clearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);
        });

        it('should call clearEntitlementCache even when ALL purchases fail', async () => {
            // Arrange
            vi.mocked(revokeAddonForSubscriptionCancellation)
                .mockRejectedValueOnce(new Error('fail 1'))
                .mockRejectedValueOnce(new Error('fail 2'));

            const db = createMockDb([PURCHASE_ENT, PURCHASE_LIMIT]);

            // Act
            try {
                await handleSubscriptionCancellationAddons({
                    subscriptionId: SUBSCRIPTION_ID,
                    customerId: CUSTOMER_ID,
                    billing: mockBilling,
                    db: db as unknown as Parameters<
                        typeof handleSubscriptionCancellationAddons
                    >[0]['db']
                });
            } catch {
                // expected throw
            }

            // Assert — unconditional cache clear per spec
            expect(entitlementMiddleware.clearEntitlementCache).toHaveBeenCalledOnce();
            expect(entitlementMiddleware.clearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);
        });
    });

    // =========================================================================
    // GAP-043-05: Partial failure and retry recovery
    // =========================================================================
    describe('partial failure and retry recovery', () => {
        /**
         * AC: Process 3 addons. Addon #2 revocation throws.
         *
         * Expected outcome after the first (failing) call:
         *   - Addon #1: status = 'canceled' (DB update called with status='canceled')
         *   - Addon #2: status remains 'active' (only metadata updated, no status='canceled')
         *   - Addon #3: status = 'canceled' (loop continues past the failed #2)
         *   - The service throws at the end because failed.length > 0
         */
        it('should cancel addon 1 and 3 in DB, leave addon 2 active when addon 2 revocation fails', async () => {
            // Arrange
            vi.mocked(revokeAddonForSubscriptionCancellation)
                .mockResolvedValueOnce(ENT_REVOCATION_OK) // addon 1 succeeds
                .mockRejectedValueOnce(new Error('QZPay timeout')) // addon 2 fails
                .mockResolvedValueOnce(THREE_REVOCATION_OK); // addon 3 succeeds

            const db = createMockDb([PURCHASE_ENT, PURCHASE_LIMIT, PURCHASE_THREE]);

            // Act
            try {
                await handleSubscriptionCancellationAddons({
                    subscriptionId: SUBSCRIPTION_ID,
                    customerId: CUSTOMER_ID,
                    billing: mockBilling,
                    db: db as unknown as Parameters<
                        typeof handleSubscriptionCancellationAddons
                    >[0]['db']
                });
            } catch {
                // expected — partial failure throws
            }

            // Assert — 3 DB update calls: addon1 (canceled) + addon2 (metadata) + addon3 (canceled)
            expect(db.update).toHaveBeenCalledTimes(3);

            const allSetCalls = db._mockUpdateSet.mock.calls as Array<[Record<string, unknown>]>;

            // Addon 1: status='canceled'
            const canceledCalls = allSetCalls.filter((call) => call[0]?.status === 'canceled');
            expect(canceledCalls).toHaveLength(2); // addons 1 and 3

            // Addon 2: metadata update only (no status='canceled')
            const metadataCalls = allSetCalls.filter(
                (call) =>
                    call[0] !== null &&
                    typeof call[0] === 'object' &&
                    'metadata' in call[0] &&
                    !('status' in call[0])
            );
            expect(metadataCalls).toHaveLength(1);

            // Assert — the metadata call has revocationRetryCount=1
            const meta = metadataCalls[0]?.[0]?.metadata as Record<string, unknown> | undefined;
            expect(meta?.revocationRetryCount).toBe(1);
        });

        /**
         * AC: On retry (simulating MercadoPago retry), addon #1 is already 'canceled'
         * in the DB (WHERE status='active' filters it out).
         * The DB mock returns only addons #2 and #3 as active.
         *
         * Expected:
         *   - Addon #1: skipped (not in active purchases query result)
         *   - Addon #2: retried and succeeds
         *   - Addon #3: processed
         *   - revokeAddonForSubscriptionCancellation called exactly 2 times (not 3)
         */
        it('should skip already-canceled addon 1 and retry addon 2 on subsequent call', async () => {
            // Arrange — DB only returns addons 2 and 3 as still active (addon 1 was persisted as canceled)
            vi.mocked(revokeAddonForSubscriptionCancellation)
                .mockResolvedValueOnce(LIMIT_REVOCATION_OK) // addon 2 succeeds on retry
                .mockResolvedValueOnce(THREE_REVOCATION_OK); // addon 3 succeeds

            const db = createMockDb([PURCHASE_LIMIT, PURCHASE_THREE]); // addon 1 not returned

            // Act
            const result = await handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing: mockBilling,
                db: db as unknown as Parameters<
                    typeof handleSubscriptionCancellationAddons
                >[0]['db']
            });

            // Assert — exactly 2 revocations (addon 1 filtered by WHERE status='active')
            expect(revokeAddonForSubscriptionCancellation).toHaveBeenCalledTimes(2);

            // Assert — addon 2 revocation called with correct purchase ID
            expect(revokeAddonForSubscriptionCancellation).toHaveBeenCalledWith(
                expect.objectContaining({
                    purchase: expect.objectContaining({ id: PURCHASE_LIMIT.id })
                })
            );

            // Assert — result reports only 2 processed
            expect(result.totalProcessed).toBe(2);
            expect(result.succeeded).toHaveLength(2);
            expect(result.failed).toHaveLength(0);
        });

        /**
         * AC: After the retry, all 3 addons are 'canceled'.
         * This verifies full recovery: 2 DB updates on retry (addons 2 and 3) + the
         * previous call's 2 updates (addons 1 and 3) = all 3 ultimately canceled.
         *
         * We test the retry call in isolation: the service returns totalProcessed=2,
         * both in succeeded, which means the caller knows addon 1 was already handled.
         */
        it('should result in full recovery after a successful retry call', async () => {
            // Arrange — only addons 2 and 3 remain active (addon 1 canceled on first attempt)
            vi.mocked(revokeAddonForSubscriptionCancellation)
                .mockResolvedValueOnce(LIMIT_REVOCATION_OK)
                .mockResolvedValueOnce(THREE_REVOCATION_OK);

            const db = createMockDb([PURCHASE_LIMIT, PURCHASE_THREE]);

            // Act
            const result = await handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing: mockBilling,
                db: db as unknown as Parameters<
                    typeof handleSubscriptionCancellationAddons
                >[0]['db']
            });

            // Assert — no failures on retry
            expect(result.failed).toHaveLength(0);
            expect(result.succeeded).toHaveLength(2);
            expect(result.totalProcessed).toBe(2);

            // Assert — both remaining addons were updated to 'canceled'
            expect(db.update).toHaveBeenCalledTimes(2);
            const allSetCalls = db._mockUpdateSet.mock.calls as Array<[Record<string, unknown>]>;
            const canceledCalls = allSetCalls.filter((call) => call[0]?.status === 'canceled');
            expect(canceledCalls).toHaveLength(2);

            // Assert — both set payloads include canceledAt as a Date
            for (const call of canceledCalls) {
                expect(call[0]?.canceledAt).toBeInstanceOf(Date);
            }
        });

        /**
         * Verifies that the WHERE condition on the retry UPDATE uses status='active'
         * (preventing re-cancellation of an already-canceled addon).
         *
         * The service calls: db.update(...).set({status:'canceled',...}).where(and(eq(id,...), eq(status,'active')))
         * The eq(status,'active') condition ensures idempotency.
         */
        it('should use status=active in the WHERE clause of the DB update to prevent double-cancellation', async () => {
            // Arrange
            vi.mocked(revokeAddonForSubscriptionCancellation).mockResolvedValueOnce(
                ENT_REVOCATION_OK
            );

            const db = createMockDb([PURCHASE_ENT]);

            // Act
            await handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing: mockBilling,
                db: db as unknown as Parameters<
                    typeof handleSubscriptionCancellationAddons
                >[0]['db']
            });

            // Assert — the WHERE condition passed to update().set().where() is called
            // We verify eq was called with 'status' and 'active' values
            const { eq } = await import('drizzle-orm');
            const eqCalls = vi.mocked(eq).mock.calls;

            // The service calls eq(billingAddonPurchases.status, 'active') in the update WHERE
            const activeStatusEqCall = eqCalls.find((call) => call[1] === 'active');
            expect(activeStatusEqCall).toBeDefined();
        });
    });

    // =========================================================================
    // Return shape and elapsedMs
    // =========================================================================
    describe('return value shape', () => {
        it('should include elapsedMs as a non-negative number in the result', async () => {
            // Arrange
            vi.mocked(revokeAddonForSubscriptionCancellation).mockResolvedValueOnce(
                ENT_REVOCATION_OK
            );

            const db = createMockDb([PURCHASE_ENT]);

            // Act
            const result = await handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing: mockBilling,
                db: db as unknown as Parameters<
                    typeof handleSubscriptionCancellationAddons
                >[0]['db']
            });

            // Assert
            expect(typeof result.elapsedMs).toBe('number');
            expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
        });

        it('should include elapsedMs in the no-op short-circuit result', async () => {
            // Arrange
            const db = createMockDb([]);

            // Act
            const result = await handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing: mockBilling,
                db: db as unknown as Parameters<
                    typeof handleSubscriptionCancellationAddons
                >[0]['db']
            });

            // Assert
            expect(typeof result.elapsedMs).toBe('number');
            expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
        });
    });

    // =========================================================================
    // GAP-043-047: AC-5.x audit trail assertions
    // =========================================================================
    describe('GAP-043-047: audit trail logging and Sentry context', () => {
        it('should log info with subscriptionId and totalProcessed on success', async () => {
            // Arrange
            vi.mocked(revokeAddonForSubscriptionCancellation)
                .mockResolvedValueOnce(ENT_REVOCATION_OK)
                .mockResolvedValueOnce(LIMIT_REVOCATION_OK);

            const db = createMockDb([PURCHASE_ENT, PURCHASE_LIMIT]);

            // Act
            await handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing: mockBilling,
                db: db as unknown as Parameters<
                    typeof handleSubscriptionCancellationAddons
                >[0]['db']
            });

            // Assert — info log includes subscriptionId and totalProcessed
            expect(vi.mocked(apiLogger.info)).toHaveBeenCalledWith(
                expect.objectContaining({
                    subscriptionId: SUBSCRIPTION_ID,
                    totalProcessed: 2
                }),
                expect.any(String)
            );
        });

        it('should call Sentry.captureException with extra object containing subscriptionId and customerId on failure', async () => {
            // Arrange
            vi.mocked(revokeAddonForSubscriptionCancellation).mockRejectedValueOnce(
                new Error('revocation error')
            );

            const db = createMockDb([PURCHASE_ENT]);

            // Act
            try {
                await handleSubscriptionCancellationAddons({
                    subscriptionId: SUBSCRIPTION_ID,
                    customerId: CUSTOMER_ID,
                    billing: mockBilling,
                    db: db as unknown as Parameters<
                        typeof handleSubscriptionCancellationAddons
                    >[0]['db']
                });
            } catch {
                // expected throw
            }

            // Assert — Sentry.captureException called with an Error and extra context
            expect(Sentry.captureException).toHaveBeenCalledWith(
                expect.any(Error),
                expect.objectContaining({
                    extra: expect.any(Object)
                })
            );
        });
    });

    // =========================================================================
    // GAP-043-027: Customer-not-found scenarios
    // =========================================================================
    describe('GAP-043-027: customer-not-found and transient billing error handling', () => {
        it('should succeed with totalProcessed=0 when no purchases found for subscription (empty DB)', async () => {
            // Arrange — simulates a webhook firing for an already-cleaned-up subscription
            const db = createMockDb([]);

            // Act — must not throw; returns empty result without QZPay calls
            const result = await handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing: mockBilling,
                db: db as unknown as Parameters<
                    typeof handleSubscriptionCancellationAddons
                >[0]['db']
            });

            // Assert — clean no-op result; no revocations attempted
            expect(result.totalProcessed).toBe(0);
            expect(result.succeeded).toHaveLength(0);
            expect(result.failed).toHaveLength(0);
            expect(revokeAddonForSubscriptionCancellation).not.toHaveBeenCalled();
        });

        it('should log a debug/info message when no purchases are found for the subscription', async () => {
            // Arrange
            const db = createMockDb([]);

            // Act
            await handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing: mockBilling,
                db: db as unknown as Parameters<
                    typeof handleSubscriptionCancellationAddons
                >[0]['db']
            });

            // Assert — a debug/info log was emitted indicating there's nothing to process
            const debugCalls = vi.mocked(apiLogger.debug).mock.calls;
            const infoCalls = vi.mocked(apiLogger.info).mock.calls;
            const allLogCalls = [...debugCalls, ...infoCalls];
            const hasRelevantLog = allLogCalls.some(
                (call) =>
                    JSON.stringify(call[0]).includes(SUBSCRIPTION_ID) ||
                    (typeof call[1] === 'string' && call[1].includes(SUBSCRIPTION_ID))
            );
            expect(hasRelevantLog).toBe(true);
        });

        it('should propagate as an error when DB query itself throws (not treated as customer-not-found)', async () => {
            // Arrange — simulate a transient DB error in the SELECT query
            const dbError = new Error('Connection pool exhausted');
            const faultyDb = {
                select: vi.fn(() => {
                    throw dbError;
                }),
                update: vi.fn()
            };

            // Act & Assert — transient error must propagate; must NOT be swallowed as a 0-result
            await expect(
                handleSubscriptionCancellationAddons({
                    subscriptionId: SUBSCRIPTION_ID,
                    customerId: CUSTOMER_ID,
                    billing: mockBilling,
                    db: faultyDb as unknown as Parameters<
                        typeof handleSubscriptionCancellationAddons
                    >[0]['db']
                })
            ).rejects.toThrow('Connection pool exhausted');
        });
    });
});
