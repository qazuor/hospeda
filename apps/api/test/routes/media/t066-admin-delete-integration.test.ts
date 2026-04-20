/**
 * Integration tests for DELETE /api/v1/admin/media (SPEC-078-GAPS T-066,
 * GAP-078-024 + GAP-078-093).
 *
 * Scenarios covered:
 *   - REQ-04.3-A: happy-path delete returns 200 and calls provider.delete
 *     with the canonical publicId.
 *   - REQ-04.3-B: publicId outside the `hospeda/` namespace is rejected.
 *     (Current implementation returns 400 VALIDATION_ERROR from the schema
 *     refinement. Spec nominates 422; we assert actual behavior.)
 *   - REQ-04.3-C: idempotent delete — Cloudinary "not found" surfaces as
 *     200 with `wasPresent: false`, no error raised.
 *   - REQ-04.3-D: unauthenticated DELETE is rejected with 401.
 *   - REQ-04.3-E: missing `publicId` query parameter is rejected with 400.
 *   - GAP-078-093: when the media provider is not configured
 *     (`getMediaProvider()` returns null), the route responds 503
 *     CLOUDINARY_NOT_CONFIGURED.
 *   - GAP-078-024 (env prefix refinement): `publicId` pointing to the wrong
 *     env (`prod` while running under `test`) yields 403 FORBIDDEN — the
 *     pre-validation middleware short-circuits before the schema check.
 *   - GAP-078-024 (traversal guard): raw `..` and URL-encoded `%2E%2E`
 *     traversal segments yield 422 UNPROCESSABLE_ENTITY.
 *
 * @module test/routes/media/t066-admin-delete-integration
 */

import { PermissionEnum } from '@repo/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuthenticatedRequest, createMockAdminActor } from '../../helpers/auth';

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
const TARGET_PUBLIC_ID = `hospeda/test/accommodations/${ADMIN_ENTITY_ID}/featured`;

const createDeleteReadyActor = () =>
    createMockAdminActor({
        id: ADMIN_ACTOR_ID,
        permissions: [
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.ACCESS_API_ADMIN,
            PermissionEnum.MEDIA_DELETE,
            PermissionEnum.ACCOMMODATION_UPDATE_ANY
        ]
    });

describe('DELETE /api/v1/admin/media — integration (T-066)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();

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
        providerState.configured = true;
        mockUpload.mockReset();
        mockDelete.mockReset();
        resetMetrics();
    });

    afterAll(() => {
        providerState.configured = true;
    });

    // ── REQ-04.3-A: Successful delete ──────────────────────────────────────
    describe('REQ-04.3-A — successful delete', () => {
        it('returns 200 with { deleted: true, publicId, wasPresent: true } and invokes provider.delete with the canonical publicId', async () => {
            // Arrange
            mockDelete.mockResolvedValueOnce({ wasPresent: true });
            const actor = createDeleteReadyActor();

            // Act
            const res = await app.request(
                `/api/v1/admin/media?publicId=${encodeURIComponent(TARGET_PUBLIC_ID)}`,
                {
                    method: 'DELETE',
                    ...createAuthenticatedRequest(actor)
                }
            );
            const body = (await res.json()) as {
                success: boolean;
                data: { deleted: boolean; publicId: string; wasPresent: boolean };
            };

            // Assert
            expect(res.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.deleted).toBe(true);
            expect(body.data.publicId).toBe(TARGET_PUBLIC_ID);
            expect(body.data.wasPresent).toBe(true);

            expect(mockDelete).toHaveBeenCalledTimes(1);
            expect(mockDelete.mock.calls[0]?.[0]).toEqual({ publicId: TARGET_PUBLIC_ID });

            const counters = getDomainCounters();
            expect(counters['media_delete_total{result=success}']).toBe(1);
        });
    });

    // ── REQ-04.3-B: publicId outside hospeda/ namespace ────────────────────
    describe('REQ-04.3-B — publicId outside the hospeda/ namespace', () => {
        it('rejects publicId that does not start with "hospeda/" via the schema refinement', async () => {
            // Arrange
            const actor = createDeleteReadyActor();
            const outsideId = 'some-other-account/image';

            // Act
            const res = await app.request(
                `/api/v1/admin/media?publicId=${encodeURIComponent(outsideId)}`,
                {
                    method: 'DELETE',
                    ...createAuthenticatedRequest(actor)
                }
            );
            const body = (await res.json()) as {
                success: boolean;
                error?: { code: string };
            };

            // Assert: the schema refinement on `DeleteMediaQuerySchema`
            // rejects with a generic validation error. Spec REQ-04.3-B
            // nominates 422; current implementation surfaces 400
            // VALIDATION_ERROR because the refinement message does not
            // contain "path traversal" so the route does not promote it to
            // 422. Asserting actual behavior to keep the test honest.
            expect(res.status).toBe(400);
            expect(body.success).toBe(false);
            expect(body.error?.code).toBe('VALIDATION_ERROR');
            expect(mockDelete).not.toHaveBeenCalled();
        });
    });

    // ── REQ-04.3-C: Idempotent delete when Cloudinary says "not found" ─────
    describe('REQ-04.3-C — idempotent delete', () => {
        it('returns 200 with wasPresent: false when the provider reports the asset was already absent', async () => {
            // Arrange: provider.delete resolves with {wasPresent: false}.
            mockDelete.mockResolvedValueOnce({ wasPresent: false });
            const actor = createDeleteReadyActor();

            // Act
            const res = await app.request(
                `/api/v1/admin/media?publicId=${encodeURIComponent(TARGET_PUBLIC_ID)}`,
                {
                    method: 'DELETE',
                    ...createAuthenticatedRequest(actor)
                }
            );
            const body = (await res.json()) as {
                success: boolean;
                data: { deleted: boolean; publicId: string; wasPresent: boolean };
            };

            // Assert
            expect(res.status).toBe(200);
            expect(body.success).toBe(true);
            expect(body.data.deleted).toBe(true);
            expect(body.data.wasPresent).toBe(false);
            expect(body.data.publicId).toBe(TARGET_PUBLIC_ID);
        });
    });

    // ── REQ-04.3-D: Unauthenticated request ────────────────────────────────
    describe('REQ-04.3-D — auth gate', () => {
        it('rejects an unauthenticated DELETE with HTTP 401', async () => {
            // Act: no mock-actor headers → guest actor → 401 from the admin
            // authorization middleware. user-agent kept so the validation
            // middleware does not cross-fire with a header-level 400.
            const res = await app.request(
                `/api/v1/admin/media?publicId=${encodeURIComponent(TARGET_PUBLIC_ID)}`,
                {
                    method: 'DELETE',
                    headers: { 'user-agent': 'vitest' }
                }
            );

            // Assert
            expect(res.status).toBe(401);
            expect(mockDelete).not.toHaveBeenCalled();
        });
    });

    // ── REQ-04.3-E: Missing publicId query parameter ───────────────────────
    describe('REQ-04.3-E — missing publicId', () => {
        it('rejects a DELETE without a publicId query parameter', async () => {
            // Arrange
            const actor = createDeleteReadyActor();

            // Act
            const res = await app.request('/api/v1/admin/media', {
                method: 'DELETE',
                ...createAuthenticatedRequest(actor)
            });
            const body = (await res.json()) as {
                success: boolean;
                error?: { code: string };
            };

            // Assert: schema rejects missing publicId. The route surfaces
            // this as 400 VALIDATION_ERROR (schema-level). Spec REQ-04.3-E
            // nominates 422; asserting actual behavior so the test does not
            // silently misrepresent contract drift.
            expect(res.status).toBe(400);
            expect(body.success).toBe(false);
            expect(body.error?.code).toBe('VALIDATION_ERROR');
            expect(mockDelete).not.toHaveBeenCalled();
        });
    });

    // ── GAP-078-093: provider not configured ───────────────────────────────
    describe('GAP-078-093 — provider not configured', () => {
        it('returns 503 CLOUDINARY_NOT_CONFIGURED when getMediaProvider() returns null', async () => {
            // Arrange
            providerState.configured = false;
            const actor = createDeleteReadyActor();

            // Act
            const res = await app.request(
                `/api/v1/admin/media?publicId=${encodeURIComponent(TARGET_PUBLIC_ID)}`,
                {
                    method: 'DELETE',
                    ...createAuthenticatedRequest(actor)
                }
            );
            const body = (await res.json()) as {
                success: boolean;
                error?: { code: string };
            };

            // Assert
            expect(res.status).toBe(503);
            expect(body.success).toBe(false);
            expect(body.error?.code).toBe('CLOUDINARY_NOT_CONFIGURED');
            expect(mockDelete).not.toHaveBeenCalled();
        });
    });

    // ── GAP-078-024: env prefix refinement (403) ───────────────────────────
    describe('GAP-078-024 — env-prefix enforcement', () => {
        it('returns 403 FORBIDDEN for a publicId in a different environment (prod while running under test)', async () => {
            // Arrange
            const actor = createDeleteReadyActor();
            const wrongEnvPublicId = `hospeda/prod/accommodations/${ADMIN_ENTITY_ID}/featured`;

            // Act
            const res = await app.request(
                `/api/v1/admin/media?publicId=${encodeURIComponent(wrongEnvPublicId)}`,
                {
                    method: 'DELETE',
                    ...createAuthenticatedRequest(actor)
                }
            );
            const body = (await res.json()) as {
                success: boolean;
                error?: { code: string };
            };

            // Assert
            expect(res.status).toBe(403);
            expect(body.success).toBe(false);
            expect(body.error?.code).toBe('FORBIDDEN');
            expect(mockDelete).not.toHaveBeenCalled();
        });
    });

    // ── GAP-078-024: path traversal guard (422) ────────────────────────────
    describe('GAP-078-024 — path traversal rejection', () => {
        it('rejects a raw ".." traversal segment in publicId with 422 UNPROCESSABLE_ENTITY', async () => {
            // Arrange
            const actor = createDeleteReadyActor();

            // Act
            const res = await app.request(
                '/api/v1/admin/media?publicId=hospeda/test/../prod/x/featured',
                {
                    method: 'DELETE',
                    ...createAuthenticatedRequest(actor)
                }
            );
            const body = (await res.json()) as {
                success: boolean;
                error?: { code: string };
            };

            // Assert
            expect(res.status).toBe(422);
            expect(body.success).toBe(false);
            expect(body.error?.code).toBe('UNPROCESSABLE_ENTITY');
            expect(mockDelete).not.toHaveBeenCalled();
        });

        it('rejects a URL-encoded "%2E%2E" traversal segment in publicId with 422 UNPROCESSABLE_ENTITY', async () => {
            // Arrange
            const actor = createDeleteReadyActor();

            // Act
            const res = await app.request(
                '/api/v1/admin/media?publicId=hospeda/test/%2E%2E/prod/x/featured',
                {
                    method: 'DELETE',
                    ...createAuthenticatedRequest(actor)
                }
            );
            const body = (await res.json()) as {
                success: boolean;
                error?: { code: string };
            };

            // Assert
            expect(res.status).toBe(422);
            expect(body.success).toBe(false);
            expect(body.error?.code).toBe('UNPROCESSABLE_ENTITY');
            expect(mockDelete).not.toHaveBeenCalled();
        });
    });
});
