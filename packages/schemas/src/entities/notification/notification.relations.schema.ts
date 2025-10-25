import { z } from 'zod';
import { AccommodationSchema } from '../accommodation/accommodation.schema.js';
import { UserSchema } from '../user/user.schema.js';
import { NotificationSchema } from './notification.schema.js';

/**
 * Notification with User relationship
 * For notifications sent to users
 */
export const NotificationWithUserSchema = NotificationSchema.extend({
    recipient: UserSchema.pick({
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        isActive: true,
        profileImageUrl: true
    })
});

/**
 * Notification with Accommodation context
 * For notifications related to accommodations
 */
export const NotificationWithAccommodationSchema = NotificationSchema.extend({
    accommodation: AccommodationSchema.pick({
        id: true,
        name: true,
        hostId: true,
        status: true,
        isActive: true
    }).optional()
});

/**
 * Complete notification with available relationships
 * Used for detailed notification views
 */
export const NotificationWithAllRelationsSchema = NotificationSchema.extend({
    // Recipient user
    recipient: UserSchema.pick({
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        isActive: true,
        profileImageUrl: true
    }).optional(),

    // Related accommodation
    accommodation: AccommodationSchema.pick({
        id: true,
        name: true,
        hostId: true,
        status: true,
        isActive: true,
        address: true
    }).optional(),

    // Performer of the action that triggered the notification
    performer: UserSchema.pick({
        id: true,
        name: true,
        email: true,
        profileImageUrl: true
    }).optional()
});

/**
 * Notification delivery status with external tracking
 * For notifications with external service tracking
 */
export const NotificationWithDeliveryStatusSchema = NotificationSchema.extend({
    deliveryStatus: z.object({
        externalId: z.string().optional(),
        providerStatus: z.string().optional(),
        webhookReceived: z.boolean().default(false),
        lastStatusUpdate: z.date().optional(),
        deliveryAttempts: z.number().int().min(0).default(0),
        maxDeliveryAttempts: z.number().int().min(1).default(3),
        nextRetryAt: z.date().optional(),
        failureReason: z.string().max(500).optional(),
        deliveryLogs: z
            .array(
                z.object({
                    timestamp: z.date(),
                    status: z.string(),
                    message: z.string().max(1000),
                    metadata: z.record(z.string(), z.unknown()).optional()
                })
            )
            .default([])
    })
});

/**
 * Notification preferences for recipient
 * Includes user's notification preferences
 */
export const NotificationWithPreferencesSchema = NotificationSchema.extend({
    recipientPreferences: z.object({
        emailEnabled: z.boolean().default(true),
        smsEnabled: z.boolean().default(false),
        pushEnabled: z.boolean().default(true),
        inAppEnabled: z.boolean().default(true),
        marketingEnabled: z.boolean().default(false),
        quietHoursStart: z
            .string()
            .regex(/^([01]?\d|2[0-3]):[0-5]\d$/)
            .optional(),
        quietHoursEnd: z
            .string()
            .regex(/^([01]?\d|2[0-3]):[0-5]\d$/)
            .optional(),
        timezone: z.string().optional(),
        preferredLanguage: z.string().length(2).optional()
    })
});

/**
 * Bulk notification result
 * For tracking bulk notification operations
 */
export const BulkNotificationResultSchema = z.object({
    operation: z.enum(['mark_as_read', 'mark_as_sent', 'delete', 'retry_failed']),
    totalRequested: z.number().int().min(0),
    successCount: z.number().int().min(0),
    failureCount: z.number().int().min(0),
    skippedCount: z.number().int().min(0),
    processedNotifications: z.array(
        z.object({
            id: z.string().uuid(),
            status: z.enum(['success', 'failure', 'skipped']),
            error: z.string().max(500).optional()
        })
    ),
    performedAt: z.date(),
    performedById: z.string().uuid(),
    durationMs: z.number().int().min(0)
});

export type NotificationWithUser = z.infer<typeof NotificationWithUserSchema>;
export type NotificationWithAccommodation = z.infer<typeof NotificationWithAccommodationSchema>;
export type NotificationWithAllRelations = z.infer<typeof NotificationWithAllRelationsSchema>;
export type NotificationWithDeliveryStatus = z.infer<typeof NotificationWithDeliveryStatusSchema>;
export type NotificationWithPreferences = z.infer<typeof NotificationWithPreferencesSchema>;
export type BulkNotificationResult = z.infer<typeof BulkNotificationResultSchema>;
