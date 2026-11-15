/**
 * Regression: importing `lib/auth` must not dereference the MCP OAuth tables
 * (HOS-2184 T-005).
 *
 * `auth-mcp-oauth-schema.ts` once exported a module-level object built from
 * `jwks` and the `oauth*` tables, so merely importing `lib/auth` read those
 * eight `@repo/db` bindings. Every test whose `@repo/db` mock does not list
 * them (the global mock, and every local factory that spreads
 * `importActual`, whose table bindings come back absent) then failed at
 * import with `No "jwks" export is defined on the "@repo/db" mock` — 395 api
 * test files at once. The tables must be read only when `getAuth()` builds
 * the adapter with the MCP flag on, like the four core tables.
 */

import { describe, expect, it, vi } from 'vitest';

// A mock that exposes none of the OAuth provider tables. Accessing any key it
// does not define throws, which is exactly the failure being guarded.
vi.mock('@repo/db', async () => {
    const { createDbMock } = await import('../helpers/mocks/db-mock');
    return createDbMock();
});

describe('lib/auth import without the MCP OAuth tables in @repo/db', () => {
    it('imports without reading jwks or any oauth* table', async () => {
        // Arrange
        const db = (await import('@repo/db')) as Record<string, unknown>;
        expect('jwks' in db).toBe(false);

        // Act
        const load = import('../../src/lib/auth');

        // Assert
        await expect(load).resolves.toHaveProperty('getAuth');
    });

    it('builds the adapter map only when asked', async () => {
        // Arrange
        const schemaModule = await import('../../src/lib/auth-mcp-oauth-schema');

        // Act
        const build = () => schemaModule.getMcpOAuthAdapterSchema();

        // Assert
        expect(build).toThrow(/jwks/);
    });
});
