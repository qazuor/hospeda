import { AccommodationModel } from '@repo/db';
import { LifecycleStatusEnum, PermissionEnum } from '@repo/types';
import { type Mock, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../accommodation/accommodation.service';
import * as permissionManager from '../../utils/permission-manager';
import {
    createMockAccommodation,
    createMockArchivedAccommodation,
    getMockAccommodationId
} from '../factories/accommodationFactory';
import {
    getMockAdminUser,
    getMockDisabledUser,
    getMockOwnerUser,
    getMockPublicUser,
    getMockUserId,
    getMockUserWithoutPermissions
} from '../factories/userFactory';
import { expectInfoLog, expectPermissionLog } from '../utils/log-assertions';

describe('accommodation.service.softDelete', () => {
    it('should soft-delete (archive) accommodation when user is the owner and has permission', async () => {
        // Arrange: Create an owner user and a non-archived accommodation
        const ownerId = getMockUserId();
        const user = getMockOwnerUser({ id: ownerId });
        const accommodation = createMockAccommodation({ ownerId });
        const now = new Date();
        const archivedAccommodation = createMockArchivedAccommodation({
            ownerId,
            deletedAt: now,
            deletedById: ownerId,
            updatedAt: now,
            updatedById: ownerId
        });
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);
        (AccommodationModel.update as Mock).mockResolvedValue(archivedAccommodation);

        // Act: Attempt to soft-delete the accommodation as the owner
        const result = await AccommodationService.softDelete({ id: accommodation.id }, user);

        // Assert: The accommodation is archived and fields are set correctly
        expect(result.accommodation).toMatchObject({
            ...accommodation,
            lifecycleState: LifecycleStatusEnum.ARCHIVED,
            deletedById: ownerId,
            updatedById: ownerId
        });
        expect(result.accommodation?.deletedAt).toBeInstanceOf(Date);
        expect(result.accommodation?.updatedAt).toBeInstanceOf(Date);
        // Assert logs
        expectInfoLog({ input: { id: accommodation.id }, actor: user }, 'delete:start');
        expectInfoLog({ result: { accommodation: archivedAccommodation } }, 'delete:end');
    });

    it('should soft-delete accommodation when user is ADMIN and has global permission', async () => {
        // Arrange: Create an admin user and a non-archived accommodation
        const adminId = getMockUserId();
        const adminUser = getMockAdminUser({ id: adminId });
        const ownerId = getMockUserId();
        const accommodation = createMockAccommodation({ ownerId });
        const now = new Date();
        const archivedAccommodation = createMockArchivedAccommodation({
            ownerId,
            deletedAt: now,
            deletedById: adminId,
            updatedAt: now,
            updatedById: adminId
        });
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);
        (AccommodationModel.update as Mock).mockResolvedValue(archivedAccommodation);

        // Act: Attempt to soft-delete the accommodation as admin
        const result = await AccommodationService.softDelete({ id: accommodation.id }, adminUser);

        // Assert: The accommodation is archived and fields are set correctly
        expect(result.accommodation).toMatchObject({
            ...accommodation,
            lifecycleState: LifecycleStatusEnum.ARCHIVED,
            deletedById: adminId,
            updatedById: adminId
        });
        expect(result.accommodation?.deletedAt).toBeInstanceOf(Date);
        expect(result.accommodation?.updatedAt).toBeInstanceOf(Date);
        // Assert logs
        expectInfoLog({ input: { id: accommodation.id }, actor: adminUser }, 'delete:start');
        expectInfoLog({ result: { accommodation: archivedAccommodation } }, 'delete:end');
    });

    it('should deny delete if user is not the owner and lacks global permissions', async () => {
        // Arrange: Create a user who is not the owner and has no global permissions
        const ownerId = getMockUserId();
        const notOwnerId = getMockUserId('not-owner-id');
        const user = getMockUserWithoutPermissions({ id: notOwnerId });
        const accommodation = createMockAccommodation({ ownerId });
        vi.spyOn(permissionManager, 'hasPermission').mockImplementation(() => {
            throw new Error('Forbidden: User does not have permission to delete accommodation');
        });
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);

        // Act & Assert: Attempt to soft-delete and expect a forbidden error
        await expect(
            AccommodationService.softDelete({ id: accommodation.id }, user)
        ).rejects.toThrow(/Forbidden/);
        // Assert permission log
        expectPermissionLog({
            permission: expect.any(String),
            userId: notOwnerId,
            role: user.role,
            extraData: expect.objectContaining({ error: expect.stringContaining('Forbidden') })
        });
    });

    it('should deny delete if user is disabled', async () => {
        // Arrange: Create a disabled user and a non-archived accommodation
        const ownerId = getMockUserId();
        const disabledUser = getMockDisabledUser({
            id: ownerId,
            lifecycleState: LifecycleStatusEnum.INACTIVE
        });
        const accommodation = createMockAccommodation({ ownerId });
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);

        // Act & Assert: Attempt to soft-delete and expect forbidden error
        await expect(
            AccommodationService.softDelete({ id: accommodation.id }, disabledUser)
        ).rejects.toThrow(/Forbidden: user disabled/);
        // Assert permission log for disabled user
        expectPermissionLog({
            permission: PermissionEnum.ACCOMMODATION_DELETE_OWN,
            userId: disabledUser.id,
            role: disabledUser.role,
            extraData: expect.objectContaining({ reason: 'user disabled' })
        });
    });

    it('should deny delete if user is public (unauthenticated)', async () => {
        // Arrange: Create a public user and a non-archived accommodation
        const ownerId = getMockUserId();
        const publicUser = getMockPublicUser();
        const accommodation = createMockAccommodation({ ownerId });
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);

        // Act & Assert: Attempt to soft-delete and expect forbidden error
        await expect(
            AccommodationService.softDelete({ id: accommodation.id }, publicUser)
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

    it('should deny delete if user has insufficient permissions', async () => {
        // Arrange: Create a user who is not the owner and has insufficient permissions
        const ownerId = getMockUserId();
        const notOwnerId = getMockUserId('not-owner-id');
        const user = getMockUserWithoutPermissions({ id: notOwnerId });
        const accommodation = createMockAccommodation({ ownerId });
        vi.spyOn(permissionManager, 'hasPermission').mockImplementation(() => {
            throw new Error('Forbidden: User does not have permission to delete accommodation');
        });
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);

        // Act & Assert: Attempt to soft-delete and expect forbidden error
        await expect(
            AccommodationService.softDelete({ id: accommodation.id }, user)
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
        const user = getMockOwnerUser();
        (AccommodationModel.getById as Mock).mockResolvedValue(undefined);

        // Act & Assert: Attempt to soft-delete and expect not found error
        await expect(
            AccommodationService.softDelete({ id: getMockAccommodationId('not-exist') }, user)
        ).rejects.toThrow('Accommodation not found');
        // Assert info log for result null
        expectInfoLog({ result: { accommodation: null } }, 'delete:end');
    });

    it('should throw if accommodation is already archived or deleted', async () => {
        // Arrange: Create a user and an already archived accommodation
        const ownerId = getMockUserId();
        const user = getMockOwnerUser({ id: ownerId });
        const archivedAccommodation = createMockArchivedAccommodation({ ownerId });
        (AccommodationModel.getById as Mock).mockResolvedValue(archivedAccommodation);

        // Act & Assert: Attempt to soft-delete and expect already archived error
        await expect(
            AccommodationService.softDelete({ id: archivedAccommodation.id }, user)
        ).rejects.toThrow('Accommodation is already archived or deleted');
        // Assert info log for result null
        expectInfoLog({ result: { accommodation: null } }, 'delete:end');
    });

    it('softDelete should call serviceLogger.info and serviceLogger.permission at the correct points', async () => {
        // Success case: info logs
        const ownerId = getMockUserId();
        const user = getMockOwnerUser({ id: ownerId });
        const accommodation = createMockAccommodation({ ownerId });
        const now = new Date();
        const archivedAccommodation = createMockArchivedAccommodation({
            ownerId,
            deletedAt: now,
            deletedById: ownerId,
            updatedAt: now,
            updatedById: ownerId
        });
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);
        (AccommodationModel.update as Mock).mockResolvedValue(archivedAccommodation);

        await AccommodationService.softDelete({ id: accommodation.id }, user);
        expectInfoLog({ input: { id: accommodation.id }, actor: user }, 'delete:start');
        expectInfoLog({ result: { accommodation: archivedAccommodation } }, 'delete:end');

        // Permission error case: permission log
        vi.clearAllMocks();
        vi.spyOn(permissionManager, 'hasPermission').mockImplementation(() => {
            throw new Error('Forbidden: User does not have permission to delete accommodation');
        });
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);
        await expect(
            AccommodationService.softDelete({ id: accommodation.id }, user)
        ).rejects.toThrow(/Forbidden/);
        expectPermissionLog({
            permission: expect.any(String),
            userId: user.id,
            role: user.role,
            extraData: expect.objectContaining({ error: expect.stringContaining('Forbidden') })
        });
    });

    it('softDelete should set deletedAt, deletedById, updatedAt, updatedById, and lifecycleState to ARCHIVED', async () => {
        // Arrange: Create an owner user and a non-archived accommodation
        const ownerId = getMockUserId();
        const user = getMockOwnerUser({ id: ownerId });
        const accommodation = createMockAccommodation({ ownerId });
        const now = new Date();
        const archivedAccommodation = createMockArchivedAccommodation({
            ownerId,
            deletedAt: now,
            deletedById: ownerId,
            updatedAt: now,
            updatedById: ownerId
        });
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        (AccommodationModel.getById as Mock).mockResolvedValue(accommodation);
        (AccommodationModel.update as Mock).mockResolvedValue(archivedAccommodation);

        // Act: Attempt to soft-delete the accommodation as the owner
        const result = await AccommodationService.softDelete({ id: accommodation.id }, user);

        // Assert: All fields are set correctly
        expect(result.accommodation?.lifecycleState).toBe(LifecycleStatusEnum.ARCHIVED);
        expect(result.accommodation?.deletedAt).toBeInstanceOf(Date);
        expect(result.accommodation?.deletedById).toBe(ownerId);
        expect(result.accommodation?.updatedAt).toBeInstanceOf(Date);
        expect(result.accommodation?.updatedById).toBe(ownerId);
    });

    it('should not allow double deletion (idempotency)', async () => {
        // Arrange: Create an owner user and an already archived accommodation
        const ownerId = getMockUserId();
        const user = getMockOwnerUser({ id: ownerId });
        const archivedAccommodation = createMockArchivedAccommodation({ ownerId });
        (AccommodationModel.getById as Mock).mockResolvedValue(archivedAccommodation);

        // Act & Assert: Attempt to soft-delete again and expect already archived error
        await expect(
            AccommodationService.softDelete({ id: archivedAccommodation.id }, user)
        ).rejects.toThrow('Accommodation is already archived or deleted');
        // Assert info log for result null
        expectInfoLog({ result: { accommodation: null } }, 'delete:end');
    });
});
