import { EventModel } from '@repo/db';
import { LifecycleStatusEnum, PermissionEnum, RoleEnum, VisibilityEnum } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventService } from '../../event/event.service';
import * as permissionManager from '../../utils/permission-manager';
import { getMockEvent, getMockPublicUser, getMockUser } from '../factories';
import { getMockEventId } from '../factories/eventFactory';
import { getMockUserId } from '../factories/userFactory';
import { expectInfoLog, expectPermissionLog } from '../utils/log-assertions';

describe('event.service.getFeatured', () => {
    const admin = getMockUser({ id: getMockUserId('admin-1'), role: RoleEnum.ADMIN });
    const userWithPerm = getMockUser({
        id: getMockUserId('user-2'),
        role: RoleEnum.USER,
        permissions: [PermissionEnum.EVENT_VIEW_PRIVATE]
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
    const publicEvent = getMockEvent({
        id: getMockEventId('event-1'),
        visibility: VisibilityEnum.PUBLIC,
        isFeatured: true
    });
    const privateEvent = getMockEvent({
        id: getMockEventId('event-2'),
        visibility: VisibilityEnum.PRIVATE,
        isFeatured: true
    });
    const archivedEvent = getMockEvent({
        id: getMockEventId('event-3'),
        visibility: VisibilityEnum.PUBLIC,
        lifecycleState: LifecycleStatusEnum.ARCHIVED,
        isFeatured: true
    });
    const allEvents = [publicEvent, privateEvent, archivedEvent];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return all featured events for ADMIN', async () => {
        (EventModel.search as Mock).mockResolvedValue(allEvents);
        const result = await EventService.getFeatured({}, admin);
        expect(result.events).toHaveLength(3);
        expect(result.events).toEqual(expect.arrayContaining(allEvents));
        expectInfoLog({ input: {}, actor: admin }, 'getFeatured:start');
        expectInfoLog({ result: { events: expect.arrayContaining(allEvents) } }, 'getFeatured:end');
    });

    it('should return public and private featured events for user with permission', async () => {
        vi.spyOn(permissionManager, 'hasPermission').mockImplementation(
            (_, perm) => perm === PermissionEnum.EVENT_VIEW_PRIVATE
        );
        (EventModel.search as Mock).mockResolvedValue(allEvents);
        const result = await EventService.getFeatured({}, userWithPerm);
        expect(result.events).toEqual(expect.arrayContaining([publicEvent, privateEvent]));
        expect(result.events).not.toContainEqual(archivedEvent);
        expectInfoLog({ input: {}, actor: userWithPerm }, 'getFeatured:start');
        expectInfoLog(
            { result: { events: expect.arrayContaining([publicEvent, privateEvent]) } },
            'getFeatured:end'
        );
    });

    it('should return only public featured events for user without permission', async () => {
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(false);
        (EventModel.search as Mock).mockResolvedValue(allEvents);
        const result = await EventService.getFeatured({}, userNoPerm);
        expect(result.events).toEqual([publicEvent]);
        expect(result.events).not.toContainEqual(archivedEvent);
        expectInfoLog({ input: {}, actor: userNoPerm }, 'getFeatured:start');
        expectInfoLog({ result: { events: [publicEvent] } }, 'getFeatured:end');
    });

    it('should return only public featured events for public user', async () => {
        (EventModel.search as Mock).mockResolvedValue(allEvents);
        const result = await EventService.getFeatured({}, publicActor);
        expect(result.events).toEqual([publicEvent]);
        expect(result.events).not.toContainEqual(archivedEvent);
        expectInfoLog({ input: {}, actor: publicActor }, 'getFeatured:start');
        expectInfoLog({ result: { events: [publicEvent] } }, 'getFeatured:end');
    });

    it('should return no events for disabled user', async () => {
        (EventModel.search as Mock).mockResolvedValue(allEvents);
        const result = await EventService.getFeatured({}, disabledUser);
        expect(result.events).toEqual([]);
        expectPermissionLog({
            userId: disabledUser.id,
            role: disabledUser.role,
            extraData: expect.objectContaining({ error: 'User disabled' })
        });
        expectInfoLog({ result: { events: [] } }, 'getFeatured:end');
    });

    it('should respect limit and offset', async () => {
        (EventModel.search as Mock).mockResolvedValue([publicEvent, privateEvent, archivedEvent]);
        const result = await EventService.getFeatured({ limit: 1, offset: 1 }, admin);
        expect(EventModel.search).toHaveBeenCalledWith(
            expect.objectContaining({ limit: 1, offset: 1 })
        );
        expect(result.events).toHaveLength(3); // Filtering is after model
    });

    it('should return empty if no events found', async () => {
        (EventModel.search as Mock).mockResolvedValue([]);
        const result = await EventService.getFeatured({}, admin);
        expect(result.events).toEqual([]);
        expectInfoLog({ result: { events: [] } }, 'getFeatured:end');
    });

    it('should return empty if all events filtered by permissions', async () => {
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(false);
        (EventModel.search as Mock).mockResolvedValue([privateEvent]);
        const result = await EventService.getFeatured({}, userNoPerm);
        expect(result.events).toEqual([]);
        expectInfoLog({ result: { events: [] } }, 'getFeatured:end');
    });
});
