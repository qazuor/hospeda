import { EventModel } from '@repo/db';
import { LifecycleStatusEnum, PermissionEnum, RoleEnum } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventService } from '../../event/event.service';
import * as permissionManager from '../../utils/permission-manager';
import { getMockEvent, getMockEventId } from '../factories/eventFactory';
import { getMockPublicUser, getMockUser, getMockUserId } from '../factories/userFactory';
import { expectInfoLog, expectPermissionLog } from '../utils/log-assertions';

describe('event.service.hardDelete', () => {
    const admin = getMockUser({ id: getMockUserId('admin-1'), role: RoleEnum.ADMIN });
    const superAdmin = getMockUser({
        id: getMockUserId('superadmin-1'),
        role: RoleEnum.SUPER_ADMIN
    });
    const userWithPerm = getMockUser({
        id: getMockUserId('user-2'),
        role: RoleEnum.USER,
        permissions: [PermissionEnum.EVENT_HARD_DELETE]
    });
    const userNoPerm = getMockUser({
        id: getMockUserId('user-3'),
        role: RoleEnum.USER,
        permissions: []
    });
    const disabledUser = getMockUser({
        id: getMockUserId('user-4'),
        lifecycleState: LifecycleStatusEnum.INACTIVE
    });
    const publicActor = getMockPublicUser();
    const eventId = getMockEventId('event-1');
    const event = getMockEvent({ id: eventId });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should hard-delete event when user is ADMIN', async () => {
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        (EventModel.getById as Mock).mockResolvedValue(event);
        (EventModel.hardDelete as Mock).mockResolvedValue(true);
        const result = await EventService.hardDelete({ id: eventId }, admin);
        expect(result.success).toBe(true);
        expectInfoLog({ input: { id: eventId }, actor: admin }, 'hardDelete:start');
        expectInfoLog({ result: { success: true } }, 'hardDelete:end');
    });

    it('should hard-delete event when user is SUPER_ADMIN', async () => {
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(false);
        (EventModel.getById as Mock).mockResolvedValue(event);
        (EventModel.hardDelete as Mock).mockResolvedValue(true);
        const result = await EventService.hardDelete({ id: eventId }, superAdmin);
        expect(result.success).toBe(true);
        expectInfoLog({ input: { id: eventId }, actor: superAdmin }, 'hardDelete:start');
        expectInfoLog({ result: { success: true } }, 'hardDelete:end');
    });

    it('should hard-delete event when user has EVENT_HARD_DELETE permission', async () => {
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        (EventModel.getById as Mock).mockResolvedValue(event);
        (EventModel.hardDelete as Mock).mockResolvedValue(true);
        const result = await EventService.hardDelete({ id: eventId }, userWithPerm);
        expect(result.success).toBe(true);
        expectInfoLog({ input: { id: eventId }, actor: userWithPerm }, 'hardDelete:start');
        expectInfoLog({ result: { success: true } }, 'hardDelete:end');
    });

    it('should deny hard-delete if user is disabled', async () => {
        (EventModel.getById as Mock).mockResolvedValue(event);
        await expect(EventService.hardDelete({ id: eventId }, disabledUser)).rejects.toThrow(
            /Forbidden: user disabled/
        );
        expectPermissionLog({
            permission: PermissionEnum.EVENT_HARD_DELETE,
            userId: disabledUser.id,
            role: disabledUser.role,
            extraData: expect.objectContaining({ error: 'User disabled' })
        });
    });

    it('should deny hard-delete if user is public', async () => {
        (EventModel.getById as Mock).mockResolvedValue(event);
        await expect(EventService.hardDelete({ id: eventId }, publicActor)).rejects.toThrow(
            /Forbidden/
        );
        expectPermissionLog({
            permission: PermissionEnum.EVENT_HARD_DELETE,
            userId: 'public',
            role: publicActor.role,
            extraData: expect.objectContaining({ error: 'Permission denied' })
        });
    });

    it('should deny hard-delete if user has no permission', async () => {
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(false);
        (EventModel.getById as Mock).mockResolvedValue(event);
        await expect(EventService.hardDelete({ id: eventId }, userNoPerm)).rejects.toThrow(
            /Forbidden/
        );
        expectPermissionLog({
            permission: PermissionEnum.EVENT_HARD_DELETE,
            userId: userNoPerm.id,
            role: userNoPerm.role,
            extraData: expect.objectContaining({ error: 'Permission denied' })
        });
    });

    it('should throw if event does not exist', async () => {
        (EventModel.getById as Mock).mockResolvedValue(undefined);
        await expect(EventService.hardDelete({ id: eventId }, admin)).rejects.toThrow(
            'Event not found'
        );
        expectInfoLog({ result: { success: false } }, 'hardDelete:end');
    });

    it('should throw if hardDelete fails in the model', async () => {
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        (EventModel.getById as Mock).mockResolvedValue(event);
        (EventModel.hardDelete as Mock).mockRejectedValue(new Error('DB error'));
        await expect(EventService.hardDelete({ id: eventId }, admin)).rejects.toThrow(
            'Event hard delete failed'
        );
        expectInfoLog({ result: { success: false } }, 'hardDelete:end');
    });

    it('should return success: false if model returns false', async () => {
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        (EventModel.getById as Mock).mockResolvedValue(event);
        (EventModel.hardDelete as Mock).mockResolvedValue(false);
        const result = await EventService.hardDelete({ id: eventId }, admin);
        expect(result.success).toBe(false);
        expectInfoLog({ result: { success: false } }, 'hardDelete:end');
    });
});
