import { relations } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';
import { oauthClients } from './oauth-client.dbschema.ts';

/**
 * Better Auth `oauthProvider()` user consents (HOS-2184).
 *
 * One row per (user, client) grant the user approved on the consent page:
 * the scopes and resources they agreed to. Deleting it is how a connection
 * is revoked. Columns mirror the plugin's `oauthConsent` model exactly.
 * Managed entirely by Better Auth - do not insert/update manually.
 */
export const oauthConsents = pgTable(
    'oauth_consent',
    {
        id: text('id').primaryKey(),
        clientId: text('client_id')
            .notNull()
            .references(() => oauthClients.clientId, { onDelete: 'cascade' }),
        userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
        referenceId: text('reference_id'),
        resources: text('resources').array(),
        requestedUserInfoClaims: text('requested_user_info_claims').array(),
        scopes: text('scopes').array().notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }),
        updatedAt: timestamp('updated_at', { withTimezone: true })
    },
    (table) => ({
        clientIdx: index('idx_oauth_consent_client_id').on(table.clientId),
        userIdx: index('idx_oauth_consent_user_id').on(table.userId)
    })
);

export const oauthConsentsRelations = relations(oauthConsents, ({ one }) => ({
    client: one(oauthClients, {
        fields: [oauthConsents.clientId],
        references: [oauthClients.clientId]
    }),
    user: one(users, {
        fields: [oauthConsents.userId],
        references: [users.id]
    })
}));

/** Insert shape for an OAuth consent. */
export type InsertOauthConsent = typeof oauthConsents.$inferInsert;
/** Select shape for an OAuth consent. */
export type SelectOauthConsent = typeof oauthConsents.$inferSelect;
