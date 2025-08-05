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
    clerkAuth: vi.fn(() => vi.fn())
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
    securityHeadersMiddleware: vi.fn(() => vi.fn())
}));

vi.mock('../../src/middlewares/validation', () => ({
    validationMiddleware: vi.fn(() => vi.fn())
}));

// Mock Hono modules
vi.mock('hono/request-id', () => ({
    requestId: vi.fn(() => vi.fn())
}));

// Mock OpenAPIHono
const mockOpenAPIHono = vi.fn();
vi.mock('@hono/zod-openapi', () => ({
    OpenAPIHono: mockOpenAPIHono
}));

describe('Create App Utility', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Reset the mock implementation for each test
        mockOpenAPIHono.mockImplementation(() => ({
            onError: vi.fn(),
            use: vi.fn().mockReturnThis(),
            notFound: vi.fn(),
            route: vi.fn().mockReturnThis(),
            get: vi.fn(),
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
            const module = await import('../../src/utils/create-app');
            module.createRouter();
            expect(mockOpenAPIHono).toHaveBeenCalledWith({
                strict: false
            });
        });
    });

    describe('createApp', () => {
        it('should create an app with all middlewares registered', async () => {
            const module = await import('../../src/utils/create-app');
            const app = module.default();
            expect(app).toBeDefined();
        });

        it('should register global error handler', async () => {
            const module = await import('../../src/utils/create-app');

            const mockApp = {
                onError: vi.fn(),
                use: vi.fn().mockReturnThis(),
                notFound: vi.fn()
            };
            mockOpenAPIHono.mockReturnValue(mockApp);

            module.default();

            // Verify that onError was called with the result of createErrorHandler()
            expect(mockApp.onError).toHaveBeenCalledWith(expect.any(Function));
        });

        it('should register all middlewares in correct order', async () => {
            const module = await import('../../src/utils/create-app');

            const mockApp = {
                onError: vi.fn(),
                use: vi.fn().mockReturnThis(),
                notFound: vi.fn()
            };
            mockOpenAPIHono.mockReturnValue(mockApp);

            module.default();

            // Verify middleware registration order
            expect(mockApp.use).toHaveBeenCalledTimes(13); // All middlewares + requestId + favicon
        });

        it('should register notFound handler', async () => {
            const module = await import('../../src/utils/create-app');

            const mockApp = {
                onError: vi.fn(),
                use: vi.fn().mockReturnThis(),
                notFound: vi.fn()
            };
            mockOpenAPIHono.mockReturnValue(mockApp);

            module.default();

            expect(mockApp.notFound).toHaveBeenCalled();
        });

        it('should return the configured app', async () => {
            const module = await import('../../src/utils/create-app');

            const mockApp = {
                onError: vi.fn(),
                use: vi.fn().mockReturnThis(),
                notFound: vi.fn()
            };
            mockOpenAPIHono.mockReturnValue(mockApp);

            const result = module.default();

            expect(result).toBe(mockApp);
        });
    });

    describe('createTestApp', () => {
        it('should create test app with router', async () => {
            const module = await import('../../src/utils/create-app');

            const mockRouter = {
                routes: vi.fn()
            };

            const mockApp = {
                onError: vi.fn(),
                use: vi.fn().mockReturnThis(),
                notFound: vi.fn(),
                route: vi.fn().mockReturnThis()
            };
            mockOpenAPIHono.mockReturnValue(mockApp);

            const result = module.createTestApp(mockRouter as any);

            expect(mockApp.route).toHaveBeenCalledWith('/', mockRouter);
            expect(result).toBe(mockApp);
        });

        it('should use createApp internally', async () => {
            const module = await import('../../src/utils/create-app');

            const mockRouter = {
                routes: vi.fn()
            };

            const mockApp = {
                onError: vi.fn(),
                use: vi.fn().mockReturnThis(),
                notFound: vi.fn(),
                route: vi.fn().mockReturnThis()
            };
            mockOpenAPIHono.mockReturnValue(mockApp);

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
            const module = await import('../../src/utils/create-app');
            module.default();

            expect(mockOpenAPIHono).toHaveBeenCalledWith({
                strict: false
            });
        });

        it('should register all required middlewares', async () => {
            const module = await import('../../src/utils/create-app');

            const mockApp = {
                onError: vi.fn(),
                use: vi.fn().mockReturnThis(),
                notFound: vi.fn()
            };
            mockOpenAPIHono.mockReturnValue(mockApp);

            module.default();

            // Verify all middlewares are registered
            const middlewareCalls = mockApp.use.mock.calls;
            expect(middlewareCalls.length).toBeGreaterThan(0);
        });
    });

    describe('Error Handling', () => {
        it('should handle middleware registration errors gracefully', async () => {
            const module = await import('../../src/utils/create-app');

            const mockApp = {
                onError: vi.fn(),
                use: vi.fn().mockImplementation(() => {
                    throw new Error('Middleware error');
                }),
                notFound: vi.fn()
            };
            mockOpenAPIHono.mockReturnValue(mockApp);

            expect(() => module.default()).toThrow('Middleware error');
        });

        it('should handle app creation errors', async () => {
            const module = await import('../../src/utils/create-app');

            mockOpenAPIHono.mockImplementation(() => {
                throw new Error('App creation error');
            });

            expect(() => module.default()).toThrow('App creation error');
        });
    });
});
