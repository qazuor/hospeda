/**
 * Tests for admin stock media import endpoint (SPEC-274 T-274-05).
 *
 * Covers:
 * - Route-level permission gate (requires MEDIA_UPLOAD)
 * - Entity permission validation (defense in depth)
 * - Gallery cap enforcement
 * - Cloudinary provider integration
 * - Attribution persistence in response
 *
 * @module test/routes/media/admin/import-stock
 */
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { initApp } from '../../../../src/app';
import { resetMetrics } from '../../../../src/middlewares/metrics';
import type { AppOpenAPI } from '../../../../src/types';
import { createAuthenticatedRequest, createMockAdminActor } from '../../../helpers/auth';

// ---------------------------------------------------------------------------
// Env mock — must be declared before any app import
// ---------------------------------------------------------------------------

vi.mock('../../../../src/utils/env', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../../src/utils/env')>();
    return {
        ...actual,
        env: {
            ...actual.env,
            HOSPEDA_UNSPLASH_ACCESS_KEY: 'test-unsplash-key',
            HOSPEDA_PEXELS_API_KEY: 'test-pexels-key'
        }
    };
});

// ---------------------------------------------------------------------------
// Provider and service mocks
// ---------------------------------------------------------------------------
// Provider and service mocks
// ---------------------------------------------------------------------------

const mockUpload = vi.fn();
const mockImport = vi.fn();
const mockGetById = vi.fn();

const providerState = vi.hoisted(() => ({ configured: true as boolean }));

vi.mock('../../../../src/services/media', () => ({
    getMediaProvider: () =>
        providerState.configured ? { upload: mockUpload, delete: vi.fn() } : null
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        ImageImportService: vi.fn().mockImplementation(() => ({
            import: mockImport
        })),
        AccommodationService: vi.fn().mockImplementation(() => ({
            getById: mockGetById
        })),
        DestinationService: vi.fn().mockImplementation(() => ({
            getById: mockGetById
        })),
        EventService: vi.fn().mockImplementation(() => ({
            getById: mockGetById
        })),
        PostService: vi.fn().mockImplementation(() => ({
            getById: mockGetById
        }))
    };
});

// SPEC-204: accommodation media count from relational table
const mockFindByAccommodation = vi.fn();
vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        accommodationMediaModel: {
            findByAccommodation: mockFindByAccommodation
        }
    };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeActor = (permissions: PermissionEnum[], id = crypto.randomUUID()): Actor => ({
    id,
    role: RoleEnum.ADMIN,
    permissions
});

const _buildAuthHeaders = (
    entityPermission: PermissionEnum = PermissionEnum.ACCOMMODATION_UPDATE_ANY
): Record<string, string> => {
    const actor = createMockAdminActor({
        id: '00000000-0000-4000-8000-000000000099',
        permissions: [
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.ACCESS_API_ADMIN,
            PermissionEnum.MEDIA_UPLOAD,
            entityPermission
        ]
    });
    const { headers } = createAuthenticatedRequest(actor);
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
        if (k.toLowerCase() === 'content-type') continue;
        out[k] = v;
    }
    return out;
};

const buildImportBody = (overrides: Record<string, unknown> = {}) => ({
    provider: 'unsplash',
    providerId: 'uns-1',
    fullUrl: 'https://images.unsplash.com/photo.jpg',
    downloadLocation: 'https://api.unsplash.com/photos/uns-1/download',
    photographer: 'Alice',
    photographerUrl: 'https://unsplash.com/@alice',
    entityType: 'accommodation',
    entityId: '00000000-0000-4000-8000-0000000000aa',
    role: 'gallery',
    ...overrides
});

const buildEntityStub = (galleryCount = 0) => ({
    data: {
        id: '00000000-0000-4000-8000-0000000000aa',
        ownerId: '00000000-0000-4000-8000-000000000099',
        media: {
            gallery: Array.from({ length: galleryCount }, (_, i) => ({
                url: `https://example.com/img${i}.jpg`,
                moderationState: 'APPROVED'
            }))
        }
    },
    error: undefined
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/v1/admin/media/import-stock — stock image import (SPEC-274)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    beforeEach(() => {
        providerState.configured = true;
        mockUpload.mockReset();
        mockImport.mockReset();
        mockGetById.mockReset();
        mockFindByAccommodation.mockReset();
        mockFindByAccommodation.mockResolvedValue({ items: [], total: 0 });
        resetMetrics();
    });

    afterAll(() => {
        vi.restoreAllMocks();
    });

    describe('route-level permission gate', () => {
        it('rejects actor without MEDIA_UPLOAD with 403', async () => {
            const actor = makeActor([
                PermissionEnum.ACCESS_PANEL_ADMIN,
                PermissionEnum.ACCESS_API_ADMIN
            ]);
            const res = await app.request('/api/v1/admin/media/import-stock', {
                method: 'POST',
                headers: {
                    ...createAuthenticatedRequest(actor).headers,
                    'content-type': 'application/json'
                },
                body: JSON.stringify(buildImportBody())
            });
            expect(res.status).toBe(403);
        });

        it('passes the route gate when MEDIA_UPLOAD is present', async () => {
            const actor = createMockAdminActor({
                permissions: [
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.ACCESS_API_ADMIN,
                    PermissionEnum.MEDIA_UPLOAD,
                    PermissionEnum.ACCOMMODATION_UPDATE_ANY
                ]
            });
            mockGetById.mockResolvedValue(buildEntityStub(0));
            mockImport.mockResolvedValue({
                url: 'https://res.cloudinary.com/hospeda/image/upload/sample.jpg',
                publicId: 'hospeda/accommodations/abc/gallery/xyz',
                width: 1200,
                height: 800,
                attribution: {
                    photographer: 'Alice',
                    sourceUrl: 'https://unsplash.com/@alice',
                    license: 'Unsplash License',
                    provider: 'unsplash'
                }
            });

            const res = await app.request('/api/v1/admin/media/import-stock', {
                method: 'POST',
                headers: {
                    ...createAuthenticatedRequest(actor).headers,
                    'content-type': 'application/json'
                },
                body: JSON.stringify(buildImportBody())
            });

            expect(res.status).not.toBe(403);
        });
    });

    describe('entity permission validation', () => {
        it('rejects actor without entity update permission', async () => {
            const actor = createMockAdminActor({
                permissions: [
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.ACCESS_API_ADMIN,
                    PermissionEnum.MEDIA_UPLOAD
                ]
            });
            mockGetById.mockResolvedValue(buildEntityStub(0));

            const res = await app.request('/api/v1/admin/media/import-stock', {
                method: 'POST',
                headers: {
                    ...createAuthenticatedRequest(actor).headers,
                    'content-type': 'application/json'
                },
                body: JSON.stringify(buildImportBody())
            });

            expect(res.status).toBe(403);
            const body = await res.json();
            expect(body.error.code).toBe('FORBIDDEN');
        });

        it('allows actor with ACCOMMODATION_UPDATE_ANY regardless of ownership', async () => {
            const actor = createMockAdminActor({
                id: 'actor-uuid',
                permissions: [
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.ACCESS_API_ADMIN,
                    PermissionEnum.MEDIA_UPLOAD,
                    PermissionEnum.ACCOMMODATION_UPDATE_ANY
                ]
            });
            mockGetById.mockResolvedValue({
                data: { ownerId: 'different-owner' },
                error: undefined
            });
            mockImport.mockResolvedValue({
                url: 'https://res.cloudinary.com/hospeda/image/upload/sample.jpg',
                publicId: 'hospeda/accommodations/abc/gallery/xyz',
                width: 1200,
                height: 800,
                attribution: {
                    photographer: 'Alice',
                    sourceUrl: 'https://unsplash.com/@alice',
                    license: 'Unsplash License',
                    provider: 'unsplash'
                }
            });

            const res = await app.request('/api/v1/admin/media/import-stock', {
                method: 'POST',
                headers: {
                    ...createAuthenticatedRequest(actor).headers,
                    'content-type': 'application/json'
                },
                body: JSON.stringify(buildImportBody())
            });

            expect(res.status).toBe(200);
        });
    });

    describe('gallery cap enforcement', () => {
        it('returns 422 when accommodation gallery is at cap', async () => {
            const actor = createMockAdminActor({
                permissions: [
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.ACCESS_API_ADMIN,
                    PermissionEnum.MEDIA_UPLOAD,
                    PermissionEnum.ACCOMMODATION_UPDATE_ANY
                ]
            });
            mockGetById.mockResolvedValue(buildEntityStub(50));
            mockFindByAccommodation.mockResolvedValue({ items: [], total: 50 });

            const res = await app.request('/api/v1/admin/media/import-stock', {
                method: 'POST',
                headers: {
                    ...createAuthenticatedRequest(actor).headers,
                    'content-type': 'application/json'
                },
                body: JSON.stringify(buildImportBody({ role: 'gallery' }))
            });

            expect(res.status).toBe(422);
            const body = await res.json();
            expect(body.error.code).toBe('GALLERY_LIMIT_EXCEEDED');
            expect(body.error.details.limit).toBe(50);
        });

        it('allows import when gallery has one slot remaining', async () => {
            const actor = createMockAdminActor({
                permissions: [
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.ACCESS_API_ADMIN,
                    PermissionEnum.MEDIA_UPLOAD,
                    PermissionEnum.ACCOMMODATION_UPDATE_ANY
                ]
            });
            mockGetById.mockResolvedValue(buildEntityStub(49));
            mockFindByAccommodation.mockResolvedValue({ items: [], total: 49 });
            mockImport.mockResolvedValue({
                url: 'https://res.cloudinary.com/hospeda/image/upload/sample.jpg',
                publicId: 'hospeda/accommodations/abc/gallery/xyz',
                width: 1200,
                height: 800,
                attribution: {
                    photographer: 'Alice',
                    sourceUrl: 'https://unsplash.com/@alice',
                    license: 'Unsplash License',
                    provider: 'unsplash'
                }
            });

            const res = await app.request('/api/v1/admin/media/import-stock', {
                method: 'POST',
                headers: {
                    ...createAuthenticatedRequest(actor).headers,
                    'content-type': 'application/json'
                },
                body: JSON.stringify(buildImportBody({ role: 'gallery' }))
            });

            expect(res.status).toBe(200);
        });

        it('bypasses gallery cap for featured role', async () => {
            const actor = createMockAdminActor({
                permissions: [
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.ACCESS_API_ADMIN,
                    PermissionEnum.MEDIA_UPLOAD,
                    PermissionEnum.ACCOMMODATION_UPDATE_ANY
                ]
            });
            mockGetById.mockResolvedValue(buildEntityStub(50));
            mockFindByAccommodation.mockResolvedValue({ items: [], total: 50 });
            mockImport.mockResolvedValue({
                url: 'https://res.cloudinary.com/hospeda/image/upload/sample.jpg',
                publicId: 'hospeda/accommodations/abc/featured',
                width: 1200,
                height: 800,
                attribution: {
                    photographer: 'Alice',
                    sourceUrl: 'https://unsplash.com/@alice',
                    license: 'Unsplash License',
                    provider: 'unsplash'
                }
            });

            const res = await app.request('/api/v1/admin/media/import-stock', {
                method: 'POST',
                headers: {
                    ...createAuthenticatedRequest(actor).headers,
                    'content-type': 'application/json'
                },
                body: JSON.stringify(buildImportBody({ role: 'featured' }))
            });

            expect(res.status).toBe(200);
        });
    });

    describe('import flow and attribution', () => {
        it('calls ImageImportService with correct parameters', async () => {
            const actor = createMockAdminActor({
                permissions: [
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.ACCESS_API_ADMIN,
                    PermissionEnum.MEDIA_UPLOAD,
                    PermissionEnum.ACCOMMODATION_UPDATE_ANY
                ]
            });
            mockGetById.mockResolvedValue(buildEntityStub(0));
            mockImport.mockResolvedValue({
                url: 'https://res.cloudinary.com/hospeda/image/upload/sample.jpg',
                publicId: 'hospeda/accommodations/abc/gallery/xyz',
                width: 1200,
                height: 800,
                attribution: {
                    photographer: 'Alice',
                    sourceUrl: 'https://unsplash.com/@alice',
                    license: 'Unsplash License',
                    provider: 'unsplash'
                }
            });

            const body = buildImportBody();
            const res = await app.request('/api/v1/admin/media/import-stock', {
                method: 'POST',
                headers: {
                    ...createAuthenticatedRequest(actor).headers,
                    'content-type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            expect(res.status).toBe(200);
            expect(mockImport).toHaveBeenCalledWith({
                provider: 'unsplash',
                providerId: 'uns-1',
                fullUrl: 'https://images.unsplash.com/photo.jpg',
                downloadLocation: 'https://api.unsplash.com/photos/uns-1/download',
                photographer: 'Alice',
                photographerUrl: 'https://unsplash.com/@alice',
                folder: 'hospeda/accommodations/00000000-0000-4000-8000-0000000000aa'
            });
        });

        it('returns attribution in response with moderationState APPROVED', async () => {
            const actor = createMockAdminActor({
                permissions: [
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.ACCESS_API_ADMIN,
                    PermissionEnum.MEDIA_UPLOAD,
                    PermissionEnum.ACCOMMODATION_UPDATE_ANY
                ]
            });
            mockGetById.mockResolvedValue(buildEntityStub(0));
            mockImport.mockResolvedValue({
                url: 'https://res.cloudinary.com/hospeda/image/upload/sample.jpg',
                publicId: 'hospeda/accommodations/abc/gallery/xyz',
                width: 1200,
                height: 800,
                attribution: {
                    photographer: 'Alice',
                    sourceUrl: 'https://unsplash.com/@alice',
                    license: 'Unsplash License',
                    provider: 'unsplash'
                }
            });

            const res = await app.request('/api/v1/admin/media/import-stock', {
                method: 'POST',
                headers: {
                    ...createAuthenticatedRequest(actor).headers,
                    'content-type': 'application/json'
                },
                body: JSON.stringify(buildImportBody())
            });

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.data).toMatchObject({
                url: 'https://res.cloudinary.com/hospeda/image/upload/sample.jpg',
                publicId: 'hospeda/accommodations/abc/gallery/xyz',
                width: 1200,
                height: 800,
                attribution: {
                    photographer: 'Alice',
                    sourceUrl: 'https://unsplash.com/@alice',
                    license: 'Unsplash License',
                    provider: 'unsplash'
                },
                moderationState: 'APPROVED'
            });
        });

        it('skips downloadLocation for Pexels imports', async () => {
            const actor = createMockAdminActor({
                permissions: [
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.ACCESS_API_ADMIN,
                    PermissionEnum.MEDIA_UPLOAD,
                    PermissionEnum.ACCOMMODATION_UPDATE_ANY
                ]
            });
            mockGetById.mockResolvedValue(buildEntityStub(0));
            mockImport.mockResolvedValue({
                url: 'https://res.cloudinary.com/hospeda/image/upload/sample.jpg',
                publicId: 'hospeda/accommodations/abc/gallery/xyz',
                width: 1200,
                height: 800,
                attribution: {
                    photographer: 'Bob',
                    sourceUrl: 'https://pexels.com/@bob',
                    license: 'Pexels License',
                    provider: 'pexels'
                }
            });

            const res = await app.request('/api/v1/admin/media/import-stock', {
                method: 'POST',
                headers: {
                    ...createAuthenticatedRequest(actor).headers,
                    'content-type': 'application/json'
                },
                body: JSON.stringify(
                    buildImportBody({
                        provider: 'pexels',
                        providerId: '42',
                        fullUrl: 'https://images.pexels.com/photo.jpg',
                        downloadLocation: undefined,
                        photographer: 'Bob',
                        photographerUrl: 'https://pexels.com/@bob'
                    })
                )
            });

            expect(res.status).toBe(200);
            expect(mockImport).toHaveBeenCalledWith(
                expect.objectContaining({
                    provider: 'pexels',
                    downloadLocation: undefined
                })
            );
        });
    });

    describe('request body validation', () => {
        it('rejects missing provider', async () => {
            const actor = createMockAdminActor({
                permissions: [
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.ACCESS_API_ADMIN,
                    PermissionEnum.MEDIA_UPLOAD,
                    PermissionEnum.ACCOMMODATION_UPDATE_ANY
                ]
            });
            const res = await app.request('/api/v1/admin/media/import-stock', {
                method: 'POST',
                headers: {
                    ...createAuthenticatedRequest(actor).headers,
                    'content-type': 'application/json'
                },
                body: JSON.stringify({ ...buildImportBody(), provider: undefined })
            });
            expect(res.status).toBe(400);
        });

        it('rejects invalid entity type', async () => {
            const actor = createMockAdminActor({
                permissions: [
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.ACCESS_API_ADMIN,
                    PermissionEnum.MEDIA_UPLOAD,
                    PermissionEnum.ACCOMMODATION_UPDATE_ANY
                ]
            });
            const res = await app.request('/api/v1/admin/media/import-stock', {
                method: 'POST',
                headers: {
                    ...createAuthenticatedRequest(actor).headers,
                    'content-type': 'application/json'
                },
                body: JSON.stringify({ ...buildImportBody(), entityType: 'invalid' })
            });
            expect(res.status).toBe(400);
        });

        it('rejects invalid role', async () => {
            const actor = createMockAdminActor({
                permissions: [
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.ACCESS_API_ADMIN,
                    PermissionEnum.MEDIA_UPLOAD,
                    PermissionEnum.ACCOMMODATION_UPDATE_ANY
                ]
            });
            const res = await app.request('/api/v1/admin/media/import-stock', {
                method: 'POST',
                headers: {
                    ...createAuthenticatedRequest(actor).headers,
                    'content-type': 'application/json'
                },
                body: JSON.stringify({ ...buildImportBody(), role: 'invalid' })
            });
            expect(res.status).toBe(400);
        });
    });
});
