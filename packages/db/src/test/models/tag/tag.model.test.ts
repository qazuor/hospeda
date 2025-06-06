import type { NewTagInputType, TagType, UpdateTagInputType } from '@repo/types';
import { LifecycleStatusEnum, TagColorEnum } from '@repo/types';
import type { TagId } from '@repo/types/common/id.types.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tags } from '../../../dbschemas/tag/tag.dbschema';
import { TagModel } from '../../../models/tag/tag.model.js';
import { getMockTag, mockTag } from '../../mockData';

declare global {
    // biome-ignore lint/suspicious/noExplicitAny: test mock typing
    var mockDb: any;
    // biome-ignore lint/suspicious/noExplicitAny: test mock typing
    var mockLogger: any;
}

describe('TagModel.getById', () => {
    beforeEach(() => {
        globalThis.mockLogger.query.mockClear();
        globalThis.mockLogger.error.mockClear();
        globalThis.mockDb.select = vi.fn().mockReturnThis();
        globalThis.mockDb.from = vi.fn().mockReturnThis();
        globalThis.mockDb.where = vi.fn().mockReturnThis();
        globalThis.mockDb.limit = vi.fn();
    });

    it('returns a tag if found', async () => {
        globalThis.mockDb.limit.mockResolvedValueOnce([mockTag]);
        const result = await TagModel.getById('tag-1');
        expect(result).toEqual(mockTag);
        expect(globalThis.mockLogger.query).toHaveBeenCalledWith({
            table: 'tags',
            action: 'getById',
            params: { id: 'tag-1' },
            result: [mockTag]
        });
        expect(globalThis.mockLogger.error).not.toHaveBeenCalled();
    });

    it('returns undefined if not found', async () => {
        globalThis.mockDb.limit.mockResolvedValueOnce([]);
        const result = await TagModel.getById('not-found');
        expect(result).toBeUndefined();
        expect(globalThis.mockLogger.query).toHaveBeenCalledWith({
            table: 'tags',
            action: 'getById',
            params: { id: 'not-found' },
            result: []
        });
        expect(globalThis.mockLogger.error).not.toHaveBeenCalled();
    });

    it('logs and throws on error', async () => {
        globalThis.mockDb.limit.mockRejectedValueOnce(new Error('DB error'));
        await expect(TagModel.getById('fail')).rejects.toThrow('Failed to get tag by id: DB error');
        expect(globalThis.mockLogger.error).toHaveBeenCalledWith(
            expect.any(Error),
            'TagModel.getById'
        );
    });
});

describe('TagModel.create', () => {
    const input: NewTagInputType = {
        name: 'New Tag',
        color: 'red',
        lifecycleState: LifecycleStatusEnum.ACTIVE
    };
    beforeEach(() => {
        globalThis.mockLogger.query.mockClear();
        globalThis.mockLogger.error.mockClear();
    });

    it('creates and returns a tag', async () => {
        const returning = vi.fn().mockResolvedValueOnce([{ ...mockTag, ...input }]);
        const values = vi.fn(() => ({ returning }));
        globalThis.mockDb.insert = vi.fn(() => ({ values }));
        const result = await TagModel.create(input);
        expect(result).toEqual({ ...mockTag, ...input });
        expect(globalThis.mockLogger.query).toHaveBeenCalledWith({
            table: 'tags',
            action: 'create',
            params: { input },
            result: { ...mockTag, ...input }
        });
        expect(globalThis.mockLogger.error).not.toHaveBeenCalled();
    });

    it('throws and logs if insert fails', async () => {
        const returning = vi.fn().mockResolvedValueOnce([]);
        const values = vi.fn(() => ({ returning }));
        globalThis.mockDb.insert = vi.fn(() => ({ values }));
        await expect(TagModel.create(input)).rejects.toThrow('Insert failed');
        expect(globalThis.mockLogger.error).toHaveBeenCalledWith(
            expect.any(Error),
            'TagModel.create'
        );
    });

    it('throws and logs on db error', async () => {
        const returning = vi.fn().mockRejectedValueOnce(new Error('DB error'));
        const values = vi.fn(() => ({ returning }));
        globalThis.mockDb.insert = vi.fn(() => ({ values }));
        await expect(TagModel.create(input)).rejects.toThrow('Failed to create tag: DB error');
        expect(globalThis.mockLogger.error).toHaveBeenCalledWith(
            expect.any(Error),
            'TagModel.create'
        );
    });
});

describe('TagModel.update', () => {
    const input: UpdateTagInputType = {
        name: 'Updated Tag',
        color: 'green'
    };
    beforeEach(() => {
        globalThis.mockLogger.query.mockClear();
        globalThis.mockLogger.error.mockClear();
        globalThis.mockDb.update = vi.fn(() => ({
            set: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            returning: vi.fn()
        }));
    });

    it('updates and returns the tag', async () => {
        const returning = vi.fn().mockResolvedValueOnce([{ ...mockTag, ...input }]);
        const set = vi.fn(() => ({ where: vi.fn(() => ({ returning })) }));
        globalThis.mockDb.update = vi.fn(() => ({ set }));
        const result = await TagModel.update('tag-1', input);
        expect(result).toEqual({ ...mockTag, ...input });
        expect(globalThis.mockLogger.query).toHaveBeenCalledWith({
            table: 'tags',
            action: 'update',
            params: { id: 'tag-1', input },
            result: { ...mockTag, ...input }
        });
        expect(globalThis.mockLogger.error).not.toHaveBeenCalled();
    });

    it('returns undefined if not found', async () => {
        const returning = vi.fn().mockResolvedValueOnce([]);
        const set = vi.fn(() => ({ where: vi.fn(() => ({ returning })) }));
        globalThis.mockDb.update = vi.fn(() => ({ set }));
        const result = await TagModel.update('not-found', input);
        expect(result).toBeUndefined();
        expect(globalThis.mockLogger.query).toHaveBeenCalledWith({
            table: 'tags',
            action: 'update',
            params: { id: 'not-found', input },
            result: undefined
        });
        expect(globalThis.mockLogger.error).not.toHaveBeenCalled();
    });

    it('throws and logs on db error', async () => {
        const returning = vi.fn().mockRejectedValueOnce(new Error('DB error'));
        const set = vi.fn(() => ({ where: vi.fn(() => ({ returning })) }));
        globalThis.mockDb.update = vi.fn(() => ({ set }));
        await expect(TagModel.update('fail', input)).rejects.toThrow(
            'Failed to update tag: DB error'
        );
        expect(globalThis.mockLogger.error).toHaveBeenCalledWith(
            expect.any(Error),
            'TagModel.update'
        );
    });
});

describe('TagModel.delete', () => {
    const deletedById = 'user-2';
    beforeEach(() => {
        globalThis.mockLogger.query.mockClear();
        globalThis.mockLogger.error.mockClear();
        globalThis.mockDb.update = vi.fn(() => ({
            set: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            returning: vi.fn()
        }));
    });

    it('soft deletes and returns the tag id', async () => {
        const now = new Date();
        const deletedResult = { id: mockTag.id };
        const returning = vi.fn().mockResolvedValueOnce([deletedResult]);
        const set = vi.fn(() => ({ where: vi.fn(() => ({ returning })) }));
        globalThis.mockDb.update = vi.fn(() => ({ set }));
        // Mock Date
        vi.spyOn(global, 'Date').mockImplementation(() => now);
        const result = await TagModel.delete('tag-1', deletedById);
        expect(result).toEqual({ id: mockTag.id });
        expect(globalThis.mockLogger.query).toHaveBeenCalledWith({
            table: 'tags',
            action: 'delete',
            params: { id: 'tag-1', deletedById },
            result: { id: mockTag.id }
        });
        expect(globalThis.mockLogger.error).not.toHaveBeenCalled();
        vi.restoreAllMocks();
    });

    it('returns undefined if not found', async () => {
        const returning = vi.fn().mockResolvedValueOnce([]);
        const set = vi.fn(() => ({ where: vi.fn(() => ({ returning })) }));
        globalThis.mockDb.update = vi.fn(() => ({ set }));
        const result = await TagModel.delete('not-found', deletedById);
        expect(result).toBeUndefined();
        expect(globalThis.mockLogger.query).toHaveBeenCalledWith({
            table: 'tags',
            action: 'delete',
            params: { id: 'not-found', deletedById },
            result: undefined
        });
        expect(globalThis.mockLogger.error).not.toHaveBeenCalled();
    });

    it('throws and logs on db error', async () => {
        const returning = vi.fn().mockRejectedValueOnce(new Error('DB error'));
        const set = vi.fn(() => ({ where: vi.fn(() => ({ returning })) }));
        globalThis.mockDb.update = vi.fn(() => ({ set }));
        await expect(TagModel.delete('fail', deletedById)).rejects.toThrow(
            'Failed to delete tag: DB error'
        );
        expect(globalThis.mockLogger.error).toHaveBeenCalledWith(
            expect.any(Error),
            'TagModel.delete'
        );
    });
});

describe('TagModel.hardDelete', () => {
    beforeEach(() => {
        globalThis.mockLogger.query.mockClear();
        globalThis.mockLogger.error.mockClear();
        globalThis.mockDb.delete = vi.fn(() => ({
            where: vi.fn().mockReturnThis(),
            returning: vi.fn()
        }));
    });

    it('hard deletes and returns true', async () => {
        const returning = vi.fn().mockResolvedValueOnce([mockTag]);
        const where = vi.fn(() => ({ returning }));
        globalThis.mockDb.delete = vi.fn(() => ({ where }));
        const result = await TagModel.hardDelete('tag-1');
        expect(result).toBe(true);
        expect(globalThis.mockLogger.query).toHaveBeenCalledWith({
            table: 'tags',
            action: 'hardDelete',
            params: { id: 'tag-1' },
            result: true
        });
        expect(globalThis.mockLogger.error).not.toHaveBeenCalled();
    });

    it('returns false if not found', async () => {
        const returning = vi.fn().mockResolvedValueOnce([]);
        const where = vi.fn(() => ({ returning }));
        globalThis.mockDb.delete = vi.fn(() => ({ where }));
        const result = await TagModel.hardDelete('not-found');
        expect(result).toBe(false);
        expect(globalThis.mockLogger.query).toHaveBeenCalledWith({
            table: 'tags',
            action: 'hardDelete',
            params: { id: 'not-found' },
            result: false
        });
        expect(globalThis.mockLogger.error).not.toHaveBeenCalled();
    });

    it('throws and logs on db error', async () => {
        const returning = vi.fn().mockRejectedValueOnce(new Error('DB error'));
        const where = vi.fn(() => ({ returning }));
        globalThis.mockDb.delete = vi.fn(() => ({ where }));
        await expect(TagModel.hardDelete('fail')).rejects.toThrow(
            'Failed to hard delete tag: DB error'
        );
        expect(globalThis.mockLogger.error).toHaveBeenCalledWith(
            expect.any(Error),
            'TagModel.hardDelete'
        );
    });
});

describe('TagModel.getWithRelations', () => {
    beforeEach(() => {
        globalThis.mockLogger.query.mockClear();
        globalThis.mockLogger.error.mockClear();
        globalThis.mockDb.query = {
            tags: {
                findFirst: vi.fn()
            }
        };
    });

    it('returns a tag with entityTags if found', async () => {
        const entityTags = [
            { tagId: mockTag.id, entityId: 'entity-1', entityType: 'ACCOMMODATION' }
        ];
        globalThis.mockDb.query.tags.findFirst.mockResolvedValueOnce({ ...mockTag, entityTags });
        const result = await TagModel.getWithRelations('tag-1', { entityTags: true });
        expect(result).toEqual({ ...mockTag, entityTags });
        expect(globalThis.mockLogger.query).toHaveBeenCalledWith({
            table: 'tags',
            action: 'getWithRelations',
            params: { id: 'tag-1', with: { entityTags: true } },
            result: { ...mockTag, entityTags }
        });
        expect(globalThis.mockLogger.error).not.toHaveBeenCalled();
    });

    it('returns undefined if not found', async () => {
        globalThis.mockDb.query.tags.findFirst.mockResolvedValueOnce(undefined);
        const result = await TagModel.getWithRelations('not-found', { entityTags: true });
        expect(result).toBeUndefined();
        expect(globalThis.mockLogger.query).toHaveBeenCalledWith({
            table: 'tags',
            action: 'getWithRelations',
            params: { id: 'not-found', with: { entityTags: true } },
            result: undefined
        });
        expect(globalThis.mockLogger.error).not.toHaveBeenCalled();
    });

    it('throws and logs on db error', async () => {
        globalThis.mockDb.query.tags.findFirst.mockRejectedValueOnce(new Error('DB error'));
        await expect(TagModel.getWithRelations('fail', { entityTags: true })).rejects.toThrow(
            'Failed to get tag with relations: DB error'
        );
        expect(globalThis.mockLogger.error).toHaveBeenCalledWith(
            expect.any(Error),
            'TagModel.getWithRelations'
        );
    });
});

describe('TagModel.list', () => {
    const mockResult: TagType[] = [
        getMockTag({ id: 'tag-1' as TagId, name: 'A', color: 'blue' }),
        getMockTag({ id: 'tag-2' as TagId, name: 'B', color: 'red' })
    ];
    let chain: {
        select: ReturnType<typeof vi.fn>;
        from: ReturnType<typeof vi.fn>;
        orderBy: ReturnType<typeof vi.fn>;
        limit: ReturnType<typeof vi.fn>;
        offset: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        globalThis.mockLogger.query.mockClear();
        globalThis.mockLogger.error.mockClear();
        // Mock encadenable
        chain = {
            select: vi.fn().mockReturnThis(),
            from: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            offset: vi.fn().mockReturnThis()
        };
        globalThis.mockDb.select = chain.select;
        globalThis.mockDb.from = chain.from;
        globalThis.mockDb.orderBy = chain.orderBy;
        globalThis.mockDb.limit = chain.limit;
        globalThis.mockDb.offset = chain.offset;
    });

    it('returns tags with default order', async () => {
        chain.limit.mockReturnThis();
        chain.offset.mockResolvedValueOnce(mockResult);
        const result = await TagModel.list({ limit: 10, offset: 0 });
        expect(result).toEqual(mockResult);
        expect(globalThis.mockLogger.query).toHaveBeenCalled();
        expect(globalThis.mockLogger.error).not.toHaveBeenCalled();
    });

    it('returns tags in descending order', async () => {
        chain.limit.mockReturnThis();
        chain.offset.mockResolvedValueOnce(mockResult);
        const result = await TagModel.list({ limit: 10, offset: 0, order: 'desc' });
        expect(result).toEqual(mockResult);
        expect(globalThis.mockLogger.query).toHaveBeenCalled();
    });

    it('returns tags ordered by a valid column', async () => {
        chain.limit.mockReturnThis();
        chain.offset.mockResolvedValueOnce(mockResult);
        const result = await TagModel.list({ limit: 10, offset: 0, orderBy: 'name' });
        expect(result).toEqual(mockResult);
        expect(globalThis.mockLogger.query).toHaveBeenCalled();
    });

    it('throws error for invalid orderBy column', async () => {
        process.env.DB_ORDERBY_THROW_ON_INVALID = 'true';
        await expect(
            TagModel.list({ limit: 10, offset: 0, orderBy: 'invalid' as unknown as never })
        ).rejects.toThrow('Invalid orderBy column: invalid');
        expect(globalThis.mockLogger.error).toHaveBeenCalled();
        process.env.DB_ORDERBY_THROW_ON_INVALID = undefined;
    });

    it('returns paginated tags', async () => {
        chain.limit.mockReturnThis();
        chain.offset.mockResolvedValueOnce([mockResult[1]]);
        const result = await TagModel.list({ limit: 1, offset: 1 });
        expect(result).toEqual([mockResult[1]]);
        expect(globalThis.mockLogger.query).toHaveBeenCalled();
    });
});

describe('TagModel.findByName', () => {
    beforeEach(() => {
        globalThis.mockLogger.query.mockClear();
        globalThis.mockLogger.error.mockClear();
        globalThis.mockDb.select = vi.fn().mockReturnThis();
        globalThis.mockDb.from = vi.fn().mockReturnThis();
        globalThis.mockDb.where = vi.fn().mockReturnThis();
        globalThis.mockDb.limit = vi.fn();
    });

    it('returns a tag if found', async () => {
        globalThis.mockDb.limit.mockResolvedValueOnce([mockTag]);
        const result = await TagModel.findByName('Test Tag');
        expect(result).toEqual(mockTag);
        expect(globalThis.mockLogger.query).toHaveBeenCalledWith({
            table: 'tags',
            action: 'findByName',
            params: { name: 'Test Tag' },
            result: [mockTag]
        });
        expect(globalThis.mockLogger.error).not.toHaveBeenCalled();
    });

    it('returns undefined if not found', async () => {
        globalThis.mockDb.limit.mockResolvedValueOnce([]);
        const result = await TagModel.findByName('not-found');
        expect(result).toBeUndefined();
        expect(globalThis.mockLogger.query).toHaveBeenCalledWith({
            table: 'tags',
            action: 'findByName',
            params: { name: 'not-found' },
            result: []
        });
        expect(globalThis.mockLogger.error).not.toHaveBeenCalled();
    });

    it('logs and throws on error', async () => {
        globalThis.mockDb.limit.mockRejectedValueOnce(new Error('DB error'));
        await expect(TagModel.findByName('fail')).rejects.toThrow(
            'Failed to find tag by name: DB error'
        );
        expect(globalThis.mockLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.any(String) }),
            'TagModel.findByName'
        );
    });
});

describe('TagModel.count', () => {
    beforeEach(() => {
        globalThis.mockLogger.query.mockClear();
        globalThis.mockLogger.error.mockClear();
        globalThis.mockDb.select = vi.fn().mockReturnThis();
        globalThis.mockDb.from = vi.fn().mockReturnThis();
        globalThis.mockDb.where = vi.fn().mockReturnThis();
    });

    it('returns the count of all tags', async () => {
        globalThis.mockDb.select.mockReturnThis();
        globalThis.mockDb.from.mockReturnThis();
        globalThis.mockDb.where.mockReturnThis();
        const mockResult = [{ count: 5 }];
        globalThis.mockDb.from.mockResolvedValueOnce(mockResult);
        const result = await TagModel.count();
        expect(result).toBe(5);
        expect(globalThis.mockLogger.query).toHaveBeenCalled();
    });

    it('returns the count with filters', async () => {
        globalThis.mockDb.select.mockReturnThis();
        globalThis.mockDb.from.mockReturnThis();
        globalThis.mockDb.where.mockReturnThis();
        const mockResult = [{ count: 2 }];
        globalThis.mockDb.where.mockResolvedValueOnce(mockResult);
        const result = await TagModel.count({
            color: TagColorEnum.BLUE,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            limit: 10,
            offset: 0
        });
        expect(result).toBe(2);
        expect(globalThis.mockLogger.query).toHaveBeenCalled();
    });

    it('returns 0 if no tags found', async () => {
        globalThis.mockDb.select.mockReturnThis();
        globalThis.mockDb.from.mockReturnThis();
        globalThis.mockDb.where.mockReturnThis();
        globalThis.mockDb.where.mockResolvedValueOnce([]);
        const result = await TagModel.count({ color: TagColorEnum.RED, limit: 10, offset: 0 });
        expect(result).toBe(0);
    });

    it('logs and throws on error', async () => {
        globalThis.mockDb.select.mockReturnThis();
        globalThis.mockDb.from.mockReturnThis();
        globalThis.mockDb.where.mockReturnThis();
        globalThis.mockDb.where.mockRejectedValueOnce(new Error('DB error'));
        await expect(
            TagModel.count({ color: 'fail' as TagColorEnum, limit: 10, offset: 0 })
        ).rejects.toThrow('Failed to count tags: DB error');
        expect(globalThis.mockLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.any(String) }),
            'TagModel.count'
        );
    });
});

describe('TagModel.search', () => {
    beforeEach(() => {
        // biome-ignore lint/suspicious/noExplicitAny: test hack
        (tags as any).name = {
            ilike: vi.fn(() => true)
        };
        globalThis.mockLogger.query.mockClear();
        globalThis.mockLogger.error.mockClear();
        globalThis.mockDb.select = vi.fn().mockReturnThis();
        globalThis.mockDb.from = vi.fn().mockReturnThis();
        globalThis.mockDb.where = vi.fn().mockReturnThis();
        globalThis.mockDb.orderBy = vi.fn().mockReturnThis();
        globalThis.mockDb.limit = vi.fn().mockReturnThis();
        globalThis.mockDb.offset = vi.fn().mockReturnThis();
    });

    it('returns tags with default search', async () => {
        globalThis.mockDb.limit.mockReturnThis();
        globalThis.mockDb.offset.mockResolvedValueOnce([mockTag]);
        const result = await TagModel.search({ limit: 10, offset: 0 });
        expect(result).toEqual([mockTag]);
        expect(globalThis.mockLogger.query).toHaveBeenCalled();
    });

    it('returns tags with filters', async () => {
        globalThis.mockDb.limit.mockReturnThis();
        globalThis.mockDb.offset.mockResolvedValueOnce([mockTag]);
        const result = await TagModel.search({
            limit: 10,
            offset: 0,
            color: TagColorEnum.BLUE,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });
        expect(result).toEqual([mockTag]);
        expect(globalThis.mockLogger.query).toHaveBeenCalled();
    });

    it('returns tags with name search', async () => {
        globalThis.mockDb.limit.mockReturnThis();
        globalThis.mockDb.offset.mockResolvedValueOnce([mockTag]);
        const result = await TagModel.search({ limit: 10, offset: 0, name: 'Test' });
        expect(result).toEqual([mockTag]);
        expect(globalThis.mockLogger.query).toHaveBeenCalled();
    });

    it('returns empty array if no tags found', async () => {
        globalThis.mockDb.limit.mockReturnThis();
        globalThis.mockDb.offset.mockResolvedValueOnce([]);
        const result = await TagModel.search({ limit: 10, offset: 0, color: TagColorEnum.RED });
        expect(result).toEqual([]);
    });

    it('logs and throws on error', async () => {
        globalThis.mockDb.limit.mockReturnThis();
        globalThis.mockDb.offset.mockRejectedValueOnce(new Error('DB error'));
        await expect(
            TagModel.search({ limit: 10, offset: 0, color: 'fail' as TagColorEnum })
        ).rejects.toThrow('Failed to search tags: DB error');
        expect(globalThis.mockLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.any(String) }),
            'TagModel.search'
        );
    });
});

describe('TagModel.update (concurrency)', () => {
    it('handles concurrent updates gracefully', async () => {
        const fixedDate = new Date('2025-05-29T13:57:15.491Z');
        vi.spyOn(global, 'Date').mockImplementation(() => fixedDate);

        // Simulate first update is successful
        const returning1 = vi
            .fn()
            .mockResolvedValueOnce([
                getMockTag({ name: 'Tag v2', createdAt: fixedDate, updatedAt: fixedDate })
            ]);
        // Simulate second update fails due to race condition
        const returning2 = vi
            .fn()
            .mockRejectedValueOnce(new Error('Row was updated by another transaction'));

        const set1 = vi.fn(() => ({ where: vi.fn(() => ({ returning: returning1 })) }));
        const set2 = vi.fn(() => ({ where: vi.fn(() => ({ returning: returning2 })) }));

        let callCount = 0;
        globalThis.mockDb.update = vi.fn(() => {
            callCount += 1;
            return callCount === 1 ? { set: set1 } : { set: set2 };
        });

        // First update should succeed
        const result1 = await TagModel.update('tag-1', { name: 'Tag v2' });
        expect(result1).toEqual(
            getMockTag({ name: 'Tag v2', createdAt: fixedDate, updatedAt: fixedDate })
        );

        // Second update should throw concurrency error
        await expect(TagModel.update('tag-1', { name: 'Tag v3' })).rejects.toThrow(
            'Row was updated by another transaction'
        );
    });
});

describe('TagModel.delete (concurrency)', () => {
    it('handles concurrent delete and update gracefully', async () => {
        // Simulate delete is successful
        const returningDelete = vi.fn().mockResolvedValueOnce([{ id: 'tag-1' }]);
        // Simulate update after delete returns empty (not found)
        const returningUpdate = vi.fn().mockResolvedValueOnce([]);

        const setUpdate = vi.fn(() => ({ where: vi.fn(() => ({ returning: returningUpdate })) }));
        globalThis.mockDb.update = vi.fn(() => ({ set: setUpdate }));

        // First, delete the tag
        globalThis.mockDb.update = vi.fn(() => ({
            set: vi.fn(() => ({ where: vi.fn(() => ({ returning: returningDelete })) }))
        }));
        const deleteResult = await TagModel.delete('tag-1', 'user-2');
        expect(deleteResult).toEqual({ id: 'tag-1' });

        // Now, simulate update after delete (should return undefined)
        globalThis.mockDb.update = vi.fn(() => ({ set: setUpdate }));
        const updateResult = await TagModel.update('tag-1', { name: 'Should not update' });
        expect(updateResult).toBeUndefined();
    });

    it('handles concurrent delete and delete gracefully', async () => {
        // Simulate first delete is successful
        const returningDelete1 = vi.fn().mockResolvedValueOnce([{ id: 'tag-1' }]);
        // Simulate second delete returns empty (already deleted)
        const returningDelete2 = vi.fn().mockResolvedValueOnce([]);

        let callCount = 0;
        globalThis.mockDb.update = vi.fn(() => ({
            set: vi.fn(() => ({
                where: vi.fn(() => ({
                    returning: callCount++ === 0 ? returningDelete1 : returningDelete2
                }))
            }))
        }));

        // First delete should succeed
        const result1 = await TagModel.delete('tag-1', 'user-2');
        expect(result1).toEqual({ id: 'tag-1' });

        // Second delete should return undefined (already deleted)
        const result2 = await TagModel.delete('tag-1', 'user-2');
        expect(result2).toBeUndefined();
    });
});

afterEach(() => {
    vi.restoreAllMocks();
    const tagName = (tags as Record<string, unknown>).name;
    if (tagName && typeof (tagName as { ilike?: unknown }).ilike === 'function') {
        (tagName as { ilike?: unknown }).ilike = undefined;
    }
    process.env.DB_ORDERBY_THROW_ON_INVALID = undefined;
});
