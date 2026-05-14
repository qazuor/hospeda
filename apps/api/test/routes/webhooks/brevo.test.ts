/**
 * Unit tests for the Brevo webhook receiver (SPEC-101 T-101-32).
 *
 * The NewsletterTrackingService is mocked at the constructor boundary so
 * the test never touches the DB.
 *
 * `HOSPEDA_BREVO_WEBHOOK_SECRET` is configured via vi.stubEnv so the
 * timingSafeEqual comparison has a real secret to verify against.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (declare BEFORE importing the route)
// ---------------------------------------------------------------------------

const mockProcessEvent = vi.fn();

vi.mock('@repo/service-core', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...original,
        NewsletterTrackingService: vi.fn().mockImplementation(() => ({
            processBrevoWebhookEvent: mockProcessEvent
        }))
    };
});

vi.mock('../../../src/middlewares/rate-limit', async (importOriginal) => {
    const original = await importOriginal<typeof import('../../../src/middlewares/rate-limit')>();
    return {
        ...original,
        createPerRouteRateLimitMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
            await next();
        }
    };
});

// Mock the env module — vi.stubEnv doesn't reach our parsed Zod env object.
// Use importOriginal so every other export (validateApiEnv, getEnv, etc.) is
// preserved; only the `env` constant is overridden with our test fixture.
vi.mock('../../../src/utils/env', async (importOriginal) => {
    const original = await importOriginal<typeof import('../../../src/utils/env')>();
    return {
        ...original,
        env: {
            ...original.env,
            HOSPEDA_BREVO_WEBHOOK_SECRET: 'test-brevo-secret-value'
        }
    };
});

import { Hono } from 'hono';
import { _resetBrevoWebhookCache, brevoWebhookRoutes } from '../../../src/routes/webhooks/brevo';

function buildApp() {
    const app = new Hono();
    app.route('/api/v1/public/webhooks', brevoWebhookRoutes);
    return app;
}

const VALID_TOKEN = 'test-brevo-secret-value';

beforeEach(() => {
    mockProcessEvent.mockReset();
    _resetBrevoWebhookCache();
});

afterEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

describe('POST /api/v1/public/webhooks/brevo/:token — signature', () => {
    it('returns 404 when no token segment is present in the URL', async () => {
        // The route requires a :token path param, so an unsuffixed POST
        // does not match — Hono returns 404. This is intentional: random
        // scanners hitting /brevo without the secret should not even know
        // the endpoint exists.
        const app = buildApp();
        const res = await app.request('/api/v1/public/webhooks/brevo', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ event: 'delivered', email: 'a@b.com' })
        });
        expect(res.status).toBe(404);
        expect(mockProcessEvent).not.toHaveBeenCalled();
    });

    it('returns 401 invalid_signature when the token in the path does not match', async () => {
        const app = buildApp();
        const res = await app.request('/api/v1/public/webhooks/brevo/wrong-token', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ event: 'delivered', email: 'a@b.com' })
        });
        expect(res.status).toBe(401);
        const body = (await res.json()) as { error: string };
        expect(body.error).toBe('invalid_signature');
        expect(mockProcessEvent).not.toHaveBeenCalled();
    });

    it('accepts a request with the correct token', async () => {
        mockProcessEvent.mockResolvedValue({ data: { updated: true }, error: null });
        const app = buildApp();
        const res = await app.request(`/api/v1/public/webhooks/brevo/${VALID_TOKEN}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                event: 'delivered',
                email: 'sub@example.com',
                'message-id': '<abc@brevo>'
            })
        });
        expect(res.status).toBe(200);
        const body = (await res.json()) as { ok: boolean; processed: number };
        expect(body.ok).toBe(true);
        expect(body.processed).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// Event dispatch
// ---------------------------------------------------------------------------

describe('POST /api/v1/public/webhooks/brevo/:token — event dispatch', () => {
    it('forwards a single event to the tracking service with the right shape', async () => {
        mockProcessEvent.mockResolvedValue({ data: { updated: true }, error: null });
        const app = buildApp();

        await app.request(`/api/v1/public/webhooks/brevo/${VALID_TOKEN}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                event: 'opened',
                email: 'sub@example.com',
                'message-id': '<abc@brevo>',
                date: '2026-05-12T15:00:00.000Z'
            })
        });

        expect(mockProcessEvent).toHaveBeenCalledTimes(1);
        const [arg] = mockProcessEvent.mock.calls[0] ?? [];
        expect(arg).toMatchObject({
            event: 'opened',
            email: 'sub@example.com',
            messageId: '<abc@brevo>'
        });
    });

    it('accepts an array body and dispatches one call per matching event', async () => {
        mockProcessEvent.mockResolvedValue({ data: { updated: true }, error: null });
        const app = buildApp();

        const res = await app.request(`/api/v1/public/webhooks/brevo/${VALID_TOKEN}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify([
                { event: 'delivered', email: 'a@b.com', 'message-id': '<m1>' },
                { event: 'opened', email: 'a@b.com', 'message-id': '<m1>' },
                { event: 'click', email: 'a@b.com', 'message-id': '<m1>' }
            ])
        });

        expect(res.status).toBe(200);
        expect(mockProcessEvent).toHaveBeenCalledTimes(3);
    });

    it('silently skips events outside the whitelist (e.g. proxy_open)', async () => {
        mockProcessEvent.mockResolvedValue({ data: { updated: true }, error: null });
        const app = buildApp();

        const res = await app.request(`/api/v1/public/webhooks/brevo/${VALID_TOKEN}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify([
                { event: 'proxy_open', email: 'a@b.com' },
                { event: 'request', email: 'a@b.com' }
            ])
        });

        expect(res.status).toBe(200);
        const body = (await res.json()) as { processed: number; skipped: number };
        expect(body.processed).toBe(0);
        expect(body.skipped).toBe(2);
        expect(mockProcessEvent).not.toHaveBeenCalled();
    });

    it('returns 400 invalid_payload when the body is not parseable JSON', async () => {
        const app = buildApp();
        const res = await app.request(`/api/v1/public/webhooks/brevo/${VALID_TOKEN}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: 'not json'
        });
        expect(res.status).toBe(400);
        const body = (await res.json()) as { error: string };
        expect(body.error).toBe('invalid_payload');
    });

    it('returns 200 with skipped count when a single event throws inside the service', async () => {
        mockProcessEvent.mockRejectedValueOnce(new Error('boom'));
        mockProcessEvent.mockResolvedValueOnce({
            data: { updated: true },
            error: null
        });
        const app = buildApp();

        const res = await app.request(`/api/v1/public/webhooks/brevo/${VALID_TOKEN}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify([
                { event: 'delivered', email: 'a@b.com', 'message-id': '<m1>' },
                { event: 'opened', email: 'a@b.com', 'message-id': '<m1>' }
            ])
        });

        expect(res.status).toBe(200);
        const body = (await res.json()) as { processed: number; skipped: number };
        expect(body.processed).toBe(1);
        expect(body.skipped).toBe(1);
    });
});
