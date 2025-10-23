import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { clients } from '../client/client.dbschema';
import { users } from '../user/user.dbschema';

/**
 * NOTIFICATION Schema - Etapa 2.12: Grupo Notificaciones
 * Comprehensive notification system with polymorphic recipients and multi-channel support
 */
export const notifications = pgTable('notifications', {
    // Primary key
    id: uuid('id').defaultRandom().primaryKey(),

    // Polymorphic recipient - can be USER or CLIENT
    recipientType: text('recipient_type', {
        enum: ['USER', 'CLIENT']
    }).notNull(),
    recipientId: uuid('recipient_id').notNull(),

    // Notification content
    title: text('title').notNull(),
    message: text('message').notNull(),

    // Notification type and category
    type: text('type', {
        enum: ['info', 'warning', 'error', 'success', 'marketing', 'system', 'reminder', 'alert']
    }).notNull(),
    category: text('category'), // Optional categorization for filtering

    // Delivery channels
    channels: jsonb('channels')
        .$type<{
            email?: {
                enabled: boolean;
                template?: string;
                subject?: string;
                priority?: 'low' | 'normal' | 'high';
            };
            sms?: {
                enabled: boolean;
                template?: string;
                priority?: 'low' | 'normal' | 'high';
            };
            push?: {
                enabled: boolean;
                title?: string;
                badge?: number;
                sound?: string;
                data?: Record<string, unknown>;
            };
            inApp?: {
                enabled: boolean;
                persistent?: boolean;
                actionUrl?: string;
                actionText?: string;
            };
        }>()
        .notNull(),

    // Scheduling
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),

    // Status and retry logic
    status: text('status', {
        enum: ['pending', 'scheduled', 'processing', 'delivered', 'failed', 'cancelled']
    })
        .notNull()
        .default('pending'),

    // Retry configuration
    retryCount: integer('retry_count').notNull().default(0),
    maxRetries: integer('max_retries').notNull().default(3),
    retryPolicy: jsonb('retry_policy').$type<{
        strategy?: 'exponential' | 'linear' | 'fixed';
        initialDelay?: number; // seconds
        maxDelay?: number; // seconds
        multiplier?: number; // for exponential backoff
    }>(),

    // Polymorphic relations to entities that triggered the notification
    relatedEntityType: text('related_entity_type'), // e.g., 'accommodation', 'booking', 'payment'
    relatedEntityId: uuid('related_entity_id'),

    // Additional metadata
    metadata: jsonb('metadata').$type<{
        source?: string; // System component that created notification
        tags?: string[];
        priority?: 'low' | 'normal' | 'high' | 'urgent';
        expiresAt?: string; // ISO date string
        locale?: string; // Language/locale for content
        customData?: Record<string, unknown>;
        trackingId?: string; // For external tracking
        campaignId?: string; // For marketing notifications
    }>(),

    // User interaction
    readAt: timestamp('read_at', { withTimezone: true }),
    clickedAt: timestamp('clicked_at', { withTimezone: true }),
    isRead: boolean('is_read').notNull().default(false),
    isArchived: boolean('is_archived').notNull().default(false),

    // Administrative metadata
    adminInfo: jsonb('admin_info').$type<AdminInfoType>(),

    // Audit fields
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    createdById: uuid('created_by_id')
        .notNull()
        .references(() => users.id),
    updatedById: uuid('updated_by_id')
        .notNull()
        .references(() => users.id),

    // Soft delete
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedById: uuid('deleted_by_id').references(() => users.id)
});

export const notificationRelations = relations(notifications, ({ one }) => ({
    // Polymorphic recipient relations
    userRecipient: one(users, {
        fields: [notifications.recipientId],
        references: [users.id],
        relationName: 'user_notifications'
    }),
    clientRecipient: one(clients, {
        fields: [notifications.recipientId],
        references: [clients.id],
        relationName: 'client_notifications'
    }),

    // Audit relations
    createdBy: one(users, {
        fields: [notifications.createdById],
        references: [users.id],
        relationName: 'notification_created_by'
    }),
    updatedBy: one(users, {
        fields: [notifications.updatedById],
        references: [users.id],
        relationName: 'notification_updated_by'
    }),
    deletedBy: one(users, {
        fields: [notifications.deletedById],
        references: [users.id],
        relationName: 'notification_deleted_by'
    })
}));

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
