import type { AdminInfoType, ContactInfoType, SocialNetworkType } from '@repo/types';
import { relations } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { StatePgEnum } from './enums.dbschema.js';
import { events } from './event.dbschema.js';
import { entityTagRelations } from './r_entity_tag.dbschema.js';
import { users } from './user.dbschema.js';

export const eventOrganizers: ReturnType<typeof pgTable> = pgTable(
    'event_organizers',
    {
        /** Primary key */
        id: uuid('id').primaryKey().defaultRandom(),

        /** BaseEntity: internal name */
        name: text('name').notNull(),

        /** BaseEntity: display name */
        displayName: text('display_name').notNull(),

        /** General state (ACTIVE, INACTIVE, etc.) */
        state: StatePgEnum('state').default('ACTIVE').notNull(),

        /** Admin metadata (notes, favorite) */
        adminInfo: jsonb('admin_info').$type<AdminInfoType>(),

        /** Organizer logo URL or identifier */
        logo: text('logo'),

        /** Contact information JSON */
        contactInfo: jsonb('contact_info').$type<ContactInfoType>(),

        /** Social networks JSON */
        social: jsonb('social').$type<SocialNetworkType>(),

        /** Audit timestamps and soft-delete */
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, {
            onDelete: 'set null'
        }),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        updatedById: uuid('updated_by_id').references(() => users.id, {
            onDelete: 'set null'
        }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, {
            onDelete: 'set null'
        })
    },
    (table) => ({
        /** Unique internal name per organizer */
        uniqueName: uniqueIndex('event_organizers_name_key').on(table.name)
    })
);

export const eventOrganizersRelations = relations(eventOrganizers, ({ one, many }) => ({
    /** Who created this organizer */
    createdBy: one(users),
    /** Who last updated this organizer */
    updatedBy: one(users),
    /** Who soft-deleted this organizer */
    deletedBy: one(users),

    /** Events associated with this organizer */
    events: many(events),

    /** Tags applied to this organizer */
    tags: many(entityTagRelations)
}));
