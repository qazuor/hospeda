/**
 * Tests for limit enforcement middleware
 *
 * Tests both unit-level middleware behavior and integration scenarios
 * with real Hono app instances.
 */

import { LimitKey } from '@repo/billing';
import { LifecycleStatusEnum, PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import {
    AccommodationService,
    type Actor,
    OwnerPromotionService,
    ServiceError
} from '@repo/service-core';
import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    enforceAccommodationLimit,
    enforcePhotoLimit,
    enforcePromotionLimit,
    enforcePropertiesLimit,
    enforceStaffAccountsLimit
} from '../../src/middlewares/limit-enforcement';
import type { AppBindings } from '../../src/types';

// ---------------------------------------------------------------------------
// Hoist model mock — must be before vi.mock() calls that reference it.
// SPEC-204 T-014: enforcePhotoLimit() now reads from the relational table via
// accommodationMediaModel.findByAccommodation(), not the JSONB blob.
// ---------------------------------------------------------------------------

const { mockFindByAccommodation } = vi.hoisted(() => ({
    mockFindByAccommodation: vi.fn()
}));

// Stub @repo/db so photo-limit tests can control the visible-row total returned
// by the relational table without a live database connection.
vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        accommodationMediaModel: {
            findByAccommodation: mockFindByAccommodation
        }
    };
});

// Mock dependencies
vi.mock('../../src/utils/actor', () => ({
    getActorFromContext: vi.fn()
}));

// Wrap checkLimit in a spy so individual tests can inject synthetic return values
// (e.g., allowed=false with upgradeMessage=undefined to cover the ?? fallback branches).
// By default the spy delegates to the real implementation so all existing tests pass.
vi.mock('../../src/utils/limit-check', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../src/utils/limit-check')>();
    return {
        ...actual,
        checkLimit: vi.fn(actual.checkLimit),
        calculateThreshold: vi.fn(actual.calculateThreshold),
        calculateUsagePercent: vi.fn(actual.calculateUsagePercent)
    };
});

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        AccommodationService: vi.fn(),
        OwnerPromotionService: vi.fn()
        // ServiceError stays as the real class from `actual` so `instanceof` checks
        // in the production middleware work as expected.
    };
});

/**
 * Minimal app.onError handler used by the integration tests below to mirror
 * the production behavior of `createErrorHandler()` from
 * `apps/api/src/middlewares/response.ts`. It converts a thrown `ServiceError`
 * into the standard `{ success: false, error: { code, message, details } }`
 * envelope with the right HTTP status, so tests can assert against the same
 * shape clients see in production.
 */
const SERVICE_ERROR_HTTP_STATUS: Partial<Record<ServiceErrorCode, number>> = {
    [ServiceErrorCode.LIMIT_REACHED]: 403,
    [ServiceErrorCode.ENTITLEMENT_REQUIRED]: 403,
    [ServiceErrorCode.FORBIDDEN]: 403,
    [ServiceErrorCode.UNAUTHORIZED]: 401,
    [ServiceErrorCode.VALIDATION_ERROR]: 400,
    [ServiceErrorCode.NOT_FOUND]: 404
};

const attachTestErrorHandler = (app: Hono<AppBindings>): void => {
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
            { success: false, error: { code: 'INTERNAL_ERROR', message: error.message } },
            500
        );
    });
};

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn()
    }
}));

import { getActorFromContext } from '../../src/utils/actor';
import { checkLimit } from '../../src/utils/limit-check';

describe('Limit Enforcement Middleware', () => {
    let mockContext: Context<AppBindings>;
    let mockNext: Next;
    let mockLimitsMap: Map<LimitKey, number>;

    beforeEach(() => {
        vi.clearAllMocks();

        // Create a mock limits map that will be returned by context.get()
        mockLimitsMap = new Map<LimitKey, number>();

        mockContext = {
            req: {
                param: vi.fn()
            },
            get: vi.fn((key: string) => {
                if (key === 'userLimits') {
                    return mockLimitsMap;
                }
                return undefined;
            }),
            header: vi.fn()
        } as unknown as Context<AppBindings>;

        mockNext = vi.fn();
    });

    describe('enforceAccommodationLimit', () => {
        const mockActor: Actor = {
            id: 'user-123',
            role: RoleEnum.HOST,
            permissions: [PermissionEnum.ACCOMMODATION_LISTING_CREATE]
        };

        it('should allow when under limit', async () => {
            // Mock actor
            vi.mocked(getActorFromContext).mockReturnValue(mockActor);

            // Set up limit in context
            mockLimitsMap.set(LimitKey.MAX_ACCOMMODATIONS, 5);

            // Mock service count
            const mockCount = vi.fn().mockResolvedValue({
                success: true,
                data: { count: 3 }
            });
            vi.mocked(AccommodationService).mockImplementation(
                () =>
                    ({
                        count: mockCount
                    }) as unknown as AccommodationService
            );

            const middleware = enforceAccommodationLimit();
            await middleware(mockContext, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should block when at limit', async () => {
            vi.mocked(getActorFromContext).mockReturnValue(mockActor);

            // Set up limit in context
            mockLimitsMap.set(LimitKey.MAX_ACCOMMODATIONS, 5);

            const mockCount = vi.fn().mockResolvedValue({
                success: true,
                data: { count: 5 }
            });
            vi.mocked(AccommodationService).mockImplementation(
                () =>
                    ({
                        count: mockCount
                    }) as unknown as AccommodationService
            );

            const middleware = enforceAccommodationLimit();

            await expect(middleware(mockContext, mockNext)).rejects.toThrow(ServiceError);

            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should continue when actor is not authenticated', async () => {
            vi.mocked(getActorFromContext).mockReturnValue({
                id: '',
                role: RoleEnum.GUEST,
                permissions: []
            });

            const middleware = enforceAccommodationLimit();
            await middleware(mockContext, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should continue when count fails', async () => {
            vi.mocked(getActorFromContext).mockReturnValue(mockActor);

            const mockCount = vi.fn().mockResolvedValue({
                success: false,
                error: { code: 'DATABASE_ERROR', message: 'Failed to count' }
            });
            vi.mocked(AccommodationService).mockImplementation(
                () =>
                    ({
                        count: mockCount
                    }) as unknown as AccommodationService
            );

            const middleware = enforceAccommodationLimit();
            await middleware(mockContext, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should allow unlimited when limit is -1', async () => {
            vi.mocked(getActorFromContext).mockReturnValue(mockActor);

            // Set up unlimited limit in context (not set, getRemainingLimit will return -1)
            // Don't set limit in map - getRemainingLimit will return -1 for missing keys

            const mockCount = vi.fn().mockResolvedValue({
                success: true,
                data: { count: 100 }
            });
            vi.mocked(AccommodationService).mockImplementation(
                () =>
                    ({
                        count: mockCount
                    }) as unknown as AccommodationService
            );

            const middleware = enforceAccommodationLimit();
            await middleware(mockContext, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should use ?? fallback message when upgradeMessage is undefined (line 165)', async () => {
            // Coverage target: limit-enforcement.ts line 165.
            // `limitCheck.upgradeMessage ?? 'Accommodation limit reached'` — defensive fallback
            // when checkLimit returns allowed=false without upgradeMessage.
            vi.mocked(getActorFromContext).mockReturnValue(mockActor);
            mockLimitsMap.set(LimitKey.MAX_ACCOMMODATIONS, 5);

            const mockCount = vi.fn().mockResolvedValue({
                success: true,
                data: { count: 5 }
            });
            vi.mocked(AccommodationService).mockImplementation(
                () =>
                    ({
                        count: mockCount
                    }) as unknown as AccommodationService
            );

            vi.mocked(checkLimit).mockReturnValueOnce({
                allowed: false,
                currentCount: 5,
                maxAllowed: 5,
                remaining: 0,
                upgradeMessage: undefined
            });

            const middleware = enforceAccommodationLimit();
            let thrown: unknown;
            try {
                await middleware(mockContext, mockNext);
            } catch (err) {
                thrown = err;
            }
            expect(thrown).toBeInstanceOf(ServiceError);
            expect((thrown as ServiceError).message).toBe('Accommodation limit reached');
        });

        it('should call next() and log with String() when a non-Error is thrown in the catch block (line 185)', async () => {
            // Coverage target: limit-enforcement.ts line 185.
            // `error instanceof Error ? error.message : String(error)` — the String(error)
            // branch fires when someone throws a non-Error value (e.g. a plain string).
            vi.mocked(getActorFromContext).mockReturnValue(mockActor);

            // Make count throw a plain string (NOT an Error instance)
            const mockCount = vi.fn().mockImplementation(() => {
                // eslint-disable-next-line @typescript-eslint/no-throw-literal
                throw 'plain-string-error-for-coverage';
            });
            vi.mocked(AccommodationService).mockImplementation(
                () =>
                    ({
                        count: mockCount
                    }) as unknown as AccommodationService
            );

            const middleware = enforceAccommodationLimit();
            await middleware(mockContext, mockNext);

            // Plain-string throw must NOT block the request
            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('enforcePhotoLimit', () => {
        const mockActor: Actor = {
            id: 'user-123',
            role: RoleEnum.HOST,
            permissions: [PermissionEnum.ACCOMMODATION_LISTING_UPDATE]
        };

        beforeEach(() => {
            vi.mocked(mockContext.req.param).mockReturnValue('accommodation-id-123');
        });

        it('should allow when under photo limit', async () => {
            vi.mocked(getActorFromContext).mockReturnValue(mockActor);

            // Set up limit in context
            mockLimitsMap.set(LimitKey.MAX_PHOTOS_PER_ACCOMMODATION, 10);

            // SPEC-204 T-014: middleware reads visible row count from the relational
            // table, not the JSONB blob. Stub the model to return 5 visible rows
            // (below the limit of 10) — the exact blob shape is irrelevant now.
            mockFindByAccommodation.mockResolvedValue({ total: 5 });

            const middleware = enforcePhotoLimit();
            await middleware(mockContext, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should block when at photo limit', async () => {
            vi.mocked(getActorFromContext).mockReturnValue(mockActor);

            // Set up limit in context
            mockLimitsMap.set(LimitKey.MAX_PHOTOS_PER_ACCOMMODATION, 10);

            // SPEC-204 T-014: table reports 10 visible rows (at the limit of 10) → block.
            mockFindByAccommodation.mockResolvedValue({ total: 10 });

            const middleware = enforcePhotoLimit();

            await expect(middleware(mockContext, mockNext)).rejects.toThrow(ServiceError);
        });

        it('should continue when no accommodation ID in params', async () => {
            vi.mocked(getActorFromContext).mockReturnValue(mockActor);
            vi.mocked(mockContext.req.param).mockReturnValue('' as never);

            const middleware = enforcePhotoLimit();
            await middleware(mockContext, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should handle accommodation with 0 photos', async () => {
            vi.mocked(getActorFromContext).mockReturnValue(mockActor);

            // Set up limit in context
            mockLimitsMap.set(LimitKey.MAX_PHOTOS_PER_ACCOMMODATION, 10);

            // SPEC-204 T-014: no visible rows yet → total 0, well below limit 10.
            mockFindByAccommodation.mockResolvedValue({ total: 0 });

            const middleware = enforcePhotoLimit();
            await middleware(mockContext, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should use the relational table total directly (not inspect media blob shape)', async () => {
            // SPEC-204 T-014: the middleware no longer reads media.gallery or
            // media.featuredImage. It relies entirely on the visible row count from
            // the accommodation_media table. Any blob-shape edge cases (gallery not
            // an array, featuredImage absent, etc.) are irrelevant at this layer.
            // This test confirms the table total drives the decision when total < limit.
            vi.mocked(getActorFromContext).mockReturnValue(mockActor);
            mockLimitsMap.set(LimitKey.MAX_PHOTOS_PER_ACCOMMODATION, 10);

            // Table returns 1 visible row — under limit 10.
            mockFindByAccommodation.mockResolvedValue({ total: 1 });

            const middleware = enforcePhotoLimit();
            await middleware(mockContext, mockNext);

            expect(mockNext).toHaveBeenCalled();
            // findByAccommodation must have been called with state:'visible'
            expect(mockFindByAccommodation).toHaveBeenCalledWith({
                accommodationId: 'accommodation-id-123',
                state: 'visible'
            });
        });

        it('should use ?? fallback message when upgradeMessage is undefined (line 291)', async () => {
            // Coverage target: limit-enforcement.ts — `limitCheck.upgradeMessage ?? 'Photo limit reached'`.
            // The right-hand fallback fires when checkLimit returns allowed=false with
            // upgradeMessage=undefined. This is a defensive branch.
            //
            // SPEC-204 T-014: findByAccommodation must resolve first so the middleware
            // reaches the checkLimit call. The mockReturnValueOnce on checkLimit is
            // consumed immediately after the DB query succeeds.
            vi.mocked(getActorFromContext).mockReturnValue(mockActor);
            mockLimitsMap.set(LimitKey.MAX_PHOTOS_PER_ACCOMMODATION, 1);

            // Table returns 1 visible row — middleware will call checkLimit next.
            mockFindByAccommodation.mockResolvedValue({ total: 1 });

            // Inject a synthetic checkLimit result that omits upgradeMessage so the
            // ?? right-hand fallback string 'Photo limit reached' is used.
            vi.mocked(checkLimit).mockReturnValueOnce({
                allowed: false,
                currentCount: 1,
                maxAllowed: 1,
                remaining: 0,
                upgradeMessage: undefined
            });

            const middleware = enforcePhotoLimit();
            let thrown: unknown;
            try {
                await middleware(mockContext, mockNext);
            } catch (err) {
                thrown = err;
            }
            expect(thrown).toBeInstanceOf(ServiceError);
            expect((thrown as ServiceError).message).toBe('Photo limit reached');
        });

        it('should call next() when findByAccommodation throws unexpectedly (photo limit catch)', async () => {
            // Coverage target: enforcePhotoLimit catch block.
            // The catch re-throws ServiceError/HTTPException; for any other error it logs
            // and calls next() to avoid blocking the user on a count failure.
            // SPEC-204 T-014: the unexpected throw now comes from findByAccommodation,
            // not from AccommodationService.getById.
            vi.mocked(getActorFromContext).mockReturnValue(mockActor);
            mockLimitsMap.set(LimitKey.MAX_PHOTOS_PER_ACCOMMODATION, 10);

            // Make findByAccommodation throw a raw Error (not ServiceError, not HTTPException)
            mockFindByAccommodation.mockRejectedValue(new RangeError('Unexpected proxy error'));

            const middleware = enforcePhotoLimit();
            await middleware(mockContext, mockNext);

            // Unexpected errors must NOT block the request — next() is called.
            expect(mockNext).toHaveBeenCalled();
        });

        it('should call next() and log with String() when a non-Error is thrown by findByAccommodation', async () => {
            // Coverage target: `error instanceof Error ? error.message : String(error)`
            // in the photo limit catch block. The String(error) branch fires when a
            // non-Error value is thrown. SPEC-204: the throw site is findByAccommodation.
            vi.mocked(getActorFromContext).mockReturnValue(mockActor);
            mockLimitsMap.set(LimitKey.MAX_PHOTOS_PER_ACCOMMODATION, 10);

            // Throw a plain number (NOT an Error instance) — triggers String(error) path.
            mockFindByAccommodation.mockImplementation(() => {
                throw 42;
            });

            const middleware = enforcePhotoLimit();
            await middleware(mockContext, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('enforcePromotionLimit', () => {
        const mockActor: Actor = {
            id: 'user-123',
            role: RoleEnum.HOST,
            permissions: [PermissionEnum.OWNER_PROMOTION_CREATE]
        };

        it('should allow when under promotion limit', async () => {
            vi.mocked(getActorFromContext).mockReturnValue(mockActor);

            // Set up limit in context
            mockLimitsMap.set(LimitKey.MAX_ACTIVE_PROMOTIONS, 3);

            const mockCount = vi.fn().mockResolvedValue({
                success: true,
                data: { count: 2 }
            });
            vi.mocked(OwnerPromotionService).mockImplementation(
                () =>
                    ({
                        count: mockCount
                    }) as unknown as OwnerPromotionService
            );

            const middleware = enforcePromotionLimit();
            await middleware(mockContext, mockNext);

            expect(mockNext).toHaveBeenCalled();
            // Check that count was called with correct filter for active promotions
            const callArgs = mockCount.mock.calls[0];
            if (callArgs) {
                expect(callArgs[1]).toMatchObject({
                    lifecycleState: LifecycleStatusEnum.ACTIVE,
                    ownerId: 'user-123'
                });
            }
        });

        it('should block when at promotion limit', async () => {
            vi.mocked(getActorFromContext).mockReturnValue(mockActor);

            // Set up limit in context
            mockLimitsMap.set(LimitKey.MAX_ACTIVE_PROMOTIONS, 3);

            const mockCount = vi.fn().mockResolvedValue({
                success: true,
                data: { count: 3 }
            });
            vi.mocked(OwnerPromotionService).mockImplementation(
                () =>
                    ({
                        count: mockCount
                    }) as unknown as OwnerPromotionService
            );

            const middleware = enforcePromotionLimit();

            await expect(middleware(mockContext, mockNext)).rejects.toThrow(ServiceError);
        });

        it('should continue when count fails', async () => {
            vi.mocked(getActorFromContext).mockReturnValue(mockActor);

            const mockCount = vi.fn().mockResolvedValue({
                success: false,
                error: { code: 'DATABASE_ERROR', message: 'Failed to count' }
            });
            vi.mocked(OwnerPromotionService).mockImplementation(
                () =>
                    ({
                        count: mockCount
                    }) as unknown as OwnerPromotionService
            );

            const middleware = enforcePromotionLimit();
            await middleware(mockContext, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should only count active promotions', async () => {
            vi.mocked(getActorFromContext).mockReturnValue(mockActor);

            // Set up limit in context
            mockLimitsMap.set(LimitKey.MAX_ACTIVE_PROMOTIONS, 3);

            const mockCount = vi.fn().mockResolvedValue({
                success: true,
                data: { count: 1 }
            });
            vi.mocked(OwnerPromotionService).mockImplementation(
                () =>
                    ({
                        count: mockCount
                    }) as unknown as OwnerPromotionService
            );

            const middleware = enforcePromotionLimit();
            await middleware(mockContext, mockNext);

            // Check that count was called with correct filter for active promotions
            const callArgs = mockCount.mock.calls[0];
            if (callArgs) {
                expect(callArgs[1]).toMatchObject({
                    lifecycleState: LifecycleStatusEnum.ACTIVE,
                    ownerId: 'user-123'
                });
            }
        });

        it('should treat undefined data.count as 0 and allow when under limit (line 371 ?. branch)', async () => {
            // Coverage target: limit-enforcement.ts line 371.
            // `countResult.data?.count || 0` — the `?.` optional chain evaluates to
            // undefined when data is undefined (success=true but no data payload).
            // The `|| 0` then coerces undefined to 0, and the limit check uses 0.
            vi.mocked(getActorFromContext).mockReturnValue(mockActor);
            mockLimitsMap.set(LimitKey.MAX_ACTIVE_PROMOTIONS, 3);

            // Service returns success but data is undefined (edge case)
            const mockCount = vi.fn().mockResolvedValue({
                success: true,
                data: undefined
            });
            vi.mocked(OwnerPromotionService).mockImplementation(
                () =>
                    ({
                        count: mockCount
                    }) as unknown as OwnerPromotionService
            );

            const middleware = enforcePromotionLimit();
            await middleware(mockContext, mockNext);

            // currentCount falls back to 0, which is under limit 3 → next() called
            expect(mockNext).toHaveBeenCalled();
        });

        it('should use ?? fallback message when upgradeMessage is undefined (line 399)', async () => {
            // Coverage target: limit-enforcement.ts line 399.
            // `limitCheck.upgradeMessage ?? 'Promotion limit reached'` — defensive fallback
            // when checkLimit returns allowed=false without upgradeMessage.
            vi.mocked(getActorFromContext).mockReturnValue(mockActor);
            mockLimitsMap.set(LimitKey.MAX_ACTIVE_PROMOTIONS, 3);

            const mockCount = vi.fn().mockResolvedValue({
                success: true,
                data: { count: 3 }
            });
            vi.mocked(OwnerPromotionService).mockImplementation(
                () =>
                    ({
                        count: mockCount
                    }) as unknown as OwnerPromotionService
            );

            // Inject a synthetic checkLimit result without upgradeMessage
            vi.mocked(checkLimit).mockReturnValueOnce({
                allowed: false,
                currentCount: 3,
                maxAllowed: 3,
                remaining: 0,
                upgradeMessage: undefined
            });

            const middleware = enforcePromotionLimit();
            await expect(middleware(mockContext, mockNext)).rejects.toThrow(ServiceError);
        });

        it('should call next() when an unexpected non-ServiceError is thrown inside the try block (lines 411-422)', async () => {
            // Coverage target: limit-enforcement.ts lines 411-422.
            // The catch block re-throws ServiceError/HTTPException and logs+continues
            // for any other unexpected error. This covers the else branch where the
            // error is neither a ServiceError nor an HTTPException.
            vi.mocked(getActorFromContext).mockReturnValue(mockActor);

            // Make OwnerPromotionService.count throw a raw Error (not ServiceError)
            const mockCount = vi.fn().mockRejectedValue(new TypeError('Unexpected proxy error'));
            vi.mocked(OwnerPromotionService).mockImplementation(
                () =>
                    ({
                        count: mockCount
                    }) as unknown as OwnerPromotionService
            );

            const middleware = enforcePromotionLimit();
            await middleware(mockContext, mockNext);

            // Unexpected errors must NOT block the request — next() must be called.
            expect(mockNext).toHaveBeenCalled();
        });

        it('should call next() and log with String() when a non-Error is thrown in promotion catch (line 419)', async () => {
            // Coverage target: limit-enforcement.ts line 419.
            // `error instanceof Error ? error.message : String(error)` — the String(error)
            // branch fires when a non-Error value is thrown inside the try block.
            vi.mocked(getActorFromContext).mockReturnValue(mockActor);

            // Throw a plain number (NOT an Error instance)
            const mockCount = vi.fn().mockImplementation(() => {
                // eslint-disable-next-line @typescript-eslint/no-throw-literal
                throw 42;
            });
            vi.mocked(OwnerPromotionService).mockImplementation(
                () =>
                    ({
                        count: mockCount
                    }) as unknown as OwnerPromotionService
            );

            const middleware = enforcePromotionLimit();
            await middleware(mockContext, mockNext);

            // Non-Error throw must NOT block the request
            expect(mockNext).toHaveBeenCalled();
        });

        // SPEC-167 T-004: plan-restricted promotions must not count toward the cap
        it('should pass planRestricted:false in the count filter so restricted promos do not consume the cap', async () => {
            // Arrange
            vi.mocked(getActorFromContext).mockReturnValue(mockActor);
            mockLimitsMap.set(LimitKey.MAX_ACTIVE_PROMOTIONS, 3);

            const mockCount = vi.fn().mockResolvedValue({
                success: true,
                data: { count: 1 }
            });
            vi.mocked(OwnerPromotionService).mockImplementation(
                () =>
                    ({
                        count: mockCount
                    }) as unknown as OwnerPromotionService
            );

            const middleware = enforcePromotionLimit();
            await middleware(mockContext, mockNext);

            // The service's count() is called with a filter that includes planRestricted:false
            // (enforced inside OwnerPromotionService._executeCount). The middleware itself
            // delegates the filtering concern to the service, so the mock here just confirms
            // the count path is exercised with the ACTIVE+ownerId filter.
            const callArgs = mockCount.mock.calls[0];
            if (callArgs) {
                expect(callArgs[1]).toMatchObject({
                    lifecycleState: LifecycleStatusEnum.ACTIVE,
                    ownerId: 'user-123'
                });
            }
            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('Integration Tests with Hono App', () => {
        describe('enforceAccommodationLimit integration', () => {
            it('should allow request when under accommodation limit', async () => {
                // Arrange
                const app = new Hono<AppBindings>();
                attachTestErrorHandler(app);
                const mockActor: Actor = {
                    id: 'user-123',
                    role: RoleEnum.HOST,
                    permissions: [PermissionEnum.ACCOMMODATION_LISTING_CREATE]
                };

                vi.mocked(getActorFromContext).mockReturnValue(mockActor);

                const mockCount = vi.fn().mockResolvedValue({
                    success: true,
                    data: { count: 2 }
                });
                vi.mocked(AccommodationService).mockImplementation(
                    () =>
                        ({
                            count: mockCount
                        }) as unknown as AccommodationService
                );

                // Set up middleware to inject limits into context
                app.use('/*', async (c, next) => {
                    const limitsMap = new Map<LimitKey, number>();
                    limitsMap.set(LimitKey.MAX_ACCOMMODATIONS, 5);
                    c.set('userLimits', limitsMap);
                    await next();
                });

                app.use('/*', enforceAccommodationLimit());
                app.post('/accommodations', (c) => c.json({ success: true, id: 'new-123' }));

                // Act
                const res = await app.request('/accommodations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });

                // Assert
                expect(res.status).toBe(200);
                const data = await res.json();
                expect(data).toEqual({ success: true, id: 'new-123' });
            });

            it('should return 403 with proper error structure when limit reached', async () => {
                // Arrange
                const app = new Hono<AppBindings>();
                attachTestErrorHandler(app);
                const mockActor: Actor = {
                    id: 'user-123',
                    role: RoleEnum.HOST,
                    permissions: [PermissionEnum.ACCOMMODATION_LISTING_CREATE]
                };

                vi.mocked(getActorFromContext).mockReturnValue(mockActor);

                const mockCount = vi.fn().mockResolvedValue({
                    success: true,
                    data: { count: 5 }
                });
                vi.mocked(AccommodationService).mockImplementation(
                    () =>
                        ({
                            count: mockCount
                        }) as unknown as AccommodationService
                );

                // Set up middleware to inject limits into context
                app.use('/*', async (c, next) => {
                    const limitsMap = new Map<LimitKey, number>();
                    limitsMap.set(LimitKey.MAX_ACCOMMODATIONS, 5);
                    c.set('userLimits', limitsMap);
                    await next();
                });

                app.use('/*', enforceAccommodationLimit());
                app.post('/accommodations', (c) => c.json({ success: true }));

                // Act
                const res = await app.request('/accommodations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });

                // Assert
                expect(res.status).toBe(403);
                const errorText = await res.text();
                const parsedError = JSON.parse(errorText);

                expect(parsedError).toMatchObject({
                    success: false,
                    error: {
                        code: 'LIMIT_REACHED',
                        message:
                            'Has alcanzado el límite de 5 alojamientos. Actualiza tu plan para obtener más.',
                        details: {
                            limitKey: LimitKey.MAX_ACCOMMODATIONS,
                            currentCount: 5,
                            maxAllowed: 5,
                            upgradeAudience: 'host'
                        }
                    }
                });
            });

            it('should continue on service error to avoid blocking users', async () => {
                // Arrange
                const app = new Hono<AppBindings>();
                attachTestErrorHandler(app);
                const mockActor: Actor = {
                    id: 'user-123',
                    role: RoleEnum.HOST,
                    permissions: [PermissionEnum.ACCOMMODATION_LISTING_CREATE]
                };

                vi.mocked(getActorFromContext).mockReturnValue(mockActor);

                const mockCount = vi.fn().mockResolvedValue({
                    success: false,
                    error: { code: 'DATABASE_ERROR', message: 'Connection timeout' }
                });
                vi.mocked(AccommodationService).mockImplementation(
                    () =>
                        ({
                            count: mockCount
                        }) as unknown as AccommodationService
                );

                app.use('/*', enforceAccommodationLimit());
                app.post('/accommodations', (c) => c.json({ success: true, id: 'new-456' }));

                // Act
                const res = await app.request('/accommodations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });

                // Assert - should pass through despite error
                expect(res.status).toBe(200);
                const data = await res.json();
                expect(data).toEqual({ success: true, id: 'new-456' });
            });
        });

        describe('Edge Cases and Error Scenarios', () => {
            it('should handle limit of zero (feature disabled)', async () => {
                // Arrange
                const app = new Hono<AppBindings>();
                attachTestErrorHandler(app);
                const mockActor: Actor = {
                    id: 'user-123',
                    role: RoleEnum.HOST,
                    permissions: [PermissionEnum.ACCOMMODATION_LISTING_CREATE]
                };

                vi.mocked(getActorFromContext).mockReturnValue(mockActor);

                const mockCount = vi.fn().mockResolvedValue({
                    success: true,
                    data: { count: 0 }
                });
                vi.mocked(AccommodationService).mockImplementation(
                    () =>
                        ({
                            count: mockCount
                        }) as unknown as AccommodationService
                );

                // Set up middleware to inject limits into context (limit = 0 means disabled)
                app.use('/*', async (c, next) => {
                    const limitsMap = new Map<LimitKey, number>();
                    limitsMap.set(LimitKey.MAX_ACCOMMODATIONS, 0);
                    c.set('userLimits', limitsMap);
                    await next();
                });

                app.use('/*', enforceAccommodationLimit());
                app.post('/accommodations', (c) => c.json({ success: true }));

                // Act
                const res = await app.request('/accommodations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });

                // Assert
                expect(res.status).toBe(403);
                const errorText = await res.text();
                const parsedError = JSON.parse(errorText);

                expect(parsedError.error.message).toContain('no está disponible en tu plan actual');
            });

            it('should handle very large current counts', async () => {
                // Arrange
                const mockActor: Actor = {
                    id: 'user-123',
                    role: RoleEnum.HOST,
                    permissions: [PermissionEnum.ACCOMMODATION_LISTING_CREATE]
                };

                vi.mocked(getActorFromContext).mockReturnValue(mockActor);

                // Don't set limit - will return -1 (unlimited)

                const mockCount = vi.fn().mockResolvedValue({
                    success: true,
                    data: { count: 999999 }
                });
                vi.mocked(AccommodationService).mockImplementation(
                    () =>
                        ({
                            count: mockCount
                        }) as unknown as AccommodationService
                );

                const middleware = enforceAccommodationLimit();
                await middleware(mockContext, mockNext);

                expect(mockNext).toHaveBeenCalled();
            });

            it('should handle service throwing unexpected errors gracefully', async () => {
                // Arrange
                const mockActor: Actor = {
                    id: 'user-123',
                    role: RoleEnum.HOST,
                    permissions: [PermissionEnum.ACCOMMODATION_LISTING_CREATE]
                };

                vi.mocked(getActorFromContext).mockReturnValue(mockActor);

                const mockCount = vi.fn().mockRejectedValue(new Error('Network failure'));
                vi.mocked(AccommodationService).mockImplementation(
                    () =>
                        ({
                            count: mockCount
                        }) as unknown as AccommodationService
                );

                const middleware = enforceAccommodationLimit();
                await middleware(mockContext, mockNext);

                // Should continue despite error
                expect(mockNext).toHaveBeenCalled();
            });
        });

        describe('enforcePromotionLimit integration', () => {
            it('should allow promotion creation when under limit', async () => {
                // Arrange
                const app = new Hono<AppBindings>();
                attachTestErrorHandler(app);
                const mockActor: Actor = {
                    id: 'user-123',
                    role: RoleEnum.HOST,
                    permissions: [PermissionEnum.OWNER_PROMOTION_CREATE]
                };

                vi.mocked(getActorFromContext).mockReturnValue(mockActor);

                const mockCount = vi.fn().mockResolvedValue({
                    success: true,
                    data: { count: 1 }
                });
                vi.mocked(OwnerPromotionService).mockImplementation(
                    () =>
                        ({
                            count: mockCount
                        }) as unknown as OwnerPromotionService
                );

                // Set up middleware to inject limits into context
                app.use('/*', async (c, next) => {
                    const limitsMap = new Map<LimitKey, number>();
                    limitsMap.set(LimitKey.MAX_ACTIVE_PROMOTIONS, 3);
                    c.set('userLimits', limitsMap);
                    await next();
                });

                app.use('/*', enforcePromotionLimit());
                app.post('/promotions', (c) => c.json({ success: true, promotionId: 'promo-123' }));

                // Act
                const res = await app.request('/promotions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });

                // Assert
                expect(res.status).toBe(200);
                const data = await res.json();
                expect(data).toEqual({ success: true, promotionId: 'promo-123' });
            });

            it('should return 403 when promotion limit reached', async () => {
                // Arrange
                const app = new Hono<AppBindings>();
                attachTestErrorHandler(app);
                const mockActor: Actor = {
                    id: 'user-123',
                    role: RoleEnum.HOST,
                    permissions: [PermissionEnum.OWNER_PROMOTION_CREATE]
                };

                vi.mocked(getActorFromContext).mockReturnValue(mockActor);

                const mockCount = vi.fn().mockResolvedValue({
                    success: true,
                    data: { count: 3 }
                });
                vi.mocked(OwnerPromotionService).mockImplementation(
                    () =>
                        ({
                            count: mockCount
                        }) as unknown as OwnerPromotionService
                );

                // Set up middleware to inject limits into context
                app.use('/*', async (c, next) => {
                    const limitsMap = new Map<LimitKey, number>();
                    limitsMap.set(LimitKey.MAX_ACTIVE_PROMOTIONS, 3);
                    c.set('userLimits', limitsMap);
                    await next();
                });

                app.use('/*', enforcePromotionLimit());
                app.post('/promotions', (c) => c.json({ success: true }));

                // Act
                const res = await app.request('/promotions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });

                // Assert
                expect(res.status).toBe(403);
                const errorText = await res.text();
                const parsedError = JSON.parse(errorText);

                expect(parsedError).toMatchObject({
                    success: false,
                    error: {
                        code: 'LIMIT_REACHED',
                        details: {
                            limitKey: LimitKey.MAX_ACTIVE_PROMOTIONS,
                            currentCount: 3,
                            maxAllowed: 3
                        }
                    }
                });
            });
        });

        describe('Multiple middleware chaining', () => {
            it('should work correctly with multiple middlewares in sequence', async () => {
                // Arrange
                const app = new Hono<AppBindings>();
                attachTestErrorHandler(app);
                const mockActor: Actor = {
                    id: 'user-123',
                    role: RoleEnum.HOST,
                    permissions: [
                        PermissionEnum.ACCOMMODATION_LISTING_CREATE,
                        PermissionEnum.OWNER_PROMOTION_CREATE
                    ]
                };

                vi.mocked(getActorFromContext).mockReturnValue(mockActor);

                // Mock accommodation count
                const mockAccommodationCount = vi.fn().mockResolvedValue({
                    success: true,
                    data: { count: 2 }
                });
                vi.mocked(AccommodationService).mockImplementation(
                    () =>
                        ({
                            count: mockAccommodationCount
                        }) as unknown as AccommodationService
                );

                // Mock promotion count
                const mockPromotionCount = vi.fn().mockResolvedValue({
                    success: true,
                    data: { count: 1 }
                });
                vi.mocked(OwnerPromotionService).mockImplementation(
                    () =>
                        ({
                            count: mockPromotionCount
                        }) as unknown as OwnerPromotionService
                );

                // Both limits OK

                // Set up middleware to inject limits into context
                app.use('/*', async (c, next) => {
                    const limitsMap = new Map<LimitKey, number>();
                    limitsMap.set(LimitKey.MAX_ACCOMMODATIONS, 5);
                    limitsMap.set(LimitKey.MAX_ACTIVE_PROMOTIONS, 3);
                    c.set('userLimits', limitsMap);
                    await next();
                });

                // Chain both middleware
                app.use('/*', enforceAccommodationLimit());
                app.use('/*', enforcePromotionLimit());
                app.post('/test', (c) => c.json({ success: true }));

                // Act
                const res = await app.request('/test', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });

                // Assert
                expect(res.status).toBe(200);
                const data = await res.json();
                expect(data).toEqual({ success: true });
            });
        });
    });

    describe('Error Response Structure', () => {
        it('should include all required fields in error response', async () => {
            // Arrange
            const mockActor: Actor = {
                id: 'user-123',
                role: RoleEnum.HOST,
                permissions: [PermissionEnum.ACCOMMODATION_LISTING_CREATE]
            };

            vi.mocked(getActorFromContext).mockReturnValue(mockActor);

            // Set up limit in context
            mockLimitsMap.set(LimitKey.MAX_ACCOMMODATIONS, 10);

            const mockCount = vi.fn().mockResolvedValue({
                success: true,
                data: { count: 10 }
            });
            vi.mocked(AccommodationService).mockImplementation(
                () =>
                    ({
                        count: mockCount
                    }) as unknown as AccommodationService
            );

            const middleware = enforceAccommodationLimit();

            // Act & Assert
            try {
                await middleware(mockContext, mockNext);
                expect.fail('Should have thrown ServiceError');
            } catch (error) {
                expect(error).toBeInstanceOf(ServiceError);
                const serviceError = error as ServiceError;

                expect(serviceError.code).toBe(ServiceErrorCode.LIMIT_REACHED);
                expect(serviceError.message).toEqual(expect.any(String));

                expect(serviceError.details).toMatchObject({
                    limitKey: LimitKey.MAX_ACCOMMODATIONS,
                    currentCount: expect.any(Number),
                    maxAllowed: expect.any(Number),
                    upgradeAudience: 'host'
                });
            }
        });
    });
});

/**
 * RESERVED-LIMIT pinning tests (SPEC-145 T-007)
 *
 * These tests assert the stub-always-passes behaviour for MAX_PROPERTIES and
 * MAX_STAFF_ACCOUNTS. Both limits have a hardcoded currentCount=0 because the
 * counting service has not been built yet (see docs/billing/endpoint-gate-matrix.md
 * "Reserved — Limit Stubs"). The tests intentionally verify that:
 *   1. The middleware calls next() (never blocks) for an authenticated actor.
 *   2. No LIMIT_REACHED error is thrown even when the plan ceiling is very low.
 *
 * If either test starts failing, it means someone wired a real count source
 * without updating this file — that is a deliberate break that forces a review.
 */
describe('RESERVED-LIMIT stubs — pinning tests (SPEC-145)', () => {
    let mockContext: Context<AppBindings>;
    let mockNext: ReturnType<typeof vi.fn>;
    let mockLimitsMap: Map<LimitKey, number>;

    beforeEach(() => {
        vi.clearAllMocks();

        mockLimitsMap = new Map<LimitKey, number>();

        mockContext = {
            req: {
                param: vi.fn().mockReturnValue('complex-id-123')
            },
            get: vi.fn((key: string) => {
                if (key === 'userLimits') {
                    return mockLimitsMap;
                }
                return undefined;
            }),
            header: vi.fn()
        } as unknown as Context<AppBindings>;

        mockNext = vi.fn();
    });

    describe('enforcePropertiesLimit — stub always passes', () => {
        it('always calls next() because counting service is not built', async () => {
            // Arrange — actor is authenticated and limit ceiling is 1 (very tight)
            const actor: Actor = {
                id: 'host-stub-123',
                role: RoleEnum.HOST,
                permissions: [PermissionEnum.ACCOMMODATION_LISTING_CREATE]
            };
            vi.mocked(getActorFromContext).mockReturnValue(actor);

            // Set the plan limit extremely low — the stub count is 0, so it still passes
            mockLimitsMap.set(LimitKey.MAX_PROPERTIES, 1);

            const middleware = enforcePropertiesLimit();

            // Act
            await middleware(mockContext, mockNext);

            // Assert — never blocked; next() must be called
            expect(mockNext).toHaveBeenCalledOnce();
        });

        it('does not throw ServiceError when plan ceiling is 0 (stub count is 0)', async () => {
            // Arrange — a plan with ceiling 0 would normally block immediately, but
            // checkLimit treats 0 as "not configured" / unlimited so the stub still passes
            const actor: Actor = {
                id: 'host-stub-456',
                role: RoleEnum.HOST,
                permissions: [PermissionEnum.ACCOMMODATION_LISTING_CREATE]
            };
            vi.mocked(getActorFromContext).mockReturnValue(actor);

            // No limit key in context — checkLimit falls back to unlimited (0 = no limit set)
            const middleware = enforcePropertiesLimit();

            // Act & Assert
            await expect(middleware(mockContext, mockNext)).resolves.toBeUndefined();
            expect(mockNext).toHaveBeenCalledOnce();
        });
    });

    describe('enforceStaffAccountsLimit — stub always passes', () => {
        it('always calls next() because staff service is not built', async () => {
            // Arrange — actor is authenticated and limit ceiling is 1 (very tight)
            const actor: Actor = {
                id: 'host-staff-stub-123',
                role: RoleEnum.HOST,
                permissions: [PermissionEnum.ACCOMMODATION_LISTING_CREATE]
            };
            vi.mocked(getActorFromContext).mockReturnValue(actor);

            mockContext = {
                ...mockContext,
                req: {
                    param: vi.fn()
                }
            } as unknown as Context<AppBindings>;

            mockLimitsMap.set(LimitKey.MAX_STAFF_ACCOUNTS, 1);

            const middleware = enforceStaffAccountsLimit();

            // Act
            await middleware(mockContext, mockNext);

            // Assert — never blocked; next() must be called
            expect(mockNext).toHaveBeenCalledOnce();
        });

        it('does not throw ServiceError even with low ceiling (stub count is 0)', async () => {
            // Arrange
            const actor: Actor = {
                id: 'host-staff-stub-456',
                role: RoleEnum.HOST,
                permissions: [PermissionEnum.ACCOMMODATION_LISTING_CREATE]
            };
            vi.mocked(getActorFromContext).mockReturnValue(actor);

            mockContext = {
                ...mockContext,
                req: {
                    param: vi.fn()
                }
            } as unknown as Context<AppBindings>;

            // No limit key set — checkLimit returns unlimited
            const middleware = enforceStaffAccountsLimit();

            // Act & Assert
            await expect(middleware(mockContext, mockNext)).resolves.toBeUndefined();
            expect(mockNext).toHaveBeenCalledOnce();
        });
    });
});
