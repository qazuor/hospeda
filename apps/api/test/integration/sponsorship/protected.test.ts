// This suite uses the explicit test-only mock-actor headers. Match the
// integration-test convention that keeps those headers available under CI.
delete process.env.CI;

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { createTestUser } from '../../e2e/setup/seed-helpers';
import { testDb } from '../../e2e/setup/test-database';

/**
 * Integration tests for protected sponsorship routes.
 * Tests CRUD operations requiring authenticated user access.
 *
 * Routes tested:
 *   GET    /api/v1/protected/sponsorships
 *   GET    /api/v1/protected/sponsorships/:id
 *   GET    /api/v1/protected/sponsorships/:id/analytics
 *   POST   /api/v1/protected/sponsorships
 *   PUT    /api/v1/protected/sponsorships/:id
 *   DELETE /api/v1/protected/sponsorships/:id
 *
 * The acting sponsor is a real user row (created in `beforeEach`) and the
 * statuses are pinned to the error contract: auth 401, input shape 400,
 * missing resource 404.
 */
describe('Protected Sponsorship Routes', () => {
    let app: ReturnType<typeof initApp>;

    const base = '/api/v1/protected/sponsorships';
    // Valid UUID v4 that matches no seeded row.
    const nonExistentId = '99999999-9999-4999-8999-999999999999';
    const unauthenticatedHeaders = {
        'content-type': 'application/json',
        'user-agent': 'vitest'
    };

    const sponsorActor = {
        id: '',
        roles: [RoleEnum.SPONSOR],
        permissions: [
            PermissionEnum.ACCESS_API_PUBLIC,
            PermissionEnum.ACCESS_API_PRIVATE,
            // Route gates (requiredPermissions) ...
            PermissionEnum.SPONSORSHIP_VIEW,
            PermissionEnum.SPONSORSHIP_CREATE,
            PermissionEnum.SPONSORSHIP_UPDATE,
            PermissionEnum.SPONSORSHIP_DELETE,
            // ... plus the ownership-scoped grants the service checks afterwards
            PermissionEnum.SPONSORSHIP_VIEW_OWN,
            PermissionEnum.SPONSORSHIP_UPDATE_OWN,
            PermissionEnum.SPONSORSHIP_SOFT_DELETE_OWN
        ]
    };

    /**
     * Builds mock auth headers for a test actor.
     */
    function makeHeaders(
        actor: { id: string; roles: readonly string[]; permissions: string[] },
        extra: Record<string, string> = {}
    ): Record<string, string> {
        return {
            'content-type': 'application/json',
            'user-agent': 'vitest',
            'x-mock-actor-id': actor.id,
            'x-mock-actor-role': actor.roles.join(','),
            'x-mock-actor-permissions': JSON.stringify(actor.permissions),
            ...extra
        };
    }

    afterAll(async () => {
        await testDb.teardown();
    });

    afterEach(async () => {
        await testDb.clean();
    });

    beforeAll(async () => {
        await testDb.setup();
        validateApiEnv();
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        app = initApp();
    });

    beforeEach(async () => {
        const user = await createTestUser({
            email: `sponsorship-protected-${crypto.randomUUID()}@example.test`,
            slug: `sponsorship-protected-${crypto.randomUUID()}`
        });
        sponsorActor.id = user.id;
    });

    // ─── GET / ──────────────────────────────────────────────────────────────────

    describe('GET /protected/sponsorships', () => {
        it('returns an empty paginated list for an authenticated sponsor without sponsorships', async () => {
            const res = await app.request(`${base}?page=1&pageSize=10`, {
                headers: makeHeaders(sponsorActor)
            });
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.data.items).toEqual([]);
            expect(body.data.pagination).toMatchObject({ page: 1, pageSize: 10, total: 0 });
        });

        it('returns 403 when the actor lacks the view permissions', async () => {
            const res = await app.request(base, {
                headers: makeHeaders({
                    ...sponsorActor,
                    permissions: [
                        PermissionEnum.ACCESS_API_PUBLIC,
                        PermissionEnum.ACCESS_API_PRIVATE
                    ]
                })
            });
            expect(res.status).toBe(403);
        });

        it('returns 401 when no auth headers provided', async () => {
            const res = await app.request(base, { headers: { 'user-agent': 'vitest' } });
            expect(res.status).toBe(401);
        });
    });

    // ─── GET /:id ────────────────────────────────────────────────────────────────

    describe('GET /protected/sponsorships/:id', () => {
        it('returns 404 for a valid UUID that matches no sponsorship', async () => {
            const res = await app.request(`${base}/${nonExistentId}`, {
                headers: makeHeaders(sponsorActor)
            });
            expect(res.status).toBe(404);
            const body = await res.json();
            expect(body.error.code).toBe('NOT_FOUND');
        });

        it('returns 400 for invalid UUID format', async () => {
            const res = await app.request(`${base}/not-a-uuid`, {
                headers: makeHeaders(sponsorActor)
            });
            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error.code).toBe('VALIDATION_ERROR');
        });
    });

    // ─── GET /:id/analytics ──────────────────────────────────────────────────────

    describe('GET /protected/sponsorships/:id/analytics', () => {
        it('returns 404 for a valid UUID that matches no sponsorship', async () => {
            const res = await app.request(`${base}/${nonExistentId}/analytics`, {
                headers: makeHeaders(sponsorActor)
            });
            expect(res.status).toBe(404);
        });
    });

    // ─── POST / ──────────────────────────────────────────────────────────────────

    describe('POST /protected/sponsorships', () => {
        it('returns 400 when the referenced sponsorship level does not exist', async () => {
            const payload = {
                sponsorUserId: sponsorActor.id,
                targetType: 'event',
                targetId: nonExistentId,
                levelId: nonExistentId,
                startsAt: new Date().toISOString(),
                endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                logoUrl: 'https://example.com/logo.png',
                linkUrl: 'https://example.com'
            };

            const res = await app.request(base, {
                method: 'POST',
                headers: makeHeaders(sponsorActor),
                body: JSON.stringify(payload)
            });
            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error.message).toContain('does not exist');
        });

        it('returns 400 for an empty body', async () => {
            const res = await app.request(base, {
                method: 'POST',
                headers: makeHeaders(sponsorActor),
                body: JSON.stringify({})
            });
            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error.code).toBe('VALIDATION_ERROR');
        });

        it('returns 401 when unauthenticated', async () => {
            const res = await app.request(base, {
                method: 'POST',
                headers: unauthenticatedHeaders,
                body: JSON.stringify({ targetType: 'event' })
            });
            expect(res.status).toBe(401);
        });
    });

    // ─── PUT /:id ────────────────────────────────────────────────────────────────

    describe('PUT /protected/sponsorships/:id', () => {
        it('returns 404 for a non-existent resource', async () => {
            const res = await app.request(`${base}/${nonExistentId}`, {
                method: 'PUT',
                headers: makeHeaders(sponsorActor),
                body: JSON.stringify({ linkUrl: 'https://updated.example.com' })
            });
            expect(res.status).toBe(404);
        });

        it('returns 400 for invalid UUID in path', async () => {
            const res = await app.request(`${base}/not-a-uuid`, {
                method: 'PUT',
                headers: makeHeaders(sponsorActor),
                body: JSON.stringify({ linkUrl: 'https://example.com' })
            });
            expect(res.status).toBe(400);
        });
    });

    // ─── DELETE /:id ─────────────────────────────────────────────────────────────

    describe('DELETE /protected/sponsorships/:id', () => {
        it('returns 404 for a non-existent resource', async () => {
            const res = await app.request(`${base}/${nonExistentId}`, {
                method: 'DELETE',
                headers: makeHeaders(sponsorActor)
            });
            expect(res.status).toBe(404);
        });

        it('returns 401 when unauthenticated', async () => {
            const res = await app.request(`${base}/${nonExistentId}`, {
                method: 'DELETE',
                headers: { 'user-agent': 'vitest' }
            });
            expect(res.status).toBe(401);
        });
    });
});
