/** Host dashboard property counts and unread conversations after plan removal. */
import { LifecycleStatusEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../src/types';

// ---------------------------------------------------------------------------
// Mocks — the route calls real services. We mock those
// so we can assert the MAPPED dashboard shape. `@repo/service-core` keeps its
// real exports (ServiceError / RoleEnum are used by the entitlement middleware
// and the route's error path) and only overrides the two service classes.
// ---------------------------------------------------------------------------

const getByOwnerMock = vi.fn();
const getUnreadCountMock = vi.fn();

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

    // Default: no accommodations and no unread conversations.
    getByOwnerMock.mockResolvedValue(ok([]));
    getUnreadCountMock.mockResolvedValue({ data: { count: 0 }, error: undefined });
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
            roles: [RoleEnum.HOST],
            permissions: []
        });
        return next();
    });
}

/**
 * Build a test app with the given entitlement keys.
 * Middleware order: error handler → actor → entitlements → route.
 * Entitlements are set BEFORE the route is mounted so they run first.
 */
function buildApp(): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    attachTestErrorHandler(app);
    injectHostActor(app);
    app.route('/', hostDashboardRoute);
    return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/v1/protected/host/dashboard (SPEC-205)', () => {
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
            const app = buildApp();

            // Act
            const res = await app.request('/dashboard');
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
            const app = buildApp();

            // Act
            const res = await app.request('/dashboard');
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
            const app = buildApp();

            // Act
            await app.request('/dashboard');

            // Assert
            expect(getByOwnerMock).toHaveBeenCalledWith(
                { ownerId: '00000000-0000-0000-0000-000000000010' },
                expect.objectContaining({ id: '00000000-0000-0000-0000-000000000010' })
            );
        });
    });

    describe('unread conversations', () => {
        it('returns the mapped count from getUnreadCount when accommodations exist', async () => {
            // Arrange
            getByOwnerMock.mockResolvedValue(
                ok([{ id: 'a1', lifecycleState: LifecycleStatusEnum.ACTIVE }])
            );
            getUnreadCountMock.mockResolvedValue({ data: { count: 7 }, error: undefined });
            const app = buildApp();

            // Act
            const res = await app.request('/dashboard');
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
            const app = buildApp();

            // Act
            const res = await app.request('/dashboard');
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
            const app = buildApp();

            // Act
            const res = await app.request('/dashboard');
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
            const app = buildApp();

            // Act
            const res = await app.request('/dashboard');
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
            const app = buildApp();

            // Act
            const res = await app.request('/dashboard');
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
            const app = buildApp();

            // Act
            const res = await app.request('/dashboard');
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
            const app = buildApp();

            // Act
            const res = await app.request('/dashboard');
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
            const app = buildApp();

            // Act
            const res = await app.request('/dashboard');

            // Assert
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.data.properties).toBeDefined();
        });
    });
});
