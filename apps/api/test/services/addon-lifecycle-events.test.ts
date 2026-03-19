/**
 * Tests for the centralized addon lifecycle event emitter.
 *
 * Covers:
 * - T-054a: emitLifecycleEvent — PURCHASE_CONFIRMED logs with correct fields
 * - T-054b: emitLifecycleEvent — CANCELLATION_STARTED logs with correct fields
 * - T-054c: emitLifecycleEvent — CANCELLATION_COMPLETED logs with correct fields
 * - T-054d: emitLifecycleEvent — EXPIRATION_WARNING logs with correct fields
 * - T-054e: emitLifecycleEvent — EXPIRED logs with correct fields
 * - T-054f: emitLifecycleEvent — RENEWAL_CONFIRMED logs with correct fields
 * - T-054g: emitLifecycleEvent — LIMITS_RECALCULATED logs with correct fields
 * - T-054h: emitLifecycleEvent — REVOCATION_FAILED logs with correct fields
 * - T-054i: emitLifecycleEvent — optional metadata is included when provided
 * - T-054j: emitLifecycleEvent — optional metadata is omitted when absent
 * - T-054k: addonLogger is exported from utils/logger under ADDON_LIFECYCLE category
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
    emitLifecycleEvent
} from '../../src/services/addon-lifecycle-events';

// ─── Module mocks ─────────────────────────────────────────────────────────────

// vi.mock is hoisted to the top of the file, so the factory cannot reference
// variables declared in the module body. Use vi.hoisted to share the mock
// reference between the factory and the test assertions.
const { mockAddonLogger } = vi.hoisted(() => ({
    mockAddonLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    },
    addonLogger: mockAddonLogger
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
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // =========================================================================
    // T-054a: PURCHASE_CONFIRMED
    // =========================================================================
    describe('T-054a: PURCHASE_CONFIRMED', () => {
        it('should log with correct type, customerId, addonSlug, and purchaseId', async () => {
            // Arrange
            const event: PurchaseConfirmedEvent = {
                type: AddonLifecycleEventType.PURCHASE_CONFIRMED,
                customerId: CUSTOMER_ID,
                addonSlug: ADDON_SLUG,
                purchaseId: PURCHASE_ID,
                timestamp: TIMESTAMP
            };

            // Act
            await emitLifecycleEvent(event);

            // Assert
            expect(mockAddonLogger.info).toHaveBeenCalledOnce();
            const [logPayload, logMessage] = mockAddonLogger.info.mock.calls[0] as [
                Record<string, unknown>,
                string
            ];
            expect(logPayload).toMatchObject({
                type: 'addon.purchase.confirmed',
                customerId: CUSTOMER_ID,
                addonSlug: ADDON_SLUG,
                purchaseId: PURCHASE_ID
            });
            expect(logMessage).toBe('Addon lifecycle: addon.purchase.confirmed');
        });
    });

    // =========================================================================
    // T-054b: CANCELLATION_STARTED
    // =========================================================================
    describe('T-054b: CANCELLATION_STARTED', () => {
        it('should log with subscriptionId and addonCount', async () => {
            // Arrange
            const event: CancellationStartedEvent = {
                type: AddonLifecycleEventType.CANCELLATION_STARTED,
                customerId: CUSTOMER_ID,
                subscriptionId: SUBSCRIPTION_ID,
                addonCount: 3,
                timestamp: TIMESTAMP
            };

            // Act
            await emitLifecycleEvent(event);

            // Assert
            const [logPayload] = mockAddonLogger.info.mock.calls[0] as [Record<string, unknown>];
            expect(logPayload).toMatchObject({
                type: 'addon.cancellation.started',
                customerId: CUSTOMER_ID,
                subscriptionId: SUBSCRIPTION_ID,
                addonCount: 3
            });
        });
    });

    // =========================================================================
    // T-054c: CANCELLATION_COMPLETED
    // =========================================================================
    describe('T-054c: CANCELLATION_COMPLETED', () => {
        it('should log revokedCount and failedCount', async () => {
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
            const [logPayload] = mockAddonLogger.info.mock.calls[0] as [Record<string, unknown>];
            expect(logPayload).toMatchObject({
                type: 'addon.cancellation.completed',
                revokedCount: 2,
                failedCount: 1
            });
        });
    });

    // =========================================================================
    // T-054d: EXPIRATION_WARNING
    // =========================================================================
    describe('T-054d: EXPIRATION_WARNING', () => {
        it('should log daysRemaining along with purchaseId and addonSlug', async () => {
            // Arrange
            const event: ExpirationWarningEvent = {
                type: AddonLifecycleEventType.EXPIRATION_WARNING,
                customerId: CUSTOMER_ID,
                addonSlug: ADDON_SLUG,
                purchaseId: PURCHASE_ID,
                daysRemaining: 3,
                timestamp: TIMESTAMP
            };

            // Act
            await emitLifecycleEvent(event);

            // Assert
            const [logPayload] = mockAddonLogger.info.mock.calls[0] as [Record<string, unknown>];
            expect(logPayload).toMatchObject({
                type: 'addon.expiration.warning',
                addonSlug: ADDON_SLUG,
                purchaseId: PURCHASE_ID,
                daysRemaining: 3
            });
        });
    });

    // =========================================================================
    // T-054e: EXPIRED
    // =========================================================================
    describe('T-054e: EXPIRED', () => {
        it('should log addonSlug and purchaseId', async () => {
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
            const [logPayload, logMessage] = mockAddonLogger.info.mock.calls[0] as [
                Record<string, unknown>,
                string
            ];
            expect(logPayload).toMatchObject({
                type: 'addon.expired',
                addonSlug: ADDON_SLUG,
                purchaseId: PURCHASE_ID
            });
            expect(logMessage).toBe('Addon lifecycle: addon.expired');
        });
    });

    // =========================================================================
    // T-054f: RENEWAL_CONFIRMED
    // =========================================================================
    describe('T-054f: RENEWAL_CONFIRMED', () => {
        it('should log addonSlug and purchaseId for the new renewal cycle', async () => {
            // Arrange
            const renewedPurchaseId = 'purch_renewed_uuid-0001';
            const event: RenewalConfirmedEvent = {
                type: AddonLifecycleEventType.RENEWAL_CONFIRMED,
                customerId: CUSTOMER_ID,
                addonSlug: ADDON_SLUG,
                purchaseId: renewedPurchaseId,
                timestamp: TIMESTAMP
            };

            // Act
            await emitLifecycleEvent(event);

            // Assert
            const [logPayload] = mockAddonLogger.info.mock.calls[0] as [Record<string, unknown>];
            expect(logPayload).toMatchObject({
                type: 'addon.renewal.confirmed',
                addonSlug: ADDON_SLUG,
                purchaseId: renewedPurchaseId
            });
        });
    });

    // =========================================================================
    // T-054g: LIMITS_RECALCULATED
    // =========================================================================
    describe('T-054g: LIMITS_RECALCULATED', () => {
        it('should log trigger, evaluatedCount, and changedCount', async () => {
            // Arrange
            const event: LimitsRecalculatedEvent = {
                type: AddonLifecycleEventType.LIMITS_RECALCULATED,
                customerId: CUSTOMER_ID,
                trigger: 'plan-change',
                evaluatedCount: 5,
                changedCount: 2,
                timestamp: TIMESTAMP
            };

            // Act
            await emitLifecycleEvent(event);

            // Assert
            const [logPayload] = mockAddonLogger.info.mock.calls[0] as [Record<string, unknown>];
            expect(logPayload).toMatchObject({
                type: 'addon.limits.recalculated',
                trigger: 'plan-change',
                evaluatedCount: 5,
                changedCount: 2
            });
        });
    });

    // =========================================================================
    // T-054h: REVOCATION_FAILED
    // =========================================================================
    describe('T-054h: REVOCATION_FAILED', () => {
        it('should log errorMessage alongside purchaseId and addonSlug', async () => {
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
            const [logPayload] = mockAddonLogger.info.mock.calls[0] as [Record<string, unknown>];
            expect(logPayload).toMatchObject({
                type: 'addon.revocation.failed',
                addonSlug: ADDON_SLUG,
                purchaseId: PURCHASE_ID,
                errorMessage: 'QZPay timeout after 3 retries'
            });
        });
    });

    // =========================================================================
    // T-054i: optional metadata is forwarded when provided
    // =========================================================================
    describe('T-054i: optional metadata is included when provided', () => {
        it('should include metadata in the log payload', async () => {
            // Arrange
            const event: ExpiredEvent = {
                type: AddonLifecycleEventType.EXPIRED,
                customerId: CUSTOMER_ID,
                addonSlug: ADDON_SLUG,
                purchaseId: PURCHASE_ID,
                timestamp: TIMESTAMP,
                metadata: { jobId: 'cron-run-42', retryCount: 0 }
            };

            // Act
            await emitLifecycleEvent(event);

            // Assert
            const [logPayload] = mockAddonLogger.info.mock.calls[0] as [Record<string, unknown>];
            expect(logPayload).toMatchObject({
                metadata: { jobId: 'cron-run-42', retryCount: 0 }
            });
        });
    });

    // =========================================================================
    // T-054j: optional metadata is omitted when absent
    // =========================================================================
    describe('T-054j: optional metadata is omitted when absent', () => {
        it('should not include a metadata key when the field is undefined', async () => {
            // Arrange
            const event: ExpiredEvent = {
                type: AddonLifecycleEventType.EXPIRED,
                customerId: CUSTOMER_ID,
                addonSlug: ADDON_SLUG,
                purchaseId: PURCHASE_ID,
                timestamp: TIMESTAMP
                // no metadata field
            };

            // Act
            await emitLifecycleEvent(event);

            // Assert
            const [logPayload] = mockAddonLogger.info.mock.calls[0] as [Record<string, unknown>];
            expect(logPayload).not.toHaveProperty('metadata');
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
});
