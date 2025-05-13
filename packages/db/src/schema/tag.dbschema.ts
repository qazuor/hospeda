import type { AdminInfoType } from '@repo/types';
import { relations } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { StatePgEnum, TagColorPgEnum } from './enums.dbschema';
import { entityTagRelations } from './r_entity_tag.dbschema';
import { users } from './user.dbschema';

/**
 * tags table schema
 */
export const tags: ReturnType<typeof pgTable> = pgTable(
    'tags',
    {
        /** Primary key */
        id: uuid('id').primaryKey().defaultRandom(),

        /** Tag name (unique per owner) */
        name: text('name').notNull(),

        /** Display name for UI */
        displayName: text('display_name').notNull(),

        /** General state (ACTIVE, INACTIVE, etc.) */
        state: StatePgEnum('state').default('ACTIVE').notNull(),

        /** Admin metadata (notes, favorite) */
        adminInfo: jsonb('admin_info').$type<AdminInfoType>(),

        /** Owner of this tag */
        ownerId: uuid('owner_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),

        /** Optional notes about the tag */
        notes: text('notes'),

        /** Color for UI representation */
        color: TagColorPgEnum('color').notNull(),

        /** Optional icon (URL, emoji, etc.) */
        icon: text('icon'),

        /** Audit timestamps and soft-delete */
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),

        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),

        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        /** Ensure each owner cannot have duplicate tag names */
        uniqueOwnerTag: uniqueIndex('tags_owner_name_key').on(table.ownerId, table.name)
    })
);

/**
 * Relations for tags table
 */
export const tagsRelations = relations(tags, ({ one, many }) => ({
    /** The user who owns this tag */
    owner: one(users, {
        fields: [tags.ownerId],
        references: [users.id]
    }),
    /** Who created this tag */
    createdBy: one(users, {
        fields: [tags.createdById],
        references: [users.id]
    }),
    /** Who last updated this tag */
    updatedBy: one(users, {
        fields: [tags.updatedById],
        references: [users.id]
    }),
    /** Who soft-deleted this tag */
    deletedBy: one(users, {
        fields: [tags.deletedById],
        references: [users.id]
    }),
    /** All entity–tag relations for this tag */
    entityTagRelations: many(entityTagRelations)
}));
