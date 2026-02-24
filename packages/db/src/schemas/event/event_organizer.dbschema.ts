import type { AdminInfoType, ContactInfo, SocialNetwork } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { LifecycleStatusPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { events } from './event.dbschema.ts';

export const eventOrganizers = pgTable(
    'event_organizers',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        name: text('name').notNull(),
        slug: text('slug').notNull().unique(),
        description: text('description'),
        logo: text('logo'),
        contactInfo: jsonb('contact_info').$type<ContactInfo>(),
        socialNetworks: jsonb('social').$type<SocialNetwork>(),
        lifecycleState: LifecycleStatusPgEnum('lifecycle_state').notNull().default('ACTIVE'),
        adminInfo: jsonb('admin_info').$type<AdminInfoType>(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        eventOrganizers_slug_idx: index('eventOrganizers_slug_idx').on(table.slug),
        eventOrganizers_lifecycleState_idx: index('eventOrganizers_lifecycleState_idx').on(
            table.lifecycleState
        )
    })
);

export const eventOrganizersRelations = relations(eventOrganizers, ({ many }) => ({
    events: many(events)
}));
