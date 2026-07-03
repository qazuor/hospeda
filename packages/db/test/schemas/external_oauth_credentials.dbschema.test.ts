/**
 * Schema-level unit tests for `external_oauth_credentials` (HOS-45 T-002).
 *
 * These are in-process tests — they inspect Drizzle's `getTableConfig`
 * metadata and do NOT require a running PostgreSQL instance.
 *
 * Mirrors the equivalent `ai_provider_credentials` section in
 * `ai-schemas.test.ts` (the near-identical precedent for an
 * encrypted-at-rest credential vault table).
 *
 * AAA pattern (Arrange / Act / Assert):
 *   - Arrange: import the Drizzle table and call `getTableConfig`.
 *   - Act:    extract columns / indexes from the config.
 *   - Assert: assert presence, types, and structural invariants.
 */

import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import { externalOauthCredentials } from '../../src/schemas/integration/external_oauth_credentials.dbschema.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ColumnConfig = ReturnType<typeof getTableConfig>['columns'][number];

/**
 * Find a column by its SQL name (snake_case as declared in the schema).
 */
function col(sqlName: string): ColumnConfig | undefined {
    return getTableConfig(externalOauthCredentials).columns.find((c) => c.name === sqlName);
}

/**
 * Return true when a column exists in the table config.
 */
function hasCol(sqlName: string): boolean {
    return col(sqlName) !== undefined;
}

/**
 * Return all index names for the table.
 */
function indexNames(): string[] {
    return getTableConfig(externalOauthCredentials).indexes.map((i) => i.config.name);
}

// ---------------------------------------------------------------------------
// external_oauth_credentials
// ---------------------------------------------------------------------------

describe('external_oauth_credentials schema', () => {
    it('should have the correct table name', () => {
        // Arrange + Act
        const config = getTableConfig(externalOauthCredentials);
        // Assert
        expect(config.name).toBe('external_oauth_credentials');
    });

    it('should have the id, provider, and expires_at columns', () => {
        // Arrange + Act
        const sqlNames = getTableConfig(externalOauthCredentials).columns.map((c) => c.name);
        // Assert
        expect(sqlNames).toContain('id');
        expect(sqlNames).toContain('provider');
        expect(sqlNames).toContain('expires_at');
    });

    it('should have access_token ciphertext/iv/auth_tag columns (AES-256-GCM layout)', () => {
        // Arrange + Act
        const sqlNames = getTableConfig(externalOauthCredentials).columns.map((c) => c.name);
        // Assert
        expect(sqlNames).toContain('access_token_ciphertext');
        expect(sqlNames).toContain('access_token_iv');
        expect(sqlNames).toContain('access_token_auth_tag');
    });

    it('should have refresh_token ciphertext/iv/auth_tag columns (AES-256-GCM layout)', () => {
        // Arrange + Act
        const sqlNames = getTableConfig(externalOauthCredentials).columns.map((c) => c.name);
        // Assert
        expect(sqlNames).toContain('refresh_token_ciphertext');
        expect(sqlNames).toContain('refresh_token_iv');
        expect(sqlNames).toContain('refresh_token_auth_tag');
    });

    it('access_token_ciphertext should be text type (unbounded length)', () => {
        // Arrange + Act
        const ciphertextCol = col('access_token_ciphertext');
        // Assert
        expect(ciphertextCol?.columnType).toBe('PgText');
    });

    it('refresh_token_ciphertext should be text type (unbounded length)', () => {
        // Arrange + Act
        const ciphertextCol = col('refresh_token_ciphertext');
        // Assert
        expect(ciphertextCol?.columnType).toBe('PgText');
    });

    it('expires_at should be not-null (access token expiry drives refresh scheduling)', () => {
        // Arrange + Act
        const expiresAtCol = col('expires_at');
        // Assert
        expect(expiresAtCol?.notNull).toBe(true);
    });

    it('should have a soft-delete column (deletedAt)', () => {
        expect(hasCol('deleted_at')).toBe(true);
    });

    it('deleted_at should be nullable', () => {
        // Arrange + Act
        const deletedAtCol = col('deleted_at');
        // Assert
        expect(deletedAtCol?.notNull).toBe(false);
    });

    it('should have a unique partial index enforcing one active row per provider', () => {
        // Arrange + Act
        const names = indexNames();
        const { indexes } = getTableConfig(externalOauthCredentials);
        const activeProviderIdx = indexes.find(
            (i) => i.config.name === 'idx_external_oauth_credentials_active_provider'
        );
        // Assert
        expect(names).toContain('idx_external_oauth_credentials_active_provider');
        expect(activeProviderIdx?.config.unique).toBe(true);
    });
});
