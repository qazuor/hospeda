import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';

/**
 * Integration tests for destination hierarchy API endpoints.
 *
 * Tests verify that routes are registered and return appropriate HTTP status codes
 * for valid and invalid inputs. No seeded data is required.
 */
describe('Destination Hierarchy API', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/destinations';
    const validUuid = '123e4567-e89b-42d3-a456-426614174000';

    beforeAll(async () => {
        await testDb.setup();
        // Initialize environment variables before running tests
        validateApiEnv();
        app = initApp();
    });

    afterAll(async () => {
        await testDb.clean();
        await testDb.teardown();
    });

    describe('GET /{id}/children', () => {
        it('returns 400 or 404 for invalid UUID format', async () => {
            const res = await app.request(`${base}/not-a-uuid/children`);
            expect([400, 404]).toContain(res.status);
        });

        it('returns a valid response for a well-formed UUID', async () => {
            const res = await app.request(`${base}/${validUuid}/children`);
            expect(res.status).toBe(404);
        });

        it('response has correct content-type', async () => {
            const res = await app.request(`${base}/${validUuid}/children`);
            const contentType = res.headers.get('content-type');
            expect(contentType).toContain('application/json');
        });
    });

    describe('GET /{id}/descendants', () => {
        it('returns 400 or 404 for invalid UUID format', async () => {
            const res = await app.request(`${base}/not-a-uuid/descendants`);
            expect([400, 404]).toContain(res.status);
        });

        it('returns a valid response for a well-formed UUID', async () => {
            const res = await app.request(`${base}/${validUuid}/descendants`);
            expect(res.status).toBe(404);
        });

        it('accepts maxDepth query parameter', async () => {
            const res = await app.request(`${base}/${validUuid}/descendants?maxDepth=5`);
            expect(res.status).toBe(404);
        });

        it('accepts destinationType query parameter', async () => {
            const res = await app.request(`${base}/${validUuid}/descendants?destinationType=CITY`);
            expect(res.status).toBe(404);
        });

        it('returns 400 for invalid maxDepth (0)', async () => {
            const res = await app.request(`${base}/${validUuid}/descendants?maxDepth=0`);
            expect([400, 422]).toContain(res.status);
        });

        it('returns 400 for invalid maxDepth (11)', async () => {
            const res = await app.request(`${base}/${validUuid}/descendants?maxDepth=11`);
            expect([400, 422]).toContain(res.status);
        });
    });

    describe('GET /{id}/ancestors', () => {
        it('returns 400 or 404 for invalid UUID format', async () => {
            const res = await app.request(`${base}/not-a-uuid/ancestors`);
            expect([400, 404]).toContain(res.status);
        });

        it('returns a valid response for a well-formed UUID', async () => {
            const res = await app.request(`${base}/${validUuid}/ancestors`);
            expect(res.status).toBe(404);
        });
    });

    describe('GET /{id}/breadcrumb', () => {
        it('returns 400 or 404 for invalid UUID format', async () => {
            const res = await app.request(`${base}/not-a-uuid/breadcrumb`);
            expect([400, 404]).toContain(res.status);
        });

        it('returns a valid response for a well-formed UUID', async () => {
            const res = await app.request(`${base}/${validUuid}/breadcrumb`);
            expect(res.status).toBe(404);
        });
    });

    describe('GET /by-path', () => {
        it('returns 400 when path is missing', async () => {
            const res = await app.request(`${base}/by-path`);
            expect([400, 422]).toContain(res.status);
        });

        it('returns 400 for invalid path format (uppercase)', async () => {
            const res = await app.request(`${base}/by-path?path=/Argentina/Litoral`);
            expect([400, 422]).toContain(res.status);
        });

        it('returns 400 for invalid path format (no leading slash)', async () => {
            const res = await app.request(`${base}/by-path?path=argentina/litoral`);
            expect([400, 422]).toContain(res.status);
        });

        it('returns a valid response for a well-formed path', async () => {
            const res = await app.request(`${base}/by-path?path=/argentina/litoral`);
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body).toHaveProperty('data');
        });

        it('returns null for a well-formed but non-existent path', async () => {
            const res = await app.request(`${base}/by-path?path=/nonexistent/destination`);
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.data).toBeNull();
        });
    });
});
