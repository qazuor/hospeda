import { EventModel } from '@repo/db';
import { LifecycleStatusEnum, PermissionEnum, RoleEnum } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventService } from '../../event/event.service';
import * as permissionManager from '../../utils/permission-manager';
import { getMockEvent, getMockEventId } from '../factories/eventFactory';
import { getMockPublicUser, getMockUser, getMockUserId } from '../factories/userFactory';
import { expectInfoLog, expectPermissionLog } from '../utils/log-assertions';

describe('event.service.softDelete', () => {
    const baseEvent = getMockEvent({
        id: getMockEventId('event-1'),
        authorId: getMockUserId('user-1')
    });
    const admin = getMockUser({ id: getMockUserId('admin-1'), role: RoleEnum.ADMIN });
    const superAdmin = getMockUser({
        id: getMockUserId('superadmin-1'),
        role: RoleEnum.SUPER_ADMIN
    });
    const author = getMockUser({ id: getMockUserId('user-1'), role: RoleEnum.USER });
    const userWithPerm = getMockUser({
        id: getMockUserId('user-2'),
        role: RoleEnum.USER,
        permissions: [PermissionEnum.EVENT_DELETE]
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

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('should soft-delete event when user is admin', async () => {
        const archivedEvent = {
            ...baseEvent,
            lifecycleState: LifecycleStatusEnum.ARCHIVED,
            deletedAt: new Date(),
            deletedById: admin.id,
            updatedAt: new Date(),
            updatedById: admin.id
        };
        (EventModel.getById as Mock).mockResolvedValue(baseEvent);
        (EventModel.update as Mock).mockResolvedValue(archivedEvent);
        const result = await EventService.softDelete({ id: baseEvent.id }, admin);
        expect(result.event).toMatchObject({
            lifecycleState: LifecycleStatusEnum.ARCHIVED,
            deletedById: admin.id
        });
        expectInfoLog({ input: { id: baseEvent.id }, actor: admin }, 'delete:start');
        expectInfoLog({ result: { event: archivedEvent } }, 'delete:end');
    });

    it('should soft-delete event when user is superAdmin', async () => {
        const archivedEvent = {
            ...baseEvent,
            lifecycleState: LifecycleStatusEnum.ARCHIVED,
            deletedAt: new Date(),
            deletedById: superAdmin.id,
            updatedAt: new Date(),
            updatedById: superAdmin.id
        };
        (EventModel.getById as Mock).mockResolvedValue(baseEvent);
        (EventModel.update as Mock).mockResolvedValue(archivedEvent);
        const result = await EventService.softDelete({ id: baseEvent.id }, superAdmin);
        expect(result.event).toMatchObject({
            lifecycleState: LifecycleStatusEnum.ARCHIVED,
            deletedById: superAdmin.id
        });
        expectInfoLog({ input: { id: baseEvent.id }, actor: superAdmin }, 'delete:start');
        expectInfoLog({ result: { event: archivedEvent } }, 'delete:end');
    });

    it('should soft-delete event when user is author', async () => {
        const archivedEvent = {
            ...baseEvent,
            lifecycleState: LifecycleStatusEnum.ARCHIVED,
            deletedAt: new Date(),
            deletedById: author.id,
            updatedAt: new Date(),
            updatedById: author.id
        };
        (EventModel.getById as Mock).mockResolvedValue(baseEvent);
        (EventModel.update as Mock).mockResolvedValue(archivedEvent);
        const result = await EventService.softDelete({ id: baseEvent.id }, author);
        expect(result.event).toMatchObject({
            lifecycleState: LifecycleStatusEnum.ARCHIVED,
            deletedById: author.id
        });
        expectInfoLog({ input: { id: baseEvent.id }, actor: author }, 'delete:start');
        expectInfoLog({ result: { event: archivedEvent } }, 'delete:end');
    });

    it('should soft-delete event when user has EVENT_DELETE permission', async () => {
        const archivedEvent = {
            ...baseEvent,
            lifecycleState: LifecycleStatusEnum.ARCHIVED,
            deletedAt: new Date(),
            deletedById: userWithPerm.id,
            updatedAt: new Date(),
            updatedById: userWithPerm.id
        };
        (EventModel.getById as Mock).mockResolvedValue(baseEvent);
        (EventModel.update as Mock).mockResolvedValue(archivedEvent);
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        const result = await EventService.softDelete({ id: baseEvent.id }, userWithPerm);
        expect(result.event).toMatchObject({
            lifecycleState: LifecycleStatusEnum.ARCHIVED,
            deletedById: userWithPerm.id
        });
        expectInfoLog({ input: { id: baseEvent.id }, actor: userWithPerm }, 'delete:start');
        expectInfoLog({ result: { event: archivedEvent } }, 'delete:end');
    });

    it('should deny soft-delete if user has no permission', async () => {
        (EventModel.getById as Mock).mockResolvedValue(baseEvent);
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(false);
        await expect(EventService.softDelete({ id: baseEvent.id }, userNoPerm)).rejects.toThrow(
            /Permission denied/
        );
        expectPermissionLog({
            permission: PermissionEnum.EVENT_DELETE,
            userId: userNoPerm.id,
            role: userNoPerm.role,
            extraData: expect.objectContaining({ error: 'Permission denied' })
        });
    });

    it('should deny soft-delete if user is disabled', async () => {
        (EventModel.getById as Mock).mockResolvedValue(baseEvent);
        await expect(EventService.softDelete({ id: baseEvent.id }, disabledUser)).rejects.toThrow(
            /user disabled/
        );
        expectPermissionLog({
            permission: PermissionEnum.EVENT_DELETE,
            userId: disabledUser.id,
            role: disabledUser.role,
            extraData: expect.objectContaining({ error: 'User disabled' })
        });
    });

    it('should throw if event is already archived', async () => {
        const archivedEvent = {
            ...baseEvent,
            lifecycleState: LifecycleStatusEnum.ARCHIVED,
            deletedAt: new Date()
        };
        (EventModel.getById as Mock).mockResolvedValue(archivedEvent);
        await expect(EventService.softDelete({ id: baseEvent.id }, admin)).rejects.toThrow(
            /already archived/
        );
        expectInfoLog({ result: { event: null } }, 'delete:end');
    });

    it('should throw if event does not exist', async () => {
        (EventModel.getById as Mock).mockResolvedValue(undefined);
        await expect(
            EventService.softDelete({ id: getMockEventId('not-exist') }, admin)
        ).rejects.toThrow('Event not found');
        expectInfoLog({ result: { event: null } }, 'delete:end');
    });

    it('should deny soft-delete for public user', async () => {
        (EventModel.getById as Mock).mockResolvedValue(baseEvent);
        await expect(EventService.softDelete({ id: baseEvent.id }, publicActor)).rejects.toThrow(
            /Permission denied/
        );
        expectPermissionLog({
            permission: PermissionEnum.EVENT_DELETE,
            userId: 'public',
            role: publicActor.role,
            extraData: expect.objectContaining({ error: 'Permission denied' })
        });
    });
});
