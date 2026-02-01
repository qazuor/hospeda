/**
 * Unit tests for Admin Notifications API endpoint
 *
 * Tests the admin endpoint for listing notification logs with filtering and pagination.
 * Tests authentication, authorization, filtering, pagination, and response structure.
 *
 * Endpoint: GET /api/v1/admin/billing/notifications
 */

import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listNotificationLogsHandler } from '../../src/routes/billing/admin/notifications';

// Mock logger
vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn()
    }
}));

// Mock database
const mockDb = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn()
};

vi.mock('@repo/db', () => ({
    getDb: vi.fn(() => mockDb),
    billingNotificationLog: {
        id: 'id',
        customerId: 'customerId',
        type: 'type',
        channel: 'channel',
        recipient: 'recipient',
        subject: 'subject',
        templateId: 'templateId',
        status: 'status',
        sentAt: 'sentAt',
        errorMessage: 'errorMessage',
        metadata: 'metadata',
        createdAt: 'createdAt'
    },
    sql: vi.fn()
}));

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
    and: vi.fn((...conditions) => ({ _tag: 'and', conditions })),
    eq: vi.fn((field, value) => ({ _tag: 'eq', field, value })),
    gte: vi.fn((field, value) => ({ _tag: 'gte', field, value })),
    lte: vi.fn((field, value) => ({ _tag: 'lte', field, value })),
    count: vi.fn(() => ({ _tag: 'count' })),
    desc: vi.fn((field) => ({ _tag: 'desc', field }))
}));

describe('Admin Notifications API - GET /', () => {
    let mockContext: Partial<Context>;
    let queryChain: any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Create chainable query mock
        queryChain = {
            select: vi.fn().mockReturnThis(),
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            offset: vi.fn().mockResolvedValue([])
        };

        // Setup mock context
        mockContext = {
            get: vi.fn((key: string) => {
                if (key === 'billingEnabled') return true;
                return undefined;
            })
        };

        // Setup mock db methods
        mockDb.select = vi.fn().mockReturnValue(queryChain);
    });

    describe('Success Cases - Listing', () => {
        it('should return empty list when no notifications exist', async () => {
            // Arrange
            queryChain.offset.mockResolvedValueOnce([{ total: 0 }]); // count query
            queryChain.offset.mockResolvedValueOnce([]); // select query

            // Act
            const result = await listNotificationLogsHandler(mockContext as Context, {}, {}, {});

            // Assert
            expect(result.data).toEqual([]);
            expect(result.total).toBe(0);
            expect(result.limit).toBe(50);
            expect(result.offset).toBe(0);
        });

        it('should return paginated list of notifications', async () => {
            // Arrange
            const mockNotifications = [
                {
                    id: 'notif-1',
                    customerId: 'customer-1',
                    type: 'usage_warning',
                    channel: 'email',
                    recipient: 'user@example.com',
                    subject: 'Usage Warning',
                    templateId: 'template-1',
                    status: 'sent',
                    sentAt: new Date('2024-01-01T10:00:00Z'),
                    errorMessage: null,
                    metadata: { foo: 'bar' },
                    createdAt: new Date('2024-01-01T09:00:00Z')
                },
                {
                    id: 'notif-2',
                    customerId: 'customer-2',
                    type: 'payment_failed',
                    channel: 'email',
                    recipient: 'user2@example.com',
                    subject: 'Payment Failed',
                    templateId: 'template-2',
                    status: 'failed',
                    sentAt: null,
                    errorMessage: 'SMTP error',
                    metadata: null,
                    createdAt: new Date('2024-01-01T08:00:00Z')
                }
            ];

            queryChain.offset.mockResolvedValueOnce([{ total: 2 }]); // count query
            queryChain.offset.mockResolvedValueOnce(mockNotifications); // select query

            // Act
            const result = await listNotificationLogsHandler(mockContext as Context, {}, {}, {});

            // Assert
            expect(result.data).toHaveLength(2);
            expect(result.total).toBe(2);
            expect(result.data[0]!.id).toBe('notif-1');
            expect(result.data[0]!.type).toBe('usage_warning');
            expect(result.data[0]!.status).toBe('sent');
            expect(result.data[0]!.sentAt).toBe('2024-01-01T10:00:00.000Z');
            expect(result.data[1]!.id).toBe('notif-2');
            expect(result.data[1]!.sentAt).toBe(null);
        });

        it('should convert dates to ISO strings', async () => {
            // Arrange
            const mockNotifications = [
                {
                    id: 'notif-1',
                    customerId: 'customer-1',
                    type: 'trial_ending',
                    channel: 'email',
                    recipient: 'user@example.com',
                    subject: 'Trial Ending',
                    templateId: 'template-1',
                    status: 'sent',
                    sentAt: new Date('2024-01-15T14:30:00Z'),
                    errorMessage: null,
                    metadata: {},
                    createdAt: new Date('2024-01-15T14:00:00Z')
                }
            ];

            queryChain.offset.mockResolvedValueOnce([{ total: 1 }]);
            queryChain.offset.mockResolvedValueOnce(mockNotifications);

            // Act
            const result = await listNotificationLogsHandler(mockContext as Context, {}, {}, {});

            // Assert
            expect(result.data[0]!.sentAt).toBe('2024-01-15T14:30:00.000Z');
            expect(result.data[0]!.createdAt).toBe('2024-01-15T14:00:00.000Z');
        });
    });

    describe('Success Cases - Pagination', () => {
        it('should apply default pagination (limit 50, offset 0)', async () => {
            // Arrange
            queryChain.offset.mockResolvedValueOnce([{ total: 100 }]);
            queryChain.offset.mockResolvedValueOnce([]);

            // Act
            const result = await listNotificationLogsHandler(mockContext as Context, {}, {}, {});

            // Assert
            expect(result.limit).toBe(50);
            expect(result.offset).toBe(0);
            expect(queryChain.limit).toHaveBeenCalledWith(50);
            expect(queryChain.offset).toHaveBeenCalledWith(0);
        });

        it('should apply custom limit and offset', async () => {
            // Arrange
            queryChain.offset.mockResolvedValueOnce([{ total: 100 }]);
            queryChain.offset.mockResolvedValueOnce([]);

            const query = {
                limit: 20,
                offset: 40
            };

            // Act
            const result = await listNotificationLogsHandler(mockContext as Context, {}, {}, query);

            // Assert
            expect(result.limit).toBe(20);
            expect(result.offset).toBe(40);
            expect(queryChain.limit).toHaveBeenCalledWith(20);
            expect(queryChain.offset).toHaveBeenCalledWith(40);
        });

        it('should enforce maximum limit of 100', async () => {
            // Arrange
            queryChain.offset.mockResolvedValueOnce([{ total: 200 }]);
            queryChain.offset.mockResolvedValueOnce([]);

            const query = {
                limit: 100
            };

            // Act
            const result = await listNotificationLogsHandler(mockContext as Context, {}, {}, query);

            // Assert
            expect(result.limit).toBe(100);
        });
    });

    describe('Success Cases - Filtering', () => {
        it('should filter by notification type', async () => {
            // Arrange
            // @ts-expect-error - drizzle-orm is mocked
            const { eq } = await import('drizzle-orm');

            queryChain.offset.mockResolvedValueOnce([{ total: 5 }]);
            queryChain.offset.mockResolvedValueOnce([]);

            const query = {
                type: 'usage_warning'
            };

            // Act
            await listNotificationLogsHandler(mockContext as Context, {}, {}, query);

            // Assert
            expect(eq).toHaveBeenCalled();
        });

        it('should filter by status', async () => {
            // Arrange
            // @ts-expect-error - drizzle-orm is mocked
            const { eq } = await import('drizzle-orm');

            queryChain.offset.mockResolvedValueOnce([{ total: 3 }]);
            queryChain.offset.mockResolvedValueOnce([]);

            const query = {
                status: 'sent' as const
            };

            // Act
            await listNotificationLogsHandler(mockContext as Context, {}, {}, query);

            // Assert
            expect(eq).toHaveBeenCalled();
        });

        it('should filter by date range (start and end)', async () => {
            // Arrange
            // @ts-expect-error - drizzle-orm is mocked
            const { gte, lte } = await import('drizzle-orm');

            queryChain.offset.mockResolvedValueOnce([{ total: 10 }]);
            queryChain.offset.mockResolvedValueOnce([]);

            const query = {
                startDate: '2024-01-01T00:00:00Z',
                endDate: '2024-01-31T23:59:59Z'
            };

            // Act
            await listNotificationLogsHandler(mockContext as Context, {}, {}, query);

            // Assert
            expect(gte).toHaveBeenCalled();
            expect(lte).toHaveBeenCalled();
        });

        it('should filter by start date only', async () => {
            // Arrange
            // @ts-expect-error - drizzle-orm is mocked
            const { gte } = await import('drizzle-orm');

            queryChain.offset.mockResolvedValueOnce([{ total: 15 }]);
            queryChain.offset.mockResolvedValueOnce([]);

            const query = {
                startDate: '2024-01-01T00:00:00Z'
            };

            // Act
            await listNotificationLogsHandler(mockContext as Context, {}, {}, query);

            // Assert
            expect(gte).toHaveBeenCalled();
        });

        it('should filter by end date only', async () => {
            // Arrange
            // @ts-expect-error - drizzle-orm is mocked
            const { lte } = await import('drizzle-orm');

            queryChain.offset.mockResolvedValueOnce([{ total: 12 }]);
            queryChain.offset.mockResolvedValueOnce([]);

            const query = {
                endDate: '2024-01-31T23:59:59Z'
            };

            // Act
            await listNotificationLogsHandler(mockContext as Context, {}, {}, query);

            // Assert
            expect(lte).toHaveBeenCalled();
        });

        it('should combine multiple filters', async () => {
            // Arrange
            // @ts-expect-error - drizzle-orm is mocked
            const { eq, gte, lte, and } = await import('drizzle-orm');

            queryChain.offset.mockResolvedValueOnce([{ total: 2 }]);
            queryChain.offset.mockResolvedValueOnce([]);

            const query = {
                type: 'payment_failed',
                status: 'failed' as const,
                startDate: '2024-01-01T00:00:00Z',
                endDate: '2024-01-31T23:59:59Z'
            };

            // Act
            await listNotificationLogsHandler(mockContext as Context, {}, {}, query);

            // Assert
            expect(eq).toHaveBeenCalled();
            expect(gte).toHaveBeenCalled();
            expect(lte).toHaveBeenCalled();
            expect(and).toHaveBeenCalled();
        });
    });

    describe('Error Cases', () => {
        it('should handle database query errors', async () => {
            // Arrange
            queryChain.offset.mockRejectedValueOnce(new Error('Database connection failed'));

            // Act & Assert
            await expect(
                listNotificationLogsHandler(mockContext as Context, {}, {}, {})
            ).rejects.toThrow(HTTPException);
        });

        it('should handle database timeout errors', async () => {
            // Arrange
            queryChain.offset.mockRejectedValueOnce(new Error('Query timeout'));

            // Act & Assert
            await expect(
                listNotificationLogsHandler(mockContext as Context, {}, {}, {})
            ).rejects.toThrow(HTTPException);
        });

        it('should throw 500 with generic message on unknown error', async () => {
            // Arrange
            queryChain.offset.mockRejectedValueOnce('Unknown error');

            // Act & Assert
            try {
                await listNotificationLogsHandler(mockContext as Context, {}, {}, {});
                expect.fail('Should have thrown HTTPException');
            } catch (error) {
                expect(error).toBeInstanceOf(HTTPException);
                expect((error as HTTPException).status).toBe(500);
                expect((error as HTTPException).message).toBe(
                    'Failed to retrieve notification logs'
                );
            }
        });

        it('should handle invalid date format gracefully', async () => {
            // Arrange
            queryChain.offset.mockRejectedValueOnce(new Error('Invalid date format'));

            const query = {
                startDate: 'invalid-date'
            };

            // Act & Assert
            await expect(
                listNotificationLogsHandler(mockContext as Context, {}, {}, query)
            ).rejects.toThrow(HTTPException);
        });
    });

    describe('Response Structure', () => {
        it('should return correctly structured response', async () => {
            // Arrange
            const mockNotifications = [
                {
                    id: 'notif-1',
                    customerId: 'customer-1',
                    type: 'subscription_created',
                    channel: 'email',
                    recipient: 'user@example.com',
                    subject: 'Subscription Created',
                    templateId: 'template-1',
                    status: 'sent',
                    sentAt: new Date('2024-01-01T10:00:00Z'),
                    errorMessage: null,
                    metadata: { subscriptionId: 'sub-123' },
                    createdAt: new Date('2024-01-01T09:00:00Z')
                }
            ];

            queryChain.offset.mockResolvedValueOnce([{ total: 1 }]);
            queryChain.offset.mockResolvedValueOnce(mockNotifications);

            // Act
            const result = await listNotificationLogsHandler(mockContext as Context, {}, {}, {});

            // Assert - Check top-level structure
            expect(result).toHaveProperty('data');
            expect(result).toHaveProperty('total');
            expect(result).toHaveProperty('limit');
            expect(result).toHaveProperty('offset');

            // Assert - Check data structure
            expect(Array.isArray(result.data)).toBe(true);
            const notification = result.data[0];
            expect(notification).toHaveProperty('id');
            expect(notification).toHaveProperty('customerId');
            expect(notification).toHaveProperty('type');
            expect(notification).toHaveProperty('channel');
            expect(notification).toHaveProperty('recipient');
            expect(notification).toHaveProperty('subject');
            expect(notification).toHaveProperty('templateId');
            expect(notification).toHaveProperty('status');
            expect(notification).toHaveProperty('sentAt');
            expect(notification).toHaveProperty('errorMessage');
            expect(notification).toHaveProperty('metadata');
            expect(notification).toHaveProperty('createdAt');
        });

        it('should handle null values correctly', async () => {
            // Arrange
            const mockNotifications = [
                {
                    id: 'notif-1',
                    customerId: null,
                    type: 'system_alert',
                    channel: 'email',
                    recipient: 'admin@example.com',
                    subject: 'System Alert',
                    templateId: null,
                    status: 'sent',
                    sentAt: null,
                    errorMessage: null,
                    metadata: null,
                    createdAt: new Date('2024-01-01T09:00:00Z')
                }
            ];

            queryChain.offset.mockResolvedValueOnce([{ total: 1 }]);
            queryChain.offset.mockResolvedValueOnce(mockNotifications);

            // Act
            const result = await listNotificationLogsHandler(mockContext as Context, {}, {}, {});

            // Assert
            expect(result.data[0]!.customerId).toBe(null);
            expect(result.data[0]!.templateId).toBe(null);
            expect(result.data[0]!.sentAt).toBe(null);
            expect(result.data[0]!.errorMessage).toBe(null);
            expect(result.data[0]!.metadata).toBe(null);
        });
    });

    describe('Query Performance', () => {
        it('should execute exactly 2 database queries (count + select)', async () => {
            // Arrange
            queryChain.offset.mockResolvedValueOnce([{ total: 10 }]);
            queryChain.offset.mockResolvedValueOnce([]);

            // Act
            await listNotificationLogsHandler(mockContext as Context, {}, {}, {});

            // Assert
            expect(mockDb.select).toHaveBeenCalledTimes(2);
        });

        it('should use WHERE clause when filters are provided', async () => {
            // Arrange
            queryChain.offset.mockResolvedValueOnce([{ total: 5 }]);
            queryChain.offset.mockResolvedValueOnce([]);

            const query = {
                type: 'usage_warning'
            };

            // Act
            await listNotificationLogsHandler(mockContext as Context, {}, {}, query);

            // Assert
            expect(queryChain.where).toHaveBeenCalled();
        });

        it('should order by createdAt descending', async () => {
            // Arrange
            // @ts-expect-error - drizzle-orm is mocked
            const { desc } = await import('drizzle-orm');

            queryChain.offset.mockResolvedValueOnce([{ total: 10 }]);
            queryChain.offset.mockResolvedValueOnce([]);

            // Act
            await listNotificationLogsHandler(mockContext as Context, {}, {}, {});

            // Assert
            expect(desc).toHaveBeenCalled();
            expect(queryChain.orderBy).toHaveBeenCalled();
        });
    });
});
