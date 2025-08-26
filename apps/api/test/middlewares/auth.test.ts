/**
 * Auth Middleware Tests
 * Tests the Clerk authentication middleware functionality
 */
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Clerk middleware
const mockClerkMiddleware = vi.fn();
vi.mock('@hono/clerk-auth', () => ({
    clerkMiddleware: mockClerkMiddleware
}));

// Mock process.env for auth middleware
const originalEnv = process.env;
beforeEach(() => {
    process.env = {
        ...originalEnv,
        HOSPEDA_CLERK_SECRET_KEY: 'sk_test_Y2xlcmstdGVzdC1zZWNyZXQta2V5',
        HOSPEDA_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_Y2xlcmstdGVzdC1wdWJsaXNoYWJsZS1rZXk',
        NODE_ENV: 'test',
        API_VALIDATION_CLERK_AUTH_ENABLED: 'false'
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

    describe('clerkAuth', () => {
        it('should create Clerk middleware with correct configuration', async () => {
            const { clerkAuth } = await import('../../src/middlewares/auth');

            // Call the function
            clerkAuth();

            // In test environment with API_VALIDATION_CLERK_AUTH_ENABLED=false,
            // clerkAuth should return a mock middleware, not call clerkMiddleware
            expect(mockClerkMiddleware).not.toHaveBeenCalled();
        });

        it('should return a middleware handler', async () => {
            const { clerkAuth } = await import('../../src/middlewares/auth');

            const result = clerkAuth();

            expect(typeof result).toBe('function');
        });

        it('should be callable multiple times with same configuration', async () => {
            const { clerkAuth } = await import('../../src/middlewares/auth');

            // Call multiple times
            const result1 = clerkAuth();
            const result2 = clerkAuth();
            const result3 = clerkAuth();

            // All should return middleware functions
            expect(typeof result1).toBe('function');
            expect(typeof result2).toBe('function');
            expect(typeof result3).toBe('function');
        });

        it('should use environment variables for configuration', async () => {
            // Set up environment for real Clerk auth
            process.env.API_VALIDATION_CLERK_AUTH_ENABLED = 'true';

            // Force reimport to get new behavior
            vi.resetModules();
            const { clerkAuth } = await import('../../src/middlewares/auth');

            clerkAuth();

            // Verify it uses the correct env values when Clerk auth is enabled
            expect(mockClerkMiddleware).toHaveBeenCalledWith({
                secretKey: 'sk_test_Y2xlcmstdGVzdC1zZWNyZXQta2V5',
                publishableKey: 'pk_test_Y2xlcmstdGVzdC1wdWJsaXNoYWJsZS1rZXk'
            });
        });
    });

    describe('Integration with Hono', () => {
        it('should integrate properly with Hono app', async () => {
            // Enable auth for this test
            process.env.API_VALIDATION_CLERK_AUTH_ENABLED = 'true';

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

            // Restore original value
            process.env.API_VALIDATION_CLERK_AUTH_ENABLED = 'false';
        });

        it('should handle middleware errors gracefully', async () => {
            // Enable auth for this test
            process.env.API_VALIDATION_CLERK_AUTH_ENABLED = 'true';

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

            // Restore original value
            process.env.API_VALIDATION_CLERK_AUTH_ENABLED = 'false';
        });
    });

    describe('Configuration Validation', () => {
        it('should handle missing environment variables gracefully', async () => {
            // Set up environment with missing Clerk keys but auth disabled
            process.env = {
                ...originalEnv,
                NODE_ENV: 'test',
                API_VALIDATION_CLERK_AUTH_ENABLED: 'false'
                // HOSPEDA_CLERK_SECRET_KEY and HOSPEDA_PUBLIC_CLERK_PUBLISHABLE_KEY are undefined
            };

            // Force reimport of the module
            vi.resetModules();
            const { clerkAuth } = await import('../../src/middlewares/auth');

            // Should not throw when auth is disabled
            expect(() => clerkAuth()).not.toThrow();

            const middleware = clerkAuth();
            expect(typeof middleware).toBe('function');
        });

        it('should use fallback values when Clerk auth is enabled but keys are missing', async () => {
            // Clear previous mock calls
            vi.clearAllMocks();

            // Explicitly delete the Clerk keys from environment
            process.env.HOSPEDA_CLERK_SECRET_KEY = undefined;
            process.env.HOSPEDA_PUBLIC_CLERK_PUBLISHABLE_KEY = undefined;

            // Set up environment with Clerk auth enabled but missing keys
            process.env.NODE_ENV = 'test';
            process.env.API_VALIDATION_CLERK_AUTH_ENABLED = 'true';

            // Force reimport of the module
            vi.resetModules();
            const { clerkAuth } = await import('../../src/middlewares/auth');

            // Should not throw, but use empty string fallbacks
            expect(() => clerkAuth()).not.toThrow();

            expect(mockClerkMiddleware).toHaveBeenCalledWith({
                secretKey: '',
                publishableKey: ''
            });
        });
    });
});
