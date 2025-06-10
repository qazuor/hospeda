import type { EventId, UserId } from '@repo/types';
import { LifecycleStatusEnum, PermissionEnum, RoleEnum, VisibilityEnum } from '@repo/types';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
            search: vi.fn()
        }
    };
});

describe('event.service.getByDateRange', () => {
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
    const publicEvent = getMockEvent({
        id: 'event-1' as EventId,
        visibility: VisibilityEnum.PUBLIC
    });
    const privateEvent = getMockEvent({
        id: 'event-2' as EventId,
        visibility: VisibilityEnum.PRIVATE
    });
    const archivedEvent = getMockEvent({
        id: 'event-3' as EventId,
        visibility: VisibilityEnum.PUBLIC,
        lifecycleState: LifecycleStatusEnum.ARCHIVED
    });
    const allEvents = [publicEvent, privateEvent, archivedEvent];
    const minDate = new Date('2024-07-01T00:00:00Z');
    const maxDate = new Date('2024-08-01T00:00:00Z');

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return all events for ADMIN', async () => {
        (EventModel.search as Mock).mockResolvedValue(allEvents);
        const result = await EventService.getByDateRange({ minDate, maxDate }, admin);
        expect(result.events).toHaveLength(3);
        expect(result.events).toEqual(expect.arrayContaining(allEvents));
        expectInfoLog({ input: { minDate, maxDate }, actor: admin }, 'getByDateRange:start');
        expectInfoLog(
            { result: { events: expect.arrayContaining(allEvents) } },
            'getByDateRange:end'
        );
    });

    it('should return public and private events for user with permission', async () => {
        vi.spyOn(permissionManager, 'hasPermission').mockImplementation(
            (_, perm) => perm === PermissionEnum.EVENT_VIEW_PRIVATE
        );
        (EventModel.search as Mock).mockResolvedValue(allEvents);
        const result = await EventService.getByDateRange({ minDate, maxDate }, userWithPerm);
        expect(result.events).toEqual(expect.arrayContaining([publicEvent, privateEvent]));
        expect(result.events).not.toContainEqual(archivedEvent);
        expectInfoLog({ input: { minDate, maxDate }, actor: userWithPerm }, 'getByDateRange:start');
        expectInfoLog(
            { result: { events: expect.arrayContaining([publicEvent, privateEvent]) } },
            'getByDateRange:end'
        );
    });

    it('should return only public events for user without permission', async () => {
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(false);
        (EventModel.search as Mock).mockResolvedValue(allEvents);
        const result = await EventService.getByDateRange({ minDate, maxDate }, userNoPerm);
        expect(result.events).toEqual([publicEvent]);
        expect(result.events).not.toContainEqual(archivedEvent);
        expectInfoLog({ input: { minDate, maxDate }, actor: userNoPerm }, 'getByDateRange:start');
        expectInfoLog({ result: { events: [publicEvent] } }, 'getByDateRange:end');
    });

    it('should return only public events for public user', async () => {
        (EventModel.search as Mock).mockResolvedValue(allEvents);
        const result = await EventService.getByDateRange({ minDate, maxDate }, publicActor);
        expect(result.events).toEqual([publicEvent]);
        expect(result.events).not.toContainEqual(archivedEvent);
        expectInfoLog({ input: { minDate, maxDate }, actor: publicActor }, 'getByDateRange:start');
        expectInfoLog({ result: { events: [publicEvent] } }, 'getByDateRange:end');
    });

    it('should return no events for disabled user', async () => {
        (EventModel.search as Mock).mockResolvedValue(allEvents);
        const result = await EventService.getByDateRange({ minDate, maxDate }, disabledUser);
        expect(result.events).toEqual([]);
        expectPermissionLog({
            userId: disabledUser.id,
            role: disabledUser.role,
            extraData: expect.objectContaining({ error: 'User disabled' })
        });
        expectInfoLog({ result: { events: [] } }, 'getByDateRange:end');
    });

    it('should respect limit and offset', async () => {
        (EventModel.search as Mock).mockResolvedValue([publicEvent, privateEvent, archivedEvent]);
        await EventService.getByDateRange({ minDate, maxDate, limit: 1, offset: 1 }, admin);
        expect(EventModel.search).toHaveBeenCalledWith(
            expect.objectContaining({ limit: 1, offset: 1, minDate, maxDate })
        );
    });

    it('should pass minDate and maxDate to EventModel.search', async () => {
        (EventModel.search as Mock).mockResolvedValue([publicEvent]);
        await EventService.getByDateRange({ minDate, maxDate }, admin);
        expect(EventModel.search).toHaveBeenCalledWith(
            expect.objectContaining({ minDate, maxDate })
        );
    });

    it('should throw if minDate or maxDate is missing', async () => {
        await expect(EventService.getByDateRange({} as never, admin)).rejects.toThrow();
        await expect(EventService.getByDateRange({ minDate } as never, admin)).rejects.toThrow();
        await expect(EventService.getByDateRange({ maxDate } as never, admin)).rejects.toThrow();
    });
});
