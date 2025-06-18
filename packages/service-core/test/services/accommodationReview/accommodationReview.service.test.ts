import type { AccommodationReviewType, UserId, UserType } from '@repo/types';
import { LifecycleStatusEnum, PermissionEnum, RoleEnum, VisibilityEnum } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationReviewService } from '../../../src/services/accommodationReview/accommodationReview.service';

// Mock dependencies
vi.mock('../../../src/services/accommodationReview/accommodationReview.schemas', () => ({
    AccommodationReviewCreateSchema: {} // dummy
}));

const mockReviewModel = {
    findAll: vi.fn()
};
const mockAccommodationModel = {
    update: vi.fn()
};

// Mock UserType with all required fields and brandeados
const baseUserId = 'user-1' as UserId;
const actor: UserType = {
    id: baseUserId,
    userName: 'test',
    password: 'pw',
    role: RoleEnum.USER,
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: baseUserId,
    updatedById: baseUserId,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    visibility: VisibilityEnum.PUBLIC
};

describe('AccommodationReviewService', () => {
    let service: AccommodationReviewService;

    beforeEach(() => {
        service = new AccommodationReviewService();
        // biome-ignore lint/suspicious/noExplicitAny: override for test mock injection
        (service as any).reviewModel = mockReviewModel;
        // biome-ignore lint/suspicious/noExplicitAny: override for test mock injection
        (service as any).accommodationModel = mockAccommodationModel;
        vi.clearAllMocks();
    });

    describe('listReviewsByAccommodation', () => {
        it('returns paginated reviews for an accommodation', async () => {
            mockReviewModel.findAll.mockResolvedValue({ items: [{ id: 'r1' }], total: 1 });
            const result = await service.listReviewsByAccommodation({
                accommodationId: '00000000-0000-0000-0000-000000000001',
                page: 1,
                pageSize: 10
            });
            expect(mockReviewModel.findAll).toHaveBeenCalledWith(
                { accommodationId: '00000000-0000-0000-0000-000000000001' },
                { page: 1, pageSize: 10 }
            );
            expect(result).toEqual({ items: [{ id: 'r1' }], total: 1 });
        });
    });

    describe('listReviewsByUser', () => {
        it('returns paginated reviews for a user if actor is the user', async () => {
            mockReviewModel.findAll.mockResolvedValue({ items: [{ id: 'r2' }], total: 1 });
            const result = await service.listReviewsByUser({
                userId: 'user-1',
                page: 1,
                pageSize: 5,
                actor
            });
            expect(mockReviewModel.findAll).toHaveBeenCalledWith(
                { userId: 'user-1' },
                { page: 1, pageSize: 5 }
            );
            expect(result).toEqual({ items: [{ id: 'r2' }], total: 1 });
        });
        it('throws if actor is not the user and lacks permission', async () => {
            await expect(
                service.listReviewsByUser({ userId: 'other', page: 1, pageSize: 5, actor })
            ).rejects.toThrow('Permission denied');
        });
        it('allows admin/moderator to list any user reviews', async () => {
            const admin: UserType = {
                ...actor,
                id: 'admin' as UserId,
                permissions: [PermissionEnum.ACCOMMODATION_REVIEW_MODERATE]
            };
            mockReviewModel.findAll.mockResolvedValue({ items: [{ id: 'r3' }], total: 1 });
            const result = await service.listReviewsByUser({
                userId: 'other',
                page: 1,
                pageSize: 5,
                actor: admin
            });
            expect(result).toEqual({ items: [{ id: 'r3' }], total: 1 });
        });
    });

    describe('recalculateStats', () => {
        it('calculates and updates stats for an accommodation', async () => {
            const reviews: AccommodationReviewType[] = [
                {
                    id: 'r1',
                    accommodationId: 'a1',
                    userId: 'u1',
                    rating: {
                        cleanliness: 4,
                        hospitality: 5,
                        services: 4,
                        accuracy: 5,
                        communication: 4,
                        location: 5
                    }
                } as AccommodationReviewType,
                {
                    id: 'r2',
                    accommodationId: 'a1',
                    userId: 'u2',
                    rating: {
                        cleanliness: 3,
                        hospitality: 4,
                        services: 3,
                        accuracy: 4,
                        communication: 3,
                        location: 4
                    }
                } as AccommodationReviewType
            ];
            mockReviewModel.findAll.mockResolvedValue(reviews);
            mockAccommodationModel.update.mockResolvedValue({});
            const result = await service.recalculateStats('a1');
            expect(result.reviewsCount).toBe(2);
            expect(result.averageRating).toBeCloseTo(4, 1);
            expect(mockAccommodationModel.update).toHaveBeenCalledWith(
                { id: 'a1' },
                expect.objectContaining({ reviewsCount: 2, averageRating: expect.any(Number) })
            );
        });
    });

    // --- Edge cases y errores ---
    describe('validation and input errors', () => {
        it('throws if accommodationId is missing or invalid', async () => {
            await expect(
                service.listReviewsByAccommodation({
                    accommodationId: undefined as unknown as string
                })
            ).rejects.toThrow(/accommodationId/);
            await expect(
                service.listReviewsByAccommodation({ accommodationId: 'not-a-uuid' })
            ).rejects.toThrow(/Invalid uuid/);
        });
        it('throws if userId is missing or invalid in listReviewsByUser', async () => {
            // userId undefined
            await expect(
                service.listReviewsByUser({
                    userId: undefined as unknown as string,
                    actor,
                    page: 1,
                    pageSize: 5
                })
            ).rejects.toThrow();
            // Invalid userId
            await expect(
                service.listReviewsByUser({ userId: 'not-a-uuid', page: 1, pageSize: 5, actor })
            ).rejects.toThrow();
        });
        it('returns empty if accommodationId/userId not found', async () => {
            mockReviewModel.findAll.mockResolvedValue({ items: [], total: 0 });
            const result = await service.listReviewsByAccommodation({
                accommodationId: '00000000-0000-0000-0000-000000000000'
            });
            expect(result).toEqual({ items: [], total: 0 });
        });
    });

    describe('permission errors', () => {
        it('throws if actor is not the user and lacks permission', async () => {
            await expect(
                service.listReviewsByUser({ userId: 'other', page: 1, pageSize: 5, actor })
            ).rejects.toThrow('Permission denied');
        });
        it('allows admin/moderator to list any user reviews', async () => {
            const admin = {
                ...actor,
                id: 'admin' as UserId,
                permissions: [PermissionEnum.ACCOMMODATION_REVIEW_MODERATE]
            };
            mockReviewModel.findAll.mockResolvedValue({ items: [{ id: 'r3' }], total: 1 });
            const result = await service.listReviewsByUser({
                userId: 'other',
                page: 1,
                pageSize: 5,
                actor: admin
            });
            expect(result).toEqual({ items: [{ id: 'r3' }], total: 1 });
        });
    });

    describe('pagination edge cases', () => {
        it('returns empty for out-of-range page', async () => {
            mockReviewModel.findAll.mockResolvedValue({ items: [], total: 0 });
            const result = await service.listReviewsByAccommodation({
                accommodationId: '00000000-0000-0000-0000-000000000000',
                page: 999,
                pageSize: 10
            });
            expect(result).toEqual({ items: [], total: 0 });
        });
        it('handles negative or zero page/pageSize gracefully', async () => {
            await expect(
                service.listReviewsByAccommodation({
                    accommodationId: '00000000-0000-0000-0000-000000000000',
                    page: -1,
                    pageSize: 10
                })
            ).rejects.toThrow(/greater than or equal to 1/);
            await expect(
                service.listReviewsByAccommodation({
                    accommodationId: '00000000-0000-0000-0000-000000000000',
                    page: 1,
                    pageSize: 0
                })
            ).rejects.toThrow(/greater than or equal to 1/);
        });
    });

    describe('recalculateStats edge cases', () => {
        it('returns 0 for no reviews', async () => {
            mockReviewModel.findAll.mockResolvedValue([]);
            mockAccommodationModel.update.mockResolvedValue({});
            const result = await service.recalculateStats('a1');
            expect(result).toEqual({ averageRating: 0, reviewsCount: 0 });
        });
        it('returns correct stats for all 5s', async () => {
            const reviews = [
                {
                    rating: {
                        cleanliness: 5,
                        hospitality: 5,
                        services: 5,
                        accuracy: 5,
                        communication: 5,
                        location: 5
                    }
                },
                {
                    rating: {
                        cleanliness: 5,
                        hospitality: 5,
                        services: 5,
                        accuracy: 5,
                        communication: 5,
                        location: 5
                    }
                }
            ];
            mockReviewModel.findAll.mockResolvedValue(reviews);
            mockAccommodationModel.update.mockResolvedValue({});
            const result = await service.recalculateStats('a1');
            expect(result.averageRating).toBe(5);
            expect(result.reviewsCount).toBe(2);
        });
        it('returns correct stats for mixed ratings', async () => {
            const reviews = [
                {
                    rating: {
                        cleanliness: 1,
                        hospitality: 2,
                        services: 3,
                        accuracy: 4,
                        communication: 5,
                        location: 1
                    }
                },
                {
                    rating: {
                        cleanliness: 5,
                        hospitality: 4,
                        services: 3,
                        accuracy: 2,
                        communication: 1,
                        location: 5
                    }
                }
            ];
            mockReviewModel.findAll.mockResolvedValue(reviews);
            mockAccommodationModel.update.mockResolvedValue({});
            const result = await service.recalculateStats('a1');
            expect(result.reviewsCount).toBe(2);
            expect(result.averageRating).toBeCloseTo(3, 1);
        });
    });

    describe('db/model errors', () => {
        it('throws if reviewModel.findAll throws', async () => {
            mockReviewModel.findAll.mockRejectedValue(new Error('DB error'));
            await expect(
                service.listReviewsByAccommodation({ accommodationId: 'not-a-uuid' })
            ).rejects.toThrow(/Invalid uuid/);
            await expect(
                service.listReviewsByAccommodation({
                    accommodationId: '00000000-0000-0000-0000-000000000000'
                })
            ).rejects.toThrow('DB error');
        });
        it('throws if accommodationModel.update throws in recalculateStats', async () => {
            mockReviewModel.findAll.mockResolvedValue([
                {
                    rating: {
                        cleanliness: 5,
                        hospitality: 5,
                        services: 5,
                        accuracy: 5,
                        communication: 5,
                        location: 5
                    }
                }
            ]);
            mockAccommodationModel.update.mockRejectedValue(new Error('Update failed'));
            await expect(service.recalculateStats('a1')).rejects.toThrow('Update failed');
        });
    });
});
