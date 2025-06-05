import {
    type EventId,
    LifecycleStatusEnum,
    PermissionEnum,
    RoleEnum,
    type UserId,
    VisibilityEnum
} from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventModel } from '../../../models/event/event.model';
import { getFeatured } from '../../../services/event/event.service';
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
            search: vi.fn()
        }
    };
});

describe('event.service.getFeatured', () => {
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
        visibility: VisibilityEnum.PUBLIC,
        isFeatured: true
    });
    const privateEvent = getMockEvent({
        id: 'event-2' as EventId,
        visibility: VisibilityEnum.PRIVATE,
        isFeatured: true
    });
    const archivedEvent = getMockEvent({
        id: 'event-3' as EventId,
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
        const result = await getFeatured({}, admin);
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
        const result = await getFeatured({}, userWithPerm);
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
        const result = await getFeatured({}, userNoPerm);
        expect(result.events).toEqual([publicEvent]);
        expect(result.events).not.toContainEqual(archivedEvent);
        expectInfoLog({ input: {}, actor: userNoPerm }, 'getFeatured:start');
        expectInfoLog({ result: { events: [publicEvent] } }, 'getFeatured:end');
    });

    it('should return only public featured events for public user', async () => {
        (EventModel.search as Mock).mockResolvedValue(allEvents);
        const result = await getFeatured({}, publicActor);
        expect(result.events).toEqual([publicEvent]);
        expect(result.events).not.toContainEqual(archivedEvent);
        expectInfoLog({ input: {}, actor: publicActor }, 'getFeatured:start');
        expectInfoLog({ result: { events: [publicEvent] } }, 'getFeatured:end');
    });

    it('should return no events for disabled user', async () => {
        (EventModel.search as Mock).mockResolvedValue(allEvents);
        const result = await getFeatured({}, disabledUser);
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
        const result = await getFeatured({ limit: 1, offset: 1 }, admin);
        expect(EventModel.search).toHaveBeenCalledWith(
            expect.objectContaining({ limit: 1, offset: 1 })
        );
        expect(result.events).toHaveLength(3); // Filtering is after model
    });

    it('should return empty if no events found', async () => {
        (EventModel.search as Mock).mockResolvedValue([]);
        const result = await getFeatured({}, admin);
        expect(result.events).toEqual([]);
        expectInfoLog({ result: { events: [] } }, 'getFeatured:end');
    });

    it('should return empty if all events filtered by permissions', async () => {
        vi.spyOn(permissionManager, 'hasPermission').mockReturnValue(false);
        (EventModel.search as Mock).mockResolvedValue([privateEvent]);
        const result = await getFeatured({}, userNoPerm);
        expect(result.events).toEqual([]);
        expectInfoLog({ result: { events: [] } }, 'getFeatured:end');
    });
});
