/**
 * Per-entity gallery cap enforcement tests (SPEC-078-GAPS gallery-cap-drift
 * follow-up).
 *
 * Verifies that the upload route enforces the SSOT caps from `@repo/schemas`
 * (`ENTITY_GALLERY_CAPS`) for each content entity type. For each entity, two
 * scenarios are covered:
 *
 *   - AT cap: gallery is full (count === cap) → route returns 422
 *     GALLERY_LIMIT_EXCEEDED with the entity-specific limit in the error
 *     payload.
 *   - BELOW cap: gallery has one slot remaining (count === cap - 1) → route
 *     forwards to the provider and returns 200.
 *
 * Entity types tested:
 *   - accommodation (cap = 50)
 *   - destination   (cap = 20)
 *   - event         (cap = 10)
 *   - post          (cap = 15)
 *
 * @module test/routes/media/gallery-cap-enforcement
 */

import { ENTITY_GALLERY_CAPS, PermissionEnum } from '@repo/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuthenticatedRequest, createMockAdminActor } from '../../helpers/auth';

// ---------------------------------------------------------------------------
// Provider mock (hoisted so vi.mock() can reference it)
// ---------------------------------------------------------------------------

const { mockUpload, mockDelete, providerState, mockFindByAccommodation } = vi.hoisted(() => ({
    mockUpload: vi.fn(),
    mockDelete: vi.fn(),
    providerState: { configured: true as boolean },
    // SPEC-204: accommodation gallery count now comes from the relational table.
    mockFindByAccommodation: vi.fn()
}));

vi.mock('../../../src/services/media', () => ({
    getMediaProvider: () =>
        providerState.configured ? { upload: mockUpload, delete: mockDelete } : null
}));

// SPEC-204: stub accommodationMediaModel so the route can count visible rows
// from the relational table without a live database connection.
vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        accommodationMediaModel: {
            findByAccommodation: mockFindByAccommodation
        }
    };
});

import {
    AccommodationService,
    DestinationService,
    EventService,
    PostService
} from '@repo/service-core';

import { initApp } from '../../../src/app';
import { resetMetrics } from '../../../src/middlewares/metrics';
import type { AppOpenAPI } from '../../../src/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ACTOR_ID = '00000000-0000-4000-8000-000000000099';
const ENTITY_ID = '00000000-0000-4000-8000-0000000000aa';
const UPLOAD_URL = 'http://localhost/api/v1/admin/media/upload';

/**
 * Minimal 1x1 PNG — stays under every file-size gate and is accepted by the
 * `image-size` dimension checker inside `validateMediaFile`.
 */
const MINIMAL_PNG_B64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

const pngFile = (): File =>
    new File([Buffer.from(MINIMAL_PNG_B64, 'base64') as unknown as BlobPart], 'test.png', {
        type: 'image/png'
    });

/**
 * Returns auth headers for an admin actor that owns the test entity and holds
 * the MEDIA_UPLOAD permission plus the entity-specific update permission.
 */
const buildAuthHeaders = (
    entityPermission: PermissionEnum = PermissionEnum.ACCOMMODATION_UPDATE_ANY
): Record<string, string> => {
    const actor = createMockAdminActor({
        id: ACTOR_ID,
        permissions: [
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.ACCESS_API_ADMIN,
            PermissionEnum.MEDIA_UPLOAD,
            entityPermission
        ]
    });
    const { headers } = createAuthenticatedRequest(actor);
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
        if (k.toLowerCase() === 'content-type') continue;
        out[k] = v;
    }
    return out;
};

/**
 * Builds a multipart gallery upload request body for the given entity type.
 */
const buildGalleryFormData = (entityType: string): FormData => {
    const fd = new FormData();
    fd.append('entityType', entityType);
    fd.append('entityId', ENTITY_ID);
    fd.append('role', 'gallery');
    fd.append('file', pngFile());
    return fd;
};

/**
 * Builds a vi mock function that resolves to an entity stub whose gallery has
 * exactly `galleryCount` items. `ownerId` matches `ACTOR_ID` so the entity
 * permission check passes.
 *
 * Wrapped in `vi.fn()` so that `mockImplementationOnce` receives a callable
 * — matching the exact shape used by the existing upload integration tests.
 * The route only reads `data.ownerId` and `data.media.gallery` from the
 * resolved value, so the partial stub is functionally complete.
 */
const buildEntityStubFn = (galleryCount: number) =>
    vi.fn().mockResolvedValue({
        data: {
            id: ENTITY_ID,
            ownerId: ACTOR_ID,
            media: {
                gallery: Array.from({ length: galleryCount }, (_, i) => ({
                    url: `https://example.com/img${i}.jpg`,
                    moderationState: 'APPROVED'
                }))
            }
        },
        error: undefined
    });

// ---------------------------------------------------------------------------
// Helper: makes a single gallery upload request and returns the response.
// ---------------------------------------------------------------------------

const upload = async (
    app: AppOpenAPI,
    entityType: string,
    entityPermission: PermissionEnum
): Promise<Response> => {
    const req = new Request(UPLOAD_URL, {
        method: 'POST',
        headers: buildAuthHeaders(entityPermission),
        body: buildGalleryFormData(entityType)
    });
    return app.request(req);
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Gallery cap enforcement — per-entity SSOT (SPEC-078-GAPS)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    beforeEach(() => {
        providerState.configured = true;
        mockUpload.mockReset();
        mockUpload.mockResolvedValue({
            url: 'https://res.cloudinary.com/hospeda/image/upload/v1/hospeda/test/accommodations/abc/gallery/abcd1234.png',
            publicId: 'hospeda/test/accommodations/abc/gallery/abcd1234',
            width: 1920,
            height: 1080
        });
        mockDelete.mockReset();
        // Default: empty gallery (0 visible rows). Individual accommodation
        // tests override this via mockResolvedValueOnce before the at-cap/below-cap
        // stubs fire so both gallery-cap checks get consistent counts.
        mockFindByAccommodation.mockReset();
        mockFindByAccommodation.mockResolvedValue({ items: [], total: 0 });
        resetMetrics();
    });

    afterAll(() => {
        providerState.configured = true;
    });

    // ── accommodation (cap = 50) ───────────────────────────────────────────

    describe('accommodation (cap = 50)', () => {
        it('rejects upload #51: gallery full at 50 items → 422 GALLERY_LIMIT_EXCEEDED with limit=50', async () => {
            // Arrange: gallery is AT the cap (50 items).
            // SPEC-204: accommodation gallery count comes from the relational
            // table; stub both the entity lookup and the media count.
            const cap = ENTITY_GALLERY_CAPS.accommodation;
            vi.spyOn(AccommodationService.prototype, 'getById').mockImplementationOnce(
                buildEntityStubFn(cap)
            );
            // findByAccommodation is called twice: once for the plan-cap check
            // (3d-i) and once for the absolute gallery-cap check (3d).
            mockFindByAccommodation.mockResolvedValue({ items: [], total: cap });

            // Act
            const res = await upload(app, 'accommodation', PermissionEnum.ACCOMMODATION_UPDATE_ANY);

            // Assert
            expect(res.status).toBe(422);
            const body = (await res.json()) as {
                success: boolean;
                error: { code: string; details: { limit: number; currentCount: number } };
            };
            expect(body.error.code).toBe('GALLERY_LIMIT_EXCEEDED');
            expect(body.error.details.limit).toBe(cap);
            expect(body.error.details.currentCount).toBe(cap);
            expect(mockUpload).not.toHaveBeenCalled();
        });

        it('allows upload #50: one slot remaining (49 items) → 200', async () => {
            // Arrange: one slot below cap.
            const belowCap = ENTITY_GALLERY_CAPS.accommodation - 1;
            vi.spyOn(AccommodationService.prototype, 'getById').mockImplementationOnce(
                buildEntityStubFn(belowCap)
            );
            // Both plan-cap and gallery-cap checks receive the same count.
            mockFindByAccommodation.mockResolvedValue({ items: [], total: belowCap });

            // Act
            const res = await upload(app, 'accommodation', PermissionEnum.ACCOMMODATION_UPDATE_ANY);

            // Assert
            expect(res.status).toBe(200);
            expect(mockUpload).toHaveBeenCalledTimes(1);
        });
    });

    // ── destination (cap = 20) ────────────────────────────────────────────

    describe('destination (cap = 20)', () => {
        it('rejects upload #21: gallery full at 20 items → 422 GALLERY_LIMIT_EXCEEDED with limit=20', async () => {
            // Arrange: gallery is AT the cap (20 items).
            vi.spyOn(DestinationService.prototype, 'getById').mockImplementationOnce(
                buildEntityStubFn(ENTITY_GALLERY_CAPS.destination)
            );

            // Act
            const res = await upload(app, 'destination', PermissionEnum.DESTINATION_UPDATE);

            // Assert
            expect(res.status).toBe(422);
            const body = (await res.json()) as {
                success: boolean;
                error: { code: string; details: { limit: number; currentCount: number } };
            };
            expect(body.error.code).toBe('GALLERY_LIMIT_EXCEEDED');
            expect(body.error.details.limit).toBe(ENTITY_GALLERY_CAPS.destination);
            expect(body.error.details.currentCount).toBe(ENTITY_GALLERY_CAPS.destination);
            expect(mockUpload).not.toHaveBeenCalled();
        });

        it('allows upload #20: one slot remaining (19 items) → 200', async () => {
            // Arrange: one slot below cap.
            vi.spyOn(DestinationService.prototype, 'getById').mockImplementationOnce(
                buildEntityStubFn(ENTITY_GALLERY_CAPS.destination - 1)
            );

            // Act
            const res = await upload(app, 'destination', PermissionEnum.DESTINATION_UPDATE);

            // Assert
            expect(res.status).toBe(200);
            expect(mockUpload).toHaveBeenCalledTimes(1);
        });
    });

    // ── event (cap = 10) ──────────────────────────────────────────────────

    describe('event (cap = 10)', () => {
        it('rejects upload #11: gallery full at 10 items → 422 GALLERY_LIMIT_EXCEEDED with limit=10', async () => {
            // Arrange: gallery is AT the cap (10 items).
            vi.spyOn(EventService.prototype, 'getById').mockImplementationOnce(
                buildEntityStubFn(ENTITY_GALLERY_CAPS.event)
            );

            // Act
            const res = await upload(app, 'event', PermissionEnum.EVENT_UPDATE);

            // Assert
            expect(res.status).toBe(422);
            const body = (await res.json()) as {
                success: boolean;
                error: { code: string; details: { limit: number; currentCount: number } };
            };
            expect(body.error.code).toBe('GALLERY_LIMIT_EXCEEDED');
            expect(body.error.details.limit).toBe(ENTITY_GALLERY_CAPS.event);
            expect(body.error.details.currentCount).toBe(ENTITY_GALLERY_CAPS.event);
            expect(mockUpload).not.toHaveBeenCalled();
        });

        it('allows upload #10: one slot remaining (9 items) → 200', async () => {
            // Arrange: one slot below cap.
            vi.spyOn(EventService.prototype, 'getById').mockImplementationOnce(
                buildEntityStubFn(ENTITY_GALLERY_CAPS.event - 1)
            );

            // Act
            const res = await upload(app, 'event', PermissionEnum.EVENT_UPDATE);

            // Assert
            expect(res.status).toBe(200);
            expect(mockUpload).toHaveBeenCalledTimes(1);
        });
    });

    // ── post (cap = 15) ───────────────────────────────────────────────────

    describe('post (cap = 15)', () => {
        it('rejects upload #16: gallery full at 15 items → 422 GALLERY_LIMIT_EXCEEDED with limit=15', async () => {
            // Arrange: gallery is AT the cap (15 items).
            vi.spyOn(PostService.prototype, 'getById').mockImplementationOnce(
                buildEntityStubFn(ENTITY_GALLERY_CAPS.post)
            );

            // Act
            const res = await upload(app, 'post', PermissionEnum.POST_UPDATE);

            // Assert
            expect(res.status).toBe(422);
            const body = (await res.json()) as {
                success: boolean;
                error: { code: string; details: { limit: number; currentCount: number } };
            };
            expect(body.error.code).toBe('GALLERY_LIMIT_EXCEEDED');
            expect(body.error.details.limit).toBe(ENTITY_GALLERY_CAPS.post);
            expect(body.error.details.currentCount).toBe(ENTITY_GALLERY_CAPS.post);
            expect(mockUpload).not.toHaveBeenCalled();
        });

        it('allows upload #15: one slot remaining (14 items) → 200', async () => {
            // Arrange: one slot below cap.
            vi.spyOn(PostService.prototype, 'getById').mockImplementationOnce(
                buildEntityStubFn(ENTITY_GALLERY_CAPS.post - 1)
            );

            // Act
            const res = await upload(app, 'post', PermissionEnum.POST_UPDATE);

            // Assert
            expect(res.status).toBe(200);
            expect(mockUpload).toHaveBeenCalledTimes(1);
        });
    });
});
