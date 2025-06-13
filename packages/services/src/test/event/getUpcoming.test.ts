import { EventModel } from '@repo/db';
import { LifecycleStatusEnum, PermissionEnum, RoleEnum, VisibilityEnum } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventService } from '../../event/event.service';
import * as permissionManager from '../../utils/permission-manager';
import { getMockEvent, getMockPublicUser, getMockUser } from '../factories';
import { getMockEventId } from '../factories/eventFactory';
import { getMockUserId } from '../factories/userFactory';
import { expectInfoLog, expectPermissionLog } from '../utils/log-assertions';

describe('event.service.getUpcoming', () => {
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
    const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24); // +1 day
    const publicEvent = getMockEvent({
        id: getMockEventId('event-1'),
        visibility: VisibilityEnum.PUBLIC,
        date: { start: futureDate }
    });
    const privateEvent = getMockEvent({
        id: getMockEventId('event-2'),
        visibility: VisibilityEnum.PRIVATE,
        date: { start: futureDate }
    });
    const archivedEvent = getMockEvent({
        id: getMockEventId('event-3'),
        visibility: VisibilityEnum.PUBLIC,
        lifecycleState: LifecycleStatusEnum.ARCHIVED,
        date: { start: futureDate }
    });
    const allUpcoming = [publicEvent, privateEvent, archivedEvent];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return all upcoming events for ADMIN', async () => {
        (EventModel.search as Mock).mockResolvedValue(allUpcoming);
        const result = await EventService.getUpcoming({}, admin);
        expect(result.events).toHaveLength(3);
        expect(result.events).toEqual(expect.arrayContaining(allUpcoming));
        expectInfoLog({ input: {}, actor: admin }, 'getUpcoming:start');
        expectInfoLog(
            { result: { events: expect.arrayContaining(allUpcoming) } },
            'getUpcoming:end'
        );
    });

    it('should return public and private upcoming events for user with permission', async () => {
        vi.spyOn(permissionManager, 'hasPermission').mockImplementation(
            (_, perm) => perm === PermissionEnum.EVENT_VIEW_PRIVATE
        );
        (EventModel.search as Mock).mockResolvedValue(allUpcoming);
        const result = await EventService.getUpcoming({}, userWithPerm);
        expect(result.events).toEqual(expect.arrayContaining([publicEvent, privateEvent]));
        expect(result.events).not.toContainEqual(archivedEvent);
        expectInfoLog({ input: {}, actor: userWithPerm }, 'getUpcoming:start');
        expectInfoLog(
            { result: { events: expect.arrayContaining([publicEvent, privateEvent]) } },
            'getUpcoming:end'
        );
    });

    it('should return only public upcoming events for user without permission', async () => {
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(false);
        (EventModel.search as Mock).mockResolvedValue(allUpcoming);
        const result = await EventService.getUpcoming({}, userNoPerm);
        expect(result.events).toEqual([publicEvent]);
        expect(result.events).not.toContainEqual(archivedEvent);
        expectInfoLog({ input: {}, actor: userNoPerm }, 'getUpcoming:start');
        expectInfoLog({ result: { events: [publicEvent] } }, 'getUpcoming:end');
    });

    it('should return only public upcoming events for public user', async () => {
        (EventModel.search as Mock).mockResolvedValue(allUpcoming);
        const result = await EventService.getUpcoming({}, publicActor);
        expect(result.events).toEqual([publicEvent]);
        expect(result.events).not.toContainEqual(archivedEvent);
        expectInfoLog({ input: {}, actor: publicActor }, 'getUpcoming:start');
        expectInfoLog({ result: { events: [publicEvent] } }, 'getUpcoming:end');
    });

    it('should return no events for disabled user', async () => {
        (EventModel.search as Mock).mockResolvedValue(allUpcoming);
        const result = await EventService.getUpcoming({}, disabledUser);
        expect(result.events).toEqual([]);
        expectPermissionLog({
            userId: disabledUser.id,
            role: disabledUser.role,
            extraData: expect.objectContaining({ error: 'User disabled' })
        });
        expectInfoLog({ result: { events: [] } }, 'getUpcoming:end');
    });

    it('should respect limit and offset', async () => {
        (EventModel.search as Mock).mockResolvedValue(allUpcoming);
        const result = await EventService.getUpcoming({ limit: 1, offset: 1 }, admin);
        expect(EventModel.search).toHaveBeenCalledWith(
            expect.objectContaining({ limit: 1, offset: 1 })
        );
        expect(result.events).toHaveLength(3); // Filtering is after model
    });

    it('should return empty if no events found', async () => {
        (EventModel.search as Mock).mockResolvedValue([]);
        const result = await EventService.getUpcoming({}, admin);
        expect(result.events).toEqual([]);
        expectInfoLog({ result: { events: [] } }, 'getUpcoming:end');
    });

    it('should return empty if all events filtered by permissions', async () => {
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(false);
        (EventModel.search as Mock).mockResolvedValue([privateEvent]);
        const result = await EventService.getUpcoming({}, userNoPerm);
        expect(result.events).toEqual([]);
        expectInfoLog({ result: { events: [] } }, 'getUpcoming:end');
    });

    it('should pass minDate to EventModel.search', async () => {
        (EventModel.search as Mock).mockResolvedValue([publicEvent]);
        const minDate = new Date('2024-07-01T00:00:00Z');
        await EventService.getUpcoming({ minDate }, admin);
        expect(EventModel.search).toHaveBeenCalledWith(expect.objectContaining({ minDate }));
    });

    it('should pass maxDate to EventModel.search', async () => {
        (EventModel.search as Mock).mockResolvedValue([publicEvent]);
        const maxDate = new Date('2024-08-01T00:00:00Z');
        await EventService.getUpcoming({ maxDate }, admin);
        expect(EventModel.search).toHaveBeenCalledWith(expect.objectContaining({ maxDate }));
    });

    it('should pass both minDate and maxDate to EventModel.search', async () => {
        (EventModel.search as Mock).mockResolvedValue([publicEvent]);
        const minDate = new Date('2024-07-01T00:00:00Z');
        const maxDate = new Date('2024-08-01T00:00:00Z');
        await EventService.getUpcoming({ minDate, maxDate }, admin);
        expect(EventModel.search).toHaveBeenCalledWith(
            expect.objectContaining({ minDate, maxDate })
        );
    });

    it('should default minDate to now if not provided', async () => {
        (EventModel.search as Mock).mockResolvedValue([publicEvent]);
        const before = Date.now();
        await EventService.getUpcoming({}, admin);
        const call = (EventModel.search as Mock).mock.calls[0]?.[0];
        expect(call).toBeDefined();
        expect(call.minDate).toBeInstanceOf(Date);
        expect(call.minDate.getTime()).toBeGreaterThanOrEqual(before);
    });
});
