/**
 * @file rate-limit-mcp-tiers.test.ts
 * @description HOS-2184: MCP traffic and the OAuth machine endpoints have their
 * own per-IP tiers, separate from `general` and from the login `auth` tier.
 *
 * Claude and ChatGPT call from a few shared server IPs, so a per-IP budget on
 * `/mcp` or on the token endpoint would be one budget for every Hospeda user of
 * that assistant. Budgets here are tiny and distinct so each assertion can tell
 * the tiers apart by behaviour alone.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.HOSPEDA_TESTING_RATE_LIMIT = 'true';

vi.mock('../../src/utils/redis', () => ({
    getRedisClient: vi.fn().mockResolvedValue(undefined),
    disconnectRedis: vi.fn().mockResolvedValue(undefined),
    resetRedisState: vi.fn()
}));

vi.mock('../../src/utils/env', () => {
    const mockEnv = {
        NODE_ENV: 'test',
        HOSPEDA_TESTING_RATE_LIMIT: true,
        HOSPEDA_REDIS_URL: undefined as string | undefined,
        HOSPEDA_INTERNAL_REQUEST_SECRET: ''
    };
    const getRateLimitConfig = () => ({
        enabled: true,
        windowMs: 1000,
        maxRequests: 3,
        keyGenerator: 'ip',
        skip: 'none' as const,
        headers: 'legacy' as const,
        message: 'general limit',
        trustProxy: true,
        trustedProxies: [] as readonly string[],
        authEnabled: true,
        authWindowMs: 1000,
        authMaxRequests: 2,
        authMessage: 'auth limit',
        authSessionReadEnabled: true,
        authSessionReadWindowMs: 1000,
        authSessionReadMaxRequests: 6,
        authSessionReadMessage: 'session limit',
        publicEnabled: true,
        publicWindowMs: 1000,
        publicMaxRequests: 50,
        publicMessage: 'public limit',
        adminEnabled: true,
        adminWindowMs: 1000,
        adminMaxRequests: 50,
        adminMessage: 'admin limit',
        protectedEnabled: true,
        protectedWindowMs: 1000,
        protectedMaxRequests: 50,
        protectedMessage: 'protected limit',
        webhookEnabled: true,
        webhookWindowMs: 1000,
        webhookMaxRequests: 50,
        webhookMessage: 'webhook limit',
        mcpWindowMs: 1000,
        mcpMaxRequests: 8,
        mcpMessage: 'mcp limit',
        oauthWindowMs: 1000,
        oauthMaxRequests: 5,
        oauthMessage: 'oauth limit',
        oauthRegisterWindowMs: 1000,
        oauthRegisterMaxRequests: 1,
        oauthRegisterMessage: 'register limit'
    });
    return { validateApiEnv: vi.fn(), env: mockEnv, getRateLimitConfig };
});

import { Hono } from 'hono';
import {
    clearRateLimitStore,
    getEndpointType,
    rateLimitMiddleware
} from '../../src/middlewares/rate-limit';

const IP = { 'X-Forwarded-For': '203.0.113.9' } as const;

const buildApp = (): Hono => {
    const app = new Hono();
    app.use('*', rateLimitMiddleware);
    app.all('*', (c) => c.json({ ok: true }));
    return app;
};

const hit = async ({
    app,
    path,
    method = 'POST'
}: {
    readonly app: Hono;
    readonly path: string;
    readonly method?: string;
}): Promise<number> => (await app.request(path, { method, headers: IP })).status;

describe('HOS-2184 rate-limit tiers for MCP and OAuth', () => {
    let app: Hono;

    beforeEach(async () => {
        await clearRateLimitStore();
        vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00.000Z').getTime(), toFake: ['Date'] });
        app = buildApp();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('classification', () => {
        it.each([
            ['/mcp', 'POST'],
            ['/mcp', 'GET'],
            ['/mcp', 'DELETE'],
            ['/.well-known/oauth-protected-resource/mcp', 'GET']
        ])('classifies %s %s as mcp', (path, method) => {
            expect(getEndpointType(path, method)).toBe('mcp');
        });

        it.each([
            '/api/auth/oauth2/token',
            '/api/auth/oauth2/revoke',
            '/api/auth/oauth2/introspect',
            '/api/auth/oauth2/token/'
        ])('classifies POST %s as oauth', (path) => {
            expect(getEndpointType(path, 'POST')).toBe('oauth');
        });

        it('classifies POST /api/auth/oauth2/register as oauth-register', () => {
            expect(getEndpointType('/api/auth/oauth2/register', 'POST')).toBe('oauth-register');
        });

        it.each([
            ['/api/auth/sign-in/email', 'POST'],
            ['/api/auth/sign-up/email', 'POST'],
            ['/api/auth/forget-password', 'POST'],
            ['/api/auth/reset-password', 'POST'],
            ['/api/auth/oauth2/authorize', 'GET'],
            ['/api/auth/oauth2/consent', 'POST'],
            ['/api/auth/oauth2/token', 'GET']
        ])('keeps %s %s in auth', (path, method) => {
            expect(getEndpointType(path, method)).toBe('auth');
        });

        it('does not treat a lookalike path as mcp', () => {
            expect(getEndpointType('/mcpx', 'POST')).toBe('general');
            expect(getEndpointType('/api/v1/public/mcp', 'GET')).toBe('public');
        });
    });

    describe('behaviour', () => {
        it('does not count /mcp against the general tier', async () => {
            // Arrange: the general budget is 3, the mcp ceiling is 8.
            const statuses: number[] = [];

            // Act
            for (let i = 0; i < 6; i++) statuses.push(await hit({ app, path: '/mcp' }));

            // Assert: 6 calls pass although general would have refused the 4th,
            // and the general bucket of the same IP is untouched.
            expect(statuses).toEqual([200, 200, 200, 200, 200, 200]);
            expect(await hit({ app, path: '/some/general/path', method: 'GET' })).toBe(200);
        });

        it('enforces the per-IP ceiling on /mcp', async () => {
            // Arrange
            for (let i = 0; i < 8; i++) expect(await hit({ app, path: '/mcp' })).toBe(200);

            // Act
            const res = await app.request('/mcp', { method: 'POST', headers: IP });

            // Assert
            expect(res.status).toBe(429);
            const body = (await res.json()) as { error: { message: string } };
            expect(body.error.message).toBe('mcp limit');
        });

        it('keeps the oauth tier separate from the auth (login) tier', async () => {
            // Arrange: exhaust the login budget (2).
            await hit({ app, path: '/api/auth/sign-in/email' });
            await hit({ app, path: '/api/auth/sign-in/email' });
            expect(await hit({ app, path: '/api/auth/sign-in/email' })).toBe(429);

            // Act + Assert: token calls from the same IP still pass, up to 5.
            for (let i = 0; i < 5; i++) {
                expect(await hit({ app, path: '/api/auth/oauth2/token' })).toBe(200);
            }
            expect(await hit({ app, path: '/api/auth/oauth2/token' })).toBe(429);
        });

        it('does not let token traffic spend the login budget', async () => {
            // Arrange
            for (let i = 0; i < 5; i++) await hit({ app, path: '/api/auth/oauth2/token' });

            // Act + Assert: login still has its full budget of 2.
            expect(await hit({ app, path: '/api/auth/sign-in/email' })).toBe(200);
            expect(await hit({ app, path: '/api/auth/sign-in/email' })).toBe(200);
            expect(await hit({ app, path: '/api/auth/sign-in/email' })).toBe(429);
        });

        it('shares one bucket between token, revoke and introspect', async () => {
            // Arrange
            await hit({ app, path: '/api/auth/oauth2/token' });
            await hit({ app, path: '/api/auth/oauth2/token' });
            await hit({ app, path: '/api/auth/oauth2/revoke' });
            await hit({ app, path: '/api/auth/oauth2/revoke' });
            await hit({ app, path: '/api/auth/oauth2/introspect' });

            // Act + Assert
            expect(await hit({ app, path: '/api/auth/oauth2/token' })).toBe(429);
        });

        it('keeps registration on its own stricter tier', async () => {
            // Arrange: register budget is 1.
            expect(await hit({ app, path: '/api/auth/oauth2/register' })).toBe(200);

            // Act
            const res = await app.request('/api/auth/oauth2/register', {
                method: 'POST',
                headers: IP
            });

            // Assert: second registration refused, token calls unaffected.
            expect(res.status).toBe(429);
            expect(((await res.json()) as { error: { message: string } }).error.message).toBe(
                'register limit'
            );
            expect(await hit({ app, path: '/api/auth/oauth2/token' })).toBe(200);
        });

        it('leaves the login tier unchanged (2 per window)', async () => {
            expect(await hit({ app, path: '/api/auth/sign-in/email' })).toBe(200);
            expect(await hit({ app, path: '/api/auth/sign-in/email' })).toBe(200);
            expect(await hit({ app, path: '/api/auth/sign-in/email' })).toBe(429);
        });
    });
});
