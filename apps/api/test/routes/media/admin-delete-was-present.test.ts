/**
 * Tests for SPEC-078-GAPS T-030 / GAP-078-154.
 *
 * Verifies the admin DELETE /media route surfaces the provider's
 * `wasPresent` boolean signal in the response body, so callers can
 * distinguish "deleted just now" from "asset was already absent".
 *
 * Both outcomes resolve normally — the operation is idempotent at the
 * provider level. Only thrown upstream errors map to 502.
 *
 * @module test/routes/media/admin-delete-was-present
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

const TARGET_PUBLIC_ID = `hospeda/test/accommodations/${ADMIN_ENTITY_ID}/featured`;

const createDeleteReadyActor = () =>
    createMockAdminActor({
        id: '00000000-0000-4000-8000-000000000099',
        permissions: [
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.ACCESS_API_ADMIN,
            PermissionEnum.MEDIA_DELETE,
            PermissionEnum.ACCOMMODATION_UPDATE_ANY
        ]
    });

describe('Admin media delete — wasPresent (SPEC-078-GAPS T-030 / GAP-078-154)', () => {
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
        mockDelete.mockReset();
    });

    it('returns wasPresent: true when the provider reports the asset was deleted', async () => {
        mockDelete.mockResolvedValueOnce({ wasPresent: true });

        const actor = createDeleteReadyActor();
        const res = await app.request(
            `/api/v1/admin/media?publicId=${encodeURIComponent(TARGET_PUBLIC_ID)}`,
            {
                method: 'DELETE',
                ...createAuthenticatedRequest(actor)
            }
        );

        expect(res.status).toBe(200);
        const payload = (await res.json()) as {
            success: boolean;
            data: { deleted: true; publicId: string; wasPresent: boolean };
            metadata: { timestamp: string };
        };
        expect(payload.success).toBe(true);
        expect(payload.data.deleted).toBe(true);
        expect(payload.data.publicId).toBe(TARGET_PUBLIC_ID);
        expect(payload.data.wasPresent).toBe(true);
        expect(typeof payload.metadata.timestamp).toBe('string');
    });

    it('returns wasPresent: false when the provider reports the asset was already absent', async () => {
        mockDelete.mockResolvedValueOnce({ wasPresent: false });

        const actor = createDeleteReadyActor();
        const res = await app.request(
            `/api/v1/admin/media?publicId=${encodeURIComponent(TARGET_PUBLIC_ID)}`,
            {
                method: 'DELETE',
                ...createAuthenticatedRequest(actor)
            }
        );

        expect(res.status).toBe(200);
        const payload = (await res.json()) as {
            success: boolean;
            data: { deleted: true; publicId: string; wasPresent: boolean };
        };
        expect(payload.success).toBe(true);
        expect(payload.data.wasPresent).toBe(false);
    });

    it('returns 502 UPSTREAM_ERROR when the provider throws', async () => {
        mockDelete.mockRejectedValueOnce(new Error('socket hang up'));

        const actor = createDeleteReadyActor();
        const res = await app.request(
            `/api/v1/admin/media?publicId=${encodeURIComponent(TARGET_PUBLIC_ID)}`,
            {
                method: 'DELETE',
                ...createAuthenticatedRequest(actor)
            }
        );

        expect(res.status).toBe(502);
        const payload = (await res.json()) as {
            success: boolean;
            error: { code: string };
        };
        expect(payload.success).toBe(false);
        expect(payload.error.code).toBe('UPSTREAM_ERROR');
    });
});
