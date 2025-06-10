import {
    type AccommodationId,
    LifecycleStatusEnum,
    PermissionEnum,
    RoleEnum,
    type VisibilityEnum
} from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationModel } from '../../../models/accommodation/accommodation.model';
import { AccommodationService } from '../../../services/accommodation/accommodation.service';
import {
    expectInfoLog,
    expectNoPermissionLog,
    expectPermissionLog
} from '../../utils/logAssertions';
import {
    getMockAccommodation,
    getMockAccommodationPrivate,
    getMockAccommodationPublic,
    getMockPublicUser,
    getMockUser,
    getMockUserId
} from '../mockData';

vi.mock('../../../models/accommodation/accommodation.model', async (importOriginal) => {
    const actualImport = await importOriginal();
    const actual = typeof actualImport === 'object' && actualImport !== null ? actualImport : {};
    return {
        ...actual,
        AccommodationModel: {
            ...((actual as Record<string, unknown>).AccommodationModel ?? {}),
            create: vi.fn(),
            getById: vi.fn(),
            getByName: vi.fn(),
            search: vi.fn(),
            update: vi.fn(),
            hardDelete: vi.fn(),
            getByDestination: vi.fn()
        },
        ACCOMMODATION_ORDERABLE_COLUMNS: [
            'ownerId',
            'destinationId',
            'averageRating',
            'visibility',
            'lifecycle',
            'name',
            'type'
        ]
    };
});

describe('accommodation.service.getByName', () => {
    // This test verifies that a public user can access a PUBLIC accommodation by name.
    const publicUser = getMockPublicUser();
    const user = getMockUser({
        id: getMockUserId(),
        role: RoleEnum.ADMIN,
        permissions: [PermissionEnum.ACCOMMODATION_CREATE]
    });
    const disabledUser = getMockUser({
        id: getMockUserId(),
        role: RoleEnum.ADMIN,
        settings: {
            notifications: {
                enabled: false,
                allowEmails: true,
                allowSms: true,
                allowPush: true
            }
        }
    });
    const accommodationPublic = getMockAccommodationPublic();
    const accommodationPrivate = getMockAccommodationPrivate();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return accommodation for public user if visibility is PUBLIC', async () => {
        // Arrange: Set up a public accommodation and a public user.
        (AccommodationModel.getByName as Mock).mockResolvedValue(accommodationPublic);
        // Act: Attempt to get the accommodation by name as a public user.
        const resultByName = await AccommodationService.getByName(
            { name: accommodationPublic.name },
            publicUser
        );
        // Assert: The accommodation is returned and logs are correct.
        expect(resultByName.accommodation).toEqual(accommodationPublic);
        expectInfoLog(
            { input: { name: accommodationPublic.name }, actor: publicUser },
            'getByName:start'
        );
        expectInfoLog({ result: { accommodation: accommodationPublic } }, 'getByName:end');
    });

    // This test verifies that a public user cannot access a PRIVATE accommodation by name and logs the permission denial.
    it('should return null and log permission for public user if visibility is PRIVATE', async () => {
        // Arrange: Set up a private accommodation and a public user.
        (AccommodationModel.getByName as Mock).mockResolvedValue(accommodationPrivate);
        // Act: Attempt to get the accommodation by name as a public user.
        const resultByName = await AccommodationService.getByName(
            { name: accommodationPrivate.name },
            publicUser
        );
        // Assert: The result is null and a permission log is created.
        expect(resultByName.accommodation).toBeNull();
        expectPermissionLog({
            permission: PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,
            userId: 'public',
            role: RoleEnum.GUEST,
            extraData: expect.anything()
        });
    });

    // This test verifies that a logged-in user can access a PRIVATE accommodation by name.
    it('should return accommodation for logged in user regardless of visibility', async () => {
        // Arrange: Set up a private accommodation and an admin user.
        (AccommodationModel.getByName as Mock).mockResolvedValue(accommodationPrivate);
        // Act: Attempt to get the accommodation by name as an admin user.
        const resultByName = await AccommodationService.getByName(
            { name: accommodationPrivate.name },
            user
        );
        // Assert: The accommodation is returned and logs are correct.
        expect(resultByName.accommodation).toEqual(accommodationPrivate);
        expectInfoLog(
            { input: { name: accommodationPrivate.name }, actor: user },
            'getByName:start'
        );
        expectInfoLog({ result: { accommodation: accommodationPrivate } }, 'getByName:end');
    });

    // This test verifies that if the accommodation does not exist, null is returned and no permission log is created.
    it('should return null if accommodation does not exist', async () => {
        // Arrange: Set up a non-existent accommodation name and a public user.
        (AccommodationModel.getByName as Mock).mockResolvedValue(undefined);
        // Act: Attempt to get the accommodation by name as a public user.
        const resultByName = await AccommodationService.getByName(
            { name: 'not-exist' },
            publicUser
        );
        // Assert: The result is null and no permission log is created.
        expect(resultByName.accommodation).toBeNull();
        expectNoPermissionLog();
    });

    // This test verifies that a disabled user cannot access a PRIVATE accommodation by name and logs the permission denial with a specific reason.
    it('should return null and log permission if user is disabled', async () => {
        // Arrange: Set up a private accommodation and a disabled user.
        (AccommodationModel.getByName as Mock).mockResolvedValue(accommodationPrivate);
        // Act: Attempt to get the accommodation by name as a disabled user.
        const result = await AccommodationService.getByName(
            { name: accommodationPrivate.name },
            { ...disabledUser, lifecycleState: LifecycleStatusEnum.INACTIVE }
        );
        // Assert: The result is null and a permission log is created with the reason 'user disabled'.
        expect(result.accommodation).toBeNull();
        expectPermissionLog({
            permission: PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,
            userId: disabledUser.id,
            role: disabledUser.role,
            extraData: expect.objectContaining({ reason: 'user disabled' })
        });
    });

    // Edge-case: Ensures that if the accommodation has an unknown visibility, an error is thrown and the permission log contains the correct details.
    it('should throw and log if accommodation has unknown visibility', async () => {
        // Arrange: Set up an accommodation with unknown visibility and an admin user.
        const accommodationUnknown = getMockAccommodation({
            id: 'acc-3' as AccommodationId,
            name: 'Unknown Hotel',
            visibility: 'UNKNOWN' as unknown as VisibilityEnum
        });
        (AccommodationModel.getByName as Mock).mockResolvedValue(accommodationUnknown);
        // Act & Assert: Attempt to get the accommodation by name and expect an error. The permission log should contain the error details.
        await expect(
            AccommodationService.getByName({ name: 'Unknown Hotel' }, user)
        ).rejects.toThrow(/Unknown accommodation visibility/);
        expectPermissionLog({
            permission: 'UNKNOWN_PERMISSION',
            userId: user.id,
            role: user.role,
            extraData: expect.objectContaining({
                error: 'unknown visibility',
                visibility: 'UNKNOWN',
                input: expect.any(Object)
            })
        });
    });
});
