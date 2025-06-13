import { EventModel } from '@repo/db';
import {
    EventCategoryEnum,
    type EventId,
    LifecycleStatusEnum,
    PermissionEnum,
    RoleEnum,
    type UserId,
    VisibilityEnum
} from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventService } from '../../event/event.service';
import * as permissionManager from '../../utils/permission-manager';
import { getMockEvent, getMockEventId } from '../factories/eventFactory';
import { getMockPublicUser, getMockUser, getMockUserId } from '../factories/userFactory';

const admin = getMockUser({ id: getMockUserId('admin-1') as UserId, role: RoleEnum.ADMIN });
const superAdmin = getMockUser({
    id: getMockUserId('superadmin-1') as UserId,
    role: RoleEnum.SUPER_ADMIN
});
const userWithPerm = getMockUser({
    id: getMockUserId('user-2') as UserId,
    role: RoleEnum.USER,
    permissions: [PermissionEnum.EVENT_UPDATE]
});
const userNoPerm = getMockUser({
    id: getMockUserId('user-3') as UserId,
    role: RoleEnum.USER,
    permissions: []
});
const disabledUser = getMockUser({
    id: getMockUserId('user-4') as UserId,
    lifecycleState: LifecycleStatusEnum.INACTIVE
});
const publicActor = getMockPublicUser();

const baseEvent = getMockEvent({
    id: getMockEventId('event-1') as EventId,
    slug: 'original-slug',
    summary: 'Original',
    category: EventCategoryEnum.MUSIC,
    visibility: VisibilityEnum.PUBLIC
});

const validInput = { id: baseEvent.id, summary: 'Updated summary' };

describe('event.service.update', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should allow admin to update an event', async () => {
        vi.spyOn(EventModel, 'getById').mockResolvedValue(baseEvent);
        vi.spyOn(EventModel, 'update').mockImplementation(async (_id, input) =>
            getMockEvent({ ...baseEvent, ...input })
        );
        const result = await EventService.update(validInput, admin);
        expect(result.event.summary).toBe(validInput.summary);
        expect(mockServiceLogger.info).toHaveBeenCalledWith(expect.anything(), 'update:start');
        expect(mockServiceLogger.info).toHaveBeenCalledWith(expect.anything(), 'update:end');
    });

    it('should allow superadmin to update an event', async () => {
        vi.spyOn(EventModel, 'getById').mockResolvedValue(baseEvent);
        vi.spyOn(EventModel, 'update').mockImplementation(async (_id, input) =>
            getMockEvent({ ...baseEvent, ...input })
        );
        const result = await EventService.update(validInput, superAdmin);
        expect(result.event.summary).toBe(validInput.summary);
    });

    it('should allow user with permission to update an event', async () => {
        vi.spyOn(EventModel, 'getById').mockResolvedValue(baseEvent);
        vi.spyOn(EventModel, 'update').mockImplementation(async (_id, input) =>
            getMockEvent({ ...baseEvent, ...input })
        );
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(true);
        const result = await EventService.update(validInput, userWithPerm);
        expect(result.event.summary).toBe(validInput.summary);
    });

    it('should not allow user without permission', async () => {
        vi.spyOn(EventModel, 'getById').mockResolvedValue(baseEvent);
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(false);
        await expect(EventService.update(validInput, userNoPerm)).rejects.toThrow(
            'Permission denied'
        );
    });

    it('should not allow disabled user', async () => {
        vi.spyOn(EventModel, 'getById').mockResolvedValue(baseEvent);
        await expect(EventService.update(validInput, disabledUser)).rejects.toThrow(
            'User is disabled'
        );
    });

    it('should not allow public actor', async () => {
        vi.spyOn(EventModel, 'getById').mockResolvedValue(baseEvent);
        await expect(EventService.update(validInput, publicActor)).rejects.toThrow(
            'Permission denied'
        );
    });

    it('should not allow duplicate slug', async () => {
        vi.spyOn(EventModel, 'getById').mockResolvedValue(baseEvent);
        vi.spyOn(EventModel, 'getBySlug').mockResolvedValue(
            getMockEvent({ id: getMockEventId('event-2') as EventId, slug: 'new-slug' })
        );
        await expect(
            EventService.update({ ...validInput, slug: 'new-slug' }, admin)
        ).rejects.toThrow('Slug already exists');
    });

    it('should throw if event not found', async () => {
        vi.spyOn(EventModel, 'getById').mockResolvedValue(undefined);
        await expect(EventService.update(validInput, admin)).rejects.toThrow('Event not found');
    });

    it('should throw on invalid input', async () => {
        await expect(EventService.update({ id: '' }, admin)).rejects.toThrow();
    });
});
