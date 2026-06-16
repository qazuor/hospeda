/**
 * @file addon-lifecycle-events.test.ts
 *
 * Unit tests for the addon lifecycle event emitter and in-memory metrics store.
 *
 * Targets:
 * - emitLifecycleEvent: all event type branches
 * - getAddonLifecycleMetrics: snapshot isolation
 * - resetAddonLifecycleMetrics: resets all counters/arrays
 * - METRICS_BUFFER_CAP overflow behaviour
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    AddonLifecycleEventType,
    emitLifecycleEvent,
    getAddonLifecycleMetrics,
    resetAddonLifecycleMetrics
} from '../../../src/services/billing/addon/addon-lifecycle-events.js';

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------

function makeCancellationCompletedEvent(overrides: Record<string, unknown> = {}) {
    return {
        type: AddonLifecycleEventType.CANCELLATION_COMPLETED,
        customerId: 'cus_test_001',
        subscriptionId: 'sub_test_001',
        revokedCount: 2,
        failedCount: 0,
        timestamp: new Date(),
        ...overrides
    } as const;
}

function makeRevocationFailedEvent(overrides: Record<string, unknown> = {}) {
    return {
        type: AddonLifecycleEventType.REVOCATION_FAILED,
        customerId: 'cus_test_001',
        addonSlug: 'visibility-boost-7d',
        purchaseId: 'purch_test_001',
        errorMessage: 'Revocation timed out',
        timestamp: new Date(),
        ...overrides
    } as const;
}

function makeLimitsRecalculatedEvent(overrides: Record<string, unknown> = {}) {
    return {
        type: AddonLifecycleEventType.LIMITS_RECALCULATED,
        customerId: 'cus_test_001',
        trigger: 'plan-change',
        evaluatedCount: 5,
        changedCount: 2,
        timestamp: new Date(),
        ...overrides
    } as const;
}

function makeExpiredEvent() {
    return {
        type: AddonLifecycleEventType.EXPIRED,
        customerId: 'cus_test_001',
        addonSlug: 'extra-photos-20',
        purchaseId: 'purch_test_002',
        timestamp: new Date()
    } as const;
}

function makePurchaseConfirmedEvent() {
    return {
        type: AddonLifecycleEventType.PURCHASE_CONFIRMED,
        customerId: 'cus_test_001',
        addonSlug: 'visibility-boost-7d',
        purchaseId: 'purch_test_003',
        timestamp: new Date()
    } as const;
}

function makeCancellationStartedEvent() {
    return {
        type: AddonLifecycleEventType.CANCELLATION_STARTED,
        customerId: 'cus_test_001',
        subscriptionId: 'sub_test_001',
        addonCount: 3,
        timestamp: new Date()
    } as const;
}

function makeExpirationWarningEvent() {
    return {
        type: AddonLifecycleEventType.EXPIRATION_WARNING,
        customerId: 'cus_test_001',
        addonSlug: 'extra-photos-20',
        purchaseId: 'purch_test_004',
        daysRemaining: 3,
        timestamp: new Date()
    } as const;
}

function makeRenewalConfirmedEvent() {
    return {
        type: AddonLifecycleEventType.RENEWAL_CONFIRMED,
        customerId: 'cus_test_001',
        addonSlug: 'visibility-boost-7d',
        purchaseId: 'purch_test_005',
        timestamp: new Date()
    } as const;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('addon-lifecycle-events', () => {
    beforeEach(() => {
        resetAddonLifecycleMetrics();
    });

    afterEach(() => {
        resetAddonLifecycleMetrics();
    });

    // =========================================================================
    // resetAddonLifecycleMetrics
    // =========================================================================

    describe('resetAddonLifecycleMetrics', () => {
        it('should reset all counters and arrays to zero', async () => {
            // Arrange — populate some metrics first
            await emitLifecycleEvent(
                makeCancellationCompletedEvent({ metadata: { durationMs: 100 } })
            );
            await emitLifecycleEvent(makeRevocationFailedEvent());
            await emitLifecycleEvent(makeExpiredEvent());

            // Act
            resetAddonLifecycleMetrics();

            // Assert
            const metrics = getAddonLifecycleMetrics();
            expect(metrics.revocationDurationMs).toHaveLength(0);
            expect(metrics.revocationOutcomes.success).toBe(0);
            expect(metrics.revocationOutcomes.failed).toBe(0);
            expect(metrics.recalculationDurationMs).toHaveLength(0);
            expect(metrics.expiryRetryCount).toBe(0);
            expect(metrics.cacheHitRate.hits).toBe(0);
            expect(metrics.cacheHitRate.misses).toBe(0);
        });
    });

    // =========================================================================
    // getAddonLifecycleMetrics — snapshot isolation
    // =========================================================================

    describe('getAddonLifecycleMetrics', () => {
        it('should return a shallow copy — mutations do not affect internal state', async () => {
            // Arrange
            await emitLifecycleEvent(
                makeCancellationCompletedEvent({ metadata: { durationMs: 42 } })
            );
            const snap = getAddonLifecycleMetrics();

            // Act — mutate the snapshot (nested objects are not deeply readonly, so these are valid mutations)
            snap.revocationOutcomes.success = 9999;
            snap.revocationDurationMs.push(9999);

            // Assert — original state is unchanged
            const snap2 = getAddonLifecycleMetrics();
            expect(snap2.revocationOutcomes.success).toBe(1);
            expect(snap2.revocationDurationMs).not.toContain(9999);
        });
    });

    // =========================================================================
    // emitLifecycleEvent — CANCELLATION_COMPLETED
    // =========================================================================

    describe('CANCELLATION_COMPLETED', () => {
        it('should increment revocationOutcomes.success', async () => {
            // Act
            await emitLifecycleEvent(makeCancellationCompletedEvent());

            // Assert
            expect(getAddonLifecycleMetrics().revocationOutcomes.success).toBe(1);
        });

        it('should push durationMs to revocationDurationMs when metadata.durationMs is a number', async () => {
            // Act
            await emitLifecycleEvent(
                makeCancellationCompletedEvent({ metadata: { durationMs: 250 } })
            );

            // Assert
            const metrics = getAddonLifecycleMetrics();
            expect(metrics.revocationDurationMs).toContain(250);
        });

        it('should NOT push durationMs when metadata is absent', async () => {
            // Act
            await emitLifecycleEvent(makeCancellationCompletedEvent());

            // Assert
            expect(getAddonLifecycleMetrics().revocationDurationMs).toHaveLength(0);
        });

        it('should NOT push durationMs when metadata.durationMs is not a number', async () => {
            // Act
            await emitLifecycleEvent(
                makeCancellationCompletedEvent({ metadata: { durationMs: 'not-a-number' } })
            );

            // Assert
            expect(getAddonLifecycleMetrics().revocationDurationMs).toHaveLength(0);
        });

        it('should cap revocationDurationMs at METRICS_BUFFER_CAP (1000) by shifting', async () => {
            // Arrange — fill the buffer to exactly 1000 entries
            for (let i = 0; i < 1000; i++) {
                await emitLifecycleEvent(
                    makeCancellationCompletedEvent({ metadata: { durationMs: i } })
                );
            }
            expect(getAddonLifecycleMetrics().revocationDurationMs).toHaveLength(1000);

            // Act — add one more
            await emitLifecycleEvent(
                makeCancellationCompletedEvent({ metadata: { durationMs: 9999 } })
            );

            // Assert — length stays at 1000, oldest entry dropped
            const metrics = getAddonLifecycleMetrics();
            expect(metrics.revocationDurationMs).toHaveLength(1000);
            expect(metrics.revocationDurationMs[999]).toBe(9999);
            expect(metrics.revocationDurationMs[0]).toBe(1); // index 0 was shifted out (was 0), now 1
        });
    });

    // =========================================================================
    // emitLifecycleEvent — REVOCATION_FAILED
    // =========================================================================

    describe('REVOCATION_FAILED', () => {
        it('should increment revocationOutcomes.failed', async () => {
            // Act
            await emitLifecycleEvent(makeRevocationFailedEvent());
            await emitLifecycleEvent(makeRevocationFailedEvent());

            // Assert
            expect(getAddonLifecycleMetrics().revocationOutcomes.failed).toBe(2);
        });
    });

    // =========================================================================
    // emitLifecycleEvent — LIMITS_RECALCULATED
    // =========================================================================

    describe('LIMITS_RECALCULATED', () => {
        it('should push durationMs to recalculationDurationMs when metadata.durationMs is a number', async () => {
            // Act
            await emitLifecycleEvent(
                makeLimitsRecalculatedEvent({ metadata: { durationMs: 333 } })
            );

            // Assert
            const metrics = getAddonLifecycleMetrics();
            expect(metrics.recalculationDurationMs).toContain(333);
        });

        it('should NOT push durationMs when metadata is absent', async () => {
            // Act
            await emitLifecycleEvent(makeLimitsRecalculatedEvent());

            // Assert
            expect(getAddonLifecycleMetrics().recalculationDurationMs).toHaveLength(0);
        });

        it('should cap recalculationDurationMs at METRICS_BUFFER_CAP by shifting', async () => {
            // Arrange — fill to capacity
            for (let i = 0; i < 1000; i++) {
                await emitLifecycleEvent(
                    makeLimitsRecalculatedEvent({ metadata: { durationMs: i } })
                );
            }

            // Act — overflow by 1
            await emitLifecycleEvent(
                makeLimitsRecalculatedEvent({ metadata: { durationMs: 8888 } })
            );

            // Assert
            const metrics = getAddonLifecycleMetrics();
            expect(metrics.recalculationDurationMs).toHaveLength(1000);
            expect(metrics.recalculationDurationMs[999]).toBe(8888);
        });
    });

    // =========================================================================
    // emitLifecycleEvent — EXPIRED
    // =========================================================================

    describe('EXPIRED', () => {
        it('should increment expiryRetryCount', async () => {
            // Act
            await emitLifecycleEvent(makeExpiredEvent());
            await emitLifecycleEvent(makeExpiredEvent());

            // Assert
            expect(getAddonLifecycleMetrics().expiryRetryCount).toBe(2);
        });
    });

    // =========================================================================
    // emitLifecycleEvent — no-op / default branch events
    // =========================================================================

    describe('default (no-op) event types', () => {
        it('PURCHASE_CONFIRMED should not mutate any metric counters', async () => {
            // Act
            await emitLifecycleEvent(makePurchaseConfirmedEvent());

            // Assert — all counters still at zero
            const metrics = getAddonLifecycleMetrics();
            expect(metrics.revocationOutcomes.success).toBe(0);
            expect(metrics.revocationOutcomes.failed).toBe(0);
            expect(metrics.expiryRetryCount).toBe(0);
        });

        it('CANCELLATION_STARTED should not mutate any metric counters', async () => {
            // Act
            await emitLifecycleEvent(makeCancellationStartedEvent());

            // Assert
            const metrics = getAddonLifecycleMetrics();
            expect(metrics.revocationOutcomes.success).toBe(0);
            expect(metrics.expiryRetryCount).toBe(0);
        });

        it('EXPIRATION_WARNING should not mutate any metric counters', async () => {
            // Act
            await emitLifecycleEvent(makeExpirationWarningEvent());

            // Assert
            const metrics = getAddonLifecycleMetrics();
            expect(metrics.revocationOutcomes.success).toBe(0);
            expect(metrics.expiryRetryCount).toBe(0);
        });

        it('RENEWAL_CONFIRMED should not mutate any metric counters', async () => {
            // Act
            await emitLifecycleEvent(makeRenewalConfirmedEvent());

            // Assert
            const metrics = getAddonLifecycleMetrics();
            expect(metrics.revocationOutcomes.success).toBe(0);
            expect(metrics.expiryRetryCount).toBe(0);
        });
    });
});
