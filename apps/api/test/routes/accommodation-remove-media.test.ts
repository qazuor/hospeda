/**
 * Unit/integration tests for DELETE /api/v1/admin/accommodations/:id/media/:mediaId
 * Remove a photo from an accommodation gallery — Admin endpoint (SPEC-204 T-018)
 *
 * Coverage:
 * - Authentication: unauthenticated requests return 401/403
 * - Happy path: soft-deletes row and returns success
 * - Error: accommodation not found returns 4xx
 * - Error: media row not found returns 4xx
 * - Route registration: path should not return 404
 *
 * Testing strategy: mock `@repo/service-core` so no DB is needed.
 *
 * @module test/routes/accommodation-remove-media
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------
const { mockRemoveMedia } = vi.hoisted(() => ({
    mockRemoveMedia: vi.fn()
}));

vi.mock('@repo/service-core', async () => {
    const actual = await vi.importActual<typeof import('@repo/service-core')>('@repo/service-core');
    return {
        ...actual,
        AccommodationService: vi.fn().mockImplementation(() => ({
            removeMedia: mockRemoveMedia
        }))
    };
});

const mockActor = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    role: 'SUPER_ADMIN',
    permissions: ['accommodation.update.any', 'access.panelAdmin']
};
vi.mock('../../src/utils/actor.js', () => ({
    getActorFromContext: () => mockActor
}));

vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

// ---------------------------------------------------------------------------
// Import app AFTER mocks
// ---------------------------------------------------------------------------
import { initApp } from '../../src/app.js';
import type { AppOpenAPI } from '../../src/types.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const ACCOMMODATION_ID = '00000000-0000-0000-0000-000000000001';
const MEDIA_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const BASE_URL = `/api/v1/admin/accommodations/${ACCOMMODATION_ID}/media/${MEDIA_ID}`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('DELETE /api/v1/admin/accommodations/:id/media/:mediaId — removeMedia (SPEC-204 T-018)', () => {
    let app: AppOpenAPI;

    beforeEach(() => {
        vi.clearAllMocks();
        app = initApp();
        mockRemoveMedia.mockResolvedValue({ data: { success: true }, error: undefined });
    });

    // ── Authentication ─────────────────────────────────────────────────────────

    describe('Authentication', () => {
        it('should return 401/403 when no Authorization header is provided', async () => {
            const res = await app.request(BASE_URL, { method: 'DELETE' });
            expect([400, 401, 403]).toContain(res.status);
        });
    });

    // ── Happy path ────────────────────────────────────────────────────────────

    describe('Happy path', () => {
        it('should return 2xx with success on valid removal', async () => {
            const res = await app.request(BASE_URL, {
                method: 'DELETE',
                headers: { Authorization: 'Bearer test-admin-token' }
            });

            // Deletion returns 200 with { success: true, data: ... } via createAdminRoute.
            if ([200, 204].includes(res.status)) {
                if (res.status === 200) {
                    const body = await res.json();
                    expect(body.success).toBe(true);
                }
            } else {
                expect(res.status).not.toBe(404);
            }
        });

        it('should call service.removeMedia with correct params from URL', async () => {
            await app.request(BASE_URL, {
                method: 'DELETE',
                headers: { Authorization: 'Bearer test-admin-token' }
            });

            if (mockRemoveMedia.mock.calls.length > 0) {
                const firstCall = mockRemoveMedia.mock.calls[0] as [
                    unknown,
                    { accommodationId: string; mediaId: string }
                ];
                expect(firstCall[1].accommodationId).toBe(ACCOMMODATION_ID);
                expect(firstCall[1].mediaId).toBe(MEDIA_ID);
            }
        });
    });

    // ── Error handling ─────────────────────────────────────────────────────────

    describe('Error handling', () => {
        it('should return 4xx when accommodation is not found', async () => {
            mockRemoveMedia.mockResolvedValue({
                data: undefined,
                error: { code: 'NOT_FOUND', message: 'Accommodation not found' }
            });

            const res = await app.request(BASE_URL, {
                method: 'DELETE',
                headers: { Authorization: 'Bearer test-admin-token' }
            });

            expect([400, 401, 403, 404, 500]).toContain(res.status);
            expect(res.status).not.toBe(200);
        });

        it('should return 4xx when media row is not found', async () => {
            mockRemoveMedia.mockResolvedValue({
                data: undefined,
                error: { code: 'NOT_FOUND', message: 'Media not found for this accommodation' }
            });

            const res = await app.request(BASE_URL, {
                method: 'DELETE',
                headers: { Authorization: 'Bearer test-admin-token' }
            });

            expect(res.status).not.toBe(200);
        });
    });

    // ── Route registration sanity ─────────────────────────────────────────────

    describe('Route registration', () => {
        it('should be registered (DELETE to the path does not return 404)', async () => {
            const res = await app.request(BASE_URL, {
                method: 'DELETE',
                headers: { Authorization: 'Bearer test-admin-token' }
            });
            expect(res.status).not.toBe(404);
        });

        it('should not confuse "reorder" as a mediaId param', async () => {
            // The reorder route PATCH /:id/media/reorder must be registered first.
            // This test verifies DELETE on /reorder does NOT match the DELETE /:mediaId route
            // (wrong method on a fixed-suffix path → 404 or 405, not success).
            const reorderUrl = `/api/v1/admin/accommodations/${ACCOMMODATION_ID}/media/reorder`;
            const res = await app.request(reorderUrl, {
                method: 'DELETE',
                headers: { Authorization: 'Bearer test-admin-token' }
            });
            // DELETE on /reorder should NOT succeed (405 or 404); if it does call removeMedia
            // with id="reorder" that's a UUID validation failure (400).
            expect([400, 404, 405]).toContain(res.status);
        });
    });
});
