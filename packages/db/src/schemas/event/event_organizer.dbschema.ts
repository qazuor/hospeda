import type { AdminInfoType, ContactInfoType, SocialNetworkType } from '@repo/types';
import { relations } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { LifecycleStatusPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { events } from './event.dbschema.ts';

export const eventOrganizers: ReturnType<typeof pgTable> = pgTable('event_organizers', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    logo: text('logo'),
    contactInfo: jsonb('contact_info').$type<ContactInfoType>(),
    social: jsonb('social').$type<SocialNetworkType>(),
    lifecycle: LifecycleStatusPgEnum('lifecycle').notNull().default('ACTIVE'),
    adminInfo: jsonb('admin_info').$type<AdminInfoType>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
});

export const eventOrganizersRelations = relations(eventOrganizers, ({ many }) => ({
    events: many(events)
}));
