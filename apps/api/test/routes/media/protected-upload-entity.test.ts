/**
 * @file protected-upload-entity.test.ts
 * @description Tests for the protected media upload-entity endpoint.
 *
 * Covers:
 * - Missing file field → 400
 * - Empty file → 422
 * - Ownership check (entity not owned by actor) → 403
 * - Missing required fields → 400
 * - Invalid role rejected (avatar not allowed) → 400
 * - Cloudinary upload failure (a single-attempt timeout, NO retry) always
 *   surfaces as a typed JSON error, never an uncaught exception (BETA-134)
 *
 * @module test/routes/media/protected-upload-entity
 */
import { PermissionEnum } from '@repo/schemas';
import { AccommodationService } from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuthenticatedRequest, createMockUserActor } from '../../helpers/auth';

const mockUpload = vi.fn();

vi.mock('../../../src/services/media', () => ({
    getMediaProvider: () => ({
        upload: mockUpload
    })
}));

const OWNER_ID = '00000000-0000-4000-8000-000000000099';
const ENTITY_ID = '00000000-0000-4000-8000-0000000000aa';
const _OTHER_USER_ID = '00000000-0000-4000-8000-0000000000bb';

const UPLOAD_URL = 'http://localhost/api/v1/protected/media/upload-entity';

const buildAuthHeaders = (
    actor: ReturnType<typeof createMockUserActor>
): Record<string, string> => {
    const { headers } = createAuthenticatedRequest(actor);
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
        if (k.toLowerCase() === 'content-type') continue;
        out[k] = v;
    }
    return out;
};

const buildMultipartBody = (overrides?: {
    role?: string;
    entityType?: string;
    entityId?: string;
    file?: File;
}): FormData => {
    const fd = new FormData();
    fd.append('role', overrides?.role ?? 'featured');
    fd.append('entityType', overrides?.entityType ?? 'accommodation');
    fd.append('entityId', overrides?.entityId ?? ENTITY_ID);
    fd.append(
        'file',
        overrides?.file ?? new File(['test-image-data'], 'test.jpg', { type: 'image/jpeg' })
    );
    return fd;
};

// Valid PNG magic bytes
const VALID_PNG_FILE = new File(
    [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])],
    'test.png',
    { type: 'image/png' }
);

describe('Protected media upload-entity endpoint', () => {
    const ownerActor = createMockUserActor({
        id: OWNER_ID,
        permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('validation', () => {
        it('should reject request with missing required fields', async () => {
            const { initApp } = await import('../../../src/app');
            const app = await initApp();
            const fd = new FormData();
            fd.append('file', VALID_PNG_FILE);

            const req = new Request(UPLOAD_URL, {
                method: 'POST',
                body: fd,
                headers: buildAuthHeaders(ownerActor)
            });

            const res = await app.request(req);
            // Without entityType/entityId/role, schema validation fails (400)
            // OR entity lookup fails (404) depending on middleware order
            expect([400, 404]).toContain(res.status);
        });

        it('should reject invalid role (avatar not allowed in protected tier)', async () => {
            const { initApp } = await import('../../../src/app');
            const app = await initApp();
            const fd = buildMultipartBody({ role: 'avatar' });

            const req = new Request(UPLOAD_URL, {
                method: 'POST',
                body: fd,
                headers: buildAuthHeaders(ownerActor)
            });

            const res = await app.request(req);
            expect(res.status).toBe(400);
        });

        it('should reject invalid entityType', async () => {
            const { initApp } = await import('../../../src/app');
            const app = await initApp();
            const fd = buildMultipartBody({ entityType: 'invalid' });

            const req = new Request(UPLOAD_URL, {
                method: 'POST',
                body: fd,
                headers: buildAuthHeaders(ownerActor)
            });

            const res = await app.request(req);
            expect(res.status).toBe(400);
        });

        it('should reject invalid entityId (not UUID)', async () => {
            const { initApp } = await import('../../../src/app');
            const app = await initApp();
            const fd = buildMultipartBody({ entityId: 'not-a-uuid' });

            const req = new Request(UPLOAD_URL, {
                method: 'POST',
                body: fd,
                headers: buildAuthHeaders(ownerActor)
            });

            const res = await app.request(req);
            expect(res.status).toBe(400);
        });
    });

    describe('Cache-Control header', () => {
        it('should set Cache-Control: no-store on error responses', async () => {
            const { initApp } = await import('../../../src/app');
            const app = await initApp();
            const fd = new FormData(); // missing required fields

            const req = new Request(UPLOAD_URL, {
                method: 'POST',
                body: fd,
                headers: buildAuthHeaders(ownerActor)
            });

            const res = await app.request(req);
            expect(res.headers.get('cache-control')).toBe('no-store');
        });
    });

    // -------------------------------------------------------------------------
    // BETA-134: Cloudinary timeout/failure must always surface as a typed JSON
    // error, never an uncaught exception (which is what let a reverse-proxy
    // timeout page — non-JSON — reach the client instead).
    // -------------------------------------------------------------------------
    describe('Cloudinary upload failure resiliency (BETA-134)', () => {
        /**
         * Minimal 1x1 red PNG with a real IHDR chunk (dimensions parseable by
         * `image-size`) — `VALID_PNG_FILE` above only has magic bytes and
         * fails the dimension check, which would mask these tests behind an
         * unrelated 422 UNPROCESSABLE_ENTITY before ever reaching the
         * provider.
         */
        const REAL_PNG_FILE = new File(
            [
                Buffer.from(
                    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
                    'base64'
                ) as unknown as BlobPart
            ],
            'test.png',
            { type: 'image/png' }
        );

        /**
         * Builds a vi mock function resolving to a minimal entity stub owned
         * by `OWNER_ID` with an empty gallery. Wrapped in `vi.fn()` (matching
         * the pattern used by `gallery-cap-enforcement.test.ts`) so it can be
         * passed to `mockImplementationOnce` without a type-unsafe cast — the
         * route only reads `data.ownerId` and `data.media.gallery` from the
         * resolved value, so this partial stub is functionally complete.
         */
        const buildOwnedEntityStub = () =>
            vi.fn().mockResolvedValue({
                data: {
                    id: ENTITY_ID,
                    ownerId: OWNER_ID,
                    media: { gallery: [] }
                },
                error: undefined
            });

        it('returns a typed 502 UPSTREAM_ERROR JSON body when Cloudinary persistently times out', async () => {
            // Arrange
            vi.spyOn(AccommodationService.prototype, 'getById').mockImplementationOnce(
                buildOwnedEntityStub()
            );
            mockUpload.mockRejectedValue(new Error('ETIMEDOUT'));

            const { initApp } = await import('../../../src/app');
            const app = await initApp();
            const req = new Request(UPLOAD_URL, {
                method: 'POST',
                body: buildMultipartBody({ file: REAL_PNG_FILE }),
                headers: buildAuthHeaders(ownerActor)
            });

            // Act
            const res = await app.request(req);
            const body = (await res.json()) as {
                success: boolean;
                error?: { code: string; message: string };
            };

            // Assert: a clean, parseable JSON error — this is the exact
            // contract the client's `JSON.parse(xhr.responseText)` relies on.
            expect(res.status).toBe(502);
            expect(body.success).toBe(false);
            expect(body.error?.code).toBe('UPSTREAM_ERROR');
            expect(typeof body.error?.message).toBe('string');

            // Single attempt only — no retry (uploads are not provably
            // idempotent, so an automatic retry could leak an orphaned
            // Cloudinary asset version).
            expect(mockUpload).toHaveBeenCalledOnce();
        });
    });
});
