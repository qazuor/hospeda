import { AccommodationModel } from '@repo/db';
import { LifecycleStatusEnum, RoleEnum, VisibilityEnum } from '@repo/types';
import { type Mock, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../accommodation/accommodation.service';
import { getMockAccommodation, getMockAccommodationId } from '../factories/accommodationFactory';
import { getMockDestinationId } from '../factories/destinationFactory';
import {
    getMockDisabledUser,
    getMockPublicUser,
    getMockUser,
    getMockUserId
} from '../factories/userFactory';
import { expectInfoLog, expectPermissionLog } from '../utils/log-assertions';

describe('accommodation.service.getTopRatedByDestination', () => {
    it('should return the top N PUBLIC accommodations for a destination to a public user, ordered by averageRating desc', async () => {
        // Arrange
        const publicUser = getMockPublicUser();
        const destinationId = getMockDestinationId('dest-1');
        const accommodation1 = getMockAccommodation({
            id: getMockAccommodationId('acc-1'),
            destinationId,
            visibility: VisibilityEnum.PUBLIC,
            averageRating: 4.9
        });
        const accommodation2 = getMockAccommodation({
            id: getMockAccommodationId('acc-2'),
            destinationId,
            visibility: VisibilityEnum.PUBLIC,
            averageRating: 4.7
        });
        const accommodation3 = getMockAccommodation({
            id: getMockAccommodationId('acc-3'),
            destinationId,
            visibility: VisibilityEnum.PUBLIC,
            averageRating: 4.5
        });
        (AccommodationModel.search as Mock).mockResolvedValue([
            accommodation1,
            accommodation2,
            accommodation3
        ]);
        const limit = 2;
        // Act
        const result = await AccommodationService.getTopRatedByDestination(
            { destinationId, limit },
            publicUser
        );
        // Assert
        expect(result.accommodations).toEqual([accommodation1, accommodation2]);
        expectInfoLog(
            { input: { destinationId, limit }, actor: publicUser },
            'getTopRatedByDestination:start'
        );
        expectInfoLog(
            { result: { accommodations: [accommodation1, accommodation2] } },
            'getTopRatedByDestination:end'
        );
    });

    it('should return the top N accommodations (PUBLIC and PRIVATE) for a destination to an admin, ordered by averageRating desc', async () => {
        // Arrange
        const adminUser = getMockUser({ role: RoleEnum.ADMIN });
        const destinationId = getMockDestinationId('dest-2');
        const accommodationPublic = getMockAccommodation({
            id: getMockAccommodationId('acc-4'),
            destinationId,
            visibility: VisibilityEnum.PUBLIC,
            averageRating: 4.8
        });
        const accommodationPrivate = getMockAccommodation({
            id: getMockAccommodationId('acc-5'),
            destinationId,
            visibility: VisibilityEnum.PRIVATE,
            averageRating: 4.6
        });
        const accommodationPublic2 = getMockAccommodation({
            id: getMockAccommodationId('acc-6'),
            destinationId,
            visibility: VisibilityEnum.PUBLIC,
            averageRating: 4.4
        });
        (AccommodationModel.search as Mock).mockResolvedValue([
            accommodationPublic,
            accommodationPrivate,
            accommodationPublic2
        ]);
        const limit = 2;
        // Act
        const result = await AccommodationService.getTopRatedByDestination(
            { destinationId, limit },
            adminUser
        );
        // Assert
        expect(result.accommodations).toEqual([accommodationPublic, accommodationPrivate]);
        expectInfoLog(
            { input: { destinationId, limit }, actor: adminUser },
            'getTopRatedByDestination:start'
        );
        expectInfoLog(
            { result: { accommodations: [accommodationPublic, accommodationPrivate] } },
            'getTopRatedByDestination:end'
        );
    });

    it('should return only accessible accommodations for a destination to a regular user, ordered by averageRating desc', async () => {
        // Arrange
        const userId = getMockUserId('user-3');
        const user = getMockUser({ id: userId, role: RoleEnum.USER });
        const destinationId = getMockDestinationId('dest-3');
        const accommodationPublic = getMockAccommodation({
            id: getMockAccommodationId('acc-7'),
            destinationId,
            visibility: VisibilityEnum.PUBLIC,
            averageRating: 4.9
        });
        const accommodationPrivateOwned = getMockAccommodation({
            id: getMockAccommodationId('acc-8'),
            destinationId,
            visibility: VisibilityEnum.PRIVATE,
            ownerId: userId,
            averageRating: 4.7
        });
        const accommodationPrivateOther = getMockAccommodation({
            id: getMockAccommodationId('acc-9'),
            destinationId,
            visibility: VisibilityEnum.PRIVATE,
            ownerId: getMockUserId('other-user'),
            averageRating: 4.8
        });
        (AccommodationModel.search as Mock).mockResolvedValue([
            accommodationPublic,
            accommodationPrivateOwned,
            accommodationPrivateOther
        ]);
        const limit = 2;
        // Act
        const result = await AccommodationService.getTopRatedByDestination(
            { destinationId, limit },
            user
        );
        // Assert
        expect(result.accommodations).toEqual([accommodationPublic, accommodationPrivateOwned]);
        expectInfoLog(
            { input: { destinationId, limit }, actor: user },
            'getTopRatedByDestination:start'
        );
        expectInfoLog(
            { result: { accommodations: [accommodationPublic, accommodationPrivateOwned] } },
            'getTopRatedByDestination:end'
        );
    });

    it('should return an empty array if there are no accommodations for the destination', async () => {
        // Arrange
        const user = getMockUser();
        const destinationId = getMockDestinationId('dest-4');
        (AccommodationModel.search as Mock).mockResolvedValue([]);
        const limit = 3;
        // Act
        const result = await AccommodationService.getTopRatedByDestination(
            { destinationId, limit },
            user
        );
        // Assert
        expect(result.accommodations).toEqual([]);
        expectInfoLog(
            { input: { destinationId, limit }, actor: user },
            'getTopRatedByDestination:start'
        );
        expectInfoLog({ result: { accommodations: [] } }, 'getTopRatedByDestination:end');
    });

    it('should return an empty array if the user is disabled and log permission for each accommodation', async () => {
        // Arrange
        vi.clearAllMocks();
        const disabledUser = getMockDisabledUser({
            id: getMockUserId('user-disabled'),
            role: RoleEnum.USER,
            lifecycleState: LifecycleStatusEnum.INACTIVE
        });
        const destinationId = getMockDestinationId('dest-5');
        const accommodation1 = getMockAccommodation({
            id: getMockAccommodationId('acc-10'),
            destinationId,
            visibility: VisibilityEnum.PUBLIC,
            averageRating: 4.2
        });
        const accommodation2 = getMockAccommodation({
            id: getMockAccommodationId('acc-11'),
            destinationId,
            visibility: VisibilityEnum.PRIVATE,
            averageRating: 4.1
        });
        (AccommodationModel.search as Mock).mockResolvedValue([accommodation1, accommodation2]);
        const limit = 2;
        // Act
        const result = await AccommodationService.getTopRatedByDestination(
            { destinationId, limit },
            disabledUser
        );
        // Assert
        expect(result.accommodations).toEqual([]);
        expectInfoLog(
            { input: { destinationId, limit }, actor: disabledUser },
            'getTopRatedByDestination:start'
        );
        expectInfoLog({ result: { accommodations: [] } }, 'getTopRatedByDestination:end');
        // Should log denied permission for each accommodation
        expectPermissionLog({
            permission: expect.anything(),
            userId: disabledUser.id,
            role: disabledUser.role,
            extraData: expect.objectContaining({ reason: 'user disabled' })
        });
    });

    it('should log denied for accommodations with unknown visibility', async () => {
        // Arrange
        vi.clearAllMocks();
        const user = getMockUser({ id: getMockUserId('user-6'), role: RoleEnum.USER });
        const destinationId = getMockDestinationId('dest-6');
        const accommodationUnknown = getMockAccommodation({
            id: getMockAccommodationId('acc-12'),
            destinationId,
            // @ts-expect-error purposely invalid visibility for test
            visibility: 'UNKNOWN_VISIBILITY',
            averageRating: 4.9
        });
        const accommodationPublic = getMockAccommodation({
            id: getMockAccommodationId('acc-13'),
            destinationId,
            visibility: VisibilityEnum.PUBLIC,
            averageRating: 4.7
        });
        (AccommodationModel.search as Mock).mockResolvedValue([
            accommodationUnknown,
            accommodationPublic
        ]);
        const limit = 2;
        // Act
        const result = await AccommodationService.getTopRatedByDestination(
            { destinationId, limit },
            user
        );
        // Assert
        expect(result.accommodations).toEqual([accommodationPublic]);
        expectInfoLog(
            { input: { destinationId, limit }, actor: user },
            'getTopRatedByDestination:start'
        );
        expectInfoLog(
            { result: { accommodations: [accommodationPublic] } },
            'getTopRatedByDestination:end'
        );
        expectPermissionLog({
            permission: 'UNKNOWN_PERMISSION',
            userId: user.id,
            role: user.role,
            extraData: expect.objectContaining({ error: 'unknown visibility' })
        });
    });
});
