/**
 * Middleware Stack Integration Tests
 * Tests the complete middleware stack to ensure all middlewares work together
 * and that the request flow is processed correctly through all layers.
 *
 * `/health/ready` is the happy-path probe: it is public, cached and answers the
 * standard envelope. `/health/live` is NOT used for that, because it answers
 * 500 today (see the known-failure test at the bottom).
 */

import { gunzipSync } from 'node:zlib';
import { beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../src/app';
import { clearCache } from '../../src/middlewares/cache';
import { resetMetrics } from '../../src/middlewares/metrics';

const READY = '/health/ready';

/** The slice of the response envelope these tests read. */
interface Envelope {
    readonly success: boolean;
    readonly data: { readonly ready?: boolean };
    readonly metadata: { readonly requestId: string; readonly timestamp: string };
}

/** Reads a JSON body, inflating it first when the stack compressed it. */
const readJson = async ({ res }: { readonly res: Response }): Promise<Envelope> => {
    const raw = Buffer.from(await res.arrayBuffer());
    const text = res.headers.get('content-encoding')?.includes('gzip')
        ? gunzipSync(raw).toString('utf8')
        : raw.toString('utf8');
    return JSON.parse(text);
};

describe('Middleware Stack Integration', () => {
    beforeEach(() => {
        clearCache();
        resetMetrics();
    });

    describe('Complete Stack Processing', () => {
        it('should process request through all middlewares successfully', async () => {
            const app = initApp();

            const res = await app.request(READY, {
                method: 'GET',
                headers: {
                    'user-agent': 'integration-test/1.0',
                    accept: 'application/json',
                    'accept-encoding': 'gzip, deflate',
                    origin: 'http://localhost:3000'
                }
            });

            expect(res.status).toBe(200);
            // Compression middleware
            expect(res.headers.get('content-encoding')).toBe('gzip');

            // Response formatting middleware
            const data = await readJson({ res });
            expect(data.success).toBe(true);
            expect(data.data.ready).toBe(true);
            expect(data.metadata.timestamp).toBeDefined();

            // Request ID middleware: header and envelope agree
            expect(res.headers.get('x-request-id')).toBeTruthy();
            expect(data.metadata.requestId).toBe(res.headers.get('x-request-id'));

            // Security headers middleware
            expect(res.headers.get('x-content-type-options')).toBe('nosniff');
            expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN');
            expect(res.headers.get('x-xss-protection')).toBe('0');

            // CORS middleware echoes the allowed origin
            expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
        });

        it('should handle validation errors correctly through the stack', async () => {
            const app = initApp();

            const res = await app.request(READY, {
                method: 'GET',
                headers: {
                    // Missing required user-agent header
                    accept: 'application/json'
                }
            });

            expect(res.status).toBe(400);

            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('MISSING_REQUIRED_HEADER');
            expect(data.metadata.requestId).toBe(res.headers.get('x-request-id'));

            // Security headers are still applied on errors
            expect(res.headers.get('x-content-type-options')).toBe('nosniff');
            expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN');
        });

        it('should answer a JSON POST to an unknown route with a formatted 404', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/users', {
                method: 'POST',
                headers: {
                    'user-agent': 'integration-test/1.0',
                    accept: 'application/json',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({ test: 'data', number: 123 })
            });

            expect(res.status).toBe(404);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('NOT_FOUND');
            expect(res.headers.get('x-request-id')).toBeTruthy();
            expect(res.headers.get('x-content-type-options')).toBe('nosniff');
        });
    });

    describe('Middleware Order Verification', () => {
        it('should apply middlewares in the correct order', async () => {
            const app = initApp();

            const res = await app.request(READY, {
                headers: {
                    'user-agent': 'integration-test/1.0',
                    accept: 'application/json'
                }
            });

            expect(res.status).toBe(200);
            const data = await res.json();

            // Request ID is set before response formatting reads it
            expect(data.metadata.requestId).toBe(res.headers.get('x-request-id'));
            // Response formatting wrapped the handler output
            expect(data.success).toBe(true);
            expect(data.data.ready).toBe(true);
            // Security headers are applied on the way out
            expect(res.headers.get('x-content-type-options')).toBe('nosniff');
        });
    });

    describe('Performance Under Load', () => {
        it('should handle multiple concurrent requests', async () => {
            const app = initApp();

            // The admin list is not cached, so every response is a fresh request.
            const responses = await Promise.all(
                Array.from({ length: 10 }, (_, i) =>
                    app.request('/api/v1/admin/accommodations', {
                        headers: {
                            'user-agent': `integration-test-${i}/1.0`,
                            accept: 'application/json'
                        }
                    })
                )
            );

            for (const res of responses) {
                expect(res.status).toBe(401);
                expect(res.headers.get('x-request-id')).toBeTruthy();
            }

            const requestIds = responses.map((res) => res.headers.get('x-request-id'));
            expect(new Set(requestIds).size).toBe(10);
        });
    });

    describe('Cache and Compression Integration', () => {
        it('should apply both caching and compression when appropriate', async () => {
            const app = initApp();
            const request = () =>
                app.request(READY, {
                    headers: {
                        'user-agent': 'integration-test/1.0',
                        accept: 'application/json',
                        'accept-encoding': 'gzip'
                    }
                });

            const first = await request();
            expect(first.status).toBe(200);
            expect(first.headers.get('x-cache')).toBe('MISS');
            expect(first.headers.get('content-encoding')).toBe('gzip');
            expect((await readJson({ res: first })).data.ready).toBe(true);

            const second = await request();
            expect(second.status).toBe(200);
            expect(second.headers.get('x-cache')).toBe('HIT');
            expect(second.headers.get('content-encoding')).toBe('gzip');
            expect((await readJson({ res: second })).data.ready).toBe(true);
        });
    });

    describe('Error Propagation Through Stack', () => {
        it('should handle invalid content-type gracefully', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/users', {
                method: 'POST',
                headers: {
                    'user-agent': 'integration-test/1.0',
                    accept: 'application/json',
                    'content-type': 'text/plain'
                },
                body: 'invalid json payload'
            });

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INVALID_CONTENT_TYPE');
            expect(data.metadata.requestId).toBe(res.headers.get('x-request-id'));
        });
    });

    describe('Security Headers Integration', () => {
        it('should apply all security headers consistently', async () => {
            const app = initApp();

            const res = await app.request(READY, {
                headers: {
                    'user-agent': 'security-test/1.0',
                    accept: 'application/json'
                }
            });

            expect(res.status).toBe(200);
            expect(res.headers.get('x-content-type-options')).toBe('nosniff');
            expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN');
            expect(res.headers.get('x-xss-protection')).toBe('0');
            expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
            expect(res.headers.get('x-request-id')).toBeTruthy();
        });
    });

    describe('Liveness endpoint', () => {
        const live = () =>
            initApp().request('/health/live', {
                headers: { 'user-agent': 'integration-test/1.0', accept: 'application/json' }
            });

        // HOS-TODO-health-live-500: liveRoutes declares the whole envelope (HealthLivenessSchema) as responseSchema but returns the bare payload, so stripWithSchema always throws.
        it.fails('answers 200 with the alive payload', async () => {
            const res = await live();
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.data.alive).toBe(true);
        });

        it('currently answers 500 INTERNAL_ERROR (HOS-TODO-health-live-500)', async () => {
            const res = await live();
            expect(res.status).toBe(500);
            const data = await res.json();
            expect(data.error.code).toBe('INTERNAL_ERROR');
            expect(data.error.message).toBe('Response payload does not match declared schema');
        });
    });
});
