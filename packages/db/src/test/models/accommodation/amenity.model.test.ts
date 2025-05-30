import type {
    AmenityId,
    AmenityType,
    NewAmenityInputType,
    UpdateAmenityInputType,
    UserId
} from '@repo/types';
import { AmenitiesTypeEnum, LifecycleStatusEnum } from '@repo/types';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../../../../src/client';
import { AmenityModel } from '../../../../src/models/accommodation/amenity.model';
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
        amenities: {
            findFirst: vi.fn()
        }
    }
};

(getDb as unknown as Mock).mockReturnValue(mockDb);

const amenityId = 'amenity-uuid' as AmenityId;
const userId = 'user-uuid' as UserId;
const baseAmenity: AmenityType = {
    id: amenityId,
    name: 'WiFi',
    description: 'Wireless Internet',
    icon: 'wifi',
    isBuiltin: true,
    type: AmenitiesTypeEnum.CONNECTIVITY,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    adminInfo: { favorite: false },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: userId,
    updatedById: userId,
    deletedAt: undefined,
    deletedById: undefined
};

describe('AmenityModel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getById', () => {
        it('returns amenity if found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([{ ...baseAmenity }]);
            const amenity = await AmenityModel.getById('amenity-uuid');
            expect(amenity).toEqual(baseAmenity);
        });
        it('returns undefined if not found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([]);
            const amenity = await AmenityModel.getById('not-exist');
            expect(amenity).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AmenityModel.getById('err')).rejects.toThrow(
                'Failed to get amenity by id: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByName', () => {
        it('returns amenity if found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([{ ...baseAmenity }]);
            const amenity = await AmenityModel.getByName('WiFi');
            expect(amenity).toEqual(baseAmenity);
        });
        it('returns undefined if not found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.limit.mockReturnValueOnce([]);
            const amenity = await AmenityModel.getByName('not-exist');
            expect(amenity).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AmenityModel.getByName('err')).rejects.toThrow(
                'Failed to get amenity by name: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByType', () => {
        it('returns amenities of given type', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([{ ...baseAmenity }]);
            const amenities = await AmenityModel.getByType('CONNECTIVITY');
            expect(amenities).toEqual([baseAmenity]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.where.mockReturnValueOnce([]);
            const amenities = await AmenityModel.getByType('NOTYPE');
            expect(amenities).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AmenityModel.getByType('err')).rejects.toThrow(
                'Failed to get amenities by type: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getByAccommodation', () => {
        it('returns amenities for accommodation', async () => {
            const joinResult = [{ amenities: { ...baseAmenity }, rAccommodationAmenity: {} }];
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.innerJoin.mockReturnValueOnce(joinResult);
            const amenities = await AmenityModel.getByAccommodation('accommodation-uuid');
            expect(amenities).toEqual([baseAmenity]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.innerJoin.mockReturnValueOnce({
                where: vi.fn().mockReturnValueOnce([])
            });
            const amenities = await AmenityModel.getByAccommodation('not-exist');
            expect(amenities).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AmenityModel.getByAccommodation('err')).rejects.toThrow(
                'Failed to get amenities by accommodation: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('create', () => {
        it('returns created amenity', async () => {
            mockDb.insert.mockReturnThis();
            mockDb.values.mockReturnThis();
            mockDb.returning = vi.fn().mockReturnValueOnce([{ ...baseAmenity }]);
            const input: NewAmenityInputType = {
                name: 'WiFi',
                isBuiltin: true,
                type: AmenitiesTypeEnum.CONNECTIVITY,
                lifecycleState: LifecycleStatusEnum.ACTIVE
            } as NewAmenityInputType;
            const amenity = await AmenityModel.create(input);
            expect(amenity).toEqual(baseAmenity);
        });
        it('throws if insert fails', async () => {
            mockDb.insert.mockReturnThis();
            mockDb.values.mockReturnThis();
            mockDb.returning = vi.fn().mockReturnValueOnce(undefined);
            await expect(
                AmenityModel.create({
                    name: 'fail',
                    isBuiltin: false,
                    type: AmenitiesTypeEnum.KITCHEN,
                    lifecycleState: LifecycleStatusEnum.ACTIVE
                } as NewAmenityInputType)
            ).rejects.toThrow('Insert failed');
        });
        it('logs and throws on db error', async () => {
            mockDb.insert.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(
                AmenityModel.create({
                    name: 'fail',
                    isBuiltin: false,
                    type: AmenitiesTypeEnum.KITCHEN,
                    lifecycleState: LifecycleStatusEnum.ACTIVE
                } as NewAmenityInputType)
            ).rejects.toThrow('Failed to create amenity: fail');
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('update', () => {
        it('returns updated amenity', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnValueOnce({
                returning: vi.fn().mockReturnValueOnce([{ ...baseAmenity }])
            });
            const input: UpdateAmenityInputType = { name: 'Updated' };
            const amenity = await AmenityModel.update('amenity-uuid', input);
            expect(amenity).toEqual(baseAmenity);
        });
        it('returns undefined if not found', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnValueOnce({
                returning: vi.fn().mockReturnValueOnce([])
            });
            const amenity = await AmenityModel.update('not-exist', { name: 'Updated' });
            expect(amenity).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.update.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AmenityModel.update('err', { name: 'fail' })).rejects.toThrow(
                'Failed to update amenity: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('delete', () => {
        it('returns id if deleted', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnValueOnce({
                returning: vi.fn().mockReturnValueOnce([{ id: amenityId }])
            });
            const result = await AmenityModel.delete('amenity-uuid', 'user-uuid');
            expect(result).toEqual({ id: amenityId });
        });
        it('returns undefined if not found', async () => {
            mockDb.update.mockReturnThis();
            mockDb.set.mockReturnThis();
            mockDb.where.mockReturnValueOnce({
                returning: vi.fn().mockReturnValueOnce([])
            });
            const result = await AmenityModel.delete('not-exist', 'user-uuid');
            expect(result).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.update.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AmenityModel.delete('err', 'user-uuid')).rejects.toThrow(
                'Failed to delete amenity: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('hardDelete', () => {
        it('returns true if deleted', async () => {
            mockDb.delete.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([{}]);
            const result = await AmenityModel.hardDelete('amenity-uuid');
            expect(result).toBe(true);
        });
        it('returns false if not found', async () => {
            mockDb.delete.mockReturnThis();
            mockDb.where.mockReturnThis();
            mockDb.returning.mockReturnValueOnce([]);
            const result = await AmenityModel.hardDelete('not-exist');
            expect(result).toBe(false);
        });
        it('logs and throws on db error', async () => {
            mockDb.delete.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AmenityModel.hardDelete('err')).rejects.toThrow(
                'Failed to hard delete amenity: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('list', () => {
        it('returns amenities with pagination', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([{ ...baseAmenity }]);
            const amenities = await AmenityModel.list({ limit: 10, offset: 0 });
            expect(amenities).toEqual([baseAmenity]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([]);
            const amenities = await AmenityModel.list({ limit: 10, offset: 0 });
            expect(amenities).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AmenityModel.list({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to list amenities: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('search', () => {
        it('returns amenities matching search', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([{ ...baseAmenity }]);
            const amenities = await AmenityModel.search({ limit: 10, offset: 0 });
            expect(amenities).toEqual([baseAmenity]);
        });
        it('returns empty array if none found', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnThis();
            mockDb.orderBy.mockReturnThis();
            mockDb.limit.mockReturnThis();
            mockDb.offset.mockReturnValueOnce([]);
            const amenities = await AmenityModel.search({ limit: 10, offset: 0 });
            expect(amenities).toEqual([]);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AmenityModel.search({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to search amenities: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('count', () => {
        it('returns count of amenities', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnValueOnce([{ count: 5 }]);
            const count = await AmenityModel.count({ limit: 10, offset: 0 });
            expect(count).toBe(5);
        });
        it('returns 0 if no amenities', async () => {
            mockDb.select.mockReturnThis();
            mockDb.from.mockReturnValueOnce([]);
            const count = await AmenityModel.count({ limit: 10, offset: 0 });
            expect(count).toBe(0);
        });
        it('logs and throws on db error', async () => {
            mockDb.select.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(AmenityModel.count({ limit: 10, offset: 0 })).rejects.toThrow(
                'Failed to count amenities: fail'
            );
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });

    describe('getWithRelations', () => {
        it('returns amenity with relations', async () => {
            mockDb.query.amenities.findFirst.mockResolvedValueOnce({
                ...baseAmenity,
                accommodations: [{ id: 'accommodation-uuid' }]
            });
            const amenity = await AmenityModel.getWithRelations('amenity-uuid', {
                accommodations: true
            });
            expect(amenity).toHaveProperty('accommodations');
        });
        it('returns undefined if not found', async () => {
            mockDb.query.amenities.findFirst.mockResolvedValueOnce(undefined);
            const amenity = await AmenityModel.getWithRelations('not-exist', {
                accommodations: true
            });
            expect(amenity).toBeUndefined();
        });
        it('logs and throws on db error', async () => {
            mockDb.query.amenities.findFirst.mockImplementationOnce(() => {
                throw new Error('fail');
            });
            await expect(
                AmenityModel.getWithRelations('err', { accommodations: true })
            ).rejects.toThrow('Failed to get amenity with relations: fail');
            expect(dbLogger.error).toHaveBeenCalled();
        });
    });
});
