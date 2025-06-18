/**
 * accommodation.service.test.ts
 *
 * Tests for AccommodationService.
 */

import { RoleEnum } from '@repo/types';
import { PermissionEnum } from '@repo/types/enums/permission.enum';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import {
    createAccommodation,
    createNewAccommodationInput,
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

// Subclase para exponer métodos protegidos
class TestableAccommodationService extends AccommodationService {
    public canViewEntity = super.canViewEntity;
    public canDeleteEntity = super.canDeleteEntity;
    public canRestoreEntity = super.canRestoreEntity;
}

describe('AccommodationService', () => {
    let service: TestableAccommodationService;
    const accommodation = createAccommodation();
    const newInput = createNewAccommodationInput();
    const updateInput = { ...createUpdateAccommodationInput(), id: accommodation.id };
    const _actor: ActorWithPermissions = createActor({
        role: RoleEnum.ADMIN,
        permissions: [PermissionEnum.ACCOMMODATION_VIEW_ALL]
    });

    beforeEach(() => {
        service = new TestableAccommodationService();
        // @ts-expect-error override for test
        service.model = mockModel;
        for (const fn of Object.values(mockModel)) {
            fn.mockReset();
        }
    });

    it('deniega create si falta permiso', async () => {
        const actor: ActorWithPermissions = createActor({ role: RoleEnum.ADMIN, permissions: [] });
        const result = await service.create({ actor, ...newInput });
        expect(result.error).toBeDefined();
    });

    it('permite create si tiene permiso', async () => {
        const actor: ActorWithPermissions = createActor({
            role: RoleEnum.ADMIN,
            permissions: [PermissionEnum.ACCOMMODATION_CREATE]
        });
        mockModel.create.mockResolvedValue(accommodation);
        const result = await service.create({ actor, ...newInput });
        expect(result.data).toEqual(accommodation);
        expect(mockModel.create).toHaveBeenCalled();
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

    it('deniega view si falta permiso (excepto featured)', async () => {
        const actor: ActorWithPermissions = createActor({ permissions: [] });
        const nonFeatured = { ...accommodation, isFeatured: false };
        const result = await service.canViewEntity(actor, nonFeatured);
        expect(result.canView).toBe(false);
    });

    it('permite view si tiene permiso', async () => {
        const actor: ActorWithPermissions = createActor({
            permissions: [PermissionEnum.ACCOMMODATION_VIEW_ALL]
        });
        const nonFeatured = { ...accommodation, isFeatured: false };
        const result = await service.canViewEntity(actor, nonFeatured);
        expect(result.canView).toBe(true);
    });

    it('permite view a cualquiera si es featured', async () => {
        const actor: ActorWithPermissions = createActor({ permissions: [] });
        const featured = { ...accommodation, isFeatured: true };
        const result = await service.canViewEntity(actor, featured);
        expect(result.canView).toBe(true);
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

    it('handles not found on update', async () => {
        const actor: ActorWithPermissions = createActor();
        mockModel.findById.mockResolvedValue(null);
        const result = await service.update({ actor, ...updateInput });
        expect(result.error).toBeDefined();
    });

    it('admin con permiso own pero no any no puede update/delete/restore alojamientos ajenos', async () => {
        const actor: ActorWithPermissions = createActor({
            id: getMockId('user', 'admin') as typeof accommodation.ownerId,
            role: RoleEnum.ADMIN,
            permissions: [
                PermissionEnum.ACCOMMODATION_UPDATE_OWN,
                PermissionEnum.ACCOMMODATION_DELETE_OWN,
                PermissionEnum.ACCOMMODATION_RESTORE_OWN
            ]
        });
        const otherAccommodation = {
            ...accommodation,
            ownerId: getMockId('user', 'owner') as typeof accommodation.ownerId
        };
        mockModel.findById.mockResolvedValue(otherAccommodation);
        expect(
            (await service.update({ actor, ...updateInput, id: otherAccommodation.id })).error
        ).toBeDefined();
        expect((await service.canDeleteEntity(actor, otherAccommodation)).canDelete).toBe(false);
        expect((await service.canRestoreEntity(actor, otherAccommodation)).canRestore).toBe(false);
    });

    it('host con permiso any no puede update/delete/restore alojamientos ajenos', async () => {
        const actor: ActorWithPermissions = createActor({
            role: RoleEnum.HOST,
            permissions: [
                PermissionEnum.ACCOMMODATION_UPDATE_ANY,
                PermissionEnum.ACCOMMODATION_DELETE_ANY,
                PermissionEnum.ACCOMMODATION_RESTORE_ANY
            ]
        });
        const otherAccommodation = {
            ...accommodation,
            ownerId: getMockId('user') as typeof accommodation.ownerId
        };
        mockModel.findById.mockResolvedValue(otherAccommodation);
        expect(
            (await service.update({ actor, ...updateInput, id: otherAccommodation.id })).error
        ).toBeDefined();
        expect((await service.canDeleteEntity(actor, otherAccommodation)).canDelete).toBe(false);
        expect((await service.canRestoreEntity(actor, otherAccommodation)).canRestore).toBe(false);
    });

    it('user con permisos pero sin rol adecuado no puede update/delete/restore', async () => {
        const actor: ActorWithPermissions = createActor({
            role: RoleEnum.USER,
            permissions: [
                PermissionEnum.ACCOMMODATION_UPDATE_ANY,
                PermissionEnum.ACCOMMODATION_DELETE_ANY,
                PermissionEnum.ACCOMMODATION_RESTORE_ANY
            ]
        });
        mockModel.findById.mockResolvedValue(accommodation);
        expect((await service.update({ actor, ...updateInput })).error).toBeDefined();
        expect((await service.canDeleteEntity(actor, accommodation)).canDelete).toBe(false);
        expect((await service.canRestoreEntity(actor, accommodation)).canRestore).toBe(false);
    });

    it('owner con permiso own pero sobre otro alojamiento no puede update/delete/restore', async () => {
        const actor: ActorWithPermissions = createActor({
            id: getMockId('user', 'not-owner') as typeof accommodation.ownerId,
            role: RoleEnum.HOST,
            permissions: [
                PermissionEnum.ACCOMMODATION_UPDATE_OWN,
                PermissionEnum.ACCOMMODATION_DELETE_OWN,
                PermissionEnum.ACCOMMODATION_RESTORE_OWN
            ]
        });
        mockModel.findById.mockResolvedValue(accommodation);
        expect((await service.update({ actor, ...updateInput })).error).toBeDefined();
        expect((await service.canDeleteEntity(actor, accommodation)).canDelete).toBe(false);
        expect((await service.canRestoreEntity(actor, accommodation)).canRestore).toBe(false);
    });

    it('no se puede update/delete/restore/view si deletedAt está presente', async () => {
        const actor: ActorWithPermissions = createActor({
            role: RoleEnum.ADMIN,
            permissions: [
                PermissionEnum.ACCOMMODATION_UPDATE_ANY,
                PermissionEnum.ACCOMMODATION_DELETE_ANY,
                PermissionEnum.ACCOMMODATION_RESTORE_ANY,
                PermissionEnum.ACCOMMODATION_VIEW_ALL
            ]
        });
        const deletedAccommodation = { ...accommodation, deletedAt: new Date() };
        mockModel.findById.mockResolvedValue(deletedAccommodation);
        expect(
            (await service.update({ actor, ...updateInput, id: deletedAccommodation.id })).error
        ).toBeDefined();
        expect((await service.canDeleteEntity(actor, deletedAccommodation)).canDelete).toBe(false);
        expect((await service.canRestoreEntity(actor, deletedAccommodation)).canRestore).toBe(
            false
        );
        expect((await service.canViewEntity(actor, deletedAccommodation)).canView).toBe(false);
    });

    it('actor con ambos permisos (any y own) puede update/delete/restore según corresponda', async () => {
        const actor: ActorWithPermissions = createActor({
            id: accommodation.ownerId,
            role: RoleEnum.ADMIN,
            permissions: [
                PermissionEnum.ACCOMMODATION_UPDATE_ANY,
                PermissionEnum.ACCOMMODATION_UPDATE_OWN,
                PermissionEnum.ACCOMMODATION_DELETE_ANY,
                PermissionEnum.ACCOMMODATION_DELETE_OWN,
                PermissionEnum.ACCOMMODATION_RESTORE_ANY,
                PermissionEnum.ACCOMMODATION_RESTORE_OWN
            ]
        });
        mockModel.findById.mockResolvedValue(accommodation);
        mockModel.update.mockResolvedValue({ ...accommodation, name: 'Updated' });
        expect((await service.update({ actor, ...updateInput })).data?.name).toBe('Updated');
        expect((await service.canDeleteEntity(actor, accommodation)).canDelete).toBe(true);
        expect((await service.canRestoreEntity(actor, accommodation)).canRestore).toBe(true);
    });

    it('admin sin permisos no puede hacer nada', async () => {
        const actor: ActorWithPermissions = createActor({ role: RoleEnum.ADMIN, permissions: [] });
        mockModel.findById.mockResolvedValue(accommodation);
        expect((await service.update({ actor, ...updateInput })).error).toBeDefined();
        expect((await service.canDeleteEntity(actor, accommodation)).canDelete).toBe(false);
        expect((await service.canRestoreEntity(actor, accommodation)).canRestore).toBe(false);
    });

    it('host sin permisos no puede hacer nada', async () => {
        const actor: ActorWithPermissions = createActor({
            id: accommodation.ownerId,
            role: RoleEnum.HOST,
            permissions: []
        });
        mockModel.findById.mockResolvedValue(accommodation);
        expect((await service.update({ actor, ...updateInput })).error).toBeDefined();
        expect((await service.canDeleteEntity(actor, accommodation)).canDelete).toBe(false);
        expect((await service.canRestoreEntity(actor, accommodation)).canRestore).toBe(false);
    });

    it('cualquiera puede ver featured aunque no tenga permisos', async () => {
        const actor: ActorWithPermissions = createActor({ permissions: [] });
        const featured = { ...accommodation, isFeatured: true };
        expect((await service.canViewEntity(actor, featured)).canView).toBe(true);
    });
});
