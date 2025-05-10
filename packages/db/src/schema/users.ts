import { RoleTypeEnum, StateEnum } from '@repo/types';
import { relations } from 'drizzle-orm';
import { boolean, date, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { chatMessages } from './chat';
import { events } from './events';
import { posts } from './posts';

/**
 * Table: users
 * Central user entity: authentication, profile, preferences, metadata.
 */
export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),

    userName: text('user_name').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name').notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    brithDate: date('birth_date').notNull(),

    emailVerified: boolean('email_verified').default(false).notNull(),
    phoneVerified: boolean('phone_verified').default(false).notNull(),

    role: text('role', { enum: Object.values(RoleTypeEnum) as [string, ...string[]] }).notNull(),
    state: text('state', { enum: Object.values(StateEnum) as [string, ...string[]] })
        .default(StateEnum.ACTIVE)
        .notNull(),

    contactInfo: jsonb('contact_info').notNull(),
    socialNetworks: jsonb('social_networks'),
    location: jsonb('location').notNull(),
    profile: jsonb('profile'),
    settings: jsonb('settings'),
    bookmarks: jsonb('bookmarks').default([]),
    adminInfo: jsonb('admin_info'),

    createdAt: date('created_at').defaultNow().notNull(),
    updatedAt: date('updated_at').defaultNow().notNull(),
    deletedAt: date('deleted_at')
});

/**
 * Table: roles
 */
export const roles = pgTable('roles', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull()
});

/**
 * Relations: users
 */
export const userRelations = relations(users, ({ many }) => ({
    posts: many(posts),
    events: many(events),
    sentMessages: many(chatMessages, { relationName: 'sender' }),
    receivedMessages: many(chatMessages, { relationName: 'receiver' })
}));
