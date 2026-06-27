/**
 * Integration tests for SPEC-237 T-008 + SPEC-250 Phase 5 protected external reputation routes.
 *
 * Routes under test:
 *   GET    /api/v1/protected/accommodations/:id/external-listings
 *   POST   /api/v1/protected/accommodations/:id/external-listings
 *   PATCH  /api/v1/protected/accommodations/:id/external-listings/:listingId
 *   DELETE /api/v1/protected/accommodations/:id/external-listings/:listingId
 *   PATCH  /api/v1/protected/accommodations/:id/external-reputation/master-toggle
 *   POST   /api/v1/protected/accommodations/:id/external-reputation/refresh
 *   GET    /api/v1/protected/accommodations/:id/external-reputation/status  (SPEC-250 Phase 5)
 *
 * Approach: vi.hoisted + vi.mock services + minimal Hono app with injected actor.
 * Does NOT hit the database — all models and services are mocked.
 *
 * Coverage:
 *   - 200/201/202/204 happy paths
 *   - 401 unauthenticated (GUEST actor, no permissions)
 *   - 403 non-owner (actor authenticated but NOT the owner)
 *   - 404 not found
 *   - 429 rate-limit on POST /refresh
 *   - 400 duplicate platform on POST /external-listings
 *   - 202 on async enqueue (SPEC-250 Phase 5)
 */

import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../src/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const NON_OWNER_ID = '22222222-2222-4222-8222-222222222222';
const GUEST_ID = '00000000-0000-4000-8000-000000000000';
const ACCOMMODATION_ID = '33333333-3333-4333-8333-333333333333';
const LISTING_ID = '44444444-4444-4444-8444-444444444444';

const MOCK_ACCOMMODATION = {
    id: ACCOMMODATION_ID,
    ownerId: OWNER_ID,
    deletedAt: null,
    name: 'Test Hotel'
};

const MOCK_LISTING = {
    id: LISTING_ID,
    accommodationId: ACCOMMODATION_ID,
    platform: 'GOOGLE',
    url: 'https://maps.google.com/?q=test',
    showLink: true,
    showReviews: false,
    verified: false,
    deletedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    createdById: OWNER_ID,
    updatedById: OWNER_ID,
    lifecycleState: 'ACTIVE'
};

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before vi.mock calls.
// ---------------------------------------------------------------------------

const {
    mockFindById,
    mockFindByAccommodation,
    mockAdd,
    mockUpdate,
    mockRemove,
    mockSetMasterToggle,
    mockRefresh,
    mockGetRefreshStatus
} = vi.hoisted(() => ({
    mockFindById: vi.fn(),
    mockFindByAccommodation: vi.fn(),
    mockAdd: vi.fn(),
    mockUpdate: vi.fn(),
    mockRemove: vi.fn(),
    mockSetMasterToggle: vi.fn(),
    mockRefresh: vi.fn(),
    mockGetRefreshStatus: vi.fn()
}));

// Mock AccommodationExternalListingModel + AccommodationExternalReputationModel
vi.mock('@repo/db', async (importActual) => {
    const actual = await importActual<typeof import('@repo/db')>();
    return {
        ...actual,
        AccommodationExternalListingModel: vi.fn().mockImplementation(() => ({
            findByAccommodation: mockFindByAccommodation,
            findById: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            softDelete: vi.fn()
        })),
        AccommodationExternalReputationModel: vi.fn().mockImplementation(() => ({
            findAll: vi.fn().mockResolvedValue({ items: [] }),
            findForDisplay: vi.fn().mockResolvedValue([]),
            upsertReputation: vi.fn()
        })),
        AccommodationModel: vi.fn().mockImplementation(() => ({
            findById: mockFindById,
            update: vi.fn()
        }))
    };
});

// Mock service-core — override just the two SPEC-237 services.
vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        AccommodationExternalListingService: vi.fn().mockImplementation(() => ({
            add: mockAdd,
            update: mockUpdate,
            remove: mockRemove,
            setMasterToggle: mockSetMasterToggle
        })),
        AccommodationExternalReputationService: vi.fn().mockImplementation(() => ({
            refresh: mockRefresh,
            getRefreshStatus: mockGetRefreshStatus
        }))
    };
});

vi.mock('../../../src/utils/logger.js', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

vi.mock('../../../src/utils/env.js', async (importActual) => {
    const actual = await importActual<typeof import('../../../src/utils/env.js')>();
    return {
        ...actual,
        env: {
            ...actual.env,
            HOSPEDA_GOOGLE_PLACES_API_KEY: undefined,
            HOSPEDA_API_DEBUG_ERRORS: false,
            NODE_ENV: 'test'
        }
    };
});

// Dynamic imports AFTER vi.mock calls.
const { protectedListExternalListingsRoute } = await import(
    '../../../src/routes/accommodation-external-reputation/protected/listListings.js'
);

const { protectedAddExternalListingRoute } = await import(
    '../../../src/routes/accommodation-external-reputation/protected/addListing.js'
);

const { protectedUpdateExternalListingRoute } = await import(
    '../../../src/routes/accommodation-external-reputation/protected/updateListing.js'
);

const { protectedRemoveExternalListingRoute } = await import(
    '../../../src/routes/accommodation-external-reputation/protected/removeListing.js'
);

const { protectedMasterToggleRoute } = await import(
    '../../../src/routes/accommodation-external-reputation/protected/masterToggle.js'
);

const { protectedRefreshReputationRoute } = await import(
    '../../../src/routes/accommodation-external-reputation/protected/refresh.js'
);

const { protectedReputationStatusRoute } = await import(
    '../../../src/routes/accommodation-external-reputation/protected/reputation-status.js'
);

// ---------------------------------------------------------------------------
// Error-handler helper
// ---------------------------------------------------------------------------

const SERVICE_ERROR_HTTP_STATUS: Partial<Record<ServiceErrorCode, number>> = {
    [ServiceErrorCode.FORBIDDEN]: 403,
    [ServiceErrorCode.UNAUTHORIZED]: 401,
    [ServiceErrorCode.NOT_FOUND]: 404,
    [ServiceErrorCode.VALIDATION_ERROR]: 400,
    [ServiceErrorCode.QUOTA_EXCEEDED]: 429
};

function attachTestErrorHandler(app: Hono<AppBindings>): void {
    app.onError((error, c) => {
        if (error instanceof ServiceError) {
            const status = SERVICE_ERROR_HTTP_STATUS[error.code] ?? 500;
            return c.json(
                { success: false, error: { code: error.code, message: error.message } },
                status as 400 | 401 | 403 | 404 | 429 | 500
            );
        }
        if (error instanceof HTTPException) {
            return error.getResponse();
        }
        return c.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: String(error) } },
            500
        );
    });
}

// ---------------------------------------------------------------------------
// App builder helpers
// ---------------------------------------------------------------------------

type ActorOptions = {
    id: string;
    role: RoleEnum;
    permissions: PermissionEnum[];
};

/**
 * Build a minimal Hono app with injected actor and one route sub-app.
 */
function buildApp(
    actor: ActorOptions,
    ...routes: ReturnType<typeof import('../../../src/utils/create-app.js').createRouter>[]
): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    attachTestErrorHandler(app);

    // Inject actor before route middleware.
    app.use((c, next) => {
        c.set('actor', actor);
        return next();
    });

    for (const route of routes) {
        app.route('/', route);
    }

    return app;
}

const ownerActor: ActorOptions = {
    id: OWNER_ID,
    role: RoleEnum.HOST,
    permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
};

const nonOwnerActor: ActorOptions = {
    id: NON_OWNER_ID,
    role: RoleEnum.HOST,
    permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
};

const guestActor: ActorOptions = {
    id: GUEST_ID,
    role: RoleEnum.GUEST,
    permissions: []
};

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

/** Default mock data for the status endpoint (SPEC-250 Phase 5). */
const MOCK_STATUS_RESULT = {
    platforms: {
        GOOGLE: {
            runStatus: 'idle',
            fetchStatus: 'ok',
            rating: 4.5,
            reviewsCount: 120,
            aggregateFetchedAt: '2024-01-01T00:00:00.000Z'
        }
    },
    allSettled: true
};

beforeEach(() => {
    mockFindById.mockResolvedValue(MOCK_ACCOMMODATION);
    mockFindByAccommodation.mockResolvedValue([MOCK_LISTING]);
    mockAdd.mockResolvedValue({ data: MOCK_LISTING });
    mockUpdate.mockResolvedValue({ data: MOCK_LISTING });
    mockRemove.mockResolvedValue({ data: true });
    mockSetMasterToggle.mockResolvedValue({ data: true });
    // SPEC-250 Phase 5: new RefreshResult shape (inlineSucceeded / enqueuedAsync / inlineFailed).
    mockRefresh.mockResolvedValue({
        data: { inlineSucceeded: ['GOOGLE'], enqueuedAsync: [], inlineFailed: [] }
    });
    mockGetRefreshStatus.mockResolvedValue({ data: MOCK_STATUS_RESULT });
});

afterEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// GET /:id/external-listings
// ---------------------------------------------------------------------------

describe('GET /:id/external-listings', () => {
    it('returns 200 with listings array for the owner', async () => {
        const app = buildApp(ownerActor, protectedListExternalListingsRoute);
        const res = await app.request(`/${ACCOMMODATION_ID}/external-listings`);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(Array.isArray(body.data)).toBe(true);
        expect(body.data).toHaveLength(1);
        expect(body.data[0].id).toBe(LISTING_ID);
    });

    it('returns 403 for a non-owner authenticated user', async () => {
        const app = buildApp(nonOwnerActor, protectedListExternalListingsRoute);
        const res = await app.request(`/${ACCOMMODATION_ID}/external-listings`);
        expect(res.status).toBe(403);
    });

    it('returns 401 or 403 for a guest (unauthenticated)', async () => {
        const app = buildApp(guestActor, protectedListExternalListingsRoute);
        const res = await app.request(`/${ACCOMMODATION_ID}/external-listings`);
        expect([401, 403]).toContain(res.status);
    });

    it('returns 404 when the accommodation does not exist', async () => {
        mockFindById.mockResolvedValue(null);
        const app = buildApp(ownerActor, protectedListExternalListingsRoute);
        const res = await app.request(`/${ACCOMMODATION_ID}/external-listings`);
        expect(res.status).toBe(404);
    });
});

// ---------------------------------------------------------------------------
// POST /:id/external-listings
// ---------------------------------------------------------------------------

describe('POST /:id/external-listings', () => {
    const validBody = {
        platform: 'GOOGLE',
        url: 'https://maps.google.com/?q=test',
        showLink: true,
        showReviews: false
    };

    it('returns 201 on happy path (owner creates listing)', async () => {
        const app = buildApp(ownerActor, protectedAddExternalListingRoute);
        const res = await app.request(`/${ACCOMMODATION_ID}/external-listings`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(validBody)
        });
        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.id).toBe(LISTING_ID);
    });

    it('returns 400 on duplicate platform (DUPLICATE_PLATFORM)', async () => {
        mockAdd.mockResolvedValue({
            error: {
                code: ServiceErrorCode.VALIDATION_ERROR,
                message: 'A listing for platform GOOGLE already exists',
                details: { reason: 'DUPLICATE_PLATFORM' }
            }
        });
        const app = buildApp(ownerActor, protectedAddExternalListingRoute);
        const res = await app.request(`/${ACCOMMODATION_ID}/external-listings`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(validBody)
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.success).toBe(false);
    });

    it('returns 401 or 403 for a guest (unauthenticated)', async () => {
        const app = buildApp(guestActor, protectedAddExternalListingRoute);
        const res = await app.request(`/${ACCOMMODATION_ID}/external-listings`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(validBody)
        });
        expect([401, 403]).toContain(res.status);
    });
});

// ---------------------------------------------------------------------------
// PATCH /:id/external-listings/:listingId
// ---------------------------------------------------------------------------

describe('PATCH /:id/external-listings/:listingId', () => {
    it('returns 200 on happy path (owner updates listing)', async () => {
        const app = buildApp(ownerActor, protectedUpdateExternalListingRoute);
        const res = await app.request(`/${ACCOMMODATION_ID}/external-listings/${LISTING_ID}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ showLink: false })
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
    });

    it('returns 401 or 403 for a guest', async () => {
        const app = buildApp(guestActor, protectedUpdateExternalListingRoute);
        const res = await app.request(`/${ACCOMMODATION_ID}/external-listings/${LISTING_ID}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ showLink: false })
        });
        expect([401, 403]).toContain(res.status);
    });

    it('returns 403 when the service returns FORBIDDEN', async () => {
        mockUpdate.mockResolvedValue({
            error: { code: ServiceErrorCode.FORBIDDEN, message: 'Not your listing' }
        });
        const app = buildApp(ownerActor, protectedUpdateExternalListingRoute);
        const res = await app.request(`/${ACCOMMODATION_ID}/external-listings/${LISTING_ID}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ showLink: false })
        });
        expect(res.status).toBe(403);
    });
});

// ---------------------------------------------------------------------------
// DELETE /:id/external-listings/:listingId
// ---------------------------------------------------------------------------

describe('DELETE /:id/external-listings/:listingId', () => {
    it('returns 200 on happy path (owner deletes listing)', async () => {
        const app = buildApp(ownerActor, protectedRemoveExternalListingRoute);
        const res = await app.request(`/${ACCOMMODATION_ID}/external-listings/${LISTING_ID}`, {
            method: 'DELETE'
        });
        // Factory returns 200 when handler returns an object (not null/undefined)
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
    });

    it('returns 401 or 403 for a guest', async () => {
        const app = buildApp(guestActor, protectedRemoveExternalListingRoute);
        const res = await app.request(`/${ACCOMMODATION_ID}/external-listings/${LISTING_ID}`, {
            method: 'DELETE'
        });
        expect([401, 403]).toContain(res.status);
    });

    it('returns 404 when listing not found', async () => {
        mockRemove.mockResolvedValue({
            error: { code: ServiceErrorCode.NOT_FOUND, message: 'External listing not found' }
        });
        const app = buildApp(ownerActor, protectedRemoveExternalListingRoute);
        const res = await app.request(`/${ACCOMMODATION_ID}/external-listings/${LISTING_ID}`, {
            method: 'DELETE'
        });
        expect(res.status).toBe(404);
    });
});

// ---------------------------------------------------------------------------
// PATCH /:id/external-reputation/master-toggle
// ---------------------------------------------------------------------------

describe('PATCH /:id/external-reputation/master-toggle', () => {
    it('returns 200 on happy path (owner sets toggle)', async () => {
        const app = buildApp(ownerActor, protectedMasterToggleRoute);
        const res = await app.request(`/${ACCOMMODATION_ID}/external-reputation/master-toggle`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ value: true })
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.updated).toBe(true);
    });

    it('returns 401 or 403 for a guest', async () => {
        const app = buildApp(guestActor, protectedMasterToggleRoute);
        const res = await app.request(`/${ACCOMMODATION_ID}/external-reputation/master-toggle`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ value: true })
        });
        expect([401, 403]).toContain(res.status);
    });

    it('returns 400 on missing body value field', async () => {
        const app = buildApp(ownerActor, protectedMasterToggleRoute);
        const res = await app.request(`/${ACCOMMODATION_ID}/external-reputation/master-toggle`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({})
        });
        // Zod validation rejects missing `value` field
        expect(res.status).toBe(400);
    });

    it('returns 403 for a non-owner with service FORBIDDEN error', async () => {
        mockSetMasterToggle.mockResolvedValue({
            error: { code: ServiceErrorCode.FORBIDDEN, message: 'Not your accommodation' }
        });
        const app = buildApp(nonOwnerActor, protectedMasterToggleRoute);
        const res = await app.request(`/${ACCOMMODATION_ID}/external-reputation/master-toggle`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ value: false })
        });
        expect(res.status).toBe(403);
    });
});

// ---------------------------------------------------------------------------
// POST /:id/external-reputation/refresh  (SPEC-237 T-008 + SPEC-250 Phase 5)
// ---------------------------------------------------------------------------

describe('POST /:id/external-reputation/refresh', () => {
    it('returns 200 when all platforms resolved inline (enqueuedAsync empty)', async () => {
        // Arrange: default mock has enqueuedAsync=[] — all inline.
        const app = buildApp(ownerActor, protectedRefreshReputationRoute);

        // Act
        const res = await app.request(`/${ACCOMMODATION_ID}/external-reputation/refresh`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' }
        });

        // Assert
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.inlineSucceeded).toEqual(['GOOGLE']);
        expect(body.data.enqueuedAsync).toEqual([]);
        expect(body.data.inlineFailed).toEqual([]);
    });

    it('returns 202 when at least one platform is enqueued async (SPEC-250 Phase 5)', async () => {
        // Arrange: service returns enqueuedAsync with AIRBNB.
        mockRefresh.mockResolvedValue({
            data: {
                inlineSucceeded: ['GOOGLE'],
                enqueuedAsync: ['AIRBNB'],
                inlineFailed: []
            }
        });
        const app = buildApp(ownerActor, protectedRefreshReputationRoute);

        // Act
        const res = await app.request(`/${ACCOMMODATION_ID}/external-reputation/refresh`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' }
        });

        // Assert
        expect(res.status).toBe(202);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.inlineSucceeded).toEqual(['GOOGLE']);
        expect(body.data.enqueuedAsync).toEqual(['AIRBNB']);
        expect(body.data.inlineFailed).toEqual([]);
    });

    it('returns 202 when all platforms are enqueued async (no inline)', async () => {
        // Arrange: service returns only async enqueues (AIRBNB + BOOKING).
        mockRefresh.mockResolvedValue({
            data: {
                inlineSucceeded: [],
                enqueuedAsync: ['AIRBNB', 'BOOKING'],
                inlineFailed: []
            }
        });
        const app = buildApp(ownerActor, protectedRefreshReputationRoute);

        // Act
        const res = await app.request(`/${ACCOMMODATION_ID}/external-reputation/refresh`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' }
        });

        // Assert
        expect(res.status).toBe(202);
        const body = await res.json();
        expect(body.data.enqueuedAsync).toHaveLength(2);
        expect(body.data.enqueuedAsync).toContain('AIRBNB');
        expect(body.data.enqueuedAsync).toContain('BOOKING');
    });

    it('returns 429 when QUOTA_EXCEEDED (rate-limit) with Retry-After header', async () => {
        // Arrange
        mockRefresh.mockResolvedValue({
            error: {
                code: ServiceErrorCode.QUOTA_EXCEEDED,
                message: 'Reputation refresh is rate-limited',
                details: { reason: 'RATE_LIMIT_ERROR', windowSeconds: 600 }
            }
        });
        const app = buildApp(ownerActor, protectedRefreshReputationRoute);

        // Act
        const res = await app.request(`/${ACCOMMODATION_ID}/external-reputation/refresh`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' }
        });

        // Assert
        expect(res.status).toBe(429);
        const retryAfter = res.headers.get('Retry-After');
        expect(retryAfter).toBeTruthy();
        expect(Number.parseInt(retryAfter ?? '0', 10)).toBeGreaterThan(0);
    });

    it('returns 401 or 403 for a guest (unauthenticated)', async () => {
        // Arrange + Act
        const app = buildApp(guestActor, protectedRefreshReputationRoute);
        const res = await app.request(`/${ACCOMMODATION_ID}/external-reputation/refresh`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' }
        });

        // Assert
        expect([401, 403]).toContain(res.status);
    });

    it('returns 403 when the service returns FORBIDDEN (non-owner)', async () => {
        // Arrange
        mockRefresh.mockResolvedValue({
            error: { code: ServiceErrorCode.FORBIDDEN, message: 'Not your accommodation' }
        });
        const app = buildApp(nonOwnerActor, protectedRefreshReputationRoute);

        // Act
        const res = await app.request(`/${ACCOMMODATION_ID}/external-reputation/refresh`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' }
        });

        // Assert
        expect(res.status).toBe(403);
    });

    it('returns 200 with partial inline failure in RefreshResult', async () => {
        // Arrange
        mockRefresh.mockResolvedValue({
            data: {
                inlineSucceeded: [],
                enqueuedAsync: [],
                inlineFailed: [{ platform: 'BOOKING', error: 'timeout' }]
            }
        });
        const app = buildApp(ownerActor, protectedRefreshReputationRoute);

        // Act
        const res = await app.request(`/${ACCOMMODATION_ID}/external-reputation/refresh`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' }
        });

        // Assert: all-inline (no enqueued) → 200 even with failures.
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.inlineFailed).toHaveLength(1);
        expect(body.data.inlineFailed[0].platform).toBe('BOOKING');
    });
});

// ---------------------------------------------------------------------------
// GET /:id/external-reputation/status  (SPEC-250 Phase 5)
// ---------------------------------------------------------------------------

describe('GET /:id/external-reputation/status', () => {
    it('returns 200 with platforms and allSettled on happy path', async () => {
        // Arrange: default mock returns allSettled=true with GOOGLE idle.
        const app = buildApp(ownerActor, protectedReputationStatusRoute);

        // Act
        const res = await app.request(`/${ACCOMMODATION_ID}/external-reputation/status`);

        // Assert
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.allSettled).toBe(true);
        expect(body.data.platforms).toBeDefined();
        expect(body.data.platforms.GOOGLE).toMatchObject({
            runStatus: 'idle',
            fetchStatus: 'ok',
            rating: 4.5,
            reviewsCount: 120
        });
    });

    it('returns 200 with allSettled=false when a platform is pending', async () => {
        // Arrange: AIRBNB is pending — not yet settled.
        mockGetRefreshStatus.mockResolvedValue({
            data: {
                platforms: {
                    GOOGLE: {
                        runStatus: 'idle',
                        fetchStatus: 'ok',
                        rating: 4.5,
                        reviewsCount: 120,
                        aggregateFetchedAt: '2024-01-01T00:00:00.000Z'
                    },
                    AIRBNB: {
                        runStatus: 'pending',
                        fetchStatus: 'ok',
                        rating: null,
                        reviewsCount: null,
                        aggregateFetchedAt: null
                    }
                },
                allSettled: false
            }
        });
        const app = buildApp(ownerActor, protectedReputationStatusRoute);

        // Act
        const res = await app.request(`/${ACCOMMODATION_ID}/external-reputation/status`);

        // Assert
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.allSettled).toBe(false);
        expect(body.data.platforms.AIRBNB.runStatus).toBe('pending');
    });

    it('returns 403 when the service returns FORBIDDEN (non-owner)', async () => {
        // Arrange
        mockGetRefreshStatus.mockResolvedValue({
            error: { code: ServiceErrorCode.FORBIDDEN, message: 'Not your accommodation' }
        });
        const app = buildApp(nonOwnerActor, protectedReputationStatusRoute);

        // Act
        const res = await app.request(`/${ACCOMMODATION_ID}/external-reputation/status`);

        // Assert
        expect(res.status).toBe(403);
    });

    it('returns 404 when the accommodation does not exist', async () => {
        // Arrange
        mockGetRefreshStatus.mockResolvedValue({
            error: { code: ServiceErrorCode.NOT_FOUND, message: 'Accommodation not found' }
        });
        const app = buildApp(ownerActor, protectedReputationStatusRoute);

        // Act
        const res = await app.request(`/${ACCOMMODATION_ID}/external-reputation/status`);

        // Assert
        expect(res.status).toBe(404);
    });

    it('returns 401 or 403 for a guest (unauthenticated)', async () => {
        // Arrange + Act
        const app = buildApp(guestActor, protectedReputationStatusRoute);
        const res = await app.request(`/${ACCOMMODATION_ID}/external-reputation/status`);

        // Assert
        expect([401, 403]).toContain(res.status);
    });
});
