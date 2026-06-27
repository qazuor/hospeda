/**
 * Integration tests for POST /api/v1/admin/media/upload (SPEC-078-GAPS T-066,
 * GAP-078-092 + GAP-078-093).
 *
 * These scenarios exercise the route through the full Hono middleware stack
 * (origin, auth, authorization, actor, validation, rate limit, domain
 * handler) with the media provider mocked at the service boundary so no
 * Cloudinary credentials are required. Each `it` maps to a named REQ-04.1
 * scenario from the SPEC-078 spec so the coverage is auditable against the
 * contract.
 *
 * Scenarios covered:
 *   - REQ-04.1-A: unauthenticated request is rejected with 401.
 *   - REQ-04.1-B: happy-path entity featured upload returns 200 with the
 *     `hospeda/{env}/accommodations/{id}/featured` publicId forwarded to the
 *     provider under the canonical folder.
 *   - REQ-04.1-C: gallery upload generates a server-side nanoid publicId
 *     (`gallery/{nanoid10}`) and echoes it back to the caller.
 *   - REQ-04.1-D: missing required field surfaces as a validation error —
 *     400 VALIDATION_ERROR (spec amended 2026-04-20, v2.0).
 *   - REQ-04.1-G: entity lookup miss surfaces as 404 ENTITY_NOT_FOUND before
 *     any provider call.
 *   - REQ-04.1-H: path-traversal-shaped entityId (not a UUID) rejected before
 *     provider call.
 *   - Sad path: MIME mismatch rejected via validateMediaFile with 422
 *     UNPROCESSABLE_ENTITY.
 *   - Sad path: missing `file` field rejected with 400 VALIDATION_ERROR.
 *   - Sad path: non-owner actor rejected with 403 FORBIDDEN (defense-in-depth
 *     entity permission layer on top of role-level MEDIA_UPLOAD gate).
 *   - GAP-078-093: when Cloudinary is not configured (`getMediaProvider()`
 *     returns null), the route responds 503 CLOUDINARY_NOT_CONFIGURED
 *     BEFORE any multipart parsing.
 *
 * @module test/routes/media/t066-admin-upload-integration
 */

import { PermissionEnum } from '@repo/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    createAuthenticatedRequest,
    createMockAdminActor,
    type createMockUserActor
} from '../../helpers/auth';

const { mockUpload, mockDelete, providerState, mockFindByAccommodation } = vi.hoisted(() => ({
    mockUpload: vi.fn(),
    mockDelete: vi.fn(),
    providerState: { configured: true as boolean },
    // SPEC-204: accommodation gallery count now comes from the relational table.
    mockFindByAccommodation: vi.fn()
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

// SPEC-204: stub accommodationMediaModel so gallery/plan-cap checks resolve
// against the relational table without a live DB connection. Default: 0 rows.
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
import { getDomainCounters, resetMetrics } from '../../../src/middlewares/metrics';
import type { AppOpenAPI } from '../../../src/types';

const ADMIN_ENTITY_ID = '00000000-0000-4000-8000-0000000000aa';
const ADMIN_ACTOR_ID = '00000000-0000-4000-8000-000000000099';
const OTHER_OWNER_ID = '00000000-0000-4000-8000-0000000000bb';

/**
 * Minimal 1x1 red PNG with correct magic bytes. Small enough to stay well
 * under every size gate and parseable by `image-size` for dimension checks.
 */
const MINIMAL_PNG_B64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

const pngBuffer = (): Buffer => Buffer.from(MINIMAL_PNG_B64, 'base64');
/**
 * Typed alias for the image bytes passed to `new File([...])`. Node's Buffer
 * in strict TS dom libs is occasionally typed as backed by an ambiguous
 * ArrayBufferLike, which the lib dom `BlobPart` union rejects. Casting to
 * `BlobPart` is safe: Buffer is accepted at runtime by the File constructor
 * via duck-typing on the iterator.
 */
const pngBlobPart = (): BlobPart => pngBuffer() as unknown as BlobPart;
const pngFile = (name = 'test.png'): File => new File([pngBlobPart()], name, { type: 'image/png' });

const buildAuthHeaders = (
    actor: ReturnType<typeof createMockAdminActor> | ReturnType<typeof createMockUserActor>
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

const createUploadReadyActor = (
    overrides: Partial<Parameters<typeof createMockAdminActor>[0]> = {}
) =>
    createMockAdminActor({
        id: ADMIN_ACTOR_ID,
        permissions: [
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.ACCESS_API_ADMIN,
            PermissionEnum.MEDIA_UPLOAD,
            PermissionEnum.ACCOMMODATION_UPDATE_ANY
        ],
        ...overrides
    });

const buildAdminMultipartBody = (
    extras: Record<string, string | Blob> = {},
    overrides: Partial<{ entityType: string; entityId: string; role: string; file: File }> = {}
): FormData => {
    const fd = new FormData();
    if (overrides.entityType !== undefined) fd.append('entityType', overrides.entityType);
    else if (overrides.entityType !== null) fd.append('entityType', 'accommodation');
    if (overrides.entityId !== undefined) fd.append('entityId', overrides.entityId);
    else fd.append('entityId', ADMIN_ENTITY_ID);
    if (overrides.role !== undefined) fd.append('role', overrides.role);
    else fd.append('role', 'featured');
    if (overrides.file !== null && overrides.file !== undefined) {
        fd.append('file', overrides.file);
    } else if (overrides.file === undefined) {
        fd.append('file', pngFile());
    }
    for (const [key, value] of Object.entries(extras)) {
        fd.append(key, value);
    }
    return fd;
};

const ADMIN_UPLOAD_URL = 'http://localhost/api/v1/admin/media/upload';

describe('POST /api/v1/admin/media/upload — integration (T-066)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();

        // Default: entity exists and is owned by the admin actor. Individual
        // cases override this via `mockImplementationOnce`.
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
    });

    beforeEach(() => {
        providerState.configured = true;
        mockUpload.mockReset();
        mockUpload.mockResolvedValue({
            url: 'https://res.cloudinary.com/hospeda/image/upload/v1/hospeda/test/accommodations/abc/featured.png',
            publicId: 'hospeda/test/accommodations/abc/featured',
            width: 1920,
            height: 1080
        });
        mockDelete.mockReset();
        // SPEC-204: default empty relational gallery (0 visible rows) so the
        // gallery-cap and plan-cap checks resolve cleanly without a DB.
        mockFindByAccommodation.mockReset();
        mockFindByAccommodation.mockResolvedValue({ items: [], total: 0 });
        resetMetrics();
    });

    afterAll(() => {
        providerState.configured = true;
    });

    // ── REQ-04.1-A: Unauthenticated request is rejected ────────────────────
    describe('REQ-04.1-A — auth gate', () => {
        it('rejects an unauthenticated request with HTTP 401', async () => {
            // Act: no mock-actor headers and no Authorization, so the actor
            // middleware produces a GUEST actor and the admin authorization
            // middleware rejects with 401. We still send a multipart body so
            // the rejection is unambiguously about auth, not about a missing
            // payload surfaced by later layers.
            const req = new Request(ADMIN_UPLOAD_URL, {
                method: 'POST',
                headers: {
                    'user-agent': 'vitest'
                },
                body: buildAdminMultipartBody()
            });
            const res = await app.request(req);

            // Assert: admin authorization middleware rejects any guest actor.
            expect(res.status).toBe(401);
            expect(mockUpload).not.toHaveBeenCalled();
        });
    });

    // ── REQ-04.1-B: Happy path entity featured upload ──────────────────────
    describe('REQ-04.1-B — successful entity featured upload', () => {
        it('forwards the canonical hospeda/{env}/{entityPlural}/{entityId} folder + featured publicId to the provider and returns 200', async () => {
            // Arrange
            const actor = createUploadReadyActor();

            // Act
            const req = new Request(ADMIN_UPLOAD_URL, {
                method: 'POST',
                headers: buildAuthHeaders(actor),
                body: buildAdminMultipartBody()
            });
            const res = await app.request(req);

            // Assert
            expect(res.status).toBe(200);
            const payload = (await res.json()) as {
                success: boolean;
                data: {
                    url: string;
                    publicId: string;
                    width: number;
                    height: number;
                    moderationState: 'APPROVED';
                };
            };
            expect(payload.success).toBe(true);
            expect(payload.data.url.startsWith('https://')).toBe(true);
            expect(payload.data.moderationState).toBe('APPROVED');

            // Provider receives the canonical folder shape + the `featured`
            // publicId. `hospeda/test/...` because Vitest runs under
            // NODE_ENV=test so resolveEnvironment() returns 'test'.
            expect(mockUpload).toHaveBeenCalledTimes(1);
            const arg = mockUpload.mock.calls[0]?.[0] as {
                folder: string;
                publicId: string;
                file: Buffer;
            };
            expect(arg.folder).toBe(`hospeda/test/accommodations/${ADMIN_ENTITY_ID}`);
            expect(arg.publicId).toBe('featured');
            expect(Buffer.isBuffer(arg.file)).toBe(true);

            // Counter bump proves the observability wiring is reached.
            const counters = getDomainCounters();
            expect(counters['media_upload_total{result=success}']).toBe(1);
        });
    });

    // ── REQ-04.1-C: Gallery upload generates nanoid ────────────────────────
    describe('REQ-04.1-C — gallery upload with server-generated nanoid', () => {
        it('generates a nanoid-shaped publicId under the gallery/ sub-folder', async () => {
            // Arrange: provider echoes back whatever publicId the route sent,
            // so we can inspect the nanoid shape.
            mockUpload.mockImplementationOnce(
                async ({ folder, publicId }: { folder: string; publicId: string }) => ({
                    url: `https://res.cloudinary.com/hospeda/image/upload/v1/${folder}/${publicId}.png`,
                    publicId: `${folder}/${publicId}`,
                    width: 1920,
                    height: 1080
                })
            );
            const actor = createUploadReadyActor();

            // Act
            const req = new Request(ADMIN_UPLOAD_URL, {
                method: 'POST',
                headers: buildAuthHeaders(actor),
                body: buildAdminMultipartBody({}, { role: 'gallery' })
            });
            const res = await app.request(req);

            // Assert
            expect(res.status).toBe(200);
            const arg = mockUpload.mock.calls[0]?.[0] as { publicId: string; folder: string };
            // Server-generated shape: `gallery/{10-char nanoid}`.
            expect(arg.publicId).toMatch(/^gallery\/[A-Za-z0-9_-]{10}$/);
            expect(arg.folder).toBe(`hospeda/test/accommodations/${ADMIN_ENTITY_ID}`);

            const payload = (await res.json()) as {
                data: { publicId: string };
            };
            // The response echoes back the publicId the provider returned,
            // including the nanoid so the client can store it.
            expect(payload.data.publicId).toMatch(
                new RegExp(
                    `^hospeda/test/accommodations/${ADMIN_ENTITY_ID}/gallery/[A-Za-z0-9_-]{10}$`
                )
            );
        });
    });

    // ── REQ-04.1-D: Missing required field ─────────────────────────────────
    describe('REQ-04.1-D — missing required field', () => {
        it('rejects a request missing entityType before calling the provider', async () => {
            // Arrange
            const actor = createUploadReadyActor();
            const fd = new FormData();
            // entityType intentionally omitted
            fd.append('entityId', ADMIN_ENTITY_ID);
            fd.append('role', 'featured');
            fd.append('file', pngFile());

            // Act
            const req = new Request(ADMIN_UPLOAD_URL, {
                method: 'POST',
                headers: buildAuthHeaders(actor),
                body: fd
            });
            const res = await app.request(req);
            const body = (await res.json()) as {
                success: boolean;
                error?: { code: string };
            };

            // Assert: spec REQ-04.1-D (amended 2026-04-20, v2.0) specifies
            // HTTP 400 VALIDATION_ERROR — the Hospeda API convention for all
            // Zod validation failures. The spec was reconciled to match the
            // implementation; no code change was needed.
            expect(res.status).toBe(400);
            expect(body.success).toBe(false);
            expect(body.error?.code).toBe('VALIDATION_ERROR');
            expect(mockUpload).not.toHaveBeenCalled();
        });
    });

    // ── REQ-04.1-G: Entity does not exist ──────────────────────────────────
    describe('REQ-04.1-G — entity lookup miss', () => {
        it('returns 404 ENTITY_NOT_FOUND when the entity service has no matching record', async () => {
            // Arrange
            vi.spyOn(AccommodationService.prototype, 'getById').mockImplementationOnce(
                vi.fn().mockResolvedValue({ data: null, error: { code: 'NOT_FOUND' } })
            );
            const actor = createUploadReadyActor();

            // Act
            const req = new Request(ADMIN_UPLOAD_URL, {
                method: 'POST',
                headers: buildAuthHeaders(actor),
                body: buildAdminMultipartBody()
            });
            const res = await app.request(req);
            const body = (await res.json()) as {
                success: boolean;
                error?: { code: string };
            };

            // Assert
            expect(res.status).toBe(404);
            expect(body.error?.code).toBe('ENTITY_NOT_FOUND');
            expect(mockUpload).not.toHaveBeenCalled();
        });
    });

    // ── REQ-04.1-H: Path traversal protection via UUID validation ──────────
    describe('REQ-04.1-H — entityId must be a UUID', () => {
        it('rejects a path-traversal-shaped entityId via the schema UUID check before provider call', async () => {
            // Arrange
            const actor = createUploadReadyActor();
            const fd = buildAdminMultipartBody({}, { entityId: '../../../malicious' });

            // Act
            const req = new Request(ADMIN_UPLOAD_URL, {
                method: 'POST',
                headers: buildAuthHeaders(actor),
                body: fd
            });
            const res = await app.request(req);
            const body = (await res.json()) as {
                success: boolean;
                error?: { code: string };
            };

            // Assert: schema rejects non-UUID entityId before the provider
            // is touched. Spec REQ-04.1-H (amended 2026-04-20, v2.0)
            // specifies HTTP 400 VALIDATION_ERROR — reconciled to the
            // Hospeda API convention for all Zod validation failures.
            expect(res.status).toBe(400);
            expect(body.error?.code).toBe('VALIDATION_ERROR');
            expect(mockUpload).not.toHaveBeenCalled();
        });
    });

    // ── Sad path: MIME mismatch (magic-byte / declared MIME disagree) ──────
    describe('MIME mismatch via validateMediaFile', () => {
        it('returns 422 UNPROCESSABLE_ENTITY when the declared MIME does not match the magic bytes', async () => {
            // Arrange: declare image/jpeg but hand over real PNG bytes — the
            // magic-byte detector will refuse.
            const actor = createUploadReadyActor();
            const mismatchedFile = new File([pngBlobPart()], 'lies.jpg', { type: 'image/jpeg' });
            const fd = buildAdminMultipartBody({}, { file: mismatchedFile });

            // Act
            const req = new Request(ADMIN_UPLOAD_URL, {
                method: 'POST',
                headers: buildAuthHeaders(actor),
                body: fd
            });
            const res = await app.request(req);
            const body = (await res.json()) as {
                success: boolean;
                error?: { code: string; details?: { code?: string } };
            };

            // Assert
            expect(res.status).toBe(422);
            expect(body.success).toBe(false);
            expect(body.error?.code).toBe('UNPROCESSABLE_ENTITY');
            expect(mockUpload).not.toHaveBeenCalled();
        });
    });

    // ── Sad path: missing file field ───────────────────────────────────────
    describe('missing file field', () => {
        it('returns 400 VALIDATION_ERROR when the file field is absent', async () => {
            // Arrange
            const actor = createUploadReadyActor();
            const fd = new FormData();
            fd.append('entityType', 'accommodation');
            fd.append('entityId', ADMIN_ENTITY_ID);
            fd.append('role', 'featured');
            // No `file` field appended.

            // Act
            const req = new Request(ADMIN_UPLOAD_URL, {
                method: 'POST',
                headers: buildAuthHeaders(actor),
                body: fd
            });
            const res = await app.request(req);
            const body = (await res.json()) as {
                success: boolean;
                error?: { code: string; message?: string };
            };

            // Assert
            expect(res.status).toBe(400);
            expect(body.error?.code).toBe('VALIDATION_ERROR');
            expect(body.error?.message ?? '').toMatch(/file/i);
            expect(mockUpload).not.toHaveBeenCalled();
        });
    });

    // ── Sad path: non-owner actor on an accommodation (entity-perm layer) ──
    describe('entity-level ownership check (defense-in-depth)', () => {
        it('returns 403 FORBIDDEN when actor has UPDATE_OWN but is not the entity owner', async () => {
            // Arrange: entity owned by someone else, actor only holds
            // ACCOMMODATION_UPDATE_OWN (no UPDATE_ANY), which must fail the
            // validateEntityMediaPermission check.
            vi.spyOn(AccommodationService.prototype, 'getById').mockImplementationOnce(
                vi.fn().mockResolvedValue({
                    data: { id: ADMIN_ENTITY_ID, ownerId: OTHER_OWNER_ID, media: { gallery: [] } },
                    error: undefined
                })
            );

            const actor = createMockAdminActor({
                id: ADMIN_ACTOR_ID,
                permissions: [
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.ACCESS_API_ADMIN,
                    PermissionEnum.MEDIA_UPLOAD,
                    PermissionEnum.ACCOMMODATION_UPDATE_OWN
                ]
            });

            // Act
            const req = new Request(ADMIN_UPLOAD_URL, {
                method: 'POST',
                headers: buildAuthHeaders(actor),
                body: buildAdminMultipartBody()
            });
            const res = await app.request(req);
            const body = (await res.json()) as {
                success: boolean;
                error?: { code: string };
            };

            // Assert
            expect(res.status).toBe(403);
            expect(body.error?.code).toBe('FORBIDDEN');
            expect(mockUpload).not.toHaveBeenCalled();
        });
    });

    // ── GAP-078-093: Cloudinary not configured ─────────────────────────────
    describe('GAP-078-093 — Cloudinary not configured', () => {
        it('returns 503 CLOUDINARY_NOT_CONFIGURED when getMediaProvider() returns null', async () => {
            // Arrange: simulate a deployment where Cloudinary env vars are
            // unset. The service factory returns null; the route must refuse
            // the upload without calling any provider method.
            providerState.configured = false;

            const actor = createUploadReadyActor();

            // Act
            const req = new Request(ADMIN_UPLOAD_URL, {
                method: 'POST',
                headers: buildAuthHeaders(actor),
                body: buildAdminMultipartBody()
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
});
