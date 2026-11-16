import { relations } from 'drizzle-orm';
import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';

/**
 * Better Auth `oauthProvider()` client registry (HOS-2184).
 *
 * One row per OAuth client of the MCP authorization server: registered
 * dynamically (DCR), from a Client ID Metadata Document (CIMD), or by an
 * admin. Other OAuth tables reference `client_id` (not `id`), so it carries a
 * unique constraint. Columns mirror the plugin's `oauthClient` model exactly
 * (Better Auth validates the Drizzle schema at runtime); defaults mirror the
 * plugin's `defaultValue`s. Managed entirely by Better Auth - do not
 * insert/update manually.
 */
export const oauthClients = pgTable(
    'oauth_client',
    {
        id: text('id').primaryKey(),
        clientId: text('client_id').notNull().unique(),
        clientSecret: text('client_secret'),
        clientDiscoveryId: text('client_discovery_id'),
        disabled: boolean('disabled').default(false),
        skipConsent: boolean('skip_consent'),
        enableEndSession: boolean('enable_end_session'),
        subjectType: text('subject_type'),
        scopes: text('scopes').array(),
        clientCredentialsScopes: text('client_credentials_scopes').array().default([]),
        /** Owner of a client registered by a signed-in user; NULL for DCR/CIMD clients. */
        userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
        createdAt: timestamp('created_at', { withTimezone: true }),
        updatedAt: timestamp('updated_at', { withTimezone: true }),
        name: text('name'),
        uri: text('uri'),
        icon: text('icon'),
        contacts: text('contacts').array(),
        tos: text('tos'),
        policy: text('policy'),
        softwareId: text('software_id'),
        softwareVersion: text('software_version'),
        softwareStatement: text('software_statement'),
        redirectUris: text('redirect_uris').array().notNull(),
        postLogoutRedirectUris: text('post_logout_redirect_uris').array(),
        backchannelLogoutUri: text('backchannel_logout_uri'),
        backchannelLogoutSessionRequired: boolean('backchannel_logout_session_required'),
        tokenEndpointAuthMethod: text('token_endpoint_auth_method'),
        applicationType: text('application_type'),
        jwks: text('jwks'),
        jwksUri: text('jwks_uri'),
        grantTypes: text('grant_types').array(),
        responseTypes: text('response_types').array(),
        requirePKCE: boolean('require_pkce'),
        dpopBoundAccessTokens: boolean('dpop_bound_access_tokens').default(false),
        referenceId: text('reference_id'),
        metadata: jsonb('metadata')
    },
    (table) => ({
        userIdx: index('idx_oauth_client_user_id').on(table.userId)
    })
);

export const oauthClientsRelations = relations(oauthClients, ({ one }) => ({
    user: one(users, {
        fields: [oauthClients.userId],
        references: [users.id]
    })
}));

/** Insert shape for an OAuth client. */
export type InsertOauthClient = typeof oauthClients.$inferInsert;
/** Select shape for an OAuth client. */
export type SelectOauthClient = typeof oauthClients.$inferSelect;
