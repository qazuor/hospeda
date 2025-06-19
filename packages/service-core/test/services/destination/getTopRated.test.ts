import type { DestinationId, DestinationType, UserId } from '@repo/types';
import { LifecycleStatusEnum } from '@repo/types/enums/lifecycle-state.enum';
import { PermissionEnum } from '@repo/types/enums/permission.enum';
import { RoleEnum } from '@repo/types/enums/role.enum';
import { ModerationStatusEnum } from '@repo/types/enums/state.enum';
import { VisibilityEnum } from '@repo/types/enums/visibility.enum';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    seo: undefined
});

class TestableDestinationService extends DestinationService {
    public override canViewEntity = super.canViewEntity;
}

describe('DestinationService.getTopRated', () => {
    let service: TestableDestinationService;
    let mockModel: ReturnType<typeof createMockBaseModel<DestinationType>>;
    const actor = {
        id: 'user-1',
        role: RoleEnum.USER,
        permissions: [PermissionEnum.DESTINATION_VIEW_PRIVATE]
    };
    const destinations: DestinationType[] = [
        createDestination({ id: asDestinationId('1'), averageRating: 5 }),
        createDestination({ id: asDestinationId('2'), averageRating: 4 }),
        createDestination({ id: asDestinationId('3'), averageRating: 3 })
    ];
    const manyDestinations = Array.from({ length: 15 }, (_, i) =>
        createDestination({ id: asDestinationId(`${i + 1}`), averageRating: 15 - i })
    );

    beforeEach(() => {
        mockModel = createMockBaseModel<DestinationType>();
        mockModel.findAll = vi.fn().mockResolvedValue(destinations);
        service = new TestableDestinationService();
        // @ts-expect-error: override protected for test
        service.model = mockModel;
        vi.clearAllMocks();
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
        expect(result.data?.map((d) => d.id)).toEqual([
            asDestinationId('1'),
            asDestinationId('2'),
            asDestinationId('3')
        ]);
    });

    it('returns no top rated if actor cannot view any', async () => {
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: false, reason: EntityPermissionReasonEnum.DENIED });
        const result = await service.getTopRated({ actor });
        expect(result.data).toHaveLength(0);
    });

    it('returns only top rated actor can view', async () => {
        service.canViewEntity = vi.fn(async (_actor, entity) => {
            return {
                canView: entity.id !== asDestinationId('2'),
                reason:
                    entity.id === asDestinationId('2')
                        ? EntityPermissionReasonEnum.DENIED
                        : EntityPermissionReasonEnum.APPROVED
            };
        });
        const result = await service.getTopRated({ actor });
        expect(result.data).toHaveLength(2);
        expect(result.data?.map((d) => d.id)).toEqual([asDestinationId('1'), asDestinationId('3')]);
    });

    it('returns top 10 rated destinations (no filter)', async () => {
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: true, reason: EntityPermissionReasonEnum.APPROVED });
        (mockModel.findAll as unknown as import('vitest').Mock).mockResolvedValue(manyDestinations);
        const result = await service.getTopRated({ actor });
        expect(result.data).toHaveLength(10);
        expect(result.data?.[0]?.averageRating ?? 0).toBe(15);
        expect(result.data?.[9]?.averageRating ?? 0).toBe(6);
        expect(result.error).toBeUndefined();
        expect(mockModel.findAll).toHaveBeenCalledWith({});
    });

    it('returns top N rated destinations if limit is set', async () => {
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: true, reason: EntityPermissionReasonEnum.APPROVED });
        (mockModel.findAll as unknown as import('vitest').Mock).mockResolvedValue(manyDestinations);
        const result = await service.getTopRated({ actor, limit: 5 });
        expect(result.data).toHaveLength(5);
        expect(result.data?.[0]?.averageRating ?? 0).toBe(15);
        expect(result.data?.[4]?.averageRating ?? 0).toBe(11);
    });

    it('applies filter if provided', async () => {
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: true, reason: EntityPermissionReasonEnum.APPROVED });
        (mockModel.findAll as unknown as import('vitest').Mock).mockResolvedValue([
            destinations[0]
        ]);
        const filter = { name: 'Test Destination' };
        const result = await service.getTopRated({ actor, filter });
        expect(mockModel.findAll).toHaveBeenCalledWith(filter);
        expect(result.data).toHaveLength(1);
        expect(result.data?.[0]?.id).toEqual(asDestinationId('1'));
    });

    it('returns INTERNAL_ERROR if model throws', async () => {
        (mockModel.findAll as unknown as import('vitest').Mock).mockRejectedValueOnce(
            new Error('DB error')
        );
        const result = await service.getTopRated({ actor });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });
});
