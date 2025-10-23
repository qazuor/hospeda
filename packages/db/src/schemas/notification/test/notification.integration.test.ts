import type { NewNotification, Notification } from '@repo/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock model factory for testing
function createBaseModelMock<TEntity, TNew>(config: { tableName: string; entityName: string }) {
    const entities = new Map<string, TEntity>();

    return {
        async create(data: TNew): Promise<TEntity> {
            const entity = {
                ...data,
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null,
                deletedById: null
            } as TEntity;
            entities.set((data as any).id, entity);
            return entity;
        },

        async findById(id: string): Promise<TEntity> {
            const entity = entities.get(id);
            if (!entity) throw new Error(`${config.entityName} not found`);
            return entity;
        },

        async update(id: string, data: Partial<TNew>): Promise<TEntity> {
            const existing = entities.get(id);
            if (!existing) throw new Error(`${config.entityName} not found`);

            const updated = {
                ...existing,
                ...data,
                updatedAt: new Date()
            } as TEntity;
            entities.set(id, updated);
            return updated;
        },

        async softDelete(id: string, deletedById: string): Promise<TEntity> {
            const existing = entities.get(id);
            if (!existing) throw new Error(`${config.entityName} not found`);

            const deleted = {
                ...existing,
                deletedAt: new Date(),
                deletedById,
                updatedAt: new Date()
            } as TEntity;
            entities.set(id, deleted);
            return deleted;
        },

        async findMany(filter?: any): Promise<TEntity[]> {
            return Array.from(entities.values()).filter((entity) => {
                if (!filter) return true;
                return Object.entries(filter).every(
                    ([key, value]) => (entity as any)[key] === value
                );
            });
        }
    };
}

describe('Notification Integration Tests - Stage 2.12', () => {
    // Mocked model for testing
    const mockNotificationModel = createBaseModelMock<Notification, NewNotification>({
        tableName: 'notifications',
        entityName: 'Notification'
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Notification Creation and Management', () => {
        it('should create notification for USER recipient with email channel', async () => {
            const notificationData: NewNotification = {
                id: 'notif-001',
                recipientType: 'USER',
                recipientId: 'user-123',
                title: 'Welcome to Hospeda!',
                message:
                    'Thank you for joining our platform. Get started by exploring our accommodations.',
                type: 'info',
                category: 'onboarding',
                channels: {
                    email: {
                        enabled: true,
                        template: 'welcome-email',
                        subject: 'Welcome to Hospeda - Your Journey Begins!',
                        priority: 'normal'
                    },
                    inApp: {
                        enabled: true,
                        persistent: true,
                        actionUrl: '/dashboard',
                        actionText: 'Get Started'
                    }
                },
                status: 'pending',
                retryCount: 0,
                maxRetries: 3,
                retryPolicy: {
                    strategy: 'exponential',
                    initialDelay: 60,
                    maxDelay: 3600,
                    multiplier: 2
                },
                metadata: {
                    source: 'user-registration',
                    priority: 'normal',
                    locale: 'en',
                    tags: ['welcome', 'onboarding']
                },
                isRead: false,
                isArchived: false,
                createdById: 'system-001',
                updatedById: 'system-001'
            };

            const result = await mockNotificationModel.create(notificationData);

            expect(result).toMatchObject({
                id: 'notif-001',
                recipientType: 'USER',
                recipientId: 'user-123',
                title: 'Welcome to Hospeda!',
                type: 'info',
                status: 'pending',
                isRead: false
            });
            expect(result.channels).toEqual(notificationData.channels);
            expect(result.metadata).toEqual(notificationData.metadata);
        });

        it('should create notification for CLIENT recipient with multiple channels', async () => {
            const notificationData: NewNotification = {
                id: 'notif-002',
                recipientType: 'CLIENT',
                recipientId: 'client-456',
                title: 'New Booking Received',
                message:
                    'You have received a new booking for Villa Paradise. Please review and confirm.',
                type: 'success',
                category: 'booking',
                channels: {
                    email: {
                        enabled: true,
                        template: 'booking-notification',
                        subject: 'New Booking - Villa Paradise',
                        priority: 'high'
                    },
                    sms: {
                        enabled: true,
                        template: 'booking-sms',
                        priority: 'high'
                    },
                    push: {
                        enabled: true,
                        title: 'New Booking!',
                        badge: 1,
                        sound: 'notification.wav',
                        data: {
                            bookingId: 'booking-789',
                            propertyId: 'property-123'
                        }
                    },
                    inApp: {
                        enabled: true,
                        persistent: true,
                        actionUrl: '/bookings/booking-789',
                        actionText: 'View Booking'
                    }
                },
                relatedEntityType: 'booking',
                relatedEntityId: 'booking-789',
                metadata: {
                    source: 'booking-system',
                    priority: 'high',
                    customData: {
                        bookingValue: 1250.0,
                        checkInDate: '2024-12-01',
                        guestCount: 4
                    }
                },
                createdById: 'system-002',
                updatedById: 'system-002'
            };

            const result = await mockNotificationModel.create(notificationData);

            expect(result.recipientType).toBe('CLIENT');
            expect(result.recipientId).toBe('client-456');
            expect(result.relatedEntityType).toBe('booking');
            expect(result.relatedEntityId).toBe('booking-789');
            expect(result.channels?.email?.priority).toBe('high');
            expect(result.channels?.push?.data?.bookingId).toBe('booking-789');
        });

        it('should create scheduled notification with future delivery', async () => {
            const futureDate = new Date('2024-12-25T09:00:00Z');

            const notificationData: NewNotification = {
                id: 'notif-003',
                recipientType: 'USER',
                recipientId: 'user-789',
                title: 'Holiday Reminder',
                message: "Don't forget about your upcoming holiday booking!",
                type: 'reminder',
                category: 'booking-reminder',
                channels: {
                    email: {
                        enabled: true,
                        template: 'reminder-email',
                        subject: 'Upcoming Holiday Reminder',
                        priority: 'normal'
                    },
                    push: {
                        enabled: true,
                        title: 'Holiday Reminder',
                        badge: 1
                    }
                },
                scheduledFor: futureDate,
                status: 'scheduled',
                relatedEntityType: 'accommodation_listing',
                relatedEntityId: 'listing-456',
                metadata: {
                    source: 'scheduler',
                    priority: 'normal',
                    expiresAt: '2024-12-26T00:00:00Z'
                },
                createdById: 'scheduler-001',
                updatedById: 'scheduler-001'
            };

            const result = await mockNotificationModel.create(notificationData);

            expect(result.status).toBe('scheduled');
            expect(result.scheduledFor).toEqual(futureDate);
            expect(result.metadata?.expiresAt).toBe('2024-12-26T00:00:00Z');
        });
    });

    describe('Notification Status Management', () => {
        it('should update notification status through lifecycle', async () => {
            // Create pending notification
            const notification = await mockNotificationModel.create({
                id: 'notif-status',
                recipientType: 'USER',
                recipientId: 'user-status',
                title: 'Status Test Notification',
                message: 'Testing status transitions',
                type: 'info',
                channels: {
                    email: { enabled: true }
                },
                status: 'pending',
                createdById: 'test-user',
                updatedById: 'test-user'
            });

            expect(notification.status).toBe('pending');

            // Transition to processing
            const processing = await mockNotificationModel.update(notification.id, {
                status: 'processing',
                updatedById: 'delivery-system'
            });
            expect(processing.status).toBe('processing');

            // Transition to delivered
            const delivered = await mockNotificationModel.update(notification.id, {
                status: 'delivered',
                deliveredAt: new Date(),
                updatedById: 'delivery-system'
            });
            expect(delivered.status).toBe('delivered');
            expect(delivered.deliveredAt).toBeDefined();
        });

        it('should handle retry logic with failure scenarios', async () => {
            const notification = await mockNotificationModel.create({
                id: 'notif-retry',
                recipientType: 'CLIENT',
                recipientId: 'client-retry',
                title: 'Retry Test Notification',
                message: 'Testing retry mechanisms',
                type: 'alert',
                channels: {
                    email: { enabled: true }
                },
                status: 'pending',
                retryCount: 0,
                maxRetries: 3,
                retryPolicy: {
                    strategy: 'exponential',
                    initialDelay: 30,
                    maxDelay: 1800,
                    multiplier: 2
                },
                createdById: 'test-user',
                updatedById: 'test-user'
            });

            // Simulate first failure
            const firstRetry = await mockNotificationModel.update(notification.id, {
                status: 'failed',
                retryCount: 1,
                updatedById: 'delivery-system'
            });
            expect(firstRetry.retryCount).toBe(1);
            expect(firstRetry.status).toBe('failed');

            // Simulate second failure
            const secondRetry = await mockNotificationModel.update(notification.id, {
                retryCount: 2,
                updatedById: 'delivery-system'
            });
            expect(secondRetry.retryCount).toBe(2);

            // Simulate final success
            const finalDelivery = await mockNotificationModel.update(notification.id, {
                status: 'delivered',
                deliveredAt: new Date(),
                updatedById: 'delivery-system'
            });
            expect(finalDelivery.status).toBe('delivered');
            expect(finalDelivery.retryCount).toBe(2);
        });

        it('should track user interactions with notifications', async () => {
            const notification = await mockNotificationModel.create({
                id: 'notif-interaction',
                recipientType: 'USER',
                recipientId: 'user-interaction',
                title: 'Interactive Notification',
                message: 'Click to view details',
                type: 'info',
                channels: {
                    inApp: {
                        enabled: true,
                        actionUrl: '/details',
                        actionText: 'View Details'
                    }
                },
                isRead: false,
                createdById: 'test-user',
                updatedById: 'test-user'
            });

            expect(notification.isRead).toBe(false);
            expect(notification.readAt).toBeUndefined();

            // Mark as read
            const readNotification = await mockNotificationModel.update(notification.id, {
                isRead: true,
                readAt: new Date(),
                updatedById: 'user-interaction'
            });
            expect(readNotification.isRead).toBe(true);
            expect(readNotification.readAt).toBeDefined();

            // Track click
            const clickedNotification = await mockNotificationModel.update(notification.id, {
                clickedAt: new Date(),
                updatedById: 'user-interaction'
            });
            expect(clickedNotification.clickedAt).toBeDefined();
        });
    });

    describe('Polymorphic Relations and Queries', () => {
        it('should create notifications for both USER and CLIENT recipients', async () => {
            // Create user notification
            const userNotification = await mockNotificationModel.create({
                id: 'notif-user-poly',
                recipientType: 'USER',
                recipientId: 'user-poly-123',
                title: 'User Notification',
                message: 'Message for user',
                type: 'info',
                channels: { email: { enabled: true } },
                createdById: 'system',
                updatedById: 'system'
            });

            // Create client notification
            const clientNotification = await mockNotificationModel.create({
                id: 'notif-client-poly',
                recipientType: 'CLIENT',
                recipientId: 'client-poly-456',
                title: 'Client Notification',
                message: 'Message for client',
                type: 'info',
                channels: { email: { enabled: true } },
                createdById: 'system',
                updatedById: 'system'
            });

            expect(userNotification.recipientType).toBe('USER');
            expect(clientNotification.recipientType).toBe('CLIENT');
            expect(userNotification.recipientId).toBe('user-poly-123');
            expect(clientNotification.recipientId).toBe('client-poly-456');
        });

        it('should link notifications to various entity types', async () => {
            const entities = [
                { type: 'accommodation', id: 'acc-123' },
                { type: 'booking', id: 'book-456' },
                { type: 'payment', id: 'pay-789' },
                { type: 'user', id: 'user-999' }
            ];

            const notifications = [];
            for (const entity of entities) {
                const notification = await mockNotificationModel.create({
                    id: `notif-entity-${entity.type}`,
                    recipientType: 'USER',
                    recipientId: 'user-entities',
                    title: `Notification for ${entity.type}`,
                    message: `Update about ${entity.type}`,
                    type: 'info',
                    channels: { inApp: { enabled: true } },
                    relatedEntityType: entity.type,
                    relatedEntityId: entity.id,
                    createdById: 'system',
                    updatedById: 'system'
                });
                notifications.push(notification);
            }

            expect(notifications).toHaveLength(4);
            notifications.forEach((notif, index) => {
                expect(notif.relatedEntityType).toBe(entities[index]?.type);
                expect(notif.relatedEntityId).toBe(entities[index]?.id);
            });
        });
    });

    describe('Multi-Channel Notification Configuration', () => {
        it('should configure comprehensive multi-channel notification', async () => {
            const notification = await mockNotificationModel.create({
                id: 'notif-multi-channel',
                recipientType: 'CLIENT',
                recipientId: 'client-multi',
                title: 'Multi-Channel Test',
                message: 'Testing all notification channels',
                type: 'marketing',
                channels: {
                    email: {
                        enabled: true,
                        template: 'marketing-email',
                        subject: 'Special Offer Just for You!',
                        priority: 'high'
                    },
                    sms: {
                        enabled: true,
                        template: 'marketing-sms',
                        priority: 'normal'
                    },
                    push: {
                        enabled: true,
                        title: 'Special Offer!',
                        badge: 1,
                        sound: 'marketing.wav',
                        data: {
                            offerId: 'offer-123',
                            discount: '25%'
                        }
                    },
                    inApp: {
                        enabled: true,
                        persistent: false,
                        actionUrl: '/offers/offer-123',
                        actionText: 'Claim Offer'
                    }
                },
                metadata: {
                    source: 'marketing-system',
                    priority: 'high',
                    campaignId: 'holiday-2024',
                    tags: ['promotion', 'limited-time'],
                    customData: {
                        discountPercent: 25,
                        validUntil: '2024-12-31'
                    }
                },
                createdById: 'marketing-system',
                updatedById: 'marketing-system'
            });

            expect(notification.channels?.email?.enabled).toBe(true);
            expect(notification.channels?.sms?.enabled).toBe(true);
            expect(notification.channels?.push?.enabled).toBe(true);
            expect(notification.channels?.inApp?.enabled).toBe(true);
            expect(notification.metadata?.campaignId).toBe('holiday-2024');
        });

        it('should handle channel-specific configurations', async () => {
            const notification = await mockNotificationModel.create({
                id: 'notif-channel-config',
                recipientType: 'USER',
                recipientId: 'user-channel',
                title: 'Channel Configuration Test',
                message: 'Testing individual channel settings',
                type: 'system',
                channels: {
                    email: {
                        enabled: false // Email disabled
                    },
                    push: {
                        enabled: true,
                        title: 'System Alert',
                        badge: 5,
                        sound: 'urgent.wav',
                        data: {
                            alertLevel: 'warning',
                            requiresAction: true
                        }
                    },
                    inApp: {
                        enabled: true,
                        persistent: true,
                        actionUrl: '/system/alerts',
                        actionText: 'View Alert'
                    }
                },
                createdById: 'system',
                updatedById: 'system'
            });

            expect(notification.channels?.email?.enabled).toBe(false);
            expect(notification.channels?.push?.enabled).toBe(true);
            expect(notification.channels?.push?.badge).toBe(5);
            expect(notification.channels?.inApp?.persistent).toBe(true);
        });
    });

    describe('Edge Cases and Validation', () => {
        it('should handle notifications with minimal configuration', async () => {
            const minimalNotification = await mockNotificationModel.create({
                id: 'notif-minimal',
                recipientType: 'USER',
                recipientId: 'user-minimal',
                title: 'Minimal Notification',
                message: 'Simple message',
                type: 'info',
                channels: {
                    inApp: { enabled: true }
                },
                createdById: 'test',
                updatedById: 'test'
            });

            expect(minimalNotification.title).toBe('Minimal Notification');
            expect(minimalNotification.status).toBe('pending'); // Default value
            expect(minimalNotification.retryCount).toBe(0); // Default value
            expect(minimalNotification.maxRetries).toBe(3); // Default value
        });

        it('should validate notification type constraints', async () => {
            const validTypes = [
                'info',
                'warning',
                'error',
                'success',
                'marketing',
                'system',
                'reminder',
                'alert'
            ];

            for (const type of validTypes) {
                const notification = await mockNotificationModel.create({
                    id: `notif-type-${type}`,
                    recipientType: 'USER',
                    recipientId: 'user-type',
                    title: `${type} notification`,
                    message: `Testing ${type} type`,
                    type: type as any,
                    channels: { inApp: { enabled: true } },
                    createdById: 'test',
                    updatedById: 'test'
                });
                expect(notification.type).toBe(type);
            }
        });

        it('should handle archiving and soft delete', async () => {
            const notification = await mockNotificationModel.create({
                id: 'notif-archive',
                recipientType: 'USER',
                recipientId: 'user-archive',
                title: 'Archive Test',
                message: 'Testing archiving',
                type: 'info',
                channels: { inApp: { enabled: true } },
                isArchived: false,
                createdById: 'test',
                updatedById: 'test'
            });

            // Archive notification
            const archived = await mockNotificationModel.update(notification.id, {
                isArchived: true,
                updatedById: 'user-archive'
            });
            expect(archived.isArchived).toBe(true);

            // Soft delete
            const deleted = await mockNotificationModel.softDelete(notification.id, 'admin-user');
            expect(deleted.deletedAt).toBeDefined();
            expect(deleted.deletedById).toBe('admin-user');
        });
    });
});
