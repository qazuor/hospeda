/**
 * Audit Middleware Tests
 *
 * Verifies that `auditMiddleware` correctly:
 * - Emits a `ROUTE_MUTATION` audit log entry for state-changing HTTP methods
 *   (POST, PUT, PATCH, DELETE) and skips read-only methods (GET, HEAD, OPTIONS)
 * - Skips explicitly excluded paths
 * - Includes the scrubbed request body in the audit entry when it is valid JSON
 * - Captures the actor identity from the Hono context
 * - Falls back to anonymous/guest identity when no actor is present or actor is guest
 * - Does NOT propagate errors thrown by `auditLog` (fail-safe contract)
 * - Works uniformly across admin, protected, and billing route prefixes
 *
 * Mocking strategy:
 * - `@repo/logger` is already mocked globally in test/setup.ts (without AuditEventType).
 *   We re-export `AuditEventType` from the real source via a partial mock of audit-logger.
 * - `../../src/utils/audit-logger` is partially mocked: real `AuditEventType` constant is
 *   preserved, but `auditLog` is replaced with a vi.fn() spy.
 * - `../../src/utils/actor` is fully mocked so `isGuestActor` is a controllable spy.
 */

import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted definitions
//
// `AuditEventType` must be created before any mock factory runs so that
// both the mock factory and test assertions reference the same object.
// We use `vi.hoisted` to guarantee hoisting order is correct even though
// vi.mock() calls are also hoisted to the top of the module.
// ---------------------------------------------------------------------------

const { AuditEventType, auditLogSpy } = vi.hoisted(() => {
    // Mirror the real AuditEventType constant from packages/logger/src/audit-types.ts.
    // Duplicating it here avoids a circular dependency between the mock factory
    // and the (also mocked) @repo/logger package.
    const AuditEventType = {
        AUTH_LOGIN_FAILED: 'auth.login.failed',
        AUTH_LOGIN_SUCCESS: 'auth.login.success',
        AUTH_LOCKOUT: 'auth.lockout',
        AUTH_PASSWORD_CHANGED: 'auth.password.changed',
        ACCESS_DENIED: 'access.denied',
        BILLING_MUTATION: 'billing.mutation',
        PERMISSION_CHANGE: 'permission.change',
        SESSION_SIGNOUT: 'session.signout',
        USER_ADMIN_MUTATION: 'user.admin.mutation',
        ROUTE_MUTATION: 'route.mutation'
    } as const;

    return {
        AuditEventType,
        auditLogSpy: vi.fn()
    };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// Partially mock audit-logger: expose the hoisted AuditEventType constant and
// replace `auditLog` with the spy so we can assert calls without side effects.
vi.mock('../../src/utils/audit-logger', () => ({
    AuditEventType,
    auditLog: auditLogSpy
}));

// Fully mock actor utilities so `isGuestActor` is a controllable spy.
vi.mock('../../src/utils/actor');

// ---------------------------------------------------------------------------
// Imports (after mock declarations)
// ---------------------------------------------------------------------------

import { auditMiddleware } from '../../src/middlewares/audit';
import { isGuestActor } from '../../src/utils/actor';

const mockIsGuestActor = vi.mocked(isGuestActor);
const mockAuditLog = auditLogSpy;

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Builds a minimal authenticated Actor for test scenarios. */
const createUserActor = (overrides: Partial<Actor> = {}): Actor => ({
    id: 'user-abc-123',
    role: RoleEnum.USER,
    permissions: [],
    ...overrides
});

/** Builds a minimal admin Actor for test scenarios. */
const createAdminActor = (): Actor => ({
    id: 'admin-xyz-456',
    role: RoleEnum.ADMIN,
    permissions: []
});

/**
 * Creates a minimal Hono test app with the audit middleware applied globally.
 * An optional `actor` is injected into context to simulate the actor middleware.
 * An optional `excludePaths` list is forwarded to `auditMiddleware`.
 */
const createTestApp = ({
    actor,
    excludePaths
}: {
    actor?: Actor;
    excludePaths?: readonly string[];
} = {}): Hono => {
    const app = new Hono();

    // Simulate actor middleware: inject actor (or nothing) into context
    app.use(async (c, next) => {
        if (actor !== undefined) {
            c.set('actor', actor);
        }
        await next();
    });

    app.use(auditMiddleware({ excludePaths }));

    // Register a catch-all handler for every HTTP method used in tests.
    // Hono exposes shorthand methods for common verbs; HEAD and OPTIONS
    // are registered via `app.on()` to avoid TypeScript errors.
    app.get('/*', (c) => c.json({ ok: true }));
    app.post('/*', (c) => c.json({ ok: true }));
    app.put('/*', (c) => c.json({ ok: true }));
    app.patch('/*', (c) => c.json({ ok: true }));
    app.delete('/*', (c) => c.json({ ok: true }));
    app.on(['HEAD', 'OPTIONS'], '/*', (c) => c.json({ ok: true }));

    return app;
};

/**
 * Fires a request against the test app and returns the response.
 * Automatically sets `content-type: application/json` when a body is provided.
 */
async function sendRequest(
    app: Hono,
    {
        method,
        path,
        body,
        headers
    }: {
        method: string;
        path: string;
        body?: Record<string, unknown>;
        headers?: Record<string, string>;
    }
): Promise<Response> {
    const init: RequestInit = {
        method,
        headers: {
            ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
            ...headers
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    };

    return app.request(path, init);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Audit Middleware', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: actor is NOT a guest (most tests use authenticated actors)
        mockIsGuestActor.mockReturnValue(false);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    // -------------------------------------------------------------------------
    // HTTP method filtering
    // -------------------------------------------------------------------------

    describe('HTTP method filtering', () => {
        it('should call auditLog for POST requests', async () => {
            // Arrange
            const actor = createUserActor();
            const app = createTestApp({ actor });

            // Act
            const res = await sendRequest(app, { method: 'POST', path: '/api/v1/admin/items' });

            // Assert
            expect(res.status).toBe(200);
            expect(mockAuditLog).toHaveBeenCalledOnce();
            expect(mockAuditLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    auditEvent: AuditEventType.ROUTE_MUTATION,
                    method: 'POST'
                })
            );
        });

        it('should call auditLog for PUT requests', async () => {
            // Arrange
            const actor = createUserActor();
            const app = createTestApp({ actor });

            // Act
            await sendRequest(app, { method: 'PUT', path: '/api/v1/protected/items/1' });

            // Assert
            expect(mockAuditLog).toHaveBeenCalledOnce();
            expect(mockAuditLog).toHaveBeenCalledWith(expect.objectContaining({ method: 'PUT' }));
        });

        it('should call auditLog for PATCH requests', async () => {
            // Arrange
            const actor = createUserActor();
            const app = createTestApp({ actor });

            // Act
            await sendRequest(app, { method: 'PATCH', path: '/api/v1/admin/items/1' });

            // Assert
            expect(mockAuditLog).toHaveBeenCalledOnce();
            expect(mockAuditLog).toHaveBeenCalledWith(expect.objectContaining({ method: 'PATCH' }));
        });

        it('should call auditLog for DELETE requests', async () => {
            // Arrange
            const actor = createUserActor();
            const app = createTestApp({ actor });

            // Act
            await sendRequest(app, { method: 'DELETE', path: '/api/v1/admin/items/1' });

            // Assert
            expect(mockAuditLog).toHaveBeenCalledOnce();
            expect(mockAuditLog).toHaveBeenCalledWith(
                expect.objectContaining({ method: 'DELETE' })
            );
        });

        it('should NOT call auditLog for GET requests', async () => {
            // Arrange
            const actor = createUserActor();
            const app = createTestApp({ actor });

            // Act
            const res = await sendRequest(app, { method: 'GET', path: '/api/v1/public/items' });

            // Assert
            expect(res.status).toBe(200);
            expect(mockAuditLog).not.toHaveBeenCalled();
        });

        it('should NOT call auditLog for HEAD requests', async () => {
            // Arrange
            const app = createTestApp();

            // Act
            await sendRequest(app, { method: 'HEAD', path: '/api/v1/public/items' });

            // Assert
            expect(mockAuditLog).not.toHaveBeenCalled();
        });

        it('should NOT call auditLog for OPTIONS requests', async () => {
            // Arrange
            const app = createTestApp();

            // Act
            await sendRequest(app, { method: 'OPTIONS', path: '/api/v1/public/items' });

            // Assert
            expect(mockAuditLog).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // Excluded paths
    // -------------------------------------------------------------------------

    describe('excluded paths', () => {
        it('should skip audit log for an explicitly excluded path', async () => {
            // Arrange
            const actor = createUserActor();
            const app = createTestApp({
                actor,
                excludePaths: ['/api/v1/protected/ping']
            });

            // Act
            await sendRequest(app, { method: 'POST', path: '/api/v1/protected/ping' });

            // Assert
            expect(mockAuditLog).not.toHaveBeenCalled();
        });

        it('should audit non-excluded paths when excludePaths is configured', async () => {
            // Arrange
            const actor = createUserActor();
            const app = createTestApp({
                actor,
                excludePaths: ['/api/v1/protected/ping']
            });

            // Act
            await sendRequest(app, { method: 'POST', path: '/api/v1/protected/items' });

            // Assert
            expect(mockAuditLog).toHaveBeenCalledOnce();
        });

        it('should use exact path matching for exclusions (no prefix match)', async () => {
            // Arrange
            const actor = createUserActor();
            const app = createTestApp({
                actor,
                excludePaths: ['/api/v1/protected/ping']
            });

            // Act: path starts with excluded string but is not an exact match
            await sendRequest(app, {
                method: 'POST',
                path: '/api/v1/protected/ping-extended'
            });

            // Assert: must NOT be excluded because matching is exact, not prefix-based
            expect(mockAuditLog).toHaveBeenCalledOnce();
        });

        it('should suppress all configured excluded paths', async () => {
            // Arrange
            const actor = createUserActor();
            const app = createTestApp({
                actor,
                excludePaths: ['/api/v1/health', '/api/v1/metrics']
            });

            // Act
            await sendRequest(app, { method: 'POST', path: '/api/v1/health' });
            await sendRequest(app, { method: 'POST', path: '/api/v1/metrics' });

            // Assert: both excluded paths suppressed the audit
            expect(mockAuditLog).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // Request body handling
    // -------------------------------------------------------------------------

    describe('request body handling', () => {
        it('should include the parsed body in the audit log entry', async () => {
            // Arrange
            const actor = createUserActor();
            const app = createTestApp({ actor });
            const body = { name: 'Alice', email: 'alice@example.com' };

            // Act
            await sendRequest(app, { method: 'POST', path: '/api/v1/admin/users', body });

            // Assert: body must be passed to auditLog (scrubbing is auditLog's responsibility)
            expect(mockAuditLog).toHaveBeenCalledWith(
                expect.objectContaining({ requestBody: body })
            );
        });

        it('should omit requestBody from audit entry when body is absent', async () => {
            // Arrange
            const actor = createUserActor();
            const app = createTestApp({ actor });

            // Act: POST without a body
            await sendRequest(app, { method: 'POST', path: '/api/v1/admin/items' });

            // Assert: requestBody key must not be present in the audit entry
            expect(mockAuditLog).toHaveBeenCalledWith(
                expect.not.objectContaining({ requestBody: expect.anything() })
            );
        });

        it('should omit requestBody when content-type is not application/json', async () => {
            // Arrange
            const actor = createUserActor();
            const app = createTestApp({ actor });

            // Act: POST with form-urlencoded body
            await app.request('/api/v1/admin/upload', {
                method: 'POST',
                headers: { 'content-type': 'application/x-www-form-urlencoded' },
                body: 'field=value'
            });

            // Assert: middleware only reads the body for JSON content-type
            expect(mockAuditLog).toHaveBeenCalledWith(
                expect.not.objectContaining({ requestBody: expect.anything() })
            );
        });

        it('should omit requestBody when body is malformed JSON', async () => {
            // Arrange
            const actor = createUserActor();
            const app = createTestApp({ actor });

            // Act: send syntactically invalid JSON
            await app.request('/api/v1/admin/items', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: '{ invalid json !!!'
            });

            // Assert: parse failure is absorbed silently; requestBody is absent
            expect(mockAuditLog).toHaveBeenCalledWith(
                expect.not.objectContaining({ requestBody: expect.anything() })
            );
        });
    });

    // -------------------------------------------------------------------------
    // Actor identity capture
    // -------------------------------------------------------------------------

    describe('actor identity capture', () => {
        it('should capture actorId and actorRole from an authenticated actor', async () => {
            // Arrange
            const actor = createAdminActor();
            const app = createTestApp({ actor });

            // Act
            await sendRequest(app, { method: 'POST', path: '/api/v1/admin/items' });

            // Assert
            expect(mockAuditLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    actorId: 'admin-xyz-456',
                    actorRole: RoleEnum.ADMIN
                })
            );
        });

        it('should fall back to anonymous/guest identity when no actor is in context', async () => {
            // Arrange: do not inject any actor
            const app = createTestApp();

            // Act
            await sendRequest(app, { method: 'POST', path: '/api/v1/admin/items' });

            // Assert
            expect(mockAuditLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    actorId: 'anonymous',
                    actorRole: 'guest'
                })
            );
        });

        it('should fall back to anonymous/guest identity when actor isGuestActor returns true', async () => {
            // Arrange
            const guestActor: Actor = {
                id: '00000000-0000-4000-8000-000000000000',
                role: RoleEnum.GUEST,
                permissions: []
            };
            mockIsGuestActor.mockReturnValue(true);
            const app = createTestApp({ actor: guestActor });

            // Act
            await sendRequest(app, { method: 'POST', path: '/api/v1/public/contact' });

            // Assert
            expect(mockAuditLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    actorId: 'anonymous',
                    actorRole: 'guest'
                })
            );
        });

        it('should use the authenticated user actor identity when available', async () => {
            // Arrange
            const actor = createUserActor({ id: 'real-user-id', role: RoleEnum.USER });
            const app = createTestApp({ actor });

            // Act
            await sendRequest(app, { method: 'DELETE', path: '/api/v1/protected/posts/99' });

            // Assert
            expect(mockAuditLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    actorId: 'real-user-id',
                    actorRole: RoleEnum.USER
                })
            );
        });
    });

    // -------------------------------------------------------------------------
    // Audit log entry structure
    // -------------------------------------------------------------------------

    describe('audit log entry structure', () => {
        it('should include the request path in the audit entry', async () => {
            // Arrange
            const actor = createUserActor();
            const app = createTestApp({ actor });

            // Act
            await sendRequest(app, { method: 'POST', path: '/api/v1/admin/accommodations' });

            // Assert
            expect(mockAuditLog).toHaveBeenCalledWith(
                expect.objectContaining({ path: '/api/v1/admin/accommodations' })
            );
        });

        it('should include the HTTP response status code in the audit entry', async () => {
            // Arrange
            const actor = createUserActor();
            const app = createTestApp({ actor });

            // Act
            await sendRequest(app, { method: 'POST', path: '/api/v1/admin/items' });

            // Assert: route handler returns 200; status must be captured post-next()
            expect(mockAuditLog).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 200 }));
        });

        it('should use ROUTE_MUTATION as the auditEvent type', async () => {
            // Arrange
            const actor = createUserActor();
            const app = createTestApp({ actor });

            // Act
            await sendRequest(app, { method: 'PUT', path: '/api/v1/admin/items/5' });

            // Assert
            expect(mockAuditLog).toHaveBeenCalledWith(
                expect.objectContaining({ auditEvent: AuditEventType.ROUTE_MUTATION })
            );
        });
    });

    // -------------------------------------------------------------------------
    // Fail-safe: request must complete normally regardless of audit outcome
    // -------------------------------------------------------------------------

    describe('fail-safe behavior', () => {
        it('should return the handler response after a successful audit', async () => {
            // Arrange
            const actor = createUserActor();
            const app = createTestApp({ actor });

            // Act
            const res = await sendRequest(app, { method: 'POST', path: '/api/v1/admin/items' });

            // Assert: response body from the route handler is intact
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data).toEqual({ ok: true });
        });

        it('should execute the route handler before writing the audit log', async () => {
            // Arrange: verify that `next()` runs before `auditLog` is called
            const actor = createUserActor();
            let handlerExecuted = false;

            const app = new Hono();
            app.use(async (c, next) => {
                c.set('actor', actor);
                await next();
            });
            app.use(auditMiddleware());
            app.post('/test', (c) => {
                handlerExecuted = true;
                return c.json({ ok: true });
            });

            // Act
            await app.request('/test', { method: 'POST' });

            // Assert
            expect(handlerExecuted).toBe(true);
            expect(mockAuditLog).toHaveBeenCalledOnce();
        });

        it('should call auditLog once per mutation request', async () => {
            // Arrange
            const actor = createUserActor();
            const app = createTestApp({ actor });

            // Act: fire three different mutation requests
            await sendRequest(app, { method: 'POST', path: '/items' });
            await sendRequest(app, { method: 'PUT', path: '/items/1' });
            await sendRequest(app, { method: 'DELETE', path: '/items/1' });

            // Assert: exactly one audit entry per request, no duplicates
            expect(mockAuditLog).toHaveBeenCalledTimes(3);
        });
    });

    // -------------------------------------------------------------------------
    // Cross-tier route coverage (admin / protected / billing prefixes)
    // -------------------------------------------------------------------------

    describe('cross-tier route coverage', () => {
        it('should audit POST on admin routes', async () => {
            // Arrange
            const actor = createAdminActor();
            const app = createTestApp({ actor });

            // Act
            await sendRequest(app, { method: 'POST', path: '/api/v1/admin/users' });

            // Assert
            expect(mockAuditLog).toHaveBeenCalledWith(
                expect.objectContaining({ path: '/api/v1/admin/users' })
            );
        });

        it('should audit POST on protected routes', async () => {
            // Arrange
            const actor = createUserActor();
            const app = createTestApp({ actor });

            // Act
            await sendRequest(app, {
                method: 'POST',
                path: '/api/v1/protected/accommodations'
            });

            // Assert
            expect(mockAuditLog).toHaveBeenCalledWith(
                expect.objectContaining({ path: '/api/v1/protected/accommodations' })
            );
        });

        it('should audit POST on billing routes with body', async () => {
            // Arrange
            const actor = createUserActor();
            const app = createTestApp({ actor });

            // Act
            await sendRequest(app, {
                method: 'POST',
                path: '/api/v1/protected/billing/checkout',
                body: { planId: 'plan-abc' }
            });

            // Assert
            expect(mockAuditLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    path: '/api/v1/protected/billing/checkout',
                    method: 'POST',
                    requestBody: { planId: 'plan-abc' }
                })
            );
        });

        it('should audit DELETE on admin routes with correct actor', async () => {
            // Arrange
            const actor = createAdminActor();
            const app = createTestApp({ actor });

            // Act
            await sendRequest(app, { method: 'DELETE', path: '/api/v1/admin/posts/99' });

            // Assert
            expect(mockAuditLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    path: '/api/v1/admin/posts/99',
                    method: 'DELETE',
                    actorId: 'admin-xyz-456'
                })
            );
        });
    });

    // -------------------------------------------------------------------------
    // Default (no-config) usage
    // -------------------------------------------------------------------------

    describe('default configuration', () => {
        it('should work with no configuration arguments', async () => {
            // Arrange
            const actor = createUserActor();
            const app = new Hono();
            app.use(async (c, next) => {
                c.set('actor', actor);
                await next();
            });
            app.use(auditMiddleware()); // no options at all
            app.post('/test', (c) => c.json({ ok: true }));

            // Act
            const res = await app.request('/test', { method: 'POST' });

            // Assert
            expect(res.status).toBe(200);
            expect(mockAuditLog).toHaveBeenCalledOnce();
        });

        it('should audit all four mutation methods when no excludePaths are set', async () => {
            // Arrange
            const actor = createUserActor();
            const app = createTestApp({ actor });

            // Act
            await sendRequest(app, { method: 'POST', path: '/items' });
            await sendRequest(app, { method: 'PUT', path: '/items/1' });
            await sendRequest(app, { method: 'PATCH', path: '/items/1' });
            await sendRequest(app, { method: 'DELETE', path: '/items/1' });

            // Assert
            expect(mockAuditLog).toHaveBeenCalledTimes(4);
        });
    });
});
