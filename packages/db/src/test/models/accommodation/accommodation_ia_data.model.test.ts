import { LifecycleStatusEnum } from '@repo/types';
import type { AccommodationIaDataId, AccommodationId, UserId } from '@repo/types/common/id.types';
import type {
    AccommodationIaDataType,
    NewAccommodationIaDataInputType,
    UpdateAccommodationIaDataInputType
} from '@repo/types/entities/accommodation/accommodation.ia.types';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../../../../src/client';
import { AccommodationIaDataModel } from '../../../../src/models/accommodation/accommodation_ia_data.model';
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
    query: {}
};
(getDb as unknown as Mock).mockReturnValue(mockDb);

const baseIaData: AccommodationIaDataType = {
    id: 'ia-uuid' as AccommodationIaDataId,
    accommodationId: 'acc-uuid' as AccommodationId,
    title: 'IA Title',
    content: 'Some content',
    category: 'summary',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: undefined,
    createdById: 'user-uuid' as UserId,
    updatedById: 'user-uuid' as UserId,
    deletedById: undefined,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    adminInfo: undefined
};

describe('AccommodationIaDataModel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getById', () => {
        it('returns iaData if found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([{ ...baseIaData }]);
            const res = await AccommodationIaDataModel.getById('ia-uuid');
            expect(res).toEqual(baseIaData);
        });
        it('returns undefined if not found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([]);
            const res = await AccommodationIaDataModel.getById('not-exist');
            expect(res).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AccommodationIaDataModel.getById('err')).rejects.toThrow(
                'Failed to get accommodation IA data by id: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByAccommodation', () => {
        it('returns iaData array', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([{ ...baseIaData }]);
            const res = await AccommodationIaDataModel.getByAccommodation('acc-uuid');
            expect(res).toEqual([baseIaData]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([]);
            const res = await AccommodationIaDataModel.getByAccommodation('nope');
            expect(res).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AccommodationIaDataModel.getByAccommodation('err')).rejects.toThrow(
                'Failed to get accommodation IA data by accommodation: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('create', () => {
        it('returns created iaData', async () => {
            mockDb.insert.mockReturnThis();
            mockDb.values.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ ...baseIaData }]);
            const input: NewAccommodationIaDataInputType = {
                title: baseIaData.title,
                content: baseIaData.content,
                category: baseIaData.category,
                accommodationId: baseIaData.accommodationId,
                adminInfo: baseIaData.adminInfo,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            };
            const res = await AccommodationIaDataModel.create(input);
            expect(res).toEqual(baseIaData);
        });
        it('throws if insert fails', async () => {
            mockDb.insert.mockReturnThis();
            mockDb.values.mockReturnThis();
            mockDb.returning.mockReturnValueOnce(undefined);
            const input: NewAccommodationIaDataInputType = {
                title: baseIaData.title,
                content: baseIaData.content,
                category: baseIaData.category,
                accommodationId: baseIaData.accommodationId,
                adminInfo: baseIaData.adminInfo,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            };
            await expect(AccommodationIaDataModel.create(input)).rejects.toThrow('Insert failed');
        });
        it('logs and throws on db error', async () => {
            mockDb.insert.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            const input: NewAccommodationIaDataInputType = {
                title: baseIaData.title,
                content: baseIaData.content,
                category: baseIaData.category,
                accommodationId: baseIaData.accommodationId,
                adminInfo: baseIaData.adminInfo,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            };
            await expect(AccommodationIaDataModel.create(input)).rejects.toThrow(
                'Failed to create accommodation IA data: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('update', () => {
        it('returns updated iaData', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ ...baseIaData, title: 'Nuevo' }]);
            const input: UpdateAccommodationIaDataInputType = { title: 'Nuevo' };
            const res = await AccommodationIaDataModel.update('ia-uuid', input);
            expect(res).toEqual({ ...baseIaData, title: 'Nuevo' });
        });
        it('returns undefined if not found', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const input: UpdateAccommodationIaDataInputType = { title: 'Nuevo' };
            const res = await AccommodationIaDataModel.update('not-exist', input);
            expect(res).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.update.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            const input: UpdateAccommodationIaDataInputType = { title: 'Nuevo' };
            await expect(AccommodationIaDataModel.update('err', input)).rejects.toThrow(
                'Failed to update accommodation IA data: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('delete', () => {
        it('returns deleted id', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{ id: 'ia-uuid' }]);
            const res = await AccommodationIaDataModel.delete('ia-uuid', 'user-uuid');
            expect(res).toEqual({ id: 'ia-uuid' });
        });
        it('returns undefined if not found', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const res = await AccommodationIaDataModel.delete('not-exist', 'user-uuid');
            expect(res).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.update.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AccommodationIaDataModel.delete('err', 'user-uuid')).rejects.toThrow(
                'Failed to delete accommodation IA data: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('hardDelete', () => {
        it('returns true if deleted', async () => {
            mockDb.delete.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{}]);
            const res = await AccommodationIaDataModel.hardDelete('ia-uuid');
            expect(res).toBe(true);
        });
        it('returns false if not found', async () => {
            mockDb.delete.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const res = await AccommodationIaDataModel.hardDelete('not-exist');
            expect(res).toBe(false);
        });
        it('logs and throws on db error', async () => {
            mockDb.delete.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AccommodationIaDataModel.hardDelete('err')).rejects.toThrow(
                'Failed to hard delete accommodation IA data: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('list', () => {
        it('returns paginated iaData', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([{ ...baseIaData }]);
            const res = await AccommodationIaDataModel.list({ limit: 10, offset: 0 });
            expect(res).toEqual([baseIaData]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([]);
            const res = await AccommodationIaDataModel.list({ limit: 10, offset: 0 });
            expect(res).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AccommodationIaDataModel.list({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to list accommodation IA data: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('search', () => {
        it('returns found iaData', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([{ ...baseIaData }]);
            const res = await AccommodationIaDataModel.search({ limit: 10, offset: 0 });
            expect(res).toEqual([baseIaData]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([]);
            const res = await AccommodationIaDataModel.search({ limit: 10, offset: 0 });
            expect(res).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AccommodationIaDataModel.search({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to search accommodation IA data: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('count', () => {
        it('returns count', async () => {
            const whereMock = vi.fn().mockReturnValueOnce([{ count: 5 }]);
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnValue({ where: whereMock });
            const res = await AccommodationIaDataModel.count({ limit: 10, offset: 0 });
            expect(res).toBe(5);
        });
        it('returns 0 if not found', async () => {
            const whereMock = vi.fn().mockReturnValueOnce([{}]);
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnValue({ where: whereMock });
            const res = await AccommodationIaDataModel.count({ limit: 10, offset: 0 });
            expect(res).toBe(0);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AccommodationIaDataModel.count({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to count accommodation IA data: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });
});
