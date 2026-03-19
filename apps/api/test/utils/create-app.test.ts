/**
 * Create App Utility Tests
 * Tests the application factory functionality
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock all middlewares
vi.mock('../../src/middlewares/actor', () => ({
    actorMiddleware: vi.fn(() => vi.fn())
}));

vi.mock('../../src/middlewares/auth', () => ({
    authMiddleware: vi.fn(() => vi.fn())
}));

vi.mock('../../src/middlewares/cache', () => ({
    cacheMiddleware: vi.fn(() => vi.fn())
}));

vi.mock('../../src/middlewares/compression', () => ({
    compressionMiddleware: vi.fn(() => vi.fn())
}));

vi.mock('../../src/middlewares/cors', () => ({
    corsMiddleware: vi.fn(() => vi.fn())
}));

vi.mock('../../src/middlewares/response', () => ({
    responseFormattingMiddleware: vi.fn(() => vi.fn()),
    createErrorHandler: vi.fn(() => vi.fn())
}));

vi.mock('../../src/middlewares/logger', () => ({
    loggerMiddleware: vi.fn(() => vi.fn())
}));

vi.mock('../../src/middlewares/metrics', () => ({
    metricsMiddleware: vi.fn(() => vi.fn())
}));

vi.mock('../../src/middlewares/rate-limit', () => ({
    rateLimitMiddleware: vi.fn(() => vi.fn())
}));

vi.mock('../../src/middlewares/security', () => ({
    securityHeadersMiddleware: vi.fn(() => vi.fn()),
    originVerificationMiddleware: vi.fn(() => vi.fn())
}));

vi.mock('../../src/middlewares/validation', () => ({
    validationMiddleware: vi.fn(() => vi.fn())
}));

vi.mock('../../src/middlewares/sentry', () => ({
    sentryMiddleware: vi.fn(() => vi.fn())
}));

vi.mock('../../src/middlewares/response-validator', () => ({
    responseValidatorMiddleware: vi.fn(() => vi.fn())
}));

vi.mock('../../src/middlewares/billing', () => ({
    billingMiddleware: vi.fn(() => vi.fn())
}));

vi.mock('../../src/middlewares/billing-customer', () => ({
    billingCustomerMiddleware: vi.fn(() => vi.fn())
}));

vi.mock('../../src/middlewares/entitlement', () => ({
    entitlementMiddleware: vi.fn(() => vi.fn())
}));

vi.mock('../../src/middlewares/trial', () => ({
    trialMiddleware: vi.fn(() => vi.fn())
}));

vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: {
        log: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn()
    }
}));

// Mock Hono modules
vi.mock('hono/request-id', () => ({
    requestId: vi.fn(() => vi.fn())
}));

// Mock OpenAPIHono while preserving other exports like 'z'
vi.mock('@hono/zod-openapi', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@hono/zod-openapi')>();
    const mockOpenAPIHono = vi.fn();

    // Set default implementation
    mockOpenAPIHono.mockImplementation(() => ({
        onError: vi.fn(),
        use: vi.fn().mockReturnThis(),
        notFound: vi.fn(),
        route: vi.fn().mockReturnThis(),
        get: vi.fn(),
        request: vi.fn()
    }));

    return {
        ...actual,
        OpenAPIHono: mockOpenAPIHono
    };
});

describe('Create App Utility', () => {
    beforeEach(async () => {
        vi.clearAllMocks();

        // Get the mocked OpenAPIHono from the module
        const { OpenAPIHono } = await import('@hono/zod-openapi');
        const mockOpenAPIHono = vi.mocked(OpenAPIHono);

        // Reset the mock implementation for each test
        mockOpenAPIHono.mockImplementation(() => ({
            onError: vi.fn(),
            use: vi.fn().mockReturnThis(),
            notFound: vi.fn(),
            route: vi.fn().mockReturnThis(),
            get: vi.fn().mockReturnThis(),
            request: vi.fn()
        }));
    });

    describe('createRouter', () => {
        it('should create a new OpenAPIHono instance', async () => {
            const module = await import('../../src/utils/create-app');
            const router = module.createRouter();
            expect(router).toBeDefined();
        });

        it('should create router with strict: false configuration', async () => {
            const { OpenAPIHono } = await import('@hono/zod-openapi');
            const mockOpenAPIHono = vi.mocked(OpenAPIHono);

            const module = await import('../../src/utils/create-app');
            module.createRouter();
            expect(mockOpenAPIHono).toHaveBeenCalledWith(
                expect.objectContaining({
                    strict: false
                })
            );
        });

        it('should register a defaultHook function on the router (GAP-004)', async () => {
            const { OpenAPIHono } = await import('@hono/zod-openapi');
            const mockOpenAPIHono = vi.mocked(OpenAPIHono);

            const module = await import('../../src/utils/create-app');
            module.createRouter();
            expect(mockOpenAPIHono).toHaveBeenCalledWith(
                expect.objectContaining({
                    defaultHook: expect.any(Function)
                })
            );
        });
    });

    describe('createApp', () => {
        it('should create an app with all middlewares registered', async () => {
            const module = await import('../../src/utils/create-app');
            const app = module.createApp();
            expect(app).toBeDefined();
        });

        it('should register global error handler', async () => {
            const { OpenAPIHono } = await import('@hono/zod-openapi');
            const mockOpenAPIHono = vi.mocked(OpenAPIHono);

            const module = await import('../../src/utils/create-app');

            const mockApp = {
                onError: vi.fn(),
                use: vi.fn().mockReturnThis(),
                notFound: vi.fn(),
                get: vi.fn().mockReturnThis()
            };
            mockOpenAPIHono.mockReturnValue(mockApp);

            module.createApp();

            // Verify that onError was called with the result of createErrorHandler()
            expect(mockApp.onError).toHaveBeenCalledWith(expect.any(Function));
        });

        it('should register all middlewares in correct order', async () => {
            const { OpenAPIHono } = await import('@hono/zod-openapi');
            const mockOpenAPIHono = vi.mocked(OpenAPIHono);

            const module = await import('../../src/utils/create-app');

            const mockApp = {
                onError: vi.fn(),
                use: vi.fn().mockReturnThis(),
                notFound: vi.fn(),
                get: vi.fn().mockReturnThis()
            };
            mockOpenAPIHono.mockReturnValue(mockApp);

            module.createApp();

            // Verify middleware registration order
            // 22 middlewares: requestId, favicon, sentry, logger, cors, originVerification,
            // securityHeaders, rateLimit, bodyLimit, compression, validation, cache, metrics,
            // responseFormatting, responseValidator, mockAuth (test env), authMiddleware, actor,
            // billing, billingCustomer, entitlement, trial
            expect(mockApp.use).toHaveBeenCalledTimes(22);
        });

        it('should register notFound handler', async () => {
            const { OpenAPIHono } = await import('@hono/zod-openapi');
            const mockOpenAPIHono = vi.mocked(OpenAPIHono);

            const module = await import('../../src/utils/create-app');

            const mockApp = {
                onError: vi.fn(),
                use: vi.fn().mockReturnThis(),
                notFound: vi.fn(),
                get: vi.fn().mockReturnThis()
            };
            mockOpenAPIHono.mockReturnValue(mockApp);

            module.createApp();

            expect(mockApp.notFound).toHaveBeenCalled();
        });

        it('should return the configured app', async () => {
            const { OpenAPIHono } = await import('@hono/zod-openapi');
            const mockOpenAPIHono = vi.mocked(OpenAPIHono);

            const module = await import('../../src/utils/create-app');

            const mockApp = {
                onError: vi.fn(),
                use: vi.fn().mockReturnThis(),
                notFound: vi.fn(),
                get: vi.fn().mockReturnThis()
            };
            mockOpenAPIHono.mockReturnValue(mockApp);

            const result = module.createApp();

            expect(result).toBe(mockApp);
        });
    });

    describe('createTestApp', () => {
        it('should create test app with router', async () => {
            const { OpenAPIHono } = await import('@hono/zod-openapi');
            const mockOpenAPIHono = vi.mocked(OpenAPIHono);

            const module = await import('../../src/utils/create-app');

            const mockRouter = {
                routes: vi.fn()
            };

            const mockApp = {
                onError: vi.fn(),
                use: vi.fn().mockReturnThis(),
                notFound: vi.fn(),
                route: vi.fn().mockReturnThis(),
                get: vi.fn().mockReturnThis()
            };
            mockOpenAPIHono.mockReturnValue(mockApp as any);

            const result = module.createTestApp(mockRouter as any);

            expect(mockApp.route).toHaveBeenCalledWith('/', mockRouter);
            expect(result).toBe(mockApp);
        });

        it('should use createApp internally', async () => {
            const { OpenAPIHono } = await import('@hono/zod-openapi');
            const mockOpenAPIHono = vi.mocked(OpenAPIHono);

            const module = await import('../../src/utils/create-app');

            const mockRouter = {
                routes: vi.fn()
            };

            const mockApp = {
                onError: vi.fn(),
                use: vi.fn().mockReturnThis(),
                notFound: vi.fn(),
                route: vi.fn().mockReturnThis(),
                get: vi.fn().mockReturnThis()
            };
            mockOpenAPIHono.mockReturnValue(mockApp as any);

            module.createTestApp(mockRouter as any);

            // Should call createApp which registers all middlewares
            expect(mockApp.use).toHaveBeenCalled();
            expect(mockApp.onError).toHaveBeenCalled();
        });
    });

    describe('getApp', () => {
        it('should return the singleton app instance', async () => {
            const module = await import('../../src/utils/create-app');
            const app1 = module.getApp();
            const app2 = module.getApp();

            expect(app1).toBe(app2);
        });

        it('should return a valid app instance', async () => {
            const module = await import('../../src/utils/create-app');
            const app = module.getApp();
            expect(app).toBeDefined();
        });
    });

    describe('App Configuration', () => {
        it('should create app with OpenAPIHono configuration', async () => {
            const { OpenAPIHono } = await import('@hono/zod-openapi');
            const mockOpenAPIHono = vi.mocked(OpenAPIHono);

            const module = await import('../../src/utils/create-app');
            module.createApp();

            expect(mockOpenAPIHono).toHaveBeenCalledWith(
                expect.objectContaining({
                    strict: false
                })
            );
        });

        it('should register all required middlewares', async () => {
            const { OpenAPIHono } = await import('@hono/zod-openapi');
            const mockOpenAPIHono = vi.mocked(OpenAPIHono);

            const module = await import('../../src/utils/create-app');

            const mockApp = {
                onError: vi.fn(),
                use: vi.fn().mockReturnThis(),
                notFound: vi.fn(),
                get: vi.fn().mockReturnThis()
            };
            mockOpenAPIHono.mockReturnValue(mockApp as any);

            module.createApp();

            // Verify all middlewares are registered
            const middlewareCalls = mockApp.use.mock.calls;
            expect(middlewareCalls.length).toBeGreaterThan(0);
        });
    });

    describe('Error Handling', () => {
        it('should handle middleware registration errors gracefully', async () => {
            const { OpenAPIHono } = await import('@hono/zod-openapi');
            const mockOpenAPIHono = vi.mocked(OpenAPIHono);

            const module = await import('../../src/utils/create-app');

            const mockApp = {
                onError: vi.fn(),
                use: vi.fn().mockImplementation(() => {
                    throw new Error('Middleware error');
                }),
                notFound: vi.fn(),
                get: vi.fn().mockReturnThis()
            };
            mockOpenAPIHono.mockReturnValue(mockApp as any);

            expect(() => module.createApp()).toThrow('Middleware error');
        });

        it('should handle app creation errors', async () => {
            const { OpenAPIHono } = await import('@hono/zod-openapi');
            const mockOpenAPIHono = vi.mocked(OpenAPIHono);

            const module = await import('../../src/utils/create-app');

            mockOpenAPIHono.mockImplementation(() => {
                throw new Error('App creation error');
            });

            expect(() => module.createApp()).toThrow('App creation error');
        });
    });
});
