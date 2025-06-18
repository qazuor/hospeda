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

const mockAccommodation: AccommodationType = {
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
};

class MockAccommodationModel extends AccommodationModel {
    public override findWithRelations = vi.fn().mockResolvedValue(mockAccommodation);
}

class TestableAccommodationService extends AccommodationService {
    public model = new MockAccommodationModel();
    public override canViewEntity = super.canViewEntity;
}

describe('AccommodationService.getWithRelations', () => {
    let service: TestableAccommodationService;
    const actor: Actor = { id: 'user', role: RoleEnum.USER, permissions: [] };
    const input = { id: '1', relations: {}, actor };

    beforeEach(() => {
        service = new TestableAccommodationService();
        service.model.findWithRelations.mockReset();
        service.model.findWithRelations.mockResolvedValue(mockAccommodation);
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns the accommodation if actor can view', async () => {
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: true, reason: EntityPermissionReasonEnum.APPROVED });
        const result = await service.getWithRelations(input);
        expect(result.data).toEqual(mockAccommodation);
    });

    it('returns null if actor cannot view', async () => {
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: false, reason: EntityPermissionReasonEnum.DENIED });
        const result = await service.getWithRelations(input);
        expect(result.data).toBeNull();
    });

    it('returns accommodation with relations for valid id and relations', async () => {
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: true, reason: EntityPermissionReasonEnum.APPROVED });
        service.model.findWithRelations.mockResolvedValue(mockAccommodation);
        const result = await service.getWithRelations({ actor, id: '1', relations: {} });
        expect(result.data).toEqual(mockAccommodation);
        expect(result.error).toBeUndefined();
        expect(service.model.findWithRelations).toHaveBeenCalledWith({ id: '1' }, {});
    });

    it('returns null if accommodation not found', async () => {
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: true, reason: EntityPermissionReasonEnum.APPROVED });
        service.model.findWithRelations.mockResolvedValue(null);
        const result = await service.getWithRelations({ actor, id: '1', relations: {} });
        expect(result.data).toBeNull();
        expect(result.error).toBeUndefined();
    });

    it('returns validation error if id is missing', async () => {
        // @ts-expect-error purposely missing id
        const result = await service.getWithRelations({ actor, relations: {} });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('returns validation error if id is not a string', async () => {
        // @ts-expect-error purposely wrong type
        const result = await service.getWithRelations({ actor, id: 123, relations: {} });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('returns validation error if relations is missing', async () => {
        // @ts-expect-error purposely missing relations
        const result = await service.getWithRelations({ actor, id: '1' });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('returns validation error if relations is not an object', async () => {
        // @ts-expect-error purposely wrong type
        const result = await service.getWithRelations({ actor, id: '1', relations: 'invalid' });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('returns internal error if model throws', async () => {
        service.model.findWithRelations.mockRejectedValue(new Error('DB error'));
        const result = await service.getWithRelations({ actor, id: '1', relations: {} });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('INTERNAL_ERROR');
    });
});
