import type { AdminInfoType } from '@repo/types';
import { relations } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { EntityTypePgEnum, StatePgEnum } from './enums.dbschema.js';
import { users } from './user.dbschema.js';

/**
 * user_bookmarks table schema
 */
export const userBookmarks: ReturnType<typeof pgTable> = pgTable(
    'user_bookmarks',
    {
        /** Primary key */
        id: uuid('id').primaryKey().defaultRandom(),

        /** Owner (user) of the bookmark */
        ownerId: uuid('owner_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),

        /** Type of the bookmarked entity */
        entityType: EntityTypePgEnum('entity_type').notNull(),

        /** ID of the bookmarked entity */
        entityId: uuid('entity_id').notNull(),

        /** Optional custom name for this bookmark */
        name: text('name'),

        /** Optional description or note */
        description: text('description'),

        /** Bookmark state (ACTIVE, DELETED, etc.) */
        state: StatePgEnum('state').default('ACTIVE').notNull(),

        /** Admin metadata (notes, favorite) */
        adminInfo: jsonb('admin_info').$type<AdminInfoType>(),

        /** Audit & soft-delete timestamps */
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
        /** Prevent duplicate bookmarks of the same entity by the same user */
        uniqueBookmark: uniqueIndex('user_bookmarks_owner_entity_key').on(
            table.ownerId,
            table.entityType,
            table.entityId
        )
    })
);

/**
 * Relations for user_bookmarks table
 */
export const userBookmarksRelations = relations(userBookmarks, ({ one }) => ({
    /** Who owns this bookmark */
    owner: one(users),
    /** Who created it */
    createdBy: one(users),
    /** Who last updated it */
    updatedBy: one(users),
    /** Who soft-deleted it */
    deletedBy: one(users)
}));
