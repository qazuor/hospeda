import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { FeatureModel } from '../../src/models/accommodation/feature.model';

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn(),
    dbLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

/**
 * HOS-2068: rows with equal sort values must keep a stable order across pages,
 * so `findAll` accepts a deterministic tie-break column after `sortBy`.
 */
describe('BaseModel.findAll thenSortBy', () => {
    let orderBy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        orderBy = vi.fn();
        const qb = {
            orderBy: (...args: unknown[]) => {
                orderBy(...args);
                return qb;
            },
            limit: () => ({ offset: () => Promise.resolve([]) }),
            $dynamic: () => qb
        };
        vi.spyOn(dbUtils, 'getDb').mockReturnValue({
            select: (args?: unknown) => ({
                from: () => ({
                    where: () =>
                        args && typeof args === 'object' && 'count' in args
                            ? Promise.resolve([{ count: '0' }])
                            : qb
                })
            })
        } as never);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('orders by sortBy then by the tie-break column', async () => {
        await new FeatureModel().findAll(
            {},
            { sortBy: 'displayWeight', sortOrder: 'desc', thenSortBy: 'slug' }
        );

        expect(orderBy).toHaveBeenCalledTimes(1);
        expect(orderBy.mock.calls[0]).toHaveLength(2);
    });

    it('orders by sortBy only when no tie-break is given', async () => {
        await new FeatureModel().findAll({}, { sortBy: 'displayWeight', sortOrder: 'desc' });

        expect(orderBy.mock.calls[0]).toHaveLength(1);
    });

    it('does not order at all without sortBy, even with a tie-break', async () => {
        await new FeatureModel().findAll({}, { thenSortBy: 'slug' });

        expect(orderBy).not.toHaveBeenCalled();
    });
});
