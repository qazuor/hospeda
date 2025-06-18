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
    public override findById = vi.fn().mockResolvedValue(mockAccommodation);
    public override findOne = vi.fn().mockResolvedValue(mockAccommodation);
}

class TestableAccommodationService extends AccommodationService {
    public model = new MockAccommodationModel();
    public override canViewEntity = super.canViewEntity;
}

describe('AccommodationService.getSummary', () => {
    let service: TestableAccommodationService;
    const actor: Actor = { id: 'user', role: RoleEnum.USER, permissions: [] };
    const id = '1';
    const slug = 'a';
    const inputId = { id, actor };
    const inputSlug = { slug, actor };

    beforeEach(() => {
        service = new TestableAccommodationService();
        service.model.findById.mockReset();
        service.model.findOne.mockReset();
        service.model.findById.mockResolvedValue(mockAccommodation);
        service.model.findOne.mockResolvedValue(mockAccommodation);
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns the summary if actor can view', async () => {
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: true, reason: EntityPermissionReasonEnum.APPROVED });
        const result = await service.getSummary(inputId);
        expect(result.data).toMatchObject({ id: '1', name: 'A', slug: 'a' });
    });

    it('returns null if actor cannot view', async () => {
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: false, reason: EntityPermissionReasonEnum.DENIED });
        const result = await service.getSummary(inputId);
        expect(result.data).toBeNull();
    });

    it('returns summary for a valid id', async () => {
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: true, reason: EntityPermissionReasonEnum.APPROVED });
        service.model.findById.mockResolvedValue(mockAccommodation);
        const result = await service.getSummary(inputId);
        expect(result.data).toMatchObject({ id: '1', name: 'A', slug: 'a' });
        expect(service.model.findById).toHaveBeenCalledWith('1');
    });

    it('returns summary for a valid slug', async () => {
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: true, reason: EntityPermissionReasonEnum.APPROVED });
        service.model.findOne.mockResolvedValue(mockAccommodation);
        const result = await service.getSummary(inputSlug);
        expect(result.data).toMatchObject({ id: '1', name: 'A', slug: 'a' });
        expect(service.model.findOne).toHaveBeenCalledWith({ slug: 'a' });
    });

    it('returns null if accommodation not found by id', async () => {
        service.model.findById.mockResolvedValue(null);
        const result = await service.getSummary(inputId);
        expect(result.data).toBeNull();
    });

    it('returns null if accommodation not found by slug', async () => {
        service.model.findOne.mockResolvedValue(null);
        const result = await service.getSummary(inputSlug);
        expect(result.data).toBeNull();
    });

    it('returns validation error if id and slug are missing', async () => {
        const result = await service.getSummary({ actor });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('returns validation error if id is not a string', async () => {
        // @ts-expect-error purposely wrong type
        const result = await service.getSummary({ actor, id: 123 });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('returns validation error if slug is not a string', async () => {
        // @ts-expect-error purposely wrong type
        const result = await service.getSummary({ actor, slug: 123 });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('returns internal error if model throws', async () => {
        service.model.findById.mockRejectedValue(new Error('DB error'));
        const result = await service.getSummary(inputId);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('INTERNAL_ERROR');
    });
});
