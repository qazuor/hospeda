/**
 * @file user_bookmark.dbschema.ts
 *
 * **Naming note**: Backend entity is `UserBookmark` (with optional `collectionId` for grouping).
 * User-facing UI calls this "Favoritos" (favorites). The polymorphic foreign key (`entityId` +
 * `entityType`) supports ACCOMMODATION, DESTINATION, EVENT, POST, and ATTRACTION types.
 * Soft-delete via `deletedAt`. See SPEC-098 for the full feature design.
 */
import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { EntityTypePgEnum, LifecycleStatusPgEnum } from '../enums.dbschema.ts';
import { users } from './user.dbschema.ts';
import { userBookmarkCollections } from './user_bookmark_collection.dbschema.ts';

export const userBookmarks = pgTable(
    'user_bookmarks',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        entityId: uuid('entity_id').notNull(),
        entityType: EntityTypePgEnum('entity_type').notNull(),
        /**
         * Optional reference to a user collection. Null = uncollected (loose favorite).
         * When the parent collection is soft-deleted, the application logic resets this
         * to null. Hard-delete cascade is SET NULL for safety.
         */
        collectionId: uuid('collection_id').references(() => userBookmarkCollections.id, {
            onDelete: 'set null'
        }),
        name: text('name'),
        description: text('description'),
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
        /** Fast lookup of all bookmarks belonging to a specific collection. */
        collectionIdx: index('idx_user_bookmarks_collection').on(table.collectionId),
        /**
         * Compound index supporting the public per-entity bookmark count and the
         * "Most saved" listing sort. Filters on `deletedAt IS NULL` are kept on
         * the leading edge so they can be range-scanned. SPEC-098 T-008 / T-052.
         */
        entityActiveIdx: index('idx_user_bookmarks_entity_active').on(
            table.entityId,
            table.entityType,
            table.deletedAt
        )
    })
);

export const userBookmarksRelations = relations(userBookmarks, ({ one }) => ({
    user: one(users, {
        fields: [userBookmarks.userId],
        references: [users.id]
    }),
    collection: one(userBookmarkCollections, {
        fields: [userBookmarks.collectionId],
        references: [userBookmarkCollections.id]
    })
}));
