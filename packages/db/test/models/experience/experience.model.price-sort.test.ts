/**
 * Unit tests for the price sort of `ExperienceModel` (HOS-1943).
 *
 * An experience "a consultar" stores `price_from = NULL`. Postgres puts NULLs
 * first under `DESC`, so without `nullsLastSortColumns` a listing with no price
 * would head a "most expensive first" sort. These tests capture the ORDER BY the
 * model hands to Drizzle and render it to SQL text.
 *
 * Uses a mocked Drizzle client (`vi.spyOn(dbUtils, 'getDb')`) per the project
 * convention — no real DB connection required.
 */
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../../src/client';
import { ExperienceModel } from '../../../src/models/experience/experience.model';

vi.mock('../../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

const dialect = new PgDialect();

/** Builds a chainable select mock and returns the spy that receives ORDER BY. */
function mockSelectChain(getDb: ReturnType<typeof vi.fn>): ReturnType<typeof vi.fn> {
    const offset = vi.fn().mockResolvedValue([]);
    const limit = vi.fn().mockReturnValue({ offset });
    const orderBy = vi.fn().mockReturnValue({ limit });
    const dynamic = vi.fn().mockReturnValue({ orderBy, limit });
    const where = vi.fn().mockReturnValue({ $dynamic: dynamic });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    getDb.mockReturnValue({ select });
    return orderBy;
}

describe('ExperienceModel price sort (HOS-1943)', () => {
    let model: ExperienceModel;
    let getDb: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new ExperienceModel();
        vi.clearAllMocks();
        getDb = vi.spyOn(dbUtils, 'getDb') as ReturnType<typeof vi.fn>;
        vi.spyOn(model, 'count').mockResolvedValue(0);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('puts a NULL price last on a descending price sort', async () => {
        // Arrange
        const orderBy = mockSelectChain(getDb);

        // Act
        await model.findAll({}, { sortBy: 'priceFrom', sortOrder: 'desc' });

        // Assert
        const clause = orderBy.mock.calls[0]?.[0] as SQL;
        expect(dialect.sqlToQuery(clause).sql).toBe('"experiences"."price_from" desc nulls last');
    });

    it('puts a NULL price last on an ascending price sort', async () => {
        // Arrange
        const orderBy = mockSelectChain(getDb);

        // Act
        await model.findAll({}, { sortBy: 'priceFrom', sortOrder: 'asc' });

        // Assert
        const clause = orderBy.mock.calls[0]?.[0] as SQL;
        expect(dialect.sqlToQuery(clause).sql).toBe('"experiences"."price_from" asc nulls last');
    });

    it('leaves other columns on the default NULL placement', async () => {
        // Arrange
        const orderBy = mockSelectChain(getDb);

        // Act
        await model.findAll({}, { sortBy: 'name', sortOrder: 'desc' });

        // Assert
        const clause = orderBy.mock.calls[0]?.[0] as SQL;
        expect(dialect.sqlToQuery(clause).sql.toLowerCase()).not.toContain('nulls last');
    });
});
