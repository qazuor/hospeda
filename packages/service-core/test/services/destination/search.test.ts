import type { DestinationId, DestinationType, UserId } from '@repo/types';
import { LifecycleStatusEnum } from '@repo/types/enums/lifecycle-state.enum';
import { PermissionEnum } from '@repo/types/enums/permission.enum';
import { RoleEnum } from '@repo/types/enums/role.enum';
import { ModerationStatusEnum } from '@repo/types/enums/state.enum';
import { VisibilityEnum } from '@repo/types/enums/visibility.enum';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('DestinationService.search', () => {
    let service: TestableDestinationService;
    let mockModel: ReturnType<typeof createMockBaseModel<DestinationType>>;
    const actor = {
        id: 'user-1',
        role: RoleEnum.USER,
        permissions: [PermissionEnum.DESTINATION_VIEW_PRIVATE]
    };
    const destinations: DestinationType[] = [
        createDestination({
            id: asDestinationId('1'),
            name: 'A',
            location: { state: 'X', country: 'Y', zipCode: '123' }
        }),
        createDestination({
            id: asDestinationId('2'),
            name: 'B',
            location: { state: 'X', country: 'Y', zipCode: '123' }
        }),
        createDestination({
            id: asDestinationId('3'),
            name: 'C',
            location: { state: 'Z', country: 'Y', zipCode: '123' }
        })
    ];

    beforeEach(() => {
        mockModel = createMockBaseModel<DestinationType>();
        mockModel.findAll = vi.fn().mockResolvedValue(destinations);
        service = new TestableDestinationService();
        // @ts-expect-error: override protected for test
        service.model = mockModel;
        vi.clearAllMocks();
    });

    it('returns filtered destinations if actor can view all', async () => {
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: true, reason: EntityPermissionReasonEnum.APPROVED });
        const filter = { state: 'X' };
        const result = await service.search({ actor, ...filter });
        expect(mockModel.findAll).toHaveBeenCalledWith(filter);
        expect(result.data).toHaveLength(3);
        expect(result.error).toBeUndefined();
    });

    it('returns only destinations actor can view', async () => {
        service.canViewEntity = vi.fn(async (_actor, entity) => {
            return {
                canView: entity.id !== asDestinationId('2'),
                reason:
                    entity.id === asDestinationId('2')
                        ? EntityPermissionReasonEnum.DENIED
                        : EntityPermissionReasonEnum.APPROVED
            };
        });
        const filter = { state: 'X' };
        const result = await service.search({ actor, ...filter });
        expect(result.data).toHaveLength(2);
        expect(result.data?.map((d) => d.id)).toEqual([asDestinationId('1'), asDestinationId('3')]);
    });

    it('returns VALIDATION_ERROR if no filters are provided', async () => {
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: true, reason: EntityPermissionReasonEnum.APPROVED });
        const result = await service.search({ actor });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });

    it('returns VALIDATION_ERROR if filters are invalid', async () => {
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: true, reason: EntityPermissionReasonEnum.APPROVED });
        // minRating fuera de rango
        const filter = { minRating: 10 };
        const result = await service.search({ actor, ...filter });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });

    it('returns UNAUTHORIZED if actor is missing', async () => {
        // @ts-expect-error purposely missing actor
        const result = await service.search({ filter: { state: 'X' } });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.UNAUTHORIZED);
    });

    it('returns INTERNAL_ERROR if model throws', async () => {
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: true, reason: EntityPermissionReasonEnum.APPROVED });
        (mockModel.findAll as unknown as import('vitest').Mock).mockRejectedValueOnce(
            new Error('DB error')
        );
        const filter = { state: 'X' };
        const result = await service.search({ actor, ...filter });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });
});
