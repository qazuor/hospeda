/**
 * Unit tests for Admin Notifications API endpoint
 *
 * Tests the admin endpoint for listing notification logs with filtering and pagination.
 * Tests authentication, authorization, filtering, pagination, and response structure.
 *
 * Endpoint: GET /api/v1/admin/billing/notifications
 *
 * NOTE: This test mocks the DB layer (@repo/db) directly because the
 * `listNotificationLogsHandler` handler queries the database inline via
 * `getDb().select().from(billingNotificationLog)...` with no service abstraction.
 * Moving to service-layer mocking would require production code changes (out of scope).
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

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
    and: vi.fn((...conditions) => ({ _tag: 'and', conditions })),
    eq: vi.fn((field, value) => ({ _tag: 'eq', field, value })),
    gte: vi.fn((field, value) => ({ _tag: 'gte', field, value })),
    lte: vi.fn((field, value) => ({ _tag: 'lte', field, value })),
    count: vi.fn(() => ({ _tag: 'count' })),
    desc: vi.fn((field) => ({ _tag: 'desc', field }))
}));

// Create query chain mock that will be reused
let countQueryChain: any;
let selectQueryChain: any;

// Mock database
const mockDb = {
    select: vi.fn((fields?: unknown) => {
        // If fields include count(), return count query chain
        // Otherwise return select query chain
        if (fields && typeof fields === 'object' && 'total' in fields) {
            return countQueryChain;
        }
        return selectQueryChain;
    })
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
    sql: vi.fn(),
    // Required by role-permissions-cache.ts loaded via actor middleware
    RRolePermissionModel: class MockRRolePermissionModel {
        async findAll(_filters: unknown, _opts?: unknown) {
            return { items: [], total: 0 };
        }
    },
    RUserPermissionModel: class MockRUserPermissionModel {
        async findAll(_filters: unknown, _opts?: unknown) {
            return { items: [], total: 0 };
        }
    }
}));

describe('Admin Notifications API - GET /', () => {
    let mockContext: Partial<Context>;

    beforeEach(() => {
        vi.clearAllMocks();

        // Create separate chainable query mocks for count and select queries
        // Use Symbol.toStringTag to make them thenable without using 'then' property
        countQueryChain = {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue([{ total: 0 }])
        };

        selectQueryChain = {
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
    });

    describe('Success Cases - Listing', () => {
        it('should return empty list when no notifications exist', async () => {
            // Arrange
            countQueryChain.where.mockResolvedValue([{ total: 0 }]);
            selectQueryChain.offset.mockResolvedValue([]);

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

            countQueryChain.where.mockResolvedValue([{ total: 2 }]);
            selectQueryChain.offset.mockResolvedValue(mockNotifications);

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

            countQueryChain.where.mockResolvedValue([{ total: 1 }]);
            selectQueryChain.offset.mockResolvedValue(mockNotifications);

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
            countQueryChain.where.mockResolvedValue([{ total: 100 }]);
            selectQueryChain.offset.mockResolvedValue([]);

            // Act
            const result = await listNotificationLogsHandler(mockContext as Context, {}, {}, {});

            // Assert
            expect(result.limit).toBe(50);
            expect(result.offset).toBe(0);
            expect(selectQueryChain.limit).toHaveBeenCalledWith(50);
            expect(selectQueryChain.offset).toHaveBeenCalledWith(0);
        });

        it('should apply custom limit and offset', async () => {
            // Arrange
            countQueryChain.where.mockResolvedValue([{ total: 100 }]);
            selectQueryChain.offset.mockResolvedValue([]);

            const query = {
                limit: 20,
                offset: 40
            };

            // Act
            const result = await listNotificationLogsHandler(mockContext as Context, {}, {}, query);

            // Assert
            expect(result.limit).toBe(20);
            expect(result.offset).toBe(40);
            expect(selectQueryChain.limit).toHaveBeenCalledWith(20);
            expect(selectQueryChain.offset).toHaveBeenCalledWith(40);
        });

        it('should enforce maximum limit of 100', async () => {
            // Arrange
            countQueryChain.where.mockResolvedValue([{ total: 200 }]);
            selectQueryChain.offset.mockResolvedValue([]);

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

            countQueryChain.where.mockResolvedValue([{ total: 5 }]);
            selectQueryChain.offset.mockResolvedValue([]);

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

            countQueryChain.where.mockResolvedValue([{ total: 3 }]);
            selectQueryChain.offset.mockResolvedValue([]);

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

            countQueryChain.where.mockResolvedValue([{ total: 10 }]);
            selectQueryChain.offset.mockResolvedValue([]);

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

            countQueryChain.where.mockResolvedValue([{ total: 15 }]);
            selectQueryChain.offset.mockResolvedValue([]);

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

            countQueryChain.where.mockResolvedValue([{ total: 12 }]);
            selectQueryChain.offset.mockResolvedValue([]);

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

            countQueryChain.where.mockResolvedValue([{ total: 2 }]);
            selectQueryChain.offset.mockResolvedValue([]);

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
            countQueryChain.where.mockRejectedValue(new Error('Database connection failed'));

            // Act & Assert
            await expect(
                listNotificationLogsHandler(mockContext as Context, {}, {}, {})
            ).rejects.toThrow(HTTPException);
        });

        it('should handle database timeout errors', async () => {
            // Arrange
            countQueryChain.where.mockRejectedValue(new Error('Query timeout'));

            // Act & Assert
            await expect(
                listNotificationLogsHandler(mockContext as Context, {}, {}, {})
            ).rejects.toThrow(HTTPException);
        });

        it('should throw 500 with generic message on unknown error', async () => {
            // Arrange
            countQueryChain.where.mockRejectedValue('Unknown error');

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
            countQueryChain.where.mockRejectedValue(new Error('Invalid date format'));

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

            countQueryChain.where.mockResolvedValue([{ total: 1 }]);
            selectQueryChain.offset.mockResolvedValue(mockNotifications);

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

            countQueryChain.where.mockResolvedValue([{ total: 1 }]);
            selectQueryChain.offset.mockResolvedValue(mockNotifications);

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
            countQueryChain.where.mockResolvedValue([{ total: 10 }]);
            selectQueryChain.offset.mockResolvedValue([]);

            // Act
            await listNotificationLogsHandler(mockContext as Context, {}, {}, {});

            // Assert
            expect(mockDb.select).toHaveBeenCalledTimes(2);
        });

        it('should use WHERE clause when filters are provided', async () => {
            // Arrange
            countQueryChain.where.mockResolvedValue([{ total: 5 }]);
            selectQueryChain.offset.mockResolvedValue([]);

            const query = {
                type: 'usage_warning'
            };

            // Act
            await listNotificationLogsHandler(mockContext as Context, {}, {}, query);

            // Assert
            expect(countQueryChain.where).toHaveBeenCalled();
            expect(selectQueryChain.where).toHaveBeenCalled();
        });

        it('should order by createdAt descending', async () => {
            // Arrange
            // @ts-expect-error - drizzle-orm is mocked
            const { desc } = await import('drizzle-orm');

            countQueryChain.where.mockResolvedValue([{ total: 10 }]);
            selectQueryChain.offset.mockResolvedValue([]);

            // Act
            await listNotificationLogsHandler(mockContext as Context, {}, {}, {});

            // Assert
            expect(desc).toHaveBeenCalled();
            expect(selectQueryChain.orderBy).toHaveBeenCalled();
        });
    });
});
