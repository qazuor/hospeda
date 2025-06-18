import type { AccommodationType, DestinationId, PermissionEnum } from '@repo/types';
import { RoleEnum } from '@repo/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { EntityPermissionReasonEnum } from '../../../src/types';
import { createAccommodation } from '../../factories/accommodationFactory';
import { getMockId } from '../../factories/utilsFactory';
import '../../setupTest';

const mockModel = {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn()
};

const mockAccommodations: AccommodationType[] = [
    { id: '1', name: 'A', ownerId: 'u1', type: 'HOTEL', destinationId: 'd1' } as AccommodationType,
    { id: '2', name: 'B', ownerId: 'u2', type: 'HOTEL', destinationId: 'd1' } as AccommodationType,
    { id: '3', name: 'C', ownerId: 'u3', type: 'HOTEL', destinationId: 'd1' } as AccommodationType
];

class TestableAccommodationService extends AccommodationService {
    public override canViewEntity = super.canViewEntity;
}

type Actor = {
    id: string;
    role: RoleEnum;
    permissions: PermissionEnum[];
};

describe('AccommodationService.getByDestinationId', () => {
    let service: TestableAccommodationService;
    const actor: Actor = { id: 'user', role: RoleEnum.USER, permissions: [] };
    const destinationId = getMockId('destination') as DestinationId;
    const accommodation = createAccommodation({ destinationId });

    beforeEach(() => {
        service = new TestableAccommodationService();
        // @ts-expect-error override for test
        service.model = mockModel;
        for (const fn of Object.values(mockModel)) {
            fn.mockReset();
        }
        // Por defecto, el modelo retorna todos los alojamientos
        mockModel.findAll.mockResolvedValue(mockAccommodations);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns all accommodations if actor can view all', async () => {
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: true, reason: EntityPermissionReasonEnum.APPROVED });
        mockModel.findAll.mockResolvedValue(mockAccommodations);
        const result = await service.getByDestinationId({ destinationId: 'd1', actor });
        expect(result.data).toHaveLength(3);
        expect(result.data?.map((a) => a.id)).toEqual(['1', '2', '3']);
    });

    it('returns no accommodations if actor cannot view any', async () => {
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: false, reason: EntityPermissionReasonEnum.DENIED });
        mockModel.findAll.mockResolvedValue(mockAccommodations);
        const result = await service.getByDestinationId({ destinationId: 'd1', actor });
        expect(result.data).toHaveLength(0);
    });

    it('returns only accommodations actor can view', async () => {
        service.canViewEntity = vi.fn(async (_actor: Actor, entity: AccommodationType) => {
            return {
                canView: entity.id !== '2',
                reason:
                    entity.id === '2'
                        ? EntityPermissionReasonEnum.DENIED
                        : EntityPermissionReasonEnum.APPROVED
            };
        });
        mockModel.findAll.mockResolvedValue(mockAccommodations);
        const result = await service.getByDestinationId({ destinationId: 'd1', actor });
        expect(result.data).toHaveLength(2);
        expect(result.data?.map((a) => a.id)).toEqual(['1', '3']);
    });

    it('returns accommodations for a valid destinationId', async () => {
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: true, reason: EntityPermissionReasonEnum.APPROVED });
        mockModel.findAll.mockResolvedValue([accommodation]);
        const result = await service.getByDestinationId({
            actor,
            destinationId: accommodation.destinationId
        });
        expect(result.data).toEqual([accommodation]);
        expect(result.error).toBeUndefined();
        expect(mockModel.findAll).toHaveBeenCalledWith({
            destinationId: accommodation.destinationId
        });
    });

    it('returns empty array if no accommodations found', async () => {
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: true, reason: EntityPermissionReasonEnum.APPROVED });
        mockModel.findAll.mockResolvedValue([]);
        const result = await service.getByDestinationId({
            actor,
            destinationId: accommodation.destinationId
        });
        expect(result.data).toEqual([]);
        expect(result.error).toBeUndefined();
    });

    it('returns validation error if destinationId is missing', async () => {
        // @ts-expect-error purposely missing destinationId
        const result = await service.getByDestinationId({ actor });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('returns validation error if destinationId is not a string', async () => {
        // @ts-expect-error purposely wrong type
        const result = await service.getByDestinationId({ actor, destinationId: 123 });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('returns internal error if model throws', async () => {
        service.canViewEntity = vi
            .fn()
            .mockResolvedValue({ canView: true, reason: EntityPermissionReasonEnum.APPROVED });
        mockModel.findAll.mockRejectedValue(new Error('DB error'));
        const result = await service.getByDestinationId({
            actor,
            destinationId: accommodation.destinationId
        });
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('INTERNAL_ERROR');
    });
});
