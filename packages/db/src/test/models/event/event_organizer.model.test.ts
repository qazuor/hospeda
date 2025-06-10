import type {
    EventOrganizerId,
    EventOrganizerType,
    NewEventOrganizerInputType,
    UpdateEventOrganizerInputType,
    UserId
} from '@repo/types';
import { LifecycleStatusEnum } from '@repo/types';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../../../../src/client';
import { EventOrganizerModel } from '../../../../src/models/event/event_organizer.model';
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
        eventOrganizers: {
            findFirst: vi.fn()
        }
    }
};
(getDb as unknown as Mock).mockReturnValue(mockDb);

const baseOrganizer: EventOrganizerType = {
    id: 'organizer-uuid' as EventOrganizerId,
    name: 'Organizador X',
    logo: 'logo.png',
    contactInfo: undefined,
    social: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: undefined,
    createdById: 'user-uuid' as UserId,
    updatedById: 'user-uuid' as UserId,
    deletedById: undefined,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    adminInfo: undefined
};

describe('EventOrganizerModel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getById', () => {
        it('returns organizer if found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([{ ...baseOrganizer }]);
            const org = await EventOrganizerModel.getById('organizer-uuid');
            expect(org).toEqual(baseOrganizer);
        });
        it('returns undefined if not found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([]);
            const org = await EventOrganizerModel.getById('not-exist');
            expect(org).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(EventOrganizerModel.getById('err')).rejects.toThrow(
                'Failed to get event organizer by id: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByName', () => {
        it('returns organizers by name', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([{ ...baseOrganizer }]);
            const orgs = await EventOrganizerModel.getByName('Organizador X');
            expect(orgs).toEqual([baseOrganizer]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([]);
            const orgs = await EventOrganizerModel.getByName('Nope');
            expect(orgs).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(EventOrganizerModel.getByName('err')).rejects.toThrow(
                'Failed to get event organizers by name: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('create', () => {
        it('returns created organizer', async () => {
            mockDb.insert.mockReturnThis();
            mockDb.values.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ ...baseOrganizer }]);
            const input: NewEventOrganizerInputType = {
                name: baseOrganizer.name,
                logo: baseOrganizer.logo,
                contactInfo: baseOrganizer.contactInfo,
                social: baseOrganizer.social,
                adminInfo: baseOrganizer.adminInfo,
                lifecycleState: baseOrganizer.lifecycleState
            };
            const org = await EventOrganizerModel.create(input);
            expect(org).toEqual(baseOrganizer);
        });
        it('throws if insert fails', async () => {
            mockDb.insert.mockReturnThis();
            mockDb.values.mockReturnThis();
            mockDb.returning.mockReturnValueOnce(undefined);
            const input: NewEventOrganizerInputType = {
                name: baseOrganizer.name,
                logo: baseOrganizer.logo,
                contactInfo: baseOrganizer.contactInfo,
                social: baseOrganizer.social,
                adminInfo: baseOrganizer.adminInfo,
                lifecycleState: baseOrganizer.lifecycleState
            };
            await expect(EventOrganizerModel.create(input)).rejects.toThrow('Insert failed');
        });
        it('logs and throws on db error', async () => {
            mockDb.insert.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            const input: NewEventOrganizerInputType = {
                name: baseOrganizer.name,
                logo: baseOrganizer.logo,
                contactInfo: baseOrganizer.contactInfo,
                social: baseOrganizer.social,
                adminInfo: baseOrganizer.adminInfo,
                lifecycleState: baseOrganizer.lifecycleState
            };
            await expect(EventOrganizerModel.create(input)).rejects.toThrow(
                'Failed to create event organizer: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('update', () => {
        it('returns updated organizer', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ ...baseOrganizer, name: 'Nuevo' }]);
            const input: UpdateEventOrganizerInputType = { name: 'Nuevo' };
            const org = await EventOrganizerModel.update('organizer-uuid', input);
            expect(org).toEqual({ ...baseOrganizer, name: 'Nuevo' });
        });
        it('returns undefined if not found', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const input: UpdateEventOrganizerInputType = { name: 'Nuevo' };
            const org = await EventOrganizerModel.update('not-exist', input);
            expect(org).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.update.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            const input: UpdateEventOrganizerInputType = { name: 'Nuevo' };
            await expect(EventOrganizerModel.update('err', input)).rejects.toThrow(
                'Failed to update event organizer: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('delete', () => {
        it('returns deleted id', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ id: 'organizer-uuid' }]);
            const res = await EventOrganizerModel.delete('organizer-uuid', 'user-uuid');
            expect(res).toEqual({ id: 'organizer-uuid' });
        });
        it('returns undefined if not found', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const res = await EventOrganizerModel.delete('not-exist', 'user-uuid');
            expect(res).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.update.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(EventOrganizerModel.delete('err', 'user-uuid')).rejects.toThrow(
                'Failed to delete event organizer: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('hardDelete', () => {
        it('returns true if deleted', async () => {
            mockDb.delete.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{}]);
            const res = await EventOrganizerModel.hardDelete('organizer-uuid');
            expect(res).toBe(true);
        });
        it('returns false if not found', async () => {
            mockDb.delete.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const res = await EventOrganizerModel.hardDelete('not-exist');
            expect(res).toBe(false);
        });
        it('logs and throws on db error', async () => {
            mockDb.delete.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(EventOrganizerModel.hardDelete('err')).rejects.toThrow(
                'Failed to hard delete event organizer: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('list', () => {
        it('returns paginated organizers', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([{ ...baseOrganizer }]);
            const res = await EventOrganizerModel.list({ limit: 10, offset: 0 });
            expect(res).toEqual([baseOrganizer]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([]);
            const res = await EventOrganizerModel.list({ limit: 10, offset: 0 });
            expect(res).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(EventOrganizerModel.list({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to list event organizers: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('search', () => {
        it('returns found organizers', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([{ ...baseOrganizer }]);
            const res = await EventOrganizerModel.search({ limit: 10, offset: 0 });
            expect(res).toEqual([baseOrganizer]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([]);
            const res = await EventOrganizerModel.search({ limit: 10, offset: 0 });
            expect(res).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(EventOrganizerModel.search({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to search event organizers: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('count', () => {
        it('returns count', async () => {
            const whereMock = vi.fn().mockReturnValueOnce([{ count: 5 }]);
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnValue({ where: whereMock });
            const res = await EventOrganizerModel.count({ limit: 10, offset: 0 });
            expect(res).toBe(5);
        });
        it('returns 0 if not found', async () => {
            const whereMock = vi.fn().mockReturnValueOnce([{}]);
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnValue({ where: whereMock });
            const res = await EventOrganizerModel.count({ limit: 10, offset: 0 });
            expect(res).toBe(0);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(EventOrganizerModel.count({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to count event organizers: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getWithRelations', () => {
        it('returns organizer with events relation', async () => {
            mockDb.query.eventOrganizers.findFirst.mockResolvedValueOnce({
                ...baseOrganizer,
                events: []
            });
            const res = await EventOrganizerModel.getWithRelations('organizer-uuid', {
                events: true
            });
            expect(res).toEqual({ ...baseOrganizer, events: [] });
        });
        it('returns undefined if not found', async () => {
            mockDb.query.eventOrganizers.findFirst.mockResolvedValueOnce(undefined);
            const res = await EventOrganizerModel.getWithRelations('not-exist', { events: true });
            expect(res).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.query.eventOrganizers.findFirst.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(
                EventOrganizerModel.getWithRelations('err', { events: true })
            ).rejects.toThrow('Failed to get event organizer with relations: fail');
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByEvent', () => {
        it('returns organizers by event', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.innerJoin.mockReturnValueOnce([{ eventOrganizers: { ...baseOrganizer } }]);
            const res = await EventOrganizerModel.getByEvent('event-uuid');
            expect(res).toEqual([{ ...baseOrganizer }]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.innerJoin.mockReturnValueOnce([]);
            const res = await EventOrganizerModel.getByEvent('not-exist');
            expect(res).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(EventOrganizerModel.getByEvent('err')).rejects.toThrow(
                'Failed to get event organizers by event: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });
});
