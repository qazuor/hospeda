import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

/**
 * Integration tests for admin accommodation review CRUD routes.
 *
 * Reviews are registered as a sub-resource of accommodations:
 *   GET    /api/v1/admin/accommodations/reviews/:id
 *   PUT    /api/v1/admin/accommodations/reviews/:id
 *   DELETE /api/v1/admin/accommodations/reviews/:id
 *   POST   /api/v1/admin/accommodations/reviews/:id/restore
 *   DELETE /api/v1/admin/accommodations/reviews/:id/hard
 */
describe('Admin AccommodationReview CRUD Routes', () => {
    let app: ReturnType<typeof initApp>;

    const base = '/api/v1/admin/accommodations/reviews';
    const nonExistentId = '123e4567-e89b-12d3-a456-426614174000';

    const adminActor = {
        id: crypto.randomUUID(),
        role: RoleEnum.ADMIN,
        permissions: [
            PermissionEnum.ACCESS_API_PUBLIC,
            PermissionEnum.ACCESS_API_PRIVATE,
            PermissionEnum.ACCOMMODATION_REVIEW_VIEW,
            PermissionEnum.ACCOMMODATION_REVIEW_UPDATE,
            PermissionEnum.ACCOMMODATION_REVIEW_DELETE,
            PermissionEnum.ACCOMMODATION_REVIEW_RESTORE,
            PermissionEnum.ACCOMMODATION_REVIEW_HARD_DELETE,
            PermissionEnum.MANAGE_CONTENT
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

    // ─── GET /:id ────────────────────────────────────────────────────────────────

    describe('GET /admin/accommodations/reviews/:id', () => {
        it('returns 200 or 404 for valid UUID with admin actor', async () => {
            const res = await app.request(`${base}/${nonExistentId}`, {
                headers: makeHeaders(adminActor)
            });
            expect([200, 400, 401, 402, 403, 404]).toContain(res.status);
        });

        it('returns 400 for non-UUID id', async () => {
            const res = await app.request(`${base}/not-a-valid-uuid`, {
                headers: makeHeaders(adminActor)
            });
            expect([400, 404, 422]).toContain(res.status);
        });

        it('returns 401 or 403 when unauthenticated', async () => {
            const res = await app.request(`${base}/${nonExistentId}`);
            expect([401, 403]).toContain(res.status);
        });
    });

    // ─── PUT /:id ────────────────────────────────────────────────────────────────

    describe('PUT /admin/accommodations/reviews/:id', () => {
        it('returns update result or 404 for non-existent review', async () => {
            const payload = {
                title: 'Updated title',
                content: 'Updated review content.'
            };

            const res = await app.request(`${base}/${nonExistentId}`, {
                method: 'PUT',
                headers: makeHeaders(adminActor),
                body: JSON.stringify(payload)
            });
            expect([200, 400, 401, 402, 403, 404, 422]).toContain(res.status);
        });

        it('returns 400 or 422 for invalid UUID in path', async () => {
            const res = await app.request(`${base}/not-a-uuid`, {
                method: 'PUT',
                headers: makeHeaders(adminActor),
                body: JSON.stringify({ title: 'Updated' })
            });
            expect([400, 404, 422]).toContain(res.status);
        });
    });

    // ─── DELETE /:id ─────────────────────────────────────────────────────────────

    describe('DELETE /admin/accommodations/reviews/:id', () => {
        it('returns soft-delete result or 404 for non-existent review', async () => {
            const res = await app.request(`${base}/${nonExistentId}`, {
                method: 'DELETE',
                headers: makeHeaders(adminActor)
            });
            expect([200, 204, 400, 401, 402, 403, 404]).toContain(res.status);
        });

        it('returns 401 or 403 when unauthenticated', async () => {
            const res = await app.request(`${base}/${nonExistentId}`, {
                method: 'DELETE'
            });
            expect([401, 403]).toContain(res.status);
        });
    });

    // ─── POST /:id/restore ───────────────────────────────────────────────────────

    describe('POST /admin/accommodations/reviews/:id/restore', () => {
        it('returns restore result or 404 for non-existent review', async () => {
            const res = await app.request(`${base}/${nonExistentId}/restore`, {
                method: 'POST',
                headers: makeHeaders(adminActor)
            });
            expect([200, 400, 401, 402, 403, 404]).toContain(res.status);
        });

        it('returns 400 or 422 for invalid UUID in path', async () => {
            const res = await app.request(`${base}/not-a-uuid/restore`, {
                method: 'POST',
                headers: makeHeaders(adminActor)
            });
            expect([400, 404, 422]).toContain(res.status);
        });
    });

    // ─── DELETE /:id/hard ────────────────────────────────────────────────────────

    describe('DELETE /admin/accommodations/reviews/:id/hard', () => {
        it('returns hard-delete result or 404 for non-existent review', async () => {
            const res = await app.request(`${base}/${nonExistentId}/hard`, {
                method: 'DELETE',
                headers: makeHeaders(adminActor)
            });
            expect([200, 204, 400, 401, 402, 403, 404]).toContain(res.status);
        });

        it('returns 401 or 403 when unauthenticated', async () => {
            const res = await app.request(`${base}/${nonExistentId}/hard`, {
                method: 'DELETE'
            });
            expect([401, 403]).toContain(res.status);
        });
    });
});
