/**
 * Unit tests for the public newsletter routes (verify + unsubscribe)
 * (SPEC-101 T-101-22 and T-101-23).
 *
 * These tests exercise the handlers indirectly via a real Hono router so
 * we cover the redirect status code, the locale resolution, and the
 * defensive query-parsing path. The HMAC secret is set in
 * apps/api/.env.local for local dev so the lazy singleton in
 * _singletons.ts can construct the real NewsletterSubscriberService.
 *
 * The service itself is mocked at the module boundary so we never hit
 * the database. The mock exposes the two methods we depend on
 * (`verifyToken`, `unsubscribeByToken`).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the lazy singleton BEFORE importing the routes module.
// ---------------------------------------------------------------------------

const mockVerifyToken = vi.fn();
const mockUnsubscribeByToken = vi.fn();

vi.mock('../../../src/routes/newsletter/protected/_singletons', () => ({
    getDefaultNewsletterService: vi.fn(() => ({
        verifyToken: mockVerifyToken,
        unsubscribeByToken: mockUnsubscribeByToken
    })),
    getDefaultUserService: vi.fn(() => ({})),
    _resetNewsletterRouteSingletons: vi.fn()
}));

// Stub `createPerRouteRateLimitMiddleware` to a no-op so tests don't hit
// Redis. Use `importOriginal` to preserve every other export of the module.
vi.mock('../../../src/middlewares/rate-limit', async (importOriginal) => {
    const original = await importOriginal<typeof import('../../../src/middlewares/rate-limit')>();
    return {
        ...original,
        createPerRouteRateLimitMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
            await next();
        }
    };
});

import { Hono } from 'hono';
import { newsletterPublicRoutes } from '../../../src/routes/newsletter/public';

function buildApp() {
    const app = new Hono();
    app.route('/api/v1/public/newsletter', newsletterPublicRoutes);
    return app;
}

// ---------------------------------------------------------------------------
// verify
// ---------------------------------------------------------------------------

beforeEach(() => {
    mockVerifyToken.mockReset();
    mockUnsubscribeByToken.mockReset();
});

describe('GET /api/v1/public/newsletter/verify', () => {
    it('redirects to the confirmado page on a valid token', async () => {
        mockVerifyToken.mockResolvedValue({
            data: { subscriberId: 's1', status: 'active' },
            error: null
        });
        const app = buildApp();

        const res = await app.request('/api/v1/public/newsletter/verify?token=goodtoken&locale=es');

        expect(res.status).toBe(302);
        expect(res.headers.get('location')).toMatch(/\/es\/newsletter\/confirmado\/$/);
    });

    it('falls back to es when locale query is missing or unsupported', async () => {
        mockVerifyToken.mockResolvedValue({
            data: { subscriberId: 's1', status: 'active' },
            error: null
        });
        const app = buildApp();

        const res = await app.request('/api/v1/public/newsletter/verify?token=goodtoken&locale=fr');

        expect(res.status).toBe(302);
        expect(res.headers.get('location')).toMatch(/\/es\/newsletter\/confirmado\/$/);
    });

    it('redirects to the error page with token_expired when the token is expired', async () => {
        mockVerifyToken.mockResolvedValue({
            data: null,
            error: { code: 'NEWSLETTER_TOKEN_EXPIRED', message: 'expired' }
        });
        const app = buildApp();

        const res = await app.request('/api/v1/public/newsletter/verify?token=expired');

        expect(res.status).toBe(302);
        expect(res.headers.get('location')).toMatch(/reason=token_expired/);
    });

    it('redirects to the error page with invalid_token for tampered tokens', async () => {
        mockVerifyToken.mockResolvedValue({
            data: null,
            error: { code: 'NEWSLETTER_TOKEN_INVALID', message: 'invalid' }
        });
        const app = buildApp();

        const res = await app.request('/api/v1/public/newsletter/verify?token=bad');

        expect(res.status).toBe(302);
        expect(res.headers.get('location')).toMatch(/reason=invalid_token/);
    });

    it('redirects to invalid_token when the query is missing the token entirely', async () => {
        const app = buildApp();

        const res = await app.request('/api/v1/public/newsletter/verify');

        expect(res.status).toBe(302);
        expect(res.headers.get('location')).toMatch(/reason=invalid_token/);
        expect(mockVerifyToken).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// unsubscribe
// ---------------------------------------------------------------------------

describe('GET /api/v1/public/newsletter/unsubscribe', () => {
    it('redirects to the desuscripto page on a valid token', async () => {
        mockUnsubscribeByToken.mockResolvedValue({
            data: { status: 'unsubscribed' },
            error: null
        });
        const app = buildApp();

        const res = await app.request(
            '/api/v1/public/newsletter/unsubscribe?token=goodtoken&locale=en'
        );

        expect(res.status).toBe(302);
        expect(res.headers.get('location')).toMatch(/\/en\/newsletter\/desuscripto\/$/);
    });

    it('is idempotent for already-unsubscribed rows (still redirects to desuscripto)', async () => {
        mockUnsubscribeByToken.mockResolvedValue({
            data: { status: 'already_unsubscribed' },
            error: null
        });
        const app = buildApp();

        const res = await app.request('/api/v1/public/newsletter/unsubscribe?token=goodtoken');

        expect(res.status).toBe(302);
        expect(res.headers.get('location')).toMatch(/\/es\/newsletter\/desuscripto\/$/);
    });

    it('redirects to invalid_token when the token is bad', async () => {
        mockUnsubscribeByToken.mockResolvedValue({
            data: null,
            error: { code: 'NEWSLETTER_TOKEN_INVALID', message: 'invalid' }
        });
        const app = buildApp();

        const res = await app.request('/api/v1/public/newsletter/unsubscribe?token=bad');

        expect(res.status).toBe(302);
        expect(res.headers.get('location')).toMatch(/reason=invalid_token/);
    });

    it('redirects to invalid_token when the query is missing the token entirely', async () => {
        const app = buildApp();

        const res = await app.request('/api/v1/public/newsletter/unsubscribe');

        expect(res.status).toBe(302);
        expect(res.headers.get('location')).toMatch(/reason=invalid_token/);
        expect(mockUnsubscribeByToken).not.toHaveBeenCalled();
    });
});
