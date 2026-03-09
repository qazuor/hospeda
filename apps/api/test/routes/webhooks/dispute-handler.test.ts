/**
 * Tests for dispute/chargeback webhook handler.
 *
 * Covers:
 * - Logging dispute events at warn level
 * - Marking events as processed
 * - Admin notification dispatch (BILL-17)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockMarkProcessed = vi.fn().mockResolvedValue(undefined);
const mockSendNotification = vi.fn().mockResolvedValue(undefined);
const mockCleanupRequestProviderEventId = vi.fn();

vi.mock('../../../src/routes/webhooks/mercadopago/utils', () => ({
    markEventProcessedByProviderId: (...args: unknown[]) => mockMarkProcessed(...args)
}));

vi.mock('../../../src/routes/webhooks/mercadopago/event-handler', () => ({
    cleanupRequestProviderEventId: (...args: unknown[]) =>
        mockCleanupRequestProviderEventId(...args)
}));

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

vi.mock('../../../src/utils/notification-helper', () => ({
    sendNotification: (...args: unknown[]) => mockSendNotification(...args)
}));

vi.mock('../../../src/utils/env', () => ({
    env: {
        HOSPEDA_ADMIN_NOTIFICATION_EMAILS: undefined as string | undefined
    }
}));

import { handleDisputeOpened } from '../../../src/routes/webhooks/mercadopago/dispute-handler';
import { env } from '../../../src/utils/env';
import { apiLogger } from '../../../src/utils/logger';

function createMockContext(): { get: ReturnType<typeof vi.fn> } {
    return {
        get: vi.fn((key: string) => {
            if (key === 'requestId') return 'req-dispute-123';
            return undefined;
        })
    };
}

describe('handleDisputeOpened', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (env as Record<string, unknown>).HOSPEDA_ADMIN_NOTIFICATION_EMAILS = undefined;
    });

    it('should log dispute at warn level with event metadata', async () => {
        // Arrange
        const c = createMockContext();
        const event = {
            id: 12345,
            type: 'chargebacks',
            data: {
                id: 'dispute-abc',
                payment_id: 'pay-789',
                status: 'opened',
                amount: 5000,
                reason: 'unauthorized_purchase'
            }
        };

        // Act
        await handleDisputeOpened(c as never, event as never);

        // Assert
        expect(apiLogger.warn).toHaveBeenCalledWith(
            expect.objectContaining({
                eventId: '12345',
                eventType: 'chargebacks',
                disputeId: 'dispute-abc',
                paymentId: 'pay-789',
                status: 'opened',
                amount: 5000,
                reason: 'unauthorized_purchase'
            }),
            expect.stringContaining('dispute/chargeback')
        );
    });

    it('should mark the event as processed by provider ID', async () => {
        // Arrange
        const c = createMockContext();
        const event = {
            id: 67890,
            type: 'payment.dispute',
            data: { id: 'dispute-xyz' }
        };

        // Act
        await handleDisputeOpened(c as never, event as never);

        // Assert
        expect(mockMarkProcessed).toHaveBeenCalledWith({
            providerEventId: '67890'
        });
    });

    it('should return undefined to continue default processing', async () => {
        // Arrange
        const c = createMockContext();
        const event = {
            id: 11111,
            type: 'chargebacks',
            data: {}
        };

        // Act
        const result = await handleDisputeOpened(c as never, event as never);

        // Assert
        expect(result).toBeUndefined();
    });

    it('should handle events with missing data gracefully', async () => {
        // Arrange
        const c = createMockContext();
        const event = {
            id: 22222,
            type: 'chargebacks',
            data: undefined
        };

        // Act
        await handleDisputeOpened(c as never, event as never);

        // Assert
        expect(apiLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockMarkProcessed).toHaveBeenCalledTimes(1);
    });

    describe('admin notification (BILL-17)', () => {
        it('should send ADMIN_SYSTEM_EVENT notification with severity critical to admin emails', async () => {
            // Arrange
            (env as Record<string, unknown>).HOSPEDA_ADMIN_NOTIFICATION_EMAILS =
                'admin1@test.com,admin2@test.com';
            const c = createMockContext();
            const event = {
                id: 33333,
                type: 'chargebacks',
                data: {
                    id: 'dispute-notif',
                    payment_id: 'pay-notif',
                    status: 'opened',
                    amount: 7500,
                    reason: 'unauthorized_purchase'
                }
            };

            // Act
            await handleDisputeOpened(c as never, event as never);

            // Assert
            expect(mockSendNotification).toHaveBeenCalledTimes(2);

            expect(mockSendNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'admin_system_event',
                    recipientEmail: 'admin1@test.com',
                    recipientName: 'Admin',
                    userId: null,
                    severity: 'critical',
                    eventDetails: expect.objectContaining({
                        eventType: 'chargebacks',
                        disputeId: 'dispute-notif',
                        paymentId: 'pay-notif',
                        status: 'opened',
                        amount: 7500,
                        reason: 'unauthorized_purchase'
                    })
                })
            );
        });

        it('should include dispute metadata in eventDetails', async () => {
            // Arrange
            (env as Record<string, unknown>).HOSPEDA_ADMIN_NOTIFICATION_EMAILS = 'admin@test.com';
            const c = createMockContext();
            const event = {
                id: 44444,
                type: 'payment.dispute',
                data: {
                    id: 'disp-meta',
                    payment_id: 'pay-meta',
                    status: 'closed',
                    amount: 10000,
                    reason: 'fraud'
                }
            };

            // Act
            await handleDisputeOpened(c as never, event as never);

            // Assert
            expect(mockSendNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    eventDetails: {
                        eventType: 'payment.dispute',
                        disputeId: 'disp-meta',
                        paymentId: 'pay-meta',
                        status: 'closed',
                        amount: 10000,
                        reason: 'fraud'
                    }
                })
            );
        });

        it('should not block webhook processing if notification fails', async () => {
            // Arrange
            (env as Record<string, unknown>).HOSPEDA_ADMIN_NOTIFICATION_EMAILS = 'admin@test.com';
            mockSendNotification.mockRejectedValueOnce(new Error('Notification service down'));
            const c = createMockContext();
            const event = {
                id: 55555,
                type: 'chargebacks',
                data: { id: 'disp-fail', amount: 3000 }
            };

            // Act
            const result = await handleDisputeOpened(c as never, event as never);

            // Assert - handler should not throw
            expect(result).toBeUndefined();
            expect(mockMarkProcessed).toHaveBeenCalledTimes(1);
            expect(apiLogger.debug).toHaveBeenCalledWith(
                expect.objectContaining({
                    eventId: '55555'
                }),
                expect.stringContaining('notification failed')
            );
        });

        it('should skip notification when ADMIN_NOTIFICATION_EMAILS is not set', async () => {
            // Arrange
            (env as Record<string, unknown>).HOSPEDA_ADMIN_NOTIFICATION_EMAILS = undefined;
            const c = createMockContext();
            const event = {
                id: 66666,
                type: 'chargebacks',
                data: { id: 'disp-no-emails' }
            };

            // Act
            await handleDisputeOpened(c as never, event as never);

            // Assert
            expect(mockSendNotification).not.toHaveBeenCalled();
            expect(mockMarkProcessed).toHaveBeenCalledTimes(1);
        });
    });
});
