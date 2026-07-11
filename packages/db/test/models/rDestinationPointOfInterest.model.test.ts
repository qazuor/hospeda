import type { DestinationIdType, PointOfInterestIdType } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { RDestinationPointOfInterestModel } from '../../src/models/destination/rDestinationPointOfInterest.model';
import { DbError } from '../../src/utils/error';
import { createDrizzleRelationMock } from '../utils/drizzle-mock';

vi.mock('../../src/utils/logger');

const model = new RDestinationPointOfInterestModel();
const asDestinationId = (id: string) => id as unknown as DestinationIdType;
const asPointOfInterestId = (id: string) => id as unknown as PointOfInterestIdType;

/**
 * Test suite for RDestinationPointOfInterestModel.
 * Uses '@ts-expect-error' in Drizzle mocks because it is not possible to replicate the full
 * RelationalQueryBuilder interface in tests. Only the used methods (findFirst, etc.) are
 * mocked. This mirrors RDestinationAttractionModel's test suite (HOS-113 T-016).
 */

describe('RDestinationPointOfInterestModel', () => {
    beforeEach(() => {
        vi.spyOn(dbUtils, 'getDb');
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('findWithRelations - relacion encontrada', async () => {
        const rDestinationPointOfInterestMock = createDrizzleRelationMock({
            findFirst: vi.fn().mockResolvedValue({
                destinationId: asDestinationId('a'),
                pointOfInterestId: asPointOfInterestId('b'),
                destination: {},
                pointOfInterest: {}
            })
        });
        vi.mocked(dbUtils.getDb).mockReturnValue({
            query: {
                // @ts-expect-error: mock Drizzle relation for test
                rDestinationPointOfInterest: rDestinationPointOfInterestMock
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
        const dummy = {
            destinationId: asDestinationId('a'),
            pointOfInterestId: asPointOfInterestId('b'),
            isHighlighted: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: 'test-user',
            updatedById: 'test-user'
        };
        const spy = vi.spyOn(model, 'findOne').mockResolvedValue(dummy);
        const result = await model.findWithRelations({ destinationId: asDestinationId('a') }, {});
        expect(spy).toHaveBeenCalled();
        expect(result).toBeTruthy();
    });

    it('findWithRelations - no encontrada', async () => {
        const rDestinationPointOfInterestMock = createDrizzleRelationMock({
            findFirst: vi.fn().mockResolvedValue(null)
        });
        vi.mocked(dbUtils.getDb).mockReturnValue({
            query: {
                // @ts-expect-error: mock Drizzle relation for test
                rDestinationPointOfInterest: rDestinationPointOfInterestMock
            }
        });
        const result = await model.findWithRelations(
            { destinationId: asDestinationId('x') },
            { destination: true }
        );
        expect(result).toBeNull();
    });

    it('findWithRelations - error de DB', async () => {
        const rDestinationPointOfInterestMock = createDrizzleRelationMock({
            findFirst: vi.fn().mockRejectedValue(new Error('fail'))
        });
        vi.mocked(dbUtils.getDb).mockReturnValue({
            query: {
                // @ts-expect-error: mock Drizzle relation for test
                rDestinationPointOfInterest: rDestinationPointOfInterestMock
            }
        });
        await expect(
            model.findWithRelations({ destinationId: asDestinationId('a') }, { destination: true })
        ).rejects.toThrow(DbError);
    });

    // ========================================================================
    // HOS-113 T-016: tx propagation for RDestinationPointOfInterestModel
    // ========================================================================
    describe('tx propagation', () => {
        it('findWithRelations() uses tx when provided (with relations branch)', async () => {
            // Arrange
            const findFirst = vi.fn().mockResolvedValue(null);
            const mockTx = { query: { rDestinationPointOfInterest: { findFirst } } } as any;
            const spy = vi.spyOn(model as any, 'getClient');
            spy.mockReturnValue(mockTx);

            // Act
            await model.findWithRelations(
                { destinationId: asDestinationId('d1') },
                { destination: true },
                mockTx
            );

            // Assert
            expect(spy).toHaveBeenCalledWith(mockTx);
            expect(dbUtils.getDb).not.toHaveBeenCalled();

            spy.mockRestore();
        });

        it('findWithRelations() threads tx to findOne in fallback branch', async () => {
            // Arrange
            const mockTx = {} as any;
            const findOneSpy = vi.spyOn(model, 'findOne').mockResolvedValue(null);
            const spy = vi.spyOn(model as any, 'getClient');
            spy.mockReturnValue(mockTx);

            // Act
            await model.findWithRelations({ destinationId: asDestinationId('d1') }, {}, mockTx);

            // Assert
            expect(findOneSpy).toHaveBeenCalledWith(
                { destinationId: asDestinationId('d1') },
                mockTx
            );

            spy.mockRestore();
            findOneSpy.mockRestore();
        });
    });
});
