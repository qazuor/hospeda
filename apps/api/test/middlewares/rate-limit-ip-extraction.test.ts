/**
 * Rate-Limit IP Extraction Tests (SPEC-110)
 *
 * Covers the trust-chain-validated `getClientIp` rewrite and the loopback healthcheck
 * bypass added in SPEC-110 to eliminate the shared `rl:general:unknown` bucket.
 */
import type { Context } from 'hono';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Enable rate limiting in this test file
process.env.HOSPEDA_TESTING_RATE_LIMIT = 'true';

vi.mock('../../src/utils/redis', () => ({
    getRedisClient: vi.fn().mockResolvedValue(undefined),
    disconnectRedis: vi.fn().mockResolvedValue(undefined),
    resetRedisState: vi.fn()
}));

// Mock env BEFORE importing the middleware so that env.ts is fully replaced.
const mockTrustedProxies: { value: readonly string[] } = { value: [] };
const mockTrustProxy: { value: boolean } = { value: true };

vi.mock('../../src/utils/env', () => {
    const mockEnv = {
        NODE_ENV: 'test',
        HOSPEDA_TESTING_RATE_LIMIT: true,
        HOSPEDA_REDIS_URL: undefined as string | undefined
    };

    const getRateLimitConfig = () => ({
        enabled: true,
        windowMs: 1000,
        maxRequests: 100,
        keyGenerator: 'ip',
        skip: 'none' as const,
        headers: 'legacy' as const,
        message: 'Too many requests',
        trustProxy: mockTrustProxy.value,
        trustedProxies: mockTrustedProxies.value,
        authEnabled: true,
        authWindowMs: 1000,
        authMaxRequests: 5,
        authMessage: 'Too many auth',
        publicEnabled: true,
        publicWindowMs: 1000,
        publicMaxRequests: 10,
        publicMessage: 'Too many public',
        adminEnabled: true,
        adminWindowMs: 1000,
        adminMaxRequests: 5,
        adminMessage: 'Too many admin',
        billingEnabled: true,
        billingWindowMs: 1000,
        billingMaxRequests: 2,
        billingMessage: 'Too many billing',
        webhookEnabled: true,
        webhookWindowMs: 1000,
        webhookMaxRequests: 8,
        webhookMessage: 'Too many webhook'
    });

    return {
        validateApiEnv: vi.fn(),
        env: mockEnv,
        getRateLimitConfig
    };
});

import {
    clearRateLimitStore,
    getClientIp,
    isLoopbackIp,
    isPrivateIp,
    rateLimitMiddleware,
    resetRateLimitStore
} from '../../src/middlewares/rate-limit';

beforeEach(async () => {
    await clearRateLimitStore();
    resetRateLimitStore();
    mockTrustedProxies.value = [];
    mockTrustProxy.value = true;
});

afterEach(async () => {
    await clearRateLimitStore();
});

// ── Test helper: fake Hono context ────────────────────────────────────────────

interface FakeContextOpts {
    readonly socketIp?: string;
    readonly headers?: Record<string, string>;
}

/**
 * Builds a minimal Hono Context double sufficient for `getClientIp`.
 * `c.req.header(name)` returns the matching header (case-insensitive lookup).
 * `c.req.raw.socket.remoteAddress` is set when `socketIp` is provided.
 */
const makeContext = ({ socketIp, headers = {} }: FakeContextOpts): Context => {
    const lowerHeaders = Object.fromEntries(
        Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
    );
    const raw = socketIp ? { socket: { remoteAddress: socketIp } } : {};
    return {
        req: {
            raw,
            header: (name: string): string | undefined => lowerHeaders[name.toLowerCase()]
        }
    } as unknown as Context;
};

// ─── isLoopbackIp ─────────────────────────────────────────────────────────────

describe('isLoopbackIp', () => {
    it.each(['127.0.0.1', '127.1.2.3', '127.255.255.255', '::1', '::ffff:127.0.0.1'])(
        'returns true for loopback %s',
        (ip) => {
            expect(isLoopbackIp(ip)).toBe(true);
        }
    );

    it.each(['10.0.0.1', '172.16.0.1', '192.168.1.1', '8.8.8.8', '::', '2001:db8::1'])(
        'returns false for non-loopback %s',
        (ip) => {
            expect(isLoopbackIp(ip)).toBe(false);
        }
    );
});

// ─── isPrivateIp ──────────────────────────────────────────────────────────────

describe('isPrivateIp', () => {
    it.each([
        '10.0.0.1',
        '10.255.255.255',
        '172.16.0.1',
        '172.31.255.255',
        '192.168.0.1',
        '192.168.255.255',
        '::ffff:10.0.0.1',
        '::ffff:172.20.0.5',
        '::ffff:192.168.1.1',
        'fc00::1',
        'fd12:3456::1'
    ])('returns true for private %s', (ip) => {
        expect(isPrivateIp(ip)).toBe(true);
    });

    it.each([
        '8.8.8.8',
        '1.1.1.1',
        '172.15.0.1', // just outside RFC1918 172.16-31
        '172.32.0.1', // just outside RFC1918 172.16-31
        '172.0.0.1',
        '127.0.0.1', // loopback, not RFC1918
        '2001:db8::1', // documentation IPv6
        '::1' // loopback IPv6
    ])('returns false for non-private %s', (ip) => {
        expect(isPrivateIp(ip)).toBe(false);
    });
});

// ─── getClientIp ──────────────────────────────────────────────────────────────

describe('getClientIp — trust chain', () => {
    describe('loopback source (Docker healthcheck)', () => {
        it('returns internal:<ip> for socket 127.0.0.1 regardless of headers', () => {
            const c = makeContext({
                socketIp: '127.0.0.1',
                headers: { 'cf-connecting-ip': '1.2.3.4' }
            });
            expect(getClientIp({ c })).toBe('internal:127.0.0.1');
        });

        it('returns internal:::1 for IPv6 loopback', () => {
            const c = makeContext({ socketIp: '::1' });
            expect(getClientIp({ c })).toBe('internal:::1');
        });
    });

    describe('trusted source (RFC1918 reverse proxy)', () => {
        it('reads cf-connecting-ip when socket is RFC1918', () => {
            const c = makeContext({
                socketIp: '172.20.0.5',
                headers: { 'cf-connecting-ip': '203.0.113.10' }
            });
            expect(getClientIp({ c })).toBe('203.0.113.10');
        });

        it('reads first hop of x-forwarded-for when cf header missing', () => {
            const c = makeContext({
                socketIp: '10.0.0.5',
                headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.5' }
            });
            expect(getClientIp({ c })).toBe('203.0.113.10');
        });

        it('reads x-real-ip when cf and xff are missing', () => {
            const c = makeContext({
                socketIp: '192.168.1.5',
                headers: { 'x-real-ip': '203.0.113.11' }
            });
            expect(getClientIp({ c })).toBe('203.0.113.11');
        });

        it('prefers cf-connecting-ip over x-forwarded-for and x-real-ip', () => {
            const c = makeContext({
                socketIp: '10.0.0.5',
                headers: {
                    'cf-connecting-ip': '1.1.1.1',
                    'x-forwarded-for': '2.2.2.2',
                    'x-real-ip': '3.3.3.3'
                }
            });
            expect(getClientIp({ c })).toBe('1.1.1.1');
        });

        it('returns proxy:<socket-ip> when trusted upstream has no proxy headers', () => {
            const c = makeContext({ socketIp: '10.0.0.5' });
            expect(getClientIp({ c })).toBe('proxy:10.0.0.5');
        });
    });

    describe('untrusted source (anti-spoof)', () => {
        it('IGNORES cf-connecting-ip when socket is public IP (spoof prevention)', () => {
            const c = makeContext({
                socketIp: '5.6.7.8',
                headers: { 'cf-connecting-ip': '1.1.1.1' }
            });
            expect(getClientIp({ c })).toBe('untrusted:5.6.7.8');
        });

        it('IGNORES x-forwarded-for when socket is public IP', () => {
            const c = makeContext({
                socketIp: '5.6.7.8',
                headers: { 'x-forwarded-for': '1.1.1.1, 2.2.2.2' }
            });
            expect(getClientIp({ c })).toBe('untrusted:5.6.7.8');
        });

        it('returns untrusted:<socket-ip> with no headers', () => {
            const c = makeContext({ socketIp: '5.6.7.8' });
            expect(getClientIp({ c })).toBe('untrusted:5.6.7.8');
        });

        it('trusts an explicit proxy IP from API_RATE_LIMIT_TRUSTED_PROXIES', () => {
            mockTrustedProxies.value = ['5.6.7.8'];
            const c = makeContext({
                socketIp: '5.6.7.8',
                headers: { 'cf-connecting-ip': '203.0.113.99' }
            });
            expect(getClientIp({ c })).toBe('203.0.113.99');
        });
    });

    describe('no socket available (tests, edge runtimes)', () => {
        it('falls back to header-based extraction when no socket', () => {
            const c = makeContext({ headers: { 'cf-connecting-ip': '1.2.3.4' } });
            expect(getClientIp({ c })).toBe('1.2.3.4');
        });

        it('returns "unknown" when neither socket nor headers are present', () => {
            const c = makeContext({});
            expect(getClientIp({ c })).toBe('unknown');
        });

        it('honors x-forwarded-for first hop when no socket', () => {
            const c = makeContext({
                headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' }
            });
            expect(getClientIp({ c })).toBe('203.0.113.5');
        });
    });

    describe('trustProxy=false', () => {
        beforeEach(() => {
            mockTrustProxy.value = false;
        });

        it('uses socket IP directly when trustProxy is disabled', () => {
            const c = makeContext({
                socketIp: '5.6.7.8',
                headers: { 'cf-connecting-ip': '1.1.1.1' }
            });
            expect(getClientIp({ c })).toBe('5.6.7.8');
        });

        it('falls back to headers when trustProxy is false and no socket', () => {
            const c = makeContext({ headers: { 'cf-connecting-ip': '1.1.1.1' } });
            expect(getClientIp({ c })).toBe('1.1.1.1');
        });
    });
});

// ─── Healthcheck bypass (A) ───────────────────────────────────────────────────

describe('rateLimitMiddleware — healthcheck bypass', () => {
    /**
     * Builds a Hono app that injects a fake socket onto c.req.raw before the
     * rate-limit middleware runs. This emulates what `@hono/node-server` does
     * in production.
     */
    const buildApp = (socketIp: string): Hono => {
        const app = new Hono();
        app.use('*', async (c, next) => {
            (c.req.raw as unknown as { socket: { remoteAddress: string } }).socket = {
                remoteAddress: socketIp
            };
            await next();
        });
        app.use('*', rateLimitMiddleware);
        app.get('/', (c) => c.text('ok'));
        app.get('/health', (c) => c.text('ok'));
        app.get('/api/v1/public/foo', (c) => c.text('ok'));
        return app;
    };

    it('bypasses rate limit for loopback + healthcheck path (/)', async () => {
        const app = buildApp('127.0.0.1');
        // Send way more than the general bucket allows; none should 429.
        for (let i = 0; i < 200; i++) {
            const res = await app.request('/');
            expect(res.status).toBe(200);
        }
    });

    it('bypasses rate limit for loopback + /health', async () => {
        const app = buildApp('127.0.0.1');
        for (let i = 0; i < 200; i++) {
            const res = await app.request('/health');
            expect(res.status).toBe(200);
        }
    });

    it('does NOT bypass for loopback + non-healthcheck path', async () => {
        const app = buildApp('127.0.0.1');
        // public limit is 10; the 11th should 429
        let saw429 = false;
        for (let i = 0; i < 30; i++) {
            const res = await app.request('/api/v1/public/foo');
            if (res.status === 429) {
                saw429 = true;
                break;
            }
        }
        expect(saw429).toBe(true);
    });

    it('does NOT bypass for non-loopback source even on healthcheck path', async () => {
        // Untrusted external IP hitting / would burn the general bucket.
        // It should rate-limit normally (not bypass) so it cannot hide behind the path.
        const app = buildApp('5.6.7.8');
        let saw429 = false;
        for (let i = 0; i < 200; i++) {
            const res = await app.request('/');
            if (res.status === 429) {
                saw429 = true;
                break;
            }
        }
        expect(saw429).toBe(true);
    });
});
