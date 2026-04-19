/**
 * Tests for the media upload response contract (SPEC-078-GAPS T-029).
 *
 * Covers:
 *   - GAP-078-062: HTTP 200 OK (not 201) because uploads may overwrite an
 *     existing asset and are not strictly a creation.
 *   - GAP-078-026 + GAP-078-029: Response body is wrapped via `ResponseFactory`
 *     as `{ success: true, data: {...}, metadata: {...} }`. No raw `ctx.json`
 *     bypass.
 *   - GAP-078-149: The route runs `UploadResponseDataSchema.parse()` on the
 *     provider result before returning. Malformed provider output fails
 *     closed with HTTP 502 rather than flowing bad data downstream.
 *   - GAP-078-159: `data.moderationState === 'APPROVED'` is always present
 *     on the success payload.
 *   - GAP-078-178: Envelope includes the `metadata` block (timestamp + requestId).
 *
 * @module test/routes/media/upload-response-contract
 */
import { PermissionEnum, UploadResponseSchema } from '@repo/schemas';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createAuthenticatedRequest, createMockAdminActor } from '../../helpers/auth';

// Happy-path mock: provider returns the four required fields the route uses
// to build its validated response. The provider is called only if all the
// early gates pass (provider configured, actor UUID, session match, form
// valid, entity exists, permission check).
const mockUpload = vi.fn();
const mockDelete = vi.fn();

vi.mock('../../../src/services/media', () => ({
    getMediaProvider: () => ({
        upload: mockUpload,
        delete: mockDelete
    })
}));

// The admin upload route also calls AccommodationService.getById to verify
// the entity exists. Rather than mocking the whole `@repo/service-core`
// (which brings in AccommodationModel and trips other service graphs), we
// spy on the prototype so only `getById` is replaced for the duration of
// this suite.
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
 * Minimal 1x1 red PNG (67 bytes, base64-encoded).
 *
 * This is the canonical valid-image buffer used by
 * `packages/media/src/server/__tests__/validate-media-file.test.ts`.
 * It has the correct PNG magic bytes AND a parseable IHDR so that
 * `image-size` inside `validateMediaFile` extracts width=1, height=1.
 */
const MINIMAL_PNG_B64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

const buildMultipartBody = (): FormData => {
    const fd = new FormData();
    fd.append('entityType', 'accommodation');
    fd.append('entityId', ADMIN_ENTITY_ID);
    fd.append('role', 'featured');
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
            // Required by `validateEntityMediaPermission`: modifying media
            // counts as updating the entity, so the actor must hold the
            // entity's UPDATE permission. ANY (vs OWN) bypasses ownership
            // checks, which is what we want for a test-focused happy path.
            PermissionEnum.ACCOMMODATION_UPDATE_ANY
        ]
    });

describe('Admin media upload — response contract (SPEC-078-GAPS T-029)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();

        // Stub entity lookup across all four services the route supports.
        // The admin upload route calls `service.getById(actor, entityId)` to
        // verify the target entity exists before uploading. We short-circuit
        // that with a valid result so the provider is actually reached.
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

    it('returns HTTP 200 (not 201) and a wrapped body with moderationState APPROVED', async () => {
        mockUpload.mockResolvedValueOnce({
            url: 'https://res.cloudinary.com/hospeda/image/upload/v1/hospeda/abc.jpg',
            publicId: 'hospeda/test/accommodations/abc/featured',
            width: 1920,
            height: 1080
        });

        const actor = createUploadReadyActor();
        // Use a Request object so the runtime serializes FormData with the
        // correct multipart/form-data boundary automatically. When we pass
        // headers+body separately to `app.request`, Hono does not compute
        // the boundary for us and formData parsing fails with 400.
        const req = new Request('http://localhost/api/v1/admin/media/upload', {
            method: 'POST',
            headers: buildAuthHeaders(actor),
            body: buildMultipartBody()
        });
        const res = await app.request(req);

        // GAP-078-062: uploads return 200, not 201.
        expect(res.status).toBe(200);

        const payload = await res.json();

        // GAP-078-026 + 029: wrapped envelope produced by ResponseFactory.
        expect(payload.success).toBe(true);
        expect(payload.data).toBeDefined();
        expect(payload.metadata).toBeDefined();
        expect(typeof payload.metadata.timestamp).toBe('string');

        // GAP-078-159: moderationState present and equal to APPROVED.
        expect(payload.data.moderationState).toBe('APPROVED');
        expect(payload.data.url).toBe(
            'https://res.cloudinary.com/hospeda/image/upload/v1/hospeda/abc.jpg'
        );
        expect(payload.data.publicId).toBe('hospeda/test/accommodations/abc/featured');
        expect(payload.data.width).toBe(1920);
        expect(payload.data.height).toBe(1080);

        // GAP-078-178: the full wrapped shape must `parse` cleanly against
        // the canonical `UploadResponseSchema` — the single source of truth.
        const parsed = UploadResponseSchema.safeParse(payload);
        expect(parsed.success).toBe(true);
    });

    it('returns 502 UPSTREAM_ERROR when the provider response fails UploadResponseDataSchema', async () => {
        // Provider returns a malformed response (missing width/height). The
        // route MUST catch this via UploadResponseDataSchema.safeParse and
        // respond 502 instead of flowing bad data downstream.
        mockUpload.mockResolvedValueOnce({
            url: 'https://res.cloudinary.com/hospeda/image/upload/v1/hospeda/abc.jpg',
            publicId: 'hospeda/test/accommodations/abc/featured'
            // width + height intentionally missing
        });

        const actor = createUploadReadyActor();
        const req = new Request('http://localhost/api/v1/admin/media/upload', {
            method: 'POST',
            headers: buildAuthHeaders(actor),
            body: buildMultipartBody()
        });
        const res = await app.request(req);

        expect(res.status).toBe(502);
        const payload = await res.json();
        expect(payload.success).toBe(false);
        expect(payload.error?.code).toBe('UPSTREAM_ERROR');
    });
});
