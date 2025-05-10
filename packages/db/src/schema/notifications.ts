import { NotificationStateEnum, NotificationTypeEnum, StateEnum } from '@repo/types';
import { relations } from 'drizzle-orm';
import { date, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { enumToTuple } from '../utils/db-utils';
import { users } from './users';

/**
 * Table: notifications
 * Stores system notifications for delivery via email, push, etc.
 * Supports targeting by user, roles, or all.
 */
export const notifications = pgTable('notifications', {
    id: uuid('id').primaryKey().defaultRandom(),

    type: text('type', { enum: enumToTuple(NotificationTypeEnum) }).notNull(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    htmlMessage: text('html_message'),

    channels: jsonb('channels').notNull(), // NotificationChannelEnum[]
    target: jsonb('target').notNull(), // { type: ..., roles?, userId? }

    /**
     * Flattened FK for user-targeted notifications (performance optimization).
     * Should match target.userId when target.type === 'user'
     */
    targetUserId: uuid('target_user_id'),

    scheduledAt: date('scheduled_at'),
    sentAt: date('sent_at'),

    status: text('status', { enum: enumToTuple(NotificationStateEnum) }).notNull(),
    metadata: jsonb('metadata'),
    state: text('state', { enum: enumToTuple(StateEnum) })
        .default(StateEnum.ACTIVE)
        .notNull(),

    createdAt: date('created_at').defaultNow().notNull(),
    updatedAt: date('updated_at').defaultNow().notNull(),
    deletedAt: date('deleted_at')
});

/**
 * Relations: notifications → users (only if user-targeted)
 */
export const notificationRelations = relations(notifications, ({ one }) => ({
    recipient: one(users, {
        fields: [notifications.targetUserId],
        references: [users.id]
    })
}));
