import { relations } from 'drizzle-orm';
import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { EntityTypePgEnum } from 'src/schema/enums.dbschema';
import { users } from './user.dbschema';

/**
 * user_bookmarks table schema
 */
export const userBookmarks = pgTable(
    'user_bookmarks',
    {
        /** Primary key for each bookmark record */
        id: uuid('id').primaryKey().defaultRandom(),

        /** Reference to the user who created the bookmark */
        ownerId: uuid('owner_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),

        /** Type of entity being bookmarked (values from EntityTypeEnum) */
        entityType: EntityTypePgEnum('entity_type').notNull(),

        /** UUID of the entity being bookmarked */
        entityId: uuid('entity_id').notNull(),

        /** Optional display name for listing purposes */
        name: text('name'),

        /** Optional description or notes about the bookmark */
        description: text('description'),

        /** Timestamp when the bookmark was created */
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),

        /** Timestamp when the bookmark was last updated; maintained by trigger */
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),

        /** Soft-delete timestamp; NULL means the record is active */
        deletedAt: timestamp('deleted_at', { withTimezone: true })
    },
    (table) => ({
        /** Prevent the same user from bookmarking the same entity more than once */
        uniqueBookmark: uniqueIndex('user_bookmarks_unique').on(
            table.ownerId,
            table.entityType,
            table.entityId
        )
    })
);

/**
 * Relations configuration for convenient JOINs
 */
export const userBookmarksRelations = relations(userBookmarks, ({ one }) => ({
    /** Join to owner user record */
    owner: one(users, {
        fields: [userBookmarks.ownerId],
        references: [users.id]
    })
}));
