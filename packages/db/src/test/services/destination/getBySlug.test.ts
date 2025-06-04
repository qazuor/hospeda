import { PermissionEnum, RoleEnum, VisibilityEnum } from '@repo/types';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DestinationModel } from '../../../models/destination/destination.model';
import * as DestinationService from '../../../services/destination/destination.service';
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
            getBySlug: vi.fn()
        }
    };
});

describe('destination.service.getBySlug', () => {
    const publicUser = { ...getMockPublicUser(), permissions: [] };
    const user = getMockUser({ id: getMockUserId(), role: RoleEnum.ADMIN });
    const admin = getMockUser({ id: getMockUserId(), role: RoleEnum.ADMIN });
    const disabledUser = { ...user, enabled: false };
    const destinationId = getMockDestinationId();
    const baseDestination = getMockDestination({
        id: destinationId,
        slug: 'test-destination',
        visibility: VisibilityEnum.PUBLIC
    });
    const privateDestination = getMockDestination({
        id: destinationId,
        slug: 'private-destination',
        visibility: VisibilityEnum.PRIVATE
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return destination for public user if visibility is PUBLIC', async () => {
        (DestinationModel.getBySlug as Mock).mockResolvedValue(baseDestination);
        const result = await DestinationService.getBySlug(
            { slug: baseDestination.slug },
            publicUser
        );
        expect(result.destination).toEqual(baseDestination);
        expectInfoLog(
            { input: { slug: baseDestination.slug }, actor: publicUser },
            'getBySlug:start'
        );
        expectInfoLog({ result: { destination: baseDestination } }, 'getBySlug:end');
    });

    it('should return null and log permission for public user if visibility is PRIVATE', async () => {
        (DestinationModel.getBySlug as Mock).mockResolvedValue(privateDestination);
        const result = await DestinationService.getBySlug(
            { slug: privateDestination.slug as string },
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
        (DestinationModel.getBySlug as Mock).mockResolvedValue(privateDestination);
        const result = await DestinationService.getBySlug(
            { slug: privateDestination.slug as string },
            admin
        );
        expect(result.destination).toEqual(privateDestination);
        expectInfoLog(
            { input: { slug: privateDestination.slug }, actor: admin },
            'getBySlug:start'
        );
        expectInfoLog({ result: { destination: privateDestination } }, 'getBySlug:end');
    });

    it('should return null if destination does not exist', async () => {
        (DestinationModel.getBySlug as Mock).mockResolvedValue(undefined);
        const result = await DestinationService.getBySlug({ slug: 'not-exist' }, user);
        expect(result.destination).toBeNull();
        expectNoPermissionLog();
    });

    it('should return null and log permission if user is disabled', async () => {
        (DestinationModel.getBySlug as Mock).mockResolvedValue(privateDestination);
        const result = await DestinationService.getBySlug(
            { slug: privateDestination.slug as string },
            disabledUser
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
            slug: 'unknown-destination',
            visibility: 'UNKNOWN' as VisibilityEnum
        });
        (DestinationModel.getBySlug as Mock).mockResolvedValue(unknownDestination);
        await expect(
            DestinationService.getBySlug({ slug: 'unknown-destination' }, user)
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
