import type { DestinationId, DestinationType, UserId } from '@repo/types';
import { LifecycleStatusEnum } from '@repo/types/enums/lifecycle-state.enum';
import { PermissionEnum } from '@repo/types/enums/permission.enum';
import { RoleEnum } from '@repo/types/enums/role.enum';
import { ModerationStatusEnum } from '@repo/types/enums/state.enum';
import { VisibilityEnum } from '@repo/types/enums/visibility.enum';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    getMockDestinationReview,
    getMockDestinationReviewId
} from '../../../../services/src/test/factories/destinationReviewFactory';
import { DestinationService } from '../../../src/services/destination/destination.service';
import { EntityPermissionReasonEnum, ServiceErrorCode } from '../../../src/types';
import { createMockBaseModel } from '../../factories/baseServiceFactory';

const asDestinationId = (id: string) => id as DestinationId;
const asUserId = (id: string) => id as UserId;
const createDestination = (overrides: Partial<DestinationType> = {}): DestinationType => ({
    id: asDestinationId(overrides.id ?? 'dest-1'),
    name: overrides.name ?? 'Test Destination',
    slug: overrides.slug ?? 'test-destination',
    summary: overrides.summary ?? 'A valid summary for the destination.',
    description: overrides.description ?? 'A valid description for the destination, long enough.',
    location: overrides.location ?? { state: 'A', zipCode: '1234', country: 'B' },
    media: overrides.media ?? {
        featuredImage: { url: 'img', moderationState: ModerationStatusEnum.APPROVED }
    },
    visibility: overrides.visibility ?? VisibilityEnum.PUBLIC,
    lifecycleState: overrides.lifecycleState ?? LifecycleStatusEnum.ACTIVE,
    moderationState: overrides.moderationState ?? ModerationStatusEnum.APPROVED,
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
    createdById: overrides.createdById ?? asUserId('user-1'),
    updatedById: overrides.updatedById ?? asUserId('user-1'),
    averageRating: overrides.averageRating ?? 0,
    reviewsCount: overrides.reviewsCount ?? 0,
    tags: [],
    adminInfo: undefined,
    seo: undefined,
    reviews: overrides.reviews ?? [
        getMockDestinationReview({ id: getMockDestinationReviewId('r1') }),
        getMockDestinationReview({ id: getMockDestinationReviewId('r2') })
    ]
});

class TestableDestinationService extends DestinationService {
    public override canViewEntity = super.canViewEntity;
}

describe('DestinationService.getReviews', () => {
    let service: TestableDestinationService;
    let mockModel: ReturnType<typeof createMockBaseModel<DestinationType>>;
    const actor = {
        id: 'user-1',
        role: RoleEnum.USER,
        permissions: [PermissionEnum.DESTINATION_VIEW_PRIVATE]
    };
    const id = asDestinationId('dest-1');
    const slug = 'test-destination';
    const destination = createDestination({ id, slug });
    const reviews = destination.reviews ?? [];

    beforeEach(() => {
        mockModel = createMockBaseModel<DestinationType>();
        mockModel.findById = vi.fn();
        mockModel.findOne = vi.fn();
        service = new TestableDestinationService();
        // @ts-expect-error: override protected for test
        service.model = mockModel;
        vi.clearAllMocks();
    });

    it('returns reviews if found by id and permitted', async () => {
        (mockModel.findById as unknown as import('vitest').Mock).mockResolvedValueOnce(destination);
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: true, reason: EntityPermissionReasonEnum.APPROVED });
        const result = await service.getReviews({ actor, id });
        expect(mockModel.findById).toHaveBeenCalledWith(id);
        expect(result.data).toEqual(reviews);
        expect(result.error).toBeUndefined();
    });

    it('returns reviews if found by slug and permitted', async () => {
        (mockModel.findOne as unknown as import('vitest').Mock).mockResolvedValueOnce(destination);
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: true, reason: EntityPermissionReasonEnum.APPROVED });
        const result = await service.getReviews({ actor, slug });
        expect(mockModel.findOne).toHaveBeenCalledWith({ slug });
        expect(result.data).toEqual(reviews);
        expect(result.error).toBeUndefined();
    });

    it('returns empty array if not found by id', async () => {
        (mockModel.findById as unknown as import('vitest').Mock).mockResolvedValueOnce(null);
        const result = await service.getReviews({ actor, id });
        expect(result.data).toEqual([]);
        expect(result.error).toBeUndefined();
    });

    it('returns empty array if not found by slug', async () => {
        (mockModel.findOne as unknown as import('vitest').Mock).mockResolvedValueOnce(null);
        const result = await service.getReviews({ actor, slug });
        expect(result.data).toEqual([]);
        expect(result.error).toBeUndefined();
    });

    it('returns empty array if no permission', async () => {
        (mockModel.findById as unknown as import('vitest').Mock).mockResolvedValueOnce(destination);
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: false, reason: EntityPermissionReasonEnum.DENIED });
        const result = await service.getReviews({ actor, id });
        expect(result.data).toEqual([]);
        expect(result.error).toBeUndefined();
    });

    it('returns validation error if neither id nor slug is provided', async () => {
        const result = await service.getReviews({ actor });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });

    it('returns validation error if id is not a string', async () => {
        // @ts-expect-error purposely wrong type
        const result = await service.getReviews({ actor, id: 123 });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });

    it('returns validation error if slug is not a string', async () => {
        // @ts-expect-error purposely wrong type
        const result = await service.getReviews({ actor, slug: 123 });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });

    it('returns INTERNAL_ERROR if model throws', async () => {
        (mockModel.findById as unknown as import('vitest').Mock).mockRejectedValueOnce(
            new Error('DB error')
        );
        const result = await service.getReviews({ actor, id });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });
});
