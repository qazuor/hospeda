/**
 * Tests for SPEC-078-GAPS T-030 / GAP-078-155.
 *
 * Verifies the admin upload route forwards optional `tags` and `overwrite`
 * fields from the multipart request body to the underlying media provider
 * call. Both fields are pass-through-only — the route does not transform
 * them, validate Cloudinary semantics, or enforce defaults beyond what the
 * provider already does.
 *
 * @module test/routes/media/admin-upload-tags-overwrite
 */
import { PermissionEnum } from '@repo/schemas';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuthenticatedRequest, createMockAdminActor } from '../../helpers/auth';

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

/**
 * Minimal 1x1 red PNG (67 bytes, base64-encoded). Reused from the existing
 * upload-response-contract test to keep the multipart payload realistic.
 */
const MINIMAL_PNG_B64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

const buildMultipartBody = (extras: Record<string, string> = {}): FormData => {
    const fd = new FormData();
    fd.append('entityType', 'accommodation');
    fd.append('entityId', ADMIN_ENTITY_ID);
    fd.append('role', 'featured');
    for (const [key, value] of Object.entries(extras)) {
        fd.append(key, value);
    }
    fd.append(
        'file',
        new File([Buffer.from(MINIMAL_PNG_B64, 'base64')], 'test.png', {
            type: 'image/png'
        })
    );
    return fd;
};

const buildAuthHeaders = (
    actor: ReturnType<typeof createMockAdminActor>
): Record<string, string> => {
    const { headers } = createAuthenticatedRequest(actor);
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
        if (k.toLowerCase() === 'content-type') continue;
        out[k] = v;
    }
    return out;
};

const createUploadReadyActor = () =>
    createMockAdminActor({
        id: '00000000-0000-4000-8000-000000000099',
        permissions: [
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.ACCESS_API_ADMIN,
            PermissionEnum.MEDIA_UPLOAD,
            PermissionEnum.ACCOMMODATION_UPDATE_ANY
        ]
    });

describe('Admin media upload — tags + overwrite forwarding (SPEC-078-GAPS T-030 / GAP-078-155)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();

        const okEntity = {
            id: ADMIN_ENTITY_ID,
            ownerId: '00000000-0000-4000-8000-000000000099'
        };
        const stub = vi.fn().mockResolvedValue({ data: okEntity, error: undefined });
        vi.spyOn(AccommodationService.prototype, 'getById').mockImplementation(stub);
        vi.spyOn(DestinationService.prototype, 'getById').mockImplementation(stub);
        vi.spyOn(EventService.prototype, 'getById').mockImplementation(stub);
        vi.spyOn(PostService.prototype, 'getById').mockImplementation(stub);
    });

    beforeEach(() => {
        mockUpload.mockReset();
        mockUpload.mockResolvedValue({
            url: 'https://res.cloudinary.com/hospeda/image/upload/v1/hospeda/abc.jpg',
            publicId: 'hospeda/test/accommodations/abc/featured',
            width: 1920,
            height: 1080
        });
    });

    it('forwards comma-separated tags from the multipart body to the provider', async () => {
        const actor = createUploadReadyActor();
        const req = new Request('http://localhost/api/v1/admin/media/upload', {
            method: 'POST',
            headers: buildAuthHeaders(actor),
            body: buildMultipartBody({ tags: 'hero,beach,featured' })
        });

        const res = await app.request(req);

        expect(res.status).toBe(200);
        expect(mockUpload).toHaveBeenCalledTimes(1);
        const callArg = mockUpload.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(callArg.tags).toEqual(['hero', 'beach', 'featured']);
    });

    it('forwards overwrite=false from the multipart body to the provider', async () => {
        const actor = createUploadReadyActor();
        const req = new Request('http://localhost/api/v1/admin/media/upload', {
            method: 'POST',
            headers: buildAuthHeaders(actor),
            body: buildMultipartBody({ overwrite: 'false' })
        });

        const res = await app.request(req);

        expect(res.status).toBe(200);
        expect(mockUpload).toHaveBeenCalledTimes(1);
        const callArg = mockUpload.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(callArg.overwrite).toBe(false);
    });

    it('forwards overwrite=true from the multipart body to the provider', async () => {
        const actor = createUploadReadyActor();
        const req = new Request('http://localhost/api/v1/admin/media/upload', {
            method: 'POST',
            headers: buildAuthHeaders(actor),
            body: buildMultipartBody({ overwrite: 'true' })
        });

        const res = await app.request(req);

        expect(res.status).toBe(200);
        const callArg = mockUpload.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(callArg.overwrite).toBe(true);
    });

    it('omits tags + overwrite from the provider call when not present', async () => {
        const actor = createUploadReadyActor();
        const req = new Request('http://localhost/api/v1/admin/media/upload', {
            method: 'POST',
            headers: buildAuthHeaders(actor),
            body: buildMultipartBody()
        });

        const res = await app.request(req);

        expect(res.status).toBe(200);
        const callArg = mockUpload.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(callArg).not.toHaveProperty('tags');
        expect(callArg).not.toHaveProperty('overwrite');
    });

    it('rejects an invalid tag (containing a comma after split is empty/illegal)', async () => {
        const actor = createUploadReadyActor();
        // After server-side split on `,` an entry like "evil injection" survives
        // and then fails Zod's per-tag character class (whitespace is forbidden).
        const req = new Request('http://localhost/api/v1/admin/media/upload', {
            method: 'POST',
            headers: buildAuthHeaders(actor),
            body: buildMultipartBody({ tags: 'safe,evil injection' })
        });

        const res = await app.request(req);

        expect(res.status).toBe(400);
        expect(mockUpload).not.toHaveBeenCalled();
    });
});
