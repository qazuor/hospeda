/**
 * Tests for the request-context Hono middleware (SPEC-184).
 *
 * Exercises:
 * - requestId, method, and path are captured from the Hono context.
 * - Downstream handler sees the context via getRequestContext().
 * - Actor enrichment (setRequestContextActor) sets userId/role on the store.
 * - Missing requestId falls back to 'unknown'.
 */
import { Hono } from 'hono';
import { requestId } from 'hono/request-id';
import { beforeEach, describe, expect, it } from 'vitest';
import { getRequestContext, setRequestContextActor } from '../../src/lib/request-context';
import { requestContextMiddleware } from '../../src/middlewares/request-context';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Snapshot of the context captured inside a handler. */
interface CapturedContext {
    requestId: string | undefined;
    method: string | undefined;
    path: string | undefined;
    userId: string | undefined;
    role: string | undefined;
}

/**
 * Creates a minimal test app that:
 * 1. Optionally installs hono/request-id so requestId is available.
 * 2. Installs requestContextMiddleware.
 * 3. Mounts a GET /test handler that captures the ALS context and returns it.
 */
function buildApp({ withRequestId = true }: { withRequestId?: boolean } = {}): {
    app: Hono;
    getCaptured: () => CapturedContext;
} {
    const app = new Hono();
    let captured: CapturedContext = {
        requestId: undefined,
        method: undefined,
        path: undefined,
        userId: undefined,
        role: undefined
    };

    if (withRequestId) {
        app.use(requestId());
    }
    app.use(requestContextMiddleware());

    app.get('/test', (c) => {
        const ctx = getRequestContext();
        captured = {
            requestId: ctx?.requestId,
            method: ctx?.method,
            path: ctx?.path,
            userId: ctx?.userId,
            role: ctx?.role
        };
        return c.json({ ok: true });
    });

    return { app, getCaptured: () => captured };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('requestContextMiddleware', () => {
    beforeEach(() => {
        // Nothing to reset — ALS is scoped per run
    });

    describe('store population', () => {
        it('should capture method and path in the store', async () => {
            // Arrange
            const { app, getCaptured } = buildApp();

            // Act
            const res = await app.request('/test', { method: 'GET' });

            // Assert
            expect(res.status).toBe(200);
            expect(getCaptured().method).toBe('GET');
            expect(getCaptured().path).toBe('/test');
        });

        it('should capture the requestId set by hono/request-id', async () => {
            // Arrange
            const { app, getCaptured } = buildApp();

            // Act
            await app.request('/test');

            // Assert — hono/request-id generates a UUID-like string
            expect(getCaptured().requestId).toBeDefined();
            expect(typeof getCaptured().requestId).toBe('string');
            expect(getCaptured().requestId).not.toBe('');
            expect(getCaptured().requestId).not.toBe('unknown');
        });

        it('should fall back to "unknown" when requestId is not in context', async () => {
            // Arrange — no requestId middleware installed
            const { app, getCaptured } = buildApp({ withRequestId: false });

            // Act
            await app.request('/test');

            // Assert
            expect(getCaptured().requestId).toBe('unknown');
        });

        it('should leave userId and role undefined before actor enrichment', async () => {
            // Arrange
            const { app, getCaptured } = buildApp();

            // Act
            await app.request('/test');

            // Assert
            expect(getCaptured().userId).toBeUndefined();
            expect(getCaptured().role).toBeUndefined();
        });
    });

    describe('downstream visibility', () => {
        it('should make the context available to code called from the handler', async () => {
            // Arrange
            const app = new Hono();
            app.use(requestId());
            app.use(requestContextMiddleware());

            let deepCaptured: ReturnType<typeof getRequestContext>;

            // A helper function simulating a shared-package utility
            const someDeepUtility = async () => {
                await Promise.resolve(); // crosses async boundary
                deepCaptured = getRequestContext();
            };

            app.get('/deep', async (c) => {
                await someDeepUtility();
                return c.json({ ok: true });
            });

            // Act
            await app.request('/deep');

            // Assert
            expect(deepCaptured).toBeDefined();
            expect(deepCaptured?.method).toBe('GET');
            expect(deepCaptured?.path).toBe('/deep');
        });
    });

    describe('actor enrichment integration', () => {
        it('should reflect setRequestContextActor mutations on the store', async () => {
            // Arrange — a middleware that enriches the actor after requestContextMiddleware
            const app = new Hono();
            app.use(requestId());
            app.use(requestContextMiddleware());

            // Simulate actor middleware enriching the context
            app.use(async (_c, next) => {
                setRequestContextActor({ userId: 'user-42', role: 'HOST' });
                await next();
            });

            let captured: ReturnType<typeof getRequestContext>;
            app.get('/enriched', (c) => {
                captured = getRequestContext();
                return c.json({ ok: true });
            });

            // Act
            await app.request('/enriched');

            // Assert
            expect(captured?.userId).toBe('user-42');
            expect(captured?.role).toBe('HOST');
        });

        it('should not leak actor from one request into a subsequent request', async () => {
            // Arrange
            const app = new Hono();
            app.use(requestId());
            app.use(requestContextMiddleware());

            const capturedByRequest: Array<{ userId: string | undefined }> = [];

            app.use(async (_c, next) => {
                await next();
            });

            let callCount = 0;
            app.get('/sequential', (c) => {
                callCount += 1;
                // First request sets actor, second does not
                if (callCount === 1) {
                    setRequestContextActor({ userId: 'user-first', role: 'HOST' });
                }
                capturedByRequest.push({ userId: getRequestContext()?.userId });
                return c.json({ ok: true });
            });

            // Act — two sequential requests
            await app.request('/sequential');
            await app.request('/sequential');

            // Assert — second request must NOT see first request's actor
            expect(capturedByRequest[0]?.userId).toBe('user-first');
            expect(capturedByRequest[1]?.userId).toBeUndefined();
        });
    });
});
