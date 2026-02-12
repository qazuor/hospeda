import { relations } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { AuthProviderPgEnum } from '../enums.dbschema.ts';
import { users } from './user.dbschema.ts';

/**
 * @deprecated Legacy identity table from Clerk era.
 * Better Auth uses the `account` table for provider identity tracking.
 * Retained for backward compatibility with existing data.
 */
export const userAuthIdentities = pgTable(
    'user_auth_identities',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        provider: AuthProviderPgEnum('provider').notNull(),
        providerUserId: text('provider_user_id').notNull(),
        email: text('email'),
        username: text('username'),
        avatarUrl: text('avatar_url'),
        raw: jsonb('raw'),
        lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        uniqueProviderIdentity: uniqueIndex('user_auth_identity_provider_user_id_key').on(
            table.provider,
            table.providerUserId
        )
    })
);

export const userAuthIdentitiesRelations = relations(userAuthIdentities, ({ one }) => ({
    user: one(users, {
        fields: [userAuthIdentities.userId],
        references: [users.id]
    })
}));
