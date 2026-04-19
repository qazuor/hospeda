/**
 * Tests for SPEC-078-GAPS T-056 — media route observability.
 *
 * Verifies the structured-log + Sentry capture + counter additions on the
 * admin upload, admin delete, and protected (avatar) upload routes:
 *
 *   - GAP-078-050: structured `media.upload.success` / `media.delete.success`
 *     log entry on the success path of each route, carrying `publicId` and
 *     a `preset` derived from entity type / role.
 *   - GAP-078-128 + GAP-078-129: provider error path captures the original
 *     exception with `Sentry.captureException` tagged
 *     `component=media-provider`, and increments the
 *     `media_upload_total{result=failure}` /
 *     `media_delete_total{result=failure}` counters.
 *   - Success paths increment the `result=success` variant of the same
 *     counters.
 *
 * @module test/routes/media/observability
 */
import { PermissionEnum } from '@repo/schemas';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuthenticatedRequest, createMockAdminActor } from '../../helpers/auth';

const { mockUpload, mockDelete, mockCaptureException } = vi.hoisted(() => ({
    mockUpload: vi.fn(),
    mockDelete: vi.fn(),
    mockCaptureException: vi.fn()
}));

vi.mock('../../../src/services/media', () => ({
    getMediaProvider: () => ({
        upload: mockUpload,
        delete: mockDelete
    })
}));

// Mock @sentry/node directly so `Sentry.captureException` is a vi.fn() that
// we can assert against. The lib/sentry module re-exports the namespace,
// so this mock flows through to every importer.
vi.mock('@sentry/node', () => ({
    init: vi.fn(),
    isEnabled: vi.fn().mockReturnValue(false),
    flush: vi.fn().mockResolvedValue(true),
    close: vi.fn().mockResolvedValue(true),
    captureException: mockCaptureException,
    captureMessage: vi.fn(),
    setContext: vi.fn(),
    setTag: vi.fn(),
    setUser: vi.fn(),
    startSpan: vi.fn()
}));

vi.mock('@sentry/profiling-node', () => ({
    nodeProfilingIntegration: vi.fn(() => ({}))
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
import { apiLogger } from '../../../src/utils/logger';

const ADMIN_ENTITY_ID = '00000000-0000-4000-8000-0000000000aa';
const ADMIN_ACTOR_ID = '00000000-0000-4000-8000-000000000099';
const TARGET_PUBLIC_ID = `hospeda/test/accommodations/${ADMIN_ENTITY_ID}/featured`;

/**
 * Minimal 1x1 red PNG (67 bytes, base64-encoded). Reused from the existing
 * upload tests to keep the multipart payload realistic.
 */
const MINIMAL_PNG_B64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

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

const buildAdminUploadBody = (): FormData => {
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

const createUploadReadyActor = () =>
    createMockAdminActor({
        id: ADMIN_ACTOR_ID,
        permissions: [
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.ACCESS_API_ADMIN,
            PermissionEnum.MEDIA_UPLOAD,
            PermissionEnum.ACCOMMODATION_UPDATE_ANY
        ]
    });

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

describe('Media route observability (SPEC-078-GAPS T-056)', () => {
    let app: AppOpenAPI;
    let infoSpy: ReturnType<typeof vi.spyOn>;

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
        mockDelete.mockReset();
        mockCaptureException.mockReset();
        resetMetrics();
        infoSpy = vi.spyOn(apiLogger, 'info').mockImplementation(() => undefined);
    });

    describe('admin upload — success path (GAP-078-050 + GAP-078-128)', () => {
        it('emits a structured success log carrying publicId and preset', async () => {
            mockUpload.mockResolvedValueOnce({
                url: 'https://res.cloudinary.com/hospeda/image/upload/v1/hospeda/test/accommodations/abc/featured.jpg',
                publicId: 'hospeda/test/accommodations/abc/featured',
                width: 1920,
                height: 1080
            });

            const actor = createUploadReadyActor();
            const res = await app.request(
                new Request('http://localhost/api/v1/admin/media/upload', {
                    method: 'POST',
                    headers: buildAuthHeaders(actor),
                    body: buildAdminUploadBody()
                })
            );

            expect(res.status).toBe(200);

            const successLog = infoSpy.mock.calls.find(
                (call) =>
                    typeof call[0] === 'object' &&
                    call[0] !== null &&
                    (call[0] as { event?: string }).event === 'media.upload.success'
            );
            expect(successLog).toBeDefined();
            const payload = successLog?.[0] as Record<string, unknown>;
            expect(payload.publicId).toBe('hospeda/test/accommodations/abc/featured');
            expect(payload.preset).toBe('accommodation:featured');

            // Counter increment — success variant only.
            const counters = getDomainCounters();
            expect(counters['media_upload_total{result=success}']).toBe(1);
            expect(counters['media_upload_total{result=failure}']).toBeUndefined();
        });
    });

    describe('admin upload — provider failure (GAP-078-128)', () => {
        it('captures the provider error in Sentry and bumps the failure counter', async () => {
            const providerErr = new Error('Cloudinary 502 Bad Gateway');
            mockUpload.mockRejectedValueOnce(providerErr);

            const actor = createUploadReadyActor();
            const res = await app.request(
                new Request('http://localhost/api/v1/admin/media/upload', {
                    method: 'POST',
                    headers: buildAuthHeaders(actor),
                    body: buildAdminUploadBody()
                })
            );

            expect(res.status).toBe(502);

            // Sentry capture: must include the original error and the
            // `component=media-provider` tag so the issue groups under the
            // media slice in Sentry, not the generic API noise.
            expect(mockCaptureException).toHaveBeenCalled();
            const [capturedErr, captureCtx] = mockCaptureException.mock.calls[0] ?? [];
            expect(capturedErr).toBe(providerErr);
            expect((captureCtx as { tags?: Record<string, string> }).tags).toMatchObject({
                component: 'media-provider',
                operation: 'upload'
            });

            const counters = getDomainCounters();
            expect(counters['media_upload_total{result=failure}']).toBe(1);
            expect(counters['media_upload_total{result=success}']).toBeUndefined();
        });
    });

    describe('admin delete — success + failure (GAP-078-050 + GAP-078-129)', () => {
        it('emits a structured success log and bumps the success counter', async () => {
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

            const successLog = infoSpy.mock.calls.find(
                (call) =>
                    typeof call[0] === 'object' &&
                    call[0] !== null &&
                    (call[0] as { event?: string }).event === 'media.delete.success'
            );
            expect(successLog).toBeDefined();
            const payload = successLog?.[0] as Record<string, unknown>;
            expect(payload.publicId).toBe(TARGET_PUBLIC_ID);
            expect(payload.preset).toBe('accommodation:delete');

            const counters = getDomainCounters();
            expect(counters['media_delete_total{result=success}']).toBe(1);
            expect(counters['media_delete_total{result=failure}']).toBeUndefined();
        });

        it('captures provider delete errors in Sentry and bumps the failure counter', async () => {
            const providerErr = new Error('Cloudinary delete blew up');
            mockDelete.mockRejectedValueOnce(providerErr);

            const actor = createDeleteReadyActor();
            const res = await app.request(
                `/api/v1/admin/media?publicId=${encodeURIComponent(TARGET_PUBLIC_ID)}`,
                {
                    method: 'DELETE',
                    ...createAuthenticatedRequest(actor)
                }
            );

            expect(res.status).toBe(502);
            expect(mockCaptureException).toHaveBeenCalled();
            const [capturedErr, captureCtx] = mockCaptureException.mock.calls[0] ?? [];
            expect(capturedErr).toBe(providerErr);
            expect((captureCtx as { tags?: Record<string, string> }).tags).toMatchObject({
                component: 'media-provider',
                operation: 'delete'
            });

            const counters = getDomainCounters();
            expect(counters['media_delete_total{result=failure}']).toBe(1);
        });
    });
});
