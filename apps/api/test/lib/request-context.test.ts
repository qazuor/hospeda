/**
 * Unit tests for the request-context AsyncLocalStorage lib (SPEC-184).
 *
 * Exercises:
 * - Store visibility inside / outside runWithRequestContext scope.
 * - Actor mutation via setRequestContextActor.
 * - No-op when called without an active scope.
 * - Isolation between nested / concurrent scopes.
 */
import { describe, expect, it } from 'vitest';
import {
    getRequestContext,
    runWithRequestContext,
    setRequestContextActor,
    setRequestContextVisitor
} from '../../src/lib/request-context';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeStore = (overrides: Partial<Parameters<typeof runWithRequestContext>[0]['store']> = {}) =>
    ({
        requestId: 'req-test-001',
        method: 'GET',
        path: '/api/v1/public/health',
        ...overrides
    }) as Parameters<typeof runWithRequestContext>[0]['store'];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getRequestContext', () => {
    it('should return undefined when called outside any active scope', () => {
        // Arrange — no scope established (top-level module code / server startup)
        // Act
        const result = getRequestContext();
        // Assert
        expect(result).toBeUndefined();
    });
});

describe('runWithRequestContext', () => {
    it('should make the store visible inside fn via getRequestContext', async () => {
        // Arrange
        const store = makeStore({ requestId: 'abc-123' });
        let captured: ReturnType<typeof getRequestContext>;

        // Act
        await runWithRequestContext({
            store,
            fn: async () => {
                captured = getRequestContext();
            }
        });

        // Assert
        expect(captured).toBeDefined();
        expect(captured?.requestId).toBe('abc-123');
        expect(captured?.method).toBe('GET');
        expect(captured?.path).toBe('/api/v1/public/health');
    });

    it('should return undefined outside the scope once fn has resolved', async () => {
        // Arrange
        const store = makeStore();

        // Act
        await runWithRequestContext({ store, fn: async () => {} });

        // Assert — store no longer visible after fn completes
        expect(getRequestContext()).toBeUndefined();
    });

    it('should propagate the store across async await boundaries inside fn', async () => {
        // Arrange
        const store = makeStore({ requestId: 'propagation-test' });
        const capturedIds: string[] = [];

        // Act
        await runWithRequestContext({
            store,
            fn: async () => {
                capturedIds.push(getRequestContext()?.requestId ?? 'missing');
                await Promise.resolve(); // microtask boundary
                capturedIds.push(getRequestContext()?.requestId ?? 'missing');
                await new Promise<void>((resolve) => setTimeout(resolve, 0)); // macro-task boundary
                capturedIds.push(getRequestContext()?.requestId ?? 'missing');
            }
        });

        // Assert
        expect(capturedIds).toEqual(['propagation-test', 'propagation-test', 'propagation-test']);
    });
});

describe('setRequestContextActor', () => {
    it('should mutate the active store with userId and role', async () => {
        // Arrange
        const store = makeStore();
        let captured: ReturnType<typeof getRequestContext>;

        // Act
        await runWithRequestContext({
            store,
            fn: async () => {
                setRequestContextActor({ userId: 'user-uuid-001', role: 'HOST' });
                captured = getRequestContext();
            }
        });

        // Assert
        expect(captured?.userId).toBe('user-uuid-001');
        expect(captured?.role).toBe('HOST');
    });

    it('should be a no-op when called outside any active scope', () => {
        // Arrange — no active scope
        // Act — must not throw
        expect(() => setRequestContextActor({ userId: 'x', role: 'HOST' })).not.toThrow();
        // Assert — no store leaked
        expect(getRequestContext()).toBeUndefined();
    });

    it('should not affect other store fields when mutating actor', async () => {
        // Arrange
        const store = makeStore({ requestId: 'field-isolation', path: '/test' });
        let captured: ReturnType<typeof getRequestContext>;

        // Act
        await runWithRequestContext({
            store,
            fn: async () => {
                setRequestContextActor({ userId: 'u1', role: 'ADMIN' });
                captured = getRequestContext();
            }
        });

        // Assert — other fields untouched
        expect(captured?.requestId).toBe('field-isolation');
        expect(captured?.path).toBe('/test');
        expect(captured?.method).toBe('GET');
    });

    it('should set sessionId when provided', async () => {
        // Arrange
        const store = makeStore();
        let captured: ReturnType<typeof getRequestContext>;

        // Act
        await runWithRequestContext({
            store,
            fn: async () => {
                setRequestContextActor({
                    userId: 'user-uuid-002',
                    role: 'HOST',
                    sessionId: 'session-uuid-001'
                });
                captured = getRequestContext();
            }
        });

        // Assert
        expect(captured?.userId).toBe('user-uuid-002');
        expect(captured?.sessionId).toBe('session-uuid-001');
    });

    it('should leave sessionId undefined when not provided', async () => {
        // Arrange
        const store = makeStore();
        let captured: ReturnType<typeof getRequestContext>;

        // Act
        await runWithRequestContext({
            store,
            fn: async () => {
                setRequestContextActor({ userId: 'u2', role: 'USER' });
                captured = getRequestContext();
            }
        });

        // Assert
        expect(captured?.sessionId).toBeUndefined();
    });
});

describe('setRequestContextVisitor', () => {
    it('should mutate the active store with visitorId', async () => {
        // Arrange
        const store = makeStore();
        let captured: ReturnType<typeof getRequestContext>;

        // Act
        await runWithRequestContext({
            store,
            fn: async () => {
                setRequestContextVisitor({ visitorId: 'visitor-uuid-001' });
                captured = getRequestContext();
            }
        });

        // Assert
        expect(captured?.visitorId).toBe('visitor-uuid-001');
    });

    it('should be a no-op when called outside any active scope', () => {
        // Arrange — no active scope
        // Act — must not throw
        expect(() => setRequestContextVisitor({ visitorId: 'x' })).not.toThrow();
        // Assert — no store leaked
        expect(getRequestContext()).toBeUndefined();
    });

    it('should not affect other store fields when setting visitorId', async () => {
        // Arrange
        const store = makeStore({ requestId: 'visitor-isolation' });
        let captured: ReturnType<typeof getRequestContext>;

        // Act
        await runWithRequestContext({
            store,
            fn: async () => {
                setRequestContextActor({ userId: 'u3', role: 'HOST' });
                setRequestContextVisitor({ visitorId: 'visitor-uuid-002' });
                captured = getRequestContext();
            }
        });

        // Assert — actor fields untouched by visitor mutation
        expect(captured?.userId).toBe('u3');
        expect(captured?.role).toBe('HOST');
        expect(captured?.visitorId).toBe('visitor-uuid-002');
    });

    it('should coexist with an authenticated actor on the same store', async () => {
        // Arrange — anonymous request that later authenticates in the same session
        const store = makeStore();
        let captured: ReturnType<typeof getRequestContext>;

        // Act
        await runWithRequestContext({
            store,
            fn: async () => {
                setRequestContextVisitor({ visitorId: 'visitor-before-login' });
                setRequestContextActor({ userId: 'u4', role: 'USER' });
                captured = getRequestContext();
            }
        });

        // Assert — both identities present simultaneously
        expect(captured?.visitorId).toBe('visitor-before-login');
        expect(captured?.userId).toBe('u4');
    });
});

describe('isolation — nested and concurrent scopes', () => {
    it('should keep distinct stores for two concurrent runWithRequestContext calls', async () => {
        // Arrange — two requests racing, each with a unique requestId
        const capturedA: string[] = [];
        const capturedB: string[] = [];

        const runA = runWithRequestContext({
            store: makeStore({ requestId: 'req-A', path: '/a' }),
            fn: async () => {
                capturedA.push(getRequestContext()?.requestId ?? 'missing');
                // Yield so runB can interleave
                await Promise.resolve();
                capturedA.push(getRequestContext()?.requestId ?? 'missing');
            }
        });

        const runB = runWithRequestContext({
            store: makeStore({ requestId: 'req-B', path: '/b' }),
            fn: async () => {
                capturedB.push(getRequestContext()?.requestId ?? 'missing');
                await Promise.resolve();
                capturedB.push(getRequestContext()?.requestId ?? 'missing');
            }
        });

        // Act
        await Promise.all([runA, runB]);

        // Assert — each closure saw only its own store, no leakage
        expect(capturedA).toEqual(['req-A', 'req-A']);
        expect(capturedB).toEqual(['req-B', 'req-B']);
    });

    it('should not leak actor enrichment from one concurrent scope into another', async () => {
        // Arrange
        let actorInA: string | undefined = 'initial';
        let actorInB: string | undefined = 'initial';

        const runA = runWithRequestContext({
            store: makeStore({ requestId: 'A' }),
            fn: async () => {
                await Promise.resolve();
                setRequestContextActor({ userId: 'user-A', role: 'HOST' });
                await Promise.resolve();
                actorInA = getRequestContext()?.userId;
            }
        });

        const runB = runWithRequestContext({
            store: makeStore({ requestId: 'B' }),
            fn: async () => {
                await Promise.resolve();
                // B never sets an actor
                await Promise.resolve();
                actorInB = getRequestContext()?.userId;
            }
        });

        // Act
        await Promise.all([runA, runB]);

        // Assert
        expect(actorInA).toBe('user-A');
        expect(actorInB).toBeUndefined(); // B must not see A's actor
    });
});
