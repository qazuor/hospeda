import { LifecycleStatusEnum, PermissionEnum, RoleEnum, VisibilityEnum } from '@repo/types';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DestinationModel } from '../../../models/destination/destination.model';
import * as DestinationService from '../../../services/destination/destination.service';
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

describe('destination.service.softDelete', () => {
    const admin = getMockUser({ id: getMockUserId(), role: RoleEnum.ADMIN });
    const publicUser = getMockPublicUser();
    const user = getMockUser({ id: getMockUserId(), role: RoleEnum.USER });
    const disabledUser = { ...user, lifecycleState: LifecycleStatusEnum.INACTIVE };
    const destinationId = getMockDestinationId();
    const baseDestination = getMockDestination({
        id: destinationId,
        visibility: VisibilityEnum.PUBLIC
    });
    const archivedDestination = getMockDestination({
        id: destinationId,
        lifecycleState: LifecycleStatusEnum.ARCHIVED,
        deletedAt: new Date(),
        deletedById: user.id,
        updatedAt: new Date(),
        updatedById: user.id
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should soft-delete destination when user is ADMIN and has permission', async () => {
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        (DestinationModel.getById as Mock).mockResolvedValue(baseDestination);
        const now = new Date();
        (DestinationModel.update as Mock).mockResolvedValue({
            ...baseDestination,
            lifecycleState: LifecycleStatusEnum.ARCHIVED,
            deletedAt: now,
            deletedById: admin.id,
            updatedAt: now,
            updatedById: admin.id
        });

        const result = await DestinationService.softDelete({ id: destinationId }, admin);
        expect(result.destination).not.toBeNull();
        if (!result.destination) throw new Error('destination should not be null');
        const { updatedAt, deletedAt, ...rest } = result.destination;
        expect(rest).toMatchObject(
            expect.objectContaining({
                id: baseDestination.id,
                name: baseDestination.name,
                slug: baseDestination.slug,
                lifecycleState: LifecycleStatusEnum.ARCHIVED,
                deletedById: admin.id,
                updatedById: admin.id
            })
        );
        expect(result.destination?.deletedAt).toBeInstanceOf(Date);
        expect(result.destination?.updatedAt).toBeInstanceOf(Date);
        expectInfoLog({ input: { id: destinationId }, actor: admin }, 'delete:start');
        expectInfoLog(
            {
                result: {
                    destination: expect.objectContaining({
                        lifecycleState: LifecycleStatusEnum.ARCHIVED
                    })
                }
            },
            'delete:end'
        );
    });

    it('should deny delete if user is disabled', async () => {
        (DestinationModel.getById as Mock).mockResolvedValue(baseDestination);
        await expect(
            DestinationService.softDelete({ id: destinationId }, disabledUser)
        ).rejects.toThrow(/Forbidden: user disabled/);
        expectPermissionLog({
            permission: PermissionEnum.DESTINATION_DELETE,
            userId: disabledUser.id,
            role: disabledUser.role,
            extraData: expect.objectContaining({ reason: 'user disabled' })
        });
    });

    it('should deny delete if user is public (unauthenticated)', async () => {
        (DestinationModel.getById as Mock).mockResolvedValue(baseDestination);
        await expect(
            DestinationService.softDelete({ id: destinationId }, publicUser)
        ).rejects.toThrow(/Forbidden/);
        expectPermissionLog({
            permission: PermissionEnum.DESTINATION_DELETE,
            userId: 'public',
            role: publicUser.role,
            extraData: expect.objectContaining({
                error: 'Forbidden: public user cannot delete destinations'
            })
        });
    });

    it('should deny delete if user has insufficient permissions', async () => {
        vi.spyOn(permissionManager, 'hasPermission').mockImplementation(() => {
            throw new Error('Forbidden: User does not have permission to delete destination');
        });
        (DestinationModel.getById as Mock).mockResolvedValue(baseDestination);
        await expect(DestinationService.softDelete({ id: destinationId }, user)).rejects.toThrow(
            /Forbidden/
        );
        expectPermissionLog({
            permission: PermissionEnum.DESTINATION_DELETE,
            userId: user.id,
            role: user.role,
            extraData: expect.objectContaining({ error: expect.stringContaining('Forbidden') })
        });
    });

    it('should throw if destination does not exist', async () => {
        (DestinationModel.getById as Mock).mockResolvedValue(undefined);
        await expect(DestinationService.softDelete({ id: destinationId }, admin)).rejects.toThrow(
            'Destination not found'
        );
        expectInfoLog({ result: { destination: null } }, 'delete:end');
    });

    it('should throw if destination is already archived or deleted', async () => {
        (DestinationModel.getById as Mock).mockResolvedValue(archivedDestination);
        await expect(DestinationService.softDelete({ id: destinationId }, admin)).rejects.toThrow(
            'Destination is already archived or deleted'
        );
        expectInfoLog({ result: { destination: null } }, 'delete:end');
    });

    it('softDelete should set deletedAt, deletedById, updatedAt, updatedById, and lifecycle to ARCHIVED', async () => {
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        (DestinationModel.getById as Mock).mockResolvedValue(baseDestination);
        const now = new Date();
        (DestinationModel.update as Mock).mockResolvedValue({
            ...baseDestination,
            lifecycleState: LifecycleStatusEnum.ARCHIVED,
            deletedAt: now,
            deletedById: admin.id,
            updatedAt: now,
            updatedById: admin.id
        });
        const result = await DestinationService.softDelete({ id: destinationId }, admin);
        expect(result.destination?.lifecycleState).toBe(LifecycleStatusEnum.ARCHIVED);
        expect(result.destination?.deletedAt).toBeInstanceOf(Date);
        expect(result.destination?.deletedById).toBe(admin.id);
        expect(result.destination?.updatedAt).toBeInstanceOf(Date);
        expect(result.destination?.updatedById).toBe(admin.id);
    });
});
