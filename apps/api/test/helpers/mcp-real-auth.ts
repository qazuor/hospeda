/**
 * Helpers for tests that run the REAL Better Auth instance (`lib/auth`) over
 * its in-memory adapter (HOS-2184 T-029, T-031).
 *
 * A test file using them declares these `vi.mock`s itself (they must be hoisted
 * in the file, so they cannot live here):
 *
 * ```ts
 * vi.mock('better-auth/adapters/drizzle', async () => {
 *     const { createMemoryDrizzleAdapter } = await import('../../helpers/mcp-real-auth');
 *     return { drizzleAdapter: createMemoryDrizzleAdapter };
 * });
 * vi.mock('../../../src/lib/auth-mcp-oauth-schema', () => ({ getMcpOAuthAdapterSchema: () => ({}) }));
 * vi.mock('../../../src/lib/auth-deleted-user-guard', async () => (await import(...)).deletedUserGuardMock);
 * vi.mock('../../../src/lib/auth-signup-baseline-role', ...);
 * vi.mock('@repo/db', async () => (await import(...)).createRealAuthDbMock());
 * ```
 *
 * What is real: Better Auth, its plugins (admin, expo, jwt, oauthProvider,
 * cimd), every hook in `auth.ts` except the two that read the user tables
 * (replaced by the stubs above), password hashing, sessions, cookies, JWT
 * signing. What is not: the storage (an in-memory adapter instead of Drizzle).
 */

import { createHash, randomBytes } from 'node:crypto';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { vi } from 'vitest';

/** The in-memory tables the adapter reads and writes. Keyed by Better Auth model name. */
export const authMemoryStore: Record<string, unknown[]> = {};

/**
 * Every Better Auth model the instance in `lib/auth` declares with the MCP
 * plugins on. The memory adapter needs each table to exist up front (and
 * clones the whole store in transactions, so a lazy Proxy cannot stand in).
 */
const AUTH_MODELS = [
    'user',
    'session',
    'account',
    'verification',
    'jwks',
    'oauthClient',
    'oauthResource',
    'oauthClientResource',
    'oauthRefreshToken',
    'oauthAccessToken',
    'oauthConsent',
    'oauthClientAssertion'
] as const;

/** Row the `getDb()` stand-in answers for a `.limit()` read (the user the bearer middleware loads). */
export const dbLiveUser: { current: Record<string, unknown> | null } = { current: null };

/** Stand-in for `drizzleAdapter(db, options)`: ignores both and serves {@link authMemoryStore}. */
export function createMemoryDrizzleAdapter() {
    return memoryAdapter(authMemoryStore);
}

/** `auth-deleted-user-guard` stub: nobody is deleted. */
export const deletedUserGuardMock = { isUserSoftDeleted: async () => false };

/** `auth-signup-baseline-role` stub: the role write needs the user tables. */
export const baselineRoleMock = { grantBaselineUserRole: async () => {} };

/**
 * A `getDb()` result whose query chain resolves to `[]`, except a chain that
 * went through `.limit()` (the bearer middleware's user lookup), which
 * resolves to {@link dbLiveUser}.
 */
function createQueryChain(): unknown {
    let limited = false;
    const chain: unknown = new Proxy(() => undefined, {
        get: (_target, property) => {
            if (property === 'then') {
                return (resolve: (rows: unknown[]) => void) =>
                    resolve(limited && dbLiveUser.current ? [dbLiveUser.current] : []);
            }
            if (property === 'limit') {
                return () => {
                    limited = true;
                    return chain;
                };
            }
            return () => chain;
        }
    });
    return chain;
}

/** One stored row, as the OAuth models keep it. */
interface StoredRow {
    readonly userId?: string;
    readonly clientId?: string;
    readonly name?: string | null;
    readonly createdAt?: Date | string;
    readonly scopes?: readonly string[];
}

/**
 * `OauthConnectionModel` over the in-memory store: the same operations as the
 * SQL model (list the consents of a user joined to their client; delete a
 * user's access tokens, refresh tokens and consents for one client, counting
 * each). The SQL itself is covered by the `@repo/db` integration test.
 */
export class MemoryOauthConnectionModel {
    async listForUser({ userId }: { readonly userId: string }) {
        const rows = (authMemoryStore.oauthConsent ?? []) as StoredRow[];
        const clients = (authMemoryStore.oauthClient ?? []) as StoredRow[];
        return rows
            .filter((row) => row.userId === userId)
            .map((row) => ({
                clientId: row.clientId as string,
                name: clients.find((client) => client.clientId === row.clientId)?.name ?? null,
                uri: null,
                logoUri: null,
                scopes: [...(row.scopes ?? [])],
                connectedAt: row.createdAt ? new Date(row.createdAt) : null,
                lastUsedAt: null
            }));
    }

    async revokeForUser({
        userId,
        clientId
    }: {
        readonly userId: string;
        readonly clientId: string;
    }) {
        const remove = (model: string): number => {
            const rows = (authMemoryStore[model] ?? []) as StoredRow[];
            const kept = rows.filter(
                (row) => !(row.userId === userId && row.clientId === clientId)
            );
            authMemoryStore[model] = kept;
            return rows.length - kept.length;
        };
        return {
            accessTokens: remove('oauthAccessToken'),
            refreshTokens: remove('oauthRefreshToken'),
            consents: remove('oauthConsent')
        };
    }
}

/**
 * The `@repo/db` mock for a real-auth test: the global mock plus the tables
 * `auth.ts` reads that the global mock lacks, a `getDb` that answers
 * {@link dbLiveUser}, and the OAuth connection model over the memory store.
 *
 * @returns The module replacement for `vi.mock('@repo/db', ...)`
 */
export async function createRealAuthDbMock() {
    const { createDbMock } = await import('./mocks/db-mock');
    return {
        ...createDbMock(),
        getDb: vi.fn(() => createQueryChain()),
        sessions: {},
        accounts: {},
        userRole: {},
        conversations: {},
        OauthConnectionModel: MemoryOauthConnectionModel,
        oauthConnectionModel: new MemoryOauthConnectionModel()
    };
}

/** Empties every table, creating the ones that do not exist yet. */
export function resetAuthMemoryStore(): void {
    for (const key of Object.keys(authMemoryStore)) {
        delete authMemoryStore[key];
    }
    for (const model of AUTH_MODELS) {
        authMemoryStore[model] = [];
    }
}

/** A PKCE verifier and its S256 challenge (RFC 7636). */
export function createPkcePair(): { readonly verifier: string; readonly challenge: string } {
    const verifier = randomBytes(32).toString('base64url');
    return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
}

/**
 * Collapses `Set-Cookie` headers into a `Cookie` request header value.
 *
 * @param response - A response that set cookies
 * @returns The `name=value` pairs, joined
 */
export function toCookieHeader(response: Response): string {
    return response.headers
        .getSetCookie()
        .map((cookie) => cookie.split(';')[0])
        .join('; ');
}

/**
 * Reads a JSON-RPC message from a JSON or single-event SSE body.
 *
 * @param response - A `/mcp` response
 * @returns The parsed JSON-RPC message
 */
export async function readJsonRpc<T = Record<string, unknown>>(response: Response): Promise<T> {
    const text = await response.text();
    if ((response.headers.get('content-type') ?? '').includes('text/event-stream')) {
        const line = text.split('\n').find((candidate) => candidate.startsWith('data: '));
        return JSON.parse(line?.slice('data: '.length) ?? 'null') as T;
    }
    return JSON.parse(text) as T;
}
