import { type AccommodationId, RoleEnum, type UserId, VisibilityEnum } from '@repo/types';
import { type Mock, describe, expect, it, vi } from 'vitest';
import { AccommodationModel } from '../../../models/accommodation/accommodation.model';
import * as AccommodationService from '../../../services/accommodation/accommodation.service';
import type * as LoggerModule from '../../../utils/logger';
import { makeDisabledUser } from '../../factories/userFactory';
import { getMockAccommodation, getMockPublicUser, getMockUser } from '../../mockData';
import { expectInfoLog, expectPermissionLog } from '../../utils/logAssertions';

vi.mock('../../../utils/logger', async (importOriginal) => {
    const actual: typeof LoggerModule = await importOriginal();
    return {
        ...actual,
        dbLogger: {
            info: vi.fn(),
            error: vi.fn(),
            permission: vi.fn()
        }
    };
});

vi.mock('../../../models/accommodation/accommodation.model', async (importOriginal) => {
    const actualImport = await importOriginal();
    const actual = typeof actualImport === 'object' && actualImport !== null ? actualImport : {};
    return {
        ...actual,
        AccommodationModel: {
            ...((actual as Record<string, unknown>).AccommodationModel ?? {}),
            getByOwner: vi.fn()
        }
    };
});

describe('accommodation.service.getByOwner', () => {
    it('should return all PUBLIC accommodations for an owner to a public user', async () => {
        // Arrange
        const publicUser = getMockPublicUser();
        const ownerId = 'user-1' as UserId;
        const accommodationPublic1 = getMockAccommodation({
            id: 'acc-1' as AccommodationId,
            ownerId,
            visibility: VisibilityEnum.PUBLIC
        });
        const accommodationPublic2 = getMockAccommodation({
            id: 'acc-2' as AccommodationId,
            ownerId,
            visibility: VisibilityEnum.PUBLIC
        });
        (AccommodationModel.getByOwner as Mock).mockResolvedValue([
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
        const ownerId = 'user-2' as UserId;
        const accommodationPublic = getMockAccommodation({
            id: 'acc-3' as AccommodationId,
            ownerId,
            visibility: VisibilityEnum.PUBLIC
        });
        const accommodationPrivate = getMockAccommodation({
            id: 'acc-4' as AccommodationId,
            ownerId,
            visibility: VisibilityEnum.PRIVATE
        });
        (AccommodationModel.getByOwner as Mock).mockResolvedValue([
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
        const userId = 'user-3' as UserId;
        const user = getMockUser({ id: userId, role: RoleEnum.USER });
        const ownerId = userId;
        const accommodationPublic = getMockAccommodation({
            id: 'acc-5' as AccommodationId,
            ownerId,
            visibility: VisibilityEnum.PUBLIC
        });
        const accommodationPrivateOwned = getMockAccommodation({
            id: 'acc-6' as AccommodationId,
            ownerId,
            visibility: VisibilityEnum.PRIVATE
        });
        const accommodationPrivateOther = getMockAccommodation({
            id: 'acc-7' as AccommodationId,
            ownerId: 'other-user' as UserId,
            visibility: VisibilityEnum.PRIVATE
        });
        (AccommodationModel.getByOwner as Mock).mockResolvedValue([
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
        const ownerId = 'user-4' as UserId;
        (AccommodationModel.getByOwner as Mock).mockResolvedValue([]);
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
        const disabledUser = makeDisabledUser({
            id: 'user-disabled' as UserId,
            role: RoleEnum.USER
        });
        const ownerId = 'user-disabled' as UserId;
        const accommodation1 = getMockAccommodation({
            id: 'acc-8' as AccommodationId,
            ownerId,
            visibility: VisibilityEnum.PUBLIC
        });
        const accommodation2 = getMockAccommodation({
            id: 'acc-9' as AccommodationId,
            ownerId,
            visibility: VisibilityEnum.PRIVATE
        });
        (AccommodationModel.getByOwner as Mock).mockResolvedValue([accommodation1, accommodation2]);
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
        const user = getMockUser({ id: 'user-5' as UserId, role: RoleEnum.USER });
        const ownerId = 'user-5' as UserId;
        const accommodationUnknown = getMockAccommodation({
            id: 'acc-10' as AccommodationId,
            ownerId,
            // @ts-expect-error purposely invalid visibility for test
            visibility: 'UNKNOWN_VISIBILITY'
        });
        const accommodationPublic = getMockAccommodation({
            id: 'acc-11' as AccommodationId,
            ownerId,
            visibility: VisibilityEnum.PUBLIC
        });
        (AccommodationModel.getByOwner as Mock).mockResolvedValue([
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
