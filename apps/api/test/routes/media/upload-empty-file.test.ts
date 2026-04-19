/**
 * Tests for SPEC-078-GAPS T-032 / GAP-078-148.
 *
 * Verifies both upload routes (admin entity upload + protected avatar
 * upload) reject zero-byte file payloads with HTTP 422 and the dedicated
 * `EMPTY_FILE` error code BEFORE any provider call is attempted.
 *
 * @module test/routes/media/upload-empty-file
 */
import { PermissionEnum } from '@repo/schemas';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    createAuthenticatedRequest,
    createMockAdminActor,
    createMockUserActor
} from '../../helpers/auth';

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
const ADMIN_ACTOR_ID = '00000000-0000-4000-8000-000000000099';

const buildAuthHeaders = (
    actor: ReturnType<typeof createMockAdminActor> | ReturnType<typeof createMockUserActor>
): Record<string, string> => {
    const { headers } = createAuthenticatedRequest(actor);
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
        // Strip Content-Type so FormData can set the multipart boundary itself.
        if (k.toLowerCase() === 'content-type') continue;
        out[k] = v;
    }
    return out;
};

const buildAdminMultipartBody = (file: File): FormData => {
    const fd = new FormData();
    fd.append('entityType', 'accommodation');
    fd.append('entityId', ADMIN_ENTITY_ID);
    fd.append('role', 'featured');
    fd.append('file', file);
    return fd;
};

const buildProtectedMultipartBody = (file: File): FormData => {
    const fd = new FormData();
    fd.append('file', file);
    return fd;
};

const createUploadReadyAdminActor = () =>
    createMockAdminActor({
        id: ADMIN_ACTOR_ID,
        permissions: [
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.ACCESS_API_ADMIN,
            PermissionEnum.MEDIA_UPLOAD,
            PermissionEnum.ACCOMMODATION_UPDATE_ANY
        ]
    });

describe('Media upload — empty file rejection (SPEC-078-GAPS T-032 / GAP-078-148)', () => {
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
        mockUpload.mockReset();
    });

    it('admin upload rejects a zero-byte file with HTTP 422 EMPTY_FILE', async () => {
        // Arrange
        const actor = createUploadReadyAdminActor();
        const emptyFile = new File([new Uint8Array(0)], 'empty.png', { type: 'image/png' });
        const req = new Request('http://localhost/api/v1/admin/media/upload', {
            method: 'POST',
            headers: buildAuthHeaders(actor),
            body: buildAdminMultipartBody(emptyFile)
        });

        // Act
        const res = await app.request(req);
        const body = (await res.json()) as { success: boolean; error?: { code: string } };

        // Assert
        expect(res.status).toBe(422);
        expect(body.success).toBe(false);
        expect(body.error?.code).toBe('EMPTY_FILE');
        // Crucially the provider is never called for a zero-byte upload.
        expect(mockUpload).not.toHaveBeenCalled();
    });

    it('protected avatar upload rejects a zero-byte file with HTTP 422 EMPTY_FILE', async () => {
        // Arrange
        const actor = createMockUserActor({
            id: '00000000-0000-4000-8000-0000000000bb'
        });
        const emptyFile = new File([new Uint8Array(0)], 'empty.jpg', { type: 'image/jpeg' });
        const req = new Request('http://localhost/api/v1/protected/media/upload', {
            method: 'POST',
            headers: buildAuthHeaders(actor),
            body: buildProtectedMultipartBody(emptyFile)
        });

        // Act
        const res = await app.request(req);
        const body = (await res.json()) as { success: boolean; error?: { code: string } };

        // Assert
        expect(res.status).toBe(422);
        expect(body.success).toBe(false);
        expect(body.error?.code).toBe('EMPTY_FILE');
        expect(mockUpload).not.toHaveBeenCalled();
    });
});
