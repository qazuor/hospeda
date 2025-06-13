import { EventModel } from '@repo/db';
import {
    type EventType,
    LifecycleStatusEnum,
    PermissionEnum,
    RoleEnum,
    VisibilityEnum
} from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventService } from '../../event/event.service';
import { getMockEventLocationId } from '../factories';
import { getMockEvent, getMockEventId } from '../factories/eventFactory';
import { getMockPublicUser, getMockUser } from '../factories/userFactory';

const locationId = getMockEventLocationId();
const publicEvent = getMockEvent({
    id: getMockEventId('event-public'),
    slug: 'public-event',
    locationId,
    visibility: VisibilityEnum.PUBLIC,
    lifecycleState: LifecycleStatusEnum.ACTIVE
});
const privateEvent = getMockEvent({
    id: getMockEventId('event-private'),
    slug: 'private-event',
    locationId,
    visibility: VisibilityEnum.PRIVATE,
    lifecycleState: LifecycleStatusEnum.ACTIVE
});
const archivedEvent = getMockEvent({
    id: getMockEventId('event-archived'),
    slug: 'archived-event',
    locationId,
    visibility: VisibilityEnum.PUBLIC,
    lifecycleState: LifecycleStatusEnum.ARCHIVED
});

const admin = {
    ...getMockUser({ role: RoleEnum.ADMIN }),
    permissions: [PermissionEnum.EVENT_VIEW_PRIVATE]
};
const superAdmin = {
    ...getMockUser({ role: RoleEnum.SUPER_ADMIN }),
    permissions: [PermissionEnum.EVENT_VIEW_PRIVATE]
};
const userWithPerm = {
    ...getMockUser({ role: RoleEnum.USER }),
    permissions: [PermissionEnum.EVENT_VIEW_PRIVATE]
};
const userNoPerm = { ...getMockUser({ role: RoleEnum.USER }), permissions: [] };
const disabledUser = {
    ...getMockUser({ lifecycleState: LifecycleStatusEnum.INACTIVE }),
    permissions: []
};
const publicActor = getMockPublicUser();

const allEvents: EventType[] = [publicEvent, privateEvent, archivedEvent];

vi.spyOn(mockServiceLogger, 'info').mockImplementation(() => {});
vi.spyOn(mockServiceLogger, 'warn').mockImplementation(() => {});
vi.spyOn(mockServiceLogger, 'error').mockImplementation(() => {});

describe('event.service.getByLocationId', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('should allow admin to see all events for the location', async () => {
        vi.spyOn(EventModel, 'search').mockResolvedValue(allEvents);
        const { events } = await EventService.getByLocationId({ locationId }, admin);
        expect(events).toHaveLength(3);
        expect(events).toContainEqual(publicEvent);
        expect(events).toContainEqual(privateEvent);
        expect(events).toContainEqual(archivedEvent);
    });

    it('should allow superadmin to see all events for the location', async () => {
        vi.spyOn(EventModel, 'search').mockResolvedValue(allEvents);
        const { events } = await EventService.getByLocationId({ locationId }, superAdmin);
        expect(events).toHaveLength(3);
    });

    it('should allow user with permission to see public and private events', async () => {
        vi.spyOn(EventModel, 'search').mockResolvedValue(allEvents);
        const { events } = await EventService.getByLocationId({ locationId }, userWithPerm);
        expect(events).toHaveLength(2);
        expect(events).toContainEqual(publicEvent);
        expect(events).toContainEqual(privateEvent);
        for (const e of events) {
            expect(e.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
        }
    });

    it('should allow user without permission to see only public active events', async () => {
        vi.spyOn(EventModel, 'search').mockResolvedValue(allEvents);
        const { events } = await EventService.getByLocationId({ locationId }, userNoPerm);
        expect(events).toHaveLength(1);
        if (events.length === 1) {
            expect(events[0]).toBeDefined();
            expect(events[0]?.visibility).toBe(VisibilityEnum.PUBLIC);
            expect(events[0]?.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
        }
    });

    it('should not allow disabled user to see any event', async () => {
        vi.spyOn(EventModel, 'search').mockResolvedValue(allEvents);
        const { events } = await EventService.getByLocationId({ locationId }, disabledUser);
        expect(events).toEqual([]);
    });

    it('should allow public actor to see only public active events', async () => {
        vi.spyOn(EventModel, 'search').mockResolvedValue(allEvents);
        const { events } = await EventService.getByLocationId({ locationId }, publicActor);
        expect(events).toHaveLength(1);
        if (events.length === 1) {
            expect(events[0]).toBeDefined();
            expect(events[0]?.visibility).toBe(VisibilityEnum.PUBLIC);
            expect(events[0]?.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
        }
    });

    it('should return empty array if no events for location', async () => {
        vi.spyOn(EventModel, 'search').mockResolvedValue([]);
        const { events } = await EventService.getByLocationId({ locationId }, admin);
        expect(events).toEqual([]);
    });

    it('should throw on invalid input', async () => {
        await expect(EventService.getByLocationId({ locationId: '' }, admin)).rejects.toThrow();
    });
});
