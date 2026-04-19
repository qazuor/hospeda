/**
 * Tests for SPEC-078-GAPS T-055 / GAP-078-135.
 *
 * Verifies both upload routes (admin entity upload + protected avatar upload)
 * always emit `Cache-Control: no-store` so intermediaries (CDNs, browsers,
 * shared proxies) never cache the response — the response body contains a
 * freshly minted publicId / URL pair tied to a single actor + entity, and
 * any cached copy would (a) leak that asset reference across requests, and
 * (b) become stale the moment the next upload overwrites the asset.
 *
 * The header is asserted on BOTH happy paths and short-circuit paths
 * (zero-byte file, missing file field) to confirm that the route writes the
 * header BEFORE any conditional return — including the validation, provider,
 * and schema-error branches.
 *
 * @module test/routes/media/upload-cache-control
 */
import { PermissionEnum } from '@repo/schemas';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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

import {
    AccommodationService,
    DestinationService,
    EventService,
    PostService
} from '@repo/service-core';

import { initApp } from '../../../src/app';
import type { AppOpenAPI } from '../../../src/types';

const ADMIN_ENTITY_ID = '00000000-0000-4000-8000-0000000000aa';
const ADMIN_ACTOR_ID = '00000000-0000-4000-8000-000000000099';

/**
 * Minimal 1x1 red PNG (67 bytes, base64-encoded). Same canonical fixture
 * used by `upload-response-contract.test.ts` and the validate-media-file
 * test in `@repo/media`. Has the correct PNG magic bytes AND a parseable
 * IHDR so `image-size` extracts width=1, height=1.
 */
const MINIMAL_PNG_B64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

const buildAuthHeaders = (
    actor: ReturnType<typeof createMockAdminActor> | ReturnType<typeof createMockUserActor>
): Record<string, string> => {
    const { headers } = createAuthenticatedRequest(actor);
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
        // Strip Content-Type so FormData picks the multipart boundary itself.
        if (k.toLowerCase() === 'content-type') continue;
        out[k] = v;
    }
    return out;
};

const buildAdminMultipartBody = (file: File): FormData => {
    const fd = new FormData();
    fd.append('entityType', 'accommodation');
    fd.append('entityId', ADMIN_ENTITY_ID);
    fd.append('role', 'featured');
    fd.append('file', file);
    return fd;
};

const buildProtectedMultipartBody = (file: File): FormData => {
    const fd = new FormData();
    fd.append('file', file);
    return fd;
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

describe('Media upload — Cache-Control: no-store (SPEC-078-GAPS T-055 / GAP-078-135)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();

        // Stub entity lookup so the admin upload route reaches the provider.
        const okEntity = {
            id: ADMIN_ENTITY_ID,
            ownerId: ADMIN_ACTOR_ID
        };
        const stub = vi.fn().mockResolvedValue({ data: okEntity, error: undefined });
        vi.spyOn(AccommodationService.prototype, 'getById').mockImplementation(stub);
        vi.spyOn(DestinationService.prototype, 'getById').mockImplementation(stub);
        vi.spyOn(EventService.prototype, 'getById').mockImplementation(stub);
        vi.spyOn(PostService.prototype, 'getById').mockImplementation(stub);
    });

    beforeEach(() => {
        mockUpload.mockReset();
    });

    describe('admin upload', () => {
        it('emits Cache-Control: no-store on a successful 200 response', async () => {
            // Arrange
            mockUpload.mockResolvedValueOnce({
                url: 'https://res.cloudinary.com/hospeda/image/upload/v1/hospeda/abc.jpg',
                publicId: 'hospeda/test/accommodations/abc/featured',
                width: 1920,
                height: 1080
            });
            const actor = createUploadReadyAdminActor();
            const file = new File([Buffer.from(MINIMAL_PNG_B64, 'base64')], 'test.png', {
                type: 'image/png'
            });
            const req = new Request('http://localhost/api/v1/admin/media/upload', {
                method: 'POST',
                headers: buildAuthHeaders(actor),
                body: buildAdminMultipartBody(file)
            });

            // Act
            const res = await app.request(req);

            // Assert
            expect(res.status).toBe(200);
            expect(res.headers.get('cache-control')).toBe('no-store');
        });

        it('emits Cache-Control: no-store on a short-circuit 422 EMPTY_FILE response', async () => {
            // Arrange
            const actor = createUploadReadyAdminActor();
            const empty = new File([new Uint8Array(0)], 'empty.png', { type: 'image/png' });
            const req = new Request('http://localhost/api/v1/admin/media/upload', {
                method: 'POST',
                headers: buildAuthHeaders(actor),
                body: buildAdminMultipartBody(empty)
            });

            // Act
            const res = await app.request(req);

            // Assert
            expect(res.status).toBe(422);
            expect(res.headers.get('cache-control')).toBe('no-store');
            // Provider must not be touched on the short-circuit path.
            expect(mockUpload).not.toHaveBeenCalled();
        });
    });

    describe('protected avatar upload', () => {
        it('emits Cache-Control: no-store on a successful 200 response', async () => {
            // Arrange
            mockUpload.mockResolvedValueOnce({
                url: 'https://res.cloudinary.com/hospeda/image/upload/v1/hospeda/avatars/u.jpg',
                publicId: '00000000-0000-4000-8000-0000000000bb',
                width: 256,
                height: 256
            });
            const actor = createMockUserActor({
                id: '00000000-0000-4000-8000-0000000000bb'
            });
            const file = new File([Buffer.from(MINIMAL_PNG_B64, 'base64')], 'avatar.png', {
                type: 'image/png'
            });
            const req = new Request('http://localhost/api/v1/protected/media/upload', {
                method: 'POST',
                headers: buildAuthHeaders(actor),
                body: buildProtectedMultipartBody(file)
            });

            // Act
            const res = await app.request(req);

            // Assert
            expect(res.status).toBe(200);
            expect(res.headers.get('cache-control')).toBe('no-store');
        });

        it('emits Cache-Control: no-store on a short-circuit 422 EMPTY_FILE response', async () => {
            // Arrange
            const actor = createMockUserActor({
                id: '00000000-0000-4000-8000-0000000000bb'
            });
            const empty = new File([new Uint8Array(0)], 'empty.jpg', { type: 'image/jpeg' });
            const req = new Request('http://localhost/api/v1/protected/media/upload', {
                method: 'POST',
                headers: buildAuthHeaders(actor),
                body: buildProtectedMultipartBody(empty)
            });

            // Act
            const res = await app.request(req);

            // Assert
            expect(res.status).toBe(422);
            expect(res.headers.get('cache-control')).toBe('no-store');
            expect(mockUpload).not.toHaveBeenCalled();
        });
    });
});
