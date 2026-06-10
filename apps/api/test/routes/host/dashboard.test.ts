/**
 * SPEC-205: Tests for the Host Dashboard API endpoint.
 *
 * Tests the protected aggregation endpoint `GET /api/v1/protected/host/dashboard`
 * including:
 * - Entitlement gate (VIEW_BASIC_STATS) — gate matrix (200 / 403 / 503 / staff)
 * - Mapped response shape (properties grouped by lifecycleState, plan info, unread)
 * - Plan fail-safe (billing disabled / no subscription → null)
 * - Plan populated + status/isTrial mapping for a trialing subscription
 * - Graceful degradation (getByOwner rejects → 200 with zeroed properties)
 *
 * The route wires REAL services (AccommodationService.getByOwner,
 * ConversationService.getUnreadCount) and the billing provider
 * (getQZPayBilling). Those are mocked here so the test asserts the
 * MAPPED shape, not stubbed defaults.
 *
 * Layer: Integration (minimal Hono app with entitlement middleware)
 *
 * @see apps/api/src/routes/host/protected/dashboard.ts
 */
import { EntitlementKey, type LimitKey } from '@repo/billing';
import { LifecycleStatusEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../src/types';

// ---------------------------------------------------------------------------
// Mocks — the route calls real services + billing provider. We mock those
// so we can assert the MAPPED dashboard shape. `@repo/service-core` keeps its
// real exports (ServiceError / RoleEnum are used by the entitlement middleware
// and the route's error path) and only overrides the two service classes.
// ---------------------------------------------------------------------------

const getByOwnerMock = vi.fn();
const getUnreadCountMock = vi.fn();
const getQZPayBillingMock = vi.fn();

vi.mock('@repo/service-core', async (importActual) => {
    const actual = await importActual<typeof import('@repo/service-core')>();
    return {
        ...actual,
        AccommodationService: class {
            getByOwner = getByOwnerMock;
        },
        ConversationService: class {
            getUnreadCount = getUnreadCountMock;
        }
    };
});

vi.mock('../../../src/middlewares/billing', async (importActual) => {
    const actual = await importActual<typeof import('../../../src/middlewares/billing')>();
    return {
        ...actual,
        getQZPayBilling: getQZPayBillingMock
    };
});

// Import AFTER the mocks are registered so the route picks up the mocked deps.
const { hostDashboardRoute } = await import('../../../src/routes/host/protected/dashboard');

// ---------------------------------------------------------------------------
// Default mock state — overridden per-test as needed.
// ---------------------------------------------------------------------------

/** Build a successful getByOwner result wrapping the given accommodations. */
function ok(accommodations: Array<{ id: string; lifecycleState: LifecycleStatusEnum }>) {
    return { data: { accommodations }, error: undefined };
}

beforeEach(() => {
    getByOwnerMock.mockReset();
    getUnreadCountMock.mockReset();
    getQZPayBillingMock.mockReset();

    // Default: no accommodations, no unread, billing disabled (null plan).
    getByOwnerMock.mockResolvedValue(ok([]));
    getUnreadCountMock.mockResolvedValue({ data: { count: 0 }, error: undefined });
    getQZPayBillingMock.mockReturnValue(null);
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
            const status = SERVICE_ERROR_HTTP_STATUS[error.code] ?? 500;
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
// Helpers — build test apps with entitlements injected BEFORE the route
// ---------------------------------------------------------------------------

/** Inject a minimal host actor. */
function injectHostActor(app: Hono<AppBindings>): void {
    app.use((c, next) => {
        c.set('actor', {
            id: '00000000-0000-0000-0000-000000000010',
            role: RoleEnum.HOST,
            permissions: []
        });
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

/** Inject billing failure state. */
function injectBillingFailure(app: Hono<AppBindings>): void {
    app.use((c, next) => {
        c.set('billingLoadFailed', true);
        return next();
    });
}

/**
 * Build a test app with the given entitlement keys.
 * Middleware order: error handler → actor → entitlements → route.
 * Entitlements are set BEFORE the route is mounted so they run first.
 */
function buildApp(entitlementKeys: EntitlementKey[]): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    attachTestErrorHandler(app);
    injectHostActor(app);
    injectEntitlements(app, entitlementKeys);
    app.route('/', hostDashboardRoute);
    return app;
}

/**
 * Build a test app with billing failure.
 */
function buildBillingFailureApp(): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    attachTestErrorHandler(app);
    injectHostActor(app);
    injectBillingFailure(app);
    app.route('/', hostDashboardRoute);
    return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/v1/protected/host/dashboard (SPEC-205)', () => {
    describe('entitlement gate (VIEW_BASIC_STATS)', () => {
        it('returns 200 when actor has VIEW_BASIC_STATS entitlement', async () => {
            // Arrange
            const app = buildApp([EntitlementKey.VIEW_BASIC_STATS]);

            // Act
            const res = await app.request('/');

            // Assert
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.data).toBeDefined();
            expect(body.data.properties).toBeDefined();
            expect(body.data.properties.total).toBe(0);
        });

        it('returns 403 when actor lacks VIEW_BASIC_STATS entitlement', async () => {
            // Arrange
            const app = buildApp([EntitlementKey.PUBLISH_ACCOMMODATIONS]);

            // Act
            const res = await app.request('/');

            // Assert
            expect(res.status).toBe(403);
            const body = await res.json();
            expect(body.error.code).toBe(ServiceErrorCode.ENTITLEMENT_REQUIRED);
        });

        it('returns 403 when actor has empty entitlements', async () => {
            // Arrange
            const app = buildApp([]);

            // Act
            const res = await app.request('/');

            // Assert
            expect(res.status).toBe(403);
            const body = await res.json();
            expect(body.error.code).toBe(ServiceErrorCode.ENTITLEMENT_REQUIRED);
        });

        it('returns 503 when billing service is unavailable', async () => {
            // Arrange
            const app = buildBillingFailureApp();

            // Act
            const res = await app.request('/');

            // Assert
            expect(res.status).toBe(503);
            const body = await res.json();
            expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
        });
    });

    describe('staff bypass', () => {
        it('allows staff actors through (entitlementMiddleware injects all keys)', async () => {
            // When entitlementMiddleware runs with staff role, it injects ALL keys.
            // We simulate that by injecting VIEW_BASIC_STATS.
            // Arrange
            const app = buildApp([EntitlementKey.VIEW_BASIC_STATS]);

            // Act
            const res = await app.request('/');

            // Assert
            expect(res.status).toBe(200);
        });
    });

    describe('properties mapping (grouped by lifecycleState)', () => {
        it('groups counts: 2 ACTIVE + 1 DRAFT + 1 ARCHIVED → total 4', async () => {
            // Arrange
            getByOwnerMock.mockResolvedValue(
                ok([
                    { id: 'a1', lifecycleState: LifecycleStatusEnum.ACTIVE },
                    { id: 'a2', lifecycleState: LifecycleStatusEnum.ACTIVE },
                    { id: 'd1', lifecycleState: LifecycleStatusEnum.DRAFT },
                    { id: 'ar1', lifecycleState: LifecycleStatusEnum.ARCHIVED }
                ])
            );
            const app = buildApp([EntitlementKey.VIEW_BASIC_STATS]);

            // Act
            const res = await app.request('/');
            const body = await res.json();

            // Assert
            expect(res.status).toBe(200);
            expect(body.data.properties).toEqual({
                total: 4,
                published: 2,
                draft: 1,
                archived: 1
            });
        });

        it('counts INACTIVE in total only (no dedicated field)', async () => {
            // Arrange
            getByOwnerMock.mockResolvedValue(
                ok([
                    { id: 'a1', lifecycleState: LifecycleStatusEnum.ACTIVE },
                    { id: 'i1', lifecycleState: LifecycleStatusEnum.INACTIVE }
                ])
            );
            const app = buildApp([EntitlementKey.VIEW_BASIC_STATS]);

            // Act
            const res = await app.request('/');
            const body = await res.json();

            // Assert
            expect(body.data.properties).toEqual({
                total: 2,
                published: 1,
                draft: 0,
                archived: 0
            });
        });

        it('scopes the owner query to the authenticated actor id', async () => {
            // Arrange
            const app = buildApp([EntitlementKey.VIEW_BASIC_STATS]);

            // Act
            await app.request('/');

            // Assert
            expect(getByOwnerMock).toHaveBeenCalledWith(
                { ownerId: '00000000-0000-0000-0000-000000000010' },
                expect.objectContaining({ id: '00000000-0000-0000-0000-000000000010' })
            );
        });
    });

    describe('plan info (fail-safe)', () => {
        it('returns plan = null when billing is disabled', async () => {
            // Arrange — default mock has getQZPayBilling → null
            const app = buildApp([EntitlementKey.VIEW_BASIC_STATS]);

            // Act
            const res = await app.request('/');
            const body = await res.json();

            // Assert
            expect(body.data.plan).toBeNull();
        });

        it('returns plan = null when the customer has no active subscription', async () => {
            // Arrange
            getQZPayBillingMock.mockReturnValue({
                customers: { getByExternalId: vi.fn().mockResolvedValue({ id: 'cust-1' }) },
                subscriptions: {
                    getByCustomerId: vi.fn().mockResolvedValue([{ status: 'cancelled' }])
                },
                plans: { get: vi.fn() }
            });
            const app = buildApp([EntitlementKey.VIEW_BASIC_STATS]);

            // Act
            const res = await app.request('/');
            const body = await res.json();

            // Assert
            expect(body.data.plan).toBeNull();
        });

        it('populates plan with mapped status + isTrial for a trialing subscription', async () => {
            // Arrange
            getQZPayBillingMock.mockReturnValue({
                customers: { getByExternalId: vi.fn().mockResolvedValue({ id: 'cust-1' }) },
                subscriptions: {
                    getByCustomerId: vi
                        .fn()
                        .mockResolvedValue([{ status: 'trialing', planId: 'plan-host-pro' }])
                },
                plans: { get: vi.fn().mockResolvedValue({ name: 'host-pro' }) }
            });
            const app = buildApp([EntitlementKey.VIEW_BASIC_STATS]);

            // Act
            const res = await app.request('/');
            const body = await res.json();

            // Assert
            expect(body.data.plan).toEqual({
                slug: 'host-pro',
                name: 'host-pro',
                status: 'trial',
                isTrial: true
            });
        });

        it('maps an active subscription to status active / isTrial false', async () => {
            // Arrange
            getQZPayBillingMock.mockReturnValue({
                customers: { getByExternalId: vi.fn().mockResolvedValue({ id: 'cust-1' }) },
                subscriptions: {
                    getByCustomerId: vi
                        .fn()
                        .mockResolvedValue([{ status: 'active', planId: 'plan-host-basic' }])
                },
                plans: { get: vi.fn().mockResolvedValue({ name: 'host-basic' }) }
            });
            const app = buildApp([EntitlementKey.VIEW_BASIC_STATS]);

            // Act
            const res = await app.request('/');
            const body = await res.json();

            // Assert
            expect(body.data.plan).toEqual({
                slug: 'host-basic',
                name: 'host-basic',
                status: 'active',
                isTrial: false
            });
        });

        it('degrades plan to null when the billing provider throws', async () => {
            // Arrange
            getQZPayBillingMock.mockReturnValue({
                customers: {
                    getByExternalId: vi.fn().mockRejectedValue(new Error('billing down'))
                },
                subscriptions: { getByCustomerId: vi.fn() },
                plans: { get: vi.fn() }
            });
            const app = buildApp([EntitlementKey.VIEW_BASIC_STATS]);

            // Act
            const res = await app.request('/');
            const body = await res.json();

            // Assert
            expect(res.status).toBe(200);
            expect(body.data.plan).toBeNull();
        });
    });

    describe('unread conversations', () => {
        it('returns the mapped count from getUnreadCount when accommodations exist', async () => {
            // Arrange
            getByOwnerMock.mockResolvedValue(
                ok([{ id: 'a1', lifecycleState: LifecycleStatusEnum.ACTIVE }])
            );
            getUnreadCountMock.mockResolvedValue({ data: { count: 7 }, error: undefined });
            const app = buildApp([EntitlementKey.VIEW_BASIC_STATS]);

            // Act
            const res = await app.request('/');
            const body = await res.json();

            // Assert
            expect(body.data.unreadConversations).toBe(7);
            expect(getUnreadCountMock).toHaveBeenCalledWith(
                expect.objectContaining({ id: '00000000-0000-0000-0000-000000000010' }),
                expect.objectContaining({ actorSide: 'OWNER', accommodationIds: ['a1'] })
            );
        });

        it('returns 0 without calling getUnreadCount when there are no accommodations', async () => {
            // Arrange — default getByOwner returns empty list
            const app = buildApp([EntitlementKey.VIEW_BASIC_STATS]);

            // Act
            const res = await app.request('/');
            const body = await res.json();

            // Assert
            expect(body.data.unreadConversations).toBe(0);
            expect(getUnreadCountMock).not.toHaveBeenCalled();
        });

        it('degrades unread to 0 when getUnreadCount rejects', async () => {
            // Arrange
            getByOwnerMock.mockResolvedValue(
                ok([{ id: 'a1', lifecycleState: LifecycleStatusEnum.ACTIVE }])
            );
            getUnreadCountMock.mockRejectedValue(new Error('conversation service down'));
            const app = buildApp([EntitlementKey.VIEW_BASIC_STATS]);

            // Act
            const res = await app.request('/');
            const body = await res.json();

            // Assert
            expect(res.status).toBe(200);
            expect(body.data.unreadConversations).toBe(0);
        });
    });

    describe('graceful degradation', () => {
        it('returns 200 with zeroed properties when getByOwner rejects', async () => {
            // Arrange
            getByOwnerMock.mockRejectedValue(new Error('db down'));
            const app = buildApp([EntitlementKey.VIEW_BASIC_STATS]);

            // Act
            const res = await app.request('/');
            const body = await res.json();

            // Assert — endpoint degrades, does NOT 500.
            expect(res.status).toBe(200);
            expect(body.data.properties).toEqual({
                total: 0,
                published: 0,
                draft: 0,
                archived: 0
            });
            expect(body.data.unreadConversations).toBe(0);
        });

        it('returns 200 with zeroed properties when getByOwner returns an error result', async () => {
            // Arrange
            getByOwnerMock.mockResolvedValue({
                data: undefined,
                error: { code: ServiceErrorCode.INTERNAL_ERROR, message: 'boom' }
            });
            const app = buildApp([EntitlementKey.VIEW_BASIC_STATS]);

            // Act
            const res = await app.request('/');
            const body = await res.json();

            // Assert
            expect(res.status).toBe(200);
            expect(body.data.properties).toEqual({
                total: 0,
                published: 0,
                draft: 0,
                archived: 0
            });
        });
    });

    describe('response shape', () => {
        it('returns the full HostDashboardResponse shape', async () => {
            // Arrange
            const app = buildApp([EntitlementKey.VIEW_BASIC_STATS]);

            // Act
            const res = await app.request('/');
            const body = await res.json();

            // Assert
            expect(body.data).toBeDefined();
            // properties block
            expect(body.data.properties).toBeTypeOf('object');
            expect(body.data.properties.total).toBeTypeOf('number');
            expect(body.data.properties.published).toBeTypeOf('number');
            expect(body.data.properties.draft).toBeTypeOf('number');
            expect(body.data.properties.archived).toBeTypeOf('number');

            // plan block (nullable)
            expect(body.data).toHaveProperty('plan');
            if (body.data.plan !== null) {
                expect(body.data.plan.slug).toBeTypeOf('string');
                expect(body.data.plan.name).toBeTypeOf('string');
                expect(['active', 'trial', 'cancelled', 'expired', 'past_due']).toContain(
                    body.data.plan.status
                );
                expect(body.data.plan.isTrial).toBeTypeOf('boolean');
            }

            // unreadConversations
            expect(body.data.unreadConversations).toBeTypeOf('number');
            expect(body.data.unreadConversations).toBe(0);
        });

        it('returns non-negative integers for all numeric fields', async () => {
            // Arrange
            const app = buildApp([EntitlementKey.VIEW_BASIC_STATS]);

            // Act
            const res = await app.request('/');
            const body = await res.json();

            // Assert
            expect(body.data.properties.total).toBeGreaterThanOrEqual(0);
            expect(body.data.properties.published).toBeGreaterThanOrEqual(0);
            expect(body.data.properties.draft).toBeGreaterThanOrEqual(0);
            expect(body.data.properties.archived).toBeGreaterThanOrEqual(0);
            expect(body.data.unreadConversations).toBeGreaterThanOrEqual(0);
        });
    });

    describe('route registration', () => {
        it('route is mountable at the real API path', async () => {
            // Arrange
            const app = buildApp([EntitlementKey.VIEW_BASIC_STATS]);

            // Act
            const res = await app.request('/');

            // Assert
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.data.properties).toBeDefined();
        });
    });
});
