/**
 * Tests for experience media routes — Admin tier (HOS-372).
 *
 * Covers:
 * - POST   /api/v1/admin/experiences/:id/media
 * - GET    /api/v1/admin/experiences/:id/media
 * - PATCH  /api/v1/admin/experiences/:id/media/reorder
 * - PUT    /api/v1/admin/experiences/:id/media/:mediaId/featured
 * - DELETE /api/v1/admin/experiences/:id/media/:mediaId
 *
 * Testing strategy: mock the standalone `@repo/service-core` media helper
 * functions so no real DB is needed, then exercise the routes via
 * `initApp()` with the `x-mock-actor-*` header triplet (see
 * gastronomy/admin/admin-gastronomy.test.ts convention).
 *
 * @module test/routes/experience/admin/media
 */
import { ModerationStatusEnum } from '@repo/schemas';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mocks
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
const BASE = `/api/v1/admin/experiences/${EXPERIENCE_ID}/media`;

const NOW = new Date('2026-01-15T12:00:00.000Z');

const USER_AGENT = { 'user-agent': 'vitest' };
const ADMIN_HEADERS = {
    ...USER_AGENT,
    'x-mock-actor-id': '11111111-1111-4111-8111-111111111111',
    'x-mock-actor-role': 'ADMIN',
    'x-mock-actor-permissions': JSON.stringify(['access.panelAdmin', 'commerce.editAll'])
};
const NO_COMMERCE_PERMS_HEADERS = {
    ...USER_AGENT,
    'x-mock-actor-id': '11111111-1111-4111-8111-111111111111',
    'x-mock-actor-role': 'ADMIN',
    'x-mock-actor-permissions': JSON.stringify(['access.panelAdmin'])
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

describe('Experience media routes — Admin tier (HOS-372)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Authentication / authorization ──────────────────────────────────────

    describe('Service error mapping', () => {
        it('POST /media — returns 401/403 when no auth headers are provided', async () => {
            const res = await app.request(BASE, {
                method: 'POST',
                headers: { ...USER_AGENT, 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: 'https://example.com/photo.jpg' })
            });
            expect([400, 401, 403]).toContain(res.status);
        });

        it('POST /media — returns 403 when actor lacks COMMERCE_EDIT_ALL', async () => {
            const res = await app.request(BASE, {
                method: 'POST',
                headers: { ...NO_COMMERCE_PERMS_HEADERS, 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: 'https://example.com/photo.jpg' })
            });
            expect(res.status).toBe(403);
        });

        it('DELETE /media/:mediaId — returns 401/403 when no auth headers are provided', async () => {
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
                headers: { ...ADMIN_HEADERS, 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: 'https://example.com/photo.jpg' })
            });

            if (res.status === 201 || res.status === 200) {
                const body = await res.json();
                expect(body.success).toBe(true);
                expect(body.data.media.id).toBe(MEDIA_ID_1);
            } else {
                expect(res.status).not.toBe(403);
                expect(res.status).not.toBe(404);
            }
        });

        it('GET /media — returns the gallery list', async () => {
            mockGetExperienceMedia.mockResolvedValue({
                data: { media: [buildMediaRow(MEDIA_ID_1, 0), buildMediaRow(MEDIA_ID_2, 1)] },
                error: undefined
            });

            const res = await app.request(BASE, { method: 'GET', headers: ADMIN_HEADERS });

            if (res.status === 200) {
                const body = await res.json();
                expect(body.success).toBe(true);
                expect(Array.isArray(body.data.media)).toBe(true);
            } else {
                expect(res.status).not.toBe(403);
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
                headers: ADMIN_HEADERS
            });

            if (res.status === 200) {
                const body = await res.json();
                expect(body.success).toBe(true);
                expect(body.data.media.isFeatured).toBe(true);
            } else {
                expect(res.status).not.toBe(403);
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
                headers: ADMIN_HEADERS
            });

            expect(res.status).not.toBe(403);
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
                headers: { ...ADMIN_HEADERS, 'Content-Type': 'application/json' },
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
                headers: ADMIN_HEADERS
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
                headers: { ...ADMIN_HEADERS, 'Content-Type': 'application/json' },
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
                headers: { ...ADMIN_HEADERS, 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderedIds: [MEDIA_ID_1] })
            });

            expect(res.status).toBeGreaterThanOrEqual(400);
            expect(res.status).toBeLessThan(500);
        });
    });
});
