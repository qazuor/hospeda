import type {
    AccommodationType,
    AccommodationWithRelationsType,
    NewAccommodationInputType,
    UpdateAccommodationInputType
} from '@repo/types';
import {
    AccommodationTypeEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    VisibilityEnum
} from '@repo/types';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../../../../src/client';
import { AccommodationModel } from '../../../../src/models/accommodation/accommodation.model';
import { dbLogger } from '../../../../src/utils/logger';
import { mockAccommodation } from '../mockData';

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
        accommodations: {
            findFirst: vi.fn(),
            findMany: vi.fn()
        }
    }
};

(getDb as unknown as Mock).mockReturnValue(mockDb);

describe('AccommodationModel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getById', () => {
        it('returns accommodation if found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([{ ...mockAccommodation }]);
            const acc = await AccommodationModel.getById('acc-uuid');
            expect(acc).toEqual(mockAccommodation);
        });
        it('returns undefined if not found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([]);
            const acc = await AccommodationModel.getById('not-exist');
            expect(acc).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AccommodationModel.getById('err')).rejects.toThrow(
                'Failed to get accommodation by id: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByName', () => {
        it('returns accommodation if found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([{ ...mockAccommodation }]);
            const acc = await AccommodationModel.getByName('Hotel Uruguay');
            expect(acc).toEqual(mockAccommodation);
        });
        it('returns undefined if not found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([]);
            const acc = await AccommodationModel.getByName('not-exist');
            expect(acc).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AccommodationModel.getByName('err')).rejects.toThrow(
                'Failed to get accommodation by name: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getBySlug', () => {
        it('returns accommodation if found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([{ ...mockAccommodation }]);
            const acc = await AccommodationModel.getBySlug('hotel-uruguay');
            expect(acc).toEqual(mockAccommodation);
        });
        it('returns undefined if not found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([]);
            const acc = await AccommodationModel.getBySlug('not-exist');
            expect(acc).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AccommodationModel.getBySlug('err')).rejects.toThrow(
                'Failed to get accommodation by slug: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByType', () => {
        it('returns accommodations by type', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([{ ...mockAccommodation }]);
            const accs = await AccommodationModel.getByType(AccommodationTypeEnum.HOTEL);
            expect(accs).toEqual([mockAccommodation]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([]);
            const accs = await AccommodationModel.getByType('not-exist');
            expect(accs).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AccommodationModel.getByType('err')).rejects.toThrow(
                'Failed to get accommodations by type: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('create', () => {
        it('returns created accommodation', async () => {
            mockDb.insert.mockReturnThis();
            mockDb.values.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ ...mockAccommodation }]);
            const input: NewAccommodationInputType = {
                ...mockAccommodation,
                id: undefined,
                createdAt: undefined,
                updatedAt: undefined,
                createdById: undefined,
                updatedById: undefined
            };
            const acc = await AccommodationModel.create(input);
            expect(acc).toEqual(mockAccommodation);
        });
        it('throws if insert fails', async () => {
            mockDb.insert.mockReturnThis();
            mockDb.values.mockReturnThis();
            mockDb.returning.mockReturnValueOnce(undefined);
            await expect(
                AccommodationModel.create({
                    ...mockAccommodation,
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
                AccommodationModel.create({
                    ...mockAccommodation,
                    id: undefined,
                    createdAt: undefined,
                    updatedAt: undefined,
                    createdById: undefined,
                    updatedById: undefined
                })
            ).rejects.toThrow('Failed to create accommodation: fail');
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('update', () => {
        it('returns updated accommodation', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ ...mockAccommodation }]);
            const input: UpdateAccommodationInputType = { summary: 'Updated' };
            const acc = await AccommodationModel.update('acc-uuid', input);
            expect(acc).toEqual(mockAccommodation);
        });
        it('returns undefined if not found', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const acc = await AccommodationModel.update('not-exist', { summary: 'Updated' });
            expect(acc).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.update.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AccommodationModel.update('err', { summary: 'fail' })).rejects.toThrow(
                'Failed to update accommodation: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('delete', () => {
        it('returns id if deleted', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ id: 'acc-uuid' }]);
            const result = await AccommodationModel.delete('acc-uuid', 'user-uuid');
            expect(result).toEqual({ id: 'acc-uuid' });
        });
        it('returns undefined if not found', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const result = await AccommodationModel.delete('not-exist', 'user-uuid');
            expect(result).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.update.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AccommodationModel.delete('err', 'user-uuid')).rejects.toThrow(
                'Failed to delete accommodation: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('hardDelete', () => {
        it('returns true if deleted', async () => {
            mockDb.delete.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{}]);
            const result = await AccommodationModel.hardDelete('acc-uuid');
            expect(result).toBe(true);
        });
        it('returns false if not found', async () => {
            mockDb.delete.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const result = await AccommodationModel.hardDelete('not-exist');
            expect(result).toBe(false);
        });
        it('logs and throws on db error', async () => {
            mockDb.delete.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AccommodationModel.hardDelete('err')).rejects.toThrow(
                'Failed to hard delete accommodation: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('list', () => {
        it('returns accommodations with pagination', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([{ ...mockAccommodation }]);
            const accs = await AccommodationModel.list({ limit: 10, offset: 0 });
            expect(accs).toEqual([mockAccommodation]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([]);
            const accs = await AccommodationModel.list({ limit: 10, offset: 0 });
            expect(accs).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AccommodationModel.list({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to list accommodations: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('search', () => {
        it('returns accommodations matching search', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([{ ...mockAccommodation }]);
            const accs = await AccommodationModel.search({ limit: 10, offset: 0 });
            expect(accs).toEqual([mockAccommodation]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([]);
            const accs = await AccommodationModel.search({ limit: 10, offset: 0 });
            expect(accs).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AccommodationModel.search({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to search accommodations: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
        it('should find by text in name', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([
                { ...mockAccommodation, name: 'UniqueName', summary: 'Sum', description: 'Desc' }
            ] as AccommodationType[]);
            const result = (await AccommodationModel.search({
                q: 'UniqueName',
                limit: 10,
                offset: 0
            })) as AccommodationType[];
            expect(result).not.toHaveLength(0);
            expect(result[0]?.name).toBe('UniqueName');
        });
        it('should find by text in summary', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([
                { ...mockAccommodation, name: 'N', summary: 'SpecialSummary', description: 'Desc' }
            ] as AccommodationType[]);
            const result = (await AccommodationModel.search({
                q: 'SpecialSummary',
                limit: 10,
                offset: 0
            })) as AccommodationType[];
            expect(result).not.toHaveLength(0);
            expect(result[0]?.summary).toBe('SpecialSummary');
        });
        it('should find by text in description', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([
                { ...mockAccommodation, name: 'N', summary: 'S', description: 'SpecialDescription' }
            ] as AccommodationType[]);
            const result = (await AccommodationModel.search({
                q: 'SpecialDescription',
                limit: 10,
                offset: 0
            })) as AccommodationType[];
            expect(result).not.toHaveLength(0);
            expect(result[0]?.description).toBe('SpecialDescription');
        });
        it('should return empty array if no match', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([]);
            const result = await AccommodationModel.search({ q: 'NoMatch', limit: 10, offset: 0 });
            expect(result).toEqual([]);
        });
    });

    describe('count', () => {
        it('returns count of accommodations', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnValue({
                where: () => [{ count: 5 }]
            });
            const count = await AccommodationModel.count({ limit: 10, offset: 0 });
            expect(count).toBe(5);
        });
        it('returns 0 if no accommodations', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnValue({
                where: () => []
            });
            const count = await AccommodationModel.count({ limit: 10, offset: 0 });
            expect(count).toBe(0);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AccommodationModel.count({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to count accommodations: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getWithRelations', () => {
        it('returns accommodation with relations', async () => {
            mockDb.query.accommodations.findFirst.mockResolvedValueOnce({
                ...mockAccommodation,
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
                owner: {
                    id: 'user-uuid',
                    userName: 'owner',
                    password: 'pw',
                    role: 'role',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    lifecycleState: LifecycleStatusEnum.ACTIVE,
                    adminInfo: undefined
                },
                destination: {
                    id: 'dest-uuid',
                    slug: 'dest',
                    name: 'Destino',
                    summary: '',
                    description: '',
                    location: { lat: 0, lng: 0 },
                    media: { url: '' },
                    visibility: VisibilityEnum.PUBLIC,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    lifecycleState: LifecycleStatusEnum.ACTIVE,
                    moderationState: ModerationStatusEnum.PENDING_REVIEW,
                    adminInfo: undefined
                }
            });
            const acc = await AccommodationModel.getWithRelations('acc-uuid', {
                tags: true,
                owner: true,
                destination: true
            });
            expect(acc).toHaveProperty('tags');
            expect(acc).toHaveProperty('owner');
            expect(acc).toHaveProperty('destination');
        });
        it('returns undefined if not found', async () => {
            mockDb.query.accommodations.findFirst.mockResolvedValueOnce(undefined);
            const acc = await AccommodationModel.getWithRelations('not-exist', { tags: true });
            expect(acc).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.query.accommodations.findFirst.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(
                AccommodationModel.getWithRelations('err', { tags: true })
            ).rejects.toThrow('Failed to get accommodation with relations: fail');
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('list with relations', () => {
        it('returns accommodations with destination (only id, slug, name)', async () => {
            mockDb.query.accommodations.findMany.mockResolvedValueOnce([
                {
                    ...mockAccommodation,
                    destination: {
                        id: 'dest-1',
                        slug: 'slug-1',
                        name: 'Destino 1'
                    }
                }
            ] as AccommodationWithRelationsType[]);
            const accs = (await AccommodationModel.list(
                { limit: 10, offset: 0 },
                { destination: true }
            )) as AccommodationWithRelationsType[];
            expect(accs[0]?.destination).toEqual({
                id: 'dest-1',
                slug: 'slug-1',
                name: 'Destino 1'
            });
        });
        it('returns accommodations with features and amenities', async () => {
            mockDb.query.accommodations.findMany.mockResolvedValueOnce([
                {
                    ...mockAccommodation,
                    features: [{ id: 'f1', name: 'WiFi' }],
                    amenities: [{ id: 'a1', name: 'Pool' }]
                }
            ] as AccommodationWithRelationsType[]);
            const accs = (await AccommodationModel.list(
                { limit: 10, offset: 0 },
                { features: true, amenities: true }
            )) as AccommodationWithRelationsType[];
            expect(accs[0]?.features).toEqual([{ id: 'f1', name: 'WiFi' }]);
            expect(accs[0]?.amenities).toEqual([{ id: 'a1', name: 'Pool' }]);
        });
        it('returns accommodations with all relations', async () => {
            mockDb.query.accommodations.findMany.mockResolvedValueOnce([
                {
                    ...mockAccommodation,
                    destination: { id: 'd', slug: 's', name: 'N' },
                    features: [{ id: 'f', name: 'F' }],
                    amenities: [{ id: 'a', name: 'A' }]
                }
            ] as AccommodationWithRelationsType[]);
            const accs = (await AccommodationModel.list(
                { limit: 10, offset: 0 },
                { destination: true, features: true, amenities: true }
            )) as AccommodationWithRelationsType[];
            expect(accs[0]?.destination).toEqual({ id: 'd', slug: 's', name: 'N' });
            expect(accs[0]?.features).toEqual([{ id: 'f', name: 'F' }]);
            expect(accs[0]?.amenities).toEqual([{ id: 'a', name: 'A' }]);
        });
        it('returns empty array if none found (with relations)', async () => {
            mockDb.query.accommodations.findMany.mockResolvedValueOnce([]);
            const accs = (await AccommodationModel.list(
                { limit: 10, offset: 0 },
                { destination: true }
            )) as AccommodationWithRelationsType[];
            expect(accs).toEqual([]);
        });
        it('returns accommodations with empty relations arrays', async () => {
            mockDb.query.accommodations.findMany.mockResolvedValueOnce([
                { ...mockAccommodation, features: [], amenities: [] }
            ] as AccommodationWithRelationsType[]);
            const accs = (await AccommodationModel.list(
                { limit: 10, offset: 0 },
                { features: true, amenities: true }
            )) as AccommodationWithRelationsType[];
            expect(accs[0]?.features).toEqual([]);
            expect(accs[0]?.amenities).toEqual([]);
        });
    });

    describe('search with relations', () => {
        it('returns accommodations with destination (only id, slug, name)', async () => {
            mockDb.query.accommodations.findMany.mockResolvedValueOnce([
                {
                    ...mockAccommodation,
                    destination: {
                        id: 'dest-2',
                        slug: 'slug-2',
                        name: 'Destino 2'
                    }
                }
            ] as AccommodationWithRelationsType[]);
            const accs = (await AccommodationModel.search(
                { limit: 10, offset: 0 },
                { destination: true }
            )) as AccommodationWithRelationsType[];
            expect(accs[0]?.destination).toEqual({
                id: 'dest-2',
                slug: 'slug-2',
                name: 'Destino 2'
            });
        });
        it('returns accommodations with features and amenities', async () => {
            mockDb.query.accommodations.findMany.mockResolvedValueOnce([
                {
                    ...mockAccommodation,
                    features: [{ id: 'f2', name: 'WiFi' }],
                    amenities: [{ id: 'a2', name: 'Pool' }]
                }
            ] as AccommodationWithRelationsType[]);
            const accs = (await AccommodationModel.search(
                { limit: 10, offset: 0 },
                { features: true, amenities: true }
            )) as AccommodationWithRelationsType[];
            expect(accs[0]?.features).toEqual([{ id: 'f2', name: 'WiFi' }]);
            expect(accs[0]?.amenities).toEqual([{ id: 'a2', name: 'Pool' }]);
        });
        it('returns accommodations with all relations', async () => {
            mockDb.query.accommodations.findMany.mockResolvedValueOnce([
                {
                    ...mockAccommodation,
                    destination: { id: 'd2', slug: 's2', name: 'N2' },
                    features: [{ id: 'f2', name: 'F2' }],
                    amenities: [{ id: 'a2', name: 'A2' }]
                }
            ] as AccommodationWithRelationsType[]);
            const accs = (await AccommodationModel.search(
                { limit: 10, offset: 0 },
                { destination: true, features: true, amenities: true }
            )) as AccommodationWithRelationsType[];
            expect(accs[0]?.destination).toEqual({ id: 'd2', slug: 's2', name: 'N2' });
            expect(accs[0]?.features).toEqual([{ id: 'f2', name: 'F2' }]);
            expect(accs[0]?.amenities).toEqual([{ id: 'a2', name: 'A2' }]);
        });
        it('returns empty array if none found (with relations)', async () => {
            mockDb.query.accommodations.findMany.mockResolvedValueOnce([]);
            const accs = (await AccommodationModel.search(
                { limit: 10, offset: 0 },
                { destination: true }
            )) as AccommodationWithRelationsType[];
            expect(accs).toEqual([]);
        });
        it('returns accommodations with empty relations arrays', async () => {
            mockDb.query.accommodations.findMany.mockResolvedValueOnce([
                { ...mockAccommodation, features: [], amenities: [] }
            ] as AccommodationWithRelationsType[]);
            const accs = (await AccommodationModel.search(
                { limit: 10, offset: 0 },
                { features: true, amenities: true }
            )) as AccommodationWithRelationsType[];
            expect(accs[0]?.features).toEqual([]);
            expect(accs[0]?.amenities).toEqual([]);
        });
    });
});
