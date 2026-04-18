/**
 * Smoke tests for media route registration (SPEC-078 / GAP-078-001).
 *
 * Verifies that the admin and protected media routers are mounted on the
 * API app at the correct paths. Without registration, requests would return
 * 404 instead of the expected 401 (auth required) or 503 (provider missing).
 *
 * @module test/routes/media/routes-registration
 */
import { PermissionEnum } from '@repo/schemas';
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import type { AppOpenAPI } from '../../../src/types';
import { createAuthenticatedRequest, createMockAdminActor } from '../../helpers/auth';

describe('Media routes registration (smoke)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    describe('without authentication', () => {
        it('POST /api/v1/admin/media/upload should not return 404 (route exists)', async () => {
            const res = await app.request('/api/v1/admin/media/upload', {
                method: 'POST',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).not.toBe(404);
            expect([401, 403]).toContain(res.status);
        });

        it('DELETE /api/v1/admin/media should not return 404 (route exists)', async () => {
            const res = await app.request('/api/v1/admin/media?publicId=test', {
                method: 'DELETE',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).not.toBe(404);
            expect([401, 403]).toContain(res.status);
        });

        it('POST /api/v1/protected/media/upload should not return 404 (route exists)', async () => {
            const res = await app.request('/api/v1/protected/media/upload', {
                method: 'POST',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).not.toBe(404);
            expect([401, 403]).toContain(res.status);
        });
    });

    describe('with admin authentication (Cloudinary credentials absent in test env)', () => {
        const adminActor = createMockAdminActor({
            permissions: [
                ...createMockAdminActor().permissions,
                PermissionEnum.ACCESS_PANEL_ADMIN,
                PermissionEnum.ACCESS_API_ADMIN
            ]
        });

        it('POST /api/v1/admin/media/upload reaches handler (not 404, not 401)', async () => {
            const res = await app.request('/api/v1/admin/media/upload', {
                method: 'POST',
                ...createAuthenticatedRequest(adminActor, {
                    'content-type': 'multipart/form-data; boundary=----test'
                })
            });
            expect(res.status).not.toBe(404);
            expect(res.status).not.toBe(401);
            // Without Cloudinary creds in test env => 503;
            // also acceptable: 400/422 if multipart parsing fails before provider check.
            expect([400, 422, 503]).toContain(res.status);
        });

        it('DELETE /api/v1/admin/media reaches handler (not 404, not 401)', async () => {
            const res = await app.request('/api/v1/admin/media?publicId=hospeda/test/x', {
                method: 'DELETE',
                ...createAuthenticatedRequest(adminActor)
            });
            expect(res.status).not.toBe(404);
            expect(res.status).not.toBe(401);
            // Provider absent => 503; otherwise upstream/validation outcomes.
            expect([400, 422, 503]).toContain(res.status);
        });
    });
});
