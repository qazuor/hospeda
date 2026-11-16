import { relations } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sessions } from '../user/session.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { oauthClients } from './oauth-client.dbschema.ts';

/**
 * Better Auth `oauthProvider()` refresh tokens (HOS-2184).
 *
 * Issued when a client asks for `offline_access`; single-use (rotated on each
 * refresh). `token` holds the plugin's stored form of the token, never the
 * raw value. Columns mirror the plugin's `oauthRefreshToken` model exactly.
 * Managed entirely by Better Auth - do not insert/update manually.
 */
export const oauthRefreshTokens = pgTable(
    'oauth_refresh_token',
    {
        id: text('id').primaryKey(),
        token: text('token').notNull().unique(),
        clientId: text('client_id')
            .notNull()
            .references(() => oauthClients.clientId, { onDelete: 'cascade' }),
        sessionId: text('session_id').references(() => sessions.id, { onDelete: 'set null' }),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        referenceId: text('reference_id'),
        authorizationCodeId: text('authorization_code_id'),
        resources: text('resources').array(),
        requestedUserInfoClaims: text('requested_user_info_claims').array(),
        expiresAt: timestamp('expires_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true }),
        revoked: timestamp('revoked', { withTimezone: true }),
        rotatedAt: timestamp('rotated_at', { withTimezone: true }),
        rotationReplayResponse: text('rotation_replay_response'),
        rotationReplayExpiresAt: timestamp('rotation_replay_expires_at', { withTimezone: true }),
        authTime: timestamp('auth_time', { withTimezone: true }),
        confirmation: jsonb('confirmation'),
        scopes: text('scopes').array().notNull()
    },
    (table) => ({
        clientIdx: index('idx_oauth_refresh_token_client_id').on(table.clientId),
        sessionIdx: index('idx_oauth_refresh_token_session_id').on(table.sessionId),
        userIdx: index('idx_oauth_refresh_token_user_id').on(table.userId),
        authorizationCodeIdx: index('idx_oauth_refresh_token_authorization_code_id').on(
            table.authorizationCodeId
        )
    })
);

/**
 * Better Auth `oauthProvider()` opaque access tokens (HOS-2184).
 *
 * The MCP access tokens are JWTs (audience = the MCP resource), verified
 * locally against `/api/auth/jwks`; this table holds the opaque tokens the
 * provider persists. The plugin declares it either way and Better Auth
 * validates that it exists. Columns mirror the plugin's `oauthAccessToken`
 * model exactly.
 * Managed entirely by Better Auth - do not insert/update manually.
 */
export const oauthAccessTokens = pgTable(
    'oauth_access_token',
    {
        id: text('id').primaryKey(),
        token: text('token').unique(),
        clientId: text('client_id')
            .notNull()
            .references(() => oauthClients.clientId, { onDelete: 'cascade' }),
        sessionId: text('session_id').references(() => sessions.id, { onDelete: 'set null' }),
        userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
        referenceId: text('reference_id'),
        authorizationCodeId: text('authorization_code_id'),
        resources: text('resources').array(),
        requestedUserInfoClaims: text('requested_user_info_claims').array(),
        refreshId: text('refresh_id').references(() => oauthRefreshTokens.id, {
            onDelete: 'cascade'
        }),
        expiresAt: timestamp('expires_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true }),
        revoked: timestamp('revoked', { withTimezone: true }),
        confirmation: jsonb('confirmation'),
        scopes: text('scopes').array().notNull()
    },
    (table) => ({
        clientIdx: index('idx_oauth_access_token_client_id').on(table.clientId),
        sessionIdx: index('idx_oauth_access_token_session_id').on(table.sessionId),
        userIdx: index('idx_oauth_access_token_user_id').on(table.userId),
        authorizationCodeIdx: index('idx_oauth_access_token_authorization_code_id').on(
            table.authorizationCodeId
        ),
        refreshIdx: index('idx_oauth_access_token_refresh_id').on(table.refreshId)
    })
);

export const oauthRefreshTokensRelations = relations(oauthRefreshTokens, ({ one, many }) => ({
    client: one(oauthClients, {
        fields: [oauthRefreshTokens.clientId],
        references: [oauthClients.clientId]
    }),
    user: one(users, {
        fields: [oauthRefreshTokens.userId],
        references: [users.id]
    }),
    accessTokens: many(oauthAccessTokens)
}));

export const oauthAccessTokensRelations = relations(oauthAccessTokens, ({ one }) => ({
    client: one(oauthClients, {
        fields: [oauthAccessTokens.clientId],
        references: [oauthClients.clientId]
    }),
    user: one(users, {
        fields: [oauthAccessTokens.userId],
        references: [users.id]
    }),
    refreshToken: one(oauthRefreshTokens, {
        fields: [oauthAccessTokens.refreshId],
        references: [oauthRefreshTokens.id]
    })
}));

/** Insert shape for an OAuth refresh token. */
export type InsertOauthRefreshToken = typeof oauthRefreshTokens.$inferInsert;
/** Select shape for an OAuth refresh token. */
export type SelectOauthRefreshToken = typeof oauthRefreshTokens.$inferSelect;
/** Insert shape for an OAuth opaque access token. */
export type InsertOauthAccessToken = typeof oauthAccessTokens.$inferInsert;
/** Select shape for an OAuth opaque access token. */
export type SelectOauthAccessToken = typeof oauthAccessTokens.$inferSelect;
