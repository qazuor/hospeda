import type { AdminInfoType } from '@repo/types';
import { relations } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { StatePgEnum } from './enums.dbschema.js';
import { entityTagRelations } from './r_entity_tag.dbschema.js';
import { users } from './user.dbschema.js';

/**
 * tags table schema
 */
export const tags = pgTable(
    'tags',
    {
        /** Primary key */
        id: uuid('id').primaryKey().defaultRandom(),

        /** Tag name (internal) */
        name: text('name').notNull(),

        /** Tag display name (for UI) */
        displayName: text('display_name').notNull(),

        /** Owner of the tag */
        ownerId: uuid('owner_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),

        /** General state (ACTIVE, INACTIVE, etc.) */
        state: StatePgEnum('state').default('ACTIVE').notNull(),

        /** Admin metadata (notes, favorite) */
        adminInfo: jsonb('admin_info').$type<AdminInfoType>(),

        /** Optional notes about the tag */
        notes: text('notes'),

        /** Tag color (enum value) */
        color: text('color').notNull(),

        /** Optional icon reference or URL */
        icon: text('icon'),

        /** Audit & soft-delete timestamps */
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        /** Prevent duplicate tag names per owner */
        uniqueOwnerName: uniqueIndex('tags_owner_name_key').on(table.ownerId, table.name)
    })
);

/**
 * Relations for tags table
 */
export const tagsRelations = relations(tags, ({ one, many }) => ({
    /** Tag owner */
    owner: one(users),
    /** Who created the tag */
    createdBy: one(users),
    /** Who last updated the tag */
    updatedBy: one(users),
    /** Who soft-deleted the tag */
    deletedBy: one(users),
    /** All entity-tag mappings for this tag */
    entityTags: many(entityTagRelations)
}));
