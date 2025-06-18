import { RoleEnum } from '@repo/types';
import { PermissionEnum } from '@repo/types/enums/permission.enum';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import {
    createAccommodation,
    createUpdateAccommodationInput
} from '../../factories/accommodationFactory';
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

class TestableAccommodationService extends AccommodationService {}

describe('AccommodationService.update', () => {
    let service: TestableAccommodationService;
    const accommodation = createAccommodation();
    const updateInput = { ...createUpdateAccommodationInput(), id: accommodation.id };

    beforeEach(() => {
        service = new TestableAccommodationService();
        // @ts-expect-error override for test
        service.model = mockModel;
        for (const fn of Object.values(mockModel)) {
            fn.mockReset();
        }
    });

    it('deniega update si falta permiso', async () => {
        const actor: ActorWithPermissions = createActor({ permissions: [] });
        mockModel.findById.mockResolvedValue(accommodation);
        const result = await service.update({ actor, ...updateInput });
        expect(result.error).toBeDefined();
    });

    it('permite update si tiene permiso any', async () => {
        const actor: ActorWithPermissions = createActor({
            role: RoleEnum.ADMIN,
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY]
        });
        mockModel.findById.mockResolvedValue(accommodation);
        mockModel.update.mockResolvedValue({ ...accommodation, name: 'Updated' });
        const result = await service.update({ actor, ...updateInput });
        expect(result.data?.name).toBe('Updated');
        expect(mockModel.update).toHaveBeenCalled();
    });

    it('permite update si es owner y tiene permiso own', async () => {
        const actor: ActorWithPermissions = createActor({
            id: accommodation.ownerId,
            role: RoleEnum.HOST,
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
        });
        mockModel.findById.mockResolvedValue(accommodation);
        mockModel.update.mockResolvedValue({ ...accommodation, name: 'Updated' });
        const result = await service.update({ actor, ...updateInput });
        expect(result.data?.name).toBe('Updated');
    });

    it('handles not found on update', async () => {
        const actor: ActorWithPermissions = createActor();
        mockModel.findById.mockResolvedValue(null);
        const result = await service.update({ actor, ...updateInput });
        expect(result.error).toBeDefined();
    });

    it('admin con permiso own pero no any no puede update alojamientos ajenos', async () => {
        const actor: ActorWithPermissions = createActor({
            id: getMockId('user', 'admin') as typeof accommodation.ownerId,
            role: RoleEnum.ADMIN,
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
        });
        const otherAccommodation = {
            ...accommodation,
            ownerId: getMockId('user', 'owner') as typeof accommodation.ownerId
        };
        mockModel.findById.mockResolvedValue(otherAccommodation);
        const result = await service.update({ actor, ...updateInput, id: otherAccommodation.id });
        expect(result.error).toBeDefined();
    });

    it('host con permiso any no puede update alojamientos ajenos', async () => {
        const actor: ActorWithPermissions = createActor({
            role: RoleEnum.HOST,
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY]
        });
        const otherAccommodation = {
            ...accommodation,
            ownerId: getMockId('user') as typeof accommodation.ownerId
        };
        mockModel.findById.mockResolvedValue(otherAccommodation);
        const result = await service.update({ actor, ...updateInput, id: otherAccommodation.id });
        expect(result.error).toBeDefined();
    });

    it('user con permisos pero sin rol adecuado no puede update', async () => {
        const actor: ActorWithPermissions = createActor({
            role: RoleEnum.USER,
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY]
        });
        mockModel.findById.mockResolvedValue(accommodation);
        const result = await service.update({ actor, ...updateInput });
        expect(result.error).toBeDefined();
    });

    it('owner con permiso own pero sobre otro alojamiento no puede update', async () => {
        const actor: ActorWithPermissions = createActor({
            id: getMockId('user', 'not-owner') as typeof accommodation.ownerId,
            role: RoleEnum.HOST,
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
        });
        mockModel.findById.mockResolvedValue(accommodation);
        const result = await service.update({ actor, ...updateInput });
        expect(result.error).toBeDefined();
    });

    it('no se puede update si deletedAt está presente', async () => {
        const actor: ActorWithPermissions = createActor({
            role: RoleEnum.ADMIN,
            permissions: [PermissionEnum.ACCOMMODATION_UPDATE_ANY]
        });
        const deletedAccommodation = { ...accommodation, deletedAt: new Date() };
        mockModel.findById.mockResolvedValue(deletedAccommodation);
        const result = await service.update({ actor, ...updateInput, id: deletedAccommodation.id });
        expect(result.error).toBeDefined();
    });

    it('actor con ambos permisos (any y own) puede update según corresponda', async () => {
        const actor: ActorWithPermissions = createActor({
            id: accommodation.ownerId,
            role: RoleEnum.ADMIN,
            permissions: [
                PermissionEnum.ACCOMMODATION_UPDATE_ANY,
                PermissionEnum.ACCOMMODATION_UPDATE_OWN
            ]
        });
        mockModel.findById.mockResolvedValue(accommodation);
        mockModel.update.mockResolvedValue({ ...accommodation, name: 'Updated' });
        const result = await service.update({ actor, ...updateInput });
        expect(result.data?.name).toBe('Updated');
    });
});
