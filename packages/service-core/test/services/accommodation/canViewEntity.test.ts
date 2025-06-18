import { RoleEnum } from '@repo/types';
import { PermissionEnum } from '@repo/types/enums/permission.enum';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import { createAccommodation } from '../../factories/accommodationFactory';
import { type ActorWithPermissions, createActor } from '../../factories/actorFactory';
import '../../setupTest';

const mockModel = {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn()
};

class TestableAccommodationService extends AccommodationService {
    public canViewEntity = super.canViewEntity;
}

describe('AccommodationService.canViewEntity', () => {
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

    it('no se puede view si deletedAt está presente', async () => {
        const actor: ActorWithPermissions = createActor({
            role: RoleEnum.ADMIN,
            permissions: [PermissionEnum.ACCOMMODATION_VIEW_ALL]
        });
        const deletedAccommodation = { ...accommodation, deletedAt: new Date() };
        const result = await service.canViewEntity(actor, deletedAccommodation);
        expect(result.canView).toBe(false);
    });
});
