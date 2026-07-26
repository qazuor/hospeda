/**
 * @file upload-body-limit.test.ts
 * @description Regression tests for HOS-322 — the entity-photo size limit.
 *
 * Before the fix, a single global `bodyLimit` in `create-app.ts` capped EVERY
 * request at 10 MB. Raising the media limit alone was not enough: a 12 MB photo
 * died in that global middleware with `REQUEST_TOO_LARGE` before the upload
 * handler (and its own, larger cap) ever ran. A per-route middleware could not
 * fix it either — Hono runs global middleware first.
 *
 * These tests pin the resulting contract:
 * - upload routes accept bodies above the global cap, up to the media cap;
 * - upload routes still reject bodies above the media cap;
 * - every OTHER route keeps the tighter global cap.
 *
 * @module test/routes/media/upload-body-limit
 */
import { PermissionEnum } from '@repo/schemas';
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

const ENTITY_UPLOAD_URL = 'http://localhost/api/v1/protected/media/upload-entity';
const AVATAR_UPLOAD_URL = 'http://localhost/api/v1/protected/media/upload';
const NON_UPLOAD_URL = 'http://localhost/api/v1/protected/accommodations';

const MB = 1024 * 1024;

/**
 * Build a JPEG-shaped payload of an exact byte length.
 *
 * Starts with the JPEG magic bytes so the buffer survives as far as the
 * dimension parser — these tests care about WHERE the request dies, so the
 * payload must never be rejected earlier for the wrong reason.
 */
const buildPayload = (bytes: number): Blob => {
    const data = new Uint8Array(new ArrayBuffer(bytes));
    data[0] = 0xff;
    data[1] = 0xd8;
    data[2] = 0xff;
    return new Blob([data]);
};

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

const readErrorCode = async (res: Response): Promise<string | undefined> => {
    const body = (await res.json()) as { error?: { code?: string } };
    return body.error?.code;
};

describe('HOS-322 — media upload body limits', () => {
    const ownerActor = createMockUserActor({
        id: OWNER_ID,
        permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('lets a 12 MB entity photo past the global body limit', async () => {
        const { initApp } = await import('../../../src/app');
        const app = await initApp();

        const fd = new FormData();
        fd.append('role', 'featured');
        fd.append('entityType', 'accommodation');
        fd.append('entityId', ENTITY_ID);
        fd.append('file', new File([buildPayload(12 * MB)], 'big.jpg', { type: 'image/jpeg' }));

        const res = await app.request(
            new Request(ENTITY_UPLOAD_URL, {
                method: 'POST',
                body: fd,
                headers: buildAuthHeaders(ownerActor)
            })
        );

        // The request must reach the handler. It may still fail there (the
        // entity does not exist in this harness), but it must NOT be killed by
        // a size guard.
        const code = await readErrorCode(res);
        expect(code).not.toBe('REQUEST_TOO_LARGE');
        expect(code).not.toBe('PAYLOAD_TOO_LARGE');
        expect(res.status).not.toBe(413);
    });

    it('still rejects an entity photo above the media cap', async () => {
        const { initApp } = await import('../../../src/app');
        const app = await initApp();

        const fd = new FormData();
        fd.append('role', 'featured');
        fd.append('entityType', 'accommodation');
        fd.append('entityId', ENTITY_ID);
        fd.append('file', new File([buildPayload(17 * MB)], 'huge.jpg', { type: 'image/jpeg' }));

        const res = await app.request(
            new Request(ENTITY_UPLOAD_URL, {
                method: 'POST',
                body: fd,
                headers: buildAuthHeaders(ownerActor)
            })
        );

        expect(res.status).toBe(413);
        // Must be the media-cap rejection, not the blunt global guard —
        // otherwise this test would pass for the very reason it exists to
        // rule out.
        expect(await readErrorCode(res)).toBe('PAYLOAD_TOO_LARGE');
    });

    it('keeps the tighter global cap on non-upload routes', async () => {
        const { initApp } = await import('../../../src/app');
        const app = await initApp();

        const res = await app.request(
            new Request(NON_UPLOAD_URL, {
                method: 'POST',
                body: buildPayload(12 * MB),
                headers: {
                    ...buildAuthHeaders(ownerActor),
                    'content-type': 'application/json'
                }
            })
        );

        expect(res.status).toBe(413);
        expect(await readErrorCode(res)).toBe('REQUEST_TOO_LARGE');
    });

    it('rejects an avatar above the avatar cap', async () => {
        const { initApp } = await import('../../../src/app');
        const app = await initApp();

        const fd = new FormData();
        fd.append('file', new File([buildPayload(6 * MB)], 'avatar.jpg', { type: 'image/jpeg' }));

        const res = await app.request(
            new Request(AVATAR_UPLOAD_URL, {
                method: 'POST',
                body: fd,
                headers: buildAuthHeaders(ownerActor)
            })
        );

        expect(res.status).toBe(413);
        expect(await readErrorCode(res)).toBe('PAYLOAD_TOO_LARGE');
    });
});
