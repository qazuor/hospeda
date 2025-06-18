import { RoleEnum } from '@repo/types';
import { PermissionEnum } from '@repo/types/enums/permission.enum';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import {
    createAccommodation,
    createNewAccommodationInput
} from '../../factories/accommodationFactory';
import { type ActorWithPermissions, createActor } from '../../factories/actorFactory';
import '../../setupTest';

const mockModel = {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn()
};

class TestableAccommodationService extends AccommodationService {}

describe('AccommodationService.create', () => {
    let service: TestableAccommodationService;
    const accommodation = createAccommodation();
    const newInput = createNewAccommodationInput();

    beforeEach(() => {
        service = new TestableAccommodationService();
        // @ts-expect-error override for test
        service.model = mockModel;
        for (const fn of Object.values(mockModel)) {
            fn.mockReset();
        }
    });

    it('denies create if missing permission', async () => {
        const actor: ActorWithPermissions = createActor({ role: RoleEnum.ADMIN, permissions: [] });
        const result = await service.create({ actor, ...newInput });
        expect(result.error).toBeDefined();
    });

    it('allows create if has permission', async () => {
        const actor: ActorWithPermissions = createActor({
            role: RoleEnum.ADMIN,
            permissions: [PermissionEnum.ACCOMMODATION_CREATE]
        });
        mockModel.create.mockResolvedValue(accommodation);
        const result = await service.create({ actor, ...newInput });
        expect(result.data).toEqual(accommodation);
        expect(mockModel.create).toHaveBeenCalled();
    });
});
