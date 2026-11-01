/**
 * @file cache.auth-cookie-names.test.ts
 * @description HOS-1924 item 1. The HOS-1923 bypass recognises Better Auth
 * cookies by name prefix, and `cache.credentials-bypass.test.ts` feeds it
 * hand-written cookie strings. If someone adds `advanced.cookies.*.name`, a
 * third `cookiePrefix`, or Better Auth starts writing a new cookie, the bypass
 * stops matching and the cache leaks again with every test still green.
 *
 * This file closes that gap: it builds the REAL Better Auth instance for each
 * deployment shape, reads the cookie names it will actually write
 * (`(await getAuth().$context).authCookies`), and asserts the cache middleware
 * bypasses on every one of them. The names are never typed in here.
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The global setup mocks the @repo/db schemas (and, through the shared module
// graph, the root export), but `lib/auth.ts` needs the real table objects.
vi.unmock('@repo/db/schemas');
vi.mock('@repo/db', async () => ({
    ...(await vi.importActual<Record<string, unknown>>('@repo/db')),
    // buildAuth only hands the client to the adapter; nothing queries it here.
    getDb: () => ({})
}));

const envOverrides: Record<string, unknown> = {};
vi.mock('../../src/utils/env', async () => {
    const actual =
        await vi.importActual<typeof import('../../src/utils/env')>('../../src/utils/env');
    return {
        ...actual,
        get env() {
            return new Proxy(actual.env, {
                get: (target, prop: string) =>
                    prop in envOverrides
                        ? envOverrides[prop]
                        : (target as Record<string, unknown>)[prop]
            });
        },
        getCacheConfig: () => ({
            enabled: true,
            defaultMaxAge: 60,
            defaultStaleWhileRevalidate: 30,
            defaultStaleIfError: 3600,
            maxAge: 60,
            staleWhileRevalidate: 30,
            staleIfError: 3600,
            etagEnabled: true,
            lastModifiedEnabled: true
        })
    };
});

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }
}));

import { clearCache, createCacheMiddleware } from '../../src/middlewares/cache';
import { validateApiEnv } from '../../src/utils/env';

const ROUTE = '/api/v1/public/posts/slug/some-post';

/** The deployment shapes `lib/auth.ts` can run in: secure on/off x cookie prefix. */
const DEPLOYMENTS = [
    { label: 'dev / local', nodeEnv: 'test', deployEnv: undefined },
    { label: 'staging', nodeEnv: 'production', deployEnv: 'preview' },
    { label: 'production', nodeEnv: 'production', deployEnv: 'prod' },
    { label: 'dev against the staging prefix', nodeEnv: 'test', deployEnv: 'preview' }
] as const;

/** Builds the real Better Auth instance for a deployment and returns every cookie name it writes. */
async function readRealAuthCookieNames({
    nodeEnv,
    deployEnv
}: {
    readonly nodeEnv: string;
    readonly deployEnv: string | undefined;
}): Promise<readonly string[]> {
    vi.resetModules();
    envOverrides.NODE_ENV = nodeEnv;
    envOverrides.HOSPEDA_DEPLOY_ENV = deployEnv;
    const { validateApiEnv: validate } = await import('../../src/utils/env');
    validate();
    const { getAuth } = await import('../../src/lib/auth');
    const context = await getAuth().$context;
    return Object.values(context.authCookies).map((cookie) => (cookie as { name: string }).name);
}

/** A cached public route whose handler counts executions. */
function createTestApp() {
    const app = new Hono();
    let executions = 0;
    app.use('*', createCacheMiddleware());
    app.get(ROUTE, (c) => {
        executions++;
        return c.json({ data: { viewer: 'someone' } });
    });
    return { app, getExecutions: () => executions };
}

describe('Cache middleware — bypass covers every cookie the REAL Better Auth writes (HOS-1924)', () => {
    beforeEach(() => {
        clearCache();
        validateApiEnv();
    });

    it.each(DEPLOYMENTS)('$label: every real auth cookie name bypasses the cache', async ({
        nodeEnv,
        deployEnv
    }) => {
        // Arrange
        const names = await readRealAuthCookieNames({ nodeEnv, deployEnv });
        // Guard against the test going vacuous: Better Auth must expose several.
        expect(names.length).toBeGreaterThanOrEqual(3);
        expect(names.some((name) => name.endsWith('.session_token'))).toBe(true);
        vi.resetModules();
        const { createCacheMiddleware: freshCache, clearCache: freshClear } = await import(
            '../../src/middlewares/cache'
        );
        freshClear();
        const app = new Hono();
        app.use('*', freshCache());
        app.get(ROUTE, (c) => c.json({ data: [] }));

        // Act + Assert, one request per real cookie name
        for (const name of names) {
            const response = await app.request(ROUTE, {
                headers: { Cookie: `hospeda_vid=anon; ${name}=value` }
            });
            expect(response.headers.get('x-cache'), `cookie "${name}"`).toBe('BYPASS');
        }
    });

    it('control: a request with only unrelated cookies is still cached', async () => {
        // Arrange
        const { app, getExecutions } = createTestApp();
        const headers = { Cookie: 'hospeda_vid=anon; ph_session=abc' };

        // Act
        const first = await app.request(ROUTE, { headers });
        const second = await app.request(ROUTE, { headers });

        // Assert
        expect(first.headers.get('x-cache')).toBe('MISS');
        expect(second.headers.get('x-cache')).toBe('HIT');
        expect(getExecutions()).toBe(1);
    });
});
