/**
 * @file protected-delete-entity.test.ts
 * @description Integration tests for DELETE /api/v1/protected/media/delete-entity (SPEC-208 Fix A).
 *
 * Scenarios covered:
 *   - Happy path: owner deletes their entity's asset → 200 { deleted, publicId, wasPresent }
 *   - 403: publicId belongs to entity owned by a DIFFERENT user
 *   - 404: entity does not exist
 *   - 400: publicId does not start with "hospeda/"
 *   - 400: publicId targets an unsupported entity type (e.g. avatars path)
 *   - 422: publicId contains a path traversal segment (`..`)
 *   - 503: media provider not configured
 *   - 401: unauthenticated request
 *   - Admin bypass: actor with ACCOMMODATION_UPDATE_ANY can delete another user's entity
 *
 * The ownership check implementation under test:
 *   entity.ownerId !== actor.id  →  403 FORBIDDEN
 *   entity.ownerId === actor.id  →  proceeds to Cloudinary delete
 */

import { PermissionEnum } from '@repo/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    createAuthenticatedRequest,
    createMockAdminActor,
    createMockUserActor
} from '../../helpers/auth';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockDelete, providerState } = vi.hoisted(() => ({
    mockDelete: vi.fn(),
    providerState: { configured: true as boolean }
}));

vi.mock('../../../src/services/media', () => ({
    getMediaProvider: () =>
        providerState.configured ? { upload: vi.fn(), delete: mockDelete } : null
}));

import {
    AccommodationService,
    DestinationService,
    EventService,
    PostService
} from '@repo/service-core';

import { initApp } from '../../../src/app';
import type { AppOpenAPI } from '../../../src/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const OWNER_ID = '00000000-0000-4000-8000-000000000099';
const OTHER_USER_ID = '00000000-0000-4000-8000-0000000000bb';
const ENTITY_ID = '00000000-0000-4000-8000-0000000000aa';

/** A valid publicId that encodes ENTITY_ID owned by OWNER_ID. */
const VALID_PUBLIC_ID = `hospeda/test/accommodations/${ENTITY_ID}/featured`;

const DELETE_URL = (publicId: string) =>
    `/api/v1/protected/media/delete-entity?publicId=${encodeURIComponent(publicId)}`;

const buildOwnerActor = () =>
    createMockUserActor({
        id: OWNER_ID,
        permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
    });

const buildOtherActor = () =>
    createMockUserActor({
        id: OTHER_USER_ID,
        permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
    });

const buildAdminActor = () =>
    createMockAdminActor({
        id: 'ffffffff-0000-4000-8000-000000000000',
        permissions: [
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.ACCESS_API_ADMIN,
            PermissionEnum.MEDIA_DELETE,
            PermissionEnum.ACCOMMODATION_UPDATE_ANY
        ]
    });

const authHeaders = (actor: ReturnType<typeof createMockUserActor>): Record<string, string> => {
    const { headers } = createAuthenticatedRequest(actor);
    return headers as Record<string, string>;
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('DELETE /api/v1/protected/media/delete-entity — integration (SPEC-208 Fix A)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();

        // Default entity stub: owned by OWNER_ID
        const ownerEntity = {
            id: ENTITY_ID,
            ownerId: OWNER_ID,
            name: 'Test Accommodation'
        };

        vi.spyOn(AccommodationService.prototype, 'getById').mockResolvedValue({
            data: ownerEntity,
            error: null
        } as never);
        vi.spyOn(DestinationService.prototype, 'getById').mockResolvedValue({
            data: ownerEntity,
            error: null
        } as never);
        vi.spyOn(EventService.prototype, 'getById').mockResolvedValue({
            data: ownerEntity,
            error: null
        } as never);
        vi.spyOn(PostService.prototype, 'getById').mockResolvedValue({
            data: ownerEntity,
            error: null
        } as never);
    });

    afterAll(() => {
        vi.restoreAllMocks();
    });

    beforeEach(() => {
        mockDelete.mockReset();
        mockDelete.mockResolvedValue({ wasPresent: true });
        providerState.configured = true;
    });

    // ── Happy path ────────────────────────────────────────────────────────────

    it('returns 200 with deleted=true when owner deletes their entity asset', async () => {
        const actor = buildOwnerActor();
        const res = await app.request(DELETE_URL(VALID_PUBLIC_ID), {
            method: 'DELETE',
            headers: authHeaders(actor)
        });

        expect(res.status).toBe(200);
        const body = (await res.json()) as { success: boolean; data: Record<string, unknown> };
        expect(body.success).toBe(true);
        expect(body.data.deleted).toBe(true);
        expect(body.data.publicId).toBe(VALID_PUBLIC_ID);
        expect(body.data.wasPresent).toBe(true);
        expect(mockDelete).toHaveBeenCalledWith({ publicId: VALID_PUBLIC_ID });
    });

    it('returns wasPresent=false when asset was already absent (idempotent)', async () => {
        mockDelete.mockResolvedValueOnce({ wasPresent: false });
        const actor = buildOwnerActor();
        const res = await app.request(DELETE_URL(VALID_PUBLIC_ID), {
            method: 'DELETE',
            headers: authHeaders(actor)
        });

        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: { wasPresent: boolean } };
        expect(body.data.wasPresent).toBe(false);
    });

    // ── CRITICAL AUTHZ: 403 on foreign publicId ──────────────────────────────

    it('returns 403 FORBIDDEN when actor does not own the entity (foreign publicId)', async () => {
        // OTHER_USER_ID tries to delete an asset belonging to OWNER_ID
        const actor = buildOtherActor();
        const res = await app.request(DELETE_URL(VALID_PUBLIC_ID), {
            method: 'DELETE',
            headers: authHeaders(actor)
        });

        // The entity stub returns ownerId = OWNER_ID; actor.id = OTHER_USER_ID → 403
        expect(res.status).toBe(403);
        const body = (await res.json()) as { error: { code: string } };
        expect(body.error.code).toBe('FORBIDDEN');
        expect(mockDelete).not.toHaveBeenCalled();
    });

    // ── Admin bypass ──────────────────────────────────────────────────────────

    it("allows actor with ACCOMMODATION_UPDATE_ANY to delete another user's entity asset", async () => {
        const actor = buildAdminActor();
        const res = await app.request(DELETE_URL(VALID_PUBLIC_ID), {
            method: 'DELETE',
            headers: authHeaders(actor)
        });

        expect(res.status).toBe(200);
        const body = (await res.json()) as { success: boolean };
        expect(body.success).toBe(true);
        expect(mockDelete).toHaveBeenCalledOnce();
    });

    // ── Entity not found ──────────────────────────────────────────────────────

    it('returns 404 when entity does not exist', async () => {
        vi.spyOn(AccommodationService.prototype, 'getById').mockResolvedValueOnce({
            data: null,
            error: { code: 'NOT_FOUND', message: 'Not found' }
        } as never);

        const actor = buildOwnerActor();
        const res = await app.request(DELETE_URL(VALID_PUBLIC_ID), {
            method: 'DELETE',
            headers: authHeaders(actor)
        });

        expect(res.status).toBe(404);
        const body = (await res.json()) as { error: { code: string } };
        expect(body.error.code).toBe('ENTITY_NOT_FOUND');
    });

    // ── Validation guards ─────────────────────────────────────────────────────

    it('returns 400 when publicId does not start with "hospeda/"', async () => {
        const actor = buildOwnerActor();
        const res = await app.request(DELETE_URL('other/namespace/image'), {
            method: 'DELETE',
            headers: authHeaders(actor)
        });

        expect(res.status).toBe(400);
        const body = (await res.json()) as { error: { code: string } };
        expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when publicId targets a non-entity path (e.g. avatars)', async () => {
        const actor = buildOwnerActor();
        const avatarsPublicId = `hospeda/test/avatars/${ENTITY_ID}/avatar`;
        const res = await app.request(DELETE_URL(avatarsPublicId), {
            method: 'DELETE',
            headers: authHeaders(actor)
        });

        // Avatars path does not match the entity regex → VALIDATION_ERROR
        expect(res.status).toBe(400);
    });

    it('returns 422 when publicId contains a path traversal segment (..)', async () => {
        const actor = buildOwnerActor();
        const traversalId = `hospeda/test/../prod/accommodations/${ENTITY_ID}/featured`;
        const res = await app.request(DELETE_URL(traversalId), {
            method: 'DELETE',
            headers: authHeaders(actor)
        });

        expect(res.status).toBe(422);
        const body = (await res.json()) as { error: { code: string } };
        expect(body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    // ── Infrastructure guards ─────────────────────────────────────────────────

    it('returns 503 when media provider is not configured', async () => {
        providerState.configured = false;
        const actor = buildOwnerActor();
        const res = await app.request(DELETE_URL(VALID_PUBLIC_ID), {
            method: 'DELETE',
            headers: authHeaders(actor)
        });

        expect(res.status).toBe(503);
        const body = (await res.json()) as { error: { code: string } };
        expect(body.error.code).toBe('CLOUDINARY_NOT_CONFIGURED');
    });

    it('returns 401 for unauthenticated requests', async () => {
        // Include User-Agent so the global validation middleware lets the request
        // through to the auth layer (validation requires User-Agent for all routes).
        const res = await app.request(DELETE_URL(VALID_PUBLIC_ID), {
            method: 'DELETE',
            headers: { 'user-agent': 'vitest' }
        });

        expect(res.status).toBe(401);
    });
});
