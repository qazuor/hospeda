import {
    type EventId,
    LifecycleStatusEnum,
    PermissionEnum,
    RoleEnum,
    type UserId
} from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventModel } from '../../../models/event/event.model';
import { EventService } from '../../../services/event/event.service';
import * as permissionManager from '../../../utils/permission-manager';
import { getMockEvent, getMockPublicUser, getMockUser } from '../../mockData';
import { expectInfoLog, expectPermissionLog } from '../../utils/logAssertions';

vi.mock('../../../models/event/event.model', async (importOriginal) => {
    const actualImport = await importOriginal();
    const actual = typeof actualImport === 'object' && actualImport !== null ? actualImport : {};
    return {
        ...actual,
        EventModel: {
            ...((actual as Record<string, unknown>).EventModel ?? {}),
            getById: vi.fn(),
            update: vi.fn()
        }
    };
});

describe('event.service.softDelete', () => {
    const baseEvent = getMockEvent({ id: 'event-1' as EventId, authorId: 'user-1' as UserId });
    const admin = getMockUser({ id: 'admin-1' as UserId, role: RoleEnum.ADMIN });
    const superAdmin = getMockUser({ id: 'superadmin-1' as UserId, role: RoleEnum.SUPER_ADMIN });
    const author = getMockUser({ id: 'user-1' as UserId, role: RoleEnum.USER });
    const userWithPerm = getMockUser({
        id: 'user-2' as UserId,
        role: RoleEnum.USER,
        permissions: [PermissionEnum.EVENT_DELETE]
    });
    const userNoPerm = getMockUser({
        id: 'user-3' as UserId,
        role: RoleEnum.USER,
        permissions: []
    });
    const disabledUser = getMockUser({
        id: 'user-4' as UserId,
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
            EventService.softDelete({ id: 'not-exist' as EventId }, admin)
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
