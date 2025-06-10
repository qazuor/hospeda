import {
    EventCategoryEnum,
    type EventId,
    LifecycleStatusEnum,
    PermissionEnum,
    RoleEnum,
    type UserId,
    VisibilityEnum
} from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventModel } from '../../../models/event/event.model';
import { EventService } from '../../../services/event/event.service';
import * as permissionManager from '../../../utils/permission-manager';
import { expectInfoLog, expectPermissionLog } from '../../utils/log-assertions';
import { getMockEvent, getMockPublicUser, getMockUser } from '../mockData';

vi.mock('../../../models/event/event.model', async (importOriginal) => {
    const actualImport = await importOriginal();
    const actual = typeof actualImport === 'object' && actualImport !== null ? actualImport : {};
    return {
        ...actual,
        EventModel: {
            ...((actual as Record<string, unknown>).EventModel ?? {}),
            search: vi.fn()
        }
    };
});

describe('event.service.getByCategory', () => {
    const admin = getMockUser({ id: 'admin-1' as UserId, role: RoleEnum.ADMIN });
    const userWithPerm = getMockUser({
        id: 'user-2' as UserId,
        role: RoleEnum.USER,
        permissions: [PermissionEnum.EVENT_VIEW_PRIVATE]
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
    const category = EventCategoryEnum.FESTIVAL;
    const publicEvent = getMockEvent({
        id: 'event-1' as EventId,
        visibility: VisibilityEnum.PUBLIC,
        category
    });
    const privateEvent = getMockEvent({
        id: 'event-2' as EventId,
        visibility: VisibilityEnum.PRIVATE,
        category
    });
    const archivedEvent = getMockEvent({
        id: 'event-3' as EventId,
        visibility: VisibilityEnum.PUBLIC,
        lifecycleState: LifecycleStatusEnum.ARCHIVED,
        category
    });
    const allEvents = [publicEvent, privateEvent, archivedEvent];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return all events for ADMIN', async () => {
        (EventModel.search as Mock).mockResolvedValue(allEvents);
        const result = await EventService.getByCategory({ category }, admin);
        expect(result.events).toHaveLength(3);
        expect(result.events).toEqual(expect.arrayContaining(allEvents));
        expectInfoLog({ input: { category }, actor: admin }, 'getByCategory:start');
        expectInfoLog(
            { result: { events: expect.arrayContaining(allEvents) } },
            'getByCategory:end'
        );
    });

    it('should return public and private events for user with permission', async () => {
        vi.spyOn(permissionManager, 'hasPermission').mockImplementation(
            (_, perm) => perm === PermissionEnum.EVENT_VIEW_PRIVATE
        );
        (EventModel.search as Mock).mockResolvedValue(allEvents);
        const result = await EventService.getByCategory({ category }, userWithPerm);
        expect(result.events).toEqual(expect.arrayContaining([publicEvent, privateEvent]));
        expect(result.events).not.toContainEqual(archivedEvent);
        expectInfoLog({ input: { category }, actor: userWithPerm }, 'getByCategory:start');
        expectInfoLog(
            { result: { events: expect.arrayContaining([publicEvent, privateEvent]) } },
            'getByCategory:end'
        );
    });

    it('should return only public events for user without permission', async () => {
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(false);
        (EventModel.search as Mock).mockResolvedValue(allEvents);
        const result = await EventService.getByCategory({ category }, userNoPerm);
        expect(result.events).toEqual([publicEvent]);
        expect(result.events).not.toContainEqual(archivedEvent);
        expectInfoLog({ input: { category }, actor: userNoPerm }, 'getByCategory:start');
        expectInfoLog({ result: { events: [publicEvent] } }, 'getByCategory:end');
    });

    it('should return only public events for public user', async () => {
        (EventModel.search as Mock).mockResolvedValue(allEvents);
        const result = await EventService.getByCategory({ category }, publicActor);
        expect(result.events).toEqual([publicEvent]);
        expect(result.events).not.toContainEqual(archivedEvent);
        expectInfoLog({ input: { category }, actor: publicActor }, 'getByCategory:start');
        expectInfoLog({ result: { events: [publicEvent] } }, 'getByCategory:end');
    });

    it('should return no events for disabled user', async () => {
        (EventModel.search as Mock).mockResolvedValue(allEvents);
        const result = await EventService.getByCategory({ category }, disabledUser);
        expect(result.events).toEqual([]);
        expectPermissionLog({
            userId: disabledUser.id,
            role: disabledUser.role,
            extraData: expect.objectContaining({ error: 'User disabled' })
        });
        expectInfoLog({ result: { events: [] } }, 'getByCategory:end');
    });

    it('should respect limit and offset', async () => {
        (EventModel.search as Mock).mockResolvedValue([publicEvent, privateEvent, archivedEvent]);
        const result = await EventService.getByCategory({ category, limit: 1, offset: 1 }, admin);
        expect(EventModel.search).toHaveBeenCalledWith(
            expect.objectContaining({ limit: 1, offset: 1 })
        );
        expect(result.events).toHaveLength(3); // Filtering is after model
    });

    it('should return empty if no events found', async () => {
        (EventModel.search as Mock).mockResolvedValue([]);
        const result = await EventService.getByCategory({ category }, admin);
        expect(result.events).toEqual([]);
        expectInfoLog({ result: { events: [] } }, 'getByCategory:end');
    });

    it('should return empty if all events filtered by permissions', async () => {
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(false);
        (EventModel.search as Mock).mockResolvedValue([privateEvent]);
        const result = await EventService.getByCategory({ category }, userNoPerm);
        expect(result.events).toEqual([]);
        expectInfoLog({ result: { events: [] } }, 'getByCategory:end');
    });

    it('should pass minDate to EventModel.search', async () => {
        (EventModel.search as Mock).mockResolvedValue([publicEvent]);
        const minDate = new Date('2024-07-01T00:00:00Z');
        await EventService.getByCategory({ category, minDate }, admin);
        expect(EventModel.search).toHaveBeenCalledWith(expect.objectContaining({ minDate }));
    });

    it('should pass maxDate to EventModel.search', async () => {
        (EventModel.search as Mock).mockResolvedValue([publicEvent]);
        const maxDate = new Date('2024-08-01T00:00:00Z');
        await EventService.getByCategory({ category, maxDate }, admin);
        expect(EventModel.search).toHaveBeenCalledWith(expect.objectContaining({ maxDate }));
    });

    it('should pass both minDate and maxDate to EventModel.search', async () => {
        (EventModel.search as Mock).mockResolvedValue([publicEvent]);
        const minDate = new Date('2024-07-01T00:00:00Z');
        const maxDate = new Date('2024-08-01T00:00:00Z');
        await EventService.getByCategory({ category, minDate, maxDate }, admin);
        expect(EventModel.search).toHaveBeenCalledWith(
            expect.objectContaining({ minDate, maxDate })
        );
    });
});
