/**
 * SPEC-284 T-015: Tests for the personalized recommendations feed API endpoint.
 *
 * Tests the protected read-only endpoint `GET /api/v1/protected/recommendations`
 * including:
 * - Entitlement gate (CAN_VIEW_RECOMMENDATIONS) — blocked BEFORE the service runs.
 * - Service-level permission gate (RECOMMENDATION_VIEW) — surfaced as a
 *   ServiceError(FORBIDDEN) once the route gate is passed.
 * - Unauthenticated (guest actor) — rejected by `protectedAuthMiddleware`.
 * - Response shape (`items`, `isColdStart`, `generatedAt`) and cold-start passthrough.
 * - Generic service error status mapping.
 *
 * Layer: Integration (minimal Hono app with entitlement middleware), mirroring
 * `apps/api/test/routes/host/dashboard.test.ts` — the closest sibling in shape
 * (protected + entitlement-gated + real-service-mocked GET route).
 *
 * @see apps/api/src/routes/recommendations/protected/get.ts
 */
import { EntitlementKey, type LimitKey } from '@repo/billing';
import { AccommodationTypeEnum, PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import type { RecommendationFeedResponse } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../src/types';
import { createGuestActor } from '../../../src/utils/actor';

// ---------------------------------------------------------------------------
// Mocks — the route calls the real `RecommendationService`. We mock it so we
// can assert the route's status-mapping and passthrough behavior without
// exercising the real signal-fetching/scoring pipeline (that's covered by
// `packages/service-core/test/services/recommendation/recommendation.service.test.ts`).
// `@repo/service-core` keeps its real exports (`ServiceError` is used by the
// route's error path) and only overrides the `RecommendationService` class.
// ---------------------------------------------------------------------------

const getFeedMock = vi.fn();

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        RecommendationService: class {
            getFeed = getFeedMock;
        }
    };
});

// Import AFTER the mock is registered so the route picks up the mocked service.
const { getRecommendationsRoute } = await import(
    '../../../src/routes/recommendations/protected/get'
);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ACTOR_ID = '00000000-0000-0000-0000-000000000010';

/** Minimal `RecommendationCandidateAccommodation` + score, valid against `ScoredAccommodationSchema`. */
function buildScoredAccommodation(overrides: { isFeatured?: boolean } = {}) {
    return {
        accommodation: {
            id: '11111111-1111-4111-8111-111111111111',
            name: 'Cabaña de prueba',
            slug: 'cabana-de-prueba',
            summary: 'A quiet test cabin near the river, perfect for a weekend getaway.',
            type: AccommodationTypeEnum.CABIN,
            ownerId: '22222222-2222-4222-8222-222222222222',
            destinationId: '33333333-3333-4333-8333-333333333333',
            amenityIds: [] as string[],
            isFeatured: overrides.isFeatured ?? false,
            averageRating: undefined,
            price: null,
            location: null,
            media: null
        },
        score: { destination: 40, type: 20, price: 14, amenities: 9, quality: 5 },
        totalScore: 88
    };
}

/** Successful `getFeed` payload — a personalized (non-cold-start) feed. */
function buildFeedResponse(
    overrides: Partial<RecommendationFeedResponse> = {}
): RecommendationFeedResponse {
    return {
        items: [buildScoredAccommodation()],
        isColdStart: false,
        generatedAt: new Date('2026-06-30T12:00:00.000Z'),
        ...overrides
    };
}

/** Wraps a successful service payload in the `ServiceOutput` envelope. */
function ok(data: RecommendationFeedResponse) {
    return { data, error: undefined };
}

beforeEach(() => {
    getFeedMock.mockReset();
    getFeedMock.mockResolvedValue(ok(buildFeedResponse()));
});

afterEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Minimal error handler mirroring production createErrorHandler() shape.
// ---------------------------------------------------------------------------

const SERVICE_ERROR_HTTP_STATUS: Partial<Record<ServiceErrorCode, number>> = {
    [ServiceErrorCode.ENTITLEMENT_REQUIRED]: 403,
    [ServiceErrorCode.LIMIT_REACHED]: 403,
    [ServiceErrorCode.FORBIDDEN]: 403,
    [ServiceErrorCode.UNAUTHORIZED]: 401,
    [ServiceErrorCode.NOT_FOUND]: 404,
    [ServiceErrorCode.VALIDATION_ERROR]: 400
};

function attachTestErrorHandler(app: Hono<AppBindings>): void {
    app.onError((error, c) => {
        if (error instanceof ServiceError) {
            const status = SERVICE_ERROR_HTTP_STATUS[error.code as ServiceErrorCode] ?? 500;
            return c.json(
                {
                    success: false,
                    error: {
                        code: error.code,
                        message: error.message,
                        ...(error.details ? { details: error.details } : {})
                    }
                },
                status as 400 | 401 | 403 | 404 | 500
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
// Helpers — build test apps with actor + entitlements injected BEFORE the route
// ---------------------------------------------------------------------------

/** Inject a minimal tourist actor. */
function injectActor(
    app: Hono<AppBindings>,
    actor: { id: string; role: RoleEnum; permissions: readonly PermissionEnum[] }
): void {
    app.use((c, next) => {
        c.set('actor', actor);
        return next();
    });
}

/** Inject entitlement set (billing healthy). */
function injectEntitlements(app: Hono<AppBindings>, keys: EntitlementKey[]): void {
    app.use((c, next) => {
        c.set('userEntitlements', new Set(keys));
        c.set('userLimits', new Map<LimitKey, number>());
        c.set('billingLoadFailed', false);
        return next();
    });
}

/**
 * Build a test app for an authenticated actor with the given entitlement keys.
 * Middleware order: error handler → actor → entitlements → route (which itself
 * runs `protectedAuthMiddleware()` then `gateRecommendations()` before the handler).
 */
function buildApp(entitlementKeys: EntitlementKey[]): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    attachTestErrorHandler(app);
    injectActor(app, {
        id: ACTOR_ID,
        role: RoleEnum.USER,
        permissions: [PermissionEnum.RECOMMENDATION_VIEW]
    });
    injectEntitlements(app, entitlementKeys);
    app.route('/', getRecommendationsRoute);
    return app;
}

/** Build a test app for an unauthenticated (guest) actor. */
function buildUnauthenticatedApp(): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    attachTestErrorHandler(app);
    injectActor(app, createGuestActor());
    injectEntitlements(app, [EntitlementKey.CAN_VIEW_RECOMMENDATIONS]);
    app.route('/', getRecommendationsRoute);
    return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/v1/protected/recommendations (SPEC-284 T-015)', () => {
    describe('happy path', () => {
        it('returns 200 with the RecommendationFeedResponse shape when the actor has the entitlement', async () => {
            // Arrange
            const app = buildApp([EntitlementKey.CAN_VIEW_RECOMMENDATIONS]);

            // Act
            const res = await app.request('/');
            const body = await res.json();

            // Assert
            expect(res.status).toBe(200);
            expect(body.data).toBeDefined();
            expect(Array.isArray(body.data.items)).toBe(true);
            expect(body.data.items).toHaveLength(1);
            expect(body.data.isColdStart).toBe(false);
            expect(body.data.generatedAt).toBeDefined();
            expect(getFeedMock).toHaveBeenCalledTimes(1);
        });
    });

    describe('entitlement gate (CAN_VIEW_RECOMMENDATIONS)', () => {
        it('returns 403 ENTITLEMENT_REQUIRED when the actor lacks the entitlement, without calling the service', async () => {
            // Arrange
            const app = buildApp([]);

            // Act
            const res = await app.request('/');
            const body = await res.json();

            // Assert
            expect(res.status).toBe(403);
            expect(body.error.code).toBe(ServiceErrorCode.ENTITLEMENT_REQUIRED);
            expect(getFeedMock).not.toHaveBeenCalled();
        });
    });

    describe('permission gate (RECOMMENDATION_VIEW, service-level)', () => {
        it('returns 403 FORBIDDEN when the service rejects for lack of RECOMMENDATION_VIEW', async () => {
            // Arrange — route-level gate passes (actor has the entitlement), but the
            // service reports a FORBIDDEN ServiceError (the role-axis check, T-005b).
            getFeedMock.mockResolvedValue({
                data: undefined,
                error: {
                    code: ServiceErrorCode.FORBIDDEN,
                    message:
                        'Permission denied: RECOMMENDATION_VIEW required to view the recommendations feed'
                }
            });
            const app = buildApp([EntitlementKey.CAN_VIEW_RECOMMENDATIONS]);

            // Act
            const res = await app.request('/');
            const body = await res.json();

            // Assert
            expect(res.status).toBe(403);
            expect(body.error.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(body.error.message).toContain('RECOMMENDATION_VIEW');
            expect(getFeedMock).toHaveBeenCalledTimes(1);
        });
    });

    describe('unauthenticated', () => {
        it('returns 401 when the actor is a guest (no session)', async () => {
            // Arrange
            const app = buildUnauthenticatedApp();

            // Act
            const res = await app.request('/');

            // Assert
            expect(res.status).toBe(401);
            expect(getFeedMock).not.toHaveBeenCalled();
        });
    });

    describe('generic service error passthrough', () => {
        it('maps a non-FORBIDDEN ServiceError to its corresponding HTTP status', async () => {
            // Arrange
            getFeedMock.mockResolvedValue({
                data: undefined,
                error: {
                    code: ServiceErrorCode.INTERNAL_ERROR,
                    message: 'Unexpected failure computing the feed'
                }
            });
            const app = buildApp([EntitlementKey.CAN_VIEW_RECOMMENDATIONS]);

            // Act
            const res = await app.request('/');
            const body = await res.json();

            // Assert
            expect(res.status).toBe(500);
            expect(body.error.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
        });
    });

    describe('cold-start passthrough', () => {
        it('returns isColdStart: true unmodified when the service reports a cold-start feed', async () => {
            // Arrange
            getFeedMock.mockResolvedValue(
                ok(
                    buildFeedResponse({
                        isColdStart: true,
                        items: [buildScoredAccommodation({ isFeatured: true })]
                    })
                )
            );
            const app = buildApp([EntitlementKey.CAN_VIEW_RECOMMENDATIONS]);

            // Act
            const res = await app.request('/');
            const body = await res.json();

            // Assert
            expect(res.status).toBe(200);
            expect(body.data.isColdStart).toBe(true);
            expect(body.data.items).toHaveLength(1);
        });
    });
});
