/**
 * Tests for limit enforcement middleware
 *
 * Tests both unit-level middleware behavior and integration scenarios
 * with real Hono app instances.
 */

import { LimitKey } from '@repo/billing';
import { LifecycleStatusEnum, PermissionEnum, RoleEnum } from '@repo/schemas';
import { AccommodationService, type Actor, OwnerPromotionService } from '@repo/service-core';
import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    enforceAccommodationLimit,
    enforcePhotoLimit,
    enforcePromotionLimit
} from '../../src/middlewares/limit-enforcement';
import type { AppBindings } from '../../src/types';

// Mock dependencies
vi.mock('../../src/utils/actor', () => ({
    getActorFromContext: vi.fn()
}));

vi.mock('@repo/service-core', () => ({
    AccommodationService: vi.fn(),
    OwnerPromotionService: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn()
    }
}));

import { getActorFromContext } from '../../src/utils/actor';

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

            await expect(middleware(mockContext, mockNext)).rejects.toThrow(HTTPException);

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

            // Use media JSONB structure: 1 featuredImage + 4 gallery = 5 total (under limit of 10)
            const mockGetById = vi.fn().mockResolvedValue({
                success: true,
                data: {
                    id: 'accommodation-id-123',
                    media: {
                        featuredImage: {
                            url: 'https://example.com/featured.jpg',
                            moderationState: 'approved'
                        },
                        gallery: Array.from({ length: 4 }, (_, i) => ({
                            url: `https://example.com/${i}.jpg`,
                            moderationState: 'approved'
                        }))
                    }
                }
            });
            vi.mocked(AccommodationService).mockImplementation(
                () =>
                    ({
                        getById: mockGetById
                    }) as unknown as AccommodationService
            );

            const middleware = enforcePhotoLimit();
            await middleware(mockContext, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should block when at photo limit', async () => {
            vi.mocked(getActorFromContext).mockReturnValue(mockActor);

            // Set up limit in context
            mockLimitsMap.set(LimitKey.MAX_PHOTOS_PER_ACCOMMODATION, 10);

            // Use media JSONB structure: 1 featuredImage + 9 gallery = 10 total (at limit)
            const mockGetById = vi.fn().mockResolvedValue({
                success: true,
                data: {
                    id: 'accommodation-id-123',
                    media: {
                        featuredImage: {
                            url: 'https://example.com/featured.jpg',
                            moderationState: 'approved'
                        },
                        gallery: Array.from({ length: 9 }, (_, i) => ({
                            url: `https://example.com/${i}.jpg`,
                            moderationState: 'approved'
                        }))
                    }
                }
            });
            vi.mocked(AccommodationService).mockImplementation(
                () =>
                    ({
                        getById: mockGetById
                    }) as unknown as AccommodationService
            );

            const middleware = enforcePhotoLimit();

            await expect(middleware(mockContext, mockNext)).rejects.toThrow(HTTPException);
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

            const mockGetById = vi.fn().mockResolvedValue({
                data: { id: 'accommodation-id-123' }
            });
            vi.mocked(AccommodationService).mockImplementation(
                () =>
                    ({
                        getById: mockGetById
                    }) as unknown as AccommodationService
            );

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

            await expect(middleware(mockContext, mockNext)).rejects.toThrow(HTTPException);
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
    });

    describe('Integration Tests with Hono App', () => {
        describe('enforceAccommodationLimit integration', () => {
            it('should allow request when under accommodation limit', async () => {
                // Arrange
                const app = new Hono<AppBindings>();
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
                            upgradeUrl: '/billing/plans'
                        }
                    }
                });
            });

            it('should continue on service error to avoid blocking users', async () => {
                // Arrange
                const app = new Hono<AppBindings>();
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
                expect.fail('Should have thrown HTTPException');
            } catch (error) {
                expect(error).toBeInstanceOf(HTTPException);
                const httpError = error as HTTPException;

                expect(httpError.status).toBe(403);

                const errorMessage = JSON.parse(httpError.message);
                expect(errorMessage).toHaveProperty('success', false);
                expect(errorMessage).toHaveProperty('error');
                expect(errorMessage.error).toHaveProperty('code', 'LIMIT_REACHED');
                expect(errorMessage.error).toHaveProperty('message');
                expect(errorMessage.error).toHaveProperty('details');
                expect(errorMessage.error.details).toHaveProperty('limitKey');
                expect(errorMessage.error.details).toHaveProperty('currentCount');
                expect(errorMessage.error.details).toHaveProperty('maxAllowed');
                expect(errorMessage.error.details).toHaveProperty('upgradeUrl');
            }
        });
    });
});
