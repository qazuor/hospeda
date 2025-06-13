import { AccommodationModel } from '@repo/db';
import { LifecycleStatusEnum, PermissionEnum, RoleEnum, VisibilityEnum } from '@repo/types';
import { type Mock, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../accommodation/accommodation.service';
import { createMockAccommodation, getMockAccommodationId } from '../factories/accommodationFactory';
import { getMockDestinationId } from '../factories/destinationFactory';
import { createMockUser, getMockUserId } from '../factories/userFactory';
import { expectInfoLog, expectPermissionLog } from '../utils/log-assertions';

describe('accommodation.service.getByDestination', () => {
    it('should return all PUBLIC accommodations for a destination to a public user', async () => {
        // Arrange
        const publicUser = createMockUser({ role: RoleEnum.USER });
        const destinationId = getMockDestinationId('dest-1');
        const accommodationPublic1 = createMockAccommodation({
            id: getMockAccommodationId('acc-1'),
            destinationId,
            visibility: VisibilityEnum.PUBLIC
        });
        const accommodationPublic2 = createMockAccommodation({
            id: getMockAccommodationId('acc-2'),
            destinationId,
            visibility: VisibilityEnum.PUBLIC
        });
        (AccommodationModel.search as Mock).mockResolvedValue([
            accommodationPublic1,
            accommodationPublic2
        ]);
        // Act
        const result = await AccommodationService.getByDestination({ destinationId }, publicUser);
        // Assert
        expect(result.accommodations).toEqual([accommodationPublic1, accommodationPublic2]);
        expectInfoLog({ input: { destinationId }, actor: publicUser }, 'getByDestination:start');
        expectInfoLog(
            { result: { accommodations: [accommodationPublic1, accommodationPublic2] } },
            'getByDestination:end'
        );
    });

    it('should return all accommodations (PUBLIC and PRIVATE) for a destination to an admin', async () => {
        // Arrange
        const adminUser = createMockUser({ role: RoleEnum.ADMIN });
        const destinationId = getMockDestinationId('dest-2');
        const accommodationPublic = createMockAccommodation({
            id: getMockAccommodationId('acc-3'),
            destinationId,
            visibility: VisibilityEnum.PUBLIC
        });
        const accommodationPrivate = createMockAccommodation({
            id: getMockAccommodationId('acc-4'),
            destinationId,
            visibility: VisibilityEnum.PRIVATE
        });
        (AccommodationModel.search as Mock).mockResolvedValue([
            accommodationPublic,
            accommodationPrivate
        ]);
        // Act
        const result = await AccommodationService.getByDestination({ destinationId }, adminUser);
        // Assert
        expect(result.accommodations).toEqual([accommodationPublic, accommodationPrivate]);
        expectInfoLog({ input: { destinationId }, actor: adminUser }, 'getByDestination:start');
        expectInfoLog(
            { result: { accommodations: [accommodationPublic, accommodationPrivate] } },
            'getByDestination:end'
        );
    });

    it('should return only accessible accommodations for a destination to a regular user', async () => {
        // Arrange
        const userId = getMockUserId('user-1');
        const user = createMockUser({ id: userId, role: RoleEnum.USER });
        const destinationId = getMockDestinationId('dest-3');
        const accommodationPublic = createMockAccommodation({
            id: getMockAccommodationId('acc-5'),
            destinationId,
            visibility: VisibilityEnum.PUBLIC
        });
        const accommodationPrivateOwned = createMockAccommodation({
            id: getMockAccommodationId('acc-6'),
            destinationId,
            visibility: VisibilityEnum.PRIVATE,
            ownerId: userId
        });
        const accommodationPrivateOther = createMockAccommodation({
            id: getMockAccommodationId('acc-7'),
            destinationId,
            visibility: VisibilityEnum.PRIVATE,
            ownerId: getMockUserId('other-user')
        });
        (AccommodationModel.search as Mock).mockResolvedValue([
            accommodationPublic,
            accommodationPrivateOwned,
            accommodationPrivateOther
        ]);
        // Act
        const result = await AccommodationService.getByDestination({ destinationId }, user);
        // Assert
        expect(result.accommodations).toEqual([accommodationPublic, accommodationPrivateOwned]);
        expectInfoLog({ input: { destinationId }, actor: user }, 'getByDestination:start');
        expectInfoLog(
            { result: { accommodations: [accommodationPublic, accommodationPrivateOwned] } },
            'getByDestination:end'
        );
    });

    it('should return an empty array if there are no accommodations for the destination', async () => {
        // Arrange
        const user = createMockUser();
        const destinationId = getMockDestinationId('dest-4');
        (AccommodationModel.search as Mock).mockResolvedValue([]);
        // Act
        const result = await AccommodationService.getByDestination({ destinationId }, user);
        // Assert
        expect(result.accommodations).toEqual([]);
        expectInfoLog({ input: { destinationId }, actor: user }, 'getByDestination:start');
        expectInfoLog({ result: { accommodations: [] } }, 'getByDestination:end');
    });

    it('should return an empty array if the user is disabled and log permission for each accommodation', async () => {
        // Arrange
        vi.clearAllMocks();
        const disabledUser = createMockUser({
            lifecycleState: LifecycleStatusEnum.INACTIVE
        });
        const destinationId = getMockDestinationId('dest-5');
        const accommodation1 = createMockAccommodation({
            id: getMockAccommodationId('acc-8'),
            destinationId,
            visibility: VisibilityEnum.PUBLIC
        });
        const accommodation2 = createMockAccommodation({
            id: getMockAccommodationId('acc-9'),
            destinationId,
            visibility: VisibilityEnum.PRIVATE
        });
        (AccommodationModel.search as Mock).mockResolvedValue([accommodation1, accommodation2]);
        // Act
        const result = await AccommodationService.getByDestination({ destinationId }, disabledUser);
        // Assert
        expect(result.accommodations).toEqual([]);
        expectInfoLog({ input: { destinationId }, actor: disabledUser }, 'getByDestination:start');
        expectInfoLog({ result: { accommodations: [] } }, 'getByDestination:end');
        // Should log denied permission for each accommodation
        expectPermissionLog({
            permission: PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,
            userId: disabledUser.id,
            role: disabledUser.role,
            extraData: expect.objectContaining({ reason: 'user disabled' })
        });
        expect(mockServiceLogger.permission).toHaveBeenCalledTimes(2);
    });

    it('should filter out accommodations with unknown visibility and log denied', async () => {
        // Arrange
        vi.clearAllMocks();
        const user = createMockUser();
        const destinationId = getMockDestinationId('dest-6');
        const accommodationPublic = createMockAccommodation({
            id: getMockAccommodationId('acc-10'),
            destinationId,
            visibility: VisibilityEnum.PUBLIC
        });
        const accommodationUnknown = createMockAccommodation({
            id: getMockAccommodationId('acc-11'),
            destinationId,
            visibility: 'UNKNOWN' as VisibilityEnum
        });
        (AccommodationModel.search as Mock).mockResolvedValue([
            accommodationPublic,
            accommodationUnknown
        ]);
        // Act
        const result = await AccommodationService.getByDestination({ destinationId }, user);
        // Assert
        expect(result.accommodations).toEqual([accommodationPublic]);
        expectInfoLog({ input: { destinationId }, actor: user }, 'getByDestination:start');
        expectInfoLog(
            { result: { accommodations: [accommodationPublic] } },
            'getByDestination:end'
        );
        // Should log denied for unknown visibility
        expectPermissionLog({
            permission: 'UNKNOWN_PERMISSION',
            userId: user.id,
            role: user.role,
            extraData: expect.objectContaining({
                error: 'unknown visibility',
                visibility: 'UNKNOWN',
                input: expect.objectContaining({ destinationId })
            })
        });
        expect(mockServiceLogger.permission).toHaveBeenCalledTimes(1);
    });

    it('should log access to private/draft accommodations for users with permission', async () => {
        // Arrange
        vi.clearAllMocks();
        const adminUser = createMockUser({ role: RoleEnum.ADMIN });
        const destinationId = getMockDestinationId('dest-7');
        const accommodationPrivate = createMockAccommodation({
            id: getMockAccommodationId('acc-12'),
            destinationId,
            visibility: VisibilityEnum.PRIVATE
        });
        const accommodationDraft = createMockAccommodation({
            id: getMockAccommodationId('acc-13'),
            destinationId,
            visibility: VisibilityEnum.DRAFT
        });
        (AccommodationModel.search as Mock).mockResolvedValue([
            accommodationPrivate,
            accommodationDraft
        ]);
        // Act
        const result = await AccommodationService.getByDestination({ destinationId }, adminUser);
        // Assert
        expect(result.accommodations).toEqual([accommodationPrivate, accommodationDraft]);
        expectInfoLog({ input: { destinationId }, actor: adminUser }, 'getByDestination:start');
        expectInfoLog(
            { result: { accommodations: [accommodationPrivate, accommodationDraft] } },
            'getByDestination:end'
        );
        // Should log access to private/draft (logGrant -> mockServiceLogger.permission)
        expectPermissionLog({
            permission: PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,
            userId: adminUser.id,
            role: adminUser.role,
            extraData: expect.objectContaining({
                access: 'granted',
                reason: expect.any(String),
                visibility: VisibilityEnum.PRIVATE
            })
        });
        expectPermissionLog({
            permission: PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,
            userId: adminUser.id,
            role: adminUser.role,
            extraData: expect.objectContaining({
                access: 'granted',
                reason: expect.any(String),
                visibility: VisibilityEnum.DRAFT
            })
        });
        expect(mockServiceLogger.permission).toHaveBeenCalledTimes(2);
    });

    it('should handle a mix of visibilities and permissions correctly', async () => {
        // Arrange
        vi.clearAllMocks();
        const userId = getMockUserId('user-mix');
        const user = createMockUser({ id: userId, role: RoleEnum.USER });
        const destinationId = getMockDestinationId('dest-8');
        const accommodationPublic = createMockAccommodation({
            id: getMockAccommodationId('acc-14'),
            destinationId,
            visibility: VisibilityEnum.PUBLIC
        });
        const accommodationPrivateOwner = createMockAccommodation({
            id: getMockAccommodationId('acc-15'),
            destinationId,
            visibility: VisibilityEnum.PRIVATE,
            ownerId: userId
        });
        const accommodationPrivateOther = createMockAccommodation({
            id: getMockAccommodationId('acc-16'),
            destinationId,
            visibility: VisibilityEnum.PRIVATE,
            ownerId: getMockUserId('other-user')
        });
        const accommodationDraft = createMockAccommodation({
            id: getMockAccommodationId('acc-17'),
            destinationId,
            visibility: VisibilityEnum.DRAFT,
            ownerId: getMockUserId('other-user')
        });
        const accommodationUnknown = createMockAccommodation({
            id: getMockAccommodationId('acc-18'),
            destinationId,
            visibility: 'UNKNOWN' as VisibilityEnum
        });
        (AccommodationModel.search as Mock).mockResolvedValue([
            accommodationPublic,
            accommodationPrivateOwner,
            accommodationPrivateOther,
            accommodationDraft,
            accommodationUnknown
        ]);
        // Act
        const result = await AccommodationService.getByDestination({ destinationId }, user);
        // Assert
        expect(result.accommodations).toEqual([accommodationPublic, accommodationPrivateOwner]);
        expectInfoLog({ input: { destinationId }, actor: user }, 'getByDestination:start');
        expectInfoLog(
            { result: { accommodations: [accommodationPublic, accommodationPrivateOwner] } },
            'getByDestination:end'
        );
        // Log denied for PRIVATE from another owner
        expectPermissionLog({
            permission: PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,
            userId: user.id,
            role: user.role,
            extraData: expect.objectContaining({
                input: expect.objectContaining({ destinationId }),
                visibility: VisibilityEnum.PRIVATE
            })
        });
        // Log denied for UNKNOWN
        expectPermissionLog({
            permission: 'UNKNOWN_PERMISSION',
            userId: user.id,
            role: user.role,
            extraData: expect.objectContaining({
                error: 'unknown visibility',
                visibility: 'UNKNOWN',
                input: expect.objectContaining({ destinationId })
            })
        });
        // There should be no logGrant for DRAFT (regular user without permission)
        // (already covered by not being in the result)
        // There should be two denied permission logs
        const deniedLogs = (mockServiceLogger.permission as Mock).mock.calls.filter(
            ([arg]) => !arg.extraData || arg.extraData.access !== 'granted'
        );
        expect(deniedLogs).toHaveLength(3);
    });
});
