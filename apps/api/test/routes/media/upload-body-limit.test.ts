/**
 * @file upload-body-limit.test.ts
 * @description Regression tests for HOS-322 — the entity-photo size limit.
 *
 * Before the fix, a single global `bodyLimit` capped EVERY request at 10 MB and
 * the entity upload path enforced its own hardcoded 5 MB. Two consequences:
 * a photo above 5 MB was refused outright, and even after raising the media cap
 * a photo AT the cap still died — the multipart envelope pushes the body past
 * the global ceiling, so the request was rejected with `REQUEST_TOO_LARGE`
 * before the upload handler ran. Moving the wider ceiling into the route's own
 * `options.middlewares` could not fix that either: Hono runs global middleware
 * first.
 *
 * These tests pin the resulting contract:
 * - an upload route accepts a file at the cap even once the envelope is added;
 * - it still rejects a file above the cap, with the precise error;
 * - the avatar route keeps its own, lower ceiling;
 * - every OTHER route keeps the tight global cap.
 *
 * Sizes here are deliberately absolute rather than derived from the shared
 * constants: every other test in this change derives from the same constant the
 * code reads, which pins boundary behaviour but not the value. This file is
 * where a silent revert of the cap gets caught.
 *
 * @module test/routes/media/upload-body-limit
 */
import { PermissionEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WIDENED_UPLOAD_PATHS } from '../../../src/middlewares/body-limit';
import { createAuthenticatedRequest, createMockUserActor } from '../../helpers/auth';

const mockUpload = vi.fn();

vi.mock('../../../src/services/media', () => ({
    getMediaProvider: () => ({
        upload: mockUpload
    })
}));

const OWNER_ID = '00000000-0000-4000-8000-000000000099';
const ENTITY_ID = '00000000-0000-4000-8000-0000000000aa';

const ORIGIN = 'http://localhost';
const ENTITY_UPLOAD_URL = `${ORIGIN}/api/v1/protected/media/upload-entity`;
const AVATAR_UPLOAD_URL = `${ORIGIN}/api/v1/protected/media/upload`;
const NON_UPLOAD_URL = `${ORIGIN}/api/v1/protected/accommodations`;

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

const readError = async (res: Response): Promise<{ code?: string; message?: string }> => {
    const body = (await res.json()) as { error?: { code?: string; message?: string } };
    return body.error ?? {};
};

describe('HOS-322 — media upload body limits', () => {
    const ownerActor = createMockUserActor({
        id: OWNER_ID,
        permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    const buildEntityForm = (bytes: number, name: string): FormData => {
        const fd = new FormData();
        fd.append('role', 'featured');
        fd.append('entityType', 'accommodation');
        fd.append('entityId', ENTITY_ID);
        fd.append('file', new File([buildPayload(bytes)], name, { type: 'image/jpeg' }));
        return fd;
    };

    it('accepts an entity photo at the full 10 MB cap, envelope included', async () => {
        // The exact case the old single global ceiling broke: the FILE is at the
        // cap, so the BODY (file + boundaries + four field parts) is over it.
        const { initApp } = await import('../../../src/app');
        const app = await initApp();

        const res = await app.request(
            new Request(ENTITY_UPLOAD_URL, {
                method: 'POST',
                body: buildEntityForm(10 * MB, 'at-cap.jpg'),
                headers: buildAuthHeaders(ownerActor)
            })
        );

        // The request must reach the handler. It may still fail there (the
        // entity does not exist in this harness), but never on size.
        const { code } = await readError(res);
        expect(code).not.toBe('REQUEST_TOO_LARGE');
        expect(code).not.toBe('PAYLOAD_TOO_LARGE');
        expect(res.status).not.toBe(413);
    });

    it('rejects an entity photo above the cap with the precise error', async () => {
        const { initApp } = await import('../../../src/app');
        const app = await initApp();

        const res = await app.request(
            new Request(ENTITY_UPLOAD_URL, {
                method: 'POST',
                body: buildEntityForm(12 * MB, 'over-cap.jpg'),
                headers: buildAuthHeaders(ownerActor)
            })
        );

        expect(res.status).toBe(413);
        const { code, message } = await readError(res);
        // Must be the media-cap rejection, not the blunt global guard —
        // otherwise this test would pass for the very reason it exists to
        // rule out. And the message must name the limit actually applied.
        expect(code).toBe('PAYLOAD_TOO_LARGE');
        expect(message).toContain('10MB');
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
        expect((await readError(res)).code).toBe('REQUEST_TOO_LARGE');
    });

    it('holds the avatar route to its own lower ceiling', async () => {
        // 6 MB is under the entity cap but over the avatar cap: it proves the
        // avatar path did not inherit the wider entity ceiling despite being a
        // string prefix of `/upload-entity`.
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
        const { code, message } = await readError(res);
        expect(code).toBe('PAYLOAD_TOO_LARGE');
        expect(message).toContain('5MB');
    });

    it('widens the ceiling only for paths that are really registered routes', async () => {
        // The middleware matches hardcoded copies of paths owned by
        // `routes/index.ts` and the route modules. A rename there would
        // otherwise silently drop an upload route back to the global cap, with
        // no failure anywhere until a host hit it in production.
        const { initApp } = await import('../../../src/app');
        const app = await initApp();

        expect(WIDENED_UPLOAD_PATHS.length).toBeGreaterThan(0);

        for (const path of WIDENED_UPLOAD_PATHS) {
            const res = await app.request(
                new Request(`${ORIGIN}${path}`, {
                    method: 'POST',
                    body: new FormData(),
                    headers: buildAuthHeaders(ownerActor)
                })
            );
            // Any status but 404 proves the path reaches a registered handler.
            expect(res.status, `${path} is not a registered POST route`).not.toBe(404);
        }
    });
});
