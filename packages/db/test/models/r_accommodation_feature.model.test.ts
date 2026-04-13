import type { AccommodationIdType, FeatureIdType } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { RAccommodationFeatureModel } from '../../src/models/accommodation/rAccommodationFeature.model';
import { DbError } from '../../src/utils/error';
import { createDrizzleRelationMock } from '../utils/drizzle-mock';

vi.mock('../../src/utils/logger');

const model = new RAccommodationFeatureModel();
const asAccommodationId = (id: string) => id as unknown as AccommodationIdType;
const asFeatureId = (id: string) => id as unknown as FeatureIdType;

/**
 * Test suite for RAccommodationFeatureModel.
 * Uses '@ts-expect-error' in Drizzle mocks because it is not possible to replicate the full RelationalQueryBuilder interface in tests. Only the used methods (findFirst, etc.) are mocked.
 * This is documented and justified according to project rules.
 */

describe('RAccommodationFeatureModel', () => {
    beforeEach(() => {
        vi.spyOn(dbUtils, 'getDb');
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('findWithRelations - relación encontrada', async () => {
        const rAccommodationFeatureMock = createDrizzleRelationMock({
            findFirst: vi.fn().mockResolvedValue({
                accommodationId: asAccommodationId('a'),
                featureId: asFeatureId('b'),
                accommodation: {},
                feature: {}
            })
        });
        vi.mocked(dbUtils.getDb).mockReturnValue({
            query: {
                // @ts-ignore: mock Drizzle relation for test
                rAccommodationFeature: rAccommodationFeatureMock
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
            featureId: asFeatureId('b')
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
        const rAccommodationFeatureMock = createDrizzleRelationMock({
            findFirst: vi.fn().mockResolvedValue(null)
        });
        vi.mocked(dbUtils.getDb).mockReturnValue({
            query: {
                // @ts-ignore: mock Drizzle relation for test
                rAccommodationFeature: rAccommodationFeatureMock
            }
        });
        const result = await model.findWithRelations(
            { accommodationId: asAccommodationId('x') },
            { accommodation: true }
        );
        expect(result).toBeNull();
    });

    it('findWithRelations - error de DB', async () => {
        const rAccommodationFeatureMock = createDrizzleRelationMock({
            findFirst: vi.fn().mockRejectedValue(new Error('fail'))
        });
        vi.mocked(dbUtils.getDb).mockReturnValue({
            query: {
                // @ts-ignore: mock Drizzle relation for test
                rAccommodationFeature: rAccommodationFeatureMock
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
    // T-049: tx propagation for RAccommodationFeatureModel
    // ========================================================================
    describe('tx propagation', () => {
        it('countAccommodationsByFeatureIds() uses tx when provided', async () => {
            // Arrange
            const mockTx = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            groupBy: vi
                                .fn()
                                .mockResolvedValue([{ featureId: asFeatureId('ft1'), count: 2 }])
                        })
                    })
                })
            } as any;
            const spy = vi.spyOn(model as any, 'getClient');
            spy.mockReturnValue(mockTx);

            // Act
            const result = await model.countAccommodationsByFeatureIds(['ft1'], mockTx);

            // Assert
            expect(spy).toHaveBeenCalledWith(mockTx);
            expect(dbUtils.getDb).not.toHaveBeenCalled();
            expect(result.get('ft1')).toBe(2);

            spy.mockRestore();
        });

        it('findWithRelations() uses tx when provided (with relations branch)', async () => {
            // Arrange
            const findFirst = vi.fn().mockResolvedValue(null);
            const mockTx = { query: { rAccommodationFeature: { findFirst } } } as any;
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

// This file uses '@ts-expect-error' in Drizzle mocks because it is not possible to replicate the full RelationalQueryBuilder interface in tests. Only the used methods (findFirst, etc.) are mocked.
// This is documented and justified according to project rules.
