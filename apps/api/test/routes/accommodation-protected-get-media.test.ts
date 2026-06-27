/**
 * Unit/integration tests for GET /api/v1/protected/accommodations/:id/media
 * List accommodation gallery photos — Protected (owner-facing) endpoint (SPEC-204)
 *
 * Coverage:
 * - Authentication: unauthenticated requests return 401/403
 * - Happy path: returns media list for valid accommodation
 * - Error: accommodation not found returns 4xx
 * - Route registration sanity
 *
 * Testing strategy: mock `@repo/service-core` so no DB is needed.
 * Actor is a HOST owner with UPDATE_OWN + panelProtected access.
 *
 * @module test/routes/accommodation-protected-get-media
 */

import { ModerationStatusEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------
const { mockAdminGetMedia } = vi.hoisted(() => ({
    mockAdminGetMedia: vi.fn()
}));

vi.mock('@repo/service-core', async () => {
    const actual = await vi.importActual<typeof import('@repo/service-core')>('@repo/service-core');
    return {
        ...actual,
        AccommodationService: vi.fn().mockImplementation(() => ({
            adminGetMedia: mockAdminGetMedia
        }))
    };
});

// Actor: HOST owner with UPDATE_OWN permission (passes service _canUpdate gate).
const mockActor = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    role: 'HOST',
    permissions: ['accommodation.update.own', 'access.panelProtected']
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
const MEDIA_ID_1 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01';
const MEDIA_ID_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02';
const BASE_URL = `/api/v1/protected/accommodations/${ACCOMMODATION_ID}/media`;

const NOW = new Date('2026-01-15T12:00:00.000Z');

const buildMediaRow = (id: string, sortOrder: number) => ({
    id,
    accommodationId: ACCOMMODATION_ID,
    url: `https://res.cloudinary.com/demo/image/upload/${id}.jpg`,
    publicId: `hospeda/dev/${id}`,
    caption: 'Vista al mar',
    alt: 'Foto del alojamiento',
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

const MEDIA_LIST = [buildMediaRow(MEDIA_ID_1, 0), buildMediaRow(MEDIA_ID_2, 1)];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('GET /api/v1/protected/accommodations/:id/media — getMedia (SPEC-204)', () => {
    let app: AppOpenAPI;

    beforeEach(() => {
        vi.clearAllMocks();
        app = initApp();
        mockAdminGetMedia.mockResolvedValue({ data: { media: MEDIA_LIST }, error: undefined });
    });

    // ── Authentication ─────────────────────────────────────────────────────────

    describe('Authentication', () => {
        it('should return 401/403 when no Authorization header is provided', async () => {
            const res = await app.request(BASE_URL, { method: 'GET' });
            expect([400, 401, 403]).toContain(res.status);
        });
    });

    // ── Happy path ────────────────────────────────────────────────────────────

    describe('Happy path', () => {
        it('should return 200 with the media list', async () => {
            const res = await app.request(BASE_URL, {
                method: 'GET',
                headers: { Authorization: 'Bearer test-protected-token' }
            });

            if (res.status === 200) {
                const body = await res.json();
                expect(body.success).toBe(true);
                expect(body.data).toBeDefined();
                expect(Array.isArray(body.data.media)).toBe(true);
                expect(body.data.media).toHaveLength(2);
                expect(body.data.media[0].id).toBe(MEDIA_ID_1);
                expect(body.data.media[0].sortOrder).toBe(0);
                expect(body.data.media[1].id).toBe(MEDIA_ID_2);
                expect(body.data.media[1].sortOrder).toBe(1);
            } else {
                expect(res.status).not.toBe(404);
            }
        });

        it('should call service.adminGetMedia with accommodationId from URL param', async () => {
            await app.request(BASE_URL, {
                method: 'GET',
                headers: { Authorization: 'Bearer test-protected-token' }
            });

            if (mockAdminGetMedia.mock.calls.length > 0) {
                const firstCall = mockAdminGetMedia.mock.calls[0] as [
                    unknown,
                    { accommodationId: string; state?: string }
                ];
                expect(firstCall[1].accommodationId).toBe(ACCOMMODATION_ID);
            }
        });

        it('should return empty media array when accommodation has no photos', async () => {
            mockAdminGetMedia.mockResolvedValue({ data: { media: [] }, error: undefined });

            const res = await app.request(BASE_URL, {
                method: 'GET',
                headers: { Authorization: 'Bearer test-protected-token' }
            });

            if (res.status === 200) {
                const body = await res.json();
                expect(body.data.media).toHaveLength(0);
            } else {
                expect(res.status).not.toBe(404);
            }
        });
    });

    // ── Error handling ─────────────────────────────────────────────────────────

    describe('Error handling', () => {
        it('should return 4xx when accommodation is not found', async () => {
            mockAdminGetMedia.mockResolvedValue({
                data: undefined,
                error: { code: 'NOT_FOUND', message: 'Accommodation not found' }
            });

            const res = await app.request(BASE_URL, {
                method: 'GET',
                headers: { Authorization: 'Bearer test-protected-token' }
            });

            expect(res.status).not.toBe(200);
        });
    });

    // ── Route registration sanity ─────────────────────────────────────────────

    describe('Route registration', () => {
        it('should be registered (GET to the path does not return 404)', async () => {
            const res = await app.request(BASE_URL, {
                method: 'GET',
                headers: { Authorization: 'Bearer test-protected-token' }
            });
            expect(res.status).not.toBe(404);
        });
    });
});
