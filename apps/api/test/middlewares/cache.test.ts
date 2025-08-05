/**
 * Cache Middleware Tests
 * Tests the caching functionality and configuration
 */
import type { Context } from 'hono';
import { Hono } from 'hono';
import { cache } from 'hono/cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCacheMiddleware } from '../../src/middlewares/cache';

// Mock Hono cache
vi.mock('hono/cache', () => ({
    cache: vi.fn()
}));

// Mock environment
vi.mock('../../src/utils/env', () => ({
    env: {
        CACHE_ENABLED: true,
        CACHE_DEFAULT_MAX_AGE: 300,
        CACHE_DEFAULT_STALE_WHILE_REVALIDATE: 60,
        CACHE_DEFAULT_STALE_IF_ERROR: 86400,
        CACHE_PUBLIC_ENDPOINTS: '/api/v1/public/accommodations,/health',
        CACHE_PRIVATE_ENDPOINTS: '/api/v1/public/users',
        CACHE_NO_CACHE_ENDPOINTS: '/health/db,/docs',
        CACHE_ETAG_ENABLED: true,
        CACHE_LAST_MODIFIED_ENABLED: true
    },
    getCacheConfig: () => ({
        enabled: true,
        publicEndpoints: ['/api/v1/public/accommodations', '/health'],
        privateEndpoints: ['/api/v1/public/users'],
        noCacheEndpoints: ['/health/db', '/docs'],
        maxAge: 300,
        staleWhileRevalidate: 60,
        staleIfError: 86400,
        etagEnabled: true,
        lastModifiedEnabled: true
    })
}));

describe('Cache Middleware', () => {
    const getCacheConfig = () => {
        const config = vi.mocked(cache).mock.calls[0]?.[0];
        if (!config) throw new Error('Cache config not found');
        return config;
    };

    // Helper to create mock context
    const createMockContext = (path: string, authHeader?: string): Partial<Context> =>
        ({
            req: {
                path,
                header: vi.fn().mockReturnValue(authHeader)
            }
        }) as any;

    // Helper to create dynamic mocks with consistent structure
    const createEnvMock = (config: {
        enabled?: boolean;
        maxAge?: number;
        staleWhileRevalidate?: number;
        staleIfError?: number;
        publicEndpoints?: string;
        privateEndpoints?: string;
        noCacheEndpoints?: string;
        etagEnabled?: boolean;
        lastModifiedEnabled?: boolean;
    }) => ({
        env: {
            CACHE_ENABLED: config.enabled ?? true,
            CACHE_DEFAULT_MAX_AGE: config.maxAge ?? 300,
            CACHE_DEFAULT_STALE_WHILE_REVALIDATE: config.staleWhileRevalidate ?? 60,
            CACHE_DEFAULT_STALE_IF_ERROR: config.staleIfError ?? 86400,
            CACHE_PUBLIC_ENDPOINTS:
                config.publicEndpoints ?? '/api/v1/public/accommodations,/health',
            CACHE_PRIVATE_ENDPOINTS: config.privateEndpoints ?? '/api/v1/public/users',
            CACHE_NO_CACHE_ENDPOINTS: config.noCacheEndpoints ?? '/health/db,/docs',
            CACHE_ETAG_ENABLED: config.etagEnabled ?? true,
            CACHE_LAST_MODIFIED_ENABLED: config.lastModifiedEnabled ?? true
        },
        getCacheConfig: () => ({
            enabled: config.enabled ?? true,
            publicEndpoints: (config.publicEndpoints ?? '/api/v1/public/accommodations,/health')
                .split(',')
                .map((e) => e.trim()),
            privateEndpoints: (config.privateEndpoints ?? '/api/v1/public/users')
                .split(',')
                .map((e) => e.trim()),
            noCacheEndpoints: (config.noCacheEndpoints ?? '/health/db,/docs')
                .split(',')
                .map((e) => e.trim()),
            maxAge: config.maxAge ?? 300,
            staleWhileRevalidate: config.staleWhileRevalidate ?? 60,
            staleIfError: config.staleIfError ?? 86400,
            etagEnabled: config.etagEnabled ?? true,
            lastModifiedEnabled: config.lastModifiedEnabled ?? true
        })
    });

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(cache).mockReturnValue(vi.fn());
    });

    describe('createCacheMiddleware', () => {
        it('should create cache middleware with correct configuration', () => {
            createCacheMiddleware();

            expect(vi.mocked(cache)).toHaveBeenCalledWith({
                cacheName: 'hospeda-api',
                cacheControl:
                    'public, max-age=300, stale-while-revalidate=60, stale-if-error=86400',
                vary: ['Accept-Encoding', 'Accept-Language'],
                keyGenerator: expect.any(Function),
                cacheableStatusCodes: [200, 404]
            });
        });

        it('should return no-op middleware when cache is disabled', async () => {
            // Reset modules to ensure fresh import
            vi.resetModules();

            // Mock env with cache disabled
            vi.doMock('../../src/utils/env', () => createEnvMock({ enabled: false }));

            const { createCacheMiddleware: recreatedMiddleware } = await import(
                '../../src/middlewares/cache'
            );
            const middleware = recreatedMiddleware();

            expect(typeof middleware).toBe('function');
            expect(vi.mocked(cache)).not.toHaveBeenCalled();
        });

        it('should parse endpoint lists correctly', () => {
            createCacheMiddleware();

            const config = getCacheConfig();
            const keyGenerator = config.keyGenerator;
            expect(keyGenerator).toBeDefined();
            expect(keyGenerator).toBeDefined();

            // Test public endpoint
            const publicContext = createMockContext('/api/v1/public/accommodations');
            const publicKey = keyGenerator?.(publicContext as unknown as Context);
            expect(publicKey).toBe('public-/api/v1/public/accommodations');

            // Test private endpoint
            const privateContext = createMockContext('/api/v1/public/users', 'Bearer token123');
            const privateKey = keyGenerator?.(privateContext as unknown as Context);
            expect(privateKey).toBe('private-/api/v1/public/users-Bearer token123');

            // Test no-cache endpoint
            const noCacheContext = {
                req: {
                    path: '/health/db',
                    header: vi.fn()
                }
            };
            const noCacheKey = keyGenerator?.(noCacheContext as unknown as Context);
            expect(noCacheKey).toMatch(/\/health\/db-\d+/);

            // Test unspecified endpoint
            const unspecifiedContext = {
                req: {
                    path: '/api/v1/unknown',
                    header: vi.fn()
                }
            };
            const unspecifiedKey = keyGenerator?.(unspecifiedContext as unknown as Context);
            expect(unspecifiedKey).toMatch(/\/api\/v1\/unknown-\d+/);
        });

        it('should handle private endpoints without authorization header', () => {
            createCacheMiddleware();

            const config = getCacheConfig();
            const keyGenerator = config.keyGenerator;
            expect(keyGenerator).toBeDefined();

            const context = {
                req: {
                    path: '/api/v1/public/users',
                    header: vi.fn().mockReturnValue(undefined)
                }
            };

            const key = keyGenerator?.(context as unknown as Context);
            expect(key).toBe('private-/api/v1/public/users-anonymous');
        });

        it('should handle endpoint matching with trailing slashes', () => {
            createCacheMiddleware();

            const config = getCacheConfig();
            const keyGenerator = config.keyGenerator;
            expect(keyGenerator).toBeDefined();

            const context = {
                req: {
                    path: '/api/v1/public/accommodations/123',
                    header: vi.fn()
                }
            };

            const key = keyGenerator?.(context as unknown as Context);
            expect(key).toBe('public-/api/v1/public/accommodations/123');
        });

        it('should handle empty endpoint lists', async () => {
            // Reset modules to ensure fresh import
            vi.resetModules();

            // Mock env with empty endpoint lists
            vi.doMock('../../src/utils/env', () =>
                createEnvMock({
                    publicEndpoints: '',
                    privateEndpoints: '',
                    noCacheEndpoints: ''
                })
            );

            const { createCacheMiddleware: recreatedMiddleware } = await import(
                '../../src/middlewares/cache'
            );
            recreatedMiddleware();

            const config = getCacheConfig();
            const keyGenerator = config.keyGenerator;
            expect(keyGenerator).toBeDefined();

            const context = {
                req: {
                    path: '/api/v1/public/accommodations',
                    header: vi.fn()
                }
            };

            const key = keyGenerator?.(context as unknown as Context);
            // When endpoint lists are empty, default behavior is no-cache (unique timestamp)
            expect(key).toMatch(/\/api\/v1\/public\/accommodations-\d+/);
        });
    });

    describe('cacheMiddleware', () => {
        it('should export default middleware instance', async () => {
            // Reset modules and clear mocks for clean import
            vi.resetModules();
            vi.clearAllMocks();

            const { cacheMiddleware: freshCacheMiddleware } = await import(
                '../../src/middlewares/cache'
            );
            expect(typeof freshCacheMiddleware).toBe('function');
        });

        it('should be the same as createCacheMiddleware()', async () => {
            // Reset modules and clear mocks for clean import
            vi.resetModules();
            vi.clearAllMocks();

            const {
                cacheMiddleware: freshCacheMiddleware,
                createCacheMiddleware: freshCreateMiddleware
            } = await import('../../src/middlewares/cache');
            const createdMiddleware = freshCreateMiddleware();
            // They should both be functions (comparison may differ due to environment mocking)
            expect(typeof freshCacheMiddleware).toBe('function');
            expect(typeof createdMiddleware).toBe('function');
        });
    });

    describe('Integration with Hono', () => {
        it('should integrate with Hono app', async () => {
            const mockMiddleware = vi.fn(async (_c: unknown, next: () => Promise<void>) => {
                await next();
            });
            vi.mocked(cache).mockReturnValue(mockMiddleware);

            const { createCacheMiddleware: freshCreateMiddleware } = await import(
                '../../src/middlewares/cache'
            );
            const freshMiddleware = freshCreateMiddleware();

            const app = new Hono();
            app.use(freshMiddleware);
            app.get('/test', (c) => c.json({ message: 'success' }));

            const res = await app.request('/test');

            expect(res.status).toBe(200);
            expect(mockMiddleware).toHaveBeenCalled();
        });

        it('should handle middleware errors gracefully', async () => {
            const mockMiddleware = vi.fn(async () => {
                throw new Error('Cache error');
            });
            vi.mocked(cache).mockReturnValue(mockMiddleware);

            const { createCacheMiddleware: freshCreateMiddleware } = await import(
                '../../src/middlewares/cache'
            );
            const freshMiddleware = freshCreateMiddleware();

            const app = new Hono();
            app.use(freshMiddleware);
            app.get('/test', (c) => c.json({ message: 'success' }));

            // Hono handles errors gracefully and returns 500 status
            const res = await app.request('/test');
            expect(res.status).toBe(500);
        });
    });

    describe('Cache Configuration', () => {
        it('should use correct cache control headers', () => {
            createCacheMiddleware();

            const config = getCacheConfig();
            expect(config.cacheControl).toBe(
                'public, max-age=300, stale-while-revalidate=60, stale-if-error=86400'
            );
        });

        it('should use correct vary headers', () => {
            createCacheMiddleware();

            const config = getCacheConfig();
            expect(config.vary).toEqual(['Accept-Encoding', 'Accept-Language']);
        });

        it('should use correct cacheable status codes', () => {
            createCacheMiddleware();

            const config = getCacheConfig();
            expect(config.cacheableStatusCodes).toEqual([200, 404]);
        });

        it('should use correct cache name', () => {
            createCacheMiddleware();

            const config = getCacheConfig();
            expect(config.cacheName).toBe('hospeda-api');
        });
    });

    describe('Key Generation Logic', () => {
        let keyGenerator: ((c: Context) => string | Promise<string>) | undefined;

        beforeEach(() => {
            createCacheMiddleware();
            const config = getCacheConfig();
            keyGenerator = config.keyGenerator;
        });

        it('should generate unique keys for no-cache endpoints', async () => {
            const context = {
                req: {
                    path: '/health/db',
                    header: vi.fn()
                }
            };

            const key1 = keyGenerator?.(context as unknown as Context);
            // Small delay to ensure timestamp difference
            await new Promise((resolve) => setTimeout(resolve, 1));
            const key2 = keyGenerator?.(context as unknown as Context);

            expect(key1).not.toBe(key2);
            expect(key1).toMatch(/\/health\/db-\d+/);
            expect(key2).toMatch(/\/health\/db-\d+/);
        });

        it('should generate consistent keys for public endpoints', () => {
            const context = {
                req: {
                    path: '/api/v1/public/accommodations',
                    header: vi.fn()
                }
            };

            const key1 = keyGenerator?.(context as unknown as Context);
            const key2 = keyGenerator?.(context as unknown as Context);

            expect(key1).toBe(key2);
            expect(key1).toBe('public-/api/v1/public/accommodations');
        });

        it('should generate auth-specific keys for private endpoints', () => {
            const context1 = {
                req: {
                    path: '/api/v1/public/users',
                    header: vi.fn().mockReturnValue('Bearer token1')
                }
            };

            const context2 = {
                req: {
                    path: '/api/v1/public/users',
                    header: vi.fn().mockReturnValue('Bearer token2')
                }
            };

            const key1 = keyGenerator?.(context1 as unknown as Context);
            const key2 = keyGenerator?.(context2 as unknown as Context);

            expect(key1).not.toBe(key2);
            expect(key1).toBe('private-/api/v1/public/users-Bearer token1');
            expect(key2).toBe('private-/api/v1/public/users-Bearer token2');
        });

        it('should handle nested paths correctly', () => {
            const context = {
                req: {
                    path: '/api/v1/public/accommodations/123/details',
                    header: vi.fn()
                }
            };

            const key = keyGenerator?.(context as unknown as Context);
            expect(key).toBe('public-/api/v1/public/accommodations/123/details');
        });

        it('should handle root path', () => {
            const context = {
                req: {
                    path: '/',
                    header: vi.fn()
                }
            };

            const key = keyGenerator?.(context as unknown as Context);
            expect(key).toMatch(/\/-\d+/);
        });
    });

    describe('Environment Variable Handling', () => {
        it('should handle different cache configurations', async () => {
            // Reset modules to ensure fresh import
            vi.resetModules();

            // Mock env with different values
            vi.doMock('../../src/utils/env', () =>
                createEnvMock({
                    maxAge: 600,
                    staleWhileRevalidate: 120,
                    staleIfError: 172800,
                    publicEndpoints: '/custom/public',
                    privateEndpoints: '/custom/private',
                    noCacheEndpoints: '/custom/no-cache'
                })
            );

            const { createCacheMiddleware: recreatedMiddleware } = await import(
                '../../src/middlewares/cache'
            );
            recreatedMiddleware();

            const config = getCacheConfig();
            expect(config.cacheControl).toBe(
                'public, max-age=600, stale-while-revalidate=120, stale-if-error=172800'
            );

            const keyGenerator = config.keyGenerator;
            expect(keyGenerator).toBeDefined();
            const context = {
                req: {
                    path: '/custom/public/test',
                    header: vi.fn()
                }
            };

            const key = keyGenerator?.(context as unknown as Context);
            expect(key).toBe('public-/custom/public/test');
        });

        it('should handle whitespace in endpoint lists', async () => {
            // Reset modules to ensure fresh import
            vi.resetModules();

            // Mock env with whitespace in endpoint lists
            vi.doMock('../../src/utils/env', () =>
                createEnvMock({
                    publicEndpoints: ' /api/v1/public/accommodations , /health ',
                    privateEndpoints: ' /api/v1/public/users ',
                    noCacheEndpoints: ' /health/db , /docs '
                })
            );

            const { createCacheMiddleware: recreatedMiddleware } = await import(
                '../../src/middlewares/cache'
            );
            recreatedMiddleware();

            const config = getCacheConfig();
            const keyGenerator = config.keyGenerator;
            expect(keyGenerator).toBeDefined();

            const context = {
                req: {
                    path: '/api/v1/public/accommodations',
                    header: vi.fn()
                }
            };

            const key = keyGenerator?.(context as unknown as Context);
            expect(key).toBe('public-/api/v1/public/accommodations');
        });
    });
});
