import { AccommodationModel } from '@repo/db';
import type { AccommodationId, AccommodationType, DestinationId, UserId } from '@repo/types';
import { AccommodationTypeEnum, type PermissionEnum, RoleEnum } from '@repo/types';
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

const fullRating = {
    cleanliness: 5,
    hospitality: 5,
    services: 5,
    accuracy: 5,
    communication: 5,
    location: 5
};
const mockAccommodations: AccommodationType[] = [
    {
        id: '1' as AccommodationId,
        name: 'A',
        ownerId: 'u1' as UserId,
        type: AccommodationTypeEnum.HOTEL,
        destinationId: 'd1' as DestinationId,
        slug: 'a',
        summary: '',
        description: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: 'u1' as UserId,
        updatedById: 'u1' as UserId,
        visibility: VisibilityEnum.PUBLIC,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        moderationState: ModerationStatusEnum.APPROVED,
        reviewsCount: 0,
        averageRating: 0,
        adminInfo: undefined,
        tags: [],
        seo: undefined,
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
        id: '2' as AccommodationId,
        name: 'B',
        ownerId: 'u2' as UserId,
        type: AccommodationTypeEnum.HOTEL,
        destinationId: 'd1' as DestinationId,
        slug: 'b',
        summary: '',
        description: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: 'u2' as UserId,
        updatedById: 'u2' as UserId,
        visibility: VisibilityEnum.PUBLIC,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        moderationState: ModerationStatusEnum.APPROVED,
        reviewsCount: 0,
        averageRating: 0,
        adminInfo: undefined,
        tags: [],
        seo: undefined,
        rating: {
            cleanliness: 4,
            hospitality: 4,
            services: 4,
            accuracy: 4,
            communication: 4,
            location: 4
        }
    },
    {
        id: '3' as AccommodationId,
        name: 'C',
        ownerId: 'u3' as UserId,
        type: AccommodationTypeEnum.HOTEL,
        destinationId: 'd1' as DestinationId,
        slug: 'c',
        summary: '',
        description: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: 'u3' as UserId,
        updatedById: 'u3' as UserId,
        visibility: VisibilityEnum.PUBLIC,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        moderationState: ModerationStatusEnum.APPROVED,
        reviewsCount: 0,
        averageRating: 0,
        adminInfo: undefined,
        tags: [],
        seo: undefined,
        rating: {
            cleanliness: 3,
            hospitality: 3,
            services: 3,
            accuracy: 3,
            communication: 3,
            location: 3
        }
    }
];

class MockAccommodationModel extends AccommodationModel {
    public override findAll = vi.fn().mockResolvedValue(mockAccommodations);
}

class TestableAccommodationService extends AccommodationService {
    public model = new MockAccommodationModel();
    public override canViewEntity = super.canViewEntity;
}

describe('AccommodationService.getTopRated', () => {
    let service: TestableAccommodationService;
    const actor: Actor = { id: 'user', role: RoleEnum.USER, permissions: [] };
    const destinationId = 'dest-123';
    const accommodations = Array.from({ length: 15 }, (_, i) =>
        createAccommodation({
            rating: { ...fullRating, cleanliness: 10 - i },
            destinationId: destinationId as DestinationId
        })
    );

    beforeEach(() => {
        service = new TestableAccommodationService();
        service.model.findAll.mockReset();
        service.model.findAll.mockResolvedValue(mockAccommodations);
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns all top rated if actor can view all', async () => {
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: true, reason: EntityPermissionReasonEnum.APPROVED });
        const result = await service.getTopRated({ actor });
        expect(result.data).toHaveLength(3);
        expect(result.data?.map((a) => a.id)).toEqual(['1', '2', '3']);
    });

    it('returns no top rated if actor cannot view any', async () => {
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: false, reason: EntityPermissionReasonEnum.DENIED });
        const result = await service.getTopRated({ actor });
        expect(result.data).toHaveLength(0);
    });

    it('returns only top rated actor can view', async () => {
        service.canViewEntity = vi.fn(async (_actor: Actor, entity: AccommodationType) => {
            return {
                canView: entity.id !== '2',
                reason:
                    entity.id === '2'
                        ? EntityPermissionReasonEnum.DENIED
                        : EntityPermissionReasonEnum.APPROVED
            };
        });
        const result = await service.getTopRated({ actor });
        expect(result.data).toHaveLength(2);
        expect(result.data?.map((a) => a.id)).toEqual(['1', '3']);
    });

    it('returns top 10 rated accommodations (no filter)', async () => {
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: true, reason: EntityPermissionReasonEnum.APPROVED });
        service.model.findAll.mockResolvedValue(accommodations);
        const result = await service.getTopRated({ actor });
        expect(result.data).toHaveLength(10);
        expect(result.data?.[0]?.rating?.cleanliness ?? 0).toBe(10);
        expect(result.data?.[9]?.rating?.cleanliness ?? 0).toBe(1);
        expect(result.error).toBeUndefined();
        expect(service.model.findAll).toHaveBeenCalledWith({});
    });

    it('returns top 10 rated accommodations for a destinationId', async () => {
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: true, reason: EntityPermissionReasonEnum.APPROVED });
        service.model.findAll.mockResolvedValue(accommodations);
        const result = await service.getTopRated({ actor, destinationId });
        expect(result.data).toHaveLength(10);
        expect(result.data?.[0]?.destinationId ?? '').toBe(destinationId);
        expect(result.error).toBeUndefined();
        expect(service.model.findAll).toHaveBeenCalledWith({ destinationId });
    });

    it('returns all if less than 10 accommodations', async () => {
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: true, reason: EntityPermissionReasonEnum.APPROVED });
        service.model.findAll.mockResolvedValue(accommodations.slice(0, 5));
        const result = await service.getTopRated({ actor });
        expect(result.data).toHaveLength(5);
        expect(result.error).toBeUndefined();
    });

    it('returns validation error if destinationId is not a string', async () => {
        // @ts-expect-error purposely wrong type
        const result = await service.getTopRated({ actor, destinationId: 123 });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('returns internal error if model throws', async () => {
        service.model.findAll.mockRejectedValue(new Error('DB error'));
        const result = await service.getTopRated({ actor });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('INTERNAL_ERROR');
    });
});
