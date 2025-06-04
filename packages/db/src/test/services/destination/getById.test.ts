import { LifecycleStatusEnum, PermissionEnum, RoleEnum, VisibilityEnum } from '@repo/types';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DestinationModel } from '../../../models/destination/destination.model';
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
            getById: vi.fn()
        }
    };
});

import * as DestinationService from '../../../services/destination/destination.service';

/**
 * Unit tests for destination.service.getById
 * Covers all visibility, ownership, and permission scenarios.
 * @see getDestinationById
 */
describe('destination.service.getById', () => {
    const publicUser = getMockPublicUser();
    const user = getMockUser({ id: getMockUserId() });
    const admin = getMockUser({ id: getMockUserId(), role: RoleEnum.ADMIN });
    const superAdmin = getMockUser({ id: getMockUserId(), role: RoleEnum.SUPER_ADMIN });
    const disabledUser = { ...user, enabled: false };
    const destinationId = getMockDestinationId();
    const baseDestination = getMockDestination({
        id: destinationId,
        visibility: VisibilityEnum.PUBLIC
    });
    const privateDestination = getMockDestination({
        id: destinationId,
        visibility: VisibilityEnum.PRIVATE
    });
    const userWithPrivatePerm = getMockUser({
        id: getMockUserId(),
        role: RoleEnum.USER,
        permissions: [PermissionEnum.DESTINATION_VIEW_PRIVATE]
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return destination for public user if visibility is PUBLIC', async () => {
        (DestinationModel.getById as Mock).mockResolvedValue(baseDestination);
        const result = await DestinationService.getById({ id: destinationId }, publicUser);
        expect(result.destination).toEqual(baseDestination);
        expectInfoLog({ input: { id: destinationId }, actor: publicUser }, 'getById:start');
        expectInfoLog({ result: { destination: baseDestination } }, 'getById:end');
    });

    it('should return null for disabled user', async () => {
        (DestinationModel.getById as Mock).mockResolvedValue(baseDestination);
        const result = await DestinationService.getById(
            { id: destinationId },
            { ...disabledUser, lifecycleState: LifecycleStatusEnum.INACTIVE }
        );
        expect(result.destination).toBeNull();
        expectPermissionLog({
            permission: expect.any(String),
            userId: disabledUser.id,
            role: disabledUser.role,
            extraData: expect.objectContaining({ reason: 'user disabled' })
        });
    });

    it('should throw if destination has unknown visibility', async () => {
        const unknownDestination = { ...baseDestination, visibility: 'UNKNOWN' };
        (DestinationModel.getById as Mock).mockResolvedValue(unknownDestination);
        await expect(DestinationService.getById({ id: destinationId }, user)).rejects.toThrow(
            /Unknown destination visibility/
        );
        expectPermissionLog({
            permission: expect.any(String),
            userId: user.id,
            role: user.role,
            extraData: expect.objectContaining({
                error: expect.stringContaining('unknown visibility')
            })
        });
    });

    it('should return destination for admin if visibility is PRIVATE', async () => {
        (DestinationModel.getById as Mock).mockResolvedValue(privateDestination);
        const result = await DestinationService.getById({ id: destinationId }, admin);
        expect(result.destination).toEqual(privateDestination);
        expectInfoLog({ input: { id: destinationId }, actor: admin }, 'getById:start');
        expectInfoLog({ result: { destination: privateDestination } }, 'getById:end');
    });

    it('should return destination for superadmin if visibility is DRAFT', async () => {
        const draftDestination = { ...baseDestination, visibility: VisibilityEnum.DRAFT };
        (DestinationModel.getById as Mock).mockResolvedValue(draftDestination);
        const result = await DestinationService.getById({ id: destinationId }, superAdmin);
        expect(result.destination).toEqual(draftDestination);
        expectInfoLog({ input: { id: destinationId }, actor: superAdmin }, 'getById:start');
        expectInfoLog({ result: { destination: draftDestination } }, 'getById:end');
    });

    it('should return null if destination does not exist', async () => {
        (DestinationModel.getById as Mock).mockResolvedValue(null);
        const result = await DestinationService.getById({ id: destinationId }, user);
        expect(result.destination).toBeNull();
        expectNoPermissionLog();
    });

    it('should return destination for user with DESTINATION_VIEW_PRIVATE permission', async () => {
        (DestinationModel.getById as Mock).mockResolvedValue(privateDestination);
        const result = await DestinationService.getById(
            { id: privateDestination.id },
            userWithPrivatePerm
        );
        expect(result.destination).toEqual(privateDestination);
        expectInfoLog(
            { input: { id: privateDestination.id }, actor: userWithPrivatePerm },
            'getById:start'
        );
        expectInfoLog({ result: { destination: privateDestination } }, 'getById:end');
    });
});
