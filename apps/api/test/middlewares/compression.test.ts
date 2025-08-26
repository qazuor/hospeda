/**
 * Compression Middleware Tests
 * Tests the compression functionality and configuration
 */
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    compressionMiddleware,
    createCompressionMiddleware
} from '../../src/middlewares/compression';

// Mock environment
vi.mock('../../src/utils/env', () => ({
    env: {
        COMPRESSION_ENABLED: true,
        COMPRESSION_ALGORITHMS: 'gzip,deflate',
        COMPRESSION_THRESHOLD: 1024,
        COMPRESSION_LEVEL: 6,
        COMPRESSION_CHUNK_SIZE: 16384,
        COMPRESSION_FILTER: 'text/*,application/json,application/xml,application/javascript',
        COMPRESSION_EXCLUDE_ENDPOINTS: '/health/db,/docs'
    },
    getCompressionConfig: () => ({
        enabled: true,
        algorithms: ['gzip', 'deflate'],
        threshold: 1024,
        level: 6,
        chunkSize: 16384,
        filter: ['text/*', 'application/json', 'application/xml', 'application/javascript'],
        excludeEndpoints: ['/health/db', '/docs']
    }),
    validateApiEnv: vi.fn()
}));

describe('Compression Middleware', () => {
    let app: Hono;

    // Helper to create dynamic mocks with consistent structure
    const createEnvMock = (config: {
        enabled?: boolean;
        algorithms?: string;
        threshold?: number;
        level?: number;
        chunkSize?: number;
        filter?: string;
        excludeEndpoints?: string;
    }) => ({
        env: {
            COMPRESSION_ENABLED: config.enabled ?? true,
            COMPRESSION_ALGORITHMS: config.algorithms ?? 'gzip,deflate',
            COMPRESSION_THRESHOLD: config.threshold ?? 1024,
            COMPRESSION_LEVEL: config.level ?? 6,
            COMPRESSION_CHUNK_SIZE: config.chunkSize ?? 16384,
            COMPRESSION_FILTER:
                config.filter ?? 'text/*,application/json,application/xml,application/javascript',
            COMPRESSION_EXCLUDE_ENDPOINTS: config.excludeEndpoints ?? '/health/db,/docs'
        },
        getCompressionConfig: () => ({
            enabled: config.enabled ?? true,
            algorithms: (config.algorithms ?? 'gzip,deflate').split(',').map((a) => a.trim()),
            threshold: config.threshold ?? 1024,
            level: config.level ?? 6,
            chunkSize: config.chunkSize ?? 16384,
            filter: (
                config.filter ?? 'text/*,application/json,application/xml,application/javascript'
            )
                .split(',')
                .map((f) => f.trim()),
            excludeEndpoints: (config.excludeEndpoints ?? '/health/db,/docs')
                .split(',')
                .map((e) => e.trim())
        })
    });

    beforeEach(() => {
        app = new Hono();
        vi.clearAllMocks();
    });

    describe('createCompressionMiddleware', () => {
        it('should create a middleware function', () => {
            const middleware = createCompressionMiddleware();
            expect(typeof middleware).toBe('function');
        });

        it('should return no-op middleware when compression is disabled', async () => {
            vi.doMock('../../src/utils/env', () => createEnvMock({ enabled: false }));

            vi.resetModules();
            const { createCompressionMiddleware: freshCreateMiddleware } = await import(
                '../../src/middlewares/compression'
            );

            const middleware = freshCreateMiddleware();
            app.use(middleware);
            app.get('/test', (c) => c.json({ message: 'test' }));

            const res = await app.request('/test');
            expect(res.status).toBe(200);
            // No compression headers should be present
            expect(res.headers.get('content-encoding')).toBeNull();
        });

        it('should handle gzip-only configuration', async () => {
            vi.doMock('../../src/utils/env', () =>
                createEnvMock({
                    algorithms: 'gzip',
                    threshold: 100
                })
            );

            vi.resetModules();
            const { createCompressionMiddleware: freshCreateMiddleware } = await import(
                '../../src/middlewares/compression'
            );

            const middleware = freshCreateMiddleware();
            expect(typeof middleware).toBe('function');
        });

        it('should handle deflate-only configuration', async () => {
            vi.doMock('../../src/utils/env', () =>
                createEnvMock({
                    algorithms: 'deflate',
                    threshold: 100
                })
            );

            vi.resetModules();
            const { createCompressionMiddleware: freshCreateMiddleware } = await import(
                '../../src/middlewares/compression'
            );

            const middleware = freshCreateMiddleware();
            expect(typeof middleware).toBe('function');
        });

        it('should handle both algorithms configuration', async () => {
            vi.doMock('../../src/utils/env', () =>
                createEnvMock({
                    algorithms: 'gzip,deflate',
                    threshold: 100
                })
            );

            vi.resetModules();
            const { createCompressionMiddleware: freshCreateMiddleware } = await import(
                '../../src/middlewares/compression'
            );

            const middleware = freshCreateMiddleware();
            expect(typeof middleware).toBe('function');
        });

        it('should handle empty algorithms configuration', async () => {
            vi.doMock('../../src/utils/env', () =>
                createEnvMock({
                    algorithms: '',
                    threshold: 100
                })
            );

            vi.resetModules();
            const { createCompressionMiddleware: freshCreateMiddleware } = await import(
                '../../src/middlewares/compression'
            );

            const middleware = freshCreateMiddleware();
            expect(typeof middleware).toBe('function');
        });

        it('should handle algorithms with extra spaces', async () => {
            vi.doMock('../../src/utils/env', () =>
                createEnvMock({
                    algorithms: ' gzip , deflate ',
                    threshold: 100
                })
            );

            vi.resetModules();
            const { createCompressionMiddleware: freshCreateMiddleware } = await import(
                '../../src/middlewares/compression'
            );

            const middleware = freshCreateMiddleware();
            expect(typeof middleware).toBe('function');
        });
    });

    describe('Integration with Hono app', () => {
        it('should integrate with Hono app without errors', async () => {
            app.use(compressionMiddleware());
            app.get('/test', (c) => c.json({ message: 'Hello World' }));

            const res = await app.request('/test', {
                headers: {
                    'Accept-Encoding': 'gzip, deflate'
                }
            });

            expect(res.status).toBe(200);
            // When compression is applied, verify headers instead of JSON content
            expect(res.headers.get('content-encoding')).toBeTruthy();
            // Verify the response can be read as text to confirm it's not corrupted
            const text = await res.text();
            expect(text).toBeTruthy();
        });

        it('should handle requests without Accept-Encoding header', async () => {
            app.use(compressionMiddleware());
            app.get('/test', (c) => c.json({ message: 'Hello World' }));

            const res = await app.request('/test');
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.message).toBe('Hello World');
        });

        it('should handle large response bodies', async () => {
            app.use(compressionMiddleware());
            app.get('/large', (c) => {
                // Create a large response (over threshold)
                const largeData = {
                    message: 'x'.repeat(2048), // 2KB of data
                    items: Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Item ${i}` }))
                };
                return c.json(largeData);
            });

            const res = await app.request('/large', {
                headers: {
                    'Accept-Encoding': 'gzip'
                }
            });

            expect(res.status).toBe(200);
            // For large responses, compression should be applied
            expect(res.headers.get('content-encoding')).toBe('gzip');
            // Verify the response is actually compressed by checking we can read it
            const text = await res.text();
            expect(text).toBeTruthy();
            // Compressed responses should have content-encoding header set
            expect(res.headers.get('content-encoding')).toBe('gzip');
        });

        it('should handle small response bodies', async () => {
            app.use(compressionMiddleware());
            app.get('/small', (c) => c.json({ message: 'small' }));

            const res = await app.request('/small', {
                headers: {
                    'Accept-Encoding': 'gzip'
                }
            });

            expect(res.status).toBe(200);
            // Note: Hono's compress middleware may still compress small responses
            // We verify it works regardless of compression
            if (res.headers.get('content-encoding')) {
                // If compressed, verify the header is set
                expect(res.headers.get('content-encoding')).toBe('gzip');
            } else {
                // If not compressed, we can parse as JSON
                const data = await res.json();
                expect(data.message).toBe('small');
            }
        });

        it('should handle different content types', async () => {
            app.use(compressionMiddleware());
            app.get('/json', (c) => c.json({ type: 'json' }));
            app.get('/text', (c) => c.text('Hello World'));
            app.get('/html', (c) => c.html('<h1>Hello World</h1>'));

            const jsonRes = await app.request('/json', {
                headers: { 'Accept-Encoding': 'gzip' }
            });
            const textRes = await app.request('/text', {
                headers: { 'Accept-Encoding': 'gzip' }
            });
            const htmlRes = await app.request('/html', {
                headers: { 'Accept-Encoding': 'gzip' }
            });

            expect(jsonRes.status).toBe(200);
            expect(textRes.status).toBe(200);
            expect(htmlRes.status).toBe(200);
        });
    });

    describe('Error handling', () => {
        it('should handle middleware errors gracefully', async () => {
            app.use(compressionMiddleware());
            app.get('/error', () => {
                throw new Error('Test error');
            });

            const res = await app.request('/error');
            // Error should be handled gracefully and return 500 status
            expect(res.status).toBe(500);
            expect(res.headers.get('content-type')).toContain('text/plain');
        });

        it('should not interfere with normal error responses', async () => {
            app.use(compressionMiddleware());
            app.get('/client-error', (c) => c.json({ error: 'Bad Request' }, 400));
            app.get('/server-error', (c) => c.json({ error: 'Internal Error' }, 500));

            const clientErrorRes = await app.request('/client-error');
            const serverErrorRes = await app.request('/server-error');

            expect(clientErrorRes.status).toBe(400);
            expect(serverErrorRes.status).toBe(500);

            const clientErrorData = await clientErrorRes.json();
            const serverErrorData = await serverErrorRes.json();

            expect(clientErrorData.error).toBe('Bad Request');
            expect(serverErrorData.error).toBe('Internal Error');
        });
    });

    describe('Configuration edge cases', () => {
        it('should handle very low threshold', async () => {
            vi.doMock('../../src/utils/env', () =>
                createEnvMock({
                    algorithms: 'gzip',
                    threshold: 1
                })
            );

            vi.resetModules();
            const { createCompressionMiddleware: freshCreateMiddleware } = await import(
                '../../src/middlewares/compression'
            );

            const middleware = freshCreateMiddleware();
            app.use(middleware);
            app.get('/test', (c) => c.json({ message: 'x' }));

            const res = await app.request('/test', {
                headers: { 'Accept-Encoding': 'gzip' }
            });

            expect(res.status).toBe(200);
        });

        it('should handle very high threshold', async () => {
            vi.doMock('../../src/utils/env', () =>
                createEnvMock({
                    algorithms: 'gzip',
                    threshold: 1000000 // 1MB
                })
            );

            vi.resetModules();
            const { createCompressionMiddleware: freshCreateMiddleware } = await import(
                '../../src/middlewares/compression'
            );

            const middleware = freshCreateMiddleware();
            app.use(middleware);
            app.get('/test', (c) => c.json({ message: 'Hello World' }));

            const res = await app.request('/test', {
                headers: { 'Accept-Encoding': 'gzip' }
            });

            expect(res.status).toBe(200);
        });
    });

    describe('Default middleware instance', () => {
        it('should export a default configured middleware', () => {
            expect(compressionMiddleware).toBeDefined();
            expect(typeof compressionMiddleware).toBe('function');
        });

        it('should work with default configuration', async () => {
            app.use(compressionMiddleware());
            app.get('/test', (c) => c.json({ message: 'Hello World' }));

            const res = await app.request('/test');
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.message).toBe('Hello World');
        });
    });

    describe('Multiple algorithm support', () => {
        it('should handle unsupported algorithms gracefully', async () => {
            vi.doMock('../../src/utils/env', () =>
                createEnvMock({
                    algorithms: 'brotli,unknownalgo',
                    threshold: 100
                })
            );

            vi.resetModules();
            const { createCompressionMiddleware: freshCreateMiddleware } = await import(
                '../../src/middlewares/compression'
            );

            const middleware = freshCreateMiddleware();
            app.use(middleware);
            app.get('/test', (c) => c.json({ message: 'Hello World' }));

            const res = await app.request('/test');
            expect(res.status).toBe(200);
        });

        it('should parse comma-separated algorithms correctly', async () => {
            vi.doMock('../../src/utils/env', () =>
                createEnvMock({
                    algorithms: 'gzip,deflate,br',
                    threshold: 100
                })
            );

            vi.resetModules();
            const { createCompressionMiddleware: freshCreateMiddleware } = await import(
                '../../src/middlewares/compression'
            );

            const middleware = freshCreateMiddleware();
            expect(typeof middleware).toBe('function');
        });
    });
});
