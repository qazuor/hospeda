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

const baseAccommodation: AccommodationType = {
    id: 'base' as AccommodationId,
    name: 'Base',
    ownerId: 'u1' as UserId,
    type: AccommodationTypeEnum.HOTEL,
    destinationId: 'd1' as DestinationId,
    slug: 'base',
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
};

const mockSimilars: AccommodationType[] = [
    {
        ...baseAccommodation,
        id: '1' as AccommodationId,
        slug: 'a',
        name: 'A',
        ownerId: 'u1' as UserId,
        createdById: 'u1' as UserId,
        updatedById: 'u1' as UserId
    },
    {
        ...baseAccommodation,
        id: '2' as AccommodationId,
        slug: 'b',
        name: 'B',
        ownerId: 'u1' as UserId,
        createdById: 'u1' as UserId,
        updatedById: 'u1' as UserId
    },
    {
        ...baseAccommodation,
        id: '3' as AccommodationId,
        slug: 'c',
        name: 'C',
        ownerId: 'u1' as UserId,
        createdById: 'u1' as UserId,
        updatedById: 'u1' as UserId
    }
];

class MockAccommodationModel extends AccommodationModel {
    public override findById = vi.fn().mockResolvedValue(baseAccommodation);
    public override findOne = vi.fn().mockResolvedValue(baseAccommodation);
    public override findAll = vi.fn().mockResolvedValue(mockSimilars);
}

class TestableAccommodationService extends AccommodationService {
    public model = new MockAccommodationModel();
    public override canViewEntity = super.canViewEntity;
}

describe('AccommodationService.getSimilar', () => {
    let service: TestableAccommodationService;
    const actor: Actor = { id: 'user', role: RoleEnum.USER, permissions: [] };
    const id = 'base';
    const slug = 'base';
    const inputId = { id, actor };
    const inputSlug = { slug, actor };

    beforeEach(() => {
        service = new TestableAccommodationService();
        service.model.findById.mockReset();
        service.model.findOne.mockReset();
        service.model.findAll.mockReset();
        service.model.findById.mockResolvedValue(baseAccommodation);
        service.model.findOne.mockResolvedValue(baseAccommodation);
        service.model.findAll.mockResolvedValue(mockSimilars);
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns all similars if actor can view all', async () => {
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: true, reason: EntityPermissionReasonEnum.APPROVED });
        const result = await service.getSimilar(inputId);
        expect(result.data).toHaveLength(3);
        expect(result.data?.map((a) => a.id)).toEqual(['1', '2', '3']);
    });

    it('returns no similars if actor cannot view any', async () => {
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: false, reason: EntityPermissionReasonEnum.DENIED });
        const result = await service.getSimilar(inputId);
        expect(result.data).toHaveLength(0);
    });

    it('returns only similars actor can view', async () => {
        service.canViewEntity = vi.fn(async (_actor: Actor, entity: AccommodationType) => {
            return {
                canView: entity.id !== '2',
                reason:
                    entity.id === '2'
                        ? EntityPermissionReasonEnum.DENIED
                        : EntityPermissionReasonEnum.APPROVED
            };
        });
        const result = await service.getSimilar(inputId);
        expect(result.data).toHaveLength(2);
        expect(result.data?.map((a) => a.id)).toEqual(['1', '3']);
    });

    it('returns up to 10 similar accommodations by id', async () => {
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: true, reason: EntityPermissionReasonEnum.APPROVED });
        service.model.findById.mockResolvedValue(baseAccommodation);
        service.model.findAll.mockResolvedValue([baseAccommodation, ...mockSimilars]);
        const result = await service.getSimilar(inputId);
        expect(result.data).toHaveLength(3);
        expect(result.data?.every((a) => a.id !== baseAccommodation.id)).toBe(true);
        expect(result.error).toBeUndefined();
        expect(service.model.findById).toHaveBeenCalledWith('base');
        expect(service.model.findAll).toHaveBeenCalledWith({
            destinationId: baseAccommodation.destinationId,
            type: baseAccommodation.type
        });
    });

    it('returns up to 10 similar accommodations by slug', async () => {
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: true, reason: EntityPermissionReasonEnum.APPROVED });
        service.model.findOne.mockResolvedValue(baseAccommodation);
        service.model.findAll.mockResolvedValue([baseAccommodation, ...mockSimilars]);
        const result = await service.getSimilar(inputSlug);
        expect(result.data).toHaveLength(3);
        expect(result.data?.every((a) => a.id !== baseAccommodation.id)).toBe(true);
        expect(result.error).toBeUndefined();
        expect(service.model.findOne).toHaveBeenCalledWith({ slug: 'base' });
        expect(service.model.findAll).toHaveBeenCalledWith({
            destinationId: baseAccommodation.destinationId,
            type: baseAccommodation.type
        });
    });

    it('returns empty array if base accommodation not found by id', async () => {
        service.model.findById.mockResolvedValue(null);
        const result = await service.getSimilar(inputId);
        expect(result.data).toEqual([]);
        expect(result.error).toBeUndefined();
    });

    it('returns empty array if base accommodation not found by slug', async () => {
        service.model.findOne.mockResolvedValue(null);
        const result = await service.getSimilar(inputSlug);
        expect(result.data).toEqual([]);
        expect(result.error).toBeUndefined();
    });

    it('returns validation error if id and slug are missing', async () => {
        // purposely missing both
        const result = await service.getSimilar({ actor });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('returns validation error if id is not a string', async () => {
        // @ts-expect-error purposely wrong type
        const result = await service.getSimilar({ actor, id: 123 });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('returns validation error if slug is not a string', async () => {
        // @ts-expect-error purposely wrong type
        const result = await service.getSimilar({ actor, slug: 123 });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('returns internal error if model throws', async () => {
        service.model.findById.mockRejectedValue(new Error('DB error'));
        const result = await service.getSimilar(inputId);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('INTERNAL_ERROR');
    });
});
