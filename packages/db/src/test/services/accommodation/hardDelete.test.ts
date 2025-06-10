import {
    type AccommodationId,
    LifecycleStatusEnum,
    PermissionEnum,
    type UserId
} from '@repo/types';
import { type Mock, describe, expect, it, vi } from 'vitest';
import { AccommodationModel } from '../../../models/accommodation/accommodation.model';
import { AccommodationService } from '../../../services/accommodation/accommodation.service';
import * as permissionManager from '../../../utils/permission-manager';
import { makeAccommodation } from '../../factories/accommodationFactory';
import {
    makeAdmin,
    makeDisabledUser,
    makeOwner,
    makePublicUser,
    makeUserWithoutPermissions
} from '../../factories/userFactory';
import { getMockUserId } from '../mockData';

import { expectInfoLog, expectPermissionLog } from '../../utils/log-assertions';

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

describe('accommodation.service.hardDelete', () => {
    it('should hard-delete accommodation when user is the owner and has permission', async () => {
        // Arrange: Create an owner user and an accommodation
        const ownerId = getMockUserId();
        const user = makeOwner({ id: ownerId });
        const accommodation = makeAccommodation({ ownerId });
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);
        (AccommodationModel.hardDelete as Mock).mockResolvedValue(true);

        // Act: Attempt to hard-delete the accommodation as the owner
        const result = await AccommodationService.hardDelete({ id: accommodation.id }, user);

        // Assert: The accommodation is hard-deleted (success: true) and logs are correct
        expect(result.success).toBe(true);
        expectInfoLog({ input: { id: accommodation.id }, actor: user }, 'hardDelete:start');
        expectInfoLog({ result: { success: true } }, 'hardDelete:end');
    });

    it('should hard-delete accommodation when user is ADMIN and has global permission', async () => {
        // Arrange: Create an admin user and an accommodation
        const adminId = getMockUserId();
        const adminUser = makeAdmin({ id: adminId });
        const accommodation = makeAccommodation({ ownerId: getMockUserId() });
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);
        (AccommodationModel.hardDelete as Mock).mockResolvedValue(true);

        // Act: Attempt to hard-delete the accommodation as admin
        const result = await AccommodationService.hardDelete({ id: accommodation.id }, adminUser);

        // Assert: The accommodation is hard-deleted (success: true) and logs are correct
        expect(result.success).toBe(true);
        expectInfoLog({ input: { id: accommodation.id }, actor: adminUser }, 'hardDelete:start');
        expectInfoLog({ result: { success: true } }, 'hardDelete:end');
    });

    it('should deny hard-delete if user is not the owner and lacks global permissions', async () => {
        // Arrange: Create a user who is not the owner and has no global permissions
        const ownerId = getMockUserId();
        const notOwnerId = 'not-owner-id' as UserId;
        const user = makeUserWithoutPermissions({ id: notOwnerId });
        const accommodation = makeAccommodation({ ownerId });
        vi.spyOn(permissionManager, 'hasPermission').mockImplementation(() => {
            throw new Error(
                'Forbidden: User does not have permission to hard-delete accommodation'
            );
        });
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);

        // Act & Assert: Attempt to hard-delete and expect a forbidden error
        await expect(
            AccommodationService.hardDelete({ id: accommodation.id }, user)
        ).rejects.toThrow(/Forbidden/);
        // Assert permission log
        expectPermissionLog({
            permission: PermissionEnum.ACCOMMODATION_HARD_DELETE,
            userId: notOwnerId,
            role: user.role,
            extraData: expect.objectContaining({ error: expect.stringContaining('Forbidden') })
        });
    });

    it('should deny hard-delete if user is disabled', async () => {
        // Arrange: Create a disabled user and an accommodation
        const ownerId = getMockUserId();
        const disabledUser = makeDisabledUser({
            id: ownerId,
            lifecycleState: LifecycleStatusEnum.INACTIVE
        });
        const accommodation = makeAccommodation({ ownerId });
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);

        // Act & Assert: Attempt to hard-delete and expect forbidden error
        await expect(
            AccommodationService.hardDelete({ id: accommodation.id }, disabledUser)
        ).rejects.toThrow(/Forbidden: user disabled/);
        // Assert permission log for disabled user
        expectPermissionLog({
            permission: PermissionEnum.ACCOMMODATION_HARD_DELETE,
            userId: disabledUser.id,
            role: disabledUser.role,
            extraData: expect.objectContaining({ reason: 'user disabled' })
        });
    });

    it('should deny hard-delete if user is public (unauthenticated)', async () => {
        // Arrange: Create a public user and an accommodation
        const ownerId = getMockUserId();
        const publicUser = makePublicUser();
        const accommodation = makeAccommodation({ ownerId });
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);

        // Act & Assert: Attempt to hard-delete and expect forbidden error
        await expect(
            AccommodationService.hardDelete({ id: accommodation.id }, publicUser)
        ).rejects.toThrow(/Forbidden/);
        // Assert permission log for public user
        expect(mockServiceLogger.permission).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'public',
                role: publicUser.role,
                extraData: expect.objectContaining({
                    error: expect.stringContaining('Forbidden')
                })
            })
        );
    });

    it('should deny hard-delete if user has insufficient permissions', async () => {
        // Arrange: Create a user who is not the owner and has insufficient permissions
        const ownerId = getMockUserId();
        const notOwnerId = 'not-owner-id' as UserId;
        const user = makeUserWithoutPermissions({ id: notOwnerId });
        const accommodation = makeAccommodation({ ownerId });
        vi.spyOn(permissionManager, 'hasPermission').mockImplementation(() => {
            throw new Error(
                'Forbidden: User does not have permission to hard-delete accommodation'
            );
        });
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);

        // Act & Assert: Attempt to hard-delete and expect forbidden error
        await expect(
            AccommodationService.hardDelete({ id: accommodation.id }, user)
        ).rejects.toThrow(/Forbidden/);
        // Assert permission log
        expectPermissionLog({
            permission: PermissionEnum.ACCOMMODATION_HARD_DELETE,
            userId: notOwnerId,
            role: user.role,
            extraData: expect.objectContaining({ error: expect.stringContaining('Forbidden') })
        });
    });

    it('should throw if accommodation does not exist', async () => {
        // Arrange: Create a user and mock getById to return undefined
        const user = makeOwner();
        (AccommodationModel.getById as Mock).mockResolvedValue(undefined);

        // Act & Assert: Attempt to hard-delete and expect not found error
        await expect(
            AccommodationService.hardDelete({ id: 'not-exist' as AccommodationId }, user)
        ).rejects.toThrow('Accommodation not found');
        // Assert info log for result false
        expectInfoLog({ result: { success: false } }, 'hardDelete:end');
    });

    it('hardDelete should call serviceLogger.info and serviceLogger.permission at the correct points', async () => {
        // Arrange: test that logs are called correctly on success and permission error
        const ownerId = getMockUserId();
        const user = makeOwner({ id: ownerId });
        const accommodation = makeAccommodation({ ownerId });
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);
        (AccommodationModel.hardDelete as Mock).mockResolvedValue(true);

        // Act (successful case)
        await AccommodationService.hardDelete({ id: accommodation.id }, user);

        // Assert (successful case)
        expectInfoLog({ input: { id: accommodation.id }, actor: user }, 'hardDelete:start');
        expectInfoLog({ result: { success: true } }, 'hardDelete:end');

        // Arrange (permission error case)
        vi.clearAllMocks();
        vi.spyOn(permissionManager, 'hasPermission').mockImplementation(() => {
            throw new Error(
                'Forbidden: User does not have permission to hard-delete accommodation'
            );
        });
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);

        // Act & Assert (permission error case)
        await expect(
            AccommodationService.hardDelete({ id: accommodation.id }, user)
        ).rejects.toThrow(/Forbidden/);
        expectPermissionLog({
            permission: PermissionEnum.ACCOMMODATION_HARD_DELETE,
            userId: user.id,
            role: user.role,
            extraData: expect.objectContaining({
                error: expect.stringContaining('Forbidden')
            })
        });
    });

    it('should not allow double hard-delete (idempotency)', async () => {
        // Arrange: Create an owner user and an already deleted accommodation
        const ownerId = getMockUserId();
        const user = makeOwner({ id: ownerId });
        const accommodation = makeAccommodation({ ownerId });
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);
        (AccommodationModel.hardDelete as Mock).mockResolvedValue(true);
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);

        // Act: Successful hard-delete
        await AccommodationService.hardDelete({ id: accommodation.id }, user);

        // Arrange: Simulate that it no longer exists (getById returns undefined)
        (AccommodationModel.getById as Mock).mockResolvedValue(undefined);

        // Act & Assert: Second attempt should throw error and log success: false
        await expect(
            AccommodationService.hardDelete({ id: accommodation.id }, user)
        ).rejects.toThrow('Accommodation not found');
        expectInfoLog({ result: { success: false } }, 'hardDelete:end');
    });

    it('should allow hard-delete if already soft-deleted (archived)', async () => {
        // Arrange: Create an owner user and an archived accommodation
        const ownerId = getMockUserId();
        const user = makeOwner({ id: ownerId });
        const now = new Date();
        const archivedAccommodation = {
            ...makeAccommodation({ ownerId }),
            lifecycleState: LifecycleStatusEnum.ARCHIVED,
            deletedAt: now,
            deletedById: ownerId
        };
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        (AccommodationModel.getById as Mock).mockResolvedValue(archivedAccommodation);
        (AccommodationModel.hardDelete as Mock).mockResolvedValue(true);

        // Act: Attempt to hard-delete the archived accommodation
        const result = await AccommodationService.hardDelete(
            { id: archivedAccommodation.id },
            user
        );

        // Assert: The accommodation is hard-deleted (success: true) and logs are correct
        expect(result.success).toBe(true);
        expectInfoLog({ input: { id: archivedAccommodation.id }, actor: user }, 'hardDelete:start');
        expectInfoLog({ result: { success: true } }, 'hardDelete:end');
    });
});
