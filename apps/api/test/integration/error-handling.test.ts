/**
 * Error Handling Cross-Middleware Integration Tests
 * Tests that errors are properly handled and propagated through the complete middleware stack
 * without losing information or causing interference between middlewares.
 *
 * `/health/ready` is the happy-path probe (`/health/live` is covered in
 * middleware-stack.test.ts). Body-parsing cases go through a real protected route
 * with a real user row behind the mock actor.
 */

import { PermissionEnum } from '@repo/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../src/app';
import { clearCache } from '../../src/middlewares/cache';
import { resetMetrics } from '../../src/middlewares/metrics';
import { validateApiEnv } from '../../src/utils/env';
import { testDb } from '../e2e/setup/test-database';
import { buildMockActorHeaders, createMockActorUser } from './helpers/mock-actor';

const READY = '/health/ready';
const CREATE_ROUTE = '/api/v1/protected/accommodations';

describe('Error Handling Cross-Middleware Integration', () => {
    let creatorHeaders: Record<string, string>;

    beforeAll(async () => {
        await testDb.setup();
        await testDb.clean();
        clearCache();
        validateApiEnv();
        const creator = await createMockActorUser({ label: 'error-handling-creator' });
        creatorHeaders = buildMockActorHeaders({
            actorId: creator.id,
            permissions: [PermissionEnum.ACCOMMODATION_CREATE]
        });
    });

    beforeEach(() => {
        clearCache();
        resetMetrics();
    });

    afterAll(async () => {
        await testDb.clean();
        clearCache();
        await testDb.teardown();
    });

    describe('Validation Errors Through Stack', () => {
        it('should handle missing required headers with proper error format', async () => {
            const app = initApp();

            const res = await app.request(READY, {
                method: 'GET',
                headers: {
                    // Missing required user-agent header
                    accept: 'application/json'
                }
            });

            expect(res.status).toBe(400);

            // Error envelope is kept through all middlewares
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('MISSING_REQUIRED_HEADER');
            expect(data.error.messageKey).toBe('zodError.validation.header.missing');

            // Metadata is preserved even in error responses
            expect(data.metadata.timestamp).toBeDefined();
            expect(data.metadata.requestId).toBe(res.headers.get('x-request-id'));

            // Security headers are still applied to error responses
            expect(res.headers.get('x-content-type-options')).toBe('nosniff');
            expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN');
        });

        it('should handle invalid accept headers with proper propagation', async () => {
            const app = initApp();

            const res = await app.request(READY, {
                method: 'GET',
                headers: {
                    'user-agent': 'error-test/1.0',
                    accept: 'text/html' // Invalid accept header
                }
            });

            expect(res.status).toBe(400);

            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INVALID_ACCEPT_HEADER');

            // The error did not break the middleware chain
            expect(res.headers.get('x-request-id')).toBeTruthy();
            expect(data.metadata.requestId).toBe(res.headers.get('x-request-id'));
        });

        it('should handle content-type validation errors', async () => {
            const app = initApp();

            const res = await app.request(CREATE_ROUTE, {
                method: 'POST',
                headers: {
                    'user-agent': 'error-test/1.0',
                    accept: 'application/json',
                    'content-type': 'text/plain' // Invalid for JSON APIs
                },
                body: 'not json'
            });

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INVALID_CONTENT_TYPE');
            expect(data.metadata.requestId).toBe(res.headers.get('x-request-id'));

            // Even validation errors carry security headers
            expect(res.headers.get('x-content-type-options')).toBe('nosniff');
        });
    });

    describe('Authentication Errors Through Stack', () => {
        it('should handle authentication failures with proper error format', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/admin/accommodations', {
                method: 'GET',
                headers: {
                    'user-agent': 'auth-error-test/1.0',
                    accept: 'application/json'
                    // No session
                }
            });

            expect(res.status).toBe(401);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('UNAUTHORIZED');
            expect(data.metadata.requestId).toBe(res.headers.get('x-request-id'));
            expect(res.headers.get('x-content-type-options')).toBe('nosniff');
        });
    });

    describe('Server Errors Through Stack', () => {
        it('should format an unexpected handler error with the standard envelope and headers', async () => {
            const app = initApp();
            app.get('/test-error', () => {
                throw new Error('boom');
            });

            const res = await app.request('/test-error', {
                headers: {
                    'user-agent': 'server-error-test/1.0',
                    accept: 'application/json'
                }
            });

            expect(res.status).toBe(500);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('INTERNAL_ERROR');
            expect(data.metadata.requestId).toBe(res.headers.get('x-request-id'));
            expect(res.headers.get('x-content-type-options')).toBe('nosniff');
        });

        it('should reject malformed JSON with a 400 validation error', async () => {
            const app = initApp();

            const res = await app.request(CREATE_ROUTE, {
                method: 'POST',
                headers: creatorHeaders,
                body: '{"invalid": json}' // Invalid JSON
            });

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('VALIDATION_ERROR');
            expect(res.headers.get('x-request-id')).toBeTruthy();
            expect(res.headers.get('x-content-type-options')).toBe('nosniff');
        });
    });

    describe('CORS Errors Through Stack', () => {
        it('should answer a preflight from a disallowed origin without granting it', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/public/users', {
                method: 'OPTIONS',
                headers: {
                    origin: 'https://evil-site.com', // Not an allowed origin
                    'access-control-request-method': 'POST',
                    'access-control-request-headers': 'content-type'
                }
            });

            expect(res.status).toBe(204);
            // The origin is never echoed back, so the browser blocks the request
            expect(res.headers.get('access-control-allow-origin')).toBeNull();
            expect(res.headers.get('x-request-id')).toBeTruthy();
        });

        it('should grant a preflight from an allowed origin', async () => {
            const app = initApp();

            const res = await app.request('/api/v1/public/users', {
                method: 'OPTIONS',
                headers: {
                    origin: 'http://localhost:3000',
                    'access-control-request-method': 'POST',
                    'access-control-request-headers': 'content-type'
                }
            });

            expect(res.status).toBe(204);
            expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
        });
    });

    describe('Content Size Errors Through Stack', () => {
        it('should reject a 10KB payload that fails validation with a formatted 400', async () => {
            const app = initApp();

            const res = await app.request(CREATE_ROUTE, {
                method: 'POST',
                headers: creatorHeaders,
                body: JSON.stringify({ data: 'x'.repeat(10000) })
            });

            expect(res.status).toBe(400);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.metadata.requestId).toBe(res.headers.get('x-request-id'));
        });

        it('should reject a body over the global cap with 413 REQUEST_TOO_LARGE', async () => {
            const app = initApp();

            const res = await app.request(CREATE_ROUTE, {
                method: 'POST',
                headers: creatorHeaders,
                body: JSON.stringify({ data: 'x'.repeat(11 * 1024 * 1024) })
            });

            expect(res.status).toBe(413);
            const data = await res.json();
            expect(data.success).toBe(false);
            expect(data.error.code).toBe('REQUEST_TOO_LARGE');
            expect(res.headers.get('x-request-id')).toBeTruthy();
        });
    });

    describe('Middleware Chain Recovery', () => {
        it('should recover gracefully after errors and continue processing subsequent requests', async () => {
            const app = initApp();

            // First request: cause a validation error (missing user-agent)
            const errorRes = await app.request(READY, {
                headers: { accept: 'application/json' }
            });
            expect(errorRes.status).toBe(400);

            // Second request: works normally
            const successRes = await app.request(READY, {
                headers: { 'user-agent': 'recovery-test/1.0', accept: 'application/json' }
            });
            expect(successRes.status).toBe(200);

            // Each request got its own id
            const errorRequestId = errorRes.headers.get('x-request-id');
            const successRequestId = successRes.headers.get('x-request-id');
            expect(errorRequestId).toBeTruthy();
            expect(successRequestId).toBeTruthy();
            expect(errorRequestId).not.toBe(successRequestId);

            const successData = await successRes.json();
            expect(successData.success).toBe(true);
            expect(successData.data.ready).toBe(true);
        });
    });
});
