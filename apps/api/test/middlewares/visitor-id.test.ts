/**
 * Tests for the visitor-id Hono middleware (SPEC-184 follow-up).
 *
 * Exercises:
 * - No cookie present → generates one, sets it on the response, and
 *   populates the request-context store.
 * - Existing VALID cookie → reused as-is, no new Set-Cookie header, store
 *   still populated with the existing value.
 * - Existing MALFORMED/attacker-supplied cookie → rejected and regenerated
 *   (guards against unbounded/arbitrary values reaching stdout logs).
 * - Cookie attributes: HttpOnly, SameSite=Lax, no Max-Age/Expires
 *   (session-scoped), Path=/. Secure is prod-only (env-gated), so it is
 *   absent under NODE_ENV=test.
 */
import { Hono } from 'hono';
import { requestId } from 'hono/request-id';
import { describe, expect, it } from 'vitest';
import { getRequestContext } from '../../src/lib/request-context';
import { requestContextMiddleware } from '../../src/middlewares/request-context';
import { VISITOR_ID_COOKIE_NAME, visitorIdMiddleware } from '../../src/middlewares/visitor-id';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a minimal test app wiring requestContextMiddleware (required so
 * the ALS store exists) followed by visitorIdMiddleware, then a handler
 * that captures the store's visitorId.
 */
function buildApp(): { app: Hono; getCapturedVisitorId: () => string | undefined } {
    const app = new Hono();
    let capturedVisitorId: string | undefined;

    app.use(requestId());
    app.use(requestContextMiddleware());
    app.use(visitorIdMiddleware());

    app.get('/test', (c) => {
        capturedVisitorId = getRequestContext()?.visitorId;
        return c.json({ ok: true });
    });

    return { app, getCapturedVisitorId: () => capturedVisitorId };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('visitorIdMiddleware', () => {
    describe('no cookie present', () => {
        it('should generate a new visitor id and set it as a cookie', async () => {
            // Arrange
            const { app } = buildApp();

            // Act
            const res = await app.request('/test');

            // Assert
            const setCookieHeader = res.headers.get('set-cookie');
            expect(setCookieHeader).toBeTruthy();
            expect(setCookieHeader).toContain(`${VISITOR_ID_COOKIE_NAME}=`);
        });

        it('should populate the request-context store with the generated id', async () => {
            // Arrange
            const { app, getCapturedVisitorId } = buildApp();

            // Act
            await app.request('/test');

            // Assert
            expect(getCapturedVisitorId()).toBeDefined();
            expect(typeof getCapturedVisitorId()).toBe('string');
            // crypto.randomUUID() format
            expect(getCapturedVisitorId()).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            );
        });

        it('should generate a different id on each cookie-less request', async () => {
            // Arrange
            const { app, getCapturedVisitorId } = buildApp();

            // Act
            await app.request('/test');
            const first = getCapturedVisitorId();
            await app.request('/test');
            const second = getCapturedVisitorId();

            // Assert
            expect(first).not.toBe(second);
        });
    });

    describe('existing cookie present', () => {
        it('should reuse an existing VALID visitor id without overwriting it', async () => {
            // Arrange
            const { app, getCapturedVisitorId } = buildApp();
            // A well-formed UUID v4 (the shape this server mints).
            const existingId = '11111111-1111-4111-8111-111111111111';

            // Act
            const res = await app.request('/test', {
                headers: { cookie: `${VISITOR_ID_COOKIE_NAME}=${existingId}` }
            });

            // Assert — store reflects the existing cookie value
            expect(getCapturedVisitorId()).toBe(existingId);
            // No new cookie is set when a valid one already exists
            expect(res.headers.get('set-cookie')).toBeNull();
        });
    });

    describe('malformed / attacker-supplied cookie', () => {
        it.each([
            ['non-uuid garbage', 'not-a-uuid'],
            ['empty value', ''],
            ['oversized string', 'x'.repeat(4096)],
            ['control characters', 'aaaa\r\nbbbb'],
            ['uuid with wrong version nibble', '11111111-1111-1111-8111-111111111111']
        ])('should reject a %s cookie and regenerate a fresh valid id', async (_label, badValue) => {
            // Arrange
            const { app, getCapturedVisitorId } = buildApp();

            // Act
            const res = await app.request('/test', {
                headers: { cookie: `${VISITOR_ID_COOKIE_NAME}=${encodeURIComponent(badValue)}` }
            });

            // Assert — the bad value never reaches the store
            const captured = getCapturedVisitorId();
            expect(captured).not.toBe(badValue);
            // A fresh well-formed UUID v4 is minted instead
            expect(captured).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
            );
            // And a replacement cookie is set on the response
            expect(res.headers.get('set-cookie')).toContain(`${VISITOR_ID_COOKIE_NAME}=`);
        });
    });

    describe('downstream Set-Cookie preservation (Better Auth regression)', () => {
        it('should not drop a handler-issued Set-Cookie when it returns its own Response', async () => {
            // Arrange — a handler that returns a FRESH Response carrying its own
            // Set-Cookie, exactly like Better Auth's `return auth.handler(...)`
            // in routes/auth/handler.ts. Writing the visitor cookie BEFORE
            // next() used to attach it to a c.res this Response then replaced,
            // corrupting the session cookie and 401-ing every protected route.
            const app = new Hono();
            app.use(requestId());
            app.use(requestContextMiddleware());
            app.use(visitorIdMiddleware());
            app.get(
                '/login',
                () =>
                    new Response('ok', {
                        headers: {
                            'set-cookie': 'better-auth.session_token=abc123; Path=/; HttpOnly'
                        }
                    })
            );

            // Act
            const res = await app.request('/login');

            // Assert — BOTH cookies survive on the final response
            const setCookies = res.headers.getSetCookie();
            const joined = setCookies.join(' || ');
            expect(joined).toContain('better-auth.session_token=abc123');
            expect(joined).toContain(`${VISITOR_ID_COOKIE_NAME}=`);
        });
    });

    describe('cookie attributes', () => {
        it('should set HttpOnly, SameSite=Lax, Path=/, and no Max-Age/Expires', async () => {
            // Arrange
            const { app } = buildApp();

            // Act
            const res = await app.request('/test');
            const setCookieHeader = res.headers.get('set-cookie') ?? '';

            // Assert
            expect(setCookieHeader).toMatch(/HttpOnly/i);
            expect(setCookieHeader).toMatch(/SameSite=Lax/i);
            expect(setCookieHeader).toMatch(/Path=\//i);
            // Session-scoped: must NOT carry an expiry
            expect(setCookieHeader).not.toMatch(/Max-Age/i);
            expect(setCookieHeader).not.toMatch(/Expires/i);
            // Secure is prod-only (env-gated), so under NODE_ENV=test the cookie
            // is issued WITHOUT it — otherwise local HTTP dev would drop it.
            expect(setCookieHeader).not.toMatch(/Secure/i);
        });
    });
});
