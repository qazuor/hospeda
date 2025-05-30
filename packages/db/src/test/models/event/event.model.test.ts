import {
    EventCategoryEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    VisibilityEnum
} from '@repo/types';
import type { EventId, UserId } from '@repo/types/common/id.types';
import type {
    EventType,
    NewEventInputType,
    UpdateEventInputType
} from '@repo/types/entities/event/event.types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../../../../src/client';
import { EventModel } from '../../../../src/models/event/event.model';
import { dbLogger } from '../../../../src/utils/logger';

vi.mock('../../../../src/utils/logger');
vi.mock('../../../../src/client');

const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    query: {
        events: {
            findFirst: vi.fn()
        }
    }
};

(getDb as unknown as Mock).mockReturnValue(mockDb);

const baseEvent: EventType = {
    id: 'event-uuid' as EventId,
    slug: 'fiesta-nacional',
    summary: 'Fiesta Nacional',
    description: 'Una fiesta popular',
    media: undefined,
    category: EventCategoryEnum.FESTIVAL,
    date: { start: new Date(), end: new Date() },
    authorId: 'user-uuid' as UserId,
    locationId: undefined,
    organizerId: undefined,
    pricing: undefined,
    contact: undefined,
    visibility: VisibilityEnum.PUBLIC,
    isFeatured: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    moderationState: ModerationStatusEnum.PENDING_REVIEW,
    createdById: 'user-uuid' as UserId,
    updatedById: 'user-uuid' as UserId,
    deletedAt: undefined,
    deletedById: undefined,
    adminInfo: undefined,
    tags: [],
    seo: undefined
};

describe('EventModel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getById', () => {
        it('returns event if found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([{ ...baseEvent }]);
            const event = await EventModel.getById('event-uuid');
            expect(event).toEqual(baseEvent);
        });
        it('returns undefined if not found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([]);
            const event = await EventModel.getById('not-exist');
            expect(event).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(EventModel.getById('err')).rejects.toThrow(
                'Failed to get event by id: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getBySlug', () => {
        it('returns event if found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([{ ...baseEvent }]);
            const event = await EventModel.getBySlug('fiesta-nacional');
            expect(event).toEqual(baseEvent);
        });
        it('returns undefined if not found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([]);
            const event = await EventModel.getBySlug('not-exist');
            expect(event).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(EventModel.getBySlug('err')).rejects.toThrow(
                'Failed to get event by slug: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByCategory', () => {
        it('returns events by category', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([{ ...baseEvent }]);
            const events = await EventModel.getByCategory(EventCategoryEnum.FESTIVAL);
            expect(events).toEqual([baseEvent]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([]);
            const events = await EventModel.getByCategory(EventCategoryEnum.MUSIC);
            expect(events).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(EventModel.getByCategory(EventCategoryEnum.MUSIC)).rejects.toThrow(
                'Failed to get events by category: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('create', () => {
        it('returns created event', async () => {
            mockDb.insert.mockReturnThis();
            mockDb.values.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ ...baseEvent }]);
            const input: NewEventInputType = {
                ...baseEvent,
                id: undefined,
                createdAt: undefined,
                updatedAt: undefined,
                createdById: undefined,
                updatedById: undefined
            };
            const event = await EventModel.create(input);
            expect(event).toEqual(baseEvent);
        });
        it('throws if insert fails', async () => {
            mockDb.insert.mockReturnThis();
            mockDb.values.mockReturnThis();
            mockDb.returning.mockReturnValueOnce(undefined);
            await expect(
                EventModel.create({
                    ...baseEvent,
                    id: undefined,
                    createdAt: undefined,
                    updatedAt: undefined,
                    createdById: undefined,
                    updatedById: undefined
                })
            ).rejects.toThrow('Insert failed');
        });
        it('logs and throws on db error', async () => {
            mockDb.insert.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(
                EventModel.create({
                    ...baseEvent,
                    id: undefined,
                    createdAt: undefined,
                    updatedAt: undefined,
                    createdById: undefined,
                    updatedById: undefined
                })
            ).rejects.toThrow('Failed to create event: fail');
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('update', () => {
        it('returns updated event', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ ...baseEvent }]);
            const input: UpdateEventInputType = { summary: 'Updated' };
            const event = await EventModel.update('event-uuid', input);
            expect(event).toEqual(baseEvent);
        });
        it('returns undefined if not found', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const event = await EventModel.update('not-exist', { summary: 'Updated' });
            expect(event).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.update.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(EventModel.update('err', { summary: 'fail' })).rejects.toThrow(
                'Failed to update event: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('delete', () => {
        it('returns id if deleted', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ id: 'event-uuid' }]);
            const result = await EventModel.delete('event-uuid', 'user-uuid');
            expect(result).toEqual({ id: 'event-uuid' });
        });
        it('returns undefined if not found', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const result = await EventModel.delete('not-exist', 'user-uuid');
            expect(result).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.update.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(EventModel.delete('err', 'user-uuid')).rejects.toThrow(
                'Failed to delete event: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('hardDelete', () => {
        it('returns true if deleted', async () => {
            mockDb.delete.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{}]);
            const result = await EventModel.hardDelete('event-uuid');
            expect(result).toBe(true);
        });
        it('returns false if not found', async () => {
            mockDb.delete.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const result = await EventModel.hardDelete('not-exist');
            expect(result).toBe(false);
        });
        it('logs and throws on db error', async () => {
            mockDb.delete.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(EventModel.hardDelete('err')).rejects.toThrow(
                'Failed to hard delete event: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('list', () => {
        it('returns events with pagination', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([{ ...baseEvent }]);
            const events = await EventModel.list({ limit: 10, offset: 0 });
            expect(events).toEqual([baseEvent]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([]);
            const events = await EventModel.list({ limit: 10, offset: 0 });
            expect(events).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(EventModel.list({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to list events: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('search', () => {
        it('returns events matching search', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([{ ...baseEvent }]);
            const events = await EventModel.search({ limit: 10, offset: 0 });
            expect(events).toEqual([baseEvent]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([]);
            const events = await EventModel.search({ limit: 10, offset: 0 });
            expect(events).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(EventModel.search({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to search events: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('count', () => {
        it('returns count of events', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnValue({
                where: () => [{ count: 5 }]
            });
            const count = await EventModel.count({ limit: 10, offset: 0 });
            expect(count).toBe(5);
        });
        it('returns 0 if no events', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnValue({
                where: () => []
            });
            const count = await EventModel.count({ limit: 10, offset: 0 });
            expect(count).toBe(0);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(EventModel.count({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to count events: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getWithRelations', () => {
        it('returns event with relations', async () => {
            mockDb.query.events.findFirst.mockResolvedValueOnce({
                ...baseEvent,
                tags: [
                    {
                        id: 'tag-uuid',
                        name: 'Tag',
                        color: 'green',
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        lifecycleState: LifecycleStatusEnum.ACTIVE
                    }
                ],
                organizer: {
                    id: 'org-uuid',
                    name: 'Org',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    lifecycleState: LifecycleStatusEnum.ACTIVE,
                    adminInfo: undefined
                },
                location: {
                    id: 'loc-uuid',
                    city: 'Ciudad',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    lifecycleState: LifecycleStatusEnum.ACTIVE,
                    adminInfo: undefined
                }
            });
            const event = await EventModel.getWithRelations('event-uuid', {
                tags: true,
                organizer: true,
                location: true
            });
            expect(event).toHaveProperty('tags');
            expect(event).toHaveProperty('organizer');
            expect(event).toHaveProperty('location');
        });
        it('returns undefined if not found', async () => {
            mockDb.query.events.findFirst.mockResolvedValueOnce(undefined);
            const event = await EventModel.getWithRelations('not-exist', {
                tags: true
            });
            expect(event).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.query.events.findFirst.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(EventModel.getWithRelations('err', { tags: true })).rejects.toThrow(
                'Failed to get event with relations: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByTag', () => {
        beforeEach(() => {
            mockDb.innerJoin.mockReset();
        });
        it('returns events for given tag', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.innerJoin.mockReturnValueOnce([{ events: { ...baseEvent }, rEntityTag: {} }]);
            const events = await EventModel.getByTag('tag-uuid');
            expect(events).toEqual([baseEvent]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.innerJoin.mockReturnValueOnce([]);
            const events = await EventModel.getByTag('not-exist');
            expect(events).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(EventModel.getByTag('err')).rejects.toThrow(
                'Failed to get events by tag: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByOrganizer', () => {
        beforeEach(() => {
            mockDb.where.mockReset();
        });
        it('returns events for given organizer', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([baseEvent]);
            const events = await EventModel.getByOrganizer('org-uuid');
            expect(events).toEqual([baseEvent]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([]);
            const events = await EventModel.getByOrganizer('not-exist');
            expect(events).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(EventModel.getByOrganizer('err')).rejects.toThrow(
                'Failed to get events by organizer: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByDestination', () => {
        beforeEach(() => {
            mockDb.innerJoin.mockReset();
        });
        it('returns events for given destination', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.innerJoin.mockReturnValueOnce([
                { events: { ...baseEvent }, eventLocations: {} }
            ]);
            const events = await EventModel.getByDestination('Ciudad');
            expect(events).toEqual([baseEvent]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.innerJoin.mockReturnValueOnce([]);
            const events = await EventModel.getByDestination('not-exist');
            expect(events).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(EventModel.getByDestination('err')).rejects.toThrow(
                'Failed to get events by destination: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });
});
