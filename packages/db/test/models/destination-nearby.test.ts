/**
 * Unit tests for DestinationModel.findNearby (HOS-111 T-011).
 *
 * Mirrors the mocked-DB testing convention used throughout
 * `test/models/destination.hierarchy.test.ts`: `getDb()` is spied and the
 * Drizzle query-builder chain (`select().from().where().orderBy().limit()`)
 * is stubbed per test. `model.findOne` (used to load the anchor destination)
 * is spied directly rather than mocked through the chain, since it goes
 * through `BaseModelImpl`.
 *
 * Scenarios:
 * - Radius hit: the radius pass returns rows → returned as-is, no fallback query.
 * - Empty-radius fallback: the radius pass returns zero rows → falls back to
 *   the N-nearest query (OQ-2 — a "destinos cercanos" follow-up never comes
 *   back empty).
 * - Null-coordinate exclusion: anchor destination without coordinates → `[]`
 *   with no query issued (nothing to compute distance from).
 * - Anchor not found → `[]`.
 * - DB failure → throws `DbError` and logs.
 *
 * @module packages/db/test/models/destination-nearby
 */

import type { Destination } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import {
    DestinationModel,
    NEARBY_DESTINATION_FALLBACK_COUNT,
    NEARBY_DESTINATION_RADIUS_KM
} from '../../src/models/destination/destination.model';
import { DbError } from '../../src/utils/error';
import * as logger from '../../src/utils/logger';

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

const ANCHOR_ID = 'anchor-destination-1';

const anchorWithCoordinates: Partial<Destination> = {
    id: ANCHOR_ID,
    name: 'Colón',
    location: {
        state: 'Entre Ríos',
        country: 'Argentina',
        coordinates: { lat: '-32.2265', long: '-58.1382' }
    }
} as Partial<Destination>;

const anchorWithoutCoordinates: Partial<Destination> = {
    id: ANCHOR_ID,
    name: 'Colón',
    location: { state: 'Entre Ríos', country: 'Argentina' }
} as Partial<Destination>;

const mockNeighbor: Partial<Destination> = {
    id: 'neighbor-1',
    name: 'Concepción del Uruguay',
    location: {
        state: 'Entre Ríos',
        country: 'Argentina',
        coordinates: { lat: '-32.4825', long: '-58.2372' }
    }
} as Partial<Destination>;

describe('DestinationModel.findNearby', () => {
    let model: DestinationModel;
    let getDb: ReturnType<typeof vi.fn>;
    let logQuery: ReturnType<typeof vi.fn>;
    let logError: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new DestinationModel();
        logQuery = logger.logQuery as ReturnType<typeof vi.fn>;
        logError = logger.logError as ReturnType<typeof vi.fn>;
        vi.clearAllMocks();
        getDb = vi.spyOn(dbUtils, 'getDb') as ReturnType<typeof vi.fn>;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    /** Builds a fresh select().from().where().orderBy().limit() chain mock. */
    function mockSelectChain(resolvedRows: unknown[]) {
        const mockSelect = vi.fn();
        const mockFrom = vi.fn();
        const mockWhere = vi.fn();
        const mockOrderBy = vi.fn();
        const mockLimit = vi.fn();

        mockSelect.mockReturnValue({ from: mockFrom });
        mockFrom.mockReturnValue({ where: mockWhere });
        mockWhere.mockReturnValue({ orderBy: mockOrderBy });
        mockOrderBy.mockReturnValue({ limit: mockLimit });
        mockLimit.mockResolvedValue(resolvedRows);

        return { mockSelect, mockFrom, mockWhere, mockOrderBy, mockLimit };
    }

    it('radius hit: returns the radius-pass rows without querying the fallback', async () => {
        // Arrange
        vi.spyOn(model, 'findOne').mockResolvedValue(anchorWithCoordinates as Destination);
        const radiusChain = mockSelectChain([mockNeighbor]);
        getDb.mockReturnValue({ select: radiusChain.mockSelect });

        // Act
        const result = await model.findNearby({ destinationId: ANCHOR_ID });

        // Assert
        expect(result).toEqual([mockNeighbor]);
        expect(radiusChain.mockSelect).toHaveBeenCalledTimes(1);
        expect(radiusChain.mockLimit).toHaveBeenCalledTimes(1);
        expect(logQuery).toHaveBeenCalledWith(
            'destinations',
            'findNearby',
            expect.objectContaining({ destinationId: ANCHOR_ID, strategy: 'radius' }),
            [mockNeighbor]
        );
    });

    it('empty-radius fallback: falls back to the N-nearest query when the radius pass is empty', async () => {
        // Arrange
        vi.spyOn(model, 'findOne').mockResolvedValue(anchorWithCoordinates as Destination);

        const radiusSelect = vi.fn();
        const radiusFrom = vi.fn();
        const radiusWhere = vi.fn();
        const radiusOrderBy = vi.fn();
        const radiusLimit = vi.fn();
        radiusSelect.mockReturnValue({ from: radiusFrom });
        radiusFrom.mockReturnValue({ where: radiusWhere });
        radiusWhere.mockReturnValue({ orderBy: radiusOrderBy });
        radiusOrderBy.mockReturnValue({ limit: radiusLimit });
        radiusLimit.mockResolvedValueOnce([]); // radius pass: empty

        const fallbackSelect = vi.fn();
        const fallbackFrom = vi.fn();
        const fallbackWhere = vi.fn();
        const fallbackOrderBy = vi.fn();
        const fallbackLimit = vi.fn();
        fallbackSelect.mockReturnValue({ from: fallbackFrom });
        fallbackFrom.mockReturnValue({ where: fallbackWhere });
        fallbackWhere.mockReturnValue({ orderBy: fallbackOrderBy });
        fallbackOrderBy.mockReturnValue({ limit: fallbackLimit });
        fallbackLimit.mockResolvedValueOnce([mockNeighbor]); // fallback pass: N-nearest

        // First select() call (radius) then second (fallback).
        const combinedSelect = vi
            .fn()
            .mockImplementationOnce(radiusSelect)
            .mockImplementationOnce(fallbackSelect);
        getDb.mockReturnValue({ select: combinedSelect });

        // Act
        const result = await model.findNearby({ destinationId: ANCHOR_ID, fallbackCount: 3 });

        // Assert
        expect(result).toEqual([mockNeighbor]);
        expect(combinedSelect).toHaveBeenCalledTimes(2);
        expect(fallbackLimit).toHaveBeenCalledWith(3);
        expect(logQuery).toHaveBeenCalledWith(
            'destinations',
            'findNearby',
            expect.objectContaining({ destinationId: ANCHOR_ID, strategy: 'fallback' }),
            [mockNeighbor]
        );
    });

    it('defaults fallbackCount to NEARBY_DESTINATION_FALLBACK_COUNT when not overridden', async () => {
        vi.spyOn(model, 'findOne').mockResolvedValue(anchorWithCoordinates as Destination);

        const radiusLimit = vi.fn().mockResolvedValueOnce([]);
        const radiusChainRest = { orderBy: vi.fn().mockReturnValue({ limit: radiusLimit }) };
        const radiusFrom = vi
            .fn()
            .mockReturnValue({ where: vi.fn().mockReturnValue(radiusChainRest) });
        const radiusSelect = vi.fn().mockReturnValue({ from: radiusFrom });

        const fallbackLimit = vi.fn().mockResolvedValueOnce([mockNeighbor]);
        const fallbackChainRest = { orderBy: vi.fn().mockReturnValue({ limit: fallbackLimit }) };
        const fallbackFrom = vi
            .fn()
            .mockReturnValue({ where: vi.fn().mockReturnValue(fallbackChainRest) });
        const fallbackSelect = vi.fn().mockReturnValue({ from: fallbackFrom });

        const combinedSelect = vi
            .fn()
            .mockImplementationOnce(radiusSelect)
            .mockImplementationOnce(fallbackSelect);
        getDb.mockReturnValue({ select: combinedSelect });

        await model.findNearby({ destinationId: ANCHOR_ID });

        expect(fallbackLimit).toHaveBeenCalledWith(NEARBY_DESTINATION_FALLBACK_COUNT);
    });

    it('uses NEARBY_DESTINATION_RADIUS_KM (50) as the default radius', () => {
        expect(NEARBY_DESTINATION_RADIUS_KM).toBe(50);
    });

    it('null-coordinate exclusion: returns [] when the anchor has no coordinates, without querying', async () => {
        // Arrange
        vi.spyOn(model, 'findOne').mockResolvedValue(anchorWithoutCoordinates as Destination);

        // Act
        const result = await model.findNearby({ destinationId: ANCHOR_ID });

        // Assert
        expect(result).toEqual([]);
        expect(getDb).not.toHaveBeenCalled();
    });

    it('returns [] when the anchor destination does not exist', async () => {
        // Arrange
        vi.spyOn(model, 'findOne').mockResolvedValue(null);

        // Act
        const result = await model.findNearby({ destinationId: 'missing-id' });

        // Assert
        expect(result).toEqual([]);
        expect(getDb).not.toHaveBeenCalled();
    });

    it('malformed-coordinate guard: returns [] (no query) when the anchor coordinate strings are non-numeric', async () => {
        // Arrange: coordinates present but not parseable — Number('abc') is NaN.
        // The `Number.isNaN` guard in findNearby must bail out BEFORE building
        // any SQL, so a garbage coordinate can never feed NaN into the Haversine
        // arithmetic (which would poison the ORDER BY / radius comparison).
        const anchorWithBadCoordinates: Partial<Destination> = {
            id: ANCHOR_ID,
            name: 'Colón',
            location: {
                state: 'Entre Ríos',
                country: 'Argentina',
                coordinates: { lat: 'abc', long: '-58' }
            }
        } as Partial<Destination>;
        vi.spyOn(model, 'findOne').mockResolvedValue(anchorWithBadCoordinates as Destination);

        // Act
        const result = await model.findNearby({ destinationId: ANCHOR_ID });

        // Assert
        expect(result).toEqual([]);
        expect(getDb).not.toHaveBeenCalled();
    });

    it('throws DbError and logs on database failure', async () => {
        // Arrange
        vi.spyOn(model, 'findOne').mockResolvedValue(anchorWithCoordinates as Destination);
        const error = new Error('Database connection failed');

        const mockSelect = vi.fn();
        const mockFrom = vi.fn();
        const mockWhere = vi.fn();
        const mockOrderBy = vi.fn();
        const mockLimit = vi.fn();
        mockSelect.mockReturnValue({ from: mockFrom });
        mockFrom.mockReturnValue({ where: mockWhere });
        mockWhere.mockReturnValue({ orderBy: mockOrderBy });
        mockOrderBy.mockReturnValue({ limit: mockLimit });
        mockLimit.mockRejectedValue(error);

        getDb.mockReturnValue({ select: mockSelect });

        // Act / Assert
        await expect(model.findNearby({ destinationId: ANCHOR_ID })).rejects.toThrow(DbError);
        expect(logError).toHaveBeenCalledWith(
            'destinations',
            'findNearby',
            { destinationId: ANCHOR_ID },
            error
        );
    });
});
