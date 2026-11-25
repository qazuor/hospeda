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
    it('redirects to the web confirmation page and never unsubscribes', async () => {
        const app = buildApp();

        const res = await app.request(
            '/api/v1/public/newsletter/unsubscribe?token=goodtoken&locale=en'
        );

        expect(res.status).toBe(302);
        expect(res.headers.get('location')).toMatch(
            /\/en\/newsletter\/unsubscribe\/\?token=goodtoken$/
        );
        expect(mockUnsubscribeByToken).not.toHaveBeenCalled();
    });

    it('falls back to es and still does not unsubscribe', async () => {
        const app = buildApp();

        const res = await app.request('/api/v1/public/newsletter/unsubscribe?token=t&locale=fr');

        expect(res.headers.get('location')).toMatch(/\/es\/newsletter\/unsubscribe\/\?token=t$/);
        expect(mockUnsubscribeByToken).not.toHaveBeenCalled();
    });

    it('redirects to the page without a token when the query has none', async () => {
        const app = buildApp();

        const res = await app.request('/api/v1/public/newsletter/unsubscribe');

        expect(res.status).toBe(302);
        expect(res.headers.get('location')).toMatch(/\/es\/newsletter\/unsubscribe\/$/);
        expect(mockUnsubscribeByToken).not.toHaveBeenCalled();
    });
});

describe('POST /api/v1/public/newsletter/unsubscribe', () => {
    const post = (init: RequestInit, query = '') =>
        buildApp().request(`/api/v1/public/newsletter/unsubscribe${query}`, {
            method: 'POST',
            ...init
        });

    it('unsubscribes with the token in the JSON body', async () => {
        mockUnsubscribeByToken.mockResolvedValue({ data: { status: 'unsubscribed' }, error: null });

        const res = await post({
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ token: 'goodtoken' })
        });

        expect(res.status).toBe(200);
        const json = (await res.json()) as { success: boolean; data: { status: string } };
        expect(json.success).toBe(true);
        expect(json.data.status).toBe('unsubscribed');
        expect(mockUnsubscribeByToken).toHaveBeenCalledWith('goodtoken');
    });

    it('supports RFC 8058 one-click (form body, token in the query)', async () => {
        mockUnsubscribeByToken.mockResolvedValue({
            data: { status: 'already_unsubscribed' },
            error: null
        });

        const res = await post(
            {
                headers: { 'content-type': 'application/x-www-form-urlencoded' },
                body: 'List-Unsubscribe=One-Click'
            },
            '?token=qtoken'
        );

        expect(res.status).toBe(200);
        expect(mockUnsubscribeByToken).toHaveBeenCalledWith('qtoken');
    });

    it('answers 400 VALIDATION_ERROR when there is no token', async () => {
        const res = await post({
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({})
        });

        expect(res.status).toBe(400);
        const json = (await res.json()) as { error: { code: string } };
        expect(json.error.code).toBe('VALIDATION_ERROR');
        expect(mockUnsubscribeByToken).not.toHaveBeenCalled();
    });

    it('answers 401 UNAUTHORIZED for a tampered token', async () => {
        mockUnsubscribeByToken.mockResolvedValue({
            data: null,
            error: { code: 'UNAUTHORIZED', reason: 'NEWSLETTER_TOKEN_INVALID', message: 'invalid' }
        });

        const res = await post({
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ token: 'bad' })
        });

        expect(res.status).toBe(401);
        const json = (await res.json()) as { error: { code: string; reason: string } };
        expect(json.error.code).toBe('UNAUTHORIZED');
        expect(json.error.reason).toBe('NEWSLETTER_TOKEN_INVALID');
    });

    it('answers 401 with the expired reason for an expired token', async () => {
        mockUnsubscribeByToken.mockResolvedValue({
            data: null,
            error: { code: 'UNAUTHORIZED', reason: 'NEWSLETTER_TOKEN_EXPIRED', message: 'expired' }
        });

        const res = await post({
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ token: 'old' })
        });

        expect(res.status).toBe(401);
        const json = (await res.json()) as { error: { reason: string } };
        expect(json.error.reason).toBe('NEWSLETTER_TOKEN_EXPIRED');
    });

    it('answers 404 NOT_FOUND when the subscriber no longer exists', async () => {
        mockUnsubscribeByToken.mockResolvedValue({
            data: null,
            error: { code: 'NOT_FOUND', reason: 'NEWSLETTER_SUBSCRIBER_NOT_FOUND', message: 'x' }
        });

        const res = await post({
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ token: 'orphan' })
        });

        expect(res.status).toBe(404);
    });
});
