import {
    type EventType,
    LifecycleStatusEnum,
    PermissionEnum,
    RoleEnum,
    VisibilityEnum
} from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventModel } from '../../../models/event/event.model';
import { getByLocationId } from '../../../services/event/event.service';
import { dbLogger } from '../../../utils/logger';
import { getMockEvent, getMockPublicUser, getMockUser } from '../../mockData';

import type { EventId, EventLocationId } from '@repo/types';

const locationId = 'loc-1' as EventLocationId;
const publicEvent = getMockEvent({
    id: 'event-public' as EventId,
    slug: 'public-event',
    locationId,
    visibility: VisibilityEnum.PUBLIC,
    lifecycleState: LifecycleStatusEnum.ACTIVE
});
const privateEvent = getMockEvent({
    id: 'event-private' as EventId,
    slug: 'private-event',
    locationId,
    visibility: VisibilityEnum.PRIVATE,
    lifecycleState: LifecycleStatusEnum.ACTIVE
});
const archivedEvent = getMockEvent({
    id: 'event-archived' as EventId,
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

vi.spyOn(dbLogger, 'info').mockImplementation(() => {});
vi.spyOn(dbLogger, 'warn').mockImplementation(() => {});
vi.spyOn(dbLogger, 'error').mockImplementation(() => {});

describe('event.service.getByLocationId', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('should allow admin to see all events for the location', async () => {
        vi.spyOn(EventModel, 'search').mockResolvedValue(allEvents);
        const { events } = await getByLocationId({ locationId }, admin);
        expect(events).toHaveLength(3);
        expect(events).toContainEqual(publicEvent);
        expect(events).toContainEqual(privateEvent);
        expect(events).toContainEqual(archivedEvent);
    });

    it('should allow superadmin to see all events for the location', async () => {
        vi.spyOn(EventModel, 'search').mockResolvedValue(allEvents);
        const { events } = await getByLocationId({ locationId }, superAdmin);
        expect(events).toHaveLength(3);
    });

    it('should allow user with permission to see public and private events', async () => {
        vi.spyOn(EventModel, 'search').mockResolvedValue(allEvents);
        const { events } = await getByLocationId({ locationId }, userWithPerm);
        expect(events).toHaveLength(2);
        expect(events).toContainEqual(publicEvent);
        expect(events).toContainEqual(privateEvent);
        for (const e of events) {
            expect(e.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
        }
    });

    it('should allow user without permission to see only public active events', async () => {
        vi.spyOn(EventModel, 'search').mockResolvedValue(allEvents);
        const { events } = await getByLocationId({ locationId }, userNoPerm);
        expect(events).toHaveLength(1);
        if (events.length === 1) {
            expect(events[0]).toBeDefined();
            expect(events[0]?.visibility).toBe(VisibilityEnum.PUBLIC);
            expect(events[0]?.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
        }
    });

    it('should not allow disabled user to see any event', async () => {
        vi.spyOn(EventModel, 'search').mockResolvedValue(allEvents);
        const { events } = await getByLocationId({ locationId }, disabledUser);
        expect(events).toEqual([]);
    });

    it('should allow public actor to see only public active events', async () => {
        vi.spyOn(EventModel, 'search').mockResolvedValue(allEvents);
        const { events } = await getByLocationId({ locationId }, publicActor);
        expect(events).toHaveLength(1);
        if (events.length === 1) {
            expect(events[0]).toBeDefined();
            expect(events[0]?.visibility).toBe(VisibilityEnum.PUBLIC);
            expect(events[0]?.lifecycleState).toBe(LifecycleStatusEnum.ACTIVE);
        }
    });

    it('should return empty array if no events for location', async () => {
        vi.spyOn(EventModel, 'search').mockResolvedValue([]);
        const { events } = await getByLocationId({ locationId }, admin);
        expect(events).toEqual([]);
    });

    it('should throw on invalid input', async () => {
        await expect(getByLocationId({ locationId: '' }, admin)).rejects.toThrow();
    });
});
