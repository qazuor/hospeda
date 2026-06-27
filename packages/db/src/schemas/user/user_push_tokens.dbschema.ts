/**
 * @file user_push_tokens.dbschema.ts
 *
 * Drizzle schema for the `user_push_tokens` table (SPEC-243 T-011).
 *
 * Stores Expo push tokens for authenticated users, enabling targeted push
 * notifications to specific devices. The UNIQUE constraint on `token` ensures
 * each device install belongs to exactly one user at any given time — re-login
 * on the same device automatically transfers ownership to the new user via UPSERT.
 *
 * No soft-delete: tokens are simply replaced or removed. This is an
 * append-only-ish lean table with no audit columns per the approved convention
 * for simple device-registry tables (see CLAUDE.md lean-table precedent).
 */
import { relations } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from './user.dbschema.ts';

/**
 * Push token registry for mobile and web devices.
 *
 * One row per device install per user. A user may have many rows (one per
 * device). On conflict (same `token`), `userId`, `platform`, and `updatedAt`
 * are overwritten — ownership is always transferred to the most-recent actor
 * who registered the token.
 */
export const userPushTokens = pgTable(
    'user_push_tokens',
    {
        /** Auto-generated UUID primary key. */
        id: uuid('id').primaryKey().defaultRandom(),

        /**
         * The user who owns this push token.
         * Cascade-deletes when the user is removed from the platform.
         */
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),

        /**
         * Expo push token string (e.g. `ExponentPushToken[xxxxxxxx]` or a raw
         * APNs/FCM device token for bare-workflow installs). Max 512 chars.
         * Globally unique — the same physical device can only belong to one user.
         */
        token: text('token').notNull(),

        /**
         * Device platform. One of 'ios', 'android', or 'web'.
         * Stored as plain text (not a PG enum) to avoid migration churn if
         * new platforms are added in the future.
         */
        platform: text('platform').notNull(),

        /** Timestamp when this token was first registered. */
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),

        /** Timestamp when this token was last upserted (e.g. re-login). */
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        /** Global uniqueness on `token` — enforces one-user-per-device. */
        tokenUniqueIdx: uniqueIndex('user_push_tokens_token_unique').on(table.token),

        /** Index to efficiently retrieve all tokens for a given user. */
        userIdIdx: index('user_push_tokens_userId_idx').on(table.userId)
    })
);

/**
 * Relations for the `user_push_tokens` table.
 * Each token belongs to exactly one user.
 */
export const userPushTokensRelations = relations(userPushTokens, ({ one }) => ({
    user: one(users, {
        fields: [userPushTokens.userId],
        references: [users.id]
    })
}));

/** Inferred insert type for the `user_push_tokens` table. */
export type InsertUserPushToken = typeof userPushTokens.$inferInsert;

/** Inferred select type for the `user_push_tokens` table. */
export type SelectUserPushToken = typeof userPushTokens.$inferSelect;
