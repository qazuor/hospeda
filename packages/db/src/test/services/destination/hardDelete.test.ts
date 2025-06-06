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
            hardDelete: vi.fn()
        }
    };
});

describe('destination.service.hardDelete', () => {
    const admin = getMockUser({ id: getMockUserId(), role: RoleEnum.ADMIN });
    const publicUser = getMockPublicUser();
    const user = getMockUser({ id: getMockUserId(), role: RoleEnum.USER });
    const disabledUser = { ...user, lifecycleState: LifecycleStatusEnum.INACTIVE };
    const destinationId = getMockDestinationId();
    const destination = getMockDestination({ id: destinationId });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should hard-delete destination when user is ADMIN and has permission', async () => {
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        (DestinationModel.getById as Mock).mockResolvedValue(destination);
        (DestinationModel.hardDelete as Mock).mockResolvedValue(true);

        const result = await DestinationService.hardDelete({ id: destinationId }, admin);
        expect(result.success).toBe(true);
        expectInfoLog({ input: { id: destinationId }, actor: admin }, 'hardDelete:start');
        expectInfoLog({ result: { success: true } }, 'hardDelete:end');
    });

    it('should deny hard-delete if user is disabled', async () => {
        (DestinationModel.getById as Mock).mockResolvedValue(destination);
        await expect(
            DestinationService.hardDelete({ id: destinationId }, disabledUser)
        ).rejects.toThrow(/Forbidden: user disabled/);
        expectPermissionLog({
            permission: PermissionEnum.DESTINATION_HARD_DELETE,
            userId: disabledUser.id,
            role: disabledUser.role,
            extraData: expect.objectContaining({ reason: 'user disabled' })
        });
    });

    it('should deny hard-delete if user is public (unauthenticated)', async () => {
        (DestinationModel.getById as Mock).mockResolvedValue(destination);
        await expect(
            DestinationService.hardDelete({ id: destinationId }, publicUser)
        ).rejects.toThrow(/Forbidden/);
        expectPermissionLog({
            permission: PermissionEnum.DESTINATION_HARD_DELETE,
            userId: 'public',
            role: publicUser.role,
            extraData: expect.objectContaining({
                error: 'Forbidden: public user cannot hard-delete destinations'
            })
        });
    });

    it('should deny hard-delete if user has insufficient permissions', async () => {
        vi.spyOn(permissionManager, 'hasPermission').mockImplementation(() => {
            throw new Error('Forbidden: User does not have permission to hard-delete destination');
        });
        (DestinationModel.getById as Mock).mockResolvedValue(destination);
        await expect(DestinationService.hardDelete({ id: destinationId }, user)).rejects.toThrow(
            /Forbidden/
        );
        expectPermissionLog({
            permission: PermissionEnum.DESTINATION_HARD_DELETE,
            userId: user.id,
            role: user.role,
            extraData: expect.objectContaining({ error: expect.stringContaining('Forbidden') })
        });
    });

    it('should throw if destination does not exist', async () => {
        (DestinationModel.getById as Mock).mockResolvedValue(undefined);
        await expect(DestinationService.hardDelete({ id: destinationId }, admin)).rejects.toThrow(
            'Destination not found'
        );
        expectInfoLog({ result: { success: false } }, 'hardDelete:end');
    });

    it('should throw if hardDelete fails in the model', async () => {
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        (DestinationModel.getById as Mock).mockResolvedValue(destination);
        (DestinationModel.hardDelete as Mock).mockRejectedValue(new Error('DB error'));
        await expect(DestinationService.hardDelete({ id: destinationId }, admin)).rejects.toThrow(
            'Destination hard delete failed'
        );
        expectInfoLog({ result: { success: false } }, 'hardDelete:end');
    });

    it('should return success: false if model returns false', async () => {
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        (DestinationModel.getById as Mock).mockResolvedValue(destination);
        (DestinationModel.hardDelete as Mock).mockResolvedValue(false);
        const result = await DestinationService.hardDelete({ id: destinationId }, admin);
        expect(result.success).toBe(false);
        expectInfoLog({ result: { success: false } }, 'hardDelete:end');
    });
});
