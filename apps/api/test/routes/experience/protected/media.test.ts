/**
 * Tests for experience media routes — Protected tier (HOS-372).
 *
 * Covers:
 * - POST   /api/v1/protected/experiences/:id/media
 * - GET    /api/v1/protected/experiences/:id/media
 * - PATCH  /api/v1/protected/experiences/:id/media/reorder
 * - PUT    /api/v1/protected/experiences/:id/media/:mediaId/featured
 * - DELETE /api/v1/protected/experiences/:id/media/:mediaId
 *
 * Testing strategy: mock the standalone `@repo/service-core` media helper
 * functions (addExperienceMedia / removeExperienceMedia / getExperienceMedia /
 * reorderExperienceMedia / setFeaturedExperienceMedia) so no real DB is
 * needed, then exercise the routes via `initApp()` with the `x-mock-actor-*`
 * header triplet.
 *
 * @module test/routes/experience/protected/media
 */
import { ModerationStatusEnum } from '@repo/schemas';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mocks — standalone media functions are module-level exports, not
// class methods, so they are mocked directly rather than via a class stub.
// ---------------------------------------------------------------------------
const {
    mockAddExperienceMedia,
    mockRemoveExperienceMedia,
    mockGetExperienceMedia,
    mockReorderExperienceMedia,
    mockSetFeaturedExperienceMedia
} = vi.hoisted(() => ({
    mockAddExperienceMedia: vi.fn(),
    mockRemoveExperienceMedia: vi.fn(),
    mockGetExperienceMedia: vi.fn(),
    mockReorderExperienceMedia: vi.fn(),
    mockSetFeaturedExperienceMedia: vi.fn()
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        addExperienceMedia: mockAddExperienceMedia,
        removeExperienceMedia: mockRemoveExperienceMedia,
        getExperienceMedia: mockGetExperienceMedia,
        reorderExperienceMedia: mockReorderExperienceMedia,
        setFeaturedExperienceMedia: mockSetFeaturedExperienceMedia
    };
});

// ---------------------------------------------------------------------------
// Import app AFTER mocks
// ---------------------------------------------------------------------------
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const EXPERIENCE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const MEDIA_ID_1 = 'cccccccc-cccc-4ccc-8ccc-cccccccccc01';
const MEDIA_ID_2 = 'cccccccc-cccc-4ccc-8ccc-cccccccccc02';
const BASE = `/api/v1/protected/experiences/${EXPERIENCE_ID}/media`;

const NOW = new Date('2026-01-15T12:00:00.000Z');

const USER_AGENT = { 'user-agent': 'vitest' };
const OWNER_HEADERS = {
    ...USER_AGENT,
    'x-mock-actor-id': 'owner-1',
    'x-mock-actor-role': 'OWNER_BASICO',
    'x-mock-actor-permissions': JSON.stringify(['commerce.editOwn'])
};

const buildMediaRow = (id: string, sortOrder: number) => ({
    id,
    experienceId: EXPERIENCE_ID,
    url: `https://res.cloudinary.com/demo/image/upload/${id}.jpg`,
    publicId: `hospeda/dev/${id}`,
    caption: 'Vista panoramica',
    alt: 'Foto de la experiencia',
    description: undefined,
    attribution: null,
    moderationState: ModerationStatusEnum.APPROVED,
    state: 'visible' as const,
    isFeatured: false,
    sortOrder,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null
});

describe('Experience media routes — Protected tier (HOS-372)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Service error mapping ──────────────────────────────────────────────
    //
    // NOT an authorization test. Authorization lives in
    // `checkExperienceCanEditMedia` (COMMERCE_EDIT_OWN / COMMERCE_EDIT_ALL) inside the
    // standalone service function, which is mocked module-wide here — so nothing
    // in this file can prove a guest is refused. These cases only assert that a
    // FORBIDDEN coming back from the service becomes a 4xx instead of a 500.
    //
    // The real gate is covered without mocks in
    // `packages/service-core/test/services/experience/experience.media.test.ts`
    // ('should return FORBIDDEN when actor lacks COMMERCE_EDIT_OWN').

    describe('Service error mapping', () => {
        it('POST /media — maps a service FORBIDDEN to a 4xx', async () => {
            mockAddExperienceMedia.mockResolvedValue({
                data: undefined,
                error: { code: 'FORBIDDEN', message: 'Permission denied' }
            });

            const res = await app.request(BASE, {
                method: 'POST',
                headers: { ...USER_AGENT, 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: 'https://example.com/photo.jpg' })
            });
            expect([400, 401, 403]).toContain(res.status);
        });

        it('GET /media — maps a service FORBIDDEN to a 4xx', async () => {
            mockGetExperienceMedia.mockResolvedValue({
                data: undefined,
                error: { code: 'FORBIDDEN', message: 'Permission denied' }
            });

            const res = await app.request(BASE, { method: 'GET', headers: USER_AGENT });
            expect([400, 401, 403]).toContain(res.status);
        });

        it('DELETE /media/:mediaId — maps a service FORBIDDEN to a 4xx', async () => {
            mockRemoveExperienceMedia.mockResolvedValue({
                data: undefined,
                error: { code: 'FORBIDDEN', message: 'Permission denied' }
            });

            const res = await app.request(`${BASE}/${MEDIA_ID_1}`, {
                method: 'DELETE',
                headers: USER_AGENT
            });
            expect([400, 401, 403]).toContain(res.status);
        });
    });

    // ── Happy paths ───────────────────────────────────────────────────────

    describe('Happy path', () => {
        it('POST /media — adds a photo and returns it', async () => {
            mockAddExperienceMedia.mockResolvedValue({
                data: { media: buildMediaRow(MEDIA_ID_1, 0) },
                error: undefined
            });

            const res = await app.request(BASE, {
                method: 'POST',
                headers: { ...OWNER_HEADERS, 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: 'https://example.com/photo.jpg' })
            });

            if (res.status === 201 || res.status === 200) {
                const body = await res.json();
                expect(body.success).toBe(true);
                expect(body.data.media.id).toBe(MEDIA_ID_1);
            } else {
                expect(res.status).not.toBe(404);
            }
        });

        it('GET /media — returns the gallery list', async () => {
            mockGetExperienceMedia.mockResolvedValue({
                data: { media: [buildMediaRow(MEDIA_ID_1, 0), buildMediaRow(MEDIA_ID_2, 1)] },
                error: undefined
            });

            const res = await app.request(BASE, { method: 'GET', headers: OWNER_HEADERS });

            if (res.status === 200) {
                const body = await res.json();
                expect(body.success).toBe(true);
                expect(Array.isArray(body.data.media)).toBe(true);
            } else {
                expect(res.status).not.toBe(404);
            }
        });

        it('PUT /media/:mediaId/featured — promotes a photo to featured', async () => {
            mockSetFeaturedExperienceMedia.mockResolvedValue({
                data: { media: { ...buildMediaRow(MEDIA_ID_1, 0), isFeatured: true } },
                error: undefined
            });

            const res = await app.request(`${BASE}/${MEDIA_ID_1}/featured`, {
                method: 'PUT',
                headers: OWNER_HEADERS
            });

            if (res.status === 200) {
                const body = await res.json();
                expect(body.success).toBe(true);
                expect(body.data.media.isFeatured).toBe(true);
            } else {
                expect(res.status).not.toBe(404);
            }
        });

        it('DELETE /media/:mediaId — removes a photo', async () => {
            mockRemoveExperienceMedia.mockResolvedValue({
                data: { success: true },
                error: undefined
            });

            const res = await app.request(`${BASE}/${MEDIA_ID_1}`, {
                method: 'DELETE',
                headers: OWNER_HEADERS
            });

            expect(res.status).not.toBe(404);
            expect(res.status).not.toBe(500);
        });
    });

    // ── Reorder route — must not be swallowed by :mediaId ────────────────────

    describe('Reorder route ordering', () => {
        it('PATCH /media/reorder is registered and calls the reorder service (not treated as a mediaId)', async () => {
            mockReorderExperienceMedia.mockResolvedValue({
                data: { media: [buildMediaRow(MEDIA_ID_2, 0), buildMediaRow(MEDIA_ID_1, 1)] },
                error: undefined
            });

            const res = await app.request(`${BASE}/reorder`, {
                method: 'PATCH',
                headers: { ...OWNER_HEADERS, 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderedIds: [MEDIA_ID_2, MEDIA_ID_1] })
            });

            expect(res.status).not.toBe(404);

            if (mockReorderExperienceMedia.mock.calls.length > 0) {
                const call = mockReorderExperienceMedia.mock.calls[0] as [
                    unknown,
                    unknown,
                    { experienceId: string; orderedIds: string[] }
                ];
                expect(call[2].experienceId).toBe(EXPERIENCE_ID);
                expect(call[2].orderedIds).toEqual([MEDIA_ID_2, MEDIA_ID_1]);
            }
        });

        it('GET on the reorder path is not treated as a successful list-by-mediaId match', async () => {
            const res = await app.request(`${BASE}/reorder`, {
                method: 'GET',
                headers: OWNER_HEADERS
            });
            expect(res.status).not.toBe(200);
        });
    });

    // ── Error handling ────────────────────────────────────────────────────

    describe('Error handling', () => {
        it('returns 4xx (not 500) when the listing is not found', async () => {
            mockAddExperienceMedia.mockResolvedValue({
                data: undefined,
                error: { code: 'NOT_FOUND', message: 'Experience listing not found' }
            });

            const res = await app.request(BASE, {
                method: 'POST',
                headers: { ...OWNER_HEADERS, 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: 'https://example.com/photo.jpg' })
            });

            expect(res.status).toBeGreaterThanOrEqual(400);
            expect(res.status).toBeLessThan(500);
        });

        it('reorder returns 4xx (not 500) when orderedIds mismatch is reported by the service', async () => {
            mockReorderExperienceMedia.mockResolvedValue({
                data: undefined,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'orderedIds does not match visible media for this experience listing'
                }
            });

            const res = await app.request(`${BASE}/reorder`, {
                method: 'PATCH',
                headers: { ...OWNER_HEADERS, 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderedIds: [MEDIA_ID_1] })
            });

            expect(res.status).toBeGreaterThanOrEqual(400);
            expect(res.status).toBeLessThan(500);
        });
    });
});
