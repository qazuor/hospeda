/**
 * Schema-level unit tests for the Better Auth OAuth provider tables
 * (HOS-2184 T-005): `jwks`, `oauth_client`, `oauth_resource`,
 * `oauth_client_resource`, `oauth_refresh_token`, `oauth_access_token`,
 * `oauth_consent`, `oauth_client_assertion`.
 *
 * In-process tests over Drizzle's `getTableConfig` metadata; no PostgreSQL
 * needed. Field-level parity with what the plugins declare is asserted in
 * `apps/api/test/lib/auth-mcp-oauth-schema.test.ts`, where the plugins are
 * importable; this file pins the SQL shape: names, keys, FKs and indexes.
 */

import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import {
    jwks,
    oauthAccessTokens,
    oauthClientAssertions,
    oauthClientResources,
    oauthClients,
    oauthConsents,
    oauthRefreshTokens,
    oauthResources
} from '../../src/schemas/oauth-provider/index.ts';

/** One FK as `local_column -> foreign_table.foreign_column (on delete)`. */
function foreignKeys(table: PgTable): string[] {
    return getTableConfig(table)
        .foreignKeys.map((fk) => {
            const ref = fk.reference();
            const local = ref.columns.map((c) => c.name).join(',');
            const foreign = ref.foreignColumns.map((c) => c.name).join(',');
            return `${local} -> ${getTableConfig(ref.foreignTable).name}.${foreign} (${fk.onDelete})`;
        })
        .sort();
}

/** The SQL column names of a table. */
function columnNames(table: PgTable): string[] {
    return getTableConfig(table).columns.map((c) => c.name);
}

/** A column's config by SQL name. */
function column(table: PgTable, name: string) {
    return getTableConfig(table).columns.find((c) => c.name === name);
}

/** Index names of a table. */
function indexNames(table: PgTable): string[] {
    return getTableConfig(table)
        .indexes.map((i) => i.config.name ?? '')
        .sort();
}

describe('OAuth provider tables (HOS-2184)', () => {
    it.each([
        [jwks, 'jwks'],
        [oauthClients, 'oauth_client'],
        [oauthResources, 'oauth_resource'],
        [oauthClientResources, 'oauth_client_resource'],
        [oauthRefreshTokens, 'oauth_refresh_token'],
        [oauthAccessTokens, 'oauth_access_token'],
        [oauthConsents, 'oauth_consent'],
        [oauthClientAssertions, 'oauth_client_assertion']
    ] as const)('uses the singular snake_case table name %#', (table, name) => {
        // Arrange / Act
        const config = getTableConfig(table);

        // Assert
        expect(config.name).toBe(name);
        expect(column(table, 'id')?.primary).toBe(true);
        expect(column(table, 'id')?.columnType).toBe('PgText');
    });

    it('jwks holds the key pair and created_at as required columns', () => {
        // Arrange / Act
        const names = columnNames(jwks);

        // Assert
        expect(names).toEqual([
            'id',
            'public_key',
            'private_key',
            'created_at',
            'expires_at',
            'alg',
            'crv'
        ]);
        expect(column(jwks, 'public_key')?.notNull).toBe(true);
        expect(column(jwks, 'private_key')?.notNull).toBe(true);
        expect(column(jwks, 'created_at')?.notNull).toBe(true);
        expect(column(jwks, 'expires_at')?.notNull).toBe(false);
    });

    it('oauth_client has a unique client_id, required redirect_uris and an optional owner', () => {
        // Arrange / Act
        const clientId = column(oauthClients, 'client_id');
        const redirectUris = column(oauthClients, 'redirect_uris');
        const userId = column(oauthClients, 'user_id');

        // Assert
        expect(clientId?.notNull).toBe(true);
        expect(clientId?.isUnique).toBe(true);
        expect(redirectUris?.notNull).toBe(true);
        expect(redirectUris?.columnType).toBe('PgArray');
        expect(userId?.notNull).toBe(false);
        expect(userId?.columnType).toBe('PgUUID');
        expect(column(oauthClients, 'metadata')?.columnType).toBe('PgJsonb');
        expect(foreignKeys(oauthClients)).toEqual(['user_id -> users.id (cascade)']);
        expect(indexNames(oauthClients)).toEqual(['idx_oauth_client_user_id']);
    });

    it('oauth_resource is referenced by a unique identifier', () => {
        // Arrange / Act
        const identifier = column(oauthResources, 'identifier');

        // Assert
        expect(identifier?.notNull).toBe(true);
        expect(identifier?.isUnique).toBe(true);
        expect(column(oauthResources, 'name')?.notNull).toBe(true);
        expect(column(oauthResources, 'policy_version')?.default).toBe(1);
        expect(foreignKeys(oauthResources)).toEqual([]);
    });

    it('oauth_client_resource links client and resource once each, cascading', () => {
        // Arrange / Act
        const config = getTableConfig(oauthClientResources);
        const unique = config.indexes.find(
            (i) => i.config.name === 'uq_oauth_client_resource_client_resource'
        );

        // Assert
        expect(foreignKeys(oauthClientResources)).toEqual([
            'client_id -> oauth_client.client_id (cascade)',
            'resource_id -> oauth_resource.identifier (cascade)'
        ]);
        expect(unique?.config.unique).toBe(true);
        expect(unique?.config.columns.map((c) => ('name' in c ? c.name : ''))).toEqual([
            'client_id',
            'resource_id'
        ]);
    });

    it('oauth_refresh_token belongs to a user and a client; its session is nulled on delete', () => {
        // Arrange / Act
        const fks = foreignKeys(oauthRefreshTokens);

        // Assert
        expect(fks).toEqual([
            'client_id -> oauth_client.client_id (cascade)',
            'session_id -> session.id (set null)',
            'user_id -> users.id (cascade)'
        ]);
        expect(column(oauthRefreshTokens, 'user_id')?.notNull).toBe(true);
        expect(column(oauthRefreshTokens, 'token')?.isUnique).toBe(true);
        expect(column(oauthRefreshTokens, 'scopes')?.notNull).toBe(true);
        expect(indexNames(oauthRefreshTokens)).toEqual([
            'idx_oauth_refresh_token_authorization_code_id',
            'idx_oauth_refresh_token_client_id',
            'idx_oauth_refresh_token_session_id',
            'idx_oauth_refresh_token_user_id'
        ]);
    });

    it('oauth_access_token references client, user, session and its refresh token', () => {
        // Arrange / Act
        const fks = foreignKeys(oauthAccessTokens);

        // Assert
        expect(fks).toEqual([
            'client_id -> oauth_client.client_id (cascade)',
            'refresh_id -> oauth_refresh_token.id (cascade)',
            'session_id -> session.id (set null)',
            'user_id -> users.id (cascade)'
        ]);
        expect(column(oauthAccessTokens, 'user_id')?.notNull).toBe(false);
        expect(column(oauthAccessTokens, 'token')?.notNull).toBe(false);
        expect(column(oauthAccessTokens, 'token')?.isUnique).toBe(true);
    });

    it('oauth_consent is deleted with its user or client', () => {
        // Arrange / Act
        const fks = foreignKeys(oauthConsents);

        // Assert
        expect(fks).toEqual([
            'client_id -> oauth_client.client_id (cascade)',
            'user_id -> users.id (cascade)'
        ]);
        expect(column(oauthConsents, 'scopes')?.notNull).toBe(true);
    });

    it('oauth_client_assertion is just a jti and its expiry', () => {
        // Arrange / Act
        const names = columnNames(oauthClientAssertions);

        // Assert
        expect(names).toEqual(['id', 'expires_at']);
        expect(column(oauthClientAssertions, 'expires_at')?.notNull).toBe(true);
    });

    it('stores every timestamp with time zone', () => {
        // Arrange
        const tables = [
            jwks,
            oauthClients,
            oauthResources,
            oauthClientResources,
            oauthRefreshTokens,
            oauthAccessTokens,
            oauthConsents,
            oauthClientAssertions
        ];

        // Act
        const naive = tables.flatMap((table) =>
            getTableConfig(table)
                .columns.filter(
                    (c) =>
                        c.columnType === 'PgTimestamp' && !c.getSQLType().includes('with time zone')
                )
                .map((c) => `${getTableConfig(table).name}.${c.name}`)
        );

        // Assert
        expect(naive).toEqual([]);
    });
});
