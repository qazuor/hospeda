/**
 * Auth Middleware Tests
 * Tests the Clerk authentication middleware functionality
 */
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Clerk middleware
const mockClerkMiddleware = vi.fn();
vi.mock('@hono/clerk-auth', () => ({
    clerkMiddleware: mockClerkMiddleware
}));

// Mock environment
vi.mock('../../src/utils/env', () => ({
    env: {
        CLERK_SECRET_KEY: 'test-secret-key',
        CLERK_PUBLISHABLE_KEY: 'test-publishable-key'
    }
}));

describe('Auth Middleware', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('clerkAuth', () => {
        it('should create Clerk middleware with correct configuration', async () => {
            const { clerkAuth } = await import('../../src/middlewares/auth');

            // Call the function
            clerkAuth();

            // Verify clerkMiddleware was called with correct config
            expect(mockClerkMiddleware).toHaveBeenCalledWith({
                secretKey: 'test-secret-key',
                publishableKey: 'test-publishable-key'
            });
        });

        it('should return a middleware handler', async () => {
            const { clerkAuth } = await import('../../src/middlewares/auth');

            // Mock the middleware to return a function
            const mockMiddleware = vi.fn();
            mockClerkMiddleware.mockReturnValue(mockMiddleware);

            const result = clerkAuth();

            expect(typeof result).toBe('function');
            expect(result).toBe(mockMiddleware);
        });

        it('should be callable multiple times with same configuration', async () => {
            const { clerkAuth } = await import('../../src/middlewares/auth');

            // Call multiple times
            clerkAuth();
            clerkAuth();
            clerkAuth();

            // Should be called 3 times with same config
            expect(mockClerkMiddleware).toHaveBeenCalledTimes(3);
            expect(mockClerkMiddleware).toHaveBeenCalledWith({
                secretKey: 'test-secret-key',
                publishableKey: 'test-publishable-key'
            });
        });

        it('should use environment variables for configuration', async () => {
            const { clerkAuth } = await import('../../src/middlewares/auth');

            clerkAuth();

            // Verify it uses the mocked env values
            expect(mockClerkMiddleware).toHaveBeenCalledWith({
                secretKey: 'test-secret-key',
                publishableKey: 'test-publishable-key'
            });
        });
    });

    describe('Integration with Hono', () => {
        it('should integrate properly with Hono app', async () => {
            const { clerkAuth } = await import('../../src/middlewares/auth');

            // Mock middleware that calls next()
            const mockMiddleware = vi.fn(async (_c, next) => {
                await next();
            });
            mockClerkMiddleware.mockReturnValue(mockMiddleware);

            const app = new Hono();
            app.use(clerkAuth());
            app.get('/test', (c) => c.json({ message: 'success' }));

            const res = await app.request('/test');

            expect(res.status).toBe(200);
            expect(mockMiddleware).toHaveBeenCalled();
        });

        it('should handle middleware errors gracefully', async () => {
            const { clerkAuth } = await import('../../src/middlewares/auth');

            // Mock middleware that throws an error
            const mockMiddleware = vi.fn(async () => {
                throw new Error('Auth error');
            });
            mockClerkMiddleware.mockReturnValue(mockMiddleware);

            const app = new Hono();
            app.use(clerkAuth());
            app.get('/test', (c) => c.json({ message: 'success' }));

            // Should return 500 status code when middleware throws
            const res = await app.request('/test');
            expect(res.status).toBe(500);
        });
    });

    describe('Configuration Validation', () => {
        it('should handle missing environment variables', async () => {
            // Mock env with missing values
            vi.doMock('../../src/utils/env', () => ({
                env: {
                    CLERK_SECRET_KEY: undefined,
                    CLERK_PUBLISHABLE_KEY: undefined
                }
            }));

            // Force reimport of the module
            vi.resetModules();
            const { clerkAuth } = await import('../../src/middlewares/auth');

            expect(() => clerkAuth()).toThrow(
                'Clerk environment variables (CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY) are required for authentication middleware'
            );
        });

        it('should handle empty string environment variables', async () => {
            // Mock env with empty strings
            vi.doMock('../../src/utils/env', () => ({
                env: {
                    CLERK_SECRET_KEY: '',
                    CLERK_PUBLISHABLE_KEY: ''
                }
            }));

            // Force reimport of the module
            vi.resetModules();
            const { clerkAuth } = await import('../../src/middlewares/auth');

            expect(() => clerkAuth()).toThrow(
                'Clerk environment variables (CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY) are required for authentication middleware'
            );
        });
    });
});
