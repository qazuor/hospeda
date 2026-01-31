/**
 * Tests for limit enforcement middleware
 *
 * Tests both unit-level middleware behavior and integration scenarios
 * with real Hono app instances.
 */

import { LimitKey } from '@repo/billing';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
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

vi.mock('../../src/utils/limit-check', () => ({
    checkLimit: vi.fn()
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
import { checkLimit } from '../../src/utils/limit-check';

describe('Limit Enforcement Middleware', () => {
    let mockContext: Context<AppBindings>;
    let mockNext: Next;

    beforeEach(() => {
        vi.clearAllMocks();

        mockContext = {
            req: {
                param: vi.fn()
            },
            get: vi.fn()
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

            // Mock limit check - under limit
            vi.mocked(checkLimit).mockReturnValue({
                allowed: true,
                currentCount: 3,
                maxAllowed: 5,
                remaining: 2
            });

            const middleware = enforceAccommodationLimit();
            await middleware(mockContext, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(checkLimit).toHaveBeenCalledWith({
                context: mockContext,
                limitKey: LimitKey.MAX_ACCOMMODATIONS,
                currentCount: 3
            });
        });

        it('should block when at limit', async () => {
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

            vi.mocked(checkLimit).mockReturnValue({
                allowed: false,
                currentCount: 5,
                maxAllowed: 5,
                remaining: 0,
                upgradeMessage:
                    'Has alcanzado el límite de 5 alojamientos. Actualiza tu plan para obtener más.'
            });

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

            vi.mocked(checkLimit).mockReturnValue({
                allowed: true,
                currentCount: 100,
                maxAllowed: -1,
                remaining: -1
            });

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

            const mockGetById = vi.fn().mockResolvedValue({
                success: true,
                data: { id: 'accommodation-id-123', photosCount: 5 }
            });
            vi.mocked(AccommodationService).mockImplementation(
                () =>
                    ({
                        getById: mockGetById
                    }) as unknown as AccommodationService
            );

            vi.mocked(checkLimit).mockReturnValue({
                allowed: true,
                currentCount: 5,
                maxAllowed: 10,
                remaining: 5
            });

            const middleware = enforcePhotoLimit();
            await middleware(mockContext, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(checkLimit).toHaveBeenCalledWith({
                context: mockContext,
                limitKey: LimitKey.MAX_PHOTOS_PER_ACCOMMODATION,
                currentCount: 5
            });
        });

        it('should block when at photo limit', async () => {
            vi.mocked(getActorFromContext).mockReturnValue(mockActor);

            const mockGetById = vi.fn().mockResolvedValue({
                success: true,
                data: { id: 'accommodation-id-123', photosCount: 10 }
            });
            vi.mocked(AccommodationService).mockImplementation(
                () =>
                    ({
                        getById: mockGetById
                    }) as unknown as AccommodationService
            );

            vi.mocked(checkLimit).mockReturnValue({
                allowed: false,
                currentCount: 10,
                maxAllowed: 10,
                remaining: 0,
                upgradeMessage:
                    'Has alcanzado el límite de 10 fotos por alojamiento. Actualiza tu plan para obtener más.'
            });

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

            const mockGetById = vi.fn().mockResolvedValue({
                data: { id: 'accommodation-id-123' }
            });
            vi.mocked(AccommodationService).mockImplementation(
                () =>
                    ({
                        getById: mockGetById
                    }) as unknown as AccommodationService
            );

            vi.mocked(checkLimit).mockReturnValue({
                allowed: true,
                currentCount: 0,
                maxAllowed: 10,
                remaining: 10
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

            vi.mocked(checkLimit).mockReturnValue({
                allowed: true,
                currentCount: 2,
                maxAllowed: 3,
                remaining: 1
            });

            const middleware = enforcePromotionLimit();
            await middleware(mockContext, mockNext);

            expect(mockNext).toHaveBeenCalled();
            // Check that count was called with correct filter for active promotions
            const callArgs = mockCount.mock.calls[0];
            if (callArgs) {
                expect(callArgs[1]).toMatchObject({ isActive: true, ownerId: 'user-123' });
            }
        });

        it('should block when at promotion limit', async () => {
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

            vi.mocked(checkLimit).mockReturnValue({
                allowed: false,
                currentCount: 3,
                maxAllowed: 3,
                remaining: 0,
                upgradeMessage:
                    'Has alcanzado el límite de 3 promociones activas. Actualiza tu plan para obtener más.'
            });

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

            vi.mocked(checkLimit).mockReturnValue({
                allowed: true,
                currentCount: 1,
                maxAllowed: 3,
                remaining: 2
            });

            const middleware = enforcePromotionLimit();
            await middleware(mockContext, mockNext);

            // Check that count was called with correct filter for active promotions
            const callArgs = mockCount.mock.calls[0];
            if (callArgs) {
                expect(callArgs[1]).toMatchObject({ isActive: true, ownerId: 'user-123' });
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

                vi.mocked(checkLimit).mockReturnValue({
                    allowed: true,
                    currentCount: 2,
                    maxAllowed: 5,
                    remaining: 3
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

                vi.mocked(checkLimit).mockReturnValue({
                    allowed: false,
                    currentCount: 5,
                    maxAllowed: 5,
                    remaining: 0,
                    upgradeMessage:
                        'Has alcanzado el límite de 5 alojamientos. Actualiza tu plan para obtener más.'
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

                vi.mocked(checkLimit).mockReturnValue({
                    allowed: false,
                    currentCount: 0,
                    maxAllowed: 0,
                    remaining: 0,
                    upgradeMessage:
                        'Esta funcionalidad no está disponible en tu plan actual. Actualiza tu plan para poder usar alojamientos.'
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

                vi.mocked(checkLimit).mockReturnValue({
                    allowed: true,
                    currentCount: 999999,
                    maxAllowed: -1,
                    remaining: -1
                });

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

                vi.mocked(checkLimit).mockReturnValue({
                    allowed: true,
                    currentCount: 1,
                    maxAllowed: 3,
                    remaining: 2
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

                vi.mocked(checkLimit).mockReturnValue({
                    allowed: false,
                    currentCount: 3,
                    maxAllowed: 3,
                    remaining: 0,
                    upgradeMessage:
                        'Has alcanzado el límite de 3 promociones activas. Actualiza tu plan para obtener más.'
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
                vi.mocked(checkLimit).mockReturnValue({
                    allowed: true,
                    currentCount: 2,
                    maxAllowed: 5,
                    remaining: 3
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

            vi.mocked(checkLimit).mockReturnValue({
                allowed: false,
                currentCount: 10,
                maxAllowed: 10,
                remaining: 0,
                upgradeMessage: 'Has alcanzado el límite de 10 alojamientos.'
            });

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
