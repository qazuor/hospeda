/**
 * Integration tests for POST /api/v1/protected/media/upload (SPEC-078-GAPS
 * T-066, GAP-078-093).
 *
 * This endpoint is the user-self-service avatar upload. The entity (avatar
 * path) is always inferred from the session actor's id — users cannot
 * target someone else's avatar.
 *
 * Scenarios covered:
 *   - REQ-04.2-A: authenticated user uploads and receives 200 with a
 *     publicId keyed on the actor's own id (never another user's id).
 *   - REQ-04.2-B: unauthenticated request is rejected with 401.
 *   - GAP-078-093: when Cloudinary is not configured, the route responds
 *     with 503 CLOUDINARY_NOT_CONFIGURED.
 *   - Sad path: provider failure surfaces as 502 UPSTREAM_ERROR (proves
 *     the error path is wired through the avatar route as well).
 *
 * @module test/routes/media/t066-protected-upload-integration
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuthenticatedRequest, createMockUserActor } from '../../helpers/auth';

const { mockUpload, mockDelete, providerState } = vi.hoisted(() => ({
    mockUpload: vi.fn(),
    mockDelete: vi.fn(),
    providerState: { configured: true as boolean }
}));

vi.mock('../../../src/services/media', () => ({
    getMediaProvider: () =>
        providerState.configured
            ? {
                  upload: mockUpload,
                  delete: mockDelete
              }
            : null
}));

import { initApp } from '../../../src/app';
import { getDomainCounters, resetMetrics } from '../../../src/middlewares/metrics';
import type { AppOpenAPI } from '../../../src/types';

const USER_ACTOR_ID = '00000000-0000-4000-8000-00000000aaaa';

/**
 * Minimal 1x1 red PNG with correct magic bytes (parsable by `image-size`).
 */
const MINIMAL_PNG_B64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

const buildAuthHeaders = (
    actor: ReturnType<typeof createMockUserActor>
): Record<string, string> => {
    const { headers } = createAuthenticatedRequest(actor);
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
        // Strip Content-Type so FormData sets the multipart boundary itself.
        if (k.toLowerCase() === 'content-type') continue;
        out[k] = v;
    }
    return out;
};

const buildAvatarBody = (file?: File): FormData => {
    const fd = new FormData();
    fd.append(
        'file',
        file ??
            new File([Buffer.from(MINIMAL_PNG_B64, 'base64')], 'avatar.png', {
                type: 'image/png'
            })
    );
    return fd;
};

const PROTECTED_UPLOAD_URL = 'http://localhost/api/v1/protected/media/upload';

describe('POST /api/v1/protected/media/upload — integration (T-066)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    beforeEach(() => {
        providerState.configured = true;
        mockUpload.mockReset();
        mockDelete.mockReset();
        resetMetrics();
    });

    afterAll(() => {
        providerState.configured = true;
    });

    // ── REQ-04.2-A: Authenticated user uploads avatar ──────────────────────
    describe('REQ-04.2-A — authenticated user uploads avatar', () => {
        it('returns 200 with a publicId keyed on the actor id and forwards overwrite:true to the provider', async () => {
            // Arrange: provider echoes back a realistic Cloudinary shape.
            const expectedPublicId = `hospeda/test/avatars/${USER_ACTOR_ID}`;
            mockUpload.mockImplementationOnce(
                async ({
                    folder,
                    publicId,
                    overwrite
                }: {
                    folder: string;
                    publicId: string;
                    overwrite: boolean;
                }) => {
                    // Self-check: the route must be passing the avatar folder
                    // and the actor's own id as the publicId, with
                    // overwrite=true. Capturing here so the assertion below
                    // can inspect it regardless of mock-ordering.
                    return {
                        url: `https://res.cloudinary.com/hospeda/image/upload/v1/${folder}/${publicId}.png`,
                        publicId: `${folder}/${publicId}`,
                        width: 800,
                        height: 800,
                        _meta: { overwrite }
                    };
                }
            );

            const actor = createMockUserActor({ id: USER_ACTOR_ID });

            // Act
            const req = new Request(PROTECTED_UPLOAD_URL, {
                method: 'POST',
                headers: buildAuthHeaders(actor),
                body: buildAvatarBody()
            });
            const res = await app.request(req);
            const body = (await res.json()) as {
                success: boolean;
                data: {
                    url: string;
                    publicId: string;
                    width: number;
                    height: number;
                    moderationState: 'APPROVED';
                };
            };

            // Assert
            expect(res.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.url.startsWith('https://')).toBe(true);
            expect(body.data.moderationState).toBe('APPROVED');
            expect(body.data.publicId).toBe(expectedPublicId);

            // Provider receives the `avatars` folder + the actor id as the
            // publicId + overwrite: true. These invariants enforce
            // REQ-04.2-FLOW's self-scoped upload: users cannot target
            // another user's avatar path.
            expect(mockUpload).toHaveBeenCalledTimes(1);
            const arg = mockUpload.mock.calls[0]?.[0] as {
                folder: string;
                publicId: string;
                overwrite: boolean;
                file: Buffer;
            };
            expect(arg.folder).toBe('hospeda/test/avatars');
            expect(arg.publicId).toBe(USER_ACTOR_ID);
            expect(arg.overwrite).toBe(true);
            expect(Buffer.isBuffer(arg.file)).toBe(true);

            const counters = getDomainCounters();
            expect(counters['media_upload_total{result=success}']).toBe(1);
        });

        it('keys the publicId on the session actor — a second user uploading gets their own bucket, not someone else"s', async () => {
            // Arrange: two independent user actors in sequence verify the
            // avatar-scoping invariant. Both calls use their respective ids
            // as the publicId.
            mockUpload.mockImplementation(
                async ({ publicId, folder }: { publicId: string; folder: string }) => ({
                    url: `https://res.cloudinary.com/hospeda/image/upload/v1/${folder}/${publicId}.png`,
                    publicId: `${folder}/${publicId}`,
                    width: 400,
                    height: 400
                })
            );

            const userA = createMockUserActor({ id: '00000000-0000-4000-8000-0000000000aa' });
            const userB = createMockUserActor({ id: '00000000-0000-4000-8000-0000000000bb' });

            // Act
            const resA = await app.request(
                new Request(PROTECTED_UPLOAD_URL, {
                    method: 'POST',
                    headers: buildAuthHeaders(userA),
                    body: buildAvatarBody()
                })
            );
            const resB = await app.request(
                new Request(PROTECTED_UPLOAD_URL, {
                    method: 'POST',
                    headers: buildAuthHeaders(userB),
                    body: buildAvatarBody()
                })
            );

            // Assert
            expect(resA.status).toBe(200);
            expect(resB.status).toBe(200);

            // Two calls, two different publicIds — one per actor.
            expect(mockUpload).toHaveBeenCalledTimes(2);
            const argA = mockUpload.mock.calls[0]?.[0] as { publicId: string };
            const argB = mockUpload.mock.calls[1]?.[0] as { publicId: string };
            expect(argA.publicId).toBe(userA.id);
            expect(argB.publicId).toBe(userB.id);
            expect(argA.publicId).not.toBe(argB.publicId);
        });
    });

    // ── REQ-04.2-B: Unauthenticated request ────────────────────────────────
    describe('REQ-04.2-B — auth gate', () => {
        it('rejects an unauthenticated request with HTTP 401', async () => {
            // Act: no mock-actor headers → guest actor → protected auth
            // middleware rejects with 401. user-agent kept so the validation
            // middleware does not cross-fire with a header-level 400.
            const req = new Request(PROTECTED_UPLOAD_URL, {
                method: 'POST',
                headers: { 'user-agent': 'vitest' },
                body: buildAvatarBody()
            });
            const res = await app.request(req);

            // Assert
            expect(res.status).toBe(401);
            expect(mockUpload).not.toHaveBeenCalled();
        });
    });

    // ── GAP-078-093: Cloudinary not configured ─────────────────────────────
    describe('GAP-078-093 — Cloudinary not configured', () => {
        it('returns 503 CLOUDINARY_NOT_CONFIGURED when getMediaProvider() returns null', async () => {
            // Arrange
            providerState.configured = false;
            const actor = createMockUserActor({ id: USER_ACTOR_ID });

            // Act
            const req = new Request(PROTECTED_UPLOAD_URL, {
                method: 'POST',
                headers: buildAuthHeaders(actor),
                body: buildAvatarBody()
            });
            const res = await app.request(req);
            const body = (await res.json()) as {
                success: boolean;
                error?: { code: string };
            };

            // Assert
            expect(res.status).toBe(503);
            expect(body.success).toBe(false);
            expect(body.error?.code).toBe('CLOUDINARY_NOT_CONFIGURED');
            expect(mockUpload).not.toHaveBeenCalled();
        });
    });

    // ── Sad path: provider raises ──────────────────────────────────────────
    describe('provider failure path', () => {
        it('returns 502 UPSTREAM_ERROR when the provider throws', async () => {
            // Arrange
            mockUpload.mockRejectedValueOnce(new Error('Cloudinary SDK blew up'));
            const actor = createMockUserActor({ id: USER_ACTOR_ID });

            // Act
            const req = new Request(PROTECTED_UPLOAD_URL, {
                method: 'POST',
                headers: buildAuthHeaders(actor),
                body: buildAvatarBody()
            });
            const res = await app.request(req);
            const body = (await res.json()) as {
                success: boolean;
                error?: { code: string };
            };

            // Assert
            expect(res.status).toBe(502);
            expect(body.success).toBe(false);
            expect(body.error?.code).toBe('UPSTREAM_ERROR');

            const counters = getDomainCounters();
            expect(counters['media_upload_total{result=failure}']).toBe(1);
        });
    });
});
