import { Hono } from 'hono';
/**
 * Logger Middleware Tests
 * Tests the logging functionality for API requests and responses
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loggerMiddleware } from '../../src/middlewares/logger';

// Mock the logger with proper structure
vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        permission: vi.fn()
    }
}));

// Mock environment
vi.mock('../../src/utils/env', () => ({
    env: {
        LOG_LEVEL: 'info'
    },
    validateApiEnv: vi.fn()
}));

describe('Logger Middleware', () => {
    let app: Hono;

    beforeEach(() => {
        app = new Hono();
        app.use(loggerMiddleware);
        app.get('/test', (c) => c.json({ message: 'success' }));
        app.get('/error', (c) => c.json({ error: 'test error' }, 400));
        app.get('/server-error', (c) => c.json({ error: 'server error' }, 500));

        // Clear all mocks
        vi.clearAllMocks();
    });

    describe('Request Logging', () => {
        it('should log successful requests with info level', async () => {
            const res = await app.request('/test');

            expect(res.status).toBe(200);
            expect(
                vi.mocked(await import('../../src/utils/logger')).apiLogger.info
            ).toHaveBeenCalledWith(
                expect.stringContaining('GET http://localhost/test 200'),
                'SUCCESS'
            );
        });

        it('should log client errors with warn level', async () => {
            const res = await app.request('/error');

            expect(res.status).toBe(400);
            expect(
                vi.mocked(await import('../../src/utils/logger')).apiLogger.warn
            ).toHaveBeenCalledWith(
                expect.stringContaining('GET http://localhost/error 400'),
                'WARNING'
            );
        });

        it('should log server errors with error level', async () => {
            const res = await app.request('/server-error');

            expect(res.status).toBe(500);
            expect(
                vi.mocked(await import('../../src/utils/logger')).apiLogger.error
            ).toHaveBeenCalledWith(
                expect.stringContaining('GET http://localhost/server-error 500'),
                'ERROR'
            );
        });

        it('should include timing information in log messages', async () => {
            await app.request('/test');

            expect(
                vi.mocked(await import('../../src/utils/logger')).apiLogger.info
            ).toHaveBeenCalledWith(
                expect.stringMatching(/GET http:\/\/localhost\/test 200 \d+ms/),
                'SUCCESS'
            );
        });
    });

    describe('Different HTTP Methods', () => {
        it('should log POST requests correctly', async () => {
            app.post('/test', (c) => c.json({ message: 'posted' }));

            await app.request('/test', { method: 'POST' });

            expect(
                vi.mocked(await import('../../src/utils/logger')).apiLogger.info
            ).toHaveBeenCalledWith(
                expect.stringContaining('POST http://localhost/test 200'),
                'SUCCESS'
            );
        });

        it('should log PUT requests correctly', async () => {
            app.put('/test', (c) => c.json({ message: 'updated' }));

            await app.request('/test', { method: 'PUT' });

            expect(
                vi.mocked(await import('../../src/utils/logger')).apiLogger.info
            ).toHaveBeenCalledWith(
                expect.stringContaining('PUT http://localhost/test 200'),
                'SUCCESS'
            );
        });

        it('should log DELETE requests correctly', async () => {
            app.delete('/test', (c) => c.json({ message: 'deleted' }));

            await app.request('/test', { method: 'DELETE' });

            expect(
                vi.mocked(await import('../../src/utils/logger')).apiLogger.info
            ).toHaveBeenCalledWith(
                expect.stringContaining('DELETE http://localhost/test 200'),
                'SUCCESS'
            );
        });
    });

    describe('Error Handling', () => {
        it('should handle middleware errors gracefully', async () => {
            app.get('/middleware-error', () => {
                throw new Error('Middleware error');
            });

            await app.request('/middleware-error');

            expect(
                vi.mocked(await import('../../src/utils/logger')).apiLogger.error
            ).toHaveBeenCalledWith(
                expect.stringContaining('GET http://localhost/middleware-error 500'),
                'ERROR'
            );
        });

        it('should log timing even when errors occur', async () => {
            app.get('/timing-error', () => {
                throw new Error('Timing error');
            });

            await app.request('/timing-error');

            expect(
                vi.mocked(await import('../../src/utils/logger')).apiLogger.error
            ).toHaveBeenCalledWith(
                expect.stringMatching(/GET http:\/\/localhost\/timing-error 500 \d+ms/),
                'ERROR'
            );
        });
    });

    describe('URL Logging', () => {
        it('should log full URLs including query parameters', async () => {
            await app.request('/test?param=value&other=123');

            expect(
                vi.mocked(await import('../../src/utils/logger')).apiLogger.info
            ).toHaveBeenCalledWith(
                expect.stringContaining('GET http://localhost/test?param=value&other=123 200'),
                'SUCCESS'
            );
        });

        it('should log URLs with path parameters', async () => {
            app.get('/users/:id', (c) => c.json({ id: c.req.param('id') }));

            await app.request('/users/123');

            expect(
                vi.mocked(await import('../../src/utils/logger')).apiLogger.info
            ).toHaveBeenCalledWith(
                expect.stringContaining('GET http://localhost/users/123 200'),
                'SUCCESS'
            );
        });
    });
});
