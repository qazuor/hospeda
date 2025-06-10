import type { AccommodationId } from '@repo/types';
import { EntityTypeEnum } from '@repo/types';
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../../../../src/client';
import { EntityTagModel } from '../../../../src/models/tag/entity_tag.model';
import { dbLogger } from '../../../../src/utils/logger';
import { mockEntityTag } from '../mockData';

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
    count: vi.fn().mockReturnThis()
};
(getDb as unknown as Mock).mockReturnValue(mockDb);

describe('EntityTagModel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('getById', () => {
        it('returns the relation if it exists', async () => {
            mockDb.limit.mockResolvedValueOnce([mockEntityTag]);
            const result = await EntityTagModel.getById(
                'tag-1',
                'acc-1',
                EntityTypeEnum.ACCOMMODATION
            );
            expect(result).toEqual(mockEntityTag);
        });
        it('returns undefined if it does not exist', async () => {
            mockDb.limit.mockResolvedValueOnce([]);
            const result = await EntityTagModel.getById(
                'tag-1',
                'acc-1',
                EntityTypeEnum.ACCOMMODATION
            );
            expect(result).toBeUndefined();
        });
        it('throws and logs on error', async () => {
            mockDb.limit.mockRejectedValueOnce(new Error('fail'));
            await expect(
                EntityTagModel.getById('tag-1', 'acc-1', EntityTypeEnum.ACCOMMODATION)
            ).rejects.toThrow('Failed to get entity tag by id: fail');
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByEntity', () => {
        it('returns relations by entity', async () => {
            mockDb.where.mockResolvedValueOnce([mockEntityTag]);
            const result = await EntityTagModel.getByEntity('acc-1', EntityTypeEnum.ACCOMMODATION);
            expect(result).toEqual([mockEntityTag]);
        });
        it('returns empty array if none', async () => {
            mockDb.where.mockResolvedValueOnce([]);
            const result = await EntityTagModel.getByEntity('acc-1', EntityTypeEnum.ACCOMMODATION);
            expect(result).toEqual([]);
        });
        it('throws and logs on error', async () => {
            mockDb.where.mockRejectedValueOnce(new Error('fail'));
            await expect(
                EntityTagModel.getByEntity('acc-1', EntityTypeEnum.ACCOMMODATION)
            ).rejects.toThrow('Failed to get entity tags by entity: fail');
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByTag', () => {
        it('returns relations by tag', async () => {
            mockDb.where.mockResolvedValueOnce([mockEntityTag]);
            const result = await EntityTagModel.getByTag('tag-1');
            expect(result).toEqual([mockEntityTag]);
        });
        it('returns empty array if none', async () => {
            mockDb.where.mockResolvedValueOnce([]);
            const result = await EntityTagModel.getByTag('tag-1');
            expect(result).toEqual([]);
        });
        it('throws and logs on error', async () => {
            mockDb.where.mockRejectedValueOnce(new Error('fail'));
            await expect(EntityTagModel.getByTag('tag-1')).rejects.toThrow(
                'Failed to get entity tags by tag: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('create', () => {
        it('creates and returns the relation', async () => {
            mockDb.insert.mockReturnThis();
            mockDb.values.mockReturnThis();
            mockDb.returning.mockResolvedValueOnce([mockEntityTag]);
            const result = await EntityTagModel.create(mockEntityTag);
            expect(result).toEqual(mockEntityTag);
        });
        it('throws if insert fails', async () => {
            mockDb.insert.mockReturnThis();
            mockDb.values.mockReturnThis();
            mockDb.returning.mockResolvedValueOnce([]);
            await expect(EntityTagModel.create(mockEntityTag)).rejects.toThrow('Insert failed');
            expect(dbLogger.error).toHaveBeenCalled();
        });
        it('throws and logs on error', async () => {
            mockDb.insert.mockReturnThis();
            mockDb.values.mockReturnThis();
            mockDb.returning.mockRejectedValueOnce(new Error('fail'));
            await expect(EntityTagModel.create(mockEntityTag)).rejects.toThrow(
                'Failed to create entity tag: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('update', () => {
        it('updates and returns the relation', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockResolvedValueOnce([mockEntityTag]);
            const result = await EntityTagModel.update(
                'tag-1',
                'acc-1',
                EntityTypeEnum.ACCOMMODATION,
                { entityId: 'acc-2' as AccommodationId }
            );
            expect(result).toEqual(mockEntityTag);
        });
        it('returns undefined if it does not exist', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockResolvedValueOnce([]);
            const result = await EntityTagModel.update(
                'tag-1',
                'acc-1',
                EntityTypeEnum.ACCOMMODATION,
                { entityId: 'acc-2' as AccommodationId }
            );
            expect(result).toBeUndefined();
        });
        it('throws and logs on error', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockRejectedValueOnce(new Error('fail'));
            await expect(
                EntityTagModel.update('tag-1', 'acc-1', EntityTypeEnum.ACCOMMODATION, {
                    entityId: 'acc-2' as AccommodationId
                })
            ).rejects.toThrow('Failed to update entity tag: fail');
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('delete', () => {
        it('deletes and returns the PK', async () => {
            const deleted = {
                tagId: 'tag-1',
                entityId: 'acc-1',
                entityType: EntityTypeEnum.ACCOMMODATION
            };
            mockDb.delete.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockResolvedValueOnce([deleted]);
            const result = await EntityTagModel.delete(
                'tag-1',
                'acc-1',
                EntityTypeEnum.ACCOMMODATION
            );
            expect(result).toEqual(deleted);
        });
        it('returns undefined if it does not exist', async () => {
            mockDb.delete.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockResolvedValueOnce([]);
            const result = await EntityTagModel.delete(
                'tag-1',
                'acc-1',
                EntityTypeEnum.ACCOMMODATION
            );
            expect(result).toBeUndefined();
        });
        it('throws and logs on error', async () => {
            mockDb.delete.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockRejectedValueOnce(new Error('fail'));
            await expect(
                EntityTagModel.delete('tag-1', 'acc-1', EntityTypeEnum.ACCOMMODATION)
            ).rejects.toThrow('Failed to delete entity tag: fail');
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('list', () => {
        it('returns relations paginated', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockResolvedValueOnce([mockEntityTag]);
            const result = await EntityTagModel.list({
                limit: 10,
                offset: 0,
                order: 'asc',
                orderBy: 'tagId'
            });
            expect(result).toEqual([mockEntityTag]);
        });
        it('throws and logs on error', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockRejectedValueOnce(new Error('fail'));
            await expect(
                EntityTagModel.list({ limit: 10, offset: 0, order: 'asc', orderBy: 'tagId' })
            ).rejects.toThrow('Failed to list entity tags: fail');
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('search', () => {
        it('returns relations by search', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockResolvedValueOnce([mockEntityTag]);
            const result = await EntityTagModel.search({
                limit: 10,
                offset: 0,
                order: 'asc',
                orderBy: 'tagId',
                query: 'acc'
            });
            expect(result).toEqual([mockEntityTag]);
        });
        it('throws and logs on error', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockRejectedValueOnce(new Error('fail'));
            await expect(
                EntityTagModel.search({
                    limit: 10,
                    offset: 0,
                    order: 'asc',
                    orderBy: 'tagId',
                    query: 'acc'
                })
            ).rejects.toThrow('Failed to search entity tags: fail');
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('count', () => {
        it('returns the count', async () => {
            mockDb.where.mockResolvedValueOnce([{ count: 3 }]);
            const result = await EntityTagModel.count({
                limit: 10,
                offset: 0,
                order: 'asc',
                orderBy: 'tagId',
                query: 'acc'
            });
            expect(result).toBe(3);
        });
        it('returns 0 if no results', async () => {
            mockDb.where.mockResolvedValueOnce([{}]);
            const result = await EntityTagModel.count({
                limit: 10,
                offset: 0,
                order: 'asc',
                orderBy: 'tagId',
                query: 'acc'
            });
            expect(result).toBe(0);
        });
        it('throws and logs on error', async () => {
            mockDb.where.mockRejectedValueOnce(new Error('fail'));
            await expect(
                EntityTagModel.count({
                    limit: 10,
                    offset: 0,
                    order: 'asc',
                    orderBy: 'tagId',
                    query: 'acc'
                })
            ).rejects.toThrow('Failed to count entity tags: fail');
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });
});
