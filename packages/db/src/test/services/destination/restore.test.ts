import { LifecycleStatusEnum, PermissionEnum, RoleEnum } from '@repo/types';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DestinationModel } from '../../../models/destination/destination.model';
import { DestinationService } from '../../../services/destination/destination.service';
import * as permissionManager from '../../../utils/permission-manager';
import {
    getMockDestination,
    getMockDestinationId,
    getMockPublicUser,
    getMockUser,
    getMockUserId
} from '../../mockData';
import { expectInfoLog, expectPermissionLog } from '../../utils/logAssertions';

vi.mock('../../../utils/logger');
vi.mock('../../../models/destination/destination.model', async (importOriginal) => {
    const actualImport = await importOriginal();
    const actual = typeof actualImport === 'object' && actualImport !== null ? actualImport : {};
    return {
        ...actual,
        DestinationModel: {
            ...((actual as Record<string, unknown>).DestinationModel ?? {}),
            getById: vi.fn(),
            update: vi.fn()
        }
    };
});

describe('destination.service.restore', () => {
    const admin = getMockUser({ id: getMockUserId(), role: RoleEnum.ADMIN });
    const publicUser = getMockPublicUser();
    const user = getMockUser({ id: getMockUserId(), role: RoleEnum.USER });
    const disabledUser = { ...user, lifecycleState: LifecycleStatusEnum.INACTIVE };
    const destinationId = getMockDestinationId();
    const archivedDestination = getMockDestination({
        id: destinationId,
        lifecycleState: LifecycleStatusEnum.ARCHIVED,
        deletedAt: new Date(),
        deletedById: user.id,
        updatedAt: new Date(),
        updatedById: user.id
    });
    const activeDestination = getMockDestination({
        id: destinationId,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        deletedAt: undefined,
        deletedById: undefined,
        updatedAt: new Date(),
        updatedById: user.id
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should restore destination when user is ADMIN and has permission', async () => {
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        (DestinationModel.getById as Mock).mockResolvedValue(archivedDestination);
        const now = new Date();
        (DestinationModel.update as Mock).mockResolvedValue({
            ...archivedDestination,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            deletedAt: undefined,
            deletedById: undefined,
            updatedAt: now,
            updatedById: admin.id
        });

        const result = await DestinationService.restore({ id: destinationId }, admin);
        expect(result.destination).not.toBeNull();
        if (!result.destination) throw new Error('destination should not be null');
        const { updatedAt, ...rest } = result.destination;
        expect(rest).toMatchObject(
            expect.objectContaining({
                id: archivedDestination.id,
                name: archivedDestination.name,
                slug: archivedDestination.slug,
                lifecycleState: LifecycleStatusEnum.ACTIVE,
                deletedAt: undefined,
                deletedById: undefined,
                updatedById: admin.id
            })
        );
        expect(result.destination.updatedAt).toBeInstanceOf(Date);
        expectInfoLog({ input: { id: destinationId }, actor: admin }, 'restore:start');
        expectInfoLog(
            {
                result: {
                    destination: expect.objectContaining({
                        lifecycleState: LifecycleStatusEnum.ACTIVE
                    })
                }
            },
            'restore:end'
        );
    });

    it('should deny restore if user is disabled', async () => {
        (DestinationModel.getById as Mock).mockResolvedValue(archivedDestination);
        await expect(
            DestinationService.restore({ id: destinationId }, disabledUser)
        ).rejects.toThrow(/Forbidden: user disabled/);
        expectPermissionLog({
            permission: PermissionEnum.DESTINATION_RESTORE,
            userId: disabledUser.id,
            role: disabledUser.role,
            extraData: expect.objectContaining({ reason: 'user disabled' })
        });
    });

    it('should deny restore if user is public (unauthenticated)', async () => {
        (DestinationModel.getById as Mock).mockResolvedValue(archivedDestination);
        await expect(DestinationService.restore({ id: destinationId }, publicUser)).rejects.toThrow(
            /Forbidden/
        );
        expectPermissionLog({
            permission: PermissionEnum.DESTINATION_RESTORE,
            userId: 'public',
            role: publicUser.role,
            extraData: expect.objectContaining({
                error: 'Forbidden: public user cannot restore destinations'
            })
        });
    });

    it('should deny restore if user has insufficient permissions', async () => {
        vi.spyOn(permissionManager, 'hasPermission').mockImplementation(() => {
            throw new Error('Forbidden: User does not have permission to restore destination');
        });
        (DestinationModel.getById as Mock).mockResolvedValue(archivedDestination);
        await expect(DestinationService.restore({ id: destinationId }, user)).rejects.toThrow(
            /Forbidden/
        );
        expectPermissionLog({
            permission: PermissionEnum.DESTINATION_RESTORE,
            userId: user.id,
            role: user.role,
            extraData: expect.objectContaining({ error: expect.stringContaining('Forbidden') })
        });
    });

    it('should throw if destination does not exist', async () => {
        (DestinationModel.getById as Mock).mockResolvedValue(undefined);
        await expect(DestinationService.restore({ id: destinationId }, admin)).rejects.toThrow(
            'Destination not found'
        );
        expectInfoLog({ result: { destination: null } }, 'restore:end');
    });

    it('should throw if destination is not archived', async () => {
        (DestinationModel.getById as Mock).mockResolvedValue(activeDestination);
        await expect(DestinationService.restore({ id: destinationId }, admin)).rejects.toThrow(
            'Destination is not archived'
        );
        expectInfoLog({ result: { destination: null } }, 'restore:end');
    });

    it('restore should set deletedAt, deletedById undefined, updatedAt, updatedById, y lifecycleState ACTIVE', async () => {
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        (DestinationModel.getById as Mock).mockResolvedValue(archivedDestination);
        const now = new Date();
        (DestinationModel.update as Mock).mockResolvedValue({
            ...archivedDestination,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            deletedAt: undefined,
            deletedById: undefined,
            updatedAt: now,
            updatedById: admin.id
        });
        const result = await DestinationService.restore({ id: destinationId }, admin);
        expect(result.destination?.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
        expect(result.destination?.deletedAt).toBeUndefined();
        expect(result.destination?.deletedById).toBeUndefined();
        expect(result.destination?.updatedAt).toBeInstanceOf(Date);
        expect(result.destination?.updatedById).toBe(admin.id);
    });
});
