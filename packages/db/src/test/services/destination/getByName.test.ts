import { LifecycleStatusEnum, PermissionEnum, RoleEnum, VisibilityEnum } from '@repo/types';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DestinationModel } from '../../../models/destination/destination.model';
import { DestinationService } from '../../../services/destination/destination.service';
import {
    getMockDestination,
    getMockDestinationId,
    getMockPublicUser,
    getMockUser,
    getMockUserId
} from '../../mockData';
import {
    expectInfoLog,
    expectNoPermissionLog,
    expectPermissionLog
} from '../../utils/logAssertions';

vi.mock('../../../utils/logger');
vi.mock('../../../models/destination/destination.model', async (importOriginal) => {
    const actualImport = await importOriginal();
    const actual = typeof actualImport === 'object' && actualImport !== null ? actualImport : {};
    return {
        ...actual,
        DestinationModel: {
            ...((actual as Record<string, unknown>).DestinationModel ?? {}),
            getByName: vi.fn()
        }
    };
});

describe('destination.service.getByName', () => {
    const publicUser = { ...getMockPublicUser(), permissions: [] };
    const user = getMockUser({ id: getMockUserId(), role: RoleEnum.ADMIN });
    const admin = getMockUser({ id: getMockUserId(), role: RoleEnum.ADMIN });
    const disabledUser = { ...user, enabled: false };
    const destinationId = getMockDestinationId();
    const baseDestination = getMockDestination({
        id: destinationId,
        name: 'Test Destination',
        visibility: VisibilityEnum.PUBLIC
    });
    const privateDestination = getMockDestination({
        id: destinationId,
        name: 'Private Destination',
        visibility: VisibilityEnum.PRIVATE
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return destination for public user if visibility is PUBLIC', async () => {
        (DestinationModel.getByName as Mock).mockResolvedValue(baseDestination);
        const result = await DestinationService.getByName(
            { name: baseDestination.name },
            publicUser
        );
        expect(result.destination).toEqual(baseDestination);
        expectInfoLog(
            { input: { name: baseDestination.name }, actor: publicUser },
            'getByName:start'
        );
        expectInfoLog({ result: { destination: baseDestination } }, 'getByName:end');
    });

    it('should return null and log permission for public user if visibility is PRIVATE', async () => {
        (DestinationModel.getByName as Mock).mockResolvedValue(privateDestination);
        const result = await DestinationService.getByName(
            { name: privateDestination.name },
            publicUser
        );
        expect(result.destination).toBeNull();
        expectPermissionLog({
            permission: PermissionEnum.DESTINATION_VIEW_PRIVATE,
            userId: 'public',
            role: RoleEnum.GUEST,
            extraData: expect.anything()
        });
    });

    it('should return destination for admin if visibility is PRIVATE', async () => {
        (DestinationModel.getByName as Mock).mockResolvedValue(privateDestination);
        const result = await DestinationService.getByName({ name: privateDestination.name }, admin);
        expect(result.destination).toEqual(privateDestination);
        expectInfoLog(
            { input: { name: privateDestination.name }, actor: admin },
            'getByName:start'
        );
        expectInfoLog({ result: { destination: privateDestination } }, 'getByName:end');
    });

    it('should return null if destination does not exist', async () => {
        (DestinationModel.getByName as Mock).mockResolvedValue(undefined);
        const result = await DestinationService.getByName({ name: 'not-exist' }, user);
        expect(result.destination).toBeNull();
        expectNoPermissionLog();
    });

    it('should return null and log permission if user is disabled', async () => {
        (DestinationModel.getByName as Mock).mockResolvedValue(privateDestination);
        const result = await DestinationService.getByName(
            { name: privateDestination.name },
            { ...disabledUser, lifecycleState: LifecycleStatusEnum.INACTIVE }
        );
        expect(result.destination).toBeNull();
        expectPermissionLog({
            permission: PermissionEnum.DESTINATION_VIEW_PRIVATE,
            userId: disabledUser.id,
            role: disabledUser.role,
            extraData: expect.objectContaining({ reason: 'user disabled' })
        });
    });

    it('should throw and log if destination has unknown visibility', async () => {
        const unknownDestination = getMockDestination({
            id: destinationId,
            name: 'Unknown Destination',
            visibility: 'UNKNOWN' as VisibilityEnum
        });
        (DestinationModel.getByName as Mock).mockResolvedValue(unknownDestination);
        await expect(
            DestinationService.getByName({ name: 'Unknown Destination' }, user)
        ).rejects.toThrow(/Unknown destination visibility/);
        expectPermissionLog({
            permission: expect.any(String),
            userId: user.id,
            role: user.role,
            extraData: expect.objectContaining({
                error: expect.stringContaining('unknown visibility')
            })
        });
    });
});
