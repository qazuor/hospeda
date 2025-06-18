import { AccommodationModel } from '@repo/db';
import type { AccommodationId, AccommodationType, DestinationId, UserId } from '@repo/types';
import { AccommodationTypeEnum, type PermissionEnum, RoleEnum } from '@repo/types';
import { LifecycleStatusEnum } from '@repo/types/enums/lifecycle-state.enum';
import { ModerationStatusEnum } from '@repo/types/enums/state.enum';
import { VisibilityEnum } from '@repo/types/enums/visibility.enum';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { EntityPermissionReasonEnum } from '../../../src/types';
import '../../setupTest';

type Actor = {
    id: string;
    role: RoleEnum;
    permissions: PermissionEnum[];
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
        seo: undefined
    }
];

class MockAccommodationModel extends AccommodationModel {
    public override findAll = vi.fn().mockResolvedValue(mockAccommodations);
}

class TestableAccommodationService extends AccommodationService {
    public model = new MockAccommodationModel();
    public override canViewEntity = super.canViewEntity;
}

describe('AccommodationService.getByType', () => {
    let service: TestableAccommodationService;
    const actor: Actor = { id: 'user', role: RoleEnum.USER, permissions: [] };

    beforeEach(() => {
        service = new TestableAccommodationService();
        service.model.findAll.mockReset();
        service.model.findAll.mockResolvedValue(mockAccommodations);
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns all accommodations if actor can view all', async () => {
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: true, reason: EntityPermissionReasonEnum.APPROVED });
        const result = await service.getByType({ type: 'HOTEL', actor });
        expect(result.data).toHaveLength(1);
        expect(result.data?.map((a) => a.id)).toEqual(['1']);
    });

    it('returns no accommodations if actor cannot view any', async () => {
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: false, reason: EntityPermissionReasonEnum.DENIED });
        const result = await service.getByType({ type: 'HOTEL', actor });
        expect(result.data).toHaveLength(0);
    });

    it('returns only accommodations actor can view', async () => {
        service.canViewEntity = vi.fn(async (_actor: Actor, entity: AccommodationType) => {
            return {
                canView: entity.id !== '1',
                reason:
                    entity.id === '1'
                        ? EntityPermissionReasonEnum.DENIED
                        : EntityPermissionReasonEnum.APPROVED
            };
        });
        const result = await service.getByType({ type: 'HOTEL', actor });
        expect(result.data).toHaveLength(0);
    });

    it('returns accommodations for a valid type', async () => {
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: true, reason: EntityPermissionReasonEnum.APPROVED });
        const result = await service.getByType({ type: 'HOTEL', actor });
        expect(result.data).toEqual(mockAccommodations);
        expect(result.error).toBeUndefined();
    });

    it('returns empty array if no accommodations found', async () => {
        service.model.findAll.mockResolvedValue([]);
        const result = await service.getByType({ type: 'HOTEL', actor });
        expect(result.data).toEqual([]);
        expect(result.error).toBeUndefined();
    });

    it('returns validation error if type is missing', async () => {
        // @ts-expect-error purposely missing type
        const result = await service.getByType({ actor });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('returns validation error if type is not a string', async () => {
        // @ts-expect-error purposely wrong type
        const result = await service.getByType({ actor, type: 123 });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('returns internal error if model throws', async () => {
        service.model.findAll.mockRejectedValue(new Error('DB error'));
        const result = await service.getByType({ type: 'HOTEL', actor });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('INTERNAL_ERROR');
    });
});
