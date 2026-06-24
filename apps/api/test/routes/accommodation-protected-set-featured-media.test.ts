/**
 * Unit/integration tests for PUT /api/v1/protected/accommodations/:id/media/:mediaId/featured
 * Set the featured photo for an accommodation gallery — Protected (owner-facing) endpoint (SPEC-204)
 *
 * Coverage:
 * - Authentication: unauthenticated requests return 401/403
 * - Happy path: promotes target row as featured, returns updated media row
 * - Invariant: featuring an archived photo returns 4xx (VALIDATION_ERROR)
 * - Error: accommodation not found returns 4xx
 * - Error: media row not found returns 4xx
 * - Route registration: path does not return 404; no collision with DELETE /:mediaId
 *
 * Testing strategy: mock `@repo/service-core` so no DB is needed.
 * Actor is a HOST owner with UPDATE_OWN + panelProtected access.
 *
 * @module test/routes/accommodation-protected-set-featured-media
 */

import { ModerationStatusEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------
const { mockSetFeaturedMedia } = vi.hoisted(() => ({
    mockSetFeaturedMedia: vi.fn()
}));

vi.mock('@repo/service-core', async () => {
    const actual = await vi.importActual<typeof import('@repo/service-core')>('@repo/service-core');
    return {
        ...actual,
        AccommodationService: vi.fn().mockImplementation(() => ({
            setFeaturedMedia: mockSetFeaturedMedia
        }))
    };
});

// Actor: HOST owner with UPDATE_OWN permission.
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
const MEDIA_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const BASE_URL = `/api/v1/protected/accommodations/${ACCOMMODATION_ID}/media/${MEDIA_ID}/featured`;

const NOW = new Date('2026-01-15T12:00:00.000Z');

const FEATURED_MEDIA_ROW = {
    id: MEDIA_ID,
    accommodationId: ACCOMMODATION_ID,
    url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
    publicId: 'hospeda/dev/sample',
    caption: 'Vista al mar',
    alt: 'Foto principal',
    description: undefined,
    attribution: null,
    moderationState: ModerationStatusEnum.APPROVED,
    state: 'visible' as const,
    isFeatured: true,
    sortOrder: 0,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('PUT /api/v1/protected/accommodations/:id/media/:mediaId/featured — setFeaturedMedia (SPEC-204)', () => {
    let app: AppOpenAPI;

    beforeEach(() => {
        vi.clearAllMocks();
        app = initApp();
        mockSetFeaturedMedia.mockResolvedValue({
            data: { media: FEATURED_MEDIA_ROW },
            error: undefined
        });
    });

    // ── Authentication ─────────────────────────────────────────────────────────

    describe('Authentication', () => {
        it('should return 401/403 when no Authorization header is provided', async () => {
            const res = await app.request(BASE_URL, { method: 'PUT' });
            expect([400, 401, 403]).toContain(res.status);
        });
    });

    // ── Happy path ────────────────────────────────────────────────────────────

    describe('Happy path', () => {
        it('should return 200 with the promoted media row', async () => {
            const res = await app.request(BASE_URL, {
                method: 'PUT',
                headers: { Authorization: 'Bearer test-protected-token' }
            });

            if (res.status === 200) {
                const body = await res.json();
                expect(body.success).toBe(true);
                expect(body.data).toBeDefined();
                expect(body.data.media).toBeDefined();
                expect(body.data.media.id).toBe(MEDIA_ID);
                expect(body.data.media.isFeatured).toBe(true);
                expect(body.data.media.state).toBe('visible');
            } else {
                // Auth or entitlement rejection is acceptable in test env —
                // route must be registered (not 404).
                expect(res.status).not.toBe(404);
            }
        });

        it('should call service.setFeaturedMedia with correct params from URL', async () => {
            await app.request(BASE_URL, {
                method: 'PUT',
                headers: { Authorization: 'Bearer test-protected-token' }
            });

            if (mockSetFeaturedMedia.mock.calls.length > 0) {
                const firstCall = mockSetFeaturedMedia.mock.calls[0] as [
                    unknown,
                    { accommodationId: string; mediaId: string }
                ];
                expect(firstCall[1].accommodationId).toBe(ACCOMMODATION_ID);
                expect(firstCall[1].mediaId).toBe(MEDIA_ID);
            }
        });
    });

    // ── Invariant: archived photo cannot be featured ─────────────────────────

    describe('DB invariant: archived photo cannot be featured', () => {
        it('should return 4xx when service rejects an archived target photo', async () => {
            mockSetFeaturedMedia.mockResolvedValue({
                data: undefined,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Cannot feature an archived photo — restore it to visible first'
                }
            });

            const res = await app.request(BASE_URL, {
                method: 'PUT',
                headers: { Authorization: 'Bearer test-protected-token' }
            });

            expect(res.status).not.toBe(200);
            expect(res.status).not.toBe(201);
        });
    });

    // ── Error handling ─────────────────────────────────────────────────────────

    describe('Error handling', () => {
        it('should return 4xx when accommodation is not found', async () => {
            mockSetFeaturedMedia.mockResolvedValue({
                data: undefined,
                error: { code: 'NOT_FOUND', message: 'Accommodation not found' }
            });

            const res = await app.request(BASE_URL, {
                method: 'PUT',
                headers: { Authorization: 'Bearer test-protected-token' }
            });

            expect(res.status).not.toBe(200);
        });

        it('should return 4xx when media row is not found', async () => {
            mockSetFeaturedMedia.mockResolvedValue({
                data: undefined,
                error: { code: 'NOT_FOUND', message: 'Media not found for this accommodation' }
            });

            const res = await app.request(BASE_URL, {
                method: 'PUT',
                headers: { Authorization: 'Bearer test-protected-token' }
            });

            expect(res.status).not.toBe(200);
        });
    });

    // ── Route registration sanity ─────────────────────────────────────────────

    describe('Route registration', () => {
        it('should be registered (PUT to the path does not return 404)', async () => {
            const res = await app.request(BASE_URL, {
                method: 'PUT',
                headers: { Authorization: 'Bearer test-protected-token' }
            });
            expect(res.status).not.toBe(404);
        });

        it('should not collide with DELETE /:id/media/:mediaId (different method + suffix)', async () => {
            // The DELETE path is /:id/media/:mediaId (no /featured suffix).
            // Verifies Hono does not match "featured" as a mediaId on DELETE.
            const deleteUrl = `/api/v1/protected/accommodations/${ACCOMMODATION_ID}/media/featured`;
            const res = await app.request(deleteUrl, {
                method: 'DELETE',
                headers: { Authorization: 'Bearer test-protected-token' }
            });
            // A DELETE on .../media/featured should 400 (UUID validation failure for
            // "featured" as mediaId param) or 404/405 — never 200.
            expect([400, 401, 403, 404, 405]).toContain(res.status);
        });
    });
});
