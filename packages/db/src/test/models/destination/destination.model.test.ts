import type {
    DestinationId,
    DestinationType,
    DestinationWithRelationsType,
    UserId
} from '@repo/types';
import { LifecycleStatusEnum, ModerationStatusEnum, VisibilityEnum } from '@repo/types';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../../../../src/client';
import { destinations } from '../../../../src/dbschemas/destination/destination.dbschema.ts';
import { DestinationModel } from '../../../../src/models/destination/destination.model';
import { dbLogger } from '../../../../src/utils/logger';

vi.mock('../../../../src/utils/logger');
vi.mock('../../../../src/client');
vi.mock('../../../../src/dbschemas/destination/destination.dbschema.ts', () => ({
    destinations: {
        name: { ilike: vi.fn() },
        slug: {},
        createdAt: {},
        updatedAt: {},
        isFeatured: {},
        visibility: {},
        lifecycle: {}
    }
}));

const destinationId = 'destination-1' as DestinationId;
const userId = 'user-1' as UserId;
const baseDestination: DestinationType = {
    id: destinationId,
    slug: 'test-destination',
    name: 'Test Destination',
    summary: 'A test destination',
    description: 'Description',
    location: { state: '', zipCode: '', country: '' },
    media: { featuredImage: { url: '', moderationState: ModerationStatusEnum.PENDING_REVIEW } },
    isFeatured: false,
    visibility: VisibilityEnum.PUBLIC,
    accommodationsCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: userId,
    updatedById: userId,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    moderationState: ModerationStatusEnum.PENDING_REVIEW,
    reviewsCount: 0,
    averageRating: 0,
    adminInfo: { favorite: false },
    seo: {},
    tags: [],
    attractions: [],
    reviews: []
};

const baseWithRelations: DestinationWithRelationsType = {
    ...baseDestination,
    accommodations: [],
    reviews: [],
    tags: [],
    attractions: []
};

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
    query: {
        destinations: {
            findFirst: vi.fn()
        }
    }
};
(getDb as unknown as Mock).mockReturnValue(mockDb);

describe('DestinationModel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (destinations.name.ilike as Mock).mockReset();
    });

    it('getById returns destination if found', async () => {
        mockDb.select.mockReturnThis();
        mockDb.from.mockReturnThis();
        mockDb.where.mockReturnThis();
        mockDb.limit.mockReturnValueOnce([baseDestination]);
        const result = await DestinationModel.getById(destinationId);
        expect(result).toEqual(baseDestination);
    });

    it('getById returns undefined if not found', async () => {
        mockDb.select.mockReturnThis();
        mockDb.from.mockReturnThis();
        mockDb.where.mockReturnThis();
        mockDb.limit.mockReturnValueOnce([]);
        const result = await DestinationModel.getById('not-found' as DestinationId);
        expect(result).toBeUndefined();
    });

    it('getById logs and throws on db error', async () => {
        mockDb.select.mockImplementationOnce(() => {
            throw new Error('fail');
        });
        await expect(DestinationModel.getById('fail' as DestinationId)).rejects.toThrow(
            'Failed to get destination by id: fail'
        );
        expect(dbLogger.error).toHaveBeenCalled();
    });

    it('create returns created destination', async () => {
        mockDb.insert.mockReturnThis();
        mockDb.values.mockReturnThis();
        mockDb.returning.mockResolvedValueOnce([baseDestination]);
        const result = await DestinationModel.create({ ...baseDestination });
        expect(result).toEqual(baseDestination);
    });

    it('create throws if insert fails', async () => {
        mockDb.insert.mockReturnThis();
        mockDb.values.mockReturnThis();
        mockDb.returning.mockResolvedValueOnce([]);
        await expect(DestinationModel.create({ ...baseDestination })).rejects.toThrow(
            'Insert failed'
        );
    });

    it('create logs and throws on db error', async () => {
        mockDb.insert.mockReturnThis();
        mockDb.values.mockReturnThis();
        mockDb.returning.mockRejectedValueOnce(new Error('fail'));
        await expect(DestinationModel.create({ ...baseDestination })).rejects.toThrow(
            'Failed to create destination: fail'
        );
        expect(dbLogger.error).toHaveBeenCalled();
    });

    it('update returns updated destination', async () => {
        mockDb.update.mockReturnThis();
        mockDb.set.mockReturnThis();
        mockDb.where.mockReturnThis();
        mockDb.returning.mockResolvedValueOnce([baseDestination]);
        const result = await DestinationModel.update('destination-1', { name: 'Updated' });
        expect(result).toEqual(baseDestination);
    });

    it('update returns undefined if not found', async () => {
        mockDb.update.mockReturnThis();
        mockDb.set.mockReturnThis();
        mockDb.where.mockReturnThis();
        mockDb.returning.mockResolvedValueOnce([]);
        const result = await DestinationModel.update('not-found', { name: 'Updated' });
        expect(result).toBeUndefined();
    });

    it('update logs and throws on db error', async () => {
        mockDb.update.mockReturnThis();
        mockDb.set.mockReturnThis();
        mockDb.where.mockReturnThis();
        mockDb.returning.mockRejectedValueOnce(new Error('fail'));
        await expect(DestinationModel.update('fail', { name: 'Updated' })).rejects.toThrow(
            'Failed to update destination: fail'
        );
        expect(dbLogger.error).toHaveBeenCalled();
    });

    it('delete returns id if deleted', async () => {
        mockDb.update.mockReturnThis();
        mockDb.set.mockReturnThis();
        mockDb.where.mockReturnThis();
        mockDb.returning.mockResolvedValueOnce([{ id: 'destination-1' }]);
        const result = await DestinationModel.delete('destination-1', 'user-1');
        expect(result).toEqual({ id: 'destination-1' });
    });

    it('delete returns undefined if not found', async () => {
        mockDb.update.mockReturnThis();
        mockDb.set.mockReturnThis();
        mockDb.where.mockReturnThis();
        mockDb.returning.mockResolvedValueOnce([]);
        const result = await DestinationModel.delete('not-found', 'user-1');
        expect(result).toBeUndefined();
    });

    it('delete logs and throws on db error', async () => {
        mockDb.update.mockReturnThis();
        mockDb.set.mockReturnThis();
        mockDb.where.mockReturnThis();
        mockDb.returning.mockRejectedValueOnce(new Error('fail'));
        await expect(DestinationModel.delete('fail', 'user-1')).rejects.toThrow(
            'Failed to delete destination: fail'
        );
        expect(dbLogger.error).toHaveBeenCalled();
    });

    it('hardDelete returns true if deleted', async () => {
        mockDb.delete.mockReturnThis();
        mockDb.where.mockReturnThis();
        mockDb.returning.mockResolvedValueOnce([baseDestination]);
        const result = await DestinationModel.hardDelete('destination-1');
        expect(result).toBe(true);
    });

    it('hardDelete returns false if not found', async () => {
        mockDb.delete.mockReturnThis();
        mockDb.where.mockReturnThis();
        mockDb.returning.mockResolvedValueOnce([]);
        const result = await DestinationModel.hardDelete('not-found');
        expect(result).toBe(false);
    });

    it('hardDelete logs and throws on db error', async () => {
        mockDb.delete.mockReturnThis();
        mockDb.where.mockReturnThis();
        mockDb.returning.mockRejectedValueOnce(new Error('fail'));
        await expect(DestinationModel.hardDelete('fail')).rejects.toThrow(
            'Failed to hard delete destination: fail'
        );
        expect(dbLogger.error).toHaveBeenCalled();
    });

    it('findBySlug returns destination if found', async () => {
        mockDb.select.mockReturnThis();
        mockDb.from.mockReturnThis();
        mockDb.where.mockReturnThis();
        mockDb.limit.mockResolvedValueOnce([baseDestination]);
        const result = await DestinationModel.findBySlug('test-destination');
        expect(result).toEqual(baseDestination);
    });

    it('findBySlug returns undefined if not found', async () => {
        mockDb.select.mockReturnThis();
        mockDb.from.mockReturnThis();
        mockDb.where.mockReturnThis();
        mockDb.limit.mockResolvedValueOnce([]);
        const result = await DestinationModel.findBySlug('not-found');
        expect(result).toBeUndefined();
    });

    it('findBySlug logs and throws on db error', async () => {
        mockDb.select.mockReturnThis();
        mockDb.from.mockReturnThis();
        mockDb.where.mockReturnThis();
        mockDb.limit.mockRejectedValueOnce(new Error('fail'));
        await expect(DestinationModel.findBySlug('fail')).rejects.toThrow(
            'Failed to find destination by slug: fail'
        );
        expect(dbLogger.error).toHaveBeenCalled();
    });

    it('getWithRelations returns destination with relations', async () => {
        mockDb.query = {
            destinations: {
                findFirst: vi.fn().mockResolvedValueOnce(baseWithRelations)
            }
        };
        const result = await DestinationModel.getWithRelations('destination-1');
        expect(result).toEqual(baseWithRelations);
    });

    it('getWithRelations returns undefined if not found', async () => {
        mockDb.query = {
            destinations: {
                findFirst: vi.fn().mockResolvedValueOnce(undefined)
            }
        };
        const result = await DestinationModel.getWithRelations('not-found');
        expect(result).toBeUndefined();
    });

    it('getWithRelations logs and throws on db error', async () => {
        mockDb.query = {
            destinations: {
                findFirst: vi.fn().mockRejectedValueOnce(new Error('fail'))
            }
        };
        await expect(DestinationModel.getWithRelations('fail')).rejects.toThrow(
            'Failed to get destination with relations: fail'
        );
        expect(dbLogger.error).toHaveBeenCalled();
    });

    it('list returns destinations with pagination', async () => {
        mockDb.select.mockReturnThis();
        mockDb.from.mockReturnThis();
        mockDb.orderBy.mockReturnThis();
        mockDb.limit.mockReturnThis();
        mockDb.offset.mockResolvedValueOnce([baseDestination]);
        const result = await DestinationModel.list({ limit: 10, offset: 0 });
        expect(result).toEqual([baseDestination]);
    });

    it('list returns empty array if none found', async () => {
        mockDb.select.mockReturnThis();
        mockDb.from.mockReturnThis();
        mockDb.orderBy.mockReturnThis();
        mockDb.limit.mockReturnThis();
        mockDb.offset.mockResolvedValueOnce([]);
        const result = await DestinationModel.list({ limit: 10, offset: 0 });
        expect(result).toEqual([]);
    });

    it('list logs and throws on db error', async () => {
        mockDb.select.mockReturnThis();
        mockDb.from.mockReturnThis();
        mockDb.orderBy.mockReturnThis();
        mockDb.limit.mockReturnThis();
        mockDb.offset.mockRejectedValueOnce(new Error('fail'));
        await expect(DestinationModel.list({ limit: 10, offset: 0 })).rejects.toThrow(
            'Failed to list destinations: fail'
        );
        expect(dbLogger.error).toHaveBeenCalled();
    });

    it('count returns number of destinations', async () => {
        mockDb.select.mockReturnThis();
        mockDb.from.mockReturnThis();
        mockDb.where.mockReturnThis();
        (destinations.name.ilike as Mock).mockReturnValue('ilike-clause');
        mockDb.where.mockResolvedValueOnce([{ count: 5 }]);
        const result = await DestinationModel.count({ name: 'Test', limit: 10, offset: 0 });
        expect(result).toBe(5);
    });

    it('count returns 0 if none found', async () => {
        mockDb.select.mockReturnThis();
        mockDb.from.mockReturnThis();
        mockDb.where.mockReturnThis();
        (destinations.name.ilike as Mock).mockReturnValue('ilike-clause');
        mockDb.where.mockResolvedValueOnce([]);
        const result = await DestinationModel.count({ name: 'None', limit: 10, offset: 0 });
        expect(result).toBe(0);
    });

    it('count logs and throws on db error', async () => {
        mockDb.select.mockReturnThis();
        mockDb.from.mockReturnThis();
        mockDb.where.mockReturnThis();
        (destinations.name.ilike as Mock).mockImplementation(() => {
            throw new Error('fail');
        });
        await expect(
            DestinationModel.count({ name: 'fail', limit: 10, offset: 0 })
        ).rejects.toThrow('Failed to count destinations: fail');
        expect(dbLogger.error).toHaveBeenCalled();
    });

    it('search returns destinations matching search', async () => {
        mockDb.select.mockReturnThis();
        mockDb.from.mockReturnThis();
        mockDb.where.mockReturnThis();
        mockDb.orderBy.mockReturnThis();
        mockDb.limit.mockReturnThis();
        mockDb.offset.mockResolvedValueOnce([baseDestination]);
        (destinations.name.ilike as Mock).mockReturnValue('ilike-clause');
        const result = await DestinationModel.search({ name: 'Test', limit: 10, offset: 0 });
        expect(result).toEqual([baseDestination]);
    });

    it('search returns empty array if none found', async () => {
        mockDb.select.mockReturnThis();
        mockDb.from.mockReturnThis();
        mockDb.where.mockReturnThis();
        mockDb.orderBy.mockReturnThis();
        mockDb.limit.mockReturnThis();
        mockDb.offset.mockResolvedValueOnce([]);
        (destinations.name.ilike as Mock).mockReturnValue('ilike-clause');
        const result = await DestinationModel.search({ name: 'None', limit: 10, offset: 0 });
        expect(result).toEqual([]);
    });

    it('search logs and throws on db error', async () => {
        mockDb.select.mockReturnThis();
        mockDb.from.mockReturnThis();
        mockDb.where.mockReturnThis();
        mockDb.orderBy.mockReturnThis();
        mockDb.limit.mockReturnThis();
        mockDb.offset.mockRejectedValueOnce(new Error('fail'));
        (destinations.name.ilike as Mock).mockReturnValue('ilike-clause');
        await expect(
            DestinationModel.search({ name: 'fail', limit: 10, offset: 0 })
        ).rejects.toThrow('Failed to search destinations: fail');
        expect(dbLogger.error).toHaveBeenCalled();
    });
});
