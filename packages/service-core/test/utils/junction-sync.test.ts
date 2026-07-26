/**
 * HOS-321 — direct tests for the shared junction-sync primitives.
 *
 * The accommodation and commerce sync modules both drive these, but their own
 * suites only ever pass an accommodation-shaped `where`. The whole reason these
 * live in `utils/` is that the `where` is generic — commerce passes
 * `{ [entityFkColumn]: entityId }` — so that generality needs coverage here or
 * it has none anywhere.
 */

import type { DrizzleClient } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { readAllJunctionRows, validateCatalogIds } from '../../src/utils/junction-sync';

const tx = {} as DrizzleClient;

/** Matches the model's real ceiling, which the helper pages against. */
const PAGE_SIZE = 200;

/**
 * Junction-model stub that paginates exactly like `BaseModelImpl.findAll`:
 * `page` defaults to 1, `pageSize` defaults to 20 and is clamped at 200.
 */
function createPaginatingModel<TRow>(rows: readonly TRow[]) {
    return {
        findAll: vi.fn(
            async (
                _where: Record<string, unknown>,
                options?: { page?: number; pageSize?: number }
            ) => {
                const page = options?.page ?? 1;
                const pageSize = Math.min(options?.pageSize ?? 20, PAGE_SIZE);
                const offset = (page - 1) * pageSize;
                return { items: rows.slice(offset, offset + pageSize), total: rows.length };
            }
        )
    };
}

describe('readAllJunctionRows', () => {
    it('reads the full set with a non-accommodation `where` (the commerce shape)', async () => {
        const rows = Array.from({ length: 45 }, (_, i) => ({
            gastronomyId: 'gastro-1',
            amenityId: `am-${i}`
        }));
        const junctionModel = createPaginatingModel(rows);

        const result = await readAllJunctionRows({
            where: { gastronomyId: 'gastro-1' },
            junctionModel,
            sortBy: 'amenityId',
            tx
        });

        expect(result).toHaveLength(45);
        expect(junctionModel.findAll).toHaveBeenCalledWith(
            { gastronomyId: 'gastro-1' },
            expect.objectContaining({ pageSize: PAGE_SIZE, sortBy: 'amenityId', sortOrder: 'asc' }),
            undefined,
            tx
        );
    });

    it('asks for a page size ABOVE the model default of 20', async () => {
        // The load-bearing half of the HOS-321 read fix: the default 20 is what
        // truncated the current set and corrupted the exact-set diff.
        const rows = Array.from({ length: 45 }, (_, i) => ({ amenityId: `am-${i}` }));
        const junctionModel = createPaginatingModel(rows);

        const result = await readAllJunctionRows({
            where: { accommodationId: 'acc-1' },
            junctionModel,
            sortBy: 'amenityId',
            tx
        });

        expect(result).toHaveLength(45);
    });

    it('accumulates across pages when the set exceeds one page', async () => {
        const rows = Array.from({ length: 250 }, (_, i) => ({ amenityId: `am-${i}` }));
        const junctionModel = createPaginatingModel(rows);

        const result = await readAllJunctionRows({
            where: { accommodationId: 'acc-1' },
            junctionModel,
            sortBy: 'amenityId',
            tx
        });

        expect(result).toHaveLength(250);
        // 250 rows over a 200-row page: page 1 is full, page 2 is short and
        // ends the loop. Asserting the sequence keeps the loop from silently
        // degrading back into a single truncated read.
        const pages = junctionModel.findAll.mock.calls.map(
            (call) => (call[1] as { page: number }).page
        );
        expect(pages).toEqual([1, 2]);
    });

    it('ignores `total` entirely', async () => {
        // `findAll` runs its count and its rows as SEPARATE statements, so under
        // READ COMMITTED `total` can disagree with what was read. Termination
        // must not depend on it — a `total` of 9999 changes nothing here.
        const junctionModel = {
            findAll: vi.fn(async () => ({ items: [{ amenityId: 'am-1' }], total: 9999 }))
        };

        const result = await readAllJunctionRows({
            where: { accommodationId: 'acc-1' },
            junctionModel,
            sortBy: 'amenityId',
            tx
        });

        expect(result).toEqual([{ amenityId: 'am-1' }]);
        expect(junctionModel.findAll).toHaveBeenCalledTimes(1);
    });

    it('throws instead of hanging when the model ignores `page`', async () => {
        const fullPage = Array.from({ length: PAGE_SIZE }, (_, i) => ({ amenityId: `am-${i}` }));
        const junctionModel = { findAll: vi.fn(async () => ({ items: fullPage, total: 9999 })) };

        await expect(
            readAllJunctionRows({
                where: { accommodationId: 'acc-1' },
                junctionModel,
                sortBy: 'amenityId',
                tx
            })
        ).rejects.toMatchObject({ code: ServiceErrorCode.INTERNAL_ERROR });
    });

    it('refuses an empty `where` instead of paging the whole table', async () => {
        const junctionModel = createPaginatingModel([{ amenityId: 'am-1' }]);

        await expect(
            readAllJunctionRows({ where: {}, junctionModel, sortBy: 'amenityId', tx })
        ).rejects.toMatchObject({ code: ServiceErrorCode.INTERNAL_ERROR });

        expect(junctionModel.findAll).not.toHaveBeenCalled();
    });
});

describe('validateCatalogIds', () => {
    it('validates the whole set in ONE call', async () => {
        const ids = ['a', 'b', 'c'];
        const findByIds = vi.fn(async (requested: readonly string[]) =>
            requested.map((id) => ({ id }))
        );

        await validateCatalogIds({ ids, findByIds, entityLabel: 'amenity', tx });

        expect(findByIds).toHaveBeenCalledTimes(1);
        expect(findByIds).toHaveBeenCalledWith(ids, tx);
    });

    it('reports the FIRST unknown id in the caller order, not the DB order', async () => {
        // The message has to be reproducible regardless of how the DB ordered
        // its result set.
        const findByIds = vi.fn(async (requested: readonly string[]) =>
            requested.filter((id) => id !== 'b' && id !== 'c').map((id) => ({ id }))
        );

        await expect(
            validateCatalogIds({ ids: ['a', 'b', 'c'], findByIds, entityLabel: 'feature', tx })
        ).rejects.toMatchObject({
            code: ServiceErrorCode.VALIDATION_ERROR,
            message: 'feature not found: b'
        });
    });

    it('does not query at all for an empty id list', async () => {
        const findByIds = vi.fn();

        await validateCatalogIds({ ids: [], findByIds, entityLabel: 'amenity', tx });

        expect(findByIds).not.toHaveBeenCalled();
    });
});
