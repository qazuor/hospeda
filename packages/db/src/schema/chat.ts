import { MessageTypeEnum } from '@repo/types';
import { relations } from 'drizzle-orm';
import { boolean, date, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { enumToTuple } from '../utils/db-utils';
import { accommodations } from './accommodations';
import { users } from './users';

/**
 * Table: chat_threads
 * Represents a conversation between a guest and a host, linked to an accommodation.
 */
export const chatThreads = pgTable('chat_threads', {
    id: uuid('id').primaryKey().defaultRandom(),

    accommodation: uuid('accommodation').notNull(),

    guestId: uuid('guest_id').notNull(),
    hostId: uuid('host_id').notNull(),

    isArchived: boolean('is_archived').default(false),
    isBlocked: boolean('is_blocked').default(false),

    createdAt: date('created_at').defaultNow().notNull(),
    updatedAt: date('updated_at').defaultNow().notNull(),
    deletedAt: date('deleted_at')
});

/**
 * Table: chat_messages
 * Messages exchanged within a chat thread.
 */
export const chatMessages = pgTable('chat_messages', {
    id: uuid('id').primaryKey().defaultRandom(),

    threadId: uuid('thread_id').notNull(),
    senderId: uuid('sender_id').notNull(),
    receiverId: uuid('receiver_id').notNull(),

    content: text('content').notNull(),
    type: text('type', { enum: enumToTuple(MessageTypeEnum) }).notNull(),

    sentAt: date('sent_at').notNull(),
    readAt: date('read_at'),
    createdAt: date('created_at').defaultNow().notNull(),
    updatedAt: date('updated_at').defaultNow().notNull(),
    deletedAt: date('deleted_at')
});

/**
 * Relations: chat_threads ↔ users, accommodations, messages
 */
export const chatThreadRelations = relations(chatThreads, ({ one, many }) => ({
    guest: one(users, {
        fields: [chatThreads.guestId],
        references: [users.id]
    }),
    host: one(users, {
        fields: [chatThreads.hostId],
        references: [users.id]
    }),
    accommodation: one(accommodations, {
        fields: [chatThreads.accommodation],
        references: [accommodations.id]
    }),
    messages: many(chatMessages)
}));

/**
 * Relations: chat_messages ↔ threads, users
 */
export const chatMessageRelations = relations(chatMessages, ({ one }) => ({
    thread: one(chatThreads, {
        fields: [chatMessages.threadId],
        references: [chatThreads.id]
    }),
    sender: one(users, {
        relationName: 'sender',
        fields: [chatMessages.senderId],
        references: [users.id]
    }),
    receiver: one(users, {
        relationName: 'receiver',
        fields: [chatMessages.receiverId],
        references: [users.id]
    })
}));
