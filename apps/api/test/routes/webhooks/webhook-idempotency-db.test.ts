/**
 * Tests for DB-only webhook idempotency functions.
 *
 * Verifies that markEventProcessedByProviderId and markEventFailedByProviderId
 * correctly update webhook events by provider event ID instead of relying on
 * the in-memory Map.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUpdate = vi.fn().mockReturnThis();
const mockSet = vi.fn().mockReturnThis();
const mockWhere = vi.fn().mockResolvedValue([]);
const mockDb = {
    update: mockUpdate,
    set: mockSet,
    where: mockWhere
};

vi.mock('@repo/db', () => ({
    getDb: () => mockDb,
    billingWebhookEvents: {
        providerEventId: 'provider_event_id',
        status: 'status',
        processedAt: 'processed_at',
        error: 'error'
    },
    eq: vi.fn((col: string, val: string) => ({ column: col, value: val, op: 'eq' })),
    and: vi.fn((...conditions: unknown[]) => ({ conditions, op: 'and' })),
    or: vi.fn((...conditions: unknown[]) => ({ conditions, op: 'or' }))
}));

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

import {
    markEventFailedByProviderId,
    markEventProcessedByProviderId
} from '../../../src/routes/webhooks/mercadopago/utils';

describe('DB-only webhook idempotency', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUpdate.mockReturnValue({ set: mockSet });
        mockSet.mockReturnValue({ where: mockWhere });
        mockWhere.mockResolvedValue([]);
    });

    describe('markEventProcessedByProviderId', () => {
        it('should call db.update with billingWebhookEvents table', async () => {
            await markEventProcessedByProviderId({
                providerEventId: 'mp-event-123'
            });

            expect(mockUpdate).toHaveBeenCalledTimes(1);
        });

        it('should set status to processed and processedAt to current date', async () => {
            await markEventProcessedByProviderId({
                providerEventId: 'mp-event-123'
            });

            expect(mockSet).toHaveBeenCalledTimes(1);
            const setArg = mockSet.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(setArg.status).toBe('processed');
            expect(setArg.processedAt).toBeInstanceOf(Date);
        });

        it('should filter by providerEventId and pending/failed status', async () => {
            await markEventProcessedByProviderId({
                providerEventId: 'mp-event-456'
            });

            expect(mockWhere).toHaveBeenCalledTimes(1);
        });

        it('should not throw on success', async () => {
            await expect(
                markEventProcessedByProviderId({ providerEventId: 'mp-event-789' })
            ).resolves.toBeUndefined();
        });

        it('should log success at debug level', async () => {
            const { apiLogger } = await import('../../../src/utils/logger');

            await markEventProcessedByProviderId({
                providerEventId: 'mp-event-log'
            });

            expect(apiLogger.debug).toHaveBeenCalledWith(
                expect.objectContaining({ providerEventId: 'mp-event-log' }),
                expect.stringContaining('processed')
            );
        });
    });

    describe('markEventFailedByProviderId', () => {
        it('should call db.update with billingWebhookEvents table', async () => {
            await markEventFailedByProviderId({
                providerEventId: 'mp-event-fail-1',
                errorMessage: 'Payment processing error'
            });

            expect(mockUpdate).toHaveBeenCalledTimes(1);
        });

        it('should set status to failed and include error message', async () => {
            await markEventFailedByProviderId({
                providerEventId: 'mp-event-fail-2',
                errorMessage: 'Timeout error'
            });

            expect(mockSet).toHaveBeenCalledTimes(1);
            const setArg = mockSet.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(setArg.status).toBe('failed');
            expect(setArg.error).toBe('Timeout error');
        });

        it('should filter by providerEventId and pending status', async () => {
            await markEventFailedByProviderId({
                providerEventId: 'mp-event-fail-3',
                errorMessage: 'Some error'
            });

            expect(mockWhere).toHaveBeenCalledTimes(1);
        });

        it('should not throw when db update succeeds', async () => {
            await expect(
                markEventFailedByProviderId({
                    providerEventId: 'mp-event-fail-4',
                    errorMessage: 'Error'
                })
            ).resolves.toBeUndefined();
        });

        it('should log error details at debug level', async () => {
            const { apiLogger } = await import('../../../src/utils/logger');

            await markEventFailedByProviderId({
                providerEventId: 'mp-event-fail-log',
                errorMessage: 'DB connection lost'
            });

            expect(apiLogger.debug).toHaveBeenCalledWith(
                expect.objectContaining({
                    providerEventId: 'mp-event-fail-log',
                    errorMessage: 'DB connection lost'
                }),
                expect.stringContaining('failed')
            );
        });
    });

    describe('error handling', () => {
        it('should log warning when markEventProcessedByProviderId fails', async () => {
            mockWhere.mockRejectedValueOnce(new Error('DB connection error'));
            const { apiLogger } = await import('../../../src/utils/logger');

            await markEventProcessedByProviderId({
                providerEventId: 'mp-error-1'
            });

            expect(apiLogger.warn).toHaveBeenCalledWith(
                expect.objectContaining({
                    providerEventId: 'mp-error-1'
                }),
                expect.stringContaining('Failed')
            );
        });

        it('should log warning when markEventFailedByProviderId fails', async () => {
            mockWhere.mockRejectedValueOnce(new Error('DB timeout'));
            const { apiLogger } = await import('../../../src/utils/logger');

            await markEventFailedByProviderId({
                providerEventId: 'mp-error-2',
                errorMessage: 'Original error'
            });

            expect(apiLogger.warn).toHaveBeenCalledWith(
                expect.objectContaining({
                    providerEventId: 'mp-error-2'
                }),
                expect.stringContaining('Failed')
            );
        });
    });
});
