/**
 * Parity between the MCP OAuth plugins' declared models and the Drizzle
 * tables mapped for Better Auth's adapter (HOS-2184 T-005).
 *
 * Better Auth >= 1.7 validates the Drizzle schema at runtime and fails every
 * auth request on a mismatch. This test applies the same rules to the
 * plugins `buildMcpOAuthConfig` registers, without a live DB:
 *
 * - every model the plugins declare is mapped under its model name;
 * - every declared field (and `id`) exists as a column property;
 * - a column the plugin does not write is nullable or has a default;
 * - required fields are NOT NULL, optional ones are nullable.
 *
 * `@repo/db` is mocked globally in `test/setup.ts`; this file re-mocks it with
 * the real OAuth provider tables so the actual Drizzle columns are inspected.
 */

import { getTableColumns } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import { buildMcpOAuthConfig } from '../../src/lib/auth-mcp-oauth';
import { MCP_OAUTH_ADAPTER_SCHEMA } from '../../src/lib/auth-mcp-oauth-schema';

// The global mock has no OAuth tables; serve the real ones (imported by path,
// so the mock does not intercept them).
vi.mock(
    '@repo/db',
    async () => import('../../../../packages/db/src/schemas/oauth-provider/index.ts')
);

interface DeclaredField {
    readonly required?: boolean;
    readonly fieldName?: string;
}

interface DeclaredModel {
    readonly fields: Record<string, DeclaredField>;
}

/** Models the core config already maps in `auth.ts` (not part of this map). */
const CORE_MODELS = new Set(['user', 'session', 'account', 'verification']);

/** Every model declared by the plugins of an enabled MCP OAuth config. */
function declaredModels(): Record<string, DeclaredModel> {
    const config = buildMcpOAuthConfig({
        enabled: true,
        resourceUrl: 'https://api.example.test/mcp',
        siteUrl: 'https://example.test'
    });
    const models: Record<string, DeclaredModel> = {};
    for (const plugin of config.plugins) {
        const schema = (plugin as { schema?: Record<string, DeclaredModel> }).schema ?? {};
        for (const [name, model] of Object.entries(schema)) {
            if (CORE_MODELS.has(name)) continue;
            const existing = models[name];
            models[name] = { fields: { ...(existing?.fields ?? {}), ...model.fields } };
        }
    }
    return models;
}

describe('MCP OAuth adapter schema (HOS-2184 T-005)', () => {
    const models = declaredModels();
    const mapped = MCP_OAUTH_ADAPTER_SCHEMA as Record<string, PgTable>;

    it('maps exactly the models the jwt() and oauthProvider() plugins declare', () => {
        // Arrange / Act
        const declared = Object.keys(models).sort();

        // Assert
        expect(declared).toEqual([
            'jwks',
            'oauthAccessToken',
            'oauthClient',
            'oauthClientAssertion',
            'oauthClientResource',
            'oauthConsent',
            'oauthRefreshToken',
            'oauthResource'
        ]);
        expect(Object.keys(mapped).sort()).toEqual(declared);
    });

    it.each(Object.keys(models))('%s: has a column for id and every declared field', (name) => {
        // Arrange
        const columns = getTableColumns(mapped[name] as PgTable);
        const written = [
            'id',
            ...Object.entries(models[name]?.fields ?? {}).map(([key, f]) => f.fieldName ?? key)
        ];

        // Act
        const missing = written.filter((field) => !(field in columns));

        // Assert
        expect(missing).toEqual([]);
    });

    it.each(Object.keys(models))('%s: no column the plugin never writes is required', (name) => {
        // Arrange
        const columns = getTableColumns(mapped[name] as PgTable);
        const written = new Set([
            'id',
            ...Object.entries(models[name]?.fields ?? {}).map(([key, f]) => f.fieldName ?? key)
        ]);

        // Act
        const unexpected = Object.entries(columns)
            .filter(([key, col]) => !written.has(key) && col.notNull && !col.hasDefault)
            .map(([key]) => key);

        // Assert
        expect(unexpected).toEqual([]);
    });

    it.each(Object.keys(models))('%s: NOT NULL matches the declared required flag', (name) => {
        // Arrange
        const columns = getTableColumns(mapped[name] as PgTable);

        // Act
        const mismatched = Object.entries(models[name]?.fields ?? {})
            .filter(([key, field]) => {
                const col = columns[field.fieldName ?? key];
                return col !== undefined && col.notNull !== (field.required === true);
            })
            .map(([key]) => key);

        // Assert
        expect(mismatched).toEqual([]);
    });
});
