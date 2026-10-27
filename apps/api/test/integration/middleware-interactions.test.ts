/**
 * Middleware Interactions Integration Tests
 * Tests specific interactions between different middlewares to ensure they work
 * harmoniously together without interfering with each other's functionality.
 *
 * `/health/ready` is the happy-path probe (public, cached, standard envelope);
 * `GET /api/v1/admin/accommodations` is the uncached 401 probe. `/health/live`
 * is not used here because it answers 500 today (see middleware-stack.test.ts).
 */

import { gunzipSync } from 'node:zlib';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../src/app';
import { clearCache } from '../../src/middlewares/cache';
import { getMetrics, resetMetrics } from '../../src/middlewares/metrics';
import { apiLogger } from '../../src/utils/logger';

const READY = '/health/ready';
const UNCACHED_401 = '/api/v1/admin/accommodations';

describe('Middleware Interactions Integration', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        clearCache();
        resetMetrics();
    });

    describe('CORS + Response Formatting Interaction', () => {
        it('should apply CORS headers while maintaining response format', async () => {
            const app = initApp();

            const res = await app.request(READY, {
                method: 'GET',
                headers: {
                    'user-agent': 'cors-test/1.0',
                    accept: 'application/json',
                    origin: 'http://localhost:3000'
                }
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.data.ready).toBe(true);
            expect(data.metadata.requestId).toBe(res.headers.get('x-request-id'));
            expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
        });

        it('should handle CORS preflight with proper response formatting', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/users', {
                method: 'OPTIONS',
                headers: {
                    origin: 'http://localhost:3000',
                    'access-control-request-method': 'POST',
                    'access-control-request-headers': 'content-type,authorization'
                }
            });

            expect(res.status).toBe(204);
            expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
            expect(res.headers.get('access-control-allow-methods')).toContain('POST');
            expect(res.headers.get('access-control-allow-headers')).toContain('Authorization');
            expect(res.headers.get('x-request-id')).toBeTruthy();
        });
    });

    describe('Cache + Metrics Interaction', () => {
        it('should track metrics for the request that reaches the handler', async () => {
            const app = initApp();

            const res = await app.request(READY, {
                method: 'GET',
                headers: { 'user-agent': 'cache-metrics-test/1.0', accept: 'application/json' }
            });

            expect(res.status).toBe(200);
            expect(res.headers.get('x-cache')).toBe('MISS');
            expect(res.headers.get('x-request-id')).toBeTruthy();

            const endpoint = getMetrics().endpoints.find(
                (item) => item.endpoint === `GET ${READY}`
            );
            expect(endpoint).toMatchObject({ requests: 1, errors: 0 });
        });

        it('should serve the second identical request from the cache', async () => {
            const app = initApp();
            const request = () =>
                app.request(READY, {
                    headers: { 'user-agent': 'cache-hit-test/1.0', accept: 'application/json' }
                });

            const first = await request();
            const second = await request();

            expect(first.status).toBe(200);
            expect(first.headers.get('x-cache')).toBe('MISS');
            expect(second.status).toBe(200);
            expect(second.headers.get('x-cache')).toBe('HIT');
            expect((await second.json()).data.ready).toBe(true);
        });

        // HOS-1915: PER_REQUEST_HEADERS in cache.ts omits x-request-id, so a cache HIT replays the first request's id (header and body metadata).
        it.fails('should give a cached response its own request id', async () => {
            const app = initApp();
            const request = () =>
                app.request(READY, {
                    headers: { 'user-agent': 'cache-hit-test/1.0', accept: 'application/json' }
                });

            const first = await request();
            const second = await request();

            expect(second.headers.get('x-cache')).toBe('HIT');
            expect(second.headers.get('x-request-id')).not.toBe(first.headers.get('x-request-id'));
        });

        it('currently replays the first request id on a cache HIT (HOS-1915)', async () => {
            const app = initApp();
            const request = () =>
                app.request(READY, {
                    headers: { 'user-agent': 'cache-hit-test/1.0', accept: 'application/json' }
                });

            const first = await request();
            const second = await request();

            expect(second.headers.get('x-cache')).toBe('HIT');
            expect(second.headers.get('x-request-id')).toBe(first.headers.get('x-request-id'));
        });

        it('should give uncached requests unique request ids', async () => {
            const app = initApp();
            const request = () =>
                app.request(UNCACHED_401, {
                    headers: { 'user-agent': 'unique-id-test/1.0', accept: 'application/json' }
                });

            const first = await request();
            const second = await request();

            expect(first.status).toBe(401);
            expect(second.status).toBe(401);
            expect(first.headers.get('x-request-id')).toBeTruthy();
            expect(second.headers.get('x-request-id')).toBeTruthy();
            expect(first.headers.get('x-request-id')).not.toBe(second.headers.get('x-request-id'));
        });
    });

    describe('Security Headers + Compression Interaction', () => {
        it('should apply security headers to compressed responses', async () => {
            const app = initApp();

            const res = await app.request(READY, {
                method: 'GET',
                headers: {
                    'user-agent': 'security-compression-test/1.0',
                    accept: 'application/json',
                    'accept-encoding': 'gzip, deflate'
                }
            });

            expect(res.status).toBe(200);
            expect(res.headers.get('content-encoding')).toBe('gzip');
            expect(res.headers.get('x-content-type-options')).toBe('nosniff');
            expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN');
            expect(res.headers.get('x-xss-protection')).toBe('0');

            const data = JSON.parse(
                gunzipSync(Buffer.from(await res.arrayBuffer())).toString('utf8')
            );
            expect(data.success).toBe(true);
            expect(data.data.ready).toBe(true);
        });
    });

    describe('Validation + Response Formatting Interaction', () => {
        it('should format validation errors consistently', async () => {
            const app = initApp();

            const res = await app.request(READY, {
                method: 'GET',
                headers: {
                    // Missing user-agent header
                    accept: 'application/json'
                }
            });

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('MISSING_REQUIRED_HEADER');
            expect(data.error.messageKey).toBe('zodError.validation.header.missing');
            expect(data.metadata.timestamp).toBeDefined();
            expect(res.headers.get('x-request-id')).toBe(data.metadata.requestId);
        });

        it('should validate and format content-type errors', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/users', {
                method: 'POST',
                headers: {
                    'user-agent': 'validation-format-test/1.0',
                    accept: 'application/json',
                    'content-type': 'text/plain'
                },
                body: 'not json'
            });

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INVALID_CONTENT_TYPE');
            expect(data.metadata.requestId).toBe(res.headers.get('x-request-id'));
        });
    });

    describe('Auth + Actor + Response Formatting Interaction', () => {
        it('should handle authentication flow with proper response formatting', async () => {
            const app = initApp();

            const res = await app.request(UNCACHED_401, {
                method: 'GET',
                headers: {
                    'user-agent': 'auth-actor-test/1.0',
                    accept: 'application/json'
                    // No session
                }
            });

            expect(res.status).toBe(401);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
            expect(data.metadata.requestId).toBe(res.headers.get('x-request-id'));
        });
    });

    describe('Logger + Metrics + Response Formatting Interaction', () => {
        it('should coordinate logging, metrics, and response formatting', async () => {
            const app = initApp();
            const info = vi.spyOn(apiLogger, 'info');
            const initialMetrics = getMetrics();

            const res = await app.request(READY, {
                method: 'GET',
                headers: {
                    'user-agent': 'logger-metrics-response-test/1.0',
                    accept: 'application/json'
                }
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.metadata.requestId).toBeTruthy();

            // The request logger wrote one success line for this request
            expect(info).toHaveBeenCalledWith(
                expect.stringContaining(`HTTP SUCCESS => GET http://localhost${READY} 200`),
                'SUCCESS'
            );

            // Metrics tracked it
            expect(getMetrics().summary.totalRequests).toBe(
                initialMetrics.summary.totalRequests + 1
            );
        });
    });

    describe('Request ID Consistency Across Middlewares', () => {
        it('should maintain same request ID across all middlewares', async () => {
            const app = initApp();

            const res = await app.request(READY, {
                method: 'GET',
                headers: {
                    'user-agent': 'request-id-consistency-test/1.0',
                    accept: 'application/json'
                }
            });

            expect(res.status).toBe(200);
            const requestIdHeader = res.headers.get('x-request-id');
            const data = await res.json();

            // Response formatting reuses the id the request-id middleware set
            expect(data.metadata.requestId).toBe(requestIdHeader);
            expect(requestIdHeader).toMatch(/^[a-zA-Z0-9-_]+$/);
            expect(requestIdHeader?.length ?? 0).toBeGreaterThan(10);
        });
    });

    describe('Error Propagation Through Multiple Middleware Layers', () => {
        it('should propagate errors correctly through validation, auth, and formatting', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/admin/users', {
                method: 'POST',
                headers: {
                    'user-agent': 'multi-layer-error-test/1.0',
                    accept: 'text/html', // Invalid accept header
                    'content-type': 'application/json'
                },
                body: '{"test": "data"}'
            });

            // Header validation rejects it before auth is consulted
            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INVALID_ACCEPT_HEADER');
            expect(data.metadata.requestId).toBe(res.headers.get('x-request-id'));
            expect(res.headers.get('x-content-type-options')).toBe('nosniff');
        });
    });
});
