import type { DestinationReviewType, UserId, UserType } from '@repo/types';
import { LifecycleStatusEnum, PermissionEnum, RoleEnum, VisibilityEnum } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DestinationReviewService } from '../../../src/services/destinationReview/destinationReview.service';

// Mock dependencies
vi.mock('../../../src/services/destinationReview/destinationReview.schemas', () => ({
    DestinationReviewCreateSchema: {} // dummy
}));

const mockReviewModel = {
    findAll: vi.fn()
};
const mockDestinationModel = {
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

describe('DestinationReviewService', () => {
    let service: DestinationReviewService;

    beforeEach(() => {
        service = new DestinationReviewService();
        // biome-ignore lint/suspicious/noExplicitAny: override for test mock injection
        (service as any).reviewModel = mockReviewModel;
        // biome-ignore lint/suspicious/noExplicitAny: override for test mock injection
        (service as any).destinationModel = mockDestinationModel;
        vi.clearAllMocks();
    });

    describe('listReviewsByDestination', () => {
        it('returns paginated reviews for a destination', async () => {
            mockReviewModel.findAll.mockResolvedValue({ items: [{ id: 'r1' }], total: 1 });
            const result = await service.listReviewsByDestination({
                destinationId: '00000000-0000-0000-0000-000000000001',
                page: 1,
                pageSize: 10
            });
            expect(mockReviewModel.findAll).toHaveBeenCalledWith(
                { destinationId: '00000000-0000-0000-0000-000000000001' },
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
            ).rejects.toThrow('permission');
        });
        it('allows admin/moderator to list any user reviews', async () => {
            const admin: UserType = {
                ...actor,
                id: 'admin' as UserId,
                permissions: [PermissionEnum.DESTINATION_REVIEW_MODERATE]
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
        it('calculates and updates stats for a destination', async () => {
            const reviews: DestinationReviewType[] = [
                {
                    id: 'r1',
                    destinationId: 'd1',
                    userId: 'u1',
                    rating: {
                        landscape: 4,
                        attractions: 5,
                        accessibility: 4,
                        safety: 5,
                        cleanliness: 4,
                        hospitality: 5,
                        culturalOffer: 4,
                        gastronomy: 5,
                        affordability: 4,
                        nightlife: 5,
                        infrastructure: 4,
                        environmentalCare: 5,
                        wifiAvailability: 4,
                        shopping: 5,
                        beaches: 4,
                        greenSpaces: 5,
                        localEvents: 4,
                        weatherSatisfaction: 5
                    }
                } as DestinationReviewType,
                {
                    id: 'r2',
                    destinationId: 'd1',
                    userId: 'u2',
                    rating: {
                        landscape: 3,
                        attractions: 4,
                        accessibility: 3,
                        safety: 4,
                        cleanliness: 3,
                        hospitality: 4,
                        culturalOffer: 3,
                        gastronomy: 4,
                        affordability: 3,
                        nightlife: 4,
                        infrastructure: 3,
                        environmentalCare: 4,
                        wifiAvailability: 3,
                        shopping: 4,
                        beaches: 3,
                        greenSpaces: 4,
                        localEvents: 3,
                        weatherSatisfaction: 4
                    }
                } as DestinationReviewType
            ];
            mockReviewModel.findAll.mockResolvedValue(reviews);
            mockDestinationModel.update.mockResolvedValue({});
            const result = await service.recalculateStats('d1');
            expect(result.reviewsCount).toBe(2);
            expect(result.averageRating).toBeGreaterThan(0);
            expect(mockDestinationModel.update).toHaveBeenCalledWith(
                { id: 'd1' },
                expect.objectContaining({ reviewsCount: 2, averageRating: expect.any(Number) })
            );
        });
    });

    // --- Edge cases and errors ---
    describe('validation and input errors', () => {
        it('throws if destinationId is missing or invalid', async () => {
            await expect(
                service.listReviewsByDestination({
                    destinationId: undefined as unknown as string
                })
            ).rejects.toThrow(/destinationId/);
            await expect(
                service.listReviewsByDestination({ destinationId: 'not-a-uuid' })
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
        it('returns empty if destinationId/userId not found', async () => {
            mockReviewModel.findAll.mockResolvedValue({ items: [], total: 0 });
            const result = await service.listReviewsByDestination({
                destinationId: '00000000-0000-0000-0000-000000000000'
            });
            expect(result).toEqual({ items: [], total: 0 });
        });
    });

    describe('permission errors', () => {
        it('throws if actor is not the user and lacks permission', async () => {
            await expect(
                service.listReviewsByUser({ userId: 'other', page: 1, pageSize: 5, actor })
            ).rejects.toThrow('permission');
        });
        it('allows admin/moderator to list any user reviews', async () => {
            const admin = {
                ...actor,
                id: 'admin' as UserId,
                permissions: [PermissionEnum.DESTINATION_REVIEW_MODERATE]
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
        it('returns correct pagination', async () => {
            mockReviewModel.findAll.mockResolvedValue({ items: [{ id: 'r4' }], total: 1 });
            const result = await service.listReviewsByDestination({
                destinationId: '00000000-0000-0000-0000-000000000001',
                page: 2,
                pageSize: 1
            });
            expect(result).toEqual({ items: [{ id: 'r4' }], total: 1 });
        });
    });
});
