import { AccommodationModel } from '@repo/db';
import { LifecycleStatusEnum, RoleEnum, VisibilityEnum } from '@repo/types';
import { type Mock, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../accommodation/accommodation.service';
import { getMockAccommodation } from '../factories';
import { getMockAccommodationId } from '../factories/accommodationFactory';
import {
    getMockDisabledUser,
    getMockPublicUser,
    getMockUser,
    getMockUserId
} from '../factories/userFactory';
import { expectInfoLog, expectPermissionLog } from '../utils/log-assertions';

describe('accommodation.service.getByOwner', () => {
    it('should return all PUBLIC accommodations for an owner to a public user', async () => {
        // Arrange
        const publicUser = getMockPublicUser();
        const ownerId = getMockUserId('user-1');
        const accommodationPublic1 = getMockAccommodation({
            id: getMockAccommodationId('acc-1'),
            ownerId,
            visibility: VisibilityEnum.PUBLIC
        });
        const accommodationPublic2 = getMockAccommodation({
            id: getMockAccommodationId('acc-2'),
            ownerId,
            visibility: VisibilityEnum.PUBLIC
        });
        (AccommodationModel.search as Mock).mockResolvedValue([
            accommodationPublic1,
            accommodationPublic2
        ]);
        // Act
        const result = await AccommodationService.getByOwner({ ownerId }, publicUser);
        // Assert
        expect(result.accommodations).toEqual([accommodationPublic1, accommodationPublic2]);
        expectInfoLog({ input: { ownerId }, actor: publicUser }, 'getByOwner:start');
        expectInfoLog(
            { result: { accommodations: [accommodationPublic1, accommodationPublic2] } },
            'getByOwner:end'
        );
    });

    it('should return all accommodations (PUBLIC and PRIVATE) for an owner to an admin', async () => {
        // Arrange
        const adminUser = getMockUser({ role: RoleEnum.ADMIN });
        const ownerId = getMockUserId('user-2');
        const accommodationPublic = getMockAccommodation({
            id: getMockAccommodationId('acc-3'),
            ownerId,
            visibility: VisibilityEnum.PUBLIC
        });
        const accommodationPrivate = getMockAccommodation({
            id: getMockAccommodationId('acc-4'),
            ownerId,
            visibility: VisibilityEnum.PRIVATE
        });
        (AccommodationModel.search as Mock).mockResolvedValue([
            accommodationPublic,
            accommodationPrivate
        ]);
        // Act
        const result = await AccommodationService.getByOwner({ ownerId }, adminUser);
        // Assert
        expect(result.accommodations).toEqual([accommodationPublic, accommodationPrivate]);
        expectInfoLog({ input: { ownerId }, actor: adminUser }, 'getByOwner:start');
        expectInfoLog(
            { result: { accommodations: [accommodationPublic, accommodationPrivate] } },
            'getByOwner:end'
        );
    });

    it('should return only accessible accommodations for an owner to a regular user', async () => {
        // Arrange
        const userId = getMockUserId('user-3');
        const user = getMockUser({ id: userId, role: RoleEnum.USER });
        const ownerId = userId;
        const accommodationPublic = getMockAccommodation({
            id: getMockAccommodationId('acc-5'),
            ownerId,
            visibility: VisibilityEnum.PUBLIC
        });
        const accommodationPrivateOwned = getMockAccommodation({
            id: getMockAccommodationId('acc-6'),
            ownerId,
            visibility: VisibilityEnum.PRIVATE
        });
        const accommodationPrivateOther = getMockAccommodation({
            id: getMockAccommodationId('acc-7'),
            ownerId: getMockUserId('other-user'),
            visibility: VisibilityEnum.PRIVATE
        });
        (AccommodationModel.search as Mock).mockResolvedValue([
            accommodationPublic,
            accommodationPrivateOwned,
            accommodationPrivateOther
        ]);
        // Act
        const result = await AccommodationService.getByOwner({ ownerId }, user);
        // Assert
        expect(result.accommodations).toEqual([accommodationPublic, accommodationPrivateOwned]);
        expectInfoLog({ input: { ownerId }, actor: user }, 'getByOwner:start');
        expectInfoLog(
            { result: { accommodations: [accommodationPublic, accommodationPrivateOwned] } },
            'getByOwner:end'
        );
    });

    it('should return an empty array if there are no accommodations for the owner', async () => {
        // Arrange
        const user = getMockUser();
        const ownerId = getMockUserId('user-4');
        (AccommodationModel.search as Mock).mockResolvedValue([]);
        // Act
        const result = await AccommodationService.getByOwner({ ownerId }, user);
        // Assert
        expect(result.accommodations).toEqual([]);
        expectInfoLog({ input: { ownerId }, actor: user }, 'getByOwner:start');
        expectInfoLog({ result: { accommodations: [] } }, 'getByOwner:end');
    });

    it('should return an empty array if the user is disabled and log permission for each accommodation', async () => {
        // Arrange
        vi.clearAllMocks();
        const disabledUser = getMockDisabledUser({
            id: getMockUserId('user-disabled'),
            lifecycleState: LifecycleStatusEnum.INACTIVE
        });
        const ownerId = getMockUserId('user-disabled');
        const accommodation1 = getMockAccommodation({
            id: getMockAccommodationId('acc-8'),
            ownerId,
            visibility: VisibilityEnum.PUBLIC
        });
        const accommodation2 = getMockAccommodation({
            id: getMockAccommodationId('acc-9'),
            ownerId,
            visibility: VisibilityEnum.PRIVATE
        });
        (AccommodationModel.search as Mock).mockResolvedValue([accommodation1, accommodation2]);
        // Act
        const result = await AccommodationService.getByOwner({ ownerId }, disabledUser);
        // Assert
        expect(result.accommodations).toEqual([]);
        expectInfoLog({ input: { ownerId }, actor: disabledUser }, 'getByOwner:start');
        expectInfoLog({ result: { accommodations: [] } }, 'getByOwner:end');
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
        const user = getMockUser({ id: getMockUserId('user-5'), role: RoleEnum.USER });
        const ownerId = getMockUserId('user-5');
        const accommodationUnknown = getMockAccommodation({
            id: getMockAccommodationId('acc-10'),
            ownerId,
            // @ts-expect-error purposely invalid visibility for test
            visibility: 'UNKNOWN_VISIBILITY'
        });
        const accommodationPublic = getMockAccommodation({
            id: getMockAccommodationId('acc-11'),
            ownerId,
            visibility: VisibilityEnum.PUBLIC
        });
        (AccommodationModel.search as Mock).mockResolvedValue([
            accommodationUnknown,
            accommodationPublic
        ]);
        // Act
        const result = await AccommodationService.getByOwner({ ownerId }, user);
        // Assert
        expect(result.accommodations).toEqual([accommodationPublic]);
        expectInfoLog({ input: { ownerId }, actor: user }, 'getByOwner:start');
        expectInfoLog({ result: { accommodations: [accommodationPublic] } }, 'getByOwner:end');
        expectPermissionLog({
            permission: 'UNKNOWN_PERMISSION',
            userId: user.id,
            role: user.role,
            extraData: expect.objectContaining({ error: 'unknown visibility' })
        });
    });
});
