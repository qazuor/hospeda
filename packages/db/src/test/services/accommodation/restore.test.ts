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
import { makeAccommodation, makeArchivedAccommodation } from '../../factories/accommodationFactory';
import {
    makeAdmin,
    makeDisabledUser,
    makeOwner,
    makePublicUser,
    makeUserWithoutPermissions
} from '../../factories/userFactory';
import { getMockUserId } from '../../mockData';
import { expectInfoLog, expectPermissionLog } from '../../utils/logAssertions';

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

describe('accommodation.service.restore', () => {
    it('should restore accommodation when user is the owner and has permission', async () => {
        // Arrange: Create an owner user and an archived accommodation
        const ownerId = getMockUserId();
        const user = makeOwner({ id: ownerId });
        const now = new Date();
        const archivedAccommodation = {
            ...makeArchivedAccommodation({ ownerId }),
            deletedAt: now, // Asegura que deletedAt está presente
            lifecycleState: LifecycleStatusEnum.ARCHIVED
        };
        const restoredAccommodation = {
            ...archivedAccommodation,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            deletedAt: undefined,
            deletedById: undefined,
            updatedAt: now,
            updatedById: ownerId
        };
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        (AccommodationModel.getById as Mock).mockResolvedValue(archivedAccommodation);
        (AccommodationModel.update as Mock).mockResolvedValue(restoredAccommodation);

        // Act: Attempt to restore the accommodation as the owner
        const result = await AccommodationService.restore({ id: archivedAccommodation.id }, user);

        // Assert: The accommodation is restored and fields are set correctly
        expect(result.accommodation).toMatchObject({
            ...archivedAccommodation,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            deletedAt: undefined,
            deletedById: undefined,
            updatedById: ownerId
        });
        expect(result.accommodation?.updatedAt).toBeInstanceOf(Date);
        expectInfoLog({ input: { id: archivedAccommodation.id }, actor: user }, 'restore:start');
        expectInfoLog({ result: { accommodation: restoredAccommodation } }, 'restore:end');
    });

    it('should restore accommodation when user is ADMIN and has global permission', async () => {
        // Arrange: Create an admin user and an archived accommodation
        const adminId = getMockUserId();
        const adminUser = makeAdmin({ id: adminId });
        const now = new Date();
        const archivedAccommodation = {
            ...makeArchivedAccommodation({ ownerId: getMockUserId() }),
            deletedAt: now,
            lifecycleState: LifecycleStatusEnum.ARCHIVED
        };
        const restoredAccommodation = {
            ...archivedAccommodation,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            deletedAt: undefined,
            deletedById: undefined,
            updatedAt: now,
            updatedById: adminId
        };
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        (AccommodationModel.getById as Mock).mockResolvedValue(archivedAccommodation);
        (AccommodationModel.update as Mock).mockResolvedValue(restoredAccommodation);

        // Act: Attempt to restore the accommodation as admin
        const result = await AccommodationService.restore(
            { id: archivedAccommodation.id },
            adminUser
        );

        // Assert: The accommodation is restored and fields are set correctly
        expect(result.accommodation).toMatchObject({
            ...archivedAccommodation,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            deletedAt: undefined,
            deletedById: undefined,
            updatedById: adminId
        });
        expect(result.accommodation?.updatedAt).toBeInstanceOf(Date);
        expectInfoLog(
            { input: { id: archivedAccommodation.id }, actor: adminUser },
            'restore:start'
        );
        expectInfoLog({ result: { accommodation: restoredAccommodation } }, 'restore:end');
    });

    it('should deny restore if user is not the owner and lacks global permissions', async () => {
        // Arrange: Create a user who is not the owner and has no global permissions
        const ownerId = getMockUserId();
        const notOwnerId = 'not-owner-id' as UserId;
        const user = makeUserWithoutPermissions({ id: notOwnerId });
        const now = new Date();
        const archivedAccommodation = {
            ...makeArchivedAccommodation({ ownerId }),
            deletedAt: now,
            lifecycleState: LifecycleStatusEnum.ARCHIVED
        };
        vi.spyOn(permissionManager, 'hasPermission').mockImplementation(() => {
            throw new Error('Forbidden: User does not have permission to restore accommodation');
        });
        (AccommodationModel.getById as Mock).mockResolvedValue(archivedAccommodation);

        // Act & Assert: Attempt to restore and expect a forbidden error
        await expect(
            AccommodationService.restore({ id: archivedAccommodation.id }, user)
        ).rejects.toThrow(/Forbidden/);
        // Assert permission log
        expectPermissionLog({
            permission: expect.any(String),
            userId: notOwnerId,
            role: user.role,
            extraData: expect.objectContaining({ error: expect.stringContaining('Forbidden') })
        });
    });

    it('should deny restore if user is disabled', async () => {
        // Arrange: Create a disabled user and an archived accommodation
        const ownerId = getMockUserId();
        const disabledUser = makeDisabledUser({
            id: ownerId,
            lifecycleState: LifecycleStatusEnum.INACTIVE
        });
        const now = new Date();
        const archivedAccommodation = {
            ...makeArchivedAccommodation({ ownerId }),
            deletedAt: now,
            lifecycleState: LifecycleStatusEnum.ARCHIVED
        };
        (AccommodationModel.getById as Mock).mockResolvedValue(archivedAccommodation);

        // Act & Assert: Attempt to restore and expect forbidden error
        await expect(
            AccommodationService.restore({ id: archivedAccommodation.id }, disabledUser)
        ).rejects.toThrow(/Forbidden: user disabled/);
        // Assert permission log for disabled user
        expectPermissionLog({
            permission: PermissionEnum.ACCOMMODATION_RESTORE_OWN,
            userId: disabledUser.id,
            role: disabledUser.role,
            extraData: expect.objectContaining({ reason: 'user disabled' })
        });
    });

    it('should deny restore if user is public (unauthenticated)', async () => {
        // Arrange: Create a public user and an archived accommodation
        const ownerId = getMockUserId();
        const publicUser = makePublicUser();
        const now = new Date();
        const archivedAccommodation = {
            ...makeArchivedAccommodation({ ownerId }),
            deletedAt: now,
            lifecycleState: LifecycleStatusEnum.ARCHIVED
        };
        (AccommodationModel.getById as Mock).mockResolvedValue(archivedAccommodation);

        // Act & Assert: Attempt to restore and expect forbidden error
        await expect(
            AccommodationService.restore({ id: archivedAccommodation.id }, publicUser)
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

    it('should deny restore if user has insufficient permissions', async () => {
        // Arrange: Create a user who is not the owner and has insufficient permissions
        const ownerId = getMockUserId();
        const notOwnerId = 'not-owner-id' as UserId;
        const user = makeUserWithoutPermissions({ id: notOwnerId });
        const now = new Date();
        const archivedAccommodation = {
            ...makeArchivedAccommodation({ ownerId }),
            deletedAt: now,
            lifecycleState: LifecycleStatusEnum.ARCHIVED
        };
        vi.spyOn(permissionManager, 'hasPermission').mockImplementation(() => {
            throw new Error('Forbidden: User does not have permission to restore accommodation');
        });
        (AccommodationModel.getById as Mock).mockResolvedValue(archivedAccommodation);

        // Act & Assert: Attempt to restore and expect forbidden error
        await expect(
            AccommodationService.restore({ id: archivedAccommodation.id }, user)
        ).rejects.toThrow(/Forbidden/);
        // Assert permission log
        expectPermissionLog({
            permission: expect.any(String),
            userId: notOwnerId,
            role: user.role,
            extraData: expect.objectContaining({ error: expect.stringContaining('Forbidden') })
        });
    });

    it('should throw if accommodation does not exist', async () => {
        // Arrange: Create a user and mock getById to return undefined
        const user = makeOwner();
        (AccommodationModel.getById as Mock).mockResolvedValue(undefined);

        // Act & Assert: Attempt to restore and expect not found error
        await expect(
            AccommodationService.restore({ id: 'not-exist' as AccommodationId }, user)
        ).rejects.toThrow('Accommodation not found');
        // Assert info log for result null
        expectInfoLog({ result: { accommodation: null } }, 'restore:end');
    });

    it('should throw if accommodation is not archived', async () => {
        // Arrange: Create a user and a non-archived accommodation
        const ownerId = getMockUserId();
        const user = makeOwner({ id: ownerId });
        const notArchivedAccommodation = {
            ...makeAccommodation({ ownerId }),
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            deletedAt: undefined
        };
        (AccommodationModel.getById as Mock).mockResolvedValue(notArchivedAccommodation);

        // Act & Assert: Attempt to restore and expect error
        await expect(
            AccommodationService.restore({ id: notArchivedAccommodation.id }, user)
        ).rejects.toThrow('Accommodation is not archived');
        // Assert info log for result null
        expectInfoLog({ result: { accommodation: null } }, 'restore:end');
    });

    it('restore should call serviceLogger.info and serviceLogger.permission at the correct points', async () => {
        // Arrange: test that logs are called correctly on success and permission error
        const ownerId = getMockUserId();
        const user = makeOwner({ id: ownerId });
        const now = new Date();
        const archivedAccommodation = {
            ...makeArchivedAccommodation({ ownerId }),
            deletedAt: now,
            lifecycleState: LifecycleStatusEnum.ARCHIVED
        };
        const restoredAccommodation = {
            ...archivedAccommodation,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            deletedAt: undefined,
            deletedById: undefined,
            updatedAt: now,
            updatedById: ownerId
        };
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        (AccommodationModel.getById as Mock).mockResolvedValue(archivedAccommodation);
        (AccommodationModel.update as Mock).mockResolvedValue(restoredAccommodation);

        // Act (successful case)
        await AccommodationService.restore({ id: archivedAccommodation.id }, user);

        // Assert (successful case)
        expectInfoLog({ input: { id: archivedAccommodation.id }, actor: user }, 'restore:start');
        expectInfoLog({ result: { accommodation: restoredAccommodation } }, 'restore:end');

        // Arrange (permission error case)
        vi.clearAllMocks();
        vi.spyOn(permissionManager, 'hasPermission').mockImplementation(() => {
            throw new Error('Forbidden: User does not have permission to restore accommodation');
        });
        (AccommodationModel.getById as Mock).mockResolvedValue(archivedAccommodation);

        // Act & Assert (permission error case)
        await expect(
            AccommodationService.restore({ id: archivedAccommodation.id }, user)
        ).rejects.toThrow(/Forbidden/);
        expectPermissionLog({
            permission: expect.any(String),
            userId: user.id,
            role: user.role,
            extraData: expect.objectContaining({
                error: expect.stringContaining('Forbidden')
            })
        });
    });

    it('restore should set deletedAt, deletedById to undefined and lifecycleState to ACTIVE', async () => {
        // Arrange: Create an owner user and an archived accommodation
        const ownerId = getMockUserId();
        const user = makeOwner({ id: ownerId });
        const now = new Date();
        const archivedAccommodation = {
            ...makeArchivedAccommodation({ ownerId }),
            deletedAt: now,
            deletedById: ownerId,
            lifecycleState: LifecycleStatusEnum.ARCHIVED
        };
        const restoredAccommodation = {
            ...archivedAccommodation,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            deletedAt: undefined,
            deletedById: undefined,
            updatedAt: now,
            updatedById: ownerId
        };
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        (AccommodationModel.getById as Mock).mockResolvedValue(archivedAccommodation);
        (AccommodationModel.update as Mock).mockResolvedValue(restoredAccommodation);

        // Act: Attempt to restore the accommodation as the owner
        const result = await AccommodationService.restore({ id: archivedAccommodation.id }, user);

        // Assert: All fields are set correctly
        expect(result.accommodation?.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
        expect(result.accommodation?.deletedAt).toBeUndefined();
        expect(result.accommodation?.deletedById).toBeUndefined();
        expect(result.accommodation?.updatedAt).toBeInstanceOf(Date);
        expect(result.accommodation?.updatedById).toBe(ownerId);
    });

    it('should not allow restore if already active (idempotency)', async () => {
        // Arrange: Create an owner user and an already active accommodation
        const ownerId = getMockUserId();
        const user = makeOwner({ id: ownerId });
        const activeAccommodation = makeAccommodation({ ownerId });
        (AccommodationModel.getById as Mock).mockResolvedValue(activeAccommodation);

        // Act & Assert: Attempt to restore and expect already active error
        await expect(
            AccommodationService.restore({ id: activeAccommodation.id }, user)
        ).rejects.toThrow('Accommodation is not archived');
        // Assert info log for result null
        expectInfoLog({ result: { accommodation: null } }, 'restore:end');
    });
});
