/**
 * @file cache.credentials-bypass.test.ts
 * @description Regression test for HOS-1923 (security).
 *
 * The in-process response cache runs BEFORE `authMiddleware`/`actorMiddleware`
 * and keys public endpoints as `public:${path}?${query}`, with no actor in it.
 * The web app and the admin authenticate with the Better Auth session COOKIE,
 * which the key never read. So on a MISS the handler ran with the real actor
 * and its answer was stored for everyone:
 *
 * - an author with `POST_VIEW_DRAFT` fetched `/api/v1/public/posts/slug/<draft>`
 *   with their cookie, and every anonymous caller got the draft for the TTL;
 * - the owner of `/api/v1/public/users/<id>` got their own profile cached, and
 *   in reverse an anonymous 404 was replayed to the owner.
 *
 * The rule under test: a request that carries credentials neither reads from
 * nor writes to the cache. Anonymous caching is untouched.
 *
 * Every leak assertion is paired with an anonymous MISS → HIT control, so the
 * file cannot pass with the cache simply switched off.
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/utils/env', () => ({
    getCacheConfig: vi.fn(() => ({
        enabled: true,
        defaultMaxAge: 60,
        defaultStaleWhileRevalidate: 30,
        defaultStaleIfError: 3600,
        maxAge: 60,
        staleWhileRevalidate: 30,
        staleIfError: 3600,
        etagEnabled: true,
        lastModifiedEnabled: true
    })),
    validateApiEnv: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }
}));

import { clearCache, createCacheMiddleware, getCacheSize } from '../../src/middlewares/cache';
import { getCacheConfig } from '../../src/utils/env';

const DRAFT_ROUTE = '/api/v1/public/posts/slug/draft-post';
const PROFILE_ROUTE = '/api/v1/public/users/user-1';

/** Session cookie as written in production (`useSecureCookies`). */
const SECURE_SESSION_COOKIE = '__Secure-better-auth.session_token=signed-token.sig';
/** Session cookie as written in dev and local runs. */
const PLAIN_SESSION_COOKIE = 'better-auth.session_token=signed-token.sig';
/** Session cookie of the staging deployment (HOS-955 prefix). */
const STAGING_SESSION_COOKIE = '__Secure-hospeda-staging.session_token=signed-token.sig';
/** Better Auth's `session.cookieCache` cookie on its own. */
const SESSION_DATA_COOKIE = '__Secure-better-auth.session_data=payload';
/** Cookies every anonymous visitor carries. */
const ANONYMOUS_COOKIES = 'hospeda_vid=00000000-0000-4000-8000-000000000001; ph_session=abc';

/**
 * Builds an app whose handler answers like an actor-dependent route: the body
 * names whoever the request claims to be, so a replay across callers is
 * immediately visible.
 */
function createTestApp({ route }: { readonly route: string }) {
    const app = new Hono();
    let executions = 0;

    app.use('*', createCacheMiddleware());
    app.get(route, (c) => {
        executions++;
        const authenticated =
            c.req.header('Authorization') !== undefined ||
            (c.req.header('Cookie') ?? '').includes('.session_') ||
            c.req.header('x-mock-actor-id') !== undefined;
        if (!authenticated) return c.json({ error: 'not found' }, 404);
        return c.json({ data: { status: 'DRAFT', viewer: 'author' } });
    });

    return { app, getExecutions: () => executions };
}

describe('Cache middleware — requests with credentials bypass the cache (HOS-1923)', () => {
    beforeEach(() => {
        clearCache();
        vi.mocked(getCacheConfig).mockReturnValue({
            enabled: true,
            defaultMaxAge: 60,
            defaultStaleWhileRevalidate: 30,
            defaultStaleIfError: 3600,
            maxAge: 60,
            staleWhileRevalidate: 30,
            staleIfError: 3600,
            etagEnabled: true,
            lastModifiedEnabled: true
        });
    });

    it('control: an anonymous request is still MISS then HIT', async () => {
        const { app, getExecutions } = createTestApp({ route: DRAFT_ROUTE });

        const first = await app.request(DRAFT_ROUTE);
        const second = await app.request(DRAFT_ROUTE);

        expect(first.headers.get('x-cache')).toBe('MISS');
        expect(second.headers.get('x-cache')).toBe('HIT');
        expect(getExecutions()).toBe(1);
    });

    it.each([
        ['the production session cookie', SECURE_SESSION_COOKIE],
        ['the dev session cookie', PLAIN_SESSION_COOKIE],
        ['the staging session cookie', STAGING_SESSION_COOKIE],
        ['the session_data cookie cache alone', SESSION_DATA_COOKIE],
        [
            'a session cookie among unrelated cookies',
            `${ANONYMOUS_COOKIES}; ${SECURE_SESSION_COOKIE}`
        ]
    ])('does not replay a body fetched with %s to an anonymous caller', async (_label, cookie) => {
        // Arrange
        const { app, getExecutions } = createTestApp({ route: DRAFT_ROUTE });

        // Act: the author reads their draft, then a stranger asks for it.
        const author = await app.request(DRAFT_ROUTE, { headers: { Cookie: cookie } });
        const authorAgain = await app.request(DRAFT_ROUTE, { headers: { Cookie: cookie } });
        const stranger = await app.request(DRAFT_ROUTE);

        // Assert: the leak first, the mechanism second.
        expect(author.status).toBe(200);
        expect(await stranger.text()).not.toContain('DRAFT');
        expect(stranger.status).toBe(404);
        expect(stranger.headers.get('x-cache')).toBe('MISS');
        expect(author.headers.get('x-cache')).toBe('BYPASS');
        expect(authorAgain.headers.get('x-cache')).toBe('BYPASS');
        // Both author reads ran the handler; nothing of theirs was stored.
        expect(getExecutions()).toBe(3);
        expect(getCacheSize()).toBe(1);
    });

    it('does not serve an anonymous 404 to the owner who arrives with a cookie', async () => {
        const { app, getExecutions } = createTestApp({ route: PROFILE_ROUTE });

        const anonymous = await app.request(PROFILE_ROUTE);
        const owner = await app.request(PROFILE_ROUTE, {
            headers: { Cookie: SECURE_SESSION_COOKIE }
        });

        expect(anonymous.status).toBe(404);
        // The leak: the owner was served the stored anonymous 404.
        expect(owner.status).toBe(200);
        expect(owner.headers.get('x-cache')).toBe('BYPASS');
        expect(getExecutions()).toBe(2);
    });

    it('bypasses a request carrying an Authorization header (private bucket too)', async () => {
        const { app, getExecutions } = createTestApp({ route: PROFILE_ROUTE });

        const authed = await app.request(PROFILE_ROUTE, {
            headers: { Authorization: 'Bearer token-a' }
        });
        const authedAgain = await app.request(PROFILE_ROUTE, {
            headers: { Authorization: 'Bearer token-a' }
        });
        const anonymous = await app.request(PROFILE_ROUTE);

        expect(authed.status).toBe(200);
        expect(anonymous.status).toBe(404);
        expect(anonymous.headers.get('x-cache')).toBe('MISS');
        expect(authed.headers.get('x-cache')).toBe('BYPASS');
        expect(authedAgain.headers.get('x-cache')).toBe('BYPASS');
        expect(getExecutions()).toBe(3);
    });

    it('bypasses the mock-actor header the test harness turns into an actor', async () => {
        const { app, getExecutions } = createTestApp({ route: DRAFT_ROUTE });

        const mock = await app.request(DRAFT_ROUTE, {
            headers: { 'x-mock-actor-id': '00000000-0000-4000-8000-000000000042' }
        });
        const anonymous = await app.request(DRAFT_ROUTE);

        expect(mock.status).toBe(200);
        expect(anonymous.status).toBe(404);
        expect(anonymous.headers.get('x-cache')).toBe('MISS');
        expect(mock.headers.get('x-cache')).toBe('BYPASS');
        expect(getExecutions()).toBe(2);
    });

    it.each([
        ['visitor-id and analytics cookies', ANONYMOUS_COOKIES],
        ['a cookie whose VALUE mentions the session cookie', 'note=better-auth.session_token'],
        ['a cookie whose name only contains the prefix', 'xbetter-auth.session_token=1']
    ])('keeps caching a request with %s', async (_label, cookie) => {
        const { app, getExecutions } = createTestApp({ route: '/api/v1/public/accommodations' });

        const first = await app.request('/api/v1/public/accommodations', {
            headers: { Cookie: cookie }
        });
        const second = await app.request('/api/v1/public/accommodations', {
            headers: { Cookie: cookie }
        });

        expect(first.headers.get('x-cache')).toBe('MISS');
        expect(second.headers.get('x-cache')).toBe('HIT');
        expect(getExecutions()).toBe(1);
    });

    it('does not tag unclassified endpoints, credentials or not', async () => {
        const { app } = createTestApp({ route: '/api/v1/unknown' });

        const res = await app.request('/api/v1/unknown', {
            headers: { Cookie: SECURE_SESSION_COOKIE }
        });

        expect(res.headers.get('x-cache')).toBeNull();
    });
});
