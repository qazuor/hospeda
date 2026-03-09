/**
 * Tests for shared dispute processing logic.
 * @module test/routes/webhooks/dispute-logic
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies before imports
vi.mock('../../../src/utils/logger', () => ({
    apiLogger: {
        warn: vi.fn(),
        debug: vi.fn(),
        info: vi.fn(),
        error: vi.fn()
    }
}));

vi.mock('../../../src/utils/notification-helper', () => ({
    sendNotification: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../../src/utils/env', () => ({
    env: {
        HOSPEDA_ADMIN_NOTIFICATION_EMAILS: undefined as string | undefined
    }
}));

import { processDisputeEvent } from '../../../src/routes/webhooks/mercadopago/dispute-logic';
import { env } from '../../../src/utils/env';
import { apiLogger } from '../../../src/utils/logger';
import { sendNotification } from '../../../src/utils/notification-helper';

describe('processDisputeEvent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (env as Record<string, unknown>).HOSPEDA_ADMIN_NOTIFICATION_EMAILS = 'admin@test.com';
    });

    it('should log dispute at warn level', async () => {
        const result = await processDisputeEvent({
            eventData: { id: 'dispute-1', status: 'opened', reason: 'fraud' },
            eventType: 'chargebacks',
            eventId: 'evt-123'
        });

        expect(apiLogger.warn).toHaveBeenCalledWith(
            expect.objectContaining({
                eventId: 'evt-123',
                eventType: 'chargebacks',
                disputeId: 'dispute-1'
            }),
            expect.stringContaining('dispute/chargeback')
        );
        expect(result).toBe(true);
    });

    it('should send admin notification with critical severity', async () => {
        await processDisputeEvent({
            eventData: { id: 'dispute-2', amount: 5000 },
            eventType: 'payment.dispute',
            eventId: 'evt-456'
        });

        expect(sendNotification).toHaveBeenCalledWith(
            expect.objectContaining({
                recipientEmail: 'admin@test.com',
                severity: 'critical'
            })
        );
    });

    it('should always return true', async () => {
        const result = await processDisputeEvent({
            eventData: undefined,
            eventType: 'chargebacks',
            eventId: 'evt-789'
        });

        expect(result).toBe(true);
    });

    it('should not send notification when no admin emails configured', async () => {
        (env as Record<string, unknown>).HOSPEDA_ADMIN_NOTIFICATION_EMAILS = '';

        await processDisputeEvent({
            eventData: { id: 'dispute-3' },
            eventType: 'chargebacks',
            eventId: 'evt-no-email'
        });

        expect(sendNotification).not.toHaveBeenCalled();
    });

    it('should include event details in notification', async () => {
        await processDisputeEvent({
            eventData: {
                id: 'dispute-4',
                payment_id: 'pay-100',
                status: 'opened',
                amount: 2500,
                reason: 'not_received'
            },
            eventType: 'chargebacks',
            eventId: 'evt-details'
        });

        expect(sendNotification).toHaveBeenCalledWith(
            expect.objectContaining({
                eventDetails: expect.objectContaining({
                    eventType: 'chargebacks',
                    disputeId: 'dispute-4',
                    paymentId: 'pay-100',
                    status: 'opened',
                    amount: 2500,
                    reason: 'not_received'
                })
            })
        );
    });
});
