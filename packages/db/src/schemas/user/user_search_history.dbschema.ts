/**
 * @file user_search_history.dbschema.ts
 *
 * Append-only log of a user's past accommodation searches (SPEC-289).
 *
 * Design notes:
 *  - **No soft-delete** — deletion is always a hard delete (privacy requirement).
 *    `createdAt` is the only timestamp column.
 *  - `filtersJson` carries the storable filter subset from the search request,
 *    typed via `$type<SearchHistoryFilters>()` for full TypeScript safety.
 *  - `queryText` stores the free-text `q` component separately so services
 *    can read it without deserialising the full JSONB blob.
 *  - The composite index on `(userId, createdAt)` supports the "last N entries"
 *    read pattern efficiently in both ascending and descending order.
 *  - FK to `users.id` with `onDelete: 'cascade'` so history is automatically
 *    removed when a user account is deleted.
 *
 * Reference model: `user_bookmarks` (`user_bookmark.dbschema.ts`).
 */
import type { SearchHistoryFilters } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './user.dbschema.ts';

export const userSearchHistory = pgTable(
    'user_search_history',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        /**
         * Free-text query component of the search (`q` parameter).
         * `null` when the user submitted a filter-only search with no text.
         */
        queryText: text('query_text'),
        /**
         * Structured filter snapshot at the time of the search.
         * Typed as `SearchHistoryFilters` — the storable subset of
         * `AccommodationSearchHttpSchema`. `null` when no filters were applied.
         */
        filtersJson: jsonb('filters_json').$type<SearchHistoryFilters>(),
        /**
         * Number of search results returned at record time.
         * Stored as a cheap signal for future analytics / SPEC-284.
         * `null` when the count was unavailable (e.g. fire-and-forget error).
         */
        resultCount: integer('result_count'),
        /** UTC timestamp of the search. Non-nullable; set automatically by the DB. */
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        /**
         * Composite index on `(userId, createdAt)` for the "last N searches"
         * read pattern. PostgreSQL uses this index efficiently for both
         * `ORDER BY createdAt DESC` and ascending range scans.
         */
        userCreatedAtIdx: index('idx_user_search_history_user_created_at').on(
            table.userId,
            table.createdAt
        )
    })
);

export const userSearchHistoryRelations = relations(userSearchHistory, ({ one }) => ({
    /** The user who performed the search. */
    user: one(users, {
        fields: [userSearchHistory.userId],
        references: [users.id]
    })
}));
