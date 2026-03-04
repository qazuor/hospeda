/**
 * Unit tests for TrialService.extendTrial()
 *
 * Covers the T-007 fix from SPEC-021:
 * - `extendTrial()` now passes `trialEnd: newTrialEnd` (Date object) to
 *   `billing.subscriptions.update()` in addition to metadata.
 * - Returns `{ previousTrialEnd, newTrialEnd }` instead of just `{ newTrialEnd }`.
 */

import { describe, expect, it, vi } from 'vitest';
import { TrialService } from '../../src/services/trial.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal shape of a QZPay subscription needed for extendTrial tests. */
interface MockSubscription {
    id: string;
    status: string;
    trialEnd: string | null;
    metadata: Record<string, string> | null;
    customerId: string;
    planId: string;
}

interface MockBillingSubscriptions {
    get: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
}

interface MockBilling {
    subscriptions: MockBillingSubscriptions;
}

/**
 * Builds a minimal QZPay billing mock with controllable subscription stubs.
 */
function createBillingMock(
    subscription: MockSubscription | null,
    updatedSubscription?: MockSubscription
): MockBilling {
    return {
        subscriptions: {
            get: vi.fn().mockResolvedValue(subscription),
            update: vi.fn().mockResolvedValue(updatedSubscription ?? subscription)
        }
    };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SUBSCRIPTION_ID = 'sub_test_001';
const TRIAL_END_ISO = '2026-03-10T00:00:00.000Z';
const EXTENDED_TRIAL_END_ISO = '2026-03-17T00:00:00.000Z';
const ADDITIONAL_DAYS = 7;

const BASE_SUBSCRIPTION: MockSubscription = {
    id: SUBSCRIPTION_ID,
    status: 'trialing',
    trialEnd: TRIAL_END_ISO,
    metadata: { createdBy: 'trial-service' },
    customerId: 'cust_001',
    planId: 'plan_001'
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TrialService.extendTrial()', () => {
    // -----------------------------------------------------------------------
    // TC-1: Extension updates trialEnd on the billing subscription
    // -----------------------------------------------------------------------
    describe('when subscription is trialing', () => {
        it('should call subscriptions.update() with trialEnd as a Date equal to the extended date', async () => {
            // Arrange
            const billing = createBillingMock(BASE_SUBSCRIPTION);
            const service = new TrialService(billing as never);

            // Act
            await service.extendTrial({
                subscriptionId: SUBSCRIPTION_ID,
                additionalDays: ADDITIONAL_DAYS
            });

            // Assert
            const [calledId, calledInput] = billing.subscriptions.update.mock.calls[0] as [
                string,
                { trialEnd: Date; metadata: Record<string, string> }
            ];

            expect(calledId).toBe(SUBSCRIPTION_ID);
            expect(calledInput.trialEnd).toBeInstanceOf(Date);

            // The new trialEnd must match 2026-03-17
            const expectedDate = new Date(EXTENDED_TRIAL_END_ISO);
            expect(calledInput.trialEnd.toISOString()).toBe(expectedDate.toISOString());
        });

        // -------------------------------------------------------------------
        // TC-2: Metadata audit trail is preserved in the update call
        // -------------------------------------------------------------------
        it('should include originalTrialEnd, newTrialEnd, trialExtendedAt, trialExtendedBy in update metadata', async () => {
            // Arrange
            const billing = createBillingMock(BASE_SUBSCRIPTION);
            const service = new TrialService(billing as never);

            const beforeCall = new Date();

            // Act
            await service.extendTrial({
                subscriptionId: SUBSCRIPTION_ID,
                additionalDays: ADDITIONAL_DAYS
            });

            const afterCall = new Date();

            // Assert
            const [, calledInput] = billing.subscriptions.update.mock.calls[0] as [
                string,
                { trialEnd: Date; metadata: Record<string, string> }
            ];

            const { metadata } = calledInput;

            expect(metadata).toBeDefined();

            // originalTrialEnd must match the subscription's current trialEnd
            expect(metadata.originalTrialEnd).toBe(new Date(TRIAL_END_ISO).toISOString());

            // newTrialEnd must match the computed extended date
            expect(metadata.newTrialEnd).toBe(new Date(EXTENDED_TRIAL_END_ISO).toISOString());

            // trialExtendedAt must be a valid ISO timestamp within the test window
            const extendedAt = new Date(metadata.trialExtendedAt as string);
            expect(extendedAt.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
            expect(extendedAt.getTime()).toBeLessThanOrEqual(afterCall.getTime());

            // trialExtendedBy describes the number of days added
            expect(metadata.trialExtendedBy).toBe(`${ADDITIONAL_DAYS} days`);
        });

        // -------------------------------------------------------------------
        // TC-3: Return value includes both previousTrialEnd and newTrialEnd
        // -------------------------------------------------------------------
        it('should return previousTrialEnd and newTrialEnd as ISO strings', async () => {
            // Arrange
            const billing = createBillingMock(BASE_SUBSCRIPTION);
            const service = new TrialService(billing as never);

            // Act
            const result = await service.extendTrial({
                subscriptionId: SUBSCRIPTION_ID,
                additionalDays: ADDITIONAL_DAYS
            });

            // Assert
            expect(result).toHaveProperty('previousTrialEnd');
            expect(result).toHaveProperty('newTrialEnd');

            expect(result.previousTrialEnd).toBe(new Date(TRIAL_END_ISO).toISOString());
            expect(result.newTrialEnd).toBe(new Date(EXTENDED_TRIAL_END_ISO).toISOString());
        });

        // -------------------------------------------------------------------
        // TC-7: Subscription with no existing trialEnd defaults to now as base
        // -------------------------------------------------------------------
        it('should use current date as base when subscription has no trialEnd', async () => {
            // Arrange
            const subscriptionWithoutTrialEnd: MockSubscription = {
                ...BASE_SUBSCRIPTION,
                trialEnd: null
            };
            const billing = createBillingMock(subscriptionWithoutTrialEnd);
            const service = new TrialService(billing as never);

            const beforeCall = new Date();

            // Act
            const result = await service.extendTrial({
                subscriptionId: SUBSCRIPTION_ID,
                additionalDays: ADDITIONAL_DAYS
            });

            const afterCall = new Date();

            // Assert
            const newTrialEndDate = new Date(result.newTrialEnd);

            // newTrialEnd must be ADDITIONAL_DAYS after a baseline of "now"
            const minExpected = new Date(beforeCall);
            minExpected.setDate(minExpected.getDate() + ADDITIONAL_DAYS);

            const maxExpected = new Date(afterCall);
            maxExpected.setDate(maxExpected.getDate() + ADDITIONAL_DAYS);

            expect(newTrialEndDate.getTime()).toBeGreaterThanOrEqual(minExpected.getTime());
            expect(newTrialEndDate.getTime()).toBeLessThanOrEqual(maxExpected.getTime());

            // The update call must pass the new trialEnd as a Date instance
            const [, calledInput] = billing.subscriptions.update.mock.calls[0] as [
                string,
                { trialEnd: Date; metadata: Record<string, string> }
            ];
            expect(calledInput.trialEnd).toBeInstanceOf(Date);
        });
    });

    // -----------------------------------------------------------------------
    // TC-4: Non-trialing subscription is rejected
    // -----------------------------------------------------------------------
    describe('when subscription status is not trialing', () => {
        it('should throw an Error containing "expected" when subscription is active', async () => {
            // Arrange
            const activeSubscription: MockSubscription = {
                ...BASE_SUBSCRIPTION,
                status: 'active'
            };
            const billing = createBillingMock(activeSubscription);
            const service = new TrialService(billing as never);

            // Act & Assert
            await expect(
                service.extendTrial({
                    subscriptionId: SUBSCRIPTION_ID,
                    additionalDays: ADDITIONAL_DAYS
                })
            ).rejects.toThrow(/expected/i);
        });

        it('should throw an Error containing "expected" when subscription is canceled', async () => {
            // Arrange
            const canceledSubscription: MockSubscription = {
                ...BASE_SUBSCRIPTION,
                status: 'canceled'
            };
            const billing = createBillingMock(canceledSubscription);
            const service = new TrialService(billing as never);

            // Act & Assert
            await expect(
                service.extendTrial({
                    subscriptionId: SUBSCRIPTION_ID,
                    additionalDays: ADDITIONAL_DAYS
                })
            ).rejects.toThrow(/expected/i);
        });
    });

    // -----------------------------------------------------------------------
    // TC-5: Subscription not found
    // -----------------------------------------------------------------------
    describe('when subscription does not exist', () => {
        it('should throw an Error containing "not found" when billing returns null', async () => {
            // Arrange
            const billing = createBillingMock(null);
            const service = new TrialService(billing as never);

            // Act & Assert
            await expect(
                service.extendTrial({
                    subscriptionId: 'sub_missing',
                    additionalDays: ADDITIONAL_DAYS
                })
            ).rejects.toThrow(/not found/i);
        });
    });

    // -----------------------------------------------------------------------
    // TC-6: Billing not enabled (null billing instance)
    // -----------------------------------------------------------------------
    describe('when billing is not enabled', () => {
        it('should throw an Error with message "Billing not enabled"', async () => {
            // Arrange
            const service = new TrialService(null);

            // Act & Assert
            await expect(
                service.extendTrial({
                    subscriptionId: SUBSCRIPTION_ID,
                    additionalDays: ADDITIONAL_DAYS
                })
            ).rejects.toThrow('Billing not enabled');
        });
    });

    // -----------------------------------------------------------------------
    // Additional: existing metadata is spread into the update call
    // -----------------------------------------------------------------------
    describe('metadata preservation', () => {
        it('should merge existing subscription metadata with audit fields', async () => {
            // Arrange
            const subscriptionWithMeta: MockSubscription = {
                ...BASE_SUBSCRIPTION,
                metadata: { createdBy: 'trial-service', autoStarted: 'true' }
            };
            const billing = createBillingMock(subscriptionWithMeta);
            const service = new TrialService(billing as never);

            // Act
            await service.extendTrial({
                subscriptionId: SUBSCRIPTION_ID,
                additionalDays: ADDITIONAL_DAYS
            });

            // Assert
            const [, calledInput] = billing.subscriptions.update.mock.calls[0] as [
                string,
                { trialEnd: Date; metadata: Record<string, string> }
            ];

            // Original fields from subscription metadata must be preserved
            expect(calledInput.metadata.createdBy).toBe('trial-service');
            expect(calledInput.metadata.autoStarted).toBe('true');

            // Audit fields must also be present
            expect(calledInput.metadata.originalTrialEnd).toBeDefined();
            expect(calledInput.metadata.newTrialEnd).toBeDefined();
            expect(calledInput.metadata.trialExtendedAt).toBeDefined();
            expect(calledInput.metadata.trialExtendedBy).toBeDefined();
        });
    });

    // -----------------------------------------------------------------------
    // Additional: update is not called when validation fails
    // -----------------------------------------------------------------------
    describe('when an error condition is detected', () => {
        it('should not call subscriptions.update() when subscription is not trialing', async () => {
            // Arrange
            const activeSubscription: MockSubscription = { ...BASE_SUBSCRIPTION, status: 'active' };
            const billing = createBillingMock(activeSubscription);
            const service = new TrialService(billing as never);

            // Act & Assert
            await expect(
                service.extendTrial({
                    subscriptionId: SUBSCRIPTION_ID,
                    additionalDays: ADDITIONAL_DAYS
                })
            ).rejects.toThrow();

            expect(billing.subscriptions.update).not.toHaveBeenCalled();
        });

        it('should not call subscriptions.update() when subscription is not found', async () => {
            // Arrange
            const billing = createBillingMock(null);
            const service = new TrialService(billing as never);

            // Act & Assert
            await expect(
                service.extendTrial({
                    subscriptionId: 'sub_missing',
                    additionalDays: ADDITIONAL_DAYS
                })
            ).rejects.toThrow();

            expect(billing.subscriptions.update).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // Additional: subscriptions.get is called with the correct ID
    // -----------------------------------------------------------------------
    describe('billing calls', () => {
        it('should call subscriptions.get() with the provided subscriptionId', async () => {
            // Arrange
            const billing = createBillingMock(BASE_SUBSCRIPTION);
            const service = new TrialService(billing as never);

            // Act
            await service.extendTrial({
                subscriptionId: SUBSCRIPTION_ID,
                additionalDays: ADDITIONAL_DAYS
            });

            // Assert
            expect(billing.subscriptions.get).toHaveBeenCalledWith(SUBSCRIPTION_ID);
            expect(billing.subscriptions.get).toHaveBeenCalledTimes(1);
        });

        it('should call subscriptions.update() exactly once on success', async () => {
            // Arrange
            const billing = createBillingMock(BASE_SUBSCRIPTION);
            const service = new TrialService(billing as never);

            // Act
            await service.extendTrial({
                subscriptionId: SUBSCRIPTION_ID,
                additionalDays: ADDITIONAL_DAYS
            });

            // Assert
            expect(billing.subscriptions.update).toHaveBeenCalledTimes(1);
        });
    });
});
