/**
 * Tests for photo limit enforcement with media JSONB counting.
 *
 * Validates that enforcePhotoLimit() correctly counts photos from the
 * accommodation's media JSONB field structure:
 *   { featuredImage?: Image, gallery?: Image[], videos?: Video[] }
 *
 * @module test/middlewares/limit-enforcement-photo
 */
import { LimitKey } from '@repo/billing';
import { RoleEnum } from '@repo/schemas';
import { AccommodationService, type Actor } from '@repo/service-core';
import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enforcePhotoLimit } from '../../src/middlewares/limit-enforcement';
import type { AppBindings } from '../../src/types';

// Mock dependencies
vi.mock('../../src/utils/actor', () => ({
    getActorFromContext: vi.fn()
}));

vi.mock('@repo/service-core', () => ({
    AccommodationService: vi.fn(),
    OwnerPromotionService: vi.fn(),
    UserBookmarkService: vi.fn()
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

/** Creates a mock Hono context with configurable limits map and params. */
function createMockContext(
    params: Record<string, string> = {},
    limitsMap: Map<LimitKey, number> = new Map()
): Context<AppBindings> {
    return {
        req: {
            param: (key: string) => params[key] ?? ''
        },
        get: (key: string) => {
            if (key === 'userLimits') return limitsMap;
            return undefined;
        },
        header: vi.fn()
    } as unknown as Context<AppBindings>;
}

describe('enforcePhotoLimit - media JSONB counting', () => {
    const mockActor: Actor = {
        id: 'user-123',
        role: RoleEnum.HOST,
        permissions: []
    };

    let mockGetById: ReturnType<typeof vi.fn>;
    let mockNext: Next;
    let mockLimitsMap: Map<LimitKey, number>;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getActorFromContext).mockReturnValue(mockActor);

        mockNext = vi.fn().mockResolvedValue(undefined);
        mockGetById = vi.fn();
        mockLimitsMap = new Map<LimitKey, number>();
        mockLimitsMap.set(LimitKey.MAX_PHOTOS_PER_ACCOMMODATION, 10);

        vi.mocked(AccommodationService).mockImplementation(
            () =>
                ({
                    getById: mockGetById
                }) as unknown as AccommodationService
        );
    });

    describe('photo counting from media JSONB', () => {
        it('should count gallery images plus featured image', async () => {
            // Arrange
            mockGetById.mockResolvedValue({
                data: {
                    id: 'acc-1',
                    media: {
                        featuredImage: {
                            url: 'https://example.com/featured.jpg',
                            moderationState: 'approved'
                        },
                        gallery: [
                            { url: 'https://example.com/1.jpg', moderationState: 'approved' },
                            { url: 'https://example.com/2.jpg', moderationState: 'approved' },
                            { url: 'https://example.com/3.jpg', moderationState: 'approved' }
                        ]
                    }
                }
            });

            const c = createMockContext({ id: 'acc-1' }, mockLimitsMap);
            const middleware = enforcePhotoLimit();

            // Act
            await middleware(c, mockNext);

            // Assert: 3 gallery + 1 featured = 4, which is under limit of 10
            expect(mockNext).toHaveBeenCalled();
        });

        it('should count only featured image when no gallery', async () => {
            // Arrange
            mockGetById.mockResolvedValue({
                data: {
                    id: 'acc-1',
                    media: {
                        featuredImage: {
                            url: 'https://example.com/featured.jpg',
                            moderationState: 'approved'
                        }
                    }
                }
            });

            // Set limit to 1 so count=1 is exactly at the limit
            mockLimitsMap.set(LimitKey.MAX_PHOTOS_PER_ACCOMMODATION, 1);
            const c = createMockContext({ id: 'acc-1' }, mockLimitsMap);
            const middleware = enforcePhotoLimit();

            // Act & Assert: count=1 equals limit=1, should block
            await expect(middleware(c, mockNext)).rejects.toThrow(HTTPException);
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should count 0 when media field is null', async () => {
            // Arrange
            mockGetById.mockResolvedValue({
                data: { id: 'acc-1', media: null }
            });

            const c = createMockContext({ id: 'acc-1' }, mockLimitsMap);
            const middleware = enforcePhotoLimit();

            // Act
            await middleware(c, mockNext);

            // Assert: count=0, under limit=10
            expect(mockNext).toHaveBeenCalled();
        });

        it('should count 0 when media field is undefined', async () => {
            // Arrange
            mockGetById.mockResolvedValue({
                data: { id: 'acc-1' }
            });

            const c = createMockContext({ id: 'acc-1' }, mockLimitsMap);
            const middleware = enforcePhotoLimit();

            // Act
            await middleware(c, mockNext);

            // Assert: count=0, under limit=10
            expect(mockNext).toHaveBeenCalled();
        });

        it('should count only gallery when no featured image', async () => {
            // Arrange
            mockGetById.mockResolvedValue({
                data: {
                    id: 'acc-1',
                    media: {
                        gallery: [
                            { url: 'https://example.com/1.jpg', moderationState: 'approved' },
                            { url: 'https://example.com/2.jpg', moderationState: 'approved' }
                        ]
                    }
                }
            });

            // Set limit to 2 so count=2 is exactly at the limit
            mockLimitsMap.set(LimitKey.MAX_PHOTOS_PER_ACCOMMODATION, 2);
            const c = createMockContext({ id: 'acc-1' }, mockLimitsMap);
            const middleware = enforcePhotoLimit();

            // Act & Assert: count=2 equals limit=2, should block
            await expect(middleware(c, mockNext)).rejects.toThrow(HTTPException);
        });

        it('should count 0 when gallery is an empty array', async () => {
            // Arrange
            mockGetById.mockResolvedValue({
                data: {
                    id: 'acc-1',
                    media: {
                        gallery: []
                    }
                }
            });

            const c = createMockContext({ id: 'acc-1' }, mockLimitsMap);
            const middleware = enforcePhotoLimit();

            // Act
            await middleware(c, mockNext);

            // Assert: count=0, under limit=10
            expect(mockNext).toHaveBeenCalled();
        });

        it('should ignore videos when counting photos', async () => {
            // Arrange - 2 gallery photos + 1 featured + many videos = 3 photos
            mockGetById.mockResolvedValue({
                data: {
                    id: 'acc-1',
                    media: {
                        featuredImage: {
                            url: 'https://example.com/featured.jpg',
                            moderationState: 'approved'
                        },
                        gallery: [
                            { url: 'https://example.com/1.jpg', moderationState: 'approved' },
                            { url: 'https://example.com/2.jpg', moderationState: 'approved' }
                        ],
                        videos: [
                            { url: 'https://example.com/video1.mp4', moderationState: 'approved' },
                            { url: 'https://example.com/video2.mp4', moderationState: 'approved' },
                            { url: 'https://example.com/video3.mp4', moderationState: 'approved' }
                        ]
                    }
                }
            });

            // Set limit to 3 so count=3 photos (ignoring 3 videos) is exactly at the limit
            mockLimitsMap.set(LimitKey.MAX_PHOTOS_PER_ACCOMMODATION, 3);
            const c = createMockContext({ id: 'acc-1' }, mockLimitsMap);
            const middleware = enforcePhotoLimit();

            // Act & Assert: 3 photos hit the limit, block
            await expect(middleware(c, mockNext)).rejects.toThrow(HTTPException);
        });
    });

    describe('blocking behavior', () => {
        it('should block and throw HTTPException when photo count equals limit', async () => {
            // Arrange - exactly at the limit
            mockGetById.mockResolvedValue({
                data: {
                    id: 'acc-1',
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

            mockLimitsMap.set(LimitKey.MAX_PHOTOS_PER_ACCOMMODATION, 10);
            const c = createMockContext({ id: 'acc-1' }, mockLimitsMap);
            const middleware = enforcePhotoLimit();

            // Act & Assert
            await expect(middleware(c, mockNext)).rejects.toThrow(HTTPException);
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should block with 403 status and correct error code', async () => {
            // Arrange
            mockGetById.mockResolvedValue({
                data: {
                    id: 'acc-1',
                    media: {
                        gallery: Array.from({ length: 5 }, (_, i) => ({
                            url: `https://example.com/${i}.jpg`,
                            moderationState: 'approved'
                        }))
                    }
                }
            });

            mockLimitsMap.set(LimitKey.MAX_PHOTOS_PER_ACCOMMODATION, 5);
            const c = createMockContext({ id: 'acc-1' }, mockLimitsMap);
            const middleware = enforcePhotoLimit();

            // Act
            try {
                await middleware(c, mockNext);
                expect.fail('Should have thrown HTTPException');
            } catch (error) {
                // Assert
                expect(error).toBeInstanceOf(HTTPException);
                const httpError = error as HTTPException;
                expect(httpError.status).toBe(403);

                const parsed = JSON.parse(httpError.message);
                expect(parsed.error.code).toBe('LIMIT_REACHED');
                expect(parsed.error.details.limitKey).toBe(LimitKey.MAX_PHOTOS_PER_ACCOMMODATION);
                expect(parsed.error.details.currentCount).toBe(5);
                expect(parsed.error.details.maxAllowed).toBe(5);
            }
        });

        it('should allow when photo count is below limit', async () => {
            // Arrange
            mockGetById.mockResolvedValue({
                data: {
                    id: 'acc-1',
                    media: {
                        featuredImage: {
                            url: 'https://example.com/featured.jpg',
                            moderationState: 'approved'
                        },
                        gallery: [{ url: 'https://example.com/1.jpg', moderationState: 'approved' }]
                    }
                }
            });

            // count=2, limit=10 -> allowed
            mockLimitsMap.set(LimitKey.MAX_PHOTOS_PER_ACCOMMODATION, 10);
            const c = createMockContext({ id: 'acc-1' }, mockLimitsMap);
            const middleware = enforcePhotoLimit();

            // Act
            await middleware(c, mockNext);

            // Assert
            expect(mockNext).toHaveBeenCalledOnce();
        });
    });

    describe('error handling and passthrough', () => {
        it('should continue when getById returns an error', async () => {
            // Arrange
            mockGetById.mockResolvedValue({
                error: { code: 'NOT_FOUND', message: 'Accommodation not found' }
            });

            const c = createMockContext({ id: 'acc-1' }, mockLimitsMap);
            const middleware = enforcePhotoLimit();

            // Act
            await middleware(c, mockNext);

            // Assert: on fetch failure, pass through (don't block user)
            expect(mockNext).toHaveBeenCalled();
        });

        it('should continue when accommodation ID is missing from params', async () => {
            // Arrange
            const c = createMockContext({}, mockLimitsMap); // no 'id' param
            const middleware = enforcePhotoLimit();

            // Act
            await middleware(c, mockNext);

            // Assert
            expect(mockNext).toHaveBeenCalled();
            expect(mockGetById).not.toHaveBeenCalled();
        });

        it('should continue when actor is not authenticated', async () => {
            // Arrange
            vi.mocked(getActorFromContext).mockReturnValue({
                id: '',
                role: RoleEnum.GUEST,
                permissions: []
            });

            const c = createMockContext({ id: 'acc-1' }, mockLimitsMap);
            const middleware = enforcePhotoLimit();

            // Act
            await middleware(c, mockNext);

            // Assert
            expect(mockNext).toHaveBeenCalled();
            expect(mockGetById).not.toHaveBeenCalled();
        });

        it('should allow unlimited when limit is not set (unlimited plan)', async () => {
            // Arrange - no limit in map means unlimited (-1)
            mockGetById.mockResolvedValue({
                data: {
                    id: 'acc-1',
                    media: {
                        featuredImage: {
                            url: 'https://example.com/featured.jpg',
                            moderationState: 'approved'
                        },
                        gallery: Array.from({ length: 100 }, (_, i) => ({
                            url: `https://example.com/${i}.jpg`,
                            moderationState: 'approved'
                        }))
                    }
                }
            });

            const emptyLimitsMap = new Map<LimitKey, number>(); // no MAX_PHOTOS limit
            const c = createMockContext({ id: 'acc-1' }, emptyLimitsMap);
            const middleware = enforcePhotoLimit();

            // Act
            await middleware(c, mockNext);

            // Assert: unlimited plan, pass through
            expect(mockNext).toHaveBeenCalled();
        });
    });
});
