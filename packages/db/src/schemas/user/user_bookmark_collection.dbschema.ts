import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { LifecycleStatusPgEnum } from '../enums.dbschema.ts';
import { users } from './user.dbschema.ts';
import { userBookmarks } from './user_bookmark.dbschema.ts';

/**
 * User bookmark collections table.
 *
 * Holds named collections (wishlists) created by authenticated users to
 * organise their bookmarks. Each collection belongs to one user and can
 * optionally carry a display colour and icon chosen from the `@repo/icons`
 * subset. Soft-delete semantics are enforced via `deletedAt`.
 *
 * A partial-unique index enforcing `(userId, name)` uniqueness while the
 * collection is active (`deletedAt IS NULL`) is intentionally NOT declared
 * here because `drizzle-kit push` cannot generate partial indexes. It is
 * applied via manual SQL in T-008 through `apply-postgres-extras.sh`.
 */
export const userBookmarkCollections = pgTable(
    'user_bookmark_collections',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        name: varchar('name', { length: 60 }).notNull(),
        description: text('description'),
        /** Hex colour string, e.g. `#FF5722`. */
        color: varchar('color', { length: 7 }),
        /** Icon name from the `@repo/icons` allowed subset. */
        icon: varchar('icon', { length: 40 }),
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
        /**
         * Fast lookup of active (non-deleted) collections for a given user.
         * The partial-unique index on `(userId, name) WHERE deletedAt IS NULL`
         * is added separately in manual SQL (T-008).
         */
        userActiveIdx: index('idx_user_bookmark_collections_user_active').on(
            table.userId,
            table.deletedAt
        )
    })
);

export const userBookmarkCollectionsRelations = relations(
    userBookmarkCollections,
    ({ one, many }) => ({
        user: one(users, {
            fields: [userBookmarkCollections.userId],
            references: [users.id]
        }),
        bookmarks: many(userBookmarks)
    })
);

export type InsertUserBookmarkCollection = typeof userBookmarkCollections.$inferInsert;
export type SelectUserBookmarkCollection = typeof userBookmarkCollections.$inferSelect;
