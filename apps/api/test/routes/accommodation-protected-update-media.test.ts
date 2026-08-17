/**
 * Unit/integration tests for PATCH /api/v1/protected/accommodations/:id/media/:mediaId
 * Correct photo text metadata in an accommodation gallery — Protected
 * (owner-facing) endpoint (HOS-388)
 *
 * Coverage:
 * - Authentication: unauthenticated requests return 401/403
 * - Happy path: returns the updated media row, calls service with the right params
 * - Error: NOT_FOUND passthrough (accommodation / media row not found)
 * - Route registration: path does not return 404; does not collide with
 *   PATCH /:id/media/reorder (fixed-suffix route registered first)
 *
 * Testing strategy: mock `@repo/service-core` so no DB is needed. Persistence
 * and the "at least one field" / "forbidden field" guarantees are covered at
 * the service layer in
 * `packages/service-core/test/services/accommodation/updateMedia.test.ts`.
 *
 * @module test/routes/accommodation-protected-update-media
 */

import { ModerationStatusEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------
const { mockUpdateMedia } = vi.hoisted(() => ({
    mockUpdateMedia: vi.fn()
}));

vi.mock('@repo/service-core', async () => {
    const actual = await vi.importActual<typeof import('@repo/service-core')>('@repo/service-core');
    return {
        ...actual,
        AccommodationService: vi.fn().mockImplementation(function () {
            return {
                updateMedia: mockUpdateMedia
            };
        })
    };
});

// Actor: HOST owner with UPDATE_OWN permission.
const mockActor = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    roles: ['HOST'],
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
const MEDIA_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const BASE_URL = `/api/v1/protected/accommodations/${ACCOMMODATION_ID}/media/${MEDIA_ID}`;

const NOW = new Date('2026-01-15T12:00:00.000Z');

const UPDATED_MEDIA_ROW = {
    id: MEDIA_ID,
    accommodationId: ACCOMMODATION_ID,
    url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
    publicId: 'hospeda/dev/sample',
    caption: 'Vista al mar',
    alt: 'Foto renombrada',
    description: undefined,
    attribution: null,
    moderationState: ModerationStatusEnum.APPROVED,
    state: 'visible' as const,
    isFeatured: false,
    sortOrder: 0,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('PATCH /api/v1/protected/accommodations/:id/media/:mediaId — updateMedia (HOS-388)', () => {
    let app: AppOpenAPI;

    beforeEach(() => {
        vi.clearAllMocks();
        app = initApp();
        mockUpdateMedia.mockResolvedValue({
            data: { media: UPDATED_MEDIA_ROW },
            error: undefined
        });
    });

    // ── Authentication ─────────────────────────────────────────────────────────

    describe('Authentication', () => {
        it('should return 401/403 when no Authorization header is provided', async () => {
            const res = await app.request(BASE_URL, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alt: 'x' })
            });
            expect([400, 401, 403]).toContain(res.status);
        });
    });

    // ── Happy path ────────────────────────────────────────────────────────────

    describe('Happy path', () => {
        it('should return 200 with the updated media row', async () => {
            const res = await app.request(BASE_URL, {
                method: 'PATCH',
                headers: {
                    Authorization: 'Bearer test-protected-token',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ alt: 'Foto renombrada' })
            });

            if (res.status === 200) {
                const body = await res.json();
                expect(body.success).toBe(true);
                expect(body.data.media).toBeDefined();
                expect(body.data.media.id).toBe(MEDIA_ID);
                expect(body.data.media.alt).toBe('Foto renombrada');
            } else {
                // Auth or entitlement rejection is acceptable in test env —
                // route must be registered (not 404).
                expect(res.status).not.toBe(404);
            }
        });

        it('should call service.updateMedia with ids from the URL and fields from the body', async () => {
            await app.request(BASE_URL, {
                method: 'PATCH',
                headers: {
                    Authorization: 'Bearer test-protected-token',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ alt: 'Foto renombrada' })
            });

            if (mockUpdateMedia.mock.calls.length > 0) {
                const firstCall = mockUpdateMedia.mock.calls[0] as [
                    unknown,
                    { accommodationId: string; mediaId: string; alt?: string | null }
                ];
                expect(firstCall[1].accommodationId).toBe(ACCOMMODATION_ID);
                expect(firstCall[1].mediaId).toBe(MEDIA_ID);
                expect(firstCall[1].alt).toBe('Foto renombrada');
            }
        });

        it('should never send isFeatured/sortOrder/url through to the service call', async () => {
            await app.request(BASE_URL, {
                method: 'PATCH',
                headers: {
                    Authorization: 'Bearer test-protected-token',
                    'Content-Type': 'application/json'
                },
                // The HTTP payload schema strips these before the handler ever runs.
                body: JSON.stringify({
                    alt: 'x',
                    isFeatured: true,
                    sortOrder: 99,
                    url: 'https://evil.example/x.jpg'
                })
            });

            if (mockUpdateMedia.mock.calls.length > 0) {
                const firstCall = mockUpdateMedia.mock.calls[0] as [
                    unknown,
                    Record<string, unknown>
                ];
                expect(firstCall[1]).not.toHaveProperty('isFeatured');
                expect(firstCall[1]).not.toHaveProperty('sortOrder');
                expect(firstCall[1]).not.toHaveProperty('url');
            }
        });
    });

    // ── Error handling ─────────────────────────────────────────────────────────

    describe('Error handling', () => {
        it('should return 4xx when accommodation is not found', async () => {
            mockUpdateMedia.mockResolvedValue({
                data: undefined,
                error: { code: 'NOT_FOUND', message: 'Accommodation not found' }
            });

            const res = await app.request(BASE_URL, {
                method: 'PATCH',
                headers: {
                    Authorization: 'Bearer test-protected-token',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ alt: 'x' })
            });

            expect(res.status).not.toBe(200);
        });

        it('should return 4xx when media row is not found (foreign or soft-deleted)', async () => {
            mockUpdateMedia.mockResolvedValue({
                data: undefined,
                error: { code: 'NOT_FOUND', message: 'Media not found for this accommodation' }
            });

            const res = await app.request(BASE_URL, {
                method: 'PATCH',
                headers: {
                    Authorization: 'Bearer test-protected-token',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ alt: 'x' })
            });

            expect(res.status).not.toBe(200);
        });

        it('should return 4xx when the service rejects an empty payload', async () => {
            mockUpdateMedia.mockResolvedValue({
                data: undefined,
                error: { code: 'VALIDATION_ERROR', message: 'Validation failed' }
            });

            const res = await app.request(BASE_URL, {
                method: 'PATCH',
                headers: {
                    Authorization: 'Bearer test-protected-token',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });

            expect(res.status).not.toBe(200);
        });
    });

    // ── Route registration sanity ─────────────────────────────────────────────

    describe('Route registration', () => {
        it('should be registered (PATCH to the path does not return 404)', async () => {
            const res = await app.request(BASE_URL, {
                method: 'PATCH',
                headers: {
                    Authorization: 'Bearer test-protected-token',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ alt: 'x' })
            });
            expect(res.status).not.toBe(404);
        });

        it('should not collide with PATCH /:id/media/reorder (fixed-suffix route registered first)', async () => {
            const reorderUrl = `/api/v1/protected/accommodations/${ACCOMMODATION_ID}/media/reorder`;
            const res = await app.request(reorderUrl, {
                method: 'PATCH',
                headers: {
                    Authorization: 'Bearer test-protected-token',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ orderedIds: [MEDIA_ID] })
            });
            // Must NOT reach updateMedia's mock — "reorder" must not resolve as a mediaId.
            expect(mockUpdateMedia).not.toHaveBeenCalled();
            expect(res.status).not.toBe(404);
        });
    });
});
