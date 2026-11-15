import { relations } from 'drizzle-orm';
import {
    boolean,
    index,
    integer,
    jsonb,
    pgTable,
    text,
    timestamp,
    uniqueIndex
} from 'drizzle-orm/pg-core';
import { oauthClients } from './oauth-client.dbschema.ts';

/**
 * Better Auth `oauthProvider()` protected resources (HOS-2184).
 *
 * One row per resource an access token can be bound to (`aud`). The provider
 * seeds the rows from its `resources` option at boot, so the MCP URL
 * (`HOSPEDA_MCP_RESOURCE_URL`) lands here on its own. Referenced by
 * `identifier`, which is therefore unique. Columns mirror the plugin's
 * `oauthResource` model exactly; defaults mirror its `defaultValue`s.
 * Managed entirely by Better Auth - do not insert/update manually.
 */
export const oauthResources = pgTable('oauth_resource', {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull().unique(),
    name: text('name').notNull(),
    accessTokenTtl: integer('access_token_ttl'),
    refreshTokenTtl: integer('refresh_token_ttl'),
    signingAlgorithm: text('signing_algorithm'),
    signingKeyId: text('signing_key_id'),
    allowedScopes: text('allowed_scopes').array(),
    customClaims: jsonb('custom_claims'),
    dpopBoundAccessTokensRequired: boolean('dpop_bound_access_tokens_required').default(false),
    disabled: boolean('disabled').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
    policyVersion: integer('policy_version').default(1),
    metadata: jsonb('metadata')
});

/**
 * Better Auth `oauthProvider()` client ↔ resource links (HOS-2184).
 *
 * Which resources a client may request when per-client resources are
 * enforced. Hospeda runs with `enforcePerClientResources: false`, so the
 * table stays empty today, but the plugin declares it and Better Auth
 * validates that it exists. One link per (client, resource).
 * Managed entirely by Better Auth - do not insert/update manually.
 */
export const oauthClientResources = pgTable(
    'oauth_client_resource',
    {
        id: text('id').primaryKey(),
        clientId: text('client_id')
            .notNull()
            .references(() => oauthClients.clientId, { onDelete: 'cascade' }),
        resourceId: text('resource_id')
            .notNull()
            .references(() => oauthResources.identifier, { onDelete: 'cascade' }),
        metadata: jsonb('metadata'),
        createdAt: timestamp('created_at', { withTimezone: true })
    },
    (table) => ({
        clientResourceUnique: uniqueIndex('uq_oauth_client_resource_client_resource').on(
            table.clientId,
            table.resourceId
        ),
        clientIdx: index('idx_oauth_client_resource_client_id').on(table.clientId),
        resourceIdx: index('idx_oauth_client_resource_resource_id').on(table.resourceId)
    })
);

export const oauthClientResourcesRelations = relations(oauthClientResources, ({ one }) => ({
    client: one(oauthClients, {
        fields: [oauthClientResources.clientId],
        references: [oauthClients.clientId]
    }),
    resource: one(oauthResources, {
        fields: [oauthClientResources.resourceId],
        references: [oauthResources.identifier]
    })
}));

/** Insert shape for an OAuth resource. */
export type InsertOauthResource = typeof oauthResources.$inferInsert;
/** Select shape for an OAuth resource. */
export type SelectOauthResource = typeof oauthResources.$inferSelect;
/** Insert shape for an OAuth client ↔ resource link. */
export type InsertOauthClientResource = typeof oauthClientResources.$inferInsert;
/** Select shape for an OAuth client ↔ resource link. */
export type SelectOauthClientResource = typeof oauthClientResources.$inferSelect;
