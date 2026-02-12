/**
 * Auth Middleware Tests
 * Tests the Better Auth session resolution middleware
 */
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../src/types';

// Mock Better Auth getAuth
const mockGetSession = vi.fn();
vi.mock('../../src/lib/auth', () => ({
    getAuth: () => ({
        api: {
            getSession: mockGetSession
        }
    })
}));

// Mock process.env for auth middleware
const originalEnv = process.env;

beforeEach(() => {
    process.env = {
        ...originalEnv,
        NODE_ENV: 'test',
        DISABLE_AUTH: 'true',
        CI: 'false'
    };
});

describe('Auth Middleware', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        process.env = originalEnv;
        vi.resetModules();
    });

    describe('authMiddleware (mock mode)', () => {
        it('should return a middleware handler', async () => {
            const { authMiddleware } = await import('../../src/middlewares/auth');

            const result = authMiddleware();

            expect(typeof result).toBe('function');
        });

        it('should set user and session on context with valid token', async () => {
            const { authMiddleware } = await import('../../src/middlewares/auth');

            const app = new Hono<AppBindings>();
            app.use(authMiddleware());
            app.get('/test', (c) => {
                const user = c.get('user');
                const session = c.get('session');
                return c.json({ hasUser: !!user, hasSession: !!session, userId: user?.id });
            });

            const res = await app.request('/test', {
                headers: { Authorization: 'Bearer valid-test-token-here' }
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.hasUser).toBe(true);
            expect(body.hasSession).toBe(true);
            expect(body.userId).toBe('00000000-0000-4000-8000-000000000099');
        });

        it('should not set user or session without authorization header', async () => {
            const { authMiddleware } = await import('../../src/middlewares/auth');

            const app = new Hono<AppBindings>();
            app.use(authMiddleware());
            app.get('/test', (c) => {
                const user = c.get('user');
                const session = c.get('session');
                return c.json({ hasUser: !!user, hasSession: !!session });
            });

            const res = await app.request('/test');

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.hasUser).toBe(false);
            expect(body.hasSession).toBe(false);
        });

        it('should not set user or session with invalid token', async () => {
            const { authMiddleware } = await import('../../src/middlewares/auth');

            const app = new Hono<AppBindings>();
            app.use(authMiddleware());
            app.get('/test', (c) => {
                const user = c.get('user');
                return c.json({ hasUser: !!user });
            });

            const res = await app.request('/test', {
                headers: { Authorization: 'Bearer invalid_token_here' }
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.hasUser).toBe(false);
        });

        it('should not set user or session with expired token', async () => {
            const { authMiddleware } = await import('../../src/middlewares/auth');

            const app = new Hono<AppBindings>();
            app.use(authMiddleware());
            app.get('/test', (c) => {
                const user = c.get('user');
                return c.json({ hasUser: !!user });
            });

            const res = await app.request('/test', {
                headers: {
                    Authorization:
                        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
                }
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.hasUser).toBe(false);
        });

        it('should be callable multiple times', async () => {
            const { authMiddleware } = await import('../../src/middlewares/auth');

            const result1 = authMiddleware();
            const result2 = authMiddleware();

            expect(typeof result1).toBe('function');
            expect(typeof result2).toBe('function');
        });
    });

    describe('authMiddleware (real mode)', () => {
        beforeEach(() => {
            process.env.DISABLE_AUTH = 'false';
        });

        it('should call getSession with request headers', async () => {
            vi.resetModules();
            const { authMiddleware } = await import('../../src/middlewares/auth');

            mockGetSession.mockResolvedValue({
                session: {
                    id: 'session-1',
                    userId: 'user-uuid',
                    expiresAt: new Date(),
                    token: 'token',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    ipAddress: null,
                    userAgent: null
                },
                user: {
                    id: 'user-uuid',
                    name: 'Test',
                    email: 'test@example.com',
                    emailVerified: true,
                    image: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    role: 'USER',
                    banned: false,
                    banReason: null,
                    banExpires: null
                }
            });

            const app = new Hono<AppBindings>();
            app.use(authMiddleware());
            app.get('/test', (c) => {
                const user = c.get('user');
                return c.json({ userId: user?.id });
            });

            const res = await app.request('/test');

            expect(res.status).toBe(200);
            expect(mockGetSession).toHaveBeenCalledWith({
                headers: expect.any(Headers)
            });
            const body = await res.json();
            expect(body.userId).toBe('user-uuid');
        });

        it('should pass through without error when no session exists', async () => {
            vi.resetModules();
            const { authMiddleware } = await import('../../src/middlewares/auth');

            mockGetSession.mockResolvedValue(null);

            const app = new Hono<AppBindings>();
            app.use(authMiddleware());
            app.get('/test', (c) => {
                const user = c.get('user');
                return c.json({ hasUser: !!user });
            });

            const res = await app.request('/test');

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.hasUser).toBe(false);
        });

        it('should handle session resolution errors gracefully', async () => {
            vi.resetModules();
            const { authMiddleware } = await import('../../src/middlewares/auth');

            mockGetSession.mockRejectedValue(new Error('Session error'));

            const app = new Hono<AppBindings>();
            app.use(authMiddleware());
            app.get('/test', (c) => {
                const user = c.get('user');
                return c.json({ hasUser: !!user });
            });

            const res = await app.request('/test');

            // Should not throw, should pass through as unauthenticated
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.hasUser).toBe(false);
        });
    });

    describe('requireAuth', () => {
        it('should throw 401 when no user in context', async () => {
            const { authMiddleware, requireAuth } = await import('../../src/middlewares/auth');

            const app = new Hono<AppBindings>();
            app.onError((err, c) => {
                if ('status' in err) {
                    return c.json({ error: err.message }, err.status as 401);
                }
                return c.json({ error: 'Internal error' }, 500);
            });
            app.use(authMiddleware());
            app.use(requireAuth);
            app.get('/test', (c) => c.json({ message: 'success' }));

            // No auth header = no user
            const res = await app.request('/test');

            expect(res.status).toBe(401);
        });

        it('should pass through when user exists in context', async () => {
            const { authMiddleware, requireAuth } = await import('../../src/middlewares/auth');

            const app = new Hono<AppBindings>();
            app.use(authMiddleware());
            app.use(requireAuth);
            app.get('/test', (c) => c.json({ message: 'success' }));

            const res = await app.request('/test', {
                headers: { Authorization: 'Bearer valid-test-token' }
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.message).toBe('success');
        });
    });
});
