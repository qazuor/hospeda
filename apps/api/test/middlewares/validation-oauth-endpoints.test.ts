/**
 * HOS-2184 T-029 regression: the OAuth token endpoint must not be refused by
 * the API's generic request validation.
 *
 * RFC 6749 section 3.2 makes `/oauth2/token` (and RFC 7009 / RFC 7662 for
 * `/oauth2/revoke` and `/oauth2/introspect`) take
 * `application/x-www-form-urlencoded`. The generic validator only allows JSON
 * and multipart, and requires a `User-Agent`, so every client's code exchange
 * answered 400 `INVALID_CONTENT_TYPE` before reaching Better Auth. Found by the
 * end-to-end OAuth test (`routes/mcp/mcp-oauth-end-to-end.test.ts`).
 */

import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { createValidationMiddleware } from '../../src/middlewares/validation';

vi.mock('../../src/middlewares/sanitization', () => ({
    sanitizeHeaders: vi.fn((headers) => headers),
    sanitizeObjectStrings: vi.fn((obj) => obj),
    sanitizeQueryParams: vi.fn((params) => params)
}));

const FORM = 'application/x-www-form-urlencoded';

function buildApp(): Hono {
    const app = new Hono();
    app.use(createValidationMiddleware());
    app.all('*', (c) => c.json({ reached: true }));
    return app;
}

describe('validation middleware on the OAuth machine endpoints', () => {
    it.each([
        '/api/auth/oauth2/token',
        '/api/auth/oauth2/revoke',
        '/api/auth/oauth2/introspect'
    ])('lets a form-encoded POST without a User-Agent through to %s', async (path) => {
        // Arrange
        const app = buildApp();

        // Act
        const res = await app.request(path, {
            method: 'POST',
            headers: { 'content-type': FORM },
            body: new URLSearchParams({ grant_type: 'authorization_code' })
        });

        // Assert
        expect(res.status).toBe(200);
    });

    it('lets a dynamic client registration without a User-Agent through', async () => {
        // Arrange
        const app = buildApp();

        // Act
        const res = await app.request('/api/auth/oauth2/register', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ redirect_uris: ['https://claude.ai/api/mcp/auth_callback'] })
        });

        // Assert
        expect(res.status).toBe(200);
    });

    it('still refuses a form-encoded POST to any other auth route', async () => {
        // Arrange
        const app = buildApp();

        // Act
        const res = await app.request('/api/auth/sign-in/email', {
            method: 'POST',
            headers: { 'content-type': FORM, 'user-agent': 'vitest' },
            body: new URLSearchParams({ email: 'a@b.co' })
        });

        // Assert
        expect(res.status).toBe(400);
    });

    it('does not widen the exemption to a lookalike path', async () => {
        // Arrange
        const app = buildApp();

        // Act
        const res = await app.request('/api/auth/oauth2/token/extra', {
            method: 'POST',
            headers: { 'content-type': FORM },
            body: new URLSearchParams({ a: 'b' })
        });

        // Assert
        expect(res.status).toBe(400);
    });
});
