/**
 * Tests for SPEC-078-GAPS T-033 (defensive hardening on upload routes).
 *
 * Covers three independent gaps applied to the admin entity upload route
 * and the protected avatar upload route:
 *
 * - GAP-078-068: interim per-route rate limit (10 req / 60s) returns 429
 *   on the 11th request inside the window. Replaces nothing; placeholder
 *   for the billing-tier-aware limits planned in SPEC-079.
 * - GAP-078-021: Content-Length pre-check uses a +1KB margin so that a
 *   multipart upload whose declared length sits exactly at the byte limit
 *   does not trip the fast-fail 413; a payload meaningfully larger than
 *   the limit (limit + 2KB) still IS rejected.
 * - GAP-078-071: server-side hard cap of 50 gallery items per entity. A
 *   `role: 'gallery'` upload against an entity already at 50 items must
 *   return 422 `GALLERY_LIMIT_EXCEEDED` BEFORE the provider is called.
 *
 * @module test/routes/media/upload-defensive-hardening
 */

// Enable rate limiting for the rate-limit test in this file. Must be set
// BEFORE any import of the env module / app so the cached env value sees it.
process.env.HOSPEDA_TESTING_RATE_LIMIT = 'true';

import { PermissionEnum } from '@repo/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    createAuthenticatedRequest,
    createMockAdminActor,
    createMockUserActor
} from '../../helpers/auth';

const mockUpload = vi.fn();
const mockDelete = vi.fn();

vi.mock('../../../src/services/media', () => ({
    getMediaProvider: () => ({
        upload: mockUpload,
        delete: mockDelete
    })
}));

import { accommodationMediaModel } from '@repo/db';
import {
    AccommodationService,
    DestinationService,
    EventService,
    PostService
} from '@repo/service-core';

import { initApp } from '../../../src/app';
import { clearRateLimitStore } from '../../../src/middlewares/rate-limit';
import type { AppOpenAPI } from '../../../src/types';

const ADMIN_ENTITY_ID = '00000000-0000-4000-8000-0000000000aa';
const ADMIN_ACTOR_ID = '00000000-0000-4000-8000-000000000099';

const buildAuthHeaders = (
    actor: ReturnType<typeof createMockAdminActor> | ReturnType<typeof createMockUserActor>
): Record<string, string> => {
    const { headers } = createAuthenticatedRequest(actor);
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
        // Strip Content-Type so FormData can set the multipart boundary itself.
        if (k.toLowerCase() === 'content-type') continue;
        out[k] = v;
    }
    return out;
};

const createUploadReadyAdminActor = () =>
    createMockAdminActor({
        id: ADMIN_ACTOR_ID,
        permissions: [
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.ACCESS_API_ADMIN,
            PermissionEnum.MEDIA_UPLOAD,
            PermissionEnum.ACCOMMODATION_UPDATE_ANY
        ]
    });

/**
 * Build a tiny but non-empty PNG file buffer (8x8 white image). Real bytes
 * pass through `validateMediaFile` magic-byte detection, which matters for
 * the rate-limit test (the request must reach the handler success path
 * before the limiter trips).
 */
const PNG_8X8_WHITE = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAIAQMAAAD+wSzIAAAABlBMVEX///+/v7+jQ3Y5AAAADElEQVQI12P4//8/AAX+Av7czFnnAAAAAElFTkSuQmCC',
    'base64'
);

const buildPngFile = (name = 'tiny.png'): File =>
    new File([PNG_8X8_WHITE], name, { type: 'image/png' });

const buildAdminMultipartBody = (file: File, role: 'featured' | 'gallery' = 'featured') => {
    const fd = new FormData();
    fd.append('entityType', 'accommodation');
    fd.append('entityId', ADMIN_ENTITY_ID);
    fd.append('role', role);
    fd.append('file', file);
    return fd;
};

const buildProtectedMultipartBody = (file: File): FormData => {
    const fd = new FormData();
    fd.append('file', file);
    return fd;
};

const ADMIN_URL = 'http://localhost/api/v1/admin/media/upload';
const PROTECTED_URL = 'http://localhost/api/v1/protected/media/upload';

describe('Media upload — defensive hardening (SPEC-078-GAPS T-033)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();

        // By default every entity lookup returns an OK accommodation owned by
        // the admin actor. Individual `it` cases override this where needed.
        const okEntity = {
            id: ADMIN_ENTITY_ID,
            ownerId: ADMIN_ACTOR_ID,
            media: { gallery: [] }
        };
        const stub = vi.fn().mockResolvedValue({ data: okEntity, error: undefined });
        vi.spyOn(AccommodationService.prototype, 'getById').mockImplementation(stub);
        vi.spyOn(DestinationService.prototype, 'getById').mockImplementation(stub);
        vi.spyOn(EventService.prototype, 'getById').mockImplementation(stub);
        vi.spyOn(PostService.prototype, 'getById').mockImplementation(stub);

        // Default upload result for any provider call.
        mockUpload.mockResolvedValue({
            url: 'https://res.cloudinary.com/demo/image/upload/v1/featured.png',
            publicId: 'hospeda/dev/accommodations/x/featured',
            width: 8,
            height: 8
        });
    });

    beforeEach(async () => {
        mockUpload.mockClear();
        await clearRateLimitStore();
    });

    afterAll(() => {
        process.env.HOSPEDA_TESTING_RATE_LIMIT = 'false';
    });

    // ── GAP-078-021 — Content-Length margin ─────────────────────────────────

    describe('GAP-078-021: Content-Length pre-check uses +1KB margin', () => {
        it('admin upload accepts a Content-Length declared exactly at the byte limit', async () => {
            // Arrange: 10 MB default cap → 10 * 1024 * 1024 bytes
            const limitBytes = 10 * 1024 * 1024;
            const actor = createUploadReadyAdminActor();
            const req = new Request(ADMIN_URL, {
                method: 'POST',
                headers: {
                    ...buildAuthHeaders(actor),
                    // Force the declared Content-Length to be exactly the
                    // limit. The actual body is the small PNG; the
                    // Content-Length header is what the pre-check reads.
                    'content-length': String(limitBytes)
                },
                body: buildAdminMultipartBody(buildPngFile())
            });

            // Act
            const res = await app.request(req);
            const body = (await res.json()) as { success: boolean; error?: { code: string } };

            // Assert: not rejected for size. The route may succeed with 200
            // (file-size validation passes for the tiny PNG) — what matters
            // is we did NOT short-circuit with PAYLOAD_TOO_LARGE.
            expect(body.error?.code).not.toBe('PAYLOAD_TOO_LARGE');
            expect(res.status).not.toBe(413);
        });

        it('admin upload rejects a Content-Length 2KB above the limit with 413', async () => {
            // Arrange
            const limitBytes = 10 * 1024 * 1024;
            const actor = createUploadReadyAdminActor();
            const req = new Request(ADMIN_URL, {
                method: 'POST',
                headers: {
                    ...buildAuthHeaders(actor),
                    // 2KB over the strict limit and ALSO above the 1KB margin.
                    'content-length': String(limitBytes + 2048)
                },
                body: buildAdminMultipartBody(buildPngFile())
            });

            // Act
            const res = await app.request(req);
            const body = (await res.json()) as { success: boolean; error?: { code: string } };

            // Assert: 413 with either the global bodyLimit code
            // (`REQUEST_TOO_LARGE`, fired by the platform-level middleware
            // configured at exactly 10MB) or the route-level
            // `PAYLOAD_TOO_LARGE`. Both are valid rejections that prove the
            // 1KB margin does not let oversized payloads through.
            expect(res.status).toBe(413);
            expect(body.success).toBe(false);
            expect(['PAYLOAD_TOO_LARGE', 'REQUEST_TOO_LARGE']).toContain(body.error?.code);
            expect(mockUpload).not.toHaveBeenCalled();
        });

        it('protected upload accepts a Content-Length declared exactly at the avatar 5MB limit', async () => {
            // Arrange
            const limitBytes = 5 * 1024 * 1024;
            const actor = createMockUserActor({
                id: '00000000-0000-4000-8000-0000000000bc'
            });
            const req = new Request(PROTECTED_URL, {
                method: 'POST',
                headers: {
                    ...buildAuthHeaders(actor),
                    'content-length': String(limitBytes)
                },
                body: buildProtectedMultipartBody(buildPngFile('avatar.png'))
            });

            // Act
            const res = await app.request(req);
            const body = (await res.json()) as { success: boolean; error?: { code: string } };

            // Assert
            expect(body.error?.code).not.toBe('PAYLOAD_TOO_LARGE');
            expect(res.status).not.toBe(413);
        });

        it('protected upload rejects a Content-Length 2KB above the avatar limit with 413', async () => {
            // Arrange
            const limitBytes = 5 * 1024 * 1024;
            const actor = createMockUserActor({
                id: '00000000-0000-4000-8000-0000000000bd'
            });
            const req = new Request(PROTECTED_URL, {
                method: 'POST',
                headers: {
                    ...buildAuthHeaders(actor),
                    'content-length': String(limitBytes + 2048)
                },
                body: buildProtectedMultipartBody(buildPngFile('avatar.png'))
            });

            // Act
            const res = await app.request(req);
            const body = (await res.json()) as { success: boolean; error?: { code: string } };

            // Assert: 413 from either route-level or global bodyLimit.
            expect(res.status).toBe(413);
            expect(body.success).toBe(false);
            expect(['PAYLOAD_TOO_LARGE', 'REQUEST_TOO_LARGE']).toContain(body.error?.code);
            expect(mockUpload).not.toHaveBeenCalled();
        });
    });

    // ── GAP-078-071 — Gallery hard cap ──────────────────────────────────────

    describe('GAP-078-071: gallery hard cap rejects 51st item with 422 GALLERY_LIMIT_EXCEEDED', () => {
        it('rejects gallery upload when entity already has 50 gallery items', async () => {
            // Arrange: spy returns an entity already at the cap.
            const fullGalleryEntity = {
                id: ADMIN_ENTITY_ID,
                ownerId: ADMIN_ACTOR_ID,
                media: {
                    gallery: Array.from({ length: 50 }, (_, i) => ({
                        url: `https://res.cloudinary.com/demo/image/upload/v1/g${i}.png`,
                        moderationState: 'APPROVED'
                    }))
                }
            };
            const fullStub = vi.fn().mockResolvedValue({
                data: fullGalleryEntity,
                error: undefined
            });
            vi.spyOn(AccommodationService.prototype, 'getById').mockImplementationOnce(fullStub);
            // SPEC-204 T-014: the gallery cap (and the owner plan-limit check) now
            // count visible rows from the relational accommodation_media table via
            // `findByAccommodation`, not from the JSONB `media.gallery`. Stub it to
            // report the entity is already at the 50-item cap so the handler returns
            // the typed 422 instead of hitting a real DB (which would 500).
            const mediaCountSpy = vi
                .spyOn(accommodationMediaModel, 'findByAccommodation')
                .mockResolvedValue({ items: [], total: 50 });

            const actor = createUploadReadyAdminActor();
            const req = new Request(ADMIN_URL, {
                method: 'POST',
                headers: buildAuthHeaders(actor),
                body: buildAdminMultipartBody(buildPngFile(), 'gallery')
            });

            // Act
            const res = await app.request(req);
            const body = (await res.json()) as {
                success: boolean;
                error?: { code: string; details?: { limit?: number; currentCount?: number } };
            };

            // Assert
            expect(res.status).toBe(422);
            expect(body.success).toBe(false);
            expect(body.error?.code).toBe('GALLERY_LIMIT_EXCEEDED');
            expect(body.error?.details?.limit).toBe(50);
            expect(body.error?.details?.currentCount).toBe(50);
            // Provider must never be called for a doomed insert.
            expect(mockUpload).not.toHaveBeenCalled();
            mediaCountSpy.mockRestore();
        });

        it('does not trigger gallery cap for featured uploads on the same full-gallery entity', async () => {
            // Arrange: same full-gallery entity, but role=featured bypasses
            // the cap (featured images are a single asset, not in the gallery
            // array).
            const fullGalleryEntity = {
                id: ADMIN_ENTITY_ID,
                ownerId: ADMIN_ACTOR_ID,
                media: {
                    gallery: Array.from({ length: 50 }, (_, i) => ({
                        url: `https://res.cloudinary.com/demo/image/upload/v1/g${i}.png`,
                        moderationState: 'APPROVED'
                    }))
                }
            };
            const fullStub = vi.fn().mockResolvedValue({
                data: fullGalleryEntity,
                error: undefined
            });
            vi.spyOn(AccommodationService.prototype, 'getById').mockImplementationOnce(fullStub);

            const actor = createUploadReadyAdminActor();
            const req = new Request(ADMIN_URL, {
                method: 'POST',
                headers: buildAuthHeaders(actor),
                body: buildAdminMultipartBody(buildPngFile(), 'featured')
            });

            // Act
            const res = await app.request(req);
            const body = (await res.json()) as { success: boolean; error?: { code: string } };

            // Assert: must not be the gallery-cap error.
            expect(body.error?.code).not.toBe('GALLERY_LIMIT_EXCEEDED');
        });
    });

    // ── GAP-078-068 — Interim rate limit ────────────────────────────────────

    describe('GAP-078-068: interim per-route rate limit (10 req / 60s)', () => {
        it('returns 429 on the 31st admin upload request inside the 60s window', async () => {
            // NOTE: SPEC-079 raised the admin upload limit to 30 req / 60s
            // (up from the GAP-078-068 interim limit of 10) to support bulk-upload
            // use cases. The protected upload route kept max=10.
            //
            // Use a distinct actor ID so the sliding-window store key is isolated
            // from requests made by other tests in this file (the store is shared
            // per actor.id and clearRateLimitStore() does not clear the sliding-window
            // store — only the fixed-window store).
            const MAX = 30;
            const actor = createMockAdminActor({
                id: 'ffffffff-0000-4000-8000-000000000099',
                permissions: [
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.ACCESS_API_ADMIN,
                    PermissionEnum.MEDIA_UPLOAD,
                    PermissionEnum.ACCOMMODATION_UPDATE_ANY
                ]
            });
            const buildReq = () =>
                new Request(ADMIN_URL, {
                    method: 'POST',
                    headers: buildAuthHeaders(actor),
                    body: buildAdminMultipartBody(buildPngFile())
                });

            // Act: send MAX+1 requests in immediate succession.
            const statuses: number[] = [];
            for (let i = 0; i < MAX + 1; i++) {
                const res = await app.request(buildReq());
                statuses.push(res.status);
            }

            // Assert: the first MAX must NOT be rate-limited (status varies
            // depending on validation; what matters is they aren't 429), and
            // the (MAX+1)th must be exactly 429.
            for (let i = 0; i < MAX; i++) {
                expect(statuses[i]).not.toBe(429);
            }
            expect(statuses[MAX]).toBe(429);
        });
    });
});
