import { DestinationModel } from '@repo/db';
import { LifecycleStatusEnum, PermissionEnum, RoleEnum, VisibilityEnum } from '@repo/types';
import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as destinationHelper from '../../destination/destination.helper';
import { DestinationService } from '../../destination/destination.service';
import * as permissionManager from '../../utils/permission-manager';
import { CanViewReasonEnum } from '../../utils/service-helper';
import { getMockDestination, getMockDestinationId, getMockUser, getMockUserId } from '../mockData';
import { expectInfoLog } from '../utils/log-assertions';

describe('destination.service.update', () => {
    const admin = getMockUser({ id: getMockUserId(), role: RoleEnum.ADMIN });
    const user = getMockUser({ id: getMockUserId(), role: RoleEnum.USER });
    const disabledUser = { ...user, lifecycleState: LifecycleStatusEnum.INACTIVE };
    const destinationId = getMockDestinationId();
    const baseDestination = getMockDestination({
        id: destinationId,
        visibility: VisibilityEnum.PUBLIC
    });
    const updateInput = { id: destinationId, name: 'Updated Name' };
    const updatedDestination = { ...baseDestination, name: 'Updated Name' };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should update destination for admin', async () => {
        (DestinationModel.getById as Mock).mockResolvedValue(baseDestination);
        (DestinationModel.update as Mock).mockResolvedValue(updatedDestination);
        const result = await DestinationService.update(updateInput, admin);
        expect(result.destination).toEqual(updatedDestination);
        expectInfoLog({ input: updateInput, actor: admin }, 'update:start');
        expectInfoLog({ result: { destination: updatedDestination } }, 'update:end');
    });

    it('should throw if destination not found', async () => {
        (DestinationModel.getById as Mock).mockResolvedValue(null);
        await expect(DestinationService.update(updateInput, admin)).rejects.toThrow(
            'Destination not found'
        );
        expectInfoLog({ input: updateInput, actor: admin }, 'update:start');
        expectInfoLog({ result: { destination: null } }, 'update:end');
    });

    it('should throw if user is disabled', async () => {
        (DestinationModel.getById as Mock).mockResolvedValue(baseDestination);
        await expect(DestinationService.update(updateInput, disabledUser)).rejects.toThrow(
            'Forbidden: user disabled'
        );
        expectInfoLog({ input: updateInput, actor: disabledUser }, 'update:start');
        expectInfoLog({ result: { destination: null } }, 'update:end');
    });

    it('should throw if user does not have permission', async () => {
        (DestinationModel.getById as Mock).mockResolvedValue(baseDestination);
        vi.spyOn(permissionManager, 'hasPermission').mockImplementation(() => {
            throw new Error('no-perm');
        });
        await expect(DestinationService.update(updateInput, user)).rejects.toThrow(
            'Forbidden: user does not have permission to update destination'
        );
        expectInfoLog({ input: updateInput, actor: user }, 'update:start');
        expectInfoLog({ result: { destination: null } }, 'update:end');
    });

    it('should throw if cannot view destination', async () => {
        (DestinationModel.getById as Mock).mockResolvedValue({
            ...baseDestination,
            visibility: 'PRIVATE'
        });
        vi.spyOn(destinationHelper, 'canViewDestination').mockReturnValue({
            canView: false,
            reason: CanViewReasonEnum.PERMISSION_CHECK_REQUIRED,
            checkedPermission: PermissionEnum.DESTINATION_VIEW_PRIVATE
        });
        await expect(DestinationService.update(updateInput, admin)).rejects.toThrow(
            'Forbidden: cannot view destination'
        );
        expectInfoLog({ result: { destination: null } }, 'update:end');
    });

    it('should throw if update fails in model', async () => {
        (DestinationModel.getById as Mock).mockResolvedValue(baseDestination);
        (DestinationModel.update as Mock).mockResolvedValue(undefined);
        await expect(DestinationService.update(updateInput, admin)).rejects.toThrow(
            'Destination update failed'
        );
        expectInfoLog({ input: updateInput, actor: admin }, 'update:start');
        expectInfoLog({ result: { destination: null } }, 'update:end');
    });
});
