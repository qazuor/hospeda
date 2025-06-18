import { type AccommodationModel, AccommodationReviewModel } from '@repo/db';
import type { AccommodationReviewId, AccommodationReviewType, UserId } from '@repo/types';
import { LifecycleStatusEnum } from '@repo/types/enums/lifecycle-state.enum';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { createAccommodation } from '../../factories/accommodationFactory';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import '../../setupTest';

const mockModel = {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
    findOne: vi.fn()
};

class TestableAccommodationService extends AccommodationService {
    public model = mockModel as unknown as AccommodationModel;
}

describe('AccommodationService.addReview', () => {
    let service: TestableAccommodationService;
    const accommodation = createAccommodation();
    const _actor = createActor();

    beforeEach(() => {
        service = new TestableAccommodationService();
        service.model = mockModel as unknown as AccommodationModel;
        for (const fn of Object.values(mockModel)) {
            fn.mockReset();
        }
        mockModel.findAll = mockModel.findAll || vi.fn();
        mockModel.findById = mockModel.findById || vi.fn();
        mockModel.create = mockModel.create || vi.fn();
        mockModel.update = mockModel.update || vi.fn();
        mockModel.count = mockModel.count || vi.fn();
        mockModel.findOne = mockModel.findOne || vi.fn();
        mockModel.findOne.mockResolvedValue(null);
    });

    it('should add a review, recalculate stats, and update the accommodation', async () => {
        // Arrange
        const reviewModel = {
            create: vi.fn(),
            findAll: vi.fn()
        };
        vi.spyOn(AccommodationReviewModel.prototype, 'create').mockImplementation(
            reviewModel.create
        );
        vi.spyOn(AccommodationReviewModel.prototype, 'findAll').mockImplementation(
            reviewModel.findAll
        );

        const accommodationId = accommodation.id;
        const reviewInput: AccommodationReviewType = {
            id: getMockId('accommodation') as AccommodationReviewId,
            accommodationId,
            userId: getMockId('user') as UserId,
            title: 'Great stay',
            content: 'Very clean and nice',
            rating: {
                cleanliness: 5,
                hospitality: 4,
                services: 5,
                accuracy: 4,
                communication: 5,
                location: 5
            },
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: getMockId('user') as UserId,
            updatedById: getMockId('user') as UserId,
            deletedAt: undefined,
            deletedById: undefined,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            adminInfo: undefined
        };
        const allReviews: AccommodationReviewType[] = [reviewInput];
        mockModel.findById.mockResolvedValue(accommodation);
        reviewModel.create.mockResolvedValue(reviewInput);
        reviewModel.findAll.mockResolvedValue(allReviews);
        mockModel.update.mockResolvedValue({
            ...accommodation,
            rating: reviewInput.rating,
            reviewsCount: 1
        });

        // Act
        const result = await service.addReview({ actor: _actor, ...reviewInput });

        // Assert
        expect(result.data).toBeDefined();
        expect(result.data?.review).toEqual(reviewInput);
        expect(result.data?.stats.rating).toEqual(reviewInput.rating);
        expect(result.data?.stats.reviewsCount).toBe(1);
        expect(mockModel.update).toHaveBeenCalledWith(
            { id: accommodationId },
            expect.objectContaining({ rating: reviewInput.rating, reviewsCount: 1 })
        );
        expect(reviewModel.create).toHaveBeenCalled();
        expect(reviewModel.findAll).toHaveBeenCalledWith({ accommodationId });
    });
});
