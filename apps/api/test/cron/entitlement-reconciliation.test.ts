/**
 * Unit Tests: Entitlement Reconciliation Phase (T-039 / GAP-011)
 *
 * Tests the entitlement reconciliation phase inside the addon-expiry cron job.
 * This phase retries `removeAddonEntitlements()` for purchases that have
 * `entitlement_removal_pending = true` — set when the DB expiry succeeded but
 * the QZPay entitlement removal subsequently failed.
 *
 * Test Coverage:
 * - Queries by `entitlementRemovalPending = true` (dedicated column, not JSONB)
 * - Clears the flag and records retry count when removal succeeds
 * - Keeps the flag and increments retry count when removal fails
 * - Escalates to Sentry after 3 failed retries
 * - Skips all DB writes in dry-run mode
 * - Calls `clearEntitlementCache` on successful reconciliation
 * - Phase result counts are included in the job return value
 *
 * @module test/cron/entitlement-reconciliation
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types';

// ---------------------------------------------------------------------------
// DB mock plumbing — one chain per query path in the phase
// ---------------------------------------------------------------------------
const _mockDbLimit = vi.fn();
const _mockDbWhere = vi.fn();
const _mockDbFrom = vi.fn();
const mockDbSelect = vi.fn();

const mockDbUpdateWhere = vi.fn();
const mockDbUpdateSet = vi.fn();
const mockDbUpdate = vi.fn();

vi.mock('@repo/db', () => ({
    getDb: vi.fn(() => ({
        select: mockDbSelect,
        update: mockDbUpdate,
        execute: vi.fn().mockResolvedValue({ rows: [{ acquired: true }] })
    })),
    /**
     * Default passthrough: executes the callback with a tx stub that simulates
     * pg_try_advisory_xact_lock(43001) returning acquired=true.
     * The tx stub uses the shared mockDbSelect/mockDbUpdate so tests that
     * configure those mocks via setupDbForReconciliationPhase still work.
     */
    withTransaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
        const txStub = {
            select: mockDbSelect,
            update: mockDbUpdate,
            execute: vi.fn().mockResolvedValue({ rows: [{ acquired: true }] })
        };
        return callback(txStub);
    }),
    billingNotificationLog: {
        id: 'id',
        type: 'type',
        customerId: 'customer_id',
        createdAt: 'created_at',
        metadata: 'metadata'
    },
    billingAddonPurchases: {
        id: 'id',
        customerId: 'customer_id',
        addonSlug: 'addon_slug',
        subscriptionId: 'subscription_id',
        status: 'status',
        metadata: 'metadata',
        entitlementRemovalPending: 'entitlement_removal_pending',
        deletedAt: 'deleted_at',
        canceledAt: 'canceled_at',
        updatedAt: 'updated_at'
    },
    billingSubscriptions: {
        id: 'id',
        customerId: 'customer_id',
        status: 'status',
        deletedAt: 'deleted_at',
        updatedAt: 'updated_at'
    },
    eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
    and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
    gte: vi.fn((...args: unknown[]) => ({ op: 'gte', args })),
    isNull: vi.fn((...args: unknown[]) => ({ op: 'isNull', args })),
    sql: vi.fn((...args: unknown[]) => ({ op: 'sql', args }))
}));

// ---------------------------------------------------------------------------
// Service layer mocks
// ---------------------------------------------------------------------------
const mockRemoveAddonEntitlements = vi.fn();

vi.mock('../../src/services/addon-expiration.service', () => ({
    AddonExpirationService: vi.fn().mockImplementation(() => ({
        findExpiredAddons: vi.fn().mockResolvedValue({ success: true, data: [] }),
        findExpiringAddons: vi.fn().mockResolvedValue({ success: true, data: [] }),
        processExpiredAddons: vi.fn().mockResolvedValue({
            success: true,
            data: { processed: 0, failed: 0, errors: [] }
        })
    }))
}));

vi.mock('../../src/services/addon-entitlement.service', () => ({
    AddonEntitlementService: vi.fn().mockImplementation(() => ({
        removeAddonEntitlements: mockRemoveAddonEntitlements
    }))
}));

vi.mock('../../src/services/addon-lifecycle.service', () => ({
    revokeAddonForSubscriptionCancellation: vi.fn().mockResolvedValue({ outcome: 'success' })
}));

vi.mock('../../src/utils/notification-helper', () => ({
    sendNotification: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn().mockReturnValue({
        subscriptions: {
            get: vi.fn().mockResolvedValue(null),
            cancel: vi.fn().mockResolvedValue(undefined)
        }
    })
}));

vi.mock('../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: vi.fn()
}));

vi.mock('../../src/utils/customer-lookup', () => ({
    lookupCustomerDetails: vi.fn().mockResolvedValue(null)
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('@repo/billing', () => ({
    getAddonBySlug: vi.fn().mockReturnValue(null)
}));

vi.mock('@sentry/node', () => ({
    captureException: vi.fn()
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------
import * as Sentry from '@sentry/node';
import { addonExpiryJob } from '../../src/cron/jobs/addon-expiry.job';
import { clearEntitlementCache } from '../../src/middlewares/entitlement';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a minimal CronJobContext for unit tests.
 */
function buildCtx(overrides: Partial<CronJobContext> = {}): CronJobContext {
    return {
        logger: {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn()
        } as unknown as CronJobContext['logger'],
        startedAt: new Date('2024-03-01T05:00:00Z'),
        dryRun: false,
        ...overrides
    };
}

/**
 * Creates a mock purchase row that has `entitlementRemovalPending = true`.
 */
function buildPendingPurchase(
    overrides: Partial<{
        id: string;
        customerId: string;
        addonSlug: string;
        metadata: Record<string, unknown>;
    }> = {}
) {
    return {
        id: overrides.id ?? 'purchase_reconcile_001',
        customerId: overrides.customerId ?? 'cust_abc',
        addonSlug: overrides.addonSlug ?? 'extra-photos',
        metadata: overrides.metadata ?? {}
    };
}

/**
 * Sets up the DB mock chain to return the given rows for the
 * `pendingEntitlementRemoval` SELECT query (phase 6 of the cron handler).
 *
 * The select chain is: select → from → where → limit → resolves rows.
 * Other phases (revocation retry, split-state) also call select, so we use
 * a counter to distinguish calls.
 */
function setupDbForReconciliationPhase(rows: ReturnType<typeof buildPendingPurchase>[]) {
    // All other select calls (notification log, orphaned purchases, split-state subs)
    // resolve with empty arrays so they don't interfere.
    const emptyChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([])
    };

    // The reconciliation-phase select chain returns our rows.
    const reconcileChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(rows)
    };

    // select() is called across phases. With no expired/expiring addons,
    // wasNotificationSent is never invoked. The actual call order is:
    //   call 1  → orphaned purchases (empty)
    //   call 2  → split-state subs (empty)
    //   call 3  → pendingEntitlementRemoval (our rows)
    mockDbSelect
        .mockReturnValueOnce(emptyChain) // orphaned purchases
        .mockReturnValueOnce(emptyChain) // split-state subs
        .mockReturnValue(reconcileChain); // reconciliation phase (and any further)

    // update chain
    mockDbUpdate.mockReturnValue({
        set: mockDbUpdateSet.mockReturnValue({
            where: mockDbUpdateWhere.mockResolvedValue({ rowCount: 1 })
        })
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

import { withTransaction } from '@repo/db';

describe('addon-expiry cron — entitlement reconciliation phase (T-039)', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Restore withTransaction default after clearAllMocks() resets it.
        // The tx stub uses the shared mockDbSelect/mockDbUpdate so tests that
        // configure those mocks via setupDbForReconciliationPhase still work.
        vi.mocked(withTransaction).mockImplementation(async (callback) => {
            const txStub = {
                select: mockDbSelect,
                update: mockDbUpdate,
                execute: vi.fn().mockResolvedValue({ rows: [{ acquired: true }] })
            };
            return callback(txStub as never);
        });
    });

    describe('when entitlementRemovalPending purchases exist', () => {
        it('should clear the flag and record retry count on successful removal', async () => {
            // Arrange
            const purchase = buildPendingPurchase({ metadata: {} });
            setupDbForReconciliationPhase([purchase]);
            mockRemoveAddonEntitlements.mockResolvedValueOnce({ success: true, data: undefined });

            // Act
            const result = await addonExpiryJob.handler(buildCtx());

            // Assert — job succeeded
            expect(result.success).toBe(true);

            // Assert — update was called to clear the flag
            expect(mockDbUpdate).toHaveBeenCalled();
            expect(mockDbUpdateSet).toHaveBeenCalledWith(
                expect.objectContaining({
                    entitlementRemovalPending: false,
                    metadata: expect.objectContaining({ entitlementRemovalRetries: 1 })
                })
            );

            // Assert — cache was invalidated
            expect(clearEntitlementCache).toHaveBeenCalledWith(purchase.customerId);

            // Assert — reconciled count reflected in details
            expect(result.details).toMatchObject({ entitlementReconciled: 1 });
        });

        it('should keep the flag and increment retry count when removal fails', async () => {
            // Arrange
            const purchase = buildPendingPurchase({ metadata: { entitlementRemovalRetries: 1 } });
            setupDbForReconciliationPhase([purchase]);
            mockRemoveAddonEntitlements.mockResolvedValueOnce({
                success: false,
                error: { code: 'QZPAY_ERROR', message: 'upstream failure' }
            });

            // Act
            const result = await addonExpiryJob.handler(buildCtx());

            // Assert — job still succeeds (reconciliation errors are non-fatal)
            expect(result.success).toBe(true);

            // Assert — update increments retry count but does NOT clear the flag
            expect(mockDbUpdateSet).toHaveBeenCalledWith(
                expect.objectContaining({
                    metadata: expect.objectContaining({ entitlementRemovalRetries: 2 })
                })
            );
            // The set payload must NOT contain entitlementRemovalPending: false
            const setCall = mockDbUpdateSet.mock.calls[0]?.[0] as
                | Record<string, unknown>
                | undefined;
            expect(setCall).not.toHaveProperty('entitlementRemovalPending');

            // Assert — cache NOT invalidated (removal failed)
            expect(clearEntitlementCache).not.toHaveBeenCalled();

            // Assert — error count reflected
            expect(result.details).toMatchObject({ entitlementReconcileErrors: 1 });
        });

        it('should escalate to Sentry after 3 consecutive failures', async () => {
            // Arrange — second retry (retryCount=2, so newRetryCount becomes 3)
            const purchase = buildPendingPurchase({ metadata: { entitlementRemovalRetries: 2 } });
            setupDbForReconciliationPhase([purchase]);
            mockRemoveAddonEntitlements.mockResolvedValueOnce({
                success: false,
                error: { code: 'QZPAY_ERROR', message: 'persistent failure' }
            });

            // Act
            await addonExpiryJob.handler(buildCtx());

            // Assert — Sentry was called
            expect(Sentry.captureException).toHaveBeenCalledWith(
                expect.any(Error),
                expect.objectContaining({
                    tags: expect.objectContaining({ phase: 'entitlement-reconciliation' }),
                    extra: expect.objectContaining({ purchaseId: purchase.id })
                })
            );
        });

        it('should NOT escalate to Sentry before 3 failures', async () => {
            // Arrange — first retry (retryCount=0, so newRetryCount becomes 1)
            const purchase = buildPendingPurchase({ metadata: {} });
            setupDbForReconciliationPhase([purchase]);
            mockRemoveAddonEntitlements.mockResolvedValueOnce({
                success: false,
                error: { code: 'QZPAY_ERROR', message: 'transient failure' }
            });

            // Act
            await addonExpiryJob.handler(buildCtx());

            // Assert — Sentry was NOT called for first failure
            expect(Sentry.captureException).not.toHaveBeenCalledWith(
                expect.any(Error),
                expect.objectContaining({
                    tags: expect.objectContaining({ phase: 'entitlement-reconciliation' })
                })
            );
        });

        it('should handle removeAddonEntitlements throwing an exception', async () => {
            // Arrange
            const purchase = buildPendingPurchase();
            setupDbForReconciliationPhase([purchase]);
            mockRemoveAddonEntitlements.mockRejectedValueOnce(new Error('network timeout'));

            // Act
            const result = await addonExpiryJob.handler(buildCtx());

            // Assert — job still succeeds (per-item errors are caught)
            expect(result.success).toBe(true);

            // Assert — Sentry captured the exception
            expect(Sentry.captureException).toHaveBeenCalledWith(
                expect.any(Error),
                expect.objectContaining({
                    tags: expect.objectContaining({ phase: 'entitlement-reconciliation' })
                })
            );

            expect(result.details).toMatchObject({ entitlementReconcileErrors: 1 });
        });

        it('should skip DB writes and only count in dry-run mode', async () => {
            // Arrange
            const purchase = buildPendingPurchase();
            setupDbForReconciliationPhase([purchase]);

            // Act
            const result = await addonExpiryJob.handler(buildCtx({ dryRun: true }));

            // Assert — no DB writes
            expect(mockDbUpdate).not.toHaveBeenCalled();
            expect(mockRemoveAddonEntitlements).not.toHaveBeenCalled();
            expect(clearEntitlementCache).not.toHaveBeenCalled();

            // Assert — still counted (so the result reflects what would happen)
            expect(result.details).toMatchObject({ entitlementReconciled: 1 });
        });
    });

    describe('when no purchases have entitlementRemovalPending', () => {
        it('should complete phase with zero counts and no DB writes', async () => {
            // Arrange — reconciliation SELECT returns empty array
            setupDbForReconciliationPhase([]);

            // Act
            const result = await addonExpiryJob.handler(buildCtx());

            // Assert
            expect(result.success).toBe(true);
            expect(result.details).toMatchObject({
                entitlementReconciled: 0,
                entitlementReconcileErrors: 0
            });
            expect(mockRemoveAddonEntitlements).not.toHaveBeenCalled();
            expect(clearEntitlementCache).not.toHaveBeenCalled();
        });
    });
});
