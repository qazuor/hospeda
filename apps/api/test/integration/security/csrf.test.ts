/**
 * CSRF / Origin verification middleware tests (SPEC-092 T-086).
 *
 * Hospeda's API does NOT use traditional cookie-based CSRF tokens because
 * authentication uses Bearer tokens that are NOT auto-sent by browsers.
 * Instead, defense-in-depth comes from `originVerificationMiddleware`
 * which validates the `Origin` or `Referer` header on mutating requests
 * (POST/PUT/PATCH/DELETE) against the configured CORS origins.
 *
 * These tests cover the integration points spec.md SPEC-092 calls out
 * under "Integration test: CSRF on mutations".
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/utils/env', () => {
    const mockEnv = {
        NODE_ENV: 'test',
        API_SECURITY_ENABLED: true,
        HOSPEDA_TESTING_ORIGIN_VERIFICATION: true,
        HOSPEDA_SITE_URL: 'https://hospeda.com.ar',
        HOSPEDA_ADMIN_URL: 'https://admin.hospeda.com.ar',
        API_SECURITY_HEADERS_ENABLED: false
    };
    return {
        validateApiEnv: vi.fn(),
        env: mockEnv,
        getSecurityConfig: () => ({ enabled: true }),
        getCorsConfig: () => ({
            origins: ['https://hospeda.com.ar', 'https://admin.hospeda.com.ar', '*.hospeda.com.ar']
        })
    };
});

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

const { originVerificationMiddleware } = await import('../../../src/middlewares/security');

function buildApp(): Hono {
    const app = new Hono();
    app.use('*', originVerificationMiddleware);
    app.get('/resource', (c) => c.json({ method: 'GET', ok: true }));
    app.post('/resource', (c) => c.json({ method: 'POST', ok: true }));
    app.put('/resource', (c) => c.json({ method: 'PUT', ok: true }));
    app.patch('/resource', (c) => c.json({ method: 'PATCH', ok: true }));
    app.delete('/resource', (c) => c.json({ method: 'DELETE', ok: true }));
    return app;
}

describe('CSRF / origin verification — read methods', () => {
    let app: Hono;

    beforeEach(() => {
        app = buildApp();
    });

    it('allows GET without any origin header', async () => {
        const response = await app.request('/resource');
        expect(response.status).toBe(200);
    });

    it('allows GET with foreign origin header (read-only is not protected)', async () => {
        const response = await app.request('/resource', {
            headers: { origin: 'https://attacker.example.com' }
        });
        expect(response.status).toBe(200);
    });
});

describe('CSRF / origin verification — mutation methods', () => {
    let app: Hono;

    beforeEach(() => {
        app = buildApp();
    });

    it.each(['POST', 'PUT', 'PATCH', 'DELETE'] as const)(
        'allows %s with Origin matching configured CORS origin',
        async (method) => {
            const response = await app.request('/resource', {
                method,
                headers: {
                    origin: 'https://hospeda.com.ar',
                    'content-type': 'application/json'
                },
                body: method === 'DELETE' ? undefined : JSON.stringify({})
            });
            expect(response.status).toBe(200);
        }
    );

    it.each(['POST', 'PUT', 'PATCH', 'DELETE'] as const)(
        'rejects %s with foreign Origin (403 ORIGIN_NOT_ALLOWED)',
        async (method) => {
            const response = await app.request('/resource', {
                method,
                headers: {
                    origin: 'https://attacker.example.com',
                    'content-type': 'application/json'
                },
                body: method === 'DELETE' ? undefined : JSON.stringify({})
            });
            expect(response.status).toBe(403);
            const body = await response.json();
            expect(body).toMatchObject({
                success: false,
                error: { code: 'ORIGIN_NOT_ALLOWED' }
            });
        }
    );

    it('falls back to Referer header when Origin is missing', async () => {
        const response = await app.request('/resource', {
            method: 'POST',
            headers: {
                referer: 'https://hospeda.com.ar/some/page',
                'content-type': 'application/json'
            },
            body: JSON.stringify({})
        });
        expect(response.status).toBe(200);
    });

    it('rejects when Referer points to a foreign origin', async () => {
        const response = await app.request('/resource', {
            method: 'POST',
            headers: {
                referer: 'https://attacker.example.com/page',
                'content-type': 'application/json'
            },
            body: JSON.stringify({})
        });
        expect(response.status).toBe(403);
    });

    it('treats malformed Referer as missing (allows request through)', async () => {
        const response = await app.request('/resource', {
            method: 'POST',
            headers: {
                referer: 'not-a-valid-url',
                'content-type': 'application/json'
            },
            body: JSON.stringify({})
        });
        // Malformed referer → no usable origin → request goes through
        // (we don't know it was a browser cross-origin; allow it)
        expect(response.status).toBe(200);
    });

    it('allows requests with no Origin and no Referer (non-browser clients)', async () => {
        const response = await app.request('/resource', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({})
        });
        expect(response.status).toBe(200);
    });

    it('honors wildcard subdomain matching (*.hospeda.com.ar)', async () => {
        const response = await app.request('/resource', {
            method: 'POST',
            headers: {
                origin: 'https://staging.hospeda.com.ar',
                'content-type': 'application/json'
            },
            body: JSON.stringify({})
        });
        expect(response.status).toBe(200);
    });

    it('rejects sibling domain attack against wildcard subdomain', async () => {
        // *.hospeda.com.ar must NOT match evil-hospeda.com.ar
        const response = await app.request('/resource', {
            method: 'POST',
            headers: {
                origin: 'https://evil-hospeda.com.ar',
                'content-type': 'application/json'
            },
            body: JSON.stringify({})
        });
        expect(response.status).toBe(403);
    });
});
