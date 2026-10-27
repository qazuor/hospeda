/**
 * Real User Scenarios End-to-End Integration Tests
 * Tests complete user journeys through the API to ensure the entire stack
 * works together seamlessly for real-world use cases.
 *
 * Everything runs against the real services and the integration database: one
 * public accommodation is seeded per test, the catalogs nobody seeded (amenities,
 * events, posts, destinations) are asserted EMPTY rather than "whatever came
 * back", and the admin journeys use a real admin user row behind the mock actor.
 * `/health/ready` is the liveness probe here because `/health/live` answers 500
 * today (pinned in middleware-stack.test.ts).
 */

import { RoleEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../src/app';
import { clearCache } from '../../src/middlewares/cache';
import { resetMetrics } from '../../src/middlewares/metrics';
import { validateApiEnv } from '../../src/utils/env';
import { testDb } from '../e2e/setup/test-database';
import {
    ADMIN_GATE_PERMISSIONS,
    buildMockActorHeaders,
    createMockActorUser
} from './helpers/mock-actor';
import {
    type SeededPublicAccommodation,
    seedPublicAccommodation
} from './helpers/seed-public-accommodation';

const READY = '/health/ready';
const PUBLIC = '/api/v1/public';
const ALLOWED_ORIGIN = 'http://localhost:4321';

/** Ids of the items in a list response. */
const idsOf = ({ body }: { readonly body: { data: { items: { id: string }[] } } }): string[] =>
    body.data.items.map((item) => item.id);

describe('Real User Scenarios End-to-End', () => {
    let app: ReturnType<typeof initApp>;
    let seeded: SeededPublicAccommodation;
    let adminHeaders: (userAgent: string) => Record<string, string>;
    let plainUserHeaders: Record<string, string>;

    beforeAll(async () => {
        await testDb.setup();
        await testDb.clean();
        clearCache();
        validateApiEnv();
        app = initApp();
    });

    beforeEach(async () => {
        clearCache();
        resetMetrics();
        seeded = await seedPublicAccommodation();
        const admin = await createMockActorUser({ label: 'real-user-admin' });
        adminHeaders = (userAgent) => ({
            ...buildMockActorHeaders({
                actorId: admin.id,
                permissions: ADMIN_GATE_PERMISSIONS,
                role: RoleEnum.ADMIN
            }),
            'user-agent': userAgent
        });
        const regular = await createMockActorUser({ label: 'real-user-regular' });
        plainUserHeaders = buildMockActorHeaders({ actorId: regular.id, permissions: [] });
    });

    afterEach(async () => {
        await testDb.clean();
        clearCache();
    });

    afterAll(async () => {
        await testDb.clean();
        clearCache();
        await testDb.teardown();
    });

    describe('API Discovery Journey', () => {
        it('should guide user through API exploration (root → health → metrics)', async () => {
            // Step 1: the root describes the API
            const rootRes = await app.request('/', {
                headers: { accept: 'application/json', 'user-agent': 'api-explorer/1.0' }
            });
            expect(rootRes.status).toBe(200);
            const rootData = await rootRes.json();
            expect(rootData.success).toBe(true);
            expect(rootData.data).toMatchObject({
                name: 'hospeda-api',
                status: 'operational',
                documentation: '/docs'
            });

            // Step 2: the readiness probe says the API is operational
            const healthRes = await app.request(READY, {
                headers: { accept: 'application/json', 'user-agent': 'api-explorer/1.0' }
            });
            expect(healthRes.status).toBe(200);
            const healthData = await healthRes.json();
            expect(healthData.success).toBe(true);
            expect(healthData.data.ready).toBe(true);

            // Step 3: an admin reads the metrics, which already counted the root call
            const metricsRes = await app.request('/api/v1/admin/metrics', {
                headers: adminHeaders('api-explorer/1.0')
            });
            expect(metricsRes.status).toBe(200);
            const metricsData = await metricsRes.json();
            expect(metricsData.success).toBe(true);
            expect(metricsData.data.summary.totalRequests).toBeGreaterThanOrEqual(2);
            expect(
                metricsData.data.endpoints.map((item: { endpoint: string }) => item.endpoint)
            ).toContain('GET /');
        });
    });

    describe('Frontend Integration Journey', () => {
        it('should handle CORS preflight and data fetching for frontend app', async () => {
            // Step 1: the browser's CORS preflight is granted to the frontend origin
            const preflightRes = await app.request(`${PUBLIC}/accommodations`, {
                method: 'OPTIONS',
                headers: {
                    origin: ALLOWED_ORIGIN,
                    'access-control-request-method': 'GET',
                    'access-control-request-headers': 'content-type,authorization'
                }
            });
            expect(preflightRes.status).toBe(204);
            expect(preflightRes.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);

            // Step 2: the frontend fetches the list and sees the seeded accommodation
            const apiRes = await app.request(`${PUBLIC}/accommodations`, {
                headers: {
                    'user-agent': 'Mozilla/5.0 (frontend app)',
                    accept: 'application/json',
                    origin: ALLOWED_ORIGIN
                }
            });
            expect(apiRes.status).toBe(200);
            expect(apiRes.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);
            const data = await apiRes.json();
            expect(data.success).toBe(true);
            expect(idsOf({ body: data })).toEqual([seeded.id]);
            expect(data.metadata.requestId).toBe(apiRes.headers.get('x-request-id'));

            // Step 3: pagination is echoed back
            const paginatedRes = await app.request(`${PUBLIC}/accommodations?page=1&pageSize=10`, {
                headers: {
                    'user-agent': 'Mozilla/5.0 (frontend pagination)',
                    accept: 'application/json',
                    origin: ALLOWED_ORIGIN
                }
            });
            expect(paginatedRes.status).toBe(200);
            const paginated = await paginatedRes.json();
            expect(paginated.data.pagination).toMatchObject({ page: 1, pageSize: 10, total: 1 });
        });
    });

    describe('Mobile App Integration Journey', () => {
        it('should handle mobile app requests with different user agents', async () => {
            // Step 1: iOS app fetches the accommodation list
            const iosRes = await app.request(`${PUBLIC}/accommodations`, {
                headers: {
                    'user-agent': 'MyTravelApp/1.0 (iPhone; iOS 16.0; Scale/3.00) CFNetwork/1406',
                    accept: 'application/json',
                    'accept-language': 'es-AR,es;q=0.9'
                }
            });
            expect(iosRes.status).toBe(200);
            expect(idsOf({ body: await iosRes.json() })).toEqual([seeded.id]);

            // Step 2: Android app fetches the amenity catalog (nothing seeded: empty)
            // No accept-encoding: app.request() does not decompress gzip bodies.
            const androidRes = await app.request(`${PUBLIC}/amenities`, {
                headers: {
                    'user-agent': 'MyTravelApp/1.0 (Android 13; Mobile) OkHttp/4.10.0',
                    accept: 'application/json'
                }
            });
            expect(androidRes.status).toBe(200);
            const amenities = await androidRes.json();
            expect(amenities.success).toBe(true);
            expect(amenities.data.items).toEqual([]);

            // Step 3: a malformed id is a 400 validation error...
            const malformedRes = await app.request(`${PUBLIC}/accommodations/nonexistent-id`, {
                headers: { 'user-agent': 'MyTravelApp/1.0', accept: 'application/json' }
            });
            expect(malformedRes.status).toBe(400);
            const malformed = await malformedRes.json();
            expect(malformed.success).toBe(false);
            expect(malformed.error.code).toBe('VALIDATION_ERROR');

            // ...and a well-formed id nobody owns is a 404
            const missingRes = await app.request(
                `${PUBLIC}/accommodations/a0000000-0000-4000-8000-000000000001`,
                { headers: { 'user-agent': 'MyTravelApp/1.0', accept: 'application/json' } }
            );
            expect(missingRes.status).toBe(404);
            expect((await missingRes.json()).error.code).toBe('NOT_FOUND');

            // Step 4: events are paginated (nothing seeded: empty page)
            const eventsRes = await app.request(`${PUBLIC}/events?page=1&pageSize=5`, {
                headers: { 'user-agent': 'MyTravelApp/1.0', accept: 'application/json' }
            });
            expect(eventsRes.status).toBe(200);
            const events = await eventsRes.json();
            expect(events.data.items).toEqual([]);
            expect(events.data.pagination).toMatchObject({ page: 1, pageSize: 5, total: 0 });
        });
    });

    describe('API Client Integration Journey', () => {
        it('should handle programmatic API usage patterns', async () => {
            const sdk = 'hospeda-sdk/1.0.0 (Node.js/18)';

            // Step 1: the client discovers the API through the root endpoint
            const rootRes = await app.request('/', {
                headers: { accept: 'application/json', 'user-agent': sdk }
            });
            expect(rootRes.status).toBe(200);
            const rootData = await rootRes.json();
            expect(rootData.success).toBe(true);
            expect(rootData.data.name).toBe('hospeda-api');

            // Step 2: it fetches the accommodations
            const accommodationsRes = await app.request(`${PUBLIC}/accommodations`, {
                headers: { accept: 'application/json', 'user-agent': sdk }
            });
            expect(accommodationsRes.status).toBe(200);
            expect(idsOf({ body: await accommodationsRes.json() })).toEqual([seeded.id]);

            // Step 3: it fetches posts (nothing seeded: empty) and destinations
            const postsRes = await app.request(`${PUBLIC}/posts`, {
                headers: { accept: 'application/json', 'user-agent': sdk }
            });
            expect(postsRes.status).toBe(200);
            expect((await postsRes.json()).data.items).toEqual([]);

            const destinationsRes = await app.request(`${PUBLIC}/destinations`, {
                headers: { accept: 'application/json', 'user-agent': sdk }
            });
            expect(destinationsRes.status).toBe(200);
            // The seeded accommodation brought its destination along
            expect(idsOf({ body: await destinationsRes.json() })).toEqual([seeded.destinationId]);

            // Step 4: it verifies readiness before critical requests
            const readyRes = await app.request(READY, {
                headers: { accept: 'application/json', 'user-agent': sdk }
            });
            expect(readyRes.status).toBe(200);

            // Step 5: an admin client reads the metrics
            const metricsRes = await app.request('/api/v1/admin/metrics', {
                headers: adminHeaders(sdk)
            });
            expect(metricsRes.status).toBe(200);
            const metricsData = await metricsRes.json();
            expect(metricsData.success).toBe(true);
            expect(Array.isArray(metricsData.data.endpoints)).toBe(true);
            expect(metricsData.data.summary.totalRequests).toBeGreaterThanOrEqual(5);
        });
    });

    describe('Error Recovery Journey', () => {
        it('should help user recover from various error conditions', async () => {
            // Step 1: wrong content type is rejected with a machine-readable code
            const wrongContentRes = await app.request('/api/v1/users', {
                method: 'POST',
                headers: {
                    'user-agent': 'developer-learning-api/1.0',
                    accept: 'application/json',
                    'content-type': 'text/plain'
                },
                body: 'not json'
            });
            expect(wrongContentRes.status).toBe(400);
            const errorData = await wrongContentRes.json();
            expect(errorData.success).toBe(false);
            // Validation errors carry a messageKey, not a message
            expect(errorData.error.code).toBe('INVALID_CONTENT_TYPE');
            expect(errorData.error.messageKey).toBe('zodError.validation.content_type.invalid');

            // Step 2: the corrected request works
            const correctedRes = await app.request(READY, {
                method: 'GET',
                headers: { 'user-agent': 'developer-learning-api/1.0', accept: 'application/json' }
            });
            expect(correctedRes.status).toBe(200);
            const successData = await correctedRes.json();
            expect(successData.success).toBe(true);
            expect(successData.data.ready).toBe(true);

            // Step 3: an unknown endpoint gets a structured 404
            const notFoundRes = await app.request('/api/v1/nonexistent', {
                headers: { 'user-agent': 'developer-learning-api/1.0', accept: 'application/json' }
            });
            expect(notFoundRes.status).toBe(404);
            const notFoundData = await notFoundRes.json();
            expect(notFoundData.success).toBe(false);
            expect(notFoundData.error.code).toBe('NOT_FOUND');
        });
    });

    describe('Performance Under Load Journey', () => {
        it('should maintain consistent behaviour across a user session', async () => {
            // A burst of concurrent readiness probes
            const burstResults = await Promise.all(
                Array.from({ length: 5 }, () =>
                    app.request(READY, {
                        headers: { accept: 'application/json', 'user-agent': 'load-test/1.0' }
                    })
                )
            );
            for (const res of burstResults) {
                expect(res.status).toBe(200);
            }

            // Sequential reads of the main public catalogs
            const publicEndpoints = ['accommodations', 'amenities', 'events'];
            for (const endpoint of publicEndpoints) {
                const res = await app.request(`${PUBLIC}/${endpoint}`, {
                    headers: { accept: 'application/json', 'user-agent': 'load-test/1.0' }
                });
                expect(res.status).toBe(200);
                expect(res.headers.get('content-type')).toContain('application/json');
            }

            // Readiness is still structured at the end of the session
            const finalHealthRes = await app.request(READY, {
                headers: { accept: 'application/json', 'user-agent': 'load-test/1.0' }
            });
            expect(finalHealthRes.status).toBe(200);
            const data = await finalHealthRes.json();
            expect(data.success).toBe(true);
            expect(data.data.ready).toBe(true);
        });
    });

    describe('Monitoring and Debugging Journey', () => {
        it('should provide comprehensive information for debugging issues', async () => {
            const agent = 'hospeda-monitoring/1.0';

            // Generate traffic the metrics can report on
            await app.request(READY, { headers: { 'user-agent': agent } });
            await app.request(`${PUBLIC}/accommodations`, { headers: { 'user-agent': agent } });

            // Step 1: all metrics
            const allMetricsRes = await app.request('/api/v1/admin/metrics', {
                headers: adminHeaders(agent)
            });
            expect(allMetricsRes.status).toBe(200);
            const all = await allMetricsRes.json();
            expect(all.success).toBe(true);
            const endpointNames = all.data.endpoints.map(
                (item: { endpoint: string }) => item.endpoint
            );
            expect(endpointNames).toContain(`GET ${READY}`);
            expect(endpointNames).toContain(`GET ${PUBLIC}/accommodations`);
            expect(all.data.summary.totalRequests).toBeGreaterThanOrEqual(2);

            // Step 2: system metrics only list system endpoints
            const systemMetricsRes = await app.request('/api/v1/admin/metrics/system', {
                headers: adminHeaders(agent)
            });
            expect(systemMetricsRes.status).toBe(200);
            const system = await systemMetricsRes.json();
            expect(system.success).toBe(true);
            const systemNames = system.data.endpoints.map(
                (item: { endpoint: string }) => item.endpoint
            );
            expect(systemNames).toContain(`GET ${READY}`);
            expect(systemNames).not.toContain(`GET ${PUBLIC}/accommodations`);

            // Step 3: API metrics only list API endpoints
            const apiMetricsRes = await app.request('/api/v1/admin/metrics/api', {
                headers: adminHeaders(agent)
            });
            expect(apiMetricsRes.status).toBe(200);
            const api = await apiMetricsRes.json();
            expect(api.success).toBe(true);
            const apiNames = api.data.endpoints.map((item: { endpoint: string }) => item.endpoint);
            expect(apiNames).toContain(`GET ${PUBLIC}/accommodations`);
            expect(apiNames).not.toContain(`GET ${READY}`);

            // Step 4: anonymous callers are refused
            const unauthMetricsRes = await app.request('/api/v1/admin/metrics', {
                headers: { accept: 'application/json', 'user-agent': agent }
            });
            expect(unauthMetricsRes.status).toBe(401);

            // Step 5: a signed-in user without the admin role is refused too
            const forbiddenMetricsRes = await app.request('/api/v1/admin/metrics', {
                headers: plainUserHeaders
            });
            expect(forbiddenMetricsRes.status).toBe(403);
        });
    });

    describe('Cross-Origin Resource Sharing Journey', () => {
        it('should handle complex CORS scenarios for web applications', async () => {
            // Step 1: the registered local frontends are granted on preflight
            for (const origin of ['http://localhost:4321', 'http://localhost:3000']) {
                const preflightRes = await app.request(`${PUBLIC}/accommodations`, {
                    method: 'OPTIONS',
                    headers: {
                        origin,
                        'access-control-request-method': 'GET',
                        'access-control-request-headers': 'content-type'
                    }
                });
                expect(preflightRes.status).toBe(204);
                expect(preflightRes.headers.get('access-control-allow-origin')).toBe(origin);
            }

            // Step 2: the actual cross-origin GET carries the CORS header
            const getRes = await app.request(`${PUBLIC}/accommodations`, {
                headers: {
                    origin: ALLOWED_ORIGIN,
                    accept: 'application/json',
                    'user-agent': 'Mozilla/5.0 (CORS browser)'
                }
            });
            expect(getRes.status).toBe(200);
            expect(getRes.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);
            expect((await getRes.json()).success).toBe(true);

            // Step 3: an unknown origin is still served, but is never granted
            const unknownOriginRes = await app.request(`${PUBLIC}/events`, {
                headers: {
                    origin: 'https://unknown-third-party.com',
                    accept: 'application/json',
                    'user-agent': 'Mozilla/5.0 (CORS browser)'
                }
            });
            expect(unknownOriginRes.status).toBe(200);
            expect(unknownOriginRes.headers.get('access-control-allow-origin')).toBeNull();

            // Step 4: no Origin header (same-origin / server-to-server)
            const noOriginRes = await app.request(`${PUBLIC}/posts`, {
                headers: { accept: 'application/json', 'user-agent': 'server-side-client/1.0' }
            });
            expect(noOriginRes.status).toBe(200);
            expect(noOriginRes.headers.get('access-control-allow-origin')).toBeNull();
        });
    });

    describe('Complete User Workflow', () => {
        it('should handle a complete user interaction workflow', async () => {
            const browser = 'Mozilla/5.0 (compatible browser)';

            // Step 1: a guest checks the API is up
            const readyRes = await app.request(READY, {
                headers: { accept: 'application/json', 'user-agent': browser }
            });
            expect(readyRes.status).toBe(200);

            // Step 2: the guest browses the accommodations
            const browseRes = await app.request(`${PUBLIC}/accommodations?page=1&pageSize=10`, {
                headers: { accept: 'application/json', 'user-agent': browser }
            });
            expect(browseRes.status).toBe(200);
            const data = await browseRes.json();
            expect(data.success).toBe(true);
            expect(idsOf({ body: data })).toEqual([seeded.id]);
            expect(browseRes.headers.get('x-content-type-options')).toBe('nosniff');

            // Step 3: amenities and posts (nothing seeded: empty pages)
            const amenitiesRes = await app.request(`${PUBLIC}/amenities`, {
                headers: { accept: 'application/json', 'user-agent': browser }
            });
            expect(amenitiesRes.status).toBe(200);
            expect((await amenitiesRes.json()).data.items).toEqual([]);

            const postsRes = await app.request(`${PUBLIC}/posts`, {
                headers: { accept: 'application/json', 'user-agent': browser }
            });
            expect(postsRes.status).toBe(200);
            expect((await postsRes.json()).data.items).toEqual([]);

            // Step 4: an invalid endpoint answers a structured error
            const notFoundRes = await app.request(`${PUBLIC}/nonexistent-entity`, {
                headers: { accept: 'application/json', 'user-agent': browser }
            });
            expect(notFoundRes.status).toBe(404);
            const errorData = await notFoundRes.json();
            expect(errorData.success).toBe(false);
            expect(errorData.error.code).toBe('NOT_FOUND');
        });
    });
});
