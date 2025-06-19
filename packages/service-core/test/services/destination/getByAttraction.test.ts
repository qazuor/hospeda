import type { DestinationType } from '@repo/types';
import type { DestinationId, UserId } from '@repo/types/common/id.types';
import { LifecycleStatusEnum } from '@repo/types/enums/lifecycle-state.enum';
import { PermissionEnum } from '@repo/types/enums/permission.enum';
import { RoleEnum } from '@repo/types/enums/role.enum';
import { ModerationStatusEnum } from '@repo/types/enums/state.enum';
import { VisibilityEnum } from '@repo/types/enums/visibility.enum';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DestinationService } from '../../../src/services/destination/destination.service';
import { EntityPermissionReasonEnum } from '../../../src/types';
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
        featuredImage: {
            url: 'img',
            moderationState: ModerationStatusEnum.APPROVED
        }
    },
    visibility: overrides.visibility ?? VisibilityEnum.PUBLIC,
    lifecycleState: overrides.lifecycleState ?? LifecycleStatusEnum.ACTIVE,
    moderationState: overrides.moderationState ?? ModerationStatusEnum.APPROVED,
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
    createdById: overrides.createdById ?? asUserId('user-1'),
    updatedById: overrides.updatedById ?? asUserId('user-1')
});

class TestableDestinationService extends DestinationService {
    public override canViewEntity = super.canViewEntity;
    public canCreateEntity = super.canCreateEntity;
    public canUpdateEntity = super.canUpdateEntity;
    public canDeleteEntity = super.canDeleteEntity;
    public canRestoreEntity = super.canRestoreEntity;
    public canHardDeleteEntity = super.canHardDeleteEntity;
}

describe('DestinationService.getByAttraction', () => {
    let service: TestableDestinationService;
    let mockModel: ReturnType<typeof createMockBaseModel<DestinationType>>;
    const actor = {
        id: 'user-1',
        role: RoleEnum.ADMIN,
        permissions: [PermissionEnum.DESTINATION_VIEW_PRIVATE]
    };
    const attractionId = 'attr-1';
    const destinations = [
        createDestination({ id: asDestinationId('dest-1') }),
        createDestination({ id: asDestinationId('dest-2') })
    ];
    let findAllByAttractionIdMock: import('vitest').Mock;

    beforeEach(() => {
        mockModel = createMockBaseModel<DestinationType>();
        service = new TestableDestinationService();
        // @ts-expect-error: override protected for test
        service.model = mockModel;
        findAllByAttractionIdMock = vi.fn();
        (
            mockModel as unknown as { findAllByAttractionId: typeof findAllByAttractionIdMock }
        ).findAllByAttractionId = findAllByAttractionIdMock;
        vi.clearAllMocks();
    });

    it('returns destinations from the model', async () => {
        // Arrange
        findAllByAttractionIdMock.mockResolvedValueOnce(destinations);
        // Act
        const result = await service.getByAttraction({ actor, attractionId });
        // Assert
        expect(findAllByAttractionIdMock).toHaveBeenCalledWith(attractionId);
        expect(result.data).toEqual(destinations);
        expect(result.error).toBeUndefined();
    });

    it('returns empty array if model returns none', async () => {
        // Arrange
        findAllByAttractionIdMock.mockResolvedValueOnce([]);
        // Act
        const result = await service.getByAttraction({ actor, attractionId });
        // Assert
        expect(result.data).toEqual([]);
        expect(result.error).toBeUndefined();
    });

    it('returns INTERNAL_ERROR if model throws', async () => {
        // Arrange
        findAllByAttractionIdMock.mockRejectedValueOnce(new Error('DB error'));
        // Act
        const result = await service.getByAttraction({ actor, attractionId });
        // Assert
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('INTERNAL_ERROR');
        expect(result.data).toBeUndefined();
    });

    it('returns empty array if model returns undefined', async () => {
        // Arrange
        findAllByAttractionIdMock.mockResolvedValueOnce(undefined);
        // Act
        const result = await service.getByAttraction({ actor, attractionId });
        // Assert
        expect(result.data).toEqual([]);
        expect(result.error).toBeUndefined();
    });

    it('returns empty array if model returns null', async () => {
        // Arrange
        findAllByAttractionIdMock.mockResolvedValueOnce(null);
        // Act
        const result = await service.getByAttraction({ actor, attractionId });
        // Assert
        expect(result.data).toEqual([]);
        expect(result.error).toBeUndefined();
    });

    it('returns validation error if attractionId is missing', async () => {
        // @ts-expect-error purposely missing attractionId
        const result = await service.getByAttraction({ actor });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('returns validation error if attractionId is not a string', async () => {
        // @ts-expect-error purposely wrong type
        const result = await service.getByAttraction({ actor, attractionId: 123 });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    describe('permission filtering', () => {
        it('returns all destinations if canViewEntity returns true for all', async () => {
            findAllByAttractionIdMock.mockResolvedValueOnce(destinations);
            service.canViewEntity = vi
                .fn()
                .mockResolvedValue({ canView: true, reason: EntityPermissionReasonEnum.APPROVED });
            const result = await service.getByAttraction({ actor, attractionId });
            expect(result.data ?? []).toEqual(destinations);
        });

        it('returns no destinations if canViewEntity returns false for all', async () => {
            findAllByAttractionIdMock.mockResolvedValueOnce(destinations);
            service.canViewEntity = vi
                .fn()
                .mockResolvedValue({ canView: false, reason: EntityPermissionReasonEnum.DENIED });
            const result = await service.getByAttraction({ actor, attractionId });
            expect(result.data ?? []).toEqual([]);
        });

        it('returns only destinations actor can view', async () => {
            findAllByAttractionIdMock.mockResolvedValueOnce(destinations);
            const firstId = destinations[0]?.id ?? '';
            service.canViewEntity = vi.fn(async (_actor, entity) => ({
                canView: entity.id === firstId,
                reason:
                    entity.id === firstId
                        ? EntityPermissionReasonEnum.APPROVED
                        : EntityPermissionReasonEnum.DENIED
            }));
            const result = await service.getByAttraction({ actor, attractionId });
            expect(result.data ?? []).toEqual([destinations[0]]);
        });
    });
});
