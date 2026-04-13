import type { AccommodationIdType, AmenityIdType } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { RAccommodationAmenityModel } from '../../src/models/accommodation/rAccommodationAmenity.model';
import { DbError } from '../../src/utils/error';
import { createDrizzleRelationMock } from '../utils/drizzle-mock';

vi.mock('../../src/utils/logger');

const model = new RAccommodationAmenityModel();
const asAccommodationId = (id: string) => id as unknown as AccommodationIdType;
const asAmenityId = (id: string) => id as unknown as AmenityIdType;

/**
 * Test suite for RAccommodationAmenityModel.
 * Uses '@ts-expect-error' in Drizzle mocks because it is not possible to replicate the full RelationalQueryBuilder interface in tests. Only the used methods (findFirst, etc.) are mocked.
 * This is documented and justified according to project rules.
 */

describe('RAccommodationAmenityModel', () => {
    beforeEach(() => {
        vi.spyOn(dbUtils, 'getDb');
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('findWithRelations - relación encontrada', async () => {
        const rAccommodationAmenityMock = createDrizzleRelationMock({
            findFirst: vi.fn().mockResolvedValue({
                accommodationId: asAccommodationId('a'),
                amenityId: asAmenityId('b'),
                accommodation: {},
                amenity: {}
            })
        });
        vi.mocked(dbUtils.getDb).mockReturnValue({
            query: {
                // @ts-ignore: mock Drizzle relation for test
                rAccommodationAmenity: rAccommodationAmenityMock
            }
        });
        const result = await model.findWithRelations(
            { accommodationId: asAccommodationId('a') },
            { accommodation: true }
        );
        expect(result).toBeTruthy();
        expect((result as { accommodation?: unknown }).accommodation).toBeDefined();
    });

    it('findWithRelations - sin relaciones, fallback a findOne', async () => {
        const dummy = {
            accommodationId: asAccommodationId('a'),
            amenityId: asAmenityId('b'),
            isOptional: false
        };
        const spy = vi.spyOn(model, 'findOne').mockResolvedValue(dummy);
        const result = await model.findWithRelations(
            { accommodationId: asAccommodationId('a') },
            {}
        );
        expect(spy).toHaveBeenCalled();
        expect(result).toBeTruthy();
    });

    it('findWithRelations - no encontrada', async () => {
        const rAccommodationAmenityMock = createDrizzleRelationMock({
            findFirst: vi.fn().mockResolvedValue(null)
        });
        vi.mocked(dbUtils.getDb).mockReturnValue({
            query: {
                // @ts-ignore: mock Drizzle relation for test
                rAccommodationAmenity: rAccommodationAmenityMock
            }
        });
        const result = await model.findWithRelations(
            { accommodationId: asAccommodationId('x') },
            { accommodation: true }
        );
        expect(result).toBeNull();
    });

    it('findWithRelations - error de DB', async () => {
        const rAccommodationAmenityMock = createDrizzleRelationMock({
            findFirst: vi.fn().mockRejectedValue(new Error('fail'))
        });
        vi.mocked(dbUtils.getDb).mockReturnValue({
            query: {
                // @ts-ignore: mock Drizzle relation for test
                rAccommodationAmenity: rAccommodationAmenityMock
            }
        });
        await expect(
            model.findWithRelations(
                { accommodationId: asAccommodationId('a') },
                { accommodation: true }
            )
        ).rejects.toThrow(DbError);
    });

    // ========================================================================
    // T-049: tx propagation for RAccommodationAmenityModel
    // ========================================================================
    describe('tx propagation', () => {
        it('countAccommodationsByAmenityIds() uses tx when provided', async () => {
            // Arrange
            const mockTx = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            groupBy: vi
                                .fn()
                                .mockResolvedValue([{ amenityId: asAmenityId('am1'), count: 3 }])
                        })
                    })
                })
            } as any;
            const spy = vi.spyOn(model as any, 'getClient');
            spy.mockReturnValue(mockTx);

            // Act
            const result = await model.countAccommodationsByAmenityIds(['am1'], mockTx);

            // Assert
            expect(spy).toHaveBeenCalledWith(mockTx);
            expect(dbUtils.getDb).not.toHaveBeenCalled();
            expect(result.get('am1')).toBe(3);

            spy.mockRestore();
        });

        it('findWithRelations() uses tx when provided (with relations branch)', async () => {
            // Arrange
            const findFirst = vi.fn().mockResolvedValue(null);
            const mockTx = { query: { rAccommodationAmenity: { findFirst } } } as any;
            const spy = vi.spyOn(model as any, 'getClient');
            spy.mockReturnValue(mockTx);

            // Act
            await model.findWithRelations(
                { accommodationId: asAccommodationId('a') },
                { accommodation: true },
                mockTx
            );

            // Assert
            expect(spy).toHaveBeenCalledWith(mockTx);
            expect(dbUtils.getDb).not.toHaveBeenCalled();

            spy.mockRestore();
        });
    });
});
