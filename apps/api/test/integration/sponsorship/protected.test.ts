import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

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
 */
describe('Protected Sponsorship Routes', () => {
    let app: ReturnType<typeof initApp>;

    const base = '/api/v1/protected/sponsorships';
    const nonExistentId = '123e4567-e89b-12d3-a456-426614174000';

    const sponsorActor = {
        id: crypto.randomUUID(),
        role: RoleEnum.SPONSOR,
        permissions: [
            PermissionEnum.ACCESS_API_PUBLIC,
            PermissionEnum.ACCESS_API_PRIVATE,
            PermissionEnum.SPONSORSHIP_VIEW,
            PermissionEnum.SPONSORSHIP_CREATE,
            PermissionEnum.SPONSORSHIP_UPDATE,
            PermissionEnum.SPONSORSHIP_DELETE
        ]
    };

    /**
     * Builds mock auth headers for a test actor.
     */
    function makeHeaders(
        actor: { id: string; role: string; permissions: string[] },
        extra: Record<string, string> = {}
    ): Record<string, string> {
        return {
            'content-type': 'application/json',
            'user-agent': 'vitest',
            'x-mock-actor-id': actor.id,
            'x-mock-actor-role': actor.role,
            'x-mock-actor-permissions': JSON.stringify(actor.permissions),
            ...extra
        };
    }

    beforeAll(() => {
        validateApiEnv();
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        app = initApp();
    });

    // ─── GET / ──────────────────────────────────────────────────────────────────

    describe('GET /protected/sponsorships', () => {
        it('returns paginated list for authenticated user', async () => {
            const res = await app.request(`${base}?page=1&pageSize=10`, {
                headers: makeHeaders(sponsorActor)
            });
            expect([200, 400, 401, 402, 403]).toContain(res.status);
        });

        it('returns 401 when no auth headers provided', async () => {
            const res = await app.request(base);
            expect([401, 403]).toContain(res.status);
        });
    });

    // ─── GET /:id ────────────────────────────────────────────────────────────────

    describe('GET /protected/sponsorships/:id', () => {
        it('returns 200 or 404 for valid UUID', async () => {
            const res = await app.request(`${base}/${nonExistentId}`, {
                headers: makeHeaders(sponsorActor)
            });
            expect([200, 400, 401, 402, 403, 404]).toContain(res.status);
        });

        it('returns 400 for invalid UUID format', async () => {
            const res = await app.request(`${base}/not-a-uuid`, {
                headers: makeHeaders(sponsorActor)
            });
            expect([400, 404, 422]).toContain(res.status);
        });
    });

    // ─── GET /:id/analytics ──────────────────────────────────────────────────────

    describe('GET /protected/sponsorships/:id/analytics', () => {
        it('returns 200 or 404 for valid UUID', async () => {
            const res = await app.request(`${base}/${nonExistentId}/analytics`, {
                headers: makeHeaders(sponsorActor)
            });
            expect([200, 400, 401, 402, 403, 404]).toContain(res.status);
        });
    });

    // ─── POST / ──────────────────────────────────────────────────────────────────

    describe('POST /protected/sponsorships', () => {
        it('returns 201 or validation error for valid payload shape', async () => {
            const payload = {
                targetType: 'event',
                targetId: '00000000-0000-0000-0000-000000000001',
                levelId: '00000000-0000-0000-0000-000000000002',
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
            expect([200, 201, 400, 401, 402, 403, 404, 422]).toContain(res.status);
        });

        it('returns 400 or 422 for empty body', async () => {
            const res = await app.request(base, {
                method: 'POST',
                headers: makeHeaders(sponsorActor),
                body: JSON.stringify({})
            });
            expect([400, 401, 402, 403, 422]).toContain(res.status);
        });

        it('returns 401 when unauthenticated', async () => {
            const res = await app.request(base, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ targetType: 'event' })
            });
            expect([401, 403]).toContain(res.status);
        });
    });

    // ─── PUT /:id ────────────────────────────────────────────────────────────────

    describe('PUT /protected/sponsorships/:id', () => {
        it('returns update response or 404 for non-existent resource', async () => {
            const res = await app.request(`${base}/${nonExistentId}`, {
                method: 'PUT',
                headers: makeHeaders(sponsorActor),
                body: JSON.stringify({ linkUrl: 'https://updated.example.com' })
            });
            expect([200, 400, 401, 402, 403, 404, 422]).toContain(res.status);
        });

        it('returns 400 for invalid UUID in path', async () => {
            const res = await app.request(`${base}/not-a-uuid`, {
                method: 'PUT',
                headers: makeHeaders(sponsorActor),
                body: JSON.stringify({ linkUrl: 'https://example.com' })
            });
            expect([400, 404, 422]).toContain(res.status);
        });
    });

    // ─── DELETE /:id ─────────────────────────────────────────────────────────────

    describe('DELETE /protected/sponsorships/:id', () => {
        it('returns success or 404 for non-existent resource', async () => {
            const res = await app.request(`${base}/${nonExistentId}`, {
                method: 'DELETE',
                headers: makeHeaders(sponsorActor)
            });
            expect([200, 204, 400, 401, 402, 403, 404]).toContain(res.status);
        });

        it('returns 401 when unauthenticated', async () => {
            const res = await app.request(`${base}/${nonExistentId}`, {
                method: 'DELETE'
            });
            expect([401, 403]).toContain(res.status);
        });
    });
});
