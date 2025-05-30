import { LifecycleStatusEnum } from '@repo/types';
import type { AttractionId, DestinationId, UserId } from '@repo/types/common/id.types';
import type {
    AttractionType,
    NewAttractionInputType,
    UpdateAttractionInputType
} from '@repo/types/entities/destination/destination.attraction.types';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../../../../src/client';
import { AttractionModel } from '../../../../src/models/destination/attraction.model';
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
        attractions: {
            findFirst: vi.fn()
        }
    }
};

(getDb as unknown as Mock).mockReturnValue(mockDb);

const baseAttraction: AttractionType = {
    id: 'attr-uuid' as AttractionId,
    slug: 'parque-urquiza',
    name: 'Parque Urquiza',
    description: 'Un parque emblemático',
    icon: '🌳',
    isBuiltin: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    createdById: 'user-uuid' as UserId,
    updatedById: 'user-uuid' as UserId,
    adminInfo: undefined
    // otros campos opcionales omitidos
};

describe('AttractionModel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getById', () => {
        it('returns attraction if found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([{ ...baseAttraction }]);
            const attr = await AttractionModel.getById('attr-uuid');
            expect(attr).toEqual(baseAttraction);
        });
        it('returns undefined if not found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([]);
            const attr = await AttractionModel.getById('not-exist');
            expect(attr).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AttractionModel.getById('err')).rejects.toThrow(
                'Failed to get attraction by id: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByName', () => {
        it('returns attraction if found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([{ ...baseAttraction }]);
            const attr = await AttractionModel.getByName('Parque Urquiza');
            expect(attr).toEqual(baseAttraction);
        });
        it('returns undefined if not found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([]);
            const attr = await AttractionModel.getByName('not-exist');
            expect(attr).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AttractionModel.getByName('err')).rejects.toThrow(
                'Failed to get attraction by name: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getBySlug', () => {
        it('returns attraction if found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([{ ...baseAttraction }]);
            const attr = await AttractionModel.getBySlug('parque-urquiza');
            expect(attr).toEqual(baseAttraction);
        });
        it('returns undefined if not found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([]);
            const attr = await AttractionModel.getBySlug('not-exist');
            expect(attr).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AttractionModel.getBySlug('err')).rejects.toThrow(
                'Failed to get attraction by slug: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByType', () => {
        it('returns attractions by isBuiltin', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([{ ...baseAttraction }]);
            const attrs = await AttractionModel.getByType(false);
            expect(attrs).toEqual([baseAttraction]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([]);
            const attrs = await AttractionModel.getByType(true);
            expect(attrs).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AttractionModel.getByType(true)).rejects.toThrow(
                'Failed to get attractions by type: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('create', () => {
        it('returns created attraction', async () => {
            mockDb.insert.mockReturnThis();
            mockDb.values.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ ...baseAttraction }]);
            const input: NewAttractionInputType = {
                slug: baseAttraction.slug,
                name: baseAttraction.name,
                description: baseAttraction.description,
                icon: baseAttraction.icon,
                isBuiltin: baseAttraction.isBuiltin,
                lifecycleState: baseAttraction.lifecycleState,
                adminInfo: baseAttraction.adminInfo
            };
            const attr = await AttractionModel.create(input);
            expect(attr).toEqual(baseAttraction);
        });
        it('throws if insert fails', async () => {
            mockDb.insert.mockReturnThis();
            mockDb.values.mockReturnThis();
            mockDb.returning.mockReturnValueOnce(undefined);
            await expect(
                AttractionModel.create({
                    slug: baseAttraction.slug,
                    name: baseAttraction.name,
                    description: baseAttraction.description,
                    icon: baseAttraction.icon,
                    isBuiltin: baseAttraction.isBuiltin,
                    lifecycleState: baseAttraction.lifecycleState,
                    adminInfo: baseAttraction.adminInfo
                })
            ).rejects.toThrow('Insert failed');
        });
        it('logs and throws on db error', async () => {
            mockDb.insert.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(
                AttractionModel.create({
                    slug: baseAttraction.slug,
                    name: baseAttraction.name,
                    description: baseAttraction.description,
                    icon: baseAttraction.icon,
                    isBuiltin: baseAttraction.isBuiltin,
                    lifecycleState: baseAttraction.lifecycleState,
                    adminInfo: baseAttraction.adminInfo
                })
            ).rejects.toThrow('Failed to create attraction: fail');
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('update', () => {
        it('returns updated attraction', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ ...baseAttraction }]);
            const input: UpdateAttractionInputType = { description: 'Updated' };
            const attr = await AttractionModel.update('attr-uuid', input);
            expect(attr).toEqual(baseAttraction);
        });
        it('returns undefined if not found', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const attr = await AttractionModel.update('not-exist', { description: 'Updated' });
            expect(attr).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.update.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AttractionModel.update('err', { description: 'fail' })).rejects.toThrow(
                'Failed to update attraction: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('delete', () => {
        it('returns id if deleted', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ id: 'attr-uuid' }]);
            const result = await AttractionModel.delete('attr-uuid', 'user-uuid');
            expect(result).toEqual({ id: 'attr-uuid' });
        });
        it('returns undefined if not found', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const result = await AttractionModel.delete('not-exist', 'user-uuid');
            expect(result).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.update.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AttractionModel.delete('err', 'user-uuid')).rejects.toThrow(
                'Failed to delete attraction: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('hardDelete', () => {
        it('returns true if deleted', async () => {
            mockDb.delete.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{}]);
            const result = await AttractionModel.hardDelete('attr-uuid');
            expect(result).toBe(true);
        });
        it('returns false if not found', async () => {
            mockDb.delete.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const result = await AttractionModel.hardDelete('not-exist');
            expect(result).toBe(false);
        });
        it('logs and throws on db error', async () => {
            mockDb.delete.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AttractionModel.hardDelete('err')).rejects.toThrow(
                'Failed to hard delete attraction: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('list', () => {
        it('returns attractions with pagination', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([{ ...baseAttraction }]);
            const attrs = await AttractionModel.list({ limit: 10, offset: 0 });
            expect(attrs).toEqual([baseAttraction]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([]);
            const attrs = await AttractionModel.list({ limit: 10, offset: 0 });
            expect(attrs).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AttractionModel.list({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to list attractions: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('search', () => {
        it('returns attractions matching search', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([{ ...baseAttraction }]);
            const attrs = await AttractionModel.search({ limit: 10, offset: 0 });
            expect(attrs).toEqual([baseAttraction]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([]);
            const attrs = await AttractionModel.search({ limit: 10, offset: 0 });
            expect(attrs).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AttractionModel.search({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to search attractions: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('count', () => {
        it('returns count of attractions', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnValue({
                where: () => [{ count: 5 }]
            });
            const count = await AttractionModel.count({ limit: 10, offset: 0 });
            expect(count).toBe(5);
        });
        it('returns 0 if no attractions', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnValue({
                where: () => []
            });
            const count = await AttractionModel.count({ limit: 10, offset: 0 });
            expect(count).toBe(0);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AttractionModel.count({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to count attractions: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getWithRelations', () => {
        it('returns attraction with relations', async () => {
            mockDb.query.attractions.findFirst.mockResolvedValueOnce({
                ...baseAttraction,
                destinations: [
                    {
                        destinationId: 'dest-uuid' as DestinationId,
                        attractionId: 'attr-uuid' as AttractionId
                    }
                ]
            });
            const attr = await AttractionModel.getWithRelations('attr-uuid', {
                destinations: true
            });
            expect(attr).toHaveProperty('destinations');
        });
        it('returns undefined if not found', async () => {
            mockDb.query.attractions.findFirst.mockResolvedValueOnce(undefined);
            const attr = await AttractionModel.getWithRelations('not-exist', {
                destinations: true
            });
            expect(attr).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.query.attractions.findFirst.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(
                AttractionModel.getWithRelations('err', { destinations: true })
            ).rejects.toThrow('Failed to get attraction with relations: fail');
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByDestination', () => {
        beforeEach(() => {
            mockDb.innerJoin.mockReset();
        });
        it('returns attractions for given destination', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.innerJoin.mockReturnValueOnce([
                { attractions: { ...baseAttraction }, rDestinationAttraction: {} }
            ]);
            const attrs = await AttractionModel.getByDestination('dest-uuid');
            expect(attrs).toEqual([baseAttraction]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.innerJoin.mockReturnValueOnce([]);
            const attrs = await AttractionModel.getByDestination('not-exist');
            expect(attrs).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AttractionModel.getByDestination('err')).rejects.toThrow(
                'Failed to get attractions by destination: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });
});
