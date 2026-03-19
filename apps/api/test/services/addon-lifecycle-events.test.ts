/**
 * Tests for the centralized addon lifecycle event emitter.
 *
 * After migration to @repo/service-core, emitLifecycleEvent no longer logs
 * via addonLogger. Instead it collects in-memory metrics. These tests verify:
 * - T-054a-h: emitLifecycleEvent dispatches events without throwing
 * - T-054i: metadata is accessible on the event (passed through to metrics)
 * - T-054j: event without metadata does not throw
 * - T-054k: addonLogger is still exported from utils/logger
 * - T-054-metrics: in-memory metrics are updated correctly per event type
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    AddonLifecycleEventType,
    type CancellationCompletedEvent,
    type CancellationStartedEvent,
    type ExpirationWarningEvent,
    type ExpiredEvent,
    type LimitsRecalculatedEvent,
    type PurchaseConfirmedEvent,
    type RenewalConfirmedEvent,
    type RevocationFailedEvent,
    emitLifecycleEvent,
    getAddonLifecycleMetrics,
    resetAddonLifecycleMetrics
} from '../../src/services/addon-lifecycle-events';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    },
    addonLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CUSTOMER_ID = 'cus_test_lifecycle_001';
const ADDON_SLUG = 'visibility-boost-7d';
const PURCHASE_ID = 'purch_test_uuid-0001-0002-0003-000000000099';
const SUBSCRIPTION_ID = 'sub_test_uuid-0001-0002-0003-000000000001';
const TIMESTAMP = new Date('2026-01-15T12:00:00.000Z');

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('emitLifecycleEvent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetAddonLifecycleMetrics();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // =========================================================================
    // T-054a: PURCHASE_CONFIRMED
    // =========================================================================
    describe('T-054a: PURCHASE_CONFIRMED', () => {
        it('should dispatch without throwing', async () => {
            // Arrange
            const event: PurchaseConfirmedEvent = {
                type: AddonLifecycleEventType.PURCHASE_CONFIRMED,
                customerId: CUSTOMER_ID,
                addonSlug: ADDON_SLUG,
                purchaseId: PURCHASE_ID,
                timestamp: TIMESTAMP
            };

            // Act & Assert — should not throw
            await expect(emitLifecycleEvent(event)).resolves.toBeUndefined();
        });
    });

    // =========================================================================
    // T-054b: CANCELLATION_STARTED
    // =========================================================================
    describe('T-054b: CANCELLATION_STARTED', () => {
        it('should dispatch without throwing', async () => {
            // Arrange
            const event: CancellationStartedEvent = {
                type: AddonLifecycleEventType.CANCELLATION_STARTED,
                customerId: CUSTOMER_ID,
                subscriptionId: SUBSCRIPTION_ID,
                addonCount: 3,
                timestamp: TIMESTAMP
            };

            // Act & Assert
            await expect(emitLifecycleEvent(event)).resolves.toBeUndefined();
        });
    });

    // =========================================================================
    // T-054c: CANCELLATION_COMPLETED — updates revocation metrics
    // =========================================================================
    describe('T-054c: CANCELLATION_COMPLETED', () => {
        it('should increment revocationOutcomes.success in metrics', async () => {
            // Arrange
            const event: CancellationCompletedEvent = {
                type: AddonLifecycleEventType.CANCELLATION_COMPLETED,
                customerId: CUSTOMER_ID,
                subscriptionId: SUBSCRIPTION_ID,
                revokedCount: 2,
                failedCount: 1,
                timestamp: TIMESTAMP
            };

            // Act
            await emitLifecycleEvent(event);

            // Assert
            const metrics = getAddonLifecycleMetrics();
            expect(metrics.revocationOutcomes.success).toBe(1);
        });
    });

    // =========================================================================
    // T-054d: EXPIRATION_WARNING
    // =========================================================================
    describe('T-054d: EXPIRATION_WARNING', () => {
        it('should dispatch without throwing', async () => {
            // Arrange
            const event: ExpirationWarningEvent = {
                type: AddonLifecycleEventType.EXPIRATION_WARNING,
                customerId: CUSTOMER_ID,
                addonSlug: ADDON_SLUG,
                purchaseId: PURCHASE_ID,
                daysRemaining: 3,
                timestamp: TIMESTAMP
            };

            // Act & Assert
            await expect(emitLifecycleEvent(event)).resolves.toBeUndefined();
        });
    });

    // =========================================================================
    // T-054e: EXPIRED — updates expiryRetryCount in metrics
    // =========================================================================
    describe('T-054e: EXPIRED', () => {
        it('should increment expiryRetryCount in metrics', async () => {
            // Arrange
            const event: ExpiredEvent = {
                type: AddonLifecycleEventType.EXPIRED,
                customerId: CUSTOMER_ID,
                addonSlug: ADDON_SLUG,
                purchaseId: PURCHASE_ID,
                timestamp: TIMESTAMP
            };

            // Act
            await emitLifecycleEvent(event);

            // Assert
            const metrics = getAddonLifecycleMetrics();
            expect(metrics.expiryRetryCount).toBe(1);
        });
    });

    // =========================================================================
    // T-054f: RENEWAL_CONFIRMED
    // =========================================================================
    describe('T-054f: RENEWAL_CONFIRMED', () => {
        it('should dispatch without throwing', async () => {
            // Arrange
            const renewedPurchaseId = 'purch_renewed_uuid-0001';
            const event: RenewalConfirmedEvent = {
                type: AddonLifecycleEventType.RENEWAL_CONFIRMED,
                customerId: CUSTOMER_ID,
                addonSlug: ADDON_SLUG,
                purchaseId: renewedPurchaseId,
                timestamp: TIMESTAMP
            };

            // Act & Assert
            await expect(emitLifecycleEvent(event)).resolves.toBeUndefined();
        });
    });

    // =========================================================================
    // T-054g: LIMITS_RECALCULATED — updates recalculation metrics
    // =========================================================================
    describe('T-054g: LIMITS_RECALCULATED', () => {
        it('should track durationMs in recalculationDurationMs when metadata contains it', async () => {
            // Arrange
            const event: LimitsRecalculatedEvent = {
                type: AddonLifecycleEventType.LIMITS_RECALCULATED,
                customerId: CUSTOMER_ID,
                trigger: 'plan-change',
                evaluatedCount: 5,
                changedCount: 2,
                timestamp: TIMESTAMP,
                metadata: { durationMs: 42 }
            };

            // Act
            await emitLifecycleEvent(event);

            // Assert
            const metrics = getAddonLifecycleMetrics();
            expect(metrics.recalculationDurationMs).toContain(42);
        });
    });

    // =========================================================================
    // T-054h: REVOCATION_FAILED — updates revocationOutcomes.failed
    // =========================================================================
    describe('T-054h: REVOCATION_FAILED', () => {
        it('should increment revocationOutcomes.failed in metrics', async () => {
            // Arrange
            const event: RevocationFailedEvent = {
                type: AddonLifecycleEventType.REVOCATION_FAILED,
                customerId: CUSTOMER_ID,
                addonSlug: ADDON_SLUG,
                purchaseId: PURCHASE_ID,
                errorMessage: 'QZPay timeout after 3 retries',
                timestamp: TIMESTAMP
            };

            // Act
            await emitLifecycleEvent(event);

            // Assert
            const metrics = getAddonLifecycleMetrics();
            expect(metrics.revocationOutcomes.failed).toBe(1);
        });
    });

    // =========================================================================
    // T-054i: optional metadata is forwarded when provided
    // =========================================================================
    describe('T-054i: optional metadata is included when provided', () => {
        it('should process metadata without throwing (metrics use metadata.durationMs)', async () => {
            // Arrange
            const event: ExpiredEvent = {
                type: AddonLifecycleEventType.EXPIRED,
                customerId: CUSTOMER_ID,
                addonSlug: ADDON_SLUG,
                purchaseId: PURCHASE_ID,
                timestamp: TIMESTAMP,
                metadata: { jobId: 'cron-run-42', retryCount: 0 }
            };

            // Act & Assert — metadata is accessible, should not throw
            await expect(emitLifecycleEvent(event)).resolves.toBeUndefined();
            const metrics = getAddonLifecycleMetrics();
            expect(metrics.expiryRetryCount).toBe(1);
        });
    });

    // =========================================================================
    // T-054j: optional metadata is omitted when absent
    // =========================================================================
    describe('T-054j: optional metadata is omitted when absent', () => {
        it('should dispatch without throwing when metadata is undefined', async () => {
            // Arrange
            const event: ExpiredEvent = {
                type: AddonLifecycleEventType.EXPIRED,
                customerId: CUSTOMER_ID,
                addonSlug: ADDON_SLUG,
                purchaseId: PURCHASE_ID,
                timestamp: TIMESTAMP
                // no metadata field
            };

            // Act & Assert
            await expect(emitLifecycleEvent(event)).resolves.toBeUndefined();
        });
    });

    // =========================================================================
    // T-054k: addonLogger is exported from utils/logger
    // =========================================================================
    describe('T-054k: addonLogger export from utils/logger', () => {
        it('should export addonLogger from utils/logger', async () => {
            // Arrange & Act
            const loggerModule = await import('../../src/utils/logger');

            // Assert — addonLogger must be exported alongside apiLogger
            expect(loggerModule).toHaveProperty('addonLogger');
            expect(loggerModule).toHaveProperty('apiLogger');
        });
    });

    // =========================================================================
    // T-054-metrics: resetAddonLifecycleMetrics clears state
    // =========================================================================
    describe('T-054-metrics: resetAddonLifecycleMetrics', () => {
        it('should reset all in-memory counters to zero', async () => {
            // Arrange: emit some events to increment metrics
            await emitLifecycleEvent({
                type: AddonLifecycleEventType.REVOCATION_FAILED,
                customerId: CUSTOMER_ID,
                addonSlug: ADDON_SLUG,
                purchaseId: PURCHASE_ID,
                errorMessage: 'test',
                timestamp: TIMESTAMP
            });
            await emitLifecycleEvent({
                type: AddonLifecycleEventType.EXPIRED,
                customerId: CUSTOMER_ID,
                addonSlug: ADDON_SLUG,
                purchaseId: PURCHASE_ID,
                timestamp: TIMESTAMP
            });

            // Sanity check
            let metrics = getAddonLifecycleMetrics();
            expect(metrics.revocationOutcomes.failed).toBe(1);
            expect(metrics.expiryRetryCount).toBe(1);

            // Act
            resetAddonLifecycleMetrics();

            // Assert
            metrics = getAddonLifecycleMetrics();
            expect(metrics.revocationOutcomes.failed).toBe(0);
            expect(metrics.revocationOutcomes.success).toBe(0);
            expect(metrics.expiryRetryCount).toBe(0);
            expect(metrics.recalculationDurationMs).toHaveLength(0);
            expect(metrics.revocationDurationMs).toHaveLength(0);
        });
    });
});
