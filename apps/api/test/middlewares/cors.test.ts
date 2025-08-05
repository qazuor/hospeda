import { Hono } from 'hono';
/**
 * CORS Middleware Tests
 * Tests the Cross-Origin Resource Sharing functionality
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCorsMiddleware } from '../../src/middlewares/cors';

// Mock environment
vi.mock('../../src/utils/env', () => ({
    env: {
        CORS_ORIGINS: 'http://localhost:3000,http://localhost:5173',
        CORS_ALLOW_CREDENTIALS: true,
        CORS_MAX_AGE: 86400,
        CORS_ALLOW_METHODS: 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
        CORS_ALLOW_HEADERS: 'Content-Type,Authorization,X-Requested-With',
        CORS_EXPOSE_HEADERS: 'Content-Length,X-Request-ID'
    },
    getCorsConfig: () => ({
        origins: ['http://localhost:3000', 'http://localhost:5173'],
        allowCredentials: true,
        maxAge: 86400,
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        exposeHeaders: ['Content-Length', 'X-Request-ID']
    })
}));

describe('CORS Middleware', () => {
    let app: Hono;

    beforeEach(() => {
        app = new Hono();
        app.use(createCorsMiddleware());
        app.get('/test', (c) => c.json({ message: 'success' }));
        app.post('/test', (c) => c.json({ message: 'posted' }));
        app.options('/test', (c) => c.json({}));
    });

    describe('Origin Handling', () => {
        it('should allow requests from configured origins', async () => {
            const res = await app.request('/test', {
                headers: {
                    Origin: 'http://localhost:3000'
                }
            });

            expect(res.status).toBe(200);
            expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
        });

        it('should allow requests from multiple configured origins', async () => {
            const res = await app.request('/test', {
                headers: {
                    Origin: 'http://localhost:5173'
                }
            });

            expect(res.status).toBe(200);
            expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
        });

        it('should reject requests from non-configured origins', async () => {
            const res = await app.request('/test', {
                headers: {
                    Origin: 'http://malicious-site.com'
                }
            });

            expect(res.status).toBe(200);
            // Should not include Access-Control-Allow-Origin for non-configured origins
            expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
        });

        it('should handle wildcard origin configuration', async () => {
            // Test with custom config instead of dynamic mock
            const wildcardApp = new Hono();
            wildcardApp.use(createCorsMiddleware({ origin: '*' }));
            wildcardApp.get('/test', (c) => c.json({ message: 'success' }));

            const res = await wildcardApp.request('/test', {
                headers: {
                    Origin: 'http://any-site.com'
                }
            });

            expect(res.status).toBe(200);
            expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
        });
    });

    describe('Preflight Requests', () => {
        it('should handle OPTIONS preflight requests', async () => {
            const res = await app.request('/test', {
                method: 'OPTIONS',
                headers: {
                    Origin: 'http://localhost:3000',
                    'Access-Control-Request-Method': 'POST',
                    'Access-Control-Request-Headers': 'Content-Type'
                }
            });

            expect(res.status).toBe(204);
            expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
            expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
            expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
        });

        it('should include max-age in preflight responses', async () => {
            const res = await app.request('/test', {
                method: 'OPTIONS',
                headers: {
                    Origin: 'http://localhost:3000',
                    'Access-Control-Request-Method': 'GET'
                }
            });

            expect(res.status).toBe(204);
            expect(res.headers.get('Access-Control-Max-Age')).toBe('86400');
        });
    });

    describe('Credentials Handling', () => {
        it('should include credentials header when allowed', async () => {
            const res = await app.request('/test', {
                headers: {
                    Origin: 'http://localhost:3000'
                }
            });

            expect(res.status).toBe(200);
            expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
        });

        it('should disable credentials for wildcard origin', async () => {
            // Test with custom config that should disable credentials
            const wildcardApp = new Hono();
            wildcardApp.use(
                createCorsMiddleware({
                    origin: '*',
                    credentials: false
                })
            );
            wildcardApp.get('/test', (c) => c.json({ message: 'success' }));

            const res = await wildcardApp.request('/test', {
                headers: {
                    Origin: 'http://any-site.com'
                }
            });

            expect(res.status).toBe(200);
            // CORS middleware may not include credentials header when false
            // This is implementation dependent - some middlewares omit the header entirely
            const credentialsHeader = res.headers.get('Access-Control-Allow-Credentials');
            expect(credentialsHeader === 'false' || credentialsHeader === null).toBe(true);
        });
    });

    describe('Headers Configuration', () => {
        it('should expose configured headers', async () => {
            const res = await app.request('/test', {
                headers: {
                    Origin: 'http://localhost:3000'
                }
            });

            expect(res.status).toBe(200);
            const exposeHeaders = res.headers.get('Access-Control-Expose-Headers');
            expect(exposeHeaders).toContain('Content-Length');
            expect(exposeHeaders).toContain('X-Request-ID');
        });

        it('should allow configured request headers', async () => {
            const res = await app.request('/test', {
                method: 'OPTIONS',
                headers: {
                    Origin: 'http://localhost:3000',
                    'Access-Control-Request-Headers': 'Content-Type,Authorization'
                }
            });

            expect(res.status).toBe(204);
            const allowHeaders = res.headers.get('Access-Control-Allow-Headers');
            expect(allowHeaders).toContain('Content-Type');
            expect(allowHeaders).toContain('Authorization');
        });
    });

    describe('Methods Configuration', () => {
        it('should allow configured HTTP methods', async () => {
            const res = await app.request('/test', {
                method: 'OPTIONS',
                headers: {
                    Origin: 'http://localhost:3000',
                    'Access-Control-Request-Method': 'POST'
                }
            });

            expect(res.status).toBe(204);
            const allowMethods = res.headers.get('Access-Control-Allow-Methods');
            expect(allowMethods).toContain('GET');
            expect(allowMethods).toContain('POST');
            expect(allowMethods).toContain('PUT');
            expect(allowMethods).toContain('DELETE');
            expect(allowMethods).toContain('PATCH');
            expect(allowMethods).toContain('OPTIONS');
        });
    });

    describe('Custom Configuration', () => {
        it('should allow custom CORS configuration', async () => {
            const customApp = new Hono();
            customApp.use(
                createCorsMiddleware({
                    origin: ['http://custom-origin.com'],
                    credentials: false
                })
            );
            customApp.get('/test', (c) => c.json({ message: 'success' }));

            const res = await customApp.request('/test', {
                headers: {
                    Origin: 'http://custom-origin.com'
                }
            });

            expect(res.status).toBe(200);
            expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://custom-origin.com');
            // Note: CORS middleware may not include credentials header when false
            // This is implementation dependent
            const credentialsHeader = res.headers.get('Access-Control-Allow-Credentials');
            expect(credentialsHeader === 'false' || credentialsHeader === null).toBe(true);
        });

        it('should merge custom config with environment config', async () => {
            const customApp = new Hono();
            customApp.use(
                createCorsMiddleware({
                    maxAge: 3600 // Override max age
                })
            );
            customApp.get('/test', (c) => c.json({ message: 'success' }));

            const res = await customApp.request('/test', {
                method: 'OPTIONS',
                headers: {
                    Origin: 'http://localhost:3000',
                    'Access-Control-Request-Method': 'GET'
                }
            });

            expect(res.status).toBe(204);
            expect(res.headers.get('Access-Control-Max-Age')).toBe('3600');
            // Should still use environment config for other settings
            expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
        });
    });

    describe('Error Handling', () => {
        it('should handle requests without origin header', async () => {
            const res = await app.request('/test');

            expect(res.status).toBe(200);
            // Should not include CORS headers for same-origin requests
            expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
        });

        it('should handle malformed origin headers', async () => {
            const res = await app.request('/test', {
                headers: {
                    Origin: 'invalid-origin'
                }
            });

            expect(res.status).toBe(200);
            expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
        });
    });

    describe('Environment Configuration', () => {
        it('should handle empty origins configuration', async () => {
            // Test with custom config that has no allowed origins
            const emptyApp = new Hono();
            emptyApp.use(createCorsMiddleware({ origin: [] }));
            emptyApp.get('/test', (c) => c.json({ message: 'success' }));

            const res = await emptyApp.request('/test', {
                headers: {
                    Origin: 'http://localhost:3000'
                }
            });

            expect(res.status).toBe(200);
            expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
        });

        it('should handle single origin configuration', async () => {
            // Test with custom config for single origin
            const singleApp = new Hono();
            singleApp.use(
                createCorsMiddleware({
                    origin: ['http://single-origin.com']
                })
            );
            singleApp.get('/test', (c) => c.json({ message: 'success' }));

            const res = await singleApp.request('/test', {
                headers: {
                    Origin: 'http://single-origin.com'
                }
            });

            expect(res.status).toBe(200);
            expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://single-origin.com');
        });
    });
});
