import { AccommodationModel } from '@repo/db';
import type { AccommodationId, AccommodationType, DestinationId, UserId } from '@repo/types';
import { AccommodationTypeEnum, type PermissionEnum, RoleEnum } from '@repo/types';
import type { AccommodationReviewId } from '@repo/types/common/id.types';
import type { AccommodationReviewType } from '@repo/types/entities/accommodation/accommodation.review.types';
import { LifecycleStatusEnum } from '@repo/types/enums/lifecycle-state.enum';
import { ModerationStatusEnum } from '@repo/types/enums/state.enum';
import { VisibilityEnum } from '@repo/types/enums/visibility.enum';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { EntityPermissionReasonEnum } from '../../../src/types';
import { createAccommodation } from '../../factories/accommodationFactory';
import '../../setupTest';

type Actor = {
    id: string;
    role: RoleEnum;
    permissions: PermissionEnum[];
};

const id = '1' as AccommodationId;
const ownerId = 'u1' as UserId;
const destinationId = 'd1' as DestinationId;
const createdById = 'u1' as UserId;
const updatedById = 'u1' as UserId;
const slug = 'a';
const toReviewId = (id: string) => id as AccommodationReviewId;
const reviews: AccommodationReviewType[] = [
    {
        id: toReviewId('rev-1'),
        accommodationId: id,
        userId: ownerId,
        title: 'Review 1',
        content: 'Great!',
        rating: {
            cleanliness: 5,
            hospitality: 5,
            services: 5,
            accuracy: 5,
            communication: 5,
            location: 5
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: undefined,
        createdById,
        updatedById,
        deletedById: undefined,
        adminInfo: undefined,
        lifecycleState: LifecycleStatusEnum.ACTIVE
    },
    {
        id: toReviewId('rev-2'),
        accommodationId: id,
        userId: ownerId,
        title: 'Review 2',
        content: 'Nice.',
        rating: {
            cleanliness: 4,
            hospitality: 4,
            services: 4,
            accuracy: 4,
            communication: 4,
            location: 4
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: undefined,
        createdById,
        updatedById,
        deletedById: undefined,
        adminInfo: undefined,
        lifecycleState: LifecycleStatusEnum.ACTIVE
    }
];
const accommodation: AccommodationType = {
    id,
    name: 'A',
    ownerId,
    type: AccommodationTypeEnum.HOTEL,
    destinationId,
    slug,
    summary: '',
    description: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById,
    updatedById,
    visibility: VisibilityEnum.PUBLIC,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    moderationState: ModerationStatusEnum.APPROVED,
    reviewsCount: 0,
    averageRating: 0,
    adminInfo: undefined,
    tags: [],
    seo: undefined,
    reviews
};

class MockAccommodationModel extends AccommodationModel {
    public override findById = vi.fn().mockResolvedValue(accommodation);
    public override findOne = vi.fn().mockResolvedValue(accommodation);
}

class TestableAccommodationService extends AccommodationService {
    public model = new MockAccommodationModel();
    public override canViewEntity = super.canViewEntity;
}

describe('AccommodationService.getReviews', () => {
    let service: TestableAccommodationService;
    const actor: Actor = { id: 'user', role: RoleEnum.USER, permissions: [] };

    beforeEach(() => {
        service = new TestableAccommodationService();
        service.model.findById.mockReset();
        service.model.findOne.mockReset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns reviews for a valid id', async () => {
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: true, reason: EntityPermissionReasonEnum.APPROVED });
        service.model.findById.mockResolvedValue(accommodation);
        const result = await service.getReviews({ id, actor });
        expect(result.data).toEqual(reviews);
        expect(result.error).toBeUndefined();
        expect(service.model.findById).toHaveBeenCalledWith(id);
    });

    it('returns reviews for a valid slug', async () => {
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: true, reason: EntityPermissionReasonEnum.APPROVED });
        service.model.findOne.mockResolvedValue(accommodation);
        const result = await service.getReviews({ slug, actor });
        expect(result.data).toEqual(reviews);
        expect(result.error).toBeUndefined();
        expect(service.model.findOne).toHaveBeenCalledWith({ slug });
    });

    it('returns empty array if accommodation not found by id', async () => {
        service.model.findById.mockResolvedValue(null);
        const result = await service.getReviews({ id, actor });
        expect(result.data).toEqual([]);
        expect(result.error).toBeUndefined();
    });

    it('returns empty array if accommodation not found by slug', async () => {
        service.model.findOne.mockResolvedValue(null);
        const result = await service.getReviews({ slug, actor });
        expect(result.data).toEqual([]);
        expect(result.error).toBeUndefined();
    });

    it('returns empty array if reviews is undefined', async () => {
        const accNoReviews = createAccommodation({ id, reviews: undefined });
        service.model.findById.mockResolvedValue(accNoReviews);
        const result = await service.getReviews({ id, actor });
        expect(result.data).toEqual([]);
    });

    it('returns validation error if id and slug are missing', async () => {
        const result = await service.getReviews({ actor });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('returns validation error if id is not a string', async () => {
        // @ts-expect-error purposely wrong type
        const result = await service.getReviews({ actor, id: 123 });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('returns validation error if slug is not a string', async () => {
        // @ts-expect-error purposely wrong type
        const result = await service.getReviews({ actor, slug: 123 });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('returns internal error if model throws', async () => {
        service.model.findById.mockRejectedValue(new Error('DB error'));
        const result = await service.getReviews({ id, actor });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('INTERNAL_ERROR');
    });

    it('returns reviews if actor can view', async () => {
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: true, reason: EntityPermissionReasonEnum.APPROVED });
        service.model.findById.mockResolvedValue({
            ...accommodation,
            reviews: [{ id: 'r1' }, { id: 'r2' }]
        });
        const result = await service.getReviews({ id, actor });
        expect(result.data).toEqual([{ id: 'r1' }, { id: 'r2' }]);
    });

    it('returns empty array if actor cannot view', async () => {
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: false, reason: EntityPermissionReasonEnum.DENIED });
        const result = await service.getReviews({ id, actor });
        expect(result.data).toEqual([]);
    });
});
