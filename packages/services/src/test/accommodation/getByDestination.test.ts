import { AccommodationModel } from '@repo/db';
import {
    type AccommodationId,
    type DestinationId,
    LifecycleStatusEnum,
    PermissionEnum,
    RoleEnum,
    type UserId,
    VisibilityEnum
} from '@repo/types';
import { type Mock, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../accommodation/accommodation.service';
import { makeDisabledUser } from '../factories/userFactory';
import { getMockAccommodation, getMockPublicUser, getMockUser } from '../mockData';
import { expectInfoLog, expectPermissionLog } from '../utils/log-assertions';

vi.mock('@repo/db', async (importOriginal) => {
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
            hardDelete: vi.fn()
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

describe('accommodation.service.getByDestination', () => {
    it('should return all PUBLIC accommodations for a destination to a public user', async () => {
        // Arrange
        const publicUser = getMockPublicUser();
        const destinationId = 'dest-1' as DestinationId;
        const accommodationPublic1 = getMockAccommodation({
            id: 'acc-1' as AccommodationId,
            destinationId,
            visibility: VisibilityEnum.PUBLIC
        });
        const accommodationPublic2 = getMockAccommodation({
            id: 'acc-2' as AccommodationId,
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
        const adminUser = getMockUser({ role: RoleEnum.ADMIN });
        const destinationId = 'dest-2' as DestinationId;
        const accommodationPublic = getMockAccommodation({
            id: 'acc-3' as AccommodationId,
            destinationId,
            visibility: VisibilityEnum.PUBLIC
        });
        const accommodationPrivate = getMockAccommodation({
            id: 'acc-4' as AccommodationId,
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
        const userId = 'user-1' as UserId;
        const user = getMockUser({ id: userId, role: RoleEnum.USER });
        const destinationId = 'dest-3' as DestinationId;
        const accommodationPublic = getMockAccommodation({
            id: 'acc-5' as AccommodationId,
            destinationId,
            visibility: VisibilityEnum.PUBLIC
        });
        const accommodationPrivateOwned = getMockAccommodation({
            id: 'acc-6' as AccommodationId,
            destinationId,
            visibility: VisibilityEnum.PRIVATE,
            ownerId: userId
        });
        const accommodationPrivateOther = getMockAccommodation({
            id: 'acc-7' as AccommodationId,
            destinationId,
            visibility: VisibilityEnum.PRIVATE,
            ownerId: 'other-user' as UserId
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
        const user = getMockUser();
        const destinationId = 'dest-4' as DestinationId;
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
        const disabledUser = makeDisabledUser({
            id: 'user-disabled' as UserId,
            lifecycleState: LifecycleStatusEnum.INACTIVE
        });
        const destinationId = 'dest-5' as DestinationId;
        const accommodation1 = getMockAccommodation({
            id: 'acc-8' as AccommodationId,
            destinationId,
            visibility: VisibilityEnum.PUBLIC
        });
        const accommodation2 = getMockAccommodation({
            id: 'acc-9' as AccommodationId,
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
        const user = getMockUser();
        const destinationId = 'dest-6' as DestinationId;
        const accommodationPublic = getMockAccommodation({
            id: 'acc-10' as AccommodationId,
            destinationId,
            visibility: VisibilityEnum.PUBLIC
        });
        const accommodationUnknown = getMockAccommodation({
            id: 'acc-11' as AccommodationId,
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
        const adminUser = getMockUser({ role: RoleEnum.ADMIN });
        const destinationId = 'dest-7' as DestinationId;
        const accommodationPrivate = getMockAccommodation({
            id: 'acc-12' as AccommodationId,
            destinationId,
            visibility: VisibilityEnum.PRIVATE
        });
        const accommodationDraft = getMockAccommodation({
            id: 'acc-13' as AccommodationId,
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
        const userId = 'user-mix' as UserId;
        const user = getMockUser({ id: userId, role: RoleEnum.USER });
        const destinationId = 'dest-8' as DestinationId;
        const accommodationPublic = getMockAccommodation({
            id: 'acc-14' as AccommodationId,
            destinationId,
            visibility: VisibilityEnum.PUBLIC
        });
        const accommodationPrivateOwner = getMockAccommodation({
            id: 'acc-15' as AccommodationId,
            destinationId,
            visibility: VisibilityEnum.PRIVATE,
            ownerId: userId
        });
        const accommodationPrivateOther = getMockAccommodation({
            id: 'acc-16' as AccommodationId,
            destinationId,
            visibility: VisibilityEnum.PRIVATE,
            ownerId: 'other-user' as UserId
        });
        const accommodationDraft = getMockAccommodation({
            id: 'acc-17' as AccommodationId,
            destinationId,
            visibility: VisibilityEnum.DRAFT
        });
        const accommodationUnknown = getMockAccommodation({
            id: 'acc-18' as AccommodationId,
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
