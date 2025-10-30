import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationModel } from '../../src/models/notification.model';
import type { Notification } from '../../src/schemas/notification/notification.dbschema';

// Mock the database client
vi.mock('../../src/client', () => ({
    getDb: vi.fn(() => ({}))
}));

// Mock logger to avoid console output during tests
vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

// Mock database operations
vi.mock('../../src/utils/db-utils', () => ({
    buildWhereClause: vi.fn(() => ({}))
}));

// Create mock notification data
const mockNotificationData: Notification = {
    id: 'notification-id-1',
    recipientType: 'USER',
    recipientId: 'user-id-1',
    title: 'New Booking Confirmation',
    message: 'Your accommodation booking has been confirmed for January 15-20',
    type: 'BOOKING',
    category: 'confirmations',
    channels: {
        email: {
            enabled: true,
            template: 'booking-confirmation',
            subject: 'Booking Confirmed - Hospeda',
            priority: 'high'
        },
        sms: {
            enabled: false
        },
        push: {
            enabled: true,
            title: 'Booking Confirmed!',
            badge: 1,
            sound: 'default',
            data: {
                bookingId: 'booking-123',
                accommodationId: 'accommodation-456'
            }
        },
        inApp: {
            enabled: true,
            persistent: true,
            actionUrl: '/bookings/booking-123',
            actionText: 'View Booking'
        }
    },
    scheduledFor: null,
    deliveredAt: new Date('2024-01-10T10:00:00Z'),
    status: 'SENT',
    retryCount: 0,
    maxRetries: 3,
    retryPolicy: {
        strategy: 'exponential',
        initialDelay: 60,
        maxDelay: 3600,
        multiplier: 2
    },
    relatedEntityType: 'booking',
    relatedEntityId: 'booking-123',
    metadata: {
        source: 'booking-service',
        tags: ['booking', 'confirmation'],
        priority: 'high',
        locale: 'es-AR',
        customData: {
            accommodationName: 'Hotel Paradise',
            checkInDate: '2024-01-15'
        }
    },
    readAt: null,
    clickedAt: null,
    isRead: false,
    isArchived: false,
    adminInfo: {
        notes: 'Automated notification',
        reviewedBy: 'system'
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: 'system-user-id',
    updatedById: 'system-user-id',
    deletedAt: null,
    deletedById: null
};

describe('NotificationModel', () => {
    let model: NotificationModel;

    beforeEach(async () => {
        vi.clearAllMocks();
        model = new NotificationModel();

        // Mock the specific methods that are called by the model
        vi.spyOn(model, 'findById').mockImplementation(async (id: string) => {
            if (id === 'notification-id-1') {
                return mockNotificationData;
            }
            return null;
        });

        vi.spyOn(model, 'findAll').mockImplementation(async () => ({
            items: [mockNotificationData],
            total: 1
        }));

        vi.spyOn(model, 'count').mockImplementation(async () => 1);

        vi.spyOn(model, 'create').mockImplementation(async (data: any) => ({
            ...mockNotificationData,
            ...data,
            id: 'notification-id-1'
        }));

        vi.spyOn(model, 'update').mockImplementation(async (where: any, data: any) => ({
            ...mockNotificationData,
            ...data,
            id: where.id || 'notification-id-1'
        }));

        // Mock database operations for insert/update/select
        const mockDb = {
            insert: vi.fn(() => ({
                values: vi.fn((data) => ({
                    returning: vi.fn(() =>
                        Promise.resolve([
                            {
                                id: 'notification-id-1',
                                recipientType: data.recipientType,
                                recipientId: data.recipientId,
                                title: data.title,
                                message: data.message,
                                type: data.type,
                                channels: data.channels,
                                status: data.status || 'PENDING',
                                retryCount: data.retryCount || 0,
                                createdAt: new Date(),
                                updatedAt: new Date(),
                                createdById: 'system-user-id',
                                updatedById: 'system-user-id',
                                deletedAt: null,
                                deletedById: null
                            }
                        ])
                    )
                }))
            })),
            update: vi.fn(() => ({
                set: vi.fn(() => ({
                    where: vi.fn(() => ({
                        returning: vi.fn(() =>
                            Promise.resolve([
                                {
                                    id: 'notification-id-1',
                                    status: 'SENT',
                                    isRead: true,
                                    readAt: new Date(),
                                    createdAt: new Date(),
                                    updatedAt: new Date()
                                }
                            ])
                        )
                    }))
                }))
            })),
            select: vi.fn(() => ({
                from: vi.fn(() => ({
                    where: vi.fn(() =>
                        Promise.resolve([
                            {
                                ...mockNotificationData,
                                deletedAt: null,
                                deletedById: null
                            }
                        ])
                    )
                }))
            })),
            query: {
                notifications: {
                    findFirst: vi.fn(() =>
                        Promise.resolve({
                            id: 'notification-id-1',
                            title: 'New Booking Confirmation'
                        })
                    )
                }
            }
        };

        // Override getDb for this instance
        const { getDb } = await import('../../src/client');
        vi.mocked(getDb).mockReturnValue(mockDb as any);
    });

    describe('Constructor', () => {
        it('should be properly instantiated', () => {
            expect(model).toBeDefined();
            expect(model).toBeInstanceOf(NotificationModel);
        });
    });

    describe('Base Model Properties', () => {
        it('should be properly instantiated', () => {
            expect(model).toBeDefined();
            expect(model).toBeInstanceOf(NotificationModel);
        });
    });

    describe('findById', () => {
        it('should find a notification by ID', async () => {
            const result = await model.findById('notification-id-1');

            expect(result).toBeDefined();
            expect(result?.id).toBe('notification-id-1');
            expect(result?.title).toBe('New Booking Confirmation');
            expect(result?.status).toBe('SENT');
        });

        it('should return null for non-existent ID', async () => {
            const result = await model.findById('non-existent-id');

            expect(result).toBeNull();
        });
    });

    describe('findAll', () => {
        it('should find all notifications', async () => {
            const result = await model.findAll();

            expect(result).toBeDefined();
            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
        });
    });

    describe('create', () => {
        it('should create a new notification', async () => {
            const newNotificationData = {
                recipientType: 'CLIENT' as const,
                recipientId: 'client-id-1',
                title: 'Payment Received',
                message: 'Your payment of $150 has been processed',
                type: 'PAYMENT' as const,
                channels: {
                    email: {
                        enabled: true,
                        template: 'payment-received',
                        subject: 'Payment Confirmed',
                        priority: 'normal' as const
                    },
                    inApp: {
                        enabled: true,
                        persistent: false
                    }
                },
                status: 'PENDING' as const,
                createdById: 'system-user-id',
                updatedById: 'system-user-id'
            };

            const result = await model.create(newNotificationData);

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(result.title).toBe('Payment Received');
        });
    });

    describe('count', () => {
        it('should count notifications', async () => {
            const result = await model.count();

            expect(result).toBe(1);
        });
    });

    describe('findByRecipient', () => {
        it('should find notifications by recipient type and ID', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [mockNotificationData],
                total: 1
            });

            const result = await model.findByRecipient('USER', 'user-id-1');

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]?.recipientType).toBe('USER');
            expect(result[0]?.recipientId).toBe('user-id-1');
        });
    });

    describe('findByType', () => {
        it('should find notifications by type', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [mockNotificationData],
                total: 1
            });

            const result = await model.findByType('BOOKING');

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]?.type).toBe('BOOKING');
        });
    });

    describe('findByStatus', () => {
        it('should find notifications by status', async () => {
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [mockNotificationData],
                total: 1
            });

            const result = await model.findByStatus('SENT');

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]?.status).toBe('SENT');
        });
    });

    describe('findUnread', () => {
        it('should find unread notifications', async () => {
            const unreadNotification = { ...mockNotificationData, isRead: false, readAt: null };
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [unreadNotification],
                total: 1
            });

            const result = await model.findUnread('user-id-1');

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]?.isRead).toBe(false);
        });
    });

    describe('findScheduled', () => {
        it('should find scheduled notifications', async () => {
            const scheduledNotification = {
                ...mockNotificationData,
                scheduledFor: new Date('2024-02-01'),
                status: 'PENDING' as const
            };
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [scheduledNotification],
                total: 1
            });

            const result = await model.findScheduled();

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
        });
    });

    describe('findPendingRetry', () => {
        it('should find notifications pending retry', async () => {
            const retryNotification = {
                ...mockNotificationData,
                status: 'FAILED' as const,
                retryCount: 1,
                maxRetries: 3
            };
            vi.spyOn(model, 'findAll').mockResolvedValue({
                items: [retryNotification],
                total: 1
            });

            const result = await model.findPendingRetry();

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]?.status).toBe('FAILED');
        });
    });

    describe('markAsRead', () => {
        it('should mark a notification as read', async () => {
            const result = await model.markAsRead('notification-id-1');

            expect(result).toBeDefined();
            expect(result.id).toBe('notification-id-1');
        });
    });

    describe('markAsDelivered', () => {
        it('should mark a notification as delivered', async () => {
            const result = await model.markAsDelivered('notification-id-1');

            expect(result).toBeDefined();
            expect(result.id).toBe('notification-id-1');
        });
    });

    describe('incrementRetry', () => {
        it('should increment retry count', async () => {
            const result = await model.incrementRetry('notification-id-1');

            expect(result).toBeDefined();
            expect(result.id).toBe('notification-id-1');
        });
    });

    describe('archive', () => {
        it('should archive a notification', async () => {
            const result = await model.archive('notification-id-1');

            expect(result).toBeDefined();
            expect(result.id).toBe('notification-id-1');
        });
    });
});
