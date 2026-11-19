/**
 * Regression suite for HOS-2369 — one sent email, two «Notification sent successfully» lines.
 *
 * `NotificationService.send` already logs the success after the transport call, and
 * `trySendNotification` used to log it a second time with the same `messageId`. The
 * REAL `NotificationService` runs here (only the transport and infrastructure are
 * faked) so the assertion counts what the whole helper path actually emits.
 *
 * @module test/utils/notification-helper.single-success-log.test
 */

import { NotificationType } from '@repo/notifications';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockTransportSend, mockLogger } = vi.hoisted(() => ({
    mockTransportSend: vi.fn(),
    mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('@repo/notifications', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/notifications')>();
    return {
        ...actual,
        createEmailClient: vi.fn(() => ({})),
        BrevoEmailTransport: class {
            send = mockTransportSend;
        }
    };
});

vi.mock('@repo/db', () => ({
    getDb: () => ({ insert: () => ({ values: vi.fn().mockResolvedValue(undefined) }) })
}));

vi.mock('../../src/utils/logger', () => ({ apiLogger: mockLogger }));
vi.mock('../../src/utils/redis', () => ({ getRedisClient: vi.fn().mockResolvedValue(null) }));
vi.mock('../../src/utils/email-sender', () => ({
    getEmailSender: () => ({ name: 'Hospeda', email: 'no-reply@hospeda.com.ar' })
}));
vi.mock('../../src/utils/env', () => ({
    env: { HOSPEDA_EMAIL_API_KEY: 'test-key', HOSPEDA_SITE_URL: 'https://hospeda.com.ar' }
}));

import { trySendNotification } from '../../src/utils/notification-helper';

const SUCCESS_MESSAGE = 'Notification sent successfully';

describe('trySendNotification success logging (HOS-2369)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockTransportSend.mockResolvedValue({ messageId: 'msg_123' });
    });

    it('logs «Notification sent successfully» exactly once for one delivered notification', async () => {
        // Arrange
        const payload = {
            type: NotificationType.PAYMENT_SUCCESS,
            recipientEmail: 'user@example.com',
            recipientName: 'John Doe',
            userId: 'user_123',
            customerId: 'cus_456',
            amount: 10000,
            currency: 'ARS',
            planName: 'Standard'
        } as Parameters<typeof trySendNotification>[0];

        // Act
        const outcome = await trySendNotification(payload);

        // Assert
        expect(outcome).toEqual({ delivered: true, disposition: 'sent' });
        expect(mockTransportSend).toHaveBeenCalledTimes(1);
        const successLogs = mockLogger.info.mock.calls.filter(
            ([, message]) => message === SUCCESS_MESSAGE
        );
        expect(successLogs).toHaveLength(1);
        expect(successLogs[0]?.[0]).toMatchObject({ messageId: 'msg_123' });
    });
});
