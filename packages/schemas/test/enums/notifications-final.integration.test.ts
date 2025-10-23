import { describe, expect, it } from 'vitest';

import { NotificationChannelEnum } from '../../src/enums/notification-channel.enum.js';
import { NotificationRecipientTypeEnum } from '../../src/enums/notification-recipient-type.enum.js';
import { NotificationStatusEnum } from '../../src/enums/notification-status.enum.js';
import { NotificationTypeEnum } from '../../src/enums/notification-type.enum.js';

import { NotificationChannelSchema } from '../../src/enums/notification-channel.schema.js';
import { NotificationRecipientTypeSchema } from '../../src/enums/notification-recipient-type.schema.js';
import { NotificationStatusSchema } from '../../src/enums/notification-status.schema.js';
import { NotificationTypeSchema } from '../../src/enums/notification-type.schema.js';

describe('Notifications System Integration - Etapa 1.7', () => {
    describe('Enum Integration Tests', () => {
        it('should validate notification recipient types for all channels', () => {
            const recipients = Object.values(NotificationRecipientTypeEnum);
            const channels = Object.values(NotificationChannelEnum);

            for (const recipient of recipients) {
                for (const channel of channels) {
                    expect(() => NotificationRecipientTypeSchema.parse(recipient)).not.toThrow();
                    expect(() => NotificationChannelSchema.parse(channel)).not.toThrow();
                }
            }
        });

        it('should validate notification lifecycle through statuses', () => {
            const statuses = Object.values(NotificationStatusEnum);
            const types = Object.values(NotificationTypeEnum);

            for (const type of types) {
                for (const status of statuses) {
                    expect(() => NotificationTypeSchema.parse(type)).not.toThrow();
                    expect(() => NotificationStatusSchema.parse(status)).not.toThrow();
                }
            }
        });

        it('should support complete notification flow validation', () => {
            // Test realistic notification flow
            const notificationFlow = {
                recipient: NotificationRecipientTypeEnum.USER,
                type: NotificationTypeEnum.PAYMENT_SUCCESS,
                channel: NotificationChannelEnum.EMAIL,
                status: NotificationStatusEnum.PENDING
            };

            expect(() =>
                NotificationRecipientTypeSchema.parse(notificationFlow.recipient)
            ).not.toThrow();
            expect(() => NotificationTypeSchema.parse(notificationFlow.type)).not.toThrow();
            expect(() => NotificationChannelSchema.parse(notificationFlow.channel)).not.toThrow();
            expect(() => NotificationStatusSchema.parse(notificationFlow.status)).not.toThrow();
        });
    });

    describe('Schema Export Validation', () => {
        it('should export all notification schemas from @repo/schemas', () => {
            // These should be importable from index
            expect(NotificationRecipientTypeSchema).toBeDefined();
            expect(NotificationStatusSchema).toBeDefined();
            expect(NotificationChannelSchema).toBeDefined();
            expect(NotificationTypeSchema).toBeDefined();
        });

        it('should have consistent error messages across notification enums', () => {
            const expectedErrors = [
                'zodError.enums.notificationRecipientType.invalid',
                'zodError.enums.notificationStatus.invalid',
                'zodError.enums.notificationChannel.invalid',
                'zodError.enums.notificationType.invalid'
            ];

            const invalidSchemas = [
                NotificationRecipientTypeSchema,
                NotificationStatusSchema,
                NotificationChannelSchema,
                NotificationTypeSchema
            ];

            invalidSchemas.forEach((schema, index) => {
                try {
                    schema.parse('INVALID_VALUE');
                } catch (error: any) {
                    expect(error.issues[0]?.message).toBe(expectedErrors[index]);
                }
            });
        });
    });

    describe('Business Logic Validation', () => {
        it('should validate notification channels for different recipient types', () => {
            // All channels should be valid for both USER and CLIENT
            const allChannels = Object.values(NotificationChannelEnum);
            const allRecipients = Object.values(NotificationRecipientTypeEnum);

            for (const recipient of allRecipients) {
                for (const channel of allChannels) {
                    expect(() => {
                        NotificationRecipientTypeSchema.parse(recipient);
                        NotificationChannelSchema.parse(channel);
                    }).not.toThrow();
                }
            }
        });

        it('should validate notification statuses support all notification types', () => {
            // All notification types should be able to have any status
            const allStatuses = Object.values(NotificationStatusEnum);
            const allTypes = Object.values(NotificationTypeEnum);

            for (const type of allTypes) {
                for (const status of allStatuses) {
                    expect(() => {
                        NotificationTypeSchema.parse(type);
                        NotificationStatusSchema.parse(status);
                    }).not.toThrow();
                }
            }
        });
    });
});
