import type { DestinationType } from '@repo/types';
import type { DestinationId, UserId } from '@repo/types/common/id.types';
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
    updatedById: overrides.updatedById ?? asUserId('user-1')
});

class TestableDestinationService extends DestinationService {
    public override canViewEntity = super.canViewEntity;
}

describe('DestinationService.getWithRelations', () => {
    let service: TestableDestinationService;
    let mockModel: ReturnType<typeof createMockBaseModel<DestinationType>> & {
        findWithRelations?: (
            where: Record<string, unknown>,
            relations: Record<string, boolean>
        ) => Promise<DestinationType | null>;
    };
    const actor = {
        id: 'user-1',
        role: RoleEnum.ADMIN,
        permissions: [PermissionEnum.DESTINATION_VIEW_PRIVATE]
    };
    const id = asDestinationId('dest-1');
    const relations = { accommodations: true };
    const destination = createDestination({ id });

    beforeEach(() => {
        mockModel = createMockBaseModel<DestinationType>() as typeof mockModel;
        mockModel.findWithRelations = vi.fn();
        service = new TestableDestinationService();
        // @ts-expect-error: override protected for test
        service.model = mockModel;
        vi.clearAllMocks();
    });

    it('returns destination with relations if found and permitted', async () => {
        (mockModel.findWithRelations as unknown as import('vitest').Mock).mockResolvedValueOnce(
            destination
        );
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: true, reason: EntityPermissionReasonEnum.APPROVED });
        const result = await service.getWithRelations({ actor, id, relations });
        expect(mockModel.findWithRelations).toHaveBeenCalledWith({ id }, relations);
        expect(result.data).toEqual(destination);
        expect(result.error).toBeUndefined();
    });

    it('returns null if not found', async () => {
        (mockModel.findWithRelations as unknown as import('vitest').Mock).mockResolvedValueOnce(
            null
        );
        const result = await service.getWithRelations({ actor, id, relations });
        expect(result.data).toBeNull();
        expect(result.error).toBeUndefined();
    });

    it('returns null if no permission', async () => {
        (mockModel.findWithRelations as unknown as import('vitest').Mock).mockResolvedValueOnce(
            destination
        );
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: false, reason: EntityPermissionReasonEnum.DENIED });
        const result = await service.getWithRelations({ actor, id, relations });
        expect(result.data).toBeNull();
        expect(result.error).toBeUndefined();
    });

    it('returns validation error if id is missing', async () => {
        // @ts-expect-error purposely missing id
        const result = await service.getWithRelations({ actor, relations });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });

    it('returns validation error if id is not a string', async () => {
        // @ts-expect-error purposely wrong type
        const result = await service.getWithRelations({ actor, id: 123, relations });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });

    it('returns validation error if relations is missing', async () => {
        // @ts-expect-error purposely missing relations
        const result = await service.getWithRelations({ actor, id });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });

    it('returns validation error if relations is not an object', async () => {
        // @ts-expect-error purposely wrong type
        const result = await service.getWithRelations({ actor, id, relations: 123 });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
    });

    it('returns INTERNAL_ERROR if model throws', async () => {
        (mockModel.findWithRelations as unknown as import('vitest').Mock).mockRejectedValueOnce(
            new Error('DB error')
        );
        const result = await service.getWithRelations({ actor, id, relations });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });
});
