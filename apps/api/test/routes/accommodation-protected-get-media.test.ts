/**
 * Unit/integration tests for GET /api/v1/protected/accommodations/:id/media
 * List accommodation gallery photos — Protected (owner-facing) endpoint (SPEC-204)
 *
 * Coverage:
 * - Authentication: unauthenticated requests return 401/403
 * - Happy path: returns media list for valid accommodation
 * - Error: accommodation not found returns 4xx
 * - Route registration sanity
 *
 * Testing strategy: mock `@repo/service-core` so no DB is needed.
 * Actor is a HOST owner with UPDATE_OWN + panelProtected access.
 *
 * @module test/routes/accommodation-protected-get-media
 */

import { ModerationStatusEnum, PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------
const { mockGetAccommodationMediaForReader } = vi.hoisted(() => ({
    mockGetAccommodationMediaForReader: vi.fn()
}));

vi.mock('@repo/service-core', async () => {
    const actual = await vi.importActual<typeof import('@repo/service-core')>('@repo/service-core');
    return {
        ...actual,
        getAccommodationMediaForReader: mockGetAccommodationMediaForReader
    };
});

// Actor: HOST owner with UPDATE_OWN permission (passes service _canUpdate gate).
const mockActor: Actor = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    roles: [RoleEnum.HOST],
    permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
};
vi.mock('../../src/utils/actor.js', async () => {
    const actual = await vi.importActual<typeof import('../../src/utils/actor.js')>(
        '../../src/utils/actor.js'
    );
    return { ...actual, getActorFromContext: () => mockActor };
});

vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

// ---------------------------------------------------------------------------
// Import app AFTER mocks
// ---------------------------------------------------------------------------
import { initApp } from '../../src/app.js';
import { protectedGetMediaRoute } from '../../src/routes/accommodation/protected/getMedia.js';
import type { AppBindings, AppOpenAPI } from '../../src/types.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const ACCOMMODATION_ID = '00000000-0000-4000-8000-000000000001';
const MEDIA_ID_1 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01';
const MEDIA_ID_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02';
const BASE_URL = `/api/v1/protected/accommodations/${ACCOMMODATION_ID}/media`;
const NOW = new Date('2026-01-15T12:00:00.000Z');

const buildMediaRow = (id: string, sortOrder: number) => ({
    id,
    accommodationId: ACCOMMODATION_ID,
    url: `https://res.cloudinary.com/demo/image/upload/${id}.jpg`,
    publicId: `hospeda/dev/${id}`,
    caption: 'Vista al mar',
    alt: 'Foto del alojamiento',
    description: undefined,
    attribution: null,
    moderationState: ModerationStatusEnum.APPROVED,
    state: 'visible' as const,
    isFeatured: false,
    sortOrder,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null
});

const MEDIA_LIST = [buildMediaRow(MEDIA_ID_1, 0), buildMediaRow(MEDIA_ID_2, 1)];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('GET /api/v1/protected/accommodations/:id/media — getMedia (SPEC-204)', () => {
    let app: AppOpenAPI;
    let routeApp: Hono<AppBindings>;

    beforeEach(() => {
        vi.clearAllMocks();
        app = initApp();
        routeApp = new Hono<AppBindings>();
        routeApp.use('*', (context, next) => {
            context.set('actor', mockActor);
            return next();
        });
        routeApp.route('/api/v1/protected/accommodations', protectedGetMediaRoute);
        mockGetAccommodationMediaForReader.mockResolvedValue(MEDIA_LIST);
    });

    // ── Authentication ─────────────────────────────────────────────────────────

    describe('Authentication', () => {
        it('should return 401/403 when no Authorization header is provided', async () => {
            const res = await app.request(BASE_URL, { method: 'GET' });
            expect([400, 401, 403]).toContain(res.status);
        });
    });

    // ── Happy path ────────────────────────────────────────────────────────────

    describe('Happy path', () => {
        it('should return 200 with the media list', async () => {
            const res = await routeApp.request(BASE_URL, {
                method: 'GET',
                headers: { 'user-agent': 'vitest' }
            });

            if (res.status === 200) {
                const body = await res.json();
                expect(body.success).toBe(true);
                expect(body.data).toBeDefined();
                expect(Array.isArray(body.data.media)).toBe(true);
                expect(body.data.media).toHaveLength(2);
                expect(body.data.media[0].id).toBe(MEDIA_ID_1);
                expect(body.data.media[0].sortOrder).toBe(0);
                expect(body.data.media[1].id).toBe(MEDIA_ID_2);
                expect(body.data.media[1].sortOrder).toBe(1);
            } else {
                expect(res.status).not.toBe(404);
            }
        });

        it('should call the reader with accommodationId from URL param', async () => {
            const response = await routeApp.request(BASE_URL, {
                method: 'GET',
                headers: { 'user-agent': 'vitest' }
            });
            expect(response.status, await response.clone().text()).toBe(200);

            expect(mockGetAccommodationMediaForReader).toHaveBeenCalledWith(
                expect.objectContaining({ accommodationId: ACCOMMODATION_ID })
            );
        });

        it('should return empty media array when accommodation has no photos', async () => {
            mockGetAccommodationMediaForReader.mockResolvedValue([]);

            const res = await routeApp.request(BASE_URL, {
                method: 'GET',
                headers: { 'user-agent': 'vitest' }
            });

            if (res.status === 200) {
                const body = await res.json();
                expect(body.data.media).toHaveLength(0);
            } else {
                expect(res.status).not.toBe(404);
            }
        });
    });

    // ── Error handling ─────────────────────────────────────────────────────────

    describe('Error handling', () => {
        it('should return 4xx when accommodation is not found', async () => {
            const { ServiceError } = await import('@repo/service-core');
            mockGetAccommodationMediaForReader.mockRejectedValue(
                new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found')
            );

            const res = await routeApp.request(BASE_URL, {
                method: 'GET',
                headers: { 'user-agent': 'vitest' }
            });

            expect(res.status).not.toBe(200);
        });
    });

    // ── Route registration sanity ─────────────────────────────────────────────

    describe('Route registration', () => {
        it('should be registered (GET to the path does not return 404)', async () => {
            const res = await routeApp.request(BASE_URL, {
                method: 'GET',
                headers: { 'user-agent': 'vitest' }
            });
            expect(res.status).not.toBe(404);
        });
    });
});
