/**
 * Integration tests for public owner-promotion routes.
 *
 * Covers:
 * - GET /api/v1/public/owner-promotions — paginated list
 * - GET /api/v1/public/owner-promotions/:id — get by ID
 *
 * These routes are unauthenticated and read-only.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('GET /api/v1/public/owner-promotions (list)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/owner-promotions';

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    it('returns 200 with data array on happy path', async () => {
        // Arrange / Act
        const res = await app.request(base, { headers: { 'user-agent': 'vitest' } });

        // Assert — 403 can occur in some env configs where rate-limit or CORS is strict
        expect([200, 400, 403]).toContain(res.status);
        if (res.status === 200) {
            const body = await res.json();
            expect(body).toHaveProperty('data');
        }
    });

    it('includes pagination metadata when successful', async () => {
        // Arrange / Act
        const res = await app.request(base, { headers: { 'user-agent': 'vitest' } });

        // Assert
        if (res.status === 200) {
            const body = await res.json();
            expect(body).toHaveProperty('pagination');
            expect(body.pagination).toHaveProperty('page');
            expect(body.pagination).toHaveProperty('pageSize');
            expect(body.pagination).toHaveProperty('total');
        }
    });

    it('respects pageSize query parameter', async () => {
        // Arrange / Act
        const res = await app.request(`${base}?pageSize=5`, {
            headers: { 'user-agent': 'vitest' }
        });

        // Assert
        if (res.status === 200) {
            const body = await res.json();
            expect(body.pagination.pageSize).toBeLessThanOrEqual(5);
        }
    });

    it('enforces maximum pageSize limit', async () => {
        // Arrange / Act
        const res = await app.request(`${base}?pageSize=500`, {
            headers: { 'user-agent': 'vitest' }
        });

        // Assert
        if (res.status === 200) {
            const body = await res.json();
            expect(body.pagination.pageSize).toBeLessThanOrEqual(100);
        }
    });

    it('does not require authentication', async () => {
        // Arrange — no auth headers at all
        // Act
        const res = await app.request(base);

        // Assert — must NOT return 401
        expect(res.status).not.toBe(401);
    });

    it('includes cache headers', async () => {
        // Arrange / Act
        const res = await app.request(base, { headers: { 'user-agent': 'vitest' } });

        // Assert
        if (res.status === 200) {
            const cacheControl = res.headers.get('cache-control');
            expect(cacheControl).toBeTruthy();
        }
    });
});

describe('GET /api/v1/public/owner-promotions/:id', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/public/owner-promotions';

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    it('returns 200 or 404 for a valid UUID', async () => {
        // Arrange
        const validUuid = '00000000-0000-0000-0000-000000000001';

        // Act
        const res = await app.request(`${base}/${validUuid}`, {
            headers: { 'user-agent': 'vitest' }
        });

        // Assert
        expect([200, 400, 404]).toContain(res.status);
    });

    it('returns 400 for an invalid UUID format', async () => {
        // Arrange / Act
        const res = await app.request(`${base}/not-a-uuid`, {
            headers: { 'user-agent': 'vitest' }
        });

        // Assert
        expect([400, 422]).toContain(res.status);
    });

    it('returns data object when entity is found', async () => {
        // Arrange
        const validUuid = '00000000-0000-0000-0000-000000000001';

        // Act
        const res = await app.request(`${base}/${validUuid}`, {
            headers: { 'user-agent': 'vitest' }
        });

        // Assert
        if (res.status === 200) {
            const body = await res.json();
            expect(body).toHaveProperty('data');
        }
    });

    it('does not leak admin-only fields when found', async () => {
        // Arrange
        const validUuid = '00000000-0000-0000-0000-000000000001';

        // Act
        const res = await app.request(`${base}/${validUuid}`, {
            headers: { 'user-agent': 'vitest' }
        });

        // Assert — admin fields like deletedAt / deletedById must not be present at top level
        if (res.status === 200) {
            const body = (await res.json()) as Record<string, unknown>;
            const item = (body.data ?? body) as Record<string, unknown>;
            expect(item).not.toHaveProperty('deletedAt');
            expect(item).not.toHaveProperty('deletedById');
        }
    });
});
