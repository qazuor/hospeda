import { EventModel } from '@repo/db';
import { LifecycleStatusEnum, PermissionEnum, VisibilityEnum } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventService } from '../../event/event.service';
import * as permissionManager from '../../utils/permission-manager';
import { getMockEventOrganizerId } from '../factories';
import { getMockEvent, getMockEventId } from '../factories/eventFactory';
import {
    getMockAdminUser,
    getMockDisabledUser,
    getMockPublicUser,
    getMockUser,
    getMockUserId
} from '../factories/userFactory';
import { expectInfoLog, expectPermissionLog } from '../utils/log-assertions';

describe('event.service.getByOrganizerId', () => {
    const admin = getMockAdminUser({ id: getMockUserId('admin-1') });
    const userWithPerm = getMockUser({
        id: getMockUserId('user-2'),
        permissions: [PermissionEnum.EVENT_VIEW_PRIVATE]
    });
    const userNoPerm = getMockUser({
        id: getMockUserId('user-3'),
        permissions: []
    });
    const disabledUser = getMockDisabledUser({
        id: getMockUserId('user-4')
    });
    const publicActor = getMockPublicUser();
    const organizerId = getMockEventOrganizerId('org-1');
    const publicEvent = getMockEvent({
        id: getMockEventId('event-1'),
        visibility: VisibilityEnum.PUBLIC,
        organizerId
    });
    const privateEvent = getMockEvent({
        id: getMockEventId('event-2'),
        visibility: VisibilityEnum.PRIVATE,
        organizerId
    });
    const archivedEvent = getMockEvent({
        id: getMockEventId('event-3'),
        visibility: VisibilityEnum.PUBLIC,
        lifecycleState: LifecycleStatusEnum.ARCHIVED,
        organizerId
    });
    const allEvents = [publicEvent, privateEvent, archivedEvent];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return all events for ADMIN', async () => {
        (EventModel.search as Mock).mockResolvedValue(allEvents);
        const result = await EventService.getByOrganizerId({ organizerId }, admin);
        expect(result.events).toHaveLength(3);
        expect(result.events).toEqual(expect.arrayContaining(allEvents));
        expectInfoLog({ input: { organizerId }, actor: admin }, 'getByOrganizerId:start');
        expectInfoLog(
            { result: { events: expect.arrayContaining(allEvents) } },
            'getByOrganizerId:end'
        );
    });

    it('should return public and private events for user with permission', async () => {
        vi.spyOn(permissionManager, 'hasPermission').mockImplementation(
            (_, perm) => perm === PermissionEnum.EVENT_VIEW_PRIVATE
        );
        (EventModel.search as Mock).mockResolvedValue(allEvents);
        const result = await EventService.getByOrganizerId({ organizerId }, userWithPerm);
        expect(result.events).toEqual(expect.arrayContaining([publicEvent, privateEvent]));
        expect(result.events).not.toContainEqual(archivedEvent);
        expectInfoLog({ input: { organizerId }, actor: userWithPerm }, 'getByOrganizerId:start');
        expectInfoLog(
            { result: { events: expect.arrayContaining([publicEvent, privateEvent]) } },
            'getByOrganizerId:end'
        );
    });

    it('should return only public events for user without permission', async () => {
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(false);
        (EventModel.search as Mock).mockResolvedValue(allEvents);
        const result = await EventService.getByOrganizerId({ organizerId }, userNoPerm);
        expect(result.events).toEqual([publicEvent]);
        expect(result.events).not.toContainEqual(archivedEvent);
        expectInfoLog({ input: { organizerId }, actor: userNoPerm }, 'getByOrganizerId:start');
        expectInfoLog({ result: { events: [publicEvent] } }, 'getByOrganizerId:end');
    });

    it('should return only public events for public user', async () => {
        (EventModel.search as Mock).mockResolvedValue(allEvents);
        const result = await EventService.getByOrganizerId({ organizerId }, publicActor);
        expect(result.events).toEqual([publicEvent]);
        expect(result.events).not.toContainEqual(archivedEvent);
        expectInfoLog({ input: { organizerId }, actor: publicActor }, 'getByOrganizerId:start');
        expectInfoLog({ result: { events: [publicEvent] } }, 'getByOrganizerId:end');
    });

    it('should return no events for disabled user', async () => {
        (EventModel.search as Mock).mockResolvedValue(allEvents);
        const result = await EventService.getByOrganizerId({ organizerId }, disabledUser);
        expect(result.events).toEqual([]);
        expectPermissionLog({
            userId: disabledUser.id,
            role: disabledUser.role,
            extraData: expect.objectContaining({ error: 'User disabled' })
        });
        expectInfoLog({ result: { events: [] } }, 'getByOrganizerId:end');
    });

    it('should respect limit and offset', async () => {
        (EventModel.search as Mock).mockResolvedValue([publicEvent, privateEvent, archivedEvent]);
        const result = await EventService.getByOrganizerId(
            { organizerId, limit: 1, offset: 1 },
            admin
        );
        expect(EventModel.search).toHaveBeenCalledWith(
            expect.objectContaining({ limit: 1, offset: 1 })
        );
        expect(result.events).toHaveLength(3); // Filtering is after model
    });

    it('should return empty if no events found', async () => {
        (EventModel.search as Mock).mockResolvedValue([]);
        const result = await EventService.getByOrganizerId({ organizerId }, admin);
        expect(result.events).toEqual([]);
        expectInfoLog({ result: { events: [] } }, 'getByOrganizerId:end');
    });

    it('should return empty if all events filtered by permissions', async () => {
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(false);
        (EventModel.search as Mock).mockResolvedValue([privateEvent]);
        const result = await EventService.getByOrganizerId({ organizerId }, userNoPerm);
        expect(result.events).toEqual([]);
        expectInfoLog({ result: { events: [] } }, 'getByOrganizerId:end');
    });

    it('should pass minDate to EventModel.search', async () => {
        (EventModel.search as Mock).mockResolvedValue([publicEvent]);
        const minDate = new Date('2024-07-01T00:00:00Z');
        await EventService.getByOrganizerId({ organizerId, minDate }, admin);
        expect(EventModel.search).toHaveBeenCalledWith(expect.objectContaining({ minDate }));
    });

    it('should pass maxDate to EventModel.search', async () => {
        (EventModel.search as Mock).mockResolvedValue([publicEvent]);
        const maxDate = new Date('2024-08-01T00:00:00Z');
        await EventService.getByOrganizerId({ organizerId, maxDate }, admin);
        expect(EventModel.search).toHaveBeenCalledWith(expect.objectContaining({ maxDate }));
    });

    it('should pass both minDate and maxDate to EventModel.search', async () => {
        (EventModel.search as Mock).mockResolvedValue([publicEvent]);
        const minDate = new Date('2024-07-01T00:00:00Z');
        const maxDate = new Date('2024-08-01T00:00:00Z');
        await EventService.getByOrganizerId({ organizerId, minDate, maxDate }, admin);
        expect(EventModel.search).toHaveBeenCalledWith(
            expect.objectContaining({ minDate, maxDate })
        );
    });
});
