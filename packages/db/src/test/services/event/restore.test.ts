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
import { expectInfoLog, expectPermissionLog } from '../../utils/logAssertions';
import { getMockEvent, getMockPublicUser, getMockUser } from '../mockData';

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

describe('event.service.restore', () => {
    const admin = getMockUser({ id: 'admin-1' as UserId, role: RoleEnum.ADMIN });
    const superAdmin = getMockUser({ id: 'superadmin-1' as UserId, role: RoleEnum.SUPER_ADMIN });
    const userWithPerm = getMockUser({
        id: 'user-2' as UserId,
        role: RoleEnum.USER,
        permissions: [PermissionEnum.EVENT_RESTORE]
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
    const eventId = 'event-1' as EventId;
    const archivedEvent = getMockEvent({
        id: eventId,
        lifecycleState: LifecycleStatusEnum.ARCHIVED,
        deletedAt: new Date(),
        deletedById: admin.id
    });
    const activeEvent = getMockEvent({ id: eventId, lifecycleState: LifecycleStatusEnum.ACTIVE });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should restore event when user is ADMIN', async () => {
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        (EventModel.getById as Mock).mockResolvedValue(archivedEvent);
        const now = new Date();
        (EventModel.update as Mock).mockResolvedValue({
            ...archivedEvent,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            deletedAt: undefined,
            deletedById: undefined,
            updatedAt: now,
            updatedById: admin.id
        });
        const result = await EventService.restore({ id: eventId }, admin);
        expect(result.event).not.toBeNull();
        if (!result.event) throw new Error('event should not be null');
        expect(result.event.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
        expect(result.event.deletedAt).toBeUndefined();
        expect(result.event.deletedById).toBeUndefined();
        expect(result.event.updatedAt).toBeInstanceOf(Date);
        expect(result.event.updatedById).toBe(admin.id);
        expectInfoLog({ input: { id: eventId }, actor: admin }, 'restore:start');
        expectInfoLog(
            {
                result: {
                    event: expect.objectContaining({ lifecycleState: LifecycleStatusEnum.ACTIVE })
                }
            },
            'restore:end'
        );
    });

    it('should restore event when user is SUPER_ADMIN', async () => {
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(false);
        (EventModel.getById as Mock).mockResolvedValue(archivedEvent);
        const now = new Date();
        (EventModel.update as Mock).mockResolvedValue({
            ...archivedEvent,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            deletedAt: undefined,
            deletedById: undefined,
            updatedAt: now,
            updatedById: superAdmin.id
        });
        const result = await EventService.restore({ id: eventId }, superAdmin);
        expect(result.event).not.toBeNull();
        if (!result.event) throw new Error('event should not be null');
        expect(result.event.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
        expect(result.event.updatedById).toBe(superAdmin.id);
        expectInfoLog({ input: { id: eventId }, actor: superAdmin }, 'restore:start');
        expectInfoLog(
            {
                result: {
                    event: expect.objectContaining({ lifecycleState: LifecycleStatusEnum.ACTIVE })
                }
            },
            'restore:end'
        );
    });

    it('should restore event when user has EVENT_RESTORE permission', async () => {
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        (EventModel.getById as Mock).mockResolvedValue(archivedEvent);
        const now = new Date();
        (EventModel.update as Mock).mockResolvedValue({
            ...archivedEvent,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            deletedAt: undefined,
            deletedById: undefined,
            updatedAt: now,
            updatedById: userWithPerm.id
        });
        const result = await EventService.restore({ id: eventId }, userWithPerm);
        expect(result.event).not.toBeNull();
        if (!result.event) throw new Error('event should not be null');
        expect(result.event.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
        expect(result.event.updatedById).toBe(userWithPerm.id);
        expectInfoLog({ input: { id: eventId }, actor: userWithPerm }, 'restore:start');
        expectInfoLog(
            {
                result: {
                    event: expect.objectContaining({ lifecycleState: LifecycleStatusEnum.ACTIVE })
                }
            },
            'restore:end'
        );
    });

    it('should deny restore if user is disabled', async () => {
        (EventModel.getById as Mock).mockResolvedValue(archivedEvent);
        await expect(EventService.restore({ id: eventId }, disabledUser)).rejects.toThrow(
            /Forbidden: user disabled/
        );
        expectPermissionLog({
            permission: PermissionEnum.EVENT_RESTORE,
            userId: disabledUser.id,
            role: disabledUser.role,
            extraData: expect.objectContaining({ error: 'User disabled' })
        });
    });

    it('should deny restore if user is public', async () => {
        (EventModel.getById as Mock).mockResolvedValue(archivedEvent);
        await expect(EventService.restore({ id: eventId }, publicActor)).rejects.toThrow(
            /Forbidden/
        );
        expectPermissionLog({
            permission: PermissionEnum.EVENT_RESTORE,
            userId: 'public',
            role: publicActor.role,
            extraData: expect.objectContaining({ error: 'Permission denied' })
        });
    });

    it('should deny restore if user has no permission', async () => {
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(false);
        (EventModel.getById as Mock).mockResolvedValue(archivedEvent);
        await expect(EventService.restore({ id: eventId }, userNoPerm)).rejects.toThrow(
            /Forbidden/
        );
        expectPermissionLog({
            permission: PermissionEnum.EVENT_RESTORE,
            userId: userNoPerm.id,
            role: userNoPerm.role,
            extraData: expect.objectContaining({ error: 'Permission denied' })
        });
    });

    it('should throw if event does not exist', async () => {
        (EventModel.getById as Mock).mockResolvedValue(undefined);
        await expect(EventService.restore({ id: eventId }, admin)).rejects.toThrow(
            'Event not found'
        );
        expectInfoLog({ result: { event: null } }, 'restore:end');
    });

    it('should throw if event is not archived', async () => {
        (EventModel.getById as Mock).mockResolvedValue(activeEvent);
        await expect(EventService.restore({ id: eventId }, admin)).rejects.toThrow(
            'Event is not archived'
        );
        expectInfoLog({ result: { event: null } }, 'restore:end');
    });

    it('should throw if restore fails in the model', async () => {
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        (EventModel.getById as Mock).mockResolvedValue(archivedEvent);
        (EventModel.update as Mock).mockRejectedValue(new Error('DB error'));
        await expect(EventService.restore({ id: eventId }, admin)).rejects.toThrow(
            'Event restore failed'
        );
        expectInfoLog({ result: { event: null } }, 'restore:end');
    });
});
