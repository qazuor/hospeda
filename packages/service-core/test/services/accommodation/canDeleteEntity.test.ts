import { RoleEnum } from '@repo/types';
import { PermissionEnum } from '@repo/types/enums/permission.enum';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { createAccommodation } from '../../factories/accommodationFactory';
import { type ActorWithPermissions, createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import '../../setupTest';

const mockModel = {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn()
};

class TestableAccommodationService extends AccommodationService {
    public canDeleteEntity = super.canDeleteEntity;
}

describe('AccommodationService.canDeleteEntity', () => {
    let service: TestableAccommodationService;
    const accommodation = createAccommodation();

    beforeEach(() => {
        service = new TestableAccommodationService();
        // @ts-expect-error override for test
        service.model = mockModel;
        for (const fn of Object.values(mockModel)) {
            fn.mockReset();
        }
    });

    it('deniega delete si falta permiso', async () => {
        const actor: ActorWithPermissions = createActor({ permissions: [] });
        mockModel.findById.mockResolvedValue(accommodation);
        const result = await service.canDeleteEntity(actor, accommodation);
        expect(result.canDelete).toBe(false);
    });

    it('permite delete si tiene permiso any', async () => {
        const actor: ActorWithPermissions = createActor({
            role: RoleEnum.ADMIN,
            permissions: [PermissionEnum.ACCOMMODATION_DELETE_ANY]
        });
        mockModel.findById.mockResolvedValue(accommodation);
        const result = await service.canDeleteEntity(actor, accommodation);
        expect(result.canDelete).toBe(true);
    });

    it('permite delete si es owner y tiene permiso own', async () => {
        const actor: ActorWithPermissions = createActor({
            id: accommodation.ownerId,
            role: RoleEnum.HOST,
            permissions: [PermissionEnum.ACCOMMODATION_DELETE_OWN]
        });
        mockModel.findById.mockResolvedValue(accommodation);
        const result = await service.canDeleteEntity(actor, accommodation);
        expect(result.canDelete).toBe(true);
    });

    it('admin con permiso own pero no any no puede delete alojamientos ajenos', async () => {
        const actor: ActorWithPermissions = createActor({
            id: getMockId('user', 'admin') as typeof accommodation.ownerId,
            role: RoleEnum.ADMIN,
            permissions: [PermissionEnum.ACCOMMODATION_DELETE_OWN]
        });
        const otherAccommodation = {
            ...accommodation,
            ownerId: getMockId('user', 'owner') as typeof accommodation.ownerId
        };
        mockModel.findById.mockResolvedValue(otherAccommodation);
        const result = await service.canDeleteEntity(actor, otherAccommodation);
        expect(result.canDelete).toBe(false);
    });

    it('host con permiso any no puede delete alojamientos ajenos', async () => {
        const actor: ActorWithPermissions = createActor({
            role: RoleEnum.HOST,
            permissions: [PermissionEnum.ACCOMMODATION_DELETE_ANY]
        });
        const otherAccommodation = {
            ...accommodation,
            ownerId: getMockId('user') as typeof accommodation.ownerId
        };
        mockModel.findById.mockResolvedValue(otherAccommodation);
        const result = await service.canDeleteEntity(actor, otherAccommodation);
        expect(result.canDelete).toBe(false);
    });

    it('user con permisos pero sin rol adecuado no puede delete', async () => {
        const actor: ActorWithPermissions = createActor({
            role: RoleEnum.USER,
            permissions: [PermissionEnum.ACCOMMODATION_DELETE_ANY]
        });
        mockModel.findById.mockResolvedValue(accommodation);
        const result = await service.canDeleteEntity(actor, accommodation);
        expect(result.canDelete).toBe(false);
    });

    it('owner con permiso own pero sobre otro alojamiento no puede delete', async () => {
        const actor: ActorWithPermissions = createActor({
            id: getMockId('user', 'not-owner') as typeof accommodation.ownerId,
            role: RoleEnum.HOST,
            permissions: [PermissionEnum.ACCOMMODATION_DELETE_OWN]
        });
        mockModel.findById.mockResolvedValue(accommodation);
        const result = await service.canDeleteEntity(actor, accommodation);
        expect(result.canDelete).toBe(false);
    });

    it('no se puede delete si deletedAt está presente', async () => {
        const actor: ActorWithPermissions = createActor({
            role: RoleEnum.ADMIN,
            permissions: [PermissionEnum.ACCOMMODATION_DELETE_ANY]
        });
        const deletedAccommodation = { ...accommodation, deletedAt: new Date() };
        mockModel.findById.mockResolvedValue(deletedAccommodation);
        const result = await service.canDeleteEntity(actor, deletedAccommodation);
        expect(result.canDelete).toBe(false);
    });

    it('actor con ambos permisos (any y own) puede delete según corresponda', async () => {
        const actor: ActorWithPermissions = createActor({
            id: accommodation.ownerId,
            role: RoleEnum.ADMIN,
            permissions: [
                PermissionEnum.ACCOMMODATION_DELETE_ANY,
                PermissionEnum.ACCOMMODATION_DELETE_OWN
            ]
        });
        mockModel.findById.mockResolvedValue(accommodation);
        const result = await service.canDeleteEntity(actor, accommodation);
        expect(result.canDelete).toBe(true);
    });
});
