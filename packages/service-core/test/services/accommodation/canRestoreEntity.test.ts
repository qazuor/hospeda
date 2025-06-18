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
    public canRestoreEntity = super.canRestoreEntity;
}

describe('AccommodationService.canRestoreEntity', () => {
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

    it('deniega restore si falta permiso', async () => {
        const actor: ActorWithPermissions = createActor({ permissions: [] });
        mockModel.findById.mockResolvedValue(accommodation);
        const result = await service.canRestoreEntity(actor, accommodation);
        expect(result.canRestore).toBe(false);
    });

    it('permite restore si tiene permiso any', async () => {
        const actor: ActorWithPermissions = createActor({
            role: RoleEnum.ADMIN,
            permissions: [PermissionEnum.ACCOMMODATION_RESTORE_ANY]
        });
        mockModel.findById.mockResolvedValue(accommodation);
        const result = await service.canRestoreEntity(actor, accommodation);
        expect(result.canRestore).toBe(true);
    });

    it('permite restore si es owner y tiene permiso own', async () => {
        const actor: ActorWithPermissions = createActor({
            id: accommodation.ownerId,
            role: RoleEnum.HOST,
            permissions: [PermissionEnum.ACCOMMODATION_RESTORE_OWN]
        });
        mockModel.findById.mockResolvedValue(accommodation);
        const result = await service.canRestoreEntity(actor, accommodation);
        expect(result.canRestore).toBe(true);
    });

    it('admin con permiso own pero no any no puede restore alojamientos ajenos', async () => {
        const actor: ActorWithPermissions = createActor({
            id: getMockId('user', 'admin') as typeof accommodation.ownerId,
            role: RoleEnum.ADMIN,
            permissions: [PermissionEnum.ACCOMMODATION_RESTORE_OWN]
        });
        const otherAccommodation = {
            ...accommodation,
            ownerId: getMockId('user', 'owner') as typeof accommodation.ownerId
        };
        mockModel.findById.mockResolvedValue(otherAccommodation);
        const result = await service.canRestoreEntity(actor, otherAccommodation);
        expect(result.canRestore).toBe(false);
    });

    it('host con permiso any no puede restore alojamientos ajenos', async () => {
        const actor: ActorWithPermissions = createActor({
            role: RoleEnum.HOST,
            permissions: [PermissionEnum.ACCOMMODATION_RESTORE_ANY]
        });
        const otherAccommodation = {
            ...accommodation,
            ownerId: getMockId('user') as typeof accommodation.ownerId
        };
        mockModel.findById.mockResolvedValue(otherAccommodation);
        const result = await service.canRestoreEntity(actor, otherAccommodation);
        expect(result.canRestore).toBe(false);
    });

    it('user con permisos pero sin rol adecuado no puede restore', async () => {
        const actor: ActorWithPermissions = createActor({
            role: RoleEnum.USER,
            permissions: [PermissionEnum.ACCOMMODATION_RESTORE_ANY]
        });
        mockModel.findById.mockResolvedValue(accommodation);
        const result = await service.canRestoreEntity(actor, accommodation);
        expect(result.canRestore).toBe(false);
    });

    it('owner con permiso own pero sobre otro alojamiento no puede restore', async () => {
        const actor: ActorWithPermissions = createActor({
            id: getMockId('user', 'not-owner') as typeof accommodation.ownerId,
            role: RoleEnum.HOST,
            permissions: [PermissionEnum.ACCOMMODATION_RESTORE_OWN]
        });
        mockModel.findById.mockResolvedValue(accommodation);
        const result = await service.canRestoreEntity(actor, accommodation);
        expect(result.canRestore).toBe(false);
    });

    it('no se puede restore si deletedAt está presente', async () => {
        const actor: ActorWithPermissions = createActor({
            role: RoleEnum.ADMIN,
            permissions: [PermissionEnum.ACCOMMODATION_RESTORE_ANY]
        });
        const deletedAccommodation = { ...accommodation, deletedAt: new Date() };
        mockModel.findById.mockResolvedValue(deletedAccommodation);
        const result = await service.canRestoreEntity(actor, deletedAccommodation);
        expect(result.canRestore).toBe(false);
    });

    it('actor con ambos permisos (any y own) puede restore según corresponda', async () => {
        const actor: ActorWithPermissions = createActor({
            id: accommodation.ownerId,
            role: RoleEnum.ADMIN,
            permissions: [
                PermissionEnum.ACCOMMODATION_RESTORE_ANY,
                PermissionEnum.ACCOMMODATION_RESTORE_OWN
            ]
        });
        mockModel.findById.mockResolvedValue(accommodation);
        const result = await service.canRestoreEntity(actor, accommodation);
        expect(result.canRestore).toBe(true);
    });
});
