import type { AttractionId, DestinationAttractionType, DestinationId } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../../src/client';
import { RDestinationAttractionModel } from '../../src/models/destination/rDestinationAttraction.model';
import { DbError } from '../../src/utils/error';
import { createDrizzleRelationMock } from '../utils/drizzle-mock';

vi.mock('../../src/client');
vi.mock('../../src/utils/logger');

const model = new RDestinationAttractionModel();
const asDestinationId = (id: string) => id as unknown as DestinationId;
const asAttractionId = (id: string) => id as unknown as AttractionId;

/**
 * Test suite for RDestinationAttractionModel.
 * Uses '@ts-expect-error' in Drizzle mocks because it is not possible to replicate the full RelationalQueryBuilder interface in tests. Only the used methods (findFirst, etc.) are mocked.
 * This is documented and justified according to project rules.
 */

// This file uses '@ts-expect-error' in Drizzle mocks because it is not possible to replicate the full RelationalQueryBuilder interface in tests. Only the used methods (findFirst, etc.) are mocked.
// This is documented and justified according to project rules.

describe('RDestinationAttractionModel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('findWithRelations - relación encontrada', async () => {
        const rDestinationAttractionMock = createDrizzleRelationMock({
            findFirst: vi.fn().mockResolvedValue({
                destinationId: asDestinationId('a'),
                attractionId: asAttractionId('b'),
                destination: {},
                attraction: {}
            })
        });
        vi.mocked(getDb).mockReturnValue({
            query: {
                // @ts-ignore: mock Drizzle relation for test
                rDestinationAttraction: rDestinationAttractionMock
            }
        });
        const result = await model.findWithRelations(
            { destinationId: asDestinationId('a') },
            { destination: true }
        );
        expect(result).toBeTruthy();
        expect((result as { destination?: unknown }).destination).toBeDefined();
    });

    it('findWithRelations - sin relaciones, fallback a findOne', async () => {
        const dummy: DestinationAttractionType = {
            destinationId: asDestinationId('a'),
            attractionId: asAttractionId('b')
        };
        const spy = vi.spyOn(model, 'findOne').mockResolvedValue(dummy);
        const result = await model.findWithRelations({ destinationId: asDestinationId('a') }, {});
        expect(spy).toHaveBeenCalled();
        expect(result).toBeTruthy();
    });

    it('findWithRelations - no encontrada', async () => {
        const rDestinationAttractionMock = createDrizzleRelationMock({
            findFirst: vi.fn().mockResolvedValue(null)
        });
        vi.mocked(getDb).mockReturnValue({
            query: {
                // @ts-ignore: mock Drizzle relation for test
                rDestinationAttraction: rDestinationAttractionMock
            }
        });
        const result = await model.findWithRelations(
            { destinationId: asDestinationId('x') },
            { destination: true }
        );
        expect(result).toBeNull();
    });

    it('findWithRelations - error de DB', async () => {
        const rDestinationAttractionMock = createDrizzleRelationMock({
            findFirst: vi.fn().mockRejectedValue(new Error('fail'))
        });
        vi.mocked(getDb).mockReturnValue({
            query: {
                // @ts-ignore: mock Drizzle relation for test
                rDestinationAttraction: rDestinationAttractionMock
            }
        });
        await expect(
            model.findWithRelations({ destinationId: asDestinationId('a') }, { destination: true })
        ).rejects.toThrow(DbError);
    });
});
