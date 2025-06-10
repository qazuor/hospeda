import type { NewFeatureInputType } from '@repo/types';
import { LifecycleStatusEnum } from '@repo/types';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../../../../src/client';
import { FeatureModel } from '../../../../src/models/accommodation/feature.model';
import { dbLogger } from '../../../../src/utils/logger';
import { mockFeature } from '../mockData';

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
        features: {
            findFirst: vi.fn()
        }
    }
};

(getDb as unknown as Mock).mockReturnValue(mockDb);

describe('FeatureModel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getById', () => {
        it('returns feature if found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([{ ...mockFeature }]);
            const feature = await FeatureModel.getById('feature-uuid');
            expect(feature).toEqual(mockFeature);
        });
        it('returns undefined if not found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([]);
            const feature = await FeatureModel.getById('not-exist');
            expect(feature).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(FeatureModel.getById('err')).rejects.toThrow(
                'Failed to get feature by id: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByName', () => {
        it('returns feature if found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([{ ...mockFeature }]);
            const feature = await FeatureModel.getByName('General Feature');
            expect(feature).toEqual(mockFeature);
        });
        it('returns undefined if not found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([]);
            const feature = await FeatureModel.getByName('not-exist');
            expect(feature).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(FeatureModel.getByName('err')).rejects.toThrow(
                'Failed to get feature by name: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByAccommodation', () => {
        it('returns features for accommodation', async () => {
            const joinResult = [{ features: { ...mockFeature }, rAccommodationFeature: {} }];
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.innerJoin.mockReturnValueOnce(joinResult);
            const features = await FeatureModel.getByAccommodation('accommodation-uuid');
            expect(features).toEqual([mockFeature]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.innerJoin.mockReturnValueOnce([]);
            const features = await FeatureModel.getByAccommodation('not-exist');
            expect(features).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(FeatureModel.getByAccommodation('err')).rejects.toThrow(
                'Failed to get features by accommodation: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('create', () => {
        it('returns created feature', async () => {
            mockDb.insert.mockReturnThis();
            mockDb.values.mockReturnThis();
            mockDb.returning = vi.fn().mockReturnValueOnce([{ ...mockFeature }]);
            const input: NewFeatureInputType = {
                name: 'General Feature',
                isBuiltin: true,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            } as NewFeatureInputType;
            const feature = await FeatureModel.create(input);
            expect(feature).toEqual(mockFeature);
        });
        it('throws if insert fails', async () => {
            mockDb.insert.mockReturnThis();
            mockDb.values.mockReturnThis();
            mockDb.returning = vi.fn().mockReturnValueOnce(undefined);
            await expect(
                FeatureModel.create({
                    name: 'fail',
                    isBuiltin: false,
                    lifecycleState: LifecycleStatusEnum.ACTIVE
                } as NewFeatureInputType)
            ).rejects.toThrow('Insert failed');
        });
        it('logs and throws on db error', async () => {
            mockDb.insert.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(
                FeatureModel.create({
                    name: 'fail',
                    isBuiltin: false,
                    lifecycleState: LifecycleStatusEnum.ACTIVE
                } as NewFeatureInputType)
            ).rejects.toThrow('Failed to create feature: fail');
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('update', () => {
        it('returns updated feature', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnValueOnce({
                returning: vi.fn().mockReturnValueOnce([{ ...mockFeature }])
            });
            const input = { name: 'Updated' };
            const feature = await FeatureModel.update('feature-uuid', input);
            expect(feature).toEqual(mockFeature);
        });
        it('returns undefined if not found', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnValueOnce({
                returning: vi.fn().mockReturnValueOnce([])
            });
            const feature = await FeatureModel.update('not-exist', { name: 'Updated' });
            expect(feature).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.update.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(FeatureModel.update('err', { name: 'fail' })).rejects.toThrow(
                'Failed to update feature: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('delete', () => {
        it('returns id if deleted', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnValueOnce({
                returning: vi.fn().mockReturnValueOnce([{ id: 'feature-uuid' }])
            });
            const result = await FeatureModel.delete('feature-uuid', 'user-uuid');
            expect(result).toEqual({ id: 'feature-uuid' });
        });
        it('returns undefined if not found', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnValueOnce({
                returning: vi.fn().mockReturnValueOnce([])
            });
            const result = await FeatureModel.delete('not-exist', 'user-uuid');
            expect(result).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.update.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(FeatureModel.delete('err', 'user-uuid')).rejects.toThrow(
                'Failed to delete feature: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('hardDelete', () => {
        it('returns true if deleted', async () => {
            mockDb.delete.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{}]);
            const result = await FeatureModel.hardDelete('feature-uuid');
            expect(result).toBe(true);
        });
        it('returns false if not found', async () => {
            mockDb.delete.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const result = await FeatureModel.hardDelete('not-exist');
            expect(result).toBe(false);
        });
        it('logs and throws on db error', async () => {
            mockDb.delete.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(FeatureModel.hardDelete('err')).rejects.toThrow(
                'Failed to hard delete feature: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('list', () => {
        it('returns features with pagination', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([{ ...mockFeature }]);
            const features = await FeatureModel.list({ limit: 10, offset: 0 });
            expect(features).toEqual([mockFeature]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([]);
            const features = await FeatureModel.list({ limit: 10, offset: 0 });
            expect(features).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(FeatureModel.list({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to list features: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('search', () => {
        it('returns features matching search', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([{ ...mockFeature }]);
            const features = await FeatureModel.search({ limit: 10, offset: 0 });
            expect(features).toEqual([mockFeature]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([]);
            const features = await FeatureModel.search({ limit: 10, offset: 0 });
            expect(features).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(FeatureModel.search({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to search features: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('count', () => {
        it('returns count of features', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnValueOnce([{ count: 5 }]);
            const count = await FeatureModel.count({ limit: 10, offset: 0 });
            expect(count).toBe(5);
        });
        it('returns 0 if no features', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnValueOnce([]);
            const count = await FeatureModel.count({ limit: 10, offset: 0 });
            expect(count).toBe(0);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(FeatureModel.count({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to count features: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getWithRelations', () => {
        it('returns feature with relations', async () => {
            mockDb.query.features.findFirst.mockResolvedValueOnce({
                ...mockFeature,
                accommodations: [{ id: 'accommodation-uuid' }]
            });
            const feature = await FeatureModel.getWithRelations('feature-uuid', {
                accommodations: true
            });
            expect(feature).toHaveProperty('accommodations');
        });
        it('returns undefined if not found', async () => {
            mockDb.query.features.findFirst.mockResolvedValueOnce(undefined);
            const feature = await FeatureModel.getWithRelations('not-exist', {
                accommodations: true
            });
            expect(feature).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.query.features.findFirst.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(
                FeatureModel.getWithRelations('err', { accommodations: true })
            ).rejects.toThrow('Failed to get feature with relations: fail');
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });
});
