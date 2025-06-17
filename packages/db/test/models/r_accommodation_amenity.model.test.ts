import type { AccommodationAmenityType, AccommodationId, AmenityId } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../../src/client';
import { RAccommodationAmenityModel } from '../../src/models/accommodation/rAccommodationAmenity.model';
import { DbError } from '../../src/utils/error';
import { createDrizzleRelationMock } from '../utils/drizzle-mock';

vi.mock('../../src/client');
vi.mock('../../src/utils/logger');

const model = new RAccommodationAmenityModel();
const asAccommodationId = (id: string) => id as unknown as AccommodationId;
const asAmenityId = (id: string) => id as unknown as AmenityId;

/**
 * Test suite for RAccommodationAmenityModel.
 * Uses '@ts-expect-error' in Drizzle mocks because it is not possible to replicate the full RelationalQueryBuilder interface in tests. Only the used methods (findFirst, etc.) are mocked.
 * This is documented and justified according to project rules.
 */

describe('RAccommodationAmenityModel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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
        vi.mocked(getDb).mockReturnValue({
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
        const dummy: AccommodationAmenityType = {
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
        vi.mocked(getDb).mockReturnValue({
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
        vi.mocked(getDb).mockReturnValue({
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
});
