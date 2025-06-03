import {
    AccommodationTypeEnum,
    LifecycleStatusEnum,
    ModerationStatusEnum,
    VisibilityEnum
} from '@repo/types';
import type {
    NewAccommodationInputType,
    UpdateAccommodationInputType
} from '@repo/types/entities/accommodation/accommodation.types';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../../../../src/client';
import { AccommodationModel } from '../../../../src/models/accommodation/accommodation.model';
import { dbLogger } from '../../../../src/utils/logger';
import { mockAccommodation } from '../../mockData';

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
            findFirst: vi.fn()
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

    describe('getByTag', () => {
        beforeEach(() => {
            mockDb.innerJoin.mockReset();
        });
        it('returns accommodations for given tag', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.innerJoin.mockReturnValueOnce([
                { accommodations: { ...mockAccommodation }, rEntityTag: {} }
            ]);
            const accs = await AccommodationModel.getByTag('tag-uuid');
            expect(accs).toEqual([mockAccommodation]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.innerJoin.mockReturnValueOnce([]);
            const accs = await AccommodationModel.getByTag('not-exist');
            expect(accs).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AccommodationModel.getByTag('err')).rejects.toThrow(
                'Failed to get accommodations by tag: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByOwner', () => {
        beforeEach(() => {
            mockDb.where.mockReset();
        });
        it('returns accommodations for given owner', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([mockAccommodation]);
            const accs = await AccommodationModel.getByOwner('user-uuid');
            expect(accs).toEqual([mockAccommodation]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([]);
            const accs = await AccommodationModel.getByOwner('not-exist');
            expect(accs).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AccommodationModel.getByOwner('err')).rejects.toThrow(
                'Failed to get accommodations by owner: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByDestination', () => {
        beforeEach(() => {
            mockDb.where.mockReset();
        });
        it('returns accommodations for given destination', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([mockAccommodation]);
            const accs = await AccommodationModel.getByDestination('dest-uuid');
            expect(accs).toEqual([mockAccommodation]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([]);
            const accs = await AccommodationModel.getByDestination('not-exist');
            expect(accs).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AccommodationModel.getByDestination('err')).rejects.toThrow(
                'Failed to get accommodations by destination: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });
});
