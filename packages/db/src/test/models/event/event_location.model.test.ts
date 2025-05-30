import { LifecycleStatusEnum } from '@repo/types';
import type { EventLocationId, UserId } from '@repo/types/common/id.types';
import type {
    EventLocationType,
    NewEventLocationInputType,
    UpdateEventLocationInputType
} from '@repo/types/entities/event/event.location.types';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../../../../src/client';
import { EventLocationModel } from '../../../../src/models/event/event_location.model';
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
        eventLocations: {
            findFirst: vi.fn()
        }
    }
};
(getDb as unknown as Mock).mockReturnValue(mockDb);

const baseLocation: EventLocationType = {
    id: 'location-uuid' as EventLocationId,
    street: 'Calle Falsa',
    number: '123',
    floor: '1',
    apartment: 'A',
    neighborhood: 'Centro',
    city: 'Ciudad',
    department: 'Depto',
    placeName: 'Salón',
    state: 'Entre Ríos',
    zipCode: '3200',
    country: 'AR',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: undefined,
    createdById: 'user-uuid' as UserId,
    updatedById: 'user-uuid' as UserId,
    deletedById: undefined,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    adminInfo: undefined
};

describe('EventLocationModel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getById', () => {
        it('returns location if found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([{ ...baseLocation }]);
            const loc = await EventLocationModel.getById('location-uuid');
            expect(loc).toEqual(baseLocation);
        });
        it('returns undefined if not found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([]);
            const loc = await EventLocationModel.getById('not-exist');
            expect(loc).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(EventLocationModel.getById('err')).rejects.toThrow(
                'Failed to get event location by id: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByCity', () => {
        it('returns locations by city', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([{ ...baseLocation }]);
            const locs = await EventLocationModel.getByCity('Ciudad');
            expect(locs).toEqual([baseLocation]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([]);
            const locs = await EventLocationModel.getByCity('Nope');
            expect(locs).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(EventLocationModel.getByCity('err')).rejects.toThrow(
                'Failed to get event locations by city: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByPlaceName', () => {
        it('returns locations by place name', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([{ ...baseLocation }]);
            const locs = await EventLocationModel.getByPlaceName('Salón');
            expect(locs).toEqual([baseLocation]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([]);
            const locs = await EventLocationModel.getByPlaceName('Nope');
            expect(locs).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(EventLocationModel.getByPlaceName('err')).rejects.toThrow(
                'Failed to get event locations by place name: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('create', () => {
        it('returns created location', async () => {
            mockDb.insert.mockReturnThis();
            mockDb.values.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ ...baseLocation }]);
            const input: NewEventLocationInputType = {
                street: baseLocation.street,
                number: baseLocation.number,
                floor: baseLocation.floor,
                apartment: baseLocation.apartment,
                neighborhood: baseLocation.neighborhood,
                city: baseLocation.city,
                department: baseLocation.department,
                placeName: baseLocation.placeName,
                state: baseLocation.state,
                zipCode: baseLocation.zipCode,
                country: baseLocation.country,
                adminInfo: baseLocation.adminInfo,
                lifecycleState: baseLocation.lifecycleState
            };
            const loc = await EventLocationModel.create(input);
            expect(loc).toEqual(baseLocation);
        });
        it('throws if insert fails', async () => {
            mockDb.insert.mockReturnThis();
            mockDb.values.mockReturnThis();
            mockDb.returning.mockReturnValueOnce(undefined);
            const input: NewEventLocationInputType = {
                street: baseLocation.street,
                number: baseLocation.number,
                floor: baseLocation.floor,
                apartment: baseLocation.apartment,
                neighborhood: baseLocation.neighborhood,
                city: baseLocation.city,
                department: baseLocation.department,
                placeName: baseLocation.placeName,
                state: baseLocation.state,
                zipCode: baseLocation.zipCode,
                country: baseLocation.country,
                adminInfo: baseLocation.adminInfo,
                lifecycleState: baseLocation.lifecycleState
            };
            await expect(EventLocationModel.create(input)).rejects.toThrow('Insert failed');
        });
        it('logs and throws on db error', async () => {
            mockDb.insert.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            const input: NewEventLocationInputType = {
                street: baseLocation.street,
                number: baseLocation.number,
                floor: baseLocation.floor,
                apartment: baseLocation.apartment,
                neighborhood: baseLocation.neighborhood,
                city: baseLocation.city,
                department: baseLocation.department,
                placeName: baseLocation.placeName,
                state: baseLocation.state,
                zipCode: baseLocation.zipCode,
                country: baseLocation.country,
                adminInfo: baseLocation.adminInfo,
                lifecycleState: baseLocation.lifecycleState
            };
            await expect(EventLocationModel.create(input)).rejects.toThrow(
                'Failed to create event location: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('update', () => {
        it('returns updated location', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ ...baseLocation, street: 'Nueva' }]);
            const input: UpdateEventLocationInputType = { street: 'Nueva' };
            const loc = await EventLocationModel.update('location-uuid', input);
            expect(loc).toEqual({ ...baseLocation, street: 'Nueva' });
        });
        it('returns undefined if not found', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const input: UpdateEventLocationInputType = { street: 'Nueva' };
            const loc = await EventLocationModel.update('not-exist', input);
            expect(loc).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.update.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            const input: UpdateEventLocationInputType = { street: 'Nueva' };
            await expect(EventLocationModel.update('err', input)).rejects.toThrow(
                'Failed to update event location: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('delete', () => {
        it('returns deleted id', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ id: 'location-uuid' }]);
            const res = await EventLocationModel.delete('location-uuid', 'user-uuid');
            expect(res).toEqual({ id: 'location-uuid' });
        });
        it('returns undefined if not found', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const res = await EventLocationModel.delete('not-exist', 'user-uuid');
            expect(res).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.update.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(EventLocationModel.delete('err', 'user-uuid')).rejects.toThrow(
                'Failed to delete event location: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('hardDelete', () => {
        it('returns true if deleted', async () => {
            mockDb.delete.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{}]);
            const res = await EventLocationModel.hardDelete('location-uuid');
            expect(res).toBe(true);
        });
        it('returns false if not found', async () => {
            mockDb.delete.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const res = await EventLocationModel.hardDelete('not-exist');
            expect(res).toBe(false);
        });
        it('logs and throws on db error', async () => {
            mockDb.delete.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(EventLocationModel.hardDelete('err')).rejects.toThrow(
                'Failed to hard delete event location: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('list', () => {
        it('returns paginated locations', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([{ ...baseLocation }]);
            const res = await EventLocationModel.list({ limit: 10, offset: 0 });
            expect(res).toEqual([baseLocation]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([]);
            const res = await EventLocationModel.list({ limit: 10, offset: 0 });
            expect(res).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(EventLocationModel.list({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to list event locations: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('search', () => {
        it('returns found locations', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([{ ...baseLocation }]);
            const res = await EventLocationModel.search({ limit: 10, offset: 0 });
            expect(res).toEqual([baseLocation]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([]);
            const res = await EventLocationModel.search({ limit: 10, offset: 0 });
            expect(res).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(EventLocationModel.search({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to search event locations: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('count', () => {
        it('returns count', async () => {
            const whereMock = vi.fn().mockReturnValueOnce([{ count: 5 }]);
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnValue({ where: whereMock });
            const res = await EventLocationModel.count({ limit: 10, offset: 0 });
            expect(res).toBe(5);
        });
        it('returns 0 if not found', async () => {
            const whereMock = vi.fn().mockReturnValueOnce([{}]);
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnValue({ where: whereMock });
            const res = await EventLocationModel.count({ limit: 10, offset: 0 });
            expect(res).toBe(0);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(EventLocationModel.count({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to count event locations: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getWithRelations', () => {
        it('returns location with events relation', async () => {
            mockDb.query.eventLocations.findFirst.mockResolvedValueOnce({
                ...baseLocation,
                events: []
            });
            const res = await EventLocationModel.getWithRelations('location-uuid', {
                events: true
            });
            expect(res).toEqual({ ...baseLocation, events: [] });
        });
        it('returns undefined if not found', async () => {
            mockDb.query.eventLocations.findFirst.mockResolvedValueOnce(undefined);
            const res = await EventLocationModel.getWithRelations('not-exist', { events: true });
            expect(res).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.query.eventLocations.findFirst.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(
                EventLocationModel.getWithRelations('err', { events: true })
            ).rejects.toThrow('Failed to get event location with relations: fail');
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByEvent', () => {
        it('returns locations by event', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.innerJoin.mockReturnValueOnce([{ eventLocations: { ...baseLocation } }]);
            const res = await EventLocationModel.getByEvent('event-uuid');
            expect(res).toEqual([{ ...baseLocation }]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.innerJoin.mockReturnValueOnce([]);
            const res = await EventLocationModel.getByEvent('not-exist');
            expect(res).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(EventLocationModel.getByEvent('err')).rejects.toThrow(
                'Failed to get event locations by event: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });
});
